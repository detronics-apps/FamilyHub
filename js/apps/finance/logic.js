// Finance (product plan section 14): monthly budgets (planned against actual)
// and savings and debt goals with projections whose assumptions are always
// visible. Arithmetic on the family's own numbers - never advice, never a
// promised outcome. Pure - no DOM.

import { addMonths } from '../../dates.js';

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const r2 = (n) => Math.round(n * 100) / 100;
const listOf = (v, fn) => (Array.isArray(v) ? v : []).map(fn).filter(Boolean);

/* ------------------------------------------------------------- budget */

export const monthId = (month) => `month_${month.replace('-', '')}`;
export const monthOf = (day) => day.slice(0, 7);
export const shiftMonth = (month, n) => addMonths(`${month}-01`, n).slice(0, 7);

export function normaliseMonth(m = {}, month) {
  return {
    ...m,
    month: /^\d{4}-\d{2}$/.test(m.month ?? '') ? m.month : month,
    lines: listOf(m.lines, (l, i) => (l && str(l.category) ? { id: str(l.id, 40) || `l${i}`, category: str(l.category, 60), planned: money(l.planned) ?? 0 } : null)),
    spends: listOf(m.spends, (s, i) => (s && money(s.amount) != null ? {
      id: str(s.id, 40) || `s${i}`, day: /^\d{4}-\d{2}-\d{2}$/.test(s.day ?? '') ? s.day : null,
      category: str(s.category, 60) || 'Other', amount: money(s.amount), note: str(s.note, 200), who: typeof s.who === 'string' ? s.who : null,
    } : null)),
    income: listOf(m.income, (x, i) => (x && str(x.what) ? { id: str(x.id, 40) || `i${i}`, what: str(x.what, 100), amount: money(x.amount) ?? 0 } : null)),
  };
}

/** Per category: planned, spent, left. Spending in a category with no plan is shown, not hidden. */
export function monthSummary(m) {
  const cats = new Map();
  for (const l of m.lines) cats.set(l.category.toLowerCase(), { category: l.category, planned: l.planned, spent: 0, planned_: true });
  for (const s of m.spends) {
    const k = s.category.toLowerCase();
    if (!cats.has(k)) cats.set(k, { category: s.category, planned: 0, spent: 0, planned_: false });
    cats.get(k).spent += s.amount;
  }
  const rows = [...cats.values()].map((c) => ({ category: c.category, planned: r2(c.planned), spent: r2(c.spent), left: r2(c.planned - c.spent), unplanned: !c.planned_ }));
  const total = (k) => r2(rows.reduce((s, r) => s + r[k], 0));
  const income = r2(m.income.reduce((s, x) => s + x.amount, 0));
  return { rows, planned: total('planned'), spent: total('spent'), left: total('left'), income, afterPlan: r2(income - total('planned')) };
}

/** Next month starts from this month's plan (no spending copied). */
export const copyMonth = (from, month) => ({ month, lines: from.lines.map((l) => ({ ...l })), spends: [], income: from.income.map((x) => ({ ...x })) });

let n = 0;
const nextId = (p) => `${p}${Date.now().toString(36)}${(n += 1)}`;
export const addSpend = (m, s) => (money(s.amount) == null ? m : { ...m, spends: [...m.spends, { id: nextId('s'), day: s.day ?? null, category: str(s.category, 60) || 'Other', amount: money(s.amount), note: str(s.note, 200), who: s.who ?? null }] });
export const addLine = (m, category, planned) => (str(category) ? { ...m, lines: [...m.lines, { id: nextId('l'), category: str(category, 60), planned: money(planned) ?? 0 }] } : m);
export const addIncome = (m, what, amount) => (str(what) ? { ...m, income: [...m.income, { id: nextId('i'), what: str(what, 100), amount: money(amount) ?? 0 }] } : m);
export const removeFrom = (m, list, id) => ({ ...m, [list]: m[list].filter((x) => x.id !== id) });

