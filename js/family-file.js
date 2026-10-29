// The family file: everything in one JSON file - the household, the installed
// mini-apps, and every mini-app's records. It is
//   - what a phone saves to Drive and opens from Drive (D-014),
//   - the backup format (Backups/ in the folder),
//   - the portable export.
//
// { kind: 'family-hub-family-file', format: 1, exportedAt, household, registry,
//   base?, files: { 'Data/tasks/tasks/index.json': '...', ... } }
//
// `base` is the household the sender last agreed with (the copy it opened), so the
// receiver can tell "deleted on the phone" from "added on the laptop" (D-052).
//
// Mini-app data travels as its own files, so importing it reuses copyAppData:
// newer records win by rev, indexes merge, nothing is lost.

import { migrate } from './model.js';
import { normaliseRegistry } from './miniapps.js';
import { createMemoryStore, walk } from './folder-store.js';
import { EXPORT_KIND } from './storage.js';

export const FAMILY_FILE_KIND = 'family-hub-family-file';
export const FAMILY_FILE_FORMAT = 1;

const APP_DATA = (p) => p.startsWith('Data/') && !/^Data\/(household\/|chores\/(chores\.json|events\/)|Media\/)/.test(p);

/** Gather the mini-app files from a store (this device's or the folder). */
export async function collectAppFiles(store) {
  const files = {};
  for (const p of (await walk(store, 'Data')).filter(APP_DATA)) {
    const text = await store.read(p);
    if (text != null) files[p] = text;
  }
  return files;
}

export function buildFamilyFile({ household, registry, files = {}, base = null, baseFiles = null, now = new Date() }) {
  return JSON.stringify({
    kind: FAMILY_FILE_KIND,
    format: FAMILY_FILE_FORMAT,
    exportedAt: now.toISOString(),
    household,
    registry: normaliseRegistry(registry),
    ...(base ? { base } : {}),
    ...(base && baseFiles ? { baseFiles } : {}),   // the mini-app records it started from (D-082)
    files,
  });
}

/** Where laptops keep the copy for phones, and where phones send theirs back (D-052). */
export const PHONE_DIR = 'Phone';
export const PHONE_FILE = 'Family Hub.json';
/** A file a phone sent back: any family file in Phone/ but the laptops' own copy. */
export const isFromPhone = (name) => /\.json$/i.test(name) && name !== PHONE_FILE;

export function familyFileName(household, now = new Date()) {
  const slug = household.household.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'household';
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `family-hub-${slug}-${stamp}.json`;
}

/**
 * Read a family file (or an older household-only export). Checks everything
 * before anything is replaced.
 */
export function parseFamilyFile(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ['This file is not valid JSON, so it is not a Family Hub file.'] }; }
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['This file does not contain a household.'] };

  if (raw.kind === EXPORT_KIND || raw.kind === undefined) {
    // A v0.1 export: the household only.
    try {
      const household = migrate(raw.kind === EXPORT_KIND ? raw.data : raw);
      return { ok: true, household, registry: null, files: new Map(), exportedAt: raw.exportedAt ?? null, legacy: true };
    } catch (err) { return { ok: false, errors: [err.message] }; }
  }
  if (raw.kind !== FAMILY_FILE_KIND) return { ok: false, errors: ['This JSON file was not made by Family Hub.'] };
  if (raw.format > FAMILY_FILE_FORMAT) return { ok: false, errors: [`This file was made by a newer version of Family Hub (format ${raw.format}). Update the app first.`] };

  const errors = [];
  let household = null;
  try { household = migrate(raw.household); } catch (err) { errors.push(err.message); }
  const files = new Map();
  for (const [p, t] of Object.entries(raw.files && typeof raw.files === 'object' ? raw.files : {})) {
    if (!APP_DATA(p) || /(^|\/)\.\.(\/|$)/.test(p) || typeof t !== 'string') { errors.push(`Unexpected entry "${p}" in the file.`); continue; }
    files.set(p, t);
  }
  if (errors.length) return { ok: false, errors };
  let base = null;
  try { base = raw.base ? migrate(raw.base) : null; } catch { base = null; }   // a bad base only loses the deletions it would have told us about
  // Only well-formed entries; a bad one just means that record falls back to newer-wins.
  const baseFiles = base && raw.baseFiles && typeof raw.baseFiles === 'object'
    ? new Map(Object.entries(raw.baseFiles).filter(([p, t]) => APP_DATA(p) && !/(^|\/)\.\.(\/|$)/.test(p) && typeof t === 'string'))
    : null;
  return { ok: true, household, registry: raw.registry ? normaliseRegistry(raw.registry) : null, files, base, baseFiles, exportedAt: raw.exportedAt ?? null, legacy: false };
}

/** The mini-app files of a parsed family file, as a store copyAppData can read. */
export const filesAsStore = (parsed) => createMemoryStore(parsed.files);

/** A short, plain description of what a file holds, for the "Are you sure?" step. */
export function describeFamilyFile(parsed) {
  const h = parsed.household;
  const records = [...parsed.files.keys()].filter((p) => p.includes('/records/')).length;
  return `${h.household.name}: ${h.people.length} people, ${h.chores.length} chores, ${h.events.length} chore records`
    + (records ? `, and ${records} mini-app records` : '')
    + (parsed.exportedAt ? ` - saved ${parsed.exportedAt.slice(0, 16).replace('T', ' ')}` : '');
}
