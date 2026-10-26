// Meals & Recipes (Meals section): the family's meals and recipes. A meal without a
// method is a meal; adding the method makes it a recipe. A meal can be planned in
// This Week and sent to Shopping - each of those apps writes its own records.
// Each meal shows how it might be shared out among the family (js/portions.js).
// Recipes live in a collection with an index, so a library of thousands is
// searched from one file and a recipe is read only when it is opened.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { loading, failure, recordForm, saveRecord } from '../kit.js';
import {
  ALLERGENS, NUTRIENTS, normaliseRecipe, recipeSummary, recipeText, scaleIngredients, nutritionRows,
  formatIngredient, isRecipe, keepFoodLinks, linkedNutrition, mealFromPlate,
} from './logic.js';
import { portionShares, portionPlan, fmtShare, LEFTOVERS } from '../../portions.js';
import { sendHref } from '../shopping/logic.js';
import { amounts, fmtAmount } from '../../food.js';

const ui = { query: '', avoid: [], kind: 'all', servings: {}, limit: 50, who: {}, leftovers: {} };
const KINDS = { all: 'All', recipe: 'Recipes', meal: 'Meals without a method' };

const recipes = (hub) => hub.data.collection('recipes', { summary: recipeSummary, text: recipeText, prefix: 'rec' });

export function render(hub, route) {
  const screen = route.sub ?? 'recipes';
  if (screen === 'item') return recipeScreen(hub, route.rest[0]);
  if (screen === 'new') return editScreen(hub, null, route.rest[0] ?? null);
  if (screen === 'edit') return editScreen(hub, route.rest[0]);
  // The week and the shopping list moved to their own mini-apps (This Week, Shopping).
  if (screen === 'week' || screen === 'shopping') {
    return el('p', { class: 'panel' }, [`That has moved: `, el('a', { href: screen === 'week' ? '#/mealplan' : '#/shopping', text: screen === 'week' ? 'This Week' : 'Shopping' }), '.']);
  }
  return recipesScreen(hub);
}

/* ------------------------------------------------------------ recipes */

function recipesScreen(hub) {
  const key = `search:${ui.query}:${ui.avoid.join(',')}:${ui.kind}:${ui.limit}`;
  // Entries saved before meals and recipes were told apart have no `recipe` flag: shown under All only.
  const kindOk = (s) => ui.kind === 'all' || (ui.kind === 'recipe' ? s.recipe === true : s.recipe === false);
  const r = hub.use(key, () => recipes(hub).search(ui.query, {
    limit: ui.limit,
    filter: (s) => kindOk(s) && !s.allergens.some((a) => ui.avoid.includes(a)),
  }));
  return el('section', { class: 'stack', 'aria-label': 'Meals and recipes' }, [
    el('div', { class: 'row' }, [
      el('div', { style: { flex: '1 1 220px' } }, [el('input', {
        class: 'input', type: 'search', placeholder: 'Search by name, ingredient or tag', 'aria-label': 'Search meals and recipes', value: ui.query, 'data-field': 'recipe-search',
        on: { change: (e) => { ui.query = e.target.value; ui.limit = 50; hub.render(); } },
      })]),
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add a meal', 'data-field': 'add-recipe' }),
    ]),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Show' }, Object.entries(KINDS).map(([k, label]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(ui.kind === k), text: label, 'data-field': `kind:${k}`,
      on: { click: () => { ui.kind = k; ui.limit = 50; hub.render(); } },
    }))),
    el('fieldset', {}, [
      el('legend', { class: 'small', text: 'Leave out anything containing' }),
      el('div', { class: 'chipset' }, ALLERGENS.map((a) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(ui.avoid.includes(a)), text: a,
        on: { click: () => { ui.avoid = ui.avoid.includes(a) ? ui.avoid.filter((x) => x !== a) : [...ui.avoid, a]; hub.render(); } },
      }))),
      el('p', { class: 'small muted', text: 'Only as reliable as the allergens marked on each meal - always check the actual ingredients.' }),
    ]),
    r.loading ? loading() : r.error ? failure(r.error) : r.data.total ? el('div', { class: 'stack' }, [
      el('p', { class: 'small muted', text: `${r.data.total} found` }),
      el('ul', { class: 'list panel' }, r.data.items.map((s) => el('li', {}, [
        el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
          el('strong', { text: s.title }), s.recipe === undefined ? null : el('span', { class: `badge${s.recipe ? ' badge--ok' : ''}`, text: s.recipe ? 'Recipe' : 'Meal', style: { marginLeft: 'var(--space-2)' } }),
          el('div', { class: 'small muted', text: [s.minutes ? `${s.minutes} min` : null, `serves ${s.servings}`, s.tags.length ? s.tags.join(', ') : null, s.allergens.length ? `contains ${s.allergens.join(', ')}` : null].filter(Boolean).join(' · ') }),
        ]),
      ]))),
      r.data.total > r.data.items.length ? el('button', { class: 'btn', type: 'button', text: 'Show more', on: { click: () => { ui.limit += 50; hub.render(); } } }) : null,
    ]) : el('div', { class: 'panel empty' }, [el('p', { text: ui.query || ui.avoid.length ? 'Nothing matches.' : 'Nothing here yet. Add the meals your family already likes - a name and the ingredients are enough; add the method later to make it a recipe.' })]),
  ]);
}

