// IndexedDB, kept small: a key-value store, and a file store over it with the
// same interface as js/folder-store.js. Used for two things only:
//   - remembering the picked Drive folder between visits (handles can be stored here)
//   - mini-app records on a device with no folder connected ("This device only")

const DB = 'familyhub';
const STORE = 'kv';
let opening = null;

function db() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return opening;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const idbGet = (key) => tx('readonly', (s) => s.get(key));
export const idbSet = (key, value) => tx('readwrite', (s) => s.put(value, key));
export const idbDel = (key) => tx('readwrite', (s) => s.delete(key));
export const idbKeys = () => tx('readonly', (s) => s.getAllKeys());

const FS = 'fs:';

/** The folder-store interface over IndexedDB keys 'fs:<path>'. */
export function createIdbStore() {
  const keysUnder = async (prefix) => (await idbKeys()).filter((k) => typeof k === 'string' && k.startsWith(FS + prefix)).map((k) => k.slice(FS.length));
  return {
    kind: 'device',
    name: 'This device',
    async read(path) { const v = await idbGet(FS + path); return v ?? null; },
    async file() { return null; },
    async write(path, text) { await idbSet(FS + path, String(text)); },
    async list(path = '') {
      const prefix = path ? `${path.replace(/\/+$/, '')}/` : '';
      const seen = new Map();
      for (const key of await keysUnder(prefix)) {
        const rest = key.slice(prefix.length).split('/');
        seen.set(rest[0], rest.length > 1 ? 'directory' : 'file');
      }
      if (!seen.size && path) return null;
      return [...seen].map(([name, kind]) => ({ name, kind })).sort((a, b) => a.name.localeCompare(b.name));
    },
    async remove(path) {
      const keys = [path, ...(await keysUnder(`${path}/`))];
      let removed = false;
      for (const k of keys) {
        if ((await idbGet(FS + k)) != null) { await idbDel(FS + k); removed = true; }
      }
      return removed;
    },
    async allPaths() { return keysUnder(''); },
  };
}
