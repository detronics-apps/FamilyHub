// Boot, app state, routing and the frame. Screens live in js/ui/views/ (core)
// and js/apps/<id>/ (mini-apps).
//
// The household is only ever changed through `commit(next)`: saved on this
// device straight away, then written to the family's Drive folder by the sync
// controller (js/ui/sync.js). Mini-apps get a `hub` (js/ui/hub.js) holding only
// what their permissions allow; third-party ones run sandboxed (js/ui/sandbox.js).

import { createLocalStore } from './storage.js';
import { emptyHousehold, recordEvent, removeEvent, addPerson, normaliseHousehold, roleOf } from './model.js';
import { toDay, fmtDay } from './dates.js';
import { occurrence } from './recurrence.js';
import { defaultFilters } from './matching.js';
import { demoHousehold } from './demo.js';
import { CORE_TILES } from './dashboard.js';
import { activeSections, appsIn, section, sectionOf } from './sections.js';
import { starterRegistry, reconcileStarters, normaliseRegistry, setEnabled } from './miniapps.js';
import { starterManifests, starter } from './apps/catalogue.js';
import { el, clear } from './ui/dom.js';
import { renderNotices, captureFocus, restoreFocus } from './ui/patterns.js';
import { avatar, modal, HOUSE_ICON } from './ui/common.js';
import { createSync, folderSupported } from './ui/sync.js';
import { createHubFactory } from './ui/hub.js';
import { createMedia } from './ui/media.js';
import { createSession, sessionPanel } from './ui/session.js';
import { renderThirdParty, postRoute } from './ui/sandbox.js';
import { cachedPackage } from './ui/packages.js';
import { dashboardView } from './ui/views/dashboard.js';
import { settingsView } from './ui/views/settings.js';
import { libraryView } from './ui/views/library.js';
import { sectionView } from './ui/views/section.js';
import { peopleView } from './ui/views/people.js';
import { helpView } from './ui/views/help.js';
import { placeholderView } from './ui/views/placeholder.js';
import { recoveryView } from './ui/views/recovery.js';
import { openWelcome } from './ui/views/welcome.js';
import { openDoc } from './ui/views/docs.js';
import { syncChip, syncNotices } from './ui/views/drive.js';
import { scanImportFolder } from './ui/imports.js';

export const APP_VERSION = '0.7.2';

const store = createLocalStore(window.localStorage);

/** Everything the views read. Views never write to it directly - they call ctx methods. */
const app = {
  household: null,
  loadError: null,          // { error, previousAvailable } when the saved data is unreadable
  device: store.loadDevice(),
  registry: null,           // installed mini-apps (miniapps.js)
  flash: [],                // short-lived notices (with Undo) shown until the next navigation
  storageError: null,
  execute: { filters: defaultFilters(), phase: 'choose', justDone: null, showAll: false },
  ui: { openLater: null },
};

const dom = {};

/* ---------------------------------------------------------------- state */

const today = () => toDay(new Date());

function currentPerson() {
  return app.household?.people.find((p) => p.id === app.device.currentPersonId) || null;
}

function commit(next, { quiet = false } = {}) {
  app.household = next;
  const result = store.saveHousehold(next);
  app.storageError = result.ok ? null : result.error;
  ctx.sync.schedule();
  if (!quiet) render();
}

/** Another device's version arrived (or a merge finished): show it, without writing it back. */
function replaceHousehold(next, message = null) {
  app.household = next;
  const result = store.saveHousehold(next);
  app.storageError = result.ok ? null : result.error;
  if (message) flash({ id: `sync:${Date.now()}`, level: 'info', text: message });
  render();
}

function saveRegistry(next) {
  app.registry = normaliseRegistry(next);
  const r = store.saveRegistry(app.registry);
  if (!r.ok) app.storageError = r.error;
  ctx.sync.schedule();
  render();
}

function replaceRegistry(next) {
  app.registry = normaliseRegistry(next);
  store.saveRegistry(app.registry);
}

function setDevice(patch) {
  app.device = { ...app.device, ...patch };
  const result = store.saveDevice(app.device);
  if (!result.ok) app.storageError = result.error;
}

function flash(notice) {
  app.flash = [{ ...notice, at: Date.now() }, ...app.flash.filter((n) => n.id !== notice.id)].slice(0, 3);
}

