// Mini-apps: the manifest every package declares, the checks it must pass, the
// permissions it may ask for, and the installed-apps registry with its
// lifecycle (install, disable, enable, update, uninstall keeping data, reinstall).
// Pure: no DOM, no storage. The developer guide is MINIAPPS.md.

import { section } from './sections.js';

export const CORE_VERSION = '0.5.0';
export const API_VERSION = 1;
export const MANIFEST_VERSION = 1;

/**
 * Every permission a manifest may request. `firstParty` ones are only granted to
 * the starter apps that ship with Family Hub. Anything not listed is refused -
 * an unknown permission is an error, never silently ignored.
 */
export const PERMISSIONS = {
  'data:own': { label: 'Keep its own records in your family folder', risk: 'low' },
  'people:read': { label: 'See the names of people in your household', risk: 'medium' },
  'rooms:read': { label: 'See the rooms you have set up', risk: 'low' },
  'notify': { label: 'Show short notices', risk: 'low' },
  'media:audio': { label: 'Play music through the shared player', risk: 'low' },
  'timer': { label: 'Use the shared timer', risk: 'low' },
  'food:read': { label: 'Look up foods in the shared food database', risk: 'low', firstParty: true },
  'people:food': { label: 'See food details in people’s profiles: age, allergies, pregnancy, weight and food priorities', risk: 'high', firstParty: true },
  'household:chores': { label: 'Read and change chores and their history', risk: 'high', firstParty: true },
  'household:people:write': { label: 'Add and change people', risk: 'high', firstParty: true },
};

/**
 * Cross-app reading, e.g. 'data:tasks:read'. Always shown to the person by name.
 * Only the owning app writes its own records (it alone knows how to index them);
 * another app that wants to create one opens the owner's screen with a prefill.
 */
const CROSS = /^data:([a-z][a-z0-9.-]*):read$/;

/** The three ways into a section: when there is time to think, for a quick look or note, and when it is time to do. */
export const MODES = {
  plan: { title: 'Plan', when: 'When you have time to sit and think it through' },
  note: { title: 'Check and note', when: 'A quick look, or jotting something down before you forget' },
  do: { title: 'Do', when: 'When you have 20 minutes to an hour to get things done' },
};

