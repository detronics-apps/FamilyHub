// This Week (Meals section): the week's planned meals. Each slot is a planned
// meal - one occasion, apart from the saved recipe it came from - with its own
// servings, leftovers, ingredient changes, note and feedback (see normaliseSlot
// in ../meals/logic.js). Meals and recipes come from Meals & Recipes
// (read-only); ratings, preferences and new versions are recorded there through
// links, and the week's ingredients go to Shopping the same way. Weeks planned
// before This Week was its own mini-app are read from where they were kept.
//
// Screens: week (default) · choose a meal for a slot · a planned meal · plan my
// week · how the week looks (with Optimise My Week) · add (from a recipe) ·
// modify (from Meal Assistant).

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay, addDays } from '../../dates.js';
import { loading, failure, saveRecord } from '../kit.js';
import {
  MEALS, MEAL_LABEL, WEEKDAYS, normaliseRecipe, recipeSummary, formatIngredient, parseIngredient,
  weekStart, weekDays, normalisePlan, slotAt, setSlot, updateSlot, copyPlan, planId, planShopping, slotNeeds,
  prepared, reserved, leftoverMeals, setReservation, addReservation, SUMMARY_VERSION, slotBatch, collectRecipes,
} from '../meals/logic.js';
import { ingredientEditor } from '../../ui/ingredient-editor.js';
import { recipeFacts, passes, emptyFilters, describeFilters, PROTEIN, CARB, GROUP, TRIAL, MEAL_TAGS } from '../meals/facts.js';
import { MIX, proposeWeek, analyseWeek, optimiseWeek, additionFor } from './logic.js';
import { GUIDE } from '../assistant/guide.js';
import { sendHref } from '../shopping/logic.js';
import { mealNutrition, nutrientProfile } from '../../meal-nutrition.js';
import { nutritionPanel, comparePanel, radar } from '../../ui/nutrition-view.js';
import { portionShares, fmtShare, GUESTS, guestShares, servingsFor } from '../../portions.js';
import { inSystem } from '../../units.js';

const ui = { showAllMeals: false, q: '', filters: emptyFilters(), compare: [], mix: { family: 4, individual: 0, untried: 2, other: 1, meal: 'dinner' }, proposal: null, optimise: null, rejected: [] };

const plans = (hub) => hub.data.collection('plans', { summary: (p) => ({ title: `Week of ${p.week}`, week: p.week, count: p.slots.length }) });
const book = (hub) => (hub.data.installed('meals') ? hub.data.of('meals', 'recipes') : null);
const legacyPlans = (hub) => (hub.data.installed('meals') ? hub.data.of('meals', 'plans') : null);

/** A week's plan: our own, else one kept by Meals & Recipes from before, else empty. */
const loadPlan = (hub, monday) => hub.use(`plan:${monday}`, async () => {
  const own = await plans(hub).get(planId(monday));
  const old = own ? null : await legacyPlans(hub)?.get(planId(monday)).catch(() => null);
  return normalisePlan(own ?? old ?? { id: planId(monday) }, monday);
});
const savePlan = async (hub, monday, plan) => {
  const saved = await saveRecord(hub, plans(hub), { ...plan, id: planId(monday), week: monday });
  hub.invalidate('plan:');
  return saved;
};
const loadRecipe = (hub, id) => hub.use(`recipe:${id}`, async () => { const r = await book(hub)?.get(id); return r ? normaliseRecipe(r) : null; });
const loadFood = (hub) => hub.use('food', () => hub.food.load());

/** Every meal's summary for browsing; an older index entry without the facts is read from its meal. */
const loadSummaries = (hub) => hub.use('summaries', async () => {
  const b = book(hub);
  if (!b) return [];
  const { items } = await b.list({ limit: 100000 });
  return Promise.all(items.map(async (s) => (s.ix === SUMMARY_VERSION ? s : { id: s.id, ...recipeSummary(normaliseRecipe((await b.get(s.id)) ?? { title: s.title })) })));
});

const mealHref = (id, back) => `#/meals/item/${encodeURIComponent(id)}${back ? `/${encodeURIComponent(back)}` : ''}`;
const dateOf = (monday, day) => addDays(monday, day);
const label = (date, meal, today) => `${fmtDay(date, today)} ${MEAL_LABEL[meal].toLowerCase()}`;
const ref = (monday, x) => `${monday}~${x}`;

export function render(hub, route) {
  const [a, b, c] = (route.rest[0] ?? '').split('~');
  switch (route.sub) {
    case 'choose': return chooseScreen(hub, a, Number(b), c);
    case 'slot': return slotScreen(hub, a, b);
    case 'mix': return mixScreen(hub, a);
    case 'review': return reviewScreen(hub, a);
    case 'add': return addScreen(hub, a, b);
    case 'modify': return modifyScreen(hub, a, b, c);
    default: return weekScreen(hub, route.sub === 'week' ? route.rest[0] ?? null : null);
  }
}

const weekOf = (param, hub) => weekStart(param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : hub.today());

/* ---------------------------------------------------------------- the week */

