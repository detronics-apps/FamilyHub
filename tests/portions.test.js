// Portions per person, and meals that become recipes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { energyGuide, portionShares, portionPlan, fmtShare } from '../js/portions.js';
import { normaliseRecipe, isRecipe, recipeSummary, keepFoodLinks, linkedNutrition, mealFromPlate } from '../js/apps/meals/logic.js';
import { amounts } from '../js/food.js';
import { normalisePerson } from '../js/model.js';

const TODAY = '2026-10-26';

test('energy: equations with height and weight, typical values without, nothing for babies', () => {
  const woman = energyGuide({ born: '1996-01-01', sex: 'female', weightKg: 65, heightCm: 165 }, TODAY);
  assert.equal(woman.basis, 'measured');
  assert.ok(woman.kcal > 2100 && woman.kcal < 2250, String(woman.kcal));
  assert.deepEqual(energyGuide({ born: '2021-01-01', sex: 'male' }, TODAY), { kcal: 1600, goal: 0, basis: 'typical' });
  assert.equal(energyGuide({ born: '2026-06-01' }, TODAY), null);
  assert.equal(energyGuide({ role: 'adult' }, TODAY).basis, 'assumed');
  const pregnant = energyGuide({ born: '1996-01-01', sex: 'female', lifeStage: 'pregnant' }, TODAY).kcal;
  assert.equal(pregnant, energyGuide({ born: '1996-01-01', sex: 'female' }, TODAY).kcal + 340);
});

test('shares: a quarter at a time; a plan adds leftovers and rounds up what to cook', () => {
  const shares = portionShares([
    { id: 'a', name: 'Sam', born: '1985-01-01', sex: 'male' },      // 2600 -> 1.25
    { id: 'b', name: 'Jo', born: '1988-01-01', sex: 'female' },     // 2000 -> 1
    { id: 'c', name: 'Lily', born: '2023-01-01', sex: 'female' },   // 1200 -> 0.5
    { id: 'd', name: 'Baby', born: '2026-05-01' },
  ], TODAY);
  assert.deepEqual(shares.map((s) => s.share), [1.25, 1, 0.5, 0]);
  assert.deepEqual(portionPlan(shares), { eating: 2.75, extra: 0, total: 2.75, cook: 3 });
  assert.equal(portionPlan(shares, 'two').cook, 5);
  assert.equal(portionPlan(shares, 'meal').cook, 6);
  assert.deepEqual([1.25, 1, 0.5, 0.75].map(fmtShare), ['1¼', '1', '½', '¾']);
});

test('a meal is a recipe once it has a method', () => {
  const meal = normaliseRecipe({ title: 'Toast and eggs', ingredients: ['2 slices bread', '2 eggs'] });
  assert.equal(isRecipe(meal), false);
  assert.equal(recipeSummary(meal).recipe, false);
  assert.equal(isRecipe(normaliseRecipe({ ...meal, instructions: 'Toast the bread\nFry the eggs' })), true);
});

test('meals from Calorie Checker keep their food links, even after the lines are edited', () => {
  const meal = mealFromPlate(JSON.stringify({ title: 'Lunch', servings: 3, ingredients: [{ name: 'Bananas, raw', qty: 120, fdcId: 173944 }, { name: 'x', qty: 1, fdcId: 'nope' }] }));
  assert.equal(meal.servings, 3);
  assert.deepEqual(meal.ingredients[0], { name: 'Bananas, raw', qty: 120, unit: 'g', note: '', fdcId: 173944 });
  assert.equal(meal.ingredients[1].fdcId, undefined);
  const edited = keepFoodLinks([{ name: 'bananas, raw', qty: 240, unit: 'g' }, { name: 'honey', qty: 1, unit: 'tbsp' }], meal.ingredients);
  assert.equal(edited[0].fdcId, 173944);
  assert.equal(edited[1].fdcId, undefined);
  assert.equal(mealFromPlate('not json'), null);
});

test('calories per serving come only from linked ingredients in grams, and say how many that covers', () => {
  const foods = { 1: { per100: { kcal: 100, iodine: null } } };
  const meal = normaliseRecipe({ servings: 2, ingredients: [{ name: 'a', qty: 300, unit: 'g', fdcId: 1 }, { name: 'b', qty: 1, unit: 'cup' }] });
  const n = linkedNutrition(meal, (id) => foods[id], amounts);
  assert.deepEqual(n.perServing.kcal, { value: 150, missing: 0 });
  assert.deepEqual(n.perServing.iodine, { value: 0, missing: 1 });
  assert.equal(n.linked, 1);
  assert.equal(n.of, 2);
});

test('an energy goal moves an adult portion, never a child or a pregnant woman', () => {
  const adult = { born: '1990-01-01', sex: 'female', energyGoal: -500 };
  assert.equal(energyGuide(adult, TODAY).kcal, 1500);
  assert.equal(portionShares([{ id: 'a', name: 'A', ...adult }], TODAY)[0].share, 0.75);
  assert.equal(energyGuide({ ...adult, lifeStage: 'pregnant' }, TODAY).goal, 0);
  assert.equal(energyGuide({ born: '2012-01-01', sex: 'male', energyGoal: -500 }, TODAY).goal, 0);
  assert.equal(normalisePerson({ name: 'X', energyGoal: -900 }).energyGoal, 0, 'only the offered steps');
});
