// The shared food database, and the Meal Assistant built on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFoodDb, amounts, total, tokens, fmtAmount } from '../js/food.js';
import { GUIDE } from '../js/apps/assistant/guide.js';
import { needsFor } from '../js/apps/assistant/reference.js';
import { parseMeal, suggest, allowed, personContext, recipeMealText } from '../js/apps/assistant/logic.js';
import { normalisePerson, ageOn, lifeStageAllowed } from '../js/model.js';

const db = createFoodDb(JSON.parse(fs.readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8')));
const TODAY = '2026-10-26';

test('food database: built from USDA, unknown values kept unknown', () => {
  assert.ok(db.count > 10000, `${db.count} foods`);
  const broccoli = db.get(170379);
  assert.equal(broccoli.name, 'Broccoli, raw');
  assert.ok(broccoli.per100.kcal > 25 && broccoli.per100.kcal < 45);
  assert.ok(db.keys.every((k) => k in broccoli.per100));
  const someUnknown = db.search('broccoli raw', 50).some((f) => Object.values(f.per100).includes(null));
  assert.ok(someUnknown, 'nulls survive - nothing is filled in as zero');
});

test('food search: plurals, every word, generic first', () => {
  assert.deepEqual(tokens('Strawberries with oats'), ['strawberry', 'oat']);
  const hits = db.search('strawberries raw', 5);
  assert.equal(hits[0].name.toLowerCase().startsWith('strawberries, raw'), true);
  assert.ok(db.search('chicken breast roasted').every((f) => /chicken/i.test(f.name) && /breast/i.test(f.name)));
  assert.deepEqual(db.search(''), []);
});

test('amounts scale per 100 g; a total says how many items did not report a nutrient', () => {
  const food = { per100: { kcal: 200, iodine: null } };
  assert.deepEqual(amounts(food, 50), { kcal: 100, iodine: null });
  const t = total([{ food, grams: 50 }, { food: { per100: { kcal: 100, iodine: 10 } }, grams: 100 }]);
  assert.deepEqual(t.kcal, { value: 200, missing: 0 });
  assert.deepEqual(t.iodine, { value: 10, missing: 1 });
  assert.equal(fmtAmount(null), 'not known');
  assert.equal(fmtAmount(0.04), '<0.1');
  assert.equal(fmtAmount(123.4), '123');
});

test('every guide food points at a real USDA record, and no name is claimed twice', () => {
  for (const f of GUIDE) assert.ok(db.get(f.fdc), `${f.id} -> ${f.fdc}`);
  const seen = new Map();
  for (const f of GUIDE) {
    for (const n of [f.name, ...f.also]) {
      assert.ok(!seen.has(n) || seen.get(n) === f.id, `"${n}" is used by ${seen.get(n)} and ${f.id}`);
      seen.set(n, f.id);
    }
  }
});

test('reference values: life stage, unknown sex takes the higher, weight sets adult protein, no babies', () => {
  assert.equal(needsFor({ age: 30, sex: 'female', lifeStage: 'pregnant' }).ref.iron, 27);
  assert.equal(needsFor({ age: 30 }).ref.iron, 18, 'sex not given: the higher of 8 and 18');
  assert.equal(needsFor({ age: 40, sex: 'male', weightKg: 90 }).ref.protein, 72);
  assert.equal(needsFor({ age: 0 }), null);
  const child = needsFor({ age: null, role: 'child' });
  assert.equal(child.assumed, true);
  assert.equal(child.age, 6);
});

test('people carry optional food details; age comes from a birthday', () => {
  const p = normalisePerson({ name: 'A', born: '2020-11-01', sex: 'female', allergies: ['peanuts', 'gluten', 'chocolate'], focus: ['iron', 'x'], dislikes: 'Mushrooms, kiwi ,', weightKg: '61.25', lifeStage: 'pregnant' });
  assert.deepEqual(p.allergies, ['gluten', 'peanuts']);
  assert.deepEqual(p.focus, ['iron']);
  assert.deepEqual(p.dislikes, ['mushrooms', 'kiwi']);
  assert.equal(p.weightKg, 61.3);
  assert.equal(ageOn(p.born, '2026-10-31'), 5);
  assert.equal(ageOn(p.born, '2026-11-01'), 6);
  assert.equal(normalisePerson({ name: 'B' }).born, '');
});

test('reading a meal: the longest name wins', () => {
  const ids = (t) => parseMeal(t).items.map((f) => f.id).sort();
  assert.deepEqual(ids('oats cooked with water, butter and sugar'), ['butter', 'oats', 'sugar']);
  assert.deepEqual(ids('toast with peanut butter'), ['bread', 'peanutbutter']);
  assert.deepEqual(ids('pap and sugar beans'), ['beans', 'pap']);
  assert.deepEqual(ids('brown bread and sweet potatoes'), ['sweetpotato', 'wholegrain']);
  assert.deepEqual(parseMeal('chicken and quinoa').unknown, ['quinoa']);
});

const person = (o) => personContext(normalisePerson({ name: 'P', born: '1990-01-01', ...o }), TODAY);
const food = (id) => GUIDE.find((f) => f.id === id);

test('safety comes before benefit: allergies, diet, choking risks, pregnancy', () => {
  assert.equal(allowed(food('peanutbutter'), person({ allergies: ['peanuts'] })), false);
  assert.equal(allowed(food('salmon'), person({ diet: ['vegetarian'] })), false);
  assert.equal(allowed(food('egg'), person({ diet: ['vegan'] })), false);
  assert.equal(allowed(food('boerewors'), person({ diet: ['halal'] })), false);
  assert.equal(allowed(food('almonds'), person({ born: '2023-01-01' })), false, 'whole nuts: not under 5');
  assert.equal(allowed(food('peanutbutter'), person({ born: '2023-01-01' })), true, 'nut butter is fine, spread thinly');
  assert.equal(allowed(food('liver'), person({ sex: 'female', lifeStage: 'pregnant' })), false);
  assert.equal(allowed(food('milk'), person({ avoid: ['dairy'] })), false);
});

const fam = [
  { id: 'a', name: 'Sam', born: '1985-03-01', sex: 'male', focus: ['protein'] },
  { id: 'b', name: 'Jo', born: '1988-06-01', sex: 'female', lifeStage: 'pregnant', focus: ['iron'] },
  { id: 'c', name: 'Lily', role: 'child', born: '2023-02-01', focus: ['colour'], allergies: ['peanuts'] },
  { id: 'd', name: 'Baby', role: 'child', born: '2026-05-01' },
].map(normalisePerson);
const run = (text, selected = [], extra = {}) => suggest({ text, profiles: fam, selected, db, today: TODAY, ...extra });

test('oats, butter and sugar: fruit first, nothing unsafe for anyone at the table', () => {
  const r = run('oats cooked with water, butter and sugar', ['a', 'b', 'c']);
  const adds = r.cards.filter((c) => c.type === 'add');
  assert.ok(adds.length >= 1 && adds.length <= 2, 'a few ideas, not a list');
  assert.ok(r.cards.some((c) => ['fruit', 'veg'].includes(food(c.foodId).group)), 'adds colour to a beige meal');
  assert.ok(!r.cards.some((c) => food(c.foodId).allergens.includes('peanuts')), 'Lily is allergic to peanuts');
  assert.ok(!r.cards.some((c) => food(c.foodId).child?.avoid), 'nothing unsafe for a 3-year-old');
  assert.ok(r.notes.some((n) => /antenatal/.test(n)), 'pregnancy: supplements are for the clinic');
  assert.ok(r.cards.every((c) => c.who && c.why.length), 'every card says who and why');
});

test('chicken and rice: a vegetable, no second meat; a swap where it keeps the meal', () => {
  const r = run('chicken and rice', ['a']);
  assert.ok(!r.cards.some((c) => c.type === 'add' && food(c.foodId).group === 'protein'));
  assert.ok(r.cards.some((c) => c.type === 'add' && food(c.foodId).group === 'veg'));
  assert.ok(r.cards.some((c) => c.type === 'swap' && c.foodId === 'brownrice'));
});

test('timing only when it matters: tea after the meal for someone focusing on iron', () => {
  assert.ok(run('oats with tea', ['b']).cards.some((c) => c.type === 'time' && c.foodId === 'tea'));
  assert.ok(!run('oats with tea', ['a']).cards.some((c) => c.type === 'time'));
});

test('not today turns an idea into try next time', () => {
  const first = run('chicken and rice', ['a']).cards.find((c) => c.type === 'add');
  const again = run('chicken and rice', ['a'], { notToday: [first.foodId] });
  assert.ok(again.cards.some((c) => c.type === 'next' && c.foodId === first.foodId));
  assert.ok(!again.cards.some((c) => c.type === 'add' && c.foodId === first.foodId));
});

test('what is already on the plate is checked for each person', () => {
  const r = run('grapes and peanuts', ['c']);
  assert.ok(r.cautions.some((c) => c.who === 'Lily' && /Allergic to peanuts/.test(c.text)));
  assert.ok(r.cautions.some((c) => /quarters/.test(c.text)));
});

test('babies under one get no suggestions; an unknown meal gets none either', () => {
  const r = run('oats', ['d']);
  assert.equal(r.cards.length, 0);
  assert.ok(r.notes.some((n) => /under one/.test(n)));
  assert.equal(run('zzz').cards.length, 0);
});

test('two ideas of different kinds: chicken and rice gets a vegetable and beans or lentils', () => {
  const adds = run('chicken and rice', ['a', 'b']).cards.filter((c) => c.type === 'add').map((c) => food(c.foodId).group);
  assert.equal(adds.filter((g) => g === 'veg' || g === 'fruit').length, 1);
  assert.ok(adds.includes('legume'), adds.join());
});

test('pregnant or breastfeeding: only a female aged 16 or more', () => {
  const p = (o) => normalisePerson({ name: 'P', lifeStage: 'pregnant', ...o });
  assert.equal(p({ sex: 'male' }).lifeStage, '', 'never kept for a male');
  assert.equal(p({}).lifeStage, '', 'nor with no gender chosen');
  assert.equal(lifeStageAllowed(p({ sex: 'female', born: '2010-10-27' }), TODAY), false, '15 years old');
  assert.equal(lifeStageAllowed(p({ sex: 'female', born: '2010-10-26' }), TODAY), true, '16 today');
  assert.equal(lifeStageAllowed(p({ sex: 'female', role: 'adult' }), TODAY), true, 'no birthday: an adult');
  assert.equal(lifeStageAllowed(p({ sex: 'female', role: 'child' }), TODAY), false);
  assert.equal(personContext(p({ sex: 'female', born: '2012-01-01' }), TODAY).pregnant, false, 'the assistant ignores it under 16');
});

test('a family recipe is read as a meal from its ingredients; seasonings are not "unrecognised"', () => {
  const recipe = { title: 'Chicken curry', ingredients: [{ name: 'chicken thighs' }, { name: 'onion' }, { name: 'curry powder' }, { name: 'salt' }, { name: 'rice' }] };
  const text = recipeMealText(recipe);
  const r = parseMeal(text);
  assert.deepEqual(r.items.map((f) => f.id), ['chicken', 'onion', 'rice']);
  assert.deepEqual(r.unknown, []);
  assert.equal(recipeMealText({ title: 'Bobotie', ingredients: [] }), 'Bobotie');
});

test('age guidance reaches the plate: honey for a baby, tea for a child, wine in pregnancy', () => {
  const baby = run('oats with honey', ['d']);
  assert.equal(baby.cards.length, 0, 'still no ideas for a baby');
  assert.ok(baby.cautions.some((c) => c.who === 'Baby' && /No honey before their first birthday/.test(c.text)));
  assert.ok(run('toast and tea', ['c']).cautions.some((c) => c.who === 'Lily' && /Avoid caffeinated drinks/.test(c.text)));
  assert.ok(!run('toast and tea', ['a']).cautions.some((c) => /caffeinated/.test(c.text)), 'adults are not told off for tea');
});

test('food search: a whole-word match comes before a longer word that starts the same', () => {
  const first = db.search('egg', 5)[0].name.toLowerCase();
  assert.ok(first.startsWith('egg,') || first.startsWith('egg '), first);
});

test('a food comes in the sizes people buy: half a head of iceberg is 270 g', async () => {
  const { foodSizes } = await import('../js/food.js');
  const { resolveIngredient, batchGrams } = await import('../js/meal-nutrition.js');
  const db = createFoodDb(JSON.parse(fs.readFileSync('data/foods.json', 'utf8')));
  const iceberg = db.search('lettuce iceberg', 5).find((f) => f.portions.length);
  const head = foodSizes(iceberg).find((s) => s.unit === 'head, medium');
  assert.equal(head.each, 539);
  assert.equal(resolveIngredient({ name: 'lettuce', qty: 0.5, unit: head.unit, each: head.each, fdcId: iceberg.id }, db).grams, 269.5);
  const feta = db.search('cheese feta', 5)[0];
  const sizes = foodSizes(feta, [{ label: 'Ring', grams: 200 }]);
  assert.deepEqual(sizes[0], { unit: 'ring', label: 'Ring', each: 200, own: true }, 'our own sizes come first');
  assert.ok(!sizes.some((s) => s.unit === 'oz'), 'plain weights are left out');
  assert.equal(foodSizes({ portions: [{ label: '0.5 cup slices', grams: 52 }] })[0].each, 104, 'half a cup -> one cup');
  assert.equal(batchGrams([{ name: 'feta', qty: 1, unit: 'ring', each: 200 }, { name: 'peas', qty: 200, unit: 'g' }]).grams, 400);
});

test('a size given twice: the later one counts; "wedge (1.33 oz)" reads "wedge"', async () => {
  const { foodSizes } = await import('../js/food.js');
  const s = foodSizes({ portions: [{ label: '1 wedge (1.33 oz)', grams: 38 }] }, [{ label: 'ring', grams: 20, at: 1 }, { label: 'ring', grams: 200, at: 2 }]);
  assert.deepEqual(s.map((x) => [x.unit, x.each]), [['ring', 200], ['wedge', 38]]);
});

test('foods can be browsed by type and colour, sorted by a nutrient, to discover new ones', async () => {
  const { browseFoods, foodGroup, foodColour } = await import('../js/food.js');
  const db = createFoodDb(JSON.parse(fs.readFileSync('data/foods.json', 'utf8')));
  assert.equal(foodGroup('Vegetables and Vegetable Products'), 'veg');
  assert.equal(foodGroup('Seafood mixed dishes'), 'dishes');
  assert.equal(foodGroup('Bananas'), 'fruit');
  assert.equal(foodColour({ name: 'Corn, sweet, yellow, raw', category: 'Vegetables and Vegetable Products' }), 'yellow');
  assert.equal(foodColour({ name: 'Peppers, sweet, red, raw', category: 'Vegetables and Vegetable Products' }), 'red');
  assert.equal(foodColour({ name: 'Bananas, raw', category: 'Fruits and Fruit Juices' }), 'yellow');
  assert.equal(foodColour({ name: 'Bread, banana', category: 'Baked Products' }), null, 'colour is for plants only');
  const yellow = browseFoods(db, { colour: 'yellow' });
  assert.ok(yellow.length > 20 && yellow.every((f) => foodColour(f) === 'yellow'));
  const fibre = browseFoods(db, { group: 'fruit', sort: 'fibre', everyday: true });
  for (let i = 1; i < 30; i++) assert.ok((fibre[i - 1].per100.fibre ?? -1) >= (fibre[i].per100.fibre ?? -1), 'highest first');
  assert.ok(!fibre.some((f) => /dried|powder/i.test(f.name)), 'dried and powdered left out on request');
  const tofu = browseFoods(db, { group: 'legumes', sort: 'protein', only: new Set([172475, 173757]) });
  assert.equal(tofu[0].id, 172475, 'a short list can be browsed - tofu is found by what it brings');
  assert.ok(browseFoods(db, { query: 'egg' })[0].name.toLowerCase().startsWith('egg'), 'words still search as before');
});
