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
| 9 Meals | **Built** as a section of three mini-apps (v0.3.0): Recipe Book (recipes, weekly plan, shopping list), Calorie Checker and Meal Assistant, on one shared USDA food database and the food details in people's profiles (D-024, D-025). **Open:** dietitian review; South African composition data. |
| 10 Finance | **Built**: monthly budgets, savings and debt goals with visible-assumption projections; totals count each goal once. No bank links. |
| 11 Exercise, Holidays, Faith | **Built** as separate starter mini-apps. Health was built, then removed at the owner's request: split into Meals and Exercise (D-023). |
| 12 Hardening | Not started. |
| Onboarding import (product-patterns) | **Built**: CSV templates for recipes, chores, tasks; import in Settings with a summary, or via the Drive folder's `Import/`. Additive and idempotent. |

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

## Sections and the Meals section (v0.3.0)

| Step | Status |
|---|---|
| Sections on the home screen; mini-apps inside them; `section` in manifests | Done, tested, checked in browser |
| Health removed; a starter no longer shipped is uninstalled with records kept | Done, tested, checked in browser |
| Food database from USDA FoodData Central (`tools/build_foods.py` → `data/foods.json`, 13.6k foods, ~1 MB compressed) | Done, tested |
| Food details on people (Settings › People › Food details) | Done, tested, checked in browser |
| Recipe Book (the former Meals app, recipes first) | Done, checked in browser |
| Calorie Checker | Done, checked in browser |
| Meal Assistant: guide of 83 foods, reference values, interactions, engine, screens | Done, tested, checked in browser (desktop and 375 px) |
| Gender on people; pregnancy only for a female aged 16 or more | Done, tested, checked in browser |
| People as its own page; dated heights and weights (merged by id, in the folder) | Done, tested, checked in browser |
| Meal Assistant opens family recipes | Done, tested, checked in browser |
| Meals and recipes as one record; Calorie Checker family meal / person's plate → save as a meal | Done, tested, checked in browser |
| Portion guide per person, leftovers; energy goals and personal goals on People | Done, tested, checked in browser |
| Shopping as its own section (send from meals, This Week, chores); This Week as its own mini-app | Done, tested, checked in browser |
| Birthday on the person card; stage of life and adult/child worked out from it | Done, tested, checked in browser |
| Pregnancy on the card with a conception date; weeks, due date, trimester portions | Done, tested, checked in browser |
| Age and stage guidance: People cards, home notices, meal and plate cautions | Done, tested, checked in browser |
| Metric/imperial setting with conversions | Done, tested, checked in browser |
| Planned meals as occasions: leftovers set aside, extra portions, own changes, notes, feedback, guests | Done, tested, checked in browser |
| Recipe feedback: tried, family rating, individual preferences, dated notes; variants | Done, tested, checked in browser |
| Planner browse with combined filters, compare, choose with servings and leftovers | Done, tested, checked in browser |
| Plan my week (mix of favourites and new meals, shortfall explained) | Done, tested, checked in browser |
| Six-type spider charts, detail charts, calories per serving and per person | Done, tested, checked in browser |
| How the week looks, Optimise My Week, Meal Assistant link to a planned meal | Done, tested, checked in browser |
| Shopping: aisles, packaged items rounded up, copy and print | Done, tested, checked in browser |
| Ingredient editor (pick, amount, unit), makes, batches in halves with whole eggs, our own items as ingredients | Done, tested, checked in browser |

## Test results

`npm test`: **316 tests, 316 pass** (Node 24). Browser checks: see TEST_PLAN.md.

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

## Planned, not to be built yet

### Planner (calendar) - owner request 2026-10-25

**Planning only. Do not build until the owner says so.**

- A calendar-style mini-app, and one of the first tiles on the home screen (near Chores).
- The week at a glance (with a month view), gathering dated things from the other mini-apps
  through read-only access (`data:<app>:read`): chore turns that are due, tasks with a planned
  day, the weekly meal plan, holiday dates, decision review dates, principle review dates.
- Its own simple events too (school play, dentist), stored in its own collection.
- Questions to settle first: should it be a starter app or a core screen; how a planned-but-passed
  item is shown without guilt (plan §3.7); whether it can move things (e.g. drag a task to
  another day) - that would need the owning app's screen, since only an app writes its own
  records (W1 rule).
- Listed under Mini-apps → Coming later so nobody mistakes it for a working app.

## Next steps proposed

0. Owner: try the Meals section with your own family's food details; say which sections should
   be grouped (for example Tickets, Principles and Decisions as one "Family" section).

1. Owner: connect a real Drive for Desktop folder on a laptop, then a second laptop; try a phone
   family-file round trip.
2. Owner decisions: D-018 (starter code location), O-1 name, O-4/O-5 accounts and privacy levels.
3. Usability week with the family (Phase 5.3).
4. Next mini-apps: Meals (recipes on the collection index - the 5,000-recipe test is its basis).
