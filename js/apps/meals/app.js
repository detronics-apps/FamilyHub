// Cookbook (Meals section): the family's meals and recipes. A meal without a
// method is a meal; adding the method makes it a recipe. A meal can be planned in
// This Week and sent to Shopping - each of those apps writes its own records.
// Each meal shows how it might be shared out among the family (js/portions.js).
// Recipes live in a collection with an index, so a library of thousands is
// searched from one file and a recipe is read only when it is opened.
//
// Feedback lives on the recipe: tried or not, the family rating (1-10, only
// once tried), each person's preference kept apart from it, and dated notes.
// This Week links here to record them, and to save a changed planned meal as a
// new version or into the original - only this app writes recipes.

import { el } from '../../ui/dom.js';
import { confirmAction, fold, roomy } from '../../ui/common.js';
import { loading, failure, recordForm, saveRecord } from '../kit.js';
import {
  ALLERGENS, NUTRIENTS, normaliseRecipe, recipeSummary, recipeText, nutritionRows,
  formatIngredient, TYPES, typeOf, typeName, keepFoodLinks, mealFromPlate, mealFromLink,
  PREFS, ratingMeaning, ratingState, setRating, setTried, setPref, addNote, SUMMARY_VERSION,
  batchMultiplier, splitOwn, mergeOwn, collectRecipes, scaleCarefully, combineIngredients, goodFor, setGoodFor,
} from './logic.js';
import { ingredientEditor, UNIT_OPTIONS } from '../../ui/ingredient-editor.js';
import { mealNutrition, batchGrams } from '../../meal-nutrition.js';
import { MEAL_TAGS } from './facts.js';
import { nutritionPanel } from '../../ui/nutrition-view.js';
import { portionShares, portionPlan, fmtShare, LEFTOVERS } from '../../portions.js';
import { sendHref } from '../shopping/logic.js';

import { inSystem } from '../../units.js';

const ui = { query: '', avoid: [], kind: 'all', maxMinutes: null, servings: {}, limit: 50, who: {}, leftovers: {} };
const TIMES = [[null, 'Any time'], [20, '≤ 20 min'], [30, '≤ 30 min'], [60, '≤ 1 hour']];
const KINDS = { all: 'All', ...TYPES };
// "an item", "a meal", "a recipe", "an own ingredient"
const aType = (t) => `${t === 'own' || !TYPES[t] ? 'an' : 'a'} ${typeName(t).toLowerCase()}`;
const typeBadge = (t, style) => el('span', { class: `badge${t === 'recipe' ? ' badge--ok' : t === 'own' ? ' badge--accent' : ''}`, text: typeName(t), style, 'data-field': 'type-badge' });

const recipes = (hub) => hub.data.collection('recipes', { summary: recipeSummary, text: recipeText, prefix: 'rec' });
// The family's own sizes of a food ("1 ring of feta = 200 g"), one record each.
const sizes = (hub) => hub.data.collection('sizes', { summary: (s) => ({ fdcId: s.fdcId, label: s.label, grams: s.grams, at: s.at }), prefix: 'size' });
export const loadSizes = (list) => list.reduce((m, s) => m.set(s.fdcId, [...(m.get(s.fdcId) ?? []), s]), new Map());

