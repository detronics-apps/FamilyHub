// Finding third-party mini-app packages in the Drive folder and checking them.
//
// Copying a folder into MiniApps/ThirdParty runs nothing. Discovery reads each
// package's manifest.json, validates it, checks it is compatible, and
// fingerprints its code (SHA-256). Only after the person reviews the
// permissions and presses Install does it enter the registry - and it only
// ever runs inside the sandbox (sandbox.js), and only while the fingerprint
// still matches what they approved.

import { validateManifest, compatibility, compareVersions } from '../miniapps.js';
import { PATHS } from '../folder-sync.js';

const cache = new Map();     // id -> { manifest, code, hash, path }

export const cachedPackage = (id) => cache.get(id) ?? null;

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Read and check one package folder. Never throws: problems are returned. */
export async function inspectPackage(store, path) {
  const out = { path, folder: path.split('/').at(-1), ok: false, errors: [], manifest: null, hash: null, code: null, compat: null };
  let raw;
  try {
    const text = await store.read(`${path}/manifest.json`);
    if (text == null) { out.errors.push('No manifest.json in this folder.'); return out; }
    raw = JSON.parse(text);
  } catch (err) {
    out.errors.push(`manifest.json could not be read: ${err.message}`);
    return out;
  }
  const v = validateManifest(raw, { source: 'folder' });
  if (!v.ok) { out.errors.push(...v.errors); return out; }
  out.manifest = v.manifest;
  out.compat = compatibility(v.manifest);
  try {
    const code = await store.read(`${path}/${v.manifest.entry}`);
    if (code == null) { out.errors.push(`The entry file ${v.manifest.entry} is missing.`); return out; }
    if (code.length > 2_000_000) { out.errors.push('The code is larger than 2 MB, which is more than a mini-app should need.'); return out; }
    out.code = code;
    out.hash = await sha256(`${JSON.stringify(v.manifest)}\n${code}`);
  } catch (err) {
    out.errors.push(`The code could not be read: ${err.message}`);
    return out;
  }
  out.ok = out.compat.ok;
  if (!out.compat.ok) out.errors.push(out.compat.reason);
  return out;
}

/**
 * Every package in MiniApps/ThirdParty, with what it means for this household:
 * 'new' | 'installed' | 'update' | 'changed' (same version, different code) | 'invalid'.
 */
export async function discover(store, registry) {
  const entries = (await store.list(PATHS.thirdParty)) ?? [];
  const found = [];
  for (const e of entries) {
    if (e.kind !== 'directory') continue;
    const pkg = await inspectPackage(store, `${PATHS.thirdParty}/${e.name}`);
    const cur = pkg.manifest ? registry.apps[pkg.manifest.id] : null;
    let status = 'new';
    if (!pkg.ok) status = 'invalid';
    else if (cur && cur.source === 'starter') { status = 'invalid'; pkg.errors.push(`"${pkg.manifest.id}" is the id of an app that comes with Family Hub.`); }
    else if (cur) {
      const c = compareVersions(pkg.manifest.version, cur.version);
      status = c > 0 ? 'update' : pkg.hash === cur.codeHash ? 'installed' : 'changed';
    }
    found.push({ ...pkg, status });
  }
  return found;
}

/** Load an installed package for running. Refuses if the code changed since it was approved. */
export async function loadPackage(store, id, entry) {
  if (!store || store.kind !== 'folder') throw new Error('Connect your Drive folder to open this mini-app - it lives there.');
  if (!entry.packagePath) throw new Error('The package location is unknown. Reinstall it from Mini-apps.');
  const pkg = await inspectPackage(store, entry.packagePath);
  if (!pkg.ok) throw new Error(`It can no longer be loaded: ${pkg.errors.join(' ')}`);
  if (pkg.manifest.id !== id) throw new Error('The folder now holds a different mini-app.');
  if (pkg.hash !== entry.codeHash) {
    const e = new Error('Its files in your Drive folder have changed since you approved it, so it will not run until you review the change in Mini-apps.');
    e.changed = true;
    throw e;
  }
  cache.set(id, pkg);
  return pkg;
}

export const forgetPackage = (id) => cache.delete(id);
