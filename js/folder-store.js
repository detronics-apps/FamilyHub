// A small file store: read, write, list and remove files by path.
//
// `createFolderStore(handle)` works on any File System Access directory handle:
// the family's Google Drive folder (picked once in Chrome/Edge), or the
// browser's private storage. `createMemoryStore()` is the same interface over
// a Map, for tests and as a fallback. Nothing here touches `window`; the handle
// is passed in.
//
// Paths are 'Data/chores/chores.json' style: forward slashes, no leading slash,
// no '..'. Missing files read as null rather than throwing.

export class FolderError extends Error {
  constructor(kind, message, cause) {
    super(message);
    this.kind = kind;          // 'permission' | 'missing-folder' | 'io' | 'bad-path'
    this.cause = cause;
  }
}

const SEGMENT = /^[^/\\:*?"<>|]+$/;

export function splitPath(path) {
  const parts = String(path).split('/').filter(Boolean);
  if (!parts.length || parts.some((p) => p === '.' || p === '..' || !SEGMENT.test(p))) {
    throw new FolderError('bad-path', `Not a valid path: ${path}`);
  }
  return parts;
}

function classify(err, what) {
  const name = err?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new FolderError('permission', 'Family Hub no longer has permission to use the folder.', err);
  }
  if (name === 'NotFoundError') return new FolderError('missing-folder', `${what} could not be found.`, err);
  return new FolderError('io', `${what} could not be read or written (${err?.message || name || 'unknown error'}).`, err);
}

export function createFolderStore(root) {
  async function dir(parts, create) {
    let d = root;
    for (const p of parts) {
      try {
        d = await d.getDirectoryHandle(p, { create });
      } catch (err) {
        if (err?.name === 'NotFoundError' || err?.name === 'TypeMismatchError') return null;
        throw classify(err, p);
      }
    }
    return d;
  }

  async function fileHandle(path, create) {
    const parts = splitPath(path);
    const d = await dir(parts.slice(0, -1), create);
    if (!d) return null;
    try {
      return await d.getFileHandle(parts.at(-1), { create });
    } catch (err) {
      if (err?.name === 'NotFoundError' || err?.name === 'TypeMismatchError') return null;
      throw classify(err, path);
    }
  }

  return {
    kind: 'folder',
    name: root.name,

    async read(path) {
      const h = await fileHandle(path, false);
      if (!h) return null;
      try { return await (await h.getFile()).text(); } catch (err) { throw classify(err, path); }
    },

    /** The File itself (for audio): read only when playing, never held for the whole library. */
    async file(path) {
      const h = await fileHandle(path, false);
      if (!h) return null;
      try { return await h.getFile(); } catch (err) { throw classify(err, path); }
    },

    async write(path, text) {
      const h = await fileHandle(path, true);
      try {
        const w = await h.createWritable();
        await w.write(text);
        await w.close();
      } catch (err) { throw classify(err, path); }
    },

    /** Entries directly inside a folder, or null if the folder does not exist. */
    async list(path = '') {
      const d = path ? await dir(splitPath(path), false) : root;
      if (!d) return null;
      const out = [];
      try {
        for await (const [name, h] of d.entries()) out.push({ name, kind: h.kind });
      } catch (err) { throw classify(err, path || 'The folder'); }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    },

    async remove(path) {
      const parts = splitPath(path);
      const d = await dir(parts.slice(0, -1), false);
      if (!d) return false;
      try {
        await d.removeEntry(parts.at(-1), { recursive: true });
        return true;
      } catch (err) {
        if (err?.name === 'NotFoundError') return false;
        throw classify(err, path);
      }
    },
  };
}

/** The same interface over a Map of path -> text. `seed` may be a Map or object. */
export function createMemoryStore(seed = {}) {
  const files = new Map(seed instanceof Map ? seed : Object.entries(seed));
  const stats = { reads: 0, writes: 0, lists: 0 };
  const under = (path) => (path ? `${splitPath(path).join('/')}/` : '');
  return {
    kind: 'memory',
    name: 'memory',
    files,
    stats,
    async read(path) { stats.reads += 1; splitPath(path); return files.has(path) ? files.get(path) : null; },
    async file(path) { stats.reads += 1; return files.has(path) ? { name: path.split('/').at(-1), text: async () => files.get(path) } : null; },
    async write(path, text) { stats.writes += 1; splitPath(path); files.set(path, String(text)); },
    async list(path = '') {
      stats.lists += 1;
      const prefix = under(path);
      const seen = new Map();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length).split('/');
        seen.set(rest[0], rest.length > 1 ? 'directory' : 'file');
      }
      if (!seen.size && path) return null;
      return [...seen].map(([name, kind]) => ({ name, kind })).sort((a, b) => a.name.localeCompare(b.name));
    },
    async remove(path) {
      const prefix = `${splitPath(path).join('/')}/`;
      let removed = files.delete(path);
      for (const key of [...files.keys()]) if (key.startsWith(prefix)) { files.delete(key); removed = true; }
      return removed;
    },
  };
}

/** JSON with keys in a fixed order, so the same data always produces the same text. */
export function stableStringify(value) {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}
