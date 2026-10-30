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
three is Assign. A meal dropped on a day keeps the meal it was sorted into (a lunch stays lunch)
when that meal's row is not showing - with only dinners showing, the day is the target; when its
row is showing, the row it is dropped on decides. Dropped on a month day without a meal, it becomes
dinner. Drag fix: meal chips
are links, and a link has the browser's own drag, which cancelled ours on a real mouse - draggable
items now switch it off.

**D-056 A shop is any run of days; Cook today shows it (owner, 2026-10-27).** Shopping does not
start on a Monday, and not on the same day every week. "To Shopping" asks which days: from a day
(three days back to three weeks ahead) for 2 to 14 days, across week boundaries, and remembers
them (`shop-trip`). Cook today shows today's meals and, in a bar at the bottom, every meal of that
shop (or the next 7 days when today is not in one). Dragging a meal onto today's swaps the two;
dragging today's onto another day does the same. While dragging, every place a thing can be dropped
is outlined and the one under the pointer lights up.

**D-057 Good-for flags travel with a meal (owner, 2026-10-27).** Every meal chip in Meal Planner
carries small B, L, D, S circles for what the Cookbook says it is good for (its "Good for" tags; an
older "supper" counts as dinner), so sorting and assigning is easier and the flags stay on as it is
moved. A planned meal's page shows them with "Change", which opens a Cookbook screen to set them -
often after cooking it ("this was a nice dinner"). The Cookbook writes it; the planner only links.
Alongside: a save in one mini-app now also forgets what other mini-apps had loaded, so a change made
in the Cookbook shows in Meal Planner straight away instead of after a reload.

**D-058 The family's own Faith topics (owner, 2026-10-27).** The 25 guide topics were fixed in
code. Now the family's list is the guide's, plus their own, minus any they hid (one record,
`topics/family`). A new topic is typed right on a journal entry ("+ Topic") and ticked at once; the
same name in any capitals is the same topic (a hidden one is shown again rather than doubled).
Topics (from "Edit topics" on an entry or in the Bible guide) hides and shows any topic and removes
the family's own when no entry uses it. An entry keeps its topics whatever the list does; the
guide's starting passages come only with its own topics, and the family's logged passages and
questions show under every topic.

**D-059 Sending meals to Shopping again adds only what is new (owner, 2026-10-27).** A trip was
replaced by its start day, so overlapping trips counted shared meals twice, a resend after "Done"
asked for everything already bought, and a ticked line whose amount grew looked bought. Now each
planned meal remembers what it went to Shopping as (`sent`: recipe, servings, extra, leftovers,
its own ingredients). A send works out the meals' needs less what each sent before
(`stillToBuy`), so an unchanged meal adds nothing however many trips it falls in, and more people
adds just the difference. Shopping adds that on (`addMore`): onto a line of the same thing not yet
bought, else a line of its own. A meal is marked sent only after Add (Shopping returns through
`#/mealplan/sent/...`), so Cancel leaves it unsent; what was unticked as "already have" counts as
sent. Days of the last trip sent before this change count as sent once. Not covered: a meal sent
alone from the Cookbook ("To Shopping" there) is still its own send.

**D-060 Shop for the planned meals before they are on days (owner, 2026-10-27).** Sorting and
assigning are optional: "To Shopping" in step 1 (Gather) sends what every planned meal needs,
sorted or not, on a day or not, through the same send as a trip (D-059), so a meal later put on a
day is not bought twice. A sent meal shows a ✓ on its chip. Cook today lists sent meals that are
on no day under "Any day", first in the strip, to drag onto today (a meal already there swaps back
into the list); dragging one back to "Any day" takes it off its day.

**D-061 Removing planned meals: a bin while dragging, and Clear (owner, 2026-10-27).** Removing a
meal meant opening it and pressing Remove. Now, while a meal is dragged in Plan, Assign or
Calendar, a bin shows at the right-hand edge; dropping it there takes it off the list or its day.
"Clear" in step 1 empties the planned-meals list after a confirm (meals on days stay, the shopping
list is not touched). Both offer Undo in the notice.

**D-062 Filters and long forms fold away (owner, 2026-10-27).** On a phone, filters and the
Cookbook's item form filled the screen. One helper (`fold` in js/ui/common.js) makes a section
that folds into a single line; folded, its line still says what is on ("Recipe", "2 on",
"Everything"). Filters start folded on a narrow screen and open on a wide one; after that, open or
closed is remembered per section on this device (`familyhub.folds`, cleared with everything
else). Folded now: the filters in Cookbook, Meal Planner (choosing a meal), Faith journal, Places,
Shopping's kinds and Calorie Checker's browsing; the ingredient picker's "Search in"; and the
item form's "About it" and "Ingredients and method". Any record form can group fields the same way
(`group`). Record forms no longer use the browser's own check for required boxes (it cannot show
one inside a folded part and would refuse to save without a word) - they say what is missing. The
Save row stays at the bottom of the screen on a long form.

