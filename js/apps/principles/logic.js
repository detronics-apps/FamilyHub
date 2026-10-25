// Principles (product plan section 11): shared values, household guidelines
// and practical agreements - with the reason behind each, its exceptions, and
// what should make the family look at it again. Mutual guidance, not rules.
// Pure - no DOM.

export const KINDS = {
  value: 'A value we hold',
  guideline: 'A household guideline',
  agreement: 'A practical agreement',
};

const str = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const lines = (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 30);

export function normalisePrinciple(p = {}) {
  return {
    ...p,
    title: str(p.title, 200) || 'Untitled principle',
    kind: KINDS[p.kind] ? p.kind : 'guideline',
    belief: str(p.belief),
    apply: lines(p.apply),
    exceptions: str(p.exceptions),
    rationale: str(p.rationale),
    target: str(p.target, 500),
    reviewTrigger: str(p.reviewTrigger, 1000),
    reviewOn: typeof p.reviewOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.reviewOn) ? p.reviewOn : null,
    status: p.status === 'retired' ? 'retired' : 'active',
    demo: p.demo === true,
  };
}

export function principleSummary(p) {
  return { title: p.title, kind: p.kind, status: p.status, reviewOn: p.reviewOn, demo: p.demo };
}

export const principleText = (p) => [p.title, p.belief, ...p.apply, p.exceptions, p.rationale, p.target].join(' ');

/** Due for a look: a review date that has arrived. Shown as an invitation, not a warning. */
export const reviewDue = (s, today) => s.status === 'active' && Boolean(s.reviewOn) && s.reviewOn <= today;

/** The two worked examples from the product plan, offered only when asked for, and labelled. */
export const EXAMPLES = [
  {
    title: 'Assume positive intent', kind: 'value',
    belief: 'Everyone wants to succeed and contribute, even when something goes wrong.',
    apply: ['Do not assume laziness when a chore is missed.', 'Ask what prevented it from happening.', 'Consider time, energy, clarity, storage and how the system is set up.', 'Describe problems in order to find solutions.', 'Address repeated failures respectfully.'],
    rationale: 'Assuming positive intent does not mean ignoring a problem. It changes how we look into it and respond.',
    exceptions: '', reviewTrigger: '', demo: true,
  },
  {
    title: 'Put it away, don’t put it down', kind: 'guideline',
    belief: 'Small actions prevent clutter from building up and reduce the burden of deep cleaning later.',
    apply: ['When practical, return items to their places.'],
    exceptions: 'Exhaustion, urgent needs, childcare, or when putting something away is not practical.',
    reviewTrigger: 'If clutter keeps building, look at whether storage, room layout, workload or how this is applied needs to change.',
    rationale: '', demo: true,
  },
];
