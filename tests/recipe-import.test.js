import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, toOurUnits, densityOf, nameKey, matchIngredient, remember, splitRecipe, importRecipe } from '../js/apps/meals/import.js';

// A tiny food database: flour with a USDA "1 cup" of 125 g, salt, milk.
const FOODS = {
  168894: { id: 168894, name: 'Wheat flour, white, all-purpose', portions: [{ label: '1 cup', grams: 125 }] },
  173468: { id: 173468, name: 'Salt, table', portions: [] },
  999: { id: 999, name: 'Milk, whole', portions: [{ label: '1 cup', grams: 244 }] },
};
const db = { get: (id) => FOODS[id] ?? null };

test('ingredient lines: fractions, units in many spellings, notes', () => {
  assert.deepEqual(parseLine('2 1/2 cups AP flour, sifted'), { qty: 2.5, unit: 'cup', name: 'AP flour', note: 'sifted' });
  assert.deepEqual(parseLine('• 1½ tbsp olive oil'), { qty: 1.5, unit: 'tbsp', name: 'olive oil', note: '' });
  assert.deepEqual(parseLine('½ cup brown sugar'), { qty: 0.5, unit: 'cup', name: 'brown sugar', note: '' });
  assert.deepEqual(parseLine('3/4 tsp salt'), { qty: 0.75, unit: 'tsp', name: 'salt', note: '' });
  assert.deepEqual(parseLine('1 T sugar'), { qty: 1, unit: 'tbsp', name: 'sugar', note: '' });
  assert.deepEqual(parseLine('1 t salt'), { qty: 1, unit: 'tsp', name: 'salt', note: '' });
  assert.deepEqual(parseLine('8 fl oz milk'), { qty: 8, unit: 'floz', name: 'milk', note: '' });
  assert.deepEqual(parseLine('2-3 large eggs'), { qty: 2, unit: '', name: 'large eggs', note: '' });
  assert.deepEqual(parseLine('1 cup of oats (rolled)'), { qty: 1, unit: 'cup', name: 'oats', note: 'rolled' });
  assert.deepEqual(parseLine('Salt to taste'), { qty: null, unit: '', name: 'Salt to taste', note: '' });
  // "2 cloves garlic" is a unit; "2 carrots" is not.
  assert.equal(parseLine('2 cloves garlic').unit, 'clove');
  assert.equal(parseLine('2 carrots').unit, '');
});

test('units: weights exact, spoons to ml, cups to grams only with a density', () => {
  assert.deepEqual(toOurUnits({ qty: 8, unit: 'oz' }), { qty: 227, unit: 'g', said: '' });
  assert.deepEqual(toOurUnits({ qty: 1, unit: 'lb' }), { qty: 454, unit: 'g', said: '' });
  assert.equal(toOurUnits({ qty: 2, unit: 'tbsp' }).qty, 30);
  assert.equal(toOurUnits({ qty: 2, unit: 'tbsp' }).unit, 'ml');
  // Flour: the database's cup (236.6 ml) is 125 g; our cup is 250 ml -> 132 g a cup.
  const flour = toOurUnits({ qty: 2, unit: 'cup' }, { food: FOODS[168894], name: 'flour' });
  assert.equal(flour.unit, 'g');
  assert.equal(flour.qty, 264);
  assert.equal(flour.approx, true);
  // A US cup when chosen.
  assert.equal(toOurUnits({ qty: 1, unit: 'cup' }, { food: FOODS[168894], cupMl: 240, name: 'flour' }).qty, 127);
  // A liquid stays in ml, even with a density; no density -> ml.
  assert.deepEqual(toOurUnits({ qty: 1, unit: 'cup' }, { food: FOODS[999], name: 'milk' }), { qty: 250, unit: 'ml', said: 'a cup is 250 ml' });
  assert.equal(toOurUnits({ qty: 1, unit: 'cup' }, { food: null, name: 'rice' }).unit, 'ml');
  // The family's own "cup" size wins over the database's.
  assert.equal(densityOf(FOODS[168894], [{ label: 'cup', grams: 140 }], 250), 140 / 250);
  assert.equal(toOurUnits({ qty: null, unit: 'cup' }).qty, null);
});

