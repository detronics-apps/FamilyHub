// Tracker screens (D-100): start a scenario for a child, log a time and values in a tap or two,
// see the timeline, a simple graph of the numbers and each day's totals, and copy a summary
// for the doctor. Health scenarios keep "if you are wondering whether to go, go".

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { recordForm, saveRecord } from '../kit.js';
import { GO_LINE } from './content.js';
import { KINDS, scenariosOf, normaliseScenario, normaliseTracker, running, nextDue, series, perDay, summary, localTime, parseField, fieldLine } from './tracking.js';

export const scenariosCol = (hub) => hub.data.collection('scenarios', { summary: (r) => normaliseScenario(r), prefix: 'sc' });
export const trackersCol = (hub) => hub.data.collection('trackers', { summary: (r) => normaliseTracker(r), prefix: 'tr' });

export async function loadTrack(hub) {
  const [s, t] = await Promise.all([scenariosCol(hub).list({ limit: 1000 }), trackersCol(hub).list({ limit: 100000 })]);
  return { scenarios: scenariosOf(s.items), trackers: t.items.map(normaliseTracker) };
}

const when = (at) => `${new Date(`${at.slice(0, 10)}T12:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })} ${at.slice(11, 16)}`;
const nameOf = (kids, id) => kids.find((k) => k.id === id)?.name ?? 'a child';
const show = (f, v) => (f.kind === 'yesno' ? (v === true || v === 'yes' ? 'yes' : 'no') : `${v}${f.kind === 'number' && f.unit ? ` ${f.unit}` : ''}`);

/** The door's line: the next reading due, or how many are running. */
export function trackNote(tr, kids, now = localTime()) {
  const on = tr.trackers.filter((t) => running(t, now));
  const due = on.map((t) => ({ t, at: nextDue(t) })).filter((x) => x.at).sort((a, b) => a.at.localeCompare(b.at))[0];
  if (due) return `${tr.scenarios.find((s) => s.scenarioId === due.t.scenarioId)?.name ?? 'Tracker'} (${nameOf(kids, due.t.kidId)}): next ${due.at <= now ? 'due now' : `at ${due.at.slice(11, 16)}`}`;
  return on.length ? `${on.length} running` : null;
}

// Starting a tracker: the scenario and the child, kept while choosing.
const start = { scenario: null, kid: null };

export function trackHome(hub, tr, kids) {
  const now = localTime();
  const on = tr.trackers.filter((t) => running(t, now));
  const done = tr.trackers.filter((t) => !running(t, now)).slice(-20).reverse();
  if (!start.kid && kids.length === 1) start.kid = kids[0].id;
  const scen = (id) => tr.scenarios.find((s) => s.scenarioId === id);
  const row = (t) => { const s = scen(t.scenarioId); const due = nextDue(t); return el('li', {}, [el('a', { class: 'list__main', href: hub.href('tracker', t.trackerId), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `tracker:${t.trackerId}` }, [
    el('strong', { text: `${s?.name ?? 'Tracker'} - ${nameOf(kids, t.kidId)}` }),
    el('div', { class: `small ${due && due <= now ? 'fin-worse' : 'muted'}`, text: [`${t.entries.length} logged`, t.entries.length ? `last ${when(t.entries.at(-1).at)}` : null, due ? (due <= now ? 'next reading due now' : `next at ${due.slice(11, 16)}`) : null, t.stopped ? `stopped ${when(t.stopped)}` : null].filter(Boolean).join(' · ') }),
  ])]); };
  const chip = (label, value, key, field) => el('button', { class: 'chip', type: 'button', text: label, 'aria-pressed': String(start[key] === value), 'data-field': field, style: { padding: '10px 16px' }, on: { click: () => { start[key] = value; hub.render(); } } });
  const go = async () => {
    const s = scen(start.scenario);
    if (!s || !start.kid) return;
    const trackerId = `trk-${Date.now().toString(36)}`;
    const saved = await saveRecord(hub, trackersCol(hub), normaliseTracker({ id: `tr_${trackerId}`, trackerId, scenarioId: s.scenarioId, kidId: start.kid, started: now, remindEvery: s.remindEvery, entries: [] }));
    if (saved) { start.scenario = null; hub.go('tracker', trackerId); }
  };
  return el('section', { class: 'stack', 'aria-label': 'Track' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Parenting' }),
    el('h1', { text: 'Track', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'When something worries you, track it for a few days - a time and a value each time - so the facts are there when you see the doctor.' }),
    on.length ? el('div', { class: 'panel stack', 'data-field': 'trk-on' }, [el('h2', { text: 'Running', style: { margin: 0 } }), el('ul', { class: 'list' }, on.map(row))]) : null,
    el('div', { class: 'panel stack', 'data-field': 'trk-start' }, [
      el('h2', { text: 'Start tracking', style: { margin: 0 } }),
      el('div', { class: 'chipset', role: 'group', 'aria-label': 'What to track' }, tr.scenarios.map((s) => chip(s.name, s.scenarioId, 'scenario', `trk-scen:${s.scenarioId}`))),
      kids.length > 1 ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'Who' }, kids.map((k) => chip(k.name, k.id, 'kid', `trk-kid:${k.id}`))) : null,
      !kids.length ? el('p', { class: 'small muted', text: 'Add the children on the People page first.' }) : null,
      el('div', { class: 'row' }, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Start', disabled: !start.scenario || !start.kid, 'data-field': 'trk-go', on: { click: go } }),
        el('a', { class: 'btn btn-quiet', href: hub.href('scenario-new'), text: 'Our own', title: 'A tracker of our own, with the things we want to track' })]),
    ]),
    done.length ? el('details', { class: 'panel more' }, [el('summary', { text: `Earlier (${done.length})` }), el('ul', { class: 'list' }, done.map(row))]) : null,
  ]);
}

/** A small graph of one number over time, with the times at either end. */
function graph(points, unit) {
  if (points.length < 2) return null;
  const W = 320; const H = 120; const P = 28;
  const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs) || 1; const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.15 || 0.5;
  const X = (x) => P + ((x - x0) / (x1 - x0 || 1)) * (W - P - 8); const Y = (y) => 8 + (1 - (y - (y0 - pad)) / ((y1 + pad) - (y0 - pad))) * (H - 24);
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, a, kids = []) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); n.append(...kids); return n; };
  return mk('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Over time: from ${ys[0]} to ${ys.at(-1)}${unit ? ` ${unit}` : ''}, highest ${y1}`, style: 'width: 100%; max-width: 480px' }, [
    mk('polyline', { points: points.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' '), fill: 'none', stroke: 'var(--accent-strong)', 'stroke-width': 2 }),
    ...points.map(([x, y]) => mk('circle', { cx: X(x), cy: Y(y), r: 3, fill: 'var(--accent-strong)' })),
    mk('text', { x: 2, y: Y(y1) + 4, 'font-size': 10, fill: 'var(--text-dim)' }, [String(y1)]),
    mk('text', { x: 2, y: Y(y0) + 4, 'font-size': 10, fill: 'var(--text-dim)' }, [String(y0)]),
  ]);
}

