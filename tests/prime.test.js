// Prime over the years (D-166): the history, its lows and highs, and the bad and good starts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRIME_CHANGES, primeAt, primeMonths, primeStats, startTest } from '../js/apps/finance/prime.js';
import { REFERENCE } from '../js/apps/finance/maths.js';

test('D-166 the history is in date order, each a change, and ends at today’s prime', () => {
  for (let i = 1; i < PRIME_CHANGES.length; i += 1) {
    assert.ok(PRIME_CHANGES[i][0] > PRIME_CHANGES[i - 1][0], PRIME_CHANGES[i][0]);
    assert.notEqual(PRIME_CHANGES[i][1], PRIME_CHANGES[i - 1][1], PRIME_CHANGES[i][0]);
  }
  assert.equal(PRIME_CHANGES.at(-1)[1], REFERENCE.prime.value);
});

test('D-166 prime on a day and at a month end', () => {
  assert.equal(primeAt('2008-06-12'), 15);
  assert.equal(primeAt('2008-06-13'), 15.5);
  assert.equal(primeAt('2008-06'), 15.5);
  assert.equal(primeAt('2020-08'), 7);
  assert.equal(primeAt('2004-01'), null);
  assert.equal(primeMonths('2026-01', '2026-12').length, 12);
});

test('D-166 the last 20 years: lowest, highest, average and now', () => {
  const s = primeStats(20);
  assert.equal(s.months.length, 240);
  assert.equal(s.months[0].ym, '2006-12');
  assert.equal(s.low, 7); assert.equal(s.lowYM, '2020-07');
  assert.equal(s.high, 15.5); assert.equal(s.highYM, '2008-06');
  assert.ok(s.avg > 9.5 && s.avg < 11, String(s.avg));
  assert.equal(s.now, 10.75);
});

test('D-166 a bad start: the 20-year high plus the margin for five years, then the average', () => {
  const [a, b] = startTest('bad', { fromYM: '2026-12', margin: 1 });
  assert.deepEqual([a.kind, a.from, a.amount], ['rate', '2026-12', 16.5]);
  assert.equal(b.from, '2031-12');
  assert.equal(b.amount, Math.round((primeStats().avg + 1) * 100) / 100);
  assert.equal(startTest('good', { fromYM: '2026-12' })[0].amount, 7);
});
