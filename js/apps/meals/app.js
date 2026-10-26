// Recipe Book (Meals section): recipes (default), the week's plan, and the shopping list.
// Recipes live in a collection with an index, so a library of thousands is
// searched from one file and a recipe is read only when it is opened.

import { el } from '../../ui/dom.js';
import { modal, confirmAction } from '../../ui/common.js';
import { fmtDay, addDays } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord } from '../kit.js';
import {
  MEALS, MEAL_LABEL, WEEKDAYS, ALLERGENS, NUTRIENTS, normaliseRecipe, recipeSummary, recipeText, scaleIngredients, nutritionRows,
  formatIngredient, weekStart, weekDays, normalisePlan, slotAt, setSlot, copyPlan, planId, ingredientsForPlan,
  normaliseShopping, refreshFromPlan, addShoppingItem, toggleItem, clearBought,
} from './logic.js';

const ui = { query: '', avoid: [], showAllMeals: false, servings: {}, limit: 50 };
const LIST_ID = 'shopping_list';

const recipes = (hub) => hub.data.collection('recipes', { summary: recipeSummary, text: recipeText, prefix: 'rec' });
const plans = (hub) => hub.data.collection('plans', { summary: (p) => ({ title: `Week of ${p.week}`, week: p.week, count: p.slots.length }) });
const shopping = (hub) => hub.data.collection('shopping', { summary: (l) => ({ title: 'Shopping list', count: l.items.filter((i) => !i.checked).length }) });

export function render(hub, route) {
  const screen = route.sub ?? 'recipes';
  if (screen === 'item') return recipeScreen(hub, route.rest[0]);
  if (screen === 'new') return editScreen(hub, null);
  if (screen === 'edit') return editScreen(hub, route.rest[0]);
  if (screen === 'week') return weekScreen(hub, route.rest[0] ?? null);
  if (screen === 'shopping') return shoppingScreen(hub);
  return recipesScreen(hub);
}

const nav = (hub, current) => tabs(hub, [
  { screen: null, label: 'Recipes' }, { screen: 'week', label: 'This week' }, { screen: 'shopping', label: 'Shopping' },
], current);

const loadPlan = (hub, monday) => hub.use(`plan:${monday}`, async () => normalisePlan((await plans(hub).get(planId(monday))) ?? { id: planId(monday) }, monday));

/* --------------------------------------------------------------- week */

function weekScreen(hub, param) {
  const monday = weekStart(param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : hub.today());
  const p = loadPlan(hub, monday);
  const prev = loadPlan(hub, addDays(monday, -7));
  if (p.loading) return el('section', { class: 'stack' }, [nav(hub, 'week'), loading()]);
  if (p.error) return el('section', { class: 'stack' }, [nav(hub, 'week'), failure(p.error)]);
  const plan = p.data;
  const today = hub.today();
  const meals = ui.showAllMeals ? MEALS : ['dinner'];
  const savePlan = async (next) => { await saveRecord(hub, plans(hub), { ...next, id: planId(monday), week: monday }); };

  return el('section', { class: 'stack', 'aria-label': 'This week’s meals' }, [
    nav(hub, 'week'),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-small', href: hub.href('week', addDays(monday, -7)), 'aria-label': 'Previous week', text: '‹' }),
      el('strong', { text: `Week of ${fmtDay(monday, today)}`, style: { flex: '1 1 auto', textAlign: 'center' } }),
      el('a', { class: 'btn btn-small', href: hub.href('week', addDays(monday, 7)), 'aria-label': 'Next week', text: '›' }),
    ]),
    el('label', { class: 'checkline small' }, [
      el('input', { type: 'checkbox', checked: ui.showAllMeals, on: { change: (e) => { ui.showAllMeals = e.target.checked; hub.render(); } } }),
      'Show breakfast, lunch and snacks too',
    ]),
    el('div', { class: 'panel' }, [el('ul', { class: 'list' }, weekDays(monday).map((d, i) => el('li', { style: { alignItems: 'flex-start' } }, [
      el('div', { style: { minWidth: '72px' } }, [el('strong', { text: WEEKDAYS[i] }), el('div', { class: 'small muted', text: d === today ? 'today' : d.slice(5).replace('-', '/') })]),
      el('div', { class: 'list__main stack', style: { gap: '6px' } }, meals.map((meal) => {
        const s = slotAt(plan, i, meal);
        return el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
          el('span', {}, [
            ui.showAllMeals ? el('span', { class: 'small muted', text: `${MEAL_LABEL[meal]}: ` }) : null,
            s ? (s.recipeId ? el('a', { href: hub.href('item', s.recipeId), text: s.title }) : el('span', { text: s.title })) : el('span', { class: 'muted', text: 'Nothing planned' }),
            s ? el('span', { class: 'small muted', text: ` · ${s.servings}` }) : null,
          ]),
          el('button', { class: 'btn btn-small', type: 'button', text: s ? 'Change' : 'Plan', 'data-field': `slot:${i}:${meal}`, on: { click: () => pickMeal(hub, plan, i, meal, savePlan) } }),
        ]);
      })),
    ])))]),
    el('div', { class: 'row' }, [
      !plan.slots.length && prev.data?.slots.length ? el('button', { class: 'btn', type: 'button', text: 'Copy last week’s plan', on: { click: () => savePlan(copyPlan(prev.data, monday)) } }) : null,
      plan.slots.length ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Make the shopping list', 'data-field': 'make-list',
        on: { click: () => makeList(hub, plan, monday) },
      }) : null,
    ]),
    el('p', { class: 'small muted', text: 'Plan as much or as little as helps - empty days are fine.' }),
  ]);
}

