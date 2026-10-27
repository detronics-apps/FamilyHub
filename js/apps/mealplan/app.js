// This Week (Meals section): the week's planned meals. Each slot is a planned
// meal - one occasion, apart from the saved recipe it came from - with its own
// servings, leftovers, ingredient changes, note and feedback (see normaliseSlot
// in ../meals/logic.js). Meals and recipes come from the Cookbook
// (read-only); ratings, preferences and new versions are recorded there through
// links, and the week's ingredients go to Shopping the same way. Weeks planned
// before This Week was its own mini-app are read from where they were kept.
//
// Screens: plan (default: the planned meals, not yet on days) · assign (those
// beside a calendar, to drag onto days) · week (the calendar alone, a week or a
// month) · choose a meal · a planned meal · suggest meals · how the week looks
// (with Optimise My Week) · add (from a recipe) · modify (from Meal Assistant).

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay, addDays, dayDiff } from '../../dates.js';
import { draggable, dropTarget } from '../../ui/drag.js';
import { loading, failure, saveRecord, tabs } from '../kit.js';
import {
  MEALS, MEAL_LABEL, WEEKDAYS, normaliseRecipe, recipeSummary, formatIngredient, parseIngredient,
  weekStart, weekDays, normalisePlan, slotAt, setSlot, updateSlot, copyPlan, planId, planShopping, slotNeeds,
  prepared, reserved, leftoverMeals, setReservation, addReservation, SUMMARY_VERSION, slotBatch, collectRecipes,
  POOL, normalisePool, addToPool, moveMeal, addSlot, mealsBetween, mondaysBetween, goodFor, stillToBuy, sentAs,
} from '../meals/logic.js';
import { ingredientEditor } from '../../ui/ingredient-editor.js';
import { recipeFacts, passes, emptyFilters, describeFilters, PROTEIN, CARB, GROUP, TRIAL, MEAL_TAGS } from '../meals/facts.js';
import { MIX, proposeWeek, analyseWeek, optimiseWeek, additionFor, applyIdea } from './logic.js';
import { GUIDE } from '../assistant/guide.js';
import { sendHref } from '../shopping/logic.js';
import { mealNutrition, nutrientProfile } from '../../meal-nutrition.js';
import { nutritionPanel, comparePanel, radar } from '../../ui/nutrition-view.js';
import { portionShares, fmtShare, GUESTS, guestShares, servingsFor } from '../../portions.js';
import { inSystem } from '../../units.js';

const ui = { cooked: new Set(), showAllMeals: false, q: '', filters: emptyFilters(), compare: [], mix: { family: 4, individual: 0, untried: 2, other: 1, meal: '' }, proposal: null, optimise: null, rejected: [] };

const plans = (hub) => hub.data.collection('plans', { summary: (p) => ({ title: `Week of ${p.week}`, week: p.week, count: p.slots.length }) });
const book = (hub) => (hub.data.installed('meals') ? hub.data.of('meals', 'recipes') : null);
const legacyPlans = (hub) => (hub.data.installed('meals') ? hub.data.of('meals', 'plans') : null);

