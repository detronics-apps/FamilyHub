// What each situation did (D-087): every line under "What happened, over the years" and the
// ticked "What if…" lines, each taken out on its own and the whole home worked out again on
// the same money - so paying more is set against investing that money instead, and taking
// money out against leaving it in the bond. Pure - no DOM.

import { homePlan, sameMoney, scenarioEvents, SCENARIO_KINDS } from './home.js';
import { EVENT_KINDS, monthsFrom } from './bondlog.js';

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const isMonth = (x) => typeof x === 'string' && /^\d{4}-\d{2}$/.test(x);
const R = (x) => `R${String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymName = (ym) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** "Paid R3 000 more a month, Jan 2019 to Jun 2022" - one line, in words. */
export function situationLabel(e) {
  const a = R(num(e.amount));
  const span = e.to ? `${ymName(e.from)} to ${ymName(e.to)}` : `from ${ymName(e.from)}`;
  if (e.kind === 'more') return `${a} more a month, ${span}`;
  if (e.kind === 'pay') return `${a} a month, ${span}`;
  if (e.kind === 'extra') return `${a} paid in, ${ymName(e.from)}`;
  if (e.kind === 'withdraw') return `${a} taken out, ${ymName(e.from)}${e.use === 'spent' ? ' (spent)' : ''}`;
  return `Rate to ${num(e.amount)}%, ${ymName(e.from)}`;
}

/** The lines that count: the bond's real history (owned) and the ticked what-ifs. */
export function situationList(v) {
  const out = [];
  const add = (list, kinds, ok) => (Array.isArray(v[list]) ? v[list] : []).forEach((e, i) => {
    if (e && kinds[e.kind] && isMonth(e.from) && ok(e)) out.push({ key: `${list}:${i}`, list, i, e });
  });
  if (v.kind === 'own') add('bondEvents', EVENT_KINDS, () => true);
  add('scenarios', SCENARIO_KINDS, (e) => scenarioEvents([e]).length > 0);
  return out;
}

const without = (v, keys) => {
  const out = { ...v };
  for (const list of ['bondEvents', 'scenarios']) if (Array.isArray(v[list])) out[list] = v[list].filter((_, i) => !keys.includes(`${list}:${i}`));
  return out;
};

/**
 * @param H  the month the answer is read at (your stay)
 * @returns null without a bond, else { items: [{ key, e, label, past, effect, sooner, interest,
 *   kept, keptPaidOff, moreThanAhead, points }], together, plan, bond }  (interest: saved by it, + or -)
 *   bond: { asIs, without: { key: … }, none } - each { paidOff, interest, owedNow, owed: [[t, owed]] }
 *   effect: what the home leaves you at H with it, minus without it (both on the same money);
 *   points: that difference month by month; past: before the page starts (today) - not measured.
 */
export function situationEffects(v, today, H) {
  const base = homePlan(v, today);
  if (base.missing || !base.bond) return null;
  const list = situationList(v);
  if (!list.length) return { items: [], together: null, plan: base };
  // Before the page starts, "without it" would change where it starts and not what it cost: not measured.
  // From today, that is this month too (it is in what is owed today); from when we bought it, the
  // month we bought is the start itself, so a line beginning then is measured.
  const past = (e) => monthsFrom(base.startYM, e.from) < (base.kind === 'own' && !base.story ? 1 : 0);
  const live = list.filter((s) => !past(s.e));
  const plans = [base];
  const addPlan = (vals) => { const p = homePlan(vals, today); plans.push(p); return plans.length - 1; };
  for (const s of live) {
    s.w = addPlan(without(v, [s.key]));
    // Paying more, then stopping: had it gone on until the bond was paid off.
    if ((s.e.kind === 'more' || s.e.kind === 'pay') && s.e.to) {
      const kept = { ...v, [s.list]: v[s.list].map((x, i) => (i === s.i ? { ...x, to: null } : x)) };
      s.k = addPlan(kept);
    }
  }
  const all = live.length > 1 ? addPlan(without(v, live.map((s) => s.key))) : null;
  const sm = sameMoney(plans, { investPct: v.investPct ?? 9, investTaxPct: v.investTaxPct ?? 15, investShare: v.investShare ?? 100, cash: v.diffCash === true });
  const S = sm.series;
  const at = Math.min(H, S[0].length) - 1;
  const diff = (a, b) => S[a].map((x, j) => [x.t, x.wealth - S[b][j].wealth]);
  // What was paid ahead of the bank's schedule before a take-out (only the rate changes kept).
  const plain = homePlan({ ...v, bondEvents: (v.bondEvents ?? []).filter((e) => e?.kind === 'rate'), scenarios: (v.scenarios ?? []).filter((e) => e?.kind === 'rate') }, today);
  const items = list.map((s) => {
    const label = situationLabel(s.e);
    if (past(s.e)) return { key: s.key, e: s.e, label, past: true };
    const p = plans[s.w];
    const item = {
      key: s.key, e: s.e, label, past: false,
      effect: S[0][at].wealth - S[s.w][at].wealth,
      sooner: p.bond ? p.bond.monthsLeft - base.bond.monthsLeft : 0,
      interest: p.bond ? p.bond.interest - base.bond.interest : 0,
      points: diff(0, s.w),
    };
    if (s.k != null) { item.kept = S[s.k][at].wealth - S[0][at].wealth; item.keptPaidOff = plans[s.k].bond?.paidOff ?? null; }
    if (s.e.kind === 'withdraw') {
      const i = base.months.findIndex((m) => m.ym === s.e.from);
      const before = i > 0 ? base.months[i - 1] : null;
      const sched = before ? plain.months[i - 1]?.owed : null;
      // The bank's schedule less what was really owed, the month before (with this take-out's month excluded).
      if (before && sched != null) item.moreThanAhead = num(s.e.amount) > Math.max(0, sched - before.owed) + 1 ? Math.max(0, sched - before.owed) : null;
    }
    return item;
  });
  const together = all != null ? { effect: S[0][at].wealth - S[all][at].wealth, points: diff(0, all) } : null;
  // The bond itself, each way: paid off, interest over the whole bond, owed today, owed month by month.
  const bondOf = (p) => ({ paidOff: p.bond?.paidOff ?? null, interest: p.bond?.interest ?? 0, owedNow: p.bond?.owedNow ?? 0, owed: p.months.map((m) => [m.t, m.owed]) });
  const bond = { asIs: bondOf(base), without: Object.fromEntries(live.map((s) => [s.key, bondOf(plans[s.w])])), none: all != null ? bondOf(plans[all]) : null };
  return { items, together, plan: base, bond };
}
