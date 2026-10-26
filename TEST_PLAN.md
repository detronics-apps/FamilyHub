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

## Platform additions (v0.2.0)

### Automated

| Requirement | Test file |
|---|---|
| Folder store on a real folder-handle interface; revoked permission reported | folder-store.test.js |
| Household round-trips through readable files; only changed files written | folder-sync.test.js |
| Another device changed it → adopted; both changed different things → merged; same field → conflict and nothing written | folder-sync.test.js, merge.test.js |
| First connect into a folder with a family asks; a different household is never merged in | folder-sync.test.js |
| Completions from two laptops both kept; an undo survives a merge; edit vs delete asks | merge.test.js |
| Index + record files; search reads only the index; repair of renamed/deleted/added files | collections.test.js |
| 5,000 recipes / 2,000 ingredients: one read to open, zero to search, one to open a recipe | collections.test.js (prints timings) |
| Records never replaced by older copies when moving between device and folder | family-file.test.js |
| Family file: everything in one file, bad files refused, v0.1 exports still open | family-file.test.js |
| Manifest validation, permissions, compatibility; install / disable / update / uninstall keeping data / reinstall / delete | miniapps.test.js |
| Third-party code cannot request first-party permissions or escape its package path | miniapps.test.js |
| The example package is valid | miniapps.test.js |
| Timer, play queue, fade, music preferences | media.test.js |
| Tasks, Tickets, Principles, Decisions rules | tasks/tickets/principles/decisions.test.js |

### Browser checks run (2026-10-25, `?folder=private` - the browser's private storage stands in for the Drive folder)

1. v0.1 data on the device loads unchanged on v0.2. ✔
2. Connect: folder structure created, household written as readable files, status "Saved to Drive". ✔
3. Another laptop's change (file edited directly) is adopted on focus, with a notice. ✔
4. Same chore field changed in the folder and here → "Needs a decision"; folder untouched; dialog
   shows both values; choice applied to device and folder. ✔
5. Music from `Data/Media/Music` plays on Start → "Play music"; Done records the chore while music
   continues; next Start does not restart the playlist; timer end fades and stops; no-music case
   explains and Done works. ✔
6. Third-party: discovery, review screen requires "I trust", install. Probe package: network,
   parent page, localStorage, IndexedDB, outside script, ungranted people, undeclared collection all
   blocked; own collection allowed. ✔
7. Changing a package's code on disk stops it with the reason; reviewing re-enables it. ✔
8. Family Notes code inside the sandbox: add → stored; summary in the index; Read fetches the full
   record. ✔
9. Uninstall keeps `Data/<id>`; library lists it; reinstall recovers the records. ✔
10. Tasks quick add, steps, done; Tickets capture → meeting → decision → trial → observation →
    action task; links shown both ways; look back → Adapt; Principles examples. ✔
11. No console errors. ✔

### Not yet run

- A real Google Drive for Desktop folder (needs the owner at the system folder picker).
- Two real laptops at once; a real phone family-file round trip.
- Safari/Firefox (folder sync is Chrome/Edge only by design; the rest should work).
- Keyboard-only and screen-reader passes of the new screens.

## Later modules and importing (v0.2.0, continued)

### Automated

| Requirement | Test file |
|---|---|
| Recipes: ingredient lines, scaling, units that may and may not be added, shopping list keeps manual and bought items, nutrition never estimated | meals.test.js |
| Holidays: dates, budget (over only with a budget), packing, itinerary order | holidays.test.js |
| Finance: month totals with unplanned spending, saving and debt projections (incl. "never pays off"), goal totals counted once | finance.test.js |
| Exercise weeks and plans; Health agenda; Faith canon (1,189 chapters), portions and progress | wellbeing.test.js |
| CSV (quotes, line breaks, BOM, semicolons); templates import their own examples; duplicates and bad lines; detection by name or columns | importer.test.js |

### Browser checks run (2026-10-25, test folder)

12. Meals: recipe typed as lines → scaled 2 → 4 → planned today → shopping list sums and marks "amount not given". ✔
13. Holidays: trip with dates, plan, starter packing list, cost against budget. ✔
14. Finance: category and spend → planned/spent/left; a debt below its interest says "never" and the payment that would work; recording a payment. ✔
15. Exercise log, Health appointment, Faith plan (read a portion) and journal. ✔
16. Import folder: templates and README written; recipes and chores files brought in and moved to Import/Imported with reports; an unrecognised file moved to Import/Not imported; an existing chore name skipped. ✔

## Sections and the Meals section (v0.3.0)

### Automated
- `tests/sections.test.js`: every starter app sits in a real section; Meals holds Recipe Book,
  Calorie Checker and Meal Assistant; home shows sections in order.
- `tests/miniapps.test.js`: `section` in manifests (unknown → "more"); `people:food` refused to
  third-party apps; a starter no longer shipped (Health) is uninstalled with records kept.