function pickMeal(hub, plan, day, meal, savePlan) {
  const current = slotAt(plan, day, meal);
  const results = el('ul', { class: 'list' });
  const servings = el('input', { class: 'input', type: 'number', min: '1', value: String(current?.servings ?? 4), style: { maxWidth: '90px' }, 'aria-label': 'Servings' });
  const free = el('input', { class: 'input', placeholder: 'Or just type it, e.g. "Leftovers"', 'aria-label': 'A meal without a recipe' });
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search your recipes', 'aria-label': 'Search your recipes' });
  let close;
  const choose = async (slot) => { close(); await savePlan(setSlot(plan, day, meal, slot)); };
  const show = async () => {
    const r = await recipes(hub).search(search.value, { limit: 12 });
    results.replaceChildren(...(r.items.length ? r.items.map((x) => el('li', {}, [
      el('span', { class: 'list__main', text: x.title }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Choose', on: { click: () => choose({ recipeId: x.id, title: x.title, servings: Number(servings.value) || x.servings }) } }),
    ])) : [el('li', { class: 'small muted', text: search.value ? 'No recipe matches.' : 'No recipes yet - type a meal below, or add recipes in the Recipes tab.' })]));
  };
  search.addEventListener('input', show);
  ({ close } = modal({
    title: `${WEEKDAYS[day]} - ${MEAL_LABEL[meal]}`,
    body: [search, results, el('div', { class: 'row' }, [el('span', { class: 'small', text: 'Servings' }), servings]), free],
    foot: [
      current ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'Clear', style: { marginRight: 'auto' }, on: { click: () => choose(null) } }) : null,
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Use what I typed', on: { click: () => { if (free.value.trim()) choose({ recipeId: null, title: free.value.trim(), servings: Number(servings.value) || 4 }); else free.focus(); } } }),
    ].filter(Boolean),
  }));
  show();
  search.focus();
}

async function makeList(hub, plan, monday) {
  const byId = new Map();
  for (const s of plan.slots) {
    if (s.recipeId && !byId.has(s.recipeId)) {
      const r = await recipes(hub).get(s.recipeId);
      if (r) byId.set(s.recipeId, normaliseRecipe(r));
    }
  }
  const current = normaliseShopping((await shopping(hub).get(LIST_ID)) ?? { id: LIST_ID });
  const next = refreshFromPlan(current, monday, ingredientsForPlan(plan, byId));
  await saveRecord(hub, shopping(hub), { ...next, id: LIST_ID });
  hub.ui.notice('The shopping list is up to date with this week’s plan.');
  hub.go('shopping');
}

/* ------------------------------------------------------------ recipes */

