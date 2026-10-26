// What a meal holds: one calculation behind every calorie figure, spider chart
// and weekly analysis in the Meals section, so they can never disagree. Pure:
// the caller passes the food database.
//
// 1. Each ingredient is matched to a food: its Calorie Checker link, else a
//    food the Meal Assistant's guide recognises by name. Nothing is guessed
//    from a loose text search.
// 2. Its weight comes from the amount: grams and kilos exactly; millilitres,
//    spoons and cups as if water (marked approximate); counted things ("2 eggs")
//    from the food's own "1 medium/large" portion in USDA data.
// 3. Amounts are added up. An ingredient that could not be matched or weighed
//    is counted as MISSING - never as zero - and every figure says how complete
//    it is.
//
// Scores for the six nutrient types compare one serving with a reference adult
// (National Academies DRIs, the average of a 19-50 year old man and woman):
// a nutrient scores 1 when one serving gives a third of the day's reference -
// a meal-sized share - and 0 when it gives none. A type's score is the average
// of its nutrients that are known. It is a coverage estimate for comparing
// meals, not a percentage of anyone's needs and never a diagnosis.

import { amounts } from './food.js';
import { parseMeal } from './apps/assistant/logic.js';

/* --------------------------------------------------------- the reference adult */

// Daily reference values (RDA, or AI where no RDA exists). EPA+DHA: EFSA adequate intake.
export const REFERENCE = {
  carbs: 130, fibre: 31.5, protein: 51,
  ala: 1.35, epadha: 0.25,
  calcium: 1000, iron: 13, magnesium: 360, potassium: 3000, zinc: 9.5, phosphorus: 700, selenium: 55, copper: 0.9, manganese: 2.05,
  vitA: 800, vitC: 82.5, vitD: 15, vitE: 15, vitK: 105, thiamin: 1.15, riboflavin: 1.2, niacin: 15, pantothenic: 5, b6: 1.3, folate: 400, b12: 2.4, choline: 487,
};

// The six types and what each is judged on. `axes` have a reference; `listed` are shown as amounts only
// (limits such as saturated fat and sodium, or compounds with no established target).
export const CATEGORIES = [
  { id: 'carbs', label: 'Carbohydrates', axes: ['carbs', 'fibre'], listed: ['sugars'] },
  { id: 'fats', label: 'Functional fats', axes: ['ala', 'epadha'], listed: ['fat', 'monoFat', 'polyFat', 'satFat'] },
  { id: 'minerals', label: 'Minerals', axes: ['calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus', 'selenium', 'copper'], listed: ['manganese', 'iodine', 'sodium'] },
  { id: 'phyto', label: 'Phytonutrients', axes: ['red', 'orange', 'green', 'purple', 'white'], listed: ['betaCarotene', 'lycopene', 'lutein'] },
  { id: 'protein', label: 'Proteins and amino acids', axes: ['protein'], listed: [] },
  { id: 'vitamins', label: 'Vitamins and vitamin-like compounds', axes: ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'thiamin', 'riboflavin', 'niacin', 'pantothenic', 'b6', 'folate', 'b12', 'choline'], listed: [] },
];
export const COLOUR_LABEL = { red: 'Red', orange: 'Orange and yellow', green: 'Green', purple: 'Blue and purple', white: 'White and beige' };
export const SCALE_NOTE = 'Each axis compares one serving with a reference adult: the outer ring means a serving gives at least a third of the day’s reference amount (a meal-sized share). Phytonutrients are judged by plant colour variety, as no daily targets exist for them. A low score is not a deficiency, and a bigger shape is not a "better" meal.';

/* ------------------------------------------------------------ weighing */

