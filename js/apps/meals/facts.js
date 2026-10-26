// What a meal is made of, read from its ingredients with the Meal Assistant's
// food guide: protein and carbohydrate sources, fats, food groups, plant
// colours, allergens and animal foods. Used for the planner's filters, the
// recipe index and the weekly analysis - one reading for all of them. Pure.
//
// Only what the guide recognises is counted; an ingredient it does not know
// adds nothing rather than being guessed at.

import { parseMeal } from '../assistant/logic.js';

export const PROTEIN = {
  chicken: 'Chicken', beef: 'Beef', pork: 'Pork', fish: 'Fish', eggs: 'Eggs', legumes: 'Beans, lentils and soy', dairy: 'Dairy',
};
export const CARB = { rice: 'Rice', pasta: 'Pasta', potato: 'Potatoes', bread: 'Bread', maize: 'Maize (pap, samp)', oats: 'Oats' };
export const GROUP = {
  veg: 'Vegetables', fruit: 'Fruit', legume: 'Legumes', wholegrain: 'Whole grains', nutseed: 'Nuts and seeds', dairy: 'Dairy', oilyfish: 'Oily fish',
};

const PROTEIN_OF = {
  chicken: 'chicken', liver: 'beef', beef: 'beef', biltong: 'beef', boerewors: 'pork', pork: 'pork', bacon: 'pork',
  fish: 'fish', salmon: 'fish', pilchards: 'fish', tuna: 'fish', egg: 'eggs',
  tofu: 'legumes', lentils: 'legumes', beans: 'legumes', bakedbeans: 'legumes', chickpeas: 'legumes', hummus: 'legumes',
  cheese: 'dairy', yoghurt: 'dairy', maas: 'dairy', softcheese: 'dairy',
};
const CARB_OF = { rice: 'rice', brownrice: 'rice', pasta: 'pasta', potato: 'potato', chips: 'potato', sweetpotato: 'potato', bread: 'bread', wholegrain: 'bread', pap: 'maize', samp: 'maize', corn: 'maize', oats: 'oats' };
const WHOLEGRAIN = new Set(['brownrice', 'wholegrain', 'oats']);
const OILY = new Set(['salmon', 'pilchards']);
const FATS = { avocado: 'Avocado', oil: 'Olive or seed oil', butter: 'Butter', margarine: 'Margarine', salmon: 'Oily fish', pilchards: 'Oily fish', peanutbutter: 'Nuts and seeds', peanuts: 'Nuts and seeds', almonds: 'Nuts and seeds', sunflowerseeds: 'Nuts and seeds', pumpkinseeds: 'Nuts and seeds', chia: 'Nuts and seeds', flax: 'Nuts and seeds', cheese: 'Dairy' };

const uniq = (xs) => [...new Set(xs)];

/** The facts of one meal or recipe (anything with ingredients, or just a title). */
export function recipeFacts(recipe) {
  const text = recipe.ingredients?.length ? recipe.ingredients.map((i) => i.name).join(', ') : recipe.title ?? '';
  const { items } = parseMeal(text);
  const ids = items.map((f) => f.id);
  const groups = [];
  for (const f of items) {
    if (f.group === 'veg') groups.push('veg');
    if (f.group === 'fruit') groups.push('fruit');
    if (f.group === 'legume') groups.push('legume');
    if (f.group === 'nutseed') groups.push('nutseed');
    if (f.group === 'dairy') groups.push('dairy');
    if (WHOLEGRAIN.has(f.id)) groups.push('wholegrain');
    if (OILY.has(f.id)) groups.push('oilyfish');
  }
  return {
    foods: uniq(ids),
    proteins: uniq(ids.map((id) => PROTEIN_OF[id]).filter(Boolean)),
    carbs: uniq(ids.map((id) => CARB_OF[id]).filter(Boolean)),
    fats: uniq(ids.map((id) => FATS[id]).filter(Boolean)),
    groups: uniq(groups),
    colours: uniq(items.filter((f) => f.group === 'veg' || f.group === 'fruit').map((f) => f.colour).filter(Boolean)),
    plants: uniq(items.filter((f) => ['veg', 'fruit', 'legume', 'nutseed'].includes(f.group)).map((f) => f.id)),
    allergens: uniq([...(recipe.allergens ?? []), ...items.flatMap((f) => f.allergens)]),
    animal: uniq(items.map((f) => f.animal).filter(Boolean)),
  };
}

/** Can someone with these allergies and this diet eat it, as far as its ingredients show? */
export function suitableFor(facts, person) {
  if (facts.allergens.some((a) => person.allergies?.includes(a))) return false;
  const diet = person.diet ?? [];
  const a = facts.animal;
  if (diet.includes('vegan') && a.length) return false;
  if (diet.includes('vegetarian') && a.some((x) => ['meat', 'beef', 'pork', 'fish'].includes(x))) return false;
  if (diet.includes('pescatarian') && a.some((x) => ['meat', 'beef', 'pork'].includes(x))) return false;
  if ((diet.includes('halal') || diet.includes('kosher') || diet.includes('no-pork')) && a.includes('pork')) return false;
  if (diet.includes('no-beef') && a.includes('beef')) return false;
  return true;
}

