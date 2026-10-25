// The starter pack: mini-apps that ship with Family Hub. Each is a manifest
// (validated exactly like a third-party one) plus a loader, so its code is only
// fetched when it is first opened. Adding a starter app is one entry here and a
// folder under js/apps/ - nothing else in the core names it.

import { validateManifest } from '../miniapps.js';

const RAW = [
  {
    manifest: {
      fhManifest: 1, id: 'chores', name: 'Chores', version: '1.0.0',
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
  },
  {
    manifest: {
      fhManifest: 1, id: 'tasks', name: 'Tasks', version: '1.0.1',
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
  },
  {
    manifest: {
      fhManifest: 1, id: 'tickets', name: 'Tickets', version: '1.0.0',
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
      fhManifest: 1, id: 'principles', name: 'Principles', version: '1.0.0',
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
      fhManifest: 1, id: 'decisions', name: 'Decisions', version: '1.0.0',
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
      fhManifest: 1, id: 'meals', name: 'Meals', version: '1.0.0',
      description: 'Recipes, a weekly meal plan and the shopping list that follows from it.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'week', title: 'This week' }, { id: 'recipes', title: 'Recipes' }, { id: 'shopping', title: 'Shopping' },
        { id: 'item', title: 'Recipe', nav: false }, { id: 'new', title: 'Add a recipe', nav: false },
      ],
      data: { collections: [{ name: 'recipes', schema: 1 }, { name: 'plans', schema: 1 }, { name: 'shopping', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./meals/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'holidays', name: 'Holidays', version: '1.0.0',
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
      fhManifest: 1, id: 'finance', name: 'Finance', version: '1.0.0',
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
      fhManifest: 1, id: 'exercise', name: 'Exercise', version: '1.0.0',
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
      fhManifest: 1, id: 'health', name: 'Health', version: '1.0.0',
      description: 'Appointments and healthy habits - not medical records.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'appointments', title: 'Appointments' }, { id: 'routines', title: 'Healthy habits' }, { id: 'item', title: 'Appointment', nav: false }, { id: 'new', title: 'Add an appointment', nav: false }],
      data: { collections: [{ name: 'appointments', schema: 1 }, { name: 'routines', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify'],
    },
    load: () => import('./health/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'faith', name: 'Faith', version: '1.0.0',
      description: 'Bible reading plans, reflections and family discussion.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'reading', title: 'Reading' }, { id: 'journal', title: 'Journal' }, { id: 'plan', title: 'Reading plan', nav: false }],
      data: { collections: [{ name: 'plans', schema: 1 }, { name: 'notes', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify'],
    },
    load: () => import('./faith/app.js'),
  },
];

function check({ manifest, load }) {
  const r = validateManifest(manifest, { source: 'starter' });
  if (!r.ok) throw new Error(`Starter app ${manifest.id} has an invalid manifest: ${r.errors.join(' ')}`);
  return { manifest: r.manifest, load };
}

export const STARTERS = RAW.map(check);
export const starterManifests = () => STARTERS.map((s) => s.manifest);
export const starter = (id) => STARTERS.find((s) => s.manifest.id === id) ?? null;

/** On the roadmap, not built. Shown in the library so nobody mistakes them for working apps. */
export const COMING_LATER = [
  { id: 'planner', name: 'Planner', purpose: 'A family calendar: the week at a glance, with chores, tasks, meals, trips and review dates from the other mini-apps in one place.' },
  { id: 'medical', name: 'Medical', purpose: 'Emergency summary and medical records - only once private records and access rules exist.' },
];
