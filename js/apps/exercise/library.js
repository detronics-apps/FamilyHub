// Exercise screens for the library (D-108): your own exercises, workouts put together from
// them, and the days each one is on. Every list here adds and removes.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { recordForm, saveRecord, nameOf } from '../kit.js';
import { linksControl, linksView } from '../../ui/links-editor.js';
import {
  KINDS, WORKS, DAYS, worksName, amountText, normaliseExercise, exerciseSummary, normaliseWorkout, workoutSummary, workoutTime,
} from './logic.js';

export const exercisesCol = (hub) => hub.data.collection('exercises', { summary: exerciseSummary, text: (x) => [x.name, x.works, ...(x.how ?? [])].join(' '), prefix: 'exc' });
export const workoutsCol = (hub) => hub.data.collection('workouts', { summary: workoutSummary, text: (w) => w.name, prefix: 'wko' });

export const useLibrary = (hub) => hub.use('library', async () => {
  const [x, w] = await Promise.all([exercisesCol(hub).list({ limit: 5000 }), workoutsCol(hub).list({ limit: 1000 })]);
  return { exercises: x.items.map((i) => ({ ...normaliseExercise(i), id: i.id })), workouts: w.items.map((i) => ({ ...normaliseWorkout(i), id: i.id })) };
});

const back = (hub, screen, text, param = null) => el('a', { href: hub.href(screen, param), class: 'small', text });
const timeText = (t) => `${t.minutes ? `About ${t.minutes} min` : 'Time not set'}${t.untimed ? ` plus ${t.untimed} counted in reps` : ''}`;
const dayText = (days) => (days.length === 7 ? 'Every day' : DAYS.filter(([d]) => days.includes(d)).map(([, n]) => n).join(', ') || 'No days yet');

/** A list of lines that adds and removes: Add step / Remove step. */
function linesControl(values, { add, remove, placeholder }) {
  const box = el('div', { class: 'stack', style: { gap: '6px' } });
  const row = (v = '') => {
    const input = el('input', { class: 'input', value: v, placeholder, maxlength: 200 });
    const r = el('div', { class: 'row', style: { flexWrap: 'nowrap' } }, [input, el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: remove, on: { click: () => r.remove() } })]);
    return r;
  };
  values.forEach((v) => box.append(row(v)));
  const node = el('div', { class: 'stack', style: { gap: '6px' } }, [box, el('button', { class: 'btn btn-small', type: 'button', text: add, style: { alignSelf: 'flex-start' }, on: { click: () => { const r = row(); box.append(r); r.querySelector('input').focus(); } } })]);
  return { node, get: () => [...box.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean) };
}

// ---- Exercises -------------------------------------------------------------------------------

export function exercisesScreen(hub, lib, nav) {
  const people = hub.people.list();
  const xs = lib.exercises.slice().sort((a, b) => a.name.localeCompare(b.name));
  return el('section', { class: 'stack', 'aria-label': 'Exercises' }, [
    nav,
    el('div', { class: 'row' }, [
      el('p', { class: 'small muted', style: { flex: '1', margin: 0 }, text: 'Your own exercises - how to do each one, how much, and what you need. Put them together in Workouts.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('exercise-new'), text: 'Add exercise', 'data-field': 'exercise-add' }),
    ]),
    xs.length ? el('ul', { class: 'list panel' }, xs.map((x) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('exercise', x.id), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `exercise:${x.name}` }, [
        el('strong', { text: x.name }),
        el('div', { class: 'small muted', text: [x.works ? worksName(x.works) : null, amountText(x), x.who.length ? x.who.map((w) => nameOf(people, w)).join(', ') : null].filter(Boolean).join(' · ') }),
      ]),
    ]))) : el('p', { class: 'panel small muted', text: 'No exercises yet. Add the ones your family does - a stretch, squats, a skipping game.' }),
  ]);
}