export const RESERVED_IDS = new Set(['home', 'settings', 'help', 'library', 'app', 'apps', 'core', 'data', 'media', 'household', 'system', 'section']);
const ID = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)*$/;
const SCREEN = /^[a-z][a-z0-9-]{0,30}$/;
const COLLECTION = /^[a-z][a-z0-9-]{0,40}$/;
const ENTRY = /^(?!.*\.\.)[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*\.js$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;

/** Which record fields go into the index (summary) and the search text. At most 12; defaults suit most apps. */
const fieldList = (v) => {
  const list = (Array.isArray(v) ? v : ['title', 'name', 'status']).filter((f) => typeof f === 'string' && FIELD.test(f));
  return [...new Set(list)].slice(0, 12);
};

export function parseVersion(v) {
  const m = SEMVER.exec(String(v ?? ''));
  return m ? m.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return NaN;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** ">=0.2.0", "<1.0.0", or both separated by a space. */
export function satisfies(version, range) {
  if (!range) return true;
  return String(range).trim().split(/\s+/).every((part) => {
    const m = /^(>=|<=|>|<|=)?(\d+\.\d+\.\d+)$/.exec(part);
    if (!m) return false;
    const c = compareVersions(version, m[2]);
    return { '>=': c >= 0, '<=': c <= 0, '>': c > 0, '<': c < 0, '=': c === 0, undefined: c === 0 }[m[1]];
  });
}

export function permissionInfo(p) {
  if (PERMISSIONS[p]) return PERMISSIONS[p];
  const m = CROSS.exec(p);
  if (m) return { label: `Read records of the ${m[1]} mini-app`, risk: 'medium' };
  return null;
}

/**
 * Check a manifest. `source` is 'starter' (ships with the app) or 'folder'
 * (found in the Drive folder - other people's code).
 * @returns {{ ok: boolean, errors: string[], manifest?: object }}
 */
export function validateManifest(raw, { source = 'folder' } = {}) {
  const errors = [];
  const m = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (!m) return { ok: false, errors: ['manifest.json is not a JSON object.'] };

  if (m.fhManifest !== MANIFEST_VERSION) errors.push(`"fhManifest" must be ${MANIFEST_VERSION}.`);
  if (typeof m.id !== 'string' || !ID.test(m.id) || m.id.length > 64) errors.push('"id" must be lower-case letters, digits and dots, like "com.example.notes".');
  else if (RESERVED_IDS.has(m.id)) errors.push(`"id" "${m.id}" is reserved by Family Hub.`);
  if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 40) errors.push('"name" must be 1 to 40 characters.');
  if (!parseVersion(m.version)) errors.push('"version" must look like 1.0.0.');
  if (m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 300)) errors.push('"description" must be text of at most 300 characters.');
  if (m.section !== undefined && typeof m.section !== 'string') errors.push('"section" must be the id of a section, like "meals".');

  const req = m.requires ?? {};
  if (!Number.isInteger(req.api)) errors.push('"requires.api" must be a whole number.');
  if (req.core !== undefined && !String(req.core).trim().split(/\s+/).every((p) => /^(>=|<=|>|<|=)?\d+\.\d+\.\d+$/.test(p))) {
    errors.push('"requires.core" must be a version range like ">=0.2.0 <1.0.0".');
  }

  if (source === 'folder') {
    if (typeof m.entry !== 'string' || !ENTRY.test(m.entry)) errors.push('"entry" must be a .js file inside the package, like "app.js".');
  }

  const screens = Array.isArray(m.screens) ? m.screens : [];
  if (!screens.length) errors.push('"screens" must list at least one screen.');
  const screenIds = new Set();
  for (const s of screens) {
    if (!s || !SCREEN.test(s.id ?? '')) errors.push(`Screen id "${s?.id}" must be lower-case letters, digits and dashes.`);
    else if (screenIds.has(s.id)) errors.push(`Screen id "${s.id}" is repeated.`);
    else screenIds.add(s.id);
    if (typeof s?.title !== 'string' || !s.title.trim()) errors.push(`Screen "${s?.id}" needs a title.`);
  }

  // Where each way in fits: planning (time to think), a quick check or note, or doing (time to get things done).
  const modes = Array.isArray(m.modes) ? m.modes : [];
  for (const x of modes) {
    if (!x || !MODES[x.mode]) errors.push(`A mode must be one of ${Object.keys(MODES).join(', ')}.`);
    else if (x.screen != null && !screenIds.has(x.screen)) errors.push(`Mode "${x.label}" names a screen "${x.screen}" that is not listed.`);
    if (typeof x?.label !== 'string' || !x.label.trim() || x.label.length > 60) errors.push('Each mode needs a label of 1 to 60 characters.');
  }

  const collections = Array.isArray(m.data?.collections) ? m.data.collections : [];
  const names = new Set();
  for (const c of collections) {
    if (!c || !COLLECTION.test(c.name ?? '')) errors.push(`Collection name "${c?.name}" must be lower-case letters, digits and dashes.`);
    else if (names.has(c.name)) errors.push(`Collection "${c.name}" is repeated.`);
    else names.add(c.name);
    if (!Number.isInteger(c?.schema) || c.schema < 1) errors.push(`Collection "${c?.name}" needs a whole-number "schema" of 1 or more.`);
  }

  const perms = Array.isArray(m.permissions) ? m.permissions : [];
  if (!Array.isArray(m.permissions)) errors.push('"permissions" must be a list (it may be empty).');
  for (const p of perms) {
    const info = permissionInfo(p);
    if (!info) errors.push(`Unknown permission "${p}".`);
    else if (info.firstParty && source !== 'starter') errors.push(`Permission "${p}" is only available to the apps that come with Family Hub.`);
  }
  if (collections.length && !perms.includes('data:own')) errors.push('A mini-app with collections must request "data:own".');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    manifest: {
      fhManifest: MANIFEST_VERSION,
      id: m.id,
      name: m.name.trim(),
      version: m.version,
      description: m.description ?? '',
      // A section this version does not know yet is kept as "more" rather than refused.
      section: section(m.section) ? m.section : 'more',
      author: typeof m.author === 'string' ? m.author.slice(0, 80) : '',
      requires: { api: req.api, core: req.core ?? null },
      entry: m.entry ?? null,
      screens: screens.map((s) => ({ id: s.id, title: s.title.trim(), nav: s.nav !== false })),
      modes: modes.slice(0, 12).map((x) => ({ mode: x.mode, screen: x.screen ?? null, label: x.label.trim(), hint: typeof x.hint === 'string' ? x.hint.slice(0, 140) : '' })),
      data: { collections: collections.map((c) => ({ name: c.name, schema: c.schema, summary: fieldList(c.summary), search: fieldList(c.search ?? c.summary) })) },
      permissions: [...new Set(perms)],
      icon: typeof m.icon === 'string' ? m.icon.slice(0, 4) : null,
    },
  };
}