/** A week's plan: our own, else one kept by the Cookbook from before, else empty. 'pool' is the planned meals not on a day yet. */
const loadPlan = (hub, monday) => hub.use(`plan:${monday}`, async () => {
  const own = await plans(hub).get(planId(monday));
  if (monday === POOL) return normalisePool(own ?? {});
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
const dateOf = (monday, day) => (monday === POOL ? null : addDays(monday, day));
const label = (date, meal, today) => (date ? `${fmtDay(date, today)} ${MEAL_LABEL[meal].toLowerCase()}` : meal ? `${MEAL_LABEL[meal].toLowerCase()} - not on a day yet` : 'not sorted, not on a day yet');
const isDate = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x ?? '');
const ref = (monday, x) => `${monday}~${x}`;

export function render(hub, route) {
  const [a, b, c] = (route.rest[0] ?? '').split('~');
  switch (route.sub) {
    case 'choose': return chooseScreen(hub, a, Number(b), c);
    case 'slot': return slotScreen(hub, a, b);
    case 'mix': return mixScreen(hub);
    case 'review': return reviewScreen(hub, a);
    case 'add': return addScreen(hub, a, b);
    case 'modify': return modifyScreen(hub, a, b, c);
    case 'today': return todayScreen(hub);
    case 'sent': return sentScreen(hub, route.rest[0] ?? '');
    case 'assign': return assignScreen(hub, route.rest[0] ?? null);
    case 'week': return weekScreen(hub, route.rest[0] ?? null);
    default: return planScreen(hub);
  }
}

const weekOf = (param, hub) => weekStart(param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : hub.today());

/* ---------------------------------------------------------------- the week */

/**
 * Cooking today: each meal planned for today with the batch, what goes in and the
 * method. Below, the meals of this shop (D-056): in the mood for another one? Drag
 * it onto today and the two swap. Steps can be ticked as you go (not saved).
 */
function todayScreen(hub) {
  const today = hub.today();
  const trip = hub.use('plan:trip', () => plans(hub).get(TRIP).catch(() => null));
  if (trip.loading) return loading();
  const t = trip.data;
  const inTrip = Boolean(t?.from && t.from <= today && today <= t.to);
  const from = inTrip ? t.from : today;
  const to = inTrip ? t.to : addDays(today, 6);
  const weeks = mondaysBetween(from, to).map((m) => [m, loadPlan(hub, m)]);
  const pool = loadPool(hub);
  if (weeks.some(([, x]) => x.loading) || pool.loading) return loading();
  // Shopped for but on no day (D-060): there to drag onto today, in any order.
  const bought = (pool.data?.slots ?? []).filter((s) => s.sent);
  const bad = weeks.find(([, x]) => x.error);
  if (bad) return failure(bad[1].error);
  const got = Object.fromEntries(weeks.map(([m, x]) => [m, x.data]));
  const all = mealsBetween((m) => got[m], from, to);
  const monday = weekStart(today);
  const day = dayDiff(monday, today);
  const slots = all.filter((x) => x.date === today).map((x) => x.s);
  const recs = slots.map((s) => (s.recipeId ? loadRecipe(hub, s.recipeId) : { data: null }));
  if (recs.some((r) => r.loading)) return loading();
  const sys = hub.units();
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return el('section', { class: 'stack', 'aria-label': 'Cook today' }, [
    el('h1', { text: `Cooking today${slots.length ? '' : ' - nothing planned'}` }),
    slots.length ? null : dropTarget(el('p', { class: 'panel', 'data-field': 'cook-empty' }, ['Nothing is planned for today. Drag one of the meals below here, or ', el('a', { href: hub.href(), text: 'plan a meal' }), '.']),
      (dd) => applyMove(hub, dd, { key: monday, day, meal: dd.meal || 'dinner' })),
    ...slots.map((s, i) => {
      const rec = recs[i].data;
      const batch = slotBatch(s, rec);
      const ings = slotNeeds({ ...s, reserve: s.reserve.map((x) => ({ ...x, additions: [] })) }, rec);
      const steps = rec?.instructions ?? [];
      // Dropping another day's meal here swaps the two: it is cooked today, this one moves to its day.
      return dropTarget(el('article', { class: 'panel stack', 'data-field': `cook:${s.id}` }, [
        el('div', { class: 'card__label', text: MEAL_LABEL[s.meal] }),
        el('h2', { text: s.title, style: { margin: 0 } }),
        el('p', { class: 'small', text: `For ${prepared(s)} portion${prepared(s) === 1 ? '' : 's'}${ings.length ? ` - the recipe x${batch.m}` : ''}${reserved(s) ? `, ${reserved(s)} set aside for later` : ''}.` }),
        ings.length ? el('div', {}, [el('h3', { text: 'What goes in' }), el('ul', {}, ings.map((x) => el('li', { text: formatIngredient(inSystem(x, sys)) })))]) : null,
        steps.length ? el('div', {}, [el('h3', { text: 'Method' }), el('ol', { class: 'stack', style: { gap: '6px' } }, steps.map((t, n) => {
          const k = `${s.id}:${n}`;
          return el('li', {}, [el('label', { class: 'checkline' }, [
            el('input', { type: 'checkbox', checked: ui.cooked.has(k), on: { change: (e) => { if (e.target.checked) ui.cooked.add(k); else ui.cooked.delete(k); } } }),
            el('span', { text: t }),
          ])]);
        }))]) : el('p', { class: 'small muted', text: rec ? 'No method saved for this one.' : 'A meal typed into the plan - no recipe to follow.' }),
        el('a', { class: 'small', href: hub.href('slot', ref(monday, s.id)), text: 'The planned meal' }),
      ]), (dd) => applyMove(hub, dd, { key: monday, day, meal: s.meal }), { accepts: (dd) => dd.id !== s.id });
    }),
    // The meals of this shop, to swap with today's.
    el('aside', { class: 'panel stack shop-strip', 'aria-label': 'This shop’s meals' }, [
      el('div', {}, [
        el('h2', { text: `${inTrip ? 'This shop' : 'The next 7 days'}: ${fmtDay(from, today)} to ${fmtDay(to, today)}`, style: { margin: 0 } }),
        el('p', { class: 'small muted', style: { margin: 0 }, text: inTrip
          ? 'In the mood for something else? Drag a meal onto today’s and the two swap days (on a phone, press and hold first).'
          : 'Send the days you shop for from Meal Planner (To Shopping) and this shows exactly those. Drag a meal onto today’s to swap them.' }),
      ]),
      el('div', { class: 'shop-strip__days' }, [bought.length ? dropTarget(el('div', { class: 'shop-strip__day', 'data-field': 'strip:pool', title: 'Bought for, not on a day - cook them in any order' }, [
        el('strong', { class: 'small', text: 'Any day' }),
        ...bought.map((s) => mealChip(hub, POOL, s)),
      ]), (dd) => applyMove(hub, dd, { key: POOL, meal: dd.meal }), { accepts: (dd) => dd.key !== POOL }) : null, ...days.map((d) => {
        const m = weekStart(d);
        const i = dayDiff(m, d);
        return dropTarget(el('div', { class: `shop-strip__day${d === today ? ' is-today' : ''}`, 'data-field': `strip:${d}` }, [
          el('strong', { class: 'small', text: d === today ? 'Today' : `${WEEKDAYS[i]} ${Number(d.slice(8))}` }),
          ...all.filter((x) => x.date === d).map((x) => mealChip(hub, x.key, x.s)),
        ]), (dd) => applyMove(hub, dd, { key: m, day: i, meal: dd.meal || 'dinner' }));
      })]),
    ]),
  ]);
}

/** The days the last shop was for (D-056) - shopping need not start on a Monday. */
const TRIP = 'shop-trip';

/** "To Shopping": which days are you shopping for? Their meals go to the list, whatever weeks they fall in. */
function shopPanel(hub) {
  const today = hub.today();
  const st = ui.shopFor;
  const set = (patch) => { Object.assign(st, patch); hub.render(); };
  const to = addDays(st.from, st.days - 1);
  const starts = Array.from({ length: 24 }, (_, i) => addDays(today, i - 3));
  return el('div', { class: 'panel stack', 'data-field': 'shop-for' }, [
    el('h3', { text: 'Shopping for', style: { margin: 0 } }),
    el('div', { class: 'row' }, [
      el('label', { class: 'small', for: 'shop-from', text: 'From' }),
      el('select', { class: 'select', id: 'shop-from', style: { width: 'auto' }, 'data-field': 'shop-from', on: { change: (e) => set({ from: e.target.value }) } },
        starts.map((d) => el('option', { value: d, text: fmtDay(d, today), selected: d === st.from }))),
      el('label', { class: 'small', for: 'shop-days', text: 'for' }),
      el('select', { class: 'select', id: 'shop-days', style: { width: 'auto' }, 'data-field': 'shop-days', on: { change: (e) => set({ days: Number(e.target.value) }) } },
        Array.from({ length: 13 }, (_, i) => i + 2).map((n) => el('option', { value: String(n), text: `${n} days`, selected: n === st.days }))),
    ]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `${fmtDay(st.from, today)} to ${fmtDay(to, today)}. Cook today then shows these meals, so you can swap days with what you bought.` }),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Send', 'data-field': 'shop-send',
        on: {
          click: async () => {
            const got = Object.fromEntries(await Promise.all(mondaysBetween(st.from, to).map(async (m) => [m, await fetchPlan(hub, m)])));
            const list = mealsBetween((m) => got[m], st.from, to);
            if (!list.length) { hub.ui.notice('Nothing is planned on those days yet.'); return; }
            // A shop sent before meals remembered what they sent (D-059): its days count as sent.
            const last = await plans(hub).get(TRIP).catch(() => null);
            const slots = list.map((x) => (!x.s.sent && last && !last.marks && last.from <= x.date && x.date <= last.to ? { ...x.s, sent: sentAs(x.s) } : x.s));
            await saveRecord(hub, plans(hub), { id: TRIP, week: TRIP, from: st.from, to, at: new Date().toISOString(), marks: true, slots: [] });
            ui.shopFor = null;
            const marks = {};
            for (const x of list) (marks[x.key] ??= []).push(x.s.id);
            await sendPlanned(hub, slots, `${fmtDay(st.from, today)} to ${fmtDay(to, today)}`, `trip:${st.from}`, marks);
          },
        },
      }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Cancel', on: { click: () => { ui.shopFor = null; hub.render(); } } }),
    ]),
  ]);
}

/* ---------------------------------------------------------------- planning (D-053) */

// Plan: the planned meals only, by meal. Assign: those beside a calendar, to drag onto
// days. Calendar: the calendar alone, a week or a month at a time.
const VIEWS = [{ screen: null, label: 'Plan' }, { screen: 'assign', label: 'Assign' }, { screen: 'week', label: 'Calendar' }];
const GROUP_LABEL = { breakfast: 'Breakfasts', lunch: 'Lunches', dinner: 'Dinners', snack: 'Snacks' };

const loadPool = (hub) => loadPlan(hub, POOL);

