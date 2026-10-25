import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseTrip, nights, when, budgetSummary, packingProgress, tripDays, itineraryByDay, addCost, addStep, addPacking, toggle, removeFrom } from '../js/apps/holidays/logic.js';

const TODAY = '2026-10-25';

test('a trip needs only a name; dates are put in order', () => {
  const t = normaliseTrip({ title: 'Coast', startDay: '2026-12-20', endDay: '2026-12-10' });
  assert.equal(t.status, 'idea');
  assert.equal(t.endDay, '2026-12-20', 'an end before the start is pulled up to the start');
  assert.equal(nights(normaliseTrip({ startDay: '2026-12-20', endDay: '2026-12-27' })), 7);
  assert.equal(nights(normaliseTrip({})), null);
});

test('upcoming, now, past, undated', () => {
  assert.equal(when(normaliseTrip({ startDay: '2026-12-20', endDay: '2026-12-27' }), TODAY), 'upcoming');
  assert.equal(when(normaliseTrip({ startDay: '2026-10-24', endDay: '2026-10-26' }), TODAY), 'now');
  assert.equal(when(normaliseTrip({ startDay: '2026-10-01', endDay: '2026-10-05' }), TODAY), 'past');
  assert.equal(when(normaliseTrip({}), TODAY), 'undated');
});

test('budget: planned, paid, to pay, left, and over only with a budget', () => {
  let t = normaliseTrip({ budget: 1000 });
  t = addCost(t, 'Cabin', 650.5);
  t = addCost(t, 'Fuel', 200);
  t = addCost(t, '', 99);
  t = toggle(t, 'costs', t.costs[0].id, 'paid');
  assert.deepEqual(budgetSummary(t), { planned: 850.5, paid: 650.5, toPay: 200, left: 149.5, over: false });
  t = addCost(t, 'Activities', 300);
  assert.equal(budgetSummary(t).over, true);
  assert.equal(budgetSummary(normaliseTrip({ costs: [{ what: 'x', amount: 5 }] })).over, false, 'no budget, never "over"');
});

test('packing per person, itinerary by day and time', () => {
  let t = normaliseTrip({ startDay: '2026-12-20', endDay: '2026-12-22' });
  t = addPacking(t, 'Swimsuit', 'p1');
  t = addPacking(t, 'Charger');
  t = toggle(t, 'packing', t.packing[0].id, 'packed');
  assert.deepEqual(packingProgress(t), { packed: 1, total: 2 });
  t = addStep(t, 'Beach', '2026-12-21', '10:00');
  t = addStep(t, 'Drive', '2026-12-20', '08:00');
  t = addStep(t, 'Breakfast', '2026-12-21', '08:30');
  t = addStep(t, 'Find a market');
  const g = itineraryByDay(t);
  assert.deepEqual([...g.keys()], ['2026-12-20', '2026-12-21', 'any']);
  assert.deepEqual(g.get('2026-12-21').map((s) => s.text), ['Breakfast', 'Beach']);
  assert.deepEqual(tripDays(t), ['2026-12-20', '2026-12-21', '2026-12-22']);
  assert.equal(removeFrom(t, 'packing', t.packing[1].id).packing.length, 1);
});
