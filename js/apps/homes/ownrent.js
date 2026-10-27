// Own or rent (D-072): as close to like for like as two different things allow.
// Two starting points - buy a home or rent one, and keep the home we own or sell it
// and rent - with the family's own figures where they have them: real maintenance,
// upgrades that add value, growth from their own home's history, investments after
// tax, and how much of the monthly difference really gets invested. Pure - no DOM.

import { REFERENCE, monthlyRate, payment, balanceAfter, transferDuty, feesEstimate, buyingCosts, sellingCosts, total } from '../finance/maths.js';

/** SARS capital gains tax for individuals (sars.gov.za, 2026 and 2027 years). */
export const CGT = {
  primaryResidence: 3000000,   // gain on the home you live in that is not taxed
  annual: 50000,               // the yearly exclusion for individuals
  inclusion: 0.4,              // share of the gain added to taxable income (18% at most, at 45%)
  source: 'SARS capital gains tax, 2026 and 2027 tax years',
};

export const OWN_RENT_DEFAULTS = {
  rbMode: 'buy',
  // Buying
  price: null, deposit: 0, ratePct: REFERENCE.prime.value, termYears: 20, fees: null, moveCost: null,
  // Keeping the home we own
  worthNow: null, owedNow: 0, yearsLeft: 5, boughtFor: null, boughtWhen: null, improvedSoFar: null,
  // Owning, either way
  growthPct: REFERENCE.cpi.value, ratesTaxes: null, levies: null, insurance: null,
  maintMode: 'amount', maintYearly: null, upkeepPct: 1, upgrades: [], sellPct: 7.5, travelOwn: null,
  // Renting
  rent: null, rentRisePct: 6, rentDeposit: null, rentMove: null, travelRent: null,
  // Money and time
  escalatePct: REFERENCE.cpi.value, investPct: 9, investTaxPct: 15, investShare: 100, marginalPct: 41, stayYears: 10,
};

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

/** What the family's own home has grown by each year, from what it cost and what it is worth now. */
export function historyGrowth(boughtFor, boughtWhen, worthNow, today) {
  if (!(num(boughtFor) > 0) || !(num(worthNow) > 0) || !isMonth(boughtWhen)) return null;
  const years = (Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - (Number(boughtWhen.slice(0, 4)) * 12 + Number(boughtWhen.slice(5, 7)))) / 12;
  if (!(years > 0.5)) return null;
  return { years, pct: ((num(worthNow) / num(boughtFor)) ** (1 / years) - 1) * 100 };
}

/** Tax on selling the home you live in: only the gain above the exclusions, and only 40% of that. */
export function homeGainTax(salePrice, baseCost, marginalPct) {
  const gain = num(salePrice) - num(baseCost);
  const taxable = Math.max(0, gain - CGT.primaryResidence - CGT.annual);
  return { gain, taxable, tax: taxable * CGT.inclusion * (num(marginalPct) / 100) };
}

/**
 * Month by month for up to 30 years. Both households have the same money each
 * month: whoever pays less that month puts the difference - or the share of it
 * that really gets invested - into investments growing after tax. Upgrades are
 * paid when they are done and add to what the home sells for.
 */
