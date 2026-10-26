# Decisions

Format: question · decision · why · status. "Open" items need the owner's input before the phase
that depends on them.

## Made (2026-10-25)

**D-001 Stack.** No existing repo. Plain static ES modules + CSS, Node's test runner, no
dependencies — the Detronics app pattern the owner asked for. Simple to host anywhere, nothing to
build or update. *Trade-off:* no TypeScript types; JSDoc and normalisers instead. Approved by the
owner's instruction to use the detronics-app skill.

**D-002 Storage for this release.** Local-only (`localStorage`) behind a storage interface, with
versioned export/import. This is plan §5.2 modes 1 and 2. No cloud, no server.

**D-003 Dashboard preferences are device + profile data**, kept under a separate key and not
exported (plan §4.3). Without real accounts they cannot follow a person across devices.

**D-004 Profiles are not authentication.** Said on the picker, in Settings, the guide and the
privacy notice (plan §4.2).

**D-005 Visual style.** Warm palette (cream, cocoa, terracotta, sage, honey), large touch targets,
rounded shapes — at the owner's request that it feel family-warm rather than the Detronics blues.
The Detronics brand chrome (logo link, coffee button), the Simple/Advanced/Expert levels and the
engineering helpers were deliberately not carried over.

**D-006 Decisions module placement.** Shown as its own (placeholder) dashboard button so it can be
hidden; the model has not committed either way (plan §12, open item 6).

**D-007 Eligibility.** A chore with no one ticked can be done by any adult. Children see only
chores that name them. Conservative default for "a child should see only eligible tasks".

**D-008 Recurrence semantics** (plan open item 8 — a default, reversible):
- One current occurrence per chore. Missing it never creates more (no cascade).
- Next due = day last done or skipped + one interval. Months clamp (31 Jan → 28/29 Feb).
- "Not now → tomorrow / next week" (deferred) and "move to a date" (rescheduled) set the due day of
  the current turn only.
- One-off chores stay ready until done or "no longer needed".
- Review prompt when put off 3 times in a row, or waiting ≥ 2 whole cycles. It only asks.

**D-009 Ranking** (plan open item 9). Filters exclude; nothing is scored. Order: ready before
optional/not-due → importance → longest wait relative to its own cycle → quickest → name. Shown to
the user in words.

**D-010 Energy filter.** Low energy shows only low-effort chores; "Okay" shows low and some;
"Up for something bigger" shows all. Chores with no effort set always pass, labelled.

**D-011 Deleting** a chore removes its history too (confirmation says so and suggests changing
frequency instead). Removing a person keeps their history as "a former member". Removing a room
keeps its chores.

**D-012 No analytics** of any kind (plan open item 12).

## Open — need the owner

**O-1 Product name.** "Family Hub" is used as the working name.

**O-2 Cloud provider** (Google Drive, OneDrive or both) and whether data is one household file or
several. Needs current API research before Phase 7.

**O-3 Sync conflicts.** Last-write-wins, field-level merge, or a conflict screen? The plan forbids
silent overwrites, so the recommendation is a conflict screen for same-record edits.

**O-4 Authentication model** — shared workspace vs individual accounts. Must be settled before
private tickets or any medical/financial data (Phases 6 and 8).

**O-5 Privacy levels** — shared / adult-only / private / child-visible. The `visibility` field is
ready; the rules are not.

**O-6 Reminders/notifications** — none in this release.

## Platform additions (2026-10-25) — workstreams W1 mini-apps, W2 Google Drive, W3 music

Requirements: the owner's "Three Additional Requirements" brief. Work happens on the `platform`
branch; `main` (the live site) is untouched until the owner merges.

**D-013 (W2) No publisher, no sign-in: Drive is reached as a folder.** The owner's rule for every
Detronics app holds: the app talks to no server, nobody signs in to anything of the publisher's,
and each family's data is theirs alone. The Google Drive REST API was considered and rejected — it
requires a registered publisher on every family's consent screen. Instead (the method in the
detronics-app skill, `references/google-drive-sync.md`): Google Drive for Desktop puts the family's
Drive folder on the computer; the person picks it once in the app (File System Access API); the app
reads and writes ordinary files there and Drive for Desktop uploads them. Works in Chrome and Edge
on a computer. The folder handle is remembered in IndexedDB; after a restart the browser may ask
for permission again, which needs one click ("Reconnect").