// Kitchen basics the meal guide does not cover, matched to exact USDA records.
const BASICS = [
  [/\bsalt\b/i, 173468], [/\b(black )?pepper\b(?! ?(red|green|yellow|sweet|bell))/i, 170931], [/\bgarlic\b/i, 169230], [/\bginger\b/i, 169231],
  [/\bflour\b/i, 168894], [/\bcumin\b/i, 170923], [/\bpaprika\b/i, 171329], [/\bcurry powder\b|\bmasala\b/i, 170924], [/\bcinnamon\b/i, 171320],
  [/\b(chopped |tinned |canned )?tomatoes?,? (tinned|canned|chopped)\b|\b(tinned|canned|chopped) tomatoes\b/i, 170051], [/\bcream\b/i, 170859],
  [/\bbeef stock\b/i, 172883], [/\bstock\b|\bbroth\b/i, 172884], [/\bwater\b/i, 174158], [/\bturmeric\b/i, 172231], [/\boregano\b/i, 171328],
  [/\bchil+i powder\b/i, 171319], [/\bhot sauce\b|\bpeppadew\b/i, 174527], [/\bsoy sauce\b/i, 174278], [/\bvinegar\b/i, 172237], [/\blemon juice\b/i, 167747],
  [/\bbrown sugar\b/i, 168833], [/\bcorn ?(starch|flour)\b|\bmaizena\b/i, 169698], [/\bbaking powder\b/i, 172803], [/\bparsley\b/i, 170416],
  [/\bbasil\b/i, 171317], [/\bthyme\b/i, 170938], [/\bcoriander\b|\bcilantro\b/i, 169997],
];


const ML = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 240, cups: 240 };
const G = { g: 1, kg: 1000 };

function portionGrams(food, unit) {
  const ps = food.portions;
  if (unit === 'slice' || unit === 'slices') return ps.find((p) => /slice/i.test(p.label))?.grams ?? null;
  if (unit === 'clove' || unit === 'cloves') return ps.find((p) => /clove/i.test(p.label))?.grams ?? 3;
  if (unit === 'tin' || unit === 'tins' || unit === 'can' || unit === 'cans') return 400;
  if (unit === 'pinch') return 0.4;
  if (unit) return null;
  const one = ps.filter((p) => /^1 (medium|large|small|whole)?\b/i.test(p.label) && !/cup|tbsp|tsp|oz|slice/i.test(p.label));
  return (one.find((p) => /medium/i.test(p.label)) ?? one.find((p) => /large/i.test(p.label)) ?? one[0])?.grams ?? null;
}

/**
 * Match and weigh one ingredient.
 * @returns {{ ingredient, food|null, grams|null, how: 'linked'|'matched'|'unmatched', approx: boolean }}
 */
export function resolveIngredient(i, db) {
  let food = i.fdcId ? db.get(i.fdcId) : null;
  let how = food ? 'linked' : 'unmatched';
  if (!food) {
    // The guide first (it knows "pap", "mince", "maas"); then the kitchen basics.
    const g = parseMeal(i.name).items[0];
    const basic = g ? null : BASICS.find(([re]) => re.test(i.name));
    const id = g?.fdc ?? basic?.[1];
    if (id) { food = db.get(id); how = food ? 'matched' : 'unmatched'; }
  }
  if (!food || i.qty == null) return { ingredient: i, food, grams: null, how, approx: false };
  if (G[i.unit]) return { ingredient: i, food, grams: i.qty * G[i.unit], how, approx: false };
  if (ML[i.unit]) return { ingredient: i, food, grams: i.qty * ML[i.unit], how, approx: true };
  const each = portionGrams(food, i.unit);
  return { ingredient: i, food, grams: each ? each * i.qty : null, how, approx: each !== null };
}

/* ------------------------------------------------------------ adding up */

/**
 * What a meal holds, for `servings` servings.
 * @returns { batch, perServing: {key: {value, missing}}, resolved, counted, of, approx, kcal, colours }
 */
