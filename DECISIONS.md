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

**D-026 People is its own page, with dated heights and weights (owner, 2026-10-26).** People
moved out of Settings to a home-screen tile. Each person can have dated height and weight entries
with a note (e.g. "clinic visit"), so the family can say what someone weighed when. Entries are a
household list of their own (`measurements`, `Data/household/measurements.json`), merged by id
like chore history, and kept when a person is removed. The Meals section uses the latest weight.
Visible to everyone in the household, like the rest of People (O-4/O-5).

**D-027 Meal Assistant reads family recipes (owner, 2026-10-26).** It may open a Recipe Book
recipe (`data:meals:read`, read-only) and treat its ingredients as the meal.

**D-028 Meals and recipes are one thing; portions per person (owner, 2026-10-26).** A meal is a
name and its ingredients; adding a method makes it a recipe, at any time. Calorie Checker builds a
family meal or one person's plate and hands it to Meals & Recipes in the link to be saved (only
the owning app writes). Ingredients from Calorie Checker keep a link to the food database, so
calories per serving are worked out for them - and only for them. Each meal shows a portion guide
per person from estimated energy needs (National Academies EER with height and weight, typical
values otherwise), with or without leftovers. An adult may set an energy goal (±250/500 kcal a
day) on the People page that their portion follows; never for children or in pregnancy or
breastfeeding. Free-text personal goals sit beside it.

**D-029 Shopping and This Week are their own mini-apps (owner, 2026-10-26).** Shopping is a
section on the home screen: one family list, grouped Food / Cleaning / Household / Other. Meals &
Recipes, This Week and Chores (each chore's supplies) send items through a link
(`#/shopping/add/<json>`); Shopping shows them and adds only on a yes. Sending from the same place
again replaces its items rather than doubling them. This Week sits in the Meals section beside
Meals & Recipes, Calorie Checker and Meal Assistant. Plans and the list kept by Meals & Recipes
before the split are read in place (read-only) and never moved or deleted; the hub now allows
read-only access to another app's undeclared collections for this.

**D-030 Birthdays decide the stage of life (owner, 2026-10-26).** The birthday sits on each
person's card (not in Food details). From it Family Hub works out baby (under 1), toddler (1-3),
child (4-12), teen (13-17) or adult (18+), and adult-or-child for chores and "Who are you?" -
so a child moves on by themselves as they grow. The adult/child choice is only asked while there
is no birthday. Pregnancy sits on the card too (female, 16 or more), with an optional conception
date: the card then shows clinic weeks and the due date (conception + 38 weeks) beside the age, and
the portion guide adds 0 / 340 / 452 kcal by trimester (340 without a date). Two weeks past the due
date, the card asks to be updated.

**D-031 Age and stage guidance (owner, 2026-10-26).** One list of rules (`js/guidance.js`), each
with an age range or a life stage/diet, a level (warn/info), the foods it is about and a source
(NHS Start for Life, CDC, AAP, DGA 2025-2030, NHS pregnancy). Shown on each person's card, as home
notices for babies and milestones, and as cautions when a meal or plate holds a food it is about
(honey before one, water and juice before six months, cow's milk as a drink, salt, added sugar
under 4, caffeine for children, choking risks under 5, alcohol and food safety in pregnancy).
Further DGA changes that alter how food is weighed are proposed in docs/DGA_SUGGESTIONS.md.

**D-032 Metric or imperial (owner, 2026-10-26).** A device setting. Everything is saved in metric;
weights, heights, food amounts, ingredients and the shopping list are converted for display and
entry (US customary). Nutrients stay in g and mg.

**D-033 Planned meals are occasions, apart from recipes (owner, 2026-10-26).** A plan slot holds
servings, extra portions, leftovers set aside for later meals, its own ingredient changes, a
note, feedback, hand-set portions and guests. Leftovers are stored on the meal that is cooked, so
the food is counted once for preparation and shopping; the later meal is a view of it and adds
only its own additions. Changing a planned meal never changes the recipe: the person chooses to
keep it once, replace the saved recipe, or save a new version (`variantOf`), with its own ratings
and notes. Older plans gain stable slot ids without being rewritten.

**D-034 Feedback on recipes (owner, 2026-10-26).** Tried / not tried, a family rating 1-10 that
only exists once tried, each person's preference (favourite, likes, neutral, dislikes) kept apart
from it, and dated notes (cooking notes from a planned meal are added only when the person says
so). Recipe index version 2 carries facts (protein, carbohydrate, groups, colours, allergens) and
feedback for filtering; an older index is rebuilt once from the meal files, which are not changed.

**D-035 One nutrition calculation (owner, 2026-10-26).** `js/meal-nutrition.js` matches each
ingredient to a food (Calorie Checker link, the food guide, or a short list of exact kitchen
basics - never a loose search), weighs it (grams exactly; volumes and pieces approximately) and
adds up, counting anything unmatched as missing, never zero. Calories round to 10 and say "at
least" when incomplete. The six-type spider chart compares one serving with a reference adult
(National Academies DRIs; EPA+DHA from EFSA): an axis is full at a third of the day's reference;
phytonutrients by plant colour variety. The same numbers feed recipe pages, planned meals,
comparisons, per-person calories and the weekly analysis. Optimise My Week proposes the smallest
change first and applies nothing without a tick.

**D-036 Guests at a meal (owner, 2026-10-26).** Guests are added to a planned meal by kind (adult
man, adult woman, teenager, child, toddler); their typical shares join the portion guide and the
servings follow. No names or details are kept.

**D-037 Ingredients picked, not typed; batches in halves; our own items (owner, 2026-10-26).**
Ingredients are entered row by row: pick a food (our own items, the food guide, or the food
database), the total amount and a unit from a list. A picked food is linked, so it counts towards
calories; typed-only lines are kept and marked as not counted. A recipe can say what one batch
makes (12 pancakes, 300 ml). It is made x1, x1.5, x2... (halves): the smallest batch that is
enough and keeps whole-only ingredients whole (eggs by default; any counted item can be ticked).
A meal can be marked "use as an ingredient" (home-made mayo); other recipes add part of its batch,
and nutrition and shopping open it into its own ingredients (loops and depth are guarded).
Ingredient suggestions can be limited to our own items. Recipe index version 3.

**D-038 "We already have the mayo" (owner, 2026-10-26).** A shopping send from a meal or a week
carries our own items apart from the rest. The Shopping confirmation lists each under "Made at
home" with what it would add; ticking "We already have it" leaves its ingredients off (6 eggs, not
7). The same item from several meals is one line. Only the list changes, never the recipe, the
planned meal or the nutrition.

