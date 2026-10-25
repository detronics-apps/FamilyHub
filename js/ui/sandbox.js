// Running a third-party mini-app, isolated (DECISIONS.md D-019).
//
// The app's code goes into an <iframe sandbox="allow-scripts"> with no
// same-origin access, so it has an opaque origin: it cannot read Family Hub's
// storage, the Drive folder, the page around it, or any other app. A Content
// Security Policy inside the frame blocks network requests, so it cannot send
// what it sees anywhere (the residual risk - navigating its own frame - is
// stated on the install screen).
//
// It talks to Family Hub only through postMessage. Every request is checked
// here against the permissions the person approved, and against the screens
// and collections its manifest declared.

import { el } from './dom.js';
import { cachedPackage, loadPackage } from './packages.js';

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'";
const MAX_RECORD = 200_000;

/** The script every sandboxed app gets: window.FamilyHub.ready(hub => ...). */
const BRIDGE = `(() => {
  const pending = new Map(); let n = 0; const routeFns = []; const waiting = []; let started = false;
  const call = (method, ...args) => new Promise((resolve, reject) => {
    const id = ++n; pending.set(id, { resolve, reject });
    parent.postMessage({ fh: 1, type: 'call', id, method, args }, '*');
  });
  const hub = {
    app: null, route: null, theme: null,
    data: {
      list: (c, o) => call('data.list', c, o), search: (c, q, o) => call('data.search', c, q, o),
      get: (c, id) => call('data.get', c, id), put: (c, r) => call('data.put', c, r), remove: (c, id) => call('data.remove', c, id),
    },
    settings: { get: (k) => call('settings.get', k), set: (k, v) => call('settings.set', k, v) },
    people: { list: () => call('people.list') },
    rooms: { list: () => call('rooms.list') },
    notify: (text, level) => call('notify', text, level),
    go: (screen, param) => call('nav.go', screen, param),
    onRoute: (fn) => routeFns.push(fn),
  };
  addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const m = e.data; if (!m || m.fh !== 1) return;
    if (m.type === 'reply') { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.ok ? p.resolve(m.result) : p.reject(new Error(m.error)); }
    else if (m.type === 'route') { hub.route = m.route; routeFns.forEach((f) => { try { f(m.route); } catch (err) { console.error(err); } }); }
    else if (m.type === 'init') { hub.app = m.app; hub.route = m.route; hub.theme = m.theme; started = true; waiting.splice(0).forEach((f) => f(hub)); }
  });
  const size = () => parent.postMessage({ fh: 1, type: 'resize', height: document.documentElement.scrollHeight }, '*');
  new ResizeObserver(size).observe(document.documentElement);
  window.FamilyHub = { ready: (fn) => (started ? fn(hub) : waiting.push(fn)) };
  window.addEventListener('error', (e) => parent.postMessage({ fh: 1, type: 'error', message: String(e.message) }, '*'));
})();`;

const TOKENS = ['--bg', '--panel', '--panel-2', '--panel-3', '--border', '--border-strong', '--text', '--text-dim', '--text-faint',
  '--accent', '--accent-strong', '--accent-soft', '--accent-ink', '--ok', '--ok-soft', '--warn', '--warn-soft', '--danger', '--danger-soft',
  '--radius-sm', '--radius', '--radius-lg', '--font'];

function themeCss() {
  const cs = getComputedStyle(document.documentElement);
  const vars = TOKENS.map((t) => `${t}: ${cs.getPropertyValue(t).trim()};`).join(' ');
  return `:root { ${vars} color-scheme: ${cs.colorScheme || 'light'}; }
body { margin: 0; font: 400 15px/1.55 var(--font); color: var(--text); background: transparent; }
button, input, select, textarea { font: inherit; }`;
}