/** Record done / skipped / deferred / rescheduled / dropped, with an Undo. */
function act(choreId, type, until = null) {
  const chore = app.household.chores.find((c) => c.id === choreId);
  if (!chore) return null;
  const occ = occurrence(chore, app.household.events, today());
  const { household, event } = recordEvent(app.household, {
    choreId, type, until, by: currentPerson()?.id ?? null, dueDay: occ.dueDay,
  });
  const text = {
    done: `Done: ${chore.name}.`,
    skipped: `Skipped this time: ${chore.name}. It comes round again on its normal cycle.`,
    deferred: `${chore.name} will be back ${until ? fmtDay(until, today()) : 'later'}.`,
    rescheduled: `${chore.name} moved to ${until ? fmtDay(until, today()) : 'later'}.`,
    dropped: `${chore.name} closed - no longer needed.`,
  }[type];
  app.ui.openLater = null;
  flash({ id: `act:${event.id}`, level: 'ok', text, action: { label: 'Undo', onClick: () => undo(event.id) } });
  commit(household);
  return event;
}

function undo(eventId) {
  app.flash = app.flash.filter((n) => n.id !== `act:${eventId}`);
  if (app.execute.justDone?.eventId === eventId) app.execute = { ...app.execute, phase: 'choose', justDone: null };
  commit(removeEvent(app.household, eventId));
}

function seedDemo() {
  const demo = demoHousehold(today());
  if (!app.household || isBlank(app.household)) {
    commit(demo, { quiet: true });
  } else {
    // Added alongside real data only because someone pressed the button for it.
    const h = app.household;
    const ids = (list) => new Set(list.map((x) => x.id));
    const fresh = (mine, theirs) => theirs.filter((x) => !ids(mine).has(x.id));
    commit(normaliseHousehold({
      ...h,
      people: [...h.people, ...fresh(h.people, demo.people)],
      rooms: [...h.rooms, ...fresh(h.rooms, demo.rooms)],
      chores: [...h.chores, ...fresh(h.chores, demo.chores)],
      events: [...h.events, ...fresh(h.events, demo.events)],
    }), { quiet: true });
  }
  if (!currentPerson()) setDevice({ currentPersonId: 'p_demo_alex' });
}

const isBlank = (h) => !h.people.length && !h.rooms.length && !h.chores.length;

function startOwn(name, personName) {
  let h = emptyHousehold(name);
  let person = null;
  if (personName.trim()) ({ household: h, person } = addPerson(h, { name: personName, role: 'adult' }));
  commit(h, { quiet: true });
  setDevice({ currentPersonId: person?.id ?? null });
}

/* ------------------------------------------------------------ mini-apps */

const loadedModules = new Map();     // starter id -> module | Error
const loadingModules = new Set();

/**
 * Home-screen tiles: one per section of family life, followed by the core tiles.
 * A section with a single mini-app switched on opens that app directly.
 */
function dashboardModules() {
  const installed = installedManifests();
  return [...activeSections([...starterManifests(), ...installed]).map((s) => {
    const on = appsIn(s.id, installed).filter((m) => app.registry.apps[m.id]?.enabled);
    return { id: s.id, name: s.name, purpose: s.purpose, status: 'ready', href: on.length === 1 ? `#/${on[0].id}` : `#/section/${s.id}` };
  }), ...CORE_TILES];
}

function manifestFor(id) {
  return starter(id)?.manifest ?? cachedPackage(id)?.manifest ?? null;
}

function installedManifests() {
  return Object.keys(app.registry.apps).map(manifestFor).filter(Boolean);
}

function starterModule(id) {
  if (loadedModules.has(id)) return loadedModules.get(id);
  if (!loadingModules.has(id)) {
    loadingModules.add(id);
    starter(id).load().then(
      (m) => { loadedModules.set(id, m); loadingModules.delete(id); render(); },
      (err) => { loadedModules.set(id, err); loadingModules.delete(id); render(); },
    );
  }
  return null;
}

