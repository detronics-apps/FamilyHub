// Planned meals, leftovers, feedback, preferences, discovery, the weekly view and
// the shared nutrition numbers - the owner's acceptance tests A-R where they are logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normaliseRecipe, recipeSummary, ratingState, setRating, setTried, setPref, addNote, ratingMeaning,
  normalisePlan, setSlot, updateSlot, prepared, leftoverMeals, setReservation, addReservation, slotNeeds, ingredientsForPlan, scaleCarefully,
  batchMultiplier, slotBatch, expandIngredients, collectRecipes, wholeOnly,
} from '../js/apps/meals/logic.js';
import { recipeFacts, passes, emptyFilters, describeFilters } from '../js/apps/meals/facts.js';
import { proposeWeek, analyseWeek, optimiseWeek, additionFor, mixGroup } from '../js/apps/mealplan/logic.js';
import { mealNutrition, nutrientProfile, kcalByPerson, CATEGORIES } from '../js/meal-nutrition.js';
import { createFoodDb } from '../js/food.js';
import { normalisePerson } from '../js/model.js';

const db = createFoodDb(JSON.parse(fs.readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8')));
const TODAY = '2026-10-26';
const MONDAY = '2026-10-26';

const chickenRice = normaliseRecipe({ id: 'r1', title: 'Chicken and rice', servings: 4, ingredients: ['400 g chicken breast', '300 g rice', '1 tsp salt', '2 carrots'] });
const recipes = new Map([['r1', chickenRice]]);

test('A: leftovers scale what is cooked, and the list counts them once', () => {
  let plan = normalisePlan({}, MONDAY);
  plan = setSlot(plan, 0, 'dinner', { recipeId: 'r1', title: 'Chicken and rice', servings: 4 });
  const id = plan.slots[0].id;
  plan = addReservation(plan, id, { date: '2026-10-27', meal: 'lunch', portions: 2 }, 'res1');
  const slot = plan.slots[0];
  assert.equal(prepared(slot), 6);
  const chicken = slotNeeds(slot, chickenRice).find((i) => /chicken/.test(i.name));
  assert.equal(chicken.qty, 600, '400 g for 4 becomes 600 g for 6');
  const list = ingredientsForPlan(plan, recipes);
  assert.equal(list.filter((i) => /chicken/.test(i.name)).length, 1);
  assert.equal(list.find((i) => /chicken/.test(i.name)).qty, 600, 'once, not again for Tuesday');
  const later = leftoverMeals([plan], MONDAY);
  assert.deepEqual(later.map((l) => [l.day, l.meal, l.portions, l.title]), [[1, 'lunch', 2, 'Chicken and rice']]);
});

test('B: changing leftovers from two portions to one updates everything that depends on it', () => {
  let plan = setSlot(normalisePlan({}, MONDAY), 0, 'dinner', { recipeId: 'r1', title: 'Chicken and rice', servings: 4 });
  const id = plan.slots[0].id;
  plan = addReservation(plan, id, { date: '2026-10-27', meal: 'lunch', portions: 2 }, 'res1');
  plan = setReservation(plan, id, 'res1', { portions: 1 });
  assert.equal(prepared(plan.slots[0]), 5);
  // 5 portions of a 4-serving recipe: made x1.5 (in halves), so 600 g - with one portion spare.
  assert.equal(ingredientsForPlan(plan, recipes).find((i) => /chicken/.test(i.name)).qty, 600);
  assert.equal(slotBatch(plan.slots[0], chickenRice).spare, 1);
  assert.equal(leftoverMeals([plan], MONDAY)[0].portions, 1);
  plan = setReservation(plan, id, 'res1', { portions: 0 });
  assert.deepEqual(leftoverMeals([plan], MONDAY), [], 'cancelled');
  assert.equal(prepared(plan.slots[0]), 4);
});

test('leftovers from Sunday can be Monday’s lunch; extra portions are cooked without a later meal yet', () => {
  let last = setSlot(normalisePlan({}, '2026-10-19'), 6, 'dinner', { recipeId: 'r1', title: 'Chicken and rice', servings: 4, extra: 1 });
  last = addReservation(last, last.slots[0].id, { date: '2026-10-26', meal: 'lunch', portions: 2 });
  assert.equal(prepared(last.slots[0]), 7);
  assert.deepEqual(leftoverMeals([last, normalisePlan({}, MONDAY)], MONDAY).map((l) => [l.day, l.meal]), [[0, 'lunch']]);
});

test('careful scaling: spices rounded and marked, counted things to the half, unknown stays unknown', () => {
  assert.deepEqual(scaleCarefully({ name: 'salt', qty: 1, unit: 'tsp', note: '' }, 1.5), { name: 'salt', qty: 1.5, unit: 'tsp', note: 'scaled - adjust to taste' });
  assert.equal(scaleCarefully({ name: 'eggs', qty: 2, unit: '' }, 1.3).qty, 3, 'eggs stay whole');
  assert.equal(scaleCarefully({ name: 'onions', qty: 2, unit: '' }, 1.3).qty, 2.5, 'other counted things to the half');
  assert.equal(scaleCarefully({ name: 'stock', qty: null, unit: '' }, 2).qty, null);
  assert.equal(scaleCarefully({ name: 'tomatoes', qty: 1, unit: 'tin' }, 1.5).qty, 2, 'a tin is bought whole');
});

test('G and I: changing one planned meal never changes the recipe or the other meals', () => {
  let plan = setSlot(normalisePlan({}, MONDAY), 0, 'dinner', { recipeId: 'r1', title: 'Chicken and rice', servings: 4 });
  plan = setSlot(plan, 2, 'dinner', { recipeId: 'r1', title: 'Chicken and rice', servings: 4 });
  const [a] = plan.slots;
  plan = updateSlot(plan, a.id, { ingredients: [...chickenRice.ingredients, { name: 'mushrooms', qty: 200, unit: 'g' }], basis: 4, note: 'Added mushrooms this time', feedback: { rating: 9, text: 'Loved it' } });
  const changed = plan.slots.find((s) => s.id === a.id);
  const other = plan.slots.find((s) => s.id !== a.id);
  assert.ok(slotNeeds(changed, chickenRice).some((i) => i.name === 'mushrooms'));
  assert.ok(!slotNeeds(other, chickenRice).some((i) => i.name === 'mushrooms'));
  assert.equal(other.note, '');
  assert.equal(chickenRice.ingredients.length, 4, 'the recipe is untouched');
  assert.equal(chickenRice.rating, null, 'and so is its rating');
});

test('ratings: untried, tried-unrated and rated are kept apart; nothing is invented', () => {
  let r = normaliseRecipe({ title: 'Soup' });
  assert.equal(ratingState(r), 'untried');
  assert.equal(r.rating, null);
  r = setTried(r, true);
  assert.equal(ratingState(r), 'unrated');
  r = setRating(r, 7);
  assert.equal(ratingState(r), 'rated');
  assert.equal(ratingMeaning(7), 'Liked');
  assert.equal(setTried(r, false).rating, null, 'not tried means no rating');
  assert.equal(normaliseRecipe({ rating: 11 }).rating, null);
  assert.equal(normaliseRecipe({ rating: 8 }).tried, true, 'a stored rating means it was tried');
});

test('D: a 7/10 family meal can be one child’s favourite - both filters find it', () => {
  let r = setRating(normaliseRecipe({ id: 'r7', title: 'Mac and cheese', ingredients: ['pasta', 'cheese'] }), 7);
  r = setPref(setPref(r, 'kid', 'favourite'), 'dad', 'dislikes');
  const s = { id: 'r7', ...recipeSummary(r) };
  assert.ok(passes(s, { ...emptyFilters(), minRating: 7 }));
  assert.ok(passes(s, { ...emptyFilters(), favouriteOf: 'kid' }));
  assert.ok(!passes(s, { ...emptyFilters(), favouriteOf: 'dad' }));
  assert.ok(!passes(s, { ...emptyFilters(), avoidDislikedBy: ['dad'] }));
  assert.equal(setPref(r, 'kid', null).prefs.kid, undefined, 'back to not rated');
});

test('E and K: filters combine; clearing them brings everything back; meals are not changed', () => {
  const meals = [
    { id: 'a', ...recipeSummary(setRating(normaliseRecipe({ title: 'Chicken stir fry', ingredients: ['chicken', 'broccoli', 'rice'], prepMinutes: 20 }), 8)) },
    { id: 'b', ...recipeSummary(normaliseRecipe({ title: 'Chicken curry', ingredients: ['chicken', 'onion', 'rice'] })) },
    { id: 'c', ...recipeSummary(setRating(normaliseRecipe({ title: 'Lentil soup', ingredients: ['lentils', 'carrots'] }), 9)) },
  ];
  const f = { ...emptyFilters(), protein: ['chicken'], minRating: 7, includes: ['veg'] };
  assert.deepEqual(meals.filter((s) => passes(s, f)).map((s) => s.id), ['a']);
  assert.deepEqual(meals.filter((s) => passes(s, { ...emptyFilters(), protein: ['chicken'], trial: 'untried' })).map((s) => s.id), ['b']);
  assert.deepEqual(meals.filter((s) => passes(s, { ...emptyFilters(), protein: ['chicken'], minRating: 7, trial: 'untried' })).map((s) => s.id), [], 'every filter counts');
  assert.equal(meals.filter((s) => passes(s, emptyFilters())).length, 3);
  assert.deepEqual(meals.filter((s) => passes(s, { ...emptyFilters(), maxMinutes: 30 })).map((s) => s.id), ['a'], 'no time recorded is not "quick"');
  assert.deepEqual(describeFilters(f).map(([t]) => t), ['Chicken', 'with vegetables', 'rated 7+']);
});

test('facts and suitability come from the ingredients', () => {
  const f = recipeFacts(normaliseRecipe({ ingredients: ['500 g beef mince', '1 tin baked beans', 'brown rice', 'peanut butter'] }));
  assert.deepEqual(f.proteins.sort(), ['beef', 'legumes']);
  assert.ok(f.groups.includes('wholegrain') && f.groups.includes('legume'));
  assert.ok(f.allergens.includes('peanuts'));
  const s = { id: 'x', ...recipeSummary(normaliseRecipe({ title: 'x', ingredients: ['peanut butter', 'bread'] })) };
  assert.ok(!passes(s, { ...emptyFilters(), suitableFor: ['p'] }, { people: [normalisePerson({ id: 'p', name: 'P', allergies: ['peanuts'] })] }));
});

test('F: the weekly mix uses real ratings, and says when there are not enough', () => {
  const m = (id, o) => ({ id, ...recipeSummary(normaliseRecipe({ title: id, ...o })) });
  const meals = [
    m('fav1', { rating: 8 }), m('fav2', { rating: 9 }), m('kidsfav', { rating: 6, prefs: { kid: 'favourite' } }),
    m('new1', {}), m('meh', { tried: true }), m('awful', { rating: 2 }),
  ];
  assert.equal(mixGroup(meals[3]), 'untried');
  const slots = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, meal: 'dinner' }));
  const people = [normalisePerson({ id: 'kid', name: 'Mia' })];
  const r = proposeWeek({ meals, counts: { family: 4, individual: 0, untried: 2, other: 1 }, slots, people, seed: 'w' });
  const groups = r.picks.map((p) => p.group);
  assert.equal(groups.filter((g) => g === 'family').length, 2, 'only two meals are rated 7+');
  assert.equal(groups.filter((g) => g === 'untried').length, 1);
  assert.ok(!r.picks.some((p) => p.id === 'awful'), 'a strongly disliked meal is not offered as "other"');
  assert.deepEqual(r.shortfall.map((s) => [s.group, s.wanted, s.found]), [['family', 4, 2], ['untried', 2, 1]]);
  const ind = proposeWeek({ meals, counts: { individual: 1 }, slots, people });
  assert.match(ind.picks[0].reason, /Mia’s favourite/);
});

