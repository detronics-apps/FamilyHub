import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIngredient, formatIngredient, normaliseRecipe, recipeSummary, scaleIngredients, nutritionRows,
  weekStart, weekDays, normalisePlan, setSlot, slotAt, copyPlan, combineIngredients, ingredientsForPlan,
} from '../js/apps/meals/logic.js';
import { normaliseShopping, refreshFromPlan, addShoppingItem, toggleItem, clearBought } from '../js/apps/shopping/logic.js';

test('ingredient lines: numbers, fractions, units, and plain things', () => {
  assert.deepEqual(parseIngredient('200 g flour'), { qty: 200, unit: 'g', name: 'flour' });
  assert.deepEqual(parseIngredient('1/2 cup sugar'), { qty: 0.5, unit: 'cup', name: 'sugar' });
  assert.deepEqual(parseIngredient('1 1/2 tsp salt'), { qty: 1.5, unit: 'tsp', name: 'salt' });
  assert.deepEqual(parseIngredient('2 eggs'), { qty: 2, unit: '', name: 'eggs' });
  assert.deepEqual(parseIngredient('0,5 litres milk'), { qty: 0.5, unit: 'l', name: 'milk' });
  assert.deepEqual(parseIngredient('salt and pepper'), { name: 'salt and pepper', qty: null, unit: '' });
  assert.equal(formatIngredient({ qty: 0.333333, unit: 'cup', name: 'oats' }), '0.33 cup oats');
  assert.equal(formatIngredient({ qty: 1500, unit: 'ml', name: 'stock' }), '1.5 l stock');
});

test('a recipe needs only a title; ingredients can be typed as lines', () => {
  const r = normaliseRecipe({ title: 'Pancakes', ingredients: '200 g flour\n2 eggs\n300 ml milk', instructions: 'Mix\n\nFry' });
  assert.equal(r.servings, 4);
  assert.equal(r.ingredients.length, 3);
  assert.deepEqual(r.instructions, ['Mix', 'Fry']);
  assert.deepEqual(recipeSummary({ ...r, prepMinutes: 10, cookMinutes: 15 }).minutes, 25);
});

test('scaling: quantities follow servings; unknown amounts stay unknown', () => {
  const r = normaliseRecipe({ title: 'x', servings: 4, ingredients: [{ name: 'rice', qty: 400, unit: 'g' }, { name: 'salt', qty: null }] });
  const s = scaleIngredients(r, 6);
  assert.equal(s[0].qty, 600);
  assert.equal(s[1].qty, null);
});

test('nutrition is only ever what was supplied - the rest is "not known"', () => {
  const r = normaliseRecipe({ title: 'x', nutrition: { calories: 420, protein: '', fat: -1 } });
  const rows = nutritionRows(r);
  assert.deepEqual(rows.filter((x) => x.known).map((x) => x.key), ['calories']);
  assert.ok(rows.every((x) => x.known || x.value === null), 'nothing is estimated');
});

test('weeks start on Monday', () => {
  assert.equal(weekStart('2026-10-25'), '2026-10-19');   // a Sunday
  assert.equal(weekStart('2026-10-19'), '2026-10-19');
  assert.equal(weekStart('2026-10-21'), '2026-10-19');
  assert.equal(weekDays('2026-10-19').at(-1), '2026-10-25');
});

test('plan slots: set, replace, clear, copy to another week', () => {
  let p = normalisePlan({}, '2026-10-19');
  p = setSlot(p, 0, 'dinner', { recipeId: 'r1', title: 'Soup', servings: 4 });
  p = setSlot(p, 0, 'dinner', { recipeId: 'r2', title: 'Pasta', servings: 2 });
  assert.equal(p.slots.length, 1);
  assert.equal(slotAt(p, 0, 'dinner').title, 'Pasta');
  const next = copyPlan(p, '2026-10-26');
  assert.equal(next.week, '2026-10-26');
  assert.equal(slotAt(next, 0, 'dinner').title, 'Pasta');
  assert.equal(setSlot(p, 0, 'dinner', null).slots.length, 0);
  assert.equal(normalisePlan({ slots: [{ day: 9, meal: 'dinner' }, { day: 1, meal: 'feast' }] }, 'w').slots.length, 0);
});

test('shopping: compatible units add up; incompatible ones are never forced together', () => {
  const c = combineIngredients([
    { name: 'Flour', qty: 800, unit: 'g' }, { name: 'flour', qty: 0.5, unit: 'kg' },
    { name: 'flour', qty: 2, unit: 'cup' },
    { name: 'milk', qty: 600, unit: 'ml' }, { name: 'milk', qty: 0.5, unit: 'l' },
    { name: 'egg', qty: 2, unit: '' }, { name: 'eggs', qty: 3, unit: '' },
    { name: 'salt', qty: null, unit: '' },
  ]);
  const find = (n, u) => c.find((x) => x.name.toLowerCase().startsWith(n) && x.unit === u);
  assert.equal(find('flour', 'kg').qty, 1.3);
  assert.equal(find('flour', 'cup').qty, 2, 'cups stay separate');
  assert.equal(find('milk', 'l').qty, 1.1);
  assert.equal(find('egg', '').qty, 5, '"egg" and "eggs" are the same thing');
  assert.equal(find('salt', '').note, 'amount not given');
});

