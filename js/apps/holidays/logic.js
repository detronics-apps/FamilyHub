// Holidays (product plan section 17): ideas, trips, itineraries, packing lists
// and budgets. Planning only - no travel bookings or integrations. Pure.

import { dayDiff, addDays } from '../../dates.js';

export const STATUSES = { idea: 'Idea', planning: 'Planning', booked: 'Booked', done: 'Been' };

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const money = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const listOf = (v, fn) => (Array.isArray(v) ? v : []).map(fn).filter(Boolean);

export function normaliseTrip(t = {}) {
  const start = day(t.startDay);
  let end = day(t.endDay);
  if (start && end && end < start) end = start;
  return {
    ...t,
    title: str(t.title, 200) || 'A trip',
    status: STATUSES[t.status] ? t.status : 'idea',
    destination: str(t.destination, 200),
    startDay: start,
    endDay: end,
    travellers: ids(t.travellers),
    budget: money(t.budget),
    notes: str(t.notes),
    costs: listOf(t.costs, (c, i) => (c && str(c.what) ? { id: str(c.id, 40) || `c${i}`, what: str(c.what, 200), amount: money(c.amount) ?? 0, paid: c.paid === true } : null)),
    itinerary: listOf(t.itinerary, (s, i) => (s && str(s.text) ? { id: str(s.id, 40) || `s${i}`, day: day(s.day), time: /^\d{2}:\d{2}$/.test(s.time ?? '') ? s.time : '', text: str(s.text, 300) } : null)),
    packing: listOf(t.packing, (p, i) => (p && str(p.text) ? { id: str(p.id, 40) || `p${i}`, text: str(p.text, 120), who: typeof p.who === 'string' && p.who ? p.who : null, packed: p.packed === true } : null)),
  };
}

export function tripSummary(t) {
  return { title: t.title, status: t.status, destination: t.destination, startDay: t.startDay, endDay: t.endDay };
}

export const tripText = (t) => [t.title, t.destination, t.notes, ...t.itinerary.map((s) => s.text)].join(' ');

export function nights(t) {
  return t.startDay && t.endDay ? dayDiff(t.startDay, t.endDay) : null;
}

/** 'upcoming' | 'now' | 'past' | 'undated' */
export function when(t, today) {
  if (!t.startDay) return 'undated';
  if (dayDiff(today, t.startDay) > 0) return 'upcoming';
  if (dayDiff(today, t.endDay ?? t.startDay) >= 0) return 'now';
  return 'past';
}

/** Planned against the budget. "Over" only when a budget was set. */
export function budgetSummary(t) {
  const planned = t.costs.reduce((s, c) => s + c.amount, 0);
  const paid = t.costs.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0);
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    planned: r2(planned),
    paid: r2(paid),
    toPay: r2(planned - paid),
    left: t.budget == null ? null : r2(t.budget - planned),
    over: t.budget != null && planned > t.budget,
  };
}

export const packingProgress = (t) => ({ packed: t.packing.filter((p) => p.packed).length, total: t.packing.length });

/** The days of the trip, for laying out the itinerary. Capped at 60. */
export function tripDays(t) {
  const n = nights(t);
  if (n == null) return [];
  return Array.from({ length: Math.min(n, 59) + 1 }, (_, i) => addDays(t.startDay, i));
}

export function itineraryByDay(t) {
  const sorted = t.itinerary.slice().sort((a, b) => String(a.day ?? '9999').localeCompare(String(b.day ?? '9999')) || a.time.localeCompare(b.time));
  const groups = new Map();
  for (const s of sorted) {
    const k = s.day ?? 'any';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  return groups;
}

/** A starter packing list, offered once and freely edited. */
export const STARTER_PACKING = ['Clothes', 'Toothbrushes', 'Chargers', 'Medicines', 'Snacks for the road', 'Something to read or play', 'Swimming things', 'Jackets'];

let n = 0;
const nextId = (p) => `${p}${Date.now().toString(36)}${(n += 1)}`;

export const addCost = (t, what, amount) => (str(what) ? { ...t, costs: [...t.costs, { id: nextId('c'), what: str(what, 200), amount: money(amount) ?? 0, paid: false }] } : t);
export const addStep = (t, text, d = null, time = '') => (str(text) ? { ...t, itinerary: [...t.itinerary, { id: nextId('s'), day: day(d), time: /^\d{2}:\d{2}$/.test(time) ? time : '', text: str(text, 300) }] } : t);
export const addPacking = (t, text, who = null) => (str(text) ? { ...t, packing: [...t.packing, { id: nextId('p'), text: str(text, 120), who, packed: false }] } : t);
export const toggle = (t, list, id, field) => ({ ...t, [list]: t[list].map((x) => (x.id === id ? { ...x, [field]: !x[field] } : x)) });
export const removeFrom = (t, list, id) => ({ ...t, [list]: t[list].filter((x) => x.id !== id) });
