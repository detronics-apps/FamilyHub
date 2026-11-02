// Screen time (D-097): awareness, not judgement. A quick log (who, what, how long, when, how
// it went afterwards), each child's week against the rule you agreed, and shows rated on your
// own values - each parent separately - so if and when you watch, you choose by what matters
// to you. Rules are decisions (Decisions, topic "screens") with the ages and minutes a day.
// Pure - no DOM.

import { inRange, timing } from './logic.js';

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const score = (v) => { const n = num(v); return n == null ? null : Math.max(1, Math.min(5, Math.round(n))); };

export const AFTER = { calm: 'Calm', fine: 'Fine', wound: 'Wound up' };

// Your values - a starting point: rename, remove, add, and weigh them (0 = ignore, 3 = matters most).
export const CRITERIA = [
  { id: 'pace', name: 'Calm pace', hint: '5 = gentle; 1 = frantic cuts and noise', weight: 2 },
  { id: 'learning', name: 'Language and learning', hint: 'Words, numbers, questions, ideas', weight: 2 },
  { id: 'kindness', name: 'Kindness', hint: 'How the characters treat each other', weight: 2 },
  { id: 'ending', name: 'Easy to switch off', hint: '5 = episodes end calmly; 1 = cliffhangers and autoplay pull', weight: 1 },
  { id: 'ads', name: 'No buying push', hint: '5 = none; 1 = made to sell toys', weight: 1 },
  { id: 'parents', name: 'We can stand it', hint: 'Would we happily watch it with them?', weight: 1 },
];

// Shows to start from: names and roughly the ages they are made for - change, remove, add.
// Scores start empty: they are yours to give.
export const STARTER_SHOWS = [
  { id: 'bluey', name: 'Bluey', ageFrom: 36, ageTo: 96 },
  { id: 'pawpatrol', name: 'Paw Patrol', ageFrom: 24, ageTo: 72 },
  { id: 'msrachel', name: 'Ms Rachel', ageFrom: 6, ageTo: 48 },
  { id: 'sesame', name: 'Sesame Street', ageFrom: 24, ageTo: 72 },
  { id: 'peppa', name: 'Peppa Pig', ageFrom: 24, ageTo: 60 },
  { id: 'duggee', name: 'Hey Duggee', ageFrom: 24, ageTo: 72 },
  { id: 'danieltiger', name: 'Daniel Tiger’s Neighborhood', ageFrom: 24, ageTo: 60 },
  { id: 'numberblocks', name: 'Numberblocks', ageFrom: 36, ageTo: 84 },
  { id: 'octonauts', name: 'Octonauts', ageFrom: 36, ageTo: 96 },
  { id: 'cocomelon', name: 'Cocomelon', ageFrom: 6, ageTo: 48 },
];

export function normaliseLog(l = {}) {
  return {
    ...l,
    day: isDay(l.day) ? l.day : null,
    time: /^\d{2}:\d{2}$/.test(l.time ?? '') ? l.time : null,
    kids: (Array.isArray(l.kids) ? l.kids : []).filter((x) => typeof x === 'string'),
    showId: str(l.showId, 80) || null,
    what: str(l.what, 120),
    minutes: Math.max(0, Math.min(600, num(l.minutes) ?? 0)),
    after: AFTER[l.after] ? l.after : null,
    by: str(l.by, 40) || null,
  };
}

export function normaliseShow(s = {}) {
  const ratings = {};
  for (const [pid, r] of Object.entries(s.ratings ?? {})) {
    const clean = Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, score(v)]).filter(([, v]) => v != null));
    if (Object.keys(clean).length) ratings[pid] = clean;
  }
  return { ...s, showId: str(s.showId ?? s.id, 80), name: str(s.name, 120) || 'A show', ageFrom: num(s.ageFrom), ageTo: num(s.ageTo), ratings, own: s.own === true, removed: s.removed === true, note: str(s.note, 1000) };
}

