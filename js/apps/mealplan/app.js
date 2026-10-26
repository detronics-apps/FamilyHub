// This Week (Meals section): the week's meals, planned as much or as little as
// helps. Meals and recipes come from Meals & Recipes (read-only); the week's
// ingredients are sent to Shopping. Weeks planned before This Week was its own
// mini-app are still read from where Meals & Recipes kept them, untouched.

import { el } from '../../ui/dom.js';
import { modal } from '../../ui/common.js';
import { fmtDay, addDays, dayDiff } from '../../dates.js';
import { loading, failure, saveRecord } from '../kit.js';
import {
  MEALS, MEAL_LABEL, WEEKDAYS, normaliseRecipe, weekStart, weekDays, normalisePlan, slotAt, setSlot, copyPlan, planId, ingredientsForPlan,
} from '../meals/logic.js';
import { sendHref } from '../shopping/logic.js';

const ui = { showAllMeals: false };

const plans = (hub) => hub.data.collection('plans', { summary: (p) => ({ title: `Week of ${p.week}`, week: p.week, count: p.slots.length }) });
const book = (hub) => (hub.data.installed('meals') ? hub.data.of('meals', 'recipes') : null);
const legacyPlans = (hub) => (hub.data.installed('meals') ? hub.data.of('meals', 'plans') : null);

/** This week's plan: our own, else one kept by Meals & Recipes from before, else empty. */
const loadPlan = (hub, monday) => hub.use(`plan:${monday}`, async () => {
  const own = await plans(hub).get(planId(monday));
  const old = own ? null : await legacyPlans(hub)?.get(planId(monday)).catch(() => null);
  return normalisePlan(own ?? old ?? { id: planId(monday) }, monday);
});

export function render(hub, route) {
  if (route.sub === 'add') return addScreen(hub, route.rest[0] ?? '');
  return weekScreen(hub, route.sub === 'week' ? route.rest[0] ?? null : null);
}

const mealHref = (id) => `#/meals/item/${encodeURIComponent(id)}`;

function weekScreen(hub, param) {
  const monday = weekStart(param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : hub.today());
  const p = loadPlan(hub, monday);
  const prev = loadPlan(hub, addDays(monday, -7));
  if (p.loading) return loading();
  if (p.error) return failure(p.error);
  const plan = p.data;
  const today = hub.today();
  const meals = ui.showAllMeals ? MEALS : ['dinner'];
  const savePlan = async (next) => { await saveRecord(hub, plans(hub), { ...next, id: planId(monday), week: monday }); };

  return el('section', { class: 'stack', 'aria-label': 'This week’s meals' }, [
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
            s ? (s.recipeId ? el('a', { href: mealHref(s.recipeId), text: s.title }) : el('span', { text: s.title })) : el('span', { class: 'muted', text: 'Nothing planned' }),
            s ? el('span', { class: 'small muted', text: ` · ${s.servings}` }) : null,
          ]),
          el('button', { class: 'btn btn-small', type: 'button', text: s ? 'Change' : 'Plan', 'data-field': `slot:${i}:${meal}`, on: { click: () => pickMeal(hub, plan, i, meal, savePlan) } }),
        ]);
      })),
    ])))]),
    el('div', { class: 'row' }, [
      !plan.slots.length && prev.data?.slots.length ? el('button', { class: 'btn', type: 'button', text: 'Copy last week’s plan', on: { click: () => savePlan(copyPlan(prev.data, monday)) } }) : null,
      plan.slots.length && hub.data.installed('shopping') ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Send the week to the shopping list', 'data-field': 'make-list',
        on: { click: () => sendWeek(hub, plan, monday) },
      }) : null,
    ]),
    el('p', { class: 'small muted', text: 'Plan as much or as little as helps - empty days are fine.' }),
  ]);
}

