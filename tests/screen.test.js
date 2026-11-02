// Screen time (D-097): the week against what was agreed, and shows ranked on the family's values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseLog, allowed, minScoreFor, showsOf, criteriaOf, personScore, ranking, suggest, week, limitFor, CRITERIA } from '../js/apps/parenting/screen.js';
import { normaliseDecision, decisionSummary } from '../js/apps/decisions/logic.js';

const TODAY = '2026-11-02';
const kid = { id: 'k', name: 'Emma', months: 40 };
const rule = (x) => ({ id: x.id ?? 'd', ...decisionSummary(normaliseDecision({ source: 'parenting:screens', agreement: 'yes', ...x })) });

test('the minutes agreed for a child’s age now', () => {
  const ds = [rule({ id: 'a', ageFrom: 0, ageTo: 24, screenMinutes: 0 }), rule({ id: 'b', ageFrom: 24, ageTo: 72, screenMinutes: 60 })];
  assert.equal(limitFor(kid, ds), 60);
  assert.equal(limitFor({ ...kid, months: 10 }, ds), 0);
  assert.equal(limitFor(kid, [rule({ ageFrom: 24, ageTo: 72, screenMinutes: 60, agreement: '' })]), null, 'not agreed yet: no limit');
});

test('a week: minutes a day beside the limit, said plainly', () => {
  const logs = [
    { day: '2026-11-02', time: '17:30', kids: ['k'], minutes: 70, after: 'wound' },
    { day: '2026-11-01', time: '18:00', kids: ['k'], minutes: 40, after: 'calm' },
    { day: '2026-10-31', time: '19:00', kids: ['k'], minutes: 30 },
    { day: '2026-10-20', kids: ['k'], minutes: 200 },          // outside the week
    { day: '2026-11-02', kids: ['other'], minutes: 90 },       // someone else
  ].map(normaliseLog);
  const w = week(kid, logs, [rule({ ageFrom: 24, ageTo: 72, screenMinutes: 60 })], TODAY);
  assert.equal(w.days.length, 7);
  assert.equal(w.days.at(-1).minutes, 70);
  assert.equal(w.total, 140);
  assert.deepEqual(w.notes, ['1 day over the 60 minutes you agreed', 'Most of it after 5pm', 'Wound up afterwards 1 time']);
});

test('shows ranked on our values: weights count, each parent apart, unrated last', () => {
  const crit = criteriaOf({ criteria: [{ id: 'kind', name: 'Kindness', weight: 3 }, { id: 'pace', name: 'Calm pace', weight: 1 }] });
  const shows = showsOf([
    { showId: 'bluey', ratings: { a: { kind: 5, pace: 3 }, b: { kind: 4, pace: 4 } } },
    { showId: 'pawpatrol', ratings: { a: { kind: 3, pace: 1 } } },
  ]);
  const bluey = shows.find((s) => s.showId === 'bluey');
  assert.equal(personScore(bluey, 'a', crit), 4.5);   // (3*5 + 1*3) / 4
  const r = ranking(shows, crit, [], [{ id: 'a', name: 'Sam' }, { id: 'b', name: 'Lee' }]);
  assert.deepEqual(r.slice(0, 2).map((x) => x.show.showId), ['bluey', 'pawpatrol']);
  assert.equal(r[0].score, 4.3);                     // the average of 4.5 and 4
  assert.equal(r.at(-1).score, null);
  assert.equal(suggest(r, [{ months: 40 }]).show.showId, 'bluey');
  assert.equal(suggest(r, [{ months: 12 }]), null, 'nothing rated is made for a 1-year-old');
  assert.equal(criteriaOf(null).length, CRITERIA.length);
});

test('only shows scoring above what we agreed: marked per child, kept out of the suggestion, noted in the week', () => {
  const ds = [rule({ id: 'a', ageFrom: 24, ageTo: 72, screenMinScore: 4 }), rule({ id: 'b', ageFrom: 0, ageTo: 216, screenMinScore: 3 })];
  assert.equal(minScoreFor(kid, ds), 4, 'the strictest rule in force');
  assert.equal(minScoreFor({ ...kid, months: 100 }, ds), 3);
  assert.equal(allowed(4.3, kid, ds), 'ok');
  assert.equal(allowed(3.5, kid, ds), 'below');
  assert.equal(allowed(null, kid, ds), 'unrated');
  assert.equal(allowed(2, kid, []), null, 'no bar agreed: nothing to mark');
  const crit = criteriaOf(null);
  const shows = showsOf([{ showId: 'pawpatrol', ratings: { a: { pace: 4, learning: 4, kindness: 4, ending: 4, ads: 4, parents: 4 } } }, { showId: 'bluey', ratings: { a: { pace: 5, learning: 4, kindness: 5, ending: 4, ads: 5, parents: 5 } } }]);
  const r = ranking(shows, crit, [], [{ id: 'a', name: 'Sam' }]);
  assert.equal(suggest(r, [kid], [rule({ ageFrom: 24, ageTo: 72, screenMinScore: 4.9 })]), null, 'nothing clears 4.9');
  assert.equal(suggest(r, [kid], ds).show.showId, 'bluey');
  const logs = [{ day: TODAY, kids: ['k'], showId: 'pawpatrol', minutes: 20 }].map(normaliseLog);
  const w = week(kid, logs, [rule({ ageFrom: 24, ageTo: 72, screenMinScore: 4.5 })], TODAY, (id) => r.find((x) => x.show.showId === id)?.score ?? null);
  assert.deepEqual(w.notes, ['1 time a show below the 4.5 you agreed']);
});
