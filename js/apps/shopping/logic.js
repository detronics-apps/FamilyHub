// Shopping: one family list that anything can send to - a week's meal plan, a
// meal or recipe, a chore's supplies - plus whatever anyone types in. Pure.
//
// Each item remembers where it came from (`source`). Sending from the same
// place again replaces those items with the new amounts instead of doubling
// them; what was already bought stays bought, and typed-in items are never
// touched by a send.

import { parseIngredient, unitKey } from '../meals/logic.js';
import { parseMeal } from '../assistant/logic.js';

// Food sent from meals is sorted into aisles; 'food' stays for anything not recognised (and older lists).
export const GROUPS = {
  produce: 'Fruit and vegetables', meat: 'Meat and seafood', dairy: 'Dairy and eggs', grains: 'Bread, grains and pasta', pantry: 'Pantry',
  food: 'Other food', cleaning: 'Cleaning', household: 'Household', other: 'Other',
};
const PANTRY = /\b(salt|pepper|spices?|herbs?|cumin|paprika|chilli|turmeric|cinnamon|oregano|basil|thyme|oil|vinegar|sauce|ketchup|stock|broth|flour|sugar|honey|jam|syrup|tinned|canned|tin|can|baking|yeast|cocoa|tea|coffee|cereal|lentils|beans|chickpeas|peanut butter|nuts?|seeds?)\b/i;

/** Which aisle a food goes in, from the food guide, else a few kitchen words; 'food' when unsure. */
export function categorise(name) {
  const f = parseMeal(name).items[0];
  if (f) {
    if (f.group === 'veg' || f.group === 'fruit' || f.id === 'avocado') return 'produce';
    if (f.id === 'egg' || f.group === 'dairy' || f.id === 'butter') return 'dairy';
    if (f.group === 'protein') return f.id === 'tofu' ? 'produce' : 'meat';
    if (f.group === 'grain') return f.id === 'potato' || f.id === 'chips' ? 'produce' : 'grains';
    return 'pantry';
  }
  return PANTRY.test(name) ? 'pantry' : 'food';
}
export const LIST_ID = 'shopping_list';

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
const nameKey = (n) => String(n).toLowerCase().trim().replace(/\s+/g, ' ').replace(/(es|s)$/, '');

export function normaliseShopping(list = {}) {
  const items = (Array.isArray(list.items) ? list.items : [])
    .filter((i) => i && str(i.name))
    .map((i, n) => ({
      id: str(i.id, 40) || `it${n}`,
      name: str(i.name, 120), qty: num(i.qty), unit: unitKey(str(i.unit, 20)), note: str(i.note, 120),
      checked: i.checked === true,
      // Lists made before Shopping was its own section said `fromWeek`.
      source: str(i.source, 80) || (typeof i.fromWeek === 'string' ? `week:${i.fromWeek}` : ''),
      from: str(i.from, 80),
      group: GROUPS[i.group] ? i.group : 'food',
    }));
  return { ...list, items };
}

/**
 * Put a source's items on the list. `needed` is [{ name, qty, unit, note }].
 * @param source  where they came from, e.g. "week:2026-10-19", "meal:rec_1", "chore:c_1"
 * @param from    a name for people to read, e.g. "Tuna pasta"
 */
export function addFromSource(list, { source, from = '', group = 'food' }, needed, newId = (i) => `${source}_${i}_${Date.now().toString(36)}`) {
  const keep = list.items.filter((i) => i.source !== source);
  const before = new Map(list.items.filter((i) => i.source === source).map((i) => [`${nameKey(i.name)}|${i.unit}`, i]));
  const added = needed.filter((n) => str(n.name)).map((n, i) => {
    const prev = before.get(`${nameKey(n.name)}|${unitKey(n.unit)}`);
    // Food is sorted into its aisle; cleaning and household sends keep their own group.
    const g = group === 'food' ? categorise(n.name) : GROUPS[group] ? group : 'food';
    return { id: prev?.id ?? newId(i), name: str(n.name, 120), qty: num(n.qty), unit: unitKey(n.unit ?? ''), note: str(n.note, 120), checked: prev?.checked ?? false, source, from: str(from, 80), group: g };
  });
  return { ...list, items: [...keep, ...added] };
}

/** The meal plan's own send, kept by name for the week screen. */
export const refreshFromPlan = (list, monday, needed, newId) => addFromSource(list, { source: `week:${monday}`, from: `Week of ${monday}`, group: 'food' }, needed, newId);

export function addShoppingItem(list, text, id = `it${Date.now().toString(36)}`, group = 'other') {
  const p = parseIngredient(text);
  if (!p.name) return list;
  return { ...list, items: [...list.items, { id, ...p, note: '', checked: false, source: '', from: '', group: GROUPS[group] ? group : 'other' }] };
}

export const toggleItem = (list, id) => ({ ...list, items: list.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)) });
export const clearBought = (list) => ({ ...list, items: list.items.filter((i) => !i.checked) });
export const removeItem = (list, id) => ({ ...list, items: list.items.filter((i) => i.id !== id) });

/** Items by group, in the order the groups are listed; empty groups left out. */
export const byGroup = (list) => Object.keys(GROUPS).map((g) => [g, list.items.filter((i) => i.group === g)]).filter(([, items]) => items.length);

/** The list as plain text, by aisle - for copying into a message or printing. */
export function listText(list, format) {
  return byGroup({ items: list.items.filter((i) => !i.checked) })
    .map(([g, items]) => [GROUPS[g], ...items.map((i) => `- ${format(i)}${i.note ? ` (${i.note})` : ''}`)].join('\n'))
    .join('\n\n');
}

/** What another app sends in the link (`#/shopping/add/<json>`). Anything odd is dropped. */
export function readSend(param) {
  let raw;
  try { raw = JSON.parse(param); } catch { return null; }
  if (!raw || !str(raw.source) || !Array.isArray(raw.items)) return null;
  const item = (i) => ({ name: str(i.name, 120), qty: num(i.qty), unit: unitKey(str(i.unit, 20)), note: str(i.note, 120) });
  return {
    source: str(raw.source, 80), from: str(raw.from, 80), group: GROUPS[raw.group] ? raw.group : 'food',
    items: raw.items.slice(0, 120).filter((i) => i && str(i.name)).map(item),
    // Home-made items (mayo): bought as their ingredients unless the family already has some made.
    own: (Array.isArray(raw.own) ? raw.own : []).slice(0, 30).filter((g) => g && str(g.name) && Array.isArray(g.items)).map((g) => ({
      id: str(g.id, 40), name: str(g.name, 120), qty: num(g.qty), unit: unitKey(str(g.unit, 20)), items: g.items.slice(0, 60).filter((i) => i && str(i.name)).map(item),
    })),
  };
}

/** The link another app uses to send items here. */
export const sendHref = (send) => `#/shopping/add/${encodeURIComponent(JSON.stringify(send))}`;
