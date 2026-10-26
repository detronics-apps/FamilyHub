// Meal Assistant: "What's one easy thing that would make this meal a little
// better for the people eating it?" Pure - no DOM. The specification is in
// docs/MEAL_ASSISTANT.md; the short version:
//
//   1. Read the meal from a few words. No weights, no logging.
//   2. Safety first: allergies, diet, small-child choking risks and pregnancy
//      rules remove a food before anything else is considered.
//   3. Score what is left against the family-wide goal (variety, colour, the
//      main nutrients), then each chosen person's own wishes and life stage.
//   4. Offer a few cards - add, swap, time, try next time - each saying who it
//      helps and why, in plain words, without a score or a verdict on the meal.
//
// Reference values only decide what counts as an opportunity; they are never
// shown, and one meal below them says nothing about anyone's diet.

import { GUIDE, SWAPS, COLOURS } from './guide.js';
import { needsFor, NUTRIENTS } from './reference.js';
import { interaction } from './interactions.js';
import { amounts } from '../../food.js';
import { ageOn, lifeStageAllowed, FOCUS } from '../../model.js';

export const TYPES = { add: 'Add', swap: 'Swap', time: 'Time', next: 'Try next time' };

const SAY = {
  protein: 'protein', fibre: 'fibre', iron: 'iron', calcium: 'calcium', vitC: 'vitamin C', folate: 'folate',
  vitA: 'vitamin A', zinc: 'zinc', magnesium: 'magnesium', potassium: 'potassium', choline: 'choline',
  vitD: 'vitamin D', b12: 'vitamin B12', ala: 'omega-3 fats',
};
// The family-wide goal: always on (spec 3, layer A).
const FAMILY = { protein: 1, fibre: 1, iron: 1, calcium: 1, vitC: 1, folate: 1, vitA: 1, potassium: 1, magnesium: 1, zinc: 1, ala: 1, choline: 0.5, vitD: 0.5, b12: 0.5 };
const FOCUS_NUTRIENT = { protein: ['protein'], iron: ['iron'], calcium: ['calcium'], fibre: ['fibre'], fats: ['ala'] };
const PREGNANCY = ['folate', 'iron', 'choline', 'calcium', 'protein'];
const PLANT = new Set(['veg', 'fruit']);
const IGNORE = new Set(('a an and or with of the in on some little bit plain fresh homemade home made cooked boiled fried grilled roasted baked steamed '
  + 'mashed toasted water side slice slices bowl cup cups glass piece pieces tsp tbsp spoon spoons teaspoon tablespoon handful '
  + 'serving portion my our for lunch dinner breakfast supper snack meal plate leftover leftovers '
  // Seasonings and kitchen basics in a recipe: not worth reporting as "not recognised".
  + 'salt pepper black garlic ginger stock cube cubes spice spices herbs mixed cumin paprika chilli chili turmeric cinnamon '
  + 'curry masala nutmeg oregano basil thyme parsley coriander rosemary bay leaf leaves vanilla baking powder soda vinegar sauce to taste').split(' '));

/* ---------------------------------------------------------- the meal */

/** A Meals & Recipes recipe read as a meal: its ingredients, or its name if it lists none. */
export const recipeMealText = (recipe) => (recipe.ingredients?.length ? recipe.ingredients.map((i) => i.name).join(', ') : recipe.title ?? '');

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALIASES = GUIDE.flatMap((food) => [food.name, ...food.also].map((alias) => ({ alias: alias.toLowerCase(), food })))
  .sort((a, b) => b.alias.length - a.alias.length)
  .map((a) => ({ ...a, re: new RegExp(`(^|[^a-z])${escape(a.alias)}(es|s)?(?=$|[^a-z])`, 'g') }));

/** "oats cooked with water, butter and sugar" -> the foods it recognises, and the words it did not. */
export function parseMeal(text) {
  let rest = ` ${String(text ?? '').toLowerCase()} `;
  const found = new Map();   // food -> where it first appears, so the meal reads back in the order typed
  for (const { re, food } of ALIASES) {
    re.lastIndex = 0;
    const m = re.exec(rest);
    if (!m) continue;
    found.set(food, Math.min(found.get(food) ?? Infinity, m.index));
    rest = rest.replace(re, (x, lead) => `${lead}${' '.repeat(x.length - lead.length)}`);   // longest names claim their words first
  }
  const items = [...found].sort((a, b) => a[1] - b[1]).map(([food]) => food);
  const unknown = [...new Set(rest.split(/[^a-z]+/).filter((w) => w.length > 2 && !IGNORE.has(w)))];
  return { items, unknown };
}