- `tests/food.test.js`: the food database (13.6k foods, nulls kept), search, totals that say
  "at least"; every guide food resolves to a USDA record; reference values; people's food fields
  and age; reading a meal (longest name wins, typed order); safety (allergy, diet, under-5 choking,
  pregnancy); the spec's oats and chicken-and-rice examples; timing only with an iron priority;
  "not today" → try next time; cautions about what is already on the plate; no ideas for babies.

### Browser checks run (2026-10-26, test folder)
- Home shows sections; Health gone; Meals section lists its three mini-apps; crumbs read
  Home › Meals › Meal Assistant.
- Settings › People › Food details: saved, summary on the button, written to the folder.
- Meal Assistant: oats example (fruit, eggs, banana-for-sugar swap); with a 3-year-old allergic
  to peanuts, "toast with peanut butter and grapes" warned about the allergy and quartering grapes,
  suggested no peanut foods, and offered fruit on the side for a selective eater. 375 px: no
  sideways scroll.
- Calorie Checker: banana lookup, portions, nutrients, plate total.
- Mini-apps screen: section shown on each app; Health under "Uninstalled, records kept".
- No console errors.

### People page, heights and weights, recipes in Meal Assistant (2026-10-26)
- Automated: `tests/measurements.test.js` (validation, newest first, latest weight and height,
  kept after removing a person, two laptops merge without a question, folder round trip);
  `tests/food.test.js` (gender and pregnancy rule; a recipe read as a meal).
- Browser: People tile on home, Settings no longer has People; added 64.5 kg / 168 cm "clinic
  visit" - shown at a glance and in the dated table, saved to the folder; typed values survive a
  redraw. Meal Assistant: picked "Tuna pasta" from the recipe list, and "Ideas to improve it" from
  the Vegetable soup recipe - both read the ingredients and gave ideas. No console errors.

### Meals and recipes, portions, goals, Shopping and This Week (2026-10-26)
- Automated: `tests/portions.test.js` (energy estimates, quarter shares, leftovers, energy goals only
  for adults outside pregnancy, meal → recipe, food links kept through edits, calories only from
  linked gram amounts); `tests/meals.test.js` (shopping sends replace not double, bought stays
  bought, typed items untouched, groups, older lists read); `tests/model.test.js` (chore supplies).
- Browser: Calorie Checker family meal (chicken 600 g, rice 700 g = 1,665 kcal) shared Alex 1,
  Sam 1¼, Mia ¾; Save as a meal → Meals & Recipes prefilled → saved as a Meal with per-person kcal;
  leftovers "another family meal" → make 6, ingredients scaled; Plan it → This Week; Send the week
  → Shopping confirm → on the list, with the older list picked up; a chore's supplies sent under
  Cleaning; Alex's −500 kcal goal → ¾ portion; Mia (3) offered no energy goal.
- Found and fixed while checking: read-only access to another app's undeclared collection was
  refused by the hub.

### Planner, feedback, nutrition and guidance (2026-10-26) - the owner's acceptance tests
- Automated: `tests/planner.test.js` covers A (leftovers scale 400 g to 600 g, counted once), B
  (leftovers 2 to 1 to cancelled), G/I (a changed planned meal leaves the recipe and other meals
  alone), ratings states, D (7/10 meal that is one child's favourite), E/K (combined filters,
  reset, no guessed times), F (weekly mix from real ratings, shortfall), N/P/Q/R (one calculation,
  rounded, missing not zero, half portion half calories), L/M (week analysis and proposals);
  `tests/guidance.test.js`; units, guests and pregnancy in `tests/portions.test.js`.
- Browser (localhost, example family): Tuna pasta rated 7/10 with Mia's favourite, spider chart
  (Protein 100%, Phyto 33%), per-person calories; planner filters (Mia's favourites, rated 7+,
  fish + 7+ + untried = none, with the filters named), chose Tuna pasta for Wednesday with 2
  portions set aside for Thursday lunch - week shows "cook 6" and the leftovers as already cooked;
  shopping got 600 g pasta once, 2 tins of tomatoes, sorted by aisle, copy and print; two guests
  raised servings 4 to 6; a one-time change (mushrooms) with the keep / replace / save-as-new
  choice, original recipe unchanged; saved a new version linked to the original; How the week
  looks and Optimise My Week (added spinach to Monday only); Plan my week with an honest
  shortfall; Meal Assistant from the planned meal sent chickpeas back to that meal only; units
  switched to imperial (142 lb, 5 ft 6 in, lb input) and back; guidance on cards and home notices
  for a 6-month-old. 375 px: no sideways scroll. No console errors.
- Not covered: recurring traditions and pantry (not in the app); a real Drive folder and a phone.

