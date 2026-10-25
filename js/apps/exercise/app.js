// Exercise: log activity, keep a few flexible weekly plans, see your own week
// and what the family did together. Screens: week (default), log, plans.

import { el } from '../../ui/dom.js';
import { fmtDay, addDays, weekStart } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import {
  KINDS, IDEAS, normaliseActivity, activitySummary, normalisePlan, planSummary, weekMinutes, together, planProgress, goalLine,
} from './logic.js';

const acts = (hub) => hub.data.collection('activities', { summary: activitySummary, text: (a) => `${KINDS[a.kind]} ${a.note}`, prefix: 'act' });
const plans = (hub) => hub.data.collection('plans', { summary: planSummary, text: (p) => p.title, prefix: 'xpl' });

export function render(hub, route) {
  if (route.sub === 'log') return logScreen(hub);
  if (route.sub === 'plans') return plansScreen(hub);
  return weekScreen(hub);
}

const nav = (hub, current) => tabs(hub, [{ screen: null, label: 'This week' }, { screen: 'log', label: 'Log activity' }, { screen: 'plans', label: 'Plans and goals' }], current);
const recent = (hub) => hub.use('acts', async () => (await acts(hub).list({ limit: 2000 })).items);

function weekScreen(hub) {
  const a = recent(hub);
  const p = hub.use('plans', async () => (await plans(hub).list({ limit: 200 })).items);
  const goals = hub.use('goals', () => hub.settings.get('weeklyGoals', {}));
  if (a.loading || p.loading || goals.loading) return el('section', { class: 'stack' }, [nav(hub, null), loading()]);
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
    el('div', { class: 'stats' }, [
      me ? stat(String(mine), `minutes for ${me.name} this week`) : null,
      stat(String(t.count), 'times the family moved together'),
      stat(String(t.minutes), 'minutes together'),
    ]),
    me ? el('p', { text: goalLine(mine, goals.data?.[me.id]) }) : el('p', { class: 'small muted', text: 'Say who you are (top right) to see your own week.' }),
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
        el('span', { class: 'list__main', text: `${KINDS[x.kind]}${x.minutes ? ` - ${x.minutes} min` : ''}` }),
        el('span', { class: 'small muted', text: [fmtDay(x.day, hub.today()), x.who.map((w) => nameOf(people, w)).join(', ')].filter(Boolean).join(' · ') }),
      ]))) : el('p', { class: 'small muted', text: 'Nothing logged yet this week.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('log'), text: 'Log activity', 'data-field': 'log-activity' }),
    ]),
    el('div', { class: 'panel panel--soft' }, [el('h3', { text: 'An idea for today' }), el('p', { text: idea })]),
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
      ],
      onSave: async (values) => {
        await saveRecord(hub, acts(hub), normaliseActivity(values, hub.today()));
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
        el('span', { class: 'list__main' }, [el('strong', { text: pl.title }), el('div', { class: 'small muted', text: [`${pl.timesPerWeek} times a week`, pl.kind ? KINDS[pl.kind] : 'any activity', pl.minutes ? `${pl.minutes}+ min` : null, pl.who.length ? pl.who.map((w) => nameOf(people, w)).join(', ') : 'anyone'].filter(Boolean).join(' · ') })]),
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
      ],
      onSave: async (values) => { await saveRecord(hub, plans(hub), normalisePlan(values)); hub.ui.notice('Plan added.'); },
    }),
  ]);
}
