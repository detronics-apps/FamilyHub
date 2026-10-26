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

test('an entry is an item until it is called a meal, a recipe or an own ingredient', async () => {
  const { typeOf, typeName } = await import('../js/apps/meals/logic.js');
  const item = normaliseRecipe({ title: 'Toast and eggs', ingredients: ['2 slices bread', '2 eggs'] });
  assert.equal(item.type, '');
  assert.equal(typeName(item.type), 'Item');
  assert.equal(recipeSummary(item).type, '');
  assert.equal(normaliseRecipe({ title: 'Cake', instructions: ['Mix', 'Bake'] }).type, 'recipe', 'saved before types: a method made it a recipe');
  assert.equal(normaliseRecipe({ title: 'Mayo', asIngredient: true, instructions: ['Whisk'] }).type, 'own', 'saved before types: "use as an ingredient"');
  assert.equal(normaliseRecipe({ ...item, instructions: ['Toast the bread', 'Fry the eggs'] }).type, '', 'left as an item, a method does not change it');
  assert.equal(normaliseRecipe({ ...item, type: 'meal', instructions: ['Toast'] }).type, 'meal', 'a chosen type stays');
  assert.equal(isRecipe(normaliseRecipe({ ...item, type: 'recipe' })), true);
  assert.equal(normaliseRecipe({ title: 'x', type: 'nonsense' }).type, '');
  assert.equal(typeOf({ recipe: true }), 'recipe', 'an index line written before types');
  assert.equal(typeOf({ recipe: false }), '');
  assert.equal(JSON.parse(JSON.stringify(normaliseRecipe({ title: 'Mayo', asIngredient: true }))).asIngredient, undefined, 'the old flag is not kept');
  assert.equal(normaliseRecipe({}).title, 'Untitled item');
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

test('pregnancy from the conception date: clinic weeks, trimester, due date; portions follow the trimester', async () => {
  const { pregnancyInfo } = await import('../js/model.js');
  const mum = (conceived) => normalisePerson({ name: 'M', sex: 'female', born: '1994-01-01', lifeStage: 'pregnant', conceived });
  assert.deepEqual(pregnancyInfo(mum('2026-08-03'), TODAY), { weeks: 14, trimester: 2, due: '2027-04-26', overdue: false });
  assert.equal(pregnancyInfo(mum('2026-10-01'), TODAY).trimester, 1);
  assert.equal(pregnancyInfo(mum('2025-12-01'), TODAY).overdue, true);
  assert.equal(pregnancyInfo(mum(''), TODAY), null);
  assert.equal(normalisePerson({ name: 'B', sex: 'female', lifeStage: 'breastfeeding', conceived: '2026-01-01' }).conceived, '', 'only kept while pregnant');
  const base = energyGuide({ born: '1994-01-01', sex: 'female' }, TODAY).kcal;
  assert.equal(energyGuide(mum('2026-10-01'), TODAY).kcal, base, 'first trimester: nothing extra');
  assert.equal(energyGuide(mum('2026-03-01'), TODAY).kcal, base + 452, 'third trimester');
  assert.equal(energyGuide(mum(''), TODAY).kcal, base + 340, 'no date: the middle figure');
});

test('units: saved in metric, shown and typed in either system', async () => {
  const { fmtWeight, fmtHeight, kgFrom, cmFrom, fmtMass, gramsFromOz, inSystem } = await import('../js/units.js');
  assert.equal(fmtWeight(64.5, 'metric'), '64.5 kg');
  assert.equal(fmtWeight(64.5, 'imperial'), '142 lb');
  assert.equal(fmtWeight(6, 'imperial'), '13 lb 4 oz', 'a baby in pounds and ounces');
  assert.equal(fmtHeight(168, 'imperial'), '5 ft 6 in');
  assert.equal(fmtHeight(60, 'imperial'), '2 ft 0 in');
  assert.equal(kgFrom('142', 'imperial'), 64.4);
  assert.equal(cmFrom('5', '6', 'imperial'), 167.6);
  assert.equal(cmFrom('168', '', 'metric'), 168);
  assert.equal(kgFrom('', 'imperial'), '');
  assert.equal(fmtMass(100, 'imperial'), '3.5 oz');
  assert.equal(fmtMass(1300, 'metric'), '1.3 kg');
  assert.equal(Math.round(gramsFromOz(4)), 113);
  assert.deepEqual(inSystem({ name: 'flour', qty: 500, unit: 'g' }, 'imperial'), { name: 'flour', qty: 1.1, unit: 'lb' });
  assert.deepEqual(inSystem({ name: 'milk', qty: 250, unit: 'ml' }, 'imperial'), { name: 'milk', qty: 8.5, unit: 'fl oz' });
  assert.deepEqual(inSystem({ name: 'eggs', qty: 2, unit: '' }, 'imperial'), { name: 'eggs', qty: 2, unit: '' });
  assert.deepEqual(inSystem({ name: 'flour', qty: 500, unit: 'g' }, 'metric'), { name: 'flour', qty: 500, unit: 'g' });
});

test('guests at a meal: portions by kind, and the servings to cook follow', async () => {
  const { guestShares, servingsFor } = await import('../js/portions.js');
  const { normaliseSlot } = await import('../js/apps/meals/logic.js');
  const slot = normaliseSlot({ day: 0, meal: 'dinner', title: 'Braai', guests: [{ who: 'man' }, { who: 'woman' }, { who: 'alien' }] });
  assert.deepEqual(slot.guests.map((g) => g.who), ['man', 'woman'], 'only the offered kinds');
  const g = guestShares(slot.guests, TODAY);
  assert.deepEqual(g.map((x) => x.share), [1.25, 1]);
  const family = portionShares([{ id: 'a', name: 'A', born: '1990-01-01', sex: 'female' }, { id: 'c', name: 'C', born: '2020-01-01', sex: 'male' }], TODAY);
  assert.equal(servingsFor(family), 2);
  assert.equal(servingsFor([...family, ...g]), 4, 'two guests: cook for four');
});
