// The shared shape of every Finance calculator (D-066), so they read as one system:
// a Simple / Advanced / Learn bar, inputs that say where each default came from,
// answers that update as you type, and anything saved under a name to compare later.
// UI only - the arithmetic lives in maths.js (pure, tested).

import { el, svg } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { KEYS } from '../../storage.js';
import { saveRecord } from '../kit.js';

/* ------------------------------------------------------------ levels */

export const LEVELS = [
  { id: 'simple', label: 'Simple', says: 'Just the answer, from the few things that matter most.' },
  { id: 'advanced', label: 'Advanced', says: 'Every cost and assumption, a timeline, and what moves the answer most.' },
  { id: 'learn', label: 'Learn', says: 'Everything in Advanced, plus how each number is worked out, step by step.' },
];

export function level() {
  try { const v = localStorage.getItem(KEYS.financeLevel); return LEVELS.some((l) => l.id === v) ? v : 'simple'; } catch { return 'simple'; }
}

export function levelBar(onChange) {
  const now = level();
  return el('div', { class: 'stack', style: { gap: 'var(--space-1)' } }, [
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'How much detail' }, LEVELS.map((l) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(l.id === now), 'data-field': `level:${l.id}`, text: l.label,
      on: { click: () => { try { localStorage.setItem(KEYS.financeLevel, l.id); } catch { /* this device only */ } onChange(); } },
    }))),
    el('p', { class: 'small muted', style: { margin: 0 }, text: LEVELS.find((l) => l.id === now).says }),
  ]);
}

export const shows = (want) => ({ simple: 0, advanced: 1, learn: 2 })[level()] >= ({ simple: 0, advanced: 1, learn: 2 })[want];

/* ------------------------------------------------------------ amounts */

const ZAR = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });
/** Rands, rounded to the rand for reading; the sums underneath are never rounded. */
export const rand = (n) => (n == null || !Number.isFinite(n) ? '-' : ZAR.format(Math.round(n) || 0));
export const pct = (n, dp = 2) => `${Number(n.toFixed(dp))}%`;
export const months = (m) => (m % 12 === 0 ? `${m / 12} year${m === 12 ? '' : 's'}` : m < 12 ? `${m} months` : `${Math.floor(m / 12)} years ${m % 12} months`);

/* ------------------------------------------------------------- inputs */

/**
 * A calculator's working values, kept per calculator while the app is open, so
 * moving between Simple, Advanced and Learn never loses what was typed.
 * `mine` holds the keys the person changed: those are labelled "Yours".
 */
const drafts = new Map();
export function draft(key, defaults) {
  if (!drafts.has(key)) drafts.set(key, { values: { ...defaults }, mine: new Set(), savedId: null, title: '' });
  return drafts.get(key);
}
export function loadDraft(key, defaults, record) {
  drafts.set(key, { values: { ...defaults, ...record.values }, mine: new Set(Object.keys(record.values)), savedId: record.id, title: record.title });
}

/** Where a value came from, in words. */
function origin(f, d) {
  if (d.mine.has(f.key)) return 'Yours';
  if (f.optional && (d.values[f.key] === null || d.values[f.key] === '')) return 'Not counted';
  const s = f.source;
  if (!s) return null;
  if (s.ref) return `${s.ref.label}, ${s.ref.source}${s.note ? ` ${s.note}` : ''}`;
  return { illustrative: 'Illustrative - check your own', assumption: 'Assumption' }[s.kind] ?? s.text;
}

/**
 * One input. Types: money, percent, number, years, choice (chips), check.
 * Typing updates the answer straight away (`onInput`) without redrawing the inputs.
 */
export function input(f, d, onInput) {
  const id = `fin-${f.key}`;
  const tag = el('span', { class: 'fin-tag', 'data-field': `origin:${f.key}`, text: origin(f, d) ?? '' });
  const set = (v) => { d.values[f.key] = v; d.mine.add(f.key); tag.textContent = origin(f, d) ?? ''; onInput(f.key); };
  let control;
  if (f.type === 'choice') {
    control = el('div', { class: 'chipset', role: 'group', 'aria-label': f.label }, f.choices.map((c) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(d.values[f.key] === c.value), 'data-field': `${f.key}:${c.value}`, text: c.label,
      on: { click: (e) => { for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); set(c.value); } },
    })));
  } else if (f.type === 'check') {
    control = el('input', { type: 'checkbox', id, checked: !!d.values[f.key], on: { change: (e) => set(e.target.checked) } });
    return el('label', { class: 'checkline' }, [control, el('span', {}, [f.label, ' ', tag])]);
  } else {
    control = el('input', {
      class: 'input', id, type: 'number', inputmode: 'decimal', step: 'any', min: f.min ?? '0', value: d.values[f.key] ?? '',
      placeholder: f.optional ? 'not counted' : '', 'data-field': `in:${f.key}`, style: { maxWidth: '200px' },
      on: { input: (e) => set(e.target.value === '' ? null : Number(e.target.value)) },
    });
  }
  const unit = { money: 'R', percent: '% a year', years: 'years', months: 'months', km: 'km a year' }[f.type];
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: f.type === 'choice' ? null : id }, [f.label, ' ', tag]),
    el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [unit === 'R' ? el('span', { class: 'muted', text: 'R' }) : null, control, unit && unit !== 'R' ? el('span', { class: 'small muted', text: unit }) : null]),
    f.hint ? el('div', { class: 'field__hint', text: f.hint }) : null,
  ]);
}