function weekScreen(hub, param) {
  const monday = weekOf(param, hub);
  const p = loadPlan(hub, monday);
  const prev = loadPlan(hub, addDays(monday, -7));
  if (p.loading || prev.loading) return loading();
  if (p.error) return failure(p.error);
  const plan = p.data;
  const today = hub.today();
  const later = leftoverMeals([prev.data, plan], monday);
  const meals = ui.showAllMeals ? MEALS : ['dinner'];
  const shownMeals = [...new Set([...meals, ...plan.slots.map((s) => s.meal), ...later.map((l) => l.meal)])].sort((x, y) => MEALS.indexOf(x) - MEALS.indexOf(y));

  return el('section', { class: 'stack', 'aria-label': 'This week’s meals' }, [
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-small', href: hub.href('week', addDays(monday, -7)), 'aria-label': 'Previous week', text: '‹' }),
      el('strong', { text: `Week of ${new Date(`${monday}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`, style: { flex: '1 1 auto', textAlign: 'center' } }),
      el('a', { class: 'btn btn-small', href: hub.href('week', addDays(monday, 7)), 'aria-label': 'Next week', text: '›' }),
    ]),
    el('label', { class: 'checkline small' }, [
      el('input', { type: 'checkbox', checked: ui.showAllMeals, on: { change: (e) => { ui.showAllMeals = e.target.checked; hub.render(); } } }),
      'Show breakfast, lunch and snacks too',
    ]),
    el('div', { class: 'panel' }, [el('ul', { class: 'list' }, weekDays(monday).map((d, i) => el('li', { style: { alignItems: 'flex-start' } }, [
      el('div', { style: { minWidth: '72px' } }, [el('strong', { text: WEEKDAYS[i] }), el('div', { class: 'small muted', text: d === today ? 'today' : d.slice(5).replace('-', '/') })]),
      // The chosen meals every day; another meal only on a day that has something planned for it.
      el('div', { class: 'list__main stack', style: { gap: '6px' } }, shownMeals.filter((meal) => meals.includes(meal) || slotAt(plan, i, meal) || later.some((l) => l.day === i && l.meal === meal)).map((meal) => {
        const s = slotAt(plan, i, meal);
        const lo = later.filter((l) => l.day === i && l.meal === meal);
        return el('div', { class: 'stack', style: { gap: '2px' } }, [
          el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
            el('span', {}, [
              ui.showAllMeals || meal !== 'dinner' ? el('span', { class: 'small muted', text: `${MEAL_LABEL[meal]}: ` }) : null,
              s ? el('a', { href: hub.href('slot', ref(monday, s.id)), text: s.title, 'data-field': `open:${i}:${meal}` }) : lo.length ? null : el('span', { class: 'muted', text: 'Nothing planned' }),
              s ? el('span', { class: 'small muted', text: ` · ${s.servings} eating${s.guests.length ? ` (with ${s.guests.length} guest${s.guests.length === 1 ? '' : 's'})` : ''}${prepared(s) > s.servings ? ` · cook ${prepared(s)}` : ''}${s.ingredients ? ' · changed this time' : ''}` }) : null,
            ]),
            el('a', { class: 'btn btn-small', href: hub.href('choose', `${monday}~${i}~${meal}`), text: s ? 'Change' : 'Plan', 'data-field': `slot:${i}:${meal}` }),
          ]),
          ...lo.map((l) => el('div', { class: 'small', 'data-field': `leftover:${i}:${meal}` }, [
            el('span', { class: 'badge', text: 'Leftovers' }), ' ',
            el('a', { href: hub.href('slot', ref(l.from.week, l.from.slotId)), text: l.title }),
            ` from ${label(l.from.date, l.from.meal, today)} · ${l.portions} portion${l.portions === 1 ? '' : 's'}, already cooked${l.additions.length ? ` · plus ${l.additions.map((x) => x.name).join(', ')}` : ''}`,
          ])),
        ]);
      })),
    ])))]),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn', href: hub.href('mix', monday), text: 'Plan my week', 'data-field': 'plan-my-week' }),
      plan.slots.length ? el('a', { class: 'btn', href: hub.href('review', monday), text: 'How the week looks', 'data-field': 'review-week' }) : null,
      !plan.slots.length && prev.data?.slots.length ? el('button', { class: 'btn', type: 'button', text: 'Copy last week’s plan', on: { click: () => savePlan(hub, monday, copyPlan(prev.data, monday)) } }) : null,
      plan.slots.length && hub.data.installed('shopping') ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Send the week to the shopping list', 'data-field': 'make-list',
        on: { click: () => sendWeek(hub, plan, monday) },
      }) : null,
    ]),
    el('p', { class: 'small muted', text: 'Plan as much or as little as helps - empty days are fine. Leftovers are cooked with the meal they come from, so they are only bought once.' }),
  ]);
}

/** Shopping owns the list: what the week needs (leftovers counted once, with each meal's own changes) goes over in the link. */
async function sendWeek(hub, plan, monday) {
  const b = book(hub);
  const byId = new Map();
  for (const s of plan.slots) {
    if (b && s.recipeId && !byId.has(s.recipeId)) {
      const r = await b.get(s.recipeId);
      if (r) byId.set(s.recipeId, normaliseRecipe(r));
    }
  }
  // Our own items inside them (home-made mayo) are bought as their own ingredients.
  if (b) for (const s of plan.slots) await collectRecipes(s.ingredients ?? byId.get(s.recipeId)?.ingredients ?? [], (id) => b.get(id), byId);
  hub.open(sendHref({ source: `week:${monday}`, from: `Week of ${new Date(`${monday}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, group: 'food', ...planShopping(plan, byId) }));
}

/* ------------------------------------------------------------- servings and leftovers */

/**
 * The servings-and-leftovers part of planning a meal, used when adding one and on
 * a planned meal. `state` = { servings, mode: 'none'|'extra'|'reserve', portions, target: 'date|meal' }.
 */
function leftoverControls(state, date, onChange, today) {
  const targets = [];
  for (let d = 0; d <= 6; d += 1) for (const m of MEALS) if (d > 0 || MEALS.indexOf(m) > MEALS.indexOf(state.meal ?? 'dinner')) targets.push([`${addDays(date, d)}|${m}`, label(addDays(date, d), m, today)]);
  return el('div', { class: 'stack' }, [
    el('div', { class: 'row' }, [
      el('label', { class: 'small', for: 'lo-serv', text: 'Eating at this meal' }),
      el('input', { class: 'input', id: 'lo-serv', type: 'number', min: '1', max: '40', value: String(state.servings), style: { width: '5em' }, 'data-field': 'servings', on: { change: (e) => onChange({ servings: Math.max(1, Number(e.target.value) || 1) }) } }),
      el('label', { class: 'small', for: 'lo-mode', text: 'Leftovers' }),
      el('select', { class: 'select', id: 'lo-mode', style: { width: 'auto' }, 'data-field': 'lo-mode', on: { change: (e) => onChange({ mode: e.target.value }) } }, [
        ['none', 'No leftovers planned'], ['extra', 'Cook extra - decide later'], ['reserve', 'Set aside for a later meal'],
      ].map(([v, t]) => el('option', { value: v, text: t, selected: state.mode === v }))),
    ]),
    state.mode !== 'none' ? el('div', { class: 'row' }, [
      el('label', { class: 'small', for: 'lo-por', text: state.mode === 'reserve' ? 'Portions set aside' : 'Extra portions (or people)' }),
      el('input', { class: 'input', id: 'lo-por', type: 'number', min: '1', max: '40', value: String(state.portions), style: { width: '5em' }, 'data-field': 'lo-portions', on: { change: (e) => onChange({ portions: Math.max(1, Number(e.target.value) || 1) }) } }),
      state.mode === 'reserve' ? el('label', { class: 'small', for: 'lo-target', text: 'for' }) : null,
      state.mode === 'reserve' ? el('select', { class: 'select', id: 'lo-target', style: { width: 'auto' }, 'data-field': 'lo-target', on: { change: (e) => onChange({ target: e.target.value }) } },
        targets.map(([v, t]) => el('option', { value: v, text: t, selected: state.target === v }))) : null,
    ]) : null,
    el('p', { class: 'small muted', text: `Cook ${state.servings + (state.mode === 'none' ? 0 : state.portions)} portion${state.servings + (state.mode === 'none' ? 0 : state.portions) === 1 ? '' : 's'} - the ingredients and shopping list follow. Cooked leftovers keep about 3 days in the fridge; cool them within 2 hours and reheat until steaming hot.` }),
  ]);
}

const defaultTarget = (date) => `${addDays(date, 1)}|lunch`;

/** Turn the controls' state into a slot's fields (extra and/or one reservation). */
function slotFromState(state) {
  const [date, meal] = (state.target ?? '').split('|');
  return {
    servings: state.servings,
    extra: state.mode === 'extra' ? state.portions : 0,
    reserve: state.mode === 'reserve' && date ? [{ id: `r${Date.now().toString(36)}`, date, meal, portions: state.portions, note: '', additions: [] }] : [],
  };
}

/* ---------------------------------------------------------------- choosing a meal */

function chooseScreen(hub, monday, day, meal) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monday ?? '') || !(day >= 0 && day <= 6) || !MEALS.includes(meal)) return el('p', { class: 'panel', text: 'That planner link is incomplete.' });
  const p = loadPlan(hub, monday);
  const list = loadSummaries(hub);
  const f = loadFood(hub);
  if (p.loading || list.loading) return loading('Opening your meals…');
  if (p.error || list.error) return failure(p.error ?? list.error);
  const today = hub.today();
  const date = dateOf(monday, day);
  const current = slotAt(p.data, day, meal);
  const people = hub.foodProfiles();
  const back = hub.href('week', monday);
  const set = (patch) => { ui.filters = { ...ui.filters, ...patch }; hub.render(); };
  const q = ui.q.trim().toLowerCase();
  const results = list.data.filter((s) => (!q || `${s.title} ${(s.ingredientNames ?? []).join(' ')}`.toLowerCase().includes(q)) && passes(s, ui.filters, { people }));
  const active = describeFilters(ui.filters, people);
  const pickState = ui.pick?.for === `${monday}~${day}~${meal}` ? ui.pick : null;

  if (pickState) return configureScreen(hub, { monday, day, meal, date, summary: pickState.summary, current, back });

  return el('section', { class: 'stack', 'aria-label': 'Choose a meal' }, [
    el('a', { href: back, class: 'small', text: '‹ Back to the week' }),
    el('h1', { text: `${label(date, meal, today)}${current ? ` - instead of ${current.title}` : ''}` }),
    el('div', { class: 'row' }, [
      el('input', { class: 'input', type: 'search', value: ui.q, placeholder: 'Search by name or ingredient', 'aria-label': 'Search meals', 'data-field': 'choose-search', style: { flex: '1 1 220px' }, on: { change: (e) => { ui.q = e.target.value; hub.render(); } } }),
      current ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove from the plan', 'data-field': 'remove-slot', on: { click: async () => { if (await confirmAction({ title: `Remove ${current.title} from ${label(date, meal, today)}?`, text: 'The saved meal stays in Meals & Recipes. Leftovers set aside from it are cancelled.', confirmLabel: 'Remove' })) { await savePlan(hub, monday, setSlot(p.data, day, meal, null)); hub.open(back); } } } }) : null,
    ]),
    filterPanel(ui.filters, set, people),
    active.length ? el('div', { class: 'chipset', 'aria-label': 'Active filters' }, [
      ...active.map(([text, undo]) => el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: `${text} ×`, 'aria-label': `Remove filter: ${text}`, on: { click: () => set(undo) } })),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Clear all', 'data-field': 'clear-filters', on: { click: () => { ui.filters = emptyFilters(); ui.q = ''; hub.render(); } } }),
    ]) : null,
    el('p', { class: 'small muted', text: `${results.length} of ${list.data.length} meal${list.data.length === 1 ? '' : 's'}` }),
    results.length ? el('ul', { class: 'list panel' }, results.slice(0, 60).map((s) => resultRow(hub, s, people, () => { ui.pick = { for: `${monday}~${day}~${meal}`, summary: s }; hub.render(); }, back))) : el('div', { class: 'panel' }, [
      el('p', { text: list.data.length ? 'No meal matches every filter you chose.' : 'No meals saved yet - add some in Meals & Recipes, or type a meal below.' }),
      active.length ? el('p', { class: 'small', text: `Try removing one: ${active.map(([t]) => t).join(', ')}.` }) : null,
    ]),
    ui.compare.length >= 2 && f.data ? compareLoaded(hub, f.data) : null,
    el('form', {
      class: 'row panel', on: {
        submit: async (e) => {
          e.preventDefault();
          const title = e.target.elements.free.value.trim();
          if (!title) return;
          await savePlan(hub, monday, setSlot(p.data, day, meal, { recipeId: null, title, servings: current?.servings ?? 4 }));
          hub.open(back);
        },
      },
    }, [
      el('input', { class: 'input', name: 'free', placeholder: 'Or just type a meal, e.g. "Takeaway" or "Leftover soup"', 'aria-label': 'A meal not in Meals & Recipes', style: { flex: '1 1 220px' } }),
      el('button', { class: 'btn', type: 'submit', text: 'Use what I typed' }),
    ]),
  ]);
}

function filterPanel(f, set, people) {
  const chips = (values, chosen, key) => el('div', { class: 'chipset' }, Object.entries(values).map(([k, t]) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(chosen.includes(k)), text: t, 'data-field': `f-${key}:${k}`,
    on: { click: () => set({ [key]: chosen.includes(k) ? chosen.filter((x) => x !== k) : [...chosen, k] }) },
  })));
  const select = (id, text, value, options, onPick) => el('label', { class: 'small row', style: { gap: '4px' } }, [text, el('select', { class: 'select', id, style: { width: 'auto' }, 'data-field': id, on: { change: (e) => onPick(e.target.value || null) } },
    options.map(([v, t]) => el('option', { value: v ?? '', text: t, selected: String(value ?? '') === String(v ?? '') })))]);
  const person = [[null, 'anyone'], ...people.map((p) => [p.id, p.name])];
  return el('details', { class: 'measures', open: true }, [
    el('summary', {}, [el('strong', { text: 'Filters' })]),
    el('div', { class: 'stack', style: { marginTop: 'var(--space-2)' } }, [
      el('div', {}, [el('div', { class: 'small muted', text: 'Protein' }), chips(PROTEIN, f.protein, 'protein')]),
      el('div', {}, [el('div', { class: 'small muted', text: 'Carbohydrate' }), chips(CARB, f.carb, 'carb')]),
      el('div', {}, [el('div', { class: 'small muted', text: 'Includes' }), chips(GROUP, f.includes, 'includes')]),
      el('div', { class: 'row' }, [
        select('f-rating', 'Family rating', f.minRating, [[null, 'any'], [5, '5 or more'], [7, '7 or more'], [9, '9 or more']], (v) => set({ minRating: v === null ? null : Number(v) })),
        select('f-trial', 'Tried', f.trial, [[null, 'any'], ...Object.entries(TRIAL)], (v) => set({ trial: v })),
        select('f-fav', 'Favourite of', f.favouriteOf, person, (v) => set({ favouriteOf: v })),
        select('f-liked', 'Liked by', f.likedBy, person, (v) => set({ likedBy: v })),
      ]),
      el('div', { class: 'row' }, [
        select('f-time', 'Time', f.maxMinutes, [[null, 'any'], [20, 'under 20 min'], [30, 'under 30 min'], [45, 'under 45 min'], [60, 'under 1 hour']], (v) => set({ maxMinutes: v === null ? null : Number(v) })),
        select('f-type', 'Meal', f.mealType, [[null, 'any'], ...Object.entries(MEAL_TAGS)], (v) => set({ mealType: v })),
        people.length ? select('f-suits', 'Suits', f.suitableFor.length === people.length ? 'all' : '', [[null, 'not checked'], ['all', 'everyone’s allergies and diets']], (v) => set({ suitableFor: v === 'all' ? people.map((p) => p.id) : [] })) : null,
        people.length ? select('f-dis', 'Hide meals disliked by', f.avoidDislikedBy[0] ?? null, person.map(([v, t]) => [v, v ? t : 'no one']), (v) => set({ avoidDislikedBy: v ? [v] : [] })) : null,
      ]),
      el('div', { class: 'row' }, [
        el('label', { class: 'small row', style: { gap: '4px' } }, ['Uses', el('input', { class: 'input', value: f.have, placeholder: 'what you have, e.g. mince, carrots', 'data-field': 'f-have', style: { width: '14em' }, on: { change: (e) => set({ have: e.target.value }) } })]),
        el('label', { class: 'small row', style: { gap: '4px' } }, ['Without', el('input', { class: 'input', value: f.exclude, placeholder: 'e.g. mushrooms', 'data-field': 'f-exclude', style: { width: '12em' }, on: { change: (e) => set({ exclude: e.target.value }) } })]),
      ]),
      el('p', { class: 'small muted', text: 'A filter that needs something a meal does not record (a time, say) leaves that meal out rather than guessing.' }),
    ]),
  ]);
}

function resultRow(hub, s, people, onPick, back) {
  const favs = Object.entries(s.prefs ?? {}).filter(([, v]) => v === 'favourite').map(([id]) => people.find((p) => p.id === id)?.name).filter(Boolean);
  const dis = Object.entries(s.prefs ?? {}).filter(([, v]) => v === 'dislikes').map(([id]) => people.find((p) => p.id === id)?.name).filter(Boolean);
  const main = [...(s.proteins ?? []).map((x) => PROTEIN[x]), ...(s.carbs ?? []).map((x) => CARB[x]), ...(s.groups ?? []).filter((g) => g === 'veg' || g === 'legume').map((g) => GROUP[g])];
  const inCompare = ui.compare.includes(s.id);
  return el('li', { 'data-field': `result:${s.id}` }, [
    el('div', { class: 'list__main' }, [
      el('strong', { text: s.title }),
      el('div', { class: 'small', text: [!s.tried ? 'Not tried yet' : s.rating == null ? 'Tried, not rated' : `★ ${s.rating}/10`, favs.length ? `${favs.join(' and ')}’s favourite` : null, dis.length ? `${dis.join(' and ')} ${dis.length > 1 ? 'dislike' : 'dislikes'} it` : null].filter(Boolean).join(' · ') }),
      el('div', { class: 'small muted', text: [s.minutes ? `${s.minutes} min` : null, main.length ? main.join(', ') : null, `serves ${s.servings}`].filter(Boolean).join(' · ') }),
    ]),
    el('label', { class: 'checkline small' }, [el('input', { type: 'checkbox', checked: inCompare, disabled: !inCompare && ui.compare.length >= 3, on: { change: () => { ui.compare = inCompare ? ui.compare.filter((x) => x !== s.id) : [...ui.compare, s.id]; hub.render(); } } }), 'Compare']),
    el('a', { class: 'btn btn-small btn-quiet', href: mealHref(s.id, back), text: 'Details' }),
    el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Choose', 'data-field': `pick:${s.id}`, on: { click: onPick } }),
  ]);
}

function compareLoaded(hub, db) {
  const loaded = ui.compare.map((id) => loadRecipe(hub, id));
  if (loaded.some((r) => r.loading)) return loading('Comparing…');
  const entries = loaded.map((r) => r.data).filter(Boolean).map((rec) => ({ title: rec.title, servings: rec.servings, n: mealNutrition(rec.ingredients, rec.servings, db) }));
  return entries.length >= 2 ? comparePanel(entries, db) : null;
}

/** After choosing: servings and leftovers, then into the plan. The saved meal is not changed. */
function configureScreen(hub, { monday, day, meal, date, summary, current, back }) {
  const key = `${monday}~${day}~${meal}`;
  const st = (ui.config?.for === key ? ui.config : (ui.config = { for: key, servings: current?.servings ?? summary.servings ?? 4, mode: 'none', portions: 2, target: defaultTarget(date), meal }));
  const today = hub.today();
  return el('section', { class: 'stack' }, [
    el('button', { class: 'linkish small', type: 'button', text: '‹ Back to the list', style: { alignSelf: 'flex-start' }, on: { click: () => { ui.pick = null; hub.render(); } } }),
    el('h1', { text: `${summary.title} for ${label(date, meal, today)}` }),
    el('div', { class: 'panel' }, [leftoverControls(st, date, (patch) => { Object.assign(ui.config, patch); hub.render(); }, today)]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Put it in the plan', 'data-field': 'plan-save',
        on: {
          click: async () => {
            const p = await plans(hub).get(planId(monday)).catch(() => null);
            const plan = normalisePlan(p ?? (await legacyPlans(hub)?.get(planId(monday)).catch(() => null)) ?? {}, monday);
            const fields = slotFromState(st);
            await savePlan(hub, monday, setSlot(plan, day, meal, { recipeId: summary.id, title: summary.title, ...fields, ingredients: null, note: '', feedback: null }));
            ui.pick = null; ui.config = null;
            hub.ui.notice(`${summary.title} is planned for ${label(date, meal, today)}.`);
            hub.open(back);
          },
        },
      }),
      el('a', { class: 'btn', href: mealHref(summary.id, hub.href('choose', key)), text: 'See the recipe' }),
    ]),
  ]);
}

/** Planning arrives from Meals & Recipes ("Plan it"): pick the day and meal, servings and leftovers. */
function addScreen(hub, id, serves) {
  const r = id ? loadRecipe(hub, id) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('p', { class: 'panel', text: 'That meal was not found in Meals & Recipes.' });
  const rec = r.data;
  const today = hub.today();
  const st = (ui.adding?.for === id ? ui.adding : (ui.adding = { for: id, date: today, meal: 'dinner', servings: Number(serves) || rec.servings, mode: 'none', portions: 2, target: defaultTarget(today) }));
  const set = (patch) => { Object.assign(ui.adding, patch); hub.render(); };
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  return el('section', { class: 'stack' }, [
    el('h1', { text: `Plan ${rec.title}` }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'row' }, [
        el('label', { class: 'small', for: 'plan-day', text: 'Day' }),
        el('select', { class: 'select', id: 'plan-day', 'data-field': 'plan-day', style: { width: 'auto' }, on: { change: (e) => set({ date: e.target.value, target: defaultTarget(e.target.value) }) } }, days.map((d) => el('option', { value: d, text: fmtDay(d, today), selected: d === st.date }))),
        el('label', { class: 'small', for: 'plan-meal', text: 'Meal' }),
        el('select', { class: 'select', id: 'plan-meal', 'data-field': 'plan-meal', style: { width: 'auto' }, on: { change: (e) => set({ meal: e.target.value }) } }, MEALS.map((m) => el('option', { value: m, text: MEAL_LABEL[m], selected: m === st.meal }))),
      ]),
      leftoverControls(st, st.date, set, today),
    ]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Plan it', 'data-field': 'plan-save',
        on: {
          click: async () => {
            const monday = weekStart(st.date);
            const p = await plans(hub).get(planId(monday)).catch(() => null);
            const plan = normalisePlan(p ?? (await legacyPlans(hub)?.get(planId(monday)).catch(() => null)) ?? {}, monday);
            const day = Math.round((new Date(`${st.date}T12:00:00`) - new Date(`${monday}T12:00:00`)) / 864e5);
            if (await savePlan(hub, monday, setSlot(plan, day, st.meal, { recipeId: rec.id, title: rec.title, ...slotFromState(st), ingredients: null, note: '', feedback: null }))) {
              ui.adding = null;
              hub.ui.notice(`${rec.title} is planned for ${label(st.date, st.meal, today)}.`);
              hub.go('week', monday);
            }
          },
        },
      }),
      el('a', { class: 'btn', href: mealHref(rec.id), text: 'Cancel' }),
    ]),
  ]);
}

/* ---------------------------------------------------------------- a planned meal */

function slotScreen(hub, monday, slotId) {
  const p = loadPlan(hub, monday);
  if (p.loading) return loading();
  if (p.error) return failure(p.error);
  const slot = p.data.slots.find((s) => s.id === slotId);
  const back = hub.href('week', monday);
  if (!slot) return el('div', { class: 'panel' }, [el('p', { text: 'That planned meal is no longer in the plan.' }), el('a', { class: 'btn', href: back, text: 'Back to the week' })]);
  const r = slot.recipeId ? loadRecipe(hub, slot.recipeId) : { data: null };
  const f = loadFood(hub);
  const list = loadSummaries(hub);
  // The family's own sizes of foods, kept by Meals & Recipes.
  const ourSizes = hub.use('meal-sizes', async () => { const c = hub.data.of('meals', 'sizes'); const m = new Map(); for (const s of c ? (await c.list({ limit: 100000 })).items : []) m.set(s.fdcId, [...(m.get(s.fdcId) ?? []), s]); return m; });
  if (r.loading) return loading();
  const rec = r.data;
  const today = hub.today();
  const date = dateOf(monday, slot.day);
  const here = hub.href('slot', ref(monday, slot.id));
  const update = async (patch) => { await savePlan(hub, monday, updateSlot(p.data, slot.id, patch)); };
  const ingredients = slot.ingredients ?? rec?.ingredients ?? [];
  const basis = slot.ingredients ? slot.basis : rec?.servings ?? slot.servings;
  // Our own items used in it, loaded before anything is worked out.
  const subs = hub.use(`subs:${slot.id}:${JSON.stringify(ingredients.filter((i) => i.recipeId).map((i) => i.recipeId))}`, () => (book(hub) ? collectRecipes(ingredients, (x) => book(hub).get(x)) : new Map()));
  if (subs.loading) return loading();
  const getSub = (x) => subs.data?.get(x) ?? null;
  const n = f.data && ingredients.length ? mealNutrition(ingredients, basis, f.data, { recipes: subs.data }) : null;
  const batch = slotBatch(slot, rec);
  if (ui.slotDraft?.id !== `${monday}~${slot.id}`) ui.slotDraft = { id: `${monday}~${slot.id}`, rows: ingredients.map((i) => ({ ...i })) };
  const profiles = hub.foodProfiles();
  const guide = portionShares(profiles, today);
  const family = guide.map((s) => (slot.portions[s.id] ? { ...s, share: slot.portions[s.id], basis: 'set' } : s));
  const shares = [...family, ...guestShares(slot.guests, today).map((g) => (slot.portions[g.id] ? { ...g, share: slot.portions[g.id], basis: 'set' } : g))];
  // Guests change how many eat: the servings follow the portion guide for everyone at the table.
  const setGuests = (guests) => update({ guests, servings: servingsFor([...family, ...guestShares(guests, today)]) });
  const changed = Boolean(slot.ingredients);
  const sys = hub.units();

  return el('section', { class: 'stack' }, [
    el('a', { href: back, class: 'small', text: '‹ Back to the week' }),
    el('div', { class: 'row' }, [
      el('h1', { text: slot.title, style: { margin: 0 } }),
      el('span', { class: 'badge', text: label(date, slot.meal, today) }),
      changed ? el('span', { class: 'badge badge--demo', text: 'Changed this time' }) : null,
    ]),
    rec ? el('p', { class: 'small' }, ['From ', el('a', { href: mealHref(rec.id, here), text: rec.title }), ` · ${!rec.tried ? 'not tried yet' : rec.rating == null ? 'tried, not rated' : `family rating ${rec.rating}/10`}. Changes here are for this meal only.`])
      : el('p', { class: 'small muted', text: 'A meal typed into the plan - not saved in Meals & Recipes.' }),

    el('div', { class: 'panel stack', 'aria-label': 'Servings and leftovers' }, [
      el('h2', { text: 'Servings and leftovers', style: { margin: 0 } }),
      el('div', { class: 'row' }, [
        el('label', { class: 'small', for: 'sl-serv', text: 'Eating at this meal' }),
        el('input', { class: 'input', id: 'sl-serv', type: 'number', min: '1', max: '40', value: String(slot.servings), style: { width: '5em' }, 'data-field': 'servings', on: { change: (e) => update({ servings: Math.max(1, Number(e.target.value) || 1) }) } }),
        el('label', { class: 'small', for: 'sl-extra', text: 'Extra, not yet planned' }),
        el('input', { class: 'input', id: 'sl-extra', type: 'number', min: '0', max: '40', value: String(slot.extra), style: { width: '5em' }, 'data-field': 'extra', on: { change: (e) => update({ extra: Math.max(0, Number(e.target.value) || 0) }) } }),
      ]),
      el('div', { class: 'stack', style: { gap: '4px' } }, [
        el('div', { class: 'row' }, [
          el('span', { class: 'small', text: 'Guests joining this meal:' }),
          ...slot.guests.map((g, i) => el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: `${GUESTS[g.who].label} ×`, 'aria-label': `Remove guest: ${GUESTS[g.who].label}`, on: { click: () => setGuests(slot.guests.filter((_, j) => j !== i)) } })),
          el('select', { class: 'select', id: 'guest-new', style: { width: 'auto' }, 'aria-label': 'Kind of guest', 'data-field': 'guest-new' }, Object.entries(GUESTS).map(([k, t]) => el('option', { value: k, text: t.label }))),
          el('button', { class: 'btn btn-small', type: 'button', text: 'Add guest', 'data-field': 'guest-add', on: { click: () => setGuests([...slot.guests, { id: `g${Date.now().toString(36)}`, who: document.getElementById('guest-new').value }]) } }),
        ]),
        slot.guests.length ? el('p', { class: 'small muted', style: { margin: 0 }, text: `With guests, ${servingsFor(shares)} servings cover everyone by the portion guide - "Eating at this meal" was set to match; change it if you know better.` }) : null,
      ]),
      slot.reserve.length ? el('ul', { class: 'list' }, slot.reserve.map((res) => el('li', {}, [
        el('div', { class: 'list__main' }, [
          el('strong', { text: `Leftovers for ${label(res.date, res.meal, today)}` }),
          el('div', { class: 'row', style: { marginTop: '4px' } }, [
            el('label', { class: 'small', for: `res-${res.id}`, text: 'Portions' }),
            el('input', { class: 'input', id: `res-${res.id}`, type: 'number', min: '1', max: '40', value: String(res.portions), style: { width: '5em' }, 'data-field': `res-portions:${res.id}`, on: { change: async (e) => { await savePlan(hub, monday, setReservation(p.data, slot.id, res.id, { portions: Math.max(1, Number(e.target.value) || 1) })); } } }),
            el('label', { class: 'small', for: `resadd-${res.id}`, text: 'Also needs' }),
            el('input', { class: 'input', id: `resadd-${res.id}`, value: res.additions.map(formatIngredient).join(', '), placeholder: 'e.g. 4 wraps, 1 avocado', style: { width: '14em' }, on: { change: async (e) => { await savePlan(hub, monday, setReservation(p.data, slot.id, res.id, { additions: e.target.value.split(',').map((x) => parseIngredient(x.trim())).filter((x) => x.name) })); } } }),
          ]),
        ]),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Cancel these leftovers', on: { click: async () => { await savePlan(hub, monday, setReservation(p.data, slot.id, res.id, { portions: 0 })); } } }),
      ]))) : null,
      el('div', { class: 'row' }, [
        el('label', { class: 'small', for: 'res-new', text: 'Set aside leftovers for' }),
        el('select', { class: 'select', id: 'res-new', style: { width: 'auto' }, 'data-field': 'res-new' }, [
          el('option', { value: '', text: 'choose a later meal…' }),
          ...Array.from({ length: 6 }, (_, i) => addDays(date, i + 1)).flatMap((d) => MEALS.map((m) => el('option', { value: `${d}|${m}`, text: label(d, m, today) }))),
        ]),
        el('button', { class: 'btn btn-small', type: 'button', text: 'Add', 'data-field': 'res-add', on: { click: async () => { const v = document.getElementById('res-new').value; if (!v) return; const [d, m] = v.split('|'); await savePlan(hub, monday, addReservation(p.data, slot.id, { date: d, meal: m, portions: 1 })); } } }),
      ]),
      el('p', { class: 'small', text: `Cook ${prepared(slot)} portion${prepared(slot) === 1 ? '' : 's'}: ${slot.servings} now${slot.extra ? `, ${slot.extra} extra` : ''}${reserved(slot) ? `, ${reserved(slot)} set aside` : ''}.` }),
      ingredients.length ? el('p', { class: 'small', 'data-field': 'batch' }, [
        el('strong', { text: `Make the recipe x${batch.m}` }),
        ` - ${batch.makes} servings${batch.spare >= 0.25 ? `, about ${fmtShare(Math.floor(batch.spare * 4) / 4)} spare` : ''}${rec?.yield?.qty ? `, ${Math.round(rec.yield.qty * batch.m * 10) / 10} ${rec.yield.unit}` : ''}.`,
        batch.blocked.length ? ` A smaller batch would split the ${batch.blocked.join(' and ')}.` : '',
      ]) : null,
      el('p', { class: 'small muted', text: 'Cooked leftovers keep about 3 days in the fridge (cool within 2 hours, reheat until steaming hot), or a few months frozen.' }),
    ]),

    el('div', { class: 'panel stack', 'aria-label': 'Ingredients' }, [
      el('h2', { text: `Ingredients (recipe x${batch.m}, ${batch.makes} servings)`, style: { margin: 0 } }),
      // Everything cooked (leftovers included), our own items opened into theirs; a leftover meal's additions are listed with it.
      ingredients.length ? el('ul', {}, slotNeeds({ ...slot, reserve: slot.reserve.map((x) => ({ ...x, additions: [] })) }, rec, getSub).map((i) => el('li', { text: `${formatIngredient(inSystem(i, sys))}${i.note ? ` (${i.note})` : ''}` }))) : el('p', { class: 'small muted', text: 'No ingredients recorded.' }),
      el('details', { class: 'measures' }, [
        el('summary', { text: changed ? 'Change this meal’s ingredients again' : 'Change the ingredients for this meal only' }),
        el('div', { class: 'stack' }, [
          el('p', { class: 'small', text: `Amounts for ${basis} servings (the recipe's own) - the batch is worked out from what you cook.` }),
          ingredientEditor({ rows: ui.slotDraft.rows, db: f.data ?? null, own: (list.data ?? []).filter((s) => s.asIngredient), selfId: rec?.id ?? null, sizes: ourSizes.data ?? new Map(), system: sys }),
          el('div', { class: 'row' }, [
            el('button', { class: 'btn btn-small', type: 'button', text: 'Save for this meal', 'data-field': 'slot-ing-save', on: { click: async () => { await update({ ingredients: ui.slotDraft.rows.filter((x) => x.name.trim()), basis }); ui.slotDraft = null; } } }),
            changed && rec ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Go back to the recipe’s ingredients', on: { click: async () => { await update({ ingredients: null }); ui.slotDraft = null; } } }) : null,
          ]),
        ]),
      ]),
      // A changed planned meal: the person decides what the change is - nothing is decided for them.
      changed && rec ? el('div', { class: 'banner banner--info stack', 'aria-label': 'You changed this meal', style: { padding: 'var(--space-3)' } }, [
        el('strong', { text: 'You changed this meal. What should happen to the change?' }),
        el('ul', { class: 'small', style: { margin: 0 } }, [
          el('li', { text: 'Keep it for this time only - nothing else needed. The saved recipe and other planned meals stay as they are.' }),
          el('li', { text: 'Replace the saved recipe - every future time uses the new ingredients. Its ratings and notes stay.' }),
          el('li', { text: 'Save as a new recipe - a separate version with its own ratings and notes; the original stays.' }),
        ]),
        el('div', { class: 'row' }, [
          el('span', { class: 'badge badge--ok', text: 'Kept for this time only' }),
          el('a', { class: 'btn btn-small', href: `#/meals/edit/${encodeURIComponent(rec.id)}/${encodeURIComponent(`update:${JSON.stringify({ servings: basis, ingredients: slot.ingredients })}`)}`, text: 'Replace the saved recipe', 'data-field': 'update-original' }),
          el('a', { class: 'btn btn-small', href: `#/meals/new/${encodeURIComponent(`variant:${JSON.stringify({ title: `${rec.title} (our version)`, servings: basis, ingredients: slot.ingredients, variantOf: rec.id, notes: slot.note, instructions: rec.instructions, tags: rec.tags, prepMinutes: rec.prepMinutes, cookMinutes: rec.cookMinutes, allergens: rec.allergens, description: rec.description })}`)}`, text: 'Save as a new recipe', 'data-field': 'save-variant' }),
        ]),
      ]) : null,
      hub.data.installed('assistant') && ingredients.length ? el('a', { class: 'btn btn-small', href: `#/assistant/meal/slot:${encodeURIComponent(ref(monday, slot.id))}`, text: 'Improve with Meal Assistant', 'data-field': 'improve-slot', style: { alignSelf: 'flex-start' } }) : null,
    ]),

    el('div', { class: 'panel stack', 'aria-label': 'Nutrition' }, [
      el('h2', { text: 'What is in it', style: { margin: 0 } }),
      f.loading ? loading('Opening the food database…') : f.error ? failure(f.error) : n
        ? nutritionPanel(n, f.data, { shares, sharesNote: Object.keys(slot.portions).length ? 'Portions set by hand where shown; the rest follow the portion guide (an assumption).' : 'Portions are an assumption from the portion guide (age, gender, height and weight). Adjust them below if this meal is divided differently.' })
        : el('p', { class: 'small muted', text: 'Add ingredients to see what is in it.' }),
      profiles.length ? el('details', { class: 'measures' }, [
        el('summary', { text: 'Who eats how much at this meal' }),
        el('table', { class: 'facts' }, [el('tbody', {}, shares.map((s) => el('tr', {}, [
          el('th', { scope: 'row', text: s.name }),
          el('td', {}, el('span', { class: 'row', style: { gap: '4px', justifyContent: 'flex-end' } }, [
            el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '−', 'aria-label': `Less for ${s.name}`, on: { click: () => update({ portions: { ...slot.portions, [s.id]: Math.max(0.25, s.share - 0.25) } }) } }),
            el('span', { text: `${fmtShare(s.share)}${s.basis === 'set' ? ' (set)' : ''}` }),
            el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '+', 'aria-label': `More for ${s.name}`, on: { click: () => update({ portions: { ...slot.portions, [s.id]: Math.min(4, s.share + 0.25) } }) } }),
          ])),
        ])))]),
        Object.keys(slot.portions).length ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Back to the portion guide', on: { click: () => update({ portions: {} }) } }) : null,
      ]) : null,
    ]),

    el('div', { class: 'panel stack', 'aria-label': 'This meal' }, [
      el('h2', { text: 'Notes and feedback for this meal', style: { margin: 0 } }),
      el('label', { class: 'small', for: 'sl-note', text: 'A note about this time only (it does not change the recipe)' }),
      el('textarea', { class: 'input', id: 'sl-note', rows: '2', text: slot.note, placeholder: 'e.g. We added mushrooms; the leftovers worked well for lunch', 'data-field': 'slot-note', on: { change: (e) => update({ note: e.target.value }) } }),
      el('div', { class: 'row' }, [
        el('label', { class: 'small', for: 'sl-rate', text: changed ? 'How this version went' : 'How it went this time' }),
        el('select', { class: 'select', id: 'sl-rate', style: { width: 'auto' }, 'data-field': 'slot-rating', on: { change: (e) => update({ feedback: { ...slot.feedback, rating: e.target.value ? Number(e.target.value) : null } }) } }, [
          el('option', { value: '', text: 'not rated', selected: slot.feedback.rating === null }),
          ...Array.from({ length: 10 }, (_, i) => 10 - i).map((v) => el('option', { value: String(v), text: `${v}/10`, selected: slot.feedback.rating === v })),
        ]),
      ]),
      el('p', { class: 'small muted', text: 'This rating is for this meal only - the family rating of the recipe is set in Meals & Recipes.' }),
      rec ? el('div', { class: 'row' }, [
        el('a', { class: 'btn btn-small', href: mealHref(rec.id, here), text: 'Rate the recipe and who likes it', 'data-field': 'rate-recipe' }),
        slot.note ? el('a', { class: 'btn btn-small btn-quiet', href: `#/meals/note/${encodeURIComponent(rec.id)}/${encodeURIComponent(JSON.stringify({ text: slot.note, occasion: label(date, slot.meal, today), back: here }))}`, text: 'Add this note to the recipe', 'data-field': 'promote-note' }) : null,
      ]) : null,
    ]),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn', href: hub.href('choose', `${monday}~${slot.day}~${slot.meal}`), text: 'Replace with another meal' }),
    ]),
  ]);
}

