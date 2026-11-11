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
  // The family's own topics: added (any capitals finds the same one), hidden, shown again, removed.
  let fam = faith.normaliseTopics({});
  let r = faith.addTopic(fam, '  Tithing  and giving ');
  assert.equal(r.id, 'own-tithing-and-giving');
  fam = r.fam;
  assert.equal(faith.addTopic(fam, 'tithing AND giving').id, r.id, 'the same name is the same topic');
  assert.equal(faith.addTopic(fam, 'Marriage').id, 'marriage', 'a guide topic is not added twice');
  assert.equal(faith.addTopic(fam, '   ').id, null);
  fam = faith.setTopicHidden(fam, 'endtimes', true);
  assert.ok(faith.topicList(fam).find((t) => t.id === 'endtimes').hidden);
  assert.equal(faith.addTopic(fam, 'End times').fam.hidden.includes('endtimes'), false, 'adding a hidden one shows it again');
  assert.deepEqual(faith.topicList(fam).filter((t) => t.own).map((t) => t.label), ['Tithing and giving']);
  const kept = faith.normaliseNote({ heading: 'Giving', topics: [r.id, 'own-gone', 'made-up', 'money'] }, '2026-10-27');
  assert.deepEqual(kept.topics, [r.id, 'own-gone', 'money'], 'own topics are kept on an entry, made-up ids are not');
  assert.equal(faith.topicLabel(fam, r.id), 'Tithing and giving');
  assert.equal(faith.topicLabel(fam, 'own-gone'), 'gone', 'a removed one still reads');
  assert.deepEqual(faith.removeTopic(fam, r.id).own, []);
  assert.deepEqual(faith.normaliseTopics({ own: [{ id: 'bad id', label: 'x' }], hidden: ['nope', 'marriage'] }), { own: [], hidden: ['marriage'] });
  assert.equal(faith.bookNoteId('Song of Songs'), 'book-song-of-songs');
  assert.deepEqual(faith.normaliseBookNote({ why: '  To show love wins ', about: undefined }, '1 John'), { id: 'book-1-john', book: '1 John', why: 'To show love wins', about: '' });
  assert.deepEqual(faith.termsUsed([n, faith.normaliseNote({ terms: ['tattoos'] }, '2026-01-01')]), ['tattoos', 'love']);
  assert.ok(faith.noteText(n).includes('How do I love my wife better?'), 'questions are searchable');
  assert.deepEqual(Object.keys(BOOK_GUIDE).sort(), faith.BOOKS.map(([b]) => b).sort(), 'all 66 books have a guide');
  for (const [b, g] of Object.entries(BOOK_GUIDE)) for (const k of ['who', 'when', 'to', 'why', 'about']) assert.ok(g[k], `${b} ${k}`);
  const books = new Set(faith.BOOKS.map(([b]) => b).concat(['Psalm']));
  for (const t of Object.values(TOPICS)) for (const ref of t.start) assert.ok(books.has(ref.replace(/ \d.*$/, '')), ref);
});

test('exercise: your own exercises, workouts from them, the days they are on, and Done logs it', () => {
  const sq = ex.normaliseExercise({ name: 'Squats', works: 'strength', sets: 3, reps: 10, how: ['Feet apart', ' ', 'Sit back'] });
  assert.deepEqual(sq.how, ['Feet apart', 'Sit back']);
  assert.equal(ex.amountText(sq), '3 × 10');
  assert.equal(ex.amountText({ sets: 2, seconds: 30 }), '2 × 30 s');
  assert.equal(ex.worksName('strength'), 'Strength');
  assert.equal(ex.worksName('Mobility'), 'Mobility');            // your own word kept
  const w = ex.normaliseWorkout({ name: 'Morning', rest: 30, days: ['mon', 'thu', 'xyz'], who: ['a'],
    items: [{ exerciseId: 'sq', sets: 3, reps: 10 }, { exerciseId: 'plank', sets: 2, seconds: 60 }, { nope: 1 }] });
  assert.deepEqual(w.days, ['mon', 'thu']);
  assert.equal(w.items.length, 2);
  // 2 × 60 s timed, plus 4 rests of 30 s between 5 sets = 240 s; the squats are counted in reps
  assert.deepEqual(ex.workoutTime(w), { minutes: 4, own: false, untimed: 1 });
  assert.deepEqual(ex.workoutTime({ ...w, minutes: 20 }), { minutes: 20, own: true, untimed: 0 });
  assert.equal(ex.weekdayOf('2026-11-02'), 'mon');
  assert.equal(ex.workoutsOn([w], '2026-11-05').length, 1);       // a Thursday
  assert.equal(ex.workoutsOn([w], '2026-11-04').length, 0);
  assert.equal(ex.workoutsOn([w], '2026-11-05', 'b').length, 0);  // not for b
  assert.equal(ex.workoutsOn([{ ...w, active: false }], '2026-11-05').length, 0);
  const act = ex.normaliseActivity(ex.activityFromWorkout({ ...w, kind: 'gym' }, 'wko_1', '2026-11-05', []), '2026-11-05');
  assert.deepEqual([act.kind, act.minutes, act.who, act.workoutId], ['gym', 4, ['a'], 'wko_1']);
  assert.equal(ex.doneOn([act], 'wko_1', '2026-11-05'), true);
  assert.equal(ex.doneOn([act], 'wko_1', '2026-11-06'), false);
  assert.equal(ex.weekMinutes([act], '2026-11-02', 'a'), 4);      // counts in the week like any activity
});

