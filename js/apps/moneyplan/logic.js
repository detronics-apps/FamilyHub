// The money plan (D-070): every goal on one timeline, and whether the money each
// month can carry them all. Goals are allocations of money, not costs - nothing
// here is counted twice with the monthly commitments. Pure - no DOM.
//
// A goal has one or more payments (an amount by a month) and may change the
// monthly commitments from some month on (a new bond, school fees starting).
// Each month the money left over goes to the goal due soonest; a goal that is
// not fully funded by its month is short, and the plan says by how much.

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

/** 'YYYY-MM', n months after today's month. */
export function monthAt(today, n = 0) {
  const t = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
/** Months from today's month to `ym` (0 = this month). */
export const monthsTo = (today, ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - (Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)));

export function normaliseGoal(g = {}) {
  return {
    id: String(g.id ?? ''),
    title: String(g.title ?? '').trim() || 'A goal',
    source: g.source && typeof g.source === 'object' ? { app: String(g.source.app ?? ''), id: String(g.source.id ?? ''), label: String(g.source.label ?? '') } : null,
    payments: (Array.isArray(g.payments) ? g.payments : []).filter((p) => p && isMonth(p.month)).map((p) => ({ month: p.month, amount: Math.max(0, num(p.amount)) })),
    monthly: (Array.isArray(g.monthly) ? g.monthly : []).filter((p) => p && isMonth(p.from)).map((p) => ({ from: p.from, amount: num(p.amount) })),
    saved: Math.max(0, num(g.saved)),
    must: g.must === true,
    on: g.on !== false,
    note: String(g.note ?? ''),
  };
}

// Income and commitments rise once a year by their own rate (inflation, as an assumption), so a
// cost growing for twenty years is not set against an income frozen at today's.
export const PLAN_DEFAULTS = { income: null, commitments: null, keepBack: null, incomeRisePct: 4.5, commitmentsRisePct: 4.5, emergencyMonths: 3, emergencySaved: null, emergencyBy: null, savingsPct: 6, goals: [] };

export function normalisePlan(raw = {}) {
  const p = { ...PLAN_DEFAULTS, ...raw };
  return { ...p, goals: (Array.isArray(p.goals) ? p.goals : []).map(normaliseGoal) };
}

/** What is left to put towards goals each month, before any goal changes the commitments. */
export const freeEachMonth = (p) => num(p.income) - num(p.commitments) - num(p.keepBack);

/** The emergency fund as a goal of its own: a few months of commitments, by a month. */
export function emergencyGoal(p, today) {
  const target = num(p.emergencyMonths) * num(p.commitments);
  if (!(target > 0)) return null;
  return normaliseGoal({ id: 'emergency', title: 'Emergency fund', must: true, saved: num(p.emergencySaved), payments: [{ month: isMonth(p.emergencyBy) ? p.emergencyBy : monthAt(today, 12), amount: target }] });
}

/**
 * Run the plan month by month.
 * options: extra (more put aside each month), shift ({ goalId: months later }),
 * only (a goal filter), jobDelta (m => change in money each month), more (extra goals).
 */
