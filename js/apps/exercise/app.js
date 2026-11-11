// Exercise: log activity, keep a few flexible weekly plans, see your own week
// and what the family did together. Screens: week (default), log, plans - and your own exercises,
// workouts made from them (D-108); "I have 25 minutes", a round to work through, and tallies
// that never reset (D-110).

import { el } from '../../ui/dom.js';
import { fmtDay, addDays, weekStart } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import { linksControl, linksView } from '../../ui/links-editor.js';
import {
  KINDS, IDEAS, MUSCLES, workoutTime, fitsIn, roundStatus, yearCount, timesText, workoutCounts, countsLine, weekMuscles, shade, normaliseActivity, activitySummary, normalisePlan, planSummary, weekMinutes, together, planProgress, goalLine,
} from './logic.js';
import { useLibrary, exercisesScreen, exerciseScreen, exerciseEdit, workoutsScreen, workoutScreen, workoutEdit, doneButton, goScreen } from './library.js';
import { bodyFigure } from './body.js';

const acts = (hub) => hub.data.collection('activities', { summary: activitySummary, text: (a) => `${KINDS[a.kind]} ${a.note}`, prefix: 'act' });
const plans = (hub) => hub.data.collection('plans', { summary: planSummary, text: (p) => p.title, prefix: 'xpl' });

export function render(hub, route) {
  if (route.sub === 'log') return logScreen(hub);
  if (route.sub === 'plans') return plansScreen(hub);
  const lib = useLibrary(hub);
  if (lib.loading) return el('section', { class: 'stack' }, [loading()]);
  if (lib.error) return el('section', { class: 'stack' }, [failure(lib.error)]);
  const id = route.rest?.[0];
  if (route.sub === 'exercises') return exercisesScreen(hub, lib.data, nav(hub, 'exercises'));
  if (route.sub === 'exercise') return exerciseScreen(hub, lib.data, id);
  if (route.sub === 'exercise-new') return exerciseEdit(hub, lib.data, null);
  if (route.sub === 'exercise-edit') return exerciseEdit(hub, lib.data, id);
  if (route.sub === 'workouts') { const a = recent(hub); return workoutsScreen(hub, lib.data, nav(hub, 'workouts'), a.data ?? []); }
  if (route.sub === 'workout') { const a = recent(hub); return workoutScreen(hub, lib.data, id, { activities: a.data ?? null, actsCol: acts(hub) }); }
  if (route.sub === 'go') { const a = recent(hub); return a.data ? goScreen(hub, lib.data, id, a.data, acts(hub)) : el('section', { class: 'stack' }, [loading()]); }
  if (route.sub === 'workout-new') return workoutEdit(hub, lib.data, null);
  if (route.sub === 'workout-edit') return workoutEdit(hub, lib.data, id);
  return weekScreen(hub);
}

const nav = (hub, current) => tabs(hub, [{ screen: null, label: 'This week' }, { screen: 'log', label: 'Log activity' }, { screen: 'exercises', label: 'Exercises' }, { screen: 'workouts', label: 'Workouts' }, { screen: 'plans', label: 'Plans and goals' }], current);
const recent = (hub) => hub.use('acts', async () => (await acts(hub).list({ limit: 2000 })).items);