const fitsOf = (items) => {
  const main = items.filter((f) => !['fat', 'sweet', 'drink'].includes(f.group));
  const counts = {};
  for (const f of main.length ? main : items) for (const t of f.fits) counts[t] = (counts[t] ?? 0) + 1;
  const best = Math.max(0, ...Object.values(counts));
  return new Set(Object.keys(counts).filter((t) => counts[t] === best));
};

/* ------------------------------------------------------------ people */

/** One person as the assistant needs them: reference values, wishes, limits, and a child-sized share. */
export function personContext(p, today) {
  const age = ageOn(p.born, today);
  const lifeStage = lifeStageAllowed(p, today) ? p.lifeStage : '';
  const needs = needsFor({ age, role: p.role, sex: p.sex, lifeStage, weightKg: p.weightKg });
  if (!needs) return { id: p.id, name: p.name, baby: true };
  const a = needs.age;
  return {
    id: p.id, name: p.name, age: a, assumedAge: needs.assumed, ref: needs.ref,
    pregnant: lifeStage === 'pregnant', lifeStage,
    focus: new Set(p.focus ?? []), allergies: new Set(p.allergies ?? []), diet: new Set(p.diet ?? []),
    avoid: p.avoid ?? [], likes: p.likes ?? [], dislikes: p.dislikes ?? [],
    share: a <= 3 ? 0.4 : a <= 8 ? 0.6 : a <= 13 ? 0.8 : 1,
  };
}

const names = (food) => [food.name, ...food.also];
const mentions = (food, words) => words.some((w) => names(food).some((n) => n.includes(w) || w.includes(n)));

/** Can this person eat it at all? Allergies, diet and safety rules - never traded against a benefit. */
export function allowed(food, c) {
  if (food.allergens.some((a) => c.allergies.has(a) || c.avoid.includes(a))) return false;
  if (c.avoid.length && mentions(food, c.avoid)) return false;
  const a = food.animal;
  if (a) {
    if (c.diet.has('vegan')) return false;
    if (c.diet.has('vegetarian') && ['meat', 'beef', 'pork', 'fish'].includes(a)) return false;
    if (c.diet.has('pescatarian') && ['meat', 'beef', 'pork'].includes(a)) return false;
    if ((c.diet.has('halal') || c.diet.has('kosher') || c.diet.has('no-pork')) && a === 'pork') return false;
    if (c.diet.has('no-beef') && a === 'beef') return false;
  }
  if (food.child?.avoid && c.age < food.child.under) return false;
  if (food.preg?.avoid && c.pregnant) return false;
  return true;
}

/* ------------------------------------------------------------ scoring */

const portion = (db, food, grams) => {
  const f = db.get(food.fdc);
  return f ? amounts(f, grams) : {};
};

/** What the meal already brings, per nutrient (unknown counts for nothing - it is not assumed to be zero). */
function mealTotals(db, items) {
  const t = Object.fromEntries(NUTRIENTS.map((k) => [k, 0]));
  for (const f of items) for (const [k, v] of Object.entries(portion(db, f, f.g))) if (k in t && v !== null) t[k] += v;
  return t;
}

function weights(c) {
  const w = { ...FAMILY };
  for (const f of c.focus) for (const k of FOCUS_NUTRIENT[f] ?? []) w[k] += 2;
  if (c.pregnant) for (const k of PREGNANCY) w[k] += 1.5;
  return w;
}

/** How much one serving would add for one person, where the meal is light on it. */
function nutrientGain(db, food, c, meal) {
  const add = portion(db, food, food.g);
  const w = weights(c);
  let total = 0;
  let personal = 0;
  const parts = {};
  for (const k of NUTRIENTS) {
    if (add[k] == null || !c.ref[k]) continue;
    const have = (meal[k] * c.share) / c.ref[k];
    const frac = Math.min((add[k] * c.share) / c.ref[k], 0.5);
    const g = frac * (have < 0.3 ? 1 : 0.3);
    total += w[k] * g;
    if (w[k] > FAMILY[k]) personal += (w[k] - FAMILY[k]) * g;
    parts[k] = frac;
  }
  return { total, personal, parts };
}

