// The household (people, rooms, chores and their history) as readable files in
// the family's Drive folder, and the sync step that keeps the folder and this
// device in agreement without overwriting another device's changes.
//
// Folder layout (DECISIONS.md D-017):
//   familyhub.json                 marks the folder; format and schema version
//   Core/settings.json             household name and id
//   Core/installed.json            installed mini-apps (written by the registry)
//   Data/household/people.json     records by id
//   Data/household/rooms.json
//   Data/chores/chores.json
//   Data/chores/events/YYYY-MM.json  completions etc., one file per month
//   Data/<app-id>/...              each mini-app's own records (collections.js)
//   Data/Media/Music/              your audio files
//   MiniApps/, MiniApps/ThirdParty/  mini-app packages
//   Backups/

import { stableStringify } from './folder-store.js';
import { migrate, SCHEMA_VERSION } from './model.js';
import { mergeHousehold, sortEvents } from './merge.js';

export const FOLDER_FORMAT = 'family-hub-folder';

export const PATHS = {
  marker: 'familyhub.json',
  settings: 'Core/settings.json',
  installed: 'Core/installed.json',
  people: 'Data/household/people.json',
  rooms: 'Data/household/rooms.json',
  chores: 'Data/chores/chores.json',
  eventsDir: 'Data/chores/events',
  music: 'Data/Media/Music',
  miniApps: 'MiniApps',
  thirdParty: 'MiniApps/ThirdParty',
  backups: 'Backups',
};

const README = {
  'MiniApps/README.txt': 'Family Hub mini-app packages.\n\nThe starter apps (Chores, Tasks, Tickets, Principles, Decisions) come with Family Hub; their manifests are copied here so you can see what is installed.\n\nTo add someone else\'s mini-app, copy its folder into ThirdParty/. Family Hub will find it, check it, and ask you before installing. Nothing in this folder runs by itself.\n',
  'Data/Media/Music/README.txt': 'Put music files here (mp3, m4a, ogg, wav, flac...). Family Hub can play them while you do a timed task. They are read from this folder only - never uploaded anywhere.\n',
  'Backups/README.txt': 'Family Hub backups. Each file is a complete copy of the household at the time it was made, and can be restored from Settings.\n',
};

// Records are a list, so the order people chose (rooms, people) survives the round trip.
const recordFile = (kind, records) => stableStringify({ kind, schema: SCHEMA_VERSION, records });
const readRecords = (text) => {
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.records) ? parsed.records : Object.values(parsed.records || {});
};

/** Split a household into its files (path -> text). Events go into one file per month. */
export function householdToFiles(h) {
  const files = new Map();
  files.set(PATHS.marker, stableStringify({ kind: FOLDER_FORMAT, schema: SCHEMA_VERSION, householdId: h.household.id }));
  files.set(PATHS.settings, stableStringify({ kind: 'family-hub-settings', schema: SCHEMA_VERSION, household: h.household }));
  files.set(PATHS.people, recordFile('family-hub-people', h.people));
  files.set(PATHS.rooms, recordFile('family-hub-rooms', h.rooms));
  files.set(PATHS.chores, recordFile('family-hub-chores', h.chores));
  const months = new Map();
  for (const e of sortEvents(h.events)) {
    const m = e.day.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m).push(e);
  }
  for (const [m, list] of months) files.set(`${PATHS.eventsDir}/${m}.json`, recordFile('family-hub-events', list));
  return files;
}

/** Rebuild a household from its files. Throws if the files are not a Family Hub household. */
export function filesToHousehold(files) {
  const marker = files.get(PATHS.marker);
  if (!marker) return null;
  const m = JSON.parse(marker);
  if (m.kind !== FOLDER_FORMAT) throw new Error('This folder’s familyhub.json was not made by Family Hub.');
  if (Number.isInteger(m.schema) && m.schema > SCHEMA_VERSION) {
    throw new Error(`This folder was written by a newer version of Family Hub (data version ${m.schema}). Update the app before using it.`);
  }
  const settings = files.get(PATHS.settings) ? JSON.parse(files.get(PATHS.settings)) : {};
  const events = [];
  for (const [path, text] of files) if (path.startsWith(`${PATHS.eventsDir}/`)) events.push(...readRecords(text));
  const h = migrate({
    schema: settings.schema ?? m.schema,
    household: settings.household ?? { id: m.householdId },
    people: readRecords(files.get(PATHS.people)),
    rooms: readRecords(files.get(PATHS.rooms)),
    chores: readRecords(files.get(PATHS.chores)),
    events,
  });
  return { ...h, events: sortEvents(h.events) };
}

