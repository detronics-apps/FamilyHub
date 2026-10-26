// How a meal's nutrition is shown, the same everywhere (a recipe, a planned
// meal, a comparison): calories with how complete they are, calories per person
// from their portion, the six-type spider chart always in view, and each type's
// own chart or list folded underneath. The numbers all come from
// js/meal-nutrition.js; this file only draws them.

import { el, svg } from './dom.js';
import { nutrientProfile, kcalByPerson, SCALE_NOTE } from '../meal-nutrition.js';
import { fmtAmount } from '../food.js';
import { fmtShare } from '../portions.js';

const SERIES = ['var(--accent)', 'var(--ok)', 'var(--warn)'];

/**
 * A spider chart. `series`: [{ name, values: [0..1 | null] }] over the same axes.
 * A null value is drawn as unknown (a hollow marker at the centre and "?"), never as zero.
 */
export function radar(axes, series, { size = 260, title = '' } = {}) {
  const n = axes.length;
  const c = size / 2;
  const r = c - 46;
  const at = (i, f) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [c + Math.cos(a) * r * f, c + Math.sin(a) * r * f];
  };
  const ring = (f) => svg('polygon', { points: axes.map((_, i) => at(i, f).join(',')).join(' '), class: 'radar__ring' });
  const shapes = series.map((s, k) => {
    const pts = s.values.map((v, i) => at(i, v ?? 0).join(',')).join(' ');
    return svg('g', {}, [
      svg('polygon', { points: pts, class: 'radar__shape', style: `stroke:${SERIES[k]};fill:${SERIES[k]}` }),
      ...s.values.map((v, i) => {
        const [x, y] = at(i, v ?? 0);
        return svg('circle', { cx: x, cy: y, r: v === null ? 4 : 3, class: v === null ? 'radar__unknown' : 'radar__dot', style: v === null ? `stroke:${SERIES[k]}` : `fill:${SERIES[k]}` });
      }),
    ]);
  });
  const labels = axes.map((a, i) => {
    const [x, y] = at(i, 1.18);
    const unknown = series.every((s) => s.values[i] === null);
    return svg('text', { x, y, class: 'radar__label', 'text-anchor': x < c - 4 ? 'end' : x > c + 4 ? 'start' : 'middle', 'dominant-baseline': 'middle' }, [`${a}${unknown ? ' ?' : ''}`]);
  });
  const desc = series.map((s) => `${s.name}: ${axes.map((a, i) => `${a} ${s.values[i] === null ? 'not known' : `${Math.round(s.values[i] * 100)}%`}`).join(', ')}`).join('. ');
  return svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'radar', role: 'img', 'aria-label': `${title}. ${desc}` }, [
    ring(1), ring(2 / 3), ring(1 / 3),
    ...axes.map((_, i) => svg('line', { x1: c, y1: c, x2: at(i, 1)[0], y2: at(i, 1)[1], class: 'radar__spoke' })),
    ...shapes, ...labels,
  ]);
}

const SHORT = { carbs: 'Carbs', fats: 'Fats', minerals: 'Minerals', phyto: 'Phyto', protein: 'Protein', vitamins: 'Vitamins' };

/**
 * The full nutrition panel for one meal.
 * @param n       mealNutrition(...) for this meal
 * @param shares  optional [{ name, share, basis }] - who eats how much (an assumption unless set by hand)
 * @param sharesNote  words on where the shares came from
 */