/** A mini-app's screen. Any failure stays inside this panel - the rest of Family Hub carries on. */
function appView(route, notices) {
  const id = route.name;
  const entry = app.registry.apps[id];
  const label = entry?.name ?? starter(id)?.manifest.name ?? id;

  if (!entry) {
    if (!starter(id) && !app.registry.retained[id]) return placeholderView(ctx, route);
    return el('section', { class: 'panel empty' }, [
      el('h1', { text: label }),
      el('p', { text: `${label} is not installed.${app.registry.retained[id] ? ' Its records are still kept in your folder.' : ''}` }),
      el('a', { class: 'btn btn-primary', href: '#/library', text: 'Install', title: 'Open Mini-apps to install it' }),
    ]);
  }
  if (!entry.enabled) {
    return el('section', { class: 'panel empty' }, [
      el('h1', { text: label }),
      el('p', { text: `${label} is turned off. Its records are kept.` }),
      el('button', { class: 'btn btn-primary', type: 'button', text: `Turn on`, on: { click: () => saveRegistry(setEnabled(app.registry, id, true)) } }),
    ]);
  }

  const failed = (err) => el('section', { class: 'panel stack', role: 'alert' }, [
    el('h1', { text: label }),
    el('p', { text: `${label} was stopped. The rest of Family Hub is fine, and nothing was lost.` }),
    el('p', { class: 'small muted', text: String(err?.message || err) }),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Try again', on: { click: () => { loadedModules.delete(id); render(); } } }),
      el('button', { class: 'btn', type: 'button', text: `Turn off`, on: { click: () => saveRegistry(setEnabled(app.registry, id, false)) } }),
    ]),
  ]);

  if (entry.source === 'folder') return renderThirdParty(ctx, id, route, failed);

  const mod = starterModule(id);
  if (!mod) return el('p', { class: 'muted', text: `Opening ${label}…` });
  if (mod instanceof Error) return failed(mod);
  try {
    const hub = ctx.hubFor(starter(id).manifest, entry.granted);
    return mod.render(hub, route, notices);
  } catch (err) {
    console.error(err);
    return failed(err);
  }
}

/* -------------------------------------------------------------- routing */

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'home', sub: parts[1] || null, rest: parts.slice(2) };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/* ---------------------------------------------------------------- frame */

const THEME_ORDER = ['system', 'light', 'dark'];
const THEME_LABEL = { system: 'Theme: follows your device', light: 'Theme: light', dark: 'Theme: dark' };
const THEME_GLYPH = { system: '◐', light: '☀︎', dark: '☾︎' };

function applyTheme() {
  if (app.device.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', app.device.theme);
}

function buildHeader() {
  const person = currentPerson();
  const theme = app.device.theme;
  return el('header', { class: 'app-header' }, [
    el('a', { class: 'brand', href: '#/', 'aria-label': 'Family Hub - home' }, [
      el('span', { class: 'brand__mark', html: HOUSE_ICON, 'aria-hidden': 'true' }),
      el('span', { class: 'brand__text' }, [
        el('span', { class: 'brand__name', text: 'Family Hub' }),
        app.household ? el('span', { class: 'brand__home', text: app.household.household.name }) : null,
      ]),
    ]),
    el('div', { class: 'header-actions' }, [
      app.household ? syncChip(ctx) : null,
      app.household ? el('button', {
        class: 'btn who-btn', type: 'button', 'data-field': 'who',
        title: 'Who is using Family Hub? (a convenience, not a login)',
        on: { click: openWho },
      }, [avatar(person), el('span', { class: 'who-btn__name', text: person ? person.name : 'Who are you?' })]) : null,
      el('button', {
        class: 'btn btn-icon', type: 'button', 'data-field': 'theme',
        title: `${THEME_LABEL[theme]}. Click to change.`, 'aria-label': THEME_LABEL[theme],
        on: {
          click: () => {
            setDevice({ theme: THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length] });
            applyTheme();
            render();
          },
        },
      }, [el('span', { class: 'btn__glyph', 'aria-hidden': 'true', text: THEME_GLYPH[theme] })]),
    ]),
  ]);
}

function openWho() {
  const h = app.household;
  const choose = (id) => { setDevice({ currentPersonId: id }); close(); render(); };
  const { close } = modal({
    title: 'Who are you?',
    body: [
      h.people.length
        ? el('div', { class: 'chipset' }, h.people.map((p) => el('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(p.id === app.device.currentPersonId),
          on: { click: () => choose(p.id) },
        }, [p.name, roleOf(p, today()) === 'child' ? ' (child)' : '', p.demo ? ' - example' : ''])))
        : el('p', { text: 'No one has been added yet.' }),
      el('button', { class: 'chip', type: 'button', 'aria-pressed': String(!currentPerson()), text: 'Just looking (no one)', on: { click: () => choose(null) } }),
      el('p', { class: 'small muted', text: 'Choosing a name is a convenience, not a login. It records who did what and keeps your own dashboard order on this device. Anyone using this device can pick any name.' }),
    ],
    foot: [el('a', { class: 'btn btn-quiet', href: '#/people', text: 'People', on: { click: () => close() } })],
  });
}

