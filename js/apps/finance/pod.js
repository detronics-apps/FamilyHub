// The shared shape of every Finance calculator (D-066), so they read as one system:
// a Simple / Advanced / Learn bar, inputs that say where each default came from,
// answers that update as you type, and anything saved under a name to compare later.
// UI only - the arithmetic lives in maths.js (pure, tested).

import { el, svg, download } from '../../ui/dom.js';
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
const ZAR_CENTS = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Rands, rounded to the rand for reading (small amounts like R4.95 a km keep their cents); the sums underneath are never rounded. */
export const rand = (n) => (n == null || !Number.isFinite(n) ? '-' : Math.abs(n) < 100 && Math.round(n) !== n ? ZAR_CENTS.format(n) : ZAR.format(Math.round(n) || 0));
export const pct = (n, dp = 2) => `${Number(n.toFixed(dp))}%`;
export const months = (m) => (m % 12 === 0 ? `${m / 12} year${m === 12 ? '' : 's'}` : m < 12 ? `${m} month${m === 1 ? '' : 's'}` : `${Math.floor(m / 12)} year${m < 24 ? '' : 's'} ${m % 12} month${m % 12 === 1 ? '' : 's'}`);

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
  drafts.set(key, { values: { ...defaults, ...record.values }, mine: new Set(Object.keys(record.values)), savedId: record.id, savedKind: record.kind, title: record.title });
}

/** Where a value came from, in words. */
function origin(f, d) {
  if (d.mine.has(f.key)) return 'Yours';
  const empty = d.values[f.key] === null || d.values[f.key] === undefined || d.values[f.key] === '';
  // Empty is not always "left out": some are worked out until you type your own (D-084).
  if (empty && f.fallback) return f.fallbackLabel ?? 'Default';
  if (empty && f.estimate) return 'Estimated - type yours to replace it';
  if (empty && f.optional) return 'Not counted';
  const s = f.source;
  if (!s) return null;
  if (s.ref) return `${s.ref.label}, ${s.ref.source}${s.note ? ` ${s.note}` : ''}`;
  if (s.kind === 'reference') return s.text;
  return { illustrative: 'Illustrative - check your own', assumption: 'Assumption' }[s.kind] ?? s.text;
}

/**
 * One input. Types: money, percent, number, years, choice (chips), check.
 * Typing updates the answer straight away (`onInput`) without redrawing the inputs.
 */
/**
 * The (i) beside a heading or a figure (D-078): tap it to see what it is, where to find
 * your own, and how to get the latest. Returns [button, the text box]; the box sits under
 * the label and opens and closes in place.
 */
export function info(text, label = 'this') {
  if (!text) return [null, null];
  const box = el('div', { class: 'info-box', hidden: true, role: 'note', text });
  const btn = el('button', { class: 'info-btn', type: 'button', 'aria-expanded': 'false', 'aria-label': `About ${label}`, title: `About ${label}`, text: 'i',
    on: { click: (e) => { e.preventDefault(); e.stopPropagation(); box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden)); } } });
  return [btn, box];
}

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
  } else if (f.type === 'month') {
    control = el('input', { class: 'input', id, type: 'month', value: d.values[f.key] ?? f.fallback?.() ?? '', 'data-field': `in:${f.key}`, style: { maxWidth: '200px' }, on: { change: (e) => set(e.target.value || null) } });
  } else if (f.type === 'text') {
    control = el('textarea', { class: 'input', id, rows: 3, text: d.values[f.key] ?? '', placeholder: f.placeholder ?? '', 'data-field': `in:${f.key}`, on: { input: (e) => set(e.target.value) } });
  } else if (f.type === 'check') {
    control = el('input', { type: 'checkbox', id, checked: !!d.values[f.key], on: { change: (e) => set(e.target.checked) } });
    const [ib, ix] = info(f.info, f.label);
    return el('div', {}, [el('label', { class: 'checkline' }, [control, el('span', {}, [f.label, ' ', tag, ib])]), ix]);
  } else {
    control = el('input', {
      class: 'input', id, type: 'number', inputmode: 'decimal', step: 'any', min: f.min === null ? null : f.min ?? '0', value: d.values[f.key] ?? '',
      placeholder: f.placeholder ?? (f.estimate ? 'estimate' : f.optional ? 'not counted' : ''), 'data-field': `in:${f.key}`, style: { maxWidth: '200px' },
      on: { input: (e) => set(e.target.value === '' ? null : Number(e.target.value)) },
    });
  }
  const unit = f.unitText ?? { money: 'R', percent: '% a year', years: 'years', months: 'months', km: 'km a year', kmOne: 'km', minutes: 'minutes' }[f.type];
  const [ib, ix] = info(f.info, f.label);
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: f.type === 'choice' ? null : id }, [f.label, ' ', tag, ib]),
    ix,
    el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [unit === 'R' ? el('span', { class: 'muted', text: 'R' }) : null, control, unit && unit !== 'R' ? el('span', { class: 'small muted', text: unit }) : null]),
    f.hint ? el('div', { class: 'field__hint', text: f.hint }) : null,
  ]);
}

