import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeline, totals, normaliseDay, kindsOf, DAY_KINDS, choreShare, nextBlock, fmtSpan, normaliseKinds } from '../js/day.js';
import { updatePerson, setHouseholdName } from '../js/model.js';
import { householdToFiles, filesToHousehold, fingerprint } from '../js/folder-sync.js';
import { buildFamilyFile, parseFamilyFile } from '../js/family-file.js';
import { mergeHousehold } from '../js/merge.js';
import { fixture } from './helpers.js';

// A late family's day: up at 10, to bed at 1 - and an early one: up at 5, to bed at 20.
const late = [{ from: '01:00', to: '10:00', kind: 'sleep' }, { from: '10:00', to: '10:30', kind: 'chores' }, { from: '10:30', to: '18:30', kind: 'work' }, { from: '18:30', to: '01:00', kind: 'free' }];
const early = [{ from: '20:00', to: '05:00', kind: 'sleep' }, { from: '05:00', to: '05:30', kind: 'chores' }, { from: '05:30', to: '13:30', kind: 'work' }, { from: '13:30', to: '20:00', kind: 'free' }];

test('our day: a block across midnight is split, and the day runs 00:00 to 24:00 (D-149)', () => {
  const runs = timeline(late);
  assert.deepEqual(runs.map((r) => [r.start, r.end, r.kind]), [[0, 60, 'free'], [60, 600, 'sleep'], [600, 630, 'chores'], [630, 1110, 'work'], [1110, 1440, 'free']]);
});

test('our day: the same hours, wherever they fall - totals by category and awake', () => {
  const a = totals(late); const b = totals(early);
  assert.equal(a.awake, 15 * 60);
  assert.equal(b.awake, 15 * 60);
  assert.deepEqual(a.byKind.map((k) => [k.id, k.minutes]), b.byKind.map((k) => [k.id, k.minutes]));
  assert.equal(a.byKind.find((k) => k.id === 'free').minutes, 390);
  assert.equal(a.unplanned, 0);
  assert.equal(a.overlap, null);
});

test('our day: what is not planned, an overlap and a removed category are all said', () => {
  const t = totals([{ from: '08:00', to: '10:00', kind: 'work' }, { from: '09:00', to: '11:00', kind: 'gone' }]);
  assert.equal(t.unplanned, 1440 - 180);
  assert.equal(t.overlap, '09:00');
  assert.equal(t.byKind.find((k) => k.id === 'work').minutes, 60, 'the later block counts where they overlap');
  assert.equal(t.other, 120);
});

test('our day: the chores share in minutes, and how much is still to place', () => {
  const c = choreShare({ choreShare: 25 }, 120, late);
  assert.deepEqual(c, { percent: 25, share: 30, placed: 30, toPlace: 0 });
  assert.equal(choreShare({ choreShare: 50 }, 120, late).toPlace, 30);
  assert.equal(choreShare({}, 120, late), null);
});

test('our day: bad input is dropped, and the starting categories stand until changed', () => {
  const d = normaliseDay({ now: [{ from: '25:00', to: '10:00', kind: 'x' }, { from: '07:00', to: '08:00', kind: 'eat' }], choreShare: 140 });
  assert.equal(d.now.length, 1);
  assert.equal(d.choreShare, 100);
  assert.equal(kindsOf({ household: {} }), DAY_KINDS);
  assert.deepEqual(kindsOf({ household: { dayKinds: [{ id: 'biz', name: 'Own business', colour: '#123456' }] } }).map((k) => k.name), ['Own business']);
  assert.equal(normaliseKinds([{ id: 'a', name: 'A', colour: 'red' }])[0].colour, DAY_KINDS[0].colour);
  assert.deepEqual(nextBlock([{ from: '07:00', to: '23:30', kind: 'work' }]), { from: '23:30', to: '00:30', kind: 'hygiene' });
  assert.deepEqual(nextBlock([]), { from: '00:00', to: '07:00', kind: 'sleep' });
  assert.equal(fmtSpan(90), '1 h 30');
  assert.equal(fmtSpan(45), '45 min');
});

test('our day: kept through the Drive folder, the family file and two laptops (D-149)', () => {
  const { h: h0, ann, kid } = fixture();
  let h = updatePerson(h0, ann, { day: { now: late, goal: early, choreShare: 60 } });
  h = { ...h, household: { ...h.household, dayKinds: [...DAY_KINDS, { id: 'biz', name: 'Own business', colour: '#123456' }] } };
  const back = filesToHousehold(householdToFiles(h));
  assert.equal(fingerprint(back), fingerprint(h));
  assert.deepEqual(back.people.find((p) => p.id === ann).day.goal, early);
  assert.equal(back.household.dayKinds.at(-1).name, 'Own business');
  assert.equal('day' in back.people.find((p) => p.id === kid), false, 'someone without a day keeps their record as it was');

  const parsed = parseFamilyFile(buildFamilyFile({ household: h, registry: { apps: {} } }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.household.people.find((p) => p.id === ann).day.now, late);

  // One laptop changes Ann's day, the other renames the family: both are kept.
  const mine = updatePerson(h, ann, { day: { now: early, goal: early, choreShare: 60 } });
  const theirs = setHouseholdName(h, 'Renamed');
  const { household: merged, conflicts } = mergeHousehold(h, mine, theirs);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(merged.people.find((p) => p.id === ann).day.now, early);
  assert.equal(merged.household.name, 'Renamed');
  assert.equal(merged.household.dayKinds.at(-1).name, 'Own business');
});