test('exercise: muscles, tags, where, equipment, filters, the figure, the week, and the children’s weight', () => {
  const sq = ex.normaliseExercise({ name: 'Squats', place: 'body', sets: 3, reps: 10, tags: ['Muscle building', 'Sciatica', 'Sciatica'], muscles: { quads: 'main', core: 'also', nose: 'main', calves: 'maybe' }, kids: ['k1', 'k2'] });
  assert.deepEqual(sq.muscles, { quads: 'main', core: 'also' });
  assert.deepEqual(sq.tags, ['Muscle building', 'Sciatica']);           // your own tag kept, once
  const curl = ex.normaliseExercise({ name: 'Curls', place: 'home', need: ['Dumbbells'], muscles: { biceps: 'main' }, sets: 3, reps: 12 });
  const press = ex.normaliseExercise({ name: 'Leg press', place: 'gym', need: ['Leg press machine'], muscles: { quads: 'main' } });
  const all = [sq, curl, press];
  assert.deepEqual(ex.filterExercises(all, { tags: ['Sciatica'] }).map((x) => x.name), ['Squats']);
  assert.deepEqual(ex.filterExercises(all, { muscles: ['quads'] }).map((x) => x.name), ['Squats', 'Leg press']);
  assert.deepEqual(ex.filterExercises(all, { place: 'gym' }).map((x) => x.name), ['Leg press']);
  assert.deepEqual(ex.filterExercises(all, { have: ['dumbbells'] }).map((x) => x.name), ['Squats', 'Curls']);  // body weight needs nothing
  assert.deepEqual(ex.exerciseShade(sq), { quads: 1, core: 0.4 });
  const ids = { ...sq, id: 's' }; const c = { ...curl, id: 'c' };
  const w = ex.normaliseWorkout({ name: 'Mix', items: [{ exerciseId: 's', sets: 4, reps: 10 }, { exerciseId: 'c' }] });
  assert.deepEqual(ex.workoutMuscles(w, [ids, c]), { quads: { main: 4, also: 0 }, core: { main: 0, also: 4 }, biceps: { main: 3, also: 0 } });
  assert.deepEqual(ex.workoutMuscles(w, [ids, c], ['c']), { biceps: { main: 3, also: 0 } });     // only what was ticked as done
  assert.deepEqual(ex.shade({ quads: { main: 4, also: 0 }, core: { main: 0, also: 4 } }), { quads: 1, core: 0.5 });
  const weights = [{ id: 'k1', name: 'Mia', kg: 16, day: '2026-10-02' }, { id: 'k2', name: 'Leo', kg: 16.4, day: '2026-09-30' }];
  assert.deepEqual(ex.kidsLoad(sq, weights), { kg: 32.4, day: '2026-09-30', names: ['Mia', 'Leo'] });
  assert.equal(ex.kidsLoad({ kids: ['k1'] }, [{ id: 'k1', kg: null }]), null);
  assert.equal(ex.kidsMoved(w, [ids, c], weights), Math.round(32.4 * 10 * 4));
  const hang = { ...ex.normaliseExercise({ name: 'Hang', seconds: 30, kids: ['k1'] }), id: 'h' };
  assert.equal(ex.kidsMoved(ex.normaliseWorkout({ items: [{ exerciseId: 'h' }] }), [hang], weights), 0);   // a hold: no reps to multiply
  const acts = [
    ex.normaliseActivity({ day: '2026-11-03', who: ['a'], minutes: 20, muscles: ex.workoutMuscles(w, [ids, c]) }),
    ex.normaliseActivity({ day: '2026-11-05', who: ['a'], minutes: 20, muscles: { quads: { main: 3, also: 0 } } }),
    ex.normaliseActivity({ day: '2026-11-05', who: ['b'], minutes: 20, muscles: { chest: { main: 3, also: 0 } } }),
  ];
  const wk = ex.weekMuscles(acts, '2026-11-02', 'a');
  assert.deepEqual(wk.quads, { times: 2, main: 7, also: 0 });
  assert.equal(wk.chest, undefined);
  assert.equal(ex.KIDS_EXAMPLES.length, 3);
  for (const x of ex.KIDS_EXAMPLES) assert.ok(ex.normaliseExercise(x).tags.includes(ex.KIDS_TAG));
});

