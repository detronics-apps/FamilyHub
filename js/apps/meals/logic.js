// Meals & Recipes (product plan section 13): meals, a weekly plan, and the
// shopping list that follows from it. Pure - no DOM.
//
// One record kind: a meal is a name and its ingredients; adding a method (steps)
// makes it a recipe. So every recipe is a meal, not every meal is a recipe.
// An ingredient may carry `fdcId`, a link to the shared food database (meals
// built in Calorie Checker do), which lets calories per serving be worked out.
//
// Nutrition values a person types in are shown as "supplied"; anything else
// is "not known". Looking foods up and meal ideas are separate mini-apps in
// the Meals section (Calorie Checker, Meal Assistant) on the shared food database.

import { addDays, dayDiff, weekStart } from '../../dates.js';
import { split, numOrNull } from '../../importer.js';
import { ALLERGENS } from '../../model.js';
import { recipeFacts } from './facts.js';

export { ALLERGENS };

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const NUTRIENTS = [['calories', 'kcal'], ['protein', 'g'], ['carbs', 'g'], ['fat', 'g'], ['fibre', 'g']];

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
const lines = (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim()).filter(Boolean);

/* ------------------------------------------------------------- units */

// Units that can safely be added together, by family, with their size in the
// family's base unit. Anything else (cups, tins, "a pinch") is only combined
// with exactly the same unit - never converted (plan 13.3).
const UNITS = {
  g: ['mass', 1], gram: ['mass', 1], grams: ['mass', 1], kg: ['mass', 1000],
  ml: ['volume', 1], l: ['volume', 1000], litre: ['volume', 1000], litres: ['volume', 1000], liter: ['volume', 1000],
};
const CANON = { gram: 'g', grams: 'g', litre: 'l', litres: 'l', liter: 'l' };

export const unitKey = (u) => CANON[String(u || '').toLowerCase()] ?? String(u || '').toLowerCase().replace(/\.$/, '');

/** "200 g flour", "1/2 cup sugar", "2 eggs", "1 1/2 tsp salt", "salt" */
export function parseIngredient(line) {
  const text = String(line || '').trim();
  const m = /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-zA-Z.]+)?\s+(.*)$/.exec(text);
  if (!m) return { name: text, qty: null, unit: '' };
  const qty = m[1].split(/\s+/).reduce((sum, part) => {
    if (part.includes('/')) { const [a, b] = part.split('/').map(Number); return sum + (b ? a / b : 0); }
    return sum + Number(part.replace(',', '.'));
  }, 0);
  const unit = m[2] ?? '';
  const known = UNITS[unitKey(unit)] || ['tsp', 'tbsp', 'cup', 'cups', 'tin', 'tins', 'can', 'cans', 'clove', 'cloves', 'pinch', 'bunch', 'slice', 'slices', 'pack', 'packs'].includes(unit.toLowerCase());
  // "2 eggs": the word after the number is the thing, not a unit.
  return known ? { qty, unit: unitKey(unit), name: m[3].trim() } : { qty, unit: '', name: `${unit} ${m[3]}`.trim() };
}

/** "1000 ml stock" reads as "1 l stock"; other units are left exactly as given. */
export function formatIngredient(i) {
  let { qty, unit } = i;
  if (qty != null && unit === 'g' && qty >= 1000) { qty /= 1000; unit = 'kg'; }
  if (qty != null && unit === 'ml' && qty >= 1000) { qty /= 1000; unit = 'l'; }
  return [qty != null ? fmtQty(qty) : null, unit || null, i.name].filter(Boolean).join(' ');
}

/** Sensible kitchen precision: 1.5, 250, 0.33 -> "1/3"-ish as 0.33. */
export function fmtQty(q) {
  if (q == null) return '';
  if (q >= 100) return String(Math.round(q));
  if (q >= 10) return String(Math.round(q * 10) / 10);
  return String(Math.round(q * 100) / 100);
}

/* ------------------------------------------------------------ recipes */

