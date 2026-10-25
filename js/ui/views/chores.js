// Chores: Do something now (execute) · Rooms · Plan · Progress.

import { el } from '../dom.js';
import { findTasks, momentum, TIME_CHOICES, ENERGY_CHOICES, ORDER_RULES, defaultFilters } from '../../matching.js';
import { occurrences, occurrence } from '../../recurrence.js';
import { hasDemo, roomName } from '../../model.js';
import { householdProgress, activity } from '../../progress.js';
import { fmtDay } from '../../dates.js';
import { choreCard, demoNotice } from '../common.js';
import { planView } from './plan.js';

const TABS = [
  { sub: null, label: 'Do something now', hash: '#/chores' },
  { sub: 'rooms', label: 'Rooms', hash: '#/chores/rooms' },
  { sub: 'plan', label: 'Plan', hash: '#/chores/plan' },
  { sub: 'progress', label: 'Progress', hash: '#/chores/progress' },
];

export function choresView(ctx, route, notices) {
  const h = ctx.app.household;
  if (hasDemo(h)) notices.push(demoNotice(ctx));
  const sub = TABS.some((t) => t.sub === route.sub) ? route.sub : null;
  const body = { rooms: roomsView, plan: planView, progress: progressView }[sub] || executeView;

  return el('section', { class: 'stack', 'aria-labelledby': 'chores-title' }, [
    el('h1', { id: 'chores-title', class: 'sr-only', text: 'Chores' }),
    el('nav', { class: 'tabs', 'aria-label': 'Chores' }, TABS.map((t) => el('a', {
      class: 'tab', href: t.hash, 'aria-current': t.sub === sub ? 'page' : null, 'data-field': `tab:${t.sub ?? 'execute'}`, text: t.label,
    }))),
    body(ctx, notices),
  ]);
}

/* ------------------------------------------------------------- execute */

function chipRow(legend, options, value, onPick, field) {
  return el('fieldset', {}, [
    el('legend', { text: legend }),
    el('div', { class: 'chipset' }, options.map((o) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(o.value === value), 'data-field': `${field}:${o.value}`, text: o.label,
      on: { click: () => onPick(o.value === value && o.value !== null ? null : o.value) },
    }))),
  ]);
}

