// Entering ingredients line by line without relying on spelling: start typing
// and pick a food - one of your own items (home-made mayo), a food the guide
// knows, or one from the food database - then the total amount and a unit
// from a list. A picked food is linked, so its calories and nutrients count;
// anything typed and not picked is kept as written and marked as not counted.
//
// The editor keeps its own rows and redraws only itself, so typing is never
// interrupted by the rest of the page.

import { el } from './dom.js';
import { GUIDE } from '../apps/assistant/guide.js';
import { parseIngredient, unitKey } from '../apps/meals/logic.js';
import { tokens, foodSizes } from '../food.js';
import { resolveIngredient } from '../meal-nutrition.js';
import { fmtMass, sizeLabel } from '../units.js';

export const UNIT_OPTIONS = [
  ['g', 'g'], ['kg', 'kg'], ['ml', 'ml'], ['l', 'litres'], ['tsp', 'tsp'], ['tbsp', 'tbsp'], ['cup', 'cups'],
  ['', 'pieces (whole)'], ['slice', 'slices'], ['clove', 'cloves'], ['tin', 'tins'], ['pack', 'packs'], ['bunch', 'bunches'], ['pinch', 'pinch'],
];

/** "Rice, white, long-grain, ..." -> "rice - white"; the full name stays visible next to the line. */
function shortName(name) {
  const g = GUIDE.find((x) => x.fdc && name && x.name && name.toLowerCase() === x.name);
  if (g) return g.name;
  const [a, b] = name.split(', ');
  return `${a.toLowerCase()}${b && b.length <= 15 ? ` - ${b.toLowerCase()}` : ''}`;
}

/**
 * @param rows      the ingredient lines (edited in place): { name, qty, unit, fdcId?, recipeId?, whole?, note? }
 * @param db        the food database, or null while it loads (suggestions then come from your items and the guide)
 * @param own       your own meals: [{ id, title, yield, asIngredient }]. Those not yet used as an
 *                  ingredient are offered too when `onMakeIngredient` can set them up.
 * @param onMakeIngredient async (id) => its new `yield`, or null - marks one of our meals as an ingredient
 * @param selfId    this recipe's own id - it cannot be an ingredient of itself
 * @param onChange  called with the rows after every change
 * @param sizes     the family's own sizes: Map fdcId -> [{ label, grams }] ("ring" = 200 g)
 * @param onAddSize async ({ fdcId, label, grams }) => saves a new one; without it sizes cannot be added here
 * @param system    'metric' | 'imperial', for the weight shown next to each line
 */
