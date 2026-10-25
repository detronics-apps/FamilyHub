// Tickets: capture in seconds, discuss at the family meeting, then decide,
// act, defer or close - with the outcome linked. Screens: capture (default),
// all, meeting, item.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, saveRecord, nameOf, recordForm } from '../kit.js';
import { normaliseTicket, ticketSummary, ticketText, agenda, setStatus, TYPES, STATUS_LABEL, isPositive } from './logic.js';

const ui = { type: 'appreciation', filter: 'open' };

const col = (hub) => hub.data.collection('tickets', { summary: ticketSummary, text: ticketText, prefix: 'tkt' });
const all = (hub) => hub.use('all', async () => (await col(hub).list({ limit: 100000 })).items);

export function render(hub, route) {
  const screen = route.sub ?? 'capture';
  if (screen === 'item') return itemScreen(hub, route.rest[0]);
  if (screen === 'edit') return editScreen(hub, route.rest[0]);
  if (screen === 'meeting') return meetingScreen(hub);
  if (screen === 'all') return allScreen(hub);
  return captureScreen(hub);
}

const nav = (hub, current) => tabs(hub, [
  { screen: null, label: 'Log a ticket' }, { screen: 'all', label: 'All tickets' }, { screen: 'meeting', label: 'Family meeting' },
], current);

function captureScreen(hub) {
  const text = el('textarea', { class: 'input', id: 'ticket-text', rows: 4, 'data-field': 'ticket-text', placeholder: TYPES[ui.type].hint });
  const save = async () => {
    if (!text.value.trim()) { text.focus(); return; }
    await saveRecord(hub, col(hub), normaliseTicket({ type: ui.type, text: text.value, createdBy: hub.people.current()?.id ?? null }));
    hub.ui.notice('Saved. It will keep until you are ready to look at it.');
  };
  const list = all(hub);
  const recent = list.data ? list.data.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5) : [];

  return el('section', { class: 'stack', 'aria-label': 'Tickets' }, [
    nav(hub, null),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What do you want to remember?' }),
      el('div', { class: 'chipset', role: 'group', 'aria-label': 'Kind of ticket' }, Object.entries(TYPES).map(([k, t]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(ui.type === k), 'data-field': `ticket-type:${k}`, text: t.label, title: t.hint,
        on: { click: () => { ui.type = k; hub.render(); } },
      }))),
      el('label', { class: 'sr-only', for: 'ticket-text', text: 'The ticket' }),
      text,
      el('p', { class: 'small muted', text: 'No need to solve it, blame anyone or decide anything now. Tickets are shared with the household; private tickets need real accounts, which come later.' }),
      el('div', { class: 'row row--end' }, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'ticket-save', on: { click: save } })]),
    ]),
    recent.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Recently logged' }),
      el('ul', { class: 'list' }, recent.map((s) => ticketRow(hub, s))),
    ]) : null,
  ]);
}

function ticketRow(hub, s) {
  const people = hub.people.list();
  return el('li', {}, [
    el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
      el('strong', { text: s.title }),
      el('div', { class: 'small muted', text: [TYPES[s.type].label, STATUS_LABEL[s.status], s.createdBy ? `from ${nameOf(people, s.createdBy)}` : null, s.updatedAt ? fmtDay(s.updatedAt.slice(0, 10), hub.today()) : null].filter(Boolean).join(' · ') }),
    ]),
  ]);
}

function allScreen(hub) {
  const list = all(hub);
  const filters = { open: 'Open', discuss: 'For the meeting', deferred: 'Later', closed: 'Closed' };
  let body;
  if (list.loading) body = loading();
  else if (list.error) body = failure(list.error);
  else {
    const items = list.data.filter((s) => (ui.filter === 'open' ? s.status !== 'closed' : s.status === ui.filter))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    body = items.length ? el('ul', { class: 'list panel' }, items.map((s) => ticketRow(hub, s))) : el('div', { class: 'panel empty' }, [el('p', { text: 'Nothing here.' })]);
  }
  return el('section', { class: 'stack' }, [
    nav(hub, 'all'),
    el('div', { class: 'chipset' }, Object.entries(filters).map(([k, label]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(ui.filter === k), text: label, on: { click: () => { ui.filter = k; hub.render(); } },
    }))),
    body,
  ]);
}

