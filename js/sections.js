// Sections: the fixed areas of family life on the home screen (Meals, Chores,
// Finance...). A section is part of Family Hub itself and is never installed or
// removed; the mini-apps inside it are. A manifest names its section; one that
// names none, or one this version does not know, lands in "More".
// Pure: no DOM.

export const SECTIONS = [
  { id: 'chores', name: 'Chores', purpose: 'Recurring household work: plan it, then find something that fits right now.' },
  { id: 'tasks', name: 'Tasks', purpose: 'One-off jobs, repairs, errands and bigger projects.' },
  { id: 'shopping', name: 'Shopping', purpose: 'One family list: meals, the week’s plan, cleaning supplies and anything else you need.' },
  { id: 'meals', name: 'Meals', purpose: 'Recipes, the week’s meals, what is in a food, and easy ways to make a meal a little better.' },
  { id: 'exercise', name: 'Exercise', purpose: 'Activity, flexible weekly plans, and what the family did together.' },
  { id: 'tickets', name: 'Tickets', purpose: 'Capture a concern, idea or appreciation - talk about it at the family meeting.' },
  { id: 'principles', name: 'Principles', purpose: 'Family values and agreements, with the reasons behind them.' },
  { id: 'decisions', name: 'Decisions', purpose: 'Agreements and experiments: try something, look back, adapt.' },
  { id: 'holidays', name: 'Holidays', purpose: 'Trip ideas, itineraries, packing lists and budgets.' },
  { id: 'finance', name: 'Finance', purpose: 'Budgets, and savings and debt goals with the assumptions in plain view.' },
  { id: 'faith', name: 'Faith', purpose: 'Bible reading plans, reflections and family discussion.' },
  { id: 'more', name: 'More', purpose: 'Mini-apps that do not belong to one of the other sections.' },
];

const BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));
export const sectionIds = () => SECTIONS.map((s) => s.id);
export const section = (id) => BY_ID.get(id) ?? null;
export const sectionOf = (manifest) => (BY_ID.has(manifest?.section) ? manifest.section : 'more');

/**
 * The sections worth a home-screen tile: those with at least one mini-app
 * installed, or one that could be installed from the starter pack. A section
 * with nothing in it and nothing to offer (an empty "More") stays out of the way.
 * @param manifests every manifest known: installed ones and the starter pack
 */
export function activeSections(manifests) {
  const used = new Set(manifests.map(sectionOf));
  return SECTIONS.filter((s) => used.has(s.id));
}

/** Mini-apps in one section, in the order given (the starter pack's order first). */
export const appsIn = (sectionId, manifests) => manifests.filter((m) => sectionOf(m) === sectionId);
