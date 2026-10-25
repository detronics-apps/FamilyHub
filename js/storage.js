// The storage boundary. The UI only ever talks to a store made here, never to
// localStorage directly, so a Google Drive or OneDrive adapter can later be
// written against the same methods (see ARCHITECTURE.md).
//
// The local adapter takes any Storage-like object ({getItem, setItem,
// removeItem}), which is what lets it be tested in Node with a plain Map.
//
// Two kinds of data, two keys:
//   household  shared family records (exported, imported, one day synced)
//   device     this device's own settings: who is using it, each profile's
//              dashboard arrangement, theme, whether the welcome was seen

import { migrate, validateHousehold } from './model.js';
import { ALWAYS_SHOWN } from './dashboard.js';
import { normaliseMusicPrefs } from './music.js';

export const KEYS = {
  household: 'familyhub.household',
  previous: 'familyhub.household.previous',
  device: 'familyhub.device',
  registry: 'familyhub.registry',
  folderBase: 'familyhub.folder.base',
  registryBase: 'familyhub.registry.base',
  fileBase: 'familyhub.file.base',
};

export const EXPORT_KIND = 'family-hub-household';

export const defaultDevice = () => ({
  currentPersonId: null,
  prefs: {},                // personId (or 'anyone') -> { order, hidden }
  theme: 'system',
  onboardedAt: null,
  storageMode: 'device',    // 'device' | 'folder' (the family's Drive folder)
  folderName: null,
  music: normaliseMusicPrefs(null),
  fileSavedAt: null,        // last time a family file was saved (phones)
});

const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= 64) : []);

/**
 * Repair device settings. Dashboard prefs are only sanitised here; they are
 * matched against the installed mini-apps when the dashboard is drawn.
 */
export function normaliseDevice(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const prefs = {};
  for (const [k, v] of Object.entries(d.prefs && typeof d.prefs === 'object' ? d.prefs : {})) {
    prefs[k] = { order: [...new Set(strings(v?.order))], hidden: [...new Set(strings(v?.hidden))].filter((id) => !ALWAYS_SHOWN.has(id)) };
  }
  return {
    currentPersonId: typeof d.currentPersonId === 'string' ? d.currentPersonId : null,
    prefs,
    theme: ['system', 'light', 'dark'].includes(d.theme) ? d.theme : 'system',
    onboardedAt: typeof d.onboardedAt === 'string' ? d.onboardedAt : null,
    storageMode: d.storageMode === 'folder' ? 'folder' : 'device',
    folderName: typeof d.folderName === 'string' ? d.folderName : null,
    music: normaliseMusicPrefs(d.music),
    fileSavedAt: typeof d.fileSavedAt === 'string' ? d.fileSavedAt : null,
  };
}

export function createLocalStore(backing) {
  const read = (key) => {
    try { return backing.getItem(key); } catch { return null; }
  };

  function parseStored(text) {
    try { return { ok: true, household: migrate(JSON.parse(text)) }; } catch (err) {
      return { ok: false, error: err.message || 'The saved data could not be read.' };
    }
  }

  return {
    kind: 'local',

    /** { ok: true, household: null } means nothing saved yet - a first visit. */
    loadHousehold() {
      const text = read(KEYS.household);
      if (text == null) return { ok: true, household: null };
      const result = parseStored(text);
      if (result.ok) return result;
      return { ...result, previousAvailable: read(KEYS.previous) != null && parseStored(read(KEYS.previous)).ok };
    },

    /** Keep the last good copy, write, then read back to prove the write landed. */
    saveHousehold(household) {
      const text = JSON.stringify(household);
      try {
        const current = read(KEYS.household);
        if (current != null && parseStored(current).ok) backing.setItem(KEYS.previous, current);
        backing.setItem(KEYS.household, text);
      } catch (err) {
        return { ok: false, error: /quota/i.test(String(err?.name) + String(err?.message))
          ? 'This browser has run out of storage space for Family Hub. Export your data, then free some space.'
          : 'Saving failed in this browser. Your last change may not be kept - export your data to be safe.' };
      }
      if (read(KEYS.household) !== text) return { ok: false, error: 'Saving could not be confirmed. Export your data to be safe.' };
      return { ok: true };
    },

    /** Recover from a damaged save using the copy kept before the last write. */
    restorePrevious() {
      const text = read(KEYS.previous);
      if (text == null) return { ok: false, error: 'There is no earlier copy to go back to.' };
      const result = parseStored(text);
      if (result.ok) backing.setItem(KEYS.household, text);
      return result;
    },

    loadDevice() {
      try { return normaliseDevice(JSON.parse(read(KEYS.device) || '{}')); } catch { return defaultDevice(); }
    },

    saveDevice(device) {
      try { backing.setItem(KEYS.device, JSON.stringify(device)); return { ok: true }; } catch {
        return { ok: false, error: 'Your settings for this device could not be saved.' };
      }
    },

    /** Installed mini-apps (this device's copy; the folder's Core/installed.json is authoritative). */
    loadRegistry() {
      try { const t = read(KEYS.registry); return t ? JSON.parse(t) : null; } catch { return null; }
    },

    saveRegistry(registry) {
      try { backing.setItem(KEYS.registry, JSON.stringify(registry)); return { ok: true }; } catch {
        return { ok: false, error: 'The list of installed mini-apps could not be saved on this device.' };
      }
    },

    clearAll() {
      for (const key of Object.values(KEYS)) {
        try { backing.removeItem(key); } catch { /* nothing to remove */ }
      }
    },
  };
}

/** A documented, versioned file: { kind, exportedAt, data: <household> }. */
export function exportData(household, now = new Date()) {
  return JSON.stringify({ kind: EXPORT_KIND, exportedAt: now.toISOString(), data: household }, null, 2);
}

export function exportFilename(household, now = new Date()) {
  const slug = household.household.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'household';
  return `family-hub-${slug}-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Check an import without touching anything. The caller shows the summary,
 * asks for confirmation, and only then replaces the current household.
 */
export function parseImport(text) {
  let raw;
  try { raw = JSON.parse(text); } catch {
    return { ok: false, errors: ['This file is not valid JSON, so it is not a Family Hub export.'] };
  }
  if (raw && raw.kind !== undefined && raw.kind !== EXPORT_KIND) {
    return { ok: false, errors: ['This JSON file was not made by Family Hub.'] };
  }
  const body = raw && raw.kind === EXPORT_KIND ? raw.data : raw;
  const check = validateHousehold(body);
  if (!check.ok) return { ok: false, errors: check.errors };
  try {
    const household = migrate(body);
    return {
      ok: true,
      household,
      summary: {
        name: household.household.name,
        people: household.people.length,
        rooms: household.rooms.length,
        chores: household.chores.length,
        events: household.events.length,
        exportedAt: raw.exportedAt ?? null,
      },
    };
  } catch (err) {
    return { ok: false, errors: [err.message] };
  }
}