**D-063 One page with every step for laptops and phones (owner, 2026-10-27).** The setup was
spread over two how-tos and Settings. "Phone and laptop" (#/connect, linked at the bottom of every
page, from Settings › Google Drive, from How to use and from the phone's welcome) has it all in
order: set up a laptop, get Google Drive into the phone's file window (iPhone: the Google Drive app,
then Files › Browse › ⋯ › Edit), put Family Hub on the home screen, get the family onto the phone,
use it day to day - and fourteen things that can go wrong. It opens before a family exists, so a
new phone can read it. The words live in guide.js (CONNECT) and are tested for every part.

**D-064 A phone's Get and Send, one tap each from any page (owner, 2026-10-27).** The owner asked
why a phone cannot swap the file by itself - on opening, or every few minutes. A phone's browser
may read a Drive file only when the person picks it, and save one only through the share or save
window; doing it unattended needs a sign-in to a registered Google app, which D-013 rules out. So
the two taps are made as short as they can be: on a phone that has swapped the file once, the
header has "↓ Get" and "Send" in place of the status. Send lights up (●) while the phone has
something Drive does not - the household, or any mini-app record (each phone write is noted in
`familyhub.phone.changed`, compared with the last Get or Send). Opening the app an hour or more
after the last Get offers "Get latest". Found on the way: the time of the last Get was dropped on
every restart (normaliseDevice did not keep `fileOpenedAt`), so its reminder never worked - fixed
and tested.

**D-065 Sample chores per room (owner, 2026-10-27).** The owner asked for sample chores per room,
to show a new family how the app is meant to be used. Chores › Plan › Samples (also on the empty
Chores screens) offers eight groups - Kitchen, Living room, Bathroom (with a bath), Shower room,
Main bedroom, Baby room, Laundry, Whole house - each with daily, weekly, monthly and longer jobs.
Tick what fits, choose the room under "Into" (a new room, one the family has, or none - so the
laundry can go in the bathroom with the washing machine) and Add. They are the family's own chores,
not examples: nothing marks them, and removing the example family leaves them. A chore already in
that room is not added twice; the same chore may live in two rooms (two toilets). Daily chores
start today; the rest are spread over the coming days so a fresh list does not all come up at once.
How often follows common advice (bedding every two weeks, towels weekly); the family changes it.

**D-066 Finance becomes a set of decision tools (owner, 2026-10-27).** The owner set out a
long-term planning system - not a spending tracker - built from focused tools, each its own
mini-app under Finance, with things saved by name (this car, that house, this job) to compare and
come back to. First release, as the brief asks: the shared parts and two representative tools.
- **Simple / Advanced / Learn** bar on every calculator (Family Hub had no levels before; the
  choice is kept on this device). Inputs are kept while switching, so nothing resets.
- **Every default says where it came from**: Yours, a reference figure with source and date (prime
  10.75%, SARB 23 Sep 2026; CPI 4.5%, Stats SA September 2026), Illustrative, or Assumption.
  Defaults hidden in Simple are listed under the answer ("Also counted"), so no cost is hidden.
- **Saved by name**, with every input (so it can be rebuilt exactly) and the answer as it was.
  Saving under a new name keeps a new one. Tick two or more to compare side by side, with the
  biggest differences said in words.
