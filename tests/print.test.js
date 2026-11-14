// The print page is built from nodes: a name a family typed reaches it as text, never markup (D-129).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrint, PRINT_NOTE } from '../js/print.js';

// A stand-in document that records what was made. It has no HTML parser on purpose: buildPrint
// must not need one, and anything set as markup would show up as an innerHTML key.
function fakeDoc() {
  const node = (tag) => ({
    tag, children: [], attrs: {}, textContent: '',
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
  });
  return { title: '', head: node('head'), body: node('body'), createElement: node };
}
const all = (n) => [n, ...n.children.flatMap(all)];
const BAD = '<img src=x onerror=alert(1)>';

test('a record name reaches the printed table as text, not as an element', () => {
  const doc = buildPrint(fakeDoc(), { title: `Medicines ${BAD}`, columns: ['Medicine', 'Dose'], rows: [[BAD, '5 ml']], note: 'From the fridge door' });
  const nodes = all(doc.body);
  assert.ok(!nodes.some((n) => n.tag === 'img'), 'no element was made from the name');
  assert.ok(!nodes.some((n) => 'innerHTML' in n || 'outerHTML' in n), 'nothing set as markup');
  assert.equal(nodes.find((n) => n.tag === 'td').textContent, BAD);
  assert.equal(doc.title, `Medicines ${BAD}`);
  assert.deepEqual(nodes.filter((n) => n.tag === 'th').map((n) => n.textContent), ['Medicine', 'Dose']);
  assert.equal(nodes.at(-1).textContent, 'From the fridge door');
});

test('the fever plan prints as plain text with the doctor line', () => {
  const doc = buildPrint(fakeDoc(), { title: 'Our fever plan', text: `Under 3 months: ${BAD}`, today: '2026/11/14' });
  const nodes = all(doc.body);
  assert.equal(nodes.find((n) => n.tag === 'pre').textContent, `Under 3 months: ${BAD}`);
  assert.ok(nodes.at(-1).textContent.includes(PRINT_NOTE));
  assert.ok(!nodes.some((n) => n.tag === 'table'));
});

test('files over 50 MB are refused before they are read, with a plain message (D-135)', async () => {
  const { tooLarge, MAX_FILE_BYTES } = await import('../js/family-file.js');
  assert.equal(tooLarge({ name: 'family.json', size: MAX_FILE_BYTES }), null);
  assert.match(tooLarge({ name: 'family.json', size: MAX_FILE_BYTES + 1 }), /"family\.json" is 50 MB - Family Hub opens files up to 50 MB\. It was not read/);
  assert.match(tooLarge({ name: 'recipes.csv', size: 300 * 1024 * 1024 }), /300 MB/);
});