function routeLabel(route) {
  if (route.name === 'home') return null;
  if (route.name === 'section') return section(route.sub)?.name ?? 'Page';
  return { help: 'How to use', settings: 'Settings', library: 'Mini-apps', people: 'People' }[route.name]
    ?? app.registry.apps[route.name]?.name ?? starter(route.name)?.manifest.name ?? 'Page';
}

function buildCrumbs(route) {
  const label = routeLabel(route);
  if (!label) return null;
  // A mini-app sits inside its section; the section is named when it says something new.
  const m = manifestFor(route.name);
  const s = m ? section(sectionOf(m)) : null;
  return el('nav', { class: 'crumbs', 'aria-label': 'You are here' }, [
    el('a', { href: '#/', text: 'Home' }), ' › ',
    ...(s && s.name !== label ? [el('a', { href: `#/section/${s.id}`, text: s.name }), ' › '] : []),
    // On one of its inner screens (a recipe), the mini-app's name leads back to its first screen.
    m && route.sub && route.sub !== m.screens[0]?.id ? el('a', { href: `#/${route.name}`, text: label }) : el('span', { text: label }),
  ]);
}

/**
 * The way back at the bottom of every page but Home: an inner screen of a
 * mini-app goes to its first screen, a mini-app to its section, anything else Home.
 */
function buildBack(route) {
  if (route.name === 'home' || !app.household) return null;
  const m = manifestFor(route.name);
  const s = m ? section(sectionOf(m)) : null;
  const [href, to] = m && route.sub && route.sub !== m.screens[0]?.id ? [`#/${route.name}`, routeLabel(route)]
    : s && s.name !== routeLabel(route) ? [`#/section/${s.id}`, s.name]
      : ['#/', 'Home'];
  return el('nav', { class: 'page-back no-print', 'aria-label': 'Back' }, [el('a', { class: 'btn', href, text: `‹ Back`, title: `Back to ${to}`, 'data-field': 'page-back' })]);
}

function buildFooter() {
  const where = app.device.storageMode === 'folder'
    ? 'Your family’s data lives in your own Google Drive folder. Nothing goes anywhere else.'
    : 'Everything stays in this browser - nothing is uploaded.';
  return el('footer', { class: 'app-footer' }, [
    el('span', { text: where }),
    el('nav', { 'aria-label': 'About this app' }, [
      el('a', { href: '#/help', text: 'How to use' }),
      el('button', { class: 'linkish', type: 'button', text: 'Privacy', on: { click: () => openDoc('privacy') } }),
      el('button', { class: 'linkish', type: 'button', text: 'About', on: { click: () => openDoc('about') } }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'New here?', 'data-field': 'new-here', on: { click: () => openWelcome(ctx) } }),
      el('span', { class: 'muted', text: `v${APP_VERSION}` }),
    ]),
  ]);
}

/* --------------------------------------------------------------- render */

const ctx = {
  app, store, commit, replaceHousehold, saveRegistry, replaceRegistry, setDevice, act, undo, go, flash, seedDemo, startOwn,
  render: () => render(),
  today,
  currentPerson,
  dashboardModules,
  manifestFor,
  installedManifests,
  folderSupported,
  starterManifests,
};
ctx.sync = createSync(ctx);
ctx.media = createMedia({ getStore: () => ctx.sync.appStore(), getPrefs: () => app.device.music, onChange: () => render() });
ctx.session = createSession(ctx);
ctx.timer = ctx.session;
const createHub = createHubFactory(ctx);
ctx.hubFor = (manifest, granted) => createHub(manifest, granted, { otherManifests: installedManifests });
ctx.collectionFor = createHub.collectionFor;
ctx.invalidateAll = createHub.invalidateAll;
ctx.scanImports = () => scanImportFolder(ctx);

let lastRouteKey = null;
let renderQueued = false;

function render() {
  // Collapse bursts (a sync finishing while a click re-renders) into one frame's work.
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; renderNow(); });
}