/* -------------------------------------------------------------- goals */

export const GOAL_KINDS = { saving: 'Saving towards', debt: 'Paying off' };

export function normaliseGoal(g = {}) {
  const rate = money(g.ratePct);
  return {
    ...g,
    title: str(g.title, 200) || 'A goal',
    kind: GOAL_KINDS[g.kind] ? g.kind : 'saving',
    target: Math.max(0, money(g.target) ?? 0),          // saving: the amount wanted; debt: unused
    current: Math.max(0, money(g.current) ?? 0),        // saving: saved so far; debt: still owed
    monthly: Math.max(0, money(g.monthly) ?? 0),
    ratePct: rate == null ? null : Math.min(100, Math.max(0, rate)),
    owner: typeof g.owner === 'string' && g.owner ? g.owner : 'household',
    targetDay: /^\d{4}-\d{2}-\d{2}$/.test(g.targetDay ?? '') ? g.targetDay : null,
    notes: str(g.notes, 2000),
  };
}

export const goalSummary = (g) => ({ title: g.title, kind: g.kind, owner: g.owner, target: g.target, current: g.current });

const MAX_MONTHS = 600;   // 50 years: past this, "not within 50 years" is the honest answer

/**
 * Saving: months until the target if `monthly` goes in each month and the
 * yearly rate stays the same (compounded monthly). Null when it never gets there.
 */
export function projectSaving({ current, target, monthly, ratePct }) {
  if (current >= target) return { months: 0, reachedAt: 0 };
  const r = (ratePct ?? 0) / 100 / 12;
  let bal = current;
  for (let m = 1; m <= MAX_MONTHS; m += 1) {
    bal = bal * (1 + r) + monthly;
    if (bal >= target - 0.005) return { months: m, balance: r2(bal) };
  }
  return { months: null };
}

/**
 * Debt: months to pay it off at `monthly` with the yearly interest rate, and
 * the total interest on the way. If the payment does not cover the interest,
 * it never pays off - said plainly, with the payment that would.
 */
export function projectDebt({ current, monthly, ratePct }) {
  if (current <= 0) return { months: 0, interest: 0 };
  const r = (ratePct ?? 0) / 100 / 12;
  if (monthly <= current * r + 0.005) return { months: null, interest: null, minimum: r2(current * r + 0.01) };
  let bal = current;
  let interest = 0;
  for (let m = 1; m <= MAX_MONTHS; m += 1) {
    const i = bal * r;
    interest += i;
    bal = bal + i - monthly;
    if (bal <= 0.005) return { months: m, interest: r2(interest) };
  }
  return { months: null, interest: null };
}

export function projection(g, today) {
  const p = g.kind === 'debt' ? projectDebt(g) : projectSaving(g);
  return { ...p, day: p.months == null ? null : addMonths(today, p.months) };
}

/** Saving progress as a share; debt has no target to measure against here. */
export const progress = (g) => (g.kind === 'saving' && g.target > 0 ? Math.min(1, g.current / g.target) : null);

export function recordAmount(g, amount) {
  const a = money(amount);
  if (a == null || a <= 0) return g;
  return { ...g, current: g.kind === 'debt' ? r2(Math.max(0, g.current - a)) : r2(g.current + a) };
}

/**
 * Totals per owner and for the household, each goal counted exactly once -
 * a shared goal is never added to anyone's personal total as well.
 */
export function goalTotals(goals) {
  const out = {};
  for (const g of goals) {
    const o = (out[g.owner] ??= { saved: 0, owed: 0 });
    if (g.kind === 'debt') o.owed = r2(o.owed + g.current); else o.saved = r2(o.saved + g.current);
  }
  const all = Object.values(out).reduce((a, o) => ({ saved: r2(a.saved + o.saved), owed: r2(a.owed + o.owed) }), { saved: 0, owed: 0 });
  return { byOwner: out, all };
}
