// Boot, app state, routing and the frame. Views live in js/ui/views/.
//
// The household is only ever changed through `commit(next)`, which saves it
// through the storage boundary and re-renders. Nothing here touches
// localStorage directly.

import { createLocalStore } from './storage.js';
import { emptyHousehold, recordEvent, removeEvent, addPerson, normaliseHousehold } from './model.js';
import { toDay, fmtDay } from './dates.js';
import { occurrence } from './recurrence.js';
import { defaultFilters } from './matching.js';
import { demoHousehold } from './demo.js';
import { el, clear } from './ui/dom.js';
import { renderNotices, captureFocus, restoreFocus } from './ui/patterns.js';
import { avatar, modal, HOUSE_ICON } from './ui/common.js';
import { dashboardView } from './ui/views/dashboard.js';
import { choresView } from './ui/views/chores.js';
import { settingsView } from './ui/views/settings.js';
import { helpView } from './ui/views/help.js';
import { placeholderView } from './ui/views/placeholder.js';
import { recoveryView } from './ui/views/recovery.js';
import { openWelcome } from './ui/views/welcome.js';
import { openDoc } from './ui/views/docs.js';
import { MODULES } from './dashboard.js';

export const APP_VERSION = '0.1.0';

const store = createLocalStore(window.localStorage);

/** Everything the views read. Views never write to it directly - they call ctx methods. */
const app = {
  household: null,
  loadError: null,          // { error, previousAvailable } when the saved data is unreadable
  device: store.loadDevice(),
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
  if (!quiet) render();
}

function setDevice(patch) {
  app.device = { ...app.device, ...patch };
  const result = store.saveDevice(app.device);
  if (!result.ok) app.storageError = result.error;
}

function flash(notice) {
  app.flash = [notice, ...app.flash.filter((n) => n.id !== notice.id)].slice(0, 3);
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

/* -------------------------------------------------------------- routing */

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] || 'home', sub: parts[1] || null, rest: parts.slice(2) };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

let lastRouteKey = null;

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
        }, [p.name, p.role === 'child' ? ' (child)' : '', p.demo ? ' - example' : ''])))
        : el('p', { text: 'No one has been added yet.' }),
      el('button', { class: 'chip', type: 'button', 'aria-pressed': String(!currentPerson()), text: 'Just looking (no one)', on: { click: () => choose(null) } }),
      el('p', { class: 'small muted', text: 'Choosing a name is a convenience, not a login. It records who did what and keeps your own dashboard order on this device. Anyone using this device can pick any name.' }),
    ],
    foot: [el('a', { class: 'btn btn-quiet', href: '#/settings', text: 'Add or edit people', on: { click: () => close() } })],
  });
}

function buildCrumbs(route) {
  if (route.name === 'home') return null;
  const mod = MODULES.find((m) => m.id === route.name);
  const label = mod?.name ?? { help: 'How to use' }[route.name] ?? 'Page';
  return el('nav', { class: 'crumbs', 'aria-label': 'You are here' }, [
    el('a', { href: '#/', text: 'Home' }), ' › ', el('span', { text: label }),
  ]);
}

function buildFooter() {
  return el('footer', { class: 'app-footer' }, [
    el('span', { text: 'Everything stays in this browser - nothing is uploaded.' }),
    el('nav', { 'aria-label': 'About this app' }, [
      el('a', { href: '#/help', text: 'How to use' }),
      el('button', { class: 'linkish', type: 'button', text: 'Privacy & your data', on: { click: () => openDoc('privacy') } }),
      el('button', { class: 'linkish', type: 'button', text: 'About', on: { click: () => openDoc('about') } }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'I am new here', 'data-field': 'new-here', on: { click: () => openWelcome(ctx) } }),
      el('span', { class: 'muted', text: `v${APP_VERSION}` }),
    ]),
  ]);
}

/* --------------------------------------------------------------- render */

const ctx = {
  app, store, commit, setDevice, act, undo, go, flash, seedDemo, startOwn,
  render: () => render(),
  today,
  currentPerson,
};

function render() {
  const route = parseRoute();
  const routeKey = `${route.name}/${route.sub}`;
  const changed = routeKey !== lastRouteKey;
  if (changed && lastRouteKey !== null) { app.flash = []; app.ui.scrolledTo = null; }
  const snap = captureFocus();
  const scrollY = window.scrollY;

  clear(dom.root);
  dom.root.append(buildHeader());
  const crumbs = buildCrumbs(route);
  if (crumbs) dom.root.append(crumbs);
  const main = el('main', { class: 'app-main', id: 'main', tabindex: '-1' });
  dom.root.append(main, buildFooter());

  // Two slots: what just happened (with its Undo) is never folded away with
  // the standing notices underneath it.
  const flashHost = el('div', { class: 'notices-host', 'aria-live': 'polite' });
  const notices = el('div', { class: 'notices-host' });
  main.append(flashHost, notices);
  const items = [];
  if (app.storageError) items.push({ id: `storage:${app.storageError}`, level: 'error', text: app.storageError });

  if (app.loadError) {
    main.append(recoveryView(ctx));
  } else if (!app.household) {
    main.append(el('section', { class: 'panel empty' }, [
      el('h1', { text: 'Welcome to Family Hub' }),
      el('p', { text: 'A calm place to share the everyday load of running a home.' }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Get started', on: { click: () => openWelcome(ctx) } }),
    ]));
  } else {
    const view = {
      home: dashboardView, chores: choresView, settings: settingsView, help: helpView,
    }[route.name] || placeholderView;
    main.append(view(ctx, route, items));
  }
  renderNotices(notices, items, render);
  renderNotices(flashHost, app.flash.slice(0, 1), render);   // newest only

  restoreFocus(snap);
  if (changed) {
    window.scrollTo(0, 0);
    if (lastRouteKey !== null) main.focus?.({ preventScroll: true });
  } else {
    window.scrollTo(0, scrollY);
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }
  lastRouteKey = routeKey;
  document.title = route.name === 'home' ? 'Family Hub' : `${buildCrumbs(route)?.lastChild.textContent ?? ''} - Family Hub`;
}

/* ----------------------------------------------------------------- boot */

function init() {
  applyTheme();
  dom.root = el('div', { id: 'app', style: { display: 'contents' } });
  document.body.append(dom.root);

  const loaded = store.loadHousehold();
  if (loaded.ok) app.household = loaded.household;
  else app.loadError = { error: loaded.error, previousAvailable: loaded.previousAvailable };

  window.addEventListener('hashchange', render);
  render();

  // First visit: nothing saved yet. Ask, rather than invent a family.
  if (loaded.ok && !loaded.household && !app.device.onboardedAt) openWelcome(ctx);
  else if (loaded.ok && !loaded.household) commit(emptyHousehold());
}

init();