export function normaliseRecipe(r = {}) {
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : lines(r.ingredients).map(parseIngredient))
    .map((i) => (typeof i === 'string' ? parseIngredient(i) : i))
    .filter((i) => i && str(i.name))
    .map((i) => ({
      name: str(i.name, 120), qty: num(i.qty), unit: unitKey(str(i.unit, 20)), note: str(i.note, 120),
      ...(Number.isInteger(i.fdcId) && i.fdcId > 0 ? { fdcId: i.fdcId } : {}),
      ...(str(i.recipeId, 40) ? { recipeId: str(i.recipeId, 40) } : {}),   // one of our own meals used as an ingredient (home-made mayo)
      ...(typeof i.whole === 'boolean' ? { whole: i.whole } : {}),          // can only be used whole (eggs)
    }))
    .slice(0, 80);
  const nutrition = {};
  for (const [k] of NUTRIENTS) { const v = num(r.nutrition?.[k]); if (v != null) nutrition[k] = v; }
  return {
    ...r,
    title: str(r.title, 200) || 'Untitled meal',
    description: str(r.description),
    servings: Math.max(1, Math.round(num(r.servings) ?? 4)),
    prepMinutes: num(r.prepMinutes),
    cookMinutes: num(r.cookMinutes),
    ingredients,
    instructions: lines(r.instructions).slice(0, 60),
    tags: lines(Array.isArray(r.tags) ? r.tags : String(r.tags ?? '').split(',')).map((t) => t.toLowerCase()).slice(0, 15),
    allergens: (Array.isArray(r.allergens) ? r.allergens : []).filter((a) => ALLERGENS.includes(a)),
    nutrition,                      // per serving, as supplied - never calculated
    notes: str(r.notes),           // general notes as typed in the form (older records: the only notes)
    source: str(r.source, 300),
    // Feedback. A rating only exists for a meal that has been tried; nothing is ever filled in.
    tried: r.tried === true || rating(r.rating) !== null,
    rating: rating(r.rating),
    prefs: prefsOf(r.prefs),
    noteLog: (Array.isArray(r.noteLog) ? r.noteLog : []).filter((n) => n && str(n.text)).slice(-200).map((n, i) => ({
      id: str(n.id, 40) || `n${i}`, at: str(n.at, 30), text: str(n.text, 1000),
      from: n.from === 'occurrence' ? 'occurrence' : 'recipe', occasion: str(n.occasion, 120),
    })),
    variantOf: str(r.variantOf, 40),   // set on a copy saved from a changed planned meal
    // What one batch makes ("12 pancakes", "300 ml"), and whether other recipes can use it as an ingredient.
    yield: { qty: num(r.yield?.qty), unit: str(r.yield?.unit, 30) },
    asIngredient: r.asIngredient === true,
  };
}

/* ----------------------------------------------------- feedback */

// What a family rating means. Individual preferences are kept apart from it:
// a 7/10 meal can be one child's favourite.
export const RATING_BANDS = [[1, 3, 'Strongly disliked'], [4, 5, 'Below average'], [6, 6, 'Acceptable'], [7, 8, 'Liked'], [9, 10, 'Family favourite']];
export const PREFS = { favourite: 'Favourite', likes: 'Likes', neutral: 'Neutral', dislikes: 'Dislikes' };

const rating = (v) => { const n = Number(v); return v !== null && v !== '' && Number.isInteger(n) && n >= 1 && n <= 10 ? n : null; };
const prefsOf = (v) => Object.fromEntries(Object.entries(v && typeof v === 'object' ? v : {}).filter(([k, x]) => /^[\w-]{1,40}$/.test(k) && PREFS[x]));

export const ratingMeaning = (n) => RATING_BANDS.find(([a, b]) => n >= a && n <= b)?.[2] ?? '';
/** 'untried' | 'unrated' (tried, no score yet) | 'rated' */
export const ratingState = (r) => (!r.tried ? 'untried' : r.rating === null ? 'unrated' : 'rated');

/** Rate (1-10) or clear the rating. Rating a meal marks it tried. */
export const setRating = (r, n) => ({ ...r, rating: rating(n), tried: r.tried || rating(n) !== null });
/** Not tried after all: the rating goes too - an untried meal never carries one. */
export const setTried = (r, tried) => ({ ...r, tried: Boolean(tried), rating: tried ? r.rating : null });
/** One person's preference; null clears it (back to "not rated"). */
export function setPref(r, personId, pref) {
  const prefs = { ...r.prefs };
  if (PREFS[pref]) prefs[personId] = pref; else delete prefs[personId];
  return { ...r, prefs };
}
/** Add a dated note. `from: 'occurrence'` marks a cooking note promoted from a planned meal. */
export function addNote(r, text, { from = 'recipe', occasion = '', at = new Date().toISOString().slice(0, 10), id = `n${Date.now().toString(36)}` } = {}) {
  if (!str(text)) return r;
  return { ...r, noteLog: [...r.noteLog, { id, at, text: str(text, 1000), from, occasion: str(occasion, 120) }] };
}

