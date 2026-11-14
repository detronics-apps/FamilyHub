# Family Hub

**Live: https://familyhub.detronics.co.za/**

A calm, local-first place for a household to share the everyday load. The product brief is
[Family_Hub_Product_and_Implementation_Plan.md](Family_Hub_Product_and_Implementation_Plan.md);
this README describes what is built.

One static page. No backend, no build step, no dependencies, no accounts. Nothing is sent to the
publisher or anyone else.

Why Family Hub exists, the thinking behind it and the story of every feature are in
[FEATURES.md](FEATURES.md); what is still to come is in [BACKLOG.md](BACKLOG.md), and what was
decided against in [REJECTED.md](REJECTED.md).

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
  music from your own files; Start / Done / Undo; next suggestions; Rooms; neutral Progress.
- **Tasks**: one-off jobs and projects with steps and dependencies.
- **Tickets**: capture in seconds; the weekly family meeting; turn into a decision or task.
- **Principles**: values and agreements with reasons, exceptions and review triggers.
- **Decisions**: agreements as experiments - try, observe, look back, adapt, revise with history.
- **Shopping**: one family list on the home screen - send meals, the week's plan or chore supplies
  to it, or find things by kind (food, cleaning, hygiene, medical...) from what the family buys or
  from everything there is. "At the shop" is the list alone, to tick off.
- **Meals** section, four mini-apps sharing one food database (USDA FoodData Central, ~13,600
  foods) and the details on the People page:
  - **Calorie Checker**: what is in a food; browse everyday foods by type, colour and most
    protein / fibre / fat / carbs to discover new ones.
  - **Cookbook**: items, each called a meal, a recipe or an own ingredient (home-made mayo) - or
    left as an item until you decide. Anything can go into anything. Search, type and allergen
    filters, scaling, and a portion guide per person with or without leftovers. Plan it or send
    its ingredients to Shopping.
  - **Meal Planner**: choose the meals first (breakfasts, lunches, dinners and snacks - snacks can
    be plain items like carrots), then drag them onto a week or month calendar; drag between days to
    swap. Set servings, guests and leftovers (set aside for a later meal, counted once), change one
    meal without touching the recipe, Suggest meals (favourites plus new ones), How the week looks
    and Optimise My Week, and send a week or a month to Shopping.
  - **Calorie Checker**: calories and nutrients in the amount you actually eat (a cup, a slice,
    grams); build up the family meal or someone's plate and save it as a meal. Nothing is logged.
  - **Meal Assistant**: type a meal in a few words, choose who is eating, get one or two easy
    ideas (add, swap, time, try next time) that fit their ages, allergies, diet, pregnancy and
    wishes - or open one of the family's recipes to see what could improve it. No scores, no tracking, not medical advice. See [docs/MEAL_ASSISTANT.md](docs/MEAL_ASSISTANT.md).
- **Holidays**: big trips with a day-by-day plan, packing per person and a budget; and **Places to go** -
  local outings tagged great for kids, pet friendly, free...
- **Finance**: monthly budgets (planned against spent) and savings/debt goals with projections
  that show their assumptions. No bank connections, no advice.
- **Exercise**: activity log, flexible weekly plans, personal goals, what the family did together.
- **Faith**: Bible reading plans at your own pace; a journal with headings, questions (and where each
  stands), passages, topics and terms; and a guide to who wrote each book, when, to whom and why.
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

Node's built-in runner, nothing to install - over 450 tests, including a 5,000-recipe performance
test and the security baseline (`tests/security.test.js`, `tests/csp.test.js`). The same command runs
on every push and pull request (`.github/workflows/test.yml`, Node 22).

## Deploying

GitHub Pages from `main` / root, at its own address, `familyhub.detronics.co.za` (`CNAME`) - so no
other app shares its browser storage. `.nojekyll` is present. There is nothing to build.

### How a change is published

1. Work on the `platform` branch.
2. Open a pull request from `platform` into `main`.
3. Publish (merge) only when the Tests workflow is green **and** the owner has read the diff.
   `main` is protected so that a pull request is the only way in.

A bad version is withdrawn as described in [SECURITY.md](SECURITY.md).

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
Drive; without one, in this browser only (not a backup). Choosing a profile is not a login.

- **Stored unencrypted:** everything is stored unencrypted in this browser and in your Drive folder.
  Anyone who can use this browser profile, or open that folder, can read it. Keep only what you
  would be comfortable keeping in that Drive folder.
- **On a shared or public computer:** use your own computer account or browser profile. On a public
  computer, don't connect Drive, and when you're done use Settings › Your data › Delete everything
  on this device, then Disconnect.
- **Removing access:** Disconnect stops Family Hub using the folder. To remove the browser's access
  as well: click the icon left of the address › Site settings › File editing › Reset. Google Drive
  for Desktop is managed in Google's own app.
- **Found a security problem?** Report it privately:
  <https://github.com/detronics-apps/FamilyHub/security/advisories/new> - see [SECURITY.md](SECURITY.md).

## Known limitations

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#known-limitations).