function weekScreen(hub) {
  const a = recent(hub);
  const p = hub.use('plans', async () => (await plans(hub).list({ limit: 200 })).items);
  const goals = hub.use('goals', () => hub.settings.get('weeklyGoals', {}));
  const lib = useLibrary(hub);
  if (a.loading || p.loading || goals.loading || lib.loading) return el('section', { class: 'stack' }, [nav(hub, null), loading()]);
  if (a.error || p.error) return el('section', { class: 'stack' }, [nav(hub, null), failure(a.error ?? p.error)]);
  const monday = weekStart(hub.today());
  const me = hub.people.current();
  const t = together(a.data, monday);
  const mine = me ? weekMinutes(a.data, monday, me.id) : null;
  const active = p.data.filter((x) => x.active);
  const thisWeek = a.data.filter((x) => x.day >= monday && x.day <= addDays(monday, 6)).sort((x, y) => y.day.localeCompare(x.day));
  const idea = IDEAS[Number(hub.today().replace(/-/g, '')) % IDEAS.length];
  const people = hub.people.list();

  return el('section', { class: 'stack', 'aria-label': 'Exercise' }, [
    nav(hub, null),
    // First on the screen: the easiest way in (D-110).
    timePanel(hub, lib.data, a.data, me),
    roundPanel(hub, lib.data, a.data),
    el('div', { class: 'stats' }, [
      me ? stat(String(mine), `minutes for ${me.name} this week`) : null,
      stat(String(t.count), 'times the family moved together'),
      stat(String(t.minutes), 'minutes together'),
    ]),
    me ? el('p', { text: goalLine(mine, goals.data?.[me.id]) }) : el('p', { class: 'small muted', text: 'Say who you are (top right) to see your own week.' }),
    me ? musclesPanel(a.data, monday, me) : null,
    active.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Plans this week' }),
      el('ul', { class: 'list' }, active.map((pl) => {
        const pr = planProgress(pl, a.data, monday);
        return el('li', {}, [el('span', { class: 'list__main', text: pl.title }), el('span', { class: 'small', text: `${Math.min(pr.done, pr.of)} of ${pr.of}${pr.done >= pr.of ? ' - done' : ''}` })]);
      })),
      el('p', { class: 'small muted', text: 'Plans are flexible: any day counts. A week that did not happen is just a week.' }),
    ]) : null,
    el('div', { class: 'panel' }, [
      el('h2', { text: 'This week' }),
      thisWeek.length ? el('ul', { class: 'list' }, thisWeek.map((x) => el('li', {}, [
        el('span', { class: 'list__main' }, [`${x.title || KINDS[x.kind]}${x.minutes ? ` - ${x.minutes} min` : ''}`, linksView(hub, x)]),
        el('span', { class: 'small muted', text: [fmtDay(x.day, hub.today()), x.who.map((w) => nameOf(people, w)).join(', ')].filter(Boolean).join(' · ') }),
      ]))) : el('p', { class: 'small muted', text: 'Nothing logged yet this week.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('log'), text: 'Log activity', 'data-field': 'log-activity' }),
    ]),
    el('div', { class: 'panel panel--soft' }, [el('h3', { text: 'An idea for today' }), el('p', { text: idea })]),
  ]);
}

const have = { minutes: null };   // "I have … minutes", kept while the app is open
const MINUTES = [15, 25, 45, 60];

/** I have … minutes: the workouts that fit, the round's undone ones first. Done any time, as often as you like. */
function timePanel(hub, lib, activities, me) {
  const today = hub.today(); const year = today.slice(0, 4);
  const pick = (m) => { have.minutes = have.minutes === m ? null : m; hub.render(); };
  const own = el('input', { class: 'input', type: 'number', min: '1', max: '600', placeholder: 'Other', 'aria-label': 'Minutes you have', style: { maxWidth: '90px' }, value: have.minutes && !MINUTES.includes(have.minutes) ? String(have.minutes) : '',
    on: { change: (e) => { const m = Math.round(Number(e.target.value)); have.minutes = m > 0 ? m : null; hub.render(); } } });
  const fit = have.minutes ? fitsIn(lib.workouts, have.minutes, { activities, roundFrom: lib.roundFrom, year }) : [];
  const unset = lib.workouts.filter((w) => !workoutTime(w).minutes);
  return el('div', { class: 'panel stack', 'data-field': 'have-minutes' }, [
    el('h2', { text: 'I have…', style: { margin: 0 } }),
    el('div', { class: 'row' }, [el('div', { class: 'chipset', role: 'group', 'aria-label': 'Minutes you have' }, MINUTES.map((m) => el('button', {
      class: 'chip', type: 'button', text: `${m} min`, 'aria-pressed': String(have.minutes === m), 'data-field': `have:${m}`, on: { click: () => pick(m) } }))), own]),
    el('p', { class: 'small muted', style: { margin: 0 }, 'data-field': 'counts', text: countsLine(workoutCounts(activities, today, me?.id)) }),
    !have.minutes ? null
      : fit.length ? el('ul', { class: 'list' }, fit.map((w) => el('li', {}, [
        el('a', { class: 'list__main', href: hub.href('workout', w.id), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `fit:${w.name}` }, [
          el('strong', { text: w.name }),
          el('div', { class: 'small muted', text: [`About ${workoutTime(w).minutes} min`, w.inRound ? 'in this round' : null, timesText(yearCount(activities, w.id, year))].filter(Boolean).join(' · ') }),
        ]),
        doneButton(hub, w, lib, activities, acts(hub)),
      ])))
        : el('p', { class: 'small muted', text: lib.workouts.length ? `None of your workouts fits ${have.minutes} minutes${unset.length ? ` - ${unset.length} have no time set yet` : ''}. Make a short one in Workouts.` : 'Make a workout first, in Workouts - a 15-minute one is a good start.' }),
  ]);
}