**D-014 (W2) Phones: manual open/save of a family file, honestly labelled.** Phone browsers cannot
keep a live link to a folder. On a phone the app works fully on its own device copy, and offers
"Save family file to Drive" (the phone's share menu → Drive) and "Open family file from Drive"
(the phone's file picker), which merges using the same rules as below. The phone is never shown as
"synced".

**D-015 (W2) The Drive folder is authoritative; the browser keeps a working copy.** Every change is
saved on the device first and then written to the folder within about a second. Status is always
one of: *Saved to your Drive folder* (with time — Drive for Desktop then uploads it; the app cannot
see the upload itself and says so), *Saving*, *On this device only* (folder not connected or not
reachable), *Reconnect needed*, *Needs your decision*. "This device only" (the v0.1 mode) stays for
anyone without Drive.

**D-016 (W2) Conflicts are resolved by kind of data, never by blanket last-write-wins.** Another
laptop can change the folder at any time (through Drive). Before each write the app re-reads the
files and compares with the copy it last synced (the base):
- Nobody else changed it → write.
- They changed it, I did not → take theirs.
- Both changed → three-way merge per record and per field. Different records or different fields →
  both kept automatically. Completions (an append-only log) → both sides kept. A deletion on one
  side and no change on the other → deleted. The same field changed differently, or an edit against
  a deletion → the person chooses, seeing both values.
- Indexes are derived and merged automatically.

**D-017 (W2) Folder layout and identity.** Inside the folder the person picks:
`familyhub.json` (marks the folder, schema version), `Core/` (household settings, installed
mini-apps), `MiniApps/` (package folders; `ThirdParty/` for other people's), `Data/<app-id>/`
(records), `Data/Media/Music/` (your audio), `Backups/`. Records carry stable ids, a `rev` and the
collection's schema version inside the file; filenames are never the identity. Large collections
are `index.json` (compact summaries) plus one file per record, so a search reads one file, not
thousands.

**D-018 (W1) Starter-pack mini-apps ship with the core; third-party mini-apps load from the
folder.** Chores, Tasks, Tickets, Principles and Decisions are first-party: their code is served
with the app (trusted, versioned with the core). Their manifests are mirrored into
`MiniApps/<Name>/` so they are visible in Drive. *Deviation from "all packages live in Drive"* —
needs the owner's OK; having the core execute first-party code read back from Drive adds risk and
no benefit.

**D-019 (W1) Third-party isolation.** Third-party code runs only in a sandboxed iframe
(`sandbox="allow-scripts"`, no same-origin) with a Content Security Policy that blocks network
requests. It cannot reach the app's storage, the folder, or other apps' data. It talks to the core
only by messages; the core checks every request against the permissions declared in its manifest
and approved by the person at install. Copying a folder in runs nothing: discovery → validation →
the person reviews permissions → Install. The code is fingerprinted (SHA-256) at install; if it
changes on disk it will not run until the change is reviewed. *Residual risk:* a sandboxed app
could still leak data it was granted by navigating its own frame, so the install screen says to
grant only apps you trust.

**D-020 (W1) Uninstall keeps data.** Hide (dashboard only) → Disable (not loaded, still installed)
→ Uninstall (removed, data kept in `Data/<app-id>/`) → Delete data (separate, confirmed).
Reinstall reconnects retained data when its schema version is one the app understands; otherwise
the data is left untouched and the person is told why.

**D-021 (W3) Music = a core media service, offered when a timed activity starts.** One player for
the whole app. Sources: audio files in `Data/Media/Music/` of the connected folder (read one track
at a time, never uploaded anywhere), or files chosen on this device for the session (phones).
Playback starts only from a click (browser autoplay rules). Timer, completion and music are
separate: an audio error can never block Done. Spotify and other streaming services are separate
future work.

**D-022 Sections hold mini-apps (owner, 2026-10-26).** The home screen shows sections of family
life (Chores, Meals, Finance...), which are part of Family Hub and never installed or removed. The
mini-apps inside a section are what get installed, turned off and uninstalled. A manifest names
its section (`section`); a missing or unknown one lands in "More". A section with one mini-app
switched on opens it directly. Existing data keeps its app id (the Meals recipes stay in
`Data/meals`), so nothing moves.

**D-023 Health removed (owner, 2026-10-26).** Its food side became the Meals section and its
activity side is Exercise. A starter app a version no longer ships is uninstalled with its records
kept, like any uninstall (D-020).

**D-024 Nutrition is now in scope (owner, 2026-10-26).** This replaces the earlier "no nutrition
estimates or advice" line (plan 13.4, Phase 9.4-9.6), which waited for a reliable source and a
safety review. The source is USDA FoodData Central (public domain): Foundation, SR Legacy and
FNDDS foods, built into `data/foods.json` by `tools/build_foods.py`; the 2 million US branded
products are left out. Unknown values stay unknown, never zero. The Meal Assistant follows the
owner's specification (docs/MEAL_ASSISTANT.md): suggestions only, no scores, no tracking, no
supplement advice, no suggestions for babies under one, safety rules applied before any benefit.
*Still open:* a review by a registered dietitian before wide release, and South African food
composition data (SAFOODS) - it needs a licence, so USDA stand-ins are used for pap, samp, maas
and the like.

**D-025 Food details on people (owner, 2026-10-26).** Birthday, sex for reference values,
pregnant/breastfeeding, weight, allergies, diet, things to avoid, likes, dislikes and food wishes
are optional fields on each person, edited in Settings › People. They are visible to everyone in
the household (there are no private records yet - O-4/O-5) and are given only to apps granted
`people:food`, which is first-party only. Gender (Male/Female) is chosen on the People list itself; pregnant or
breastfeeding is offered only for a female aged 16 or more (no birthday: an adult), and is ignored
otherwise (owner, 2026-10-26).

**O-7 (W2) Phone live sync.** Only possible through a registered Google app (rejected, D-013).
Revisit only if browsers gain folder access on phones.
