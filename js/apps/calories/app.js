// Calorie Checker (Meals section): look up a food in the shared food database
// and see what is in the amount you actually eat. Foods can be added up as the
// family's meal or as one person's plate, and saved as a meal in Meals &
// Recipes (which owns meals: the plate goes over in the link). Nothing is
// logged - it is a lookup, not a diary.

import { el } from '../../ui/dom.js';
import { loading, failure, field } from '../kit.js';
import { amounts, total, fmtAmount } from '../../food.js';
import { portionShares, portionPlan, fmtShare } from '../../portions.js';
import { foodWarnings } from '../../guidance.js';
import { fmtMass, gramsFromOz, sizeLabel } from '../../units.js';

const MAIN = ['kcal', 'protein', 'carbs', 'sugars', 'fat', 'satFat', 'fibre', 'sodium'];
// One list per target: 'family' for the family meal, or a person's id for their plate.
const ui = { query: '', foodId: null, unit: 'g', count: 100, target: 'family', plates: {}, more: false };

export function render(hub) {
  const f = hub.use('food', () => hub.food.load());
  if (f.loading) return el('section', { class: 'stack' }, [loading('Opening the food database…')]);
  if (f.error) return el('section', { class: 'stack' }, [failure(f.error)]);
  const db = f.data;
  const food = ui.foodId ? db.get(ui.foodId) : null;
  const people = hub.foodProfiles();
  if (ui.target !== 'family' && !people.some((p) => p.id === ui.target)) ui.target = 'family';
  const plate = ui.plates[ui.target] ?? [];

  return el('section', { class: 'stack', 'aria-label': 'Calorie Checker' }, [
    el('form', {
      class: 'row', role: 'search',
      on: { submit: (e) => { e.preventDefault(); ui.query = e.target.elements.q.value; ui.foodId = null; hub.render(); } },
    }, [
      el('input', { class: 'input', name: 'q', type: 'search', placeholder: 'A food, like "banana" or "brown rice cooked"', 'aria-label': 'Food to look up', value: ui.query, 'data-field': 'food-search', style: { flex: '1 1 220px' } }),
      el('button', { class: 'btn btn-primary', type: 'submit', text: 'Look up' }),
    ]),
    people.length ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'Building' }, [
      el('span', { class: 'small', text: 'Building:' }),
      ...[['family', 'The family meal'], ...people.map((p) => [p.id, `${p.name}’s plate`])].map(([id, label]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(ui.target === id), 'data-field': `target:${id}`,
        text: `${label}${ui.plates[id]?.length ? ` (${ui.plates[id].length})` : ''}`, on: { click: () => { ui.target = id; hub.render(); } },
      })),
    ]) : null,
    food ? foodPanel(hub, db, food, targetName(people)) : results(hub, db),
    plate.length ? platePanel(hub, db, people, plate) : null,
    el('p', { class: 'small muted', text: `${db.count.toLocaleString()} foods from ${db.source} Amounts are typical values, not a measurement of your food.` }),
  ]);
}

function results(hub, db) {
  if (!ui.query.trim()) return el('p', { class: 'muted', text: 'Type a food and press Look up. Generic foods come first - "raw" and "cooked" in the name tell you which state the numbers are for.' });
  const hits = db.search(ui.query, 25);
  if (!hits.length) return el('p', { class: 'panel', text: 'Nothing matches. Try a simpler word ("chicken" rather than "chicken thighs") or check the spelling.' });
  return el('ul', { class: 'list panel', 'aria-label': 'Foods found' }, hits.map((h) => el('li', {}, [
    el('button', {
      class: 'linkish list__main', type: 'button', style: { textAlign: 'left', textDecoration: 'none' }, 'data-field': `food:${h.id}`,
      on: { click: () => { ui.foodId = h.id; ui.unit = defaultPortion(h, hub.units()); ui.count = ui.unit === 'g' ? 100 : ui.unit === 'oz' ? 4 : 1; hub.render(); } },
    }, [el('strong', { text: h.name }), el('div', { class: 'small muted', text: `${fmtAmount(h.per100.kcal)} kcal per 100 g · ${h.category || db.types[h.type]}` })]),
  ])));
}

