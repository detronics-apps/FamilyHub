# Building a Family Hub mini-app

Family Hub is a small core plus mini-apps. Chores, Tasks, Tickets, Principles and Decisions are the
starter pack; anyone can write another and a family can add it by copying a folder into their
Google Drive. This guide is everything you need. A complete working example is in
[`examples/miniapps/FamilyNotes/`](examples/miniapps/FamilyNotes/).

## How a family installs it

1. They copy your package folder into `FamilyHub/MiniApps/ThirdParty/` in their Google Drive
   folder (the one Family Hub is connected to).
2. In Family Hub: **Mini-apps → Look again**. Your package is found, checked, and listed.
3. They press **Review and install**, read what it asks permission for, tick "I trust whoever made
   this", and install it. It appears on their home screen.

Nothing in the folder runs until step 3. If your files change later, the app stops running until
the family reviews the change (the code is fingerprinted at install).

## Package layout

```
YourApp/
├── manifest.json     required - who you are and what you need
└── app.js            the code (the "entry" named in the manifest)
```

One JavaScript file, at most 2 MB. No other files are loaded: images must be inline (data: URLs)
and styles go in your own `<style>` element.

## manifest.json

```json
{
  "fhManifest": 1,
  "id": "org.example.familynotes",
  "name": "Family Notes",
  "version": "1.0.0",
  "description": "A shared notice board.",
  "author": "Your name",
  "requires": { "api": 1, "core": ">=0.2.0 <1.0.0" },
  "entry": "app.js",
  "screens": [{ "id": "board", "title": "Notes" }],
  "data": {
    "collections": [
      { "name": "notes", "schema": 1, "summary": ["title", "author"], "search": ["title", "body", "author"] }
    ]
  },
  "permissions": ["data:own", "people:read", "notify"]
}
```

| Field | Rule |
|---|---|
| `fhManifest` | Always `1` for this format. |
| `id` | Lower-case letters, digits and dots, e.g. `com.yourname.app`. Never changes between versions. Words Family Hub uses itself (`settings`, `home`, `library`, …) are refused. |
| `name` | 1–40 characters, shown on the home screen. |
| `version` | `major.minor.patch`. An update must have a higher version. |
| `requires.api` | The hub interface version you were written for. Currently `1`. |
| `requires.core` | Optional Family Hub version range, e.g. `">=0.2.0 <1.0.0"`. |
| `entry` | Your `.js` file, inside the package (no `..`, no URLs). |
| `screens` | At least one `{ id, title }`. Ids: lower-case letters, digits, dashes. |
| `data.collections` | Your record types: `name`, `schema` (whole number, raise it when your record shape changes), optional `summary` and `search` field lists (≤ 12 each; defaults `title`, `name`, `status`). |
| `permissions` | What you need - see below. Unknown permissions make the manifest invalid. |

## Permissions

| Permission | What it allows |
|---|---|
| `data:own` | Keep your own records (required if you declare collections). |
| `people:read` | The household's people: id, name, adult/child, colour. |
| `rooms:read` | The household's rooms. |
| `notify` | Show a short notice at the top of the screen. |
| `data:<app-id>:read` | Read (never change) another mini-app's records. |

`household:chores`, `household:people:write`, `media:audio` and `timer` are available to the
starter apps only, in this version.

## The hub

Your code runs in a sealed frame and talks to Family Hub through `window.FamilyHub`:

```js
FamilyHub.ready(async (hub) => {
  hub.app;      // { id, name, version, screens }
  hub.route;    // { screen, param } - which of your screens is open
  hub.onRoute((route) => { /* the family moved to another of your screens */ });

  await hub.data.put('notes', { title: 'Dentist Thursday' });          // -> saved record (id, rev, dates added)
  await hub.data.list('notes', { offset: 0, limit: 50 });              // -> { total, items: [summaries] }
  await hub.data.search('notes', 'dentist', { limit: 20 });            // -> { total, items: [summaries] }
  await hub.data.get('notes', id);                                      // -> the full record, or null
  await hub.data.remove('notes', id);                                   // -> true

  await hub.settings.get('sortOrder');  await hub.settings.set('sortOrder', 'newest');
  await hub.people.list();                                              // needs people:read
  await hub.rooms.list();                                               // needs rooms:read
  await hub.notify('Saved.', 'ok');                                     // needs notify; 'ok' | 'info' | 'warn'
  await hub.go('board', optionalParam);                                 // one of your declared screens
});
```

Every call returns a promise and may reject with a plain-language message (for example when a
permission is missing). Draw your interface into `document.getElementById('app')`. The frame
grows to fit your content. The family's colours are available as CSS variables (`--panel`,
`--text`, `--accent-strong`, `--border`, `--radius`, …).

### Records

- Records are plain JSON objects, at most 200 KB each. Family Hub adds `id`, `rev`, `createdAt`,
  `updatedAt` and `schema`.
- `list` and `search` return **summaries** - only the `summary` fields - read from one index file,
  so they stay fast with thousands of records. Use `get` to read one record in full when it is
  opened.
- Search matches every word of the query against your `search` fields.
- If the same record was changed on two devices, Family Hub merges changes to different fields
  automatically; your `put` is refused only if the very same field was changed differently.

### Where your data lives

```
FamilyHub/Data/<your-app-id>/<collection>/index.json
FamilyHub/Data/<your-app-id>/<collection>/records/<record-id>.json
FamilyHub/Data/<your-app-id>/settings.json
```

Plain JSON the family can read, copy and back up in Google Drive. Uninstalling your app keeps it;
a reinstall reconnects it if your collection `schema` is the same or higher.

## What the sandbox blocks

Verified in the browser (see TEST_PLAN.md): network requests of any kind, outside scripts, reading
Family Hub's page, storage or database, other apps' data without permission, collections you did
not declare. Pop-ups and `alert()` are blocked too - show messages in your own page.

One thing a sandbox cannot stop: an app could navigate its own frame to an outside address and
carry data it was allowed to see in that address. That is why families are told to install only
mini-apps from people they trust, and why permissions are kept narrow.

## Updating your app

Raise `version`, change your files, and ask the family to copy the new folder over the old one.
Family Hub shows "Update available"; if you ask for new permissions, they are listed for approval.
Never lower a collection's `schema`.
