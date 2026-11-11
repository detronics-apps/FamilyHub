// A screen that calls a function it never imported stops with "x is not defined" - and node --check
// cannot see it. Exercise's Workouts tab did that from v0.20.0 until v0.23.0 (timesText), unseen until
// a family had a workout. So: in every app, nothing a sibling module exports is called without being
// imported (or defined) in the file that calls it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const apps = join(import.meta.dirname, '..', 'js', 'apps');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Words inside plain strings and comment lines are not calls: "Yearly interest or growth (%)".
// Template strings stay: telling their text from the ${...} code in them takes a parser.
const code = (src) => src.replace(/^\s*\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");

test('every function a screen calls from a sibling module is imported', () => {
  const missing = [];
  for (const app of readdirSync(apps)) {
    const dir = join(apps, app);
    if (!statSync(dir).isDirectory()) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
    const src = Object.fromEntries(files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
    const exported = Object.fromEntries(files.map((f) => [f, [...src[f].matchAll(/export (?:async )?(?:const|function|let) ([A-Za-z_$][\w$]*)/g)].map((m) => m[1])]));
    for (const f of files) {
      const imported = new Set([...src[f].matchAll(/import \{([^}]+)\}/gs)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)));
      const defined = new Set([...src[f].matchAll(/(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
      const body = code(src[f]);
      for (const [other, names] of Object.entries(exported)) {
        if (other === f) continue;
        for (const n of names) {
          if (!imported.has(n) && !defined.has(n) && new RegExp(`(^|[^\\w$.])${esc(n)}\\s*\\(`).test(body)) missing.push(`${app}/${f} calls ${n}() from ${other}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});