function renderNow() {
  const route = parseRoute();
  const routeKey = `${route.name}/${route.sub}/${route.rest.join('/')}`;
  const changed = routeKey !== lastRouteKey;
  // Leaving a screen clears its notices - except one raised just now (a save that then moved on).
  if (changed && lastRouteKey !== null) { app.flash = app.flash.filter((n) => Date.now() - n.at < 1500); app.ui.scrolledTo = null; }
  const snap = captureFocus();
  const scrollY = window.scrollY;

  clear(dom.header).append(buildHeader());
  clear(dom.crumbs);
  const crumbs = buildCrumbs(route);
  if (crumbs) dom.crumbs.append(crumbs);
  clear(dom.footer).append(buildFooter());

  // Two slots: what just happened (with its Undo) is never folded away with
  // the standing notices underneath it.
  const items = [];
  if (app.storageError) items.push({ id: `storage:${app.storageError}`, level: 'error', text: app.storageError });
  // Drive notices that need an answer get their own slot, never folded in with the rest.
  const driveItems = app.household ? syncNotices(ctx) : [];

  let view;
  let sticky = false;
  if (app.loadError) {
    view = recoveryView(ctx);
  } else if (!app.household) {
    view = el('section', { class: 'panel empty' }, [
      el('h1', { text: 'Welcome to Family Hub' }),
      el('p', { text: 'A calm place to share the everyday load of running a home.' }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Get started', on: { click: () => openWelcome(ctx) } }),
    ]);
  } else {
    const core = { home: dashboardView, settings: settingsView, help: helpView, library: libraryView, section: sectionView, people: peopleView }[route.name];
    const entry = app.registry.apps[route.name];
    sticky = !core && entry?.source === 'folder' && entry.enabled && Boolean(cachedPackage(route.name));
    if (core) view = core(ctx, route, items);
    else if (!(sticky && dom.viewStickyId === route.name)) view = appView(route, items);
  }

  // A sandboxed mini-app keeps its frame (and its state) while you stay in it;
  // a change of screen is passed in as a message instead of a reload.
  if (sticky && dom.viewStickyId === route.name && !view) {
    if (changed) postRoute(route.name, route);
  } else {
    clear(dom.viewHost).append(view);
    dom.viewStickyId = sticky ? route.name : null;
  }
  clear(dom.session);
  if (ctx.session.state()) dom.session.append(sessionPanel(ctx));
  clear(dom.back);
  const back = buildBack(route);
  if (back) dom.back.append(back);
  renderNotices(dom.drive, driveItems, render);
  renderNotices(dom.notices, items, render);
  renderNotices(dom.flash, app.flash.slice(0, 1), render);   // newest only

  restoreFocus(snap);
  if (changed) {
    window.scrollTo(0, 0);
    if (lastRouteKey !== null) dom.main.focus?.({ preventScroll: true });
  } else {
    window.scrollTo(0, scrollY);
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }
  lastRouteKey = routeKey;
  const label = routeLabel(route);
  document.title = label ? `${label} - Family Hub` : 'Family Hub';
}

/* ----------------------------------------------------------------- boot */

function init() {
  applyTheme();
  dom.header = el('div', { class: 'slot-header' });
  dom.crumbs = el('div', { class: 'slot-crumbs' });
  dom.flash = el('div', { class: 'notices-host', 'aria-live': 'polite' });
  dom.drive = el('div', { class: 'notices-host' });
  dom.notices = el('div', { class: 'notices-host' });
  dom.viewHost = el('div', { class: 'view-host' });
  dom.session = el('div', { class: 'session-host' });
  dom.back = el('div', { class: 'view-host' });
  dom.main = el('main', { class: 'app-main', id: 'main', tabindex: '-1' }, [dom.flash, dom.drive, dom.notices, dom.session, dom.viewHost, dom.back]);
  dom.footer = el('div', { class: 'slot-footer' });
  document.body.append(el('div', { id: 'app', style: { display: 'contents' } }, [dom.header, dom.crumbs, dom.main, dom.footer]));

  const loaded = store.loadHousehold();
  if (loaded.ok) app.household = loaded.household;
  else app.loadError = { error: loaded.error, previousAvailable: loaded.previousAvailable };

  const storedRegistry = store.loadRegistry();
  app.registry = reconcileStarters(storedRegistry ?? starterRegistry(starterManifests()), starterManifests());
  store.saveRegistry(app.registry);

  window.addEventListener('hashchange', render);
  renderNow();

  // First visit: nothing saved yet. Ask, rather than invent a family.
  if (loaded.ok && !loaded.household && !app.device.onboardedAt) openWelcome(ctx);
  else if (loaded.ok && !loaded.household) commit(emptyHousehold());

  if (loaded.ok) ctx.sync.restore();
}

init();
