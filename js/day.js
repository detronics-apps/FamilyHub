// Our day (D-149): each person's average day, midnight to midnight, in blocks of time by
// category - what we do now, and the day we want to get to. The hours are the same for
// everyone; only where they fall changes. Pure - no DOM.

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DAY_MINUTES = 1440;

/** Colours a category can take (the swatches offered first; any #rrggbb is kept). */
export const KIND_COLOURS = ['#b4b2a9', '#85b7eb', '#ed93b1', '#d4537e', '#f0997b', '#7f77dd', '#ef9f27', '#5dcaa5', '#1d9e75', '#97c459', '#d9a441', '#6f9fb8'];

/** The starting categories - rename, recolour, remove or add to them. */
// `eight` is what it counts as in the 8/8/8 rule (D-150): sleep, work, personal life, or not in it.
export const DAY_KINDS = [
  { id: 'sleep', name: 'Sleep', colour: '#b4b2a9', eight: 'sleep' },
  { id: 'hygiene', name: 'Hygiene', colour: '#85b7eb', eight: 'personal', part: 'hygiene' },
  { id: 'eat', name: 'Eating', colour: '#ed93b1', eight: 'personal' },
  { id: 'cook', name: 'Cooking', colour: '#d4537e', eight: 'other' },
  { id: 'travel', name: 'Travel', colour: '#f0997b', eight: 'other' },
  { id: 'work', name: 'Work', colour: '#7f77dd', eight: 'work' },
  // At work, but not working: lunch and breaks (owner, D-150).
  { id: 'break', name: 'Work breaks', colour: '#b58a62', eight: 'other' },
  // Switching from one thing to the next: winding down, getting going (owner, D-150).
  { id: 'transition', name: 'Transition', colour: '#d3d1c7', eight: 'other' },
  { id: 'chores', name: 'Chores', colour: '#ef9f27', eight: 'other' },
  { id: 'care', name: 'Kids: care', colour: '#5dcaa5', eight: 'other' },
  { id: 'play', name: 'Kids: play', colour: '#1d9e75', eight: 'personal', part: 'family' },
  { id: 'lessons', name: 'Lessons', colour: '#6f9fb8', eight: 'work' },
  { id: 'free', name: 'Free time', colour: '#97c459', eight: 'personal', part: 'hobby' },
  // The rule is from the 1800s: nothing in it for screens, or for running a family (owner, D-152).
  { id: 'screen', name: 'Screen time', colour: '#c07aa6', eight: 'other' },
  { id: 'planning', name: 'Planning and meetings', colour: '#5f9a8b', eight: 'other' },
];

/** The 8/8/8 rule's parts, and the time it leaves out. */
export const EIGHT = [
  { id: 'sleep', name: 'Sleep', colour: '#b4b2a9', minutes: 480 },
  { id: 'work', name: 'Work', colour: '#7f77dd', minutes: 480 },
  { id: 'personal', name: 'Personal life', colour: '#97c459', minutes: 480 },
  { id: 'other', name: 'Not in 8/8/8', colour: '#ef9f27', minutes: 0 },
];
const EIGHT_IDS = EIGHT.map((g) => g.id);
const startingEight = (id) => DAY_KINDS.find((k) => k.id === id)?.eight ?? 'other';

/**
 * Some versions split the personal 8 hours into 3 Fs, 3 Hs and 3 Ss (D-151). A personal-life
 * category can be one of these nine parts; the rule gives no hours for each part.
 */
export const PART_GROUPS = [
  { id: 'f', name: '3 Fs', parts: [{ id: 'family', name: 'Family' }, { id: 'friends', name: 'Friends' }, { id: 'faith', name: 'Faith' }] },
  { id: 'h', name: '3 Hs', parts: [{ id: 'health', name: 'Health' }, { id: 'hygiene', name: 'Hygiene' }, { id: 'hobby', name: 'Hobby' }] },
  { id: 's', name: '3 Ss', parts: [{ id: 'soul', name: 'Soul' }, { id: 'service', name: 'Service' }, { id: 'smile', name: 'Smile' }] },
];
const PART_IDS = PART_GROUPS.flatMap((g) => g.parts.map((x) => x.id));

export function normaliseKinds(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter((k) => k && typeof k === 'object').map((k, i) => ({
    id: str(k.id, 40) || `k${i}`,
    name: str(k.name, 40) || 'Something',
    colour: /^#[0-9a-f]{6}$/i.test(k.colour) ? k.colour.toLowerCase() : KIND_COLOURS[i % KIND_COLOURS.length],
    eight: EIGHT_IDS.includes(k.eight) ? k.eight : startingEight(str(k.id, 40)),
    part: PART_IDS.includes(k.part) ? k.part : k.part === '' ? '' : DAY_KINDS.find((d) => d.id === k.id)?.part ?? '',
  })).filter((k) => !seen.has(k.id) && seen.add(k.id)).slice(0, 30);
}
/** The family's categories, or the starting ones until they change them. */
export const kindsOf = (h) => (Array.isArray(h?.household?.dayKinds) ? normaliseKinds(h.household.dayKinds) : DAY_KINDS);

const normaliseBlocks = (list) => (Array.isArray(list) ? list : [])
  .filter((b) => b && HHMM.test(b.from) && HHMM.test(b.to))
  .map((b) => ({ from: b.from, to: b.to, kind: str(b.kind, 40) })).slice(0, 80);