test('exercise: I have 25 minutes, a round to work through, and tallies that never reset (D-110)', () => {
  const w = (id, minutes, inRound = false) => ({ ...ex.normaliseWorkout({ name: id, minutes, inRound }), id });
  const all = [w('long', 45, true), w('short', 15), w('mid', 25, true), w('notime', null)];
  const acts = [
    ex.normaliseActivity({ day: '2026-03-01', workoutId: 'short', who: ['a'] }),
    ex.normaliseActivity({ day: '2026-11-02', workoutId: 'short', who: ['a'] }),
    ex.normaliseActivity({ day: '2025-12-30', workoutId: 'mid', who: ['a'] }),
  ];
  // fits 25: the round's undone one first, then the least done; the 45 and the untimed are left out
  assert.deepEqual(ex.fitsIn(all, 25, { activities: acts, roundFrom: '2026-11-01', year: 2026 }).map((x) => x.id), ['mid', 'short']);
  assert.equal(ex.yearCount(acts, 'short', 2026), 2);
  assert.equal(ex.yearCount(acts, 'mid', 2026), 0);                    // last year's does not count this year
  const st = ex.roundStatus(all, [...acts, ex.normaliseActivity({ day: '2026-11-04', workoutId: 'mid', who: ['a'] })], '2026-11-01');
  assert.deepEqual([st.done, st.of, st.finished], [1, 2, false]);
  assert.equal(ex.doneInRound(acts, 'mid', '2026-11-01'), false);      // done before the round began
  const morning = ex.normaliseActivity({ day: '2026-11-05', at: '2026-11-05T07:00:00.000Z', workoutId: 'mid', who: ['a'] });
  assert.equal(ex.doneInRound([morning], 'mid', '2026-11-05T09:00:00.000Z'), false);   // New round at 9 - this morning's is the old round
  assert.equal(ex.doneInRound([morning], 'mid', '2026-11-05T06:00:00.000Z'), true);
  assert.deepEqual(ex.workoutCounts(acts, '2026-11-05', 'a'), { week: 1, month: 1 });
  assert.equal(ex.countsLine({ week: 3, month: 9 }), 'This week: 3 workouts. This month: 9.');
  assert.equal(ex.countsLine({ week: 0, month: 0 }), 'A new week - any time you have 15 minutes.');
  assert.ok(!/missed|behind|overdue|streak/i.test(ex.countsLine({ week: 0, month: 4 })));
});

test('exercise: the starting examples have their own ids; copies made twice are found, never one in a workout (D-113)', () => {
  const ids = ex.KIDS_EXAMPLES.map((x) => x.id);
  assert.equal(new Set(ids).size, 3);
  // Two of each, as saved (keys sorted, as the folder writes them), one of them changed by the family.
  const sorted = (o) => JSON.parse(JSON.stringify(o, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x)));
  const saved = ex.KIDS_EXAMPLES.flatMap((x, i) => [1, 2].map((n) => ({ ...sorted(ex.normaliseExercise({ ...x, id: undefined })), id: `exc-old${i}${n}` })));
  saved[5].reps = 12;                                   // the second push-ups was changed: it is the family's now
  const copies = ex.seededCopies(saved, ex.KIDS_EXAMPLES, new Set(['exc-old02']));
  // Squats: the copy in a workout is kept. Hang: the first is kept. Push-ups: no longer the same, both stay.
  assert.deepEqual(copies, ['exc-old01', 'exc-old12']);
  assert.deepEqual(ex.seededCopies(saved.slice(2, 4), ex.KIDS_EXAMPLES), ['exc-old12']);
  assert.deepEqual(ex.seededCopies(saved.filter((_, i) => i % 2 === 0), ex.KIDS_EXAMPLES), []);
});