/** A plan read straight from storage (not the screen cache) - for a move that changes two at once. */
async function fetchPlan(hub, key) {
  const own = await plans(hub).get(planId(key)).catch(() => null);
  if (key === POOL) return normalisePool(own ?? {});
  const old = own ? null : await legacyPlans(hub)?.get(planId(key)).catch(() => null);
  return normalisePlan(own ?? old ?? {}, key);
}

/** Drag a planned meal somewhere: save every plan the move changed. */
async function applyMove(hub, from, to) {
  const keys = [...new Set([from.key, to.key])];
  const loaded = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await fetchPlan(hub, k)])));
  const changed = moveMeal((k) => loaded[k], { from, to });
  for (const [k, plan] of Object.entries(changed)) await saveRecord(hub, plans(hub), { ...plan, id: planId(k), week: k });
  hub.invalidate('plan:');
}

/** What each Cookbook item is good for (its B, L, D, S flags), by id - empty until the Cookbook is read. */
const goodForOf = (hub) => {
  const l = loadSummaries(hub);
  return l.data ? new Map(l.data.map((x) => [x.id, goodFor(x.tags ?? [])])) : new Map();
};

/** The little B, L, D, S circles: which meals the item is good for, as set in the Cookbook. */
const flags = (meals) => (meals.length ? el('span', { class: 'flags', 'aria-label': `Good for ${meals.map((m) => MEAL_LABEL[m].toLowerCase()).join(', ')}` },
  meals.map((m) => el('span', { class: `flag flag--${m}`, text: MEAL_LABEL[m][0], title: `Good for ${MEAL_LABEL[m].toLowerCase()}` }))) : null);

/** A planned meal as something to drag: a link to open it, or drag it to another place. Its flags go with it. */
function mealChip(hub, key, s, { short = false } = {}) {
  const kind = MEAL_LABEL[s.meal] ?? 'Not sorted yet';
  const good = s.recipeId ? goodForOf(hub).get(s.recipeId) ?? [] : [];
  return draggable(el('a', {
    class: `meal-chip meal-chip--${s.meal || 'unsorted'}`, href: hub.href('slot', ref(key, s.id)), 'data-field': `chip:${s.id}`,
    title: `${kind}: ${s.title}${good.length ? ` (good for ${good.map((m) => MEAL_LABEL[m].toLowerCase()).join(', ')})` : ''} - drag to move, or open it`,
  }, [short ? el('span', { class: 'meal-chip__kind', text: kind[0] }) : null, el('span', { class: 'meal-chip__title', text: s.title }), short ? null : flags(good),
    s.sent ? el('span', { class: 'meal-chip__sent', text: '✓', title: 'Sent to Shopping', 'aria-label': 'sent to Shopping' }) : null]), { key, id: s.id, meal: s.meal });
}

/** One group of planned meals - gathered (not sorted) or a meal - that meals can be dragged into. */
function poolGroup(hub, pool, meal, { add = true } = {}) {
  const here = pool.slots.filter((s) => s.meal === meal);
  return dropTarget(el('div', { class: `pool-group pool-group--${meal || 'unsorted'}`, 'data-field': `pool:${meal || 'unsorted'}` }, [
    el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
      el('h3', { text: `${meal ? GROUP_LABEL[meal] : 'Not sorted yet'} (${here.length})`, style: { margin: 0 } }),
      add ? el('a', { class: 'btn btn-small', href: hub.href('choose', `${POOL}~0~${meal || 'any'}`), text: '+ Add', title: meal === 'snack' ? 'A snack from the Cookbook, or just type one - carrots, an apple' : meal ? `Add a ${MEAL_LABEL[meal].toLowerCase()}` : 'Add a meal - sort it later', 'data-field': `pool-add:${meal || 'any'}` }) : null,
    ]),
    here.length ? el('div', { class: 'chipset' }, here.map((s) => mealChip(hub, POOL, s))) : el('p', { class: 'small muted pool-group__empty', text: 'Drag meals here' }),
  ]), (d) => applyMove(hub, d, { key: POOL, meal }), { accepts: (d) => d.key !== POOL || d.meal !== meal });
}

/** Beside the calendar: every planned meal, by meal, to drag onto days - or back here. */
function poolPanel(hub, pool) {
  const unsorted = pool.slots.some((s) => !s.meal);
  return el('div', { class: 'panel stack pool', 'aria-label': 'Planned meals' }, [
    el('h2', { text: 'Planned meals', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Drag a meal onto a day (on a phone, press and hold first). Drag one back here to take it off its day.' }),
    unsorted ? poolGroup(hub, pool, '', { add: false }) : null,
    ...MEALS.map((meal) => poolGroup(hub, pool, meal, { add: false })),
  ]);
}

/** Plan, in three steps: gather the meals, sort them into breakfast, lunch, dinner or snacks, then assign them to days. */
function planScreen(hub) {
  const pool = loadPool(hub);
  if (pool.loading) return loading();
  if (pool.error) return failure(pool.error);
  const n = pool.data.slots.length;
  const sorted = pool.data.slots.filter((s) => s.meal).length;
  const step = (num, title, hint) => el('div', { class: 'row step-head' }, [el('span', { class: 'step-num', text: String(num) }), el('div', {}, [el('h2', { text: title, style: { margin: 0 } }), el('p', { class: 'small muted', style: { margin: 0 }, text: hint })])]);
  return el('section', { class: 'stack', 'aria-label': 'Plan the meals' }, [
    tabs(hub, VIEWS, null),
    el('div', { class: 'panel stack' }, [
      step(1, 'Gather meals', 'What are we in the mood for? Add meals or get suggestions - no need to decide which meal or which day yet.'),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn btn-primary', href: hub.href('choose', `${POOL}~0~any`), text: '+ Add', title: 'Add a meal from the Cookbook, or type one', 'data-field': 'pool-add:any' }),
        el('a', { class: 'btn', href: hub.href('mix'), text: 'Suggest meals', title: 'A mix of family favourites and new ones to try, from the Cookbook', 'data-field': 'plan-my-week' }),
        // Shop for them now (D-060): no need to sort them or put them on days - cook them in any order.
        n && hub.data.installed('shopping') ? el('button', {
          class: 'btn', type: 'button', text: 'To Shopping', 'data-field': 'pool-shop',
          title: 'Send what all the planned meals need to the shopping list now - sorting and days can wait, or never happen',
          on: { click: () => sendPlanned(hub, pool.data.slots, 'Planned meals', 'pool', { [POOL]: pool.data.slots.map((s) => s.id) }) },
        }) : null,
      ]),
      poolGroup(hub, pool.data, '', { add: false }),
    ]),
    el('div', { class: 'panel stack' }, [
      step(2, 'Sort them', 'Drag each meal into breakfast, lunch, dinner or snacks (on a phone, press and hold first). Or open a meal and choose.'),
      el('div', { class: 'pool-sort' }, MEALS.map((meal) => poolGroup(hub, pool.data, meal))),
    ]),
    el('div', { class: 'panel stack' }, [
      step(3, 'Assign them to days', n ? `${sorted} of ${n} sorted. Next, drag them onto the calendar - or skip this: send them to Shopping and cook them in any order.` : 'Once meals are gathered and sorted, put them on the calendar.'),
      el('div', {}, [el('a', { class: `btn${sorted ? ' btn-primary' : ''}`, href: hub.href('assign'), text: 'Assign', title: 'Put the planned meals on days', 'data-field': 'go-assign' })]),
    ]),
  ]);
}