function meetingScreen(hub) {
  const list = all(hub);
  if (list.loading) return el('section', { class: 'stack' }, [nav(hub, 'meeting'), loading()]);
  if (list.error) return el('section', { class: 'stack' }, [nav(hub, 'meeting'), failure(list.error)]);
  const a = agenda(list.data);
  const step = (n, title, help, items, empty, actions) => el('div', { class: 'panel stack' }, [
    el('h2', { text: `${n}. ${title}` }),
    el('p', { class: 'small muted', text: help }),
    items.length ? el('ul', { class: 'list' }, items.map((s) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [el('strong', { text: s.title }), el('div', { class: 'small muted', text: TYPES[s.type].label })]),
      ...actions(s),
    ]))) : el('p', { class: 'small muted', text: empty }),
  ]);
  const quick = (s, status, label, opts) => el('button', {
    class: 'btn btn-small', type: 'button', text: label,
    on: { click: async () => { const t = await col(hub).get(s.id); if (t) await saveRecord(hub, col(hub), setStatus(normaliseTicket(t), status, opts)); } },
  });

  return el('section', { class: 'stack', 'aria-label': 'Family meeting' }, [
    nav(hub, 'meeting'),
    el('p', { class: 'muted', text: 'A short weekly check-in. Start with what went well. Then talk through what was chosen: understand each person’s view, look at alternatives, and agree an experiment, an action, or no change.' }),
    step(1, 'What went well', 'Read these out. A thank-you lands better spoken.', a.appreciations, 'No appreciations logged this week - maybe say one out loud?',
      (s) => [quick(s, 'closed', 'Shared', { reason: 'Shared at the family meeting', outcome: 'none' })]),
    step(2, 'Choose what to talk about', 'Pick the ones worth discussing this time. The rest can wait - nothing is lost.', a.waiting, 'Nothing new waiting.',
      (s) => [quick(s, 'discuss', 'Discuss now'), quick(s, 'deferred', 'Later')]),
    step(3, 'Talk it through', 'For each: what happened, how each person sees it, what could help. Then decide, plan an action, defer, or close it.', a.toDiscuss, 'Nothing chosen yet.',
      (s) => [el('a', { class: 'btn btn-small btn-primary', href: hub.href('item', s.id), text: 'Open' })]),
    a.later.length ? step(4, 'Waiting for later', 'Deferred on purpose. Bring one back when the time is right.', a.later, '',
      (s) => [quick(s, 'discuss', 'Bring back')]) : null,
  ]);
}

