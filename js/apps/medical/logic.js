// Medical: the family's outstanding medical accounts - what is owed, what was
// paid and to whom, where each claim to medical aid and gap cover stands, when
// to follow up, and where the proof is kept. Not a medical history: no
// diagnoses, only the money and the paperwork. Pure - no DOM.
//
// A SARS tax year runs 1 March to the end of February and is named by the year
// it ends in: the 2026 tax year is 1 Mar 2025 - 28 Feb 2026.

import { addDays } from '../../dates.js';

export const KINDS = ['account', 'invoice', 'quote'];
export const KIND_LABEL = { account: 'Account', invoice: 'Invoice', quote: 'Quote' };
export const CLAIM = ['none', 'tosend', 'sent', 'paid', 'part', 'declined'];
export const CLAIM_LABEL = { none: 'Not claimed', tosend: 'To send', sent: 'Sent', paid: 'Paid', part: 'Part paid', declined: 'Declined' };
const WAITING = new Set(['tosend', 'sent']);

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
const claim = (v) => (CLAIM.includes(v) ? v : 'none');
const paidTo = (v) => (v === 'us' ? 'us' : 'provider');
const sum = (xs) => xs.reduce((a, b) => a + (b ?? 0), 0);

export function normaliseAccount(r = {}) {
  return {
    ...r,
    provider: str(r.provider, 200) || 'Unnamed provider',
    personId: typeof r.personId === 'string' && r.personId ? r.personId : null,
    kind: KINDS.includes(r.kind) ? r.kind : 'account',
    day: day(r.day),
    amount: num(r.amount),
    due: day(r.due),
    payments: (Array.isArray(r.payments) ? r.payments : [])
      .filter((p) => p && num(p.amount) != null)
      .map((p) => ({ day: day(p.day), amount: num(p.amount), ref: str(p.ref, 120), to: str(p.to, 200) })),
    aidStatus: claim(r.aidStatus), aidSent: day(r.aidSent), aidBack: num(r.aidBack), aidTo: paidTo(r.aidTo),
    gapStatus: claim(r.gapStatus), gapSent: day(r.gapSent), gapBack: num(r.gapBack), gapTo: paidTo(r.gapTo),
    followUp: day(r.followUp), followNote: str(r.followNote),
    proofInvoice: str(r.proofInvoice, 500), proofPayment: str(r.proofPayment, 500), proofClaim: str(r.proofClaim, 500),
    notes: str(r.notes, 2000),
    visibility: 'shared',
  };
}

/** The index keeps everything but the notes: the list and the year view work from it alone. */
export function accountSummary(r) {
  const { notes, ...rest } = r;
  return rest;
}

export const accountText = (r) => [r.provider, r.followNote, r.notes, ...r.payments.map((p) => `${p.ref} ${p.to}`)].join(' ');

/** What we have paid ourselves. */
export const paidByUs = (r) => sum(r.payments.map((p) => p.amount));
/** What medical aid and gap cover paid back to us (not to the provider). */
export const backToUs = (r) => (r.aidTo === 'us' ? r.aidBack ?? 0 : 0) + (r.gapTo === 'us' ? r.gapBack ?? 0 : 0);
/** What medical aid and gap cover paid the provider directly. */
const paidForUs = (r) => (r.aidTo === 'provider' ? r.aidBack ?? 0 : 0) + (r.gapTo === 'provider' ? r.gapBack ?? 0 : 0);

/** Still owed to the provider. A quote owes nothing until it becomes an account. */
export function owed(r) {
  if (r.kind === 'quote' || r.amount == null) return 0;
  return Math.max(0, Math.round((r.amount - paidByUs(r) - paidForUs(r)) * 100) / 100);
}

/** What it has cost us after anything paid back. */
export const outOfPocket = (r) => Math.max(0, paidByUs(r) - backToUs(r));

export const followUpDue = (r, today) => Boolean(r.followUp && r.followUp <= today);

/** The one thing to do next, in a few words, or null when it is all settled. */
export function nextStep(r, today) {
  if (r.kind === 'quote') return 'Quote - nothing owed yet';
  if (followUpDue(r, today)) return r.followNote ? `Follow up: ${r.followNote}` : 'Follow up';
  if (r.aidStatus === 'tosend') return 'Send to medical aid';
  if (r.aidStatus === 'sent') return 'Waiting on medical aid';
  if (r.gapStatus === 'tosend') return 'Send to gap cover';
  if (r.gapStatus === 'sent') return 'Waiting on gap cover';
  if (owed(r) > 0) return 'To pay';
  return null;
}

