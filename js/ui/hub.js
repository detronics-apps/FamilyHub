// The hub: the small interface a mini-app is given. It contains only what the
// app's granted permissions allow - an app without `people:read` simply has no
// `hub.people`. Documented for developers in MINIAPPS.md.
//
// First-party (starter) apps receive this object directly. Third-party apps
// never do: they run in a sandbox and reach the same capabilities through
// messages, checked again by js/ui/sandbox.js.

import { createCollection } from '../collections.js';

/**
 * Async data for a synchronous render: `use(key, loader)` returns
 * { loading, data, error } and re-renders when the loader settles.
 */
function createResources(onSettled) {
  const cache = new Map();
  return {
    use(key, loader) {
      if (!cache.has(key)) {
        const entry = { loading: true, data: undefined, error: null };
        cache.set(key, entry);
        Promise.resolve().then(loader).then(
          (data) => { entry.loading = false; entry.data = data; onSettled(); },
          (error) => { entry.loading = false; entry.error = error; onSettled(); },
        );
      }
      return cache.get(key);
    },
    invalidate(prefix = '') {
      for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
    },
  };
}

/**
 * The shared services the core passes in:
 *   ctx: render, go, flash, today, currentPerson, app (household), sync, media, timer
 */
export function createHubFactory(ctx) {
  const collections = new Map();     // `${storeKind}:${app}/${name}` -> collection
  const resources = new Map();       // app id -> resources
  let stale = false;

  // Another device may have changed the folder while this window was away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    stale = true;
    for (const r of resources.values()) r.invalidate();
  });

  function collectionFor(appId, manifest, name, spec = {}) {
    const store = ctx.sync.appStore();
    if (!store) throw new Error('Reconnect your Drive folder to open this - it needs one click.');
    const declared = manifest.data.collections.find((c) => c.name === name);
    if (!declared && appId === manifest.id) throw new Error(`${manifest.name} did not declare a "${name}" collection in its manifest.`);
    const key = `${store.kind}:${store.name}:${appId}/${name}`;
    if (!collections.has(key)) {
      collections.set(key, createCollection(store, { app: appId, name, schema: declared?.schema ?? 1, ...spec }));
    }
    const c = collections.get(key);
    if (stale) { stale = false; for (const x of collections.values()) x.load({ refresh: true }).catch(() => {}); }
    return c;
  }

  const readOnly = (c) => ({
    name: c.name, load: c.load.bind(c), count: c.count.bind(c), list: c.list.bind(c), search: c.search.bind(c), get: c.get.bind(c),
  });

  return function createHub(manifest, granted, { otherManifests = () => [] } = {}) {
    const has = (p) => granted.includes(p);
    if (!resources.has(manifest.id)) resources.set(manifest.id, createResources(() => ctx.render()));
    const res = resources.get(manifest.id);

    const hub = {
      app: { id: manifest.id, name: manifest.name, version: manifest.version },
      manifest,
      today: ctx.today,
      href: (screen = null, param = null) => `#/${manifest.id}${screen ? `/${screen}` : ''}${param ? `/${encodeURIComponent(param)}` : ''}`,
      go: (screen, param) => ctx.go(hub.href(screen, param)),
      render: () => ctx.render(),
      use: res.use,
      invalidate: res.invalidate,
      ui: {
        notice(text, level = 'ok', action = null) {
          if (!has('notify')) throw new Error(`${manifest.name} may not show notices.`);
          ctx.flash({ id: `${manifest.id}:${Date.now()}`, level, text: String(text).slice(0, 300), action });
          ctx.render();
        },
      },
    };

    if (has('data:own')) {
      hub.data = {
        collection: (name, spec) => collectionFor(manifest.id, manifest, name, spec),
        /** Records of another mini-app, only with a granted data:<app>:read or :write. */
        of(appId, name, spec) {
          const write = has(`data:${appId}:write`);
          if (!write && !has(`data:${appId}:read`)) throw new Error(`${manifest.name} may not read ${appId} records.`);
          const other = otherManifests().find((m) => m.id === appId);
          if (!other) return null;
          const c = collectionFor(appId, other, name, spec);
          return write ? c : readOnly(c);
        },
        installed: (appId) => otherManifests().some((m) => m.id === appId),
      };
      hub.settings = {
        async get(key, fallback = null) {
          const store = ctx.sync.appStore();
          const text = store ? await store.read(`Data/${manifest.id}/settings.json`) : null;
          const all = text ? JSON.parse(text) : {};
          return key in all ? all[key] : fallback;
        },
        async set(key, value) {
          const store = ctx.sync.appStore();
          if (!store) throw new Error('Reconnect your Drive folder to save settings.');
          const path = `Data/${manifest.id}/settings.json`;
          const all = JSON.parse((await store.read(path)) || '{}');
          all[key] = value;
          await store.write(path, JSON.stringify(all, null, 2));
        },
      };
    }
    if (has('people:read')) {
      hub.people = {
        list: () => (ctx.app.household?.people ?? []).map(({ id, name, role, colour }) => ({ id, name, role, colour })),
        current: () => { const p = ctx.currentPerson(); return p ? { id: p.id, name: p.name, role: p.role, colour: p.colour } : null; },
      };
    }
    if (has('rooms:read')) hub.rooms = { list: () => (ctx.app.household?.rooms ?? []).map(({ id, name }) => ({ id, name })) };
    if (has('media:audio')) hub.media = ctx.media;
    if (has('timer')) hub.timer = ctx.timer;
    if (has('household:chores')) hub.core = ctx;       // first-party only (validateManifest enforces it)
    return hub;
  };
}