test('matching: remembered first, then our own items, then the careful matcher; nothing loose', () => {
  assert.equal(nameKey('Large Carrots, chopped'), nameKey('carrot'));
  const own = [{ id: 'rec_mayo', title: 'Home-made mayo', yield: { qty: 300, unit: 'ml' } }];
  assert.deepEqual(matchIngredient('AP flour', { aliases: { [nameKey('AP flour')]: { fdcId: 168894 } }, db }), { link: { fdcId: 168894 }, how: 'remembered' });
  assert.deepEqual(matchIngredient('home-made mayo', { own, db }), { link: { recipeId: 'rec_mayo' }, how: 'ours' });
  assert.deepEqual(matchIngredient('plain flour', { db }), { link: { fdcId: 168894 }, how: 'matched' });
  assert.deepEqual(matchIngredient('dragonfruit', { db }), { link: null, how: '' });
  // A remembered food that is no longer there is not used.
  assert.equal(matchIngredient('x', { aliases: { x: { fdcId: 5 } }, db }).how, '');
});

test('what is remembered: the line\'s words to the final link', () => {
  const rows = [{ fromKey: 'ap flour', fdcId: 168894, name: 'cake flour' }, { fromKey: 'mayo', recipeId: 'rec_mayo', name: 'Home-made mayo' }, { fromKey: 'dragonfruit' }, { name: 'typed by hand', fdcId: 1 }];
  assert.deepEqual(remember({ old: { fdcId: 1 } }, rows), { old: { fdcId: 1 }, 'ap flour': { fdcId: 168894, name: 'cake flour' }, mayo: { recipeId: 'rec_mayo', name: 'Home-made mayo' } });
});

test('splitting pasted text: with headings, and without', () => {
  const s = splitRecipe(`Easy Pancakes
Serves 4
A Sunday favourite.
https://www.youtube.com/watch?v=abc
Ingredients
For the batter:
- 1 cup flour
- 2 eggs
Method
1. Mix everything.
Step 2: Fry in a hot pan.`);
  assert.equal(s.title, 'Easy Pancakes');
  assert.equal(s.servings, 4);
  assert.equal(s.description, 'A Sunday favourite.');
  assert.deepEqual(s.ingredients, ['- 1 cup flour', '- 2 eggs']);
  assert.deepEqual(s.instructions, ['Mix everything.', 'Fry in a hot pan.']);
  assert.equal(s.videos[0].url, 'https://www.youtube.com/watch?v=abc');

  const t = splitRecipe('Toast\n2 slices bread\n1 tbsp butter\nToast the bread and spread the butter while it is still warm.');
  assert.deepEqual(t.ingredients, ['2 slices bread', '1 tbsp butter']);
  assert.deepEqual(t.instructions, ['Toast the bread and spread the butter while it is still warm.']);
});

test('a whole import: rows say what they came from and how they were matched', () => {
  const r = importRecipe('Bread\nIngredients\n2 cups AP flour\n1 tsp salt\n3 eggs\nMethod\nBake it.', {
    db, aliases: { [nameKey('AP flour')]: { fdcId: 168894, name: 'cake flour' } },
  });
  assert.equal(r.title, 'Bread');
  const [flour, salt, eggs] = r.ingredients;
  assert.equal(flour.fdcId, 168894);
  assert.equal(flour.how, 'remembered');
  assert.equal(flour.name, 'cake flour');
  assert.equal(flour.unit, 'g');
  assert.equal(flour.from, '2 cups AP flour');
  assert.equal(salt.fdcId, 173468);
  assert.deepEqual([salt.qty, salt.unit], [5, 'ml']);
  assert.equal(eggs.whole, true);
  assert.deepEqual(r.instructions, ['Bake it.']);
});