### Ingredients, batches and our own items (2026-10-26)
- Automated: batch multiplier (2 eggs: 5 portions of 4 = x1.5; 3 eggs: x2, with the reason;
  untick whole = x1.5), mayo opened into its ingredients (half a batch: 1 egg, 125 ml oil),
  nutrition through our own item, loop guard, egg found before eggplant.
- Browser: made "Home-made mayo" (makes 300 ml, use as an ingredient) by picking eggs, olive oil
  and lemon juice from the list with units; an "Egg salad" with "only our own items" suggesting
  just the mayo; salad nutrition counts half the mayo (about 1,650 kcal a batch); shopping send
  combined to 7 eggs, 125 ml oil, ½ tbsp lemon juice; a planned meal shows "Make the recipe x2".
- Already made (D-038): automated - the salad splits into 6 eggs plus mayo 150 ml (1 egg, 125 ml
  oil); two salads in a week give one mayo group of 300 ml and 12 eggs apart; the send validates.
  Browser - "We already have the Home-made mayo (150 ml needed)" ticked: 6 eggs, no oil; unticked:
  7 eggs and 125 ml olive oil.
- No spelling (D-039): automated - 165 + 60 + 8 + 6 g weigh 239 g; a spoon without the food
  database makes it "at least"; "grams" is kept as g. Browser - a new "Home made salad dressing"
  with four gram rows: the hint says 239 g; saving with "pieces" and no amount warns and keeps the
  name, the ticks and the rows; choosing g saves "Makes 239 g" and the edit screen shows it empty
  again (worked out); Lunch ticked shows as lunch.
- Sizes (D-040): automated - iceberg's "head, medium" is 539 g and half is 269.5 g; our own "ring"
  comes first and a later one corrects an earlier; oz sizes left out; "0.5 cup slices" -> 104 g a
  cup; metric labels (8-1/4" -> 21 cm, 1/2" -> 1.3 cm, 1.33 oz -> 38 g). Browser - iceberg offers
  its sizes in cm, ½ head shows "= 270 g"; 1 red onion "≈ 197 g"; feta "+ Add our own size" ring
  200 g, picked and shown "= 200 g"; a dressing saved without "use as an ingredient" is offered as
  "our own meal", and picking it marks it (makes 150 g) and adds it to the salad.
- Types (D-042): automated - a new entry is a meal; older ones become own (the old tick), recipe
  (a method) or meal; a chosen type stays when a method is added; an old index line still places.
  Browser - list chips All / Meal / Recipe / Own ingredient each show only their type, with
  badges; mayo became Own ingredient; ingredient chips search mayo in All (own + database), Own
  ingredients (mayo only), Recipes (banana bread), Ingredients (database only); "Cucumber 21 cm"
  saved as an own ingredient of 300 g cucumber reads "Makes 300 g".
- Cookbook and items (D-043): automated - a new entry is an item ('' / "Item"); a method alone does
  not change that; old entries are placed (own / recipe / item). Browser - breadcrumb "Home › Meals
  › Cookbook", "Add an item", egg salad and chicken-and-rice show Item; Calorie Checker chips "For
  the family", "For Alex"..., "Add to the item for the family", "An item for the family", "Save to
  the Cookbook" opens "Add an item" with "an item (not decided yet)"; no "plate" on the page.
- Ideas, warnings, csv (D-044): automated - the example csv gives flour 200 g, eggs 2, milk 300 ml;
  any column order and ; work; no header reads like typed lines; adding spinach adds a usual
  amount; swapping half a head of lettuce gives 270 g of the new food; warnings carry who.
  Browser - egg salad: "Apply to the recipe" on spinach and broccoli marks them "✓ Applied";
  Replace opens "Edit Egg salad" with both added and says they came from the Meal Assistant; New
  opens "Egg salad (our version)"; no paste box, a .csv button instead; the 7-layer salad text gives
  one panel for Mia (four tips) and one for Alex.
- 0.7.0 (D-045 - D-049): automated - every starter names valid ways in; a bad mode is refused;
  groups and colours (corn yellow, red peppers red, banana bread none); browsing sorted highest
  first, dried left out, tofu found in a short list; shopping remembers added and bought items,
  finds by kind, ours first, everything for a first purchase; places tags/filters/areas; faith
  entries (questions, passages, topics, terms, old entries), all 66 books in the guide, every
  starting passage a real book. Browser - section pages show Plan / Check and note / Do for Meals,
  Shopping, Faith, Holidays and Chores; Calorie Checker: 80 everyday foods by protein, tofu under
  beans, nuts and seeds; 126 yellow foods in 9 pages; Shopping: hygiene from Everything, add
  toothpaste, it is then ours; a new item offered; At the shop ticks one off; Places: a place with
  two tags, marked been and loved, found by "pet friendly"; Faith: an entry with a question
  (needs more reading), Ephesians 5:25-33 (NIV), two topics and a term; found by topic; listed in
  Questions; Ephesians' five Ws; Cook today shows tonight's batch and ingredients.
