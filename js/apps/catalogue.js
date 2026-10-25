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
  { id: 'meals', name: 'Meals', purpose: 'Recipes, a weekly meal plan and the shopping list that follows from it.' },
  { id: 'finance', name: 'Finance', purpose: 'Budgets, savings and debt goals, with the assumptions in plain view.' },
  { id: 'health', name: 'Health', purpose: 'Health goals, routines and appointment notes.' },
  { id: 'exercise', name: 'Exercise', purpose: 'Activity plans and family-friendly ways to move.' },
  { id: 'medical', name: 'Medical', purpose: 'Emergency summary and medical records - only once private records and access rules exist.' },
  { id: 'holidays', name: 'Holidays', purpose: 'Trip ideas, itineraries, packing lists and budgets.' },
  { id: 'faith', name: 'Faith', purpose: 'Bible reading, reflections and family discussion.' },
];