/** This round: a batch to work through, whenever. No days, nothing missed; New round when it is done. */
function roundPanel(hub, lib, activities) {
  const st = roundStatus(lib.workouts, activities, lib.roundFrom);
  if (!st.of) return lib.workouts.length ? el('p', { class: 'small muted', text: 'Tick workouts for "This round" in Workouts - a few to work through, whenever you have time.' }) : null;
  return el('div', { class: 'panel', 'data-field': 'round' }, [
    el('div', { class: 'row' }, [el('h2', { text: 'This round', style: { margin: 0, flex: '1' } }), el('span', { class: 'small', 'data-field': 'round-count', text: `${st.done} of ${st.of} done` })]),
    el('ul', { class: 'list' }, st.list.map(({ w, done }) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('workout', w.id), text: `${done ? '✓ ' : ''}${w.name}`, style: { color: 'inherit', textDecoration: done ? 'line-through' : 'none' } }),
      el('span', { class: 'small muted', text: workoutTime(w).minutes ? `${workoutTime(w).minutes} min` : '' }),
    ]))),
    st.finished ? el('div', { class: 'row' }, [el('span', { style: { flex: '1' }, text: 'Round finished.' }),
      el('button', { class: 'btn btn-primary btn-small', type: 'button', text: 'New round', 'data-field': 'new-round', on: { click: async () => { await hub.settings.set('roundFrom', new Date().toISOString()); hub.invalidate(); hub.ui.notice('A new round - the same workouts, all to do again. Change which in Workouts.'); } } })])
      : el('p', { class: 'small muted', style: { margin: 0 }, text: 'In any order, on any day. Not today? Then another day.' }),
  ]);
}

/** What each muscle got this week, from the workouts marked Done - a record, not a target. */
function musclesPanel(activities, monday, me) {
  const wk = weekMuscles(activities, monday, me.id);
  const kids = activities.filter((x) => x.kidsKg && x.who.includes(me.id) && x.day >= monday).reduce((s, x) => s + x.kidsKg, 0);
  if (!Object.keys(wk).length && !kids) return null;
  const out = MUSCLES.filter(([m]) => !wk[m]).map(([, n]) => n);
  return el('div', { class: 'panel', 'data-field': 'week-muscles' }, [
    el('h2', { text: `What ${me.name} worked this week` }),
    bodyFigure(shade(wk), { text: (m) => `${wk[m].times} time${wk[m].times === 1 ? '' : 's'}${wk[m].main ? `, ${wk[m].main} set${wk[m].main === 1 ? '' : 's'}` : ''}` }),
    out.length ? el('p', { class: 'small muted', text: `Not this week: ${out.join(', ')}.` }) : null,
    kids ? el('p', { class: 'small', text: `With the children: about ${kids} kg moved.` }) : null,
  ]);
}

const stat = (value, label) => el('div', { class: 'stat' }, [el('div', { class: 'stat__value', text: value }), el('div', { class: 'stat__label', text: label })]);