test('N, P, Q, R: one calculation for calories, charts and portions', () => {
  const n = mealNutrition(chickenRice.ingredients, 4, db);
  assert.equal(n.counted, 4, 'chicken, rice, salt and carrots are all weighed');
  assert.ok(n.kcal.known && n.kcal.serving > 150 && n.kcal.serving < 500, JSON.stringify(n.kcal));
  assert.equal(n.kcal.serving % 10, 0, 'no false precision');
  const n6 = mealNutrition(chickenRice.ingredients, 6, db);
  assert.ok(n6.kcal.serving < n.kcal.serving, 'more servings, less each');
  assert.equal(Math.round(n6.batch.kcal.value), Math.round(n.batch.kcal.value), 'same batch');
  const profile = nutrientProfile(n, db);
  assert.deepEqual(profile.map((c) => c.id), CATEGORIES.map((c) => c.id));
  assert.ok(profile.every((c) => c.score === null || (c.score >= 0 && c.score <= 1)));
  const mystery = mealNutrition([{ name: 'quinoa surprise', qty: 200, unit: 'g' }], 2, db);
  assert.equal(mystery.kcal.known, false, 'not matched: not known, not zero');
  assert.ok(nutrientProfile(mystery, db).filter((c) => c.id !== 'phyto').every((c) => c.score === null));
  const partial = mealNutrition([...chickenRice.ingredients, { name: 'mystery sauce', qty: 100, unit: 'g' }], 4, db);
  assert.match(partial.kcal.text, /^at least/);
  const people = kcalByPerson(n.kcal, [{ name: 'A', share: 1 }, { name: 'B', share: 0.5 }]);
  assert.equal(people[1].kcal, Math.round((n.kcal.serving * 0.5) / 10) * 10, 'a half portion, half the calories');
});