export function ownOrRent(input) {
  const v = { ...OWN_RENT_DEFAULTS, ...input };
  const keep = v.rbMode === 'keep';
  if (keep ? !(num(v.worthNow) > 0) : !(num(v.price) > 0)) return { missing: [keep ? 'what the home is worth now' : 'the price'] };
  if (!(num(v.rent) > 0)) return { missing: ['the rent'] };
  if (!keep && num(v.deposit) > num(v.price)) return { error: 'The deposit is more than the price.' };

  const r = monthlyRate(v.ratePct);
  const sell = num(v.sellPct) / 100;
  const g = num(v.growthPct) / 100;
  const esc = num(v.escalatePct) / 100;
  const year = (m) => Math.floor((m - 1) / 12);
  const after = (1 + (num(v.investPct) / 100) * (1 - num(v.investTaxPct) / 100)) ** (1 / 12) - 1;
  const share = Math.min(100, Math.max(0, num(v.investShare))) / 100;

  // The home and its bond at the start.
  let value0; let loan; let n; let ownerUp = 0; let duty = 0; let fees = 0; let baseCost; let saleNow = null;
  if (keep) {
    value0 = num(v.worthNow); loan = num(v.owedNow); n = Math.max(0, Math.round(num(v.yearsLeft) * 12));
    baseCost = num(v.boughtFor || v.worthNow) + num(v.improvedSoFar);
    const t = homeGainTax(value0 * (1 - sell), baseCost, v.marginalPct);
    saleNow = { price: value0, costs: value0 * sell, owed: loan, tax: t.tax, gain: t.gain, cash: value0 * (1 - sell) - loan - t.tax };
  } else {
    value0 = num(v.price); loan = value0 - num(v.deposit); n = Math.max(0, Math.round(num(v.termYears) * 12));
    duty = transferDuty(value0); fees = v.fees == null || v.fees === '' ? feesEstimate(value0, loan) : num(v.fees);
    ownerUp = num(v.deposit) + duty + fees + num(v.moveCost);
    baseCost = value0 + duty + fees;
  }
  if (loan > 0 && n === 0) return { error: keep ? 'Say how many years are left on the bond.' : 'Choose how long the bond runs.' };
  const pmt = loan > 0 ? payment(loan, r, n) : 0;
  const owedAt = (m) => (loan > 0 && m < n ? balanceAfter(loan, r, pmt, m) : 0);
  const upgrades = (Array.isArray(v.upgrades) ? v.upgrades : []).map((u) => ({ name: String(u.name ?? 'Upgrade'), m: Math.max(1, Math.round(num(u.inYears) * 12) || 1), cost: num(u.cost), adds: num(u.adds) }));

  // Day one: the buyer pays for the house; the renter keeps that money invested. Selling: the cash is invested.
  const rentUp = num(v.rentDeposit) + num(v.rentMove);
  const start = keep ? saleNow.cash : ownerUp;
  let invRenter = Math.max(0, start - rentUp);
  let invOwner = keep ? 0 : Math.max(0, rentUp - start);

  const series = [];
  let breakeven = null; let upgradesSpent = 0; let ownerPaid = 0; let renterPaid = 0;
  for (let m = 1; m <= 360; m += 1) {
    const e = (1 + esc) ** year(m);
    const valueAt = value0 * (1 + g) ** (m / 12) + upgrades.filter((u) => u.m <= m).reduce((s, u) => s + u.adds * (1 + g) ** ((m - u.m) / 12), 0);
    const maint = v.maintMode === 'percent' ? (valueAt * num(v.upkeepPct)) / 100 / 12 : (num(v.maintYearly) / 12) * e;
    const upgradeNow = upgrades.filter((u) => u.m === m).reduce((s, u) => s + u.cost * (1 + esc) ** (m / 12), 0);
    upgradesSpent += upgradeNow;
    const own = (m <= n ? pmt : 0) + (num(v.ratesTaxes) + num(v.levies) + num(v.insurance) + num(v.travelOwn)) * e + maint + upgradeNow;
    const rent = num(v.rent) * (1 + num(v.rentRisePct) / 100) ** year(m) + num(v.travelRent) * e;
    ownerPaid += own; renterPaid += rent;
    invOwner = invOwner * (1 + after) + Math.max(0, rent - own) * share;
    invRenter = invRenter * (1 + after) + Math.max(0, own - rent) * share;
    if (m % 12 === 0) {
      const t = homeGainTax(valueAt * (1 - sell), baseCost + upgradesSpent, v.marginalPct);
      const home = valueAt * (1 - sell) - owedAt(m) - t.tax;
      const owner = home + invOwner;
      const renter = invRenter + num(v.rentDeposit);
      series.push({ year: m / 12, value: valueAt, owed: owedAt(m), home, invOwner, owner, renter, ahead: owner - renter, tax: t.tax, own, rent, ownerPaid, renterPaid, spentOwn: ownerUp + ownerPaid, spentRent: rentUp + renterPaid });
      if (breakeven == null && owner > renter) breakeven = m / 12;
    }
  }
  const S = Math.max(1, Math.min(30, Math.round(num(v.stayYears))));
  const at = series[S - 1];
  const flips = series.filter((x, i) => i > 0 && Math.sign(x.ahead) !== Math.sign(series[i - 1].ahead)).map((x) => x.year);
  return {
    keep, ...at, horizon: S, series, breakeven, flips,
    pmt, bondEnds: loan > 0 ? n / 12 : 0, duty, fees, ownerUp, rentUp, saleNow, baseCost,
    monthOwn: pmt + num(v.ratesTaxes) + num(v.levies) + num(v.insurance) + num(v.travelOwn) + (v.maintMode === 'percent' ? (value0 * num(v.upkeepPct)) / 1200 : num(v.maintYearly) / 12),
    monthRent: num(v.rent) + num(v.travelRent),
    afterTaxPct: (num(v.investPct) * (1 - num(v.investTaxPct) / 100)),
  };
}

/**
 * The value of one assumption at which neither side is ahead after the chosen
 * years - "renting only wins if rent rises less than x%". Null when no value in
 * the range makes them equal.
 */
export function evenAt(input, key, lo, hi) {
  const f = (x) => ownOrRent({ ...input, [key]: x }).ahead;
  let a = lo; let b = hi; let fa = f(a); const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || Math.sign(fa) === Math.sign(fb)) return null;
  for (let i = 0; i < 50; i += 1) {
    const mid = (a + b) / 2; const fm = f(mid);
    if (Math.sign(fm) === Math.sign(fa)) { a = mid; fa = fm; } else b = mid;
  }
  return (a + b) / 2;
}

/**
 * Selling our home to buy the next one: the sale price, less selling costs, any
 * tax on the gain and the bond still owed, is the cash we have. From it come the
 * new home's buying costs (cash, before anything else), money kept back for
 * renovations and a reserve - and the rest is the deposit.
 */
export function sellToBuy(v) {
  const sale = Number(v.sellPrice) || 0;
  if (!(sale > 0)) return { missing: ['what our home will sell for'] };
  const owed = Math.max(0, Number(v.owedNow) || 0);
  const selling = sellingCosts(sale, owed, v.ratePct, v);
  const sellTotal = total(selling);
  const tax = homeGainTax(sale - sellTotal, (Number(v.boughtFor) || sale) + (Number(v.improvedSoFar) || 0), v.marginalPct);
  const cash = sale - sellTotal - owed - tax.tax;
  const price = Number(v.price) || 0;
  const keep = Math.max(0, Number(v.renovations) || 0) + Math.max(0, Number(v.reserve) || 0);
  // The deposit depends on the bond, and the bond's costs on the deposit: work it out from the top down.
  let deposit = 0; let buying = [];
  for (let i = 0; i < 6; i += 1) {
    buying = price > 0 ? buyingCosts(price, price - deposit, v.own ?? {}) : [];
    deposit = Math.max(0, Math.min(price, cash - total(buying) - keep));
  }
  const buyTotal = total(buying);
  const short = price > 0 ? Math.max(0, total(buying) + keep - cash) : 0;
  return { sale, owed, selling, sellTotal, tax, cash, price, buying, buyTotal, keep, deposit, loan: Math.max(0, price - deposit), short, leftOver: price > 0 ? Math.max(0, cash - buyTotal - keep - price) : Math.max(0, cash - keep) };
}
