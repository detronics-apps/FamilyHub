// Meal Assistant (Meals section): type the meal, choose who is eating, get a
// few easy ideas. Profiles (ages, allergies, pregnancy, wishes) come from
// the People page, so nothing is asked again here. A family recipe from the
// the Cookbook can be opened instead of typing (read-only). Nothing is logged.

import { el } from '../../ui/dom.js';
import { tabs, loading, failure } from '../kit.js';
import { suggest, recipeMealText, TYPES } from './logic.js';
import { INTERACTIONS } from './interactions.js';
import { FOCUS, LIFE_STAGES, lifeStageAllowed } from '../../model.js';
import { planId, normalisePlan } from '../meals/logic.js';

const ui = { text: '', asked: '', selected: [], notToday: [], hidden: [], recipe: null, slot: null };
const EXAMPLES = ['oats with butter and sugar', 'chicken and rice', 'pap and boerewors', 'toast with peanut butter'];

export function render(hub, route) {
  if (route.sub === 'about') return aboutScreen(hub);
  const param = route.rest[0] ?? '';
  if (route.sub === 'meal' && param.startsWith('slot:')) return slotMeal(hub, param.slice(5));
  if (ui.slot) ui.slot = null;
  return mealScreen(hub, route.sub === 'meal' && param.startsWith('recipe:') ? param.slice(7) : null);
}

const nav = (hub, current) => tabs(hub, [{ screen: null, label: 'Improve a meal' }, { screen: 'about', label: 'How it decides' }], current);

/**
 * Opened from a planned meal in This Week (`slot:<monday>~<slotId>`): read that
 * meal's own ingredients (read-only) and offer to send an idea back to it.
 */
function slotMeal(hub, ref) {
  const [monday, slotId] = ref.split('~');
  const r = hub.use(`slot:${ref}`, async () => {
    if (!hub.data.installed('mealplan')) return null;
    const raw = await hub.data.of('mealplan', 'plans').get(planId(monday)) ?? (hub.data.installed('meals') ? await hub.data.of('meals', 'plans').get(planId(monday)).catch(() => null) : null);
    const slot = raw ? normalisePlan(raw, monday).slots.find((s) => s.id === slotId) : null;
    if (!slot) return null;
    const rec = !slot.ingredients && slot.recipeId && hub.data.installed('meals') ? await hub.data.of('meals', 'recipes').get(slot.recipeId) : null;
    return { slot, ingredients: slot.ingredients ?? rec?.ingredients ?? [] };
  });
  if (r.loading) return el('section', { class: 'stack' }, [nav(hub, null), loading('Opening the planned meal…')]);
  if (!r.data) return el('section', { class: 'stack' }, [nav(hub, null), el('p', { class: 'panel', text: 'That planned meal could not be found.' })]);
  if (ui.slot?.ref !== ref) {
    ui.slot = { ref, monday, id: slotId, title: r.data.slot.title };
    ui.text = recipeMealText({ ingredients: r.data.ingredients, title: r.data.slot.title });
    ui.asked = ui.text; ui.recipe = null; ui.notToday = []; ui.hidden = [];
  }
  return mealScreen(hub, null);
}

/** The family's recipes, if the Cookbook is installed. */
const recipeBook = (hub) => (hub.data.installed('meals') ? hub.data.of('meals', 'recipes') : null);