export function simulate(plan, today, { extra = 0, shift = {}, only = null, jobDelta = () => 0, more = [] } = {}) {
  const p = normalisePlan(plan);
  const r = (1 + num(p.savingsPct) / 100) ** (1 / 12) - 1;
  const goals = [emergencyGoal(p, today), ...p.goals.filter((g) => g.on), ...more.map(normaliseGoal)].filter(Boolean).filter((g) => !only || only(g));
  const pays = [];
  for (const g of goals) {
    const k = num(shift[g.id]);
    let pool = g.saved;
    for (const pay of g.payments.map((x) => ({ m: Math.max(0, monthsTo(today, x.month) + k), amount: x.amount })).sort((a, b) => a.m - b.m)) {
      const grow = (1 + r) ** pay.m;
      const use = Math.min(pool * grow, pay.amount);
      pool -= use / grow;
      pays.push({ goal: g.id, title: g.title, must: g.must, m: pay.m, amount: pay.amount, fund: use / grow, alone: 0, short: 0 });
    }
  }
  pays.sort((a, b) => a.m - b.m);
  // Each payment on its own: put aside S a month from next month to have it when due.
  for (const x of pays) {
    const left = x.amount - x.fund * (1 + r) ** x.m;
    x.alone = left <= 0.005 || x.m === 0 ? 0 : r === 0 ? left / x.m : (left * r) / ((1 + r) ** x.m - 1);
  }
  const steps = goals.flatMap((g) => g.monthly.map((s) => ({ m: Math.max(1, monthsTo(today, s.from) + num(shift[g.id])), amount: s.amount })));
  const H = Math.max(12, ...pays.map((x) => x.m));
  const yearOf = (m) => Math.floor((m - 1) / 12);
  const free = (m) => num(p.income) * (1 + num(p.incomeRisePct) / 100) ** yearOf(m) - num(p.commitments) * (1 + num(p.commitmentsRisePct) / 100) ** yearOf(m) - num(p.keepBack) + num(extra);
  const months = [];
  let spare = 0;
  const open = pays.filter((x) => x.m > 0);
  for (const x of pays.filter((y) => y.m === 0)) x.short = Math.max(0, x.amount - x.fund);
  for (let m = 1; m <= H; m += 1) {
    const avail = free(m) + jobDelta(m) - steps.filter((s) => s.m <= m).reduce((s, x) => s + x.amount, 0);
    spare *= 1 + r;
    for (const x of open) x.fund *= 1 + r;
    let cash = avail + spare;
    let deficit = 0;
    if (cash < 0) { deficit = -cash; cash = 0; }
    for (const x of open) {
      if (x.m < m || cash <= 0) continue;
      const need = x.amount / (1 + r) ** (x.m - m) - x.fund;
      if (need <= 0) continue;
      const give = Math.min(cash, need);
      x.fund += give; cash -= give;
    }
    spare = cash;
    for (const x of open.filter((y) => y.m === m)) x.short = Math.max(0, x.amount - x.fund);
    months.push({ m, avail, needed: pays.filter((x) => x.m >= m).reduce((s, x) => s + x.alone, 0), deficit, due: pays.filter((x) => x.m === m).reduce((s, x) => s + x.amount, 0), short: pays.filter((x) => x.m === m).reduce((s, x) => s + x.short, 0) });
  }
  const byGoal = new Map(goals.map((g) => [g.id, { id: g.id, title: g.title, must: g.must, short: 0, firstShort: null, alone: 0, total: 0 }]));
  for (const x of pays) {
    const b = byGoal.get(x.goal);
    b.short += x.short < 1 ? 0 : x.short;
    b.total += x.amount;
    if (x.short >= 1 && (b.firstShort == null || x.m < b.firstShort)) b.firstShort = x.m;
    if (x.m >= 1) b.alone += x.alone;
  }
  const shortGoals = [...byGoal.values()].filter((g) => g.short >= 1);
  return {
    goals: [...byGoal.values()], payments: pays, months,
    availNow: months[0]?.avail ?? free(1),
    neededNow: months[0]?.needed ?? 0,
    fits: shortGoals.length === 0,
    short: shortGoals,
    shortTotal: shortGoals.reduce((s, g) => s + g.short, 0),
    deficitMonths: months.filter((x) => x.deficit > 0.5).length,
    deficitFrom: months.find((x) => x.deficit > 0.5)?.m ?? null,
    spareEnd: spare,
  };
}

/** The least extra a month that makes everything fit (null if even R1 million a month would not). */
export function extraToFit(plan, today, opts = {}) {
  if (simulate(plan, today, opts).fits) return 0;
  let lo = 0; let hi = 1000000;
  if (!simulate(plan, today, { ...opts, extra: hi }).fits) return null;
  for (let i = 0; i < 40 && hi - lo > 1; i += 1) {
    const mid = (lo + hi) / 2;
    if (simulate(plan, today, { ...opts, extra: mid }).fits) hi = mid; else lo = mid;
  }
  return Math.ceil(hi);
}

/** How many months later one goal would have to be, for it to be fully funded (null: not within 10 years). */
export function postponeToFit(plan, today, goalId, opts = {}) {
  const ok = (k) => !(simulate(plan, today, { ...opts, shift: { ...(opts.shift ?? {}), [goalId]: k } }).goals.find((g) => g.id === goalId)?.short >= 1);
  if (ok(0)) return 0;
  if (!ok(120)) return null;
  let lo = 0; let hi = 120;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}
