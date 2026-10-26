// The shared food database every Meals mini-app reads: data/foods.json, built
// from USDA FoodData Central by tools/build_foods.py. Values are per 100 g; a
// nutrient the source does not report is null and stays "not known" all the way
// to the screen - it is never added as zero. Pure: the caller fetches the JSON.

const STOP = new Set(['a', 'an', 'and', 'or', 'with', 'of', 'the', 'in', 'on', 'some', 'little', 'bit']);

/** "Strawberries" -> "strawberry"-ish stem, so "oats" finds "oat" and "berries" finds "berry". */
export const stem = (w) => w.replace(/ies$/, 'y').replace(/(oes|ses|xes)$/, (m) => m.slice(0, -2)).replace(/(?<!s)s$/, '');
export const tokens = (text) => String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);

/**
 * The sizes a food is bought or measured in, as units for a recipe line: the
 * family's own first ("ring" = 200 g, from the packet), then the database's
 * portions ("1 head, medium (6" dia)" = 539 g -> "head, medium"). `each` is the
 * grams in one. Plain weights (oz) are left out - grams already cover them. Of two
 * of our own with the same name, the one given last (`at`) counts, so a wrong one is corrected by adding it again.
 */
export function foodSizes(food, own = []) {
  const out = [];
  const add = (unit, label, each, mine) => {
    if (!unit || !(each > 0) || out.some((s) => s.unit === unit)) return;
    out.push({ unit, label, each: Math.round(each * 10) / 10, own: mine });
  };
  for (const s of [...own].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))) add(String(s.label).trim().toLowerCase(), String(s.label).trim(), Number(s.grams), true);
  for (const p of food?.portions ?? []) {
    const m = /^(\d+(?:\.\d+)?|\d+\/\d+)\s+(.+)$/.exec(p.label.trim());
    const n = !m ? 1 : m[1].includes('/') ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : Number(m[1]);
    // "wedge (1.33 oz)" -> "wedge": the grams are shown next to it anyway.
    const label = (m ? m[2] : p.label).replace(/\s*\(\s*[\d.]+\s*oz\s*\)/i, '').trim();
    if (!(n > 0) || /^(oz|g|grams?|lbs?|kg)\b/i.test(label)) continue;
    const short = label.replace(/\s*\([^)]*\)/g, '').replace(/\s+yields$/i, '').trim().toLowerCase();
    add(out.some((s) => s.unit === short) ? label.toLowerCase() : short, label, p.grams / n, false);
  }
  return out;
}

export function createFoodDb(json) {
  const keys = json.nutrients.map(([k]) => k);
  const meta = Object.fromEntries(json.nutrients.map(([k, label, unit]) => [k, { label, unit }]));
  const foods = json.foods.map(([id, name, type, category, values, portions]) => ({
    id, name, type, category, portions: portions.map(([label, grams]) => ({ label, grams })),
    per100: Object.fromEntries(keys.map((k, i) => [k, values[i]])),
    words: tokens(name),
  }));
  const byId = new Map(foods.map((f) => [f.id, f]));

  /** Every query word must start a word of the name; plain, generic, first-named foods rank first. */
  function search(query, limit = 30) {
    const q = tokens(query);
    if (!q.length) return [];
    const hits = [];
    for (const f of foods) {
      if (!q.every((t) => f.words.some((w) => w.startsWith(t)))) continue;
      const lead = f.words[0]?.startsWith(q[0]) ? 0 : 6;
      const raw = f.words.includes('raw') ? -1 : 0;
      // "egg" should find eggs before eggplant: whole-word matches first.
      const exact = q.every((t) => f.words.includes(t)) ? -2 : 0;
      hits.push([lead + raw + exact + f.words.length * 0.6 + (f.type === 'N' ? 0.5 : 0), f]);
    }
    return hits.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, f]) => f);
  }

  return { source: json.source, types: json.types, keys, meta, count: foods.length, foods, search, get: (id) => byId.get(Number(id)) ?? null };
}

/**
 * Plain groups over the database's ~200 categories. The first that matches wins,
 * so "Seafood mixed dishes" is a dish and "Fruit drinks" a drink.
 */
export const FOOD_GROUPS = [
  ['baby', 'Baby foods', /baby|infant|formula/i],
  ['dishes', 'Dishes, soups and fast food', /mixed|dishes|fast food|restaurant|pizza|sandwich|burger|soup|entree|meals|burrito|taco|nacho/i],
  ['drinks', 'Drinks', /beverage|coffee|\btea\b|water|soft drink|soda|alcohol|wine|beer|liquor|smoothie|shake|drink/i],
  ['fruit', 'Fruit', /fruit|apple|banana|berr|melon|citrus|grape|mango|papaya|peach|nectarine|pear|pineapple/i],
  ['veg', 'Vegetables', /vegetable|potato|tomato|lettuce|greens|salad|broccoli|cabbage|carrot|corn|onion|spinach|string beans|leafy/i],
  ['legumes', 'Beans, nuts and seeds', /legume|\bnut|seed|bean|soy/i],
  ['fish', 'Fish and seafood', /fish|seafood|shellfish/i],
  ['poultry', 'Chicken and poultry', /poultry|chicken|turkey/i],
  ['meat', 'Meat', /beef|pork|lamb|veal|game|sausage|luncheon|meat|frankfurter|bacon|\bham\b/i],
  ['dairy', 'Dairy and eggs', /dairy|egg|milk|cheese|yogh?urt|cream/i],
  ['grains', 'Bread, cereals and grains', /cereal|grain|pasta|rice|bread|baked|cracker|tortilla|bagel|biscuit|muffin|pancake|waffle|oat|rolls|buns/i],
  ['sweets', 'Sweets and snacks', /sweet|snack|candy|cookie|cake|pie|dessert|chip|pretzel|popcorn|sugar|jam|pudding|gelatin|sorbet|\bices\b/i],
  ['fats', 'Fats, oils and dressings', /\bfat|oil|butter|margarine|dressing|mayonnaise/i],
  ['herbs', 'Herbs, spices and sauces', /spice|herb|condiment|sauce|grav|dip/i],
];
export const foodGroup = (category) => FOOD_GROUPS.find(([, , re]) => re.test(category ?? ''))?.[0] ?? 'other';

