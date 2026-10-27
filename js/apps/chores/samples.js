// Sample chores per room (D-065): ideas to start from, not a standard to meet.
// They are added as the family's own chores - edit or remove any of them after.
// Times are rough guesses; how often follows common household advice.
// Pure - no DOM.

import { addDays } from '../../dates.js';
import { addChore, addRoom } from '../../model.js';

const f = (unit, every = 1) => ({ unit, every });
const DAILY = f('day');
const WEEKLY = f('week');
const c = (name, frequency, minutes, effort, more = {}) => ({ name, frequency, minutes, effort, ...more });

export const SAMPLE_ROOMS = [
  { id: 'kitchen', name: 'Kitchen', chores: [
    c('Pack out the dishwasher', DAILY, 5, 'low'),
    c('Pack in the dishwasher', DAILY, 5, 'low', { supplies: ['Dishwasher tablets'] }),
    c('Wipe down the counters', DAILY, 5, 'low', { instructions: 'Clear what does not live there, spray, wipe, dry.', supplies: ['Surface spray'] }),
    c('Wipe the stove top', DAILY, 5, 'low'),
    c('Sweep the floor', DAILY, 5, 'low'),
    c('Take out the rubbish', f('day', 2), 3, 'low', { supplies: ['Bin bags'] }),
    c('Mop the floor', WEEKLY, 15, 'medium', { supplies: ['Floor cleaner'] }),
    c('Clean the microwave', WEEKLY, 5, 'low', { easier: 'Heat a bowl of water with lemon for 3 minutes first, then wipe.' }),
    c('Clean out the fridge', WEEKLY, 15, 'medium', { instructions: 'Throw out what is old, wipe the shelves and any spills.' }),
    c('Clean the dishwasher filter', f('month'), 10, 'low'),
    c('Wipe the cupboard fronts', f('month'), 10, 'low'),
    c('Descale the kettle', f('month', 3), 10, 'low'),
    c('Clean the oven', f('month', 3), 45, 'high', { easier: 'Soak the racks the night before.' }),
  ] },
  { id: 'living', name: 'Living room', chores: [
    c('Pick up all the toys', DAILY, 10, 'low'),
    c('Plump the cushions and fold the blankets', DAILY, 3, 'low'),
    c('Vacuum the floor', WEEKLY, 15, 'medium'),
    c('Dust the surfaces', WEEKLY, 10, 'low'),
    c('Vacuum the couch', f('month'), 10, 'low'),
    c('Wipe the TV screen', f('month'), 3, 'low', { instructions: 'A dry soft cloth - no spray on the screen.' }),
    c('Clean the windows', f('month', 3), 30, 'medium'),
    c('Wash the curtains', f('month', 6), 30, 'medium'),
  ] },
  { id: 'bathroom', name: 'Bathroom', hint: 'With a bath.', chores: [
    c('Wipe down the counters and basin', DAILY, 3, 'low'),
    c('Wash the bath', WEEKLY, 15, 'medium', { supplies: ['Bathroom cleaner'] }),
    c('Scrub the toilet', WEEKLY, 10, 'medium', { importance: 'high', supplies: ['Toilet cleaner'] }),
    c('Clean the mirror', WEEKLY, 3, 'low'),
    c('Mop the floor', WEEKLY, 10, 'medium', { supplies: ['Floor cleaner'] }),
    c('Wash the towels', WEEKLY, 10, 'low'),
    c('Empty the bin', WEEKLY, 2, 'low'),
    c('Wash the bath mat', f('week', 2), 5, 'low'),
    c('Clean the tiles and grout', f('month'), 30, 'high'),
  ] },
  { id: 'shower', name: 'Shower room', hint: 'Shower, toilet and basin.', chores: [
    c('Wipe down the basin', DAILY, 3, 'low'),
    c('Clean the shower', WEEKLY, 15, 'medium', { supplies: ['Bathroom cleaner'] }),
    c('Scrub the toilet', WEEKLY, 10, 'medium', { importance: 'high', supplies: ['Toilet cleaner'] }),
    c('Clean the mirror', WEEKLY, 3, 'low'),
    c('Mop the floor', WEEKLY, 10, 'medium', { supplies: ['Floor cleaner'] }),
    c('Change the hand towel', WEEKLY, 2, 'low'),
    c('Empty the bin', WEEKLY, 2, 'low'),
    c('Clear the shower drain', f('month'), 10, 'medium'),
  ] },
  { id: 'bedroom', name: 'Main bedroom', chores: [
    c('Make the bed', DAILY, 3, 'low'),
    c('Put clothes away', DAILY, 5, 'low'),
    c('Wash the bedding', f('week', 2), 20, 'medium', { instructions: 'Strip the bed, wash the sheets and pillowcases, put on a clean set.' }),
    c('Vacuum the floor', WEEKLY, 10, 'medium'),
    c('Dust the surfaces', WEEKLY, 5, 'low'),
    c('Turn the mattress', f('month', 3), 10, 'high'),
    c('Wash the pillows and duvet', f('month', 6), 30, 'medium'),
    c('Sort out the wardrobe', f('year'), 60, 'medium', { kind: 'improvement', optional: true }),
  ] },
  { id: 'baby', name: 'Baby room', chores: [
    c('Empty the nappy bin', DAILY, 3, 'low', { supplies: ['Nappy bin bags'] }),
    c('Wipe the changing mat', DAILY, 2, 'low'),
    c('Wash and sterilise the bottles', DAILY, 15, 'low'),
    c('Restock nappies and wipes', WEEKLY, 5, 'low', { supplies: ['Nappies', 'Baby wipes'] }),
    c('Change the cot sheets', WEEKLY, 10, 'low'),
    c('Vacuum and dust', WEEKLY, 15, 'medium'),
    c('Wash the soft toys', f('month'), 10, 'low'),
    c('Check the cot and furniture are safe', f('month'), 5, 'low', { importance: 'high', instructions: 'Screws tight, nothing loose, tall furniture fixed to the wall, cords out of reach.' }),
    c('Sort out clothes that no longer fit', f('month', 3), 30, 'medium'),
  ] },
  { id: 'laundry', name: 'Laundry', hint: 'Washing machine in a bathroom? Choose that room under Into.', chores: [
    c('Wash the clothes', f('day', 2), 5, 'low', { supplies: ['Washing powder'] }),
    c('Hang up the washing', f('day', 2), 10, 'low'),
    c('Bring in the dry washing', f('day', 2), 5, 'low'),
    c('Fold and pack away the clothes', f('day', 2), 15, 'medium'),
    c('Iron the clothes', WEEKLY, 30, 'medium'),
    c('Clean the washing machine', f('month'), 10, 'low', { instructions: 'Run an empty hot wash, then wipe the door seal and the soap drawer.' }),
  ] },
  { id: 'house', name: 'Whole house', hint: 'Not in one room.', chores: [
    c('Put the bins out for collection', WEEKLY, 5, 'low'),
    c('Water the plants', WEEKLY, 10, 'low'),
    c('Wipe door handles and light switches', WEEKLY, 10, 'low'),
    c('Empty the vacuum cleaner', f('month'), 5, 'low'),
    c('Test the smoke alarms', f('month'), 5, 'low', { importance: 'high', kind: 'maintenance' }),
    c('Wash the windows outside', f('month', 6), 60, 'high'),
  ] },
];

