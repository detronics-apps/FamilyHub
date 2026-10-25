# Architecture

Implementation notes. Product requirements live in
[Family_Hub_Product_and_Implementation_Plan.md](Family_Hub_Product_and_Implementation_Plan.md).

## Stack

Plain ES modules, plain CSS, static hosting. No framework, bundler or dependency. Tests use
Node's built-in runner. (Decision D-001.)

## Layers

| Layer | Files | Rule |
|---|---|---|
| Domain | `js/dates.js`, `model.js`, `recurrence.js`, `matching.js`, `progress.js`, `dashboard.js`, `demo.js`, `guide.js` | Pure. No DOM, no `window`. Every file has a test. |
| Storage | `js/storage.js` | The only code that knows about persistence. Takes a Storage-like object, so it is tested with a Map. |
| Domain (platform) | `js/folder-store.js`, `folder-sync.js`, `merge.js`, `collections.js`, `family-file.js`, `miniapps.js`, `timer.js`, `music.js` | Pure. Folder handles and the clock are passed in. Every file has a test. |
| Mini-app rules | `js/apps/<id>/logic.js` | Pure, tested. |
| UI | `js/main.js`, `js/ui/**`, `js/apps/<id>/app.js` (+ screens), `js/apps/kit.js` | Renders state, calls domain helpers, saves through the store or a hub. Browser-only adapters (IndexedDB, folder picker, audio, sandbox) live in `js/ui/`. |

## Data model (schema 1)

```
household file  { schema: 1, household: {id, name, createdAt},
                  people: [Person], rooms: [Room], chores: [Chore], events: [Event] }
Person          { id, name, role: adult|child, colour, visibility, demo }
Room            { id, name, demo }
Chore           { id, name, description, roomId, frequency: {unit: day|week|month|year|once, every},
                  startDay, minutes, effort: low|medium|high|null, importance: low|normal|high,
                  kind: routine|maintenance|oneoff|improvement, optional, eligible: [personId],
                  dependsOn: [choreId], instructions, easier, cost, visibility, demo,
                  createdAt, updatedAt }
Event           { id, choreId, type: done|skipped|deferred|rescheduled|dropped,
                  day, at, by, dueDay, until, note }
```

- **Definitions vs occurrences.** A chore is a definition. Each action on it is an Event. The
  *current occurrence* (due day, ready/waiting/closed, how long it has waited, whether it needs a
  review) is **derived** by `recurrence.occurrence()` and never stored — so editing a frequency
  cannot lose history.
- **Stable ids**, never display names. **Every record has `visibility`** (only `shared` is offered
  yet) so private records can be added later without a redesign.
- **Edit helpers return a new household**; nothing mutates.
- **Migration**: `model.migrate()` walks `MIGRATIONS[n]` from the stored `schema` to the current
  one, then normalises. Unversioned data is version 0. Data from a newer version is refused with a
  message, never half-read.

## Storage

Three keys in `localStorage`:

| Key | Contents | Exported? |
|---|---|---|
| `familyhub.household` | shared household data | yes |
| `familyhub.household.previous` | the last good copy, kept before each write | no — recovery only |
| `familyhub.device` | current profile, each profile's dashboard prefs, theme, onboarding timestamp | no |

Save = copy current good value to `previous` → write → read back and compare. A failed or
unconfirmed write shows an error notice. If the saved household cannot be parsed, the app opens on
a recovery screen (restore previous copy / download damaged data / import / start again) and
writes nothing until the person chooses.

Export format: `{ kind: "family-hub-household", exportedAt, data: <household> }`. Import validates,
migrates, shows a summary, and replaces only after confirmation. A bare household object is also
accepted.

### The Drive folder (W2)

The localStorage path above is still the device copy. When a Google Drive folder is connected
(`js/ui/sync.js`), every save is followed about a second later by a sync with the folder, and
again whenever the window regains focus. The folder is authoritative; see DECISIONS.md D-013..D-017.

## UI

- Hash routes: `#/` (dashboard), `#/settings[/dashboard|/drive|/music]`, `#/help`, `#/library`
  (mini-apps), and `#/<app-id>[/<screen>[/<param>]]` for every installed mini-app. Browser back works.