test('exercise: the three timed workouts start everyone off, using the family\'s own exercise of the same name (D-114)', () => {
  const fresh = ex.starterPlan([]);
  assert.equal(fresh.exercises.length, 11);
  assert.deepEqual(fresh.workouts.map((w) => [w.id, w.style, w.minutes, w.items.length]),
    [['wko-sydney', 'rounds', 20, 3], ['wko-twenty', 'cycle', 20, 6], ['wko-one-a-day', 'rotation', 20, 8]]);
  assert.deepEqual(fresh.workouts[0].items.map((i) => i.reps), [5, 10, 15]);                 // 5 pull-ups, 10 push-ups, 15 squats
  // A family that already has "Push ups" and "RDLs" keeps theirs: nothing doubled, the workouts point at them.
  const theirs = [{ id: 'exc-ours1', name: 'Push ups' }, { id: 'exc-ours2', name: 'RDLs' }];
  const plan = ex.starterPlan(theirs);
  assert.equal(plan.exercises.length, 9);
  assert.ok(plan.workouts[0].items.some((i) => i.exerciseId === 'exc-ours1'));
  assert.equal(plan.workouts[2].items.at(-1).exerciseId, 'exc-ours2');
  // Adding them again once they are there adds nothing new.
  assert.equal(ex.starterPlan(fresh.exercises).exercises.length, 0);
  // A workout keeps its style; an unknown one is In order, and only a timed one gets 20 minutes by itself.
  assert.equal(ex.normaliseWorkout({ style: 'nonsense' }).style, 'list');
  assert.equal(ex.normaliseWorkout({}).minutes, null);
  assert.equal(ex.normaliseWorkout({ style: 'rounds' }).minutes, 20);
});

test('exercise: one a day goes on from the last one done, whenever that was; results are kept and read back (D-114)', () => {
  const plan = ex.starterPlan([]);
  const w = { ...plan.workouts[2], id: 'wko-one-a-day' };
  assert.equal(ex.rotationNext(w, []).exerciseId, 'exc-std-pullups');
  const log = (day, exerciseId, reps) => ex.normaliseActivity({ workoutId: w.id, day, at: `${day}T07:00:00Z`, result: { exerciseId, reps: { [exerciseId]: reps } } }, day);
  // Dips two weeks ago, then nothing: today is push-ups - nothing was missed.
  const acts = [log('2026-10-20', 'exc-std-pullups', 12), log('2026-10-21', 'exc-std-dips', 30)];
  assert.equal(ex.rotationNext(w, acts).exerciseId, 'exc-std-pushups');
  assert.equal(ex.goWords(w, plan.exercises, acts).lead, 'Today (3 of 8): Push-ups');
  // After the last one, it starts at the first again.
  assert.equal(ex.rotationNext(w, [log('2026-11-01', 'exc-std-rdls', 20)]).exerciseId, 'exc-std-pullups');
  const lines = ex.resultLines(w, [...acts, log('2026-11-05', 'exc-std-pullups', 15)], plan.exercises);
  assert.deepEqual(lines, ['Pull-ups: last 15 (5 Nov), best 15', 'Dips: last 30 (21 Oct)']);
  // Rounds: the last time and your best. Nonsense in a result is dropped.
  const syd = { ...plan.workouts[0], id: 'wko-sydney' };
  const r = (day, rounds) => ex.normaliseActivity({ workoutId: syd.id, day, result: { rounds } }, day);
  assert.deepEqual(ex.resultLines(syd, [r('2026-11-01', 7), r('2026-11-04', 6)], plan.exercises), ['Last time (4 Nov): 6 rounds. Your best: 7 rounds.']);
  assert.equal(ex.normaliseActivity({ result: { rounds: -2, reps: { a: 'x' } } }, '2026-11-01').result, null);
  assert.deepEqual(ex.activitySummary(r('2026-11-01', 7)).result, { rounds: 7 });
  // To failure, round and round: every exercise's total, and all of them together.
  const cyc = { ...plan.workouts[1], id: 'wko-twenty' };
  const c = ex.normaliseActivity({ workoutId: cyc.id, day: '2026-11-03', result: { reps: { 'exc-std-pullups': 14, 'exc-std-pushups': 30 } } }, '2026-11-03');
  assert.deepEqual(ex.resultLines(cyc, [c], plan.exercises), ['Last time (3 Nov): Pull-ups 14, Push-ups 30 - 44 in all.']);
  assert.match(ex.goWords(syd, plan.exercises).lead, /20 minutes/);
  assert.deepEqual(ex.goWords(syd, plan.exercises).steps, ['5 Pull-ups', '10 Push-ups', '15 Squats']);
});
