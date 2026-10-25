import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIngredient, formatIngredient, normaliseRecipe, recipeSummary, scaleIngredients, nutritionRows,
  weekStart, weekDays, normalisePlan, setSlot, slotAt, copyPlan, combineIngredients, ingredientsForPlan,
  normaliseShopping, refreshFromPlan, addShoppingItem, toggleItem, clearBought,
} from '../js/apps/meals/logic.js';

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