/** Can this core run it? */
export function compatibility(manifest, { core = CORE_VERSION, api = API_VERSION } = {}) {
  if (manifest.requires.api !== api) {
    return { ok: false, reason: `It needs mini-app interface version ${manifest.requires.api}; this Family Hub provides version ${api}.` };
  }
  if (!satisfies(core, manifest.requires.core)) {
    return { ok: false, reason: `It needs Family Hub ${manifest.requires.core}; this is version ${core}.` };
  }
  return { ok: true, reason: '' };
}

/* ------------------------------------------------------------------ *
 * The registry: Core/installed.json in the folder.
 * { schema: 1, apps: { [id]: Installed }, retained: { [id]: Retained } }
 * Installed: { name, version, enabled, source, installedAt, updatedAt,
 *              granted: [perm], dataSchemas: {collection: n}, codeHash, packagePath }
 * Retained:  { name, version, uninstalledAt, dataSchemas }   (uninstalled, data kept)
 * ------------------------------------------------------------------ */

export const emptyRegistry = () => ({ schema: 1, apps: {}, retained: {} });

export function normaliseRegistry(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const apps = {};
  for (const [id, a] of Object.entries(obj(r.apps))) {
    if (!ID.test(id) || !a) continue;
    apps[id] = {
      name: String(a.name ?? id),
      version: parseVersion(a.version) ? a.version : '0.0.0',
      enabled: a.enabled !== false,
      source: a.source === 'starter' ? 'starter' : 'folder',
      installedAt: a.installedAt ?? null,
      updatedAt: a.updatedAt ?? null,
      granted: Array.isArray(a.granted) ? a.granted.filter((p) => permissionInfo(p)) : [],
      dataSchemas: obj(a.dataSchemas),
      codeHash: typeof a.codeHash === 'string' ? a.codeHash : null,
      packagePath: typeof a.packagePath === 'string' ? a.packagePath : null,
    };
  }
  const retained = {};
  for (const [id, a] of Object.entries(obj(r.retained))) {
    if (ID.test(id) && a && !apps[id]) retained[id] = { name: String(a.name ?? id), version: a.version ?? '0.0.0', uninstalledAt: a.uninstalledAt ?? null, dataSchemas: obj(a.dataSchemas) };
  }
  return { schema: 1, apps, retained };
}

const schemasOf = (manifest) => Object.fromEntries(manifest.data.collections.map((c) => [c.name, c.schema]));

/** Would this app understand data left behind by an earlier install? */
export function retainedDataCheck(retained, manifest) {
  if (!retained) return { ok: true, recover: false, problems: [] };
  const mine = schemasOf(manifest);
  const problems = [];
  for (const [col, n] of Object.entries(retained.dataSchemas)) {
    if (mine[col] === undefined) continue;   // no longer used: left untouched
    if (n > mine[col]) problems.push(`"${col}" was saved by a newer version (data version ${n}; this version reads up to ${mine[col]}).`);
  }
  return { ok: problems.length === 0, recover: problems.length === 0, problems };
}

/**
 * Install (or reinstall) a validated, compatible manifest.
 * Every requested permission must be in `granted` - the person approved them.
 */
export function install(registry, manifest, { granted = [], source = 'folder', codeHash = null, packagePath = null, now = new Date().toISOString() } = {}) {
  const reg = normaliseRegistry(registry);
  if (reg.apps[manifest.id]) throw new Error(`${manifest.name} is already installed.`);
  const compat = compatibility(manifest);
  if (!compat.ok) throw new Error(`${manifest.name} cannot be installed: ${compat.reason}`);
  const missing = manifest.permissions.filter((p) => !granted.includes(p));
  if (missing.length) throw new Error(`${manifest.name} needs your approval for: ${missing.map((p) => permissionInfo(p).label).join('; ')}.`);
  const retained = reg.retained[manifest.id];
  const check = retainedDataCheck(retained, manifest);
  if (!check.ok) throw new Error(`${manifest.name} cannot use the data kept from before: ${check.problems.join(' ')} The data has been left untouched.`);

  const dataSchemas = { ...(retained?.dataSchemas ?? {}), ...schemasOf(manifest) };
  delete reg.retained[manifest.id];
  reg.apps[manifest.id] = {
    name: manifest.name, version: manifest.version, enabled: true, source,
    installedAt: now, updatedAt: now, granted: [...manifest.permissions], dataSchemas, codeHash, packagePath,
  };
  return { registry: reg, recovered: Boolean(retained) };
}

export function setEnabled(registry, id, enabled) {
  const reg = normaliseRegistry(registry);
  if (!reg.apps[id]) throw new Error('That mini-app is not installed.');
  reg.apps[id] = { ...reg.apps[id], enabled };
  return reg;
}

