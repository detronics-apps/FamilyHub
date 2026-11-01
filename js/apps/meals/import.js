// Importing a recipe from its text (D-092): pasted from a site or a message,
// read into a heading, ingredients and a method. Each ingredient line is
// matched to one of our foods - first by what the family said before ("AP
// flour" is our cake flour), then our own items, then the careful matcher the
// nutrition uses (never a loose search) - and its amount turned into our units.
// Volumes need a density to become grams: a cup becomes grams only when the
// food says what a cup of it weighs (the family's own size first); otherwise it
// stays in ml. Spoons stay ml. Nothing is saved here - the recipe form does that.
// Pure: no DOM.

import { tokens } from '../../food.js';
import { resolveIngredient } from '../../meal-nutrition.js';
import { safeUrl } from '../../links.js';

const FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };

// Each way of writing a unit, to our key. 'T' and 't' are told apart by case only.
const UNIT_WORDS = {
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'], tbsp: ['tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons', 'T'],
  cup: ['cup', 'cups', 'c'], oz: ['oz', 'ounce', 'ounces'], lb: ['lb', 'lbs', 'pound', 'pounds'],
  floz: ['fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces'], g: ['g', 'gram', 'grams', 'gr'], kg: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  ml: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'], l: ['l', 'litre', 'litres', 'liter', 'liters'],
  pinch: ['pinch', 'pinches'], clove: ['clove', 'cloves'], tin: ['tin', 'tins', 'can', 'cans'], slice: ['slice', 'slices'],
  bunch: ['bunch', 'bunches'], pack: ['pack', 'packs', 'packet', 'packets'],
};
const WORDS = Object.entries(UNIT_WORDS).flatMap(([k, ws]) => ws.map((w) => [w, k])).sort((a, b) => b[0].length - a[0].length);
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
const UNIT_RE = new RegExp(`^(${WORDS.map(([w]) => esc(w)).join('|')})\\.?(?=\\s|$)`, 'i');
const unitOf = (w) => {
  if (w === 'T') return 'tbsp';
  if (w === 't') return 'tsp';
  const low = w.toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
  return WORDS.find(([x]) => x.toLowerCase() === low && x !== 'T' && x !== 't')?.[1] ?? null;
};

const QTY = /^(\d+\/\d+|\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?)(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?(?:\/\d+)?)?/;
const num = (s) => s.split(/\s+/).reduce((n, part) => {
  if (part.includes('/')) { const [a, b] = part.split('/').map(Number); return n + (b ? a / b : 0); }
  return n + Number(part.replace(',', '.'));
}, 0);
const BULLET = /^[\s\-–•*·▢□☐◦‣>]+/;

/** "2 1/2 cups AP flour, sifted" -> { qty: 2.5, unit: 'cup', name: 'AP flour', note: 'sifted' }. A range ("2-3") takes the first. */
export function parseLine(line) {
  let text = String(line ?? '').replace(BULLET, '').trim();
  text = text.replace(/(\d)\s*([½¼¾⅓⅔⅛⅜⅝⅞])/g, '$1 $2').replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (f) => FRACTIONS[f]);
  let qty = null;
  let unit = '';
  const q = QTY.exec(text);
  if (q) { qty = num(q[1]); text = text.slice(q[0].length).trim(); }
  const u = qty != null ? UNIT_RE.exec(text) : null;
  if (u && unitOf(u[1])) { unit = unitOf(u[1]); text = text.slice(u[0].length).trim(); }
  text = text.replace(/^of\s+/i, '');
  const notes = [];
  text = text.replace(/\(([^)]*)\)/g, (_, x) => { notes.push(x.trim()); return ''; }).replace(/\s+/g, ' ').trim();
  const comma = text.indexOf(',');
  if (comma > 0) { notes.push(text.slice(comma + 1).trim()); text = text.slice(0, comma).trim(); }
  return { qty, unit, name: text, note: notes.filter(Boolean).join(', ') };
}

/* ---------------------------------------------------------------- units */

