// Meals (product plan section 13): recipes, a weekly plan, and the shopping
// list that follows from it. Pure - no DOM.
//
// Deliberately NOT here: nutrition advice or calculated nutrition (plan 13.4,
// Phase 9.4-9.6 - needs reliable data sources and a safety review first).
// Nutrition values a person types in are shown as "supplied"; anything else
// is "not known", never estimated.

import { addDays, dayDiff, weekStart } from '../../dates.js';
import { split, numOrNull } from '../../importer.js';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'peanuts', 'soy', 'fish', 'shellfish', 'sesame'];
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
    .map((i) => ({ name: str(i.name, 120), qty: num(i.qty), unit: unitKey(str(i.unit, 20)), note: str(i.note, 120) }))
    .slice(0, 80);
  const nutrition = {};
  for (const [k] of NUTRIENTS) { const v = num(r.nutrition?.[k]); if (v != null) nutrition[k] = v; }
  return {
    ...r,
    title: str(r.title, 200) || 'Untitled recipe',
    description: str(r.description),
    servings: Math.max(1, Math.round(num(r.servings) ?? 4)),
    prepMinutes: num(r.prepMinutes),
    cookMinutes: num(r.cookMinutes),
    ingredients,
    instructions: lines(r.instructions).slice(0, 60),
    tags: lines(Array.isArray(r.tags) ? r.tags : String(r.tags ?? '').split(',')).map((t) => t.toLowerCase()).slice(0, 15),
    allergens: (Array.isArray(r.allergens) ? r.allergens : []).filter((a) => ALLERGENS.includes(a)),
    nutrition,                      // per serving, as supplied - never calculated
    notes: str(r.notes),
    source: str(r.source, 300),
  };
}

export function recipeSummary(r) {
  return {
    title: r.title,
    minutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) || null,
    servings: r.servings,
    tags: r.tags,
    allergens: r.allergens,
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

/* ----------------------------------------------------------- the week */

export { weekStart };

export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export function normalisePlan(p = {}, monday) {
  const slots = (Array.isArray(p.slots) ? p.slots : [])
    .filter((s) => s && Number.isInteger(s.day) && s.day >= 0 && s.day < 7 && MEALS.includes(s.meal))
    .map((s) => ({
      day: s.day, meal: s.meal,
      recipeId: typeof s.recipeId === 'string' ? s.recipeId : null,
      title: str(s.title, 200) || 'Meal',
      servings: Math.max(1, Math.round(num(s.servings) ?? 4)),
    }));
  return { ...p, week: p.week ?? monday, slots };
}

export const slotAt = (plan, day, meal) => plan.slots.find((s) => s.day === day && s.meal === meal) ?? null;

export function setSlot(plan, day, meal, slot) {
  const others = plan.slots.filter((s) => !(s.day === day && s.meal === meal));
  return { ...plan, slots: slot ? [...others, { ...slot, day, meal }] : others };
}

/** Reuse a previous week's plan for another week (same days and meals). */
export const copyPlan = (from, monday) => ({ week: monday, slots: from.slots.map((s) => ({ ...s })) });

export const planId = (monday) => `week_${monday.replace(/-/g, '')}`;

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

/** Everything the week's planned recipes need, scaled to each meal's servings. */
export function ingredientsForPlan(plan, recipes) {
  const out = [];
  for (const s of plan.slots) {
    const r = s.recipeId ? recipes.get(s.recipeId) : null;
    if (r) out.push(...scaleIngredients(r, s.servings));
  }
  return combineIngredients(out);
}

export function normaliseShopping(list = {}) {
  const items = (Array.isArray(list.items) ? list.items : [])
    .filter((i) => i && str(i.name))
    .map((i, n) => ({
      id: str(i.id, 40) || `it${n}`,
      name: str(i.name, 120), qty: num(i.qty), unit: unitKey(str(i.unit, 20)), note: str(i.note, 120),
      checked: i.checked === true, fromWeek: typeof i.fromWeek === 'string' ? i.fromWeek : null,
    }));
  return { ...list, items };
}

/**
 * Refresh the list from a week's plan. Items you added yourself are never
 * touched; items already bought stay bought; the week's generated items are
 * replaced by the new totals.
 */
export function refreshFromPlan(list, monday, needed, newId = (i) => `gen_${monday}_${i}`) {
  const keep = list.items.filter((i) => i.fromWeek !== monday);
  const before = new Map(list.items.filter((i) => i.fromWeek === monday).map((i) => [`${nameKey(i.name)}|${i.unit}`, i]));
  const generated = needed.map((n, i) => {
    const prev = before.get(`${nameKey(n.name)}|${n.unit}`);
    return { id: prev?.id ?? newId(i), name: n.name, qty: n.qty, unit: n.unit, note: n.note, checked: prev?.checked ?? false, fromWeek: monday };
  });
  return { ...list, items: [...keep, ...generated] };
}

export function addShoppingItem(list, text, id = `it${Date.now().toString(36)}`) {
  const p = parseIngredient(text);
  if (!p.name) return list;
  return { ...list, items: [...list.items, { id, ...p, note: '', checked: false, fromWeek: null }] };
}

export const toggleItem = (list, id) => ({ ...list, items: list.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)) });
export const clearBought = (list) => ({ ...list, items: list.items.filter((i) => !i.checked) });

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
