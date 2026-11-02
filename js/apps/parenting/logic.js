// Parenting (D-095): topics that bring decisions to light, and a dashboard of how many
// have been talked through and agreed. The decisions themselves live in the Decisions
// app (source "parenting:<topic>"), each with the ages it applies to - so it is in force
// while a child in the family is that age. Pure - no DOM.

import { STARTER } from './content.js';

export const SECTIONS = [
  { id: 'decide', name: 'Decide together', purpose: 'The choices: options, trade-offs, timing and the science.' },
  { id: 'ages', name: 'Ages and stages', purpose: 'Leaps and milestones, and what becomes a decision when.' },
  { id: 'ready', name: 'Get ready', purpose: 'Before the birth: checklists, what to keep at home, and how many.' },
  { id: 'normal', name: 'What’s normal?', purpose: 'Poop, temperature, rashes - and when to have it checked.' },
  { id: 'emergency', name: 'Emergencies', purpose: 'Falls, choking, stopped breathing: what to do, worked out ahead.' },
  { id: 'rules', name: 'House rules', purpose: 'Our rules, grandparents and visitors, sleepovers.' },
  { id: 'out', name: 'Out and about', purpose: 'Sun, water and being out in public.' },
];

const str = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const lines = (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 60);
const month = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Whole months from a birthday to today (negative before it - a due date works too). */
export function monthsOld(born, today) {
  if (!isDay(born) || !isDay(today)) return null;
  const [y, m, d] = born.split('-').map(Number); const [Y, M, D] = today.split('-').map(Number);
  return (Y - y) * 12 + (M - m) - (D < d ? 1 : 0);
}

/** The children: under 18 by their birthday (or due date), or marked as a child. */
export function kidsOf(people, today) {
  return people.map((p) => ({ id: p.id, name: p.name, months: monthsOld(p.born, today), role: p.role }))
    .filter((p) => (p.months != null ? p.months < 216 : p.role === 'child'));
}
/** Everyone else: the people who agree. */
export const adultsOf = (people, today) => { const k = new Set(kidsOf(people, today).map((x) => x.id)); return people.filter((p) => !k.has(p.id)); };

/** "6 months", "1 year", "18 months", "2 years", "3 months before birth". */
export function ageLabel(m) {
  if (m == null) return '';
  if (m < 0) return `${-m} month${m === -1 ? '' : 's'} before birth`;
  if (m === 0) return 'birth';
  if (m < 24 && m % 12) return `${m} month${m === 1 ? '' : 's'}`;
  if (m % 12 === 0) return `${m / 12} year${m === 12 ? '' : 's'}`;
  return `${Math.floor(m / 12)} years ${m % 12} months`;
}
/** "From birth to 12 months", "From 6 months", "Any age". */
export function rangeLabel(from, to) {
  if (from == null && to == null) return 'Any age';
  if (to == null) return `From ${ageLabel(from)}`;
  return `${from == null || from <= 0 ? (from < 0 ? `From ${ageLabel(from)}` : 'From birth') : `From ${ageLabel(from)}`} to ${ageLabel(to)}`;
}

/** In the range: from its start, up to (not including) its end. */
export const inRange = (m, from, to) => m != null && (from == null || m >= from) && (to == null || m < to);

/**
 * When a decision or topic matters for this family, from the children's ages.
 * now: children in the range; soon: children entering it within `soon` months.
 * when: 'now' | 'soon' | 'later' (none there yet) | 'past' (every child past it) | 'none' (no children).
 */
export function timing(from, to, kids, soon = 3) {
  const known = kids.filter((k) => k.months != null);
  const now = known.filter((k) => inRange(k.months, from, to));
  const next = known.filter((k) => from != null && k.months < from && from - k.months <= soon);
  const when = !known.length ? 'none' : now.length ? 'now' : next.length ? 'soon' : known.every((k) => to != null && k.months >= to) ? 'past' : 'later';
  return { now, soon: next, when };
}

/** One saved topic record: the family's own topic, or their changes to a starting one. */
export function normaliseRecord(r = {}) {
  const leanings = {};
  for (const [pid, l] of Object.entries(r.leanings ?? {})) if (l && (str(l.pick) || str(l.why))) leanings[pid] = { pick: str(l.pick, 200), why: str(l.why, 2000), at: str(l.at, 40) };
  return {
    ...r,
    topicId: str(r.topicId, 80),
    own: r.own === true,
    removed: r.removed === true,
    edited: r.edited === true,
    title: str(r.title, 200),
    section: str(r.section, 40),
    question: str(r.question, 400),
    summary: str(r.summary),
    ageFrom: month(r.ageFrom),
    ageTo: month(r.ageTo),
    options: lines(r.options),
    align: lines(r.align),
    family: lines(r.family),
    notes: str(r.notes),
    items: lines(r.items),
    done: lines(r.done),
    baseV: Number(r.baseV) || 0,
    leanings,
  };
}

/** Own sections the family added. */
export const normaliseSection = (s = {}) => ({ ...s, name: str(s.name, 60) || 'Our section', purpose: str(s.purpose, 200) });

/**
 * Every topic: the starting ones with the family's changes on top, minus the removed ones,
 * plus their own. Each { ...topic, record, newer } - newer: an edited starting topic that
 * has since been improved here.
 */