const EXACT = { oz: ['g', 28.349523125], lb: ['g', 453.59237], floz: ['ml', 29.5735295625], tsp: ['ml', 5], tbsp: ['ml', 15], kg: ['kg', 1], g: ['g', 1], ml: ['ml', 1], l: ['l', 1] };
// What the food database's measures hold (US): its "1 cup" is 236.6 ml.
const USDA_ML = { cup: 236.6, tbsp: 14.79, tsp: 4.93 };
const LIQUID = /\b(milk|water|oil|stock|broth|juice|cream|vinegar|wine|beer|buttermilk|sauce|syrup)\b/i;
const round = (n) => (n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100);

/**
 * Grams in one ml of a food, from a measure it is known by: the family's own "cup" or
 * "tbsp" size first (a cup being `cupMl`), then the food database's. Null when none is known.
 */
export function densityOf(food, own = [], cupMl = 250) {
  for (const s of [...own].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))) {
    const k = unitOf(String(s.label ?? '').trim());
    const ml = k === 'cup' ? cupMl : k === 'tbsp' ? 15 : k === 'tsp' ? 5 : null;
    if (ml && s.grams > 0) return s.grams / ml;
  }
  for (const p of food?.portions ?? []) {
    const m = /^(\d+(?:\.\d+)?|\d+\/\d+)\s+(cups?|tbsp|tablespoons?|tsp|teaspoons?)\b/i.exec(p.label ?? '');
    if (!m || !(p.grams > 0)) continue;
    const n = m[1].includes('/') ? num(m[1]) : Number(m[1]);
    const k = unitOf(m[2]);
    if (n > 0 && USDA_ML[k]) return p.grams / (n * USDA_ML[k]);
  }
  return null;
}

/**
 * Our units for one parsed line: weights in g, spoons and fluid ounces in ml, and cups in
 * grams when the food's density is known and it is not a liquid (else ml). `said` explains.
 */
export function toOurUnits({ qty, unit }, { food = null, own = [], cupMl = 250, name = '' } = {}) {
  if (qty == null) return { qty, unit, said: '' };
  if (unit === 'cup') {
    const ml = qty * cupMl;
    const d = LIQUID.test(name) ? null : densityOf(food, own, cupMl);
    return d ? { qty: round(ml * d), unit: 'g', said: `about - a cup of it weighs ${Math.round(cupMl * d)} g`, approx: true }
      : { qty: round(ml), unit: 'ml', said: `a cup is ${cupMl} ml` };
  }
  const e = EXACT[unit];
  if (!e || e[1] === 1) return { qty, unit, said: '' };
  return { qty: round(qty * e[1]), unit: e[0], said: '' };
}

/* ------------------------------------------------------------- matching */

const PREP = /\b(chopped|diced|minced|sliced|grated|shredded|fresh|freshly|finely|roughly|thinly|coarsely|large|small|medium|softened|melted|beaten|peeled|crushed|sifted|packed|heaped|level|rounded|room temperature|to taste|optional|organic)\b/gi;
/** The words that say which food it is: "Large Carrots, chopped" and "carrot" are one. */
export const nameKey = (name) => tokens(String(name ?? '').split(',')[0].replace(/\([^)]*\)/g, '').replace(PREP, ' ')).join(' ');

/**
 * Which of our foods a line is. `aliases` is what the family said before: { key: { fdcId } | { recipeId } }.
 * @returns { link: { fdcId } | { recipeId } | null, how: 'remembered' | 'ours' | 'matched' | '', name? } - name: what the family called it
 */
export function matchIngredient(name, { aliases = {}, own = [], db = null } = {}) {
  const key = nameKey(name);
  if (!key) return { link: null, how: '' };
  const a = aliases[key];
  if (a?.recipeId && own.some((o) => o.id === a.recipeId)) return { link: { recipeId: a.recipeId }, how: 'remembered', ...(a.name ? { name: a.name } : {}) };
  if (Number.isInteger(a?.fdcId) && (!db || db.get(a.fdcId))) return { link: { fdcId: a.fdcId }, how: 'remembered', ...(a.name ? { name: a.name } : {}) };
  const mine = own.find((o) => o.yield?.qty && nameKey(o.title) === key);
  if (mine) return { link: { recipeId: mine.id }, how: 'ours' };
  if (db) {
    const r = resolveIngredient({ name: String(name).replace(PREP, ' ').trim(), qty: null }, db);
    if (r.food) return { link: { fdcId: r.food.id }, how: 'matched' };
  }
  return { link: null, how: '' };
}