// The amount: a portion the source lists (by its index), or a weight - grams, or ounces when Settings says imperial.
const gramsOf = (food) => (ui.unit === 'g' ? Number(ui.count) || 0 : ui.unit === 'oz' ? gramsFromOz(ui.count) : (food.portions[Number(ui.unit)]?.grams ?? 0) * (Number(ui.count) || 0));
const byWeight = () => ui.unit === 'g' || ui.unit === 'oz';
const describe = (food, sys) => (byWeight() ? `${ui.count} ${ui.unit}` : `${Number(ui.count) === 1 ? '' : `${ui.count} × `}${sizeLabel(food.portions[Number(ui.unit)].label, sys)}`);
/** A medium one where the source lists sizes, else its first portion, else grams. */
function defaultPortion(food, sys) {
  if (!food.portions.length) return sys === 'imperial' ? 'oz' : 'g';
  const medium = food.portions.findIndex((p) => /\bmedium\b/i.test(p.label));
  return String(Math.max(0, medium));
}

const targetName = (people) => (ui.target === 'family' ? 'the family meal' : `${people.find((p) => p.id === ui.target)?.name}’s plate`);

function foodPanel(hub, db, food, target) {
  const grams = gramsOf(food);
  const a = amounts(food, grams);
  const rows = (keys) => keys.map((k) => el('tr', {}, [
    el('th', { scope: 'row', text: db.meta[k].label }),
    el('td', { text: a[k] === null ? 'not known' : `${fmtAmount(a[k])} ${db.meta[k].unit}` }),
  ]));
  const count = el('input', { class: 'input', id: 'cal-amount', type: 'number', min: '0', step: 'any', value: ui.count, style: { maxWidth: '110px' }, 'data-field': 'amount', on: { change: (e) => { ui.count = Math.max(0, Number(e.target.value) || 0); hub.render(); } } });
  const unit = el('select', { class: 'input', id: 'cal-unit', 'data-field': 'unit', on: { change: (e) => { ui.unit = e.target.value; ui.count = ui.unit === 'g' ? 100 : ui.unit === 'oz' ? 4 : 1; hub.render(); } } }, [
    ...food.portions.map((p, i) => el('option', { value: String(i), selected: ui.unit === String(i), text: `${sizeLabel(p.label, hub.units())} (${fmtAmount(p.grams)} g)` })),
    hub.units() === 'imperial' ? el('option', { value: 'oz', selected: ui.unit === 'oz', text: 'ounces' }) : el('option', { value: 'g', selected: ui.unit === 'g', text: 'grams' }),
  ]);
  return el('div', { class: 'panel stack' }, [
    el('button', { class: 'linkish small', type: 'button', text: '‹ Back to the list', style: { alignSelf: 'flex-start' }, on: { click: () => { ui.foodId = null; hub.render(); } } }),
    el('h2', { text: food.name }),
    el('div', { class: 'row' }, [field('How much', count), field('Of', unit)]),
    el('p', { class: 'stat-big', 'aria-live': 'polite' }, [
      el('strong', { text: a.kcal === null ? 'Calories not known' : `${fmtAmount(a.kcal)} kcal` }),
      el('span', { class: 'small muted', text: ` in ${describe(food, hub.units())}${byWeight() ? '' : ` (${fmtMass(grams, hub.units())})`}` }),
    ]),
    el('table', { class: 'facts' }, [el('tbody', {}, rows(MAIN.slice(1)))]),
    el('details', { open: ui.more, on: { toggle: (e) => { ui.more = e.target.open; } } }, [
      el('summary', { text: 'Vitamins, minerals and fats' }),
      el('table', { class: 'facts' }, [el('tbody', {}, rows(db.keys.filter((k) => !MAIN.includes(k))))]),
    ]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: `Add to ${target}`, 'data-field': 'add-plate', disabled: grams <= 0,
        on: { click: () => { (ui.plates[ui.target] ??= []).push({ foodId: food.id, grams, label: describe(food, hub.units()) }); ui.foodId = null; hub.render(); } },
      }),
    ]),
    el('p', { class: 'small muted', text: `${db.types[food.type]} data. "Not known" means the source does not report it - it is not counted as zero.` }),
  ]);
}

