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

  return { source: json.source, types: json.types, keys, meta, count: foods.length, search, get: (id) => byId.get(Number(id)) ?? null };
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