/** A meal becomes a recipe once it has a method. */
export const isRecipe = (r) => r.instructions.length > 0;

/** Index version: an index written before this lacks the facts and feedback below and is rebuilt once. */
export const SUMMARY_VERSION = 3;

/** What the index keeps per meal: enough to list, search and filter without opening each one. */
export function recipeSummary(r) {
  const facts = recipeFacts(r);
  return {
    ix: SUMMARY_VERSION,
    title: r.title,
    recipe: isRecipe(r),
    minutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) || null,
    servings: r.servings,
    tags: r.tags,
    allergens: facts.allergens,
    proteins: facts.proteins, carbs: facts.carbs, fats: facts.fats, groups: facts.groups, colours: facts.colours, plants: facts.plants, animal: facts.animal,
    ingredientNames: r.ingredients.map((i) => i.name).slice(0, 40),
    tried: r.tried ?? false, rating: r.rating ?? null, prefs: r.prefs ?? {},
    variantOf: r.variantOf ?? '',
    asIngredient: r.asIngredient ?? false, yield: r.yield ?? { qty: null, unit: '' },
  };
}

export const recipeText = (r) => [r.title, r.description, ...r.tags, ...r.ingredients.map((i) => i.name)].join(' ');

/** Ingredients for a different number of servings. Unknown quantities stay unknown. */
export function scaleIngredients(recipe, servings) {
  const f = Math.max(1, servings) / recipe.servings;
  return recipe.ingredients.map((i) => ({ ...i, qty: i.qty == null ? null : i.qty * f }));
}

/** Nutrition per serving as supplied, with every unknown nutrient said to be unknown. */
export function nutritionRows(recipe) {
  return NUTRIENTS.map(([k, unit]) => ({ key: k, unit, value: recipe.nutrition[k] ?? null, known: recipe.nutrition[k] != null }));
}

/**
 * After the ingredient lines are edited as text, keep each one's food-database
 * link where the name is unchanged.
 */
export function keepFoodLinks(ingredients, previous) {
  const links = new Map(previous.filter((i) => i.fdcId).map((i) => [i.name.toLowerCase(), i.fdcId]));
  return ingredients.map((i) => (links.has(i.name.toLowerCase()) ? { ...i, fdcId: links.get(i.name.toLowerCase()) } : i));
}

const GRAMS = { g: 1, kg: 1000 };
/**
 * Amounts per serving from ingredients linked to the food database and given in
 * grams. Says how many ingredients that covers, so a partial figure is never
 * shown as the whole.
 * @param get fdcId -> food (from the shared database)
 */
export function linkedNutrition(recipe, get, amountsOf) {
  const usable = recipe.ingredients.filter((i) => i.fdcId && i.qty != null && GRAMS[i.unit] && get(i.fdcId));
  const sum = {};
  for (const i of usable) {
    for (const [k, v] of Object.entries(amountsOf(get(i.fdcId), i.qty * GRAMS[i.unit]))) {
      const t = (sum[k] ??= { value: 0, missing: 0 });
      if (v === null) t.missing += 1; else t.value += v;
    }
  }
  const perServing = Object.fromEntries(Object.entries(sum).map(([k, t]) => [k, { value: t.value / recipe.servings, missing: t.missing }]));
  return { perServing, linked: usable.length, of: recipe.ingredients.length };
}

/**
 * A meal handed over in a link from This Week: a changed planned meal to save as
 * a new version (`variantOf` the original), or new ingredients for the original.
 * Anything odd is dropped.
 */
export function mealFromLink(param) {
  let raw;
  try { raw = JSON.parse(param); } catch { return null; }
  if (!raw || !Array.isArray(raw.ingredients)) return null;
  return normaliseRecipe({
    title: str(raw.title, 200), servings: raw.servings, ingredients: raw.ingredients, variantOf: str(raw.variantOf, 40), notes: str(raw.notes, 2000),
    instructions: raw.instructions, tags: raw.tags, prepMinutes: raw.prepMinutes, cookMinutes: raw.cookMinutes, allergens: raw.allergens, description: raw.description,
  });
}