/* ---------------------------------------------------------------- Plan my week */

function mixScreen(hub, monday) {
  monday = weekOf(monday, hub);
  const p = loadPlan(hub, monday);
  const list = loadSummaries(hub);
  const w1 = loadPlan(hub, addDays(monday, -7));
  const w2 = loadPlan(hub, addDays(monday, -14));
  if ([p, list, w1, w2].some((x) => x.loading)) return loading('Looking through your meals…');
  if (p.error || list.error) return failure(p.error ?? list.error);
  const people = hub.foodProfiles();
  const m = ui.mix;
  const today = hub.today();
  const empty = [0, 1, 2, 3, 4, 5, 6].filter((d) => !slotAt(p.data, d, m.meal)).map((day) => ({ day, meal: m.meal }));
  const recent = new Set([...w1.data.slots, ...w2.data.slots].map((s) => s.recipeId).filter(Boolean));
  const meals = list.data.filter((s) => !ui.rejected.includes(s.id) && !p.data.slots.some((x) => x.recipeId === s.id));
  const proposal = ui.proposal?.week === monday ? ui.proposal : null;
  const number = (key) => el('label', { class: 'row small', style: { gap: '6px' } }, [
    el('input', { class: 'input', type: 'number', min: '0', max: '7', value: String(m[key]), style: { width: '4.5em' }, 'data-field': `mix-${key}`, on: { change: (e) => { ui.mix = { ...m, [key]: Math.max(0, Number(e.target.value) || 0) }; ui.proposal = null; hub.render(); } } }), MIX[key],
  ]);
  return el('section', { class: 'stack', 'aria-label': 'Plan my week' }, [
    el('a', { href: hub.href('week', monday), class: 'small', text: '‹ Back to the week' }),
    el('h1', { text: 'Plan my week' }),
    el('p', { class: 'muted', text: 'A mix of meals the family already enjoys and new ones to try, from your own Meals & Recipes. Nothing goes into the plan until you say so.' }),
    el('div', { class: 'panel stack' }, [
      el('label', { class: 'row small', style: { gap: '6px' } }, ['For', el('select', { class: 'select', style: { width: 'auto' }, 'data-field': 'mix-meal', on: { change: (e) => { ui.mix = { ...m, meal: e.target.value }; ui.proposal = null; hub.render(); } } }, MEALS.map((x) => el('option', { value: x, text: MEAL_LABEL[x].toLowerCase(), selected: x === m.meal }))), `- ${empty.length} empty day${empty.length === 1 ? '' : 's'} this week`]),
      ...Object.keys(MIX).map(number),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Suggest a week', 'data-field': 'mix-go', disabled: !empty.length, style: { alignSelf: 'flex-start' },
        on: { click: () => { ui.proposal = { week: monday, ...proposeWeek({ meals, counts: m, slots: empty, recent, people, seed: `${monday}${ui.rejected.length}` }), accept: {} }; hub.render(); } },
      }),
    ]),
    proposal ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Suggested', style: { margin: 0 } }),
      proposal.picks.length ? el('ul', { class: 'list' }, proposal.picks.map((x) => el('li', {}, [
        el('label', { class: 'checkline list__main' }, [
          el('input', { type: 'checkbox', checked: proposal.accept[x.id] !== false, 'data-field': `mix-accept:${x.id}`, on: { change: (e) => { proposal.accept[x.id] = e.target.checked; } } }),
          el('span', {}, [el('strong', { text: `${label(dateOf(monday, x.day), x.meal, today)}: ${x.title}` }), el('div', { class: 'small muted', text: [MIX[x.group], x.reason].filter(Boolean).join(' - ') })]),
        ]),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Something else', on: { click: () => { ui.rejected.push(x.id); ui.proposal = { week: monday, ...proposeWeek({ meals: meals.filter((s) => s.id !== x.id), counts: m, slots: empty, recent, people, seed: `${monday}${ui.rejected.length}` }), accept: {} }; hub.render(); } } }),
      ]))) : el('p', { text: 'No meals could be suggested.' }),
      proposal.shortfall.length ? el('div', { class: 'small' }, [
        el('p', { text: 'Not enough meals for everything you asked:' }),
        el('ul', {}, proposal.shortfall.map((s) => el('li', { text: `${MIX[s.group]}: ${s.found} of ${s.wanted}. ${{ family: 'Rate meals you have tried in Meals & Recipes so favourites can be found.', individual: 'Mark people’s favourites on a meal’s page.', untried: 'Add some new recipes to try.', other: 'Plan or rate more of the meals you have had.' }[s.group]}` }))),
        el('p', { class: 'muted', text: 'Nothing is made up to fill the gaps - you can choose meals for the empty days yourself.' }),
      ]) : null,
      proposal.picks.length ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Put the ticked meals in the plan', 'data-field': 'mix-apply', style: { alignSelf: 'flex-start' },
        on: {
          click: async () => {
            let plan = p.data;
            for (const x of proposal.picks.filter((y) => proposal.accept[y.id] !== false)) {
              const s = list.data.find((y) => y.id === x.id);
              plan = setSlot(plan, x.day, x.meal, { recipeId: x.id, title: x.title, servings: s?.servings ?? 4 });
            }
            await savePlan(hub, monday, plan);
            ui.proposal = null; ui.rejected = [];
            hub.ui.notice('The week is planned. Change anything on the week screen.');
            hub.go('week', monday);
          },
        },
      }) : null,
    ]) : null,
  ]);
}

