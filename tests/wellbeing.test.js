// Exercise and Faith rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ex from '../js/apps/exercise/logic.js';
import * as faith from '../js/apps/faith/logic.js';

const MONDAY = '2026-10-19';

test('exercise: own minutes per week, what was done together, plan progress', () => {
  const acts = [
    ex.normaliseActivity({ day: '2026-10-19', kind: 'walk', minutes: 30, who: ['a', 'b'] }),
    ex.normaliseActivity({ day: '2026-10-21', kind: 'run', minutes: 25, who: ['a'] }),
    ex.normaliseActivity({ day: '2026-10-26', kind: 'walk', minutes: 60, who: ['a'] }),     // next week
    ex.normaliseActivity({ day: '2026-10-18', kind: 'swim', minutes: 40, who: ['b'] }),     // last week
  ];
  assert.equal(ex.weekMinutes(acts, MONDAY, 'a'), 55);
  assert.equal(ex.weekMinutes(acts, MONDAY, 'b'), 30);
  assert.deepEqual(ex.together(acts, MONDAY), { count: 1, minutes: 30 });
  const plan = ex.normalisePlan({ title: 'Walk three times', kind: 'walk', timesPerWeek: 3, minutes: 20 });
  assert.deepEqual(ex.planProgress(plan, acts, MONDAY), { done: 1, of: 3 });
  assert.equal(ex.goalLine(55, 150), '55 of 150 minutes this week.');
  assert.match(ex.goalLine(160, 150), /goal reached/);
  assert.equal(ex.normaliseActivity({ minutes: -5, kind: 'flying' }, '2026-10-25').kind, 'other');
});

test('faith: the canon is complete - 39 + 27 books, 929 + 260 chapters', () => {
  assert.equal(faith.OLD_TESTAMENT.length, 39);
  assert.equal(faith.NEW_TESTAMENT.length, 27);
  const count = (books) => faith.chapters(faith.normalisePlan({ books })).length;
  assert.equal(count(faith.OLD_TESTAMENT), 929);
  assert.equal(count(faith.NEW_TESTAMENT), 260);
  assert.equal(count(faith.PRESETS.whole.books), 1189);
});

test('faith: next portion, marking read, progress, description', () => {
  let p = faith.normalisePlan({ books: ['John', 'Acts'], perDay: 2 });
  assert.equal(faith.describe(faith.nextReading(p)), 'John 1-2');
  p = faith.markRead(p, faith.nextReading(p).map((c) => c.key));
  assert.equal(faith.describe(faith.nextReading(p)), 'John 3-4');
  p = faith.markRead(p, faith.chapters(p).filter((c) => c.book === 'John' && c.chapter <= 20).map((c) => c.key));
  assert.equal(faith.describe(faith.nextReading(p)), 'John 21, Acts 1');
  const pr = faith.planProgress(p);
  assert.equal(pr.done, 20);
  assert.equal(pr.total, 49);
  assert.equal(pr.daysLeft, 15);
  assert.equal(faith.normalisePlan({ books: ['Hezekiah'] }).books[0], 'John', 'unknown books are ignored');
  assert.equal(faith.markUnread(p, 'John|1').read.includes('John|1'), false);
});