function recipesScreen(hub) {
  const key = `search:${ui.query}:${ui.avoid.join(',')}:${ui.limit}`;
  const r = hub.use(key, () => recipes(hub).search(ui.query, {
    limit: ui.limit,
    filter: ui.avoid.length ? (s) => !s.allergens.some((a) => ui.avoid.includes(a)) : null,
  }));
  return el('section', { class: 'stack', 'aria-label': 'Recipes' }, [
    nav(hub, null),
    el('div', { class: 'row' }, [
      el('div', { style: { flex: '1 1 220px' } }, [el('input', {
        class: 'input', type: 'search', placeholder: 'Search by name, ingredient or tag', 'aria-label': 'Search recipes', value: ui.query, 'data-field': 'recipe-search',
        on: { change: (e) => { ui.query = e.target.value; ui.limit = 50; hub.render(); } },
      })]),
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add a recipe', 'data-field': 'add-recipe' }),
    ]),
    el('fieldset', {}, [
      el('legend', { class: 'small', text: 'Leave out recipes containing' }),
      el('div', { class: 'chipset' }, ALLERGENS.map((a) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(ui.avoid.includes(a)), text: a,
        on: { click: () => { ui.avoid = ui.avoid.includes(a) ? ui.avoid.filter((x) => x !== a) : [...ui.avoid, a]; hub.render(); } },
      }))),
      el('p', { class: 'small muted', text: 'Only as reliable as the allergens marked on each recipe - always check the actual ingredients.' }),
    ]),
    r.loading ? loading() : r.error ? failure(r.error) : r.data.total ? el('div', { class: 'stack' }, [
      el('p', { class: 'small muted', text: `${r.data.total} recipe${r.data.total === 1 ? '' : 's'}` }),
      el('ul', { class: 'list panel' }, r.data.items.map((s) => el('li', {}, [
        el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
          el('strong', { text: s.title }),
          el('div', { class: 'small muted', text: [s.minutes ? `${s.minutes} min` : null, `serves ${s.servings}`, s.tags.length ? s.tags.join(', ') : null, s.allergens.length ? `contains ${s.allergens.join(', ')}` : null].filter(Boolean).join(' · ') }),
        ]),
      ]))),
      r.data.total > r.data.items.length ? el('button', { class: 'btn', type: 'button', text: 'Show more', on: { click: () => { ui.limit += 50; hub.render(); } } }) : null,
    ]) : el('div', { class: 'panel empty' }, [el('p', { text: ui.query || ui.avoid.length ? 'No recipe matches.' : 'No recipes yet. Add the meals your family already likes - a name and the ingredients are enough.' })]),
  ]);
}

function recipeScreen(hub, id) {
  const r = hub.use(`recipe:${id}`, () => recipes(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This recipe no longer exists.' }), el('a', { class: 'btn', href: hub.href('recipes'), text: 'Recipes' })]);
  const rec = normaliseRecipe(r.data);
  const serves = ui.servings[id] ?? rec.servings;
  const setServes = (n) => { ui.servings[id] = Math.max(1, n); hub.render(); };
  const rows = nutritionRows(rec);

  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('recipes'), class: 'small', text: '‹ Recipes' }),
    el('article', { class: 'panel stack' }, [
      el('h1', { text: rec.title, style: { margin: 0 } }),
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
      rec.instructions.length ? el('div', {}, [el('h2', { text: 'Method' }), el('ol', { class: 'howto-steps' }, rec.instructions.map((s) => el('li', { text: s })))]) : null,
      el('details', { class: 'more' }, [
        el('summary', { text: 'Nutrition per serving' }),
        el('table', { class: 'plain' }, [el('tbody', {}, rows.map((x) => el('tr', {}, [el('td', { text: x.key }), el('td', { text: x.known ? `${x.value} ${x.unit}` : 'not known' })])))]),
        el('p', { class: 'small muted', text: 'Only figures entered for this recipe are shown. Family Hub does not estimate nutrition or give dietary advice.' }),
      ]),
      rec.notes ? el('p', { class: 'small', text: `Notes: ${rec.notes}` }) : null,
      rec.source ? el('p', { class: 'small muted', text: `Source: ${rec.source}` }) : null,
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Add to this week', on: { click: () => addToWeek(hub, rec, serves) } }),
      el('a', { class: 'btn', href: hub.href('edit', rec.id), text: 'Edit' }),
      el('button', {
        class: 'btn btn-quiet', type: 'button', text: 'Delete',
        on: { click: async () => { if (!await confirmAction({ title: `Delete ${rec.title}?`, text: 'Meals already planned keep their name.', confirmLabel: 'Delete', danger: true })) return; await recipes(hub).remove(rec.id); hub.invalidate(); hub.go('recipes'); } },
      }),
    ]),
  ]);
}

