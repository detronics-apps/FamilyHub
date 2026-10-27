// Shopping: one family list that anything can send to - a week's meal plan, a
// meal or recipe, a chore's supplies - plus whatever anyone types in. Pure.
//
// Each item remembers where it came from (`source`). Sending from the same
// place again replaces those items with the new amounts instead of doubling
// them; what was already bought stays bought, and typed-in items are never
// touched by a send. Meal Planner instead sends only what is still missing
// (addMore, D-059), which is added on.

import { parseIngredient, unitKey, combineIngredients } from '../meals/logic.js';
import { parseMeal } from '../assistant/logic.js';
import { GUIDE } from '../assistant/guide.js';
import { tokens } from '../../food.js';

// Where an item sits on the list. Food is sorted into aisles; 'food' stays for anything not recognised (and older lists).
export const GROUPS = {
  produce: 'Fruit and vegetables', meat: 'Meat and seafood', dairy: 'Dairy and eggs', grains: 'Bread, grains and pasta', pantry: 'Pantry',
  food: 'Other food', cleaning: 'Cleaning', hygiene: 'Hygiene and toiletries', medical: 'Medical and first aid', stationery: 'Stationery',
  household: 'Household', pets: 'Pets', other: 'Other',
};
/** The kinds people look by ("what hygiene things do we need?"); the food aisles are all Food. */
export const KINDS = { food: 'Food', cleaning: 'Cleaning', hygiene: 'Hygiene', medical: 'Medical', stationery: 'Stationery', household: 'Household', pets: 'Pets', other: 'Other' };
const FOOD_AISLES = new Set(['produce', 'meat', 'dairy', 'grains', 'pantry', 'food']);
export const kindOf = (group) => (FOOD_AISLES.has(group) ? 'food' : KINDS[group] ? group : 'other');

/**
 * Things a family commonly buys, by kind - so someone buying something for the
 * first time can see what there is, not only find what they already know to
 * type. Food comes from the food guide (everyday foods) instead.
 */
export const STARTER = {
  cleaning: ['dishwashing liquid', 'dishwasher tablets', 'washing powder', 'fabric softener', 'bleach', 'all-purpose cleaner', 'toilet cleaner', 'glass cleaner', 'floor cleaner', 'sponges', 'scourers', 'cloths', 'rubber gloves', 'bin bags', 'disinfectant', 'stain remover', 'oven cleaner', 'furniture polish', 'mop head', 'air freshener'],
  hygiene: ['toothpaste', 'toothbrushes', 'dental floss', 'mouthwash', 'shampoo', 'conditioner', 'body wash', 'soap', 'hand wash', 'deodorant', 'razors', 'shaving cream', 'sanitary pads', 'tampons', 'toilet paper', 'tissues', 'cotton buds', 'cotton wool', 'body lotion', 'sunscreen', 'lip balm', 'nappies', 'baby wipes', 'nappy cream'],
  medical: ['plasters', 'bandages', 'antiseptic cream', 'antiseptic liquid', 'pain relief', 'children’s pain relief', 'thermometer', 'rehydration sachets', 'antihistamine', 'cough syrup', 'throat lozenges', 'insect repellent', 'burn gel', 'saline nasal spray', 'eye drops', 'vitamins', 'hand sanitiser', 'face masks'],
  stationery: ['pens', 'pencils', 'coloured pencils', 'crayons', 'erasers', 'sharpener', 'ruler', 'glue stick', 'scissors', 'sticky tape', 'printer paper', 'printer ink', 'exercise books', 'notebooks', 'sticky notes', 'highlighters', 'envelopes', 'stapler', 'staples', 'paper clips', 'files', 'book covering'],
  household: ['light bulbs', 'batteries', 'candles', 'matches', 'foil', 'cling film', 'baking paper', 'freezer bags', 'paper towels', 'serviettes', 'refuse bags', 'extension lead', 'pegs', 'hangers', 'firelighters', 'charcoal', 'water filter'],
  pets: ['dog food', 'cat food', 'pet treats', 'cat litter', 'flea treatment', 'deworming tablets', 'poo bags'],
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

/**
 * What the family has bought before or added itself, kept with the list so it
 * can be found again ("hygiene things we buy") without typing. One per name.
 */
function normaliseKnown(known) {
  const seen = new Set();
  return (Array.isArray(known) ? known : []).filter((k) => k && str(k.name)).map((k) => ({
    name: str(k.name, 120), unit: unitKey(str(k.unit, 20)), group: GROUPS[k.group] ? k.group : 'other',
    times: Math.max(0, Math.round(Number(k.times) || 0)), last: str(k.last, 10),
  })).filter((k) => !seen.has(nameKey(k.name)) && seen.add(nameKey(k.name))).slice(0, 2000);
}

/** Remember an item: `bought` counts one more time it was bought (on `day`). */
export function remember(list, item, { bought = false, day = '' } = {}) {
  const key = nameKey(item.name);
  const cur = list.known.find((k) => nameKey(k.name) === key);
  const next = { name: cur?.name ?? str(item.name, 120), unit: item.unit ?? cur?.unit ?? '', group: GROUPS[item.group] ? item.group : cur?.group ?? 'other', times: (cur?.times ?? 0) + (bought ? 1 : 0), last: bought ? day : cur?.last ?? '' };
  return { ...list, known: [next, ...list.known.filter((k) => nameKey(k.name) !== key)] };
}

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
  return { ...list, items, known: normaliseKnown(list.known) };
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

/**
 * Put more on the list (D-059): Meal Planner sends only what is still missing, so
 * it is added to what is there - onto a line of the same thing not yet bought
 * (500 g + 300 g mince is one line of 800 g), else as a line of its own.
 */
export function addMore(list, { source, from = '', group = 'food' }, needed, newId = (i) => `${source}_${i}_${Date.now().toString(36)}`) {
  const items = [...list.items];
  needed.filter((n) => str(n.name)).forEach((n, i) => {
    const at = items.findIndex((x) => !x.checked && nameKey(x.name) === nameKey(n.name) && combineIngredients([x, n]).length === 1);
    if (at >= 0 && items[at].qty != null && n.qty != null) {
      const [sum] = combineIngredients([items[at], n]);
      items[at] = { ...items[at], qty: sum.qty, unit: sum.unit };
      return;
    }
    if (at >= 0 && n.qty == null) return;   // "some" is already on the list
    const g = group === 'food' ? categorise(n.name) : GROUPS[group] ? group : 'food';
    items.push({ id: newId(i), name: str(n.name, 120), qty: num(n.qty), unit: unitKey(n.unit ?? ''), note: str(n.note, 120), checked: false, source, from: str(from, 80), group: g });
  });
  return { ...list, items };
}

/** The meal plan's own send, kept by name for the week screen. */
export const refreshFromPlan = (list, monday, needed, newId) => addFromSource(list, { source: `week:${monday}`, from: `Week of ${monday}`, group: 'food' }, needed, newId);

/** Something typed in or picked: on the list, and remembered as one of ours. */
export function addShoppingItem(list, text, id = `it${Date.now().toString(36)}`, group = 'other') {
  const p = parseIngredient(text);
  if (!p.name) return list;
  const item = { id, ...p, note: '', checked: false, source: '', from: '', group: GROUPS[group] ? group : 'other' };
  return remember({ ...list, items: [...list.items, item] }, item);
}

/** Ticking an item as bought also counts it as bought (so it is found again later). */
export function toggleItem(list, id, day = '') {
  const it = list.items.find((i) => i.id === id);
  const next = { ...list, items: list.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)) };
  return it && !it.checked ? remember(next, it, { bought: true, day }) : next;
}

