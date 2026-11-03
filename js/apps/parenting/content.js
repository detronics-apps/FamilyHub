// The starting topics (D-092, reworded D-107): a starting point the family changes, removes and
// adds to. Neutral throughout - the app asks and points out where people disagree; it states no
// study as fact and recommends nothing. The parents decide, and write their own reasons.
// Ages are in months. `v` goes up when a topic is improved, so an edited copy can offer it.
// Pure data - no DOM.

// Who to call - checked 2026-11-02. Your own doctor and clinic are worth adding to People.
export const EMERGENCY = [
  ['Ambulance', '10177'],
  ['From any cell phone (even without airtime)', '112'],
  ['ER24', '084 124'],
  ['Netcare 911', '082 911'],
  ['Poisons Information Helpline', '0861 555 777'],
];

// Starting numbers by country (D-103) - the family edits, removes and adds (their doctor, the
// clinic, the after-hours line). Check them for where you live.
export const COUNTRY_NUMBERS = {
  za: { name: 'South Africa', numbers: EMERGENCY },
  uk: { name: 'United Kingdom', numbers: [['Emergency', '999'], ['From any phone in Europe', '112'], ['NHS advice (not an emergency)', '111']] },
  us: { name: 'United States', numbers: [['Emergency', '911'], ['Poison Control', '1-800-222-1222']] },
  ca: { name: 'Canada', numbers: [['Emergency', '911']] },
  eu: { name: 'European Union', numbers: [['Emergency', '112']] },
  au: { name: 'Australia', numbers: [['Emergency', '000'], ['From a mobile', '112'], ['Poisons Information', '13 11 26']] },
  nz: { name: 'New Zealand', numbers: [['Emergency', '111'], ['Healthline', '0800 611 116']] },
};

/** The family's numbers: their own list, or South Africa's to start. */
export function numbersOf(settings) {
  const own = Array.isArray(settings?.numbers) ? settings.numbers.filter((x) => Array.isArray(x) && String(x[1] ?? '').trim()).map(([l, n]) => [String(l ?? '').trim().slice(0, 60) || 'Number', String(n).trim().slice(0, 30)]) : null;
  return own && own.length ? own : EMERGENCY;
}

export const GO_LINE = 'If you are wondering whether to go, go. Better to go and it is nothing than not go and it was something.';

const WRITTEN = [
  {
    id: 'honey', v: 2, section: 'decide', title: 'Honey', ages: { from: 0, to: 12 },
    question: 'Have you talked about honey for your baby?',
    summary: 'Many families keep honey from young babies. Look into why, and decide together - and make sure everyone who feeds the baby knows.',
    align: ['From what age, and does it include food made with honey?'],
    family: ['What we decided about honey, and why.'],
  },
  {
    id: 'water', v: 2, section: 'decide', title: 'Water for babies', ages: { from: 0, to: 12 },
    question: 'When will your baby have water, and how much?',
    summary: 'Families differ on when babies have water. Look into it, and decide together what you will do - including on hot days and when the baby is ill.',
    align: ['What we do on hot days.', 'Who makes up formula, and how.'],
    family: ['What we decided about water for the baby.'],
  },
  {
    id: 'feeding', v: 2, section: 'decide', title: 'Feeding: breast, bottle, or both', ages: { from: 0, to: 24 },
    question: 'How will your baby be fed, with what, and until when?',
    summary: 'One of the first and biggest decisions, and a personal one. The questions below go through how, with what, and until when - the reasons are yours.',
    align: ['What we try first, and what we do if it is not working.', 'How night feeds are shared.'],
    family: ['However we feed, please support it rather than comment on it.'],
  },
  {
    id: 'cosleep', v: 2, section: 'decide', title: 'Where the baby sleeps', ages: { from: 0, to: 12 },
    question: 'Where will the baby sleep, and what will you never do, however tired?',
    summary: 'Families choose very differently here. Decide together where the baby sleeps, and agree what you will never do, however tired you are.',
    align: ['Where the baby sleeps.', 'What we do at 3am when we are exhausted.'],
    family: ['Where and how the baby sleeps when you look after them.'],
  },
  {
    id: 'fever', v: 2, section: 'normal', title: 'Temperature and fever', ages: { from: 0, to: 60 }, health: true,
    question: 'What will you do at what temperature - and when will you go to a doctor?',
    summary: 'Agree your plan while everyone is calm: what you do at what temperature, how often you check, and when you go to a doctor. Then, on the night, you follow what you decided - and talk it over again afterwards.',
    prepare: ['A thermometer you both know how to use, and where it is kept', 'The medicine chart filled in (see Medicines to keep at home)', 'Your doctor, the after-hours number and the nearest hospital saved on both phones'],
    align: ['Our fever plan.', 'Who does what.'],
  },
  {
    id: 'choking', v: 2, section: 'emergency', title: 'Choking', ages: { from: 0, to: 144 }, health: true,
    question: 'Do you both know what to do if a child chokes?',
    summary: 'Worth knowing before it ever happens. A first-aid course, with a practice doll, is where this is best learnt.',
    firstAid: [
      'If they are coughing hard, let them cough and stay with them.',
      'If they cannot cough, cry or breathe: shout for someone to call for help.',
      'Under 1 year: face down along your arm, head lower - up to 5 back blows; then face up, 2 fingers on the middle of the chest - up to 5 chest thrusts. Repeat.',
      'Over 1 year: leaning forward - up to 5 back blows; then from behind, a fist above the belly button - up to 5 pulls in and up. Repeat.',
      'Only take out what you can see.',
      'If they stop responding: call for help on speaker and start CPR as the call-taker says.',
      'Afterwards, have them checked by a doctor.',
    ],
    prepare: ['A first-aid course for both of us', 'Small things out of reach', 'Emergency numbers saved on both phones'],
    align: ['Both of us do a course.', 'Which foods we cut up or keep away.'],
    family: ['Anyone who looks after the children knows what to do if they choke.'],
  },
  {
    id: 'sun', v: 2, section: 'out', title: 'Sun and skin', ages: { from: 0, to: 216 },
    question: 'How will you balance time in the sun and protecting their skin?',
    summary: 'There is ongoing discussion about sun exposure and about sunscreen. Look into it, and decide together what you are comfortable with - shade, clothing, the time of day, short spells in the sun, sunscreen, or your own mix.',
    align: ['Our usual way in the sun, and at the pool or beach.'],
    family: ['How we do things in the sun, so it is the same when you have them.'],
  },
  {
    id: 'monitors', v: 2, section: 'decide', title: 'Baby monitors', ages: { from: 0, to: 36 },
    question: 'Do you want a baby monitor - and what would you want it to do?',
    summary: 'Some families use a monitor, some do not. Think about what you would want it to do, and whether it would change what you do.',
    align: ['Whether we use one, and which kind.'],
  },
  {
    id: 'childcare', v: 2, section: 'decide', title: 'Who looks after the children', ages: { from: 0, to: 216 },
    question: 'Will anyone other than the two of you look after the children - and if so, who, and from what age?',
    summary: 'Families answer this very differently, and each answer has its reasons. Whatever you agree here, the app follows it - for instance, Dates never asks about a babysitter if the answer is only the two of you.',
    align: ['Who, if anyone, and from what age.', 'What happens in an emergency when one of you cannot be there.'],
    family: ['Our rule on who looks after the children, and why - so nobody offers and is hurt by the answer.'],
  },
  {
    id: 'predelivery', v: 2, section: 'ready', title: 'Before the baby arrives', ages: { from: -4, to: 1 }, kind: 'checklist',
    question: 'What is easier to sort out before the birth than after it?',
    summary: 'A starting list - tick what is done, remove what does not apply and add your own.',
    items: [
      'Car seat bought and fitted (practise before the day)', 'Hospital bag packed, with the paperwork and medical aid card',
      'Doctor or clinic chosen', 'Medical aid: how and by when to add the baby',
      'Home Affairs: what is needed to register the birth, and by when', 'Where the baby will sleep, set up',
      'A first-aid course', 'Emergency numbers saved on both phones',
      'A thermometer', 'Nappies, wipes and creams', 'Newborn clothes', 'Freezer meals for the first weeks',
      'Who helps in the first weeks, and when', 'Visitor rules agreed', 'Pets: how they will meet the baby', 'Smoke alarm working',
    ],
  },
];

