// Calorie Checker (Meals section): look up a food in the shared food database
// and see what is in the amount you actually eat. Foods can be added up into an
// item, for the family or for one person, and saved in the Cookbook (which owns
// items: the foods go over in the link). Nothing is logged - it is a lookup, not a diary.

import { el } from '../../ui/dom.js';
import { loading, failure, field } from '../kit.js';
import { amounts, total, fmtAmount, browseFoods, FOOD_GROUPS, FOOD_COLOURS } from '../../food.js';
import { portionShares, portionPlan, fmtShare } from '../../portions.js';
import { foodWarnings } from '../../guidance.js';
import { fmtMass, gramsFromOz, sizeLabel } from '../../units.js';
import { GUIDE } from '../assistant/guide.js';

// Everyday foods the Meal Assistant knows - a short list to explore, so a food like tofu or
// lentils can be discovered by what it brings rather than only found by someone who knew its name.
const EVERYDAY = new Map(GUIDE.filter((g) => g.fdc).map((g) => [g.fdc, g]));

const MAIN = ['kcal', 'protein', 'carbs', 'sugars', 'fat', 'satFat', 'fibre', 'sodium'];
// One item being built per target: 'family', or a person's id.
const ui = { query: '', foodId: null, unit: 'g', count: 100, target: 'family', plates: {}, more: false, group: '', colour: '', sort: '', page: 0, everyday: true, scope: 'explore' };
const SORTS = { fibre: 'Fibre', protein: 'Protein', fat: 'Fat', carbs: 'Carbs' };
const PAGE = 15;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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
      on: { submit: (e) => { e.preventDefault(); ui.query = e.target.elements.q.value; ui.foodId = null; ui.page = 0; hub.render(); } },
    }, [
      el('input', { class: 'input', name: 'q', type: 'search', placeholder: 'A food, like "banana" or "brown rice cooked"', 'aria-label': 'Food to look up', value: ui.query, 'data-field': 'food-search', style: { flex: '1 1 220px' } }),
      el('button', { class: 'btn btn-primary', type: 'submit', text: 'Look up' }),
    ]),
    food ? null : browseControls(hub),
    people.length ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'Building' }, [
      el('span', { class: 'small', text: 'Building:' }),
      ...[['family', 'Family'], ...people.map((p) => [p.id, `For ${p.name}`])].map(([id, label]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(ui.target === id), 'data-field': `target:${id}`,
        text: `${label}${ui.plates[id]?.length ? ` (${ui.plates[id].length})` : ''}`, on: { click: () => { ui.target = id; hub.render(); } },
      })),
    ]) : null,
    food ? foodPanel(hub, db, food, targetName(people)) : results(hub, db),
    plate.length ? platePanel(hub, db, people, plate) : null,
    el('p', { class: 'small muted', text: `${db.count.toLocaleString()} foods from ${db.source} Amounts are typical values, not a measurement of your food.` }),
  ]);
}

/** Narrow the foods by type and colour, and sort by one nutrient. Any change starts again at page 1. */
function browseControls(hub) {
  const pick = (key, label, options, any) => el('label', { class: 'small stack', style: { gap: '2px' } }, [label, el('select', {
    class: 'select', style: { width: 'auto' }, 'data-field': `browse-${key}`,
    on: { change: (e) => { ui[key] = e.target.value; ui.page = 0; hub.render(); } },
  }, [['', any], ...options].map(([v, t]) => el('option', { value: v, text: t, selected: ui[key] === v })))]);
  return el('div', { class: 'stack' }, [
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Browse in' }, [
      el('span', { class: 'small', text: 'Browse:' }),
      ...[['explore', `Everyday foods (${EVERYDAY.size})`], ['all', 'All foods']].map(([k, t]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(ui.scope === k), text: t, 'data-field': `scope:${k}`,
        on: { click: () => { ui.scope = k; ui.page = 0; hub.render(); } },
      })),
    ]),
    el('div', { class: 'row', role: 'group', 'aria-label': 'Find foods by' }, [
    pick('group', 'Type of food', FOOD_GROUPS.map(([k, t]) => [k, t]), 'All foods'),
    pick('colour', 'Colour (fruit and vegetables)', Object.entries(FOOD_COLOURS), 'Any colour'),
    pick('sort', 'Sort by', Object.entries(SORTS).map(([k, t]) => [k, `Most ${t.toLowerCase()} first`]), 'Best match'),
    el('label', { class: 'checkline small', style: { alignSelf: 'flex-end' } }, [
      el('input', { type: 'checkbox', checked: ui.everyday, 'data-field': 'browse-everyday', on: { change: (e) => { ui.everyday = e.target.checked; ui.page = 0; hub.render(); } } }),
      'Leave out dried and powdered foods',
    ]),
    ]),
  ]);
}