/**
 * The inputs this level shows, grouped under headings. `when(values)` hides a
 * field that does not apply (a rent with "Buy" chosen).
 */
export function inputsPanel(fields, d, groups, onChange) {
  const visible = fields.filter((f) => shows(f.level) && (!f.when || f.when(d.values)));
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'What we need', style: { margin: 0 } }),
    ...[...new Set(visible.map((f) => f.group))].map((g) => {
      const nodes = visible.filter((f) => f.group === g).map((f) => input(f, d, onChange));
      const gt = typeof groups[g] === 'string' ? { title: groups[g] } : groups[g];
      const [ib, ix] = info(gt?.info, gt?.title);
      // A group with `tick` can be left out of the answer: its fields hide, and it counts nothing.
      const on = !gt?.tick || d.values.on?.[gt.tick] !== false;
      const tick = gt?.tick ? el('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), 'data-field': `tick:${gt.tick}`, text: on ? 'Counted' : 'Left out', style: { marginLeft: '8px' },
        title: on ? 'Counted in the answer - tap to leave it out' : 'Left out of the answer - tap to count it',
        on: { click: () => { d.values.on = { ...(d.values.on ?? {}), [gt.tick]: !on }; d.mine.add('on'); onChange('on'); } } }) : null;
      return gt ? el('fieldset', { class: `stack fin-group${on ? '' : ' fin-group--off'}` }, [el('legend', {}, [gt.title, ' ', ib, tick]), ix, ...(on ? nodes : [])]) : el('div', { class: 'stack' }, nodes);
    }),
  ]);
}

