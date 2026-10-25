# Family Hub

A calm, local-first place for a household to share the everyday load. This first release builds
the foundation and one complete workflow — **Chores: Plan → Do something now → Done → optional
next task → stop or carry on** — as set out in
[Family_Hub_Product_and_Implementation_Plan.md](Family_Hub_Product_and_Implementation_Plan.md),
which is the canonical product brief.

One static page. No backend, no build step, no dependencies, no network requests after load.

## What works now

- Dashboard of large module buttons; each profile can reorder, hide and restore them (saved per
  profile, on this device, separate from household data).
- "Who are you?" profile picker — a convenience, **not** authentication.
- Chores
  - **Do something now** — filter by time, energy, room (or "anywhere but…"), and who is asking;
    transparent ordering with a "Why these suggestions?" panel; Done, Not now (tomorrow / next
    week / a date / skip this time / no longer needed), Undo; momentum suggestions after each
    completion; "Finish for now" as a normal ending.
  - **Rooms** — each room's chores, each completed on its own.
  - **Plan** — add/edit/delete chores (only a name is required), rooms, review prompts for chores
    that keep not fitting in.
  - **Progress** — neutral household totals, "still waiting" list, recent activity. No per-person
    counts or rankings.
- Settings — household name, people (adult/child, colour), your dashboard, export/import, remove
  example data, delete everything.
- Example family (clearly labelled, added only on request, removable in one step).
- How to use guide with search in everyday words, and a first-run welcome.

Every other module (Tasks, Tickets, Principles, Decisions, Meals, Finance, Health, Exercise,
Medical, Holidays, Faith) is a labelled placeholder that says it is not built yet.

## Running it

```bash
python -m http.server 8851
```

Then open http://localhost:8851. Any static server works.

## Tests

The domain logic is pure (no DOM), so it runs under Node's built-in test runner with nothing to
install:

```bash
npm test
```

## Deploying

Any static host. For GitHub Pages: push to `main`, then Settings → Pages → Deploy from a branch →
`main` / root. `.nojekyll` is present. There is nothing to build.

## Layout of the code

```
index.html                 the shell; everything else is built by JS
css/tokens.css             the warm palette, light and dark
css/app.css                layout and components
css/patterns.css           notification and tooltip rules (from the Detronics app skill)
js/dates.js                calendar-day arithmetic and friendly wording
js/model.js                versioned household model, migration, validation, edit helpers
js/recurrence.js           current occurrence of a chore, derived from definition + history
js/matching.js             "what can I do now?" filters, ordering, momentum suggestions
js/progress.js             neutral household progress and activity
js/dashboard.js            module map and per-person dashboard preferences
js/storage.js              storage interface, local adapter, export/import
js/demo.js                 the example family
js/guide.js                help content, search, privacy/about text
js/main.js                 boot, app state, routing, frame
js/ui/                     DOM helpers, shared UI, one file per screen in views/
tests/                     node --test over every pure module
```

**Everything under `js/` except `js/ui/` is pure.** See [ARCHITECTURE.md](ARCHITECTURE.md).

## Privacy

Nothing you enter leaves your browser. No server, no accounts, no analytics, no cookies, no
third-party scripts or fonts. The household is kept in `localStorage` on this device only.
**Browser storage is not a backup and does not sync between devices** — use Export.
Choosing a profile is not a login; do not store sensitive information in this version.

## Known limitations

See the progress section of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
