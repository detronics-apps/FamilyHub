// Salary and costs (D-119): is the salary keeping up with the family's own costs?
// Each cost rises at its own rate - the family's own, or a sourced starting figure
// labelled Estimated - and life events add costs from their dates. Arithmetic on
// the family's own numbers - never advice. Pure - no DOM.

import { REFERENCE } from '../finance/maths.js';
import { estimatePay } from '../jobs/logic.js';

/** Stats SA, average consumer inflation for each calendar year; 2026 is the latest month's figure. */
export const CPI = {
  byYear: { 2020: 3.3, 2021: 4.5, 2022: 6.9, 2023: 6.0, 2024: 4.4, 2025: 3.2, 2026: REFERENCE.cpi.value },
  future: REFERENCE.cpi.value,
  source: `Stats SA yearly averages; 2026: ${REFERENCE.cpi.source}`,
};

/** Medical schemes' weighted average contribution increases, as each scheme announced them. */
export const SCHEMES = {
  discovery: { label: 'Discovery', byYear: { 2025: 9.3, 2026: 7.2 } },
  bonitas: { label: 'Bonitas', byYear: { 2025: 10.2, 2026: 8.8 } },
  momentum: { label: 'Momentum', byYear: { 2026: 9.9 } },
  fedhealth: { label: 'Fedhealth', byYear: { 2026: 9.6 } },
  medihelp: { label: 'Medihelp', byYear: { 2026: 8.46 } },
  bestmed: { label: 'Bestmed', byYear: { 2026: 6.8 } },
};
export const SCHEME_SOURCE = 'The schemes’ announced 2026 averages (2025 for Discovery and Bonitas), as reported by Moonstone and BusinessTech';

export const RENT = { national: 4.7, wc: 9.7, source: 'PayProp Rental Index, 2026: national (Q1), Western Cape (Q2)' };
export const ELECTRICITY = { byYear: { 2026: 9.01 }, future: 9.01, source: 'NERSA municipal increase for 2026/27' };

/** What each cost is, and so which starting rate it rises by. */
export const KINDS = {
  other: 'Everything else',
  rent: 'Rent',
  bond: 'Bond',
  medical: 'Medical aid',
  petrol: 'Petrol',
  electricity: 'Electricity',
  food: 'Food',
};