export function exerciseScreen(hub, lib, id) {
  const x = lib.exercises.find((e) => e.id === id);
  if (!x) return el('section', { class: 'stack' }, [back(hub, 'exercises', '‹ Exercises'), el('p', { text: 'That exercise has been removed.' })]);
  const people = hub.people.list();
  const usedIn = lib.workouts.filter((w) => w.items.some((i) => i.exerciseId === id));
  return el('section', { class: 'stack', 'aria-label': x.name }, [
    back(hub, 'exercises', '‹ Exercises'),
    el('div', { class: 'row' }, [el('h1', { text: x.name, style: { margin: 0, flex: '1' } }), el('a', { class: 'btn', href: hub.href('exercise-edit', id), text: 'Edit' })]),
    el('p', { class: 'small muted', text: [x.works ? worksName(x.works) : null, amountText(x), x.who.length ? `For ${x.who.map((w) => nameOf(people, w)).join(', ')}` : null].filter(Boolean).join(' · ') }),
    x.how.length ? el('div', { class: 'panel' }, [el('h2', { text: 'How' }), el('ol', {}, x.how.map((s) => el('li', { text: s })))]) : null,
    x.need.length ? el('div', { class: 'panel' }, [el('h2', { text: 'What you need' }), el('ul', {}, x.need.map((s) => el('li', { text: s })))]) : null,
    linksView(hub, x, { small: false }),
    usedIn.length ? el('p', { class: 'small' }, ['In: ', ...usedIn.flatMap((w, i) => [i ? ', ' : '', el('a', { href: hub.href('workout', w.id), text: w.name })])]) : null,
  ]);
}

export function exerciseEdit(hub, lib, id) {
  const x = id ? lib.exercises.find((e) => e.id === id) : null;
  const how = linesControl(x?.how ?? [], { add: 'Add step', remove: 'Remove step', placeholder: 'e.g. Feet hip-width apart' });
  const need = linesControl(x?.need ?? [], { add: 'Add item', remove: 'Remove item', placeholder: 'e.g. A mat' });
  const usedIn = x ? lib.workouts.filter((w) => w.items.some((i) => i.exerciseId === id)) : [];
  return el('section', { class: 'stack' }, [
    back(hub, x ? 'exercise' : 'exercises', '‹ Back', x ? id : null),
    el('h1', { text: x ? `Edit ${x.name}` : 'A new exercise', style: { margin: 0 } }),
    recordForm({
      record: x ?? { sets: null, reps: null },
      people: hub.people.list(),
      saveLabel: 'Save',
      fields: [
        { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Wall push-ups' },
        { key: 'works', label: 'What it works', placeholder: 'Strength, stretch, or your own word', suggest: [...Object.values(WORKS), ...new Set(lib.exercises.map((e) => worksName(e.works)).filter(Boolean))] },
        { key: 'sets', label: 'Sets', type: 'number' },
        { key: 'reps', label: 'Reps in a set', type: 'number' },
        { key: 'seconds', label: 'Or seconds in a set', type: 'number' },
        { key: 'distance', label: 'Or a distance', placeholder: 'e.g. 1 km' },
        { key: 'how', label: 'How', type: 'custom', control: () => how },
        { key: 'need', label: 'What you need', type: 'custom', more: true, control: () => need },
        { key: 'who', label: 'Who it is for', type: 'people', more: true, hint: 'None ticked: anyone.' },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, hint: 'Where you learnt it, and a video showing it.', control: () => linksControl(hub, x ?? {}) }] : []),
      ],
      extra: x ? [el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', 'data-field': 'exercise-remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${x.name}"?`, text: usedIn.length ? `It comes out of ${usedIn.map((w) => w.name).join(', ')} too.` : 'It goes from your exercises.', confirmLabel: 'Remove', danger: true })) return;
        for (const w of usedIn) await saveRecord(hub, workoutsCol(hub), normaliseWorkout({ ...w, items: w.items.filter((i) => i.exerciseId !== id) }));
        await exercisesCol(hub).remove(id); hub.invalidate(); hub.go('exercises');
      } } })] : [],
      onCancel: () => (x ? hub.go('exercise', id) : hub.go('exercises')),
      onSave: async (values) => {
        const { links, works, ...rest } = values;
        const own = Object.entries(WORKS).find(([, n]) => n.toLowerCase() === (works ?? '').toLowerCase())?.[0] ?? works;
        const saved = await saveRecord(hub, exercisesCol(hub), normaliseExercise({ ...(x ?? {}), ...rest, works: own, ...links }));
        hub.invalidate(); hub.ui.notice('Saved.');
        if (saved) hub.go('exercise', saved.id ?? id);
      },
    }),
  ]);
}