- **Money calculators › Compound interest**, and **Cars › True cost**: instalment, interest, fees,
  running costs, sale price, what is still owed at an early sale, and the total cost of owning it -
  shown both as cash in and out and as drop in value + interest + fees + running costs, which are
  tested to agree (the loan's capital is not a cost on top of the price). What moves the answer
  most, better and worse resale, and each sum worked out in Learn.
- Maths in finance/maths.js, tested against textbook results. No discounting yet (said in Learn).
- Next, in order: more calculators (loan, savings target, inflation); Homes (bond, rent against buy,
  one house against another with travel to work); Children's future (from the ages already known);
  goals with Holidays' budgets; Job offers (take-home, increases, moving cost and payback); and a
  Money plan that puts every goal on one timeline. They are listed in the Library as coming later.
  (Homes was built next - D-067.)

**D-067 Homes (owner, 2026-10-27).** The second Finance mini-app, in the D-066 shape: three tools
sharing one set of inputs, so a price typed in one is there in the others.
- **A home**: the true cost of living in one home for a chosen time, bought or rented, with the
  trip to work counted (distance × 2 × days × cost per km, plus tolls; hours on the road shown, and
  an hour's worth shown beside it but never added). Total = cash out − what comes back (sale after
  selling costs and the bond, or the rental deposit) + what the money paid up front could have
  earned. Tested to equal value change + duty + fees + moving + selling costs + interest + running
  costs + travel + earnings given up. This is the owner's "closer to work but dearer" and "only
  staying a year" question: save each home by name and compare.
- **Bond**: instalment, interest, cash needed first (deposit, transfer duty, fees), the instalment
  at rates ±1 and +2 points, paying extra, and the 30%-of-income bank guide (labelled as a guide).
- **Rent or buy**: the same home both ways with the same money each month; whoever pays less saves
  the difference; who is ahead after N years, and the year buying gets ahead (if within 30).
- **Reference figures**: transfer duty from the SARS table (from 1 April 2025, confirmed unchanged
  from 1 April 2026 on sars.gov.za); SARS rate per km R4.95 (2026/27). Attorney and bond fees, when
  not entered, are a rough illustrative formula (R10 000 + 1.2% of the price, plus R10 000 + 1% of
  the bond), not the legal tariff - labelled so, with "ask a conveyancer".
- Amounts under R100 keep their cents (R4.95 a km), everything else is shown to the rand.

**D-068 Job offers (owner, 2026-10-27).** The third Finance mini-app. Each job - the one you have
and each offer - is saved by name, then compared.
- **Take-home from a payslip first** (the owner's choice); left empty, it is a SARS estimate,
  labelled as one: 2027 tax year bands, rebates and thresholds, medical credits (R376 / R376 /
  R254 a month), UIF 1% to R177.12, retirement deduction 27.5% up to R350 000; the employer's
  medical and retirement contributions as taxable benefits. Checked against sars.gov.za.
  Allowances are taxed like salary (a car allowance may be taxed less - said so).
- **Four views**: take-home, total package, what is left for the household after the job's own
  costs (travel, living costs that change, costs a benefit saves), and the long term.
- **Increases** are assumptions with a first-review delay; a performance bonus is never counted as
  certain, only shown beside. Today's money, retirement saved, milestones at 1/3/5/10 years.
- **Moving**: cash needed before the move (a refundable deposit counts as cash, not cost; the
  employer's allowance only if paid before), what is missing, months to save it from what can be
  put aside now, and whether that fits before the move. **Payback** from the projected extra each
  month, not one division; moving costs count on whichever side has them; months without pay
  count too. The salary overtaking and the running total overtaking are told apart.
- Compare chooses what to compare with (at first the job saved earliest) and over how many years,
  answers the three questions in words, tests smaller and bigger increases, and lists what is not
  money ("Worth weighing") without pricing it.

**D-069 Children's future (owner, 2026-10-27).** The fourth Finance mini-app. Ages come from the
birthdays in People through a new permission, **people:ages** ("See people's birthdays, to work out
their ages") - names alone (people:read) never carry a birthday. Children are those marked as a
child or under 25 with a birthday; one without a birthday is named, with a link to People.
- Each child's list starts from twelve milestones (day care, primary and high school fees, uniforms
  and devices, activities, tours, university fees, living away, licence, a first car, a deposit, a
  wedding) with illustrative SA costs in today's money. The family ticks, changes, removes (kept,
  marked, so it does not come back) or adds its own.
- **From budget or Save ahead.** Found while testing: saving now for every future year of school
  fees asked a family of two small children for R43 574 a month. School-type costs default to
  "From budget" (paid as they come; shown as the monthly amount they add, year by year); studies
  and starting out default to "Save ahead" (each payment its own savings goal, the saved-already
  and help-expected amounts used for the earliest first). Either can be switched per item.
- A yearly cost falls on the birthday the child turns that age; the year under way is in the budget
  now, not in savings. School fees grow at 8% a year (illustrative), the rest at CPI.
- The family view adds every child: what to put aside now, the budget now and at its highest, the
  biggest year, the years with more than one child's costs (shaded), and starting a year later.

**D-070 The money plan (owner, 2026-10-27).** The fifth Finance mini-app, and the one that joins
them: "if we want all of this, can we afford it, and what do we do now?"
- **Each month**: money coming in after tax, commitments, and a buffer kept back - or taken from
  this month's budget in one tap. Income and commitments rise once a year by their own rate
  (inflation, as an assumption): found while testing, a frozen income against twenty years of
  rising school fees reported a family over a million rand short.
- **Goals** are allocations, never costs counted twice: one or more payments by a month, and
  optionally a change to the monthly commitments from a month (a bond, school fees starting or
  ending). Must or want to. An emergency fund (months of commitments) is a must-have goal.
- **Brought in** (read-only permissions, shown by name): trips with a budget (left to pay + 10%),
  saving goals, saved cars (cash up front, then instalment and running costs), saved homes and
  bonds (cash to move in, then the monthly cost), and each child's save-ahead costs as payments
  with school-type costs as year-by-year changes to the commitments. Copies, with Update.
- **The engine**: each month the free money goes to the goal due soonest; a goal not funded by
  its month is short. Then: the least extra a month that makes everything fit, how many months
  later each short goal would fit, the amount that would fit, whether the must-haves alone fit,
  and when commitments outgrow income.
- **Job what-if**: a saved offer against the job saved first - the change each month (from Job
  offers' projection) and the cash to move go into the plan, and the difference is said in words.

**D-071 Variations of one meal (owner, 2026-10-27).** The owner wanted different versions of the
same meal - a cheese sauce, a pepper sauce, a mushroom sauce from one home-made sauce - "instead
of each one being different". Named **Variations**. A recipe keeps a list: each has a name, the
ingredients it leaves out (tapped from the recipe's own, never typed), the ones it adds (the usual
ingredient search), and steps added after the method; a swap is leave out + add. Ratings, notes and
preferences stay with the one recipe (the older "(our version)" copy, variantOf, remains for a
truly separate recipe). The recipe page shows "As is" and each variation as chips; ingredients,
method, nutrition, "Plan it" and "To Shopping" follow the one shown. A planned meal keeps the
variation's id and its ingredients (the existing per-meal ingredients path, so shopping, leftovers,
cooking and nutrition need no change) and can be switched under "Which way"; it is not shown as a
hand-changed meal. Allergens stay the recipe's, and say so when a variation is shown.

**D-065, more sample rooms (owner, 2026-10-27).** Kids' room (no beds: toys and floors), Steps,
and Workshop (a work or company room: tools, parts, the floor and the bench).

**D-072 Own or rent, as like for like as it gets (owner, 2026-10-27).** Replaces D-067's Rent or
buy. The owner: it is situational; colleagues swear by renting while rents climb; calculators assume
2 to 5% of the value on maintenance a year when the real figure has been small; upgrades (a R30 000
bathroom) add more to the price (R50-60 000) than they cost, and only an owner can do them. The app's
purpose (saved): show people what they have not thought of, and let them put their own values in.
- **Two starting points**: buying against renting (different places, each its own rent or price
  and travel), and keeping the home we own against selling it and renting (value now, bond owed,
  years left; the sale now after costs, bond and tax is what the renter invests).
- **Their own figures first**: maintenance as a rand amount (a % only if chosen), upgrades with
  cost, year and value added, house growth from their own home's history (bought for, when, worth
  now - "Use it"), the renter's investments before tax with the share lost to tax, and how much of
  the monthly difference really gets invested.
- **SARS**: the primary residence exclusion is **R3 million** of gain (not R2 million, as first said
  in conversation - corrected from sars.gov.za), plus the R50 000 annual exclusion, 40% included,
  at the person's rate. Transfer duty as D-067.
- **Shown**: who is ahead after the chosen years, when owning gets ahead, where it changes sides,
  "What it hangs on" (the house growth and investment growth at which they come out level - what
  each side is assuming), "Did you think of…" (each forgotten factor ticked with its value or
  marked not counted), what moves the answer most, and year by year.
- Tested: a home growing exactly as fast as after-tax investments, with no costs, comes out level.

**D-086 Every home compared with something real; four graphs, one question each (owner, 2026-10-30).**
The owner: "everywhere you say 'ahead' I need to know ahead of what?" A home's page measured it
against keeping your money and living somewhere for free - every rand of rates or travel counted
against the home, and nothing set against rent. Then: the graphs did not clearly answer the
questions people come with.
- **What it is compared with** (homes/alternative.js), built from the page's own figures:
  - Buying: renting a similar home - "Rent for a similar home" (and rent rises).
  - Ours already, from when we bought it: renting a similar home since then - its rent today
    typed, earlier rents worked back at the rent rise (`rentToday`) - with the deposit and buying
    costs invested instead.
  - Ours already, from today: selling today and renting, the sale invested.
  - Renting: buying a similar home (its price, deposit, rate, costs, growth).
  - Both on the same money (sameMoney): the same savings on day one, the same money each month,
    whoever spends less invests the difference - or keeps it as cash (a new switch, `diffCash`).
  - Until the figure is given, the page asks for it ("Add it") and compares nothing - never
    against nothing. Travel is the same for the similar home, so it does not move the answer.
- **One investment return**: "What the money up front could have earned" (its own 10%) is gone;
  the one "Investments grow by" is used everywhere. The range's "investments" now really moves
  a single home's answer.
- **The four graphs**, each titled by its question and answering it on the graph:
  1. "Buying or renting a similar home: which leaves you more?" (by kind) - one line, what this
     home leaves minus the other, above zero and below zero named, the tested range shaded, where
     one pulls ahead marked, and the value at your stay written on it. Replaces "If you left
     after…" and "How much could the answer move?".
  2. "What could change the answer?" - one bar per assumption, longest first, towards each side.
  3. "Can you afford it each month?" - the parts stacked, the other option as a dashed line, 30%
     of income dotted when given, and the table with the other option's row.
  4. "How much of the home is yours?" - the value split into owed and yours (replaces "Money in
     and out", which mixed value, debt and money spent).
- **Explore how the result could change** sits under graph 1: lower · your estimate · upper as
  numbers, a slider each side (lower can never pass your estimate), Narrow / Wider / Custom
  (2 points, or half as much again - testing choices, said so), each assumption's what and how
  to choose. Simple shows the three that move the answer most; Adjust on any bar opens its own.
- **Repairs are tested only with a figure** - 50% more than nothing is nothing, and it says so.
- **Every graph in Finance** (shared drawing): axis steps that read easily, calendar years,
  each line's name and last value at its end, tapping a point reads every value, and drawn
  narrower on a phone so the writing stays readable.
- **Words**: no bare "ahead" or "behind" anywhere in Homes. "Estimated proceeds if sold";
  "would leave you"; Compare says "would leave you R… less than"; the saved list says which
  leaves more by when; "Leaving sooner" in Can you carry it? is against the comparison.
- **Your figures** fold into one line once there is an answer; the answer comes first.
- The ten reasons for buying and "was it the right call" (docs/homes-reasons-plan.md) stay
  parked until the owner has seen this.

**D-085 The rest of the property report: cost by part, the order, your figure in the range (owner, 2026-10-30).**
- **What it costs a month, by part** (a home's page): the bond, rates/levies/insurance, upkeep and
  repairs, rent, getting to work - now, in 5 years, when you leave, and after the bond - with "All
  of it", a graph of each part over time, and up front against every month over the stay. A
  paid-off bond is not free: what stays is said; when running costs are empty or left out it says
  so instead of showing R0. The month record carries `upkeep` (part of `running`); tested that the
  parts add up to what goes out. It replaces the single "paid out that month" graph.
- **The order** follows the brief: summary and what it means; ahead or behind; the range and what it
  says; what moves the answer most; cost by part; money in and out; can you carry it; did you think
  of; then the range's controls and the year-by-year table. The range panel comes in parts
  (`rangeParts`) so a page can place them apart; Compare keeps it in one piece.
- **Your figure** beside each range slider on a home's page: the central value is the home's own
  figure (each assumption names it - `field(v)`), so changing it there changes the home, and the
  range is then tested around it. Not in Compare, which works on saved homes.

**D-084 The scenario range, a plain answer, and "Can you carry it?" (owner, 2026-10-29).**
From the owner's property report brief (docs/property-report-brief.md), built on the existing Homes
report rather than rebuilt:
- **Scenario range** (homes/scenarios.js): favourable, central and unfavourable, each worked out
  again through homePlan and sameMoney with its own assumptions - never a band drawn around the
  line (tested: the gap to the central line grows over time). Variables: house prices, investments,
  the bond rate, rent rises, running costs, repairs - only those that apply. Each is tried low and
  high on its own at the chosen year; the favourable scenario takes each one's better side, the
  unfavourable its worse, and the page lists which way each went (all at once is unlikely - said
  so). Called a range of tested scenarios, not a probability. Read in words from the results: all
  on one side, crosses zero, wide or narrow, and which single assumption can change the answer.
  Sliders set how far below and above your own figure each is tested (three in Simple, all in
  Advanced); your own figure stays the central line.
- **Compare** opens with "Which would leave you better off?": what each of two homes would leave
  you after the years chosen, the difference, the main assumptions, and that it can change; close
  results (within 2% or R20 000) are called about the same, not forced into a winner. With more
  than two, "This … against …" picks the pair. The range follows for that pair.
- **A home's page**: the range on "how far ahead or behind", read as the cost of living there
  against keeping your money (pointing to Compare for the real choice); the old "What moves the
  answer most" list is replaced by the range's; the year-by-year table folds away in every mode.
- **Your situation** (all optional): income, everything else spent, cash and savings, one or two
  incomes, dependants, years until the money is needed, comfort with uncertainty. **Can you carry
  it?** (homes/risk.js) lists factors, each saying what it is based on: the month against income
  (banks' ~30% as context), a 2-point rate rise, cash left after moving in in months of spending, a
  big repair (2% of the value), leaving sooner than costs are earned back, how sure the answer is,
  and the personal ones given. No score; anything without its figures is "not assessed". Room to
  absorb (capacity) and comfort (tolerance) are explained as different things. Options to consider,
  never instructions.
- **Estimated, not "Not counted"** (pod.js): an empty field that is worked out until you type your
  own (the attorneys' quotes - the fee guideline; a car's fuel use and price) now says "Estimated -
  type yours to replace it"; "Not counted" stays for what really counts as nothing. "Did you think
  of…" marks ✓ counted, ≈ estimated, ○ not counted or left out, and asks about the cash buffer and
  whether a rent is what comparable homes rent for.
- **Buying in / Renting from** show this month when empty ("This month"), still changeable.
- **The chore timer**: Pause/Resume also on the chore's own card while it runs, and the clock says
  "Paused".
The three parts left then were built in D-085.

**D-083 Homes from any month; Remove everywhere; Print and CSV (owner, 2026-10-29).**
The owner: start from today, but changeable - "I bought my house in 2019 and still want the full
calculation, compared with a new house or a rental now; or I might buy in a year". And: delete saved
items anywhere in Finance; export as PDF or CSV, with the graphs.
- **Buying in / Renting from** (a month; empty is this month): the plan starts then. Costs are typed
  in today's money and rise from today, so a later start meets them further on; the price and rent
  are as typed (what it would be then).
- **Ours already, "Work it out from"**: Today (as before: what selling today would leave) or When we
  bought it - the whole story from what we paid: the deposit and buying costs from savings (at
  today's duty and fees, so roughly), the bond from its real start with its history, the value
  growing from what we paid to what it is worth now (the rate that implies) and as assumed after,
  and "what the money up front could have earned" available. It runs 30 years on from today; the
  graphs show calendar years with Today marked; "how long you live there" counts from today.
  Tested: from today on it lands exactly where the Today version is.
- **Compare** puts them on one calendar from the month the last one starts - until then nothing
  differs; a home started earlier joins with what it has then (its earlier costs are the same
  whichever is chosen). Day-one savings count only for homes starting then.
- **Cars and Job offers** keep counting from their own start in years: their answers do not depend
  on the calendar month (no bond history or price growth to line up), so no From was added.
- **Remove** (with a confirm step) is now on the Homes list too; the other saved lists had it.
- **Print** opens every folded section and prints the page without buttons or menus (choose
  "Save as PDF" to keep it); **CSV** writes your figures (each label's own words), the results,
  every table and every graph's numbers (each graph keeps its series for this). On every tool's
  "Save and compare" panel and under every comparison.

**D-082 Two phones sending back: both kept, in every mini-app (owner, 2026-10-29).**
The owner asked: I send from my phone, my wife gets latest (without a laptop opening in between)
and sends from hers - are my changes lost? Chores were safe (three-way merge with the phone's base,
D-052), but mini-app records (the shopping list, a week's meals, a meal) were copied newer-wins by
rev: tested, two phones adding "milk" and "bread" to the same list left only "milk".
- A phone now remembers the mini-app records it last agreed on (IndexedDB, `fileBaseFiles`, set on
  every Get latest and Send back) and its file carries them as `baseFiles` beside `base`.
- Bringing a phone's file in, a record changed on both sides is merged against that copy
  (`mergeDeep3`): items with ids (shopping items, planned meals) one by one - both sides' additions
  kept, a removal on one side kept, an item edited on both merged field by field; plain lists
  (tags) keep both sides' additions; the same value changed differently on both keeps this laptop's
  and says so in the notice, with both values, to change by hand. The merged record's rev is above
  both, and its index entry follows.
- The same applies when a phone gets latest: its own unsent changes are merged in, not replaced.
- Files from phones on an older version (no `baseFiles`) are brought in as before, newer wins.

**D-081 Suggest the real time (owner, 2026-10-28).**
When a chore's last three timed Dones all took longer than its expected time (or it has no time
yet), the Chores tabs offer the average of its last five timed runs, rounded to a minute - "took 7,
10, 7 minutes... you planned 5. Make it 8 minutes?" with "Use 8 min". Only upward, as asked; the
notice closes, and comes back only when new runs change the suggestion. Untimed Dones do not count.

**D-080 Nothing is put off; the timer ring (owner, 2026-10-28).**
The owner: "Not now" should not exist. A chore that is not done today is simply still there
tomorrow; a weekly one carries over day by day until it is done. Putting it off to a date hid it
on days when there was time for it.
- **No putting off.** Tomorrow, Next week, Move date and Skip are gone; a card has Start and Done.
  A chore shows when it is due (one cycle after it was last done) and stays until it is done -
  still only one of it, so nothing piles up. Put-offs recorded before this are ignored. A one-off
  that is no longer needed is deleted under Plan › Edit. Waiting two whole cycles still asks for a
  review of the plan (being put off no longer can).
- **The ring** around the clock fills to the expected time; past it, it turns honey and fills a
  second lap as long as the first, and the clock counts up ("+4:10 over"). Taking longer is
  allowed - it may just be more work than expected.
- **Cancel** (was "Stop timer") ends it with nothing recorded.
- **Done** records the minutes it really took (paused time left out) on the chore's history.
- **Not running for hours.** At three times the expected time (at least half an hour; an hour
  with no expected time) it asks "Still on it?". "Still going" asks again as far on, so a really
  long job is still timed. Unanswered for half an hour, it stops and records nothing; Done on the
  chore still works, without a time.

**D-079 Time to set aside: chores and meals (owner, 2026-10-28).**
The owner wanted to know how much time the house and the meals take, so they can prepare for it
("plan for an hour a day of cleaning if needed").
- **Chores** (Plan and Progress): every chore counted as often as it comes round - daily 7 times a
  week, weekly once, monthly 12/52, yearly 1/52 - added up for the week and divided by 7. One-off
  jobs are left out; optional improvements are shown apart; a chore with no time is counted as
  unknown, not guessed. "By room" shows where the time goes.
- **Meals** (Calendar, week view): each planned meal's preparation plus cooking, from its recipe,
  under each day's date, with the week's total and the average a day. Every meal planned that week
  counts, shown or not; leftovers take none (they are cooked with the meal they come from). A meal
  with no time is counted as unknown. The recipe's time is used as it stands, not scaled for
  servings.

**D-078 One page per home; scenarios with and without; one Compare; the (i) (owner, 2026-10-28).**
The owner pointed out that Homes had five tools - A home, Bond, Our bond, Sell to buy, Own or rent -
the first four much alike, and asked whether there was a reason they were separate. There was not:
they were built one question at a time. Now:
- **One Home page per home**, of three kinds - Buying, Ours already, Renting - in sections, in the
  order a decision is made: the home (and what our own has grown by), the rent, selling our current
  home first, buying it (every cost item by item), the bond (a new one, or ours with its history),
  running it, upgrades, getting to work, after the bond is paid off (invest what the instalment was),
  how long and selling later, and what the money up front could have earned. Each can be ticked
  "Left out" (it then counts nothing) and folded away; the fold is remembered on the device.
- **What if…**: lines to tick - pay more each month for a period (on top of the minimum, which then
  shortens the bond), pay in once, take money out, a rate change. Every graph shows the home with and
  without them; the page says how many months sooner, the interest saved, and how much better off.
- **Compare** takes any saved homes - buy against buy, against renting, or keeping ours - on the same
  money: each month every household has as much as the dearest needs, whoever needs less invests the
  difference, and day-one cash one needs less of is invested too. Keeping ours starts from what it
  would sell for today; renting after selling ours starts with the sale's cash invested. Tested: a
  home growing as fast as investments, with no costs, comes out level with selling and renting.
- **Cars** get the same: tick fuel or upkeep out, and what-ifs on the loan (the balloon stays due;
  money taken back out is allowed but flagged - most car finance cannot be redrawn).
- **The (i)** beside every heading and figure in Homes and Cars: what it is, where to find your own
  (bond statement, municipal account, the lease, a quote) and how to get the latest (prime after each
  Reserve Bank meeting, fuel on the first Wednesday of the month). The words are in finance/help.js.
- Saved work from the five old tools opens on the new page as the right kind; the Money plan brings
  in the new homes (cash to move in, then the monthly cost; the home already owned is left out).

**D-077 Money in and out, one rule for every graph (owner, 2026-10-28).** "Show the growth of the
house/car/investment over time, and my monthly expense; make all values going out of my pocket
negative and all values growing my pocket positive." Every Finance graph and money table now follows
that rule: what the home, car or savings are worth, and money coming back, above zero; what is paid,
owed or spent below it. Each tool has a "Money in and out" panel - what it is worth against what is
still owed and what has gone out so far, and a second graph of each month's spending (A home, Cars,
Compound interest, Our bond; Own or rent's monthly comparison moved into plain view). Money plan
shows free money above, what the goals take below, and what is left over.
The owner also asked how the first month could "cost R51k": A home's graph spread the loss of selling
early over the months lived there (R153k after 3 months = R51k a month). It is replaced by "If you
sold after…": the whole amount ahead or behind, starting at what selling straight away would lose
(duty, fees, the agent), with what the money up front could have earned counted, so it ends exactly
where the table does.

**D-076 Fuel and charging, worked out (owner, 2026-10-28).** Cars had one "fuel or charging a
month" amount to type. Now: what it runs on (petrol, diesel, hybrid, plug-in hybrid, electric), the
distance a year, and the consumption (litres or kWh per 100 km; a typical figure, labelled, when
left empty). Fuel at the official October 2026 price, inland or coastal (petrol 95 R30.25/R29.38;
diesel wholesale R31.95/R31.08 - the pump is a little more); prices change on the first Wednesday of
each month, so the price shows its date and can be changed. Electric: home R4.16 and public R7.50 a
kWh (typical, 2026), the share charged at home, 10% lost while charging, electricity rising 9% a year
(NERSA's 2026/27 municipal increase); a plug-in hybrid splits its kilometres. A home charger counts
once, up front. The owner added: insurance, a yearly service, oil, tyres and licence are now separate
lines (oil not for electric cars); older saved cars keep their single upkeep figure. Your own monthly
fuel figure still replaces the worked-out one. "Did you think of…" changes with the car (insurance
quotes, cheaper servicing and faster tyre wear for electric cars, the battery warranty, uncertain
used-EV prices, home against public charging). Compare shows fuel or charging and upkeep side by side.

**D-075 Our bond, as it really went (owner, 2026-10-27).** The owner paid R12 000 a month for years
when the instalment was about R9 800, then the minimum; took R100 000 out after 4 years for a car;
and wanted to log that and see what it did. Homes › Our bond: the bond at the start (amount, month,
years, rate) and a log of what happened - "Paid each month" for a period, "Paid in once", "Took
out", "Rate changed". Worked month by month as an access bond: paying more does not lower the
minimum, it shortens the bond; money taken out, or a rate change, makes the minimum be worked out
again over the months left (said in Learn - "check how your own bank does it"). A payment below the
minimum is raised to it and said. Shows what is owed today, when it will be paid off, interest
against paying only the minimum, what money taken out costs in bond interest, and what paying R1 000,
R2 000 or R5 000 more from today would do - on a graph with each event and today marked.

Also: the owner pointed out A home's graphs read upside down - cost was positive, so coming out
ahead showed as a minus. They are flipped to money in your pocket: above zero you are ahead, below
it the home costs you (as Own or rent and Job offers already were), with "Pays for itself from…"
marked; the total says "R… ahead" instead of a minus cost, and "what moves it" says costs or saves.
Every graph was then checked: graphs about dates (Children, Money plan, Our bond) show calendar
years; year ticks fall on whole years whether or not a point does.

**D-074 Selling to buy, and every cost item by item (owner, 2026-10-27).** Agents ask different
rates; lawyers' and "hidden" fees were not visible. Buying costs are now itemised from published
figures: transfer duty (SARS); transfer and bond attorney fees on the LSSA conveyancing guideline from
1 July 2026 plus 15% VAT (tested against the published R1m, R1.5m, R2m, R3m, R5m and R10m figures);
Deeds Office transfer and bond fees (GN 7180, from 27 March 2026); the bank's initiation fee
(R6 037.50 in Nedbank and Standard Bank 2026 pricing); attorneys' extras (illustrative). This
replaces the earlier rough fee formula everywhere in Homes, and Bond lists them item by item.
Selling costs: the agent's % plus VAT (the family's own rate), bond cancellation attorney and
months of notice not given (interest), the electrical certificate, and beetle, gas and fence
certificates where they apply (illustrative, from published ranges). **Sell to buy** (Homes): sale
price → selling costs → tax on the gain (above R3m) → bond settled = cash; then the new home's
buying costs (in cash, first), what is kept for renovations, moving and a reserve, and the rest is
the deposit - shown as a falling staircase, with what it leaves on the new bond, and a tap to take
the deposit into Bond or Own or rent. Bridging, double bonds and occupational rent are named, not
counted. Every estimate says it is one and that a quote replaces it.

**D-073 Graphs that tell the story (owner, 2026-10-27).** "Graphs that tell a story, that make
sense": every Finance tool now has one graph in plain view (Simple included), with the moments that
matter marked as labelled upright lines and a one-line story under it. Own or rent: ahead or behind
by how long you stay ("Owning ahead from year 5", and the stay chosen) - drawn only as many years as
the story needs - plus the home over time (its value, the bond still owed, and what owning has cost,
marked where it becomes worth more than spent, and when the bond is paid off) and, in Advanced, each
month's cost of owning against renting (rent dearer from…, bond paid off). A home: cost a month by
how long you stay. Bond: each instalment's interest against capital, and when more pays off the bond.
Cars: worth against owed. Compound interest: when growth is bigger than all put in. Job offers: ahead
of the job you have, after moving costs, with when it gets ahead. Children: what falls due each year,
the biggest marked. Money plan: free against needed, with the first goal short and when commitments
outgrow income. Axis amounts are short (R2.4m, R850k); the turning points are found by crossing().

**D-067, a bond of any length (owner, 2026-10-27).** The bond term was three chips (20, 25, 30
years); the owner's own bond was 14 years. It is now any number of years (halves too), in Bond,
A home and Own or rent; the Bond tool's "what would change it" shows 5 years shorter and longer.

**Not built (recorded so nobody looks for it):** recurring meal traditions (none existed before),
a pantry (so no "use before it expires" or "what we have in stock" beyond a typed list), cost,
equipment and difficulty filters (no data), and individual 1-10 ratings (preferences cover it).

**O-7 (W2) Phone live sync.** Only possible through a registered Google app (rejected, D-013).
Revisit only if browsers gain folder access on phones.
