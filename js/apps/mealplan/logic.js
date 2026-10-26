// This Week's thinking, apart from its screens: proposing a week that mixes
// favourites with new meals, looking at the planned week as a whole, and
// proposing small improvements. Pure - no DOM. Every proposal is only a
// proposal: nothing is put in the plan until the person accepts it.

import { GUIDE } from '../assistant/guide.js';
import { allowed, personContext } from '../assistant/logic.js';
import { suitableFor, GROUP, PROTEIN, CARB } from '../meals/facts.js';
import { MEAL_LABEL, WEEKDAYS } from '../meals/logic.js';

/* ------------------------------------------------------------ the weekly mix */

export const MIX = {
  family: 'Family favourites (rated 7 or more)',
  individual: 'Someone’s favourite',
  untried: 'New - not tried yet',
  other: 'Other meals you have had',
};

const nameOf = (people, id) => people.find((p) => p.id === id)?.name ?? 'someone';
const favouritesOf = (s, people) => Object.entries(s.prefs ?? {}).filter(([, v]) => v === 'favourite').map(([id]) => nameOf(people, id));
const dislikedBy = (s, people) => Object.entries(s.prefs ?? {}).filter(([, v]) => v === 'dislikes').map(([id]) => nameOf(people, id));

/** Which mix group a meal belongs to, by its recorded rating and trial status only. */
export function mixGroup(s) {
  if (!s.tried) return 'untried';
  if (s.rating !== null && s.rating !== undefined && s.rating >= 7) return 'family';
  if (Object.values(s.prefs ?? {}).includes('favourite')) return 'individual';
  return 'other';
}

/**
 * Fill empty slots with a mix of meals.
 * @param meals   recipe summaries (with facts, rating, tried, prefs)
 * @param counts  { family, individual, untried, other } - how many of each
 * @param slots   [{ day, meal }] to fill, in order
 * @param recent  ids planned in the last weeks - used last, so the same few meals do not keep coming back
 * @param people  the people eating (allergies and diet are respected; dislikes are shown, not hidden)
 * @param seed    any string; the same seed gives the same proposal
 * @returns {{ picks: [{ day, meal, id, title, group, reason }], shortfall: [{ group, wanted, found }] }}
 */