// ---- Workouts --------------------------------------------------------------------------------

export function workoutsScreen(hub, lib, nav) {
  const people = hub.people.list();
  return el('section', { class: 'stack', 'aria-label': 'Workouts' }, [
    nav,
    el('div', { class: 'row' }, [
      el('p', { class: 'small muted', style: { flex: '1', margin: 0 }, text: 'Put exercises together in order, set the days and who. They show in This week, to tick off.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('workout-new'), text: 'Add workout', 'data-field': 'workout-add' }),
    ]),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'The week' }),
      el('ul', { class: 'list' }, DAYS.map(([d, n]) => {
        const on = lib.workouts.filter((w) => w.active && w.days.includes(d));
        return el('li', { 'data-field': `week-day:${d}` }, [el('strong', { text: n, style: { minWidth: '3em' } }),
          el('span', { class: 'list__main' }, on.length ? on.flatMap((w, i) => [i ? ' · ' : '', el('a', { href: hub.href('workout', w.id), text: w.name }), w.who.length ? el('span', { class: 'small muted', text: ` (${w.who.map((p) => nameOf(people, p)).join(', ')})` }) : null]) : [el('span', { class: 'small muted', text: 'Rest' })])]);
      })),
    ]),
    lib.workouts.length ? el('ul', { class: 'list panel' }, lib.workouts.map((w) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('workout', w.id), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `workout:${w.name}` }, [
        el('strong', { text: `${w.name}${w.active ? '' : ' (paused)'}` }),
        el('div', { class: 'small muted', text: [`${w.items.length} exercise${w.items.length === 1 ? '' : 's'}`, timeText(workoutTime(w)), dayText(w.days)].join(' · ') }),
      ]),
    ]))) : el('p', { class: 'panel small muted', text: lib.exercises.length ? 'No workouts yet.' : 'Add some exercises first, then put them together here.' }),
  ]);
}

export function workoutScreen(hub, lib, id, done) {
  const w = lib.workouts.find((x) => x.id === id);
  if (!w) return el('section', { class: 'stack' }, [back(hub, 'workouts', '‹ Workouts'), el('p', { text: 'That workout has been removed.' })]);
  const people = hub.people.list();
  const ex = (eid) => lib.exercises.find((e) => e.id === eid);
  return el('section', { class: 'stack', 'aria-label': w.name }, [
    back(hub, 'workouts', '‹ Workouts'),
    el('div', { class: 'row' }, [el('h1', { text: w.name, style: { margin: 0, flex: '1' } }), done, el('a', { class: 'btn', href: hub.href('workout-edit', id), text: 'Edit' })]),
    el('p', { class: 'small muted', text: [timeText(workoutTime(w)), dayText(w.days), w.who.length ? w.who.map((p) => nameOf(people, p)).join(', ') : 'Anyone', w.rest ? `${w.rest} s rest` : null].filter(Boolean).join(' · ') }),
    el('ol', { class: 'panel' }, w.items.map((i) => {
      const e = ex(i.exerciseId);
      return el('li', { style: { marginBottom: '6px' } }, [
        e ? el('a', { href: hub.href('exercise', e.id), text: e.name }) : el('span', { class: 'muted', text: 'A removed exercise' }),
        el('span', { class: 'small muted', text: ` ${amountText(i) || (e ? amountText(e) : '')}` }),
      ]);
    })),
    w.note ? el('p', { text: w.note }) : null,
    linksView(hub, w, { small: false }),
  ]);
}