/** The weeks a calendar view shows, and how to step it. */
function calRange(view, anchor) {
  if (view === 'month') {
    const first = `${anchor.slice(0, 7)}-01`;
    const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1);
    const mondays = [];
    for (let m = weekStart(first); m <= last; m = addDays(m, 7)) mondays.push(m);
    return { mondays, first, last, title: new Date(`${first}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), prev: addDays(first, -1).slice(0, 7) + '-01', next: addDays(last, 1) };
  }
  const monday = weekStart(anchor);
  return { mondays: [monday], first: monday, last: addDays(monday, 6), title: `Week of ${new Date(`${monday}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`, prev: addDays(monday, -7), next: addDays(monday, 7) };
}

/** The calendar: a week (a row per meal) or a month (a box per day). Meals can be dragged between days, and onto it from the list. */
function calendar(hub, param) {
  const today = hub.today();
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) ui.calAnchor = param;
  const anchor = ui.calAnchor ?? today;
  const view = ui.calView ?? 'week';
  const r = calRange(view, anchor);
  const loaded = [addDays(r.mondays[0], -7), ...r.mondays].map((m) => [m, loadPlan(hub, m)]);
  if (loaded.some(([, x]) => x.loading)) return loading();
  const err = loaded.find(([, x]) => x.error);
  if (err) return failure(err[1].error);
  const plan = Object.fromEntries(loaded.map(([m, x]) => [m, x.data]));
  const go = (a, v = view) => { ui.calAnchor = a; ui.calView = v; hub.render(); };
  const all = r.mondays.flatMap((m) => plan[m].slots.map((s) => ({ m, s })));
  const later = leftoverMeals(loaded.map(([, x]) => x.data), r.mondays[0]);

  const head = el('div', { class: 'row cal-head' }, [
    el('button', { class: 'btn btn-small', type: 'button', 'aria-label': view === 'month' ? 'Previous month' : 'Previous week', text: '‹', 'data-field': 'cal-prev', on: { click: () => go(r.prev) } }),
    el('strong', { text: r.title, style: { flex: '1 1 auto', textAlign: 'center' } }),
    el('button', { class: 'btn btn-small', type: 'button', 'aria-label': view === 'month' ? 'Next month' : 'Next week', text: '›', 'data-field': 'cal-next', on: { click: () => go(r.next) } }),
  ]);
  const switcher = el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Show' }, [['week', 'Week'], ['month', 'Month']].map(([v, t]) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(view === v), text: t, 'data-field': `cal-view:${v}`, on: { click: () => go(anchor, v) } }))),
    view === 'week' ? el('label', { class: 'checkline small' }, [
      el('input', { type: 'checkbox', checked: ui.showAllMeals, on: { change: (e) => { ui.showAllMeals = e.target.checked; hub.render(); } } }), 'Breakfast, lunch, snacks',
    ]) : el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Today', on: { click: () => go(today) } }),
  ]);

  let body;
  if (view === 'week') {
    const monday = r.mondays[0];
    const p = plan[monday];
    const meals = ui.showAllMeals ? MEALS : ['dinner'];
    const shown = MEALS.filter((meal) => meals.includes(meal) || p.slots.some((s) => s.meal === meal) || later.some((l) => l.meal === meal));
    body = el('div', { class: 'panel' }, [el('ul', { class: 'list cal-week' }, weekDays(monday).map((d, i) => el('li', { style: { alignItems: 'flex-start' }, class: d === today ? 'cal-today' : null }, [
      el('div', { style: { minWidth: '64px' } }, [el('strong', { text: WEEKDAYS[i] }), el('div', { class: 'small muted', text: d === today ? 'today' : d.slice(5).replace('-', '/') })]),
      el('div', { class: 'list__main stack', style: { gap: '4px' } }, shown.map((meal) => {
        const here = p.slots.filter((s) => s.day === i && s.meal === meal);
        const lo = later.filter((l) => l.day === i && l.meal === meal);
        return dropTarget(el('div', { class: 'cal-cell', 'data-field': `cell:${i}:${meal}` }, [
          shown.length > 1 ? el('span', { class: 'small muted cal-cell__kind', text: MEAL_LABEL[meal] }) : null,
          ...here.map((s) => mealChip(hub, monday, s)),
          ...lo.map((l) => el('a', { class: 'small', href: hub.href('slot', ref(l.from.week, l.from.slotId)), 'data-field': `leftover:${i}:${meal}` }, [el('span', { class: 'badge', text: 'Leftovers' }), ` ${l.title}`])),
          !here.length || meal === 'snack' ? el('a', { class: 'cal-add', href: hub.href('choose', `${monday}~${i}~${meal}`), text: '+', title: `Plan ${MEAL_LABEL[meal].toLowerCase()} for ${WEEKDAYS[i]}`, 'aria-label': `Plan ${MEAL_LABEL[meal].toLowerCase()} for ${WEEKDAYS[i]}`, 'data-field': `slot:${i}:${meal}` }) : null,
        // A meal keeps its own (a lunch stays lunch) when its row is not showing - with only
        // dinners showing, the day is the target. When its row is there, the row dropped on decides.
        ]), (dd) => applyMove(hub, dd, { key: monday, day: i, meal: dd.meal && !shown.includes(dd.meal) ? dd.meal : meal }));
      })),
    ])))]);
  } else {
    // A box per day; a meal dropped on a day keeps its own meal (a dinner stays dinner).
    const days = [];
    for (let d = r.mondays[0]; d <= addDays(r.mondays.at(-1), 6); d = addDays(d, 1)) days.push(d);
    body = el('div', { class: 'panel cal-month', role: 'grid' }, [
      ...WEEKDAYS.map((w) => el('div', { class: 'cal-month__head small muted', text: w })),
      ...days.map((d) => {
        const m = weekStart(d);
        const i = dayDiff(m, d);
        const here = plan[m].slots.filter((s) => s.day === i).sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
        return dropTarget(el('div', { class: `cal-day${d.slice(0, 7) === r.first.slice(0, 7) ? '' : ' cal-day--other'}${d === today ? ' cal-today' : ''}`, 'data-field': `day:${d}` }, [
          el('div', { class: 'small cal-day__num', text: String(Number(d.slice(8))) }),
          ...here.map((s) => mealChip(hub, m, s, { short: true })),
        ]), (dd) => applyMove(hub, dd, { key: m, day: i, meal: dd.meal || 'dinner' }));
      }),
    ]);
  }

  const monday = r.mondays[0];
  return el('div', { class: 'stack' }, [
    head, switcher, body,
    el('div', { class: 'row' }, [
      view === 'week' && plan[monday].slots.length ? el('a', { class: 'btn', href: hub.href('review', monday), text: 'Overview', title: 'How the week looks', 'data-field': 'review-week' }) : null,
      view === 'week' && !plan[monday].slots.length && plan[addDays(monday, -7)].slots.length ? el('button', { class: 'btn', type: 'button', text: 'Repeat week', title: 'Copy last week’s plan', on: { click: () => savePlan(hub, monday, copyPlan(plan[addDays(monday, -7)], monday)) } }) : null,
      hub.data.installed('shopping') ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'To Shopping', title: 'Choose the days you are shopping for, and send what their meals need to the shopping list', 'data-field': 'make-list',
        on: { click: () => { ui.shopFor = ui.shopFor ? null : { from: r.first < today ? today : r.first, days: 7 }; hub.render(); } },
      }) : null,
    ]),
    ui.shopFor ? shopPanel(hub) : null,
  ]);
}

