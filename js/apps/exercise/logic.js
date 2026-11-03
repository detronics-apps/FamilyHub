// Exercise (product plan section 16): activity, flexible weekly plans and
// personal goals, plus family-friendly ideas. Each person sees their own
// progress; the household sees what it did together. No rankings, no
// streaks (plan sections 3.7 and 5.1). Pure - no DOM.

import { addDays, dayDiff } from '../../dates.js';
import { normaliseLinks } from '../../links.js';

export const KINDS = {
  walk: 'Walk', run: 'Run', cycle: 'Cycle', swim: 'Swim', sport: 'Sport', play: 'Active play', gym: 'Gym', yoga: 'Yoga or stretching', other: 'Other',
};

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const mins = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(1440, Math.round(Number(v))) : 0);
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

export function normaliseActivity(a = {}, today) {
  return { ...a, day: day(a.day) ?? today, kind: KINDS[a.kind] ? a.kind : 'other', minutes: mins(a.minutes), who: ids(a.who), note: str(a.note), ...normaliseLinks(a) };
}

export const activitySummary = (a) => ({ title: a.title || KINDS[a.kind], workoutId: a.workoutId, day: a.day, kind: a.kind, minutes: a.minutes, who: a.who, creators: a.creators, videos: a.videos });

export function normalisePlan(p = {}) {
  return {
    ...p,
    title: str(p.title, 120) || 'Move more',
    kind: KINDS[p.kind] ? p.kind : null,           // null: any kind of activity counts
    timesPerWeek: Math.min(14, Math.max(1, Math.round(Number(p.timesPerWeek) || 3))),
    minutes: mins(p.minutes) || null,              // the shortest that counts; null = any
    who: ids(p.who),                               // empty: anyone in the household
    active: p.active !== false,
    ...normaliseLinks(p),                          // creators and videos (D-091), e.g. the workout to follow
  };
}

export const planSummary = (p) => ({ title: p.title, kind: p.kind, timesPerWeek: p.timesPerWeek, minutes: p.minutes, who: p.who, active: p.active, creators: p.creators, videos: p.videos });

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

// ---- Exercises, workouts and the weekly plan (D-108) ----------------------------------------
// Like meals and the children's activities: a library of the family's own exercises, workouts
// put together from them, and each workout set on days of the week for the people doing it.
// The app suggests no exercise and says nothing about what is good for anyone.

export const WORKS = { strength: 'Strength', stretch: 'Stretch', cardio: 'Cardio', balance: 'Balance', play: 'Play' };
export const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
const DAY_IDS = DAYS.map(([d]) => d);
const lines = (v) => (Array.isArray(v) ? v.map((x) => str(x, 200)).filter(Boolean).slice(0, 40) : []);
const count = (v, max) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(max, Math.round(Number(v))) : null);

/** One exercise: what it works (ours or your own word), how to do it, how much, what you need. */
export function normaliseExercise(x = {}) {
  return {
    ...x,
    name: str(x.name, 120) || 'An exercise',
    works: str(x.works, 40),                       // a WORKS id, or the family's own word
    how: lines(x.how),                             // the steps, in order
    need: lines(x.need),                           // a mat, a ball, a chair
    sets: count(x.sets, 50), reps: count(x.reps, 1000), seconds: count(x.seconds, 7200),
    distance: str(x.distance, 40),                 // "1 km", "two laps of the park"
    who: ids(x.who),                               // empty: anyone
    ...normaliseLinks(x),
  };
}
export const exerciseSummary = (x) => ({ name: x.name, works: x.works, how: x.how, need: x.need, sets: x.sets, reps: x.reps, seconds: x.seconds, distance: x.distance, who: x.who, creators: x.creators, videos: x.videos });
export const worksName = (w) => WORKS[w] ?? w;

/** How much, in words: "3 × 10", "3 × 30 s", "1 km". */
export function amountText(a = {}) {
  const per = [a.reps ? `${a.reps}` : null, a.seconds ? (a.seconds >= 120 && a.seconds % 60 === 0 ? `${a.seconds / 60} min` : `${a.seconds} s`) : null].filter(Boolean).join(' / ');
  return [per ? `${a.sets && a.sets > 1 ? `${a.sets} × ` : ''}${per}` : null, a.distance || null].filter(Boolean).join(' · ');
}

/** A workout: exercises in order, each with its own sets, reps or time; on which days, for whom. */
export function normaliseWorkout(w = {}) {
  return {
    ...w,
    name: str(w.name, 120) || 'A workout',
    items: (Array.isArray(w.items) ? w.items : []).filter((i) => i && typeof i.exerciseId === 'string').slice(0, 60)
      .map((i) => ({ exerciseId: i.exerciseId, sets: count(i.sets, 50), reps: count(i.reps, 1000), seconds: count(i.seconds, 7200), distance: str(i.distance, 40) })),
    rest: count(w.rest, 600),                      // seconds between sets and exercises
    minutes: mins(w.minutes) || null,              // your own figure, over the worked-out one
    kind: KINDS[w.kind] ? w.kind : 'other',        // how it is logged when done
    days: ids(w.days).filter((d) => DAY_IDS.includes(d)),
    who: ids(w.who),
    active: w.active !== false,
    note: str(w.note, 1000),
    ...normaliseLinks(w),
  };
}
export const workoutSummary = (w) => ({ name: w.name, items: w.items, rest: w.rest, minutes: w.minutes, kind: w.kind, days: w.days, who: w.who, active: w.active, note: w.note, creators: w.creators, videos: w.videos });

/**
 * Its length: the timed parts plus the rests between. Parts counted in reps have no time to
 * add, so they are counted and said rather than guessed. Your own minutes win when given.
 */
export function workoutTime(w) {
  let seconds = 0; let untimed = 0; let sets = 0;
  for (const i of w.items) {
    const n = i.sets ?? 1; sets += n;
    if (i.seconds) seconds += n * i.seconds; else untimed += 1;
  }
  if (w.rest && sets > 1) seconds += (sets - 1) * w.rest;
  return { minutes: w.minutes ?? Math.round(seconds / 60), own: Boolean(w.minutes), untimed: w.minutes ? 0 : untimed };
}

export const weekdayOf = (day) => DAY_IDS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7];

/** The workouts set for a day, for anyone or for one person. */
export const workoutsOn = (workouts, day, personId = null) => workouts.filter((w) => w.active && w.days.includes(weekdayOf(day))
  && (!personId || !w.who.length || w.who.includes(personId)));

/** Done today already? An activity logged from this workout on this day. */
export const doneOn = (activities, workoutId, day) => activities.some((a) => a.workoutId === workoutId && a.day === day);

/** The activity a finished workout logs - so it counts in the week and the plans like any other. */
export const activityFromWorkout = (w, id, day, who, note = '') => ({ kind: w.kind, minutes: workoutTime(w).minutes, day, who: who.length ? who : w.who, note, workoutId: id, title: w.name });