function addToWeek(hub, rec, serves) {
  const monday = weekStart(hub.today());
  const day = el('select', { class: 'select', 'aria-label': 'Day' }, weekDays(monday).map((d, i) => el('option', { value: String(i), text: `${WEEKDAYS[i]} ${d.slice(8)}`, selected: d === hub.today() })));
  const meal = el('select', { class: 'select', 'aria-label': 'Meal' }, MEALS.map((m) => el('option', { value: m, text: MEAL_LABEL[m], selected: m === 'dinner' })));
  const { close } = modal({
    title: `Plan ${rec.title}`,
    body: [el('div', { class: 'grid-2' }, [day, meal]), el('p', { class: 'small muted', text: `For ${serves}. This week; use the arrows on This week for later weeks.` })],
    foot: [
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Add',
        on: {
          click: async () => {
            close();
            const plan = normalisePlan((await plans(hub).get(planId(monday))) ?? {}, monday);
            await saveRecord(hub, plans(hub), { ...setSlot(plan, Number(day.value), meal.value, { recipeId: rec.id, title: rec.title, servings: serves }), id: planId(monday), week: monday });
            hub.ui.notice(`${rec.title} is planned.`);
          },
        },
      }),
    ],
  });
}

function editScreen(hub, id) {
  const r = id ? hub.use(`recipe:${id}`, () => recipes(hub).get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseRecipe(r.data) : null;
  const rec = existing ?? normaliseRecipe({ title: '' });
  const flat = {
    ...rec,
    title: existing ? rec.title : '',
    ingredients: rec.ingredients.map(formatIngredient),
    tags: rec.tags.join(', '),
    ...Object.fromEntries(NUTRIENTS.map(([k]) => [`n_${k}`, rec.nutrition[k] ?? null])),
  };
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add a recipe' }),
    recordForm({
      record: flat,
      fields: [
        { key: 'title', label: 'Name', required: true },
        { key: 'servings', label: 'Serves', type: 'number' },
        { key: 'ingredients', label: 'Ingredients', type: 'lines', rows: 6, hint: 'One per line, e.g. "200 g flour", "2 eggs", "1/2 cup milk".' },
        { key: 'instructions', label: 'Method', type: 'lines', rows: 6, hint: 'One step per line.' },
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
        const saved = await saveRecord(hub, recipes(hub), normaliseRecipe({ ...rec, ...values, nutrition }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('item', saved.id); }
      },
    }),
  ]);
}

/* ----------------------------------------------------------- shopping */

function shoppingScreen(hub) {
  const r = hub.use('list', async () => normaliseShopping((await shopping(hub).get(LIST_ID)) ?? { id: LIST_ID }));
  if (r.loading) return el('section', { class: 'stack' }, [nav(hub, 'shopping'), loading()]);
  if (r.error) return el('section', { class: 'stack' }, [nav(hub, 'shopping'), failure(r.error)]);
  const list = r.data;
  const save = (next) => saveRecord(hub, shopping(hub), { ...next, id: LIST_ID });
  const add = el('input', { class: 'input', placeholder: 'Add something, e.g. "2 l milk"', 'aria-label': 'Add to the list', 'data-field': 'shop-add' });
  add.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (add.value.trim()) save(addShoppingItem(list, add.value)); } });
  const toBuy = list.items.filter((i) => !i.checked);
  const bought = list.items.filter((i) => i.checked);
  const item = (i) => el('li', {}, [el('label', { class: 'checkline list__main' }, [
    el('input', { type: 'checkbox', checked: i.checked, 'data-field': `shop:${i.id}`, on: { change: () => save(toggleItem(list, i.id)) } }),
    el('span', { text: formatIngredient(i), style: i.checked ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : null }),
    i.note ? el('span', { class: 'small muted', text: ` (${i.note})` }) : null,
  ])]);

  return el('section', { class: 'stack', 'aria-label': 'Shopping list' }, [
    nav(hub, 'shopping'),
    el('div', { class: 'row' }, [el('div', { style: { flex: '1 1 220px' } }, [add]), el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: () => { if (add.value.trim()) save(addShoppingItem(list, add.value)); } } })]),
    el('div', { class: 'panel' }, [
      el('h2', { text: `To buy (${toBuy.length})` }),
      toBuy.length ? el('ul', { class: 'list' }, toBuy.map(item)) : el('p', { class: 'small muted', text: 'Nothing to buy. Plan the week’s meals and press "Make the shopping list", or add things here.' }),
    ]),
    bought.length ? el('div', { class: 'panel' }, [
      el('h2', { text: `Bought (${bought.length})` }),
      el('ul', { class: 'list' }, bought.map(item)),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Clear bought items', on: { click: () => save(clearBought(list)) } }),
    ]) : null,
    el('p', { class: 'small muted', text: 'Amounts in grams and kilos (or millilitres and litres) are added together. Different kinds of measure - cups and grams, say - are listed separately rather than guessed.' }),
  ]);
}