/** Assign: the planned meals on the left, the calendar on the right - drag them onto days. */
function assignScreen(hub, param) {
  const pool = loadPool(hub);
  if (pool.loading) return loading();
  if (pool.error) return failure(pool.error);
  return el('section', { class: 'stack', 'aria-label': 'Assign planned meals' }, [
    tabs(hub, VIEWS, 'assign'),
    el('div', { class: 'planner-split' }, [poolPanel(hub, pool.data), calendar(hub, param)]),
  ]);
}

/** Calendar: everything planned, a week or a month at a time. Open a meal to see it, change it or rate it. */
function weekScreen(hub, param) {
  return el('section', { class: 'stack', 'aria-label': 'Meal calendar' }, [
    tabs(hub, VIEWS, 'week'),
    calendar(hub, param),
    el('p', { class: 'small muted', text: 'Drag a meal to another day to swap them. Open a meal to change it, or say how it went and rate it. Leftovers are cooked with the meal they come from, so they are only bought once.' }),
  ]);
}

/**
 * Shopping owns the list: what these meals still need (leftovers counted once, with each
 * meal's own changes, less what each sent before - D-059) goes over in the link. Once
 * added, Shopping comes back here to note what each meal went as (`marks`: week -> ids).
 */
async function sendPlanned(hub, slots, from, source, marks) {
  const b = book(hub);
  const byId = new Map();
  for (const s of slots) {
    if (b && s.recipeId && !byId.has(s.recipeId)) {
      const r = await b.get(s.recipeId);
      if (r) byId.set(s.recipeId, normaliseRecipe(r));
    }
  }
  // Our own items inside them (home-made mayo) are bought as their own ingredients.
  if (b) for (const s of slots) await collectRecipes(s.ingredients ?? byId.get(s.recipeId)?.ingredients ?? [], (id) => b.get(id), byId);
  const need = stillToBuy(slots, byId);
  if (!need.items.length && !need.own.length) {
    await markSent(hub, marks);
    hub.ui.notice('Everything these meals need was sent before - nothing new to add.');
    return;
  }
  hub.open(sendHref({ source, from, group: 'food', more: true, then: `#/mealplan/sent/${encodeURIComponent(JSON.stringify({ ...marks, at: Date.now() }))}`, ...need }));
}

/** Note on each meal what it went to Shopping as, so it is not asked for again. */
async function markSent(hub, marks) {
  for (const [key, ids] of Object.entries(marks && typeof marks === 'object' ? marks : {})) {
    if ((!isDate(key) && key !== POOL) || !Array.isArray(ids)) continue;
    const plan = await fetchPlan(hub, key);
    await saveRecord(hub, plans(hub), { ...plan, id: planId(key), week: key, slots: plan.slots.map((s) => (ids.includes(s.id) ? { ...s, sent: sentAs(s) } : s)) });
  }
  hub.invalidate('plan:');
}

