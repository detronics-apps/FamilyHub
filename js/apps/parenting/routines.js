// Routines (D-105): little responsibilities for a moment - leaving the house, bedtime, the
// morning - that each child ticks off themselves on their own half of the screen. No races,
// no scores between children; each start is fresh. Pure - no DOM.

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Simple pictures for children who cannot read yet (line drawings, drawn in the app's colours).
export const ICONS = ['shoes', 'cup', 'hat', 'toilet', 'toothbrush', 'bath', 'pyjamas', 'book', 'bag', 'sun', 'jacket', 'hands', 'bed', 'star'];

const t = (id, name, icon, ageFrom = null) => ({ id, name, icon, ageFrom });
export const STARTER_ROUTINES = [
  { id: 'leaving', name: 'Leaving the house', tasks: [t('toilet', 'Go to the toilet', 'toilet', 30), t('drink', 'Get something to drink', 'cup', 24), t('shoes', 'Shoes on', 'shoes', 24), t('hat', 'Hat on', 'hat', 18), t('bag', 'Pack your bag', 'bag', 48), t('sun', 'Sunscreen on', 'sun', 36)] },
  { id: 'bedtime', name: 'Bedtime', tasks: [t('bath', 'Bath', 'bath'), t('pyjamas', 'Pyjamas on', 'pyjamas', 24), t('teeth', 'Brush teeth', 'toothbrush', 24), t('toilet', 'Toilet', 'toilet', 30), t('story', 'Choose a story', 'book', 18), t('bed', 'Into bed', 'bed')] },
  { id: 'morning', name: 'Morning', tasks: [t('toilet', 'Toilet', 'toilet', 30), t('dressed', 'Get dressed', 'jacket', 30), t('teeth', 'Brush teeth', 'toothbrush', 24), t('hands', 'Wash hands', 'hands', 24), t('bed', 'Make your bed', 'bed', 48)] },
];

export function normaliseTask(x = {}, i = 0) {
  return { id: str(x.id, 40) || `t${i}`, name: str(x.name, 80) || 'A task', icon: ICONS.includes(x.icon) ? x.icon : 'star', ageFrom: num(x.ageFrom), kids: Array.isArray(x.kids) ? x.kids.filter((k) => typeof k === 'string') : null };
}

export function normaliseRoutine(r = {}) {
  const done = {};
  for (const [k, v] of Object.entries(r.run?.done ?? {})) if (Array.isArray(v)) done[str(k, 40)] = v.filter((x) => typeof x === 'string');
  return {
    ...r, routineId: str(r.routineId ?? r.id, 80), name: str(r.name, 80) || 'Our routine',
    tasks: (Array.isArray(r.tasks) ? r.tasks : []).map(normaliseTask).slice(0, 20),
    who: Array.isArray(r.who) ? r.who.filter((k) => typeof k === 'string') : null,   // the children in the run (null: all)
    run: r.run ? { startedAt: str(r.run.startedAt, 40), done } : null,
    own: r.own === true, removed: r.removed === true,
  };
}

export function routinesOf(records, starter = STARTER_ROUTINES) {
  const byId = new Map(records.map((r) => [r.routineId, r]));
  const out = [];
  for (const s of starter) { const r = byId.get(s.id); if (!r?.removed) out.push(normaliseRoutine({ ...s, ...(r ?? {}), routineId: s.id, starter: true })); }
  for (const r of records) if (r.own && !r.removed) out.push(normaliseRoutine(r));
  return out;
}

/** A child's own list: the tasks given to them, or (if not chosen) those for their age. */
export const tasksFor = (routine, kid) => routine.tasks.filter((x) => (x.kids ? x.kids.includes(kid.id) : x.ageFrom == null || kid.months == null || kid.months >= x.ageFrom));

/** Start fresh: nothing ticked. */
export const start = (routine, who, now) => ({ ...routine, who, run: { startedAt: now, done: {} } });

/** Tick or untick one task for one child. */
export function tick(routine, kidId, taskId) {
  const done = { ...(routine.run?.done ?? {}) };
  const mine = new Set(done[kidId] ?? []);
  if (mine.has(taskId)) mine.delete(taskId); else mine.add(taskId);
  done[kidId] = [...mine];
  return { ...routine, run: { startedAt: routine.run?.startedAt ?? '', done } };
}

/** How far a child is: { done, total, ready }. */
export function progress(routine, kid) {
  const mine = tasksFor(routine, kid);
  const ticked = new Set(routine.run?.done?.[kid.id] ?? []);
  const done = mine.filter((x) => ticked.has(x.id)).length;
  return { done, total: mine.length, ready: mine.length > 0 && done === mine.length };
}

/** "Shoes on: shoes, 2" - one task per line in the form (picture and from-age optional). */
export function parseTask(line, i) {
  const [name, rest = ''] = String(line).split(':');
  const parts = rest.split(',').map((x) => x.trim()).filter(Boolean);
  const icon = parts.find((p) => ICONS.includes(p.toLowerCase()))?.toLowerCase() ?? 'star';
  const age = parts.map(Number).find((n) => Number.isFinite(n));
  return normaliseTask({ id: `t${i}-${str(name, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, icon, ageFrom: age != null ? age * 12 : null }, i);
}
export const taskLine = (x) => `${x.name}: ${x.icon}${x.ageFrom != null ? `, ${Math.round((x.ageFrom / 12) * 10) / 10}` : ''}`;
