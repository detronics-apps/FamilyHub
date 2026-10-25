// Each person's own dashboard arrangement over whatever mini-apps are installed.
//
// Preferences are personal, not household data: they live under the device
// settings, keyed by profile, and are never part of a household export.
// The list of tiles is passed in (installed, enabled mini-apps plus the core
// tiles), so a newly installed app simply appears at the end, and a stale
// preference is always repaired rather than trusted.

export const CORE_TILES = [
  { id: 'library', name: 'Mini-apps', purpose: 'Add, turn off, update or remove mini-apps. Nothing is deleted without asking.', status: 'ready' },
  { id: 'settings', name: 'Settings', purpose: 'Household, people, your dashboard, your Drive folder and music.', status: 'ready' },
];

/** Tiles that can never be hidden: they are the way back to everything else. */
export const ALWAYS_SHOWN = new Set(['settings', 'library']);

export const defaultPrefs = () => ({ order: [], hidden: [] });

/** Repair a stored preference against the tiles that exist now. */
export function normalisePrefs(prefs, modules = CORE_TILES) {
  const known = new Set(modules.map((m) => m.id));
  const raw = prefs && typeof prefs === 'object' ? prefs : {};
  const order = [];
  for (const id of Array.isArray(raw.order) ? raw.order : []) {
    if (known.has(id) && !order.includes(id)) order.push(id);
  }
  for (const m of modules) if (!order.includes(m.id)) order.push(m.id);
  const hidden = (Array.isArray(raw.hidden) ? raw.hidden : [])
    .filter((id, i, a) => known.has(id) && !ALWAYS_SHOWN.has(id) && a.indexOf(id) === i);
  return { order, hidden };
}

/** What the dashboard shows, in order, and what is tucked away. */
export function resolveDashboard(prefs, modules = CORE_TILES) {
  const p = normalisePrefs(prefs, modules);
  const byId = new Map(modules.map((m) => [m.id, m]));
  return {
    visible: p.order.filter((id) => !p.hidden.includes(id)).map((id) => byId.get(id)),
    hidden: p.hidden.map((id) => byId.get(id)),
  };
}

/** Move a tile one place up (-1) or down (+1) among the visible ones. */
export function moveModule(prefs, id, delta, modules = CORE_TILES) {
  const p = normalisePrefs(prefs, modules);
  const visible = p.order.filter((x) => !p.hidden.includes(x));
  const i = visible.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= visible.length) return p;
  [visible[i], visible[j]] = [visible[j], visible[i]];
  return { ...p, order: [...visible, ...p.order.filter((x) => p.hidden.includes(x))] };
}

export function hideModule(prefs, id, modules = CORE_TILES) {
  const p = normalisePrefs(prefs, modules);
  return normalisePrefs({ ...p, hidden: [...p.hidden, id] }, modules);
}

/** A restored tile comes back at the end of the visible list. */
export function showModule(prefs, id, modules = CORE_TILES) {
  const p = normalisePrefs(prefs, modules);
  const order = [...p.order.filter((x) => x !== id && !p.hidden.includes(x)), id, ...p.hidden.filter((x) => x !== id)];
  return { order, hidden: p.hidden.filter((x) => x !== id) };
}