export function nutritionPanel(n, db, { shares = null, sharesNote = '', servingsLabel = 'serving' } = {}) {
  const profile = nutrientProfile(n, db);
  const coverage = `${n.counted} of ${n.of} ingredient${n.of === 1 ? '' : 's'} could be weighed${n.approx ? ' (some by volume or by the piece, so approximate)' : ''}.`;
  const people = shares ? kcalByPerson(n.kcal, shares) : [];
  return el('div', { class: 'stack nutrition' }, [
    el('div', { class: 'row', style: { alignItems: 'baseline' } }, [
      el('p', { class: 'stat-big' }, [el('strong', { text: n.kcal.known ? `${n.kcal.complete ? '≈' : '≥'} ${n.kcal.serving} kcal` : 'Calories not known' }), el('span', { class: 'small muted', text: ` a ${servingsLabel}` })]),
      n.kcal.known ? el('span', { class: 'small muted', text: `${n.kcal.complete ? 'about' : 'at least'} ${n.kcal.batch} kcal for the whole batch` }) : null,
    ]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `${coverage}${n.kcal.known && !n.kcal.complete ? ' Anything not counted adds more - so these are "at least".' : ''}` }),
    people.length ? el('div', {}, [
      el('table', { class: 'facts' }, [el('tbody', {}, people.map((p) => el('tr', {}, [
        el('th', { scope: 'row', text: p.name }),
        el('td', { text: p.basis === 'baby' ? 'under one - not estimated' : `${fmtShare(p.share)} portion${p.share > 1 ? 's' : ''}${p.kcal !== null ? ` · ≈ ${p.kcal} kcal` : ''}` }),
      ])))]),
      el('p', { class: 'small muted', text: sharesNote || 'Portions are an assumption from the portion guide (age, gender, height and weight) - how the food is actually divided changes these.' }),
    ]) : null,
    el('div', { class: 'radar-wrap' }, [radar(profile.map((c) => SHORT[c.id]), [{ name: 'This meal', values: profile.map((c) => c.score) }], { title: 'Six nutrient types for one serving' })]),
    el('p', { class: 'small muted', text: SCALE_NOTE }),
    ...profile.map((c) => detail(c)),
  ]);
}

function detail(c) {
  const chartable = c.axes.length >= 3;
  const fmt = (a) => (a.value === null ? 'not known' : `${fmtAmount(a.value)} ${a.unit}${a.partial ? ' (at least)' : ''}`);
  return el('details', { class: 'measures' }, [
    el('summary', {}, [el('strong', { text: c.label }), ` - ${c.score === null ? 'not enough information' : `${Math.round(c.score * 100)}% of a meal-sized share`}${c.basis === 'colour variety' ? ' (by plant colour)' : ''}`]),
    chartable ? el('div', { class: 'radar-wrap' }, [radar(c.axes.map((a) => a.label), [{ name: c.label, values: c.axes.map((a) => a.frac) }], { size: 240, title: c.label })]) : null,
    el('table', { class: 'facts' }, [el('tbody', {}, [
      ...c.axes.map((a) => el('tr', {}, [el('th', { scope: 'row', text: a.label }), el('td', { text: c.basis === 'colour variety' ? (a.value ? 'in the meal' : '-') : `${fmt(a)}${a.ref ? ` of ${fmtAmount(a.ref)} ${a.unit} a day` : ''}` })])),
      ...c.list.map((a) => el('tr', {}, [el('th', { scope: 'row', text: a.label }), el('td', { text: a.value === null ? 'not known' : `${fmtAmount(a.value)} ${a.unit}` })])),
    ])]),
    c.id === 'protein' ? el('p', { class: 'small muted', text: 'Amino acid detail is not in the food data used here.' }) : null,
  ]);
}

/** Two or three meals on one six-type chart, per serving, with what makes them hard to compare. */
export function comparePanel(entries, db) {
  const profiles = entries.map((e) => ({ ...e, profile: nutrientProfile(e.n, db) }));
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Compare', style: { margin: 0 } }),
    el('div', { class: 'radar-wrap' }, [radar(Object.values(SHORT), profiles.map((p) => ({ name: p.title, values: p.profile.map((c) => c.score) })), { title: 'Comparison per serving' })]),
    el('ul', { class: 'small' }, profiles.map((p, k) => el('li', {}, [
      el('span', { class: 'swatch', style: { background: SERIES[k] } }), ` ${p.title}: ${p.n.kcal.known ? `${p.n.kcal.complete ? '≈' : '≥'} ${p.n.kcal.serving} kcal a serving` : 'calories not known'} · serves ${p.servings} · ${p.n.counted} of ${p.n.of} ingredients weighed`,
    ]))),
    el('p', { class: 'small muted', text: `Each shape is one serving as the recipe divides it - a recipe with bigger servings will look larger without being "better". ${SCALE_NOTE}` }),
  ]);
}
