// Children's future (D-069): the big costs of growing up, for each child, from the
// ages Family Hub already knows - and all the children together, year by year, so
// overlaps show early. Each future payment is its own small savings goal.
// Costs are illustrative starting points, never a standard to meet. Pure - no DOM.

import { REFERENCE } from '../finance/maths.js';

const EDU = 8;   // school and university fees have tended to rise faster than inflation: illustrative

/**
 * The starting list. `every`: 'year' (each year of age from `from` to `to`) or
 * 'once' (at age `from`). Costs are in today's rands, a year or once. `how`:
 * 'budget' - paid from the monthly budget as it comes (school fees), or 'save'
 * (the default) - saved for ahead (studies, a first car).
 */
export const MILESTONES = [
  { id: 'daycare', how: 'budget', name: 'Day care or creche', group: 'Early years', from: 1, to: 5, every: 'year', cost: 36000, growthPct: EDU, on: true },
  { id: 'primary', how: 'budget', name: 'Primary school fees', group: 'School', from: 6, to: 12, every: 'year', cost: 25000, growthPct: EDU, on: true, hint: 'No-fee schools cost nothing; private schools can be R100 000 or more a year.' },
  { id: 'high', how: 'budget', name: 'High school fees', group: 'School', from: 13, to: 17, every: 'year', cost: 35000, growthPct: EDU, on: true },
  { id: 'kit', how: 'budget', name: 'Uniforms, books, stationery and a device', group: 'School', from: 6, to: 17, every: 'year', cost: 6000, growthPct: REFERENCE.cpi.value, on: true },
  { id: 'activities', how: 'budget', name: 'Sport, music and other activities', group: 'School', from: 6, to: 17, every: 'year', cost: 6000, growthPct: REFERENCE.cpi.value, on: true },
  { id: 'tours', name: 'School tours and matric farewell', group: 'School', from: 17, to: 17, every: 'once', cost: 8000, growthPct: REFERENCE.cpi.value, on: false },
  { id: 'tuition', name: 'University or college fees', group: 'Studies', from: 18, to: 20, every: 'year', cost: 70000, growthPct: EDU, on: true, hint: 'Three years. Change the ages for a longer degree.' },
  { id: 'living', name: 'Living away from home while studying', group: 'Studies', from: 18, to: 20, every: 'year', cost: 80000, growthPct: REFERENCE.cpi.value, on: false, hint: 'Residence or a flat, food and transport.' },
  { id: 'licence', name: 'Driving lessons and licence', group: 'Starting out', from: 18, to: 18, every: 'once', cost: 8000, growthPct: REFERENCE.cpi.value, on: true },
  { id: 'car', name: 'Help with a first car', group: 'Starting out', from: 19, to: 19, every: 'once', cost: 60000, growthPct: REFERENCE.cpi.value, on: false },
  { id: 'deposit', name: 'Help with a first rental or home deposit', group: 'Starting out', from: 23, to: 23, every: 'once', cost: 30000, growthPct: REFERENCE.cpi.value, on: false },
  { id: 'wedding', name: 'Wedding contribution', group: 'Starting out', from: 28, to: 28, every: 'once', cost: 80000, growthPct: REFERENCE.cpi.value, on: false },
];

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Age in years, with the fraction (8.5 = eight and a half). */
export function exactAge(born, today) {
  if (!isDay(born) || !isDay(today)) return null;
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${born}T00:00:00Z`)) / (365.2425 * 86400000);
}

/** One child's list: the starting list, with what the family changed or added kept. Removed ones stay, marked, so they do not come back. */
export function normalisePlan(raw = {}) {
  const saved = new Map((Array.isArray(raw.items) ? raw.items : []).filter((x) => x && x.id).map((x) => [x.id, x]));
  const items = MILESTONES.map((m) => ({ ...m, saved: 0, others: 0, ...(saved.get(m.id) ?? {}) }));
  for (const [id, x] of saved) if (!MILESTONES.some((m) => m.id === id)) items.push({ every: 'once', growthPct: REFERENCE.cpi.value, saved: 0, others: 0, on: true, group: 'Our own', ...x });
  return { ...raw, items, shown: items.filter((x) => !x.removed) };
}

/**
 * When each cost falls, and what to put aside for it. A yearly cost falls on the
 * birthday the child turns that age; a year already under way is "now" - part of
 * the monthly budget, not something to save for. Each future payment is grown by
 * its own rate, then: put aside S a month from now, growing at the savings rate,
 * to have it when it falls due. What is saved already (and any help expected) is
 * used for the earliest payments first.
 */
export function schedule(child, items, today, { savingsPct = 6 } = {}) {
  const age = exactAge(child.born, today);
  if (age == null) return { missing: true };
  const r = (1 + num(savingsPct) / 100) ** (1 / 12) - 1;
  const payments = [];
  let nowMonthly = 0;
  const year = Number(today.slice(0, 4));
  for (const it of items.filter((x) => x.on && !x.removed)) {
    const ages = it.every === 'once' ? [num(it.from)] : Array.from({ length: Math.max(0, num(it.to) - num(it.from) + 1) }, (_, k) => num(it.from) + k);
    let pool = num(it.saved) + num(it.others);
    for (const a of ages) {
      const months = Math.round((a - age) * 12);
      if (months <= 0) {
        // Already under way this year of age: in the budget now. Earlier years are past.
        if (it.every === 'year' && a + 1 > age) nowMonthly += num(it.cost) / 12;
        continue;
      }
      const amount = num(it.cost) * (1 + num(it.growthPct) / 100) ** (months / 12);
      const at = year + Math.floor((months + Number(today.slice(5, 7)) - 1) / 12);
      if (it.how === 'budget') { payments.push({ item: it.id, name: it.name, age: a, months, year: at, amount, covered: 0, monthly: 0, budget: true }); continue; }
      const grow = (1 + r) ** months;
      const use = Math.min(pool * grow, amount);
      pool -= use / grow;
      const short = amount - use;
      const monthly = short <= 0 ? 0 : r === 0 ? short / months : (short * r) / (grow - 1);
      payments.push({ item: it.id, name: it.name, age: a, months, year: at, amount, covered: use, monthly });
    }
  }
  payments.sort((a, b) => a.months - b.months);
  return {
    age, payments, nowMonthly,
    monthlyNow: payments.reduce((s, p) => s + p.monthly, 0),
    total: payments.reduce((s, p) => s + p.amount, 0),
    today: payments.reduce((s, p) => s + p.amount / (1 + REFERENCE.cpi.value / 100) ** (p.months / 12), 0),
  };
}

/** What to put aside each month, month by month: it falls as each payment is made. */
export const savingAt = (payments, m) => payments.filter((p) => p.months > m).reduce((s, p) => s + p.monthly, 0);

/**
 * All the children together, by calendar year: what falls due, from whom, and
 * the years where more than one child's costs land at once.
 */
export function family(children) {
  const years = new Map();
  for (const c of children) {
    for (const p of c.plan.payments) {
      const y = years.get(p.year) ?? { year: p.year, total: 0, budget: 0, by: {} };
      y.total += p.amount;
      if (p.budget) y.budget += p.amount;
      y.by[c.id] = (y.by[c.id] ?? 0) + p.amount;
      years.set(p.year, y);
    }
  }
  const rows = [...years.values()].sort((a, b) => a.year - b.year).map((y) => ({ ...y, children: Object.keys(y.by).length }));
  const peak = rows.reduce((m, y) => (!m || y.total > m.total ? y : m), null);
  const budgetPeak = rows.reduce((m, y) => (!m || y.budget > m.budget ? y : m), null);
  return {
    rows, peak, budgetPeak,
    overlap: rows.filter((y) => y.children > 1),
    monthlyNow: children.reduce((s, c) => s + c.plan.monthlyNow, 0),
    nowMonthly: children.reduce((s, c) => s + c.plan.nowMonthly, 0),
    total: children.reduce((s, c) => s + c.plan.total, 0),
  };
}

/**
 * Starting `later` months from now instead: each payment has that much less
 * time. Payments due before then cannot be saved for and must come from the
 * budget at the time.
 */
export function startingLater(payments, later, savingsPct = 6) {
  const r = (1 + num(savingsPct) / 100) ** (1 / 12) - 1;
  let monthly = 0; let unfunded = 0;
  for (const p of payments.filter((x) => !x.budget)) {
    const short = p.amount - p.covered;
    const n = p.months - later;
    if (short <= 0) continue;
    if (n <= 0) { unfunded += short; continue; }
    monthly += r === 0 ? short / n : (short * r) / ((1 + r) ** n - 1);
  }
  return { monthly, unfunded };
}
