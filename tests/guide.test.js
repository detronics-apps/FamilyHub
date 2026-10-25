import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideMatches, HOWTOS, FAQS, PRIVACY } from '../js/guide.js';

const howtoText = (h) => `${h.title} ${h.steps.join(' ')}`;

test('everyday words find the app\'s own terms', () => {
  const find = (q) => HOWTOS.filter((h) => guideMatches(howtoText(h), q)).map((h) => h.id);
  assert.ok(find('backup').includes('backup'));
  assert.ok(find('sync').includes('drive'));
  assert.ok(find('iphone').includes('phone'));
  assert.ok(find('overwrite').includes('conflict'));
  assert.ok(find('uninstall').includes('miniapps'));
  assert.ok(find('spotify').length === 0 || find('playlist').includes('music'));
  assert.ok(find('agenda').includes('meeting'));
  assert.ok(find('postpone').includes('later'));
  assert.ok(find('five minutes').includes('quick'));
  assert.ok(find('login').includes('who'));
  assert.deepEqual(find('zzzz'), []);
});

test('every word must match (narrows, never widens)', () => {
  const all = HOWTOS.filter((h) => guideMatches(howtoText(h), 'chore')).length;
  const narrow = HOWTOS.filter((h) => guideMatches(howtoText(h), 'chore depends')).length;
  assert.ok(narrow < all && narrow > 0);
});

test('the privacy notice claims no more than the app does', () => {
  const text = PRIVACY.sections.map((s) => s.join(' ')).join(' ');
  assert.match(text, /local storage/);
  assert.match(text, /not a backup/);
  assert.match(text, /not a login/);
  assert.match(text, /logs/, 'the host keeps logs; say so');
});

test('the guide says missed chores do not pile up', () => {
  assert.ok(FAQS.some((f) => /piles up|pile up/i.test(f.a)));
});

test('the guide reaches the new apps and the importer in everyday words', () => {
  const find = (q) => HOWTOS.filter((h) => guideMatches(`${h.title} ${h.steps.join(' ')}`, q)).map((h) => h.id);
  assert.ok(find('excel').includes('import'));
  assert.ok(find('groceries').includes('meals'));
  assert.ok(find('vacation').includes('trip'));
  assert.ok(find('spending').includes('budget'));
  assert.ok(find('bible').includes('reading'));
});
