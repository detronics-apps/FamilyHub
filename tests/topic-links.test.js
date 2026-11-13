import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyHousehold, normaliseHousehold } from '../js/model.js';
import { mergeHousehold } from '../js/merge.js';
import { SECTIONS } from '../js/sections.js';
import {
  LINKED, EXAMPLES, gatherLinked, topicLinks, addTopicCreator, editCreator, removeTopicCreator,
  replaceExample, addTopicVideo, editVideo, removeVideo, setTopicHidden,
} from '../js/topic-links.js';

const recipes = { app: { id: 'meals', name: 'Cookbook' }, open: LINKED.meals[0][1], items: [
  { id: 'rec_1', title: 'Sourdough', creators: ['cr_a'], videos: [{ url: 'https://youtu.be/x', title: 'Shaping' }] },
  { id: 'rec_2', title: 'Pizza', creators: ['cr_a', 'cr_gone'], videos: [{ url: 'https://youtu.be/x', title: '' }] },
  { id: 'rec_3', title: 'Plain' },
] };

test('links on items inside the apps are gathered, with where they are from', () => {
  const g = gatherLinked([recipes]);
  assert.deepEqual(g.creators.cr_a.map((f) => f.title), ['Sourdough', 'Pizza']);
  assert.equal(g.creators.cr_a[0].href, '#/meals/item/rec_1');
  assert.equal(g.videos.length, 1);
  assert.equal(g.videos[0].title, 'Shaping');
  assert.equal(g.videos[0].from.length, 2);
  // A removed parenting topic shows nothing; a starting topic opens by its topic id.
  const p = gatherLinked([{ app: { id: 'parenting', name: 'Parenting' }, open: LINKED.parenting[0][1], items: [
    { id: 'pt_sleep', topicId: 'sleep', title: 'Sleep', creators: ['cr_a'] }, { id: 'pt_x', removed: true, creators: ['cr_a'] }] }]);
  assert.deepEqual(p.creators.cr_a.map((f) => f.href), ['#/parenting/topic/sleep']);
});

test('a topic shows its general creators, the linked ones and the examples; never another topic\'s', () => {
  let h = emptyHousehold();
  h = addTopicCreator(h, 'meals', { name: 'Cook A', url: 'cook.example/a' });
  h = { ...h, creators: h.creators.map((c) => ({ ...c, id: 'cr_a' })) };
  h = addTopicCreator(h, 'faith', { name: 'Pastor Sam' });
  const t = topicLinks(h, 'meals', gatherLinked([recipes]));
  const real = t.creators.filter((c) => !c.example);
  assert.deepEqual(real.map((c) => c.name), ['Cook A']);
  assert.equal(real[0].from.length, 2);
  assert.equal(real[0].url, 'https://cook.example/a');
  assert.equal(t.creators.filter((c) => c.example).length, 0);
  assert.equal(t.videos[0].own, false);
  // No made-up creators anywhere (owner, 2026-11-13): only real ones the family adds.
  assert.deepEqual(EXAMPLES, {});
});

test('the same name is one creator, on several topics; Remove takes it off one, then out', () => {
  let h = addTopicCreator(emptyHousehold(), 'faith', { name: 'Pastor Sam' });
  h = addTopicCreator(h, 'us', { name: 'pastor sam', url: 'https://church.example' });
  assert.equal(h.creators.length, 1);
  assert.deepEqual(h.creators[0].topics, ['faith', 'us']);
  assert.equal(h.creators[0].url, 'https://church.example/');
  const id = h.creators[0].id;
  h = editCreator(h, id, { name: 'Sam', topics: [] });
  assert.equal(h.creators[0].name, 'Sam');
  assert.deepEqual(h.creators[0].topics, ['faith', 'us']);
  let r = removeTopicCreator(h, 'faith', id);
  assert.equal(r.gone, false);
  assert.deepEqual(r.household.creators[0].topics, ['us']);
  // Still linked on something here: kept, just not general.
  assert.equal(removeTopicCreator(r.household, 'us', id, true).gone, false);
  r = removeTopicCreator(r.household, 'us', id);
  assert.equal(r.gone, true);
  assert.equal(r.household.creators.length, 0);
});

test('examples: made your own or removed, they do not come back', () => {
  let h = replaceExample(emptyHousehold(), 'chores', 'ex-chores-0');
  assert.ok(!topicLinks(h, 'chores').creators.some((c) => c.id === 'ex-chores-0'));
  h = replaceExample(h, 'chores', 'ex-chores-1', { name: 'Our homestead channel', url: 'https://video.example/@farm' });
  const t = topicLinks(h, 'chores');
  assert.deepEqual(t.creators.map((c) => c.name), ['Our homestead channel']);
  assert.deepEqual(normaliseHousehold(JSON.parse(JSON.stringify(h))).household.examplesOff, ['ex-chores-0', 'ex-chores-1']);
});

test('topic videos: added with a safe link only, edited, removed, merged; Hide and Show', () => {
  let h = addTopicVideo(emptyHousehold(), 'holidays', { url: 'javascript:alert(1)' });
  assert.equal(h.videos.length, 0);
  h = addTopicVideo(h, 'holidays', { url: 'youtu.be/trip', title: 'Coast road' });
  const v = h.videos[0];
  assert.equal(v.url, 'https://youtu.be/trip');
  assert.deepEqual(topicLinks(h, 'holidays').videos.map((x) => x.title), ['Coast road']);
  assert.equal(topicLinks(h, 'meals').videos.length, 0);
  h = editVideo(h, v.id, { title: 'Coast', url: 'javascript:x' });
  assert.equal(h.videos[0].title, 'Coast');
  assert.equal(h.videos[0].url, 'https://youtu.be/trip');
  const mine = addTopicVideo(h, 'holidays', { url: 'https://a.example/v' });
  const theirs = removeVideo(h, v.id);
  assert.deepEqual(mergeHousehold(h, mine, theirs).household.videos.map((x) => x.url), ['https://a.example/v']);
  h = setTopicHidden(h, 'medical', true);
  assert.equal(topicLinks(h, 'medical').hidden, true);
  assert.equal(topicLinks(setTopicHidden(h, 'medical', false), 'medical').hidden, false);
  assert.deepEqual(normaliseHousehold(JSON.parse(JSON.stringify(h))).household.hiddenTopics, ['medical']);
});