const cycleDays = ({ unit, every }) => every * { day: 1, week: 7, month: 30, year: 365 }[unit];
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The room a sample group goes into by default: one already called that, else a new one. 'none' for Whole house. */
export function defaultInto(h, sample) {
  if (sample.id === 'house') return 'none';
  return h.rooms.find((r) => same(r.name, sample.name))?.id ?? 'new';
}

/** Names of the sample's chores that are already in that room. */
export function alreadyIn(h, sample, into) {
  const roomId = into === 'new' ? h.rooms.find((r) => same(r.name, sample.name))?.id : into === 'none' ? null : into;
  if (roomId === undefined) return new Set();
  return new Set(sample.chores.filter((s) => h.chores.some((x) => x.roomId === roomId && same(x.name, s.name))).map((s) => s.name));
}

/**
 * Add the ticked chores of a sample group. `into` is a room id, 'new' (a room
 * named like the sample, reused if it exists) or 'none'. Chores already in that
 * room are left alone. Daily chores start today; the rest are spread out so
 * they do not all come up on the same day.
 */
export function addSamples(h, sample, names, into, today) {
  let roomId = into === 'none' ? null : into;
  if (into === 'new') {
    const found = h.rooms.find((r) => same(r.name, sample.name));
    if (found) roomId = found.id;
    else { const res = addRoom(h, sample.name); h = res.household; roomId = res.room.id; }
  }
  const have = alreadyIn(h, sample, roomId ?? 'none');
  let added = 0;
  for (const s of sample.chores.filter((x) => names.includes(x.name) && !have.has(x.name))) {
    const days = cycleDays(s.frequency);
    const startDay = days <= 1 ? today : addDays(today, (added * 2) % Math.min(days, 28));
    h = addChore(h, { ...s, roomId, startDay }).household;
    added++;
  }
  return { household: h, added, roomId };
}
