// Keeping this device and the family's Google Drive folder in agreement.
//
// The household is always saved on this device first (localStorage, as in
// v0.1), then written to the folder about a second later. Before writing, the
// folder is re-read and compared with the base - the copy both last agreed on -
// so another laptop's changes are merged, never overwritten (folder-sync.js).
//
// Status is never optimistic: "Saved to your Drive folder" only after the files
// were written there; otherwise "On this device only" or what is needed.

import { createFolderStore, FolderError } from '../folder-store.js';
import { syncHousehold, writeHousehold, fingerprint, PATHS } from '../folder-sync.js';
import { mergeHousehold, resolveConflicts } from '../merge.js';
import { copyAppData } from '../collections.js';
import { normaliseRegistry, mergeRegistry } from '../miniapps.js';
import { stableStringify } from '../folder-store.js';
import { buildFamilyFile, collectAppFiles, familyFileName, parseFamilyFile, filesAsStore } from '../family-file.js';
import { idbGet, idbSet, idbDel, createIdbStore } from './idb.js';

import { KEYS } from '../storage.js';

const BASE_KEY = KEYS.folderBase;
const REG_BASE_KEY = KEYS.registryBase;
const FILE_BASE_KEY = KEYS.fileBase;
const HANDLE_KEY = 'folder';
const DEBOUNCE_MS = 1000;

export const folderSupported = () => typeof window.showDirectoryPicker === 'function';

/** Test mode (?folder=private): the browser's private storage stands in for the Drive folder. */
export const privateTestMode = () => new URLSearchParams(location.search).get('folder') === 'private';

const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* reported by the main save */ } };