test('the week’s list: scaled per meal, manual items and bought items preserved', () => {
  const recipes = new Map([['r1', normaliseRecipe({ id: 'r1', title: 'Soup', servings: 2, ingredients: [{ name: 'carrot', qty: 2 }, { name: 'stock', qty: 500, unit: 'ml' }] })]]);
  let plan = normalisePlan({}, '2026-10-19');
  plan = setSlot(plan, 0, 'dinner', { recipeId: 'r1', title: 'Soup', servings: 4 });
  plan = setSlot(plan, 3, 'lunch', { recipeId: 'r1', title: 'Soup', servings: 2 });
  const needed = ingredientsForPlan(plan, recipes);
  assert.equal(needed.find((x) => x.name === 'carrot').qty, 6);
  assert.equal(needed.find((x) => x.name === 'stock').qty, 1.5);
  assert.equal(needed.find((x) => x.name === 'stock').unit, 'l');

  let list = addShoppingItem(normaliseShopping({}), '1 bag dog food', 'mine');
  list = refreshFromPlan(list, '2026-10-19', needed);
  const carrot = list.items.find((i) => i.name === 'carrot');
  list = toggleItem(list, carrot.id);
  // the plan changes: one fewer soup
  plan = setSlot(plan, 3, 'lunch', null);
  list = refreshFromPlan(list, '2026-10-19', ingredientsForPlan(plan, recipes));
  assert.ok(list.items.find((i) => i.id === 'mine'), 'my own item is untouched');
  assert.equal(list.items.find((i) => i.name === 'carrot').checked, true, 'already bought stays bought');
  assert.equal(list.items.find((i) => i.name === 'carrot').qty, 4, 'totals follow the plan');
  assert.equal(clearBought(list).items.some((i) => i.name === 'carrot'), false);
});

test('shopping: anything can send; sending again replaces, bought stays bought, typed items untouched', async () => {
  const { addFromSource, readSend, sendHref, byGroup, GROUPS } = await import('../js/apps/shopping/logic.js');
  let list = addShoppingItem(normaliseShopping({}), 'light bulbs', 'mine', 'household');
  list = addFromSource(list, { source: 'chore:c1', from: 'Clean the bathroom', group: 'cleaning' }, [{ name: 'bleach' }, { name: 'sponges', qty: 2 }]);
  list = addFromSource(list, { source: 'meal:r1', from: 'Tuna pasta' }, [{ name: 'pasta', qty: 500, unit: 'g' }]);
  list = toggleItem(list, list.items.find((i) => i.name === 'bleach').id);
  list = addFromSource(list, { source: 'chore:c1', group: 'cleaning' }, [{ name: 'bleach' }, { name: 'gloves' }]);
  assert.deepEqual(list.items.filter((i) => i.source === 'chore:c1').map((i) => i.name), ['bleach', 'gloves'], 'replaced, not doubled');
  assert.equal(list.items.find((i) => i.name === 'bleach').checked, true);
  assert.ok(list.items.find((i) => i.id === 'mine'));
  assert.deepEqual(byGroup(list).map(([g]) => g), ['grains', 'cleaning', 'household'], 'pasta is sorted into its aisle');
  assert.ok(Object.keys(GROUPS).includes('other'));
  const href = sendHref({ source: 'meal:r1', from: 'Soup', items: [{ name: 'carrot', qty: 2 }] });
  assert.equal(readSend(decodeURIComponent(href.split('/').at(-1))).items[0].name, 'carrot');
  assert.equal(readSend('{"items": []}'), null, 'a send needs a source');
  assert.equal(normaliseShopping({ items: [{ name: 'x', fromWeek: '2026-10-19' }] }).items[0].source, 'week:2026-10-19', 'older lists still read');
});

test('a batch weighs what its ingredients add up to (salad dressing: 239 g)', async () => {
  const { batchGrams } = await import('../js/meal-nutrition.js');
  const { normaliseRecipe } = await import('../js/apps/meals/logic.js');
  const lines = [{ name: 'Mayonnaise', qty: 165, unit: 'g' }, { name: 'Greek yoghurt', qty: 60, unit: 'g' }, { name: 'Sugar', qty: 8, unit: 'g' }, { name: 'Salt', qty: 6, unit: 'g' }];
  assert.deepEqual(batchGrams(lines), { grams: 239, complete: true });
  assert.deepEqual(batchGrams([...lines, { name: 'lemon juice', qty: 1, unit: 'tbsp' }]), { grams: 239, complete: false }, 'without the food database, a spoon cannot be weighed');
  assert.deepEqual(normaliseRecipe({ title: 'x', yield: { qty: 239, unit: 'grams', auto: true } }).yield, { qty: 239, unit: 'g', auto: true });
  assert.deepEqual(normaliseRecipe({ title: 'x', yield: { qty: 12, unit: '' } }).yield, { qty: 12, unit: '' });
});