test('L and M: the week is looked at as a whole, and improvements are only proposals', () => {
  const occ = (day, title, ingredients, extra = {}) => {
    const r = normaliseRecipe({ title, ingredients });
    const n = mealNutrition(r.ingredients, 4, db);
    return { day, meal: 'dinner', title, kind: 'cooked', slotId: `s${day}`, facts: recipeFacts(r), profile: nutrientProfile(n, db), ...extra };
  };
  const week = [
    occ(0, 'Chicken and rice', ['chicken', 'rice']), occ(1, 'Beef and rice', ['beef mince', 'rice']),
    occ(2, 'Chicken and rice again', ['chicken', 'rice']), occ(3, 'Pork and rice', ['pork', 'rice']), occ(4, 'Fish and chips', ['fish', 'chips']),
  ];
  const a = analyseWeek(week);
  const ids = a.findings.map((f) => f.id);
  for (const id of ['veg', 'legume', 'wholegrain', 'carb-repeat']) assert.ok(ids.includes(id), id);
  assert.ok(a.partial, 'only suppers: not the whole diet');
  assert.ok(!a.findings.some((f) => /deficien/i.test(f.text)), 'no deficiency claims');
  const props = optimiseWeek({ analysis: a, occasions: week, people: [normalisePerson({ id: 'p', name: 'P', born: '1990-01-01' })], today: TODAY });
  assert.ok(props.length >= 2 && props.length <= 4);
  assert.ok(props.some((p) => p.kind === 'add' && p.food.group === 'veg'));
  assert.ok(props.some((p) => p.kind === 'swap' && p.to.id === 'brownrice'));
  assert.equal(new Set(props.map((p) => p.slotId)).size, props.length, 'one change per meal');
  assert.deepEqual(additionFor(props.find((p) => p.kind === 'add').food, 4).unit, 'g');
});

