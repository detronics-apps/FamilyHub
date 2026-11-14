// Family Hub's own address (D-130): every Detronics app on detronics-apps.github.io shares one
// origin, and so one localStorage, IndexedDB and set of folder permissions. Family Hub moves to
// its own subdomain, and nothing may still send people to the shared address.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };

test('CNAME names Family Hub\'s own address', (t) => {
  // The move goes out in two steps (D-130): first the note telling families how to bring their
  // things along, and only later CNAME, which makes GitHub redirect the old address at once.
  if (!existsSync(join(ROOT, 'CNAME'))) return t.skip('CNAME not added yet - step 2 of the move (D-130)');
  assert.equal(readFileSync(join(ROOT, 'CNAME'), 'utf8').trim(), 'familyhub.detronics.co.za');
});

test('no file in js/, README.md or docs/ still sends people to the shared address', () => {
  const files = [...walk(join(ROOT, 'js')), join(ROOT, 'README.md'), ...walk(join(ROOT, 'docs'))];
  const stale = files.filter((p) => /detronics-apps\.github\.io\/FamilyHub/i.test(readFileSync(p, 'utf8'))).map((p) => relative(ROOT, p));
  assert.deepEqual(stale, []);
});

test('the code does not depend on the host name', () => {
  const uses = walk(join(ROOT, 'js')).filter((p) => p.endsWith('.js') && /location\.(host|hostname)\b|github\.io/.test(readFileSync(p, 'utf8'))).map((p) => relative(ROOT, p));
  assert.deepEqual(uses, []);
});