/** Back to where the person came from (This Week), when a link said so. */
const backLink = (hash) => (hash && /^#\/mealplan\b/.test(hash) ? el('a', { href: hash, class: 'small', text: '‹ Back', title: 'Back to Meal Planner', 'data-field': 'back-planner' }) : null);

/** An index written before ratings and facts were kept is rebuilt once from the meal files (they are not changed). */
const ensureIndex = (hub) => hub.use('index-version', async () => {
  const all = await recipes(hub).list({ limit: 100000 });
  if (all.items.some((s) => s.ix !== SUMMARY_VERSION)) { await recipes(hub).rebuildIndex(); hub.invalidate('search:'); }
  return true;
});

export function render(hub, route) {
  const screen = route.sub ?? 'recipes';
  if (screen === 'item') return recipeScreen(hub, route.rest[0], route.rest[1] ?? null);
  if (screen === 'new') return editScreen(hub, null, route.rest[0] ?? null);
  if (screen === 'edit') return editScreen(hub, route.rest[0], route.rest[1] ?? null);
  if (screen === 'note') return noteScreen(hub, route.rest[0], route.rest[1] ?? '');
  if (screen === 'goodfor') return goodForScreen(hub, route.rest[0], route.rest[1] ?? '');
  // The week and the shopping list moved to their own mini-apps (This Week, Shopping).
  if (screen === 'week' || screen === 'shopping') {
    return el('p', { class: 'panel' }, [`That has moved: `, el('a', { href: screen === 'week' ? '#/mealplan' : '#/shopping', text: screen === 'week' ? 'Meal Planner' : 'Shopping' }), '.']);
  }
  return recipesScreen(hub);
}

/* ------------------------------------------------------------ recipes */

function recipesScreen(hub) {
  const ix = ensureIndex(hub);
  if (ix.loading) return loading('Bringing the list up to date…');
  const people = hub.foodProfiles();
  const key = `search:${ui.query}:${ui.avoid.join(',')}:${ui.kind}:${ui.maxMinutes}:${ui.limit}`;
  const kindOk = (s) => ui.kind === 'all' || typeOf(s) === ui.kind;
  const r = hub.use(key, () => recipes(hub).search(ui.query, {
    limit: ui.limit,
    // A meal with no time recorded is not counted as quick.
    filter: (s) => kindOk(s) && !s.allergens.some((a) => ui.avoid.includes(a)) && (ui.maxMinutes === null || (s.minutes && s.minutes < ui.maxMinutes)),
  }));
  return el('section', { class: 'stack', 'aria-label': 'Cookbook' }, [
    el('div', { class: 'row' }, [
      el('div', { style: { flex: '1 1 220px' } }, [el('input', {
        class: 'input', type: 'search', placeholder: 'Search by name, ingredient or tag', 'aria-label': 'Search the Cookbook', value: ui.query, 'data-field': 'recipe-search',
        on: { change: (e) => { ui.query = e.target.value; ui.limit = 50; hub.render(); } },
      })]),
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'New item', 'data-field': 'add-recipe' }),
    ]),
    fold('cookbook-filters', 'Filters', [
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Show' }, Object.entries(KINDS).map(([k, label]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(ui.kind === k), text: label, 'data-field': `kind:${k}`,
      on: { click: () => { ui.kind = k; ui.limit = 50; hub.render(); } },
    }))),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Time' }, TIMES.map(([v, t]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(ui.maxMinutes === v), text: t, 'data-field': `time:${v ?? 'any'}`,
      on: { click: () => { ui.maxMinutes = v; ui.limit = 50; hub.render(); } },
    }))),
    ui.maxMinutes !== null ? el('p', { class: 'small muted', text: 'Preparation plus cooking time. Meals with no time recorded are left out - add it with Edit.' }) : null,
    el('fieldset', {}, [
      el('legend', { class: 'small', text: 'Leave out anything containing' }),
      el('div', { class: 'chipset' }, ALLERGENS.map((a) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(ui.avoid.includes(a)), text: a,
        on: { click: () => { ui.avoid = ui.avoid.includes(a) ? ui.avoid.filter((x) => x !== a) : [...ui.avoid, a]; hub.render(); } },
      }))),
      el('p', { class: 'small muted', text: 'Only as reliable as the allergens marked on each item - always check the actual ingredients.' }),
    ]),
    ], { open: roomy(), cls: 'panel', note: [ui.kind !== 'all' ? KINDS[ui.kind] : null, ui.maxMinutes !== null ? TIMES.find(([v]) => v === ui.maxMinutes)?.[1] : null, ui.avoid.length ? `without ${ui.avoid.join(', ')}` : null].filter(Boolean).join(' · ') || 'Everything' }),
    r.loading ? loading() : r.error ? failure(r.error) : r.data.total ? el('div', { class: 'stack' }, [
      el('p', { class: 'small muted', text: `${r.data.total} found` }),
      el('ul', { class: 'list panel' }, r.data.items.map((s) => el('li', {}, [
        el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
          el('strong', { text: s.title }), typeBadge(typeOf(s), { marginLeft: 'var(--space-2)' }),
          el('div', { class: 'small muted', text: [feedbackLine(s, people), s.minutes ? `${s.minutes} min` : null, `serves ${s.servings}`, s.tags.length ? s.tags.join(', ') : null, s.allergens.length ? `contains ${s.allergens.join(', ')}` : null].filter(Boolean).join(' · ') }),
        ]),
      ]))),
      r.data.total > r.data.items.length ? el('button', { class: 'btn', type: 'button', text: 'Show more', on: { click: () => { ui.limit += 50; hub.render(); } } }) : null,
    ]) : el('div', { class: 'panel empty' }, [el('p', { text: ui.query || ui.avoid.length ? 'Nothing matches.' : 'Nothing here yet. Add the meals your family already likes - a name and the ingredients are enough; the method can come later.' })]),
  ]);
}

