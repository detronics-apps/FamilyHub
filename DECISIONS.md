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