/** Read every household file from the folder (one listing for the month files). */
export async function readHouseholdFiles(store) {
  const files = new Map();
  for (const p of [PATHS.marker, PATHS.settings, PATHS.people, PATHS.rooms, PATHS.chores]) {
    const text = await store.read(p);
    if (text != null) files.set(p, text);
  }
  const months = (await store.list(PATHS.eventsDir)) ?? [];
  for (const entry of months) {
    if (entry.kind !== 'file' || !/^\d{4}-\d{2}\.json$/.test(entry.name)) continue;
    const p = `${PATHS.eventsDir}/${entry.name}`;
    const text = await store.read(p);
    if (text != null) files.set(p, text);
  }
  return files;
}

/** Write only the files whose text changed; remove month files that are now empty. */
export async function writeHousehold(store, household, current = null) {
  const now = current ?? await readHouseholdFiles(store);
  const next = householdToFiles(household);
  const written = [];
  for (const [path, text] of next) {
    if (now.get(path) === text) continue;
    await store.write(path, text);
    written.push(path);
  }
  for (const path of now.keys()) {
    if (path.startsWith(`${PATHS.eventsDir}/`) && !next.has(path)) { await store.remove(path); written.push(path); }
  }
  for (const [path, text] of Object.entries(README)) {
    if ((await store.read(path)) == null) await store.write(path, text);
  }
  return written;
}

/** A household as canonical text, for "has anything changed?" comparisons. */
export const fingerprint = (h) => (h ? stableStringify({ ...h, events: sortEvents(h.events) }) : '');

/**
 * Bring this device and the folder into agreement.
 *
 * @param store  a folder store
 * @param base   the household as last agreed with the folder (null on first connect)
 * @param mine   this device's household
 * @returns {{ status: 'unchanged'|'written'|'adopted'|'merged'|'conflict'|'first-connect', household, conflicts, written }}
 *   - 'first-connect': no base yet and the folder already has a family - `theirs` holds it;
 *                      the caller asks whether to use it or merge (mergeHousehold(null, ...)).
 *   - 'adopted': the folder had newer data and this device had no changes - use `household`.
 *   - 'merged':  both changed; merged without conflicts and written back.
 *   - 'conflict': both changed the same thing; `household` is the merge with this device's
 *                 values, `conflicts` lists what a person must choose. Nothing was written.
 */
export async function syncHousehold(store, { base, mine }) {
  const current = await readHouseholdFiles(store);
  const theirs = filesToHousehold(current);

  if (!theirs) {
    const written = await writeHousehold(store, mine, current);
    return { status: 'written', household: mine, conflicts: [], written };
  }

  if (theirs.household.id !== mine.household.id && base) {
    throw new Error('This folder holds a different household from the one on this device.');
  }

  const fpTheirs = fingerprint(theirs);
  const fpMine = fingerprint(mine);
  if (fpTheirs === fpMine) return { status: 'unchanged', household: mine, conflicts: [], written: [] };

  // First connect to a folder that already holds a family (a second laptop, say):
  // a person decides whether to use the folder's family or merge this device's into it.
  if (!base) return { status: 'first-connect', household: mine, theirs, conflicts: [], written: [] };

  const fpBase = fingerprint(base);
  if (fpTheirs === fpBase) {
    const written = await writeHousehold(store, mine, current);
    return { status: 'written', household: mine, conflicts: [], written };
  }
  if (fpMine === fpBase) return { status: 'adopted', household: theirs, conflicts: [], written: [] };

  // Both sides changed: merge.
  const { household, conflicts } = mergeHousehold(base, mine, theirs);
  if (conflicts.length) return { status: 'conflict', household, theirs, conflicts, written: [] };
  const written = await writeHousehold(store, household, current);
  return { status: 'merged', household, conflicts: [], written };
}
