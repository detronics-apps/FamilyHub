// The scenario range (D-084): how the answer moves when the assumptions are wrong.
// Every scenario is worked out again through the real model (homePlan, sameMoney) with
// its own assumptions - never a band drawn around the central line - so the range shows
// how the assumptions really interact. It is a sensitivity range, not a probability.
// Pure - no DOM.

import { homePlan, sameMoney, PLAN_DEFAULTS } from './home.js';

/**
 * What can be varied. `apply(v, d)` returns the home's values moved by d (points, or
 * percent for `scale`). `spread`: the default distance from the central value each way.
 * `field(v)`: the home's own value that is the central figure.
 */
export const VARS = [
  { key: 'growth', label: 'House prices grow', unit: 'points', spread: 2, step: 0.5, max: 6,
    why: 'What the home is worth later. Nobody knows it: the past is a guide only.', field: () => 'growthPct',
    how: 'Think about how sure anyone can be about prices in this area over these years, rather than assuming the recent trend carries on. Lower: prices grow more slowly; higher: faster.',
    apply: (v, d) => ({ ...v, growthPct: n(v.growthPct, PLAN_DEFAULTS.growthPct) + d }) },
  { key: 'invest', label: 'Investments grow', unit: 'points', spread: 2, step: 0.5, max: 6,
    why: 'What money not tied up in a home could earn - the deposit, and what is saved each month.', field: () => 'investPct',
    how: 'Returns jump about from year to year; over many years a wider range is honest. Lower: the money not in a home earns less; higher: more.',
    apply: (v, d) => ({ ...v, investPct: n(v.investPct, PLAN_DEFAULTS.investPct) + d }) },
  { key: 'rate', label: 'The bond rate', unit: 'points', spread: 2, step: 0.25, max: 5,
    why: 'A higher rate means a bigger instalment and more interest in all.', field: (v) => (v.kind === 'own' ? 'bondRate' : 'ratePct'),
    how: 'Test a higher rate to see whether the instalment stays affordable if rates rise. Lower: rates fall; higher: they rise.',
    apply: (v, d) => ({ ...v, ratePct: n(v.ratePct, PLAN_DEFAULTS.ratePct) + d, bondRate: n(v.bondRate, PLAN_DEFAULTS.bondRate) + d }) },
  { key: 'rent', label: 'Rent rises', unit: 'points', spread: 2, step: 0.5, max: 6,
    why: 'Rent usually goes up every year; how fast decides what renting costs later.', field: () => 'rentRisePct',
    how: 'Rent rises differ by area and by year. Lower: rent rises more slowly; higher: faster.',
    apply: (v, d) => ({ ...v, rentRisePct: n(v.rentRisePct, PLAN_DEFAULTS.rentRisePct) + d }) },
  { key: 'costs', label: 'Running costs rise', unit: 'points', spread: 2, step: 0.5, max: 6,
    why: 'Rates, levies, insurance and repairs rise with inflation - sometimes faster.', field: () => 'escalatePct',
    how: 'Rates, levies and insurance can rise faster than inflation. Test whether the monthly cost stays manageable. Lower: slower; higher: faster.',
    apply: (v, d) => ({ ...v, escalatePct: n(v.escalatePct, PLAN_DEFAULTS.escalatePct) + d }) },
  { key: 'repairs', label: 'Repairs and upkeep', unit: 'percent', spread: 50, step: 10, max: 200,
    why: 'Maintenance comes in lumps - a roof, a geyser. More than planned is common.', field: (v) => (v.maintMode === 'percent' ? 'upkeepPct' : 'maintYearly'),
    how: 'One big repair can cost far more than the allowance for a whole year. Test a higher figure to see how much it matters. Lower: less spent; higher: more.',
    apply: (v, d) => ({ ...v, maintYearly: n(v.maintYearly, 0) * (1 + d / 100), upkeepPct: n(v.upkeepPct, PLAN_DEFAULTS.upkeepPct) * (1 + d / 100) }) },
];

const n = (x, dflt) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? Number(dflt ?? 0) : Number(x));

/** Which variables matter for these homes (rent only with a rental, the bond rate only with a bond...). */
export function relevant(values) {
  const kinds = new Set(values.map((v) => v.kind));
  // Repairs only when there is a figure to test: 50% more than nothing is still nothing.
  const upkeep = values.some((v) => v.kind !== 'rent' && (v.maintMode === 'percent' ? n(v.upkeepPct, PLAN_DEFAULTS.upkeepPct) > 0 : n(v.maintYearly, 0) > 0));
  return VARS.filter((x) => (x.key === 'rent' ? kinds.has('rent') : x.key === 'repairs' ? upkeep : x.key === 'rate' || x.key === 'growth' || x.key === 'costs' ? kinds.has('buy') || kinds.has('own') : true));
}