/** A person's day: now, the goal, and their share of the family's chores (percent). */
export function normaliseDay(d = {}) {
  const share = Number(d?.choreShare);
  return {
    now: normaliseBlocks(d?.now),
    goal: normaliseBlocks(d?.goal),
    choreShare: d?.choreShare === null || d?.choreShare === '' || d?.choreShare === undefined || !Number.isFinite(share) ? null : Math.min(100, Math.max(0, Math.round(share))),
  };
}

export const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
export const toHHMM = (m) => { const x = ((Math.round(m) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

/**
 * The day minute by minute. A block whose end is earlier than its start crosses midnight
 * (22:00 to 01:00 covers 22:00-24:00 and 00:00-01:00). Where two blocks overlap, the later one
 * in the list counts, and the first such minute is reported.
 */
function minutesOf(blocks) {
  const day = new Array(DAY_MINUTES).fill(null);
  let overlap = null;
  for (const b of normaliseBlocks(blocks)) {
    const from = toMinutes(b.from);
    const len = (toMinutes(b.to) - from + DAY_MINUTES) % DAY_MINUTES;
    for (let i = 0; i < len; i += 1) {
      const m = (from + i) % DAY_MINUTES;
      if (day[m] !== null && overlap === null) overlap = m;
      day[m] = b.kind;
    }
  }
  return { day, overlap };
}

/** The day as runs from 00:00 to 24:00: [{ start, end, kind }] in minutes, kind null where nothing is planned. */
export function timeline(blocks) {
  const { day } = minutesOf(blocks);
  const runs = [];
  for (let m = 0; m < DAY_MINUTES; m += 1) {
    const last = runs.at(-1);
    if (last && last.kind === day[m]) last.end = m + 1;
    else runs.push({ start: m, end: m + 1, kind: day[m] });
  }
  return runs;
}

/**
 * Minutes per category, in the categories' order, plus what is not planned, awake (the day
 * less sleep) and the first overlap, if any.
 */
export function totals(blocks, kinds = DAY_KINDS) {
  const { day, overlap } = minutesOf(blocks);
  const count = new Map();
  for (const k of day) count.set(k, (count.get(k) ?? 0) + 1);
  const known = new Set(kinds.map((k) => k.id));
  const other = [...count].filter(([k]) => k !== null && !known.has(k)).reduce((s, [, n]) => s + n, 0);
  return {
    byKind: kinds.map((k) => ({ ...k, minutes: count.get(k.id) ?? 0 })).filter((k) => k.minutes),
    other,
    unplanned: count.get(null) ?? 0,
    awake: DAY_MINUTES - (count.get('sleep') ?? 0),
    overlap: overlap === null ? null : toHHMM(overlap),
  };
}

/** A new block: the night's sleep to start a day, then an hour after the last one. */
export function nextBlock(blocks, kinds = DAY_KINDS) {
  const last = blocks.at(-1);
  if (!last) return { from: '00:00', to: '07:00', kind: (kinds.find((k) => k.id === 'sleep') ?? kinds[0])?.id ?? '' };
  return { from: last.to, to: toHHMM(toMinutes(last.to) + 60), kind: (kinds.find((k) => k.id !== 'sleep') ?? kinds[0])?.id ?? '' };
}

/**
 * A person's share of the family's chores: the minutes a day it comes to, and how much of it
 * is placed in their day (blocks of the Chores category).
 */
export function choreShare(day, familyMinutesADay, blocks) {
  const d = normaliseDay(day);
  if (d.choreShare === null) return null;
  const share = Math.round((familyMinutesADay * d.choreShare) / 100);
  const placed = minutesOf(blocks).day.filter((k) => k === 'chores').length;
  return { percent: d.choreShare, share, placed, toPlace: Math.max(0, share - placed) };
}

/** 90 → "1 h 30", 45 → "45 min", 480 → "8 h". */
export const fmtSpan = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);

/**
 * The day against the 8/8/8 rule (D-150): each part's hours and how far from 8 they are, and
 * what is not in the rule at all - by category, largest first. Not planned time is apart.
 */
export function eightEight(blocks, kinds = DAY_KINDS) {
  const t = totals(blocks, kinds);
  const groups = EIGHT.map((g) => {
    const minutes = t.byKind.filter((k) => (k.eight ?? 'other') === g.id).reduce((s, k) => s + k.minutes, 0) + (g.id === 'other' ? t.other : 0);
    return { ...g, minutes, delta: g.id === 'other' ? null : minutes - g.minutes };
  });
  const left = t.byKind.filter((k) => (k.eight ?? 'other') === 'other').sort((a, b) => b.minutes - a.minutes);
  return { groups, left: t.other ? [...left, { id: '', name: 'Removed category', minutes: t.other }] : left, unplanned: t.unplanned };
}
/** +1 h, −30 min (a real minus, easy to see), same. */
export const fmtDelta = (m) => (m === 0 ? 'same' : `${m > 0 ? '+' : '−'}${fmtSpan(Math.abs(m))}`);

/**
 * Personal life by the 3 Fs, 3 Hs and 3 Ss (D-151): the minutes of each part and group, from the
 * personal-life categories given a part, and the personal-life categories not given one.
 */
export function personalParts(blocks, kinds = DAY_KINDS) {
  const personal = totals(blocks, kinds).byKind.filter((k) => k.eight === 'personal');
  const of = (part) => personal.filter((k) => k.part === part).reduce((s, k) => s + k.minutes, 0);
  const groups = PART_GROUPS.map((g) => { const parts = g.parts.map((x) => ({ ...x, minutes: of(x.id) })); return { ...g, parts, minutes: parts.reduce((s, x) => s + x.minutes, 0) }; });
  return { groups, none: personal.filter((k) => !PART_IDS.includes(k.part)) };
}
