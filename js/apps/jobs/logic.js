// Job offers (D-068): one job against another, on what reaches the household -
// not the headline salary. Take-home comes from a payslip when known, otherwise
// from a labelled SARS estimate. Increases are assumptions, never promises.
// Pure - no DOM.

import { REFERENCE } from '../finance/maths.js';

/** SARS, 2027 tax year (1 March 2026 - 28 February 2027), from sars.gov.za. */
export const SARS = {
  source: 'SARS tables for 1 March 2026 - 28 February 2027',
  bands: [[0, 0, 18], [245100, 44118, 26], [383100, 79998, 31], [530200, 125599, 36], [695800, 185215, 39], [887000, 259783, 41], [1878600, 666339, 45]],
  rebates: { primary: 17820, secondary: 9765, tertiary: 3249 },
  medical: { first: 376, second: 376, more: 254 },        // a month: main member, first dependant, each further one
  uif: { rate: 0.01, ceiling: 17712 },                      // employee's 1%, on pay up to R17 712 a month
  retirement: { share: 0.275, cap: 350000 },
};

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));

/** Tax on a year's taxable income, before rebates. */
export function bandTax(taxable) {
  const [from, base, rate] = SARS.bands.filter(([f]) => taxable > f).at(-1) ?? SARS.bands[0];
  return taxable > 0 ? base + ((taxable - from) * rate) / 100 : 0;
}

/** The rate on the next rand earned. */
export const marginalRate = (taxable) => (SARS.bands.filter(([f]) => taxable > f).at(-1) ?? SARS.bands[0])[2] / 100;

const rebate = (age) => SARS.rebates.primary + (age !== 'under65' ? SARS.rebates.secondary : 0) + (age === 'over75' ? SARS.rebates.tertiary : 0);
const medicalCredit = (members) => (members >= 1 ? SARS.medical.first : 0) + (members >= 2 ? SARS.medical.second : 0) + Math.max(0, members - 2) * SARS.medical.more;

/**
 * Estimated pay for a year, SARS style. Cash pay and allowances are taxed; the
 * employer's medical and retirement contributions are taxable benefits; the
 * retirement contributions are deductible up to 27.5% (max R350 000 a year).
 */
export function estimatePay(v) {
  const gross = num(v.grossMonthly); const allow = num(v.allowances);
  const erRet = num(v.employerRetirement); const eeRet = num(v.employeeRetirement);
  const erMed = num(v.employerMedical);
  const pay = 12 * (gross + allow) + num(v.bonusGuaranteed);
  const fringe = 12 * (erMed + erRet);
  const deduction = Math.min(12 * (eeRet + erRet), SARS.retirement.share * (pay + fringe), SARS.retirement.cap);
  const taxable = Math.max(0, pay + fringe - deduction);
  const tax = Math.max(0, bandTax(taxable) - rebate(v.age ?? 'under65') - 12 * medicalCredit(num(v.medicalMembers)));
  const uif = 12 * SARS.uif.rate * Math.min(gross, SARS.uif.ceiling);
  const takeHome = pay - tax - uif - 12 * eeRet - 12 * num(v.medicalOwn);
  return { pay, taxable, tax, uif, deduction, takeHome, monthly: takeHome / 12, marginal: marginalRate(taxable) };
}

export const OFFER_DEFAULTS = {
  grossMonthly: null, takeHome: null, raisePct: REFERENCE.cpi.value, raiseAfter: 12,
  bonusGuaranteed: null, bonusPerformance: null, allowances: null,
  employerRetirement: null, employeeRetirement: null, employerMedical: null, medicalOwn: null, medicalMembers: 0,
  otherBenefits: null, benefitSaves: null, age: 'under65',
  commute: null, livingChange: null, escalatePct: REFERENCE.cpi.value,
  moveCost: null, moveRefundable: null, moveAllowance: null, allowanceBefore: false, gapMonths: null,
  savedForMove: null, canSave: null, growthPct: 7, notes: '',
};

/** How many increases have happened by month m (the first after `raiseAfter` months, then yearly). */
const raisesBy = (m, after) => (m <= after ? 0 : 1 + Math.floor((m - after - 1) / 12));

/**
 * One job, month by month. Take-home: the payslip figure grown with each
 * increase, or the SARS estimate worked out again at each new salary (so a
 * bigger share of each increase goes to tax). The household line is what this
 * job leaves the family each month after its own costs.
 */
