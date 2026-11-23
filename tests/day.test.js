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
  h = { ...h, household: { ...h.household, dayKinds: normaliseKinds([...DAY_KINDS, { id: 'biz', name: 'Own business', colour: '#123456' }]) } };
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

test('8/8/8: the day grouped against the rule, with what it leaves out (D-150)', async () => {
  const { eightEight, fmtDelta } = await import('../js/day.js');
  const day = [{ from: '00:00', to: '07:00', kind: 'sleep' }, { from: '07:00', to: '07:30', kind: 'transition' }, { from: '07:30', to: '08:30', kind: 'travel' },
    { from: '08:30', to: '12:30', kind: 'work' }, { from: '12:30', to: '13:30', kind: 'break' }, { from: '13:30', to: '17:30', kind: 'work' },
    { from: '17:30', to: '18:30', kind: 'travel' }, { from: '18:30', to: '20:00', kind: 'cook' }, { from: '20:00', to: '23:00', kind: 'free' }];
  const e = eightEight(day);
  const g = Object.fromEntries(e.groups.map((x) => [x.id, x]));
  assert.equal(g.sleep.delta, -60);
  assert.equal(g.work.delta, 0, 'work is 8 h - but the day at work is 9 with lunch');
  assert.equal(g.personal.minutes, 180);
  assert.equal(g.other.minutes, 30 + 120 + 60 + 90);
  assert.deepEqual(e.left.map((k) => k.id), ['travel', 'cook', 'break', 'transition']);
  assert.equal(e.unplanned, 60);
  assert.equal(fmtDelta(-60), '−1 h');
  assert.equal(fmtDelta(0), 'same');
  assert.equal(fmtDelta(90), '+1 h 30');
  // A family's own category counts as not in it until they say otherwise; a starting one keeps its place.
  assert.equal(normaliseKinds([{ id: 'biz', name: 'Own business' }, { id: 'sleep', name: 'Rest' }]).map((k) => k.eight).join(), 'other,sleep');
});

test('3 Fs, 3 Hs and 3 Ss: personal life by part, and what has no part yet (D-151)', async () => {
  const { personalParts, normaliseKinds: nk } = await import('../js/day.js');
  const day = [{ from: '07:00', to: '07:30', kind: 'hygiene' }, { from: '17:00', to: '18:30', kind: 'play' }, { from: '18:30', to: '19:30', kind: 'eat' },
    { from: '20:00', to: '22:00', kind: 'free' }, { from: '22:00', to: '23:00', kind: 'church' }, { from: '09:00', to: '17:00', kind: 'work' }];
  const kinds = nk([...DAY_KINDS, { id: 'church', name: 'Church', eight: 'personal', part: 'faith' }]);
  const p = personalParts(day, kinds);
  const g = Object.fromEntries(p.groups.map((x) => [x.id, x]));
  assert.equal(g.f.minutes, 150);
  assert.deepEqual(g.f.parts.map((x) => x.minutes), [90, 0, 60]);
  assert.equal(g.h.minutes, 150);
  assert.equal(g.s.minutes, 0);
  assert.deepEqual(p.none.map((k) => k.id), ['eat'], 'eating has no part until the family gives it one');
  assert.equal(nk([{ id: 'free', name: 'Free time', part: '' }])[0].part, '', 'a part taken away stays away');
});