/** Back from Shopping after Add: note what went, then on to the list. Coming back here again only says so. */
const marked = new Set();
function sentScreen(hub, param) {
  if (!marked.has(param)) {
    marked.add(param);
    let marks = {};
    try { marks = JSON.parse(param); } catch { /* an incomplete link notes nothing */ }
    markSent(hub, marks).then(() => hub.open('#/shopping'));
    return loading();
  }
  return el('div', { class: 'panel stack' }, [
    el('p', { text: 'These meals are noted as sent to Shopping.' }),
    el('div', { class: 'row' }, [el('a', { class: 'btn', href: '#/shopping', text: 'Shopping list' }), el('a', { class: 'btn', href: hub.href('week'), text: 'Calendar' })]),
  ]);
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
  const pool = monday === POOL;
  if ((!pool && !isDate(monday)) || !(day >= 0 && day <= 6) || !(MEALS.includes(meal) || (pool && meal === 'any'))) return el('p', { class: 'panel', text: 'That planner link is incomplete.' });
  const kind = meal === 'any' ? '' : meal;
  const p = loadPlan(hub, monday);
  const list = loadSummaries(hub);
  const f = loadFood(hub);
  if (p.loading || list.loading) return loading('Opening your meals…');
  if (p.error || list.error) return failure(p.error ?? list.error);
  const today = hub.today();
  const date = dateOf(monday, day);
  const current = pool || meal === 'snack' ? null : slotAt(p.data, day, meal);
  const people = hub.foodProfiles();
  const back = pool ? hub.href() : hub.href('week', monday);
  const set = (patch) => { ui.filters = { ...ui.filters, ...patch }; hub.render(); };
  const q = ui.q.trim().toLowerCase();
  const results = list.data.filter((s) => (!q || `${s.title} ${(s.ingredientNames ?? []).join(' ')}`.toLowerCase().includes(q)) && passes(s, ui.filters, { people }));
  const active = describeFilters(ui.filters, people);
  const pickState = ui.pick?.for === `${monday}~${day}~${meal}` ? ui.pick : null;

  if (pickState) return configureScreen(hub, { monday, day, meal, date, summary: pickState.summary, current, back });

  return el('section', { class: 'stack', 'aria-label': 'Choose a meal' }, [
    el('a', { href: back, class: 'small', text: '‹ Back' }),
    el('h1', { text: pool ? (kind ? `Plan a ${MEAL_LABEL[kind].toLowerCase()}` : 'Add a meal') : `${label(date, meal, today)}${current ? ` - instead of ${current.title}` : ''}` }),
    el('div', { class: 'row' }, [
      el('input', { class: 'input', type: 'search', value: ui.q, placeholder: 'Search by name or ingredient', 'aria-label': 'Search meals', 'data-field': 'choose-search', style: { flex: '1 1 220px' }, on: { change: (e) => { ui.q = e.target.value; hub.render(); } } }),
      current ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', 'data-field': 'remove-slot', on: { click: async () => { if (await confirmAction({ title: `Remove ${current.title} from ${label(date, meal, today)}?`, text: 'The saved meal stays in the Cookbook. Leftovers set aside from it are cancelled.', confirmLabel: 'Remove' })) { await savePlan(hub, monday, setSlot(p.data, day, meal, null)); hub.open(back); } } } }) : null,
    ]),
    filterPanel(ui.filters, set, people),
    active.length ? el('div', { class: 'chipset', 'aria-label': 'Active filters' }, [
      ...active.map(([text, undo]) => el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: `${text} ×`, 'aria-label': `Remove filter: ${text}`, on: { click: () => set(undo) } })),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Clear all', 'data-field': 'clear-filters', on: { click: () => { ui.filters = emptyFilters(); ui.q = ''; hub.render(); } } }),
    ]) : null,
    el('p', { class: 'small muted', text: `${results.length} of ${list.data.length} meal${list.data.length === 1 ? '' : 's'}` }),
    results.length ? el('ul', { class: 'list panel' }, results.slice(0, 60).map((s) => resultRow(hub, s, people, () => { ui.pick = { for: `${monday}~${day}~${meal}`, summary: s }; hub.render(); }, back))) : el('div', { class: 'panel' }, [
      el('p', { text: list.data.length ? 'No meal matches every filter you chose.' : 'No meals saved yet - add some in the Cookbook, or type a meal below.' }),
      active.length ? el('p', { class: 'small', text: `Try removing one: ${active.map(([t]) => t).join(', ')}.` }) : null,
    ]),
    ui.compare.length >= 2 && f.data ? compareLoaded(hub, f.data) : null,
    el('form', {
      class: 'row panel', on: {
        submit: async (e) => {
          e.preventDefault();
          const title = e.target.elements.free.value.trim();
          if (!title) return;
          const slot = { recipeId: null, title, servings: current?.servings ?? (meal === 'snack' ? 1 : 4) };
          await savePlan(hub, monday, pool ? addToPool(p.data, { ...slot, meal: kind }) : meal === 'snack' ? addSlot(p.data, day, meal, slot) : setSlot(p.data, day, meal, slot));
          hub.open(back);
        },
      },
    }, [
      el('input', { class: 'input', name: 'free', placeholder: meal === 'snack' ? 'Or just type a snack, e.g. "Carrots" or "An apple"' : 'Or just type a meal, e.g. "Takeaway" or "Leftover soup"', 'aria-label': 'A meal not in the Cookbook', style: { flex: '1 1 220px' } }),
      el('button', { class: 'btn', type: 'submit', text: 'Use this' }),
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
  const pool = monday === POOL;
  const st = (ui.config?.for === key ? ui.config : (ui.config = { for: key, servings: current?.servings ?? summary.servings ?? 4, mode: 'none', portions: 2, target: date ? defaultTarget(date) : '', meal }));
  const today = hub.today();
  return el('section', { class: 'stack' }, [
    el('button', { class: 'linkish small', type: 'button', text: '‹ Back', title: 'Back to the list', style: { alignSelf: 'flex-start' }, on: { click: () => { ui.pick = null; hub.render(); } } }),
    el('h1', { text: pool ? `Add ${summary.title}` : `${summary.title} for ${label(date, meal, today)}` }),
    el('div', { class: 'panel' }, [pool
      ? el('div', { class: 'row' }, [
        el('label', { class: 'small', for: 'lo-serv', text: 'Eating at this meal' }),
        el('input', { class: 'input', id: 'lo-serv', type: 'number', min: '1', max: '40', value: String(st.servings), style: { width: '5em' }, 'data-field': 'servings', on: { change: (e) => { ui.config.servings = Math.max(1, Number(e.target.value) || 1); } } }),
        el('span', { class: 'small muted', text: 'Leftovers can be set aside once it is on a day.' }),
      ])
      : leftoverControls(st, date, (patch) => { Object.assign(ui.config, patch); hub.render(); }, today)]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Plan it', 'data-field': 'plan-save',
        on: {
          click: async () => {
            const plan = await fetchPlan(hub, monday);
            const slot = { recipeId: summary.id, title: summary.title, ...(pool ? { servings: st.servings } : slotFromState(st)), ingredients: null, note: '', feedback: null };
            await savePlan(hub, monday, pool ? addToPool(plan, { ...slot, meal: meal === 'any' ? '' : meal }) : meal === 'snack' ? addSlot(plan, day, meal, slot) : setSlot(plan, day, meal, slot));
            ui.pick = null; ui.config = null;
            hub.ui.notice(pool ? `${summary.title} is in the planned meals.` : `${summary.title} is planned for ${label(date, meal, today)}.`);
            hub.open(back);
          },
        },
      }),
      el('a', { class: 'btn', href: mealHref(summary.id, hub.href('choose', key)), text: 'Recipe' }),
    ]),
  ]);
}

