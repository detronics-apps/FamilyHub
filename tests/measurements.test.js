// Dated heights and weights on the People page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMeasurement, removeMeasurement, measurementsFor, latestMeasure, normaliseHousehold, removePerson } from '../js/model.js';
import { mergeHousehold } from '../js/merge.js';
import { householdToFiles, filesToHousehold, PATHS } from '../js/folder-sync.js';
import { fixture } from './helpers.js';

const withAnn = () => { const { h, ann } = fixture(); return { h, ann }; };

test('a measurement needs a date and a weight or a height; silly values are dropped', () => {
  const { h, ann } = withAnn();
  assert.throws(() => addMeasurement(h, { personId: ann, day: '2026-10-01' }), /weight or a height/);
  assert.throws(() => addMeasurement(h, { personId: ann, weightKg: 70 }), /date/);
  const { measurement: m } = addMeasurement(h, { personId: ann, day: '2026-10-01', weightKg: '70.26', heightCm: '9000', note: 'clinic' });
  assert.equal(m.weightKg, 70.3);
  assert.equal(m.heightCm, null, '9000 cm is not a height');
  assert.equal(m.note, 'clinic');
});

test('newest first; the latest weight and height can come from different days', () => {
  let { h, ann } = withAnn();
  for (const f of [
    { day: '2026-01-10', weightKg: 68, heightCm: 168 },
    { day: '2026-06-02', weightKg: 70 },
    { day: '2026-03-15', heightCm: 169 },
  ]) h = addMeasurement(h, { personId: ann, ...f }).household;
  assert.deepEqual(measurementsFor(h, ann).map((m) => m.day), ['2026-06-02', '2026-03-15', '2026-01-10']);
  assert.deepEqual(latestMeasure(h, ann), { weightKg: 70, weightDay: '2026-06-02', heightCm: 169, heightDay: '2026-03-15' });
  const first = measurementsFor(h, ann)[0].id;
  assert.equal(latestMeasure(removeMeasurement(h, first), ann).weightKg, 68);
  assert.deepEqual(latestMeasure(h, 'nobody'), { weightKg: null, weightDay: null, heightCm: null, heightDay: null });
});

test('kept when the person is removed, like their chore history', () => {
  let { h, ann } = withAnn();
  h = addMeasurement(h, { personId: ann, day: '2026-10-01', weightKg: 70 }).household;
  assert.equal(removePerson(h, ann).measurements.length, 1);
});

test('two laptops adding entries merge without a question', () => {
  const { h: base, ann } = withAnn();
  const mine = addMeasurement(base, { personId: ann, day: '2026-10-01', weightKg: 70 }).household;
  const theirs = addMeasurement(base, { personId: ann, day: '2026-10-02', heightCm: 168 }).household;
  const { household, conflicts } = mergeHousehold(base, mine, theirs);
  assert.deepEqual(conflicts, []);
  assert.equal(household.measurements.length, 2);
});

test('saved in the Drive folder as its own file, and read back', () => {
  let { h, ann } = withAnn();
  h = addMeasurement(h, { personId: ann, day: '2026-10-01', weightKg: 70, note: 'hospital' }).household;
  const files = householdToFiles(h);
  assert.ok(files.get(PATHS.measurements).includes('hospital'));
  assert.deepEqual(filesToHousehold(files).measurements, h.measurements);
  assert.deepEqual(normaliseHousehold({ ...h, measurements: undefined }).measurements, [], 'older data has none');
});