function srcdoc(code) {
  const safe = code.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${themeCss()}</style></head><body><div id="app"></div>
<script>${BRIDGE}</script>
<script>${safe}</script>
</body></html>`;
}

const frames = new Map();     // contentWindow -> { id, manifest, granted, iframe, ctx }
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('message', async (e) => {
    const f = frames.get(e.source);
    if (!f) return;                                   // not one of ours
    const m = e.data;
    if (!m || m.fh !== 1) return;
    if (m.type === 'resize') { f.iframe.style.height = `${Math.min(Math.max(Number(m.height) || 0, 120), 20000)}px`; return; }
    if (m.type === 'error') { console.warn(`[${f.manifest.name}]`, m.message); return; }
    if (m.type !== 'call') return;
    const reply = (ok, payload) => e.source.postMessage({ fh: 1, type: 'reply', id: m.id, ok, [ok ? 'result' : 'error']: payload }, '*');
    try {
      reply(true, await handle(f, String(m.method), Array.isArray(m.args) ? m.args : []));
    } catch (err) {
      reply(false, err?.message || String(err));
    }
  });
}

/** One request from a sandboxed app, checked against what it was granted. */
async function handle(f, method, args) {
  const { manifest, granted, ctx } = f;
  const need = (p) => { if (!granted.includes(p)) throw new Error(`${manifest.name} does not have permission for this (${p}).`); };
  const collection = (name) => {
    need('data:own');
    const decl = manifest.data.collections.find((c) => c.name === name);
    if (!decl) throw new Error(`"${name}" is not one of ${manifest.name}'s collections.`);
    const pick = (r) => Object.fromEntries(decl.summary.filter((k) => r[k] !== undefined && typeof r[k] !== 'object').map((k) => [k, r[k]]));
    return ctx.hubFor(manifest, granted).data.collection(name, {
      summary: pick,
      text: (r) => decl.search.map((k) => r[k]).filter((v) => typeof v === 'string' || typeof v === 'number').join(' '),
    });
  };
  const opts = (o) => ({ offset: Math.max(0, Number(o?.offset) || 0), limit: Math.min(200, Math.max(1, Number(o?.limit) || 50)) });

  switch (method) {
    case 'data.list': return collection(args[0]).list(opts(args[1]));
    case 'data.search': return collection(args[0]).search(String(args[1] ?? ''), opts(args[2]));
    case 'data.get': return collection(args[0]).get(String(args[1]));
    case 'data.put': {
      const rec = args[1];
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new Error('A record must be an object.');
      const json = JSON.stringify(rec);
      if (json.length > MAX_RECORD) throw new Error('That record is too large (over 200 KB).');
      return collection(args[0]).put(JSON.parse(json));
    }
    case 'data.remove': return collection(args[0]).remove(String(args[1]));
    case 'settings.get': need('data:own'); return ctx.hubFor(manifest, granted).settings.get(String(args[0]));
    case 'settings.set': need('data:own'); return ctx.hubFor(manifest, granted).settings.set(String(args[0]), JSON.parse(JSON.stringify(args[1] ?? null)));
    case 'people.list': need('people:read'); return ctx.hubFor(manifest, granted).people.list();
    case 'rooms.list': need('rooms:read'); return ctx.hubFor(manifest, granted).rooms.list();
    case 'notify': need('notify'); ctx.hubFor(manifest, granted).ui.notice(String(args[0] ?? ''), ['ok', 'info', 'warn'].includes(args[1]) ? args[1] : 'info'); return true;
    case 'nav.go': {
      const screen = args[0] == null ? null : String(args[0]);
      if (screen && !manifest.screens.some((s) => s.id === screen)) throw new Error(`"${screen}" is not one of ${manifest.name}'s screens.`);
      ctx.go(`#/${manifest.id}${screen ? `/${screen}` : ''}${args[1] != null ? `/${encodeURIComponent(String(args[1]))}` : ''}`);
      return true;
    }
    default: throw new Error(`Unknown request "${method}".`);
  }
}

const loadErrors = new Map();
const loading = new Set();

/** Tell an already-running app its screen changed (no reload, no lost state). */
export function postRoute(id, route) {
  for (const [win, f] of frames) {
    if (f.id === id) win.postMessage({ fh: 1, type: 'route', route: { screen: route.sub, param: route.rest[0] ?? null } }, '*');
  }
}

export function renderThirdParty(ctx, id, route, failed) {
  listen();
  const entry = ctx.app.registry.apps[id];
  const pkg = cachedPackage(id);
  if (!pkg) {
    if (loadErrors.has(id)) return failed(loadErrors.get(id));
    if (!loading.has(id)) {
      loading.add(id);
      loadPackage(ctx.sync.appStore(), id, entry).then(
        () => { loading.delete(id); loadErrors.delete(id); ctx.render(); },
        (err) => { loading.delete(id); loadErrors.set(id, err); ctx.render(); },
      );
    }
    return el('p', { class: 'muted', text: `Opening ${entry.name}…` });
  }

  // Forget frames that are no longer on the page.
  for (const [win, f] of frames) if (!f.iframe.isConnected) frames.delete(win);

  const iframe = el('iframe', {
    class: 'miniapp-frame',
    title: pkg.manifest.name,
    sandbox: 'allow-scripts',
    referrerpolicy: 'no-referrer',
    srcdoc: srcdoc(pkg.code),
  });
  iframe.addEventListener('load', () => {
    const win = iframe.contentWindow;
    frames.set(win, { id, manifest: pkg.manifest, granted: entry.granted, iframe, ctx });
    win.postMessage({
      fh: 1, type: 'init',
      app: { id, name: pkg.manifest.name, version: pkg.manifest.version, screens: pkg.manifest.screens },
      route: { screen: route.sub, param: route.rest[0] ?? null },
      theme: ctx.app.device.theme,
    }, '*');
  });
  return el('section', { class: 'stack' }, [
    el('p', { class: 'small muted', text: `${pkg.manifest.name} ${pkg.manifest.version} - a mini-app from your Drive folder, running in its own sealed space.` }),
    iframe,
  ]);
}

export const clearLoadError = (id) => loadErrors.delete(id);