/** Planning arrives from the Cookbook ("Plan it"): pick the day and meal, servings and leftovers. */
function addScreen(hub, id, serves) {
  const r = id ? loadRecipe(hub, id) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('p', { class: 'panel', text: 'That meal was not found in the Cookbook.' });
  const rec = r.data;
  const today = hub.today();
  const st = (ui.adding?.for === id ? ui.adding : (ui.adding = { for: id, date: '', meal: 'dinner', servings: Number(serves) || rec.servings, mode: 'none', portions: 2, target: defaultTarget(today) }));
  const set = (patch) => { Object.assign(ui.adding, patch); hub.render(); };
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  return el('section', { class: 'stack' }, [
    el('h1', { text: `Plan ${rec.title}` }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'row' }, [
        el('label', { class: 'small', for: 'plan-day', text: 'Day' }),
        el('select', { class: 'select', id: 'plan-day', 'data-field': 'plan-day', style: { width: 'auto' }, on: { change: (e) => set({ date: e.target.value, target: e.target.value ? defaultTarget(e.target.value) : '' }) } },
          [el('option', { value: '', text: 'No day yet - the planned meals', selected: !st.date }), ...days.map((d) => el('option', { value: d, text: fmtDay(d, today), selected: d === st.date }))]),
        el('label', { class: 'small', for: 'plan-meal', text: 'Meal' }),
        el('select', { class: 'select', id: 'plan-meal', 'data-field': 'plan-meal', style: { width: 'auto' }, on: { change: (e) => set({ meal: e.target.value }) } }, MEALS.map((m) => el('option', { value: m, text: MEAL_LABEL[m], selected: m === st.meal }))),
      ]),
      st.date ? leftoverControls(st, st.date, set, today) : null,
    ]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Plan it', 'data-field': 'plan-save',
        on: {
          click: async () => {
            const slot = { recipeId: rec.id, title: rec.title, ingredients: null, note: '', feedback: null };
            if (!st.date) {
              if (await savePlan(hub, POOL, addToPool(await fetchPlan(hub, POOL), { ...slot, servings: st.servings, meal: st.meal }))) { ui.adding = null; hub.ui.notice(`${rec.title} is in the planned meals.`); hub.go(); }
              return;
            }
            const monday = weekStart(st.date);
            const plan = await fetchPlan(hub, monday);
            const day = dayDiff(monday, st.date);
            const fields = { ...slot, ...slotFromState(st) };
            if (await savePlan(hub, monday, st.meal === 'snack' ? addSlot(plan, day, st.meal, fields) : setSlot(plan, day, st.meal, fields))) {
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
  const back = monday === POOL ? hub.href() : hub.href('week', monday);
  if (!slot) return el('div', { class: 'panel' }, [el('p', { text: 'That planned meal is no longer in the plan.' }), el('a', { class: 'btn', href: back, text: 'Back' })]);
  const r = slot.recipeId ? loadRecipe(hub, slot.recipeId) : { data: null };
  const f = loadFood(hub);
  const list = loadSummaries(hub);
  // The family's own sizes of foods, kept by the Cookbook.
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
    el('a', { href: back, class: 'small', text: '‹ Back' }),
    el('div', { class: 'row' }, [
      el('h1', { text: slot.title, style: { margin: 0 } }),
      el('span', { class: 'badge', text: label(date, slot.meal, today) }),
      changed ? el('span', { class: 'badge badge--demo', text: 'Changed this time' }) : null,
    ]),
    monday === POOL ? el('div', { class: 'row' }, [
      el('label', { class: 'small', for: 'sl-kind', text: 'Meal' }),
      el('select', { class: 'select', id: 'sl-kind', style: { width: 'auto' }, 'data-field': 'slot-kind', on: { change: (e) => update({ meal: e.target.value }) } },
        [['', 'not sorted yet'], ...MEALS.map((x) => [x, MEAL_LABEL[x]])].map(([v, t]) => el('option', { value: v, text: t, selected: slot.meal === v }))),
    ]) : null,
    rec ? el('p', { class: 'small' }, ['From ', el('a', { href: mealHref(rec.id, here), text: rec.title }), ` · ${!rec.tried ? 'not tried yet' : rec.rating == null ? 'tried, not rated' : `family rating ${rec.rating}/10`}. Changes here are for this meal only.`])
      : el('p', { class: 'small muted', text: 'A meal typed into the plan - not saved in the Cookbook.' }),
    // Good for: the flags it carries around the planner - set in the Cookbook, often after cooking it.
    rec ? el('div', { class: 'row', 'data-field': 'slot-goodfor' }, [
      el('span', { class: 'small', text: 'Good for' }),
      flags(goodFor(rec.tags)) ?? el('span', { class: 'small muted', text: 'not said yet' }),
      el('a', { class: 'btn btn-small', href: `#/meals/goodfor/${encodeURIComponent(rec.id)}/${encodeURIComponent(JSON.stringify({ back: here, had: slot.meal || null }))}`, text: 'Change', title: 'Say which meals it is good for - breakfast, lunch, dinner, snack', 'data-field': 'goodfor-change' }),
    ]) : null,

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
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Cancel leftovers', on: { click: async () => { await savePlan(hub, monday, setReservation(p.data, slot.id, res.id, { portions: 0 })); } } }),
      ]))) : null,
      !date ? el('p', { class: 'small muted', text: 'Leftovers can be set aside once this meal is on a day.' }) : el('div', { class: 'row' }, [
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
          ingredientEditor({ rows: ui.slotDraft.rows, db: f.data ?? null, own: list.data ?? [], selfId: rec?.id ?? null, sizes: ourSizes.data ?? new Map(), system: sys }),
          el('div', { class: 'row' }, [
            el('button', { class: 'btn btn-small', type: 'button', text: 'This meal', title: 'Save the changes for this planned meal only', 'data-field': 'slot-ing-save', on: { click: async () => { await update({ ingredients: ui.slotDraft.rows.filter((x) => x.name.trim()), basis }); ui.slotDraft = null; } } }),
            changed && rec ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Reset', title: 'Go back to the recipe’s ingredients', on: { click: async () => { await update({ ingredients: null }); ui.slotDraft = null; } } }) : null,
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
          el('a', { class: 'btn btn-small', href: `#/meals/edit/${encodeURIComponent(rec.id)}/${encodeURIComponent(`update:${JSON.stringify({ servings: basis, ingredients: slot.ingredients })}`)}`, text: 'Replace recipe', title: 'Change the saved recipe too', 'data-field': 'update-original' }),
          el('a', { class: 'btn btn-small', href: `#/meals/new/${encodeURIComponent(`variant:${JSON.stringify({ title: `${rec.title} (our version)`, servings: basis, ingredients: slot.ingredients, variantOf: rec.id, type: rec.type, notes: slot.note, instructions: rec.instructions, tags: rec.tags, prepMinutes: rec.prepMinutes, cookMinutes: rec.cookMinutes, allergens: rec.allergens, description: rec.description })}`)}`, text: 'New recipe', 'data-field': 'save-variant' }),
        ]),
      ]) : null,
      hub.data.installed('assistant') && ingredients.length ? el('a', { class: 'btn btn-small', href: `#/assistant/meal/slot:${encodeURIComponent(ref(monday, slot.id))}`, text: 'Improve', title: 'Ideas from the Meal Assistant', 'data-field': 'improve-slot', style: { alignSelf: 'flex-start' } }) : null,
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
        Object.keys(slot.portions).length ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Back', title: 'Back to the portion guide', on: { click: () => update({ portions: {} }) } }) : null,
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
      el('p', { class: 'small muted', text: 'This rating is for this meal only - the family rating of the recipe is set in the Cookbook.' }),
      rec ? el('div', { class: 'row' }, [
        el('a', { class: 'btn btn-small', href: mealHref(rec.id, here), text: 'Rate it', title: 'Rate the recipe, and say who likes it', 'data-field': 'rate-recipe' }),
        slot.note ? el('a', { class: 'btn btn-small btn-quiet', href: `#/meals/note/${encodeURIComponent(rec.id)}/${encodeURIComponent(JSON.stringify({ text: slot.note, occasion: label(date, slot.meal, today), back: here }))}`, text: 'Save note', title: 'Add this note to the recipe', 'data-field': 'promote-note' }) : null,
      ]) : null,
    ]),
    el('div', { class: 'row' }, [
      monday === POOL || slot.meal === 'snack' ? null : el('a', { class: 'btn', href: hub.href('choose', `${monday}~${slot.day}~${slot.meal}`), text: 'Swap meal', title: 'Replace with another meal' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', title: monday === POOL ? 'Take it off the planned meals' : 'Take it off this day - the saved meal stays in the Cookbook', 'data-field': 'slot-remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove ${slot.title}?`, text: monday === POOL ? 'It comes off the planned meals. The saved meal stays in the Cookbook.' : 'It comes off this day. The saved meal stays in the Cookbook, and leftovers set aside from it are cancelled.', confirmLabel: 'Remove' })) return;
        await savePlan(hub, monday, { ...p.data, slots: p.data.slots.filter((x) => x.id !== slot.id) });
        hub.open(back);
      } } }),
    ]),
  ]);
}

/* ---------------------------------------------------------------- Plan my week */

/** Suggest meals: a mix of favourites and new ones into the planned meals - days come later, on Assign. */
function mixScreen(hub) {
  const today = hub.today();
  const monday = weekStart(today);
  const pool = loadPool(hub);
  const list = loadSummaries(hub);
  const w0 = loadPlan(hub, monday);
  const w1 = loadPlan(hub, addDays(monday, -7));
  const w2 = loadPlan(hub, addDays(monday, -14));
  if ([pool, list, w0, w1, w2].some((x) => x.loading)) return loading('Looking through your meals…');
  if (pool.error || list.error) return failure(pool.error ?? list.error);
  const people = hub.foodProfiles();
  const m = ui.mix;
  const total = Object.keys(MIX).reduce((n, k) => n + (m[k] ?? 0), 0);
  const slots = Array.from({ length: total }, () => ({ day: null, meal: m.meal }));
  const recent = new Set([...w0.data.slots, ...w1.data.slots, ...w2.data.slots].map((s) => s.recipeId).filter(Boolean));
  const meals = list.data.filter((s) => !ui.rejected.includes(s.id) && !pool.data.slots.some((x) => x.recipeId === s.id && x.meal === m.meal));
  const proposal = ui.proposal?.meal === m.meal ? ui.proposal : null;
  const suggest = (from) => { ui.proposal = { meal: m.meal, ...proposeWeek({ meals: from, counts: m, slots, recent, people, seed: `${today}${m.meal}${ui.rejected.length}` }), accept: {} }; hub.render(); };
  const number = (key) => el('label', { class: 'row small', style: { gap: '6px' } }, [
    el('input', { class: 'input', type: 'number', min: '0', max: '14', value: String(m[key]), style: { width: '4.5em' }, 'data-field': `mix-${key}`, on: { change: (e) => { ui.mix = { ...m, [key]: Math.max(0, Math.min(14, Number(e.target.value) || 0)) }; ui.proposal = null; hub.render(); } } }), MIX[key],
  ]);
  return el('section', { class: 'stack', 'aria-label': 'Suggest meals' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Back' }),
    el('h1', { text: 'Suggest meals' }),
    el('p', { class: 'muted', text: 'A mix of meals the family already enjoys and new ones to try, from your own Cookbook. They go into the planned meals; the days come later.' }),
    el('div', { class: 'panel stack' }, [
      el('label', { class: 'row small', style: { gap: '6px' } }, ['For', el('select', { class: 'select', style: { width: 'auto' }, 'data-field': 'mix-meal', on: { change: (e) => { ui.mix = { ...m, meal: e.target.value }; ui.proposal = null; hub.render(); } } }, [['', 'any meal - sort later'], ...MEALS.map((x) => [x, MEAL_LABEL[x].toLowerCase()])].map(([v, t]) => el('option', { value: v, text: t, selected: v === m.meal }))), `- ${total} meal${total === 1 ? '' : 's'}`]),
      ...Object.keys(MIX).map(number),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Suggest', 'data-field': 'mix-go', disabled: !total, style: { alignSelf: 'flex-start' }, on: { click: () => suggest(meals) } }),
    ]),
    proposal ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Suggested', style: { margin: 0 } }),
      proposal.picks.length ? el('ul', { class: 'list' }, proposal.picks.map((x) => el('li', {}, [
        el('label', { class: 'checkline list__main' }, [
          el('input', { type: 'checkbox', checked: proposal.accept[x.id] !== false, 'data-field': `mix-accept:${x.id}`, on: { change: (e) => { proposal.accept[x.id] = e.target.checked; } } }),
          el('span', {}, [el('strong', { text: x.title }), el('div', { class: 'small muted', text: [MIX[x.group], x.reason].filter(Boolean).join(' - ') })]),
        ]),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Something else', on: { click: () => { ui.rejected.push(x.id); suggest(meals.filter((y) => y.id !== x.id)); } } }),
      ]))) : el('p', { text: 'No meals could be suggested.' }),
      proposal.shortfall.length ? el('div', { class: 'small' }, [
        el('p', { text: 'Not enough meals for everything you asked:' }),
        el('ul', {}, proposal.shortfall.map((x) => el('li', { text: `${MIX[x.group]}: ${x.found} of ${x.wanted}. ${{ family: 'Rate meals you have tried in the Cookbook so favourites can be found.', individual: 'Mark people’s favourites on a meal’s page.', untried: 'Add some new recipes to try.', other: 'Plan or rate more of the meals you have had.' }[x.group]}` }))),
        el('p', { class: 'muted', text: 'Nothing is made up to fill the gaps - add the rest yourself with "+ Add".' }),
      ]) : null,
      proposal.picks.length ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Add ticked', title: 'Put the ticked meals in the planned meals', 'data-field': 'mix-apply', style: { alignSelf: 'flex-start' },
        on: {
          click: async () => {
            let next = await fetchPlan(hub, POOL);
            for (const x of proposal.picks.filter((y) => proposal.accept[y.id] !== false)) {
              const sum = list.data.find((y) => y.id === x.id);
              next = addToPool(next, { recipeId: x.id, title: x.title, servings: sum?.servings ?? 4, meal: m.meal });
            }
            await savePlan(hub, POOL, next);
            ui.proposal = null; ui.rejected = [];
            hub.ui.notice(m.meal ? 'Added to the planned meals. Press Assign to put them on days.' : 'Added. Next, sort them into breakfast, lunch, dinner or snacks.');
            hub.go();
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
    class: 'btn btn-small btn-quiet', type: 'button', text: `Find ${GROUP[gap].toLowerCase()}`, title: 'Find meals with these',
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
        class: 'btn btn-primary', type: 'button', text: 'Optimise week', 'data-field': 'optimise', style: { alignSelf: 'flex-start' },
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
        class: 'btn btn-primary', type: 'button', text: 'Apply ticked', 'data-field': 'opt-apply', style: { alignSelf: 'flex-start' },
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
  if (!slot || !idea) return el('div', { class: 'panel' }, [el('p', { text: 'That change could not be applied - the planned meal or the idea is missing.' }), el('a', { class: 'btn', href: hub.href('week', monday), text: 'Back', title: 'Back to the week' })]);
  const r = slot.recipeId ? loadRecipe(hub, slot.recipeId) : { data: null };
  if (r.loading) return loading();
  const rec = r.data;
  const ings = slot.ingredients ?? rec?.ingredients ?? [];
  const basis = slot.ingredients ? slot.basis : rec?.servings ?? slot.servings;
  const add = idea.add ? GUIDE.find((g) => g.id === idea.add) : null;
  const swapFrom = idea.swap ? GUIDE.find((g) => g.id === idea.swap[0]) : null;
  const swapTo = idea.swap ? GUIDE.find((g) => g.id === idea.swap[1]) : null;
  const next = applyIdea(ings, idea, basis);
  if (!next) return el('p', { class: 'panel', text: 'That idea is not one this planner understands.' });
  return el('section', { class: 'stack' }, [
    el('h1', { text: add ? `Add ${add.name} to ${slot.title}?` : `Use ${swapTo.name} instead of ${swapFrom.name}?` }),
    el('p', { class: 'small', text: `For ${label(dateOf(monday, slot.day), slot.meal, hub.today())} only - the saved recipe stays as it is unless you choose to save the change there afterwards.` }),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Change meal', 'data-field': 'modify-apply', on: { click: async () => { await savePlan(hub, monday, updateSlot(p.data, slot.id, { ingredients: next, basis })); hub.ui.notice('Changed for this meal. The shopping list updates when you send the week again.'); hub.open(back); } } }),
      el('a', { class: 'btn', href: back, text: 'Cancel' }),
    ]),
  ]);
}