/** Owed first, soonest due first; then follow-ups; then the newest. */
export function sortAccounts(a, b) {
  const oa = owed(a) > 0; const ob = owed(b) > 0;
  if (oa !== ob) return oa ? -1 : 1;
  if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
  if (Boolean(a.due) !== Boolean(b.due)) return a.due ? -1 : 1;
  return String(b.day ?? '').localeCompare(String(a.day ?? ''));
}

export const FILTERS = {
  outstanding: (r) => owed(r) > 0,
  followup: (r, today) => followUpDue(r, today),
  aid: (r) => WAITING.has(r.aidStatus),
  gap: (r) => WAITING.has(r.gapStatus),
  all: () => true,
};

/** The home tile's line: what falls due this week and the follow-ups waiting. Null when nothing is. */
export function tileNote(all, today) {
  const week = addDays(today, 7);
  const due = all.filter((r) => owed(r) > 0 && r.due && r.due <= week).length;
  const follow = all.filter((r) => followUpDue(r, today)).length;
  const bits = [due ? `${due} due this week` : null, follow ? `${follow} follow-up${follow > 1 ? 's' : ''}` : null].filter(Boolean);
  return bits.length ? bits.join(' · ') : null;
}

/* ------------------------------------------------------------ tax year */

/** The SARS tax year a day falls in, named by the year it ends. */
export const taxYear = (d) => (Number(d.slice(5, 7)) >= 3 ? Number(d.slice(0, 4)) + 1 : Number(d.slice(0, 4)));
export const taxYearSpan = (y) => ({ from: `${y - 1}-03-01`, to: addDays(`${y}-03-01`, -1) });

/** What is missing from an entry's proof, in words. Quotes need none. */
export function missingProof(r) {
  if (r.kind === 'quote') return [];
  return [
    !r.proofInvoice ? 'invoice' : null,
    r.payments.length && !r.proofPayment ? 'proof of payment' : null,
    (r.aidStatus !== 'none' && r.aidStatus !== 'tosend') || (r.gapStatus !== 'none' && r.gapStatus !== 'tosend') ? (!r.proofClaim ? 'claim statement' : null) : null,
  ].filter(Boolean);
}

/**
 * Everything for one tax year: totals per person and for the family, and the
 * entries still missing proof or waiting on a claim.
 * ponytail: an entry counts in the year of its own date (or its due date), not of each payment;
 * split by payment day if a family pays one account across two tax years often.
 */
export function yearView(all, year) {
  const { from, to } = taxYearSpan(year);
  const inYear = all.filter((r) => r.kind !== 'quote' && (r.day ?? r.due) && (r.day ?? r.due) >= from && (r.day ?? r.due) <= to);
  const totals = (rs) => ({
    count: rs.length,
    charged: sum(rs.map((r) => r.amount)),
    paidByUs: sum(rs.map(paidByUs)),
    aidBack: sum(rs.map((r) => r.aidBack)),
    gapBack: sum(rs.map((r) => r.gapBack)),
    outOfPocket: sum(rs.map(outOfPocket)),
    owed: sum(rs.map(owed)),
  });
  const people = [...new Set(inYear.map((r) => r.personId))];
  return {
    year, from, to,
    family: totals(inYear),
    perPerson: people.map((personId) => ({ personId, ...totals(inYear.filter((r) => r.personId === personId)) })),
    missing: inYear.map((r) => ({ r, what: missingProof(r) })).filter((x) => x.what.length),
    waiting: inYear.filter((r) => WAITING.has(r.aidStatus) || WAITING.has(r.gapStatus)),
    notClaimed: inYear.filter((r) => r.aidStatus === 'none' && paidByUs(r) > 0),
  };
}

/** Tax years worth offering: every year with an entry, and the current one. */
export function yearsOf(all, today) {
  const ys = new Set([taxYear(today)]);
  for (const r of all) if (r.day ?? r.due) ys.add(taxYear(r.day ?? r.due));
  return [...ys].sort((a, b) => b - a);
}