function itemScreen(hub, id) {
  const r = hub.use(`item:${id}`, () => col(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This ticket no longer exists.' }), el('a', { class: 'btn', href: hub.href('all'), text: 'All tickets' })]);
  const t = normaliseTicket(r.data);
  const people = hub.people.list();
  const save = (next, message) => saveRecord(hub, col(hub), next).then(() => message && hub.ui.notice(message));

  // What this ticket became, read from the other apps (read-only).
  const tasks = hub.data.installed('tasks') ? hub.use(`linked-tasks:${id}`, () => hub.data.of('tasks', 'tasks').list({ filter: (s) => s.source === `tickets:${id}`, limit: 20 })) : null;
  const decisions = hub.data.installed('decisions') ? hub.use(`linked-dec:${id}`, () => hub.data.of('decisions', 'decisions').list({ filter: (s) => s.source === `tickets:${id}`, limit: 20 })) : null;
  const linked = [
    ...(tasks?.data?.items ?? []).map((x) => ({ app: 'tasks', label: `Task: ${x.title}`, id: x.id })),
    ...(decisions?.data?.items ?? []).map((x) => ({ app: 'decisions', label: `Decision: ${x.title}`, id: x.id })),
  ];
  const reason = el('input', { class: 'input', placeholder: 'Why it is being closed (optional)', 'aria-label': 'Reason for closing' });

  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('all'), class: 'small', text: '‹ All tickets' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: `${TYPES[t.type].label} · ${STATUS_LABEL[t.status]}` }),
      el('p', { text: t.text, style: { whiteSpace: 'pre-wrap', fontSize: '17px' } }),
      el('p', { class: 'small muted', text: [t.createdBy ? `From ${nameOf(people, t.createdBy)}` : null, t.createdAt ? `logged ${fmtDay(t.createdAt.slice(0, 10), hub.today())}` : null, t.about.length ? `about ${t.about.map((x) => nameOf(people, x)).join(', ')}` : null].filter(Boolean).join(' · ') }),
      t.notes ? el('p', { class: 'small', text: `Notes: ${t.notes}` }) : null,
      t.status === 'closed' ? el('p', { class: 'small', text: `Closed${t.closedReason ? `: ${t.closedReason}` : ''}.` }) : null,
      el('div', { class: 'row' }, [el('a', { class: 'btn btn-small', href: hub.href('edit', t.id), text: 'Clarify or add notes' })]),
    ]),
    linked.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'What came of it' }),
      el('ul', { class: 'list' }, linked.map((l) => el('li', {}, [el('a', { href: `#/${l.app}/item/${encodeURIComponent(l.id)}`, text: l.label })]))),
    ]) : null,
    t.status !== 'closed' ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What next?' }),
      el('div', { class: 'row' }, [
        t.status !== 'discuss' && !isPositive(t) ? el('button', { class: 'btn', type: 'button', text: 'Add to the family meeting', on: { click: () => save(setStatus(t, 'discuss'), 'Added to the next family meeting.') } }) : null,
        hub.data.installed('decisions') ? el('a', { class: 'btn', href: `#/decisions/new/${encodeURIComponent(`tickets:${t.id}`)}`, text: 'Make a decision or experiment' }) : null,
        hub.data.installed('tasks') ? el('a', { class: 'btn', href: `#/tasks/new/${encodeURIComponent(`tickets:${t.id}`)}`, text: 'Turn into a task' }) : null,
        t.status !== 'deferred' ? el('button', { class: 'btn', type: 'button', text: 'Later', on: { click: () => save(setStatus(t, 'deferred'), 'Saved for later.') } }) : null,
      ]),
      el('div', { class: 'row' }, [
        el('div', { style: { flex: '1 1 240px' } }, [reason]),
        el('button', { class: 'btn', type: 'button', text: linked.length ? 'Close - it is being handled' : 'Close with no action', on: { click: () => save(setStatus(t, 'closed', { reason: reason.value, outcome: linked.length ? (linked[0].app === 'tasks' ? 'task' : 'decision') : 'none' }), 'Ticket closed.') } }),
      ]),
    ]) : el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'button', text: 'Reopen', on: { click: () => save(setStatus(t, 'captured'), 'Reopened.') } })]),
    el('button', {
      class: 'btn btn-danger', type: 'button', text: 'Delete this ticket',
      on: {
        click: async () => {
          if (!await confirmAction({ title: 'Delete this ticket?', text: 'Closing it keeps it in the history instead. Deleting cannot be undone.', confirmLabel: 'Delete', danger: true })) return;
          await col(hub).remove(t.id);
          hub.invalidate();
          hub.go('all');
        },
      },
    }),
  ]);
}

function editScreen(hub, id) {
  const r = hub.use(`item:${id}`, () => col(hub).get(id));
  if (r.loading) return loading();
  if (r.error || !r.data) return failure(r.error ?? 'This ticket no longer exists.');
  const t = normaliseTicket(r.data);
  return el('section', { class: 'stack' }, [
    el('h1', { text: 'Clarify a ticket' }),
    recordForm({
      record: t,
      people: hub.people.list(),
      fields: [
        { key: 'text', label: 'The ticket', type: 'textarea', rows: 4, required: true },
        { key: 'type', label: 'Kind', type: 'select', options: Object.entries(TYPES).map(([k, x]) => [k, x.label]) },
        { key: 'notes', label: 'Notes - what you learned, each person’s view', type: 'textarea', rows: 4 },
        { key: 'about', label: 'Who it involves (optional)', type: 'people', more: true },
      ],
      onCancel: () => hub.go('item', t.id),
      onSave: async (values) => {
        const saved = await saveRecord(hub, col(hub), normaliseTicket({ ...t, ...values }));
        if (saved) hub.go('item', saved.id);
      },
    }),
  ]);
}