const ironPriority = (c) => c.focus.has('iron') || c.pregnant;

function scoreFood(db, food, ctx) {
  const { people, meal, colours, hasPlant, plantIron, fits, hasProtein } = ctx;
  if (!food.fits.some((t) => fits.has(t))) return null;
  // A second meat or fish on a plate that has one adds little (spec 9, chicken and rice); beans and lentils still may.
  if (hasProtein && food.group === 'protein') return null;
  if (!people.every((c) => allowed(food, c))) return null;
  let score = 0;
  const why = [];
  const helps = new Map();
  const parts = {};
  for (const c of people) {
    const g = nutrientGain(db, food, c, meal);
    score += g.total / people.length;
    if (g.personal > 0.12) helps.set(c.id, [...c.focus].filter((f) => FOCUS_NUTRIENT[f]?.some((k) => g.parts[k] >= 0.05)).map((f) => FOCUS[f].toLowerCase()));
    if (c.pregnant && g.personal > 0.12 && !helps.get(c.id)?.length) helps.set(c.id, ['pregnancy']);
    for (const [k, v] of Object.entries(g.parts)) parts[k] = (parts[k] ?? 0) + v / people.length;
  }

  const wantsColour = people.some((c) => c.focus.has('colour') || c.focus.has('variety') || c.focus.has('selective'));
  if (PLANT.has(food.group) && !hasPlant) {
    score += wantsColour ? 0.8 : 0.5;
    why.push(`Adds ${food.group === 'veg' ? 'a vegetable' : 'fruit'} to a meal that has none yet.`);
  } else if (food.colour && !colours.has(food.colour) && PLANT.has(food.group)) {
    score += wantsColour ? 0.5 : 0.3;
    why.push(`Adds ${COLOURS[food.colour]} colour the plate does not have yet.`);
  }
  for (const c of people) {
    if (wantsColour && PLANT.has(food.group) && (c.focus.has('colour') || c.focus.has('variety')) && !helps.has(c.id)) helps.set(c.id, ['more colour and plant variety']);
  }

  const vitC = portion(db, food, food.g).vitC ?? 0;
  if (plantIron.length && vitC >= 15) {
    const matters = people.some(ironPriority);
    score += matters ? 0.5 : 0.1;
    if (matters) why.push(`${interaction('vitc-iron').say}, like the ${plantIron[0].name} here.`);
  }

  if (food.dense && people.some((c) => c.focus.has('dense'))) {
    score += 0.6;
    why.push('Plenty of nourishment in a small amount - helpful for a small appetite.');
    for (const c of people) if (c.focus.has('dense')) helps.set(c.id, [...(helps.get(c.id) ?? []), FOCUS.dense.toLowerCase()]);
  }

  const likedBy = people.filter((c) => mentions(food, c.likes));
  const dislikedBy = people.filter((c) => mentions(food, c.dislikes));
  score += 0.4 * likedBy.length - 0.6 * dislikedBy.length;
  if (people.some((c) => c.focus.has('selective')) && food.effort === 1) score += 0.15;
  score -= 0.08 * (food.cost - 1) + 0.08 * (food.effort - 1);

  const strong = Object.entries(parts).filter(([, v]) => v >= 0.1).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (strong.length) {
    const rich = strong.filter(([, v]) => v >= 0.2).map(([k]) => SAY[k]);
    const good = strong.filter(([, v]) => v < 0.2).map(([k]) => SAY[k]);
    why.push([rich.length ? `Rich in ${list(rich)}` : '', good.length ? `${rich.length ? 'and a good source of' : 'A good source of'} ${list(good)}` : ''].filter(Boolean).join(', ') + '.');
  }

  const notes = [];
  for (const c of people) {
    if (food.child && c.age < food.child.under && food.child.prep) notes.push(`For ${c.name}: ${food.child.prep}.`);
    if (food.preg && c.pregnant && food.preg.note) notes.push(`${c.name}: ${food.preg.note}`);
  }
  for (const c of dislikedBy) notes.push(`${c.name} is not keen on it - leave it off ${c.name}’s plate.`);
  if (likedBy.length) why.push(`${list(likedBy.map((c) => c.name))} ${likedBy.length > 1 ? 'like' : 'likes'} it.`);

  return { food, score, why, helps, notes };
}