export function mealNutrition(ingredients, servings, db, { recipes = null, depth = 0 } = {}) {
  const resolved = ingredients.map((i) => {
    // One of our own items (home-made mayo): what it holds per unit of its batch, times the amount used.
    const sub = i.recipeId && recipes ? recipes.get(i.recipeId) : null;
    if (sub && sub.yield?.qty && i.qty != null && depth < 4) {
      const inner = mealNutrition(sub.ingredients, 1, db, { recipes, depth: depth + 1 });
      const share = i.qty / sub.yield.qty;
      const values = Object.fromEntries(Object.entries(inner.batch).map(([k, t]) => [k, t.missing ? null : t.value * share]));
      return { ingredient: i, food: null, grams: inner.counted ? 1 : null, how: 'own', approx: inner.approx, values };
    }
    return resolveIngredient(i, db);
  });
  const batch = {};
  for (const k of db.keys) batch[k] = { value: 0, missing: 0 };
  for (const r of resolved) {
    const a = r.values ?? (r.grams !== null ? amounts(r.food, r.grams) : null);
    for (const k of db.keys) {
      if (!a || a[k] === null) batch[k].missing += 1; else batch[k].value += a[k];
    }
  }
  batch.epadha = { value: (batch.epa?.value ?? 0) + (batch.dha?.value ?? 0), missing: Math.max(batch.epa?.missing ?? 0, batch.dha?.missing ?? 0) };
  const per = Object.fromEntries(Object.entries(batch).map(([k, t]) => [k, { value: t.value / servings, missing: t.missing }]));
  const counted = resolved.filter((r) => r.grams !== null).length;
  const { items } = parseMeal(ingredients.map((i) => i.name).join(', '));
  return {
    batch, perServing: per, resolved, counted, of: ingredients.length,
    approx: resolved.some((r) => r.approx),
    kcal: kcalEstimate(batch.kcal, servings, counted, ingredients.length),
    colours: [...new Set(items.filter((f) => f.group === 'veg' || f.group === 'fruit').map((f) => f.colour).filter(Boolean))],
    hasPlants: items.some((f) => ['veg', 'fruit', 'legume', 'nutseed'].includes(f.group)),
  };
}

/** Calories without false precision: rounded to 10, "at least" when some ingredients could not be counted. */
export function kcalEstimate(t, servings, counted, of) {
  if (!of || !counted) return { known: false, complete: false, batch: null, serving: null, text: 'not known' };
  const complete = t.missing === 0;
  const r10 = (n) => Math.round(n / 10) * 10;
  const batch = r10(t.value);
  const serving = r10(t.value / servings);
  return { known: true, complete, batch, serving, counted, of, text: `${complete ? 'about' : 'at least'} ${serving} kcal a serving` };
}

/* ------------------------------------------------------------ the six types */

/**
 * Scores for one serving: per type a 0-1 score (null when nothing is known),
 * the axes behind it (with amounts and the reference), and the listed amounts.
 */
export function nutrientProfile(n, db) {
  const meta = (k) => (k === 'epadha' ? { label: 'Omega-3 EPA + DHA', unit: 'g' } : db.meta[k] ?? { label: k, unit: '' });
  return CATEGORIES.map((c) => {
    if (c.id === 'phyto') {
      const axes = c.axes.map((colour) => ({ key: colour, label: COLOUR_LABEL[colour], value: n.colours.includes(colour) ? 1 : 0, frac: n.colours.includes(colour) ? 1 : 0, ref: null, unit: '' }));
      const unknown = !n.hasPlants && n.counted < n.of;
      return {
        ...c, axes, basis: 'colour variety',
        score: unknown ? null : Math.min(n.colours.length / 3, 1),
        list: c.listed.map((k) => ({ key: k, ...meta(k), value: n.perServing[k]?.missing ? null : n.perServing[k]?.value ?? null })),
      };
    }
    const axes = c.axes.map((k) => {
      const t = n.perServing[k];
      const known = t && t.missing < n.of && n.counted > 0;
      const value = known ? t.value : null;
      return { key: k, ...meta(k), value, partial: known && t.missing > 0, ref: REFERENCE[k], frac: value === null ? null : Math.min(value / (REFERENCE[k] / 3), 1) };
    });
    const known = axes.filter((a) => a.frac !== null);
    return {
      ...c, axes, basis: 'reference adult',
      score: known.length ? known.reduce((s, a) => s + a.frac, 0) / known.length : null,
      list: c.listed.map((k) => ({ key: k, ...meta(k), value: n.perServing[k] && n.perServing[k].missing < n.of && n.counted > 0 ? n.perServing[k].value : null })),
    };
  });
}

/** Calories each person would eat, from their share of a standard portion (one serving). */
export function kcalByPerson(kcal, shares) {
  if (!kcal.known) return shares.map((s) => ({ ...s, kcal: null }));
  return shares.map((s) => ({ ...s, kcal: Math.round((kcal.serving * s.share) / 10) * 10 }));
}
