// What would it take for buying to win? (D-116) For each year you might sell, the value of one
// assumption - house-price growth, or what investments return - at which buying and renting a
// similar home come out level on the same money. Above that growth (or below that return)
// buying leaves more; the other side, renting does. Worked out through the real model, the same
// one the page's main graph uses, over a grid of values. Pure - no DOM.

import { measure } from './scenarios.js';
import { alternativeOf } from './alternative.js';

/** The assumptions it can be asked about, and the grid each is tried over (in % a year). */
export const BREAK_EVEN = {
  growthPct: { name: 'House prices grow by', from: -5, to: 25, step: 0.5, buyWinsAbove: true },
  investPct: { name: 'Investments grow by', from: 0, to: 30, step: 0.5, buyWinsAbove: false },
};

/**
 * @returns null without a comparison, else { key, yours, rows: [{ year, needed, always }] } -
 * `needed`: the value where the two are level that year (null when none in the grid);
 * `always`: 'buy' or 'rent' when one leaves more for every value tried.
 */
export function breakEven(v, today, key, years = 20) {
  const g = BREAK_EVEN[key];
  if (!g || !alternativeOf(v, today).values) return null;
  const grid = [];
  for (let x = g.from; x <= g.to + 1e-9; x += g.step) {
    const vx = { ...v, [key]: Math.round(x * 100) / 100 };
    const alt = alternativeOf(vx, today);
    const m = alt.values ? measure([vx, alt.values], today, {}, { a: 0, b: 1 }) : null;
    if (!m) return null;
    grid.push({ x: vx[key], m });
  }
  const at = (m, t) => m.series[Math.min(t, m.series.length) - 1][1];
  const rows = [];
  for (let year = 1; year <= years; year += 1) {
    const t = year * 12;
    const d = grid.map((p) => ({ x: p.x, d: at(p.m, t) }));
    let needed = null;
    for (let i = 1; i < d.length && needed == null; i += 1) {
      const a = d[i - 1]; const b = d[i];
      if ((a.d <= 0 && b.d >= 0) || (a.d >= 0 && b.d <= 0)) needed = b.d === a.d ? a.x : a.x + ((0 - a.d) / (b.d - a.d)) * (b.x - a.x);
    }
    const always = needed != null ? null : d.every((p) => p.d > 0) ? 'buy' : 'rent';
    rows.push({ year, needed: needed == null ? null : Math.round(needed * 10) / 10, always });
  }
  return { key, name: g.name, yours: Number(v[key]) || 0, buyWinsAbove: g.buyWinsAbove, rows };
}

/** In words, for the year you plan to sell: what it would take, against your own figure. */
export function breakEvenWords(r, year) {
  const row = r?.rows.find((x) => x.year === year) ?? r?.rows.at(-1);
  if (!row) return '';
  const yrs = `${row.year} year${row.year === 1 ? '' : 's'}`;
  if (row.always === 'buy') return `Selling after ${yrs}, buying leaves more whatever ${r.name.toLowerCase().replace(' grow by', '')} do, from ${BREAK_EVEN[r.key].from}% to ${BREAK_EVEN[r.key].to}% a year.`;
  if (row.always === 'rent') return `Selling after ${yrs}, renting leaves more whatever ${r.name.toLowerCase().replace(' grow by', '')} do, from ${BREAK_EVEN[r.key].from}% to ${BREAK_EVEN[r.key].to}% a year.`;
  const what = r.key === 'growthPct' ? 'house prices would need to grow' : 'investments would need to grow';
  const side = r.buyWinsAbove ? (r.yours >= row.needed ? 'buying' : 'renting') : (r.yours <= row.needed ? 'buying' : 'renting');
  return `Selling after ${yrs}, ${what} about ${row.needed}% a year for the two to come out level. You have ${r.yours}%, so ${side} leaves more - ${r.buyWinsAbove ? 'buying wins above that growth, renting below it' : 'buying wins below that return, renting above it'}.`;
}
