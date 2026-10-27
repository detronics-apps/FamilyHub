// House rule (D-050): a button is a name of one or two words. What it does in more
// detail goes in a hover title, an info icon, a hint below it, or the page's own text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : []; });

/** The text from `start` to the bracket that closes the one at `start`. */
function span(src, start) {
  const open = src[start]; const close = { '{': '}', '(': ')', '[': ']' }[open];
  let depth = 0; let q = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

/** Every string literal in an expression - both sides of a ternary count. */
const literals = (expr) => [...expr.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`|"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] ?? m[2] ?? m[3]);
/** Words in a label: a ${value} is one word, a (count) and leading symbols like + or ‹ are not. */
const words = (s) => s.replace(/\$\{[^}]*\}/g, 'X').replace(/\([^)]*\)/g, '').replace(/^[^A-Za-z0-9"X]+/, '').split(/[\s/]+/).filter((w) => /[A-Za-z0-9]/.test(w));

/** The labels of every button-looking element in a file: <button>, links styled as buttons, chips and confirm buttons. */
function labels(src) {
  const out = [];
  for (const m of src.matchAll(/el\('(button|a)', \{/g)) {
    const attrs = span(src, m.index + m[0].length - 1);
    if (m[1] === 'a' && !/class: ['`][^'`]*\b(btn|chip)\b/.test(attrs)) continue;
    if (/class: ['`][^'`]*\b(info|linkish)\b/.test(attrs)) continue;
    const t = attrs.match(/[{,]\s*text: /);
    if (!t) continue;
    // The text expression runs to the next key at the top level of the attrs object.
    const rest = attrs.slice(t.index + t[0].length);
    let depth = 0; let q = null; let end = rest.length;
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') q = c;
      else if ('({['.includes(c)) depth++;
      else if (')}]'.includes(c)) { if (depth-- === 0) { end = i; break; } }
      else if (c === ',' && depth === 0) { end = i; break; }
    }
    out.push(...literals(rest.slice(0, end)));
  }
  for (const m of src.matchAll(/(?:confirmLabel|saveLabel): ('(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g)) out.push(m[1].slice(1, -1));
  return out;
}

test('buttons are named in one or two words, never explained', () => {
  const long = files('js').flatMap((f) => labels(readFileSync(f, 'utf8')).filter((s) => words(s).length > 2).map((s) => `${f}: ${s}`));
  assert.deepEqual(long, []);
});

test('the check catches a long label, both sides of a ternary, and a styled link', () => {
  const src = `el('button', { class: 'btn', text: on ? 'Edit' : 'Add our own notes', on: {} }); el('a', { class: 'btn', href: '#', text: 'Back to the list' }); el('a', { href: '#', text: 'a plain link is prose' });`;
  assert.deepEqual(labels(src).filter((s) => words(s).length > 2), ['Add our own notes', 'Back to the list']);
  assert.deepEqual(words('+ Add "${text}"'), ['Add', '"X"']);
});
