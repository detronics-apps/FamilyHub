// Money maths for the Finance mini-apps (D-066). Every result can be rebuilt by
// hand from its inputs: no hidden constants, and nothing rounded until it is shown.
// Arithmetic on the family's own numbers - never advice. Pure - no DOM.

/**
 * Where a default comes from. Every pre-filled value names one of these, so a
 * reference figure is never mistaken for a fact about the family's own loan.
 */
export const REFERENCE = {
  prime: { value: 10.75, label: 'Prime lending rate', source: 'SA Reserve Bank, 23 Sep 2026' },
  cpi: { value: 4.5, label: 'Inflation (CPI)', source: 'Stats SA, September 2026' },
};

const MAX_MONTHS = 600;

/** A yearly rate (%) compounded `per` times a year, as the equivalent rate per month. */
export function monthlyRate(ratePct, per = 12) {
  const r = (Number(ratePct) || 0) / 100;
  return per === 12 ? r / 12 : (1 + r / per) ** (per / 12) - 1;
}

/** What a yearly rate (%) compounded `per` times a year really earns or costs in a year (%). */
export const effectiveYearly = (ratePct, per = 12) => ((1 + (Number(ratePct) || 0) / 100 / per) ** per - 1) * 100;

/** The level payment, at each month end, that takes `principal` down to `balloon` in n months. */
export function payment(principal, r, n, balloon = 0) {
  if (n <= 0) return 0;
  if (r === 0) return (principal - balloon) / n;
  const f = (1 + r) ** n;
  return ((principal * f - balloon) * r) / (f - 1);
}

/** What is still owed after k payments. */
export function balanceAfter(principal, r, pmt, k) {
  if (r === 0) return principal - pmt * k;
  const f = (1 + r) ** k;
  return principal * f - (pmt * (f - 1)) / r;
}

/* ----------------------------------------------------- compound growth */

/**
 * Savings growing month by month. `monthly` is added each month (at its start
 * or end), and can rise by `raisePct` each year. Returns the balance, what was
 * paid in, the growth, the same money at simple interest, and a row per year.
 */
export function growth({ start = 0, monthly = 0, ratePct = 0, years = 1, per = 12, timing = 'end', raisePct = 0 }) {
  const r = monthlyRate(ratePct, per);
  const simpleR = (Number(ratePct) || 0) / 100 / 12;
  const months = Math.min(MAX_MONTHS, Math.max(0, Math.round(years * 12)));
  let balance = Number(start) || 0;
  let paidIn = balance;
  let simpleInterest = 0;
  const rows = [];
  for (let m = 1; m <= months; m += 1) {
    const add = (Number(monthly) || 0) * (1 + (Number(raisePct) || 0) / 100) ** Math.floor((m - 1) / 12);
    if (timing === 'start') { balance += add; paidIn += add; }
    simpleInterest += paidIn * simpleR;
    balance *= 1 + r;
    if (timing !== 'start') { balance += add; paidIn += add; }
    if (m % 12 === 0 || m === months) rows.push({ month: m, paidIn, balance, growth: balance - paidIn });
  }
  return { months, balance, paidIn, growth: balance - paidIn, simpleBalance: paidIn + simpleInterest, rows };
}

/** What an amount `years` from now buys in today's money, if prices rise `inflationPct` a year. */
export const todaysMoney = (amount, inflationPct, years) => amount / (1 + (Number(inflationPct) || 0) / 100) ** years;

/* --------------------------------------------- car: true cost of owning */

export const CAR_DEFAULTS = {
  price: null, deposit: 0, ratePct: Math.round((REFERENCE.prime.value + 1.5) * 100) / 100, termMonths: 60, keepYears: 5,
  balloonPct: 0, initiationFee: 1207.5, feeFinanced: true, serviceFee: 69,
  insurance: null, fuel: null, upkeep: null, licenceYearly: null, escalatePct: REFERENCE.cpi.value,
  resaleMode: 'depreciation', depreciationPct: 15, resaleAmount: null, kmYearly: null,
};

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * The cost of owning a car from the day it is bought to the day it is sold.
 * Keeps apart: what goes to the bank, what running it costs, what the sale
 * brings in, and what is still owed then. Loan principal is not a cost on top
 * of the price - it is paying for the car - so the total cost is the drop in
 * value plus interest, fees and running costs, and the sums below prove it.
 */
