// Our bond, as it really went (D-075): what was paid each month over different
// periods, extra amounts paid in, money taken out again, and rate changes - then
// where the bond stands today and what paying extra from now would do. Pure - no DOM.
//
// How the bank is assumed to behave (an access bond, as most SA home loans are):
// paying more than the instalment does not lower the instalment - it shortens the
// bond. Taking money out again, or a rate change, makes the bank work the minimum
// instalment out again over the months that are left.

import { monthlyRate, payment } from '../finance/maths.js';

export const EVENT_KINDS = {
  pay: 'Paid each month',
  extra: 'Paid in once',
  withdraw: 'Took out',
  rate: 'Rate changed',
};

const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);
/** Months from `a` to `b` ('YYYY-MM'): 0 is the same month. */
export const monthsFrom = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
export const addMonthsYM = (a, n) => { const t = Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)) - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

export function normaliseEvents(list) {
  return (Array.isArray(list) ? list : []).filter((e) => e && EVENT_KINDS[e.kind] && isMonth(e.from))
    .map((e) => ({ kind: e.kind, from: e.from, to: isMonth(e.to) ? e.to : null, amount: Number(e.amount) || 0 }));
}

/**
 * Month by month from the first payment (the month after `start`) until the bond
 * is paid off. Returns the months, what was paid, interest, the balance each month,
 * and notes on anything unusual (a payment below the minimum is raised to it).
 */
export function runBond({ loan, ratePct, termYears, start, events = [], fromMonth = null, extraFrom = 0 }) {
  const L = Number(loan) || 0;
  const n = Math.max(1, Math.round((Number(termYears) || 0) * 12));
  if (!(L > 0) || !isMonth(start)) return { missing: true };
  const ev = normaliseEvents(events).map((e) => ({ ...e, at: monthsFrom(start, e.from), until: e.to ? monthsFrom(start, e.to) : null }));
  let r = monthlyRate(ratePct);
  let bal = L;
  let minPmt = payment(L, r, n);
  let interest = 0; let paid = 0; let taken = 0;
  const rows = [{ m: 0, ym: start, balance: L, minPmt, paidThis: 0, interestThis: 0 }];
  const notes = [];
  for (let m = 1; m <= 720 && bal > 0.005; m += 1) {
    for (const e of ev.filter((x) => x.kind === 'rate' && x.at === m)) { r = monthlyRate(e.amount); minPmt = payment(bal, r, Math.max(1, n - m + 1)); }
    const i = bal * r;
    const chosen = ev.filter((x) => x.kind === 'pay' && x.at <= m && (x.until == null || m <= x.until)).at(-1);
    let pay = chosen ? chosen.amount : minPmt;
    if (chosen && pay < minPmt - 0.5) { notes.push({ m, text: `${addMonthsYM(start, m)}: R${Math.round(pay)} is below the minimum of R${Math.round(minPmt)} - the minimum is used.` }); pay = minPmt; }
    if (fromMonth != null && m >= fromMonth) pay += extraFrom;
    pay = Math.min(pay, bal + i);
    bal = bal + i - pay;
    interest += i; paid += pay;
    for (const e of ev.filter((x) => x.at === m)) {
      if (e.kind === 'extra') { const x = Math.min(e.amount, bal); bal -= x; paid += x; }
      if (e.kind === 'withdraw') { bal += e.amount; taken += e.amount; minPmt = payment(bal, r, Math.max(1, n - m)); }
    }
    rows.push({ m, ym: addMonthsYM(start, m), balance: Math.max(0, bal), minPmt, paidThis: pay, interestThis: i });
  }
  const end = rows.at(-1);
  return { rows, months: end.m, paidOff: end.balance <= 0.005 ? end.ym : null, interest, paid, taken, notes: notes.slice(0, 5), plannedMonths: n };
}

/** Where things stand on a given month, and what paying `extra` more a month from then would do. */
export function bondNow(input, today) {
  const ym = today.slice(0, 7);
  const actual = runBond(input);
  if (actual.missing) return { missing: true };
  const now = Math.max(0, Math.min(monthsFrom(input.start, ym), actual.months));
  const at = actual.rows[now];
  const plain = runBond({ ...input, events: [] });
  const withExtra = (extra) => runBond({ ...input, fromMonth: now + 1, extraFrom: extra });
  return { actual, plain, now, owedNow: at.balance, minNow: at.minPmt, withExtra };
}
