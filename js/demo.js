// The example household. Every record is flagged `demo: true`, so it is
// labelled on screen and `removeDemo()` takes all of it away in one step.
// It is only ever added by an explicit click - never mixed into real data.
//
// Dates are relative to "today", so the example always looks lived-in:
// some chores ready now, some coming up, one waiting a while.

import { addDays } from './dates.js';
import { normaliseHousehold } from './model.js';

export function demoHousehold(today, name = 'The Example family') {
  const ago = (n) => addDays(today, -n);
  const people = [
    { id: 'p_demo_alex', name: 'Alex', role: 'adult', colour: '#d9734e' },
    { id: 'p_demo_sam', name: 'Sam', role: 'adult', colour: '#8fae7e' },
    { id: 'p_demo_mia', name: 'Mia', role: 'child', colour: '#d9a441' },
  ];
  const rooms = [
    { id: 'r_demo_kitchen', name: 'Kitchen' },
    { id: 'r_demo_bathroom', name: 'Bathroom' },
    { id: 'r_demo_living', name: 'Living room' },
  ];
  const K = 'r_demo_kitchen';
  const B = 'r_demo_bathroom';
  const L = 'r_demo_living';
  const start = ago(60);
  const chore = (id, fields) => ({ id: `c_demo_${id}`, startDay: start, createdAt: `${start}T08:00:00.000Z`, ...fields });

  const chores = [
    chore('dishwasher', { name: 'Load or unload the dishwasher', roomId: K, frequency: { unit: 'day', every: 1 }, minutes: 5, effort: 'low' }),
    chore('counters', { name: 'Wipe counters', roomId: K, frequency: { unit: 'day', every: 1 }, minutes: 5, effort: 'low', instructions: 'Clear what does not live there, spray, wipe, dry.' }),
    chore('kfloor', { name: 'Clean the kitchen floor', roomId: K, frequency: { unit: 'week', every: 1 }, minutes: 15, effort: 'medium' }),
    chore('oven', { name: 'Clean the oven', roomId: K, frequency: { unit: 'month', every: 3 }, minutes: 45, effort: 'high', easier: 'Soak the racks the night before.' }),
    chore('fridge', { name: 'Clean out the fridge', roomId: K, frequency: { unit: 'month', every: 1 }, minutes: 20, effort: 'medium' }),
    chore('cupboards', { name: 'Wipe cupboard fronts', roomId: K, frequency: { unit: 'month', every: 1 }, minutes: 10, effort: 'low' }),
    chore('basin', { name: 'Clean the basin', roomId: B, frequency: { unit: 'week', every: 1 }, minutes: 5, effort: 'low' }),
    chore('toilet', { name: 'Clean the toilet', roomId: B, frequency: { unit: 'week', every: 1 }, minutes: 10, effort: 'medium', importance: 'high', startDay: ago(1) }),
    chore('shower', { name: 'Clean the shower', roomId: B, frequency: { unit: 'week', every: 2 }, minutes: 20, effort: 'high' }),
    chore('towels', { name: 'Replace towels', roomId: B, frequency: { unit: 'week', every: 1 }, minutes: 5, effort: 'low', eligible: ['p_demo_alex', 'p_demo_sam', 'p_demo_mia'] }),
    chore('bin', { name: 'Empty the bathroom bin', roomId: B, frequency: { unit: 'week', every: 1 }, minutes: 2, effort: 'low', eligible: ['p_demo_alex', 'p_demo_sam', 'p_demo_mia'] }),
    chore('bcupboard', { name: 'Organise the bathroom cupboard', roomId: B, frequency: { unit: 'once', every: 1 }, minutes: 30, effort: 'medium', kind: 'improvement', optional: true, description: 'Nice to do, never urgent.' }),
    chore('toys', { name: 'Tidy the toys away', roomId: L, frequency: { unit: 'day', every: 1 }, minutes: 10, effort: 'low', eligible: ['p_demo_alex', 'p_demo_sam', 'p_demo_mia'], startDay: today }),
    chore('vacuum', { name: 'Vacuum the living room', roomId: L, frequency: { unit: 'week', every: 1 }, minutes: 15, effort: 'medium', dependsOn: ['c_demo_toys'], startDay: ago(2), description: 'Easier once the floor is clear.' }),
    chore('dust', { name: 'Dust the shelves', roomId: L, frequency: { unit: 'week', every: 2 }, minutes: 10, effort: 'low' }),
    chore('smoke', { name: 'Test the smoke alarm', roomId: null, frequency: { unit: 'month', every: 1 }, minutes: 2, effort: 'low', importance: 'high', kind: 'maintenance' }),
    chore('tap', { name: 'Fix the dripping garden tap', roomId: null, frequency: { unit: 'once', every: 1 }, minutes: 30, effort: 'medium', kind: 'oneoff', importance: 'high', cost: 60 }),
  ];

  const done = (id, n, by) => ({ choreId: `c_demo_${id}`, type: 'done', day: ago(n), at: `${ago(n)}T18:00:00.000Z`, by });
  const events = [
    done('kfloor', 9, 'p_demo_sam'),
    done('cupboards', 12, 'p_demo_alex'),
    done('fridge', 20, 'p_demo_sam'),
    done('shower', 6, 'p_demo_alex'),
    done('basin', 8, 'p_demo_alex'),
    done('towels', 2, 'p_demo_mia'),
    done('dust', 4, 'p_demo_sam'),
    done('smoke', 32, 'p_demo_alex'),
    done('dishwasher', 1, 'p_demo_sam'),
    done('counters', 0, 'p_demo_alex'),
    done('bin', 1, 'p_demo_mia'),
    // The oven has not fitted in for months - the review prompt shows what that looks like.
    done('oven', 280, 'p_demo_alex'),
  ].map((e, i) => ({ id: `e_demo_${i}`, ...e }));

  const flag = (r) => ({ ...r, demo: true });
  return normaliseHousehold({
    schema: 1,
    household: { id: 'hh_demo', name, createdAt: `${start}T08:00:00.000Z` },
    people: people.map(flag),
    rooms: rooms.map(flag),
    chores: chores.map(flag),
    events,
  });
}