/* ---------------------------------------------------------------- how the week looks */

/** Every occasion in the week, with what it holds - leftovers as their own occasions, their food cooked once. */
function weekOccasions(hub, monday, db) {
  const p = loadPlan(hub, monday);
  const prev = loadPlan(hub, addDays(monday, -7));
  if (p.loading || prev.loading) return { loading: true };
  const plan = p.data;
  const ids = [...new Set([...plan.slots, ...prev.data.slots].map((s) => s.recipeId).filter(Boolean))];
  const rs = ids.map((id) => [id, loadRecipe(hub, id)]);
  if (rs.some(([, r]) => r.loading)) return { loading: true };
  const recipes = new Map(rs.map(([id, r]) => [id, r.data]).filter(([, r]) => r));
  const subIds = [...new Set([...recipes.values(), ...plan.slots].flatMap((x) => x.ingredients ?? []).filter((i) => i.recipeId).map((i) => i.recipeId))];
  const subs = subIds.map((id) => [id, loadRecipe(hub, id)]);
  if (subs.some(([, x]) => x.loading)) return { loading: true };
  for (const [id, x] of subs) if (x.data) recipes.set(id, x.data);
  const about = (s) => {
    const rec = s.recipeId ? recipes.get(s.recipeId) : null;
    const ings = s.ingredients ?? rec?.ingredients ?? null;
    if (!ings?.length) return { facts: null, profile: null };
    const n = mealNutrition(ings, s.ingredients ? s.basis : rec.servings, db, { recipes });
    return { facts: recipeFacts({ ingredients: ings }), profile: nutrientProfile(n, db), rating: rec?.rating ?? null, prefsFavourite: rec ? Object.values(rec.prefs).includes('favourite') : false };
  };
  const occasions = [
    ...plan.slots.map((s) => ({ day: s.day, meal: s.meal, title: s.title, kind: 'cooked', slotId: s.id, recipeId: s.recipeId, weight: s.servings, ...about(s) })),
    ...leftoverMeals([prev.data, plan], monday).map((l) => {
      const src = [...plan.slots, ...prev.data.slots].find((s) => s.id === l.from.slotId && (l.from.week === monday ? plan : prev.data).slots.includes(s));
      return { day: l.day, meal: l.meal, title: `${l.title} (leftovers)`, kind: 'leftovers', slotId: null, weight: l.portions, ...(src ? about(src) : { facts: null, profile: null }) };
    }),
  ].sort((a, b) => a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  return { plan, occasions, recipes };
}

function reviewScreen(hub, monday) {
  monday = weekOf(monday, hub);
  const f = loadFood(hub);
  const list = loadSummaries(hub);
  if (f.loading || list.loading) return loading('Looking at the week…');
  if (f.error) return failure(f.error);
  const w = weekOccasions(hub, monday, f.data);
  if (w.loading) return loading('Looking at the week…');
  const today = hub.today();
  const a = analyseWeek(w.occasions);
  const people = hub.foodProfiles();
  const cats = a.categories;
  const opt = ui.optimise?.week === monday ? ui.optimise : null;
  const findLink = (gap) => (GROUP[gap] ? el('button', {
    class: 'btn btn-small btn-quiet', type: 'button', text: `Find meals with ${GROUP[gap].toLowerCase()}`,
    on: { click: () => { ui.filters = { ...emptyFilters(), includes: [gap] }; const day = w.plan.slots[0]?.day ?? 0; hub.go('choose', `${monday}~${day}~${w.plan.slots[0]?.meal ?? 'dinner'}`); } },
  }) : null);
  return el('section', { class: 'stack', 'aria-label': 'How the week looks' }, [
    el('a', { href: hub.href('week', monday), class: 'small', text: '‹ Back to the week' }),
    el('h1', { text: 'How the week looks' }),
    el('p', { class: 'small', text: `Looking at ${a.included.length} planned meal${a.included.length === 1 ? '' : 's'} (${a.mealTypes.map((t) => MEAL_LABEL[t].toLowerCase()).join(', ')})${a.partial ? ' - not the whole of what the family eats, so read this as a look at these meals only' : ''}.` }),
    el('details', { class: 'measures' }, [el('summary', { text: 'Which meals are included' }), el('ul', { class: 'small' }, a.included.map((o) => el('li', { text: `${label(dateOf(monday, o.day), o.meal, today)}: ${o.title}` })))]),
    cats.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Six nutrient types across the week', style: { margin: 0 } }),
      el('div', { class: 'radar-wrap' }, [radar(cats.map((c) => c.label.split(' ')[0]), [{ name: 'The week', values: cats.map((c) => c.score) }], { title: 'The planned week, averaged per meal' })]),
      el('p', { class: 'small muted', text: `The average of the planned meals, each counted by the portions eaten at it. ${cats.some((c) => c.known < c.of) ? 'Some meals could not be fully weighed. ' : ''}It is an estimate, not a measure of anyone’s diet.` }),
    ]) : null,
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Variety', style: { margin: 0 } }),
      el('p', { class: 'small', text: `${a.variety.plants} different plant foods; colours: ${a.variety.colours.join(', ') || 'none recognised'}. Vegetables in ${a.variety.veg}, fruit in ${a.variety.fruit}, legumes in ${a.variety.legume}, whole grains in ${a.variety.wholegrain} of ${a.variety.withFacts} meals with ingredients.` }),
      Object.keys(a.variety.proteins).length ? el('p', { class: 'small', text: `Proteins: ${Object.entries(a.variety.proteins).map(([k, v]) => `${PROTEIN[k]} ×${v}`).join(', ')}. Carbohydrates: ${Object.entries(a.variety.carbs).map(([k, v]) => `${CARB[k]} ×${v}`).join(', ') || 'none recognised'}.` }) : null,
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Worth a look', style: { margin: 0 } }),
      a.findings.length ? el('ul', { class: 'guidance' }, a.findings.map((x) => el('li', { class: x.level === 'attention' ? 'guidance--warn' : '' }, [
        x.text, ' ', x.gap ? findLink(x.gap) : null,
      ]))) : el('p', { class: 'small', text: 'Nothing stands out.' }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Optimise my week', 'data-field': 'optimise', style: { alignSelf: 'flex-start' },
        on: { click: () => { ui.optimise = { week: monday, proposals: optimiseWeek({ analysis: a, occasions: w.occasions, meals: (list.data ?? []).filter((s) => !w.plan.slots.some((x) => x.recipeId === s.id)), people, today }), accept: {} }; hub.render(); } },
      }),
    ]),
    opt ? el('div', { class: 'panel stack', 'aria-label': 'Suggested changes' }, [
      el('h2', { text: 'Suggested changes', style: { margin: 0 } }),
      opt.proposals.length ? el('ul', { class: 'list' }, opt.proposals.map((x, i) => el('li', {}, [
        el('label', { class: 'checkline list__main' }, [
          el('input', { type: 'checkbox', checked: opt.accept[i] === true, 'data-field': `opt-accept:${i}`, on: { change: (e) => { opt.accept[i] = e.target.checked; } } }),
          el('span', {}, [el('strong', { text: x.text }), el('div', { class: 'small muted', text: x.why })]),
        ]),
      ]))) : el('p', { class: 'small', text: 'No small change from your own meals would clearly help - the week is fine as it is, or there are not enough recorded ingredients to tell.' }),
      opt.proposals.length ? el('p', { class: 'small muted', text: 'Tick the ones you want. Changes apply to these planned meals only - saved recipes stay as they are. The week and shopping list are worked out again afterwards.' }) : null,
      opt.proposals.length ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Apply the ticked changes', 'data-field': 'opt-apply', style: { alignSelf: 'flex-start' },
        on: { click: () => applyProposals(hub, monday, w, opt) },
      }) : null,
    ]) : null,
  ]);
}

