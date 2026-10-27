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
  perKm: { value: 4.95, label: 'SARS rate per km', source: 'SARS, 2026/27 tax year' },
  transferDuty: { label: 'Transfer duty', source: 'SARS table from 1 April 2025, unchanged from 1 April 2026' },
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

/* ------------------------------------------------------- homes (D-067) */

/** SARS transfer duty bands: [from, base amount, % of the value above `from`]. */
const DUTY_BANDS = [[0, 0, 0], [1210000, 0, 3], [1663800, 13614, 6], [2329300, 53544, 8], [2994800, 106784, 11], [13310000, 1241456, 13]];

export function transferDuty(price) {
  const p = Number(price) || 0;
  const [from, base, rate] = DUTY_BANDS.filter(([f]) => p > f).at(-1) ?? DUTY_BANDS[0];
  return base + ((p - from) * rate) / 100;
}

/**
 * Attorney, bond registration and deeds office costs, when none are entered:
 * a rough illustrative estimate (transfer: R10 000 + 1.2% of the price; bond:
 * R10 000 + 1% of the loan). A conveyancer's quote replaces it.
 */
export const feesEstimate = (price, loan) => 10000 + 0.012 * price + (loan > 0 ? 10000 + 0.01 * loan : 0);

export const HOME_DEFAULTS = {
  mode: 'buy', price: null, deposit: 0, ratePct: REFERENCE.prime.value, termYears: 20, stayYears: 5,
  fees: null, growthPct: 4, sellPct: 7.5,
  ratesTaxes: null, levies: null, insurance: null, upkeepPct: 1,
  rent: null, rentRisePct: 6, rentDeposit: null, moveCost: null,
  escalatePct: REFERENCE.cpi.value,
  km: null, days: 21, perKm: REFERENCE.perKm.value, travelExtra: null, minutes: null, hourValue: null,
  otherRatePct: 7,
};

/** Shared by the home tools: the bond, the house's value, and the monthly costs, month by month. */
function homeParts(v) {
  const price = num(v.price) ?? 0;
  const deposit = Math.min(price, num(v.deposit) ?? 0);
  const loan = price - deposit;
  const n = Math.max(0, Math.round((num(v.termYears) ?? 0) * 12));
  const r = monthlyRate(v.ratePct);
  const pmt = loan > 0 && n > 0 ? payment(loan, r, n) : 0;
  const esc = (num(v.escalatePct) ?? 0) / 100;
  const g = (num(v.growthPct) ?? 0) / 100;
  const year = (m) => Math.floor((m - 1) / 12);
  const valueAt = (m) => price * (1 + g) ** (m / 12);
  return {
    price, deposit, loan, n, r, pmt,
    duty: transferDuty(price),
    fees: num(v.fees) ?? feesEstimate(price, loan),
    owedAt: (m) => (loan > 0 && m < n ? balanceAfter(loan, r, pmt, m) : 0),
    valueAt,
    // Rates, levies and insurance rise with the escalation; upkeep is a share of what the house is worth.
    runningIn: (m) => ((num(v.ratesTaxes) ?? 0) + (num(v.levies) ?? 0) + (num(v.insurance) ?? 0)) * (1 + esc) ** year(m) + (valueAt(m) * (num(v.upkeepPct) ?? 0)) / 100 / 12,
    rentIn: (m) => (num(v.rent) ?? 0) * (1 + (num(v.rentRisePct) ?? 0) / 100) ** year(m),
  };
}

/** Getting to work from this home, in one month: money and hours. */
export function travel(v, m = 1) {
  const esc = (num(v.escalatePct) ?? 0) / 100;
  const days = num(v.days) ?? 0;
  const money = (2 * (num(v.km) ?? 0) * days * (num(v.perKm) ?? 0) + (num(v.travelExtra) ?? 0)) * (1 + esc) ** Math.floor((m - 1) / 12);
  const hours = (2 * (num(v.minutes) ?? 0) * days) / 60;
  return { money, hours, time: hours * (num(v.hourValue) ?? 0) };
}

/**
 * The true cost of living in one home for a while - bought or rented - with the
 * trip to work counted. Like the car: cash out, less what comes back at the end,
 * plus what the money paid up front could have earned meanwhile.
 */
