// The "How to use" content, the search over it, and the privacy/about text.
// Plain data so it can grow without touching layout code.

// Each app term carries the everyday words a person might search with instead.
export const SEARCH_ALIASES = {
  'do something now': ['five minutes', 'spare time', 'what should i do', 'quick job', 'suggest', 'find a task', 'execute'],
  chore: ['housework', 'cleaning', 'job', 'task', 'tidy'],
  plan: ['add a chore', 'create', 'new chore', 'set up', 'schedule', 'how often'],
  later: ['postpone', 'not now', 'tomorrow', 'defer', 'put off', 'snooze'],
  skip: ['miss', 'missed', 'not this time', 'skip it'],
  export: ['backup', 'back up', 'save a copy', 'download', 'move to another device', 'transfer'],
  import: ['restore', 'load', 'open a file', 'bring back'],
  dashboard: ['home screen', 'tiles', 'buttons', 'reorder', 'hide', 'rearrange'],
  'who are you': ['profile', 'switch person', 'login', 'sign in', 'user', 'account'],
  example: ['demo', 'sample', 'fake data', 'pretend family'],
  room: ['kitchen', 'bathroom', 'area', 'place'],
  review: ['keeps getting missed', 'never gets done', 'too much', 'overwhelmed', 'falling behind'],
};

export function searchText(text) {
  const low = String(text || '').toLowerCase();
  let extra = '';
  for (const [term, syns] of Object.entries(SEARCH_ALIASES)) {
    if (low.includes(term)) extra += ` ${syns.join(' ')}`;
  }
  return low + extra;
}