export function carCost(input) {
  const v = { ...CAR_DEFAULTS, ...input };
  const price = num(v.price);
  if (price == null || price <= 0) return { missing: ['the price'] };
  const deposit = num(v.deposit) ?? 0;
  const initiation = num(v.initiationFee) ?? 0;
  const service = num(v.serviceFee) ?? 0;
  const n = Math.max(0, Math.round(num(v.termMonths) ?? 0));
  const keep = Math.max(1, Math.min(MAX_MONTHS, Math.round((num(v.keepYears) ?? 0) * 12)));
  const loan = price - deposit + (v.feeFinanced ? initiation : 0);
  if (deposit > price) return { error: 'The deposit is more than the price.' };
  const balloon = (price * (num(v.balloonPct) ?? 0)) / 100;
  if (balloon > loan) return { error: 'The balloon is more than the amount borrowed.' };
  if (loan > 0 && n === 0) return { error: 'Choose how long the loan runs, or put the whole price down as the deposit.' };
  const r = monthlyRate(v.ratePct);
  const financed = loan > 0 && n > 0;
  const pmt = financed ? payment(loan, r, n, balloon) : 0;
  const owedAt = (m) => (!financed || m >= n ? 0 : balanceAfter(loan, r, pmt, m));
  const paid = Math.min(keep, financed ? n : 0);
  const balloonPaid = financed && keep >= n ? balloon : 0;
  const owed = owedAt(keep);

  const interest = pmt * paid + balloonPaid - (loan - owed);
  const fees = service * paid + initiation;
  const toBank = pmt * paid + service * paid + balloonPaid;
  const upfront = deposit + (v.feeFinanced ? 0 : initiation);

  const esc = (num(v.escalatePct) ?? 0) / 100;
  const runMonth = ['insurance', 'fuel', 'upkeep'].reduce((s, k) => s + (num(v[k]) ?? 0), 0) + (num(v.licenceYearly) ?? 0) / 12;
  const runningIn = (m) => runMonth * (1 + esc) ** Math.floor((m - 1) / 12);

  // Value over time: a steady yearly drop, either chosen or implied by an expected sale price.
  const resaleAmount = num(v.resaleAmount);
  const keepFactor = v.resaleMode === 'amount' && resaleAmount != null
    ? Math.max(0, resaleAmount) / price
    : (1 - (num(v.depreciationPct) ?? 0) / 100) ** (keep / 12);
  const valueAt = (m) => price * keepFactor ** (m / keep);
  const resale = valueAt(keep);

  let cashOut = upfront;
  let running = 0;
  const timeline = [{ month: 0, cashOut, value: price, owed: owedAt(0), cost: cashOut - (price - owedAt(0)) }];
  for (let m = 1; m <= keep; m += 1) {
    const run = runningIn(m);
    running += run;
    cashOut += run + (financed && m <= n ? pmt + service : 0) + (financed && m === n ? balloon : 0);
    timeline.push({ month: m, cashOut, value: valueAt(m), owed: owedAt(m), cost: cashOut - (valueAt(m) - owedAt(m)) });
  }
  const atSale = resale - owed;
  const total = upfront + toBank + running - atSale;
  return {
    price, deposit, loan, balloon, months: keep, termMonths: n, financed,
    instalment: financed ? pmt + service : 0, repayment: pmt, serviceFee: service,
    interest, fees, toBank, upfront, running, runningFirstMonth: runMonth,
    resale, owed, atSale, total,
    depreciation: price - resale,
    perMonth: total / keep,
    perKm: num(v.kmYearly) ? total / ((num(v.kmYearly) * keep) / 12) : null,
    timeline,
  };
}

/**
 * Which assumptions move the answer most: each is nudged by a stated amount,
 * and the change in the result is measured, biggest first.
 */
export function sensitivity(base, fn, nudges) {
  const at = fn(base);
  return nudges
    .map((x) => ({ ...x, change: fn({ ...base, [x.key]: x.to(base[x.key]) }) - at }))
    .filter((x) => Number.isFinite(x.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export const CAR_NUDGES = [
  { key: 'ratePct', what: 'interest rate 1 point higher', to: (x) => (Number(x) || 0) + 1 },
  { key: 'depreciationPct', what: 'value dropping 5 points faster a year', to: (x) => (Number(x) || 0) + 5 },
  { key: 'escalatePct', what: 'running costs rising 2 points faster a year', to: (x) => (Number(x) || 0) + 2 },
  { key: 'fuel', what: 'fuel 20% dearer', to: (x) => (Number(x) || 0) * 1.2 },
];