/** The defaults quietly in use in Simple, listed so nothing is hidden. */
export function assumed(fields, d) {
  const hidden = fields.filter((f) => f.level !== 'simple' && !f.optional && (!f.when || f.when(d.values)) && origin(f, d) && origin(f, d) !== 'Yours');
  if (!hidden.length) return null;
  return el('p', { class: 'small muted', 'data-field': 'assumed' }, [
    el('strong', { text: 'Also counted: ' }),
    hidden.map((f) => `${f.label.toLowerCase()} ${f.type === 'money' ? rand(d.values[f.key]) : f.type === 'percent' ? pct(d.values[f.key]) : f.type === 'check' ? (d.values[f.key] ? 'yes' : 'no') : d.values[f.key]} (${origin(f, d)})`).join('; '),
    '. Change them under Advanced.',
  ]);
}

export const stat = (value, label, field) => el('div', { class: 'stat', 'data-field': field ?? null }, [el('div', { class: 'stat__value', text: value }), el('div', { class: 'stat__label', text: label })]);

/** A small table of label/amount rows; a row with `total` is drawn as the sum. */
export function sums(rows) {
  return el('table', { class: 'plain fin-sums' }, [el('tbody', {}, rows.filter(Boolean).map((r) => el('tr', { class: r.total ? 'fin-sums__total' : null }, [
    el('td', {}, [r.label, r.note ? el('div', { class: 'small muted', text: r.note }) : null]),
    el('td', { class: 'num', text: typeof r.value === 'number' ? rand(r.value) : r.value }),
  ])))]);
}

/** A worked step for Learn: the rule, then the same rule with today's numbers in it. */
export const step = (title, rule, worked, why) => el('div', { class: 'fin-step' }, [
  el('strong', { text: title }),
  el('code', { class: 'fin-formula', text: rule }),
  worked ? el('code', { class: 'fin-formula fin-formula--worked', text: worked }) : null,
  why ? el('p', { class: 'small', style: { margin: 0 }, text: why }) : null,
]);

/* -------------------------------------------------------------- chart */

/**
 * Lines over time. series: [{ name, points: [[x, y]], dashed }]. x is months.
 * Colours come from the theme, so it reads in light and dark.
 */
export function lineChart(series, { label }) {
  const W = 640; const H = 220; const L = 64; const B = 26; const T = 10; const R = 10;
  const xs = series.flatMap((s) => s.points.map((p) => p[0]));
  const ys = series.flatMap((s) => s.points.map((p) => p[1]));
  const x0 = Math.min(...xs); const x1 = Math.max(...xs) || 1;
  const y0 = Math.min(0, ...ys); const y1 = Math.max(...ys) || 1;
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  const colours = ['var(--accent-strong)', 'var(--text-dim)', 'var(--warn)', 'var(--ok)'];
  const ticks = [y0, (y0 + y1) / 2, y1];
  const years = [...new Set([x0, ...xs.filter((x) => x % 12 === 0), x1])];
  return el('figure', { class: 'fin-chart', style: { margin: 0 } }, [
    svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, width: '100%' }, [
      ...ticks.map((t) => svg('g', {}, [
        svg('line', { x1: L, x2: W - R, y1: Y(t), y2: Y(t), stroke: 'var(--border)', 'stroke-width': 1 }),
        svg('text', { x: L - 6, y: Y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-dim)' }, [rand(t)]),
      ])),
      ...years.filter((x, i) => years.length < 14 || i % Math.ceil(years.length / 10) === 0).map((x) => svg('text', { x: X(x), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-dim)' }, [x % 12 === 0 ? `${x / 12}y` : `${x}m`])),
      ...series.map((s, i) => svg('polyline', {
        points: s.points.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' '),
        fill: 'none', stroke: colours[i % colours.length], 'stroke-width': 2.5, 'stroke-dasharray': s.dashed ? '6 4' : null,
      })),
    ]),
    el('figcaption', { class: 'row small', style: { gap: 'var(--space-3)' } }, series.map((s, i) => el('span', {}, [
      el('span', { class: 'fin-key', style: { background: colours[i % colours.length] } }), s.name,
    ]))),
  ]);
}

/* ------------------------------------------------ saving and comparing */

/**
 * Name it, save it, come back to it. A saved record keeps every input (defaults
 * included, so it can be rebuilt exactly) and the answer as it was that day.
 */