export function homeCost(input) {
  const v = { ...HOME_DEFAULTS, ...input };
  const buy = v.mode !== 'rent';
  if (buy && !(num(v.price) > 0)) return { missing: ['the price'] };
  if (!buy && !(num(v.rent) > 0)) return { missing: ['the rent'] };
  if (buy && (num(v.deposit) ?? 0) > num(v.price)) return { error: 'The deposit is more than the price.' };
  const h = homeParts(v);
  if (buy && h.loan > 0 && h.n === 0) return { error: 'Choose how long the bond runs, or put the whole price down as the deposit.' };
  const S = Math.max(1, Math.min(MAX_MONTHS, Math.round((num(v.stayYears) ?? 0) * 12)));
  const move = num(v.moveCost) ?? 0;
  const rentDeposit = num(v.rentDeposit) ?? 0;
  const sell = (num(v.sellPct) ?? 0) / 100;
  const upfront = buy ? h.deposit + h.duty + h.fees + move : rentDeposit + move;

  let toBank = 0; let running = 0; let rent = 0; let travelMoney = 0; let hours = 0; let timeCost = 0;
  const timeline = [{ month: 0, cost: upfront - (buy ? h.price * (1 - sell) - h.loan : rentDeposit) }];
  for (let m = 1; m <= S; m += 1) {
    if (buy) { if (m <= h.n) toBank += h.pmt; running += h.runningIn(m); } else rent += h.rentIn(m);
    const t = travel(v, m);
    travelMoney += t.money; hours += t.hours; timeCost += t.time;
    const back = buy ? h.valueAt(m) * (1 - sell) - h.owedAt(m) : rentDeposit;
    timeline.push({ month: m, cost: upfront + toBank + running + rent + travelMoney - back });
  }
  const value = buy ? h.valueAt(S) : 0;
  const sellCosts = value * sell;
  const owed = buy ? h.owedAt(S) : 0;
  const back = buy ? value - sellCosts - owed : rentDeposit;
  const interest = buy ? toBank - (h.loan - owed) : 0;
  const forgone = upfront * ((1 + (num(v.otherRatePct) ?? 0) / 100) ** (S / 12) - 1);
  const total = upfront + toBank + running + rent + travelMoney - back + forgone;
  const first = travel(v, 1);
  return {
    buy, months: S, price: h.price, deposit: h.deposit, loan: h.loan, instalment: h.pmt, termMonths: h.n,
    duty: buy ? h.duty : 0, fees: buy ? h.fees : 0, move, rentDeposit,
    upfront, toBank, running, rent, interest, travel: travelMoney, hours, timeCost,
    value, sellCosts, owed, back, forgone, total,
    valueChange: buy ? h.price - value : 0,       // positive: it lost value; negative: it gained
    perMonth: total / S,
    monthNow: buy ? h.pmt + h.runningIn(1) + first.money : h.rentIn(1) + first.money,
    travelNow: first.money,
    hoursMonth: first.hours,
    timeline,
  };
}

/** A bond on its own: the instalment, what it costs, the cash needed first, and paying extra. */
export function bond(input) {
  const v = { ...HOME_DEFAULTS, extra: null, income: null, ...input };
  if (!(num(v.price) > 0)) return { missing: ['the price'] };
  if ((num(v.deposit) ?? 0) > num(v.price)) return { error: 'The deposit is more than the price.' };
  const h = homeParts(v);
  if (h.loan > 0 && h.n === 0) return { error: 'Choose how long the bond runs.' };
  const extra = Math.max(0, num(v.extra) ?? 0);
  let bal = h.loan; let months = 0; let interestExtra = 0;
  const yearly = [{ month: 0, balance: h.loan }];
  while (bal > 0.005 && months < MAX_MONTHS) {
    const i = bal * h.r;
    interestExtra += i;
    bal = bal + i - Math.min(bal + i, h.pmt + extra);
    months += 1;
    if (months % 12 === 0 || bal <= 0.005) yearly.push({ month: months, balance: Math.max(0, bal) });
  }
  const income = num(v.income);
  return {
    price: h.price, deposit: h.deposit, loan: h.loan, termMonths: h.n, instalment: h.pmt, r: h.r,
    totalPaid: h.pmt * h.n, interest: h.pmt * h.n - h.loan,
    duty: h.duty, fees: h.fees, cashFirst: h.deposit + h.duty + h.fees,
    extra, monthsWithExtra: months, interestWithExtra: interestExtra, yearly,
    share: income ? h.pmt / income : null,
    // A common bank guide: the instalment no more than about 30% of gross monthly income.
    incomeGuide: h.pmt / 0.3,
  };
}

/**
 * Rent or buy the same home, with the same money each month. The buyer pays the
 * deposit, duty and fees; the renter invests that instead. Each month whoever
 * spends less invests the difference. Who is ahead is what each would have if
 * they stopped: the house sold (after selling costs, the bond settled) plus
 * investments, against the renter's investments plus the rental deposit back.
 */
export function rentOrBuy(input) {
  const v = { ...HOME_DEFAULTS, ...input };
  if (!(num(v.price) > 0)) return { missing: ['the price'] };
  if (!(num(v.rent) > 0)) return { missing: ['the rent'] };
  if ((num(v.deposit) ?? 0) > num(v.price)) return { error: 'The deposit is more than the price.' };
  const h = homeParts(v);
  if (h.loan > 0 && h.n === 0) return { error: 'Choose how long the bond runs.' };
  const S = Math.max(1, Math.min(30, Math.round(num(v.stayYears) ?? 0)));
  const o = monthlyRate(v.otherRatePct);
  const sell = (num(v.sellPct) ?? 0) / 100;
  const rentDeposit = num(v.rentDeposit) ?? 0;
  const upBuy = h.deposit + h.duty + h.fees;
  let invBuyer = Math.max(0, rentDeposit - upBuy);
  let invRenter = Math.max(0, upBuy - rentDeposit);
  const series = [];
  let breakeven = null;
  for (let m = 1; m <= 360; m += 1) {
    const buyOut = (m <= h.n ? h.pmt : 0) + h.runningIn(m);
    const rentOut = h.rentIn(m);
    invBuyer = invBuyer * (1 + o) + Math.max(0, rentOut - buyOut);
    invRenter = invRenter * (1 + o) + Math.max(0, buyOut - rentOut);
    if (m % 12 === 0) {
      const home = h.valueAt(m) * (1 - sell) - h.owedAt(m);
      const buyer = home + invBuyer;
      const renter = invRenter + rentDeposit;
      series.push({ year: m / 12, buyer, renter, home, invBuyer, invRenter, ahead: buyer - renter });
      if (breakeven == null && buyer > renter) breakeven = m / 12;
    }
  }
  return {
    ...series[S - 1], breakeven, upBuy, duty: h.duty, fees: h.fees, instalment: h.pmt,
    firstRent: h.rentIn(1), firstOwn: h.pmt + h.runningIn(1), series,
  };
}
