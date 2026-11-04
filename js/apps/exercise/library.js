// Exercise screens for the library (D-108): your own exercises, workouts put together from
// them, and which are in this round (D-110). Every list here adds and removes. Muscles, tags, where it is
// done, equipment at home, and exercises done with the children (D-109).

import { el } from '../../ui/dom.js';
import { confirmAction, modal } from '../../ui/common.js';
import { recordForm, saveRecord, nameOf } from '../kit.js';
import { linksControl, linksView } from '../../ui/links-editor.js';
import {
  KINDS, WORKS, worksName, amountText, normaliseExercise, exerciseSummary, normaliseWorkout, workoutSummary, workoutTime,
  MUSCLES, PLACES, START_TAGS, PREGNANCY_TAG, KIDS_EXAMPLES, muscleName, filterExercises, workoutMuscles, shade, exerciseShade, kidsLoad, kidsMoved,
  normaliseActivity, activityFromWorkout, yearCount, seededCopies,
} from './logic.js';
import { bodyFigure } from './body.js';

export const exercisesCol = (hub) => hub.data.collection('exercises', { summary: exerciseSummary, text: (x) => [x.name, x.works, ...(x.how ?? [])].join(' '), prefix: 'exc' });
export const workoutsCol = (hub) => hub.data.collection('workouts', { summary: workoutSummary, text: (w) => w.name, prefix: 'wko' });

