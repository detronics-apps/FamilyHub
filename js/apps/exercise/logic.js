// Exercise (product plan section 16): activity, flexible weekly plans and
// personal goals, plus family-friendly ideas. Each person sees their own
// progress; the household sees what it did together. No rankings, no
// streaks (plan sections 3.7 and 5.1). Pure - no DOM.

import { addDays, dayDiff } from '../../dates.js';

export const KINDS = {
  walk: 'Walk', run: 'Run', cycle: 'Cycle', swim: 'Swim', sport: 'Sport', play: 'Active play', gym: 'Gym', yoga: 'Yoga or stretching', other: 'Other',
};

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const mins = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(1440, Math.round(Number(v))) : 0);
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

export function normaliseActivity(a = {}, today) {
  return { ...a, day: day(a.day) ?? today, kind: KINDS[a.kind] ? a.kind : 'other', minutes: mins(a.minutes), who: ids(a.who), note: str(a.note) };
}

export const activitySummary = (a) => ({ title: KINDS[a.kind], day: a.day, kind: a.kind, minutes: a.minutes, who: a.who });

export function normalisePlan(p = {}) {
  return {
    ...p,
    title: str(p.title, 120) || 'Move more',
    kind: KINDS[p.kind] ? p.kind : null,           // null: any kind of activity counts
    timesPerWeek: Math.min(14, Math.max(1, Math.round(Number(p.timesPerWeek) || 3))),
    minutes: mins(p.minutes) || null,              // the shortest that counts; null = any
    who: ids(p.who),                               // empty: anyone in the household
    active: p.active !== false,
  };
}

export const planSummary = (p) => ({ title: p.title, kind: p.kind, timesPerWeek: p.timesPerWeek, minutes: p.minutes, who: p.who, active: p.active });

const inWeek = (a, monday) => dayDiff(monday, a.day) >= 0 && dayDiff(a.day, addDays(monday, 6)) >= 0;

/** Minutes a person moved in the week (Monday to Sunday). */
export const weekMinutes = (activities, monday, personId) =>
  activities.filter((a) => inWeek(a, monday) && a.who.includes(personId)).reduce((s, a) => s + a.minutes, 0);

/** What the household did together this week: activities with two or more people. */
export function together(activities, monday) {
  const list = activities.filter((a) => inWeek(a, monday) && a.who.length > 1);
  return { count: list.length, minutes: list.reduce((s, a) => s + a.minutes, 0) };
}

/** How a weekly plan is going: matching activities this week, out of the times intended. */
export function planProgress(plan, activities, monday) {
  const matches = activities.filter((a) => inWeek(a, monday)
    && (!plan.kind || a.kind === plan.kind)
    && (!plan.minutes || a.minutes >= plan.minutes)
    && (!plan.who.length || a.who.some((w) => plan.who.includes(w))));
  return { done: matches.length, of: plan.timesPerWeek };
}

/** A gentle sentence, never a scolding one. */
export function goalLine(minutes, goal) {
  if (!goal) return `${minutes} minutes this week.`;
  if (minutes >= goal) return `${minutes} of ${goal} minutes - goal reached this week.`;
  return `${minutes} of ${goal} minutes this week.`;
}

/** Family-friendly ideas, for when nobody can think of anything. */
export const IDEAS = [
  'A walk after dinner, everyone in',
  'Kitchen dance party - three songs',
  'Bike ride to the park',
  'Backyard obstacle course',
  'Swimming on the weekend',
  'Kick a ball for 20 minutes',
  'Family stretch before bed',
  'Hide and seek outside',
  'Walk to school or the shops instead of driving',
  'Hula hoop or skipping rope challenge',
];
