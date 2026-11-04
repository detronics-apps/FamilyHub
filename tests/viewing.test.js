import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_CHECKS, CAR_CHECKS, STAGES, checksFor, removedSeeds, tally, stageLine, sheetCSV, readSheet } from '../js/apps/viewing/checks.js';

test('every seeded check has a unique id and a known stage', () => {
  for (const list of [HOME_CHECKS, CAR_CHECKS]) {
    const ids = list.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(list.every((x) => STAGES.some((s) => s.id === x.stage)));
  }
});

test('a family changes, removes and adds checks; brought-back ones return', () => {
  const fam = { edits: { 'h-gas': 'Gas: works?' }, removed: ['h-braai'], added: [{ id: 'f1', stage: 'feeling', text: 'A pool' }], matters: { 'h-pets': 'must' } };
  const list = checksFor(HOME_CHECKS, fam, [{ id: 'o1', stage: 'viewing', text: 'The borehole' }]);
  assert.equal(list.find((x) => x.id === 'h-gas').text, 'Gas: works?');
  assert.ok(!list.some((x) => x.id === 'h-braai'));
  assert.ok(list.find((x) => x.id === 'f1').mine);
  assert.ok(list.find((x) => x.id === 'o1').here);
  assert.equal(list.find((x) => x.id === 'h-pets').matters, 'must');
  assert.deepEqual(removedSeeds(HOME_CHECKS, fam).map((x) => x.id), ['h-braai']);
});

test('the tally counts worries with their costs, walk-aways and must-haves', () => {
  const fam = { matters: { 'h-pets': 'must', 'h-safe': 'must', 'h-play': 'must' } };
  const list = checksFor(HOME_CHECKS, fam);
  const t = tally(list, {
    'h-mould': { mark: 'worry', cost: 15000 }, 'h-roof': { mark: 'worry', cost: '40000' }, 'h-cracks': { mark: 'walk' },
    'h-pets': { mark: 'yes' }, 'h-safe': { mark: 'no' },
  });
  assert.equal(t.repairs, 55000);
  assert.deepEqual(t.walks.map((x) => x.id), ['h-cracks']);
  assert.equal(t.must.total, 3);
  assert.deepEqual(t.must.met.map((x) => x.id), ['h-pets']);
  assert.deepEqual(t.must.missing.map((x) => x.id), ['h-safe']);
  assert.deepEqual(t.must.unknown.map((x) => x.id), ['h-play']);
  assert.match(stageLine(t.stages.viewing), /^3\/\d+, 2 worries, 1 walk away$/);
});

test('the sheet goes out and comes back in, without wiping or overwriting', () => {
  const list = checksFor(CAR_CHECKS);
  const answers = { 'c-q-why': { mark: 'worry', note: 'Moving overseas' } };
  const csv = sheetCSV(list, answers, ['questions']);
  assert.match(csv, /Why are you selling it\?/);
  assert.ok(!/Brakes/.test(csv));
  // Filled in elsewhere: a new answer, a clash, an empty row, and a row nobody knows.
  const back = csv
    .replace(/(c-q-accident,Questions,[^\r\n]*?),,,,/, '$1,Walk away,Front-end repaired,8000,Asked')
    .replace(/Moving overseas/, 'Needs a bigger car')
    + '\r\nzz,Questions,Something else,OK,,,\r\n';
  const r = readSheet(back, list, answers);
  assert.deepEqual(r.taken['c-q-accident'], { mark: 'walk', note: 'Front-end repaired', cost: 8000, from: 'asked' });
  assert.equal(r.clashes.length, 1);
  assert.equal(r.clashes[0].theirs.note, 'Needs a bigger car');
  assert.equal(r.clashes[0].theirs.mark, 'worry');
  assert.equal(r.unknown, 1);
  assert.ok(!('c-q-service' in r.taken));
});

test('repairs after buying a car are paid up front and counted in its cost', async () => {
  const { carCost, CAR_DEFAULTS } = await import('../js/apps/finance/maths.js');
  const v = { ...CAR_DEFAULTS, price: 300000 };
  const a = carCost(v); const b = carCost({ ...v, repairs: 9000 });
  assert.equal(b.upfront - a.upfront, 9000);
  assert.equal(Math.round(b.total - a.total), 9000);
});
