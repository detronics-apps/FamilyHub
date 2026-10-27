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

test('faith journal: heading, questions with where they stand, picked passages, topics and terms', async () => {
  const { BOOK_GUIDE, TOPICS } = await import('../js/apps/faith/guide.js');
  const n = faith.normaliseNote({
    kind: 'question', heading: 'Loving my family better',
    questions: [{ text: 'How do I love my wife better?', status: 'research' }, { text: '' }, { text: 'And the kids?', status: 'weird' }],
    passages: [{ version: 'niv', book: 'Ephesians', chapter: 5, from: 25, to: 33 }, { book: 'Hezekiah', chapter: 1 }, { book: 'Jude', chapter: 9, from: 3, to: 2 }],
    topics: ['marriage', 'parenting', 'made-up'], terms: ['Love ', 'love', 'Tattoos'], notes: 'Start with Ephesians 5.',
  }, '2026-10-26');
  assert.equal(n.heading, 'Loving my family better');
  assert.deepEqual(n.questions.map((q) => q.status), ['research', 'new'], 'empty questions dropped; unknown status is "only the question"');
  assert.deepEqual(n.passages.map(faith.passageRef), ['Ephesians 5:25-33 (NIV)', 'Jude 1:3'], 'only real books; a chapter past the end and a backwards range are fixed');
  assert.deepEqual(n.topics, ['marriage', 'parenting']);
  assert.deepEqual(n.terms, ['love', 'tattoos'], 'terms are lower case, once each');
  const old = faith.normaliseNote({ kind: 'reflection', passage: 'John 15:5', text: 'Abide in me\nmore thoughts' }, '2026-01-01');
  assert.equal(old.heading, 'Abide in me', 'an entry written before keeps its first line as the heading');
  assert.equal(old.notes, 'Abide in me\nmore thoughts');
  assert.equal(JSON.parse(JSON.stringify(old)).text, undefined);
  const s = [{ id: 'a', ...faith.noteSummary(n) }, { id: 'b', ...faith.noteSummary(old) }];
  assert.deepEqual(faith.filterNotes(s, { topic: 'marriage' }).map((x) => x.id), ['a']);
  assert.deepEqual(faith.filterNotes(s, { status: 'research' }).map((x) => x.id), ['a']);
  assert.deepEqual(faith.filterNotes(s, { term: 'tattoos', kind: 'reflection' }), []);
  assert.deepEqual(faith.allQuestions(s.map((x) => ({ ...x, heading: x.title })), 'new').map((q) => q.text), ['And the kids?']);
  const logged = faith.loggedOn(s.map((x) => ({ ...x, heading: x.title })), 'marriage');
  assert.deepEqual(logged.passages, [{ ref: 'Ephesians 5:25-33 (NIV)', entry: 'a', heading: 'Loving my family better' }, { ref: 'Jude 1:3', entry: 'a', heading: 'Loving my family better' }]);
  assert.deepEqual(logged.questions.map((q) => [q.text, q.entry]), [['How do I love my wife better?', 'a'], ['And the kids?', 'a']]);
  assert.deepEqual(faith.loggedOn(s.map((x) => ({ ...x, heading: x.title })), 'money'), { passages: [], questions: [] }, 'nothing logged on a topic yet');
  assert.equal(faith.bookNoteId('Song of Songs'), 'book-song-of-songs');
  assert.deepEqual(faith.normaliseBookNote({ why: '  To show love wins ', about: undefined }, '1 John'), { id: 'book-1-john', book: '1 John', why: 'To show love wins', about: '' });
  assert.deepEqual(faith.termsUsed([n, faith.normaliseNote({ terms: ['tattoos'] }, '2026-01-01')]), ['tattoos', 'love']);
  assert.ok(faith.noteText(n).includes('How do I love my wife better?'), 'questions are searchable');
  assert.deepEqual(Object.keys(BOOK_GUIDE).sort(), faith.BOOKS.map(([b]) => b).sort(), 'all 66 books have a guide');
  for (const [b, g] of Object.entries(BOOK_GUIDE)) for (const k of ['who', 'when', 'to', 'why', 'about']) assert.ok(g[k], `${b} ${k}`);
  const books = new Set(faith.BOOKS.map(([b]) => b).concat(['Psalm']));
  for (const t of Object.values(TOPICS)) for (const ref of t.start) assert.ok(books.has(ref.replace(/ \d.*$/, '')), ref);
});
