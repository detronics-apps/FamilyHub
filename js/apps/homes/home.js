// One home, whole (D-078): bought now, already ours, or rented - made of sections that
// can each be counted or left out, a bond with its real history, and "what if" scenarios
// worked out with and without. Every month from today, so homes can be compared on the
// same footing. Replaces the separate A home / Bond / Our bond / Sell to buy sums.
// Pure - no DOM.

import { REFERENCE, buyingCosts, total, travel, HOME_DEFAULTS } from '../finance/maths.js';
import { runBond, monthsFrom, addMonthsYM, normaliseEvents } from './bondlog.js';
import { homeGainTax, sellToBuy, OWN_RENT_DEFAULTS } from './ownrent.js';

export const KINDS = { buy: 'Buying', own: 'Ours already', rent: 'Renting' };

/** Sections that can be counted or left out. Off: the section folds away and counts nothing. */
export const SECTIONS = {
  sellFirst: 'Selling our current home first',
  bond: 'The bond',
  running: 'Running it',
  upgrades: 'Upgrades',
  travel: 'Getting to work',
  afterBond: 'After the bond is paid off',
  forgone: 'What the money up front could have earned',
};
export const SECTIONS_ON = { sellFirst: false, bond: true, running: true, upgrades: true, travel: true, afterBond: false, forgone: true };

export const SCENARIO_KINDS = { more: 'Pay more each month', extra: 'Pay in once', withdraw: 'Take out', rate: 'Rate changes' };

export const PLAN_DEFAULTS = {
  ...HOME_DEFAULTS, ...OWN_RENT_DEFAULTS,
  kind: 'buy', on: {}, scenarios: [],
  bondLoan: null, bondStart: null, bondYears: 20, bondRate: REFERENCE.prime.value, bondEvents: [],
  income: null,
};

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

/** Which kind a saved record is - including ones saved in the older separate tools. */
export function kindOf(v, savedAs = null) {
  if (v.kind === 'own' || v.kind === 'rent') return v.kind;
  if (v.kind === 'buy') return 'buy';
  if (savedAs === 'ourbond' || (savedAs === 'rentbuy' && v.rbMode === 'keep')) return 'own';
  if (savedAs === 'home' && v.mode === 'rent') return 'rent';
  return 'buy';
}

/** Scenario lines that are ticked (and complete). */
export function scenarioEvents(list, onlyTicked = true) {
  return (Array.isArray(list) ? list : []).filter((s) => s && SCENARIO_KINDS[s.kind] && isMonth(s.from) && (!onlyTicked || s.on !== false));
}

/** Investments' growth a month, after tax. */
export const investRate = (v) => (1 + (num(v.investPct) / 100) * (1 - num(v.investTaxPct) / 100)) ** (1 / 12) - 1;

/**
 * Month by month from today, for 30 years. `withScenarios: false` gives the same home
 * without the ticked "what ifs", for the with-and-without graphs.
 * Each month: what came out of your pocket (out), money taken back out of the bond
 * (taken), what is owed, what the home is worth, invested money, what it would bring
 * back if sold or left that month (homeNet), and how far ahead or behind you would be
 * then (ahead) - against the start: buying, against keeping your money; owning, against
 * selling today.
 */