/**
 * Things to put on the list: our own (bought before or added by us) - most
 * bought first - and, unless `ours`, everything else there is to choose from:
 * everyday foods and common things of each kind. Narrowed by words and a kind.
 * @returns [{ name, group, unit, ours, times, last, onList }]
 */
export function findItems(list, { query = '', kind = null, ours = true } = {}) {
  const q = tokens(query);
  const fits = (name, group) => (!kind || kindOf(group) === kind) && q.every((t) => tokens(name).some((w) => w.startsWith(t)));
  const onList = new Set(list.items.filter((i) => !i.checked).map((i) => nameKey(i.name)));
  const mine = list.known.filter((k) => fits(k.name, k.group)).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name))
    .map((k) => ({ ...k, ours: true, onList: onList.has(nameKey(k.name)) }));
  if (ours) return mine;
  const have = new Set(list.known.map((k) => nameKey(k.name)));
  const more = [
    ...GUIDE.filter((g) => g.suggest !== false || g.fdc).map((g) => ({ name: g.name, group: categorise(g.name) })),
    ...Object.entries(STARTER).flatMap(([group, names]) => names.map((name) => ({ name, group }))),
  ].filter((x) => !have.has(nameKey(x.name)) && fits(x.name, x.group))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => ({ ...x, unit: '', ours: false, times: 0, last: '', onList: onList.has(nameKey(x.name)) }));
  return [...mine, ...more];
}
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
    // 'more': only what is still missing - added to the list rather than replacing (D-059).
    more: raw.more === true,
    // Where to go once added, so the sender can note what went (another app's own link only).
    then: typeof raw.then === 'string' && /^#\/[a-z][a-z0-9.-]*\//.test(raw.then) ? raw.then.slice(0, 4000) : '',
    items: raw.items.slice(0, 120).filter((i) => i && str(i.name)).map(item),
    // Home-made items (mayo): bought as their ingredients unless the family already has some made.
    own: (Array.isArray(raw.own) ? raw.own : []).slice(0, 30).filter((g) => g && str(g.name) && Array.isArray(g.items)).map((g) => ({
      id: str(g.id, 40), name: str(g.name, 120), qty: num(g.qty), unit: unitKey(str(g.unit, 20)), items: g.items.slice(0, 60).filter((i) => i && str(i.name)).map(item),
    })),
  };
}

/** The link another app uses to send items here. */
export const sendHref = (send) => `#/shopping/add/${encodeURIComponent(JSON.stringify(send))}`;