function executeView(ctx) {
  const h = ctx.app.household;
  const ex = ctx.app.execute;
  const person = ctx.currentPerson();
  const f = { ...ex.filters, personId: person?.id ?? null };
  const setF = (patch) => { ex.filters = { ...ex.filters, ...patch }; ex.showAll = false; ctx.render(); };

  if (!h.chores.length) {
    return el('div', { class: 'panel empty' }, [
      el('h2', { text: 'No chores planned yet' }),
      el('p', { text: 'Chores are the regular jobs that keep a home going. Add a few, and this screen will suggest one that fits your time and energy.' }),
      el('div', { class: 'row', style: { justifyContent: 'center' } }, [
        el('a', { class: 'btn btn-primary', href: '#/chores/plan', text: 'Plan your first chore' }),
        el('button', { class: 'btn', type: 'button', text: 'Try the example family', on: { click: () => { ctx.seedDemo(); ctx.render(); } } }),
      ]),
    ]);
  }

  if (ex.phase === 'finished') {
    return el('div', { class: 'done-panel stack' }, [
      el('h2', { text: 'All done for now' }),
      el('p', { text: 'Thank you. Stopping here is a perfectly good finish.' }),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn btn-primary', href: '#/', text: 'Back to home', on: { click: () => { ex.phase = 'choose'; } } }),
        el('button', { class: 'btn', type: 'button', text: 'Actually, one more', on: { click: () => { ex.phase = 'choose'; ctx.render(); } } }),
      ]),
    ]);
  }

  const onDone = (event) => {
    if (!event) return;
    // The panel below carries its own Undo, so the top notice would only repeat it.
    ctx.app.flash = ctx.app.flash.filter((n) => n.id !== `act:${event.id}`);
    ex.phase = 'after';
    ex.justDone = { eventId: event.id, choreId: event.choreId };
    ctx.render();
  };

  if (ex.phase === 'after' && ex.justDone) {
    const picks = momentum(h, f, ctx.today(), ex.justDone.choreId);
    const doneChore = h.chores.find((c) => c.id === ex.justDone.choreId);
    return el('div', { class: 'stack' }, [
      el('div', { class: 'done-panel stack', role: 'status' }, [
        el('h2', { text: 'That’s one thing taken care of.' }),
        el('p', { text: `${doneChore?.name ?? 'It'} is recorded${person ? ` for ${person.name}` : ''}. Want to do anything else? No pressure either way.` }),
        el('div', { class: 'row' }, [
          el('button', { class: 'btn btn-primary', type: 'button', text: 'Finish for now', 'data-field': 'finish', on: { click: () => { ex.phase = 'finished'; ex.justDone = null; ctx.render(); } } }),
          el('button', { class: 'btn', type: 'button', text: 'Choose something else', 'data-field': 'choose-else', on: { click: () => { ex.phase = 'choose'; ex.justDone = null; ctx.render(); } } }),
          el('button', { class: 'btn btn-quiet', type: 'button', text: 'Undo', on: { click: () => ctx.undo(ex.justDone.eventId) } }),
        ]),
      ]),
      picks.length ? el('h2', { text: 'If you want to keep going' }) : el('p', { class: 'muted', text: 'Nothing else fits your choices right now - a good moment to stop.' }),
      el('div', { class: 'cards' }, picks.map((t) => choreCard(ctx, t.chore, t.occ, { label: t.label, reasons: t.reasons, onDone }))),
    ]);
  }

  const results = findTasks(h, f, ctx.today());
  const shown = ex.showAll ? results : results.slice(0, 5);
  const rooms = h.rooms;

  return el('div', { class: 'stack' }, [
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What can you do right now?' }),
      el('p', { class: 'small muted', text: 'Everything is optional. Say what you can, and the list below follows.' }),
      chipRow('Time', TIME_CHOICES, f.minutes, (v) => setF({ minutes: v }), 'time'),
      chipRow('Energy', ENERGY_CHOICES, f.energy, (v) => setF({ energy: v }), 'energy'),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'where', text: 'Where' }),
        el('select', {
          class: 'select', id: 'where', 'data-field': 'where', style: { maxWidth: '320px' },
          on: { change: (e) => setF({ roomId: e.target.value }) },
        }, [
          el('option', { value: 'any', text: 'Anywhere - I don’t mind', selected: f.roomId === 'any' }),
          ...rooms.map((r) => el('option', { value: r.id, text: r.name, selected: f.roomId === r.id })),
        ]),
      ]),
      f.roomId === 'any' && rooms.length ? el('fieldset', {}, [
        el('legend', { text: 'Not today' }),
        el('div', { class: 'chipset' }, rooms.map((r) => {
          const on = f.avoidRooms.includes(r.id);
          return el('button', {
            class: 'chip', type: 'button', 'aria-pressed': String(on), 'data-field': `avoid:${r.id}`, text: r.name,
            on: { click: () => setF({ avoidRooms: on ? f.avoidRooms.filter((x) => x !== r.id) : [...f.avoidRooms, r.id] }) },
          });
        })),
      ]) : null,
      el('p', { class: 'small muted' }, [
        person ? `Showing chores ${person.name} can do. ` : 'Showing everyone’s chores. ',
        el('button', { class: 'linkish', type: 'button', text: person ? 'Not you?' : 'Say who you are', on: { click: () => document.querySelector('[data-field="who"]')?.click() } }),
      ]),
    ]),

    el('h2', { text: results.length ? 'Suggestions' : 'Nothing fits those choices right now' }),
    results.length
      ? el('div', { class: 'cards' }, shown.map((t) => choreCard(ctx, t.chore, t.occ, { reasons: t.reasons, onDone })))
      : el('div', { class: 'panel empty' }, [
        el('p', { text: 'That is fine - it may simply be a good moment to rest. Or widen the search:' }),
        el('div', { class: 'row', style: { justifyContent: 'center' } }, [
          f.minutes != null ? el('button', { class: 'btn', type: 'button', text: 'Allow longer chores', on: { click: () => setF({ minutes: null }) } }) : null,
          f.energy ? el('button', { class: 'btn', type: 'button', text: 'Any energy level', on: { click: () => setF({ energy: null }) } }) : null,
          el('button', { class: 'btn', type: 'button', text: 'Include chores not due yet', on: { click: () => setF({ includeNotDue: true }) } }),
          el('button', { class: 'btn btn-quiet', type: 'button', text: 'Clear all choices', on: { click: () => setF({ ...defaultFilters() }) } }),
        ]),
      ]),
    results.length > shown.length
      ? el('button', { class: 'btn', type: 'button', text: `Show ${results.length - shown.length} more`, on: { click: () => { ex.showAll = true; ctx.render(); } } })
      : null,
    whyPanel(f, h, results.length),
  ]);
}

/** "How this works": the filters in force and the order, in words. */
function whyPanel(f, h, count) {
  const time = f.minutes == null ? 'no time limit' : `${f.minutes} minutes or less${f.allowOverrun ? ' (longer allowed)' : ''}`;
  const energy = f.energy == null ? 'any effort' : { low: 'low effort only', medium: 'low or some effort', high: 'any effort, big jobs included' }[f.energy];
  const where = f.roomId === 'any'
    ? `anywhere${f.avoidRooms.length ? `, except ${f.avoidRooms.map((id) => roomName(h, id)).join(', ')}` : ''}`
    : `only ${roomName(h, f.roomId)}`;
  return el('details', { class: 'explain panel panel--soft' }, [
    el('summary', { text: 'Why these suggestions?' }),
    el('p', { text: `Right now: ${time}, ${energy}, ${where}. ${count} chore${count === 1 ? '' : 's'} fit.` }),
    el('p', { text: 'A chore is left out if it takes longer than your time, needs more effort than you have, is in another room, is not yours to do, is waiting on another chore, or is not due yet. Optional improvements are always offered, last.' }),
    el('p', { text: 'What is left is ordered by these rules, in turn:' }),
    el('ol', { class: 'howto-steps' }, ORDER_RULES.map((r) => el('li', { text: r }))),
    el('p', { class: 'small muted', text: 'Times and effort are the family’s own rough estimates. A chore with no time set is still shown, labelled "Time not estimated".' }),
  ]);
}