export function proposeWeek({ meals, counts, slots, recent = new Set(), people = [], seed = '' }) {
  const ok = meals.filter((s) => people.every((p) => suitableFor({ allergens: s.allergens ?? [], animal: s.animal ?? [] }, p)));
  const hash = (id) => [...`${seed}${id}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rank = (a, b) => (recent.has(a.id) - recent.has(b.id)) || ((b.rating ?? 0) - (a.rating ?? 0)) || (hash(a.id) - hash(b.id));
  const used = new Set();
  const wanted = [];
  for (const g of Object.keys(MIX)) for (let i = 0; i < (counts[g] ?? 0); i += 1) wanted.push(g);
  const picks = [];
  const shortfall = {};
  for (const g of wanted) {
    if (picks.length >= slots.length) break;
    // An individual favourite counts for that group even when the family score is higher or lower.
    const pool = ok.filter((s) => !used.has(s.id) && (g === 'individual' ? favouritesOf(s, people).length && s.tried : mixGroup(s) === g) && !(g === 'other' && s.rating !== null && s.rating <= 3)).sort(rank);
    const s = pool[0];
    if (!s) { shortfall[g] = (shortfall[g] ?? 0) + 1; continue; }
    used.add(s.id);
    const slot = slots[picks.length];
    const why = {
      family: `rated ${s.rating}/10`,
      individual: `${favouritesOf(s, people).join(' and ')}’s favourite${s.rating ? `, rated ${s.rating}/10` : ''}`,
      untried: '',
      other: s.rating ? `rated ${s.rating}/10` : 'tried, not rated yet',
    }[g];
    const not = dislikedBy(s, people);
    picks.push({ ...slot, id: s.id, title: s.title, group: g, reason: [why, recent.has(s.id) ? 'also planned recently' : '', not.length ? `${not.join(' and ')} ${not.length > 1 ? 'dislike' : 'dislikes'} it` : ''].filter(Boolean).join('; ') });
  }
  const groups = Object.keys(MIX);
  return {
    picks,
    shortfall: groups.filter((g) => shortfall[g]).map((g) => ({ group: g, wanted: counts[g], found: counts[g] - shortfall[g] })),
  };
}

/* ------------------------------------------------------------ the week as a whole */

/**
 * Look at the planned week.
 * @param occasions  [{ day, meal, title, kind: 'cooked'|'leftovers', facts|null, profile|null, counted, of, slotId, recipeId }]
 *                   - leftovers are their own occasions (eaten again) but never add new food
 * @returns {{ included, mealTypes, partial, categories, variety, findings }}
 */
export function analyseWeek(occasions) {
  const n = occasions.length;
  const withFacts = occasions.filter((o) => o.facts);
  const count = (pred) => withFacts.filter(pred).length;
  const tally = (key) => {
    const t = {};
    for (const o of withFacts) for (const x of o.facts[key]) t[x] = (t[x] ?? 0) + 1;
    return t;
  };
  const mealTypes = [...new Set(occasions.map((o) => o.meal))];
  const categories = {};
  // Each occasion counts by the portions eaten at it (`weight`, default 1), so a leftover lunch
  // counts as what is eaten then - while its food was cooked, and counted for shopping, only once.
  for (const o of occasions) {
    const w = o.weight ?? 1;
    for (const c of o.profile ?? []) {
      const t = (categories[c.id] ??= { id: c.id, label: c.label, sum: 0, known: 0, of: 0 });
      t.of += w;
      if (c.score !== null) { t.sum += c.score * w; t.known += w; }
    }
  }
  for (const t of Object.values(categories)) t.score = t.known ? t.sum / t.known : null;

  const plants = new Set(withFacts.flatMap((o) => o.facts.plants));
  const colours = new Set(withFacts.flatMap((o) => o.facts.colours));
  const variety = {
    meals: n, withFacts: withFacts.length, plants: plants.size, colours: [...colours],
    veg: count((o) => o.facts.groups.includes('veg')), fruit: count((o) => o.facts.groups.includes('fruit')),
    legume: count((o) => o.facts.groups.includes('legume')), wholegrain: count((o) => o.facts.groups.includes('wholegrain')),
    oilyfish: count((o) => o.facts.groups.includes('oilyfish')),
    proteins: tally('proteins'), carbs: tally('carbs'), foods: tally('foods'),
  };

  const findings = [];
  const add = (id, level, text, gap = null) => findings.push({ id, level, text, gap });
  if (n && withFacts.length < n) add('unknown-meals', 'unknown', `${n - withFacts.length} of ${n} planned meals have no ingredients recorded, so they are not part of this look at the week.`);
  if (withFacts.length >= 2) {
    const m = withFacts.length;
    if (variety.veg < m / 2) add('veg', 'attention', `Limited vegetables across the planned meals: ${variety.veg} of ${m} include one.`, 'veg');
    if (colours.size < 3) add('colour', 'attention', `Limited colour among plant foods${colours.size ? ` (only ${[...colours].join(' and ')})` : ''}. Consider adding a fruit or vegetable of another colour to some meals.`, 'veg');
    if (m >= 4 && variety.legume <= 1) add('legume', 'attention', `Few planned meals include legumes (beans, lentils, chickpeas): ${variety.legume} of ${m}.`, 'legume');
    if (Object.keys(variety.carbs).length && variety.wholegrain === 0) add('wholegrain', 'attention', 'None of the planned meals uses a whole grain (brown rice, wholewheat bread, oats).', 'wholegrain');
    if (m >= 5 && variety.oilyfish === 0) add('oilyfish', 'attention', 'No oily fish (salmon, pilchards, sardines) this week - a good source of omega-3 fats.', 'oilyfish');
    if (mealTypes.some((t) => t === 'breakfast' || t === 'snack') && variety.fruit === 0) add('fruit', 'attention', 'Consider adding fruit to a breakfast or snack.', 'fruit');
    const top = (t) => Object.entries(t).sort((a, b) => b[1] - a[1])[0];
    const carbTotal = Object.values(variety.carbs).reduce((a, b) => a + b, 0);
    const [carb, carbN] = top(variety.carbs) ?? [];
    if (carbN >= 3 && carbN / carbTotal >= 0.6) add('carb-repeat', 'attention', `Most planned meals rely on the same carbohydrate (${CARB[carb].toLowerCase()}, ${carbN} times).`);
    const [prot, protN] = top(variety.proteins) ?? [];
    if (protN >= 3 && protN / m >= 0.6) add('protein-repeat', 'attention', `Most planned meals use the same protein (${PROTEIN[prot].toLowerCase()}, ${protN} times).`);
  }
  for (const c of Object.values(categories)) {
    if (c.known < c.of / 2) add(`unknown-${c.id}`, 'unknown', `Not enough ingredient information to assess ${c.label.toLowerCase()} confidently.`);
    else if (c.score !== null && c.score < 0.35) add(`low-${c.id}`, 'attention', `${c.label} look low across the planned meals${c.id === 'phyto' ? ' (judged by plant colour variety)' : ''} - an estimate, not a deficiency.`, `cat:${c.id}`);
    else if (c.score !== null && c.score >= 0.7) add(`good-${c.id}`, 'good', `${c.label} are well represented.`);
  }
  return {
    included: occasions.map((o) => ({ day: o.day, meal: o.meal, title: o.title, kind: o.kind })),
    mealTypes, partial: !['breakfast', 'lunch', 'dinner'].every((t) => mealTypes.includes(t)),
    categories: Object.values(categories), variety, findings,
  };
}

/* ------------------------------------------------------------ Optimise My Week */

const GAP_FOODS = { veg: ['spinach', 'broccoli', 'carrots', 'butternut', 'peas', 'redpepper', 'cabbage', 'greenbeans'], legume: ['lentils', 'beans', 'chickpeas'], fruit: ['banana', 'orange', 'strawberries', 'apple'], oilyfish: [] };
const SWAP_FOR = { wholegrain: [['rice', 'brownrice'], ['bread', 'wholegrain']] };

/**
 * Proposals to improve the week: the smallest useful change first (add one food
 * to a planned meal, or swap one ingredient), then a whole meal from your own
 * collection where a small change cannot help. Never a meal someone loves, and
 * never anything unsafe for the people eating.
 * @param analysis   from analyseWeek
 * @param occasions  as given to analyseWeek (cooked ones can be changed)
 * @param meals      recipe summaries not yet planned, for replacements
 * @returns [{ kind: 'add'|'swap'|'replace', slotId, day, meal, text, why, food?, from?, to?, recipeId?, title? }]
 */
export function optimiseWeek({ analysis, occasions, meals = [], people = [], today }) {
  const ctxs = people.map((p) => personContext(p, today)).filter((c) => !c.baby);
  const safe = (food) => ctxs.every((c) => allowed(food, c));
  const out = [];
  const touched = new Set();
  const cooked = occasions.filter((o) => o.kind === 'cooked' && o.facts && !touched.has(o.slotId));
  const loved = (o) => o.prefsFavourite;
  for (const f of analysis.findings.filter((x) => x.level === 'attention' && x.gap)) {
    if (out.length >= 4) break;
    const gap = f.gap;
    if (SWAP_FOR[gap]) {
      for (const [fromId, toId] of SWAP_FOR[gap]) {
        const o = cooked.find((x) => x.facts.foods.includes(fromId) && !touched.has(x.slotId));
        const to = GUIDE.find((g) => g.id === toId);
        if (o && safe(to)) {
          const from = GUIDE.find((g) => g.id === fromId);
          touched.add(o.slotId);
          out.push({ kind: 'swap', slotId: o.slotId, day: o.day, meal: o.meal, from, to, text: `${WEEKDAYS[o.day]} ${MEAL_LABEL[o.meal].toLowerCase()}: try ${to.name} instead of ${from.name} in ${o.title}`, why: f.text });
          break;
        }
      }
      continue;
    }
    if (GAP_FOODS[gap]?.length) {
      const o = cooked.find((x) => !x.facts.groups.includes(gap) && !touched.has(x.slotId) && !loved(x));
      const present = new Set(occasions.flatMap((x) => x.facts?.colours ?? []));
      const food = GAP_FOODS[gap].map((id) => GUIDE.find((g) => g.id === id)).filter((g) => g && safe(g))
        .sort((a, b) => (present.has(a.colour) - present.has(b.colour)))[0];
      if (o && food) {
        touched.add(o.slotId);
        out.push({ kind: 'add', slotId: o.slotId, day: o.day, meal: o.meal, food, text: `${WEEKDAYS[o.day]} ${MEAL_LABEL[o.meal].toLowerCase()}: add ${food.name} to ${o.title}`, why: f.text });
        continue;
      }
    }
    // A small change cannot help: offer a meal from the collection that brings what is missing.
    const groupGap = GROUP[gap] ? gap : null;
    const replaceable = cooked.filter((x) => !touched.has(x.slotId) && !loved(x) && !(x.rating >= 8)).sort((a, b) => (a.rating ?? 6) - (b.rating ?? 6))[0];
    const candidate = groupGap && meals
      .filter((s) => (s.groups ?? []).includes(groupGap) && people.every((p) => suitableFor({ allergens: s.allergens ?? [], animal: s.animal ?? [] }, p)))
      .filter((s) => !Object.values(s.prefs ?? {}).includes('dislikes') && !(s.rating !== null && s.rating < 6))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (replaceable && candidate) {
      touched.add(replaceable.slotId);
      out.push({ kind: 'replace', slotId: replaceable.slotId, day: replaceable.day, meal: replaceable.meal, recipeId: candidate.id, title: candidate.title,
        text: `${WEEKDAYS[replaceable.day]} ${MEAL_LABEL[replaceable.meal].toLowerCase()}: ${candidate.title} instead of ${replaceable.title}`,
        why: `${f.text} ${candidate.title} brings ${GROUP[groupGap].toLowerCase()}${candidate.rating ? ` and is rated ${candidate.rating}/10` : candidate.tried ? '' : ' (not tried yet)'}.` });
    }
  }
  return out;
}

/** The ingredient line a proposal adds to a planned meal: the guide's typical serving for every portion cooked. */
export const additionFor = (food, portions) => ({ name: food.name, qty: Math.round(food.g * portions), unit: 'g', note: '', fdcId: food.fdc });