function mealScreen(hub, recipeId) {
  const f = hub.use('food', () => hub.food.load());
  const profiles = hub.foodProfiles();
  const book = recipeBook(hub);
  const list = book ? hub.use('recipes', () => book.list({ limit: 1000 })) : null;
  const ask = (text, recipe = null) => { ui.text = text; ui.asked = text; ui.recipe = recipe; ui.notToday = []; ui.hidden = []; hub.render(); };
  // Arriving from a recipe (the picker below, or "Ideas to improve it" in the Cookbook).
  if (recipeId && book && ui.recipe?.id !== recipeId) {
    const r = hub.use(`recipe:${recipeId}`, () => book.get(recipeId));
    if (r.data) { ui.text = recipeMealText(r.data); ui.asked = ui.text; ui.recipe = { id: recipeId, title: r.data.title }; ui.notToday = []; ui.hidden = []; }
    else if (r.loading) return el('section', { class: 'stack' }, [nav(hub, null), loading('Opening the recipe…')]);
  }
  const toggle = (id) => { ui.selected = ui.selected.includes(id) ? ui.selected.filter((x) => x !== id) : [...ui.selected, id]; hub.render(); };
  const chosen = ui.selected.length ? profiles.filter((p) => ui.selected.includes(p.id)) : profiles;

  return el('section', { class: 'stack', 'aria-label': 'Meal Assistant' }, [
    nav(hub, null),
    el('p', { class: 'muted', text: 'What’s one easy thing that would make this meal a little better for the people eating it? No weighing, no counting, nothing to log.' }),
    profiles.length ? el('fieldset', {}, [
      el('legend', { class: 'small', text: 'Who is eating?' }),
      el('div', { class: 'chipset' }, [
        el('button', { class: 'chip', type: 'button', 'aria-pressed': String(!ui.selected.length), text: 'Everyone', on: { click: () => { ui.selected = []; hub.render(); } } }),
        ...profiles.map((p) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(ui.selected.includes(p.id)), text: p.name, 'data-field': `who:${p.id}`, on: { click: () => toggle(p.id) } })),
      ]),
      el('p', { class: 'small muted' }, [
        chosen.map((p) => wishes(p, hub.today())).filter(Boolean).join(' · ') || 'No wishes, allergies or ages set yet - suggestions are for the family in general.',
        ' ', el('a', { href: '#/people', text: 'Edit in People' }),
      ]),
    ]) : el('p', { class: 'small muted' }, ['Add your family in ', el('a', { href: '#/people', text: 'People' }), ' - with ages, allergies and what each person would like more of - and suggestions will fit them.']),
    el('form', { class: 'stack', on: { submit: (e) => { e.preventDefault(); ask(e.target.elements.meal.value.trim()); if (recipeId) hub.go(null); } } }, [
      el('label', { class: 'field__label', for: 'meal-text', text: 'What are you eating?' }),
      el('div', { class: 'row' }, [
        el('input', { class: 'input', id: 'meal-text', name: 'meal', value: ui.text, placeholder: 'e.g. oats with butter and sugar', autocomplete: 'off', 'data-field': 'meal', style: { flex: '1 1 240px' } }),
        el('button', { class: 'btn btn-primary', type: 'submit', text: 'Get ideas', 'data-field': 'get-ideas' }),
      ]),
      ui.asked ? null : el('div', { class: 'chipset' }, EXAMPLES.map((x) => el('button', { class: 'chip', type: 'button', text: x, on: { click: () => ask(x) } }))),
    ]),
    list?.data?.items.length ? el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'meal-recipe', text: 'Or open one of our meals or recipes' }),
      el('select', {
        class: 'select', id: 'meal-recipe', 'data-field': 'meal-recipe',
        on: { change: (e) => { if (e.target.value) hub.go('meal', `recipe:${e.target.value}`); } },
      }, [
        el('option', { value: '', text: `Choose from ${list.data.total} meal${list.data.total === 1 ? '' : 's'}…` }),
        ...[...list.data.items].sort((a, b) => a.title.localeCompare(b.title)).map((x) => el('option', { value: x.id, text: x.title, selected: ui.recipe?.id === x.id })),
      ]),
    ]) : null,
    ui.slot ? el('p', { class: 'small' }, ['Ideas for the planned meal ', el('a', { href: `#/mealplan/slot/${encodeURIComponent(ui.slot.ref)}`, text: ui.slot.title }), ' - an idea you send back changes that meal only, not the saved recipe.']) : null,
    ui.recipe ? el('p', { class: 'small' }, ['Ideas for the recipe ', el('a', { href: `#/meals/item/${encodeURIComponent(ui.recipe.id)}`, text: ui.recipe.title }), ' (its ingredients are above - change them to try something different).']) : null,
    ui.asked ? (f.loading ? loading('Opening the food database…') : f.error ? failure(f.error) : results(hub, f.data, profiles)) : null,
  ]);
}

function wishes(p, today) {
  const bits = [lifeStageAllowed(p, today) ? LIFE_STAGES[p.lifeStage] : null, ...p.focus.map((x) => FOCUS[x].toLowerCase()), p.allergies.length ? `allergic to ${p.allergies.join(', ')}` : null].filter(Boolean);
  return bits.length ? `${p.name}: ${bits.join(', ')}` : null;
}

function results(hub, db, profiles) {
  const r = suggest({ text: ui.asked, profiles, selected: ui.selected, db, today: hub.today(), notToday: ui.notToday, mealName: ui.recipe?.title.toLowerCase() ?? '' });
  if (!r.items.length) {
    return el('div', { class: 'panel', role: 'status' }, [el('p', { text: 'I did not recognise a food in that. Try simple words, like "chicken, rice and peas".' }), ...notes(r)]);
  }
  const cards = r.cards.filter((c) => !ui.hidden.includes(c.id));
  const order = Object.keys(TYPES);
  cards.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return el('div', { class: 'stack', 'aria-live': 'polite' }, [
    el('p', { class: 'small muted' }, [
      `Reading this as: ${r.items.map((i) => i.name).join(', ')}.`,
      r.unknown.length ? ` Not recognised: ${r.unknown.slice(0, 8).join(', ')}${r.unknown.length > 8 ? ` and ${r.unknown.length - 8} more` : ''} - the ideas are based on the rest.` : '',
    ]),
    ...r.cautions.map((c) => el('div', { class: 'panel caution', role: 'note' }, [el('strong', { text: 'Worth knowing: ' }), c])),
    cards.length ? el('div', { class: 'stack' }, cards.map((c) => card(hub, c)))
      : el('p', { class: 'panel', text: 'This meal already covers the easy wins I know about. Enjoy it.' }),
    ...notes(r),
  ]);
}

