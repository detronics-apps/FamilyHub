// Trackers (D-100): a scenario for a child, a time and values each time, and a summary for the doctor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, scenariosOf, normaliseTracker, running, nextDue, series, perDay, summary, parseField, fieldLine } from '../js/apps/parenting/tracking.js';

const fever = SCENARIOS.find((s) => s.id === 'fever');
const t = normaliseTracker({ trackerId: 't1', scenarioId: 'fever', kidId: 'k', started: '2026-11-02T20:00', remindEvery: 30, entries: [
  { at: '2026-11-02T20:00', values: { temp: 38.2, how: 'Quiet', drink: true } },
  { at: '2026-11-03T02:10', values: { temp: 39.4, med: 'Paracetamol 5 ml' } },
  { at: '2026-11-02T22:30', values: { temp: 38.9, drink: false } },
] });

test('entries in time order; the next reading from the last one', () => {
  assert.deepEqual(t.entries.map((e) => e.at.slice(11)), ['20:00', '22:30', '02:10']);
  assert.equal(nextDue(t), '2026-11-03T02:40');
  assert.equal(nextDue({ ...t, remindEvery: null }), null);
});

test('running until stopped, or until its days are up', () => {
  assert.ok(running(t, '2026-11-05T10:00'));
  assert.ok(!running({ ...t, stopped: '2026-11-03T08:00' }, '2026-11-03T09:00'));
  assert.ok(!running({ ...t, days: 2 }, '2026-11-05T10:00'));
});

test('a number over time, each day, and a summary for the doctor - facts only', () => {
  assert.deepEqual(series(t, 'temp'), [[0, 38.2], [2.5, 38.9], [6.17, 39.4]]);
  const days = perDay(t, fever.fields);
  assert.equal(days.length, 2);
  assert.ok(days[0].parts.includes('Temperature: highest 38.9 °C'));
  assert.ok(days[0].parts.includes('Drinking: 1'));
  const text = summary(t, fever, 'Mia');
  assert.match(text, /Fever - Mia: 3 entries over 2 days/);
  assert.match(text, /Temperature: highest 39\.4 °C at 02:10 on Tue 03; last 39\.4 °C at 02:10/);
  assert.match(text, /Drinking: yes 1 of 2 times/);
  assert.match(text, /Medicine \(what and dose\): Tue 03 02:10 Paracetamol 5 ml/);
});

test('our own trackers, written one field per line', () => {
  assert.deepEqual(parseField('Pain: choice None, Some, A lot', 0), { id: 'f0-pain', name: 'Pain', kind: 'choice', options: ['None', 'Some', 'A lot'] });
  assert.equal(parseField('Temperature: number °C', 1).unit, '°C');
  assert.equal(parseField('Pulling at ear: yes/no', 2).kind, 'yesno');
  assert.equal(parseField('Anything else', 3).kind, 'note');
  assert.equal(fieldLine(parseField('Pain: choice None, Some', 0)), 'Pain: choice None, Some');
  const list = scenariosOf([{ scenarioId: 'sleep', removed: true }, { scenarioId: 'scn-ear', own: true, name: 'Earache', fields: [parseField('Pain: choice None, Some', 0)] }]);
  assert.ok(!list.some((s) => s.scenarioId === 'sleep'));
  assert.ok(list.some((s) => s.name === 'Earache'));
});