export function project(input, months = 120) {
  const v = { ...OFFER_DEFAULTS, ...input };
  if (!(num(v.grossMonthly) > 0) && !(num(v.takeHome) > 0)) return { missing: ['the salary or the take-home pay'] };
  const raise = num(v.raisePct) / 100;
  const esc = num(v.escalatePct) / 100;
  const after = Math.max(0, Math.round(num(v.raiseAfter)));
  const estimated = !(num(v.takeHome) > 0);
  const base = estimatePay(v);
  const rows = [];
  let cumHousehold = 0; let cumTakeHome = 0; let cumGross = 0; let retirement = 0; let cumReal = 0;
  const g = (1 + num(v.growthPct) / 100) ** (1 / 12) - 1;
  const infl = (1 + esc) ** (1 / 12);   // today's money: prices rising as fast as the costs
  for (let m = 1; m <= months; m += 1) {
    const f = (1 + raise) ** raisesBy(m, after);
    const e = (1 + esc) ** Math.floor((m - 1) / 12);
    const at = { ...v, grossMonthly: num(v.grossMonthly) * f, allowances: num(v.allowances) * f, bonusGuaranteed: num(v.bonusGuaranteed) * f, employerRetirement: num(v.employerRetirement) * f, employeeRetirement: num(v.employeeRetirement) * f };
    const est = estimatePay(at);
    const takeHome = estimated ? est.monthly : num(v.takeHome) * f + (num(v.bonusGuaranteed) * f * (1 - base.marginal)) / 12;
    const gross = at.grossMonthly + at.allowances + at.bonusGuaranteed / 12;
    const household = takeHome + num(v.benefitSaves) * e - num(v.commute) * e - num(v.livingChange) * e;
    const package_ = gross + at.employerRetirement + num(v.employerMedical) * f + num(v.otherBenefits) * f;
    cumHousehold += household; cumTakeHome += takeHome; cumGross += gross;
    cumReal += household / infl ** m;
    retirement = retirement * (1 + g) + at.employerRetirement + at.employeeRetirement;
    rows.push({ month: m, gross, takeHome, household, package: package_, cumHousehold, cumTakeHome, cumGross, cumReal, retirement });
  }
  const perfNet = num(v.bonusPerformance) * (1 - base.marginal);
  return { estimated, estimate: base, first: rows[0], rows, perfNet, months };
}

/** The cash a move needs before it happens, and how long saving it would take. */
export function moveCash(input) {
  const v = { ...OFFER_DEFAULTS, ...input };
  const cost = num(v.moveCost); const refundable = num(v.moveRefundable); const allowance = num(v.moveAllowance);
  const needed = cost + refundable - (v.allowanceBefore ? allowance : 0);
  const short = Math.max(0, needed - num(v.savedForMove));
  const canSave = num(v.canSave);
  return {
    cost, refundable, allowance, needed, short,
    // Kept for good: the cost less what the employer pays. A refundable deposit comes back.
    netCost: Math.max(0, cost - allowance),
    monthsToSave: short <= 0 ? 0 : canSave > 0 ? Math.ceil(short / canSave) : null,
  };
}

/**
 * One job against another (`base`, usually staying put), over `months`.
 * Payback: the month the extra money each month has covered what the move
 * costs for good (plus any months without pay). Overtakes: the first month a
 * salary, and the first month the running total, is ahead.
 */
export function versus(offer, base, months = 120) {
  const horizon = 360;
  const a = project(offer, horizon); const b = project(base, horizon);
  if (a.missing || b.missing) return { missing: a.missing ?? b.missing };
  // Moving costs count on whichever side has them: what one job costs to take, less what the other would have.
  const move = moveCash(offer);
  const lost = num({ ...OFFER_DEFAULTS, ...offer }.gapMonths) * b.first.household;
  const baseUp = moveCash(base).netCost + num({ ...OFFER_DEFAULTS, ...base }.gapMonths) * a.first.household;
  const upfront = move.netCost + lost - baseUp;
  let payback = null; let salaryAhead = null; let totalAhead = null; let cum = 0;
  const diff = [];
  for (let m = 1; m <= horizon; m += 1) {
    const ra = a.rows[m - 1]; const rb = b.rows[m - 1];
    cum += ra.household - rb.household;
    if (payback == null && upfront > 0 && cum >= upfront) payback = m;
    if (salaryAhead == null && rb.gross > 0 && ra.gross > rb.gross) salaryAhead = m;
    if (totalAhead == null && cum - upfront > 0) totalAhead = m;
    diff.push({ month: m, monthly: ra.household - rb.household, ahead: cum - upfront });
  }
  const at = (m) => diff[Math.min(horizon, m) - 1];
  return {
    upfront, lost, move, payback: upfront > 0 ? payback : 0, salaryAhead, totalAhead,
    monthlyNow: a.first.household - b.first.household,
    ahead: at(months).ahead,
    milestones: [12, 36, 60, 120].map((m) => ({ month: m, ahead: at(m).ahead })),
    real: a.rows[months - 1].cumReal - b.rows[months - 1].cumReal - upfront,
    retirement: a.rows[months - 1].retirement - b.rows[months - 1].retirement,
    perf: (a.perfNet - b.perfNet) * (months / 12),
    diff: diff.slice(0, months),
  };
}
