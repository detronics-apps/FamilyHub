# Implementation plan and progress

Phases follow §22 of the product plan. This file records status only.

## Progress (2026-10-25, v0.1.0)

| Phase | Status |
|---|---|
| 0 Inspect, clarify, plan | Done. No prior code existed; stack and decisions in DECISIONS.md. |
| 1 App shell and dashboard | Done. Reorder/hide/restore, per-profile prefs, profile picker. |
| 2 Data model and local persistence | Done. Versioned schema, storage interface, save verification, previous-copy recovery, export/import, migration test. |
| 3 Chores planning | Done. Editor with progressive disclosure, rooms, occurrences derived from history, example family. |
| 4 Chores execute and momentum | Done. Filters, transparent ordering, Done/Not now/Undo, momentum, finish-for-now, review prompts. |
| 5 Shared views and usability testing | Built: neutral progress and activity. **Not done:** usability tests with real people (5.3–5.4) — these need the family. |
| 6–12 | Not started. Modules show as labelled placeholders. |

### Test results

`npm test`: 66 tests, 66 pass (node 24). The browser walkthrough of the first-release flow passed
(see TEST_PLAN.md, "Browser checks run").

### Known limitations

- Data lives in one browser on one device. Not a backup; no sync.
- Profiles are not secure. No private records yet — do not store sensitive data.
- Execute filters reset on reload (deliberate: each visit starts from "right now").
- No reminders or notifications.
- Recurring chores with a "wait until" dependency on each other in a loop would block each other;
  the editor prevents a direct two-way loop but not longer ones.
- Times are calendar days only (no time-of-day scheduling).

### Next step proposed

Phase 5.3: use it as a family for a week with the example family removed, and note where anyone
hesitates. Then Phase 6 (Tickets, Principles, Decisions) — which first needs O-4/O-5 for private
tickets.

### Decisions awaiting the owner

O-1 to O-6 in DECISIONS.md. None block using this release.