function platePanel(hub, db, people, plate) {
  const items = plate.map((p) => ({ ...p, food: db.get(p.foodId) })).filter((p) => p.food);
  const t = total(items);
  const line = (k) => {
    const x = t[k];
    if (!x || x.missing === items.length) return 'not known';
    return `${x.missing ? 'at least ' : ''}${fmtAmount(x.value)} ${db.meta[k].unit}`;
  };
  const family = ui.target === 'family';
  const person = people.find((p) => p.id === ui.target);
  const shares = family ? portionShares(people, hub.today()).filter((s) => s.share > 0) : [];
  const sum = shares.reduce((a, s) => a + s.share, 0);
  const kcalKnown = t.kcal && !t.kcal.missing;
  // Handed to Meals & Recipes, which saves it: names shortened to their first part, grams rounded.
  const meal = {
    title: items.slice(0, 3).map((p) => p.food.name.split(',')[0]).join(', '),
    servings: family ? portionPlan(shares).cook : 1,
    ingredients: items.map((p) => ({ name: p.food.name, qty: Math.round(p.grams), fdcId: p.food.id })),
  };
  // Age and stage guidance about these foods, for whoever is eating (honey before one, and so on).
  const warnings = (family ? people : [person]).flatMap((p) => foodWarnings(p, hub.today(), items.map((x) => x.food.name)).map((w) => `${p.name}: ${w.rule.text}`));
  return el('div', { class: 'panel stack', 'aria-label': family ? 'The family meal' : `${person.name}’s plate` }, [
    el('h2', { text: family ? 'The family meal' : `${person.name}’s plate`, style: { margin: 0 } }),
    ...warnings.map((w) => el('div', { class: 'panel caution', role: 'note' }, [el('strong', { text: 'Worth knowing: ' }), w])),
    el('ul', { class: 'list' }, items.map((p, i) => el('li', {}, [
      el('div', { class: 'list__main' }, [el('strong', { text: p.food.name }), el('div', { class: 'small muted', text: `${p.label} · ${fmtAmount(amounts(p.food, p.grams).kcal)} kcal` })]),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Remove', on: { click: () => { plate.splice(i, 1); hub.render(); } } }),
    ]))),
    el('p', { class: 'stat-big' }, [el('strong', { text: `${line('kcal').replace(' kcal', '')} kcal` }), el('span', { class: 'small muted', text: family ? ' for the whole meal' : ' altogether' })]),
    el('p', { class: 'small', text: ['protein', 'carbs', 'fat', 'fibre'].map((k) => `${db.meta[k].label} ${line(k)}`).join(' · ') }),
    t.kcal?.missing ? el('p', { class: 'small muted', text: 'One or more items does not report everything, so some totals are "at least".' }) : null,
    family && shares.length ? el('div', {}, [
      el('h3', { text: 'Shared out', style: { margin: '0 0 var(--space-1)' } }),
      el('ul', { class: 'small' }, shares.map((s) => el('li', {
        text: `${s.name}: about ${fmtShare(s.share)} portion${s.share > 1 ? 's' : ''}${kcalKnown ? ` · about ${Math.round((t.kcal.value * s.share) / sum)} kcal` : ''}`,
      }))),
      el('p', { class: 'small muted', text: 'A rough guide from age and gender, and height and weight where recorded on the People page. Appetites vary - let everyone eat to their hunger.' }),
    ]) : null,
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-primary', href: `#/meals/new/${encodeURIComponent(`plate:${JSON.stringify(meal)}`)}`, text: 'Save as a meal', 'data-field': 'save-meal' }),
      el('button', { class: 'btn btn-small', type: 'button', text: family ? 'Clear the meal' : 'Clear the plate', on: { click: () => { ui.plates[ui.target] = []; hub.render(); } } }),
    ]),
    el('p', { class: 'small muted', text: 'Saving opens Meals & Recipes with these foods filled in. Name it and save it as a meal; add the method any time to make it a recipe.' }),
  ]);
}