/** A plate built in Calorie Checker, handed over in the link as a new meal. Anything odd is dropped. */
export function mealFromPlate(param) {
  let raw;
  try { raw = JSON.parse(param); } catch { return null; }
  if (!raw || !Array.isArray(raw.ingredients)) return null;
  return normaliseRecipe({
    title: str(raw.title, 200), servings: raw.servings,
    ingredients: raw.ingredients.slice(0, 80).map((i) => ({ name: i.name, qty: i.qty, unit: 'g', fdcId: i.fdcId })),
  });
}

/* ----------------------------------------------------------- the week */

export { weekStart };

export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/*
 * A plan is one week. Each slot is a PLANNED MEAL: one occasion of a meal on a
 * day, apart from the saved recipe it came from. Changing a slot (servings,
 * leftovers, its own ingredient changes, notes) never touches the recipe or
 * any other slot.
 *
 *   servings     portions eaten at this meal
 *   extra        portions cooked on top, not yet given a later meal ("decide later")
 *   reserve      leftovers set aside for a later meal: [{ id, date, meal, portions, note, additions }]
 *                - kept HERE, on the meal that is cooked, so the food is counted once:
 *                the later meal shows it but adds nothing to the shopping list except `additions`
 *   ingredients  null = the recipe's own; a list = this occasion's own (for `basis` servings)
 *   note         about this occasion only ("we added mushrooms this time")
 *   feedback     { rating, text } about this occasion's version
 *   portions     who eats how much here, if set by hand: { personId: share of a standard portion }
 *   guests       people joining this meal, by kind: [{ id, who: 'man'|'woman'|'teen'|'child'|'toddler' }]
 */
const slotIngredients = (v) => (Array.isArray(v) ? normaliseRecipe({ ingredients: v }).ingredients : null);
const ratingOrNull = (v) => { const n = Number(v); return v !== null && v !== '' && Number.isInteger(n) && n >= 1 && n <= 10 ? n : null; };

