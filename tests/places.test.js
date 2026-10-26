import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisePlace, filterPlaces, areasOf, TAGS } from '../js/apps/places/logic.js';

test('places to go: tags from a list, filters that all must match, one spelling per area', () => {
  const p = normalisePlace({ title: 'Kirstenbosch', area: 'Cape Town', kind: 'outdoors', tags: ['kids', 'pets', 'nonsense', 'kids'], status: 'been', verdict: 'loved', link: 'javascript:alert(1)' });
  assert.deepEqual(p.tags, ['kids', 'pets'], 'only known tags, once each');
  assert.equal(p.link, '', 'only web links');
  assert.equal(normalisePlace({ verdict: 'loved' }).verdict, null, 'a verdict only once been');
  const list = [p, normalisePlace({ title: 'Farm', area: 'cape town', tags: ['kids', 'play'] }), normalisePlace({ title: 'Wine farm', area: 'Stellenbosch', tags: ['food'] })];
  assert.deepEqual(filterPlaces(list, { tags: ['kids'] }).map((x) => x.title), ['Farm', 'Kirstenbosch'], 'not been first');
  assert.deepEqual(filterPlaces(list, { tags: ['kids', 'pets'] }).map((x) => x.title), ['Kirstenbosch']);
  assert.deepEqual(filterPlaces(list, { area: 'Cape Town' }).length, 2, 'area matches whatever the capitals');
  assert.deepEqual(filterPlaces(list, { status: 'been' }).map((x) => x.title), ['Kirstenbosch']);
  assert.deepEqual(areasOf(list), ['Cape Town', 'Stellenbosch'], 'one area whatever the capitals, most used first');
  assert.ok(TAGS.kids && TAGS.pets);
});