/** What to remember after saving: each imported line's words, to the food or item it was linked to in the end. */
export function remember(aliases = {}, rows = []) {
  const out = { ...aliases };
  for (const r of rows) {
    if (!r.fromKey) continue;
    const name = String(r.name ?? '').trim().slice(0, 120) || undefined;
    if (r.recipeId) out[r.fromKey] = { recipeId: r.recipeId, name };
    else if (Number.isInteger(r.fdcId)) out[r.fromKey] = { fdcId: r.fdcId, name };
  }
  return out;
}

/* ------------------------------------------------------------- the text */

const HEAD_ING = /^(ingredients?|you will need|what you need|shopping list)\s*:?$/i;
const HEAD_METHOD = /^(method|instructions?|directions?|steps|preparation|how to make( it)?|to make)\s*:?$/i;
const SERVES = /\b(?:serves|servings?|portions?|yield|makes)\s*:?\s*(\d+)/i;
const STEP = /^(?:step\s*)?\d+\s*[.):]\s*|^step\s*\d+\s*/i;
const looksLikeIngredient = (l) => l.length <= 90 && (QTY.test(l.replace(BULLET, '').replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/, '1')) || BULLET.test(l)) && !STEP.test(l);

/** Pasted text -> { title, servings, ingredients: [line], instructions: [step], videos, source }. */
export function splitRecipe(text) {
  const out = { title: '', servings: null, ingredients: [], instructions: [], description: [], videos: [], source: '' };
  const headed = String(text ?? '').split('\n').some((l) => HEAD_ING.test(l.trim()));
  let mode = 'top';
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const url = /^\S+:\/\/\S+$/.test(line) ? safeUrl(line) : '';
    if (url) { if (/youtu\.?be|vimeo|tiktok/i.test(url)) out.videos.push({ url, title: '' }); else out.source ||= url; continue; }
    if (HEAD_ING.test(line)) { mode = 'ing'; continue; }
    if (HEAD_METHOD.test(line)) { mode = 'method'; continue; }
    const serves = SERVES.exec(line);
    if (serves && line.length < 40) { out.servings = Number(serves[1]); continue; }
    if (mode === 'top' && !out.title) { out.title = line.replace(/^#+\s*/, ''); continue; }
    if (mode === 'top' && !headed) mode = looksLikeIngredient(line) ? 'ing' : 'top';
    if (mode === 'top') { out.description.push(line); continue; }
    if (mode === 'ing') {
      if (/:$/.test(line) && !QTY.test(line)) continue;           // "For the sauce:"
      if (!headed && !looksLikeIngredient(line)) mode = 'method'; else { out.ingredients.push(line); continue; }
    }
    const step = line.replace(BULLET, '').replace(STEP, '').trim();
    if (step) out.instructions.push(step);
  }
  return { ...out, description: out.description.join(' ') };
}

/**
 * The whole import: a recipe draft whose ingredient rows say where each came from.
 * `sizes`: Map fdcId -> the family's own sizes. Rows: { name, qty, unit, note, fdcId?, recipeId?, from, fromKey, how, said }.
 */
export function importRecipe(text, { aliases = {}, own = [], db = null, sizes = new Map(), cupMl = 250 } = {}) {
  const s = splitRecipe(text);
  const rows = s.ingredients.map((line) => {
    const p = parseLine(line);
    const m = matchIngredient(p.name, { aliases, own, db });
    const food = m.link?.fdcId && db ? db.get(m.link.fdcId) : null;
    const u = toOurUnits(p, { food, own: sizes.get(m.link?.fdcId) ?? [], cupMl, name: p.name });
    const ownItem = m.link?.recipeId ? own.find((o) => o.id === m.link.recipeId) : null;
    return {
      name: ownItem?.title ?? m.name ?? p.name, qty: u.qty, unit: u.unit, note: p.note,
      ...(m.link ?? {}), ...(/\beggs?\b/i.test(p.name) && !u.unit ? { whole: true } : {}),
      from: line.replace(BULLET, '').trim(), fromKey: nameKey(p.name), how: m.how, said: u.said,
    };
  });
  return {
    title: s.title, description: s.description, servings: s.servings ?? 4, ingredients: rows, instructions: s.instructions,
    videos: s.videos, source: s.source,
  };
}
