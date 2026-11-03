// Numbers (D-103), Planner (D-104), Routines (D-105), questions and plans (D-106).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numbersOf, COUNTRY_NUMBERS, EMERGENCY, STARTER } from '../js/apps/parenting/content.js';
import { QUESTIONS, FEVER_SIGNS } from '../js/apps/parenting/questions.js';
import { topicsOf, topicStatus, parentingDecisions, dashboard, answersFor, setAnswer, normalisePlan, bandFor, planText, careRule } from '../js/apps/parenting/logic.js';
import { routinesOf, tasksFor, start, tick, progress, STARTER_ROUTINES } from '../js/apps/parenting/routines.js';
import { normaliseEvent, occurrences, clashes, weekOf, alongside } from '../js/apps/parenting/planner.js';
import { normaliseDecision, decisionSummary } from '../js/apps/decisions/logic.js';
import { COMING_LATER } from '../js/apps/catalogue.js';

const sum = (d) => ({ id: d.id, ...decisionSummary(normaliseDecision(d)) });

test('emergency numbers: South Africa to start, a country to start from, or your own', () => {
  assert.deepEqual(numbersOf(null), EMERGENCY);
  assert.deepEqual(numbersOf({ numbers: [['Our doctor', '021 555 0000'], ['', '  ']] }), [['Our doctor', '021 555 0000']]);
  assert.equal(COUNTRY_NUMBERS.uk.numbers[0][1], '999');
  assert.deepEqual(COMING_LATER, [], 'medical records will not come; the Planner is built');
});

test('every topic with questions exists, and every question has options to choose from', () => {
  for (const [id, qs] of Object.entries(QUESTIONS)) {
    assert.ok(STARTER.some((t) => t.id === id), id);
    for (const q of qs) assert.ok(q.ask && q.options.length >= 1, `${id}.${q.id}`);
  }
  const newused = topicsOf([]).find((t) => t.id === 'newused');
  assert.ok(!newused.later && newused.question, 'questions make a topic written');
});

test('a topic is agreed when every question is decided; each parent answers apart', () => {
  const bottles = topicsOf([]).find((t) => t.id === 'feeding');
  const ds = (ids) => parentingDecisions(ids.map((q, i) => sum({ id: `d${i}`, source: `parenting:feeding:${q}`, agreement: 'yes' })));
  assert.equal(topicStatus(bottles, ds(['how', 'bottle'])), 'discussing');
  assert.equal(topicStatus(bottles, ds(bottles.questions.map((q) => q.id))), 'agreed');
  assert.equal(topicStatus(bottles, parentingDecisions([sum({ id: 'x', source: 'parenting:feeding', agreement: 'all of it' })])), 'agreed', 'a whole-topic decision still settles it');
  const answers = setAnswer({}, 'bottle', 'b', { pick: 'Glass', why: 'no microplastics', change: 'if it breaks' });
  const adults = [{ id: 'a', name: 'Sam' }, { id: 'b', name: 'Lee' }];
  assert.equal(answersFor({ answers }, 'bottle', adults, 'a').others[0].shown, null);
  const both = setAnswer({ answers }, 'bottle', 'a', { pick: 'Glass' });
  assert.equal(answersFor({ answers: both }, 'bottle', adults, 'a').others[0].shown.change, 'if it breaks');
  const d = dashboard(topicsOf([]), [sum({ id: 'q', source: 'parenting:honey:until', agreement: '12 months' })], []);
  assert.equal(d.decided, 1);
  assert.ok(d.questions > 30);
});

test('our fever plan: the parents’ own numbers, by age band, in words', () => {
  const plan = normalisePlan({ bands: [{ from: 0, to: 3, steps: [{ temp: 38, actions: 'phone the doctor' }], goTemp: 38, signs: [FEVER_SIGNS[0]] },
    { from: 3, to: null, steps: [{ temp: 38, forMins: 60, every: 10, actions: 'cool cloth, fluids' }], goTemp: 39.5, goMins: 120, signs: [], own: 'not drinking' }] });
  assert.equal(bandFor(plan, 40).goTemp, 39.5);
  assert.equal(bandFor(plan, 1).goTemp, 38);
  const text = planText({ bands: [bandFor(plan, 40)] });
  assert.match(text, /From 38 °C for 60 min: cool cloth, fluids. Check every 10 min\./);
  assert.match(text, /straight away at 39.5 °C for 120 min, or if: not drinking/);
});

test('the childcare rule from its question counts too', () => {
  const d = sum({ id: 'c', source: 'parenting:childcare:who', agreement: 'only us', careBy: 'us', ageFrom: 0, ageTo: 216 });
  assert.equal(careRule([d], [{ id: 'k', months: 40 }]), 'us');
});

test('routines: each child their own list, ticked themselves, fresh each start', () => {
  const [leaving] = routinesOf([]);
  assert.equal(leaving.routineId, STARTER_ROUTINES[0].id);
  const toddler = { id: 't', months: 20 }; const big = { id: 'b', months: 60 };
  assert.ok(tasksFor(leaving, big).length > tasksFor(leaving, toddler).length, 'by age');
  let r = start(leaving, ['t', 'b'], '2026-11-02T08:00');
  for (const x of tasksFor(r, toddler)) r = tick(r, 't', x.id);
  assert.equal(progress(r, toddler).ready, true);
  assert.equal(progress(r, big).ready, false);
  r = tick(r, 't', tasksFor(r, toddler)[0].id);
  assert.equal(progress(r, toddler).ready, false, 'untick');
  assert.equal(progress(start(r, ['t'], 'later'), toddler).done, 0, 'fresh');
  const chosen = { ...leaving, tasks: [{ ...leaving.tasks[0], kids: ['b'] }] };
  assert.deepEqual(tasksFor(chosen, toddler), [], 'given to chosen children only');
});

test('planner: weekly things repeat until their end; clashes said; trips and plans alongside', () => {
  const ev = [
    normaliseEvent({ eventId: 'swim', title: 'Swimming', who: ['k1'], day: '2026-11-03', start: '15:00', end: '16:00', weekly: true, until: '2026-11-30' }),
    normaliseEvent({ eventId: 'concert', title: 'Concert', who: ['k2'], day: '2026-11-10', start: '15:30', end: '17:00' }),
  ];
  assert.equal(weekOf('2026-11-05'), '2026-11-02');
  const days = occurrences(ev, '2026-11-09', 7);
  const tue = days.find((d) => d.day === '2026-11-10');
  assert.deepEqual(tue.items.map((e) => e.eventId), ['swim', 'concert']);
  assert.equal(clashes(tue.items).length, 1);
  assert.equal(occurrences(ev, '2026-12-07', 7).find((d) => d.day === '2026-12-08').items.length, 0, 'past its end');
  assert.equal(alongside('2026-11-12', { trips: [{ id: 't', title: 'Coast', startDay: '2026-11-11', endDay: '2026-11-14' }] })[0].kind, 'trip');
});

test('planner: workouts from Exercise on their weekdays', () => {
  const w = { id: 'wko_1', name: 'Morning stretch', days: ['tue'] };
  assert.deepEqual(alongside('2026-11-03', { workouts: [w] }).map((x) => x.kind), ['workout']);
  assert.equal(alongside('2026-11-04', { workouts: [w] }).length, 0);
  assert.equal(alongside('2026-11-03', { workouts: [{ ...w, active: false }] }).length, 0);
});
