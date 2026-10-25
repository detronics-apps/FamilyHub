// Merging two versions of the family's data without silently losing either.
//
// Three-way merge needs the BASE: the copy both sides last agreed on. With it,
// a change on one side and no change on the other is simply taken - including
// a deletion. Only when both sides changed the same field differently (or one
// edited what the other deleted) does a person have to choose.
//
// Without a base (an imported file from another device) the two-way merge can
// still add what is new on either side, but cannot know about deletions; any
// record that differs is a choice for the person.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Merge one record field by field. Fields are compared whole (an array of
 * eligible people is one value), which keeps every result a valid record.
 * Returns the merged record (mine wins a conflict until a person decides)
 * and the conflicting fields.
 */
export function mergeRecord3(base, mine, theirs) {
  const merged = {};
  const conflicts = [];
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(mine || {}), ...Object.keys(theirs || {})]);
  for (const k of keys) {
    const b = base?.[k];
    const m = mine?.[k];
    const t = theirs?.[k];
    if (same(m, t)) merged[k] = m;
    else if (same(m, b)) merged[k] = t;          // only they changed it
    else if (same(t, b)) merged[k] = m;          // only I changed it
    else { merged[k] = m; conflicts.push({ field: k, mine: m, theirs: t }); }
  }
  // updatedAt and rev are bookkeeping, not something to ask a person about.
  const real = conflicts.filter((c) => c.field !== 'updatedAt' && c.field !== 'rev');
  if (conflicts.some((c) => c.field === 'updatedAt')) {
    merged.updatedAt = [mine?.updatedAt, theirs?.updatedAt].filter(Boolean).sort().at(-1);
  }
  if (conflicts.some((c) => c.field === 'rev')) merged.rev = Math.max(mine?.rev || 0, theirs?.rev || 0) + 1;
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  return { merged, conflicts: real };
}

/**
 * Merge two lists of records by id.
 * @returns {{ list: Array, conflicts: Array<{id, kind: 'field'|'edit-delete', field?, mine, theirs}> }}
 */
export function mergeList3(base = [], mine = [], theirs = []) {
  const byId = (list) => new Map(list.map((r) => [r.id, r]));
  const B = byId(base);
  const M = byId(mine);
  const T = byId(theirs);
  const ids = [...new Set([...M.keys(), ...T.keys(), ...B.keys()])];
  const list = [];
  const conflicts = [];

  for (const id of ids) {
    const b = B.get(id);
    const m = M.get(id);
    const t = T.get(id);
    if (m && t) {
      const r = b ? mergeRecord3(b, m, t) : mergeRecord3(t, m, t);   // added on both sides: mine wins where it differs...
      if (!b && !same(m, t)) {                                       // ...but a person must see it
        for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) {
          if (!same(m[k], t[k]) && k !== 'updatedAt' && k !== 'rev') conflicts.push({ id, kind: 'field', field: k, mine: m[k], theirs: t[k] });
        }
      } else {
        for (const c of r.conflicts) conflicts.push({ id, kind: 'field', ...c });
      }
      list.push(r.merged);
    } else if (m && !t) {
      if (!b) list.push(m);                         // I added it
      else if (!same(m, b)) { list.push(m); conflicts.push({ id, kind: 'edit-delete', mine: m, theirs: null }); }
      // else: they deleted it, I did not touch it -> deleted
    } else if (!m && t) {
      if (!b) list.push(t);                         // they added it
      else if (!same(t, b)) { conflicts.push({ id, kind: 'edit-delete', mine: null, theirs: t }); }
      // else: I deleted it, they did not touch it -> deleted
    }
  }
  return { list, conflicts };
}

/** Two-way merge (no base): everything new on either side is kept; differences are conflicts. */
export function mergeList2(mine = [], theirs = []) {
  return mergeList3([], mine, theirs);
}

const COLLECTIONS = ['people', 'rooms', 'chores', 'events'];

/**
 * Merge two whole households. `base` may be null (two-way).
 * Conflicts carry the collection, so a person can be shown what they are choosing between.
 */
export function mergeHousehold(base, mine, theirs) {
  const conflicts = [];
  const meta = base
    ? mergeRecord3(base.household, mine.household, theirs.household)
    : mergeRecord3(theirs.household, mine.household, theirs.household);
  for (const c of meta.conflicts) {
    if (c.field === 'id' || c.field === 'createdAt') continue;
    conflicts.push({ collection: 'household', id: mine.household.id, kind: 'field', ...c });
  }
  const out = { ...mine, household: { ...meta.merged, id: mine.household.id, createdAt: mine.household.createdAt } };
  for (const key of COLLECTIONS) {
    const r = mergeList3(base?.[key] ?? [], mine[key] ?? [], theirs[key] ?? []);
    out[key] = r.list;
    for (const c of r.conflicts) conflicts.push({ collection: key, ...c });
  }
  out.events = sortEvents(out.events);
  return { household: out, conflicts };
}

/** Events in time order; ties broken by id so the order is the same everywhere. */
export function sortEvents(events) {
  return events.slice().sort((a, b) => String(a.at ?? a.day).localeCompare(String(b.at ?? b.day)) || a.id.localeCompare(b.id));
}

/**
 * Apply a person's choices. `choices` maps conflictKey(c) -> 'mine' | 'theirs'.
 * Unanswered conflicts keep mine (the merged default).
 */
export function resolveConflicts(household, conflicts, choices) {
  const out = structuredClone(household);
  for (const c of conflicts) {
    if (choices[conflictKey(c)] !== 'theirs') continue;
    if (c.collection === 'household') { out.household[c.field] = c.theirs; continue; }
    const list = out[c.collection];
    const i = list.findIndex((r) => r.id === c.id);
    if (c.kind === 'edit-delete') {
      if (c.theirs === null) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = c.theirs; else list.push(c.theirs);
    } else if (i >= 0) {
      list[i] = { ...list[i], [c.field]: c.theirs };
    }
  }
  out.events = sortEvents(out.events);
  return out;
}

export const conflictKey = (c) => `${c.collection}:${c.id}:${c.kind === 'field' ? c.field : 'record'}`;
