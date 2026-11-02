// Parenting (D-095): topics, the ages decisions apply to, the dashboard, and the content's own rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER, SOURCES, LEVELS, OUTCOMES } from '../js/apps/parenting/content.js';
import { monthsOld, kidsOf, timing, rangeLabel, topicsOf, dashboard, leaningsFor, topicStatus, parentingDecisions, tileNote, SECTIONS } from '../js/apps/parenting/logic.js';
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

test('the content keeps its own rules: every claim sourced and levelled, every flowchart complete, never "stay home"', () => {
  for (const t of STARTER.filter((x) => !x.later)) {
    for (const w of t.why ?? []) {
      assert.ok(SOURCES[w.source], `${t.id}: ${w.source} is a source`);
      assert.ok(LEVELS[w.level], `${t.id}: ${w.level} is a level`);
    }
    if (!t.steps) continue;
    assert.ok(t.health, `${t.id}: a flowchart topic is a health topic`);
    for (const [id, node] of Object.entries(t.steps.nodes)) {
      for (const [, to] of [...(node.answers ?? []), ...(node.next ?? [])]) assert.ok(t.steps.nodes[to], `${t.id}.${id} leads to ${to}`);
      if (node.out) assert.ok(OUTCOMES[node.out], `${t.id}.${id}: an outcome`);
      assert.ok(node.q || node.say || node.out, `${t.id}.${id} says something`);
    }
  }
  assert.deepEqual(Object.keys(OUTCOMES), ['now', 'today', 'doctor'], 'no outcome tells anyone not to see a doctor');
  for (const t of STARTER.filter((x) => x.health)) for (const w of [t.summary, t.signs, ...(t.why ?? []).map((x) => x.text)]) {
    assert.ok(!/no need to (see|go)|stay home|do not need a doctor/i.test(w ?? ''), `${t.id}: never suggests not going`);
  }
});