test('a new version from a planned meal keeps the original’s method, and points back to it', async () => {
  const { mealFromLink, isRecipe } = await import('../js/apps/meals/logic.js');
  const v = mealFromLink(JSON.stringify({ title: 'Soup (our version)', servings: 4, ingredients: [{ name: 'carrots', qty: 4 }], variantOf: 'r1', instructions: ['Chop', 'Simmer'], prepMinutes: 10 }));
  assert.equal(v.variantOf, 'r1');
  assert.ok(isRecipe(v));
  assert.equal(v.rating, null, 'its own ratings start empty');
  assert.equal(mealFromLink('nope'), null);
});

test('batch size in halves, keeping whole-only items whole: 12 pancakes with 2 eggs', () => {
  const pancakes = normaliseRecipe({ title: 'Pancakes', servings: 4, yield: { qty: 12, unit: 'pancakes' }, ingredients: [{ name: 'flour', qty: 250, unit: 'g' }, { name: 'eggs', qty: 2, unit: '' }, { name: 'milk', qty: 500, unit: 'ml' }] });
  assert.ok(wholeOnly(pancakes.ingredients[1]), 'eggs are whole-only unless untucked');
  assert.deepEqual(batchMultiplier(pancakes.ingredients, 4, 5), { m: 1.5, makes: 6, spare: 1, blocked: [] });
  assert.equal(batchMultiplier(pancakes.ingredients, 4, 4).m, 1);
  assert.equal(batchMultiplier(pancakes.ingredients, 4, 8).m, 2);
  const three = normaliseRecipe({ servings: 4, ingredients: [{ name: 'eggs', qty: 3, unit: '' }] });
  const b = batchMultiplier(three.ingredients, 4, 5);
  assert.equal(b.m, 2, '3 eggs x1.5 would be 4.5 - so x2');
  assert.deepEqual(b.blocked, ['eggs']);
  const loose = normaliseRecipe({ servings: 4, ingredients: [{ name: 'eggs', qty: 3, unit: '', whole: false }] });
  assert.equal(batchMultiplier(loose.ingredients, 4, 5).m, 1.5, 'untick whole and it may be split');
});