/** The defaults quietly in use in Simple, listed so nothing is hidden. */
export function assumed(fields, d) {
  const hidden = fields.filter((f) => f.level !== 'simple' && !f.optional && (!f.when || f.when(d.values)) && origin(f, d) && origin(f, d) !== 'Yours');
  if (!hidden.length) return null;
  return el('p', { class: 'small muted', 'data-field': 'assumed' }, [
    el('strong', { text: 'Also counted: ' }),
    hidden.map((f) => `${f.label.toLowerCase()} ${f.type === 'money' ? rand(d.values[f.key] ?? (typeof f.estimate === 'function' ? f.estimate(d.values) : null)) : f.type === 'percent' ? pct(d.values[f.key]) : f.type === 'check' ? (d.values[f.key] ? 'yes' : 'no') : `${d.values[f.key]}${{ months: ' months', years: ' years' }[f.type] ?? ''}`} (${origin(f, d)})`).join('; '),
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
 * Where a line crosses zero, or where one line crosses another (a - b), first time:
 * the x between two points, found by straight-line interpolation. Null if it never does.
 */
export function crossing(points, other = null) {
  const d = other ? points.map(([x, y], i) => [x, y - (other[i]?.[1] ?? 0)]) : points;
  for (let i = 1; i < d.length; i += 1) {
    const [xa, ya] = d[i - 1]; const [xb, yb] = d[i];
    if (ya === 0) return xa;
    if (Math.sign(ya) !== Math.sign(yb) && yb !== 0) return xa + ((xb - xa) * ya) / (ya - yb);
  }
  return null;
}

/** Short amounts for a chart's axis: R24.5m, R850k, −R216k, R900. */
export const short = (n) => { const a = Math.abs(n); const s = n < 0 ? '−' : ''; return a >= 1e6 ? `${s}R${Number((a / 1e6).toFixed(a >= 1e7 ? 0 : 1))}m` : a >= 1e3 ? `${s}R${Math.round(a / 1e3)}k` : `${s}R${Math.round(a)}`; };

/** "in year 7" / "after 8 months" for a month count on a chart. */
export const whenLabel = (m) => (m >= 12 ? `year ${Math.ceil(m / 12)}` : `month ${Math.max(1, Math.ceil(m))}`);

/**
 * Lines over time, telling one story. series: [{ name, points: [[x, y]], dashed }], x in
 * months. marks: [{ x, label }] - break-even points and other moments, drawn as labelled
 * upright lines. A zero line is drawn whenever the lines go below zero. `story` is one
 * sentence under the chart saying what to look at. Colours come from the theme.
 */
/** A graph that also keeps its numbers, so CSV export can write them out (D-083). */
export function lineChart(series, opts) {
  const box = el('div', { class: 'stack', style: { gap: 'var(--space-1)' } });
  box.dataset.chart = '';
  // A shaded range goes to CSV as its two edges - always the whole timeline, zoomed or not.
  const edges = opts.band ? [{ name: `${opts.band.name} - low edge`, points: opts.band.points.map(([x, lo]) => [x, lo]) }, { name: `${opts.band.name} - high edge`, points: opts.band.points.map(([x, , hi]) => [x, hi]) }] : [];
  box.chartData = { label: opts.label, series: [...series, ...edges], xLabel: opts.xLabel ?? null };
  const xs = series.flatMap((s) => s.points.map((p) => p[0]));
  const lo = Math.min(...xs); const hi = Math.max(...xs);
  if (!(hi - lo > ZOOM + 12)) { box.append(drawChart(series, opts)); return box; }
  // Zoom (D-088): five years at a time, opening on the two before today and three after, a year back or on.
  const today = (opts.marks ?? []).find((m) => m && m.label === 'Today')?.x;
  const clamp = (x) => Math.max(lo, Math.min(hi - ZOOM, x));
  const year = (x) => (opts.xLabel ? opts.xLabel(x) : `Year ${Math.round(x / 12)}`);
  const draw = () => {
    const from = zooms.get(opts.label) ?? null;
    const cut = (p) => (from == null ? p : p.filter(([x]) => x >= from && x <= from + ZOOM));
    const set = (x) => { zooms.set(opts.label, x == null ? null : clamp(x)); draw(); };
    const btn = (text, label, to, off = false) => el('button', { class: 'btn btn-small btn-quiet', type: 'button', text, 'aria-label': label, disabled: off, on: { click: () => set(to) } });
    box.replaceChildren(
      el('div', { class: 'row small', style: { gap: 'var(--space-2)', alignItems: 'center', justifyContent: 'flex-end' }, 'data-field': 'zoom' }, [
        el('div', { class: 'chipset', role: 'group', 'aria-label': 'How much of the timeline' }, [
          el('button', { class: 'chip', type: 'button', text: '5 years', 'aria-pressed': String(from != null), on: { click: () => set(from ?? (today != null ? today - 24 : lo)) } }),
          el('button', { class: 'chip', type: 'button', text: 'All', 'aria-pressed': String(from == null), on: { click: () => set(null) } }),
        ]),
        from != null ? btn('‹', 'A year earlier', from - 12, from <= lo) : null,
        from != null ? el('span', { class: 'muted', text: `${year(from)} to ${year(from + ZOOM)}` }) : null,
        from != null ? btn('›', 'A year later', from + 12, from >= hi - ZOOM) : null,
      ]),
      drawChart(series.map((s) => ({ ...s, points: cut(s.points) })), { ...opts, band: opts.band ? { ...opts.band, points: cut(opts.band.points) } : null }),
    );
  };
  draw();
  return box;
}
const ZOOM = 60;          // months shown when zoomed in
const zooms = new Map();  // graph label -> first month shown (null: all), kept while the app is open

// Axis steps that read easily: 1, 2, 2.5 or 5 times a power of ten.
function niceStep(span, n = 4) {
  const raw = span / n || 1; const pow = 10 ** Math.floor(Math.log10(raw)); const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/**
 * Options (D-086): `stack` piles the series into areas that add up; `zones` names what
 * above and below zero mean; `dots` [{ x, y, label }] write a value on the graph;
 * `yLines` [{ y, label }] are dotted levels (30% of income); each line's name and last
 * value sit at its end. Tapping or moving over the graph reads every series at that point.
 */
function drawChart(series, { label, marks = [], story = null, xLabel = null, band = null, stack = false, zones = null, dots = [], yLines = [] }) {
  // Drawn narrower on a phone, so the writing stays readable when it is scaled to fit.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 560;
  const W = narrow ? 340 : 640; const H = narrow ? 230 : 260; const L = 48; const B = 26; const T = 16; const R = narrow ? 80 : 118;
  const colours = ['var(--accent-strong)', 'var(--warn)', 'var(--ok)', 'var(--text-dim)'];
  const colourOf = (s, i) => s.colour ?? colours[i % colours.length];
  // Stacked: each series sits on the ones before it - except one marked `over`, a line drawn on top (the rent instead).
  const piled = (s) => stack && !s.over;
  const drawn = series.map((s, i) => (!piled(s) ? s : { ...s, points: s.points.map(([x], j) => [x, series.slice(0, i + 1).filter(piled).reduce((t, o) => t + (o.points[j]?.[1] ?? 0), 0)]) }));
  const below = (i) => drawn.slice(0, i).filter((s, k) => piled(series[k])).at(-1);
  const xs = drawn.flatMap((s) => s.points.map((p) => p[0]));
  const ys = [...drawn.flatMap((s) => s.points.map((p) => p[1])), ...(band ? band.points.flatMap((p) => [p[1], p[2]]) : []), ...dots.filter(Boolean).map((d) => d.y), ...yLines.filter(Boolean).map((l) => l.y)].filter(Number.isFinite);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs) || 1;
  const step = niceStep(Math.max(0, ...ys) - Math.min(0, ...ys));
  const y0 = Math.floor(Math.min(0, ...ys) / step) * step; const y1 = Math.ceil(Math.max(0, ...ys) / step) * step || step;
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  const ticks = []; for (let t = y0; t <= y1 + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
  const grid = []; for (let x = Math.ceil(x0 / 12) * 12; x <= x1; x += 12) grid.push(x);
  const years = grid.length > 1 ? grid : [x0, x1];
  const shown = marks.filter((m) => m && Number.isFinite(m.x) && m.x >= x0 && m.x <= x1);
  const pts = (p) => p.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  // Each line's name and last value at its end, nudged apart so none overlap.
  const ends = drawn.map((s, i) => {
    const last = s.points.at(-1); if (!last) return null;
    const mid = piled(series[i]) ? (last[1] + (below(i)?.points.at(-1)[1] ?? 0)) / 2 : last[1];
    return { i, y: Y(mid), name: s.name, value: series[i].points.at(-1)[1], colour: colourOf(s, i) };
  }).filter(Boolean).sort((p, q) => p.y - q.y);
  for (let k = 1; k < ends.length; k += 1) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 26);
  const cut = (t, n = narrow ? 13 : 18) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const cursor = svg('line', { x1: -10, x2: -10, y1: T, y2: H - B, stroke: 'var(--text-dim)', 'stroke-width': 1 });
  const readout = el('div', { class: 'small muted fin-read', 'aria-live': 'polite', text: 'Tap or move over the graph to read it.' });
  const when = (x) => (xLabel ? xLabel(x) : x % 12 === 0 ? `After ${x / 12} year${x === 12 ? '' : 's'}` : `After ${x} months`);
  const near = (p, x) => p.reduce((best, q) => (Math.abs(q[0] - x) < Math.abs(best[0] - x) ? q : best), p[0]);
  const read = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const x = near(series[0].points, x0 + ((px - L) / (W - L - R)) * (x1 - x0))[0];
    cursor.setAttribute('x1', X(x)); cursor.setAttribute('x2', X(x));
    const b = band ? near(band.points, x) : null;
    readout.classList.remove('muted');
    readout.textContent = `${when(x)}: ${series.map((s) => `${s.name} ${rand(near(s.points, x)[1])}`).join(' · ')}${stack ? ` · All of it ${rand(series.filter(piled).reduce((t, s) => t + near(s.points, x)[1], 0))}` : ''}${b ? ` · ${band.name}: ${rand(b[1])} to ${rand(b[2])}` : ''}`;
  };
  return el('figure', { class: 'fin-chart', style: { margin: 0 } }, [
    svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': [label, ...shown.map((m) => m.label), ...dots.filter(Boolean).map((d) => d.label)].join('. '), width: '100%', on: { pointermove: read, pointerdown: read } }, [
      ...ticks.map((t) => svg('g', {}, [
        svg('line', { x1: L, x2: W - R, y1: Y(t), y2: Y(t), stroke: t === 0 ? 'var(--text-dim)' : 'var(--border)', 'stroke-width': t === 0 ? 1.5 : 1 }),
        svg('text', { x: L - 6, y: Y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-dim)' }, [short(t)]),
      ])),
      ...years.filter((x, i) => years.length < 14 || i % Math.ceil(years.length / 10) === 0).map((x) => svg('text', { x: X(x), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-dim)' }, [xLabel ? xLabel(x) : `${x / 12}y`])),
      // The scenario range (D-084): shaded between its low and high edges, under the lines.
      band ? svg('polygon', { points: [...band.points.map(([x, lo]) => `${X(x).toFixed(1)},${Y(lo).toFixed(1)}`), ...band.points.slice().reverse().map(([x, , hi]) => `${X(x).toFixed(1)},${Y(hi).toFixed(1)}`)].join(' '), fill: 'var(--accent-soft)', stroke: 'none', opacity: 0.9 }) : null,
      ...drawn.map((s, i) => (piled(series[i]) ? svg('polygon', {
        points: [...s.points.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`), ...(below(i)?.points ?? s.points.map(([x]) => [x, 0])).slice().reverse().map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`)].join(' '),
        fill: colourOf(s, i), opacity: 0.45, stroke: 'none',
      }) : null)),
      ...drawn.map((s, i) => svg('polyline', { points: pts(s.points), fill: 'none', stroke: colourOf(s, i), 'stroke-width': piled(series[i]) ? 1.5 : 2.5, 'stroke-dasharray': s.dashed ? '6 4' : null })),
      // What above and below zero mean, in words, at the edges.
      zones && y1 > 0 ? svg('text', { x: L + 6, y: T + 12, 'font-size': 12, 'font-weight': 700, fill: 'var(--ok)' }, [`↑ ${zones.above}`]) : null,
      zones && y0 < 0 ? svg('text', { x: L + 6, y: H - B - 8, 'font-size': 12, 'font-weight': 700, fill: 'var(--warn)' }, [`↓ ${zones.below}`]) : null,
      ...yLines.filter((l) => l && Number.isFinite(l.y)).map((l) => svg('g', {}, [
        svg('line', { x1: L, x2: W - R, y1: Y(l.y), y2: Y(l.y), stroke: 'var(--text-dim)', 'stroke-dasharray': '2 3' }),
        svg('text', { x: L + 6, y: Y(l.y) - 4, 'font-size': 11, fill: 'var(--text-dim)' }, [l.label]),
      ])),
      ...shown.map((m, i) => {
        const x = X(m.x); const right = x > L + (W - L - R) * 0.6;
        return svg('g', {}, [
          svg('line', { x1: x, x2: x, y1: T, y2: H - B, stroke: 'var(--text)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
          svg('text', { x: right ? x - 5 : x + 5, y: T + 30 + (i % 3) * 14, 'text-anchor': right ? 'end' : 'start', 'font-size': 12, 'font-weight': 700, fill: 'var(--text)' }, [m.label]),
        ]);
      }),
      ...dots.filter((d) => d && Number.isFinite(d.x) && Number.isFinite(d.y) && d.x >= x0 && d.x <= x1).map((d) => svg('g', {}, [
        svg('circle', { cx: X(d.x), cy: Y(d.y), r: 5, fill: 'var(--accent-strong)', stroke: 'var(--panel)', 'stroke-width': 2 }),
        svg('text', { x: X(d.x) - 8, y: Y(d.y) + (d.below ? 18 : -10), 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700, fill: 'var(--text)' }, [d.label]),
      ])),
      ...ends.map((e) => svg('g', {}, [
        svg('text', { x: W - R + 8, y: e.y, 'font-size': 11, fill: 'var(--text)' }, [cut(e.name)]),
        svg('text', { x: W - R + 8, y: e.y + 12, 'font-size': 11, 'font-weight': 700, fill: e.colour }, [short(e.value)]),
      ])),
      cursor,
    ]),
    el('figcaption', { class: 'stack', style: { gap: 'var(--space-1)' } }, [
      readout,
      el('div', { class: 'row small', style: { gap: 'var(--space-3)' } }, [...series.map((s, i) => el('span', {}, [
        el('span', { class: 'fin-key', style: { background: colourOf(s, i) } }), s.name,
      ])), band ? el('span', {}, [el('span', { class: 'fin-key', style: { background: 'var(--accent-soft)', outline: '1px solid var(--border-strong)' } }), band.name]) : null]),
      story ? el('p', { class: 'small', style: { margin: 0 }, text: story }) : null,
    ]),
  ]);
}

/**
 * What moves the answer (D-086): one bar per assumption, longest first - worse to the
 * left of your answer, better to the right. rows: [{ label, low, high }], low and high
 * being how far each end of its range moves the answer, in rand.
 */
export function barsChart(rows, { label, worse = 'worse', better = 'better' }) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 560;
  const W = narrow ? 340 : 640; const L = narrow ? 100 : 150; const R = 12; const row = 32; const H = rows.length * row + 40;
  const m = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.low), Math.abs(r.high)]));
  const mid = L + (W - L - R) / 2; const X = (d) => mid + (d / m) * ((W - L - R) / 2 - (narrow ? 40 : 52));
  const bar = (d, y) => svg('rect', { x: Math.min(X(0), X(d)), y, width: Math.max(1, Math.abs(X(d) - X(0))), height: 16, rx: 3, fill: d < 0 ? 'var(--warn)' : 'var(--ok)', opacity: 0.8 });
  const val = (d, y) => svg('text', { x: X(d) + (d < 0 ? -4 : 4), y: y + 12, 'text-anchor': d < 0 ? 'end' : 'start', 'font-size': 11, fill: 'var(--text-dim)' }, [Math.abs(d) < 1000 ? 'hardly' : short(d)]);
  const figure = el('figure', { class: 'fin-chart', style: { margin: 0 } }, [
    svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${label}. ${rows.map((r) => `${r.label}: ${short(r.low)} to ${short(r.high)}`).join('. ')}`, width: '100%' }, [
      svg('text', { x: X(0) - 6, y: 12, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--warn)', 'font-weight': 700 }, [`← ${worse}`]),
      svg('text', { x: X(0) + 6, y: 12, 'font-size': 11, fill: 'var(--ok)', 'font-weight': 700 }, [`${better} →`]),
      ...rows.flatMap((r, i) => {
        const y = 24 + i * row;
        return [svg('text', { x: 4, y: y + 12, 'font-size': 12, fill: 'var(--text)' }, [narrow && r.label.length > 15 ? `${r.label.slice(0, 14)}…` : r.label]), bar(r.low, y), bar(r.high, y), val(r.low, y), val(r.high, y)];
      }),
      svg('line', { x1: X(0), x2: X(0), y1: 18, y2: H - 16, stroke: 'var(--text)', 'stroke-width': 1.5 }),
      svg('text', { x: X(0), y: H - 3, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-dim)' }, ['your answer']),
    ]),
  ]);
  figure.dataset.chart = '';
  figure.chartData = { label, series: [{ name: 'Lower end', points: rows.map((r, i) => [i + 1, r.low]) }, { name: 'Upper end', points: rows.map((r, i) => [i + 1, r.high]) }] };
  return figure;
}

export const RULE = 'Above zero: what grows your pocket. Below zero: what comes out of it.';
/** Turn amounts that leave your pocket into the minus side of a graph. */
export const outOf = (points) => points.map(([x, y]) => [x, -y]);

/** A chart with its own heading, as a panel - the graphs that tell the story. */
export const chartPanel = (title, ...charts) => el('div', { class: 'panel stack' }, [el('h2', { text: title, style: { margin: 0 } }), ...charts.filter(Boolean)]);

/** A list of lines: what happened on the bond, or the "what if" scenarios (ticked to count). */
export function linesPanel(d, refresh, key, kinds, title, help, tickable = false, uses = false) {
  const list = Array.isArray(d.values[key]) ? d.values[key] : (d.values[key] = []);
  const box = el('div', { class: 'stack' });
  const save = () => { d.mine.add(key); refresh(); };
  const draw = () => box.replaceChildren(...list.map((e, i) => el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' }, 'data-field': `${key}:${i}` }, [
    tickable ? el('input', { type: 'checkbox', checked: e.on !== false, 'aria-label': 'Count this what-if', on: { change: (x) => { e.on = x.target.checked; save(); } } }) : null,
    el('select', { class: 'select', 'aria-label': 'What happens', style: { width: 'auto' }, on: { change: (x) => { e.kind = x.target.value; draw(); save(); } } },
      Object.entries(kinds).map(([k, label]) => el('option', { value: k, text: label, selected: e.kind === k }))),
    el('span', { class: 'small muted', text: e.kind === 'pay' || e.kind === 'more' ? 'from' : 'in' }),
    el('input', { class: 'input', type: 'month', value: e.from ?? '', 'aria-label': 'From', style: { maxWidth: '170px' }, on: { change: (x) => { e.from = x.target.value || null; save(); } } }),
    e.kind === 'pay' || e.kind === 'more' ? el('span', { class: 'small muted', text: 'to' }) : null,
    e.kind === 'pay' || e.kind === 'more' ? el('input', { class: 'input', type: 'month', value: e.to ?? '', 'aria-label': 'To (empty: from then on)', style: { maxWidth: '170px' }, on: { change: (x) => { e.to = x.target.value || null; save(); } } }) : null,
    el('span', { class: 'small muted', text: e.kind === 'rate' ? 'new rate' : e.kind === 'more' ? 'R more a month' : e.kind === 'pay' ? 'R a month' : 'R' }),
    el('input', { class: 'input', type: 'number', min: '0', step: 'any', value: e.amount ?? '', 'aria-label': e.kind === 'rate' ? 'New rate, % a year' : 'Amount', style: { maxWidth: '130px' }, on: { change: (x) => { e.amount = Number(x.target.value) || 0; save(); } } }),
    e.kind === 'rate' ? el('span', { class: 'small muted', text: '%' }) : null,
    // Money taken out: invested, or spent and gone (D-087).
    uses && e.kind === 'withdraw' ? el('select', { class: 'select', 'aria-label': 'What the money taken out went to', style: { width: 'auto' }, 'data-field': `${key}:${i}:use`, on: { change: (x) => { e.use = x.target.value === 'spent' ? 'spent' : undefined; save(); } } },
      [['invested', 'Invested'], ['spent', 'Spent']].map(([k, label]) => el('option', { value: k, text: label, selected: (e.use === 'spent') === (k === 'spent') }))) : null,
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': 'Remove this line', on: { click: () => { list.splice(i, 1); draw(); save(); } } }),
    // A what-if on the home we own that is already past: what really happened goes in its own list.
    tickable && d.values.kind === 'own' && e.from && e.from < today ? el('span', { class: 'small muted', style: { flexBasis: '100%' }, text: 'Already past - if it really happened, put it under "What happened" instead, so it is not counted twice.' }) : null,
  ])));
  const today = new Date().toISOString().slice(0, 7);
  draw();
  const [ib, ix] = info(help, title);
  return el('section', { class: 'panel stack', 'data-field': `${key}-panel` }, [
    el('h2', { style: { margin: 0 } }, [title, ' ', ib]),
    ix,
    tickable ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'Ticked lines are counted; "What each one did" shows each one on its own.' }) : null,
    box,
    el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add line', 'data-field': `${key}-add`, on: { click: () => { list.push({ kind: tickable ? 'more' : 'pay', from: tickable ? today : d.values.bondStart ?? null, to: null, amount: null, on: true }); draw(); } } })]),
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
    const same = d.savedId && title === d.title && d.savedKind === kind;
    const saved = await saveRecord(hub, col, { ...(same ? { id: d.savedId } : {}), kind, title, values: { ...d.values }, result: summary(), savedAt: new Date().toISOString() });
    d.savedId = saved?.id ?? d.savedId;
    d.savedKind = kind;
    d.title = title;
    hub.ui.notice(`Saved "${title}".`);
  };

  const items = list.data ?? [];
  return el('div', { class: 'panel stack', 'data-field': 'saved-panel' }, [
    el('h2', { text: 'Save and compare', style: { margin: 0 } }),
    exportBar(() => name.value.trim() || d.title || kind),
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
/* ------------------------------------------------------------ export */

/**
 * Print (or save as PDF) and CSV for whatever Finance page it sits on (D-083).
 * Print: the page as it is, every folded section opened, without buttons or menus.
 * CSV: your figures, the results, every table, and every graph's numbers.
 */
export function exportBar(title) {
  const bar = el('div', { class: 'row no-print', 'data-field': 'export' }, []);
  const root = () => bar.closest('section') ?? document.querySelector('main');
  const name = () => (typeof title === 'function' ? title() : title) || 'Family Hub';
  bar.append(
    el('button', { class: 'btn btn-small', type: 'button', text: 'Print', title: 'Print, or choose "Save as PDF" - with every graph', 'data-field': 'export-print', on: { click: () => {
      const shut = [...root().querySelectorAll('details:not([open])')];
      shut.forEach((d) => { d.open = true; });
      window.addEventListener('afterprint', () => shut.forEach((d) => { d.open = false; }), { once: true });
      window.print();
    } } }),
    el('button', { class: 'btn btn-small', type: 'button', text: 'CSV', title: 'For Excel or Google Sheets: your figures, the results, the tables and each graph’s numbers', 'data-field': 'export-csv', on: { click: () => {
      const csv = pageCsv(root(), name());
      download(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `${name().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'finance'}.csv`);
    } } }),
  );
  return bar;
}

const clean = (t) => String(t ?? '').replace(/\(i\)|ⓘ/g, '').replace(/\s+/g, ' ').trim();
const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function pageCsv(root, title) {
  const rows = [[title], ['Made', new Date().toISOString().slice(0, 10)], []];
  const figures = [...root.querySelectorAll('label[for]')].map((l) => {
    const c = root.querySelector(`#${CSS.escape(l.htmlFor)}`);
    if (!c || c.offsetParent === null || c.type === 'checkbox' || c.type === 'radio') return null;
    const value = c.tagName === 'SELECT' ? c.selectedOptions[0]?.text : c.value;
    // The label's own words, without its "Yours" tag or (i) button.
    const words = [...l.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
    return value === '' || value == null ? null : [clean(words || l.textContent), value];
  }).filter(Boolean);
  if (figures.length) rows.push(['Your figures'], ...figures, []);
  const stats = [...root.querySelectorAll('.stat')].map((s) => [clean(s.querySelector('.stat__label')?.textContent), clean(s.querySelector('.stat__value')?.textContent)]);
  if (stats.length) rows.push(['Results'], ...stats, []);
  for (const t of root.querySelectorAll('table')) {
    rows.push([clean(t.closest('.panel')?.querySelector('h2, h3')?.textContent) || 'Table']);
    for (const tr of t.rows) rows.push([...tr.cells].map((c) => clean(c.childNodes[0]?.textContent ?? c.textContent)));
    rows.push([]);
  }
  for (const f of root.querySelectorAll('[data-chart]')) {
    const { label, series, xLabel } = f.chartData ?? {};
    if (!series) continue;
    const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b);
    rows.push([`Graph: ${label}`], [xLabel ? 'Year' : 'Month', ...series.map((s) => s.name)]);
    for (const x of xs) rows.push([xLabel ? `${xLabel(x)} (month ${x})` : x, ...series.map((s) => { const p = s.points.find((q) => q[0] === x); return p ? Math.round(p[1]) : ''; })]);
    rows.push([]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

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
    exportBar(`Compared - ${items.map((it) => it.title).join(', ')}`),
  ]);
}
