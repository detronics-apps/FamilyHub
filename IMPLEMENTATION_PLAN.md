# Implementation plan and progress

Phases follow §22 of the product plan. The three platform additions are tracked separately as
workstreams W1-W3. This file records status only.

## Original phases

| Phase | Status |
|---|---|
| 0 Inspect, clarify, plan | Done (v0.1.0). |
| 1 App shell and dashboard | Done. Dashboard now follows installed mini-apps. |
| 2 Data model and local persistence | Done. Local storage remains the device copy; see W2. |
| 3 Chores planning | Done. Chores is now a mini-app. |
| 4 Chores execute and momentum | Done; Start adds a timer and optional music (W3). |
| 5 Shared views and usability testing | Built. **Not done:** usability tests with real people (5.3-5.4). |
| 6 Tickets, Principles, Decisions | **Built (v0.2.0)** as starter mini-apps, plus Tasks/Projects (§9). Tickets are shared-only until accounts exist (O-4, O-5). |
| 7 Cloud storage | Replaced by W2 (folder method, no publisher). Phone live sync not possible under that rule (D-013, O-7). |
| 8 Medical | Not started - needs access rules first. |
| 9-12 | Not started. Planned modules are listed under Mini-apps → Coming later. |

## Platform workstreams (v0.2.0, `platform` branch)

### W1 - Installable, removable mini-apps

| Step | Status |
|---|---|
| Manifest format, validation, compatibility, permissions | Done, tested |
| Registry lifecycle: install, disable, update, uninstall keeping data, reinstall recovering it, delete data separately | Done, tested, checked in browser |
| Hub interface (permission-shaped) and lazy loading | Done |
| Chores converted; dashboard and routing from the registry | Done |
| Starter apps on the hub: Tasks, Tickets, Principles, Decisions | Done, logic tested, checked in browser |
| Third-party discovery in `MiniApps/ThirdParty`, review screen, fingerprinting | Done, checked in browser |
| Sandbox + permission-checked bridge | Done; 7 escape attempts measured blocked |
| Developer guide + example package | Done (MINIAPPS.md, examples/miniapps/FamilyNotes) |
| Failure containment | Done (a broken app shows a contained panel) |

### W2 - Google Drive as the home of all data

| Step | Status |
|---|---|
| Folder store over File System Access handles | Done, tested (fake handle in Node, browser private storage in the browser) |
| Household as readable files; sync with base; three-way merge; conflict choice | Done, tested, checked in browser |
| Mini-app collections: index + record files, on-demand loading, repair | Done, tested (5,000-recipe test) |
| Status that never claims more than happened | Done |
| First connect into a folder that already has a family | Done |
| Backups in the folder, restore | Done |
| Family file for phones, moving and portability | Done, tested |
| Startup reconnect and permission prompts | Done (one click after a browser restart) |

### W3 - Optional music for timed activities

| Step | Status |
|---|---|
| Timer (pure) and session panel | Done |
| Shared player: folder music one track at a time, device files for the session | Done, checked in browser |
| Offer on Start, remember the answer, timer-end stop/fade/continue/ask | Done, checked in browser (fade verified) |
| Failure paths: no music, unplayable file | Done; Done always works |

## Test results

`npm test`: **151 tests, 151 pass** (Node 24). Browser checks: see TEST_PLAN.md.

## Known limitations

- **Real Google Drive not exercised yet.** All folder tests used the browser's private storage
  standing in for the Drive folder (same API). Connecting a real Drive for Desktop folder needs the
  owner, because the folder picker is a system dialog.
- Phones cannot keep a live link to Drive; they use the family file (manual, labelled, reminded).
- The folder method works in Chrome and Edge on a computer only.
- Drive for Desktop's own upload status is invisible to the app: "Saved to Drive" means saved into
  the Drive folder on this computer.
- Profiles are not security; no private records yet - do not store sensitive data.
- A sandboxed third-party app could leak data it was granted by navigating its own frame.
- Starter apps' code ships with the core rather than from Drive (D-018, needs approval).
- Timer state is per window; closing the tab ends the session (the chore is unaffected).

## Next steps proposed

1. Owner: connect a real Drive for Desktop folder on a laptop, then a second laptop; try a phone
   family-file round trip.
2. Owner decisions: D-018 (starter code location), O-1 name, O-4/O-5 accounts and privacy levels.
3. Usability week with the family (Phase 5.3).
4. Next mini-apps: Meals (recipes on the collection index - the 5,000-recipe test is its basis).
