// Health: appointments and healthy routines - not medical records.
// Screens: appointments (default), routines, item, new, edit.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import { normaliseAppointment, appointmentSummary, agenda, byWhen, APPOINTMENT_STATUS, normaliseRoutine, routineSummary } from './logic.js';

const appts = (hub) => hub.data.collection('appointments', { summary: appointmentSummary, text: (a) => `${a.title} ${a.with} ${a.where}`, prefix: 'apt' });
const routines = (hub) => hub.data.collection('routines', { summary: routineSummary, text: (r) => `${r.title} ${r.how}`, prefix: 'rtn' });

export function render(hub, route) {
  if (route.sub === 'item') return apptScreen(hub, route.rest[0]);
  if (route.sub === 'new') return apptEdit(hub, null);
  if (route.sub === 'edit') return apptEdit(hub, route.rest[0]);
  if (route.sub === 'routines') return routinesScreen(hub);
  return listScreen(hub);
}

const nav = (hub, current) => tabs(hub, [{ screen: null, label: 'Appointments' }, { screen: 'routines', label: 'Healthy habits' }], current);
const privacy = () => el('p', { class: 'small muted', text: 'Shared with everyone using Family Hub. Keep medical details (diagnoses, medicines, results) out of here until private records exist.' });

function listScreen(hub) {
  const r = hub.use('appts', async () => (await appts(hub).list({ limit: 2000 })).items);
  if (r.loading) return el('section', { class: 'stack' }, [nav(hub, null), loading()]);
  if (r.error) return el('section', { class: 'stack' }, [nav(hub, null), failure(r.error)]);
  const today = hub.today();
  const people = hub.people.list();
  const a = agenda(r.data, today);
  const row = (s) => el('li', {}, [el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
    el('strong', { text: s.title }),
    el('div', { class: 'small muted', text: [s.day ? fmtDay(s.day, today) : 'no date', s.time || null, s.who ? nameOf(people, s.who) : null].filter(Boolean).join(' · ') }),
  ])]);
  const past = r.data.filter((s) => s.status !== 'upcoming').sort(byWhen).reverse();

  return el('section', { class: 'stack', 'aria-label': 'Health' }, [
    nav(hub, null),
    el('div', { class: 'row' }, [el('span', { style: { flex: '1 1 auto' } }), el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add an appointment', 'data-field': 'add-appt' })]),
    a.followUps.length ? el('div', { class: 'banner banner--info' }, [el('span', { class: 'banner__text', text: `Time to book a follow-up: ${a.followUps.map((s) => s.title).join(', ')}.` })]) : null,
    el('div', { class: 'panel' }, [el('h2', { text: 'Coming up' }), a.upcoming.length ? el('ul', { class: 'list' }, a.upcoming.map(row)) : el('p', { class: 'small muted', text: 'Nothing booked.' })]),
    a.passed.length ? el('div', { class: 'panel' }, [el('h2', { text: 'Has it happened?' }), el('p', { class: 'small muted', text: 'These dates have passed - mark them done or cancelled when you can.' }), el('ul', { class: 'list' }, a.passed.map(row))]) : null,
    past.length ? el('details', { class: 'panel more' }, [el('summary', { text: `Past (${past.length})` }), el('ul', { class: 'list' }, past.map(row))]) : null,
    privacy(),
  ]);
}

function apptScreen(hub, id) {
  const r = hub.use(`appt:${id}`, () => appts(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This appointment no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'Appointments' })]);
  const a = normaliseAppointment(r.data);
  const today = hub.today();
  const save = (patch, msg) => saveRecord(hub, appts(hub), { ...a, ...patch }).then(() => hub.ui.notice(msg));
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Appointments' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: APPOINTMENT_STATUS[a.status] }),
      el('h1', { text: a.title, style: { margin: 0 } }),
      el('p', { text: [a.day ? fmtDay(a.day, today) : 'no date', a.time || null, a.who ? `for ${nameOf(hub.people.list(), a.who)}` : null].filter(Boolean).join(' · ') }),
      a.with ? el('p', { class: 'small', text: `With: ${a.with}` }) : null,
      a.where ? el('p', { class: 'small', text: `Where: ${a.where}` }) : null,
      a.bring ? el('p', { class: 'small', text: `Bring: ${a.bring}` }) : null,
      a.notes ? el('p', { text: a.notes, style: { whiteSpace: 'pre-wrap' } }) : null,
      a.followUp ? el('p', { class: 'small', text: `Follow-up around ${fmtDay(a.followUp, today)}.` }) : null,
    ]),
    el('div', { class: 'row' }, [
      a.status === 'upcoming' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Mark done', on: { click: () => save({ status: 'done' }, 'Marked done.') } }) : null,
      a.status === 'upcoming' ? el('button', { class: 'btn', type: 'button', text: 'Cancelled', on: { click: () => save({ status: 'cancelled' }, 'Marked cancelled.') } }) : null,
      a.status !== 'upcoming' ? el('button', { class: 'btn', type: 'button', text: 'Back to coming up', on: { click: () => save({ status: 'upcoming' }, 'Moved back.') } }) : null,
      el('a', { class: 'btn', href: hub.href('edit', a.id), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Delete', on: { click: async () => { if (!await confirmAction({ title: `Delete ${a.title}?`, text: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) return; await appts(hub).remove(a.id); hub.invalidate(); hub.go(null); } } }),
    ]),
  ]);
}

