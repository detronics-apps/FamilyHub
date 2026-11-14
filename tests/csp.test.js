// Family Hub's Content Security Policies (D-132): a strict one on the app, and the mini-app
// sandbox's own sealed one - its code is inline by nature, but it may reach nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (f) => readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8');
const policyOf = (html) => {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
  return m && { at: m.index, d: Object.fromEntries(m[1].split(';').map((x) => x.trim().split(/\s+/)).map(([k, ...v]) => [k, v])) };
};

test('index.html: the policy is the first thing in <head>, and scripts come only from the app itself', () => {
  const html = read('index.html');
  const p = policyOf(html);
  assert.ok(p, 'no CSP meta');
  assert.match(html.slice(html.indexOf("<head>"), p.at + 60), /^<head>\s*<meta http-equiv="Content-Security-Policy"/);
  assert.deepEqual(p.d['script-src'], ["'self'"]);
  assert.ok(!JSON.stringify(p.d).includes('unsafe-eval'));
  for (const [k, v] of [['default-src', ["'self'"]], ['connect-src', ["'self'"]], ['frame-src', ["'self'"]], ['object-src', ["'none'"]], ['base-uri', ["'none'"]], ['form-action', ["'none'"]], ['worker-src', ["'none'"]]]) {
    assert.deepEqual(p.d[k], v, k);
  }
  assert.match(html, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'no inline handlers');
});

test('sandbox.html keeps every request blocked, and runs only in an opaque-origin frame', () => {
  const p = policyOf(read('sandbox.html'));
  assert.deepEqual(p.d['connect-src'], ["'none'"]);
  assert.deepEqual(p.d['default-src'], ["'none'"]);
  assert.deepEqual(p.d['frame-src'], ["'none'"]);
  assert.deepEqual(p.d['form-action'], ["'none'"]);
  assert.ok(!JSON.stringify(p.d).includes("'self'"), 'nothing from the app\'s own address either');
  assert.ok(!JSON.stringify(p.d).includes('unsafe-eval'));
  const js = read('js/ui/sandbox.js');
  assert.match(js, /sandbox: 'allow-scripts',/);
  assert.doesNotMatch(js, /allow-same-origin/);
  assert.match(js, /src: 'sandbox\.html'/);
  assert.doesNotMatch(js, /srcdoc:/, 'a srcdoc frame would inherit the app\'s policy');
});