export function ingredientEditor({ rows, db = null, own = [], selfId = null, onChange = () => {}, ownOnly = false, sizes = new Map(), onAddSize = null, system = 'metric', onMakeIngredient = null }) {
  const box = el('div', { class: 'stack ing-editor' });
  let onlyOwn = ownOnly;
  let openRow = null;
  let adding = null;   // the row whose "our own size" form is open

  const sizesOf = (r) => (r.fdcId && db ? foodSizes(db.get(r.fdcId), sizes.get(r.fdcId) ?? []) : []);
  // What a line weighs, unless it is already in grams: "= 270 g", or "≈" where a spoon or cup is weighed as water.
  const weight = (r) => {
    if (r.recipeId || r.qty == null || r.unit === 'g' || r.unit === 'kg' || !db) return '';
    const w = resolveIngredient(r, db);
    return w.grams == null ? '' : `${w.approx ? '≈' : '='} ${fmtMass(w.grams, system)}`;
  };

  const changed = () => onChange(rows);
  const suggest = (text) => {
    const q = tokens(text);
    if (!q.length) return [];
    const hit = (s) => q.every((t) => tokens(s).some((w) => w.startsWith(t)));
    const usable = (r) => r.asIngredient || onMakeIngredient;
    const mine = own.filter((r) => r.id !== selfId && usable(r) && hit(r.title)).slice(0, 6).map((r) => ({
      kind: 'own', label: r.title,
      sub: r.asIngredient && r.yield?.qty ? `makes ${r.yield.qty} ${r.yield.unit}` : 'our own meal - picking it lets other recipes use it',
      pick: { name: r.title, recipeId: r.id, unit: r.yield?.unit ?? '', fdcId: undefined, setUp: !r.asIngredient || !r.yield?.qty },
    }));
    if (onlyOwn) return mine;
    const guide = GUIDE.filter((g) => [g.name, ...g.also].some(hit)).slice(0, 5).map((g) => ({ kind: 'guide', label: g.name, sub: 'everyday food', pick: { name: g.name, fdcId: g.fdc, recipeId: undefined } }));
    const seen = new Set();
    const usda = db ? db.search(text, 14).filter((f) => !guide.some((g) => g.pick.fdcId === f.id) && !seen.has(f.name) && seen.add(f.name)).slice(0, 6).map((f) => ({ kind: 'usda', label: f.name, sub: `${Math.round(f.per100.kcal ?? 0)} kcal per 100 g`, pick: { name: shortName(f.name), fdcId: f.id, recipeId: undefined, usdaName: f.name } })) : [];
    return [...mine, ...guide, ...usda];
  };

  const status = (r) => (r.recipeId ? ['✓', 'our own item'] : r.fdcId ? ['✓', db?.get(r.fdcId)?.name ?? 'linked to the food database'] : r.name ? ['?', 'not linked - pick from the list so it counts towards calories'] : ['', '']);

  function rowNode(r, idx) {
    const list = el('ul', { class: 'ing-suggest', role: 'listbox', hidden: openRow !== idx });
    const name = el('input', {
      class: 'input', value: r.name, placeholder: 'Start typing, e.g. eggs', 'aria-label': `Ingredient ${idx + 1}`, autocomplete: 'off', 'data-field': `ing-name:${idx}`,
      on: {
        input: (e) => {
          r.name = e.target.value; delete r.fdcId; delete r.recipeId; changed();
          const s = suggest(e.target.value);
          list.replaceChildren(...s.map((x) => el('li', {}, el('button', {
            type: 'button', class: `ing-suggest__item ing-suggest__item--${x.kind}`,
            on: { mousedown: (ev) => { ev.preventDefault(); pick(r, x.pick); } },
          }, [el('strong', { text: x.kind === 'own' ? `★ ${x.label}` : x.label }), el('span', { class: 'small muted', text: ` ${x.sub}` })]))));
          list.hidden = !s.length;
          openRow = s.length ? idx : null;
        },
        blur: () => { setTimeout(() => { list.hidden = true; openRow = null; }, 150); },
      },
    });
    const grams = el('span', { class: 'small muted ing-grams', 'data-field': `ing-grams:${idx}`, text: weight(r) });
    const qty = el('input', { class: 'input', type: 'number', min: '0', step: 'any', value: r.qty ?? '', placeholder: 'amount', 'aria-label': `Amount for ingredient ${idx + 1}`, style: { width: '6.5em' }, 'data-field': `ing-qty:${idx}`, on: { input: (e) => { r.qty = e.target.value === '' ? null : Number(e.target.value); grams.textContent = weight(r); changed(); } } });
    // General units, then the sizes this food comes in (the family's own marked ★), then "add our own".
    const fs = sizesOf(r);
    const current = r.each ? fs.findIndex((s) => unitKey(s.unit) === r.unit) : -1;
    const units = [...UNIT_OPTIONS];
    if (r.unit && !r.each && !units.some(([u]) => u === r.unit)) units.push([r.unit, r.unit]);
    const unit = el('select', {
      class: 'select', style: { width: 'auto', maxWidth: '100%' }, 'aria-label': `Unit for ingredient ${idx + 1}`, 'data-field': `ing-unit:${idx}`,
      on: {
        change: (e) => {
          const v = e.target.value;
          if (v === 'add') { adding = idx; redraw(); return; }
          if (v.startsWith('size:')) { const s = fs[Number(v.slice(5))]; r.unit = unitKey(s.unit); r.each = s.each; }
          else if (v !== 'kept') { r.unit = v; delete r.each; }
          changed(); redraw();
        },
      },
    }, [
      ...units.map(([u, t]) => el('option', { value: u, text: t, selected: !r.each && (r.unit ?? '') === u })),
      r.each && current < 0 ? el('option', { value: 'kept', text: `${sizeLabel(r.unit, system)} (${r.each} g)`, selected: true }) : null,
      fs.length ? el('optgroup', { label: 'Sizes of this food' }, fs.map((s, k) => el('option', { value: `size:${k}`, text: `${s.own ? '★ ' : ''}${sizeLabel(s.label, system)} (${s.each} g)`, selected: k === current }))) : null,
      onAddSize && r.fdcId ? el('option', { value: 'add', text: '+ Add our own size…' }) : null,
    ]);
    const [mark, why] = status(r);
    return el('div', { class: 'ing-row', 'data-field': `ing-row:${idx}` }, [
      el('div', { class: 'ing-row__name' }, [name, list]),
      qty, unit,
      !r.unit ? el('label', { class: 'checkline small', title: 'Only whole ones can be used (eggs) - the recipe is then made x1, x1.5 or x2 so they stay whole' }, [
        el('input', { type: 'checkbox', checked: r.whole ?? /\beggs?\b/i.test(r.name), on: { change: (e) => { r.whole = e.target.checked; changed(); } } }), 'whole only',
      ]) : null,
      grams,
      el('span', { class: `ing-status${mark === '?' ? ' ing-status--off' : ''}`, title: why, 'aria-label': why, text: mark }),
      el('button', { class: 'btn btn-small btn-quiet btn-icon', type: 'button', text: '×', 'aria-label': `Remove ingredient ${idx + 1}`, on: { click: () => { rows.splice(idx, 1); changed(); redraw(); } } }),
      r.usdaName ? el('div', { class: 'small muted ing-row__full', text: r.usdaName }) : null,
      adding === idx ? sizeForm(r) : null,
    ]);
  }

  // "1 ring = 200 g", read off the packet once, then offered for this food in every recipe.
  function sizeForm(r) {
    const label = el('input', { class: 'input', placeholder: 'e.g. ring, tin, punnet', maxlength: '30', 'aria-label': 'Name of the size', style: { maxWidth: '180px' }, 'data-field': 'size-label' });
    const g = el('input', { class: 'input', type: 'number', min: '0', step: 'any', placeholder: 'grams', 'aria-label': 'Grams in one', style: { width: '6.5em' }, 'data-field': 'size-grams' });
    const why = el('span', { class: 'small', role: 'alert' });
    const save = async () => {
      const name = label.value.trim();
      const grams = Number(g.value);
      if (!name || !(grams > 0)) { why.textContent = 'Give it a name and the grams in one.'; return; }
      await onAddSize({ fdcId: r.fdcId, label: name, grams });
      sizes.set(r.fdcId, [...(sizes.get(r.fdcId) ?? []), { label: name, grams, at: Date.now() }]);
      r.unit = unitKey(name.toLowerCase()); r.each = grams;
      adding = null; changed(); redraw();
    };
    return el('div', { class: 'ing-row__full stack', style: { gap: '0.25rem' } }, [
      el('div', { class: 'row' }, ['1', label, '=', g, 'g',
        el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Save this size', 'data-field': 'size-save', on: { click: save } }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Cancel', on: { click: () => { adding = null; redraw(); } } }),
        why]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'From the packet, e.g. a ring of feta = 200 g. It is kept for the family and offered for this food every time. To correct one, add it again with the same name.' }),
    ]);
  }

  // Our own item: its "makes" unit. Eggs: counted whole. Anything else keeps a chosen unit, else grams; a size of the old food does not carry over.
  async function pick(r, p) {
    // One of our meals not yet used as an ingredient: set it up first (its weight becomes what it makes).
    if (p.setUp) {
      const y = await onMakeIngredient(p.recipeId);
      if (!y?.qty) { r.name = p.name; openRow = null; changed(); redraw(); return; }
      const o = own.find((x) => x.id === p.recipeId);
      if (o) { o.asIngredient = true; o.yield = y; }
      p = { ...p, unit: y.unit, setUp: false };
    }
    r.name = p.name;
    r.usdaName = p.usdaName;
    if (p.recipeId) { r.recipeId = p.recipeId; delete r.fdcId; delete r.each; r.unit = p.unit; }
    else { r.fdcId = p.fdcId; delete r.recipeId; if (r.each) { delete r.each; r.unit = 'g'; } r.unit = /\beggs?\b/i.test(p.name) ? '' : r.unit || 'g'; }
    openRow = null;
    changed();
    redraw();
  }

  function redraw() {
    const paste = el('textarea', { class: 'input', rows: '3', placeholder: 'Paste several lines, e.g. "200 g flour"', 'aria-label': 'Paste ingredient lines' });
    box.replaceChildren(
      el('label', { class: 'checkline small' }, [el('input', { type: 'checkbox', checked: onlyOwn, 'data-field': 'ing-own-only', on: { change: (e) => { onlyOwn = e.target.checked; } } }), 'Only suggest our own items (home-made sauces, bases and the like)']),
      ...rows.map(rowNode),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn btn-small', type: 'button', text: '+ Add an ingredient', 'data-field': 'ing-add', on: { click: () => { rows.push({ name: '', qty: null, unit: 'g' }); changed(); redraw(); box.querySelector(`[data-field="ing-name:${rows.length - 1}"]`)?.focus(); } } }),
      ]),
      el('details', { class: 'measures' }, [
        el('summary', { text: 'Paste several lines at once' }),
        paste,
        el('button', { class: 'btn btn-small', type: 'button', text: 'Add these lines', on: { click: () => { for (const line of paste.value.split('\n').map((x) => x.trim()).filter(Boolean)) rows.push(parseIngredient(line)); changed(); redraw(); } } }),
        el('p', { class: 'small muted', text: 'Pasted lines are kept as written; pick each from the list afterwards to link it to the food database.' }),
      ]),
      el('p', { class: 'small muted', text: 'Amounts are the total for the whole recipe, in whatever you buy - "½ head" or "1 tin" - and the weight is shown next to it. ✓ = linked, so its calories count; ? = not linked yet.' }),
    );
  }
  redraw();
  return box;
}