function recipeScreen(hub, id) {
  const r = hub.use(`recipe:${id}`, () => recipes(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This meal no longer exists.' }), el('a', { class: 'btn', href: hub.href('recipes'), text: 'Meals & recipes' })]);
  const rec = normaliseRecipe(r.data);
  const serves = ui.servings[id] ?? rec.servings;
  const setServes = (n) => { ui.servings[id] = Math.max(1, n); hub.render(); };
  const rows = nutritionRows(rec);
  const linked = rec.ingredients.some((i) => i.fdcId) ? hub.use('food', () => hub.food.load()) : null;
  const fromFoods = linked?.data ? linkedNutrition(rec, linked.data.get, amounts) : null;
  const kcal = fromFoods?.linked && fromFoods.linked === fromFoods.of && !fromFoods.perServing.kcal?.missing ? fromFoods.perServing.kcal.value : null;

  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('recipes'), class: 'small', text: '‹ Meals & recipes' }),
    el('article', { class: 'panel stack' }, [
      el('div', { class: 'row' }, [el('h1', { text: rec.title, style: { margin: 0 } }), el('span', { class: `badge${isRecipe(rec) ? ' badge--ok' : ''}`, text: isRecipe(rec) ? 'Recipe' : 'Meal' })]),
      rec.description ? el('p', { text: rec.description }) : null,
      el('p', { class: 'small muted', text: [rec.prepMinutes != null ? `prep ${rec.prepMinutes} min` : null, rec.cookMinutes != null ? `cook ${rec.cookMinutes} min` : null, rec.tags.join(', ') || null, rec.allergens.length ? `contains ${rec.allergens.join(', ')}` : null].filter(Boolean).join(' · ') }),
      el('div', { class: 'row' }, [
        el('span', { text: 'Servings' }),
        el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '−', 'aria-label': 'Fewer servings', on: { click: () => setServes(serves - 1) } }),
        el('strong', { text: String(serves), 'data-field': 'servings' }),
        el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '+', 'aria-label': 'More servings', on: { click: () => setServes(serves + 1) } }),
      ]),
      el('h2', { text: 'Ingredients' }),
      rec.ingredients.length ? el('ul', {}, scaleIngredients(rec, serves).map((i) => el('li', { text: formatIngredient(i) + (i.note ? ` (${i.note})` : '') }))) : el('p', { class: 'small muted', text: 'No ingredients listed.' }),
      rec.instructions.length ? el('div', {}, [el('h2', { text: 'Method' }), el('ol', { class: 'howto-steps' }, rec.instructions.map((s) => el('li', { text: s })))])
        : el('p', { class: 'small' }, ['A meal without a method. ', el('a', { href: hub.href('edit', rec.id), text: 'Add the method', 'data-field': 'add-method' }), ' to make it a recipe.']),
      el('details', { class: 'more' }, [
        el('summary', { text: 'Nutrition per serving' }),
        fromFoods?.linked ? linkedTable(linked.data, fromFoods) : null,
        el('table', { class: 'plain' }, [el('tbody', {}, rows.map((x) => el('tr', {}, [el('td', { text: x.key }), el('td', { text: x.known ? `${x.value} ${x.unit}` : 'not known' })])))]),
        el('p', { class: 'small muted', text: 'Figures typed in by hand are shown as given; figures from the food database come from ingredients added in Calorie Checker. Nothing else is estimated.' }),
      ]),
      rec.notes ? el('p', { class: 'small', text: `Notes: ${rec.notes}` }) : null,
      rec.source ? el('p', { class: 'small muted', text: `Source: ${rec.source}` }) : null,
    ]),
    portionsPanel(hub, rec, serves, setServes, kcal),
    el('div', { class: 'row' }, [
      hub.data.installed('mealplan') ? el('a', { class: 'btn btn-primary', href: `#/mealplan/add/${encodeURIComponent(`${rec.id}~${serves}`)}`, text: 'Plan it', 'data-field': 'plan-meal' }) : null,
      hub.data.installed('shopping') && rec.ingredients.length ? el('a', { class: 'btn', href: sendHref({ source: `meal:${rec.id}`, from: rec.title, group: 'food', items: scaleIngredients(rec, serves) }), text: 'Send to the shopping list', 'data-field': 'send-shopping' }) : null,
      el('a', { class: 'btn', href: hub.href('edit', rec.id), text: 'Edit' }),
      hub.data.installed('assistant') ? el('a', { class: 'btn', href: `#/assistant/meal/recipe:${encodeURIComponent(rec.id)}`, text: 'Ideas to improve it', 'data-field': 'improve-recipe' }) : null,
      el('button', {
        class: 'btn btn-quiet', type: 'button', text: 'Delete',
        on: { click: async () => { if (!await confirmAction({ title: `Delete ${rec.title}?`, text: 'Meals already planned keep their name.', confirmLabel: 'Delete', danger: true })) return; await recipes(hub).remove(rec.id); hub.invalidate(); hub.go('recipes'); } },
      }),
    ]),
  ]);
}