async function applyProposals(hub, monday, w, opt) {
  let plan = w.plan;
  for (const [i, x] of opt.proposals.entries()) {
    if (opt.accept[i] !== true) continue;
    const slot = plan.slots.find((s) => s.id === x.slotId);
    if (!slot) continue;
    const rec = slot.recipeId ? w.recipes.get(slot.recipeId) : null;
    const ings = slot.ingredients ?? rec?.ingredients ?? [];
    const basis = slot.ingredients ? slot.basis : rec?.servings ?? slot.servings;
    if (x.kind === 'add') plan = updateSlot(plan, slot.id, { ingredients: [...ings, additionFor(x.food, basis)], basis });
    if (x.kind === 'swap') plan = updateSlot(plan, slot.id, { ingredients: ings.map((g) => (new RegExp(`\\b${x.from.name.split(' ').pop()}\\b`, 'i').test(g.name) ? { ...g, name: x.to.name, fdcId: x.to.fdc } : g)), basis });
    if (x.kind === 'replace') plan = setSlot(plan, slot.day, slot.meal, { recipeId: x.recipeId, title: x.title, servings: slot.servings, ingredients: null, note: '', feedback: null });
  }
  await savePlan(hub, monday, plan);
  ui.optimise = null;
  hub.ui.notice('Changes applied to the planned meals. Send the week to the shopping list again to update it.');
  hub.render();
}