export function normaliseSlot(s) {
  const reserve = (Array.isArray(s.reserve) ? s.reserve : [])
    .filter((r) => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') && MEALS.includes(r.meal))
    .map((r, i) => ({
      id: str(r.id, 40) || `r${i}`, date: r.date, meal: r.meal,
      portions: Math.max(1, Math.round(num(r.portions) ?? 1)), note: str(r.note, 1000),
      additions: slotIngredients(r.additions) ?? [],
    }));
  const portions = Object.fromEntries(Object.entries(s.portions && typeof s.portions === 'object' ? s.portions : {})
    .map(([k, v]) => [k, num(v)]).filter(([k, v]) => /^[\w-]{1,40}$/.test(k) && v !== null && v > 0 && v <= 4));
  return {
    id: str(s.id, 40) || `s_${s.day}_${s.meal}`,
    day: s.day, meal: s.meal,
    recipeId: typeof s.recipeId === 'string' && s.recipeId ? s.recipeId : null,
    title: str(s.title, 200) || 'Meal',
    servings: Math.max(1, Math.round(num(s.servings) ?? 4)),
    extra: Math.max(0, Math.round(num(s.extra) ?? 0)),
    reserve,
    ingredients: slotIngredients(s.ingredients),
    basis: Math.max(1, Math.round(num(s.basis) ?? num(s.servings) ?? 4)),
    note: str(s.note, 1000),
    feedback: { rating: ratingOrNull(s.feedback?.rating), text: str(s.feedback?.text, 1000) },
    portions,
    // Guests joining this meal, by kind only ('man', 'woman', 'teen', 'child', 'toddler').
    guests: (Array.isArray(s.guests) ? s.guests : []).filter((g) => g && ['man', 'woman', 'teen', 'child', 'toddler'].includes(g.who)).slice(0, 30)
      .map((g, i) => ({ id: str(g.id, 40) || `g${i}`, who: g.who })),
  };
}

export function normalisePlan(p = {}, monday) {
  const slots = (Array.isArray(p.slots) ? p.slots : [])
    .filter((s) => s && Number.isInteger(s.day) && s.day >= 0 && s.day < 7 && MEALS.includes(s.meal))
    .map(normaliseSlot);
  return { ...p, week: p.week ?? monday, slots };
}

export const slotAt = (plan, day, meal) => plan.slots.find((s) => s.day === day && s.meal === meal) ?? null;

/** Put a meal in a slot (null empties it). The slot keeps its id and its leftover plan unless they are replaced. */
export function setSlot(plan, day, meal, slot) {
  const old = slotAt(plan, day, meal);
  const others = plan.slots.filter((s) => !(s.day === day && s.meal === meal));
  if (!slot) return { ...plan, slots: others };
  return { ...plan, slots: [...others, normaliseSlot({ reserve: old?.reserve, extra: old?.extra, ...slot, id: old?.id ?? slot.id, day, meal })] };
}

/** Change one planned meal (by id) - nothing else moves. */
export const updateSlot = (plan, id, patch) => ({ ...plan, slots: plan.slots.map((s) => (s.id === id ? normaliseSlot({ ...s, ...patch, id }) : s)) });

/** Reuse a previous week's plan for another week (same days and meals). Leftovers and notes stay behind. */
export const copyPlan = (from, monday) => ({ week: monday, slots: from.slots.map((s) => normaliseSlot({ ...s, reserve: [], extra: 0, note: '', feedback: null })) });

export const planId = (monday) => `week_${monday.replace(/-/g, '')}`;

/** Portions cooked for a planned meal: eaten now, extra, and set aside for later. */
export const prepared = (slot) => slot.servings + slot.extra + slot.reserve.reduce((n, r) => n + r.portions, 0);
export const reserved = (slot) => slot.reserve.reduce((n, r) => n + r.portions, 0);

/**
 * Leftover meals that land in a week, from the plans given (this week's and the
 * week before, so Sunday's leftovers can be Monday's lunch). Each is a view of
 * a reservation on the meal that was cooked - nothing extra to buy.
 */
export function leftoverMeals(plans, monday) {
  const end = addDays(monday, 6);
  const out = [];
  for (const plan of plans) {
    for (const s of plan.slots) {
      for (const r of s.reserve) {
        if (r.date < monday || r.date > end) continue;
        out.push({ ...r, day: dayDiff(monday, r.date), reservationId: r.id, title: s.title, recipeId: s.recipeId,
          from: { week: plan.week, slotId: s.id, date: addDays(plan.week, s.day), meal: s.meal } });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
}

/** Change or cancel (portions 0) one reservation. */
export function setReservation(plan, slotId, reservationId, patch) {
  return {
    ...plan,
    slots: plan.slots.map((s) => {
      if (s.id !== slotId) return s;
      const reserve = s.reserve.flatMap((r) => {
        if (r.id !== reservationId) return [r];
        const next = { ...r, ...patch };
        return next.portions > 0 ? [next] : [];
      });
      return normaliseSlot({ ...s, reserve });
    }),
  };
}

export function addReservation(plan, slotId, { date, meal, portions = 1, note = '' }, id = `r${Date.now().toString(36)}`) {
  return { ...plan, slots: plan.slots.map((s) => (s.id === slotId ? normaliseSlot({ ...s, reserve: [...s.reserve, { id, date, meal, portions, note, additions: [] }] }) : s)) };
}

/* ---------------------------------------------------------- shopping */

const nameKey = (n) => String(n).toLowerCase().trim().replace(/\s+/g, ' ').replace(/(es|s)$/, '');

/**
 * Add up ingredients that are the same thing in compatible units (g with kg,
 * ml with l, or exactly the same unit). Everything else stays a separate line
 * - "2 cups" and "300 g" of flour are not pretended into one number.
 */
export function combineIngredients(list) {
  const groups = new Map();
  for (const i of list) {
    const u = unitKey(i.unit);
    const fam = UNITS[u]?.[0] ?? `unit:${u}`;
    const key = `${nameKey(i.name)}|${fam}`;
    const g = groups.get(key) ?? { name: i.name, fam, base: 0, unknown: false, unit: u };
    if (i.qty == null) g.unknown = true;
    else g.base += UNITS[u] ? i.qty * UNITS[u][1] : i.qty;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => {
    let qty = g.base || null;
    let unit = g.unit;
    if (g.fam === 'mass') { unit = qty >= 1000 ? 'kg' : 'g'; if (qty != null && unit === 'kg') qty /= 1000; }
    if (g.fam === 'volume') { unit = qty >= 1000 ? 'l' : 'ml'; if (qty != null && unit === 'l') qty /= 1000; }
    return { name: g.name, qty, unit, note: g.unknown && qty != null ? 'plus some more (amount not given)' : g.unknown ? 'amount not given' : '' };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Salt, spices and the like are scaled too, but rounded to a quarter and marked
// "to taste"; things counted whole (eggs, onions) round to the nearest half.
const SEASONING = /\b(salt|pepper|spices?|herbs?|cumin|paprika|chilli|chili|turmeric|cinnamon|nutmeg|oregano|basil|thyme|parsley|coriander|rosemary|bay|garnish|stock cubes?|vanilla|baking powder|bicarbonate|yeast|curry powder|masala)\b/i;

const WHOLE = /^(tins?|cans?|packs?|bunch(es)?|cloves?|slices?)$/;

/** Can only be used whole: ticked so, or eggs counted by the piece unless untucked. */
export const wholeOnly = (i) => i.whole === true || (i.whole === undefined && !i.unit && /\beggs?\b/i.test(i.name));

/**
 * How many times to make a recipe for `needed` servings: in halves (x1, x1.5,
 * x2...), the smallest that is enough and keeps every whole-only ingredient
 * whole - 2 eggs can be made x1.5 (3 eggs) but never x1.25 (2.5 eggs).
 * @returns {{ m, makes, spare, blocked: [names that forced a bigger batch] }}
 */
export function batchMultiplier(ingredients, servings, needed) {
  const want = Math.max(needed, 0.01) / servings;
  const whole = ingredients.filter((i) => wholeOnly(i) && i.qty != null);
  const isWhole = (m) => whole.every((i) => Math.abs(i.qty * m - Math.round(i.qty * m)) < 0.01);
  const first = Math.max(0.5, Math.ceil(want * 2 - 1e-9) / 2);
  let m = first;
  while (!isWhole(m) && m < first + 10) m += 0.5;
  if (!isWhole(m)) m = first;
  const blocked = m > first ? whole.filter((i) => Math.abs(i.qty * first - Math.round(i.qty * first)) >= 0.01).map((i) => i.name) : [];
  return { m, makes: servings * m, spare: Math.max(0, servings * m - needed), blocked };
}

/**
 * Ingredient lines for `factor` times a recipe, with our own items (a line with
 * `recipeId`) opened into their own ingredients, scaled by how much of their
 * batch is used. A loop, an item that cannot be found, or one without a "makes"
 * amount stays as one line rather than being guessed.
 */
export function expandIngredients(lines, factor, getRecipe = () => null, depth = 0, seen = new Set()) {
  const out = [];
  for (const i of lines) {
    const sub = i.recipeId ? getRecipe(i.recipeId) : null;
    if (sub && sub.yield?.qty && i.qty != null && depth < 4 && !seen.has(sub.id)) {
      out.push(...expandIngredients(sub.ingredients, (i.qty * factor) / sub.yield.qty, getRecipe, depth + 1, new Set([...seen, sub.id])));
    } else out.push(scaleCarefully(i, factor));
  }
  return out;
}

/** Every meal our own ingredients point to, however deep (for loading them before working anything out). */
export async function collectRecipes(lines, get, map = new Map(), depth = 0) {
  for (const i of lines) {
    if (!i.recipeId || map.has(i.recipeId) || depth > 4) continue;
    const r = await get(i.recipeId);
    if (!r) continue;
    const rec = normaliseRecipe(r);
    map.set(rec.id ?? i.recipeId, rec);
    await collectRecipes(rec.ingredients, get, map, depth + 1);
  }
  return map;
}

/** One ingredient for `factor` times the recipe. Unknown amounts stay unknown. */
export function scaleCarefully(i, factor) {
  if (i.qty == null || factor === 1) return { ...i };
  const raw = i.qty * factor;
  if (SEASONING.test(i.name)) return { ...i, qty: Math.max(0.25, Math.round(raw * 4) / 4), note: [i.note, 'scaled - adjust to taste'].filter(Boolean).join('; ') };
  if (wholeOnly(i)) return { ...i, qty: Math.max(1, Math.round(raw)) };
  if (!i.unit) return { ...i, qty: Math.max(0.5, Math.round(raw * 2) / 2) };
  // Bought whole: tins, packs, bunches, cloves and slices round up.
  if (WHOLE.test(i.unit)) return { ...i, qty: Math.max(1, Math.ceil(raw - 0.01)) };
  return { ...i, qty: raw };
}

/** How many times the recipe is made for a planned meal (x1, x1.5...), keeping whole-only items whole. */
export function slotBatch(slot, recipe) {
  const list = slot.ingredients ?? recipe?.ingredients ?? [];
  const basis = slot.ingredients ? slot.basis : recipe?.servings ?? slot.servings;
  return { ...batchMultiplier(list, basis, prepared(slot)), basis };
}

/**
 * What one planned meal needs bought: its ingredients for the batch made (our
 * own items opened into theirs), plus what leftover meals add.
 */
export function slotNeeds(slot, recipe, getRecipe = () => null) {
  const list = slot.ingredients ?? recipe?.ingredients ?? null;
  const out = list ? expandIngredients(list, slotBatch(slot, recipe).m, getRecipe) : [];
  for (const r of slot.reserve) out.push(...r.additions);
  return out;
}

/**
 * Everything the week's planned meals need, added up. Leftovers are counted on
 * the meal that is cooked, once; a later meal eating them adds only its additions.
 */
export function ingredientsForPlan(plan, recipes) {
  const out = [];
  for (const s of plan.slots) out.push(...slotNeeds(s, s.recipeId ? recipes.get(s.recipeId) : null, (id) => recipes.get(id)));
  return combineIngredients(out);
}

// The shopping list itself lives in the Shopping mini-app (js/apps/shopping/logic.js).

export const isPastWeek = (monday, today) => dayDiff(addDays(monday, 6), today) > 0;

/* ---------------------------------------------------------- importing */

/** The recipes spreadsheet template (Settings > Bring in data, or the Import folder). */
export const IMPORTER = {
  kind: 'recipes', label: 'Recipes', singular: 'recipe', app: 'meals', collection: 'recipes', prefix: 'rec',
  columns: [
    { name: 'title', required: true, help: 'The recipe name.' },
    { name: 'servings', help: 'How many it serves (a number).' },
    { name: 'prep_minutes', help: 'Preparation time in minutes.' },
    { name: 'cook_minutes', help: 'Cooking time in minutes.' },
    { name: 'ingredients', help: 'One per line in the cell, or separated by ";" - e.g. "200 g flour; 2 eggs".' },
    { name: 'method', help: 'Steps, one per line in the cell, or separated by ";".' },
    { name: 'tags', help: 'Separated by commas, e.g. "quick, vegetarian".' },
    { name: 'contains', help: `Allergens, separated by commas: ${ALLERGENS.join(', ')}.` },
    { name: 'notes', help: 'Anything else.' },
    { name: 'source', help: 'Where it came from.' },
    ...NUTRIENTS.map(([k, unit]) => ({ name: k, help: `Per serving, in ${unit}, only if known.` })),
  ],
  example: [
    { title: 'Vegetable soup', servings: '4', prep_minutes: '15', cook_minutes: '30', ingredients: '2 carrots; 1 onion; 1 l stock; salt', method: 'Chop the vegetables; Simmer in the stock for 25 minutes; Season', tags: 'quick, vegetarian', contains: '', notes: 'Freezes well', source: 'Gran' },
    { title: 'Pancakes', servings: '4', prep_minutes: '10', cook_minutes: '15', ingredients: '200 g flour; 2 eggs; 300 ml milk', method: 'Whisk everything; Rest 10 minutes; Fry thin pancakes', tags: 'weekend, kids', contains: 'gluten, egg, dairy', calories: '210' },
  ],
  summary: recipeSummary,
  text: recipeText,
  key: (r) => r.title.trim().toLowerCase(),
  fromRow(v) {
    if (!v.title) return { error: 'No title.' };
    const contains = split(v.contains, /\s*,\s*/).map((a) => a.toLowerCase());
    const unknown = contains.filter((a) => !ALLERGENS.includes(a));
    if (unknown.length) return { error: `Unknown allergen "${unknown[0]}" (use: ${ALLERGENS.join(', ')}).` };
    return {
      name: v.title,
      record: normaliseRecipe({
        title: v.title, servings: numOrNull(v.servings) ?? 4, prepMinutes: numOrNull(v.prep_minutes), cookMinutes: numOrNull(v.cook_minutes),
        ingredients: split(v.ingredients).map(parseIngredient), instructions: split(v.method), tags: split(v.tags, /\s*,\s*/),
        allergens: contains, notes: v.notes, source: v.source,
        nutrition: Object.fromEntries(NUTRIENTS.map(([k]) => [k, numOrNull(v[k])])),
      }),
    };
  },
};