function editScreen(hub, id, param = null) {
  const r = id ? hub.use(`recipe:${id}`, () => recipes(hub).get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseRecipe(r.data) : null;
  // Built in Calorie Checker and handed over in the link (`plate:<json>`).
  const fromPlate = !existing && param?.startsWith('plate:') ? mealFromPlate(param.slice(6)) : null;
  const rec = existing ?? fromPlate ?? normaliseRecipe({ title: '' });
  const flat = {
    ...rec,
    title: existing || (fromPlate && rec.title !== 'Untitled meal') ? rec.title : '',
    ingredients: rec.ingredients.map(formatIngredient),
    tags: rec.tags.join(', '),
    ...Object.fromEntries(NUTRIENTS.map(([k]) => [`n_${k}`, rec.nutrition[k] ?? null])),
  };
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add a meal' }),
    fromPlate ? el('p', { class: 'small muted', text: 'From Calorie Checker. Give it a name and save it as a meal - add the method now or later to make it a recipe.' }) : null,
    recordForm({
      record: flat,
      fields: [
        { key: 'title', label: 'Name', required: true },
        { key: 'servings', label: 'Serves', type: 'number' },
        { key: 'ingredients', label: 'Ingredients', type: 'lines', rows: 6, hint: 'One per line, e.g. "200 g flour", "2 eggs", "1/2 cup milk".' },
        { key: 'instructions', label: 'Method', type: 'lines', rows: 6, hint: 'One step per line. Leave it empty for a meal; adding steps makes it a recipe.' },
        { key: 'description', label: 'Description', type: 'textarea', more: true },
        { key: 'prepMinutes', label: 'Preparation (minutes)', type: 'number', more: true },
        { key: 'cookMinutes', label: 'Cooking (minutes)', type: 'number', more: true },
        { key: 'tags', label: 'Tags', more: true, hint: 'Separated by commas, e.g. quick, vegetarian, kids like it.' },
        { key: 'allergens', label: 'Contains', type: 'choices', options: ALLERGENS.map((a) => [a, a]), more: true },
        ...NUTRIENTS.map(([k, unit]) => ({ key: `n_${k}`, label: `${k[0].toUpperCase() + k.slice(1)} per serving (${unit})`, type: 'number', more: true, placeholder: 'only if known' })),
        { key: 'notes', label: 'Family notes', type: 'textarea', more: true },
        { key: 'source', label: 'Where it came from', more: true },
      ],
      onCancel: () => (existing ? hub.go('item', existing.id) : hub.go('recipes')),
      onSave: async (values) => {
        const nutrition = Object.fromEntries(NUTRIENTS.map(([k]) => [k, values[`n_${k}`]]));
        for (const [k] of NUTRIENTS) delete values[`n_${k}`];
        const next = normaliseRecipe({ ...rec, ...values, nutrition });
        const saved = await saveRecord(hub, recipes(hub), { ...next, ingredients: keepFoodLinks(next.ingredients, rec.ingredients) });
        if (saved) { hub.ui.notice(isRecipe(saved) ? 'Saved as a recipe.' : 'Saved as a meal.'); hub.go('item', saved.id); }
      },
    }),
  ]);
}

/** Amounts per serving worked out from ingredients linked to the food database. */
function linkedTable(db, n) {
  const row = (k) => {
    const t = n.perServing[k];
    if (!t || t.missing === n.linked) return 'not known';
    return `${t.missing ? 'at least ' : ''}${fmtAmount(t.value)} ${db.meta[k].unit}`;
  };
  return el('div', {}, [
    el('table', { class: 'facts' }, [el('tbody', {}, ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugars', 'sodium'].map((k) => el('tr', {}, [el('th', { scope: 'row', text: db.meta[k].label }), el('td', { text: row(k) })])))]),
    el('p', { class: 'small muted', text: n.linked === n.of ? 'Worked out from the food database for every ingredient.' : `Worked out for ${n.linked} of ${n.of} ingredients only (those added in Calorie Checker) - the whole meal holds more.` }),
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
    shares.length ? el('p', {}, [
      `Altogether about ${portions(plan.eating)}${plan.extra ? `, plus ${portions(plan.extra)} for leftovers` : ''}: `,
      el('strong', { text: `make ${plan.cook} serving${plan.cook === 1 ? '' : 's'}` }), '.',
    ]) : null,
    shares.length && plan.cook !== serves ? el('button', {
      class: 'btn', type: 'button', text: `Use ${plan.cook} servings for the ingredients`, style: { alignSelf: 'flex-start' }, 'data-field': 'use-portions',
      on: { click: () => setServes(plan.cook) },
    }) : null,
    el('p', { class: 'small muted', text: 'A rough guide from each person’s age and gender, and height and weight where recorded on the People page. One portion is one serving of this meal, sized for an adult. Appetites vary from day to day - let everyone eat to their hunger.' }),
  ]);
}