export function homePlan(input, today, { withScenarios = true } = {}) {
  const v = { ...PLAN_DEFAULTS, ...input };
  const kind = kindOf(v);
  const on = { ...SECTIONS_ON, ...(v.on ?? {}) };
  const ym = today.slice(0, 7);
  const M = 360;
  const g = num(v.growthPct) / 100;
  const esc = num(v.escalatePct) / 100;
  const sell = num(v.sellPct) / 100;
  const yr = (t) => Math.floor((t - 1) / 12);

  if (kind === 'rent' && !(num(v.rent) > 0)) return { missing: ['the rent'] };
  if (kind === 'buy' && !(num(v.price) > 0)) return { missing: ['the price'] };
  if (kind === 'own' && !(num(v.worthNow) > 0)) return { missing: ['what the home is worth now'] };

  // --- where it starts
  const scen = withScenarios ? scenarioEvents(v.scenarios) : [];
  let value0 = 0; let upfront = 0; let baseCost = 0; let funding = null; let buyItems = []; let loan = 0; let deposit = 0;
  let run = null; let k = 0; let bondEvents = []; let bondStart = ym; let inv0 = 0;
  if (on.sellFirst && kind !== 'own') funding = sellToBuy({ ...v, price: kind === 'buy' ? v.price : 0, own: { transferAttorney: v.quoteTransfer, bondAttorney: v.quoteBond } });
  if (funding?.missing) funding = null;
  if (kind === 'buy') {
    value0 = num(v.price);
    deposit = funding ? funding.deposit : Math.min(value0, num(v.deposit));
    loan = on.bond ? value0 - deposit : 0;
    if (!on.bond) deposit = value0;           // no bond: the whole price in cash
    buyItems = buyingCosts(value0, loan, { transferAttorney: v.quoteTransfer, bondAttorney: v.quoteBond });
    upfront = deposit + total(buyItems) + num(v.moveCost);
    baseCost = value0 + total(buyItems);
    bondEvents = scen;
    if (loan > 0) run = runBond({ loan, ratePct: v.ratePct, termYears: v.termYears, start: ym, events: bondEvents });
  } else if (kind === 'own') {
    value0 = num(v.worthNow);
    baseCost = num(v.boughtFor || v.worthNow) + num(v.improvedSoFar);
    if (on.bond && num(v.bondLoan) > 0 && isMonth(v.bondStart)) {
      bondStart = v.bondStart;
      bondEvents = [...normaliseEvents(v.bondEvents), ...scen];
      run = runBond({ loan: v.bondLoan, ratePct: v.bondRate, termYears: v.bondYears, start: bondStart, events: bondEvents });
      k = Math.max(0, monthsFrom(bondStart, ym));
    }
  } else {
    upfront = num(v.rentDeposit) + num(v.rentMove);
  }
  // Where the money on day one comes from. Selling our home first: the sale pays (deposit,
  // costs, renovations), and what is left is invested; only a shortfall comes from savings.
  // Owning already: nothing is paid; what the home would sell for today is the starting point.
  let fromPocket = kind === 'own' ? 0 : upfront;
  let start = 0;
  const renov = kind === 'buy' ? num(v.renovations) : 0;
  if (funding) {
    fromPocket = Math.max(0, upfront + renov - funding.cash);
    inv0 = Math.max(0, funding.cash - upfront - renov);
    start = funding.cash;
  }
  if (run?.missing) run = null;
  const row = (t) => (run ? run.rows[k + t] ?? null : null);
  const eventsAt = (kindName, t) => (run ? bondEvents.filter((e) => e.kind === kindName && monthsFrom(bondStart, e.from) === k + t).reduce((s, e) => s + num(e.amount), 0) : 0);
  const upgrades = on.upgrades && kind !== 'rent' ? (Array.isArray(v.upgrades) ? v.upgrades : []).map((u) => ({ name: u.name, m: Math.max(1, Math.round(num(u.inYears) * 12) || 1), cost: num(u.cost), adds: num(u.adds) })) : [];
  const ir = investRate(v);
  const o = num(v.otherRatePct) / 100;
  const owed0 = row(0)?.balance ?? 0;
  if (kind === 'own') start = value0 * (1 - sell) - owed0 - homeGainTax(value0 * (1 - sell), baseCost, v.marginalPct).tax;

  const months = [];
  let paid = fromPocket; let cashIn = 0; let inv = inv0; let invPut = 0; let upgradesSpent = 0; let interest = 0;
  let lastMin = row(0)?.minPmt ?? 0;
  for (let t = 1; t <= M; t += 1) {
    const e = (1 + esc) ** yr(t);
    const r = row(t);
    if (r) { lastMin = r.minPmt; interest += r.interestThis; }
    const bondPaid = r ? r.paidThis + eventsAt('extra', t) : 0;
    const taken = r ? eventsAt('withdraw', t) : 0;
    const value = kind === 'rent' ? 0 : value0 * (1 + g) ** (t / 12) + upgrades.filter((u) => u.m <= t).reduce((s, u) => s + u.adds * (1 + g) ** ((t - u.m) / 12), 0);
    const upgradeNow = upgrades.filter((u) => u.m === t).reduce((s, u) => s + u.cost * (1 + esc) ** (t / 12), 0);
    upgradesSpent += upgradeNow;
    const maint = !on.running || kind === 'rent' ? 0 : v.maintMode === 'percent' ? (value * num(v.upkeepPct)) / 1200 : (num(v.maintYearly) / 12) * e;
    const running = kind === 'rent' || !on.running ? 0 : (num(v.ratesTaxes) + num(v.levies) + num(v.insurance)) * e + maint;
    const rent = kind === 'rent' ? num(v.rent) * (1 + num(v.rentRisePct) / 100) ** yr(t) : 0;
    const trip = on.travel ? travel(v, t).money : 0;
    // After the bond: the instalment that is no longer due is invested instead.
    const put = on.afterBond && run && !r ? lastMin * e : 0;
    inv = inv * (1 + ir) + put; invPut += put;
    const out = bondPaid + running + rent + trip + upgradeNow;
    paid += out; cashIn += taken;
    const owed = r ? r.balance : 0;
    const tax = kind === 'rent' ? 0 : homeGainTax(value * (1 - sell), baseCost + upgradesSpent, v.marginalPct).tax;
    const homeNet = kind === 'rent' ? num(v.rentDeposit) : value * (1 - sell) - owed - tax;
    const forgone = on.forgone ? fromPocket * ((1 + o) ** (t / 12) - 1) : 0;
    const ahead = homeNet + inv + cashIn - paid - invPut - forgone - start;
    months.push({ t, ym: addMonthsYM(ym, t), out, bondPaid, running, rent, trip, upgradeNow, taken, owed, value, inv, put, paid, homeNet, ahead, minPmt: r?.minPmt ?? 0 });
  }
  const S = Math.max(1, Math.min(M, Math.round(num(v.stayYears) * 12) || 120));
  return {
    kind, on, months, stay: S, at: months[S - 1], ahead: months[S - 1].ahead, monthNow: months[0].out,
    upfront, fromPocket, inv0, deposit, loan, buyItems, funding, value0, start, owed0,
    bond: run ? { paidOff: run.paidOff, owedNow: owed0, minNow: row(0)?.minPmt ?? 0, monthsLeft: Math.max(0, run.months - k), interestFromNow: interest, notes: run.notes } : null,
  };
}

