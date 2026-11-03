// Planner screens (D-104): the week, one day at a time, everyone's things in their colour, with
// trips, planned activities and dates alongside; clashes said plainly. And the form.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { recordForm, saveRecord } from '../kit.js';
import { normaliseEvent, occurrences, alongside, clashes, weekOf, addDays } from './planner.js';

export const eventsCol = (hub) => hub.data.collection('events', { summary: (r) => normaliseEvent(r), text: (r) => r.title ?? '', prefix: 'ev' });
export async function loadPlanner(hub) {
  const [e, t, d, w] = await Promise.all([
    eventsCol(hub).list({ limit: 100000 }),
    hub.data.installed('holidays') ? hub.data.of('holidays', 'trips').list({ limit: 1000 }) : { items: [] },
    hub.data.installed('dates') ? hub.data.of('dates', 'dates').list({ limit: 10000 }) : { items: [] },
    hub.data.installed('exercise') ? hub.data.of('exercise', 'workouts').list({ limit: 1000 }).catch(() => ({ items: [] })) : { items: [] },
  ]);
  return { events: e.items.map(normaliseEvent), trips: t.items, dates: d.items.filter((x) => x.plannedOn && !x.removed), workouts: w.items };
}

const week = { from: null };   // the week shown, kept while the app is open
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const label = (day) => `${DAY[new Date(`${day}T12:00:00Z`).getUTCDay()]} ${Number(day.slice(8, 10))} ${new Date(`${day}T12:00:00Z`).toLocaleDateString('en-ZA', { month: 'short' })}`;

export function plannerScreen(hub, pl, activities, rule) {
  const today = hub.today();
  if (!week.from) week.from = weekOf(today);
  const people = hub.people.list();
  const who = (ids) => ids.map((id) => people.find((p) => p.id === id)).filter(Boolean);
  const chip = (p) => el('span', { class: 'small', style: { display: 'inline-block', padding: '1px 8px', borderRadius: '999px', border: `2px solid ${p.colour ?? 'var(--border-strong)'}`, marginRight: '4px' }, text: p.name });
  const days = occurrences(pl.events, week.from, 7);
  const go = (n) => { week.from = addDays(week.from, n); hub.render(); };
  return el('section', { class: 'stack', 'aria-label': 'Planner' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Parenting' }),
    el('h1', { text: 'Planner', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'What is on, for each child and each of you - with trips, planned activities and dates alongside.' }),
    el('div', { class: 'row', style: { alignItems: 'center', gap: 'var(--space-2)' } }, [
      el('button', { class: 'btn btn-small', type: 'button', text: '‹', 'aria-label': 'The week before', on: { click: () => go(-7) } }),
      el('strong', { text: `${label(week.from)} - ${label(addDays(week.from, 6))}` }),
      el('button', { class: 'btn btn-small', type: 'button', text: '›', 'aria-label': 'The week after', on: { click: () => go(7) } }),
      week.from !== weekOf(today) ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'This week', on: { click: () => { week.from = weekOf(today); hub.render(); } } }) : null,
      el('a', { class: 'btn btn-primary', href: hub.href('plan-new'), text: 'Add', 'data-field': 'plan-add', title: 'Add something to the planner' }),
    ]),
    ...days.map(({ day, items }) => {
      const extra = alongside(day, { trips: pl.trips, activities, dates: pl.dates, workouts: pl.workouts });
      const clash = clashes(items);
      return el('div', { class: 'panel stack', 'data-field': `plan-day:${day}`, style: { gap: '6px', borderWidth: day === today ? '2px' : null } }, [
        el('strong', { text: `${label(day)}${day === today ? ' · today' : ''}` }),
        ...extra.map((x) => el('div', { class: 'small' }, [el('span', { class: 'muted', text: `${{ trip: 'Trip', activity: 'Activity', date: 'Date', workout: 'Workout' }[x.kind]}: ` }), el('a', { href: x.href, text: x.title })])),
        ...items.map((e) => el('a', { href: hub.href('plan-edit', e.eventId), 'data-field': `plan-ev:${e.eventId}`, style: { color: 'inherit', textDecoration: 'none' } }, [
          el('div', {}, [el('strong', { text: `${e.start ?? 'All day'}${e.end ? `-${e.end}` : ''} ` }), e.title, e.where ? el('span', { class: 'muted', text: ` · ${e.where}` }) : null, e.weekly ? el('span', { class: 'muted small', text: ' · every week' }) : null]),
          el('div', {}, who(e.who).map(chip)),
        ])),
        ...clash.map(([a, b]) => el('p', { class: 'small fin-worse', style: { margin: 0 }, 'data-field': 'plan-clash', text: `${a.title} and ${b.title} at the same time${rule === 'us' ? ' - which of you takes whom?' : ' - who takes whom?'}` })),
        !items.length && !extra.length ? el('span', { class: 'small muted', text: 'Nothing on.' }) : null,
      ]);
    }),
  ]);
}

export function planEdit(hub, pl, id) {
  const e = id ? pl.events.find((x) => x.eventId === id) : null;
  return el('section', { class: 'stack' }, [
    el('h1', { text: e ? `Change ${e.title}` : 'Something on' }),
    recordForm({
      record: e ?? { day: hub.today() },
      people: hub.people.list(),
      fields: [
        { key: 'title', label: 'What', required: true, placeholder: 'e.g. Swimming, school concert' },
        { key: 'who', label: 'Who', type: 'people' },
        { key: 'day', label: 'Day', type: 'day' },
        { key: 'start', label: 'From', placeholder: '15:00' },
        { key: 'end', label: 'Until', placeholder: '16:00' },
        { key: 'where', label: 'Where', placeholder: 'e.g. School hall' },
        { key: 'weekly', label: 'Every week', type: 'check' },
        { key: 'until', label: 'Every week until (e.g. the end of term)', type: 'day', more: true },
        { key: 'note', label: 'Note', type: 'textarea', more: true },
      ],
      extra: e ? [el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${e.title}"?`, text: e.weekly ? 'Every week of it goes.' : 'It goes from the planner.', confirmLabel: 'Remove', danger: true })) return;
        await eventsCol(hub).remove(`ev_${e.eventId}`); hub.invalidate(); hub.go('planner');
      } } })] : [],
      onCancel: () => hub.go('planner'),
      onSave: async (v) => {
        const eventId = e?.eventId ?? `ev-${Date.now().toString(36)}`;
        if (await saveRecord(hub, eventsCol(hub), normaliseEvent({ ...(e ?? {}), ...v, id: `ev_${eventId}`, eventId }))) { hub.ui.notice('Saved.'); hub.go('planner'); }
      },
    }),
  ]);
}
