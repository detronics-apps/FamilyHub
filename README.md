# Family Hub

**Live: https://detronics-apps.github.io/FamilyHub/**

A calm, local-first place for a household to share the everyday load. The product brief is
[Family_Hub_Product_and_Implementation_Plan.md](Family_Hub_Product_and_Implementation_Plan.md);
this README describes what is built.

One static page. No backend, no build step, no dependencies, no accounts. Nothing is sent to the
publisher or anyone else.

## What works now (v0.3.0)

- **Your own Google Drive folder as the home of the data** (Chrome/Edge on a computer, with Google
  Drive for Desktop): pick the folder once; every change is saved there as readable files, other
  laptops' changes are picked up, and anything changed in two places at once is shown to you to
  choose - never silently overwritten. Backups in the folder. Phones open and save a "family file"
  from Drive. Without a folder, everything stays in the browser.
- **People**: its own page - name, adult/child, gender, colour, food details, personal goals
  (including an energy goal for adults), and a dated record of height and weight.
- **Sections and mini-apps**: the home screen shows sections of family life (Chores, Meals,
  Finance...). A section is part of Family Hub; the mini-apps inside it are what get installed or
  removed. The starter mini-apps can be turned
  off, uninstalled (records kept), reinstalled (records back) or have their records deleted
  separately. Other people's mini-apps are added by copying a folder into `MiniApps/ThirdParty`;
  they are reviewed before installing and run sealed off. See [MINIAPPS.md](MINIAPPS.md).
- **Chores**: plan; "Do something now" by time, energy and room; Start for a timer with optional
  music from your own files; Done / Not now / Undo; next suggestions; Rooms; neutral Progress.
- **Tasks**: one-off jobs and projects with steps and dependencies.
- **Tickets**: capture in seconds; the weekly family meeting; turn into a decision or task.
- **Principles**: values and agreements with reasons, exceptions and review triggers.
- **Decisions**: agreements as experiments - try, observe, look back, adapt, revise with history.
- **Shopping**: one family list on the home screen - send meals, the week's plan or chore supplies
  to it, or type anything in.
- **Meals** section, four mini-apps sharing one food database (USDA FoodData Central, ~13,600
  foods) and the details on the People page:
  - **Meals & Recipes**: meals (a name and ingredients) and recipes (a meal with a method - add it
    any time). Search, allergen filter, scaling, and a portion guide per person with or without
    leftovers. Plan a meal or send its ingredients to Shopping.
  - **This Week**: the week's meals as planned occasions - browse and filter your meals from the
    planner, set servings, guests and leftovers (set aside for a later meal, counted once), change
    one meal without touching the recipe, Plan my week (favourites plus new meals), How the week
    looks and Optimise My Week, and send everything to Shopping.
  - **Calorie Checker**: calories and nutrients in the amount you actually eat (a cup, a slice,
    grams); build up the family meal or someone's plate and save it as a meal. Nothing is logged.
  - **Meal Assistant**: type a meal in a few words, choose who is eating, get one or two easy
    ideas (add, swap, time, try next time) that fit their ages, allergies, diet, pregnancy and
    wishes - or open one of the family's recipes to see what could improve it. No scores, no tracking, not medical advice. See [docs/MEAL_ASSISTANT.md](docs/MEAL_ASSISTANT.md).
- **Holidays**: trips and ideas with a day-by-day plan, packing per person, and a budget.
- **Finance**: monthly budgets (planned against spent) and savings/debt goals with projections
  that show their assumptions. No bank connections, no advice.
- **Exercise**: activity log, flexible weekly plans, personal goals, what the family did together.
- **Faith**: Bible reading plans at your own pace, and a journal.
- **Bring in data**: spreadsheet templates (CSV) for recipes, chores and tasks - import in
  Settings, or drop filled-in files into the `Import` folder of the Drive folder.
- Planned, not built: **Planner** (family calendar) and **Medical** (needs private records first).
- Dashboard per person, "Who are you?" (a convenience, not a login), How to use guide with
  everyday-word search, first-run welcome.

## Running it

```bash
python tools/serve.py 8851
```

Then open http://localhost:8851. (`tools/serve.py` is a plain static server that turns off browser
caching, so a reload always runs the current code. Any static server works.)

Test mode for the Drive folder without a real Drive: open `http://localhost:8851/?folder=private`
and the browser's private storage stands in for the folder.

## Tests

```bash
npm test
```

Node's built-in runner, nothing to install. 181 tests, including a 5,000-recipe performance test.

## Deploying

GitHub Pages from `main` / root. `.nojekyll` is present. There is nothing to build.

## Layout of the code

```
index.html                 the shell; everything else is built by JS
css/                       tokens (warm palette), app styles, notice patterns
js/*.js                    pure domain modules (household, recurrence, matching, folder store,
                           folder sync, merge, collections, family file, mini-apps, timer, music)
js/apps/catalogue.js       the starter mini-apps (manifest + lazy loader each)
js/apps/<id>/logic.js      each mini-app's rules (pure, tested)
js/apps/<id>/app.js        each mini-app's screens
js/apps/kit.js             shared screen pieces for mini-apps
js/ui/                     the frame: hub, sync, sandbox, packages, media, session, IndexedDB, views
examples/miniapps/         a complete third-party mini-app to copy
tests/                     node --test over every pure module
tools/serve.py             no-cache dev server
```

Docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) ·
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · [TEST_PLAN.md](TEST_PLAN.md) ·
[MINIAPPS.md](MINIAPPS.md).

## Privacy

Nothing is sent to the publisher or anyone else: no server, no accounts, no analytics, no cookies,
no third-party scripts or fonts. With a Drive folder, the family's data lives in their own Google
Drive; without one, in this browser only (not a backup). Choosing a profile is not a login; do not
store sensitive information in this version.

## Known limitations

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#known-limitations).