function recipeScreen(hub, id, back) {
  const r = hub.use(`recipe:${id}`, () => recipes(hub).get(id));
  const f = hub.use('food', () => hub.food.load());
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This item no longer exists.' }), el('a', { class: 'btn', href: hub.href('recipes'), text: 'The Cookbook' })]);
  const rec = normaliseRecipe(r.data);
  const serves = ui.servings[id] ?? rec.servings;
  const setServes = (n) => { ui.servings[id] = Math.max(1, n); hub.render(); };
  const rows = nutritionRows(rec).filter((x) => x.known);
  // Our own items used in it (home-made mayo), however deep - loaded before anything is worked out.
  const subs = hub.use(`subs:${id}:${r.data.rev ?? 0}`, () => collectRecipes(rec.ingredients, (x) => recipes(hub).get(x)));
  if (subs.loading) return loading();
  const getSub = (x) => subs.data?.get(x) ?? null;
  // One calculation for this page's calories, chart and per-person figures (js/meal-nutrition.js).
  const n = f.data && rec.ingredients.length ? mealNutrition(rec.ingredients, rec.servings, f.data, { recipes: subs.data }) : null;
  const kcal = n?.kcal.known && n.kcal.complete ? n.kcal.serving : null;
  const original = rec.variantOf ? hub.use(`recipe:${rec.variantOf}`, () => recipes(hub).get(rec.variantOf)) : null;

  return el('section', { class: 'stack' }, [
    backLink(back) ?? el('a', { href: hub.href('recipes'), class: 'small', text: '‹ Cookbook' }),
    el('article', { class: 'panel stack' }, [
      el('div', { class: 'row' }, [
        el('h1', { text: rec.title, style: { margin: 0 } }), typeBadge(rec.type),
      ]),
      rec.yield.qty ? el('p', { class: 'small', style: { margin: 0 }, text: `Makes ${fmtQtyText(rec.yield.qty * (serves / rec.servings))} ${rec.yield.unit}${serves !== rec.servings ? ` (for ${serves} servings)` : ''}.` }) : null,
      rec.type === 'own' && !rec.yield.qty ? el('p', { class: 'small', text: 'Edit it and say what one batch makes (e.g. 300 ml), so other entries can use part of it.' }) : null,
      rec.variantOf ? el('p', { class: 'small' }, ['A version of ', el('a', { href: hub.href('item', rec.variantOf), text: original?.data?.title ?? 'another item' }), ' - its notes and ratings are its own.']) : null,
      rec.description ? el('p', { text: rec.description }) : null,
      el('p', { class: 'small muted', text: [rec.prepMinutes != null ? `prep ${rec.prepMinutes} min` : null, rec.cookMinutes != null ? `cook ${rec.cookMinutes} min` : null, rec.tags.join(', ') || null, rec.allergens.length ? `contains ${rec.allergens.join(', ')}` : null].filter(Boolean).join(' · ') }),
      el('div', { class: 'row' }, [
        el('span', { text: 'Servings' }),
        el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '−', 'aria-label': 'Fewer servings', on: { click: () => setServes(serves - 1) } }),
        el('strong', { text: String(serves), 'data-field': 'servings' }),
        el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '+', 'aria-label': 'More servings', on: { click: () => setServes(serves + 1) } }),
      ]),
      el('h2', { text: 'Ingredients' }),
      // Whole-only items (eggs) stay whole when the servings change.
      rec.ingredients.length ? el('ul', {}, rec.ingredients.map((i) => scaleCarefully(i, serves / rec.servings)).map((i) => el('li', {}, [
        i.recipeId && getSub(i.recipeId) ? el('a', { href: hub.href('item', i.recipeId), text: formatIngredient(inSystem(i, hub.units())) }) : formatIngredient(inSystem(i, hub.units())),
        i.note ? ` (${i.note})` : '', i.recipeId ? el('span', { class: 'small muted', text: ' - our own' }) : null,
      ]))) : el('p', { class: 'small muted', text: 'No ingredients listed.' }),
      rec.instructions.length ? el('div', {}, [el('h2', { text: 'Method' }), el('ol', { class: 'howto-steps' }, rec.instructions.map((s) => el('li', { text: s })))])
        : el('p', { class: 'small' }, ['No method yet. ', el('a', { href: hub.href('edit', rec.id), text: 'Add the method', 'data-field': 'add-method' }), ' when you have it.']),
      rec.source ? el('p', { class: 'small muted', text: `Source: ${rec.source}` }) : null,
    ]),
    feedbackPanel(hub, rec),
    el('div', { class: 'panel stack', 'aria-label': 'Nutrition' }, [
      el('h2', { text: 'What is in it', style: { margin: 0 } }),
      f.loading ? loading('Opening the food database…') : f.error ? failure(f.error)
        : n ? nutritionPanel(n, f.data, { shares: portionShares(hub.foodProfiles(), hub.today()), servingsLabel: `serving (the recipe serves ${rec.servings})` })
          : el('p', { class: 'small muted', text: 'Add ingredients to see what is in it.' }),
      rows.length ? el('details', { class: 'measures' }, [
        el('summary', { text: 'Figures typed in by hand' }),
        el('table', { class: 'facts' }, [el('tbody', {}, rows.map((x) => el('tr', {}, [el('th', { scope: 'row', text: x.key }), el('td', { text: `${x.value} ${x.unit}` })])))]),
      ]) : null,
    ]),
    portionsPanel(hub, rec, serves, setServes, kcal),
    el('div', { class: 'row' }, [
      hub.data.installed('mealplan') ? el('a', { class: 'btn btn-primary', href: `#/mealplan/add/${encodeURIComponent(`${rec.id}~${serves}`)}`, text: 'Plan it', 'data-field': 'plan-meal' }) : null,
      hub.data.installed('shopping') && rec.ingredients.length ? el('a', { class: 'btn', href: sendHref({ source: `meal:${rec.id}`, from: rec.title, group: 'food', ...shopSplit(rec.ingredients, serves / rec.servings, getSub) }), text: 'To Shopping', title: 'Send the ingredients to the shopping list', 'data-field': 'send-shopping' }) : null,
      el('a', { class: 'btn', href: hub.href('edit', rec.id), text: 'Edit' }),
      hub.data.installed('assistant') ? el('a', { class: 'btn', href: `#/assistant/meal/recipe:${encodeURIComponent(rec.id)}`, text: 'Improve', title: 'Ideas from the Meal Assistant', 'data-field': 'improve-recipe' }) : null,
      el('button', {
        class: 'btn btn-quiet', type: 'button', text: 'Delete',
        on: { click: async () => { if (!await confirmAction({ title: `Delete ${rec.title}?`, text: 'Meals already planned keep their name. Its notes and ratings go with it.', confirmLabel: 'Delete', danger: true })) return; await recipes(hub).remove(rec.id); hub.invalidate(); hub.go('recipes'); } },
      }),
    ]),
  ]);
}