/** The same home with and without the ticked "what ifs". */
export function withAndWithout(input, today) {
  const a = homePlan(input, today, { withScenarios: false });
  if (a.missing) return { missing: a.missing };
  const b = homePlan(input, today, { withScenarios: true });
  return {
    without: a, with: b, any: scenarioEvents(input.scenarios).length > 0,
    sooner: a.bond && b.bond ? a.bond.monthsLeft - b.bond.monthsLeft : 0,
    interestSaved: a.bond && b.bond ? a.bond.interestFromNow - b.bond.interestFromNow : 0,
    better: b.ahead - a.ahead,
  };
}

/**
 * Several homes on the same money (D-078): every month each household has as much as
 * the dearest of them needs; whoever needs less that month invests the difference (or
 * the share of it that really gets invested), and the cash one needs less of on day
 * one is invested too. Where each ends up = what its home would bring back + its own
 * investments + those savings.
 */
export function sameMoney(plans, v = {}) {
  const r = investRate({ investPct: v.investPct ?? 9, investTaxPct: v.investTaxPct ?? 15 });
  const s = Math.min(100, Math.max(0, v.investShare ?? 100)) / 100;
  // Day one: each starts from the same savings; whoever takes less from them keeps the rest invested.
  const up = Math.max(...plans.map((p) => p.fromPocket));
  const side = plans.map((p) => up - p.fromPocket);
  const series = plans.map(() => []);
  for (let t = 1; t <= 360; t += 1) {
    const need = plans.map((p) => { const m = p.months[t - 1]; return m.out + m.put - m.taken; });
    const top = Math.max(...need);
    plans.forEach((p, i) => {
      side[i] = side[i] * (1 + r) + (top - need[i]) * s;
      const m = p.months[t - 1];
      series[i].push({ t, wealth: m.homeNet + m.inv + side[i] });
    });
  }
  return { series, up };
}