/* ----------------------------------------------------------- filters */

export const TRIAL = { untried: 'Not tried yet', unrated: 'Tried, not rated', tried: 'Tried' };
export const MEAL_TAGS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Supper', snack: 'Snack' };

export const emptyFilters = () => ({
  protein: [], carb: [], includes: [], minRating: null, trial: null, favouriteOf: null, likedBy: null,
  avoidDislikedBy: [], suitableFor: [], exclude: '', have: '', maxMinutes: null, mealType: null, maxKcal: null,
});

const words = (s) => String(s ?? '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Does one meal's summary pass every chosen filter? Summaries carry the facts
 * (recipeSummary), the rating, trial status and preferences. A filter that needs
 * something the meal does not record (a time, calories) leaves that meal out -
 * it is never assumed to pass.
 * @param est     optional { kcalServing } worked out from the full recipe
 * @param people  profiles, for "suitable for" (allergies, diet)
 */
export function passes(s, f, { people = [], est = null } = {}) {
  const has = (list, want) => want.every((x) => list.includes(x));
  if (f.protein.length && !f.protein.some((p) => s.proteins?.includes(p))) return false;
  if (f.carb.length && !f.carb.some((c) => s.carbs?.includes(c))) return false;
  if (f.includes.length && !has(s.groups ?? [], f.includes)) return false;
  if (f.minRating !== null && !(s.rating !== null && s.rating !== undefined && s.rating >= f.minRating)) return false;
  if (f.trial === 'untried' && s.tried) return false;
  if (f.trial === 'unrated' && !(s.tried && s.rating == null)) return false;
  if (f.trial === 'tried' && !s.tried) return false;
  if (f.favouriteOf && s.prefs?.[f.favouriteOf] !== 'favourite') return false;
  if (f.likedBy && !['favourite', 'likes'].includes(s.prefs?.[f.likedBy])) return false;
  if (f.avoidDislikedBy.some((id) => s.prefs?.[id] === 'dislikes')) return false;
  for (const id of f.suitableFor) {
    const p = people.find((x) => x.id === id);
    if (p && !suitableFor(s, p)) return false;
  }
  const text = `${s.title} ${(s.ingredientNames ?? []).join(' ')}`.toLowerCase();
  if (words(f.exclude).some((w) => text.includes(w))) return false;
  if (words(f.have).length && !words(f.have).some((w) => text.includes(w))) return false;
  if (f.maxMinutes !== null && !(s.minutes && s.minutes < f.maxMinutes)) return false;
  if (f.mealType && !(s.tags ?? []).includes(f.mealType) && !(f.mealType === 'dinner' && (s.tags ?? []).includes('supper'))) return false;
  if (f.maxKcal !== null && !(est?.kcalServing && est.kcalServing <= f.maxKcal)) return false;
  return true;
}

/** The active filters in words, each with the change that removes it. */
export function describeFilters(f, people = []) {
  const name = (id) => people.find((p) => p.id === id)?.name ?? 'someone';
  const out = [];
  for (const p of f.protein) out.push([PROTEIN[p], { protein: f.protein.filter((x) => x !== p) }]);
  for (const c of f.carb) out.push([CARB[c], { carb: f.carb.filter((x) => x !== c) }]);
  for (const g of f.includes) out.push([`with ${GROUP[g].toLowerCase()}`, { includes: f.includes.filter((x) => x !== g) }]);
  if (f.minRating !== null) out.push([`rated ${f.minRating}+`, { minRating: null }]);
  if (f.trial) out.push([TRIAL[f.trial], { trial: null }]);
  if (f.favouriteOf) out.push([`${name(f.favouriteOf)}’s favourites`, { favouriteOf: null }]);
  if (f.likedBy) out.push([`liked by ${name(f.likedBy)}`, { likedBy: null }]);
  for (const id of f.avoidDislikedBy) out.push([`not disliked by ${name(id)}`, { avoidDislikedBy: f.avoidDislikedBy.filter((x) => x !== id) }]);
  for (const id of f.suitableFor) out.push([`suits ${name(id)}`, { suitableFor: f.suitableFor.filter((x) => x !== id) }]);
  if (f.exclude.trim()) out.push([`without ${f.exclude.trim()}`, { exclude: '' }]);
  if (f.have.trim()) out.push([`uses ${f.have.trim()}`, { have: '' }]);
  if (f.maxMinutes !== null) out.push([f.maxMinutes === 60 ? 'under 1 hour' : `under ${f.maxMinutes} min`, { maxMinutes: null }]);
  if (f.mealType) out.push([MEAL_TAGS[f.mealType], { mealType: null }]);
  if (f.maxKcal !== null) out.push([`${f.maxKcal} kcal or less a serving`, { maxKcal: null }]);
  return out;
}