export const FOOD_COLOURS = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', purple: 'Blue or purple', white: 'White or beige' };
// By the food's first word ("Corn, sweet, yellow" -> corn).
const COLOUR_OF = [
  ['yellow', /^(bananas?|corn|sweetcorn|pineapples?|lemons?)\b/],
  ['orange', /^(carrots?|sweet ?potato(es)?|pumpkins?|butternut|oranges?|apricots?|mangos?|mangoes|papayas?|cantaloupe|melons?|peach(es)?|nectarines?|tangerines?|mandarins?|persimmons?|clementines?)\b/],
  ['red', /^(tomato(es)?|strawberr(y|ies)|raspberr(y|ies)|watermelon|cherr(y|ies)|cranberr(y|ies)|radish(es)?|pomegranates?)\b/],
  ['green', /^(spinach|broccoli|kale|lettuce|peas|cucumbers?|avocados?|kiwi(fruit)?s?|cabbage|celery|zucchini|courgettes?|asparagus|brussels sprouts|okra|limes?|chard|collards?|arugula|rocket|leeks?|edamame|parsley|basil|coriander|cilantro|pears?|grapes, green)\b/],
  ['purple', /^(blueberr(y|ies)|blackberr(y|ies)|eggplant|aubergines?|brinjal|beets?|beetroot|plums?|grapes?|raisins?|prunes?|figs?)\b/],
  ['white', /^(cauliflower|onions?|garlic|mushrooms?|potato(es)?|parsnips?|turnips?|ginger|jicama|coconut)\b/],
];
/**
 * The colour of a fruit or vegetable: a colour named in it ("Peppers, sweet,
 * red"), else what that food usually is. Null for anything else - colour is
 * about plants, and a guess for "Bread, banana" would mislead.
 */
export function foodColour(food) {
  if (!['fruit', 'veg', 'legumes'].includes(foodGroup(food.category))) return null;
  const name = food.name.toLowerCase();
  const said = /\b(red|yellow|green|orange|purple|white)\b/.exec(name.split(',').slice(1).join(','))?.[1];
  if (said) return said;
  return COLOUR_OF.find(([, re]) => re.test(name))?.[0] ?? null;
}

const DRIED = /\b(dried|dehydrated|freeze-dried|powder(ed)?|dry mix|crude|seed gums)\b/i;

/**
 * Foods to browse: matching the words (best match first) or all of them, then
 * narrowed to a group and a colour, and sorted by one nutrient per 100 g -
 * highest first, a food that does not report it last.
 */
export function browseFoods(db, { query = '', group = null, colour = null, sort = null, everyday = false, only = null } = {}) {
  let list = String(query).trim() ? db.search(query, Infinity) : db.foods;
  if (only) list = list.filter((f) => only.has(f.id));
  // Per 100 g, a dried powder always wins; to find foods people actually eat, those can be left out.
  if (everyday) list = list.filter((f) => !DRIED.test(f.name));
  if (group) list = list.filter((f) => foodGroup(f.category) === group);
  if (colour) list = list.filter((f) => foodColour(f) === colour);
  if (sort) list = [...list].sort((a, b) => (b.per100[sort] ?? -1) - (a.per100[sort] ?? -1));
  return list;
}

/** What `grams` of a food holds. Unknown stays null. */
export function amounts(food, grams) {
  const out = {};
  for (const [k, v] of Object.entries(food.per100)) out[k] = v === null ? null : (v * grams) / 100;
  return out;
}

/**
 * Add up several items. A total is only a number when every item reports that
 * nutrient; otherwise it carries how many items are missing it, so the screen
 * can say "at least" rather than present a short total as the whole.
 */
export function total(items) {
  const out = {};
  for (const { food, grams } of items) {
    for (const [k, v] of Object.entries(amounts(food, grams))) {
      const t = out[k] ?? (out[k] = { value: 0, missing: 0 });
      if (v === null) t.missing += 1; else t.value += v;
    }
  }
  return out;
}

/** Sensible precision for a nutrient amount on screen. */
export function fmtAmount(v) {
  if (v === null || v === undefined) return 'not known';
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return String(Math.round(v * 10) / 10);
  if (v >= 0.1) return String(Math.round(v * 100) / 100);
  return v === 0 ? '0' : '<0.1';
}