function apptEdit(hub, id) {
  const r = id ? hub.use(`appt:${id}`, () => appts(hub).get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseAppointment(r.data) : null;
  const a = existing ?? normaliseAppointment({ title: '', who: hub.people.current()?.id ?? null });
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add an appointment' }),
    recordForm({
      record: { ...a, title: existing ? a.title : '' },
      fields: [
        { key: 'title', label: 'What', required: true, placeholder: 'e.g. Dentist check-up' },
        { key: 'who', label: 'For whom', type: 'select', options: [['', 'Not set'], ...hub.people.list().map((p) => [p.id, p.name])] },
        { key: 'day', label: 'Day', type: 'day' },
        { key: 'time', label: 'Time (e.g. 14:30)', placeholder: 'hh:mm' },
        { key: 'with', label: 'With', more: true },
        { key: 'where', label: 'Where', more: true },
        { key: 'bring', label: 'What to bring', more: true },
        { key: 'followUp', label: 'Follow-up around', type: 'day', more: true },
        { key: 'notes', label: 'Notes (non-medical)', type: 'textarea', more: true },
      ],
      onCancel: () => (existing ? hub.go('item', existing.id) : hub.go(null)),
      onSave: async (values) => {
        const saved = await saveRecord(hub, appts(hub), normaliseAppointment({ ...a, ...values }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('item', saved.id); }
      },
    }),
    privacy(),
  ]);
}

function routinesScreen(hub) {
  const r = hub.use('routines', async () => (await routines(hub).list({ limit: 500 })).items);
  if (r.loading) return el('section', { class: 'stack' }, [nav(hub, 'routines'), loading()]);
  const people = hub.people.list();
  return el('section', { class: 'stack' }, [
    nav(hub, 'routines'),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Healthy habits' }),
      r.data?.length ? el('ul', { class: 'list' }, r.data.map((x) => el('li', {}, [
        el('span', { class: 'list__main' }, [el('strong', { text: x.title }), el('div', { class: 'small muted', text: [x.when, x.who.length ? x.who.map((w) => nameOf(people, w)).join(', ') : 'everyone', x.active ? null : 'paused'].filter(Boolean).join(' · ') })]),
        el('button', { class: 'btn btn-small', type: 'button', text: x.active ? 'Pause' : 'Resume', on: { click: async () => { const full = await routines(hub).get(x.id); await saveRecord(hub, routines(hub), normaliseRoutine({ ...full, active: !x.active })); } } }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: async () => { await routines(hub).remove(x.id); hub.invalidate(); } } }),
      ]))) : el('p', { class: 'small muted', text: 'Habits you are building as a family - water with meals, screens off an hour before bed, a fruit with lunch.' }),
    ]),
    el('h2', { text: 'Add a habit' }),
    recordForm({
      record: { title: '' },
      people,
      saveLabel: 'Add habit',
      fields: [
        { key: 'title', label: 'The habit', required: true },
        { key: 'when', label: 'When', placeholder: 'e.g. every evening' },
        { key: 'who', label: 'For whom', type: 'people', more: true },
        { key: 'how', label: 'How we make it easy', type: 'textarea', more: true },
        { key: 'why', label: 'Why it matters', type: 'textarea', more: true },
      ],
      onSave: async (values) => { await saveRecord(hub, routines(hub), normaliseRoutine(values)); hub.ui.notice('Habit added.'); },
    }),
    privacy(),
  ]);
}