function card(hub, c) {
  return el('article', { class: `panel idea idea--${c.type}`, 'data-field': `idea:${c.id}` }, [
    el('div', { class: 'idea__type', text: TYPES[c.type] }),
    el('h3', { text: c.title }),
    el('dl', {}, [
      el('dt', { text: 'Who it helps' }), el('dd', { text: c.who }),
      el('dt', { text: 'Why' }), el('dd', { text: c.why.join(' ') }),
      c.effort ? [el('dt', { text: 'Effort' }), el('dd', { text: c.effort })] : null,
      c.alternatives.length ? [el('dt', { text: 'Or' }), el('dd', { text: `${c.alternatives.join(', ')} - whatever the family already enjoys` })] : null,
    ].flat()),
    c.notes.length ? el('ul', { class: 'small' }, c.notes.map((n) => el('li', { text: n }))) : null,
    el('div', { class: 'row', style: { marginTop: 'var(--space-2)' } }, [
      ui.slot && (c.type === 'add' || c.type === 'swap')
        ? el('a', { class: 'btn btn-small btn-primary', href: `#/mealplan/modify/${encodeURIComponent(`${ui.slot.monday}~${ui.slot.id}~${JSON.stringify(c.type === 'add' ? { add: c.foodId } : { swap: [c.fromId, c.foodId] })}`)}`, text: 'Use in this planned meal', 'data-field': `use:${c.id}` })
        : null,
      c.type === 'add' || c.type === 'swap'
        ? el('button', { class: 'btn btn-small', type: 'button', text: 'Not in the house today', on: { click: () => { ui.notToday.push(c.foodId); hub.render(); } } })
        : null,
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Not for us', on: { click: () => { ui.hidden.push(c.id); hub.render(); } } }),
    ]),
  ]);
}

const notes = (r) => [
  ...r.notes.map((n) => el('p', { class: 'small', text: n })),
  el('p', { class: 'small muted', text: 'General food ideas, not medical or dietary advice. Food values from USDA FoodData Central.' }),
];

function aboutScreen(hub) {
  const li = (t) => el('li', { text: t });
  return el('section', { class: 'stack', 'aria-label': 'How the Meal Assistant decides' }, [
    nav(hub, 'about'),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it does' }),
      el('p', { text: 'It reads a meal from a few words, then looks for one or two easy improvements for the people eating it. It never scores a meal, never calls food good or bad, and never asks you to log or weigh anything. One meal says nothing about anyone’s diet, so it does not claim to know what anyone lacks.' }),
      el('h2', { text: 'In this order' }),
      el('ol', {}, [
        li('Safety first. A food someone at the table is allergic to, cannot eat for their diet, or that is a choking risk for a small child is never suggested. Pregnancy food rules are applied too.'),
        li('The family goal, always on: more variety, more colour, and the main nutrients - carbohydrates and fibre, healthy fats, minerals, plant compounds, protein and vitamins.'),
        li('Each person’s own wishes from the People page - more iron, more protein, more colour, a small appetite, a selective eater - and their age and life stage.'),
        li('Practical: it suits the meal (fruit with porridge, vegetables with dinner), costs little and takes little work. Foods someone likes rise; foods someone dislikes drop.'),
      ]),
      el('h2', { text: 'Four kinds of idea' }),
      el('ul', {}, [li('Add - something alongside, keeping the meal as it is.'), li('Swap - the same role in the meal, with a little more to it.'), li('Time - eat something at another moment, only where there is a real reason.'), li('Try next time - for when today’s ingredients are not in the house.')]),
      el('h2', { text: 'Foods that affect each other' }),
      el('ul', { class: 'small' }, INTERACTIONS.map((i) => el('li', {}, [el('strong', { text: `${i.say}. ` }), `Evidence: ${i.evidence}. ${i.limitations} `, el('span', { class: 'muted', text: i.source })]))),
      el('h2', { text: 'Where the numbers come from' }),
      el('p', { class: 'small', text: 'Food values: USDA FoodData Central (public domain). Reference values for each age and life stage: the US National Academies’ Dietary Reference Intakes, used only to spot an opportunity - never shown as a target. Safety notes follow NHS guidance for young children and pregnancy.' }),
      el('h2', { text: 'What it will not do' }),
      el('ul', { class: 'small' }, [li('Diagnose a deficiency, or treat a wish for more iron as a diagnosis.'), li('Suggest supplements or doses - that is for your clinic.'), li('Make suggestions for babies under one.'), li('Replace a dietitian or doctor. If eating stays difficult or you are worried about growth, talk to one.')]),
    ]),
  ]);
}
