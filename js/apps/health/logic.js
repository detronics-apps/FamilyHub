// Health (product plan section 16): general health goals, routines and
// appointment notes - non-emergency, and deliberately not medical records.
// Medical details wait for private records and access rules (plan section 15,
// Phase 8). Pure - no DOM.

import { dayDiff } from '../../dates.js';

export const APPOINTMENT_STATUS = { upcoming: 'Coming up', done: 'Done', cancelled: 'Cancelled' };

const str = (v, max = 1000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const time = (v) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : '');

export function normaliseAppointment(a = {}) {
  return {
    ...a,
    title: str(a.title, 150) || 'Appointment',
    who: typeof a.who === 'string' && a.who ? a.who : null,
    day: day(a.day),
    time: time(a.time),
    with: str(a.with, 150),
    where: str(a.where, 200),
    bring: str(a.bring, 500),
    notes: str(a.notes),
    followUp: day(a.followUp),
    status: APPOINTMENT_STATUS[a.status] ? a.status : 'upcoming',
  };
}

export const appointmentSummary = (a) => ({ title: a.title, who: a.who, day: a.day, time: a.time, status: a.status, followUp: a.followUp });

/** Soonest first; undated last. */
export const byWhen = (a, b) => `${a.day ?? '9999'}${a.time}`.localeCompare(`${b.day ?? '9999'}${b.time}`);

/** Upcoming appointments, plus follow-ups that have come due (a gentle prompt to book). */
export function agenda(summaries, today) {
  const upcoming = summaries.filter((s) => s.status === 'upcoming' && (!s.day || dayDiff(today, s.day) >= 0)).sort(byWhen);
  const passed = summaries.filter((s) => s.status === 'upcoming' && s.day && dayDiff(today, s.day) < 0).sort(byWhen);
  const followUps = summaries.filter((s) => s.followUp && s.status === 'done' && dayDiff(s.followUp, today) >= 0);
  return { upcoming, passed, followUps };
}

export function normaliseRoutine(r = {}) {
  return {
    ...r,
    title: str(r.title, 150) || 'A healthy habit',
    who: Array.isArray(r.who) ? r.who.filter((x) => typeof x === 'string') : [],
    how: str(r.how),
    when: str(r.when, 200),                       // free text: "every morning", "school nights"
    why: str(r.why),
    active: r.active !== false,
  };
}

export const routineSummary = (r) => ({ title: r.title, who: r.who, when: r.when, active: r.active });
