// Tickets (product plan section 10): capture now, discuss later. A ticket is
// not an accusation or a commitment - it is something worth remembering, and
// possibly worth talking about. Pure - no DOM.

export const TYPES = {
  appreciation: { label: 'Appreciation', hint: 'Something someone did that you valued.' },
  success: { label: 'Success', hint: 'Something that went well.' },
  observation: { label: 'Observation', hint: 'Something you noticed - no judgement yet.' },
  concern: { label: 'Concern', hint: 'Something that worries you and may be worth discussing.' },
  idea: { label: 'Idea', hint: 'An opportunity or a different way of doing something.' },
  improvement: { label: 'Home improvement', hint: 'Something about the house that could work better.' },
};

export const STATUSES = ['captured', 'discuss', 'deferred', 'closed'];
export const STATUS_LABEL = { captured: 'Captured', discuss: 'For the next family meeting', deferred: 'Later', closed: 'Closed' };

const POSITIVE = new Set(['appreciation', 'success']);

const str = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function normaliseTicket(t = {}) {
  return {
    ...t,
    type: TYPES[t.type] ? t.type : 'observation',
    text: str(t.text) || '(empty)',
    about: Array.isArray(t.about) ? t.about.filter((x) => typeof x === 'string') : [],
    status: STATUSES.includes(t.status) ? t.status : 'captured',
    notes: str(t.notes),
    closedReason: str(t.closedReason, 500),
    outcome: ['decision', 'task', 'none'].includes(t.outcome) ? t.outcome : null,
    createdBy: typeof t.createdBy === 'string' ? t.createdBy : null,
    visibility: 'shared',      // private tickets need real accounts first (DECISIONS.md O-4/O-5)
  };
}

/** The first line, short - what a list shows. */
export const headline = (text) => {
  const line = String(text || '').split('\n')[0].trim();
  return line.length > 90 ? `${line.slice(0, 87)}…` : line;
};

export function ticketSummary(t) {
  return { title: headline(t.text), type: t.type, status: t.status, createdBy: t.createdBy, outcome: t.outcome, about: t.about };
}

export const ticketText = (t) => `${t.text} ${t.notes} ${TYPES[t.type].label}`;

export const isPositive = (s) => POSITIVE.has(s.type);
export const isOpen = (s) => s.status !== 'closed';

/**
 * The weekly family meeting (plan 10.4): start with what went well, then the
 * things chosen for discussion. Everything else waits, untouched.
 */
export function agenda(summaries) {
  const open = summaries.filter(isOpen);
  return {
    appreciations: open.filter(isPositive),
    toDiscuss: open.filter((s) => !isPositive(s) && s.status === 'discuss'),
    waiting: open.filter((s) => !isPositive(s) && s.status === 'captured'),
    later: open.filter((s) => s.status === 'deferred'),
  };
}

export function setStatus(t, status, { reason = '', outcome = null } = {}) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status ${status}`);
  return { ...t, status, closedReason: status === 'closed' ? String(reason).trim().slice(0, 500) : '', outcome: status === 'closed' ? outcome ?? 'none' : null };
}