export function createSync(ctx) {
  const deviceStore = createIdbStore();
  let handle = null;
  let folder = null;          // folder store once permission is granted
  let timer = null;
  let running = null;
  let again = false;

  // Start in the mode last used, so nothing reads from the wrong place while the folder reconnects.
  const startInFolder = ctx.app.device.storageMode === 'folder';
  const s = {
    mode: startInFolder ? 'folder' : 'device',   // 'device' | 'folder'
    state: startInFolder ? 'saving' : 'device',  // device | saving | saved | reconnect | decision | first-connect | error
    folderName: startInFolder ? ctx.app.device.folderName : null,
    lastSavedAt: null,
    message: '',
    conflict: null,           // { household, conflicts, theirs }
    firstConnect: null,       // { theirs }
    lastReport: null,
  };

  const set = (patch) => { Object.assign(s, patch); ctx.render(); };

  /** Where mini-app records live right now. Null while the folder needs a click to reconnect. */
  function appStore() {
    if (s.mode === 'folder') return folder;      // null until the folder is reconnected
    return deviceStore;
  }

  async function pickFolder() {
    if (privateTestMode()) return navigator.storage.getDirectory();
    return window.showDirectoryPicker({ id: 'familyhub', mode: 'readwrite' });
  }

  /**
   * Use the picked folder if it is (or holds) a Family Hub folder; otherwise make
   * a "FamilyHub" folder inside it, so the structure never spills into My Drive.
   */
  async function chooseRoot(picked) {
    const has = async (dir, name, kind) => {
      try { return kind === 'file' ? await dir.getFileHandle(name) : await dir.getDirectoryHandle(name); } catch { return null; }
    };
    if (await has(picked, PATHS.marker, 'file')) return picked;
    const inner = await has(picked, 'FamilyHub', 'dir');
    if (inner && await has(inner, PATHS.marker, 'file')) return inner;
    let empty = true;
    for await (const _ of picked.keys()) { empty = false; break; }   // eslint-disable-line no-unused-vars
    if (empty || /^family ?hub$/i.test(picked.name)) return picked;
    return picked.getDirectoryHandle('FamilyHub', { create: true });
  }

  async function adopt(h) {
    handle = h;
    folder = createFolderStore(h);
    await idbSet(HANDLE_KEY, h).catch(() => {});
    const name = h.name || 'Family Hub test folder';
    ctx.setDevice({ storageMode: 'folder', folderName: name });
    Object.assign(s, { mode: 'folder', folderName: name });
  }

  /* ----------------------------------------------------------- connecting */

  async function connect() {
    let picked;
    try {
      picked = await pickFolder();
    } catch (err) {
      if (err?.name === 'AbortError') return;              // they closed the picker
      set({ state: 'error', message: `The folder could not be opened: ${err.message}` });
      return;
    }
    try {
      await adopt(await chooseRoot(picked));
      writeJson(BASE_KEY, null);                             // a new folder: no agreed base yet
      writeJson(REG_BASE_KEY, null);
      // Mini-app records made on this device so far go into the folder too (newer wins).
      s.lastReport = await copyAppData(deviceStore, folder);
      await run();
    } catch (err) {
      fail(err);
    }
  }

  async function restore() {
    if (ctx.app.device.storageMode !== 'folder') return;
    s.mode = 'folder';
    s.folderName = ctx.app.device.folderName;
    try {
      const h = privateTestMode() ? await navigator.storage.getDirectory().then(chooseRoot) : await idbGet(HANDLE_KEY);
      if (!h) { set({ state: 'reconnect', message: 'Choose your Family Hub folder again to keep saving to Drive.' }); return; }
      handle = h;
      const perm = h.queryPermission ? await h.queryPermission({ mode: 'readwrite' }) : 'granted';
      if (perm === 'granted') { folder = createFolderStore(h); await run(); } else set({ state: 'reconnect', message: '' });
    } catch (err) {
      fail(err);
    }
  }

  /** The browser asks again after a restart; that needs a click. */
  async function reconnect() {
    if (!handle) return connect();
    try {
      const perm = handle.requestPermission ? await handle.requestPermission({ mode: 'readwrite' }) : 'granted';
      if (perm !== 'granted') { set({ state: 'reconnect', message: 'Permission was not given, so changes stay on this device.' }); return; }
      folder = createFolderStore(handle);
      await run();
    } catch (err) {
      fail(err);
    }
  }

  async function disconnect({ keepCopy = true } = {}) {
    if (keepCopy && folder) await copyAppData(folder, deviceStore).catch(() => {});
    await idbDel(HANDLE_KEY).catch(() => {});
    handle = null;
    folder = null;
    ctx.setDevice({ storageMode: 'device', folderName: null });
    writeJson(BASE_KEY, null);
    set({ mode: 'device', state: 'device', folderName: null, message: '', conflict: null, firstConnect: null });
  }

  /* -------------------------------------------------------------- syncing */

  function schedule() {
    if (s.mode !== 'folder') return;
    clearTimeout(timer);
    if (folder) { s.state = 'saving'; }
    timer = setTimeout(() => { run(); }, DEBOUNCE_MS);
  }

  async function run() {
    if (s.mode !== 'folder' || !folder || !ctx.app.household) return;
    if (s.conflict || s.firstConnect) return;                // waiting for the person
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        if (s.state !== 'saving') set({ state: 'saving' });
        await syncOnce();
      } catch (err) {
        fail(err);
      } finally {
        running = null;
        if (again) { again = false; run(); }
      }
    })();
    return running;
  }

  async function syncOnce() {
    const base = readJson(BASE_KEY);
    const mine = ctx.app.household;
    const r = await syncHousehold(folder, { base, mine });

    if (r.status === 'first-connect') { set({ state: 'first-connect', firstConnect: { theirs: r.theirs } }); return; }
    if (r.status === 'conflict') { set({ state: 'decision', conflict: { household: r.household, conflicts: r.conflicts, theirs: r.theirs, mineAtDetection: mine } }); return; }
    if (r.status === 'adopted' || r.status === 'merged') {
      ctx.replaceHousehold(r.household, r.status === 'adopted'
        ? 'Updated with changes made on another device.'
        : 'Changes from another device were merged with yours.');
    }
    writeJson(BASE_KEY, r.household);
    await syncRegistry();
    set({ state: 'saved', lastSavedAt: new Date(), message: '' });
  }

  async function syncRegistry() {
    const mine = normaliseRegistry(ctx.app.registry);
    const text = await folder.read(PATHS.installed);
    const theirs = text ? normaliseRegistry(JSON.parse(text)) : null;
    const base = readJson(REG_BASE_KEY);
    let next = mine;
    if (theirs && JSON.stringify(theirs) !== JSON.stringify(mine)) {
      if (base && JSON.stringify(mine) === JSON.stringify(normaliseRegistry(base))) next = theirs;
      else next = mergeRegistry(base, mine, theirs).registry;
    }
    if (JSON.stringify(next) !== JSON.stringify(mine)) ctx.replaceRegistry(next);
    if (!theirs || JSON.stringify(theirs) !== JSON.stringify(next)) await folder.write(PATHS.installed, stableStringify(next));
    writeJson(REG_BASE_KEY, next);
    // Starter apps ship with the app; their manifests are mirrored so the folder shows what is installed (D-018).
    for (const m of ctx.starterManifests()) {
      if (!next.apps[m.id]) continue;
      const path = `${PATHS.miniApps}/${m.name.replace(/[^A-Za-z0-9 _-]/g, '')}/manifest.json`;
      const text = stableStringify({ ...m, note: 'Comes with Family Hub. This copy shows what is installed; the app itself is part of Family Hub.' });
      if ((await folder.read(path)) !== text) await folder.write(path, text);
    }
  }

  function fail(err) {
    if (err instanceof FolderError && (err.kind === 'permission' || err.kind === 'missing-folder')) {
      folder = err.kind === 'permission' ? null : folder;
      set({ state: 'reconnect', message: err.kind === 'missing-folder'
        ? 'The Family Hub folder could not be found - it may have been moved or deleted. Choose it again.'
        : 'Family Hub needs your permission again to use the Drive folder.' });
      return;
    }
    set({ state: 'error', message: err?.message || String(err) });
  }

  /* ----------------------------------------------------- person decisions */

  /** First connect to a folder that already holds a family. */
  async function chooseFirstConnect(choice) {
    const theirs = s.firstConnect?.theirs;
    s.firstConnect = null;
    if (choice === 'cancel' || !theirs) { await disconnect({ keepCopy: false }); return; }
    if (choice === 'use') {
      ctx.replaceHousehold(theirs, `Now using ${theirs.household.name} from your Drive folder.`);
      writeJson(BASE_KEY, theirs);
      await run();
      return;
    }
    // Merge this device's family into the folder's (nothing from either side is lost).
    const { household, conflicts } = mergeHousehold(null, theirs, ctx.app.household);
    if (conflicts.length) { set({ state: 'decision', conflict: { household, conflicts, theirs, mineAtDetection: ctx.app.household } }); return; }
    await writeHousehold(folder, household);
    ctx.replaceHousehold(household, 'This device’s family was merged into the one in your Drive folder.');
    writeJson(BASE_KEY, household);
    await run();
  }

  async function resolveConflict(choices) {
    const c = s.conflict;
    if (!c) return;
    let resolved = resolveConflicts(c.household, c.conflicts, choices);
    // Anything done on this device while the question was open is kept on top.
    if (c.mineAtDetection && fingerprint(c.mineAtDetection) !== fingerprint(ctx.app.household)) {
      resolved = mergeHousehold(c.mineAtDetection, ctx.app.household, resolved).household;
    }
    s.conflict = null;
    try {
      if (folder && !c.fromFile) {
        await writeHousehold(folder, resolved);
        writeJson(BASE_KEY, resolved);
      }
      if (c.fromFile) writeJson(FILE_BASE_KEY, resolved);
      ctx.replaceHousehold(resolved, 'Your choices are saved.');
      if (folder) await run(); else set({ state: s.mode === 'folder' ? 'reconnect' : 'device' });
    } catch (err) { fail(err); }
  }

  /* ------------------------------------------------- backups, family file */

  async function familyFileText() {
    const store = appStore() ?? deviceStore;
    return buildFamilyFile({ household: ctx.app.household, registry: ctx.app.registry, files: await collectAppFiles(store) });
  }

  async function backupNow() {
    if (!folder) throw new Error('Connect your Drive folder first.');
    const name = familyFileName(ctx.app.household).replace(/^family-hub-/, 'backup-');
    await folder.write(`${PATHS.backups}/${name}`, await familyFileText());
    return name;
  }

  async function listBackups() {
    if (!folder) return [];
    return ((await folder.list(PATHS.backups)) ?? []).filter((e) => e.kind === 'file' && e.name.endsWith('.json')).map((e) => e.name).reverse();
  }

  async function readBackup(name) {
    return parseFamilyFile(await folder.read(`${PATHS.backups}/${name}`));
  }

  /**
   * Bring in a family file (from a phone, a backup, or another device).
   * `mode`: 'merge' keeps everything from both; 'replace' uses the file's household.
   * Mini-app records always merge (newer wins by rev).
   */
  async function importFamilyFile(parsed, mode) {
    const base = readJson(FILE_BASE_KEY);
    let household = parsed.household;
    let conflicts = [];
    if (mode === 'merge') {
      const sameFamily = parsed.household.household.id === ctx.app.household.household.id;
      ({ household, conflicts } = mergeHousehold(sameFamily && base?.household?.id === parsed.household.household.id ? base : null, ctx.app.household, parsed.household));
    }
    const report = await copyAppData(filesAsStore(parsed), appStore() ?? deviceStore);
    if (parsed.registry) ctx.replaceRegistry(mergeRegistry(null, ctx.app.registry, parsed.registry).registry);
    if (conflicts.length) {
      set({ state: 'decision', conflict: { household, conflicts, theirs: parsed.household, fromFile: true, mineAtDetection: ctx.app.household } });
      return { conflicts: conflicts.length, report };
    }
    ctx.replaceHousehold(household, 'The family file was brought in.');
    writeJson(FILE_BASE_KEY, household);
    schedule();
    return { conflicts: 0, report };
  }

  /** After saving a family file, remember it as the base for the next exchange. */
  function rememberFileBase() { writeJson(FILE_BASE_KEY, ctx.app.household); }

  // Coming back to the window: another laptop may have changed the folder.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
  window.addEventListener('focus', () => run());
  setInterval(() => { if (document.visibilityState === 'visible') run(); }, 60000);

  return {
    status: s,
    appStore, deviceStore: () => deviceStore, folderStore: () => folder,
    connect, restore, reconnect, disconnect, schedule, run,
    chooseFirstConnect, resolveConflict,
    backupNow, listBackups, readBackup, familyFileText, importFamilyFile, rememberFileBase,
    pending: () => s.mode === 'folder' && fingerprint(readJson(BASE_KEY)) !== fingerprint(ctx.app.household),
  };
}
