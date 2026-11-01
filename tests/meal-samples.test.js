import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLE_RECIPES, samplesToAdd } from '../js/apps/meals/samples.js';
import { normaliseRecipe, expandIngredients, variationOf, setLinked, asVariation } from '../js/apps/meals/logic.js';

const foods = new Set(JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url))).foods.map((f) => f[0]));
const byId = new Map(SAMPLE_RECIPES.map((r) => [r.id, normaliseRecipe(r)]));

test('every starter ingredient is a real food, and every own item and version it names exists', () => {
  for (const r of SAMPLE_RECIPES) {
    for (const line of [...r.ingredients, ...(r.variations ?? []).flatMap((v) => v.add)]) {
      if (line.recipeId) {
        assert.ok(byId.has(line.recipeId), `${r.title}: ${line.name}`);
        if (line.variation) assert.ok(variationOf(byId.get(line.recipeId), line.variation), `${r.title}: ${line.name}`);
      } else if (!/water/i.test(line.name)) assert.ok(foods.has(line.fdcId), `${r.title}: ${line.name} (${line.fdcId})`);
    }
    for (const v of r.variations ?? []) for (const out of v.leaveOut) assert.ok(r.ingredients.some((x) => x.name.toLowerCase() === out), `${r.title} / ${v.name} leaves out ${out}`);
    for (const m of r.goesWith ?? []) assert.ok(byId.has(m), `${r.title} goes with ${m}`);
    if (r.type === 'own') assert.ok(r.yield?.qty, `${r.title} says what a batch makes`);
  }
});

test('adding samples brings what they need and puts the fillings on their meals', () => {
  const added = samplesToAdd(['rec_s_burgers', 'rec_s_toasties', 'rec_s_chickenmayo']);
  const ids = added.map((r) => r.id);
  assert.ok(ids.includes('rec_s_sauce'), 'the sauce the burger versions use comes along');
  const toasties = added.find((r) => r.id === 'rec_s_toasties');
  assert.deepEqual(toasties.variations.map((v) => v.name), ['Chicken mayo filling']);
  assert.equal(toasties.variations[0].add[0].recipeId, 'rec_s_chickenmayo');
  // Pancakes were not added, so the filling only says it goes with the toasties.
  assert.deepEqual(added.find((r) => r.id === 'rec_s_chickenmayo').goesWith, ['rec_s_toasties']);
  // Already in the cookbook: left alone.
  assert.ok(!samplesToAdd(['rec_s_burgers'], new Set(['rec_s_sauce'])).some((r) => r.id === 'rec_s_sauce'));
});

test('a version naming a sauce version shops for that version', () => {
  const burgers = byId.get('rec_s_burgers');
  const lines = expandIngredients(asVariation(burgers, 'pepper').ingredients, 1, (id) => byId.get(id));
  const names = lines.map((l) => l.name);
  assert.ok(names.includes('Beef stock') && names.includes('Cream'), 'the pepper sauce opens into its own ingredients');
  assert.ok(!names.includes('Ketchup'));
  // 250 ml of a 400 ml batch.
  assert.equal(lines.find((l) => l.name === 'Cream').qty, 156.25);
  assert.ok(!expandIngredients(asVariation(burgers, 'mushroom').ingredients, 1, (id) => byId.get(id)).some((l) => l.name === 'Beef stock'));
});

test('ticking and unticking a filling on a meal', () => {
  const meal = byId.get('rec_s_pancakes');
  const item = byId.get('rec_s_tunamayo');
  const on = setLinked(meal, item, true);
  assert.deepEqual(on.variations[0].add, [{ name: 'Tuna mayo filling', qty: 420, unit: 'g', recipeId: 'rec_s_tunamayo' }]);
  assert.equal(normaliseRecipe(on).variations[0].from, 'rec_s_tunamayo');
  assert.equal(setLinked(setLinked(on, item, true), item, true).variations.length, 1);
  assert.equal(setLinked(on, item, false).variations.length, 0);
});