export const useLibrary = (hub) => hub.use('library', async () => {
  // The owner's examples with the children, added once - edit or remove them like any other. Each has
  // its own id, so two windows adding them at the same moment write the same three, not six (D-113).
  if (!await hub.settings.get('examplesAdded', false)) {
    for (const x of KIDS_EXAMPLES) if (!await exercisesCol(hub).get(x.id)) await exercisesCol(hub).put(normaliseExercise(x));
    await hub.settings.set('examplesAdded', true);
  }
  const [x, w, tags, have, roundFrom] = await Promise.all([exercisesCol(hub).list({ limit: 5000 }), workoutsCol(hub).list({ limit: 1000 }),
    hub.settings.get('exerciseTags', START_TAGS), hub.settings.get('homeEquipment', []), hub.settings.get('roundFrom', null)]);
  let exercises = x.items.map((i) => ({ ...normaliseExercise(i), id: i.id }));
  const workouts = w.items.map((i) => ({ ...normaliseWorkout(i), id: i.id }));
  // Copies made before that: unchanged and in no workout - taken out once.
  if (!await hub.settings.get('examplesTidied', false)) {
    const copies = seededCopies(exercises, KIDS_EXAMPLES, new Set(workouts.flatMap((wk) => wk.items.map((i) => i.exerciseId))));
    for (const id of copies) await exercisesCol(hub).remove(id);
    await hub.settings.set('examplesTidied', true);
    if (copies.length) { exercises = exercises.filter((e) => !copies.includes(e.id)); hub.ui?.notice?.(`Removed ${copies.length} doubled starting example${copies.length === 1 ? '' : 's'}.`); }
  }
  return {
    exercises, workouts,
    tags, have, roundFrom, get weights() { return hub.people.weights?.() ?? []; },   // read fresh: a new weight on People shows at once
  };
});
const kidsText = (load) => `about ${load.kg} kg${load.day ? ` (weighed ${new Date(`${load.day}T12:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })})` : ''}`;
const ASK = 'Your own tags - check with your doctor or midwife.';

const back = (hub, screen, text, param = null) => el('a', { href: hub.href(screen, param), class: 'small', text });
const timeText = (t) => `${t.minutes ? `About ${t.minutes} min` : 'Time not set'}${t.untimed ? ` plus ${t.untimed} counted in reps` : ''}`;

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

/** A list kept in the app's settings - our tags, our equipment - with Add and Remove. `onRemove` may ask first. */
function listEditor(hub, key, list, { add, remove, placeholder, hint, onRemove = null }) {
  const save = async (next) => { await hub.settings.set(key, next); hub.invalidate(); };
  const input = el('input', { class: 'input', placeholder, maxlength: 40, 'aria-label': add });
  const addIt = () => { const v = input.value.trim(); if (v && !list.includes(v)) save([...list, v]); };
  return el('div', { class: 'stack', style: { gap: '6px' }, 'data-field': `list:${key}` }, [
    hint ? el('p', { class: 'small muted', style: { margin: 0 }, text: hint }) : null,
    el('ul', { class: 'list' }, list.map((t) => el('li', {}, [el('span', { class: 'list__main', text: t }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: remove, 'data-field': `list-remove:${t}`, on: { click: async () => { if (!onRemove || await onRemove(t)) save(list.filter((x) => x !== t)); } } })]))),
    el('div', { class: 'row', style: { flexWrap: 'nowrap' } }, [input, el('button', { class: 'btn btn-small', type: 'button', text: add, on: { click: addIt } })]),
  ]);
}
const settingsList = (hub, key, list, { title, ...opts }) => el('details', { class: 'panel more' }, [el('summary', { text: `${title} (${list.length})` }), listEditor(hub, key, list, opts)]);

/** Remove an exercise - and take it out of the workouts it is in. */
async function removeExercise(hub, lib, x) {
  const usedIn = lib.workouts.filter((w) => w.items.some((i) => i.exerciseId === x.id));
  if (!await confirmAction({ title: `Remove "${x.name}"?`, text: usedIn.length ? `It comes out of ${usedIn.map((w) => w.name).join(', ')} too.` : 'It goes from your exercises.', confirmLabel: 'Remove', danger: true })) return;
  for (const w of usedIn) await saveRecord(hub, workoutsCol(hub), normaliseWorkout({ ...w, items: w.items.filter((i) => i.exerciseId !== x.id) }));
  await exercisesCol(hub).remove(x.id); hub.invalidate(); hub.go('exercises');
}

/** Remove a workout - what was logged from it stays. */
async function removeWorkout(hub, w) {
  if (!await confirmAction({ title: `Remove "${w.name}"?`, text: 'It goes from the plan. What you logged from it stays.', confirmLabel: 'Remove', danger: true })) return;
  await workoutsCol(hub).remove(w.id); hub.invalidate(); hub.go('workouts');
}

const flt = { tags: [], muscles: [], place: null, have: false };   // the filters, kept while the app is open
let typesOpen = false;   // the Type list open for changing
let startWith = null;   // Make workout: the exercises shown, and the tag they were filtered on
const chip = (text, on, click, field) => el('button', { class: 'chip', type: 'button', text, 'aria-pressed': String(on), 'data-field': field, on: { click } });
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// ---- Exercises -------------------------------------------------------------------------------

export function exercisesScreen(hub, lib, nav) {
  const people = hub.people.list();
  const all = lib.exercises.slice().sort((a, b) => a.name.localeCompare(b.name));
  const tags = [...new Set([...lib.tags, ...all.flatMap((x) => x.tags)])];
  const xs = filterExercises(all, { ...flt, tags: flt.tags.filter((t) => tags.includes(t)), have: flt.have ? lib.have : null });
  const set = (k, v) => { flt[k] = v; hub.render(); };
  const any = flt.tags.length || flt.muscles.length || flt.place || flt.have;
  // Each kind of filter under its own heading (D-113): where it is done, what type it is, the muscles it works.
  const group = (label, chips, more = null) => el('div', { class: 'stack', style: { gap: '6px' } }, [
    el('div', { class: 'row', style: { alignItems: 'center', gap: 'var(--space-2)' } }, [el('strong', { class: 'small', text: label }), more]),
    el('div', { class: 'chipset', role: 'group', 'aria-label': label }, chips)]);
  // A type removed comes off every exercise that has it too - otherwise its filter would stay.
  const dropType = async (t) => {
    const on = all.filter((x) => x.tags.includes(t));
    if (on.length && !await confirmAction({ title: `Remove "${t}"?`, text: `It comes off ${on.length === 1 ? on[0].name : `the ${on.length} exercises that have it`} too. The exercises stay.`, confirmLabel: 'Remove', danger: true })) return false;
    for (const x of on) await saveRecord(hub, exercisesCol(hub), normaliseExercise({ ...x, tags: x.tags.filter((y) => y !== t) }));
    flt.tags = flt.tags.filter((y) => y !== t);
    return true;
  };
  const filters = el('div', { class: 'panel stack', style: { gap: '10px' }, 'data-field': 'exercise-filters' }, [
    group('Where', [
      ...Object.entries(PLACES).map(([k, n]) => chip(n, flt.place === k, () => set('place', flt.place === k ? null : k), `f-place:${k}`)),
      chip('What we have', flt.have, () => set('have', !flt.have), 'f-have')]),
    group('Type', tags.map((t) => chip(t, flt.tags.includes(t), () => set('tags', toggle(flt.tags, t)), `f-tag:${t}`)),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: typesOpen ? 'Done' : 'Change', 'data-field': 'types-change', on: { click: () => { typesOpen = !typesOpen; hub.render(); } } })),
    typesOpen ? listEditor(hub, 'exerciseTags', tags, { add: 'Add type', remove: 'Remove', placeholder: 'e.g. Before work', hint: 'Your own types - offered when you tag an exercise.', onRemove: dropType }) : null,
    group('Muscles', MUSCLES.map(([m, n]) => chip(n, flt.muscles.includes(m), () => set('muscles', toggle(flt.muscles, m)), `f-muscle:${m}`))),
    el('div', { class: 'row' }, [el('span', { class: 'small muted', style: { flex: '1' }, 'data-field': 'exercise-count', text: `${xs.length} of ${all.length} shown` }),
      any && xs.length ? el('button', { class: 'btn btn-small', type: 'button', text: 'Make workout', 'data-field': 'make-workout', title: 'A new workout with the exercises shown', on: { click: () => { startWith = { ids: xs.map((x) => x.id), name: flt.tags.join(' and ') }; hub.go('workout-new'); } } }) : null,
      any ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Clear', on: { click: () => { Object.assign(flt, { tags: [], muscles: [], place: null, have: false }); hub.render(); } } }) : null]),
    flt.tags.includes(PREGNANCY_TAG) ? el('p', { class: 'small', style: { margin: 0 }, text: ASK }) : null,
    flt.have && !lib.have.length ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'Add your equipment below - until then only exercises that need nothing show.' }) : null,
  ]);
  return el('section', { class: 'stack', 'aria-label': 'Exercises' }, [
    nav,
    el('div', { class: 'row' }, [
      el('p', { class: 'small muted', style: { flex: '1', margin: 0 }, text: 'Your own exercises - how to do each one, how much, and what you need. Put them together in Workouts.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('exercise-new'), text: 'Add exercise', 'data-field': 'exercise-add' }),
    ]),
    filters,
    xs.length ? el('ul', { class: 'list panel' }, xs.map((x) => { const load = kidsLoad(x, lib.weights); return el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('exercise', x.id), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `exercise:${x.name}` }, [
        el('strong', { text: x.name }),
        el('div', { class: 'small muted', text: [PLACES[x.place], amountText(x), Object.keys(x.muscles).map(muscleName).join(', '), load ? `with ${load.names.join(' and ')}, ${kidsText(load)}` : null, x.who.length ? x.who.map((w) => nameOf(people, w)).join(', ') : null].filter(Boolean).join(' · ') }),
        x.tags.length ? el('div', { class: 'small', text: x.tags.join(' · ') }) : null,
      ]),
    ]); })) : el('p', { class: 'panel small muted', text: all.length ? 'None match - clear a filter.' : 'No exercises yet. Add the ones your family does - a stretch, squats, a skipping game.' }),
    settingsList(hub, 'homeEquipment', lib.have, { title: 'Our equipment at home', add: 'Add item', remove: 'Remove', placeholder: 'e.g. Dumbbells', hint: '"What we have" shows exercises that need nothing else. Spell items the same as in "What you need".' }),
  ]);
}

export function exerciseScreen(hub, lib, id) {
  const x = lib.exercises.find((e) => e.id === id);
  if (!x) return el('section', { class: 'stack' }, [back(hub, 'exercises', '‹ Exercises'), el('p', { text: 'That exercise has been removed.' })]);
  const people = hub.people.list();
  const usedIn = lib.workouts.filter((w) => w.items.some((i) => i.exerciseId === id));
  return el('section', { class: 'stack', 'aria-label': x.name }, [
    back(hub, 'exercises', '‹ Exercises'),
    el('div', { class: 'row' }, [el('h1', { text: x.name, style: { margin: 0, flex: '1' } }), el('a', { class: 'btn', href: hub.href('exercise-edit', id), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', 'data-field': 'exercise-remove', on: { click: () => removeExercise(hub, lib, x) } })]),
    el('p', { class: 'small muted', text: [PLACES[x.place], x.works ? worksName(x.works) : null, amountText(x), x.who.length ? `For ${x.who.map((w) => nameOf(people, w)).join(', ')}` : null].filter(Boolean).join(' · ') }),
    x.tags.length ? el('div', { class: 'chipset' }, x.tags.map((t) => el('span', { class: 'chip', text: t }))) : null,
    x.tags.includes(PREGNANCY_TAG) ? el('p', { class: 'small', text: ASK }) : null,
    x.source ? el('p', { class: 'small', text: `Who said so: ${x.source}` }) : null,
    (() => { const load = kidsLoad(x, lib.weights); return x.kids.length ? el('p', { 'data-field': 'kids-load', text: load ? `With ${load.names.join(' and ')}: ${kidsText(load)}${x.seconds && !x.reps ? ` for ${x.seconds} s` : ''}.` : `With ${x.kids.map((k) => nameOf(people, k)).join(' and ')} - add their weight on the People page to see it here.` }) : null; })(),
    el('div', { class: 'panel' }, [el('h2', { text: 'What it works' }), bodyFigure(exerciseShade(x), { text: (m) => (x.muscles[m] === 'main' ? 'mainly' : 'also'), none: 'No muscles chosen yet - press Edit.' })]),
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
  const ms = musclesControl(x?.muscles ?? {});
  const tg = tagsControl([...new Set([...lib.tags, ...lib.exercises.flatMap((e) => e.tags)])], x?.tags ?? []);
  const people = hub.people.list();
  const kids = people.filter((p) => p.role === 'child');
  return el('section', { class: 'stack' }, [
    back(hub, x ? 'exercise' : 'exercises', '‹ Back', x ? id : null),
    el('h1', { text: x ? `Edit ${x.name}` : 'A new exercise', style: { margin: 0 } }),
    recordForm({
      record: x ?? { sets: null, reps: null },
      people,
      saveLabel: 'Save',
      fields: [
        { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Wall push-ups' },
        { key: 'place', label: 'Where', type: 'select', options: [['', 'Anywhere'], ...Object.entries(PLACES)] },
        { key: 'works', label: 'What it works', placeholder: 'Strength, stretch, or your own word', suggest: [...Object.values(WORKS), ...new Set(lib.exercises.map((e) => worksName(e.works)).filter(Boolean))] },
        { key: 'muscles', label: 'Muscles', type: 'custom', control: () => ms },
        { key: 'tags', label: 'Tags', type: 'custom', control: () => tg },
        { key: 'sets', label: 'Sets', type: 'number' },
        { key: 'reps', label: 'Reps in a set', type: 'number' },
        { key: 'seconds', label: 'Or seconds in a set', type: 'number' },
        { key: 'distance', label: 'Or a distance', placeholder: 'e.g. 1 km' },
        { key: 'how', label: 'How', type: 'custom', control: () => how },
        { key: 'need', label: 'What you need', type: 'custom', more: true, control: () => need },
        { key: 'kids', label: 'Done with which children', type: 'choices', options: (kids.length ? kids : people).map((p) => [p.id, p.name]), more: true, hint: 'Their latest weights from the People page add up, and update as they grow.' },
        { key: 'source', label: 'Who said so', more: true, placeholder: 'e.g. Our physio, March 2026', hint: 'Where a tag like Pregnancy came from.' },
        { key: 'who', label: 'Who it is for', type: 'people', more: true, hint: 'None ticked: anyone.' },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', hint: 'Who you learnt it from, and a video showing it - YouTube, TikTok, any link.', control: () => linksControl(hub, x ?? {}) }] : []),
      ],
      extra: x ? [el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', 'data-field': 'exercise-remove', on: { click: () => removeExercise(hub, lib, x) } })] : [],
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

/** Each muscle: not worked, Mainly or Also. */
function musclesControl(value) {
  const sels = MUSCLES.map(([m, n]) => [m, el('select', { class: 'select', 'aria-label': n, 'data-field': `muscle:${m}`, style: { maxWidth: '110px' } },
    [['', '-'], ['main', 'Mainly'], ['also', 'Also']].map(([v, t]) => el('option', { value: v, text: t, selected: (value[m] ?? '') === v })))]);
  const node = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px 12px' } },
    sels.map(([m, s]) => el('label', { class: 'row', style: { flexWrap: 'nowrap', justifyContent: 'space-between' } }, [el('span', { class: 'small', text: muscleName(m) }), s])));
  return { node, get: () => Object.fromEntries(sels.filter(([, s]) => s.value).map(([m, s]) => [m, s.value])) };
}

/** Tags: tap ours to put on or take off; Add tag for one of your own. */
function tagsControl(offered, value) {
  let on = [...value];
  const box = el('div', { class: 'chipset' });
  const draw = () => { box.replaceChildren(...[...new Set([...offered, ...on])].map((t) => chip(t, on.includes(t), () => { on = toggle(on, t); draw(); }, `tag:${t}`))); };
  draw();
  const input = el('input', { class: 'input', placeholder: 'A tag of your own', maxlength: 40, 'aria-label': 'A tag of your own' });
  const node = el('div', { class: 'stack', style: { gap: '6px' } }, [box, el('div', { class: 'row', style: { flexWrap: 'nowrap' } }, [input,
    el('button', { class: 'btn btn-small', type: 'button', text: 'Add tag', on: { click: () => { const v = input.value.trim(); if (v && !on.includes(v)) { on = [...on, v]; input.value = ''; draw(); } } } })])]);
  return { node, get: () => on };
}

/**
 * Done: tick the exercises you did (all to start), then it is logged with the muscles worked
 * and the weight moved with the children - so the week counts only what happened.
 */
export function doneButton(hub, w, lib, activities, actsCol) {
  if (!w) return null;
  const today = hub.today();
  const me = hub.people.current();
  const open = () => {
    const boxes = w.items.map((i) => { const x = lib.exercises.find((e) => e.id === i.exerciseId); const b = el('input', { type: 'checkbox', checked: true, value: i.exerciseId });
      return { b, node: el('label', { class: 'checkline' }, [b, `${x?.name ?? 'A removed exercise'} ${amountText(i)}`]) }; });
    const { close } = modal({
      title: `${w.name} - what you did`,
      body: [el('p', { class: 'small muted', text: 'Untick anything you skipped.' }), ...boxes.map((x) => x.node)],
      foot: [el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Log it', 'data-field': 'done-log', on: { click: async () => {
          const did = boxes.filter((x) => x.b.checked).map((x) => x.b.value);
          const act = { ...activityFromWorkout(w, w.id, today, w.who.length ? w.who : me ? [me.id] : []), muscles: workoutMuscles(w, lib.exercises, did), kidsKg: kidsMoved(w, lib.exercises, lib.weights, did) };
          close();
          await saveRecord(hub, actsCol, normaliseActivity(act, today));
          hub.invalidate(); hub.ui.notice(`${w.name} logged.`);
        } } })],
    });
  };
  return el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Done', 'data-field': `done:${w.name}`, on: { click: open } });
}

// ---- Workouts --------------------------------------------------------------------------------

export function workoutsScreen(hub, lib, nav, activities = []) {
  const year = hub.today().slice(0, 4);
  const round = async (w) => { await saveRecord(hub, workoutsCol(hub), normaliseWorkout({ ...w, inRound: !w.inRound })); hub.invalidate(); };
  return el('section', { class: 'stack', 'aria-label': 'Workouts' }, [
    nav,
    el('div', { class: 'row' }, [
      el('p', { class: 'small muted', style: { flex: '1', margin: 0 }, text: 'Put exercises together in order - a 15, a 25, a 45-minute one. Tick a few for This round, and do them whenever you have the time.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('workout-new'), text: 'Add workout', 'data-field': 'workout-add' }),
    ]),
    lib.workouts.length ? el('ul', { class: 'list panel' }, lib.workouts.map((w) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('workout', w.id), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `workout:${w.name}` }, [
        el('strong', { text: `${w.name}${w.active ? '' : ' (paused)'}` }),
        el('div', { class: 'small muted', text: [`${w.items.length} exercise${w.items.length === 1 ? '' : 's'}`, timeText(workoutTime(w)), timesText(yearCount(activities, w.id, year))].join(' · ') }),
      ]),
      el('button', { class: 'chip', type: 'button', text: 'This round', 'aria-pressed': String(w.inRound), 'data-field': `round:${w.name}`, title: 'In the batch to work through', on: { click: () => round(w) } }),
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
    el('div', { class: 'row' }, [el('h1', { text: w.name, style: { margin: 0, flex: '1' } }), done, el('a', { class: 'btn', href: hub.href('workout-edit', id), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', 'data-field': 'workout-remove', on: { click: () => removeWorkout(hub, w) } })]),
    el('p', { class: 'small muted', text: [timeText(workoutTime(w)), w.inRound ? 'in this round' : null, w.who.length ? w.who.map((p) => nameOf(people, p)).join(', ') : 'Anyone', w.rest ? `${w.rest} s rest` : null].filter(Boolean).join(' · ') }),
    el('ol', { class: 'panel' }, w.items.map((i) => {
      const e = ex(i.exerciseId);
      return el('li', { style: { marginBottom: '6px' } }, [
        e ? el('a', { href: hub.href('exercise', e.id), text: e.name }) : el('span', { class: 'muted', text: 'A removed exercise' }),
        el('span', { class: 'small muted', text: ` ${amountText(i) || (e ? amountText(e) : '')}` }),
      ]);
    })),
    (() => { const kg = kidsMoved(w, lib.exercises, lib.weights); return kg ? el('p', { class: 'small', text: `With the children: about ${kg} kg moved in all (their weight × reps × sets).` }) : null; })(),
    el('div', { class: 'panel' }, [el('h2', { text: 'What it works' }), (() => { const load = workoutMuscles(w, lib.exercises);
      return bodyFigure(shade(load), { text: (m) => [load[m].main ? `${load[m].main} set${load[m].main === 1 ? '' : 's'} mainly` : null, load[m].also ? `${load[m].also} also` : null].filter(Boolean).join(', '), none: 'Choose muscles on its exercises to see them here.' }); })(),
      (() => { const out = MUSCLES.filter(([m]) => !workoutMuscles(w, lib.exercises)[m]).map(([, n]) => n); return out.length && out.length < MUSCLES.length ? el('p', { class: 'small muted', text: `Not in this workout: ${out.join(', ')}.` }) : null; })()]),
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
  const start = w ? null : startWith; startWith = null;
  const items = itemsControl(lib, w?.items ?? start?.ids.map((exerciseId) => ({ exerciseId })) ?? []);
  const me = hub.people.current();
  return el('section', { class: 'stack' }, [
    back(hub, w ? 'workout' : 'workouts', '‹ Back', w ? id : null),
    el('h1', { text: w ? `Edit ${w.name}` : 'A new workout', style: { margin: 0 } }),
    recordForm({
      record: w ?? { name: start?.name ?? '', kind: 'gym', who: me ? [me.id] : [], active: true, inRound: true },
      people: hub.people.list(),
      saveLabel: 'Save',
      fields: [
        { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Morning stretch' },
        { key: 'items', label: 'Exercises, in order', type: 'custom', control: () => items },
        { key: 'minutes', label: 'How long, in minutes', type: 'number', hint: 'e.g. 25 - so it shows when you have 25 minutes. Empty: the timed parts added up.' },
        { key: 'inRound', label: 'In this round', type: 'check' },
        { key: 'who', label: 'Who does it', type: 'people', hint: 'None ticked: anyone.' },
        { key: 'rest', label: 'Rest between, in seconds', type: 'number', more: true },
        { key: 'kind', label: 'Logged as', type: 'select', options: Object.entries(KINDS), more: true },
        { key: 'note', label: 'Note', type: 'textarea', more: true },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, hint: 'The coach or channel, and the video to follow.', control: () => linksControl(hub, w ?? {}) }] : []),
      ],
      extra: w ? [el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', 'data-field': 'workout-remove', on: { click: () => removeWorkout(hub, w) } })] : [],
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