test('shopping remembers what we buy, finds it by kind, and shows everything there is for a first time', async () => {
  const { findItems, kindOf, KINDS, STARTER } = await import('../js/apps/shopping/logic.js');
  let list = addShoppingItem(normaliseShopping({}), 'toothpaste', 't1', 'hygiene');
  list = addShoppingItem(list, '2 l milk', 'm1', 'dairy');
  assert.deepEqual(list.known.map((k) => k.name).sort(), ['milk', 'toothpaste'], 'added items are ours');
  list = toggleItem(list, 't1', '2026-10-26');
  list = toggleItem(list, 't1', '2026-10-27');
  list = toggleItem(list, 't1', '2026-10-28');
  assert.equal(list.known.find((k) => k.name === 'toothpaste').times, 2, 'ticking bought counts; unticking does not');
  assert.equal(list.known.find((k) => k.name === 'toothpaste').last, '2026-10-28');
  assert.equal(kindOf('dairy'), 'food');
  assert.equal(kindOf('hygiene'), 'hygiene');
  assert.deepEqual(findItems(list, { kind: 'hygiene' }).map((f) => f.name), ['toothpaste'], 'ours by kind');
  const all = findItems(list, { kind: 'hygiene', ours: false });
  assert.equal(all[0].name, 'toothpaste', 'ours first');
  assert.ok(all.some((f) => f.name === 'shampoo' && !f.ours), 'and everything else there is');
  assert.ok(!all.some((f) => kindOf(f.group) !== 'hygiene'));
  assert.ok(findItems(list, { query: 'mil' }).some((f) => f.name === 'milk' && f.onList));
  assert.ok(findItems(list, { kind: 'food', ours: false, query: 'tofu' }).length, 'everyday foods to choose from');
  assert.ok(Object.keys(STARTER).every((k) => KINDS[k]));
  const again = normaliseShopping(JSON.parse(JSON.stringify(list)));
  assert.equal(again.known.length, 2, 'kept with the list');
});

/* ---------------------------------------------- D-071 variations */

import { variationIngredients, asVariation, slotAsVariation, variationSays } from '../js/apps/meals/logic.js';

test('D-071 variations: one sauce, three ways - leave out, add, swap and extra steps', () => {
  const sauce = normaliseRecipe({
    title: 'White sauce', servings: 4, ingredients: ['30 g butter', '30 g flour', '500 ml milk'], instructions: ['Melt the butter', 'Stir in the flour', 'Whisk in the milk'],
    variations: [
      { id: 'cheese', name: 'Cheese sauce', add: ['100 g cheddar'], steps: ['Stir in the cheese off the heat'] },
      { id: 'pepper', name: 'Pepper sauce', leaveOut: ['Milk'], add: ['250 ml cream', '1 tbsp black pepper'] },
      { name: '' },
    ],
  });
  assert.equal(sauce.variations.length, 2);                                     // nameless ones are dropped
  assert.deepEqual(variationIngredients(sauce, sauce.variations[0]).map((i) => i.name), ['butter', 'flour', 'milk', 'cheddar']);
  // A swap: milk out (any case), cream in.
  assert.deepEqual(variationIngredients(sauce, sauce.variations[1]).map((i) => i.name), ['butter', 'flour', 'cream', 'black pepper']);
  const cheese = asVariation(sauce, 'cheese');
  assert.equal(cheese.title, 'White sauce (Cheese sauce)');
  assert.equal(cheese.instructions.at(-1), 'Stir in the cheese off the heat');
  assert.equal(asVariation(sauce, 'nope'), sauce);
  // A planned meal takes the variation's ingredients, so shopping and nutrition follow it.
  const slot = slotAsVariation(sauce, 'pepper');
  assert.equal(slot.variationId, 'pepper');
  assert.equal(slot.basis, 4);
  assert.ok(slot.ingredients.some((i) => i.name === 'cream'));
  assert.deepEqual(slotAsVariation(sauce, null), { variationId: null, title: 'White sauce', ingredients: null });
  assert.equal(variationSays(sauce.variations[1]), 'leaves out milk; adds 250 ml cream, 1 tbsp black pepper');
});

test('cooking time adds each planned meal per day and for the week', async () => {
  const { cookingTime } = await import('../js/apps/meals/logic.js');
  const mins = { soup: 45, toast: 10 };
  const t = cookingTime([
    { day: 0, recipeId: 'soup' }, { day: 0, recipeId: 'toast' }, { day: 2, recipeId: 'soup' },
    { day: 3, recipeId: 'new' }, { day: 4, recipeId: null },
  ], (id) => mins[id] ?? null);
  assert.deepEqual(t.days, [55, 0, 45, 0, 0, 0, 0]);
  assert.equal(t.week, 100);
  assert.equal(t.unknown, 2);
});
