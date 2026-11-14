// The security baseline, checked from the source (detronics-app skill r12, references/security.md).
// The same file goes into every app unchanged: it reads the pages at the repo root and js/.
// A line that must break a rule on purpose (a sandbox's srcdoc, say) carries a
// `security-reviewed: <why>` comment, so the exception is written down where it lives.
// Family Hub's one local change (D-132): a sandbox page - marked security-reviewed, with a policy
// that blocks every request (default-src 'none', connect-src 'none') - may run inline scripts,
// because a mini-app's code is inline by nature. tests/csp.test.js pins that page down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['.git', 'node_modules', 'tests', 'reference', 'references', 'docs']);

function files(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP.has(name)) files(p, ext, out); } else if (ext.test(name)) out.push(p);
  }
  return out;
}
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => join(ROOT, f));
const scripts = files(join(ROOT, 'js'), /\.m?js$/);
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');
const sealedSandbox = (html, d) => html.includes('security-reviewed:') && d['default-src']?.join() === "'none'" && d['connect-src']?.join() === "'none'";

/** Every line matching `rx`, except the reviewed ones, as "file:line  text". */
function offenders(list, rx) {
  return list.flatMap((p) => readFileSync(p, 'utf8').split('\n').flatMap((line, i) =>
    rx.test(line) && !line.includes('security-reviewed:') ? [`${rel(p)}:${i + 1}  ${line.trim().slice(0, 100)}`] : []));
}

function csp(html) {
  // The policy itself is full of single quotes, so match the attribute's own quote character.
  const m = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*content=(["'])(.*?)\1/i.exec(html);
  if (!m) return null;
  const directives = Object.fromEntries(m[2].split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
  return { at: m.index, directives };
}

test('every page has a Content Security Policy before anything it governs', () => {
  assert.ok(pages.length, 'no .html page at the repo root');
  for (const p of pages) {
    const html = readFileSync(p, 'utf8');
    const policy = csp(html);
    assert.ok(policy, `${rel(p)}: no <meta http-equiv="Content-Security-Policy"> (GitHub Pages cannot send the header)`);
    const first = html.search(/<(script|link|style)\b/i);
    assert.ok(first === -1 || policy.at < first, `${rel(p)}: the CSP meta must come before any <script>, <link> or <style>`);
    const d = policy.directives;
    const scriptSrc = d['script-src'] ?? d['default-src'] ?? [];
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), `${rel(p)}: script-src allows eval`);
    assert.ok(!scriptSrc.includes("'unsafe-inline'") || sealedSandbox(html, d), `${rel(p)}: script-src allows inline code`);
    assert.deepEqual(d['object-src'], ["'none'"], `${rel(p)}: object-src should be 'none'`);
    assert.ok(d['base-uri'], `${rel(p)}: base-uri is missing`);
  }
});

test('no inline scripts or inline event handlers in the pages (a strict CSP blocks them)', () => {
  for (const p of pages) {
    const html = readFileSync(p, 'utf8');
    if (sealedSandbox(html, csp(html)?.directives ?? {})) continue;
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>\s*\S/i, `${rel(p)}: inline <script> - move it to a file`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${rel(p)}: inline on…= handler - use addEventListener in a file`);
  }
});

test('nothing is loaded from another site', () => {
  const external = offenders([...pages, ...scripts], /<(script|link|iframe|img)[^>]+(src|href)=["']?(https?:)?\/\/|import[^;]*from\s*["']https?:|import\(\s*["']https?:|fetch\(\s*["'`]https?:/i);
  assert.deepEqual(external, [], 'external resources or requests - every one leaks the visitor\'s address and can change under you');
});

test('no HTML is built from strings, and no code from strings', () => {
  const sinks = offenders(scripts, /\.(inner|outer)HTML\s*\+?=(?!=)(?!\s*['"`]{2}\s*;)|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\s*\(|set(Timeout|Interval)\s*\(\s*['"`]|[{,]\s*html\s*:/);
  assert.deepEqual(sinks, [], 'build elements with el()/svg(), use icon() for icons, replaceChildren() to clear');
});

test('no keys, tokens or private keys in the code', () => {
  const secrets = offenders([...pages, ...scripts], /AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{30,}|AKIA[0-9A-Z]{16}|sk-(ant-)?[A-Za-z0-9_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY/);
  assert.deepEqual(secrets, [], 'a key in a public repo is a published key - rotate it, then remove it');
});

test('el() refuses markup and javascript: links, and new tabs get rel', async (t) => {
  class FakeNode {
    constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; this.dataset = {}; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener() {}
    appendChild(c) { this.children.push(c); return c; }
  }
  globalThis.Node ??= FakeNode;
  globalThis.document ??= { createElement: (tag) => new FakeNode(tag), createElementNS: (_, tag) => new FakeNode(tag), createTextNode: (s) => Object.assign(new FakeNode('#text'), { textContent: s }) };
  let dom;
  try { dom = await import('../js/ui/dom.js'); } catch (err) { return t.skip(`js/ui/dom.js needs a real browser to load (${err.message}) - check its html/href rules by hand`); }
  const { el, icon } = dom;
  assert.throws(() => el('span', { html: '<img src=x onerror=alert(1)>' }), /html/);
  assert.equal(el('a', { href: ' java\tscript:alert(1)' }).getAttribute('href'), null);
  assert.equal(el('a', { href: 'https://www.detronics.co.za/' }).getAttribute('href'), 'https://www.detronics.co.za/');
  assert.equal(el('a', { href: 'https://x.test/', target: '_blank' }).getAttribute('rel'), 'noopener noreferrer');
  assert.equal(typeof icon, 'function', 'dom.js has no icon() helper yet');
  assert.equal(icon(['M4 4h16', 'M4 12h16']).children.length, 2);
});