/* --------------------------------------------------------------- rooms */

function roomsView(ctx) {
  const h = ctx.app.household;
  const today = ctx.today();
  const occ = occurrences(h, today);
  const groups = [...h.rooms.map((r) => ({ id: r.id, name: r.name })), { id: null, name: 'No particular room' }]
    .map((g) => ({ ...g, chores: h.chores.filter((c) => c.roomId === g.id && occ.get(c.id).state !== 'closed') }))
    .filter((g) => g.chores.length);

  if (!groups.length) {
    return el('div', { class: 'panel empty' }, [
      el('p', { text: 'No rooms or chores yet.' }),
      el('a', { class: 'btn btn-primary', href: '#/chores/plan', text: 'Plan a chore' }),
    ]);
  }

  return el('div', { class: 'stack' }, [
    el('p', { class: 'muted', text: 'Each chore is its own item - marking one done never ticks off the rest of the room.' }),
    ...groups.map((g) => {
      const ready = g.chores.filter((c) => occ.get(c.id).state === 'ready').length;
      return el('details', { class: 'panel', open: ctx.app.ui[`room:${g.id}`] ?? true, on: { toggle: (e) => { ctx.app.ui[`room:${g.id}`] = e.currentTarget.open; } } }, [
        el('summary', { class: 'row', style: { cursor: 'pointer', minHeight: 'var(--tap)' } }, [
          el('strong', { text: g.name }),
          el('span', { class: 'badge', text: ready ? `${ready} ready` : 'all looked after' }),
        ]),
        el('div', { class: 'cards', style: { marginTop: 'var(--space-3)' } }, g.chores
          .slice().sort((a, b) => (occ.get(a.id).state === 'ready' ? 0 : 1) - (occ.get(b.id).state === 'ready' ? 0 : 1))
          .map((c) => choreCard(ctx, c, occ.get(c.id), { showRoom: false }))),
      ]);
    }),
  ]);
}

/* ------------------------------------------------------------ progress */

function progressView(ctx) {
  const h = ctx.app.household;
  const today = ctx.today();
  const p = householdProgress(h, today);
  const log = activity(h, 25);

  return el('div', { class: 'stack' }, [
    el('p', { class: 'muted', text: 'What the household has looked after - together. No scores, no rankings, no one compared with anyone.' }),
    el('div', { class: 'stats' }, [
      stat(p.doneCount, `taken care of in the last ${p.days} days`),
      stat(p.readyCount, 'ready now'),
      stat(p.comingUpCount, `coming up in the next ${p.days} days`),
    ]),
    p.stillWaiting.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Still waiting' }),
      el('p', { class: 'small muted', text: 'Important or one-off jobs stay here until they are done, moved, or no longer needed. Routine chores just come round again.' }),
      el('ul', { class: 'list' }, p.stillWaiting.map((c) => el('li', {}, [
        el('span', { class: 'list__main', text: c.name }),
        el('span', { class: 'small muted', text: `ready since ${fmtDay(occurrence(c, h.events, today).dueDay, today)}` }),
      ]))),
    ]) : null,
    p.review.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Worth a conversation' }),
      el('p', { class: 'small muted', text: 'These keep not fitting in. That is information about the plan, not about anyone. The Plan tab has a review for each.' }),
      el('ul', { class: 'list' }, p.review.map((c) => el('li', {}, [el('span', { class: 'list__main', text: c.name }), el('a', { href: '#/chores/plan', text: 'Review' })]))),
    ]) : null,
    p.rooms.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'By room' }),
      el('table', { class: 'plain' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: 'Room' }), el('th', { text: 'Done this week' }), el('th', { text: 'Ready now' })])]),
        el('tbody', {}, p.rooms.map((r) => el('tr', {}, [el('td', { text: r.name }), el('td', { text: String(r.done) }), el('td', { text: String(r.ready) })]))),
      ]),
    ]) : null,
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Recent activity' }),
      log.length
        ? el('ul', { class: 'list' }, log.map((a) => el('li', {}, [
          el('span', { class: 'list__main' }, [el('strong', { text: a.what }), el('span', { class: 'small muted', text: a.room ? ` · ${a.room}` : '' })]),
          el('span', { class: 'small', text: `${a.action}${a.until ? ` to ${fmtDay(a.until, today)}` : ''} · ${a.who} · ${fmtDay(a.day, today)}` }),
        ])))
        : el('p', { class: 'muted', text: 'Nothing recorded yet. When a chore is done it appears here.' }),
    ]),
  ]);
}

const stat = (value, label) => el('div', { class: 'stat' }, [el('div', { class: 'stat__value', text: String(value) }), el('div', { class: 'stat__label', text: label })]);
