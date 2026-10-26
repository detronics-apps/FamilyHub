// Age and stage guidance: what applies to whom, and which foods it is about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, guidanceFor, foodWarnings, homeNotices, monthsOn } from '../js/guidance.js';
import { normalisePerson } from '../js/model.js';

const TODAY = '2026-10-26';
const person = (o) => normalisePerson({ name: 'P', ...o });
const ids = (list) => list.map((r) => r.id);

test('every rule has a level, words and a source', () => {
  for (const r of RULES) {
    assert.ok(['warn', 'info'].includes(r.level), r.id);
    assert.ok(r.text.length > 20 && r.source, r.id);
    assert.ok(r.stage || r.diet || (Number.isInteger(r.from) && r.to > r.from), r.id);
  }
});

test('a 3-month-old: honey, water, cow’s milk, salt; not yet the water-from-6-months note', () => {
  const baby = person({ born: '2026-07-20' });
  assert.equal(monthsOn(baby.born, TODAY), 3);
  const g = ids(guidanceFor(baby, TODAY));
  for (const id of ['honey', 'water-early', 'cows-milk', 'salt-baby', 'added-sugar', 'choking', 'solids']) assert.ok(g.includes(id), id);
  assert.ok(!g.includes('water-later'));
  assert.equal(guidanceFor(baby, TODAY)[0].level, 'warn', 'warnings first');
});

test('honey is fine from the first birthday; choking rules last until 5', () => {
  const g = ids(guidanceFor(person({ born: '2025-10-26' }), TODAY));
  assert.ok(!g.includes('honey'));
  assert.ok(g.includes('choking') && g.includes('milk-switch') && g.includes('sodium-1'));
  assert.ok(!ids(guidanceFor(person({ born: '2021-01-01' }), TODAY)).includes('choking'));
});

test('no birthday: no age rules; stage and diet rules still apply', () => {
  assert.deepEqual(ids(guidanceFor(person({ role: 'child' }), TODAY)), []);
  const mum = person({ role: 'adult', sex: 'female', lifeStage: 'pregnant', diet: ['vegan'] });
  assert.deepEqual(ids(guidanceFor(mum, TODAY)).sort(), ['preg-alcohol', 'preg-caffeine', 'preg-food', 'preg-priorities', 'vegan'].sort());
});

test('foods on a plate are checked against the person’s rules', () => {
  const baby = person({ born: '2026-05-01' });
  const w = foodWarnings(baby, TODAY, ['Honey', 'Bananas, raw', 'Milk, whole, 3.25% milkfat', 'Milk, human', 'sugar beans']);
  assert.deepEqual(w.map((x) => x.rule.id).sort(), ['cows-milk', 'honey']);
  assert.deepEqual(w.find((x) => x.rule.id === 'cows-milk').foods, ['Milk, whole, 3.25% milkfat'], 'breast milk is not cow’s milk');
  assert.equal(foodWarnings(baby, TODAY, ['peanut butter']).length, 0, 'smooth nut butter is not a whole nut');
  assert.equal(foodWarnings(person({ born: '1990-01-01' }), TODAY, ['Honey']).length, 0);
  assert.equal(foodWarnings(baby, TODAY, ['Honey'], { skip: ['honey'] }).length, 0);
});

test('home notices: one for a baby, and milestones as they come', () => {
  const n = homeNotices([person({ id: 'a', name: 'Noah', born: '2026-06-01' }), person({ id: 'b', name: 'Sam', born: '1990-01-01' })], TODAY);
  assert.equal(n.length, 2);
  assert.match(n[0].text, /Noah is under one: only breast milk or formula/);
  assert.match(n[1].text, /Noah \(4 months\): solid food/);
  assert.match(homeNotices([person({ id: 'a', name: 'Noah', born: '2025-11-10' })], TODAY).map((x) => x.text).join(), /formula changes to whole milk/);
});
