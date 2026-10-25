// The module map and each person's own dashboard arrangement.
//
// Preferences are personal, not household data: they live under their own
// storage key, keyed by profile, and are never part of a household export.
// A missing or stale preference is always repaired rather than trusted, so a
// module added in a later version simply appears at the end.

export const MODULES = [
  { id: 'chores', name: 'Chores', purpose: 'Recurring household work: plan it, then find something that fits right now.', status: 'ready' },
  { id: 'tasks', name: 'Tasks', purpose: 'One-off jobs, repairs, errands and bigger projects.', status: 'planned' },
  { id: 'tickets', name: 'Tickets', purpose: 'Capture a concern, idea or appreciation in seconds, discuss it later.', status: 'planned' },
  { id: 'principles', name: 'Principles', purpose: 'Family values and practical agreements, with the reasons behind them.', status: 'planned' },
  { id: 'decisions', name: 'Decisions', purpose: 'Agreements and experiments, with a date to look back at how they went.', status: 'planned' },
  { id: 'meals', name: 'Meals', purpose: 'Recipes, a weekly meal plan and the shopping list that follows from it.', status: 'planned' },
  { id: 'finance', name: 'Finance', purpose: 'Budgets, savings and debt goals, with the assumptions in plain view.', status: 'planned' },
  { id: 'health', name: 'Health', purpose: 'Health goals, routines and appointment notes.', status: 'planned' },
  { id: 'exercise', name: 'Exercise', purpose: 'Activity plans and family-friendly ways to move.', status: 'planned' },
  { id: 'medical', name: 'Medical', purpose: 'Emergency summary and medical records - only once privacy controls exist.', status: 'planned' },
  { id: 'holidays', name: 'Holidays', purpose: 'Trip ideas, itineraries, packing lists and budgets.', status: 'planned' },
  { id: 'faith', name: 'Faith', purpose: 'Bible reading, reflections and family discussion.', status: 'planned' },
  { id: 'settings', name: 'Settings', purpose: 'Household, people, your dashboard, and your data.', status: 'ready' },
];

const KNOWN = new Set(MODULES.map((m) => m.id));

export const defaultPrefs = () => ({ order: MODULES.map((m) => m.id), hidden: [] });

/** Repair a stored preference: drop unknown ids and duplicates, append new modules. */
export function normalisePrefs(prefs) {
  const raw = prefs && typeof prefs === 'object' ? prefs : {};
  const order = [];
  for (const id of Array.isArray(raw.order) ? raw.order : []) {
    if (KNOWN.has(id) && !order.includes(id)) order.push(id);
  }
  for (const m of MODULES) if (!order.includes(m.id)) order.push(m.id);
  // Settings can never be hidden: it is the way back to everything else.
  const hidden = (Array.isArray(raw.hidden) ? raw.hidden : [])
    .filter((id, i, a) => KNOWN.has(id) && id !== 'settings' && a.indexOf(id) === i);
  return { order, hidden };
}

/** What the dashboard shows, in order, and what is tucked away. */
export function resolveDashboard(prefs) {
  const p = normalisePrefs(prefs);
  const byId = new Map(MODULES.map((m) => [m.id, m]));
  return {
    visible: p.order.filter((id) => !p.hidden.includes(id)).map((id) => byId.get(id)),
    hidden: p.hidden.map((id) => byId.get(id)),
  };
}

/** Move a module one place up (-1) or down (+1) among the visible ones. */
export function moveModule(prefs, id, delta) {
  const p = normalisePrefs(prefs);
  const visible = p.order.filter((x) => !p.hidden.includes(x));
  const i = visible.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= visible.length) return p;
  [visible[i], visible[j]] = [visible[j], visible[i]];
  // Hidden modules keep their place at the end of the order.
  return { ...p, order: [...visible, ...p.order.filter((x) => p.hidden.includes(x))] };
}

export function hideModule(prefs, id) {
  const p = normalisePrefs(prefs);
  return normalisePrefs({ ...p, hidden: [...p.hidden, id] });
}

/** A restored module comes back at the end of the visible list. */
export function showModule(prefs, id) {
  const p = normalisePrefs(prefs);
  const order = [...p.order.filter((x) => x !== id && !p.hidden.includes(x)), id, ...p.hidden.filter((x) => x !== id)];
  return { order, hidden: p.hidden.filter((x) => x !== id) };
}
