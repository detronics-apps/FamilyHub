// Parenting (D-095): topics, the ages decisions apply to, the dashboard, and the content's own rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER } from '../js/apps/parenting/content.js';
import { QUESTIONS } from '../js/apps/parenting/questions.js';
import { setView, viewsOn, normaliseViews, monthsOld, kidsOf, timing, rangeLabel, topicsOf, dashboard, leaningsFor, topicStatus, parentingDecisions, tileNote, SECTIONS } from '../js/apps/parenting/logic.js';
import { starter } from '../js/apps/catalogue.js';
import { normaliseDecision, decisionSummary, categoryOf } from '../js/apps/decisions/logic.js';

const TODAY = '2026-11-02';
// What a collection lists: the summary, with its id.
const sum = (d) => ({ id: d.id, ...decisionSummary(normaliseDecision(d)) });
const people = [{ id: 'a', name: 'Sam' }, { id: 'b', name: 'Lee' }, { id: 'k', name: 'Emma', born: '2026-03-01' }, { id: 'k2', name: 'Noah', born: '2021-10-15' }];

test('ages in months; the children are the under-18s', () => {
  assert.equal(monthsOld('2026-03-01', TODAY), 8);
  assert.equal(monthsOld('2027-01-10', TODAY), -3, 'a due date counts before birth');
  assert.deepEqual(kidsOf(people, TODAY).map((k) => [k.name, k.months]), [['Emma', 8], ['Noah', 60]]);
  assert.equal(rangeLabel(0, 12), 'From birth to 1 year');
  assert.equal(rangeLabel(6, null), 'From 6 months');
});

test('a decision is in force while a child is that age, coming up within 3 months, else not needed now', () => {
  const kids = kidsOf(people, TODAY);
  assert.deepEqual(timing(0, 12, kids).now.map((k) => k.name), ['Emma']);                 // no sugar under 1: Emma, not Noah
  assert.equal(timing(48, 72, kids).when, 'now');
  assert.deepEqual(timing(10, 24, kids).soon.map((k) => k.name), ['Emma']);
  assert.equal(timing(10, 24, kids).when, 'soon');
  assert.equal(timing(120, 216, kids).when, 'later');
  assert.equal(timing(0, 6, kidsOf([people[3]], TODAY)).when, 'past');
  assert.equal(timing(0, 12, []).when, 'none');
});

test('starting topics can be changed, removed and added to; an improved one offers its newer version', () => {
  const all = topicsOf([]);
  assert.ok(all.length >= 40 && all.some((t) => t.id === 'honey' && !t.later));
  const mine = topicsOf([
    { topicId: 'honey', edited: true, title: 'No honey', baseV: 0 },
    { topicId: 'water', removed: true },
    { topicId: 'own-bedtime', own: true, title: 'Bedtime', section: 'rules', ageFrom: 12, options: ['7pm: early', '8pm'] },
  ]);
  assert.equal(mine.find((t) => t.id === 'honey').title, 'No honey');
  assert.equal(mine.find((t) => t.id === 'honey').newer, true);
  assert.ok(!mine.some((t) => t.id === 'water'));
  const own = mine.find((t) => t.id === 'own-bedtime');
  assert.deepEqual(own.options, [{ name: '7pm', note: 'early' }, { name: '8pm', note: '' }]);
  assert.equal(own.section, 'rules');
});

test('the dashboard counts what is agreed, from the decisions in Decisions', () => {
  const kids = kidsOf(people, TODAY);
  const topics = topicsOf([{ topicId: 'cosleep', leanings: { a: { pick: 'Own cot in our room' } } }]);
  const decisions = [
    sum({ id: 'd1', title: 'No honey', source: 'parenting:honey', agreement: 'None until 1', ageFrom: 0, ageTo: 12 }),
    sum({ id: 'd2', title: 'Sugar', source: 'parenting:sugar', agreement: 'Treats on Sundays', ageFrom: 48, ageTo: 72 }),
    sum({ id: 'd3', title: 'Potty', source: 'parenting:potty', ageFrom: 10, ageTo: 36 }),
    sum({ id: 'd4', title: 'Chores', source: 'tickets:t1', agreement: 'x' }),
  ];
  const d = dashboard(topics, decisions, kids);
  assert.equal(d.agreed, 2);
  assert.equal(d.discussing, 2);   // co-sleeping (a leaning) and potty (a decision not yet agreed)
  assert.deepEqual(d.inForce.map((x) => x.d.id), ['d1', 'd2']);
  assert.deepEqual(d.comingUp.map((x) => x.d.id), ['d3']);
  assert.equal(d.bySection.length, SECTIONS.length);
  assert.ok(d.worthAgreeing.some((t) => t.id === 'cosleep'));
  assert.equal(tileNote(d), '1 coming up soon');
  assert.equal(categoryOf(decisions[0]), 'parenting');
  assert.equal(topicStatus(topics.find((t) => t.id === 'honey'), parentingDecisions(decisions)), 'agreed');
});

test('a partner’s leaning shows only once you have given your own', () => {
  const rec = { leanings: { b: { pick: 'Bed-sharing', why: 'feeds' } } };
  const adults = [{ id: 'a', name: 'Sam' }, { id: 'b', name: 'Lee' }];
  assert.deepEqual(leaningsFor(rec, adults, 'a').others, [{ id: 'b', name: 'Lee', answered: true, shown: null }]);
  const both = leaningsFor({ leanings: { ...rec.leanings, a: { pick: 'Own cot in our room' } } }, adults, 'a');
  assert.equal(both.others[0].shown.pick, 'Bed-sharing');
});

test('the content only asks (D-107): no claims, no sources as truth, no verdicts on an option, never "stay home"', () => {
  for (const t of STARTER) {
    assert.ok(!t.why && !t.steps && !t.signs, `${t.id}: no claims, flowcharts or app-made signs`);
    for (const o of t.options ?? []) assert.ok(!o.strengths && !o.weaknesses, `${t.id}: no verdicts on ${o.name}`);
  }
  for (const [id, qs] of Object.entries(QUESTIONS)) for (const q of qs) for (const o of q.options) assert.ok(!o.pro && !o.con, `${id}.${q.id}: ${o.name} carries no verdict`);
  const said = [...STARTER.flatMap((t) => [t.summary, t.question]), ...Object.values(QUESTIONS).flat().flatMap((q) => [q.ask, ...q.think])].filter(Boolean).join(' ');
  assert.ok(!/no need to (see|go)|stay home|do not need a doctor/i.test(said), 'never suggests not going');
  assert.ok(!/recommended|you should|best practice|is safe|is proven|studies show/i.test(said), 'no recommendations or claims');
});

test('Parenting and Decisions may see birthdays - without them every child reads as "no birthday yet"', () => {
  for (const id of ['parenting', 'decisions']) assert.ok(starter(id).manifest.permissions.includes('people:ages'), id);
});

test('a video: each parent agrees, is not sure or disagrees - the other shown once you have given yours', () => {
  const url = 'https://youtu.be/x';
  const adults = [{ id: 'a', name: 'Sam' }, { id: 'b', name: 'Lee' }];
  let v = setView({}, url, 'b', 'disagree', 'too strict');
  assert.deepEqual(viewsOn(v, url, adults, 'a').others[0], { id: 'b', name: 'Lee', answered: true, shown: null });
  v = setView(v, url, 'a', 'agree');
  assert.equal(viewsOn(v, url, adults, 'a').others[0].shown.note, 'too strict');
  assert.deepEqual(normaliseViews({ [url]: { a: { view: 'maybe' } } }), {}, 'only agree, not sure or disagree');
});