/** Every word of the query must appear. */
export function guideMatches(text, q) {
  if (!q || !q.trim()) return true;
  const hay = searchText(text);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export const HOWTOS = [
  { id: 'quick', title: 'Find something to do right now', steps: [
    'On the home screen, press Chores. It opens on "Do something now".',
    'Optionally say how much time you have, how your energy is, and where you want to be.',
    'Pick any suggestion and press Done when it is finished.',
    'Do another one if you like, or press "Finish for now". Stopping is always fine.',
  ] },
  { id: 'add', title: 'Plan a new chore', steps: [
    'Open Chores, then the Plan tab.',
    'Press "Add a chore". Only the name is needed.',
    'Choose how often, roughly how long, and how much effort it takes, if you know.',
    'Open "More details" for instructions, who can do it, and what it depends on.',
    'Press Save.',
  ] },
  { id: 'later', title: 'Put a chore off without guilt', steps: [
    'On any chore, press "Not now".',
    'Choose Later today, Tomorrow, Next week, or a date of your own. For a repeating chore you can also Skip this time.',
    'A routine chore that is skipped simply comes round again on its normal cycle.',
  ] },
  { id: 'room', title: 'Work through one room', steps: [
    'Open Chores, then the Rooms tab.',
    'Each room lists its own chores. Pressing Done on one never ticks off the others.',
  ] },
  { id: 'who', title: 'Say who is using the app', steps: [
    'Press the person button at the top right ("Who are you?").',
    'Choose your name. Completed chores are recorded under that name, and your dashboard order is your own.',
    'This is a convenience, not a login: anyone using this device can choose any name.',
  ] },
  { id: 'dash', title: 'Rearrange or hide dashboard buttons', steps: [
    'Open Settings, then "Your dashboard".',
    'Use the up and down arrows to reorder, and Hide to tuck a module away.',
    'Hidden modules are listed underneath with a Show button to bring them back.',
  ] },
  { id: 'export', title: 'Make a copy of your data, or move it to another device', steps: [
    'Open Settings, then "Your data".',
    'Press "Export household". A .json file is saved to your device.',
    'On the other device, press "Import a file" and choose it. You will be asked before anything is replaced.',
  ] },
  { id: 'demo', title: 'Remove the example family', steps: [
    'Press "Remove examples" on the notice at the top of any Chores screen, or in Settings under "Your data".',
    'Only the example records go. Anything you added yourself stays.',
  ] },
];

export const FAQS = [
  { q: 'What happens when we miss a chore?', a: 'Nothing piles up. A repeating chore has one current turn: if it is missed, it simply stays ready until someone does it or skips it, then its normal cycle carries on. Missed chores are information about how much the week can hold, not extra work for tomorrow.' },
  { q: 'Why is a chore asking for a review?', a: 'If a chore has been put off three times in a row, or has waited two whole cycles, the Plan tab gently asks whether the plan still fits - maybe it needs less often, a different time, a different person, or something that makes it easier. Nothing is added or changed unless you change it.' },
  { q: 'How are suggestions chosen?', a: 'Your filters remove what does not fit (too long, too much effort, wrong room, not yours to do, or waiting on another chore). What is left is ordered: ready chores before optional ones, important before ordinary, then whatever has waited longest for its own cycle, then the quickest. The "Why these suggestions?" panel shows this with your current choices.' },
  { q: 'Are the times exact?', a: 'No. Minutes and effort are rough guesses the family sets. A chore with no time set is still shown, and is labelled "Time not estimated".' },
  { q: 'What is the difference between Skip, Later and No longer needed?', a: 'Skip this time: a repeating chore is let go for this round and comes back on its normal cycle. Later or a date: the same turn waits until then. No longer needed: a one-off chore is closed without being done.' },
  { q: 'Is choosing my name a login?', a: 'No. Anyone using this device can choose any profile. It is a convenience for recording who did what and for keeping each person\'s dashboard. Real accounts and private records will come before anything sensitive, like medical details, is added.' },
  { q: 'Where is our data kept?', a: 'Only in this browser, on this device. Nothing is sent anywhere. Browser storage is not a backup and does not sync between devices - use Export to keep a copy.' },
  { q: 'Why do most dashboard buttons say "Not built yet"?', a: 'This first version builds Chores properly, end to end. The other modules are shown so you can arrange your dashboard, but they do nothing yet and say so.' },
  { q: 'Can a child use it?', a: 'A child profile only sees chores where they are named under "Who can do it". Adults see every chore that names no one, plus any that name them.' },
];

export const FEATURES = [
  { name: 'Avoid a room', where: 'Chores → Do something now', what: 'With "Anywhere" chosen, tap rooms under "Not today" to leave them out.' },
  { name: 'Undo', where: 'After pressing Done', what: 'The confirmation has an Undo button, in case it was pressed by mistake.' },
  { name: 'Dependencies', where: 'Plan → More details', what: 'A chore can wait for another, like vacuuming after the toys are tidied. It is not suggested until then.' },
  { name: 'Optional improvements', where: 'Plan → Kind', what: 'Nice-to-do jobs stay available but are never treated as urgent.' },
  { name: 'Your own dashboard', where: 'Settings → Your dashboard', what: 'Each profile has its own button order and hidden modules on this device.' },
  { name: 'Recovering a damaged save', where: 'Shown automatically', what: 'Family Hub keeps the previous good copy and offers to go back to it if the latest one cannot be read.' },
];

export const PRIVACY = {
  title: 'Privacy & your data',
  sections: [
    ['What leaves this device', 'Nothing. Family Hub has no server, no accounts, no analytics, no cookies and loads nothing from other websites.'],
    ['Where your data is kept', 'In this browser\'s local storage, on this device only. Each device has its own copy. Clearing your browser data removes it.'],
    ['It is not a backup', 'Browser storage can be cleared by the browser or by you. Use Settings → Your data → Export to keep a file you control. The app also keeps one previous copy, only to recover from a damaged save.'],
    ['Profiles are not security', 'Choosing a name is not a login. Anyone using this device can see and change everything here. Do not store sensitive information, like medical details, in this version.'],
    ['Hosting', 'If you use Family Hub from a website, that host may keep ordinary server logs of page requests, as any website does. Your household data is never sent to it.'],
    ['Removing everything', 'Settings → Your data → "Delete everything on this device" removes the household and this device\'s settings.'],
  ],
};

export const ABOUT = {
  title: 'About Family Hub',
  sections: [
    ['What it is', 'A calm place for a household to share the everyday load. Capture quickly, think deeply later, and keep the useful outcome.'],
    ['What this version does', 'Chores, end to end: plan them, find one that fits your time, energy and place, mark it done, and stop or carry on. Your dashboard, profiles, and export/import work. Other modules are placeholders.'],
    ['What it will not do', 'Streaks, scores, leaderboards, or piling missed work onto tomorrow. Missed tasks are information about workload and systems.'],
  ],
};