/** Narrow is each assumption's own spread; wider is half as much again. Testing choices, not forecasts. */
export const PRESETS = { narrow: 1, wider: 1.5 };
export const presetRanges = (values, preset) => Object.fromEntries(relevant(values).map((x) => {
  const d = Math.round((x.spread * PRESETS[preset]) / x.step) * x.step;
  return [x.key, { on: true, low: -d, high: d, preset }];
}));

/** Move every home by the same deltas: { growth: -2, invest: +1, ... }. */
const moved = (values, deltas) => values.map((v) => VARS.reduce((acc, x) => (deltas[x.key] ? x.apply(acc, deltas[x.key]) : acc), v));

/**
 * The measure, month by month, for one set of deltas.
 * One home: how far ahead or behind if you left then (its own `ahead`).
 * Two or more: home `a` minus home `b` on the same money (positive: `a` leaves you more).
 */
export function measure(values, today, deltas = {}, { a = 0, b = 1, share = {} } = {}) {
  const vs = moved(values, deltas);
  const plans = vs.map((v) => homePlan(v, today));
  if (plans.some((p) => p.missing)) return null;
  if (vs.length === 1) return { series: plans[0].months.slice(Math.max(0, plans[0].now)).map((m, i) => [i + 1, m.ahead]), plans };
  const sm = sameMoney(plans, { investPct: n(vs[0].investPct, 9), investTaxPct: n(vs[0].investTaxPct, 15), investShare: share.investShare ?? vs[0].investShare ?? 100, cash: vs[0].diffCash === true });
  return { series: sm.series[a].map((s, i) => [s.t, s.wealth - sm.series[b][i].wealth]), wealthA: sm.series[a], wealthB: sm.series[b], plans, sm };
}

/**
 * Central, favourable and unfavourable, each recalculated. For each variable, its low
 * and high values are tried one at a time at month H; the favourable scenario takes
 * whichever is better for the measure, the unfavourable whichever is worse - and says
 * so, variable by variable, so nothing is combined out of sight.
 * `ranges`: { key: { on, low, high } } in deltas from the central value.
 */
export function scenarioRange(values, today, ranges, H, opts = {}) {
  const central = measure(values, today, {}, opts);
  if (!central) return null;
  const at = (m) => m.series[Math.min(H, m.series.length) - 1][1];
  const c = at(central);
  const used = relevant(values).filter((x) => ranges[x.key]?.on !== false);
  const effects = used.map((x) => {
    const r = ranges[x.key] ?? { low: -x.spread, high: x.spread };
    const lo = at(measure(values, today, { [x.key]: r.low }, opts));
    const hi = at(measure(values, today, { [x.key]: r.high }, opts));
    return { key: x.key, label: x.label, why: x.why, unit: x.unit, low: r.low, high: r.high, atLow: lo - c, atHigh: hi - c, swing: Math.abs(hi - lo) };
  }).sort((p, q) => q.swing - p.swing);
  const pick = (better) => Object.fromEntries(effects.map((e) => [e.key, (e.atHigh > e.atLow) === better ? e.high : e.low]));
  const favDeltas = pick(true); const unfDeltas = pick(false);
  const fav = measure(values, today, favDeltas, opts);
  const unf = measure(values, today, unfDeltas, opts);
  // Where each line crosses zero (two homes: where the other one takes over).
  const cross = (s) => { for (let i = 1; i < s.length; i += 1) if ((s[i - 1][1] < 0) !== (s[i][1] < 0)) return s[i][0]; return null; };
  // What it takes to change the answer at H: single variables that flip it on their own.
  const flips = effects.filter((e) => Math.sign(c) !== 0 && (Math.sign(c + e.atLow) !== Math.sign(c) || Math.sign(c + e.atHigh) !== Math.sign(c)));
  const values3 = { central: c, favourable: at(fav), unfavourable: at(unf) };
  const verdict = values3.favourable > 0 && values3.unfavourable > 0 ? 'all-above' : values3.favourable < 0 && values3.unfavourable < 0 ? 'all-below' : 'crosses';
  return {
    central, favourable: fav, unfavourable: unf, favDeltas, unfDeltas, effects, flips, verdict, at: values3,
    crossings: { central: cross(central.series), favourable: cross(fav.series), unfavourable: cross(unf.series) },
    width: Math.abs(values3.favourable - values3.unfavourable),
  };
}

/** Default ranges for the variables that matter here. */
export const defaultRanges = (values) => presetRanges(values, 'narrow');