function results(hub, db) {
  // Words search the whole database; without words, the list is browsed - by default the everyday foods.
  const words = ui.query.trim();
  const explore = !words && ui.scope === 'explore';
  const all = browseFoods(db, { query: ui.query, group: ui.group || null, colour: ui.colour || null, sort: ui.sort || null, everyday: ui.everyday, only: explore ? new Set(EVERYDAY.keys()) : null });
  if (!words && !explore && !(ui.group || ui.colour || ui.sort)) return el('p', { class: 'muted', text: 'Type a food and press Look up - or choose a type of food, a colour or a sort to browse all 13,000 foods. Generic foods come first - "raw" and "cooked" in the name tell you which state the numbers are for.' });
  if (!all.length) return el('p', { class: 'panel', text: ui.query.trim() ? 'Nothing matches. Try a simpler word ("chicken" rather than "chicken thighs"), check the spelling, or clear a filter.' : 'Nothing matches these filters.' });
  const pages = Math.ceil(all.length / PAGE);
  ui.page = Math.min(ui.page, pages - 1);
  const hits = all.slice(ui.page * PAGE, (ui.page + 1) * PAGE);
  const sortLine = (h) => (ui.sort ? (h.per100[ui.sort] == null ? `${SORTS[ui.sort].toLowerCase()} not known · ` : `${fmtAmount(h.per100[ui.sort])} g ${SORTS[ui.sort].toLowerCase()} · `) : '');
  const turn = (to) => { ui.page = to; hub.render(); };
  return el('div', { class: 'stack' }, [
    el('p', { class: 'small muted', 'data-field': 'browse-count', text: `${all.length.toLocaleString()} ${explore ? 'everyday ' : ''}food${all.length === 1 ? '' : 's'}${ui.sort ? `, most ${SORTS[ui.sort].toLowerCase()} per 100 g first` : ''}.${explore ? ' A short list to discover something new - sort by protein or fibre, or pick a colour, and see what you have not tried yet.' : ''}` }),
    el('ul', { class: 'list panel', 'aria-label': 'Foods found' }, hits.map((h) => el('li', {}, [
    el('button', {
      class: 'linkish list__main', type: 'button', style: { textAlign: 'left', textDecoration: 'none' }, 'data-field': `food:${h.id}`,
      on: { click: () => { ui.foodId = h.id; ui.unit = defaultPortion(h, hub.units()); ui.count = ui.unit === 'g' ? 100 : ui.unit === 'oz' ? 4 : 1; hub.render(); } },
    }, [
      el('strong', { text: EVERYDAY.has(h.id) ? cap(EVERYDAY.get(h.id).name) : h.name }),
      EVERYDAY.has(h.id) ? el('span', { class: 'small muted', text: ` - ${h.name}` }) : null,
      el('div', { class: 'small muted', text: `${sortLine(h)}${fmtAmount(h.per100.kcal)} kcal per 100 g · ${h.category || db.types[h.type]}` }),
    ]),
    ]))),
    pages > 1 ? el('div', { class: 'row', role: 'navigation', 'aria-label': 'Pages' }, [
      el('button', { class: 'btn btn-small', type: 'button', text: '‹ Previous', disabled: ui.page === 0, 'data-field': 'page-prev', on: { click: () => turn(ui.page - 1) } }),
      el('span', { class: 'small', 'data-field': 'page-of', text: `Page ${ui.page + 1} of ${pages}` }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Next ›', disabled: ui.page >= pages - 1, 'data-field': 'page-next', on: { click: () => turn(ui.page + 1) } }),
    ]) : null,
  ]);
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

const targetName = (people) => (ui.target === 'family' ? 'the item for the family' : `the item for ${people.find((p) => p.id === ui.target)?.name}`);

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
    el('button', { class: 'linkish small', type: 'button', text: '‹ Back', title: 'Back to the list', style: { alignSelf: 'flex-start' }, on: { click: () => { ui.foodId = null; hub.render(); } } }),
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
        class: 'btn btn-primary', type: 'button', text: 'Add', title: `Add to ${target}`, 'data-field': 'add-item', disabled: grams <= 0,
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
  // Handed to the Cookbook, which saves it: names shortened to their first part, grams rounded.
  const meal = {
    title: items.slice(0, 3).map((p) => p.food.name.split(',')[0]).join(', '),
    servings: family ? portionPlan(shares).cook : 1,
    ingredients: items.map((p) => ({ name: p.food.name, qty: Math.round(p.grams), fdcId: p.food.id })),
  };
  // Age and stage guidance about these foods, for whoever is eating (honey before one, and so on).
  const warnings = (family ? people : [person]).flatMap((p) => foodWarnings(p, hub.today(), items.map((x) => x.food.name)).map((w) => `${p.name}: ${w.rule.text}`));
  return el('div', { class: 'panel stack', 'aria-label': family ? 'An item for the family' : `An item for ${person.name}` }, [
    el('h2', { text: family ? 'An item for the family' : `An item for ${person.name}`, style: { margin: 0 } }),
    ...warnings.map((w) => el('div', { class: 'panel caution', role: 'note' }, [el('strong', { text: 'Worth knowing: ' }), w])),
    el('ul', { class: 'list' }, items.map((p, i) => el('li', {}, [
      el('div', { class: 'list__main' }, [el('strong', { text: p.food.name }), el('div', { class: 'small muted', text: `${p.label} · ${fmtAmount(amounts(p.food, p.grams).kcal)} kcal` })]),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Remove', on: { click: () => { plate.splice(i, 1); hub.render(); } } }),
    ]))),
    el('p', { class: 'stat-big' }, [el('strong', { text: `${line('kcal').replace(' kcal', '')} kcal` }), el('span', { class: 'small muted', text: family ? ' for the whole item' : ' altogether' })]),
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
      el('a', { class: 'btn btn-primary', href: `#/meals/new/${encodeURIComponent(`item:${JSON.stringify(meal)}`)}`, text: 'Save item', title: 'Save to the Cookbook', 'data-field': 'save-meal' }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Clear', on: { click: () => { ui.plates[ui.target] = []; hub.render(); } } }),
    ]),
    el('p', { class: 'small muted', text: 'Saving opens the Cookbook with these foods filled in. Name it, and say whether it is a meal, a recipe or an own ingredient - or leave it as an item.' }),
  ]);
}