- One `render()` rebuilds the page from state; focus, caret and scroll are captured and restored.
  Dialogs (`<dialog>`) live outside the re-rendered root so typing in an editor is never
  interrupted; the chore editor commits only on Save.
- Notices use `renderNotices()` from the Detronics patterns: every notice closes, two or more fold
  into one group. The latest action confirmation (with Undo) has its own slot so it is never folded
  away.

## Platform additions

Three workstreams added on the `platform` branch, kept separate here as in the plan.

### W2 - Google Drive folder as the home of the data

```
(the folder the person picks, in Google Drive for Desktop)/FamilyHub/
  familyhub.json                  marker + schema version
  Core/settings.json              household name and id
  Core/installed.json             installed mini-apps (registry)
  Data/household/people.json      { kind, schema, records: [...] }  (list order kept)
  Data/household/rooms.json
  Data/chores/chores.json
  Data/chores/events/YYYY-MM.json completions, one file per month
  Data/<app-id>/<collection>/index.json          compact summaries + search text
  Data/<app-id>/<collection>/records/<id>.json   one full record per file
  Data/<app-id>/settings.json
  Data/Media/Music/               your audio files
  MiniApps/<Name>/manifest.json   starter apps (mirror, for visibility)
  MiniApps/ThirdParty/<Pkg>/      other people's packages
  Backups/backup-<date>.json      family files
```

- **Access**: File System Access API on a folder Drive for Desktop syncs (`folder-store.js`). The
  handle is kept in IndexedDB (`ui/idb.js`); after a browser restart permission may need one click.
- **Household sync** (`folder-sync.js`): read folder → compare with the base (copy last agreed, in
  localStorage) → write / adopt / merge / ask. Only changed files are written.
- **Merging** (`merge.js`): per record and per field against the base; deletions on one side apply
  if the other side did not touch the record; same-field changes and edit-vs-delete go to a person.
- **Mini-app records** (`collections.js`): the index answers list and search with one file read;
  `get` reads one record. Each record has `rev`; a save re-reads the stored copy and three-way
  merges if it moved on. Indexes merge entry by entry (higher `rev` wins, tombstones kept).
  `rebuildIndex` repairs files added, renamed or deleted by hand. Measured with 5,000 recipes
  (tests/collections.test.js): index 1.9 MB, load 13 ms, search 7 ms, open one record = one read.
- **Without a folder** mini-app records live in IndexedDB (`ui/idb.js`, same interface) and move
  into the folder on connect (`copyAppData`, newer `rev` wins).
- **Phones / portability** (`family-file.js`): one JSON file with the household, the registry and
  every mini-app file. Used for phone save/open (share sheet / file picker), backups and moving.
- **Status**: `device`, `saving`, `saved`, `reconnect`, `decision`, `first-connect`, `error`; shown
  in the header and, when an answer is needed, as a notice in its own slot.

### W1 - Mini-apps

- **Manifest, permissions, lifecycle**: `miniapps.js` (pure). Registry in `Core/installed.json`
  (device copy in localStorage), merged per app between devices.
- **Starter pack**: `apps/catalogue.js` - manifest + lazy loader per app. Code ships with the core.
- **Hub**: `ui/hub.js` builds the interface an app is given from its granted permissions only:
  `data.collection`, `data.of` (read-only, other apps), `settings`, `people`, `rooms`, `ui.notice`,
  `go/href`, `use/invalidate` (async data for a sync render), plus `core` for Chores only.
- **Third-party**: `ui/packages.js` discovers and validates packages and fingerprints them;
  `ui/sandbox.js` runs one in `<iframe sandbox="allow-scripts">` with a network-blocking CSP and a
  permission-checked postMessage bridge. A sandboxed app keeps its frame across re-renders.
- **Failure containment**: a mini-app that throws or fails to load shows a contained panel (Try
  again / Turn off); the rest of the app keeps working.
- **Developer guide**: MINIAPPS.md; example package: `examples/miniapps/FamilyNotes/`.

### W3 - Music for timed activities

- `timer.js` (pure) counts; `ui/session.js` runs one timed activity and its panel; `ui/media.js` is
  the single shared player (folder music read one track at a time via the folder handle, or device
  files for the session). Timer end only affects the music (`stop`/`fade`/`continue`/`ask`);
  completion is the activity's own Done and never depends on audio.