/** The family's criteria and weights (their own, or the starting ones). */
export function criteriaOf(settings) {
  const list = Array.isArray(settings?.criteria) && settings.criteria.length ? settings.criteria : CRITERIA;
  return list.filter((c) => c && str(c.name)).map((c) => ({ id: str(c.id, 40) || str(c.name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: str(c.name, 60), hint: str(c.hint, 160), weight: Math.max(0, Math.min(3, num(c.weight) ?? 1)) }));
}

/** Starting shows with the family's versions on top, minus removed ones, plus their own. */
export function showsOf(records, starter = STARTER_SHOWS) {
  const byId = new Map(records.map((r) => [r.showId, r]));
  const out = [];
  for (const s of starter) { const r = byId.get(s.id); if (!r?.removed) out.push(normaliseShow({ ...s, ...(r ?? {}), showId: s.id, starter: true })); }
  for (const r of records) if (r.own && !r.removed) out.push(normaliseShow(r));
  return out;
}

/** One person's weighted score for a show, 0-5 (null if they have not rated it). */
export function personScore(show, pid, criteria) {
  const r = show.ratings[pid];
  if (!r) return null;
  const parts = criteria.filter((c) => c.weight > 0 && r[c.id] != null);
  const w = parts.reduce((s, c) => s + c.weight, 0);
  return w ? Math.round((parts.reduce((s, c) => s + c.weight * r[c.id], 0) / w) * 10) / 10 : null;
}

/** How it left them, from the log: { times, wound, calm }. */
export function afterEffect(show, logs) {
  const mine = logs.filter((l) => l.showId === show.showId && l.after);
  return { times: mine.length, wound: mine.filter((l) => l.after === 'wound').length, calm: mine.filter((l) => l.after === 'calm').length };
}

/**
 * The ranking: each show's score as the average of everyone who rated it, with each person's own
 * score beside it, and how it left them. Unrated shows come last.
 */
export function ranking(shows, criteria, logs, raters) {
  return shows.map((s) => {
    const each = raters.map((p) => ({ id: p.id, name: p.name, score: personScore(s, p.id, criteria) }));
    const got = each.filter((x) => x.score != null);
    return { show: s, each, score: got.length ? Math.round((got.reduce((a, x) => a + x.score, 0) / got.length) * 10) / 10 : null, after: afterEffect(s, logs) };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.show.name.localeCompare(b.show.name));
}

/** If you do watch today: the best-ranked show made for the youngest child watching, that clears the bar you agreed for them. */
export function suggest(ranked, kids, decisions = []) {
  const known = kids.filter((k) => k.months != null);
  const youngest = known.length ? known.reduce((a, b) => (b.months < a.months ? b : a)) : null;
  const bar = youngest ? minScoreFor(youngest, decisions) : null;
  return ranked.find((r) => r.score != null && (!youngest || inRange(youngest.months, r.show.ageFrom, r.show.ageTo)) && (bar == null || r.score >= bar)) ?? null;
}

/** The lowest show score agreed for a child now (D-098): the strictest in-force rule's, else null. */
export function minScoreFor(kid, decisions) {
  const rules = decisions.filter((d) => d.source === 'parenting:screens' && d.screenMinScore != null && (d.hasAgreement || d.agreement) && timing(d.ageFrom ?? null, d.ageTo ?? null, [kid]).when === 'now');
  return rules.length ? Math.max(...rules.map((d) => d.screenMinScore)) : null;
}

/** For one child: 'ok' (clears the bar), 'below', 'unrated' (not checked yet), or null (no bar agreed). */
export function allowed(score, kid, decisions) {
  const bar = minScoreFor(kid, decisions);
  if (bar == null) return null;
  return score == null ? 'unrated' : score >= bar ? 'ok' : 'below';
}
export const ALLOWED_LABEL = { ok: 'Within what we agreed', below: 'Below what we agreed', unrated: 'Not checked yet' };

/** The minutes a day agreed for a child now: the in-force screen-time decision with a figure, else null. */
export function limitFor(kid, decisions) {
  const rules = decisions.filter((d) => d.source === 'parenting:screens' && d.screenMinutes != null && (d.hasAgreement || d.agreement) && timing(d.ageFrom ?? null, d.ageTo ?? null, [kid]).when === 'now');
  return rules.length ? Math.min(...rules.map((d) => d.screenMinutes)) : null;
}

const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * One child's last 7 days, ending today: minutes each day, the agreed limit, and plain
 * observations - no judgement, no streaks.
 */
export function week(kid, logs, decisions, today, scoreOf = () => null) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const mine = logs.filter((l) => l.kids.includes(kid.id) && days.includes(l.day));
  const byDay = days.map((day) => ({ day, minutes: mine.filter((l) => l.day === day).reduce((s, l) => s + l.minutes, 0) }));
  const limit = limitFor(kid, decisions);
  const total = byDay.reduce((s, d) => s + d.minutes, 0);
  const notes = [];
  if (limit != null) { const over = byDay.filter((d) => d.minutes > limit).length; notes.push(over ? `${over} day${over === 1 ? '' : 's'} over the ${limit} minutes you agreed` : `Within the ${limit} minutes you agreed every day`); }
  const timed = mine.filter((l) => l.time);
  if (timed.length >= 3) {
    const late = timed.filter((l) => l.time >= '17:00').reduce((s, l) => s + l.minutes, 0);
    const all = timed.reduce((s, l) => s + l.minutes, 0);
    if (all && late / all >= 0.6) notes.push('Most of it after 5pm');
    else if (all && late / all <= 0.2) notes.push('Mostly before 5pm');
  }
  const bar = minScoreFor(kid, decisions);
  if (bar != null) {
    const low = mine.filter((l) => l.showId && scoreOf(l.showId) != null && scoreOf(l.showId) < bar).length;
    if (low) notes.push(`${low} time${low === 1 ? '' : 's'} a show below the ${bar} you agreed`);
  }
  const wound = mine.filter((l) => l.after === 'wound').length;
  if (wound) notes.push(`Wound up afterwards ${wound} time${wound === 1 ? '' : 's'}`);
  return { days: byDay, limit, total, average: Math.round(total / 7), notes };
}

/** Today's minutes, for the door. */
export const todayMinutes = (logs, today) => logs.filter((l) => l.day === today).reduce((s, l) => s + l.minutes, 0);
