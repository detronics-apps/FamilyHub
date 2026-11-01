import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, normaliseLinks, parseVideos, videosText } from '../js/links.js';
import { emptyHousehold, normaliseHousehold, addCreator, updateCreator, removeCreator } from '../js/model.js';
import { mergeHousehold } from '../js/merge.js';

test('only http(s) links are kept', () => {
  assert.equal(safeUrl('https://youtube.com/@cook'), 'https://youtube.com/@cook');
  assert.equal(safeUrl('youtube.com/@cook'), 'https://youtube.com/@cook');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,hi'), '');
  assert.equal(safeUrl('not a link'), '');
});

test('videos one per line, with an optional title', () => {
  const v = parseVideos('https://youtu.be/abc Sourdough at home\n\nnonsense\nvimeo.com/123 - Part 2');
  assert.deepEqual(v, [{ url: 'https://youtu.be/abc', title: 'Sourdough at home' }, { url: 'https://vimeo.com/123', title: 'Part 2' }]);
  assert.deepEqual(parseVideos(videosText(v)), v);
  assert.deepEqual(normaliseLinks({ creators: ['a', 'a', 3], videos: [{ url: 'javascript:x' }, { url: 'https://x.org/v' }] }), { creators: ['a'], videos: [{ url: 'https://x.org/v', title: '' }] });
});

test('creators live in the household: added once by name, edited, removed, merged', () => {
  let h = emptyHousehold();
  const a = addCreator(h, { name: 'Pastor Sam', url: 'https://church.example/sam' });
  h = a.household;
  assert.equal(h.creators.length, 1);
  assert.equal(addCreator(h, { name: 'pastor sam' }).creator.id, a.creator.id);
  h = updateCreator(h, a.creator.id, { url: 'javascript:bad' });
  assert.equal(h.creators[0].url, '');
  assert.equal(normaliseHousehold(JSON.parse(JSON.stringify(h))).creators[0].name, 'Pastor Sam');
  // Added on two devices: both kept.
  const mine = addCreator(h, { name: 'Cook A' }).household;
  const theirs = addCreator(h, { name: 'Coach B' }).household;
  assert.deepEqual(mergeHousehold(h, mine, theirs).household.creators.map((c) => c.name).sort(), ['Coach B', 'Cook A', 'Pastor Sam']);
  assert.equal(removeCreator(h, a.creator.id).creators.length, 0);
});