export function trackerScreen(hub, tr, id, kids) {
  const t = tr.trackers.find((x) => x.trackerId === id);
  if (!t) return el('div', { class: 'panel empty' }, [el('p', { text: 'This tracker was removed.' }), el('a', { class: 'btn', href: hub.href('track'), text: 'Track' })]);
  const s = tr.scenarios.find((x) => x.scenarioId === t.scenarioId) ?? normaliseScenario({ name: 'Tracker', fields: [] });
  const kid = nameOf(kids, t.kidId);
  const now = localTime();
  const due = running(t, now) ? nextDue(t) : null;
  const put = (next) => saveRecord(hub, trackersCol(hub), normaliseTracker({ ...t, id: `tr_${t.trackerId}`, ...next }));
  // The log: each field, and the time (now unless changed).
  const inputs = {};
  const control = (f) => {
    if (f.kind === 'number') { const i = el('input', { class: 'input', type: 'number', step: 'any', inputmode: 'decimal', style: { maxWidth: '140px' }, 'data-field': `trk-in:${f.id}`, 'aria-label': f.name }); inputs[f.id] = () => (i.value === '' ? null : Number(i.value)); return i; }
    if (f.kind === 'yesno' || f.kind === 'choice') {
      let v = null; const opts = f.kind === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : (f.options ?? []).map((o) => [o, o]);
      const box = el('div', { class: 'chipset', role: 'group', 'aria-label': f.name }, opts.map(([val, label]) => el('button', { class: 'chip', type: 'button', text: label, 'aria-pressed': 'false', 'data-field': `trk-in:${f.id}:${val}`,
        on: { click: (e) => { v = v === val ? null : val; for (const b of box.children) b.setAttribute('aria-pressed', String(b === e.target && v != null)); } } })));
      inputs[f.id] = () => (f.kind === 'yesno' ? (v == null ? null : v === 'yes') : v); return box;
    }
    const i = el('input', { class: 'input', 'data-field': `trk-in:${f.id}`, 'aria-label': f.name }); inputs[f.id] = () => i.value.trim() || null; return i;
  };
  const at = el('input', { class: 'input', type: 'datetime-local', value: now, style: { maxWidth: '230px' }, 'aria-label': 'When', 'data-field': 'trk-at' });
  const log = async () => {
    const values = Object.fromEntries(Object.entries(inputs).map(([k, g]) => [k, g()]).filter(([, v]) => v !== null && v !== ''));
    if (!Object.keys(values).length) { hub.ui.notice('Nothing to log yet - fill in at least one.'); return; }
    if (await put({ entries: [...t.entries, { at: (at.value || now).slice(0, 16), values, by: hub.people.current()?.id ?? null }] })) hub.ui.notice('Logged.');
  };
  const days = perDay(t, s.fields);
  const text = summary(t, s, kid);
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('track'), class: 'small', text: '‹ Track' }),
    el('h1', { text: `${s.name} - ${kid}`, style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `Started ${when(t.started)}${t.stopped ? ` · stopped ${when(t.stopped)}` : ''}${t.remindEvery ? ` · a reading every ${t.remindEvery >= 60 ? `${t.remindEvery / 60} h` : `${t.remindEvery} min`}` : ''}` }),
    s.health ? el('p', { class: 'panel', style: { margin: 0, fontWeight: 600 }, text: GO_LINE }) : null,
    due ? el('p', { class: due <= now ? 'fin-worse' : 'small', style: { margin: 0, fontWeight: due <= now ? 600 : 400 }, 'data-field': 'trk-due', text: due <= now ? 'The next reading is due now.' : `Next reading at ${due.slice(11, 16)}.` }) : null,
    running(t, now) ? el('div', { class: 'panel stack', 'data-field': 'trk-log' }, [el('h2', { text: 'Log', style: { margin: 0 } }),
      ...s.fields.map((f) => el('div', { class: 'stack', style: { gap: '4px' } }, [el('strong', { text: `${f.name}${f.kind === 'number' && f.unit ? ` (${f.unit})` : ''}` }), control(f)])),
      el('label', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'small muted', text: 'When (now, unless you change it)' }), at]),
      el('div', {}, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Log', 'data-field': 'trk-save', on: { click: log } })])]) : null,
    ...s.fields.filter((f) => f.kind === 'number').map((f) => { const g = graph(series(t, f.id), f.unit); return g ? el('div', { class: 'panel stack', 'data-field': `trk-graph:${f.id}` }, [el('h2', { text: f.name, style: { margin: 0 } }), g]) : null; }),
    days.length ? el('div', { class: 'panel stack', 'data-field': 'trk-days' }, [el('h2', { text: 'Each day', style: { margin: 0 } }),
      el('ul', { class: 'list' }, days.slice().reverse().map((d) => el('li', {}, [el('strong', { text: `${when(`${d.day}T12:00`).slice(0, -6)} · ${d.entries} logged` }), el('div', { class: 'small', text: d.parts.join(' · ') })])))]) : null,
    t.entries.length ? el('div', { class: 'panel stack', 'data-field': 'trk-timeline' }, [el('h2', { text: 'Every entry', style: { margin: 0 } }),
      el('ul', { class: 'list' }, t.entries.slice().reverse().map((e) => el('li', {}, [el('span', { class: 'list__main' }, [el('strong', { text: when(e.at) }), ' ', s.fields.filter((f) => e.values[f.id] !== undefined).map((f) => `${f.name}: ${show(f, e.values[f.id])}`).join(' · ')])])))]) : null,
    el('div', { class: 'panel stack', 'data-field': 'trk-summary' }, [el('h2', { text: 'For the doctor', style: { margin: 0 } }),
      el('pre', { class: 'small', style: { whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }, text }),
      el('div', {}, [el('button', { class: 'btn', type: 'button', text: 'Copy', on: { click: async () => { try { await navigator.clipboard.writeText(text); hub.ui.notice('Copied.'); } catch { hub.ui.notice('Could not copy - select the text instead.'); } } } })])]),
    s.health ? el('p', { class: 'small', style: { margin: 0 } }, [GO_LINE, s.topicId ? [' ', el('a', { href: hub.href('topic', s.topicId), text: 'What to look out for' })] : null].flat().filter(Boolean)) : null,
    el('div', { class: 'row' }, [
      running(t, now) ? el('button', { class: 'btn', type: 'button', text: 'Stop', 'data-field': 'trk-stop', on: { click: () => put({ stopped: now }) } }) : el('button', { class: 'btn', type: 'button', text: 'Restart', on: { click: () => put({ stopped: null, days: null }) } }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove this ${s.name.toLowerCase()} tracker?`, text: 'Everything logged in it goes. Copy the summary first if you need it.', confirmLabel: 'Remove', danger: true })) return;
        await trackersCol(hub).remove(`tr_${t.trackerId}`); hub.invalidate(); hub.go('track');
      } } }),
    ]),
  ]);
}

export function scenarioEdit(hub, tr, id) {
  const s = id ? tr.scenarios.find((x) => x.scenarioId === id) : null;
  return el('section', { class: 'stack' }, [
    el('h1', { text: s ? `Edit ${s.name}` : 'Our own tracker' }),
    recordForm({
      record: s ? { name: s.name, fields: s.fields.map(fieldLine), remindEvery: s.remindEvery } : { remindEvery: null },
      fields: [
        { key: 'name', label: 'What it tracks', required: true, placeholder: 'e.g. Earache' },
        { key: 'fields', label: 'What to log each time', type: 'lines', rows: 5, hint: `One per line: "Temperature: number °C", "Pulling at ear: yes/no", "Pain: choice None, Some, A lot", "Note: note". Kinds: ${Object.values(KINDS).join(', ').toLowerCase()}.` },
        { key: 'remindEvery', label: 'A reading every (minutes)', type: 'number', hint: 'Empty for no reminder. Shown in the app while it is open.' },
      ],
      onCancel: () => hub.go('track'),
      onSave: async (v) => {
        const scenarioId = s?.scenarioId ?? `scn-${Date.now().toString(36)}`;
        const fields = v.fields.map(parseField).map((f, i) => ({ ...f, id: s?.fields.find((x) => x.name === f.name)?.id ?? f.id ?? `f${i}` }));
        if (await saveRecord(hub, scenariosCol(hub), normaliseScenario({ ...(s ?? { own: true }), id: `sc_${scenarioId}`, scenarioId, name: v.name, fields, remindEvery: v.remindEvery }))) { hub.ui.notice('Saved.'); hub.go('track'); }
      },
    }),
  ]);
}
