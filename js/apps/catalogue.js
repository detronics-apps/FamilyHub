// The starter pack: mini-apps that ship with Family Hub. Each is a manifest
// (validated exactly like a third-party one) plus a loader, so its code is only
// fetched when it is first opened. Adding a starter app is one entry here and a
// folder under js/apps/ - nothing else in the core names it.

import { validateManifest } from '../miniapps.js';

const RAW = [
  {
    manifest: {
      fhManifest: 1, id: 'chores', section: 'chores', name: 'Chores', version: '1.0.0',
      description: 'Recurring household work: plan it, then find something that fits right now.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'do', title: 'Do something now' }, { id: 'rooms', title: 'Rooms' },
        { id: 'plan', title: 'Plan' }, { id: 'progress', title: 'Progress' },
      ],
      data: { collections: [] },
      permissions: ['household:chores', 'people:read', 'rooms:read', 'notify', 'media:audio', 'timer'],
    },
    load: () => import('./chores/app.js'),
    importer: () => import('./chores/importer.js').then((m) => m.IMPORTER),
  },
  {
    manifest: {
      fhManifest: 1, id: 'tasks', section: 'tasks', name: 'Tasks', version: '1.0.1',
      description: 'One-off jobs, repairs, errands and bigger projects.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'open', title: 'To do' }, { id: 'mine', title: 'Mine' }, { id: 'projects', title: 'Projects' },
        { id: 'finished', title: 'Finished' }, { id: 'item', title: 'Task', nav: false }, { id: 'new', title: 'Add a task', nav: false },
      ],
      data: { collections: [{ name: 'tasks', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'data:tickets:read', 'data:decisions:read'],
    },
    load: () => import('./tasks/app.js'),
    importer: () => import('./tasks/logic.js').then((m) => m.IMPORTER),
  },
  {
    manifest: {
      fhManifest: 1, id: 'tickets', section: 'tickets', name: 'Tickets', version: '1.0.0',
      description: 'Capture a concern, idea or appreciation in seconds - talk about it at the family meeting.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'capture', title: 'Log a ticket' }, { id: 'all', title: 'All tickets' }, { id: 'meeting', title: 'Family meeting' },
        { id: 'item', title: 'Ticket', nav: false },
      ],
      data: { collections: [{ name: 'tickets', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'data:tasks:read', 'data:decisions:read'],
    },
    load: () => import('./tickets/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'principles', section: 'principles', name: 'Principles', version: '1.0.0',
      description: 'Family values and practical agreements, with the reasons behind them.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'list', title: 'Principles' }, { id: 'item', title: 'Principle', nav: false }, { id: 'new', title: 'Add a principle', nav: false }],
      data: { collections: [{ name: 'principles', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./principles/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'decisions', section: 'decisions', name: 'Decisions', version: '1.0.0',
      description: 'Agreements and experiments: try something, look back, adapt.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'list', title: 'Decisions' }, { id: 'item', title: 'Decision', nav: false }, { id: 'new', title: 'New decision', nav: false }],
      data: { collections: [{ name: 'decisions', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'data:tickets:read', 'data:tasks:read'],
    },
    load: () => import('./decisions/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'meals', section: 'meals', name: 'Cookbook', version: '1.5.0',
      description: 'Your family’s meals, recipes and own ingredients, and how much each person might eat.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [
        { id: 'recipes', title: 'Cookbook' }, { id: 'item', title: 'Item', nav: false }, { id: 'new', title: 'Add an item', nav: false },
      ],
      // Plans and the shopping list were kept here before This Week and Shopping became
      // mini-apps of their own; those apps still read the old files, which stay untouched.
      data: { collections: [{ name: 'recipes', schema: 1 }, { name: 'sizes', schema: 1 }] },
      permissions: ['data:own', 'notify', 'food:read', 'people:food'],
    },
    load: () => import('./meals/app.js'),
    importer: () => import('./meals/logic.js').then((m) => m.IMPORTER),
  },
  {
    manifest: {
      fhManifest: 1, id: 'mealplan', section: 'meals', name: 'This Week', version: '1.1.0',
      description: 'Plan the week’s meals - as much or as little as helps - and send what they need to the shopping list.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [
        { id: 'week', title: 'This week' }, { id: 'add', title: 'Plan a meal', nav: false }, { id: 'choose', title: 'Choose a meal', nav: false },
        { id: 'slot', title: 'Planned meal', nav: false }, { id: 'mix', title: 'Plan my week', nav: false }, { id: 'review', title: 'How the week looks', nav: false },
        { id: 'modify', title: 'Change a planned meal', nav: false },
      ],
      data: { collections: [{ name: 'plans', schema: 1 }] },
      permissions: ['data:own', 'notify', 'data:meals:read', 'food:read', 'people:food'],
    },
    load: () => import('./mealplan/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'shopping', section: 'shopping', name: 'Shopping', version: '1.0.0',
      description: 'One family shopping list. Send meals, the week’s plan or cleaning supplies to it, or add anything else.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'list', title: 'Shopping list' }, { id: 'add', title: 'Add to the list', nav: false }],
      data: { collections: [{ name: 'list', schema: 1 }] },
      permissions: ['data:own', 'notify', 'data:meals:read'],
    },
    load: () => import('./shopping/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'calories', section: 'meals', name: 'Calorie Checker', version: '1.2.0',
      description: 'What is in a food, in the amount you actually eat. Build up an item for the family or one person, and save it to the Cookbook.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'check', title: 'Check a food' }],
      data: { collections: [] },
      permissions: ['food:read', 'people:food'],
    },
    load: () => import('./calories/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'assistant', section: 'meals', name: 'Meal Assistant', version: '1.2.0',
      description: 'Type what you are eating and get one or two easy ways to make it a little better for the people at the table.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'meal', title: 'Improve a meal' }, { id: 'about', title: 'How it decides' }],
      data: { collections: [] },
      permissions: ['data:own', 'food:read', 'people:food', 'data:meals:read', 'data:mealplan:read'],
    },
    load: () => import('./assistant/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'holidays', section: 'holidays', name: 'Holidays', version: '1.0.0',
      description: 'Trip ideas, itineraries, packing lists and budgets.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'list', title: 'Holidays' }, { id: 'item', title: 'Trip', nav: false }, { id: 'new', title: 'Add a trip', nav: false }],
      data: { collections: [{ name: 'trips', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify'],
    },
    load: () => import('./holidays/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'finance', section: 'finance', name: 'Finance', version: '1.0.0',
      description: 'Monthly budgets, and savings and debt goals with the assumptions in plain view.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'month', title: 'Budget' }, { id: 'goals', title: 'Goals' }, { id: 'goal', title: 'Goal', nav: false }, { id: 'new-goal', title: 'Add a goal', nav: false }],
      data: { collections: [{ name: 'months', schema: 1 }, { name: 'goals', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify'],
    },
    load: () => import('./finance/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'exercise', section: 'exercise', name: 'Exercise', version: '1.0.0',
      description: 'Log activity, keep flexible weekly plans, and see what the family did together.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'week', title: 'This week' }, { id: 'log', title: 'Log activity' }, { id: 'plans', title: 'Plans and goals' }],
      data: { collections: [{ name: 'activities', schema: 1 }, { name: 'plans', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify'],
    },
    load: () => import('./exercise/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'faith', section: 'faith', name: 'Faith', version: '1.0.0',
      description: 'Bible reading plans, reflections and family discussion.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'reading', title: 'Reading' }, { id: 'journal', title: 'Journal' }, { id: 'plan', title: 'Reading plan', nav: false }],
      data: { collections: [{ name: 'plans', schema: 1 }, { name: 'notes', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify'],
    },
    load: () => import('./faith/app.js'),
  },
];

function check({ manifest, load, importer = null }) {
  const r = validateManifest(manifest, { source: 'starter' });
  if (!r.ok) throw new Error(`Starter app ${manifest.id} has an invalid manifest: ${r.errors.join(' ')}`);
  return { manifest: r.manifest, load, importer };
}

export const STARTERS = RAW.map(check);
export const starterManifests = () => STARTERS.map((s) => s.manifest);
export const starter = (id) => STARTERS.find((s) => s.manifest.id === id) ?? null;

/** On the roadmap, not built. Shown in the library so nobody mistakes them for working apps. */
export const COMING_LATER = [
  { id: 'planner', name: 'Planner', purpose: 'A family calendar: the week at a glance, with chores, tasks, meals, trips and review dates from the other mini-apps in one place.' },
  { id: 'medical', name: 'Medical', purpose: 'Emergency summary and medical records - only once private records and access rules exist.' },
];