test('our own items as ingredients: home-made mayo opens into its ingredients for shopping and nutrition', async () => {
  const mayo = normaliseRecipe({ id: 'mayo', title: 'Home-made mayo', asIngredient: true, yield: { qty: 300, unit: 'ml' }, ingredients: [{ name: 'eggs', qty: 2, unit: '' }, { name: 'olive oil', qty: 250, unit: 'ml' }] });
  const salad = normaliseRecipe({ id: 'salad', title: 'Egg salad', servings: 4, ingredients: [{ name: 'eggs', qty: 6, unit: '' }, { name: 'Home-made mayo', qty: 150, unit: 'ml', recipeId: 'mayo' }] });
  const map = await collectRecipes(salad.ingredients, async (id) => (id === 'mayo' ? mayo : null));
  assert.deepEqual([...map.keys()], ['mayo']);
  const flat = expandIngredients(salad.ingredients, 1, (id) => map.get(id));
  assert.deepEqual(flat.map((i) => [i.name, i.qty, i.unit]), [['eggs', 6, ''], ['eggs', 1, ''], ['olive oil', 125, 'ml']], 'half the mayo batch');
  const n = mealNutrition(salad.ingredients, 4, db, { recipes: map });
  const without = mealNutrition([salad.ingredients[0]], 4, db);
  assert.ok(n.kcal.serving > without.kcal.serving + 100, 'the mayo’s oil counts');
  const loop = normaliseRecipe({ id: 'loop', title: 'Loop', yield: { qty: 1, unit: 'jar' }, ingredients: [{ name: 'Loop', qty: 1, unit: 'jar', recipeId: 'loop' }] });
  assert.equal(expandIngredients(loop.ingredients, 1, () => loop).length, 1, 'a loop stops instead of running forever');
});