/** The exercises in order: each with its own amount; Add exercise, Up, Remove. */
function itemsControl(lib, items) {
  const list = el('div', { class: 'stack', style: { gap: '8px' } });
  const num = (v, label) => el('input', { class: 'input', type: 'number', min: '0', value: v ?? '', placeholder: label, 'aria-label': label, title: label, style: { maxWidth: '78px' } });
  const options = lib.exercises.slice().sort((a, b) => a.name.localeCompare(b.name));
  const row = (i = {}) => {
    const pick = el('select', { class: 'select', 'aria-label': 'Exercise' }, options.map((e) => el('option', { value: e.id, text: e.name, selected: e.id === i.exerciseId })));
    const first = options.find((e) => e.id === (i.exerciseId ?? pick.value)) ?? {};
    const sets = num(i.sets ?? first.sets, 'Sets'); const reps = num(i.reps ?? first.reps, 'Reps'); const secs = num(i.seconds ?? first.seconds, 'Seconds');
    pick.addEventListener('change', () => { const e = options.find((o) => o.id === pick.value) ?? {}; sets.value = e.sets ?? ''; reps.value = e.reps ?? ''; secs.value = e.seconds ?? ''; });
    const r = el('div', { class: 'row', 'data-item': '' }, [pick, sets, reps, secs,
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Up', on: { click: () => { if (r.previousElementSibling) list.insertBefore(r, r.previousElementSibling); } } }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => r.remove() } })]);
    r.read = () => ({ exerciseId: pick.value, sets: sets.value, reps: reps.value, seconds: secs.value, distance: i.distance });
    return r;
  };
  items.forEach((i) => list.append(row(i)));
  const node = el('div', { class: 'stack', style: { gap: '6px' } }, [
    options.length ? el('div', { class: 'small muted', text: 'Sets · reps · seconds for each - change them here for this workout.' }) : el('p', { class: 'small muted', text: 'Add exercises first, in the Exercises tab.' }),
    list,
    options.length ? el('button', { class: 'btn btn-small', type: 'button', text: 'Add exercise', 'data-field': 'workout-add-item', style: { alignSelf: 'flex-start' }, on: { click: () => list.append(row()) } }) : null,
  ]);
  return { node, get: () => [...list.children].map((r) => r.read()).filter((i) => i.exerciseId) };
}

export function workoutEdit(hub, lib, id) {
  const w = id ? lib.workouts.find((x) => x.id === id) : null;
  const items = itemsControl(lib, w?.items ?? []);
  const me = hub.people.current();
  return el('section', { class: 'stack' }, [
    back(hub, w ? 'workout' : 'workouts', '‹ Back', w ? id : null),
    el('h1', { text: w ? `Edit ${w.name}` : 'A new workout', style: { margin: 0 } }),
    recordForm({
      record: w ?? { kind: 'gym', days: [], who: me ? [me.id] : [], active: true },
      people: hub.people.list(),
      saveLabel: 'Save',
      fields: [
        { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Morning stretch' },
        { key: 'items', label: 'Exercises, in order', type: 'custom', control: () => items },
        { key: 'days', label: 'Which days', type: 'choices', options: DAYS },
        { key: 'who', label: 'Who does it', type: 'people', hint: 'None ticked: anyone.' },
        { key: 'rest', label: 'Rest between, in seconds', type: 'number', more: true },
        { key: 'minutes', label: 'How long, in minutes', type: 'number', more: true, hint: 'Leave empty to add up the timed parts.' },
        { key: 'kind', label: 'Logged as', type: 'select', options: Object.entries(KINDS), more: true },
        { key: 'active', label: 'On the plan (untick to pause)', type: 'check', more: true },
        { key: 'note', label: 'Note', type: 'textarea', more: true },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, hint: 'The coach or channel, and the video to follow.', control: () => linksControl(hub, w ?? {}) }] : []),
      ],
      extra: w ? [el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', 'data-field': 'workout-remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${w.name}"?`, text: 'It goes from the plan. What you logged from it stays.', confirmLabel: 'Remove', danger: true })) return;
        await workoutsCol(hub).remove(id); hub.invalidate(); hub.go('workouts');
      } } })] : [],
      onCancel: () => (w ? hub.go('workout', id) : hub.go('workouts')),
      onSave: async (values) => {
        const { links, ...rest } = values;
        const saved = await saveRecord(hub, workoutsCol(hub), normaliseWorkout({ ...(w ?? {}), ...rest, ...links }));
        hub.invalidate(); hub.ui.notice('Saved.');
        if (saved) hub.go('workout', saved.id ?? id);
      },
    }),
  ]);
}
