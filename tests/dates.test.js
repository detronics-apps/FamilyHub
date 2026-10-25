import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, addInterval, dayDiff, fmtDay, fmtAgo, fmtFrequency, isDay, intervalDays } from '../js/dates.js';

test('day arithmetic crosses months, years and leap days', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(dayDiff('2026-10-20', '2026-10-25'), 5);
  assert.equal(dayDiff('2026-10-25', '2026-10-20'), -5);
});

test('a day-saving change never shifts a day (UTC arithmetic)', () => {
  // 29 March 2026 and 25 October 2026 are European clock changes.
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
});

test('months clamp to the end of a shorter month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-03-15', -4), '2025-11-15');
});

test('intervals', () => {
  assert.equal(addInterval('2026-10-25', { unit: 'day', every: 1 }), '2026-10-26');
  assert.equal(addInterval('2026-10-25', { unit: 'week', every: 2 }), '2026-11-08');
  assert.equal(addInterval('2026-10-25', { unit: 'year', every: 1 }), '2027-10-25');
  assert.equal(addInterval('2026-10-25', { unit: 'once', every: 1 }), null);
  assert.equal(intervalDays({ unit: 'week', every: 2 }), 14);
  assert.equal(intervalDays({ unit: 'once', every: 1 }), null);
});

test('isDay rejects nonsense', () => {
  assert.ok(isDay('2026-10-25'));
  for (const bad of ['2026-1-5', 'today', '', null, 20261025]) assert.equal(isDay(bad), false);
});

test('friendly wording', () => {
  assert.equal(fmtDay('2026-10-25', '2026-10-25'), 'today');
  assert.equal(fmtDay('2026-10-26', '2026-10-25'), 'tomorrow');
  assert.equal(fmtDay('2026-10-30', '2026-10-25'), 'Fri 30 Oct');
  assert.equal(fmtDay('2027-01-04', '2026-10-25'), 'Mon 4 Jan 2027');
  assert.equal(fmtAgo('2026-10-22', '2026-10-25'), '3 days ago');
  assert.equal(fmtAgo('2026-10-24', '2026-10-25'), 'yesterday');
  assert.equal(fmtAgo('2026-09-25', '2026-10-25'), '4 weeks ago');
  assert.equal(fmtFrequency({ unit: 'day', every: 1 }), 'daily');
  assert.equal(fmtFrequency({ unit: 'week', every: 2 }), 'every 2 weeks');
  assert.equal(fmtFrequency({ unit: 'month', every: 3 }), 'seasonal (every 3 months)');
  assert.equal(fmtFrequency({ unit: 'once', every: 1 }), 'just once');
});