test('home-made items stay apart for shopping, so "already made" can leave them out', async () => {
  const { splitOwn, planShopping, ingredientsForPlan } = await import('../js/apps/meals/logic.js');
  const { readSend } = await import('../js/apps/shopping/logic.js');
  const mayo = normaliseRecipe({ id: 'mayo', title: 'Home-made mayo', asIngredient: true, yield: { qty: 300, unit: 'ml' }, ingredients: [{ name: 'eggs', qty: 2, unit: '' }, { name: 'olive oil', qty: 250, unit: 'ml' }] });
  const salad = normaliseRecipe({ id: 'salad', title: 'Egg salad', servings: 4, ingredients: [{ name: 'eggs', qty: 6, unit: '' }, { name: 'Home-made mayo', qty: 150, unit: 'ml', recipeId: 'mayo' }] });
  const recipes = new Map([['mayo', mayo], ['salad', salad]]);
  const s = splitOwn(salad.ingredients, 1, (id) => recipes.get(id));
  assert.deepEqual(s.base.map((i) => [i.name, i.qty]), [['eggs', 6]]);
  assert.deepEqual(s.own.map((g) => [g.name, g.qty, g.unit, g.items.map((i) => `${i.qty} ${i.name}`)]), [['Home-made mayo', 150, 'ml', ['1 eggs', '125 olive oil']]]);
  let plan = setSlot(normalisePlan({}, MONDAY), 0, 'lunch', { recipeId: 'salad', title: 'Egg salad', servings: 4 });
  plan = setSlot(plan, 2, 'lunch', { recipeId: 'salad', title: 'Egg salad', servings: 4 });
  const week = planShopping(plan, recipes);
  assert.equal(week.own.length, 1, 'the same mayo from two meals is one group');
  assert.equal(week.own[0].qty, 300);
  assert.equal(week.items.find((i) => i.name === 'eggs').qty, 12);
  assert.equal(ingredientsForPlan(plan, recipes).find((i) => i.name === 'eggs').qty, 14, 'all together: 12 + 2 from the mayo');
  const sent = readSend(JSON.stringify({ source: 'week:x', items: week.items, own: week.own }));
  assert.equal(sent.own[0].items.length, 2);
});

test('ingredients come in from a .csv file, with or without a header', async () => {
  const { ingredientsFromCSV, INGREDIENT_CSV_TEMPLATE } = await import('../js/apps/meals/logic.js');
  assert.deepEqual(ingredientsFromCSV(INGREDIENT_CSV_TEMPLATE).map((i) => [i.name, i.qty, i.unit, i.note]), [['flour', 200, 'g', ''], ['eggs', 2, '', ''], ['milk', 300, 'ml', 'full cream']]);
  assert.deepEqual(ingredientsFromCSV('Unit;Name;Amount\ngrams;sugar;8\n;salt;\n').map((i) => [i.name, i.qty, i.unit]), [['sugar', 8, 'g'], ['salt', null, '']], 'any column order, ; as separator');
  assert.deepEqual(ingredientsFromCSV('200,g,flour\n2,eggs\n').map((i) => [i.qty, i.unit, i.name]), [[200, 'g', 'flour'], [2, '', 'eggs']], 'no header: read like typed lines');
  assert.deepEqual(ingredientsFromCSV(''), []);
});

test('an idea is applied to ingredient lines: add a usual amount, or swap one food for another', async () => {
  const { applyIdea } = await import('../js/apps/mealplan/logic.js');
  const { GUIDE } = await import('../js/apps/assistant/guide.js');
  const spinach = GUIDE.find((g) => g.id === 'spinach') ?? GUIDE.find((g) => g.fdc);
  const lines = [{ name: 'lettuce - iceberg', qty: 0.5, unit: 'head, medium', each: 539, fdcId: 169248 }, { name: 'peas', qty: 200, unit: 'g' }];
  const added = applyIdea(lines, { add: spinach.id }, 4);
  assert.equal(added.length, 3);
  assert.equal(added[2].name, spinach.name);
  assert.equal(added[2].unit, 'g');
  const lettuce = GUIDE.find((g) => /lettuce/.test([g.name, ...g.also].join(' ')));
  if (lettuce) {
    const swapped = applyIdea(lines, { swap: [lettuce.id, spinach.id] }, 4);
    assert.equal(swapped[0].name, spinach.name);
    assert.equal(swapped[0].unit, 'g', 'a size of the old food becomes grams');
    assert.equal(swapped[0].qty, 270);
    assert.equal(swapped[0].each, undefined);
    assert.equal(swapped[1].name, 'peas');
  }
  assert.equal(applyIdea(lines, { add: 'no-such-food' }, 4), null);
});