/** Update to a newer version. New permissions must be approved; data versions never go down. */
export function update(registry, manifest, { granted = [], codeHash = null, now = new Date().toISOString() } = {}) {
  const reg = normaliseRegistry(registry);
  const cur = reg.apps[manifest.id];
  if (!cur) throw new Error(`${manifest.name} is not installed.`);
  if (!(compareVersions(manifest.version, cur.version) > 0)) throw new Error(`${manifest.name} ${manifest.version} is not newer than the installed ${cur.version}.`);
  const compat = compatibility(manifest);
  if (!compat.ok) throw new Error(`${manifest.name} ${manifest.version} cannot be used: ${compat.reason}`);
  const added = manifest.permissions.filter((p) => !cur.granted.includes(p));
  const unapproved = added.filter((p) => !granted.includes(p));
  if (unapproved.length) throw new Error(`The update asks for new permissions you have not approved: ${unapproved.map((p) => permissionInfo(p).label).join('; ')}.`);
  const next = schemasOf(manifest);
  for (const [col, n] of Object.entries(cur.dataSchemas)) {
    if (next[col] !== undefined && next[col] < n) throw new Error(`The update would read "${col}" data at an older version (${next[col]} < ${n}).`);
  }
  reg.apps[manifest.id] = {
    ...cur, name: manifest.name, version: manifest.version, updatedAt: now,
    granted: [...manifest.permissions], dataSchemas: { ...cur.dataSchemas, ...next }, codeHash: codeHash ?? cur.codeHash,
  };
  return { registry: reg, addedPermissions: added };
}

/** Uninstall. The app's data stays in the folder and is remembered for a reinstall. */
export function uninstall(registry, id, { now = new Date().toISOString() } = {}) {
  const reg = normaliseRegistry(registry);
  const cur = reg.apps[id];
  if (!cur) throw new Error('That mini-app is not installed.');
  delete reg.apps[id];
  reg.retained[id] = { name: cur.name, version: cur.version, uninstalledAt: now, dataSchemas: cur.dataSchemas };
  return reg;
}

/** After the person separately confirmed deleting an uninstalled app's data. */
export function forgetRetained(registry, id) {
  const reg = normaliseRegistry(registry);
  if (reg.apps[id]) throw new Error('Uninstall the mini-app before deleting its data.');
  delete reg.retained[id];
  return reg;
}

/** The registry a new household starts with: every starter app installed. */
export function starterRegistry(starterManifests, now = new Date().toISOString()) {
  let reg = emptyRegistry();
  for (const m of starterManifests) reg = install(reg, m, { granted: m.permissions, source: 'starter', now }).registry;
  return reg;
}

/**
 * Bring a stored registry up to date with the starter pack shipped in this
 * version: new starter apps are installed (unless the person uninstalled them),
 * and installed starter apps follow the shipped version.
 */
export function reconcileStarters(registry, starterManifests, now = new Date().toISOString()) {
  let reg = normaliseRegistry(registry);
  for (const m of starterManifests) {
    const cur = reg.apps[m.id];
    if (!cur && !reg.retained[m.id]) reg = install(reg, m, { granted: m.permissions, source: 'starter', now }).registry;
    else if (cur && cur.source === 'starter' && compareVersions(m.version, cur.version) > 0) {
      reg = update(reg, m, { granted: m.permissions, now }).registry;
    }
  }
  // A starter app this version no longer ships is uninstalled, its records kept.
  const shipped = new Set(starterManifests.map((m) => m.id));
  for (const [id, a] of Object.entries(reg.apps)) {
    if (a.source === 'starter' && !shipped.has(id)) reg = uninstall(reg, id, { now });
  }
  return reg;
}

/**
 * Merge two registries (two laptops installing or removing apps). Per app:
 * a change on one side is taken; if both changed the same app differently,
 * this device's choice stands and the case is reported.
 */
export function mergeRegistry(base, mine, theirs) {
  const b = normaliseRegistry(base);
  const m = normaliseRegistry(mine);
  const t = normaliseRegistry(theirs);
  const out = emptyRegistry();
  const conflicts = [];
  for (const part of ['apps', 'retained']) {
    for (const id of new Set([...Object.keys(m[part]), ...Object.keys(t[part]), ...Object.keys(b[part])])) {
      const [x, y, z] = [b[part][id], m[part][id], t[part][id]].map((v) => (v ? JSON.stringify(v) : null));
      const pick = y === z ? m[part][id] : y === x ? t[part][id] : z === x ? m[part][id] : (conflicts.push(id), m[part][id]);
      if (pick) out[part][id] = pick;
    }
  }
  for (const id of Object.keys(out.apps)) delete out.retained[id];
  return { registry: out, conflicts };
}

/** Is `op` allowed for an app with these granted permissions? */
export function allowed(granted, op) {
  return Array.isArray(granted) && granted.includes(op);
}