const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const EFFORT = ['', 'Easy', 'A little work', 'Some work'];

function whoText(helps, people) {
  if (!helps.size) return people.length > 1 ? 'Everyone at the table' : people[0].name;
  const named = people.filter((c) => helps.has(c.id)).map((c) => {
    const why = [...new Set(helps.get(c.id))];
    return why.length ? `${c.name} (${why.join(', ')})` : c.name;
  });
  return people.length > 1 ? `Everyone, especially ${list(named)}` : named[0];
}

/* ------------------------------------------------------------ results */

/**
 * @param text      the meal in a few words
 * @param profiles  people (from the People page), each with the food fields
 * @param selected  ids of the people eating; empty = everyone
 * @param notToday  food ids the person said are not available today
 * @param mealName  what to call the meal on the cards (a recipe's name); else its main foods
 */
export function suggest({ text, profiles, selected = [], db, today, notToday = [], mealName = '' }) {
  const { items, unknown } = parseMeal(text);
  const chosen = (selected.length ? profiles.filter((p) => selected.includes(p.id)) : profiles);
  const everyone = chosen.map((p) => personContext(p, today));
  const babies = everyone.filter((c) => c.baby);
  const people = everyone.filter((c) => !c.baby);
  const notes = [];
  if (babies.length) notes.push(`Family Hub does not make suggestions for babies under one (${list(babies.map((b) => b.name))}) - follow your clinic’s feeding guidance.`);
  const result = { items, unknown, cards: [], cautions: [], notes };
  if (!items.length) return result;
  if (!people.length) {
    if (!babies.length) people.push(personContext({ id: '_', name: 'You', role: 'adult' }, today));
    else return result;
  }

  // Safety about what is already on the plate comes before any idea.
  for (const f of items) {
    for (const c of people) {
      const hit = f.allergens.filter((a) => c.allergies.has(a));
      if (hit.length) { result.cautions.push(`${c.name} is allergic to ${list(hit)} - keep the ${f.name} away from ${c.name}.`); continue; }
      if (f.child && c.age < f.child.under) result.cautions.push(f.child.avoid ? `${cap(f.name)} ${f.name.endsWith('s') ? 'are' : 'is'} not safe for children under ${f.child.under} - leave ${f.name.endsWith('s') ? 'them' : 'it'} off ${c.name}’s plate.` : `For ${c.name}, the ${f.name}: ${f.child.prep}.`);
      if (f.preg && c.pregnant) result.cautions.push(`${c.name}: ${f.preg.note}`);
    }
  }

  const ctx = {
    people, meal: mealTotals(db, items), fits: fitsOf(items),
    colours: new Set(items.filter((f) => PLANT.has(f.group)).map((f) => f.colour).filter(Boolean)),
    hasPlant: items.some((f) => PLANT.has(f.group)),
    hasProtein: items.some((f) => f.group === 'protein'),
    plantIron: items.filter((f) => f.iron === 'plant'),
  };
  const ranked = GUIDE.filter((f) => f.suggest && !items.includes(f))
    .map((f) => scoreFood(db, f, ctx)).filter((s) => s && s.score > 0.15)
    .sort((a, b) => b.score - a.score);

  const card = (type, s, extra = {}) => ({
    type, id: `${type}:${s.food.id}`, foodId: s.food.id, title: '', who: whoText(s.helps, people),
    why: s.why.slice(0, 3), effort: EFFORT[s.food.effort], notes: s.notes, alternatives: [], ...extra,
  });

  // ADD: the best two, of different kinds - fruit and vegetables count as one kind here.
  const kind = (f) => (PLANT.has(f.group) ? 'plant' : f.group);
  const groups = new Set();
  const adds = [];
  for (const s of ranked) {
    if (adds.length === 2 || groups.has(kind(s.food))) continue;
    groups.add(kind(s.food));
    adds.push(s);
  }
  for (const s of adds) {
    const alts = ranked.filter((r) => r !== s && !adds.includes(r) && (r.food.group === s.food.group || (r.food.colour && r.food.colour === s.food.colour))).slice(0, 2);
    const title = `${cap(s.food.name)} with the ${mealName || items.filter((f) => !['fat', 'sweet', 'drink'].includes(f.group)).map((f) => f.name).slice(0, 2).join(' and ') || 'meal'}`;
    const c = card('add', s, { title, alternatives: alts.map((a) => a.food.name) });
    result.cards.push(notToday.includes(s.food.id) ? toNext(c, s) : c);
  }

  // SWAP: one, only where it keeps the meal's role and adds something.
  for (const sw of SWAPS) {
    const from = items.find((f) => f.id === sw.from);
    const to = GUIDE.find((f) => f.id === sw.to);
    if (!from || items.includes(to)) continue;
    const s = scoreFood(db, to, { ...ctx, fits: new Set(to.fits) });
    if (!s || s.score <= 0.1) continue;
    const c = card('swap', s, { title: `Try ${to.name} instead of ${from.name}`, why: [sw.why, ...s.why.slice(-1)] });
    result.cards.push(notToday.includes(to.id) ? toNext(c, s) : c);
    break;
  }

  // TIME: only where there is a real reason (spec 8C) - never "calcium must always be separated from iron".
  const ironFolk = people.filter(ironPriority);
  if (ironFolk.length && ctx.plantIron.length) {
    const drink = items.find((f) => f.id === 'tea' || f.id === 'coffee');
    if (drink) {
      result.cards.push({
        type: 'time', id: `time:${drink.id}`, foodId: drink.id, title: `Have the ${drink.name} an hour or so after the meal`,
        who: list(ironFolk.map((c) => c.name)), why: [`${interaction('tea-iron').say}.`, interaction('tea-iron').limitations],
        effort: 'Easy', notes: [], alternatives: [],
      });
    }
    const dairy = items.find((f) => f.group === 'dairy');
    if (dairy) {
      result.cards.push({
        type: 'time', id: `time:${dairy.id}`, foodId: dairy.id, title: `If iron is the priority, have the ${dairy.name} at another time of day`,
        who: list(ironFolk.map((c) => c.name)), why: [`${interaction('calcium-iron').say}.`, 'Keep it in the day - it brings protein and calcium.'],
        effort: 'Easy', notes: [], alternatives: [],
      });
    }
  }
  const picky = people.filter((c) => c.focus.has('selective'));
  const plantAdd = adds.find((s) => PLANT.has(s.food.group));
  if (picky.length && plantAdd) {
    result.cards.push({
      type: 'time', id: `time:side:${plantAdd.food.id}`, foodId: plantAdd.food.id, title: `Offer the ${plantAdd.food.name} on the side`,
      who: list(picky.map((c) => c.name)),
      why: ['A small amount next to familiar food, with no pressure to eat it, makes trying it easier. It can take many tries.', 'Keep the foods they already enjoy on the plate.'],
      effort: 'Easy', notes: [], alternatives: [],
    });
  }

  // TRY NEXT TIME: the next good idea, for when today's ingredients are not in the house.
  const shown = new Set(result.cards.flatMap((c) => [c.foodId, ...c.alternatives]));
  const next = ranked.find((s) => !adds.includes(s) && !shown.has(s.food.id) && !shown.has(s.food.name));
  if (next) result.cards.push(toNext(card('next', next), next));

  if (people.some((c) => c.pregnant)) notes.push('These are food ideas only. For supplements such as folic acid or iron, follow your antenatal clinic.');
  if (people.some((c) => c.focus.has('dense') || c.focus.has('selective'))) notes.push('If eating stays difficult, or you are worried about growth or weight, talk to your clinic or a dietitian.');
  if (people.some((c) => c.assumedAge) && profiles.length) notes.push('Add birthdays on the People page so suggestions fit each age.');
  return result;
}

function toNext(c, s) {
  return { ...c, type: 'next', id: `next:${s.food.id}`, title: `Next time: ${s.food.name}`, why: [...c.why.slice(0, 2)] };
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