/** The starting rate for one cost in one calendar year (null year: from now on), and where it comes from. */
export function startingRate(cost, year = null) {
  const cpi = () => ({ pct: (year != null ? CPI.byYear[year] : null) ?? CPI.future, source: year == null ? `${REFERENCE.cpi.label}, ${REFERENCE.cpi.source}` : CPI.source });
  if (cost.kind === 'bond') return { pct: 0, source: 'A bond moves with the interest rate, not with prices' };
  if (cost.kind === 'electricity') { const p = year != null ? ELECTRICITY.byYear[year] : ELECTRICITY.future; return p != null ? { pct: p, source: ELECTRICITY.source } : cpi(); }
  if (cost.kind === 'rent' && (year == null || year >= 2026)) return { pct: cost.region === 'wc' ? RENT.wc : RENT.national, source: RENT.source };
  if (cost.kind === 'medical' && SCHEMES[cost.scheme]) {
    const s = SCHEMES[cost.scheme].byYear;
    const p = year == null ? s[2026] : s[year] ?? (year > 2026 ? s[2026] : null);
    if (p != null) return { pct: p, source: SCHEME_SOURCE };
  }
  return cpi();
}

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const isMonth = (m) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m);
export const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
export function addMonth(m, n) {
  const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export const DEFAULTS = {
  salary: null, salaryPer: 'year', salaryKind: 'gross', start: null,
  raises: [], raisePct: null, costs: [], events: [], ahead: 10,
};

/** The yearly raise assumed after your last raise entry: yours, or CPI (Estimated). */
export const futureRaise = (v) => num(v.raisePct) ?? CPI.future;

/**
 * Raises are entries the person adds - a month and a percentage - on no assumed timeline
 * (D-125): every 6 months, a month after starting, whenever. Saved before D-125 they were one
 * figure per anniversary of starting; those are read as dated entries on those anniversaries.
 * Only raises after the start month count: the start salary already includes anything before.
 * An entry gives the percentage, or the new salary from that month on (D-126), in the same
 * terms as the salary you started on (a year or a month, before tax or take-home).
 */
export function raiseEntries(v, start) {
  const list = Array.isArray(v.raises) ? v.raises : [];
  return list.map((r, i) => {
    if (typeof r === 'number' || r === null) return num(r) ? { month: addMonth(start, 12 * (i + 1)), pct: num(r) } : null;
    if (!r || !isMonth(r.month)) return null;
    if (num(r.salary) > 0) return { id: r.id, month: r.month, salary: num(r.salary) };
    return num(r.pct) != null ? { id: r.id, month: r.month, pct: num(r.pct) } : null;
  }).filter((r) => r && r.month > start).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Month by month from the start to `ahead` years after today.
 * Salary: the start salary with each raise entry in its own month, then the assumed raise.
 * Take-home: a payslip figure grows with the raises; a gross salary is worked
 * through the SARS tables each month (so tax takes a growing share).
 * Each cost grows by its own rate: the family's "then and now" for the past,
 * its own % from now on, otherwise its starting rate for that calendar year.
 * Needed: the costs, the life events and what was left over at the start
 * (kept in step with the family's own prices), less any income an event adds.
 */
export function plan(input, today) {
  const v = { ...DEFAULTS, ...input };
  const s0 = num(v.salary);
  if (!(s0 > 0)) return { missing: ['the salary you started on'] };
  const now = today.slice(0, 7);
  const start = isMonth(v.start) && v.start < now ? v.start : now;
  const T = monthsBetween(start, now);
  const N = T + 12 * Math.max(1, Math.min(40, num(v.ahead) ?? 10));
  const per = v.salaryPer === 'month' ? 1 : 12;
  const monthly = s0 / per;
  // Each raise on its own month; after the last one (or today, if later) the assumed yearly
  // raise is spread month by month - no timeline is assumed for it.
  const entries = raiseEntries(v, start);
  const assumedFrom = [now, ...entries.map((r) => r.month)].sort().at(-1);
  const assumedStep = (1 + futureRaise(v) / 100) ** (1 / 12);
  const costs = (v.costs ?? []).filter((c) => c && num(c.amount) > 0);

  // Each cost's monthly growth for the step into month m (m >= 1).
  const stepOf = (c, m) => {
    if (m <= T && num(c.now) > 0 && T > 0) return (num(c.now) / num(c.amount)) ** (1 / T);
    const own = m > T ? num(c.pct) : null;
    const pct = own ?? startingRate(c, m > T ? null : Number(addMonth(start, m).slice(0, 4))).pct;
    return (1 + pct / 100) ** (1 / 12);
  };
  const cpiStep = (m) => (1 + (m > T ? CPI.future : CPI.byYear[Number(addMonth(start, m).slice(0, 4))] ?? CPI.future) / 100) ** (1 / 12);

  const F = costs.map(() => [1]);
  const cpi = [1];
  const pay = [monthly];
  for (let m = 1; m <= N; m += 1) {
    costs.forEach((c, i) => F[i].push(F[i][m - 1] * stepOf(c, m)));
    cpi.push(cpi[m - 1] * cpiStep(m));
    const month = addMonth(start, m);
    // A new salary replaces the pay; a percentage raises it - each entry then shows the other worked out.
    let p = pay[m - 1];
    for (const r of entries.filter((x) => x.month === month)) {
      const next = r.salary != null ? r.salary / per : p * (1 + r.pct / 100);
      Object.assign(r, { pct: (next / p - 1) * 100, salary: next * per });
      p = next;
    }
    pay.push(p * (month > assumedFrom ? assumedStep : 1));
  }
  const estimated = v.salaryKind !== 'takehome';
  const takeHomeOf = (g) => (estimated ? estimatePay({ grossMonthly: g }).monthly : g);
  const factorOf = (id, m) => { const i = costs.findIndex((c) => c.id === id); return i >= 0 ? F[i][m] / F[i][T] : cpi[m] / cpi[T]; };
  const events = (v.events ?? []).filter((e) => e && isMonth(e.from) && num(e.amount));   // a move can cost less: a minus amount
  const basket0 = costs.reduce((s, c) => s + num(c.amount), 0);
  const left0 = Math.max(0, takeHomeOf(monthly) - basket0);

  const rows = [];
  for (let m = 0; m <= N; m += 1) {
    const month = addMonth(start, m);
    const basket = costs.reduce((s, c, i) => s + num(c.amount) * F[i][m], 0);
    const own = basket0 > 0 ? basket / basket0 : cpi[m];
    let added = 0; let income = 0;
    for (const e of events) {
      if (e.from > month) continue;
      const amt = num(e.amount) * factorOf(e.risesWith, m);
      if (e.kind === 'income') income += amt; else added += amt;
    }
    const takeHome = takeHomeOf(pay[m]);
    const needed = basket + added - income + left0 * own;
    rows.push({ m, month, salary: pay[m], takeHome, basket, added, income, own, cpi: cpi[m], real: takeHome / own, realCpi: takeHome / cpi[m], needed, gap: takeHome - needed });
  }
  const at = (m) => rows[Math.max(0, Math.min(N, m))];
  // The table's rows: the start, each raise in its own month, today, then a year at a time ahead -
  // never the anniversaries of starting, which no raise need fall on (owner, 2026-11-14). Each row's
  // changes are since the row above.
  const raiseAt = new Set(entries.map((r) => monthsBetween(start, r.month)).filter((m) => m > 0 && m <= N));
  const ahead = Array.from({ length: Math.floor((N - T) / 12) }, (_, k) => T + 12 * (k + 1));
  const marks = [...new Set([0, ...raiseAt, T, ...ahead, N])].sort((a, b) => a - b);
  const years = marks.map((m, i) => {
    const r = at(m); const p = i ? at(marks[i - 1]) : null;
    return {
      ...r, today: m === T, raise: raiseAt.has(m),
      payPct: p ? (r.salary / p.salary - 1) * 100 : null,
      ownPct: p ? (r.own / p.own - 1) * 100 : null,
      cpiPct: p ? (r.cpi / p.cpi - 1) * 100 : null,
    };
  });
  const where = costs.map((c, i) => ({ id: c.id, name: c.name || KINDS[c.kind] || 'A cost', start: num(c.amount), now: num(c.amount) * F[i][T], change: num(c.amount) * (F[i][T] - 1) })).sort((a, b) => b.change - a.change);
  const first = rows.find((r) => r.m >= T && r.gap < -0.5)?.m ?? null;
  return { rows, years, where, T, N, start, estimated, left0, basket0, shortFrom: first, at, entries, assumedFrom };
}

/** One rate tested 2 points either side: how much the gap at month m moves. */
export function whatMoves(input, today, m) {
  const v = { ...DEFAULTS, ...input };
  const base = plan(v, today);
  if (base.missing) return [];
  const gap = (x) => plan(x, today).at(m).gap;
  const g0 = base.at(m).gap;
  const rows = [{ label: 'Your raises', low: gap({ ...v, raisePct: futureRaise(v) - 2 }) - g0, high: gap({ ...v, raisePct: futureRaise(v) + 2 }) - g0 }];
  for (const c of v.costs ?? []) {
    if (!(num(c.amount) > 0) || (c.kind === 'bond' && num(c.pct) == null)) continue;   // a bond follows the interest rate, not prices
    const p = num(c.pct) ?? startingRate(c).pct;
    const with_ = (d) => gap({ ...v, costs: v.costs.map((x) => (x === c ? { ...x, pct: p + d } : x)) }) - g0;
    rows.push({ label: c.name || KINDS[c.kind], low: with_(2), high: with_(-2) });
  }
  return rows.sort((a, b) => Math.max(Math.abs(b.low), Math.abs(b.high)) - Math.max(Math.abs(a.low), Math.abs(a.high)));
}

/** A cost's kind guessed from a budget name: Rent or bond, Medical aid, Petrol, Electricity, Food. */
export function kindFromName(name) {
  const n = String(name ?? '').toLowerCase();
  if (/bond|home loan/.test(n) && !/rent/.test(n)) return 'bond';
  if (/rent/.test(n)) return 'rent';
  if (/medical aid/.test(n)) return 'medical';
  if (/petrol|fuel|diesel/.test(n)) return 'petrol';
  if (/electric/.test(n)) return 'electricity';
  if (/food|grocer/.test(n)) return 'food';
  return 'other';
}

/**
 * Costs from a month's budget: items whose kind has its own rate stand alone;
 * the rest of each category is one cost rising with CPI.
 */
export function costsFromBudget(month) {
  const out = [];
  let n = 0;
  const add = (name, amount, kind) => { if (amount > 0) out.push({ id: `b${(n += 1)}`, name, kind, amount: Math.round(amount * 100) / 100 }); };
  for (const l of month?.lines ?? []) {
    if (l.off) continue;
    const items = (l.items ?? []).filter((x) => !x.off);
    if (!items.length) { add(l.category, Number(l.planned) || 0, kindFromName(l.category)); continue; }
    let rest = 0;
    for (const x of items) {
      const k = kindFromName(x.name);
      if (k !== 'other' && k !== 'food') add(x.name, Number(x.planned) || 0, k); else rest += Number(x.planned) || 0;
    }
    add(l.category, rest, kindFromName(l.category));
  }
  return out;
}