// Not written yet: shown so the whole list is visible, with a section and the ages it matters.
const LATER = [
  ['dummies', 'decide', 'Dummies', 0, 48], ['sugar', 'decide', 'Sugar: when and how much', 0, 72], ['screens', 'decide', 'Screen time', 0, 216],
  ['cryitout', 'decide', 'Crying it out, and the alternatives', 4, 36], ['regulation', 'decide', 'Dysregulation and self-regulation', 12, 144],
  ['potty', 'decide', 'Potty training', 18, 48], ['daycare', 'decide', 'Daycare', 3, 72], ['homeschool', 'decide', 'Homeschooling', 48, 216],
  ['allergies', 'decide', 'Food and allergies', 4, 60], ['foodrules', 'decide', 'Food and drink: do’s, don’ts and why', 4, 60],
  ['medicalaid', 'decide', 'Medical aid for the baby', -6, 216], ['newused', 'ready', 'New or second-hand', -6, 60],
  ['bottles', 'ready', 'Bottles and teats', -2, 18], ['sterilising', 'ready', 'Sterilising: how and for how long', -1, 12],
  ['glassplastic', 'ready', 'Glass or plastic (bottles, containers)', -2, 72], ['nappies', 'ready', 'Disposable or cloth nappies', -3, 36],
  ['wipes', 'ready', 'Wipes and creams', -3, 36], ['powders', 'ready', 'Baby powder', -3, 36],
  ['stock', 'ready', 'Medicines and creams to keep at home', -2, 144], ['clothes', 'ready', 'Clothes: layers, materials, how many', -3, 36],
  ['stairs', 'ready', 'Stairs and heights', 4, 48], ['pets', 'ready', 'Pets and the baby', -3, 72],
  ['milestones', 'ages', 'Milestones by age', 0, 72], ['leaps', 'ages', 'Leaps and developmental jumps', 0, 24],
  ['poop', 'normal', 'Normal poop: colour and consistency', 0, 36], ['rashes', 'normal', 'Rashes', 0, 144],
  ['falls', 'emergency', 'Falls and bumps to the head', 0, 144], ['breathing', 'emergency', 'Stopped breathing', 0, 144],
  ['rules', 'rules', 'Our house rules', 12, 216], ['grandparents', 'rules', 'Grandparents: boundaries and the reasons', -3, 216],
  ['visitors', 'rules', 'Visitors, illness and kissing newborns', -1, 6], ['sleepovers', 'rules', 'Sleepovers', 36, 216],
  ['exhausted', 'rules', 'Exhausted nights: a system', -1, 24], ['public', 'out', 'Out in public: crowds and germs', 0, 6],
  ['water-safety', 'out', 'Water safety and swimsuit colour', 6, 144],
];

export const STARTER = [
  ...WRITTEN.map((t) => ({ kind: 'decision', ...t, starter: true })),
  ...LATER.map(([id, section, title, from, to]) => ({ id, v: 0, section, title, ages: { from, to }, kind: 'decision', starter: true, later: true })),
];