/* ---------------------------------------------------------------- from Meal Assistant */

/** Meal Assistant sends an idea back for one planned meal: `{ add: guideId }` or `{ swap: [fromGuideId, toGuideId] }`. */
function modifyScreen(hub, monday, slotId, param) {
  const p = loadPlan(hub, monday);
  if (p.loading) return loading();
  const slot = p.data?.slots.find((s) => s.id === slotId);
  let idea = null;
  try { idea = JSON.parse(param ?? ''); } catch { idea = null; }
  const back = hub.href('slot', ref(monday, slotId));
  if (!slot || !idea) return el('div', { class: 'panel' }, [el('p', { text: 'That change could not be applied - the planned meal or the idea is missing.' }), el('a', { class: 'btn', href: hub.href('week', monday), text: 'Back to the week' })]);
  const r = slot.recipeId ? loadRecipe(hub, slot.recipeId) : { data: null };
  if (r.loading) return loading();
  const rec = r.data;
  const ings = slot.ingredients ?? rec?.ingredients ?? [];
  const basis = slot.ingredients ? slot.basis : rec?.servings ?? slot.servings;
  const add = idea.add ? GUIDE.find((g) => g.id === idea.add) : null;
  const swapFrom = idea.swap ? GUIDE.find((g) => g.id === idea.swap[0]) : null;
  const swapTo = idea.swap ? GUIDE.find((g) => g.id === idea.swap[1]) : null;
  const next = add ? [...ings, additionFor(add, basis)]
    : swapFrom && swapTo ? ings.map((g) => ([swapFrom.name, ...swapFrom.also].some((n) => g.name.toLowerCase().includes(n)) ? { ...g, name: swapTo.name, fdcId: swapTo.fdc } : g)) : null;
  if (!next) return el('p', { class: 'panel', text: 'That idea is not one this planner understands.' });
  return el('section', { class: 'stack' }, [
    el('h1', { text: add ? `Add ${add.name} to ${slot.title}?` : `Use ${swapTo.name} instead of ${swapFrom.name}?` }),
    el('p', { class: 'small', text: `For ${label(dateOf(monday, slot.day), slot.meal, hub.today())} only - the saved recipe stays as it is unless you choose to save the change there afterwards.` }),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Change this planned meal', 'data-field': 'modify-apply', on: { click: async () => { await savePlan(hub, monday, updateSlot(p.data, slot.id, { ingredients: next, basis })); hub.ui.notice('Changed for this meal. The shopping list updates when you send the week again.'); hub.open(back); } } }),
      el('a', { class: 'btn', href: back, text: 'Cancel' }),
    ]),
  ]);
}
