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
  return { ...a, day: day(a.day) ?? today, kind: KINDS[a.kind] ? a.kind : 'other', minutes: mins(a.minutes), who: ids(a.who), note: str(a.note), result: resultOf(a.result), ...normaliseLinks(a) };
}

export const activitySummary = (a) => ({ title: a.title || KINDS[a.kind], workoutId: a.workoutId, at: a.at, muscles: a.muscles, kidsKg: a.kidsKg, result: a.result, day: a.day, kind: a.kind, minutes: a.minutes, who: a.who, creators: a.creators, videos: a.videos });

/** What a timed workout logged (D-114): rounds done, reps per exercise, and which exercise it was. Null when none. */
function resultOf(v) {
  if (!v || typeof v !== 'object') return null;
  const n = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.min(100000, Math.round(Number(x))) : null);
  const out = {};
  if (n(v.rounds)) out.rounds = n(v.rounds);
  const reps = Object.fromEntries(Object.entries(v.reps && typeof v.reps === 'object' ? v.reps : {}).filter(([, x]) => n(x)).map(([k, x]) => [k, n(x)]));
  if (Object.keys(reps).length) out.reps = reps;
  if (typeof v.exerciseId === 'string' && v.exerciseId) out.exerciseId = v.exerciseId;
  return Object.keys(out).length ? out : null;
}

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
function exerciseBase(x = {}) {
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
export const exerciseSummary = (x) => ({ name: x.name, works: x.works, muscles: x.muscles, tags: x.tags, place: x.place, source: x.source, kids: x.kids, how: x.how, need: x.need, sets: x.sets, reps: x.reps, seconds: x.seconds, distance: x.distance, who: x.who, creators: x.creators, videos: x.videos });
export const worksName = (w) => WORKS[w] ?? w;

/** How much, in words: "3 × 10", "3 × 30 s", "1 km". */
export function amountText(a = {}) {
  const per = [a.reps ? `${a.reps}` : null, a.seconds ? (a.seconds >= 120 && a.seconds % 60 === 0 ? `${a.seconds / 60} min` : `${a.seconds} s`) : null].filter(Boolean).join(' / ');
  return [per ? `${a.sets && a.sets > 1 ? `${a.sets} × ` : ''}${per}` : null, a.distance || null].filter(Boolean).join(' · ');
}

/** A workout: exercises in order, each with its own sets, reps or time; on which days, for whom. */
export function normaliseWorkout(w = {}) {
  const style = STYLES[w.style] ? w.style : 'list';
  return {
    ...w,
    name: str(w.name, 120) || 'A workout',
    style,                                         // how it goes (D-114): in order, or one of the timed kinds
    items: (Array.isArray(w.items) ? w.items : []).filter((i) => i && typeof i.exerciseId === 'string').slice(0, 60)
      .map((i) => ({ exerciseId: i.exerciseId, sets: count(i.sets, 50), reps: count(i.reps, 1000), seconds: count(i.seconds, 7200), distance: str(i.distance, 40) })),
    rest: count(w.rest, 600),                      // seconds between sets and exercises
    minutes: mins(w.minutes) || (style === 'list' ? null : 20),   // your own figure, over the worked-out one; a timed one's timer
    kind: KINDS[w.kind] ? w.kind : 'other',        // how it is logged when done
    days: ids(w.days).filter((d) => DAY_IDS.includes(d)),
    who: ids(w.who),
    active: w.active !== false,
    inRound: w.inRound === true,                   // in this round (D-110)
    note: str(w.note, 1000),
    ...normaliseLinks(w),
  };
}
export const workoutSummary = (w) => ({ name: w.name, style: w.style, items: w.items, rest: w.rest, minutes: w.minutes, kind: w.kind, days: w.days, who: w.who, active: w.active, inRound: w.inRound, note: w.note, creators: w.creators, videos: w.videos });

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
export const activityFromWorkout = (w, id, day, who, note = '', at = new Date().toISOString()) => ({ at, kind: w.kind, minutes: workoutTime(w).minutes, day, who: who.length ? who : w.who, note, workoutId: id, title: w.name });

// ---- Muscles, tags, where, and exercises with the children (D-109) ---------------------------

/** The body figure draws these, so the list is fixed. */
export const MUSCLES = [['chest', 'Chest'], ['shoulders', 'Shoulders'], ['upperback', 'Upper back'], ['lowerback', 'Lower back'],
  ['biceps', 'Biceps'], ['triceps', 'Triceps'], ['forearms', 'Forearms'], ['core', 'Core'],
  ['glutes', 'Glutes'], ['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['calves', 'Calves']];
export const muscleName = (id) => MUSCLES.find(([m]) => m === id)?.[1] ?? id;
/** Where it is done: with your body alone, at home with what you have, or at a gym. */
export const PLACES = { body: 'Body weight', home: 'At home', gym: 'Gym' };
/** Offered to start with; the family renames, removes and adds its own. */
export const START_TAGS = ['Muscle building', 'Endurance', 'Mobility', 'Low impact', 'With the children', 'Pregnancy'];
export const KIDS_TAG = 'With the children';
export const PREGNANCY_TAG = 'Pregnancy';

const muscles = (v) => Object.fromEntries(Object.entries(v && typeof v === 'object' ? v : {})
  .filter(([m, lvl]) => MUSCLES.some(([id]) => id === m) && (lvl === 'main' || lvl === 'also')));
export const tagList = (v) => [...new Set((Array.isArray(v) ? v : []).map((t) => str(t, 40)).filter(Boolean))].slice(0, 30);

/** An exercise, with what it works, its tags, where it is done, who said so, and which children it is done with. */
export function normaliseExercise(x = {}) {
  return {
    ...exerciseBase(x),
    muscles: muscles(x.muscles),       // { quads: 'main', core: 'also' }
    tags: tagList(x.tags),
    place: PLACES[x.place] ? x.place : '',
    source: str(x.source, 200),        // who said so - "our physio, March 2026"
    kids: ids(x.kids),                 // the children it is done with; their latest weights add up
  };
}

/** Which exercises match: every tag and muscle chosen, the place, and - with `have` - only what needs nothing you lack. */
export function filterExercises(xs, { tags = [], muscles: ms = [], place = null, have = null } = {}) {
  const lower = have ? have.map((h) => h.toLowerCase()) : null;
  return xs.filter((x) => tags.every((t) => x.tags.includes(t))
    && ms.every((m) => x.muscles[m])
    && (!place || x.place === place)
    && (!lower || x.need.every((n) => lower.includes(n.toLowerCase()))));
}

/** Sets per muscle for a workout, or for the exercises ticked as done: { quads: { main: 3, also: 0 } }. */
export function workoutMuscles(w, exercises, onlyIds = null) {
  const out = {};
  for (const i of w.items) {
    if (onlyIds && !onlyIds.includes(i.exerciseId)) continue;
    const x = exercises.find((e) => e.id === i.exerciseId);
    if (!x) continue;
    for (const [m, lvl] of Object.entries(x.muscles ?? {})) {
      out[m] ??= { main: 0, also: 0 };
      out[m][lvl] += i.sets ?? x.sets ?? 1;
    }
  }
  return out;
}

/** How dark each muscle is drawn, 0 to 1: Mainly counts in full, Also by half, against the most-worked one. */
export function shade(load) {
  const v = Object.fromEntries(Object.entries(load).map(([m, l]) => [m, l.main + l.also / 2]));
  const top = Math.max(0, ...Object.values(v));
  return top ? Object.fromEntries(Object.entries(v).map(([m, n]) => [m, n / top])) : {};
}
/** One exercise's own shading: Mainly dark, Also light. */
export const exerciseShade = (x) => Object.fromEntries(Object.entries(x.muscles ?? {}).map(([m, l]) => [m, l === 'main' ? 1 : 0.4]));

/** The week for one person: per muscle, the sessions that worked it and the sets where it was the main one. */
export function weekMuscles(activities, monday, personId) {
  const out = {};
  for (const a of activities) {
    if (!a.muscles || !inWeek(a, monday) || (personId && !a.who.includes(personId))) continue;
    for (const [m, l] of Object.entries(a.muscles)) {
      out[m] ??= { times: 0, main: 0, also: 0 };
      out[m].times += 1; out[m].main += l.main ?? 0; out[m].also += l.also ?? 0;
    }
  }
  return out;
}

/** The children's weight in an exercise: their latest weights added up, with the oldest date among them. */
export function kidsLoad(x, weights) {
  const list = (x.kids ?? []).map((id) => weights.find((w) => w.id === id)).filter((w) => w && w.kg);
  if (!list.length) return null;
  return { kg: Math.round(list.reduce((s, w) => s + w.kg, 0) * 10) / 10, day: list.map((w) => w.day).filter(Boolean).sort()[0] ?? null, names: list.map((w) => w.name) };
}

/** Weight moved with the children: the children's weight × reps × sets, over the exercises done with them. */
export function kidsMoved(w, exercises, weights, onlyIds = null) {
  let kg = 0;
  for (const i of w.items) {
    if (onlyIds && !onlyIds.includes(i.exerciseId)) continue;
    const x = exercises.find((e) => e.id === i.exerciseId);
    const load = x ? kidsLoad(x, weights) : null;
    const reps = i.reps ?? x.reps;
    if (load && reps) kg += load.kg * reps * (i.sets ?? x.sets ?? 1);   // holds have no reps: their weight and time are said instead
  }
  return Math.round(kg);
}

/** The two the owner asked for, as editable examples - the app adds no exercises of its own. */
export const KIDS_EXAMPLES = [
  { id: 'exc-kids-squats', name: 'Squats holding your child', works: 'strength', place: 'body', tags: ['With the children'], muscles: { quads: 'main', glutes: 'main', core: 'also', hamstrings: 'also' }, how: ['Hold your child close to your chest'] },
  { id: 'exc-kids-hang', name: 'Dead hang with your child on your feet', works: 'strength', place: 'home', tags: ['With the children'], need: ['Pull-up bar'], seconds: 30, muscles: { forearms: 'main', shoulders: 'main', upperback: 'also', core: 'also' }, how: ['Hang from the bar', 'Your child sits on your feet and holds your legs'] },
  { id: 'exc-kids-pushups', name: 'Push-ups with your child on your back', works: 'strength', place: 'body', tags: ['With the children'], muscles: { chest: 'main', triceps: 'main', shoulders: 'also', core: 'also' }, how: ['Your child lies or sits on your back'] },
];

// ---- Plan without a week (D-110) -------------------------------------------------------------
// Workouts are ready to use, not due on a day: "I have 25 minutes" shows the ones that fit; a
// round is a batch to work through whenever; each workout keeps a tally for the year. Nothing is
// missed, nothing piles up, and an empty week is just a week.

/** The workouts that fit the time you have - in the round and not yet done first, then the least done. */
export function fitsIn(workouts, minutes, { activities = [], roundFrom = null, year } = {}) {
  const fit = workouts.filter((w) => { const t = workoutTime(w).minutes; return t > 0 && t <= minutes; });
  const rank = (w) => [w.inRound && !doneInRound(activities, w.id, roundFrom) ? 0 : 1, yearCount(activities, w.id, year)];
  return fit.sort((a, b) => { const [x1, x2] = rank(a); const [y1, y2] = rank(b); return x1 - y1 || x2 - y2 || workoutTime(a).minutes - workoutTime(b).minutes; });
}

/** Done since the round began? roundFrom is the moment New round was pressed; `at` is when Done was. */
export const doneInRound = (activities, workoutId, roundFrom) => activities.some((a) => a.workoutId === workoutId && (!roundFrom || (a.at ?? a.day) >= roundFrom));

/** Where the round stands: each workout in it, done or not. */
export function roundStatus(workouts, activities, roundFrom) {
  const list = workouts.filter((w) => w.inRound).map((w) => ({ w, done: doneInRound(activities, w.id, roundFrom) }));
  return { list, done: list.filter((x) => x.done).length, of: list.length, finished: list.length > 0 && list.every((x) => x.done) };
}

/** Times a workout was done in a year - it keeps counting, whenever it happened. */
/** "done 3 times this year", "done once", "not done yet". */
export const timesText = (n) => (n === 0 ? 'not done yet this year' : n === 1 ? 'done once this year' : `done ${n} times this year`);
export const yearCount = (activities, workoutId, year) => activities.filter((a) => a.workoutId === workoutId && a.day.startsWith(String(year))).length;

/** Workouts done by a person this week and this month. */
export function workoutCounts(activities, today, personId = null) {
  const monday = (() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const mine = activities.filter((a) => a.workoutId && (!personId || a.who.includes(personId)));
  return { week: mine.filter((a) => a.day >= monday && a.day <= today).length, month: mine.filter((a) => a.day.slice(0, 7) === today.slice(0, 7) && a.day <= today).length };
}

/** A kind sentence, never a scolding one. */
export function countsLine({ week, month }) {
  if (!week) return month ? `This month: ${month} workout${month === 1 ? '' : 's'}. A new week - any time you have 15 minutes.` : 'A new week - any time you have 15 minutes.';
  return `This week: ${week} workout${week === 1 ? '' : 's'}. This month: ${month}.`;
}

// Two windows adding the starting examples at the same moment once made two of each (D-113). Each
// example now has its own id, so that cannot happen again; this finds the copies already made.
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
/** The ids of unchanged copies of a starting example beyond the one kept - never one in a workout. */
export function seededCopies(exercises, examples, usedIds = new Set()) {
  const out = [];
  for (const e of examples) {
    const want = canon(exerciseSummary(normaliseExercise(e)));
    const same = exercises.filter((x) => canon(exerciseSummary(normaliseExercise(x))) === want);
    if (same.length < 2) continue;
    const keep = same.find((x) => x.id === e.id) ?? same.find((x) => usedIds.has(x.id)) ?? same[0];
    out.push(...same.filter((x) => x !== keep && !usedIds.has(x.id)).map((x) => x.id));
  }
  return out;
}

// ---- Timed workouts: rounds in a time, to failure round and round, one a day in turn (D-114) ----
// The owner's three: Start sets one timer, the screen says what to do, and nothing needs touching
// until it ends - then you log what you did. Life happens: the one-a-day rotation continues from
// the last one done, whenever that was, never from the calendar.

/** How a workout goes. "In order" is every workout before; the other three are timed. */
export const STYLES = {
  list: 'In order',
  rounds: 'Rounds in a time',
  cycle: 'To failure, round and round',
  rotation: 'One a day, in turn',
};
export const STYLE_HINTS = {
  list: 'Each exercise with its own sets and reps, one after the other.',
  rounds: 'One round is every exercise with its reps. As many rounds as you can before the time is up; log the rounds.',
  cycle: 'Each exercise as many as you can, then the next; at the end, start again until the time is up. Log how many of each.',
  rotation: 'One exercise a session, the next one next time. As many as you can, rest, again, until the time is up. Log how many.',
};
export const isTimed = (w) => Boolean(w) && STYLES[w.style] && w.style !== 'list';

const byWhen = (a, b) => String(b.at ?? b.day).localeCompare(String(a.at ?? a.day));

/** One a day, in turn: the one after the last one done (by when, not the calendar), and how far round. */
export function rotationNext(w, activities) {
  const order = w.items.map((i) => i.exerciseId);
  if (!order.length) return null;
  const last = activities.filter((a) => a.workoutId === w.id && a.result?.exerciseId).sort(byWhen)[0];
  const index = ((last ? order.indexOf(last.result.exerciseId) : -1) + 1) % order.length;
  return { index, exerciseId: order[index], of: order.length, nextId: order[(index + 1) % order.length] };
}

/** What to do, in words, for the screen you glance at while working. */
export function goWords(w, exercises, activities = []) {
  const name = (id) => exercises.find((e) => e.id === id)?.name ?? 'A removed exercise';
  const n = w.minutes ?? 20;
  const time = n === 1 ? '1 minute' : `${n} minutes`;
  const up = n === 1 ? 'the minute is up' : `the ${n} minutes are up`;
  if (w.style === 'rounds') {
    return { lead: `As many rounds as you can in ${time}.`, steps: w.items.map((i) => `${i.reps ? `${i.reps} ` : ''}${name(i.exerciseId)}`), after: 'Then straight into the next round.' };
  }
  if (w.style === 'cycle') {
    return { lead: `Each one as many as you can, then the next. At the end, start again - until ${up}.`, steps: w.items.map((i) => name(i.exerciseId)), after: '' };
  }
  if (w.style === 'rotation') {
    const next = rotationNext(w, activities);
    if (!next) return { lead: 'Add exercises to this workout first.', steps: [], after: '' };
    return { lead: `Today (${next.index + 1} of ${next.of}): ${name(next.exerciseId)}`, today: next.exerciseId, steps: ['As many as you can', 'Rest', `Again - until ${up}`], after: next.of > 1 ? `Next time: ${name(next.nextId)}` : '' };
  }
  return { lead: '', steps: w.items.map((i) => `${name(i.exerciseId)} ${amountText(i)}`.trim()), after: '' };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;   // "5 Nov", the same on every device

/** What was logged before - the last time, and your best - in plain words. Nothing when there is nothing. */
export function resultLines(w, activities, exercises) {
  const name = (id) => exercises.find((e) => e.id === id)?.name ?? 'a removed exercise';
  const done = activities.filter((a) => a.workoutId === w.id && a.result).sort(byWhen);
  if (w.style === 'rounds') {
    const r = done.filter((a) => a.result.rounds);
    if (!r.length) return [];
    const best = Math.max(...r.map((a) => a.result.rounds));
    const n = (x) => `${x} round${x === 1 ? '' : 's'}`;
    return [`Last time (${shortDay(r[0].day)}): ${n(r[0].result.rounds)}.${r.length > 1 ? ` Your best: ${n(best)}.` : ''}`];
  }
  if (w.style === 'cycle') {
    const last = done.find((a) => a.result.reps);
    if (!last) return [];
    const parts = w.items.map((i) => i.exerciseId).filter((id) => last.result.reps[id]).map((id) => `${name(id)} ${last.result.reps[id]}`);
    const all = Object.values(last.result.reps).reduce((t, x) => t + x, 0);
    return [`Last time (${shortDay(last.day)}): ${parts.join(', ')} - ${all} in all.`];
  }
  if (w.style === 'rotation') {
    return w.items.map((i) => i.exerciseId).flatMap((id) => {
      const mine = done.filter((a) => a.result.exerciseId === id && a.result.reps?.[id]);
      if (!mine.length) return [];
      const best = Math.max(...mine.map((a) => a.result.reps[id]));
      return [`${name(id)}: last ${mine[0].result.reps[id]} (${shortDay(mine[0].day)})${mine.length > 1 ? `, best ${best}` : ''}`];
    });
  }
  return [];
}

/** The owner's three timed workouts and the exercises they use - starting points, to change or remove. */
export const STARTER_EXERCISES = [
  { id: 'exc-std-pullups', name: 'Pull-ups', works: 'strength', place: 'home', need: ['Pull-up bar'], muscles: { upperback: 'main', biceps: 'main', forearms: 'also', shoulders: 'also', core: 'also' } },
  { id: 'exc-std-pushups', name: 'Push-ups', works: 'strength', place: 'body', muscles: { chest: 'main', triceps: 'main', shoulders: 'also', core: 'also' } },
  { id: 'exc-std-squats', name: 'Squats', works: 'strength', place: 'body', muscles: { quads: 'main', glutes: 'main', hamstrings: 'also', core: 'also' } },
  { id: 'exc-std-curls', name: 'Curls', works: 'strength', place: 'home', muscles: { biceps: 'main', forearms: 'also' } },
  { id: 'exc-std-dips', name: 'Dips', works: 'strength', place: 'home', muscles: { triceps: 'main', chest: 'main', shoulders: 'also' } },
  { id: 'exc-std-shrugs', name: 'Shrugs', works: 'strength', place: 'home', muscles: { upperback: 'main', forearms: 'also' } },
  { id: 'exc-std-lateral', name: 'Lateral raises', works: 'strength', place: 'home', muscles: { shoulders: 'main' } },
  { id: 'exc-std-rows', name: 'Rows', works: 'strength', place: 'home', muscles: { upperback: 'main', biceps: 'also', forearms: 'also' } },
  { id: 'exc-std-pike', name: 'Pike push-ups', works: 'strength', place: 'body', muscles: { shoulders: 'main', triceps: 'main', chest: 'also', core: 'also' } },
  { id: 'exc-std-lunges', name: 'Lunges', works: 'strength', place: 'body', muscles: { quads: 'main', glutes: 'main', hamstrings: 'also', calves: 'also' } },
  { id: 'exc-std-rdls', name: 'Romanian deadlifts', also: ['RDLs', 'RDL'], works: 'strength', place: 'home', muscles: { hamstrings: 'main', glutes: 'main', lowerback: 'also' } },
];
const FROM_CREATOR = 'From a creator on TikTok - add them and the video under Edit, in Creators and videos.';
export const STARTER_WORKOUTS = [
  { id: 'wko-sydney', name: 'The Sydney workout', style: 'rounds', minutes: 20, kind: 'gym', items: [['exc-std-pullups', 5], ['exc-std-pushups', 10], ['exc-std-squats', 15]] },
  { id: 'wko-twenty', name: '20 minutes a day', style: 'cycle', minutes: 20, kind: 'gym', note: FROM_CREATOR,
    items: [['exc-std-pullups'], ['exc-std-pushups'], ['exc-std-curls'], ['exc-std-dips'], ['exc-std-shrugs'], ['exc-std-lateral']] },
  { id: 'wko-one-a-day', name: 'One exercise a day', style: 'rotation', minutes: 20, kind: 'gym', note: FROM_CREATOR,
    items: [['exc-std-pullups'], ['exc-std-dips'], ['exc-std-pushups'], ['exc-std-rows'], ['exc-std-pike'], ['exc-std-squats'], ['exc-std-lunges'], ['exc-std-rdls']] },
];

/**
 * What adding the starting workouts writes: each exercise only when the family has none of that
 * name already (theirs is used instead), and each workout pointing at whichever exercise it is.
 * Fixed ids, so adding them twice writes the same records (D-113).
 */
export function starterPlan(exercises) {
  const key = (t) => String(t).toLowerCase().replace(/[^a-z]/g, '');
  const theirs = new Map(exercises.map((x) => [key(x.name), x.id]));
  const idOf = {}; const add = [];
  for (const x of STARTER_EXERCISES) {
    const own = [x.name, ...(x.also ?? [])].map((t) => theirs.get(key(t))).find(Boolean);
    idOf[x.id] = own ?? x.id;
    if (!own) { const { also, ...rest } = x; add.push(normaliseExercise(rest)); }
  }
  const workouts = STARTER_WORKOUTS.map(({ items, ...w }) => normaliseWorkout({ ...w, items: items.map(([id, reps]) => ({ exerciseId: idOf[id], reps })) }));
  return { exercises: add, workouts };
}
