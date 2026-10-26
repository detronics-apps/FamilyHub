// Calorie Checker (Meals section): look up a food in the shared food database
// and see what is in the amount you actually eat. Several items can be added up
// as a plate. Nothing is logged or kept - it is a lookup, not a diary.

import { el } from '../../ui/dom.js';
import { loading, failure, field } from '../kit.js';
import { amounts, total, fmtAmount } from '../../food.js';

const MAIN = ['kcal', 'protein', 'carbs', 'sugars', 'fat', 'satFat', 'fibre', 'sodium'];
const ui = { query: '', foodId: null, unit: 'g', count: 100, plate: [], more: false };

export function render(hub) {
  const f = hub.use('food', () => hub.food.load());
  if (f.loading) return el('section', { class: 'stack' }, [loading('Opening the food database…')]);
  if (f.error) return el('section', { class: 'stack' }, [failure(f.error)]);
  const db = f.data;
  const food = ui.foodId ? db.get(ui.foodId) : null;

  return el('section', { class: 'stack', 'aria-label': 'Calorie Checker' }, [
    el('form', {
      class: 'row', role: 'search',
      on: { submit: (e) => { e.preventDefault(); ui.query = e.target.elements.q.value; ui.foodId = null; hub.render(); } },
    }, [
      el('input', { class: 'input', name: 'q', type: 'search', placeholder: 'A food, like "banana" or "brown rice cooked"', 'aria-label': 'Food to look up', value: ui.query, 'data-field': 'food-search', style: { flex: '1 1 220px' } }),
      el('button', { class: 'btn btn-primary', type: 'submit', text: 'Look up' }),
    ]),
    food ? foodPanel(hub, db, food) : results(hub, db),
    ui.plate.length ? platePanel(hub, db) : null,
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
      on: { click: () => { ui.foodId = h.id; ui.unit = defaultPortion(h); ui.count = ui.unit === 'g' ? 100 : 1; hub.render(); } },
    }, [el('strong', { text: h.name }), el('div', { class: 'small muted', text: `${fmtAmount(h.per100.kcal)} kcal per 100 g · ${h.category || db.types[h.type]}` })]),
  ])));
}

const gramsOf = (food) => (ui.unit === 'g' ? Number(ui.count) || 0 : (food.portions[Number(ui.unit)]?.grams ?? 0) * (Number(ui.count) || 0));
const describe = (food) => (ui.unit === 'g' ? `${ui.count} g` : `${Number(ui.count) === 1 ? '' : `${ui.count} × `}${food.portions[Number(ui.unit)].label}`);
/** A medium one where the source lists sizes, else its first portion, else grams. */
function defaultPortion(food) {
  if (!food.portions.length) return 'g';
  const medium = food.portions.findIndex((p) => /medium/i.test(p.label));
  return String(Math.max(0, medium));
}

function foodPanel(hub, db, food) {
  const grams = gramsOf(food);
  const a = amounts(food, grams);
  const rows = (keys) => keys.map((k) => el('tr', {}, [
    el('th', { scope: 'row', text: db.meta[k].label }),
    el('td', { text: a[k] === null ? 'not known' : `${fmtAmount(a[k])} ${db.meta[k].unit}` }),
  ]));
  const count = el('input', { class: 'input', id: 'cal-amount', type: 'number', min: '0', step: 'any', value: ui.count, style: { maxWidth: '110px' }, 'data-field': 'amount', on: { change: (e) => { ui.count = Math.max(0, Number(e.target.value) || 0); hub.render(); } } });
  const unit = el('select', { class: 'input', id: 'cal-unit', 'data-field': 'unit', on: { change: (e) => { ui.unit = e.target.value; if (ui.unit === 'g') ui.count = 100; else ui.count = 1; hub.render(); } } }, [
    ...food.portions.map((p, i) => el('option', { value: String(i), selected: ui.unit === String(i), text: `${p.label} (${fmtAmount(p.grams)} g)` })),
    el('option', { value: 'g', selected: ui.unit === 'g', text: 'grams' }),
  ]);
  return el('div', { class: 'panel stack' }, [
    el('button', { class: 'linkish small', type: 'button', text: '‹ Back to the list', style: { alignSelf: 'flex-start' }, on: { click: () => { ui.foodId = null; hub.render(); } } }),
    el('h2', { text: food.name }),
    el('div', { class: 'row' }, [field('How much', count), field('Of', unit)]),
    el('p', { class: 'stat-big', 'aria-live': 'polite' }, [
      el('strong', { text: a.kcal === null ? 'Calories not known' : `${fmtAmount(a.kcal)} kcal` }),
      el('span', { class: 'small muted', text: ` in ${describe(food)}${ui.unit === 'g' ? '' : ` (${fmtAmount(grams)} g)`}` }),
    ]),
    el('table', { class: 'facts' }, [el('tbody', {}, rows(MAIN.slice(1)))]),
    el('details', { open: ui.more, on: { toggle: (e) => { ui.more = e.target.open; } } }, [
      el('summary', { text: 'Vitamins, minerals and fats' }),
      el('table', { class: 'facts' }, [el('tbody', {}, rows(db.keys.filter((k) => !MAIN.includes(k))))]),
    ]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn', type: 'button', text: 'Add to the plate', 'data-field': 'add-plate', disabled: grams <= 0,
        on: { click: () => { ui.plate.push({ foodId: food.id, grams, label: describe(food) }); ui.foodId = null; hub.render(); } },
      }),
    ]),
    el('p', { class: 'small muted', text: `${db.types[food.type]} data. "Not known" means the source does not report it - it is not counted as zero.` }),
  ]);
}

function platePanel(hub, db) {
  const items = ui.plate.map((p) => ({ ...p, food: db.get(p.foodId) })).filter((p) => p.food);
  const t = total(items);
  const line = (k) => {
    const x = t[k];
    if (!x) return 'not known';
    if (x.missing === items.length) return 'not known';
    return `${x.missing ? 'at least ' : ''}${fmtAmount(x.value)} ${db.meta[k].unit}`;
  };
  return el('div', { class: 'panel stack', 'aria-label': 'Plate' }, [
    el('h2', { text: 'Plate' }),
    el('ul', { class: 'list' }, items.map((p, i) => el('li', {}, [
      el('div', { class: 'list__main' }, [el('strong', { text: p.food.name }), el('div', { class: 'small muted', text: `${p.label} · ${fmtAmount(amounts(p.food, p.grams).kcal)} kcal` })]),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Remove', on: { click: () => { ui.plate.splice(i, 1); hub.render(); } } }),
    ]))),
    el('p', { class: 'stat-big' }, [el('strong', { text: `${line('kcal').replace(' kcal', '')} kcal` }), el('span', { class: 'small muted', text: ' altogether' })]),
    el('p', { class: 'small', text: ['protein', 'carbs', 'fat', 'fibre'].map((k) => `${db.meta[k].label} ${line(k)}`).join(' · ') }),
    t.kcal?.missing ? el('p', { class: 'small muted', text: 'One or more items does not report everything, so some totals are "at least".' }) : null,
    el('button', { class: 'btn btn-small', type: 'button', text: 'Clear the plate', style: { alignSelf: 'flex-start' }, on: { click: () => { ui.plate = []; hub.render(); } } }),
  ]);
}
