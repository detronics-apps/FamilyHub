// Activities (D-096): Ideas to plan them, Play now to find one fast, scores and a game's rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activitiesOf, pick, payoff, normaliseActivity, normaliseNeed, costOf, scores, changeRules, logDone, planned, shopSend, STARTER_ACTIVITIES } from '../js/apps/parenting/activities.js';

const all = () => activitiesOf([]);

test('needs: what we have, and what to buy with its cost', () => {
  assert.deepEqual(normaliseNeed('Cushions'), { name: 'Cushions', have: true, cost: 0 });
  assert.deepEqual(normaliseNeed('Water balloons - R40'), { name: 'Water balloons', have: false, cost: 40 });
  const dough = all().find((a) => a.activityId === 'playdough');
  assert.equal(costOf(dough), 25);
  assert.deepEqual(shopSend(dough).items.map((i) => i.name), ['Food colouring']);
});

test('Play now: only what fits the children, the place, the weather, the time and the budget', () => {
  const list = all();
  const out = pick(list, { kids: [30], place: 'outside', weather: 'sun', minutes: 30, buy: false });
  assert.ok(out.some((a) => a.activityId === 'sprinkler'));
  assert.ok(out.every((a) => a.place !== 'inside' && (a.ageFrom ?? 0) <= 30 && costOf(a) === 0));
  assert.ok(!pick(list, { place: 'outside', weather: 'rain' }).some((a) => a.activityId === 'sprinkler'), 'no sprinkler in the rain');
  assert.ok(!pick(list, { kids: [10] }).some((a) => a.activityId === 'fort'), 'a fort is from 18 months');
  assert.equal(pick(list, {}).length, STARTER_ACTIVITIES.length);
  assert.ok(pick(list, { kids: [8], place: 'outside', weather: 'sun' }).length, 'something for a baby outside');
});

test('how it went: scores add up, and the best-loved comes first', () => {
  const list = all();
  const fort = list.find((a) => a.activityId === 'fort');
  const loved = logDone(fort, { day: '2026-11-02', kids: [{ id: 'k', score: 5 }], parent: 4, note: '' });
  assert.deepEqual(scores(loved), { kid: 5, parent: 4, times: 1 });
  const ranked = pick([...list.filter((a) => a.activityId !== 'fort'), activitiesOf([{ ...loved }]).find((a) => a.activityId === 'fort')], { place: 'inside' });
  assert.equal(ranked[0].activityId, 'fort');
});

test('a game’s rules change, and the earlier ones are kept', () => {
  const hide = all().find((a) => a.activityId === 'hideseek');
  const next = changeRules(hide, 'The seeker counts to 30.\nNo hiding upstairs.', '2026-11-02T10:00:00Z');
  assert.deepEqual(next.rules, ['The seeker counts to 30.', 'No hiding upstairs.']);
  assert.deepEqual(next.rulesHistory.at(-1).rules, hide.rules);
  assert.equal(changeRules(next, next.rules.join('\n')), next, 'unchanged rules keep no history');
});

test('our own, changes to a starting idea, removed ones; planned days', () => {
  const list = activitiesOf([{ activityId: 'fort', name: 'Blanket fort', plannedOn: '2026-11-07' }, { activityId: 'chalk', removed: true }, { activityId: 'act-1', own: true, name: 'Car wash for toys', place: 'outside' }]);
  assert.equal(list.find((a) => a.activityId === 'fort').name, 'Blanket fort');
  assert.ok(!list.some((a) => a.activityId === 'chalk'));
  assert.ok(list.some((a) => a.name === 'Car wash for toys'));
  assert.deepEqual(planned(list, '2026-11-02').map((a) => a.activityId), ['fort']);
  assert.equal(logDone(list.find((a) => a.activityId === 'fort'), { day: '2026-11-07' }).plannedOn, null, 'done clears the plan');
});

test('5 minutes to set up for 30 busy beats 30 to set up for 45 busy', () => {
  const quick = normaliseActivity({ activityId: 'q', name: 'Quick', setup: 5, lasts: 30 });
  const slow = normaliseActivity({ activityId: 's', name: 'Slow', setup: 30, lasts: 45 });
  assert.equal(payoff(quick), 6);
  assert.equal(payoff(slow), 1.5);
  assert.deepEqual(pick([slow, quick]).map((a) => a.activityId), ['q', 's']);
});
