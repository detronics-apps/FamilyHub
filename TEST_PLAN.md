# Test plan

## Automated (`npm test`)

One test file per pure module in `tests/`. Highlights mapped to the product plan:

| Plan requirement | Test |
|---|---|
| 5-minute filter never suggests a longer known task unless overrun allowed | matching: "a five-minute filter…" |
| Low energy excludes high effort | matching: "low energy leaves out…" |
| "Any room" includes all rooms; room filter restricts | matching: "any room…", "anywhere but the bathroom" |
| Child sees only eligible tasks | matching: "a child sees only…" |
| Completing updates history and suggestions | recurrence: "done moves…"; matching: "completing a chore updates…" |
| Missed routines do not cascade | recurrence: "a missed routine stays ONE occurrence" |
| Changing frequency keeps history | model + recurrence: "changing frequency…" |
| One room item does not complete others | recurrence: "completing one room item…" |
| Demo data can be removed, real data kept | model: "removing the example family…" |
| Export/import round-trip; invalid import changes nothing | storage tests |
| Schema migration from an older sample | model: "migrates a literal unversioned (v0) household" |
| Damaged save is recoverable | storage: "a damaged save is reported…" |
| Dashboard reorder/hide/restore; settings cannot be hidden | dashboard tests |
| Progress has no per-person figures | progress: "progress carries no per-person figures" |

## Browser checks run (2026-10-25, built-in browser, Chromium)

1. First open shows the welcome; "Load the example family" lands on Chores. ✔
2. 5 minutes + low energy → three low-effort ≤5-min suggestions. ✔
3. Done on "Clean the basin" → recorded for Alex, momentum panel with 2 labelled options. ✔
4. "Finish for now" → calm ending screen. ✔
5. Reload → basin recorded, no longer suggested, Rooms shows "Next Sun 1 Nov". ✔
6. Plan: empty name is caught; new custom-frequency chore saved with room/minutes/effort. ✔
7. Oven review prompt shows; changing frequency keeps its 3 history records. ✔
8. Settings: hide Finance, move Tickets up → dashboard reflects it; Show restores. ✔
9. Switch to Mia (child): own dashboard order, only "Tidy the toys away" suggested. ✔
10. Not now → Tomorrow → Undo restores the chore; Undo is visible, not folded. ✔
11. No horizontal overflow on any screen at 320px and 375px; dark mode checked. ✔
12. No console errors. ✔

Not run: import through the real file picker (covered by unit tests of `parseImport`), keyboard-only
walkthrough with a screen reader, Safari/Firefox, a real phone.

## Manual checks for a person

- Keyboard only: Tab through home → Chores → a chip → Done. Focus ring always visible.
- Settings → Export, then Delete everything, then Import the file: everything returns.
- Usability (plan §5.3): time how long it takes someone new to find and finish one chore; note
  hesitations; ask whether anything felt like pressure.