**D-039 Nothing the app works with depends on spelling (owner, 2026-10-26).** "One batch makes" is
an amount and a unit picked from the same list as ingredients (pieces, g, ml...), with "other..."
for a typed unit. Weighed in g or kg with no amount, an item used as an ingredient takes the
weight of its ingredients (165 + 60 + 8 + 6 g = 239 g), worked out again on every save. A meal's
breakfast / lunch / supper / snack are tick boxes, not typed tags. Every form keeps what was
typed when the page redraws (a list finishing loading, a warning), until you leave the screen.
Names, notes and searches stay free text: nothing is worked out from them.

**D-040 Amounts in what you buy (owner, 2026-10-26).** Once a food is picked, its unit list also
offers the sizes the food database knows for it ("head, medium" 539 g, "cucumber" 301 g, "can,
drained" 298 g), and every line not already in grams shows its weight ("= 270 g", or "≈" where a
cup or a whole one is an estimate). A size the database lacks (a ring of feta) is added once from
the packet as one of the family's own sizes (Meals & Recipes keeps them, collection `sizes`) and is
offered for that food in every recipe; adding the same name again corrects it. A line keeps the
grams in one (`each`), so nutrition and the weight of a batch use it. In metric, the database's
American sizes read in cm and g (8-1/4" -> 21 cm, 1.33 oz -> 38 g). Any of our own meals can be
picked as an ingredient: one not yet set up is marked so, its weight becoming what it makes.

**D-041 A way back at the bottom of every page (owner, 2026-10-26).** Every page but Home ends with
"‹ Back to ...": an inner screen of a mini-app (a recipe, a planned meal) goes to that mini-app's
first screen, a mini-app to its section, and a section or core page to Home. The breadcrumb's
mini-app name is a link on inner screens too. It is drawn by the frame, so every mini-app has it.

**D-042 Every entry is a Meal, a Recipe or an Own ingredient (owner, 2026-10-26).** Replaces "a
method makes it a recipe" and the "use as an ingredient" tick. The type is chosen on the form and
is only for finding things - anything can go into anything. Meals & Recipes filters by All, Meal,
Recipe, Own ingredient; adding an ingredient searches All, Meals, Recipes, Own ingredients or
Ingredients (the food database, which has no type). An own ingredient must say what one batch
makes (weighed from its ingredients when left empty in g); any other entry picked into another is
weighed the same way. Entries saved before were placed once: "use as an ingredient" -> Own
ingredient, a method -> Recipe, else Meal (recipe index version 4).

**D-043 Cookbook, items, and no plates (owner, 2026-10-26).** "Meals & Recipes" is now the
**Cookbook**. An entry is an **item** until it is called a meal, a recipe or an own ingredient; a
new one starts as an item, and older entries without a method or the old tick are items too (not
meals, as D-042 first had it). Calorie Checker builds an item, "for the family" or "for" one
person, and saves it to the Cookbook - the word "plate" is gone from the app. Recipe index
version 5.

**D-044 Ideas applied to a recipe; warnings per person; ingredients from a file (owner,
2026-10-26).** On a recipe opened in the Meal Assistant, each Add, Swap or Try-next-time idea has
"Apply to the recipe"; the applied ones are listed at the bottom with **Replace** (into the recipe)
and **New** ("(our version)", linked to the original), both opening the Cookbook to check before
saving - the Assistant itself writes nothing. Time ideas change no ingredients, so have no button;
there are no Remove ideas. "Worth knowing" is one panel per person. "Paste several lines" is
replaced by "Add from a .csv file" (ingredient, amount, unit, note; any order; a file without a
header is read like typed lines) with an example file to download.

**D-045 Plan, check and note, do (owner, 2026-10-26).** A rule for the whole app: each section
offers its ways in by the time you have - **Plan** (relaxed, time to think), **Check and note** (a
quick look, or capturing something before it is forgotten) and **Do** (20 minutes to an hour,
getting things done). Mini-app manifests name their ways in (`modes`: mode, screen, label, hint),
validated like screens, and each section page groups them. New "Do" screens: Cook today (This
Week) and At the shop (Shopping); Faith's study session is the reading plan. On the section page
the mini-apps come first; the three groups are folded under "Extra help" below them (owner).

**D-046 Explore foods, not only find them (owner, 2026-10-26).** People cannot search for a food
they have never heard of. Calorie Checker browses by type of food (13 plain groups over the
database's ~200 categories), by colour (fruit and vegetables only: a colour in the name, else what
the food usually is) and sorts by fibre, protein, fat or carbs per 100 g, 15 to a page. Browsing
starts in the ~80 everyday foods the Meal Assistant knows (tofu, lentils...); "the whole database"
browses all, with dried and powdered foods left out unless asked for. Words still search everything.

**D-047 Shopping knows what we buy (owner, 2026-10-26).** Kinds: Food (in aisles), Cleaning,
Hygiene, Medical, Stationery, Household, Pets, Other. Everything added or bought is remembered with
the list (how often, when last), so "Ours" can show, say, every hygiene thing the family buys to
see what needs replacing. "Everything" adds common things of each kind and the everyday foods, for
a first purchase. Anything else is added as a new item, in a kind. "At the shop" is the list
alone, big, by aisle.

**D-048 Places to go, apart from trips (owner, 2026-10-26).** Holidays keeps big trips (travel,
itinerary, packing, budget). A new mini-app, Places to go, keeps local outings: area (offered from
earlier ones, one spelling per town), kind of place, tags from a list (great for kids, play area,
pet friendly, free, rainy day...), want to go / been, and how it was.

**D-049 The faith journal and Bible guide (owner, 2026-10-26).** Writing an entry and looking back
are separate screens. An entry has a kind (adds "Message heard"), a heading, questions with
their status (only the question / needs more reading / found a reasonable answer) and answer,
passages picked from lists (version incl. Afrikaans ones, book, chapter, verses - several per
entry), notes, topics from a list and finer terms of your own (offered from earlier ones).
Questions has its own tab to come back to. The Bible guide gives each of the 66 books' who, when,
to whom, why and about (traditional view, with "traditionally" and "c." where it is debated), and
where to start reading on 25 topics. Older entries keep their text as notes and their first line
as the heading.

**D-050 A button is a name, never an explanation (owner, 2026-10-27).** Every button, button-styled
link, chip and confirm button is one word, two at most ("Start shopping", "Save & send", "Restore",
"Ours"). The detail people need once or twice goes in a hover title, an info icon, a hint line
beside it or the page's own text - never in the button. `tests/buttons.test.js` reads every label
in the source, both sides of a ternary, and fails on more than two words. Inline text links in a
sentence are prose and exempt. Page headings keep their full wording.

**D-051 Plan, Check, Do - and no "jotting" (owner, 2026-10-27).** The three ways in (D-045) are
named Plan, Check and Do. "Jot", "jot down" and "jotting" are never used - the word is "write".

**D-052 Phones swap one file, and laptops do the rest (owner, 2026-10-27).** Replaces the by-hand
family-file steps of D-014 for phones. A laptop connected to the Drive folder keeps
`FamilyHub/Phone/Family Hub.json` up to date (rebuilt at most every two minutes, written only when
what it holds changed). A phone has two buttons: "Get latest" (open that file - combined without a
question when it is the same family, or used as-is when the phone has nothing yet) and "Send back"
(share to Drive, into the Phone folder). Any other family file in `Phone/` is combined in by the
next laptop that has Family Hub open, then moved to `Phone/Brought in` (another family's file goes
to `Phone/Not brought in`). A phone's file carries the copy it started from (`base`), so a chore
deleted on the phone stays deleted instead of coming back. First run on a phone offers "Get family".

**D-053 Plan the meals, then put them on days (owner, 2026-10-27).** This Week becomes Meal
Planner, with three views. **Plan**: the planned meals only, by Breakfasts, Lunches, Dinners and
Snacks, not yet on days (one record, `pool`, shaped like a week without days); "Suggest meals" fills
it. **Assign**: those beside a calendar, to drag onto days. **Calendar**: the calendar alone, a week
(a row per meal) or a month (a box per day; a dropped meal keeps its own meal). Dragging onto a day
moves a meal out of the list; dropped on a planned meal, the two swap (from the list, the other goes
back to it). Snacks can be plain items ("Carrots") and a day can have several. Leftovers set aside
move with their meal by the same number of days; a meal in the list has none (they need a day).
Tapping a meal opens it - to change it, remove it, or say how it went and rate it. "To Shopping"
sends what the week or month on screen needs. Drag works by mouse and, after a press and hold, by
finger (`js/ui/drag.js` - native drag and drop does nothing on phones).

**D-054 Drag to reorder the dashboard (owner, 2026-10-27).** Settings > Your dashboard: drag a row
onto another and it takes that place (after it when moving down, before it when moving up), so two
apps go to the top in two drags. The arrows stay for keyboards.

**D-055 Plan in three steps: gather, sort, assign (owner, 2026-10-27).** Refines D-053. Plan
starts with gathering meals with no meal and no day ("what are we in the mood for?" - added, or
suggested); a gathered meal is stored with meal ''. Step two drags each into Breakfasts, Lunches,
Dinners or Snacks (or a planned meal's page has a Meal choice, for anyone who cannot drag). Step
three is Assign. Dropped on a month day without a meal, a meal becomes dinner. Drag fix: meal chips
are links, and a link has the browser's own drag, which cancelled ours on a real mouse - draggable
items now switch it off.

**D-056 A shop is any run of days; Cook today shows it (owner, 2026-10-27).** Shopping does not
start on a Monday, and not on the same day every week. "To Shopping" asks which days: from a day
(three days back to three weeks ahead) for 2 to 14 days, across week boundaries, and remembers
them (`shop-trip`). Cook today shows today's meals and, in a bar at the bottom, every meal of that
shop (or the next 7 days when today is not in one). Dragging a meal onto today's swaps the two;
dragging today's onto another day does the same. While dragging, every place a thing can be dropped
is outlined and the one under the pointer lights up.

**Not built (recorded so nobody looks for it):** recurring meal traditions (none existed before),
a pantry (so no "use before it expires" or "what we have in stock" beyond a typed list), cost,
equipment and difficulty filters (no data), and individual 1-10 ratings (preferences cover it).

**O-7 (W2) Phone live sync.** Only possible through a registered Google app (rejected, D-013).
Revisit only if browsers gain folder access on phones.
