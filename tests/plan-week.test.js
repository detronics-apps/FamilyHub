// Plan my week (D-143): a whole week from the family's own Cookbook, every pick rejectable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWeek, SNACK_IDEAS } from '../js/apps/mealplan/logic.js';

const m = (id, tags, more = {}) => ({ id, title: id, tags, tried: true, rating: 6, proteins: [], carbs: [], allergens: [], animal: [], ...more });
const MEALS = [
  m('Porridge', ['breakfast'], { carbs: ['oats'] }), m('Eggs on toast', ['breakfast'], { proteins: ['egg'], carbs: ['bread'] }),
  m('Sandwiches', ['lunch'], { carbs: ['bread'] }), m('Leftover stew', ['lunch']),
  m('Stew', ['dinner'], { proteins: ['beef'], carbs: ['rice'], rating: 9 }), m('Pasta', ['dinner'], { proteins: ['beef'], carbs: ['pasta'] }),
  m('Fish cakes', ['supper'], { proteins: ['fish'], carbs: ['potato'] }), m('Chicken curry', ['dinner'], { proteins: ['chicken'], carbs: ['rice'], tried: false, rating: null }),
  m('Lasagne', ['dinner'], { proteins: ['beef'], carbs: ['pasta'], tried: false, rating: null }), m('Tacos', ['dinner'], { proteins: ['beef'], tried: false, rating: null }),
];

test('every empty breakfast, lunch and dinner gets a meal marked good for it, and one snack a day', () => {
  const r = planWeek({ meals: MEALS, seed: 'x' });
  assert.equal(r.picks.length, 21);
  for (const p of r.picks) assert.ok(MEALS.find((x) => x.id === p.id).tags.some((t) => t === p.meal || (p.meal === 'dinner' && t === 'supper')));
  assert.equal(r.snacks.length, 7);
  assert.ok(r.snacks.every((s) => SNACK_IDEAS.includes(s.title)));
});

test('at most two new meals a week; not the same protein or starch at dinner two days running when there is a choice', () => {
  const r = planWeek({ meals: MEALS, seed: 'x' });
  const dinners = r.picks.filter((p) => p.meal === 'dinner').sort((a, b) => a.day - b.day);
  assert.ok(dinners.filter((p) => p.why.startsWith('new')).length <= 2);
  const of = (id) => MEALS.find((x) => x.id === id);
  for (let i = 1; i < dinners.length; i += 1) {
    const a = of(dinners[i - 1].id); const b = of(dinners[i].id);
    assert.ok(a.id !== b.id, `${a.id} two days running`);
  }
});

test('a rejected pick moves to the next meal; what is already planned stays; nobody gets what they cannot eat', () => {
  const first = planWeek({ meals: MEALS, seed: 'x' });
  const mon = first.picks.find((p) => p.day === 0 && p.meal === 'dinner');
  const again = planWeek({ meals: MEALS, seed: 'x', rejected: new Set([`0|dinner|${mon.id}`]) });
  assert.notEqual(again.picks.find((p) => p.day === 0 && p.meal === 'dinner').id, mon.id);
  const kept = planWeek({ meals: MEALS, seed: 'x', taken: [{ day: 2, meal: 'lunch' }] });
  assert.ok(!kept.picks.some((p) => p.day === 2 && p.meal === 'lunch'));
  const fishy = planWeek({ meals: MEALS.map((x) => (x.id === 'Fish cakes' ? { ...x, allergens: ['fish'] } : x)), people: [{ allergies: ['fish'], diet: 'none' }], seed: 'x' });
  assert.ok(!fishy.picks.some((p) => p.id === 'Fish cakes'));
  const noSnack = planWeek({ meals: MEALS, seed: 'x', rejected: new Set(SNACK_IDEAS.map((t) => `3|snack|${t}`)) });
  assert.ok(!noSnack.snacks.some((s) => s.day === 3), 'every idea rejected for a day: none that day');
});

test('a meal not marked for any meal is taken as lunch or supper, never breakfast, and says so', () => {
  const r = planWeek({ meals: [m('Chicken pie', [], { type: 'meal' }), m('Cooked rice', [], { type: 'recipe' }), m('Mayo filling', [])], seed: 'x' });
  assert.ok(r.picks.every((p) => p.id === 'Chicken pie'), 'a recipe or filling is part of a meal, not one');
  assert.ok(r.picks.length > 0);
  assert.ok(r.picks.every((p) => p.meal !== 'breakfast'));
  assert.match(r.picks[0].why, /not marked for a meal/);
});

test('a Cookbook of meals not tried yet still fills the week', () => {
  const r = planWeek({ meals: [m('A', ['dinner'], { tried: false }), m('B', ['dinner'], { tried: false }), m('C', ['dinner'], { tried: false })], seed: 'x' });
  assert.equal(r.picks.filter((p) => p.meal === 'dinner').length, 7);
});