export function topicsOf(records, starter = STARTER) {
  const byTopic = new Map(records.map((r) => [r.topicId, normaliseRecord(r)]));
  const out = [];
  for (const t of starter) {
    const rec = byTopic.get(t.id) ?? null;
    if (rec?.removed) continue;
    const mine = rec?.edited ? {
      title: rec.title || t.title, section: rec.section || t.section, question: rec.question || t.question, summary: rec.summary || t.summary,
      ages: { from: rec.ageFrom ?? t.ages?.from ?? null, to: rec.ageTo ?? t.ages?.to ?? null },
      align: rec.align.length ? rec.align : t.align, family: rec.family.length ? rec.family : t.family, items: rec.items.length ? rec.items : t.items,
      ...(rec.options.length ? { options: parseOptions(rec.options) } : {}),
    } : {};
    out.push({ ...t, ...mine, record: rec, newer: !!rec?.edited && (t.v ?? 0) > rec.baseV, later: t.later && !rec?.edited });
  }
  for (const rec of byTopic.values()) {
    if (!rec.own || rec.removed) continue;
    out.push({
      id: rec.topicId, own: true, kind: rec.items.length ? 'checklist' : 'decision', title: rec.title || 'Our topic', section: rec.section || 'decide',
      question: rec.question, summary: rec.summary, ages: { from: rec.ageFrom, to: rec.ageTo }, align: rec.align, family: rec.family, items: rec.items,
      options: parseOptions(rec.options),
      record: rec,
    });
  }
  return out;
}

/** "Name: what we think of it" lines into options. */
const parseOptions = (xs) => xs.map((x) => { const [name, ...rest] = x.split(':'); return { name: name.trim(), note: rest.join(':').trim() }; });

/** The decisions from Parenting, with the topic each came from ('' when made without one). */
export const parentingDecisions = (decisions) => decisions.filter((d) => typeof d.source === 'string' && d.source.startsWith('parenting:'))
  .map((d) => ({ ...d, topicId: d.source.slice('parenting:'.length) }));

/** 'agreed' (a decision with an agreement), 'discussing' (leanings or a decision being worked out) or 'new'. */
export function topicStatus(topic, decisions) {
  const ds = decisions.filter((d) => d.topicId === topic.id);
  if (ds.some((d) => d.hasAgreement || str(d.agreement))) return 'agreed';
  if (ds.length || Object.keys(topic.record?.leanings ?? {}).length || (topic.record?.done ?? []).length) return 'discussing';
  return 'new';
}
export const STATUS_LABEL = { new: 'Not started', discussing: 'Discussing', agreed: 'Agreed' };

/**
 * The dashboard: how far along, per section; decisions in force now, coming up, not needed now;
 * and topics worth agreeing because a child is that age now or soon.
 */
export function dashboard(topics, decisions, kids, sections = SECTIONS) {
  const ds = parentingDecisions(decisions);
  const status = new Map(topics.map((t) => [t.id, topicStatus(t, ds)]));
  const count = (list) => ({ total: list.length, agreed: list.filter((t) => status.get(t.id) === 'agreed').length, discussing: list.filter((t) => status.get(t.id) === 'discussing').length });
  const bySection = sections.map((s) => ({ ...s, ...count(topics.filter((t) => t.section === s.id)) }));
  const timed = ds.map((d) => ({ d, t: timing(d.ageFrom ?? null, d.ageTo ?? null, kids) }));
  return {
    ...count(topics),
    status,
    bySection,
    inForce: timed.filter((x) => x.t.when === 'now' || (x.t.when === 'none' && d0(x.d))),
    comingUp: timed.filter((x) => x.t.when === 'soon'),
    notNeeded: timed.filter((x) => x.t.when === 'past' || x.t.when === 'later'),
    worthAgreeing: topics.filter((t) => status.get(t.id) !== 'agreed' && t.ages && ['now', 'soon'].includes(timing(t.ages.from, t.ages.to, kids).when)),
  };
}
// Without children yet, a decision with no age limit still applies.
const d0 = (d) => d.ageFrom == null && d.ageTo == null;

/** Partner leanings: mine, and the others' - hidden until I have given mine, so neither sways the other. */
export function leaningsFor(record, adults, me) {
  const l = record?.leanings ?? {};
  const mine = me ? l[me] ?? null : null;
  return {
    mine,
    others: adults.filter((p) => p.id !== me).map((p) => ({ id: p.id, name: p.name, answered: !!l[p.id], shown: mine ? l[p.id] ?? null : null })),
  };
}

/** The line under the Parenting tile. */
export function tileNote(dash) {
  if (dash.comingUp.length) return `${dash.comingUp.length} coming up soon`;
  if (dash.worthAgreeing.length) return `${dash.worthAgreeing.length} worth agreeing now`;
  return dash.total ? `${dash.agreed} of ${dash.total} agreed` : null;
}

/** A health flowchart: the node, or null. Answers are [label, next]. */
export const stepAt = (steps, id) => steps?.nodes?.[id ?? steps.start] ?? null;

/** A new id for the family's own topic. */
export const ownId = (title, now = Date.now()) => `own-${str(title, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topic'}-${now.toString(36)}`;
