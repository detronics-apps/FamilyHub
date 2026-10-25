// Decisions and experiments (product plan section 12). A decision is the best
// current agreement given what the family knows - never an immutable rule.
// Cycle: Observe -> Discuss -> Decide -> Experiment -> Review -> Adapt.
// Pure - no DOM.

import { addDays } from '../../dates.js';

export const STAGES = ['observe', 'discuss', 'decide', 'experiment', 'review', 'adapt'];
export const STAGE_LABEL = { observe: 'Observe', discuss: 'Discuss', decide: 'Decide', experiment: 'Experiment', review: 'Review', adapt: 'Adapt' };
export const OUTCOMES = {
  kept: 'Keep it as it is',
  improved: 'Keep it, with changes',
  reversed: 'Stop doing it',
  replaced: 'Try something else instead',
};
export const STATUSES = ['discussing', 'trying', 'settled'];

const str = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const lines = (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 20);

export function normaliseDecision(d = {}) {
  return {
    ...d,
    title: str(d.title, 200) || 'Untitled decision',
    issue: str(d.issue),
    purpose: str(d.purpose, 1000),
    alternatives: lines(d.alternatives),
    reasoning: str(d.reasoning),
    participants: Array.isArray(d.participants) ? d.participants.filter((x) => typeof x === 'string') : [],
    agreement: str(d.agreement),
    reviewOn: day(d.reviewOn),
    indicators: str(d.indicators, 1000),
    observations: (Array.isArray(d.observations) ? d.observations : [])
      .filter((o) => o && typeof o.text === 'string' && o.text.trim())
      .map((o, i) => ({ id: str(o.id, 40) || `ob${i}`, day: day(o.day), text: o.text.trim().slice(0, 1000), by: typeof o.by === 'string' ? o.by : null })),
    outcome: OUTCOMES[d.outcome] ? d.outcome : null,
    lessons: str(d.lessons),
    status: STATUSES.includes(d.status) ? d.status : 'discussing',
    source: typeof d.source === 'string' ? d.source : null,       // e.g. 'tickets:tkt_...'
    history: (Array.isArray(d.history) ? d.history : []).filter((h) => h && typeof h.agreement === 'string').slice(-20),
  };
}

export function decisionSummary(d) {
  return { title: d.title, status: d.status, reviewOn: d.reviewOn, outcome: d.outcome, source: d.source, hasAgreement: Boolean(d.agreement) };
}

export const decisionText = (d) => [d.title, d.issue, d.purpose, d.agreement, d.reasoning, ...d.alternatives, d.lessons].join(' ');

/** Where the decision is in the cycle. Works on a full record or a summary. */
export function stage(d, today) {
  if (d.status === 'settled') return 'adapt';
  if (d.status === 'trying') return d.reviewOn && d.reviewOn <= today ? 'review' : 'experiment';
  if (d.agreement || d.hasAgreement) return 'decide';
  if ((d.alternatives && d.alternatives.length) || d.reasoning) return 'discuss';
  return 'observe';
}

/** Start trying the agreement, with a day to look back (two weeks unless chosen). */
export function startTrial(d, today, reviewOn = null) {
  if (!d.agreement) throw new Error('Write down what you agreed before trying it.');
  return { ...d, status: 'trying', outcome: null, reviewOn: day(reviewOn) ?? addDays(today, 14) };
}

export function addObservation(d, text, { by = null, today, id = `ob${Date.now().toString(36)}` } = {}) {
  const t = String(text || '').trim();
  return t ? { ...d, observations: [...d.observations, { id, day: today, text: t.slice(0, 1000), by }] } : d;
}

/** Look back: record what happened and what was learned. */
export function recordOutcome(d, outcome, lessons = '') {
  if (!OUTCOMES[outcome]) throw new Error(`Unknown outcome ${outcome}`);
  return { ...d, outcome, lessons: String(lessons || d.lessons || '').trim(), status: 'settled' };
}

/**
 * Change the agreement. The old one is kept in the history with the date, so
 * the family can see how its thinking moved. It goes back to being tried.
 */
export function revise(d, agreement, { now = new Date().toISOString(), today, reviewOn = null } = {}) {
  const a = String(agreement || '').trim();
  if (!a) throw new Error('The new agreement is empty.');
  if (a === d.agreement) return d;
  const history = d.agreement ? [...d.history, { at: now, agreement: d.agreement, outcome: d.outcome }] : d.history;
  return { ...d, agreement: a, history, outcome: null, status: 'trying', reviewOn: day(reviewOn) ?? addDays(today, 14) };
}