function editScreen(hub, id, param = null) {
  // From This Week: `variant:<json>` saves a changed planned meal as a new version;
  // on an existing meal, `update:<json>` brings that planned meal's ingredients in for review.
  const handed = param?.startsWith('variant:') || param?.startsWith('update:') ? mealFromLink(param.slice(param.indexOf(':') + 1)) : null;
  // Where the changed ingredients come from: the Meal Assistant's ideas, or a planned meal.
  const fromIdeas = handed ? /"from":"ideas"/.test(param) : false;
  const changedIn = fromIdeas ? 'the Meal Assistant ideas you applied' : 'the planned meal you changed';
  const r = id ? hub.use(`recipe:${id}`, () => recipes(hub).get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseRecipe(r.data) : null;
  // Built in Calorie Checker and handed over in the link (`item:<json>`; older links say `plate:`).
  const fromPlate = !existing && /^(item|plate):/.test(param ?? '') ? mealFromPlate(param.slice(param.indexOf(':') + 1)) : null;
  const base = existing ?? fromPlate ?? (handed && !id ? handed : null) ?? normaliseRecipe({ title: '' });
  const rec = existing && handed ? { ...existing, ingredients: handed.ingredients, servings: handed.servings } : base;
  // The ingredient rows being edited live here, so a redraw of the page never loses them.
  const draftKey = `${id ?? 'new'}:${param ?? ''}`;
  if (ui.draft?.key !== draftKey) {
    const known = UNIT_OPTIONS.some(([u]) => u === rec.yield.unit);
    ui.draft = {
      key: draftKey, rows: rec.ingredients.map((i) => ({ ...i })),
      // A new meal is weighed in grams; a worked-out amount is left empty so it is worked out again.
      yield: { qty: rec.yield.auto ? null : rec.yield.qty, unit: !existing && !rec.yield.unit ? 'g' : known ? rec.yield.unit : 'other', other: known ? '' : rec.yield.unit },
    };
  }
  const f = hub.use('food', () => hub.food.load());
  const ix = ensureIndex(hub);
  if (ix.loading) return loading('Bringing the list up to date…');
  // All our own meals: any of them can be used in another (one not yet set up is set up when picked).
  const own = hub.use('own-items', async () => (await recipes(hub).list({ limit: 100000 })).items);
  const ourSizes = hub.use('sizes', async () => loadSizes((await sizes(hub).list({ limit: 100000 })).items));
  const flat = {
    ...rec,
    title: existing || ((fromPlate || handed) && rec.title !== 'Untitled item') ? rec.title : '',
    mealTypes: Object.keys(MEAL_TAGS).filter((t) => rec.tags.includes(t) || (t === 'dinner' && rec.tags.includes('supper'))),
    tags: rec.tags.filter((t) => !MEAL_TAGS[t] && t !== 'supper').join(', '),
    ...Object.fromEntries(NUTRIENTS.map(([k]) => [`n_${k}`, rec.nutrition[k] ?? null])),
  };
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add an item' }),
    fromPlate ? el('p', { class: 'small muted', text: 'From Calorie Checker. Give it a name, and say whether it is a meal, a recipe or an own ingredient - or leave it as an item for now.' }) : null,
    handed && !id ? el('p', { class: 'small muted', text: `A new version from ${changedIn}. It gets its own notes and ratings; the original stays as it is.` }) : null,
    handed && id ? el('p', { class: 'small', text: `These are the ingredients from ${changedIn}. Saving updates the saved recipe for every future time - its ratings and notes stay.` }) : null,
    recordForm({
      record: flat,
      fields: [
        { key: 'title', label: 'Name', required: true },
        { key: 'type', group: 'About it', label: 'This is', type: 'select', options: [['', 'an item (not decided yet)'], ...Object.keys(TYPES).map((k) => [k, aType(k)])], hint: 'Meal: what the family eats at one sitting. Recipe: making one thing, like a cake or a salad. Own ingredient: something you make to use in others, like mayo. Any of them can be used in another.' },
        { key: 'servings', group: 'About it', label: 'Serves', type: 'number' },
        { key: 'mealTypes', group: 'About it', label: 'Good for', type: 'choices', options: Object.entries(MEAL_TAGS), hint: 'Used by Meal Planner when looking for a breakfast, lunch, supper or snack.' },
        { key: 'prepMinutes', group: 'About it', label: 'Preparation (minutes)', type: 'number', hint: 'Prep plus cooking time lets you find quick meals when time is short.' },
        { key: 'cookMinutes', group: 'About it', label: 'Cooking (minutes)', type: 'number' },
        { key: 'yield', group: 'About it', label: 'One batch makes', type: 'custom', control: () => yieldControl(f.data ?? null) },
        {
          key: 'ingredients', group: 'Ingredients and method', label: 'Ingredients', type: 'custom',
          control: () => ({
            node: ingredientEditor({
              rows: ui.draft.rows, db: f.data ?? null, own: own.data ?? [], selfId: existing?.id ?? null, onChange: () => ui.yieldHint?.(),
              sizes: ourSizes.data ?? new Map(), system: hub.units(),
              onAddSize: async ({ fdcId, label, grams }) => { await sizes(hub).put({ fdcId, label, grams, at: Date.now() }); },
              onMakeIngredient: (x) => makeIngredient(hub, x, f.data),
            }),
            get: () => ui.draft.rows.filter((x) => x.name.trim()),
          }),
        },
        { key: 'instructions', group: 'Ingredients and method', label: 'Method', type: 'lines', rows: 6, hint: 'One step per line, now or later.' },
        { key: 'description', label: 'Description', type: 'textarea', more: true },
        { key: 'tags', label: 'Tags', more: true, hint: 'Separated by commas, e.g. quick, vegetarian, kids like it.' },
        { key: 'allergens', label: 'Contains', type: 'choices', options: ALLERGENS.map((a) => [a, a]), more: true },
        ...NUTRIENTS.map(([k, unit]) => ({ key: `n_${k}`, label: `${k[0].toUpperCase() + k.slice(1)} per serving (${unit})`, type: 'number', more: true, placeholder: 'only if known' })),
        { key: 'notes', label: 'Family notes', type: 'textarea', more: true },
        { key: 'source', label: 'Where it came from', more: true },
      ],
      onCancel: () => { ui.draft = null; if (existing) hub.go('item', existing.id); else hub.go('recipes'); },
      onSave: async (values) => {
        const nutrition = Object.fromEntries(NUTRIENTS.map(([k]) => [k, values[`n_${k}`]]));
        for (const [k] of NUTRIENTS) delete values[`n_${k}`];
        // Weighed in grams with no amount given: the ingredients' total (165 + 60 + 8 + 6 g = 239 g).
        if (values.yield.qty == null && WEIGHT[values.yield.unit] && values.type === 'own') {
          const w = batchGrams(values.ingredients, f.data ?? await hub.food.load());
          if (w.grams) values.yield = { qty: Math.round((w.grams / WEIGHT[values.yield.unit]) * 100) / 100, unit: values.yield.unit, auto: true };
        }
        if (values.type === 'own' && !values.yield.qty) { hub.ui.notice('Say what one batch of an own ingredient makes - or choose g and it is worked out from the ingredients.', 'warn'); return; }
        values.type = values.type ?? '';
        values.tags = [...values.mealTypes, ...String(values.tags).split(',')];
        delete values.mealTypes;
        const next = normaliseRecipe({ ...rec, ...values, nutrition });
        const saved = await saveRecord(hub, recipes(hub), { ...next, ingredients: keepFoodLinks(next.ingredients, rec.ingredients) });
        if (saved) { ui.draft = null; hub.invalidate('own-items'); hub.ui.notice(`Saved as ${aType(saved.type)}.`); hub.go('item', saved.id); }
      },
    }),
  ]);
}

