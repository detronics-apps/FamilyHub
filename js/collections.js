// A mini-app's records in the folder: one compact index plus one file per record.
//
//   Data/<app-id>/<collection>/index.json        { kind, app, collection, schema, entries }
//   Data/<app-id>/<collection>/records/<id>.json  the full record
//
// The index holds a short summary and search text per record, so listing and
// searching read ONE file however many records there are; a full record is read
// only when it is opened. Deleted records stay in the index as tombstones so a
// deletion on one device is not undone by another device's older index.
//
// Records always carry: id, rev (counts edits), createdAt, updatedAt, schema.

import { stableStringify, walk } from './folder-store.js';
import { mergeRecord3 } from './merge.js';

export const INDEX_KIND = 'family-hub-index';

const ID = /^[a-z0-9][a-z0-9_-]{2,63}$/i;

export function newRecordId(prefix = 'r') {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/** Lower-case words, accents folded, for matching. */
export function words(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(Boolean);
}

export class CollectionConflict extends Error {
  constructor(id, conflicts, mine, theirs, merged) {
    super('This record was changed somewhere else at the same time.');
    this.id = id;
    this.conflicts = conflicts;
    this.mine = mine;
    this.theirs = theirs;
    this.merged = merged;
  }
}

/**
 * @param store  a folder store (folder-store.js)
 * @param spec   { app, name, schema = 1, summary(record) -> object, text(record) -> string, now() }
 */
export function createCollection(store, spec) {
  const { app, name } = spec;
  const schema = spec.schema ?? 1;
  const summarise = spec.summary ?? ((r) => ({ title: r.title ?? r.name ?? '' }));
  const textOf = spec.text ?? ((r) => Object.values(summarise(r)).join(' '));
  const now = spec.now ?? (() => new Date().toISOString());
  const dir = `Data/${app}/${name}`;
  const indexPath = `${dir}/index.json`;
  const recordPath = (id) => `${dir}/records/${id}.json`;

  let index = null;          // { entries } as last read or written
  const bases = new Map();   // id -> record as last read, for three-way merges

  const emptyIndex = () => ({ kind: INDEX_KIND, app, collection: name, schema, entries: {} });

  async function readIndex() {
    const text = await store.read(indexPath);
    if (!text) return emptyIndex();
    const parsed = JSON.parse(text);
    if (parsed.kind !== INDEX_KIND) throw new Error(`${indexPath} is not a Family Hub index.`);
    if (parsed.schema > schema) {
      throw new Error(`${name} data was written by a newer version of this mini-app (data version ${parsed.schema}).`);
    }
    return { ...emptyIndex(), ...parsed, schema };
  }

  /** Merge two indexes entry by entry: the higher rev wins, tombstones included. */
  function mergeIndex(a, b) {
    const out = { ...a, entries: { ...a.entries } };
    for (const [id, e] of Object.entries(b.entries)) {
      const mine = out.entries[id];
      if (!mine || (e.rev ?? 0) > (mine.rev ?? 0)) out.entries[id] = e;
    }
    return out;
  }

  async function saveIndexEntry(id, entry) {
    // Re-read right before writing so another device's new entries are kept.
    const fresh = mergeIndex(await readIndex(), index ?? emptyIndex());
    fresh.entries[id] = entry;
    await store.write(indexPath, stableStringify(fresh));
    index = fresh;
  }

  const entryFor = (r) => ({ rev: r.rev, updatedAt: r.updatedAt, s: summarise(r), t: words(textOf(r)).join(' ') });
  const live = () => Object.entries(index.entries).filter(([, e]) => !e.deleted);

  return {
    app,
    name,
    schema,

    /** Read the index (once; `refresh` re-reads it). */
    async load({ refresh = false } = {}) {
      if (!index || refresh) index = await readIndex();
      return this;
    },

    async count() { await this.load(); return live().length; },

    /** Summaries, filtered and paged. `filter(summary, id)`; `sort(a, b)` on summaries. */
    async list({ filter = null, sort = null, offset = 0, limit = 50 } = {}) {
      await this.load();
      let items = live().map(([id, e]) => ({ id, rev: e.rev, updatedAt: e.updatedAt, ...e.s }));
      if (filter) items = items.filter((s) => filter(s, s.id));
      items.sort(sort ?? ((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
      return { total: items.length, items: items.slice(offset, offset + limit) };
    },

    /** Every word of the query must appear in the record's search text. Reads only the index. */
    async search(query, { filter = null, offset = 0, limit = 50 } = {}) {
      await this.load();
      const q = words(query);
      let items = live()
        .filter(([, e]) => q.every((w) => e.t.includes(w)))
        .map(([id, e]) => ({ id, rev: e.rev, updatedAt: e.updatedAt, ...e.s }));
      if (filter) items = items.filter((s) => filter(s, s.id));
      items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return { total: items.length, items: items.slice(offset, offset + limit) };
    },

    /** The full record, read from its own file. Null if deleted or missing. */
    async get(id) {
      if (!ID.test(id)) return null;
      const text = await store.read(recordPath(id));
      if (!text) return null;
      const record = JSON.parse(text);
      bases.set(id, record);
      return record;
    },

    /**
     * Save a record. New records get an id. If the stored copy moved on since this
     * one was read, a three-way merge keeps both sides' changes; if the same field
     * changed on both, a CollectionConflict is thrown and nothing is written.
     */
    async put(input, { force = false } = {}) {
      await this.load();
      const t = now();
      const id = input.id && ID.test(input.id) ? input.id : newRecordId(spec.prefix ?? name.slice(0, 3));
      const stored = input.id ? JSON.parse((await store.read(recordPath(id))) || 'null') : null;
      const base = bases.get(id) ?? null;
      let record = { ...input, id, schema };

      if (stored && !force && base && stored.rev !== base.rev) {
        const r = mergeRecord3(base, record, stored);
        if (r.conflicts.length) throw new CollectionConflict(id, r.conflicts, record, stored, r.merged);
        record = r.merged;
      }
      record.rev = Math.max(stored?.rev ?? 0, input.rev ?? 0) + 1;
      record.createdAt = stored?.createdAt ?? input.createdAt ?? t;
      record.updatedAt = t;

      await store.write(recordPath(id), stableStringify(record));
      bases.set(id, record);
      await saveIndexEntry(id, entryFor(record));
      return record;
    },

    /** Delete: the record file goes, a tombstone stays in the index. */
    async remove(id) {
      await this.load();
      const e = index.entries[id];
      if (!e || e.deleted) return false;
      await store.remove(recordPath(id));
      bases.delete(id);
      await saveIndexEntry(id, { rev: (e.rev ?? 0) + 1, updatedAt: now(), deleted: true });
      return true;
    },

    /**
     * Repair: rebuild the index from the record files (for files added, renamed,
     * or removed by hand in Drive). Reports what it found.
     */
    async rebuildIndex() {
      const old = await readIndex();
      const files = (await store.list(`${dir}/records`)) ?? [];
      const fresh = emptyIndex();
      const report = { records: 0, unreadable: [], recovered: [], missing: [] };
      for (const f of files) {
        if (f.kind !== 'file' || !f.name.endsWith('.json')) continue;
        try {
          const text = await store.read(`${dir}/records/${f.name}`);
          const r = JSON.parse(text);
          if (!r?.id || !ID.test(r.id)) throw new Error('no id');
          if (`${r.id}.json` !== f.name) {
            // Renamed by hand: the identity is inside the file, so put it back where it belongs.
            await store.write(recordPath(r.id), text);
            await store.remove(`${dir}/records/${f.name}`);
            report.recovered.push(f.name);
          }
          fresh.entries[r.id] = entryFor(r);
          report.records += 1;
        } catch {
          report.unreadable.push(f.name);
        }
      }
      for (const [id, e] of Object.entries(old.entries)) {
        if (e.deleted && !fresh.entries[id]) fresh.entries[id] = e;
        else if (!e.deleted && !fresh.entries[id]) report.missing.push(id);
      }
      await store.write(indexPath, stableStringify(fresh));
      index = fresh;
      return report;
    },

    /** Every live record in full - for export and backup only, never for a screen. */
    async exportAll() {
      await this.load();
      const out = [];
      for (const [id] of live()) {
        const r = await this.get(id);
        if (r) out.push(r);
      }
      return out;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Moving mini-app data between stores - this device <-> the Drive folder -
 * without losing anything: a record is copied only where the target has no
 * copy or an older one (lower rev); indexes are merged entry by entry.
 * The household and chores files are not touched here (folder-sync.js owns them).
 * ------------------------------------------------------------------ */

const OWNED_ELSEWHERE = [/^Data\/household\//, /^Data\/chores\/(chores\.json|events\/)/, /^Data\/Media\//];

export async function copyAppData(from, to) {
  const report = { copied: 0, merged: 0, kept: 0, skipped: [] };
  const paths = (await walk(from, 'Data')).filter((p) => !OWNED_ELSEWHERE.some((re) => re.test(p)));
  for (const path of paths) {
    const src = await from.read(path);
    if (src == null) continue;
    const dst = await to.read(path);
    if (dst == null) { await to.write(path, src); report.copied += 1; continue; }
    if (dst === src) continue;
    try {
      const a = JSON.parse(src);
      const b = JSON.parse(dst);
      if (path.endsWith('/index.json') && a.kind === INDEX_KIND && b.kind === INDEX_KIND) {
        const merged = { ...b, entries: { ...b.entries } };
        for (const [id, e] of Object.entries(a.entries ?? {})) {
          if (!merged.entries[id] || (e.rev ?? 0) > (merged.entries[id].rev ?? 0)) merged.entries[id] = e;
        }
        await to.write(path, stableStringify(merged));
        report.merged += 1;
      } else if ((a.rev ?? 0) > (b.rev ?? 0)) {
        await to.write(path, src);
        report.copied += 1;
      } else {
        report.kept += 1;     // the target's copy is as new or newer
      }
    } catch {
      report.skipped.push(path);
    }
  }
  return report;
}