function pickMeal(hub, plan, day, meal, savePlan) {
  const current = slotAt(plan, day, meal);
  const results = el('ul', { class: 'list' });
  const servings = el('input', { class: 'input', type: 'number', min: '1', value: String(current?.servings ?? 4), style: { maxWidth: '90px' }, 'aria-label': 'Servings' });
  const free = el('input', { class: 'input', placeholder: 'Or just type it, e.g. "Leftovers"', 'aria-label': 'A meal not in Meals & Recipes' });
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search your meals and recipes', 'aria-label': 'Search your meals and recipes' });
  let close;
  const choose = async (slot) => { close(); await savePlan(setSlot(plan, day, meal, slot)); };
  const show = async () => {
    const b = book(hub);
    const r = b ? await b.search(search.value, { limit: 12 }) : { items: [] };
    results.replaceChildren(...(r.items.length ? r.items.map((x) => el('li', {}, [
      el('span', { class: 'list__main', text: x.title }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Choose', on: { click: () => choose({ recipeId: x.id, title: x.title, servings: Number(servings.value) || x.servings }) } }),
    ])) : [el('li', { class: 'small muted', text: search.value ? 'Nothing matches.' : 'No meals yet - type one below, or add them in Meals & Recipes.' })]));
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

/** Shopping owns the list: the week's ingredients go over in the link, to be confirmed there. */
async function sendWeek(hub, plan, monday) {
  const b = book(hub);
  const byId = new Map();
  for (const s of plan.slots) {
    if (b && s.recipeId && !byId.has(s.recipeId)) {
      const r = await b.get(s.recipeId);
      if (r) byId.set(s.recipeId, normaliseRecipe(r));
    }
  }
  hub.open(sendHref({ source: `week:${monday}`, from: `Week of ${new Date(`${monday}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, group: 'food', items: ingredientsForPlan(plan, byId) }));
}

/** Plan a meal on a day, arriving from Meals & Recipes: `add/<mealId>~<servings>`. */
function addScreen(hub, param) {
  const [id, serves] = param.split('~');
  const b = book(hub);
  const r = b && id ? hub.use(`meal:${id}`, () => b.get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('p', { class: 'panel', text: 'That meal was not found in Meals & Recipes.' });
  const rec = normaliseRecipe(r.data);
  const today = hub.today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const day = el('select', { class: 'select', id: 'plan-day', 'data-field': 'plan-day' }, days.map((d) => el('option', { value: d, text: fmtDay(d, today) })));
  const meal = el('select', { class: 'select', id: 'plan-meal', 'data-field': 'plan-meal' }, MEALS.map((m) => el('option', { value: m, text: MEAL_LABEL[m], selected: m === 'dinner' })));
  const count = el('input', { class: 'input', id: 'plan-serves', type: 'number', min: '1', value: String(Number(serves) || rec.servings), style: { maxWidth: '90px' } });
  const field = (label, control) => el('div', { class: 'field' }, [el('label', { class: 'field__label', for: control.id, text: label }), control]);
  return el('section', { class: 'stack' }, [
    el('h1', { text: `Plan ${rec.title}` }),
    el('div', { class: 'panel row' }, [field('Day', day), field('Meal', meal), field('Servings', count)]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Plan it', 'data-field': 'plan-save',
        on: {
          click: async () => {
            const monday = weekStart(day.value);
            const plan = normalisePlan((await plans(hub).get(planId(monday))) ?? (await legacyPlans(hub)?.get(planId(monday)).catch(() => null)) ?? {}, monday);
            const next = setSlot(plan, dayDiff(monday, day.value), meal.value, { recipeId: rec.id, title: rec.title, servings: Number(count.value) || rec.servings });
            if (await saveRecord(hub, plans(hub), { ...next, id: planId(monday), week: monday })) {
              hub.invalidate('plan:');
              hub.ui.notice(`${rec.title} is planned for ${fmtDay(day.value, today)}.`);
              hub.go('week', monday);
            }
          },
        },
      }),
      el('a', { class: 'btn', href: mealHref(rec.id), text: 'Cancel' }),
    ]),
  ]);
}