/** "★ 7/10 · Mia's favourite", "Not tried yet", "Tried, not rated". */
function feedbackLine(s, people) {
  const state = !s.tried ? 'Not tried yet' : s.rating == null ? 'Tried, not rated' : `★ ${s.rating}/10`;
  const favs = Object.entries(s.prefs ?? {}).filter(([, v]) => v === 'favourite').map(([pid]) => people.find((p) => p.id === pid)?.name).filter(Boolean);
  return [s.tried === undefined ? null : state, favs.length ? `${favs.join(' and ')}’s favourite` : null].filter(Boolean).join(' · ');
}

/** Tried, family rating, each person's preference, and dated notes - saved as soon as they change. */
function feedbackPanel(hub, rec) {
  const save = async (next) => { await saveRecord(hub, recipes(hub), next); };
  const people = hub.foodProfiles();
  const state = ratingState(rec);
  const note = el('textarea', { class: 'input', id: 'note-new', rows: '2', placeholder: 'e.g. Use less salt; roast the broccoli instead', 'data-field': 'note-new' });
  return el('div', { class: 'panel stack', 'aria-label': 'Feedback' }, [
    el('h2', { text: 'How the family finds it', style: { margin: 0 } }),
    el('div', { class: 'row' }, [
      el('label', { class: 'checkline' }, [
        el('input', { type: 'checkbox', checked: rec.tried, 'data-field': 'tried', on: { change: (e) => save(setTried(rec, e.target.checked)) } }), 'We have tried it',
      ]),
      el('label', { class: 'small', for: 'rating', text: 'Family rating' }),
      el('select', { class: 'select', id: 'rating', style: { width: 'auto' }, disabled: !rec.tried, 'data-field': 'rating', on: { change: (e) => save(setRating(rec, e.target.value ? Number(e.target.value) : null)) } }, [
        el('option', { value: '', text: rec.tried ? 'Not rated yet' : 'Try it first', selected: rec.rating === null }),
        ...Array.from({ length: 10 }, (_, i) => 10 - i).map((v) => el('option', { value: String(v), text: `${v} - ${ratingMeaning(v)}`, selected: rec.rating === v })),
      ]),
      el('span', { class: 'badge', text: { untried: 'Not tried yet', unrated: 'Tried, not rated', rated: `${rec.rating}/10 · ${ratingMeaning(rec.rating)}` }[state] }),
    ]),
    people.length ? el('div', {}, [
      el('p', { class: 'small', style: { margin: '0 0 var(--space-1)' }, text: 'Each person, apart from the family rating:' }),
      el('table', { class: 'facts' }, [el('tbody', {}, people.map((p) => el('tr', {}, [
        el('th', { scope: 'row', text: p.name }),
        el('td', {}, el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': `${p.name}'s preference`, 'data-field': `pref:${p.id}`, on: { change: (e) => save(setPref(rec, p.id, e.target.value || null)) } }, [
          el('option', { value: '', text: 'Not rated', selected: !rec.prefs[p.id] }),
          ...Object.entries(PREFS).map(([k, label]) => el('option', { value: k, text: label, selected: rec.prefs[p.id] === k })),
        ])),
      ])))]),
    ]) : null,
    el('div', {}, [
      el('h3', { text: 'Notes for next time', style: { margin: 'var(--space-2) 0 var(--space-1)' } }),
      rec.notes ? el('p', { class: 'small', text: rec.notes }) : null,
      rec.noteLog.length ? el('ul', { class: 'guidance' }, [...rec.noteLog].reverse().map((x) => el('li', {}, [
        el('span', { class: 'small muted', text: `${x.at}${x.from === 'occurrence' ? ` · from ${x.occasion || 'a planned meal'}` : ''}: ` }), x.text,
      ]))) : null,
      el('div', { class: 'row', style: { marginTop: 'var(--space-2)' } }, [
        el('label', { class: 'sr-only', for: 'note-new', text: 'New note' }), note,
        el('button', { class: 'btn btn-small', type: 'button', text: 'Add note', 'data-field': 'note-add', on: { click: () => { if (note.value.trim()) save(addNote(rec, note.value, { at: hub.today() })); } } }),
      ]),
      el('p', { class: 'small muted', text: 'Notes here are about the recipe for every time. A note about one particular meal goes on that day in Meal Planner.' }),
    ]),
  ]);
}

/** A cooking note from This Week, added to the recipe's notes only when the person says yes. */
function noteScreen(hub, id, param) {
  let note = null;
  try { note = JSON.parse(param); } catch { note = null; }
  const r = hub.use(`recipe:${id}`, () => recipes(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data || !note?.text) return el('p', { class: 'panel', text: 'Nothing to add.' });
  const rec = normaliseRecipe(r.data);
  return el('section', { class: 'stack' }, [
    el('h1', { text: `Add a note to ${rec.title}?` }),
    el('blockquote', { class: 'panel', text: note.text }),
    el('p', { class: 'small muted', text: `From ${note.occasion || 'a planned meal'}. It will show with the recipe for every future time; the planned meal keeps its own note too.` }),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Save note', title: 'Add to the recipe’s notes', 'data-field': 'note-promote',
        on: { click: async () => { if (await saveRecord(hub, recipes(hub), addNote(rec, note.text, { from: 'occurrence', occasion: note.occasion, at: hub.today() }))) { hub.ui.notice('Added to the recipe’s notes.'); hub.open(note.back || hub.href('item', id)); } } },
      }),
      el('a', { class: 'btn', href: note.back || hub.href('item', id), text: 'Cancel' }),
    ]),
  ]);
}

/** After cooking it (from Meal Planner): say which meals it is good for - the B, L, D and S flags on the planner. */
function goodForScreen(hub, id, param) {
  let link = null;
  try { link = JSON.parse(param); } catch { link = null; }
  const r = hub.use(`recipe:${id}`, () => recipes(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('p', { class: 'panel', text: 'That meal is not in the Cookbook.' });
  const rec = normaliseRecipe(r.data);
  const back = link?.back || hub.href('item', id);
  if (ui.goodFor?.id !== id) ui.goodFor = { id, meals: goodFor(rec.tags) };
  const st = ui.goodFor;
  return el('section', { class: 'stack' }, [
    el('h1', { text: `What is ${rec.title} good for?` }),
    link?.had ? el('p', { class: 'small muted', text: `You had it for ${MEAL_TAGS[link.had]?.toLowerCase() ?? link.had}.` }) : null,
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Good for' }, Object.entries(MEAL_TAGS).map(([k, t]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(st.meals.includes(k)), text: t, 'data-field': `goodfor:${k}`,
      on: { click: () => { st.meals = st.meals.includes(k) ? st.meals.filter((x) => x !== k) : [...st.meals, k]; hub.render(); } },
    }))),
    el('p', { class: 'small muted', text: 'Shown as little B, L, D and S flags on the meal in Meal Planner, and used when looking for a breakfast, lunch, supper or snack.' }),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'goodfor-save',
        on: { click: async () => { if (await saveRecord(hub, recipes(hub), setGoodFor(rec, st.meals))) { ui.goodFor = null; hub.ui.notice(`Saved what ${rec.title} is good for.`); hub.open(back); } } },
      }),
      el('a', { class: 'btn', href: back, text: 'Cancel', on: { click: () => { ui.goodFor = null; } } }),
    ]),
  ]);
}

/** For the shopping list: bought as is, and home-made items apart so "already made" can leave them off. */
function shopSplit(lines, factor, getSub) {
  const s = splitOwn(lines, factor, getSub);
  return { items: combineIngredients(s.base), own: mergeOwn(s.own) };
}
const WEIGHT = { g: 1, kg: 1000 };

/** Picked into another entry but it does not say what it makes: weigh it, and save that as what one batch makes. */
async function makeIngredient(hub, id, db) {
  const r = normaliseRecipe(await recipes(hub).get(id));
  let y = r.yield;
  if (!y.qty) {
    const w = batchGrams(r.ingredients, db ?? await hub.food.load());
    if (!w.grams) { hub.ui.notice(`${r.title} has no amounts to weigh. Open it and say what one batch makes.`, 'warn'); return null; }
    y = { qty: w.grams, unit: 'g', auto: true };
  }
  await recipes(hub).put({ ...r, yield: y });
  return y;
}

/** "One batch makes": an amount and a unit from the list (or another, typed), with the ingredients' weight as a guide. */
function yieldControl(db) {
  const y = ui.draft.yield;
  const hint = el('div', { class: 'field__hint', 'data-field': 'yield-hint' });
  ui.yieldHint = () => {
    const w = batchGrams(ui.draft.rows.filter((x) => x.name.trim()), db);
    hint.textContent = WEIGHT[y.unit] && w.grams
      ? `The ingredients weigh ${w.complete ? '' : 'at least '}${fmtQtyText(w.grams / WEIGHT[y.unit])} ${y.unit}. Leave the amount empty to use that when it is an ingredient.`
      : 'What one batch makes, e.g. 12 pieces (pancakes) or 300 g.';
  };
  const other = el('input', { class: 'input', value: y.other, placeholder: 'e.g. jars', maxlength: '30', 'aria-label': 'Other unit', style: { maxWidth: '160px' }, hidden: y.unit !== 'other', on: { input: (e) => { y.other = e.target.value; } } });
  const node = el('div', { class: 'stack', style: { gap: '0.25rem' } }, [
    el('div', { class: 'row' }, [
      el('input', { class: 'input', type: 'number', min: '0', step: 'any', value: y.qty ?? '', placeholder: 'amount', 'aria-label': 'Amount one batch makes', style: { maxWidth: '120px' }, 'data-field': 'yield-qty', on: { input: (e) => { y.qty = e.target.value === '' ? null : Math.max(0, Number(e.target.value)); } } }),
      el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Unit one batch makes', 'data-field': 'yield-unit', on: { change: (e) => { y.unit = e.target.value; other.hidden = y.unit !== 'other'; ui.yieldHint(); } } },
        [...UNIT_OPTIONS.map(([u, t]) => [u, u ? t : 'pieces']), ['other', 'other…']].map(([u, t]) => el('option', { value: u, text: t, selected: y.unit === u }))),
      other,
    ]),
    hint,
  ]);
  ui.yieldHint();
  return { node, get: () => ({ qty: y.qty, unit: y.unit === 'other' ? y.other.trim().toLowerCase() : y.unit }) };
}

const fmtQtyText = (n) => String(Math.round(n * 10) / 10);
/** The recipe is made x1, x1.5, x2... - enough for the portions wanted, with whole-only items whole. */
const batch = (rec, plan) => batchMultiplier(rec.ingredients, rec.servings, plan.total);
function batchLine(rec, plan) {
  const b = batch(rec, plan);
  const portions = (n) => `${fmtShare(n)} portion${n > 1 ? 's' : ''}`;
  return el('p', {}, [
    `Altogether about ${portions(plan.eating)}${plan.extra ? `, plus ${portions(plan.extra)} for leftovers` : ''}: `,
    el('strong', { text: `make the recipe x${b.m}` }),
    ` - ${b.makes} servings${rec.yield.qty ? `, ${fmtQtyText(rec.yield.qty * b.m)} ${rec.yield.unit}` : ''}${b.spare >= 0.25 ? `, about ${fmtShare(Math.floor(b.spare * 4) / 4)} spare` : ''}.`,
    b.blocked.length ? el('span', { class: 'small muted', text: ` A smaller batch would split the ${b.blocked.join(' and ')}.` }) : null,
  ]);
}

/** How the meal might be shared out among whoever is eating, with or without leftovers. */
function portionsPanel(hub, rec, serves, setServes, kcalPerServing) {
  const profiles = hub.foodProfiles();
  if (!profiles.length) return el('p', { class: 'small muted' }, ['Add your family on the ', el('a', { href: '#/people', text: 'People' }), ' page to see how much each person might eat.']);
  const who = ui.who[rec.id] ?? profiles.map((p) => p.id);
  const left = ui.leftovers[rec.id] ?? 'none';
  const shares = portionShares(profiles.filter((p) => who.includes(p.id)), hub.today());
  const plan = portionPlan(shares, left);
  const toggle = (id) => { ui.who[rec.id] = who.includes(id) ? who.filter((x) => x !== id) : [...who, id]; hub.render(); };
  const portions = (n) => `${fmtShare(n)} portion${n > 1 ? 's' : ''}`;
  return el('div', { class: 'panel stack', 'aria-label': 'Portions' }, [
    el('h2', { text: 'Portions for the family', style: { margin: 0 } }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Who is eating' }, profiles.map((p) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(who.includes(p.id)), text: p.name, 'data-field': `eat:${p.id}`, on: { click: () => toggle(p.id) },
    }))),
    el('div', { class: 'field', style: { maxWidth: '320px' } }, [
      el('label', { class: 'field__label', for: `left-${rec.id}`, text: 'Leftovers' }),
      el('select', { class: 'select', id: `left-${rec.id}`, 'data-field': 'leftovers', on: { change: (e) => { ui.leftovers[rec.id] = e.target.value; hub.render(); } } },
        Object.entries(LEFTOVERS).map(([k, label]) => el('option', { value: k, text: label, selected: k === left }))),
    ]),
    shares.length ? el('ul', { class: 'list' }, shares.map((s) => el('li', {}, [
      el('div', { class: 'list__main' }, [
        el('strong', { text: s.name }),
        el('div', { class: 'small', text: s.basis === 'baby' ? 'Under one - follow your clinic’s feeding guidance' : `about ${portions(s.share)}${kcalPerServing ? ` · about ${Math.round(s.share * kcalPerServing)} kcal` : ''}` }),
      ]),
    ]))) : el('p', { class: 'small muted', text: 'Choose who is eating.' }),
    shares.length ? batchLine(rec, plan) : null,
    shares.length && batch(rec, plan).makes !== serves ? el('button', {
      class: 'btn', type: 'button', text: `Use x${batch(rec, plan).m}`, title: 'Multiply the ingredients by this', style: { alignSelf: 'flex-start' }, 'data-field': 'use-portions',
      on: { click: () => setServes(batch(rec, plan).makes) },
    }) : null,
    el('p', { class: 'small muted', text: 'A rough guide from each person’s age and gender, and height and weight where recorded on the People page. One portion is one serving of this meal, sized for an adult. Appetites vary from day to day - let everyone eat to their hunger.' }),
  ]);
}
