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
| UI | `js/main.js`, `js/ui/**` | Renders state, calls domain helpers, saves through the store. Never touches `localStorage` directly (except the recovery screen downloading the raw damaged data). |

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

### Future cloud adapter (Phase 7, not started)

A Google Drive / OneDrive adapter should implement the same methods as `createLocalStore`
(`loadHousehold`, `saveHousehold`, `restorePrevious`, `loadDevice`, `saveDevice`, `clearAll`)
plus file listing for documents. Conflict handling is an open decision (see DECISIONS.md, O-3).

## UI

- Hash routes: `#/`, `#/chores[/rooms|/plan|/progress]`, `#/settings[/dashboard]`, `#/help`,
  `#/<module>` (placeholder). Browser back works.
- One `render()` rebuilds the page from state; focus, caret and scroll are captured and restored.
  Dialogs (`<dialog>`) live outside the re-rendered root so typing in an editor is never
  interrupted; the chore editor commits only on Save.
- Notices use `renderNotices()` from the Detronics patterns: every notice closes, two or more fold
  into one group. The latest action confirmation (with Undo) has its own slot so it is never folded
  away.