function logScreen(hub) {
  const me = hub.people.current();
  return el('section', { class: 'stack' }, [
    nav(hub, 'log'),
    recordForm({
      record: { kind: 'walk', minutes: 30, day: hub.today(), who: me ? [me.id] : [] },
      people: hub.people.list(),
      saveLabel: 'Log it',
      fields: [
        { key: 'kind', label: 'What', type: 'select', options: Object.entries(KINDS) },
        { key: 'minutes', label: 'Minutes', type: 'number' },
        { key: 'who', label: 'Who took part', type: 'people' },
        { key: 'day', label: 'When', type: 'day' },
        { key: 'note', label: 'Note', more: true },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, control: () => linksControl(hub, {}) }] : []),
      ],
      onSave: async (values) => {
        const { links, ...rest } = values;
        await saveRecord(hub, acts(hub), normaliseActivity({ ...rest, ...links }, hub.today()));
        hub.ui.notice('Logged.');
        hub.go(null);
      },
    }),
  ]);
}

function plansScreen(hub) {
  const p = hub.use('plans', async () => (await plans(hub).list({ limit: 200 })).items);
  const goals = hub.use('goals', () => hub.settings.get('weeklyGoals', {}));
  if (p.loading || goals.loading) return el('section', { class: 'stack' }, [nav(hub, 'plans'), loading()]);
  const people = hub.people.list();
  const me = hub.people.current();
  const goalInput = el('input', { class: 'input', type: 'number', min: '0', step: '10', value: me ? String(goals.data?.[me.id] ?? '') : '', placeholder: 'e.g. 150', 'aria-label': 'Minutes a week', style: { maxWidth: '120px' }, 'data-field': 'goal-minutes' });

  return el('section', { class: 'stack' }, [
    nav(hub, 'plans'),
    me ? el('div', { class: 'panel row' }, [
      el('span', { text: `${me.name}’s goal: minutes a week` }),
      goalInput,
      el('button', { class: 'btn', type: 'button', text: 'Save', on: { click: async () => { await hub.settings.set('weeklyGoals', { ...(goals.data ?? {}), [me.id]: Math.max(0, Number(goalInput.value) || 0) || null }); hub.invalidate(); hub.ui.notice('Goal saved.'); } } }),
    ]) : el('p', { class: 'small muted', text: 'Say who you are (top right) to set a personal goal.' }),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Weekly plans' }),
      p.data.length ? el('ul', { class: 'list' }, p.data.map((pl) => el('li', {}, [
        el('span', { class: 'list__main' }, [el('strong', { text: pl.title }), el('div', { class: 'small muted', text: [`${pl.timesPerWeek} times a week`, pl.kind ? KINDS[pl.kind] : 'any activity', pl.minutes ? `${pl.minutes}+ min` : null, pl.who.length ? pl.who.map((w) => nameOf(people, w)).join(', ') : 'anyone'].filter(Boolean).join(' · ') }), linksView(hub, pl)]),
        el('button', { class: 'btn btn-small', type: 'button', text: pl.active ? 'Pause' : 'Resume', on: { click: async () => { const full = await plans(hub).get(pl.id); await saveRecord(hub, plans(hub), normalisePlan({ ...full, active: !pl.active })); } } }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: async () => { await plans(hub).remove(pl.id); hub.invalidate(); } } }),
      ]))) : el('p', { class: 'small muted', text: 'No plans yet - "walk three times a week" is a good one.' }),
    ]),
    el('h2', { text: 'Add a plan' }),
    recordForm({
      record: { title: '', timesPerWeek: 3, kind: '' },
      people,
      saveLabel: 'Add plan',
      fields: [
        { key: 'title', label: 'Name it', required: true, placeholder: 'e.g. Family walks' },
        { key: 'timesPerWeek', label: 'Times a week', type: 'number' },
        { key: 'kind', label: 'Which activity counts', type: 'select', options: [['', 'Any activity'], ...Object.entries(KINDS)] },
        { key: 'minutes', label: 'At least this many minutes', type: 'number', more: true },
        { key: 'who', label: 'For whom', type: 'people', more: true, hint: 'None ticked: anyone in the household.' },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, hint: 'The coach or channel, and the workout videos to follow.', control: () => linksControl(hub, {}) }] : []),
      ],
      onSave: async (values) => { const { links, ...rest } = values; await saveRecord(hub, plans(hub), normalisePlan({ ...rest, ...links })); hub.ui.notice('Plan added.'); },
    }),
  ]);
}