export function savedPanel(hub, { col, kind, d, summary, onOpen, compareScreen }) {
  const list = hub.use(`saved:${kind}`, async () => (await col.list({ limit: 1000, filter: (s) => s.kind === kind })).items
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))));
  const name = el('input', { class: 'input', id: `name-${kind}`, value: d.title, placeholder: 'Give it a name, e.g. Polo over 6 years', 'data-field': 'save-name', style: { flex: '1 1 220px' } });
  const ticked = new Set();
  const compareBtn = el('a', { class: 'btn', href: '#', 'data-field': 'compare', text: 'Compare', title: 'Tick two or more saved ones to compare them side by side', 'aria-disabled': 'true' });
  const tick = () => {
    compareBtn.setAttribute('aria-disabled', String(ticked.size < 2));
    compareBtn.href = ticked.size < 2 ? '#' : hub.href(compareScreen, [...ticked].join(','));
  };
  compareBtn.addEventListener('click', (e) => { if (ticked.size < 2) e.preventDefault(); });

  // Same name as the one opened: update it. A new name: a new saved one, the old kept as it was.
  const save = async () => {
    const title = name.value.trim() || 'Untitled';
    const same = d.savedId && title === d.title;
    const saved = await saveRecord(hub, col, { ...(same ? { id: d.savedId } : {}), kind, title, values: { ...d.values }, result: summary(), savedAt: new Date().toISOString() });
    d.savedId = saved?.id ?? d.savedId;
    d.title = title;
    hub.ui.notice(`Saved "${title}".`);
  };

  const items = list.data ?? [];
  return el('div', { class: 'panel stack', 'data-field': 'saved-panel' }, [
    el('h2', { text: 'Save and compare', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Save this with a name - a car, a house, an offer - and come back to it any time. Tick two or more to compare them.' }),
    el('div', { class: 'row' }, [
      el('label', { class: 'sr-only', for: `name-${kind}`, text: 'Name' }), name,
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', title: 'Saved under a new name, it is kept as a new one', 'data-field': 'save', on: { click: save } }),
    ]),
    list.loading ? el('p', { class: 'small muted', text: 'Loading…' }) : items.length ? el('ul', { class: 'list' }, items.map((s) => el('li', {}, [
      el('input', { type: 'checkbox', 'aria-label': `Compare ${s.title}`, 'data-field': `tick:${s.id}`, on: { change: (e) => { if (e.target.checked) ticked.add(s.id); else ticked.delete(s.id); tick(); } } }),
      el('div', { class: 'list__main' }, [el('strong', { text: s.title }), el('div', { class: 'small muted', text: [s.headline, s.savedAt ? `saved ${s.savedAt.slice(0, 10)}` : null].filter(Boolean).join(' · ') })]),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Open', 'aria-label': `Open ${s.title}`, 'data-field': `open:${s.id}`, on: { click: async () => onOpen(await col.get(s.id)) } }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${s.title}`, on: { click: async () => {
        if (!(await confirmAction({ title: `Remove "${s.title}"?`, text: 'The saved calculation is deleted. This cannot be undone.', confirmLabel: 'Remove', danger: true }))) return;
        await col.remove(s.id); if (d.savedId === s.id) d.savedId = null; hub.invalidate();
      } } }),
    ]))) : el('p', { class: 'small muted', style: { margin: 0 }, text: 'Nothing saved yet.' }),
    items.length > 1 ? el('div', { class: 'row' }, [compareBtn]) : null,
  ]);
}

/**
 * Side by side: one column per saved item, the difference from the first, and
 * the biggest differences said in words. rows: [{ label, get(out), lower: true|false|null }].
 */
export function compareTable(items, rows, { unitNote } = {}) {
  const first = items[0];
  const diff = (r, it) => {
    if (it === first) return null;
    const a = r.get(first.out); const b = r.get(it.out);
    if (typeof a !== 'number' || typeof b !== 'number') return null;
    return b - a;
  };
  const words = rows.filter((r) => r.lower != null && r.key).map((r) => items.slice(1).map((it) => ({ r, it, d: diff(r, it) }))).flat()
    .filter((x) => x.d && Math.abs(x.d) >= 1).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3)
    .map(({ r, it, d }) => `${it.title}: ${rand(Math.abs(d))} ${d > 0 ? 'more' : 'less'} ${r.label.toLowerCase()} than ${first.title}.`);
  return el('div', { class: 'stack' }, [
    el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-compare' }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: '' }), ...items.map((it) => el('th', { class: 'num', text: it.title }))])]),
      el('tbody', {}, rows.map((r) => el('tr', { class: r.total ? 'fin-sums__total' : null }, [
        el('td', { text: r.label }),
        ...items.map((it) => {
          const v = r.get(it.out); const dv = diff(r, it);
          return el('td', { class: 'num' }, [
            typeof v === 'number' ? rand(v) : (v ?? '-'),
            dv && Math.abs(dv) >= 1 && r.lower != null ? el('div', { class: `small ${(dv < 0) === r.lower ? 'fin-better' : 'fin-worse'}`, text: `${dv > 0 ? '+' : '−'}${rand(Math.abs(dv))}` }) : null,
          ]);
        }),
      ]))),
    ])]),
    words.length ? el('ul', { class: 'small', style: { margin: 0 } }, words.map((w) => el('li', { text: w }))) : null,
    unitNote ? el('p', { class: 'small muted', style: { margin: 0 }, text: unitNote }) : null,
  ]);
}
