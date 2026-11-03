// Dates (D-102): pick a date that fits tonight - within your own childcare rule - plan one
// for a day, and score it afterwards, each of you. Screens: pick (default), ideas, one date,
// the form for your own.

import { el } from '../../ui/dom.js';
import { confirmAction, modal } from '../../ui/common.js';
import { loading, failure, recordForm, saveRecord } from '../kit.js';
import { sendHref } from '../shopping/logic.js';
import { linksControl, linksView } from '../../ui/links-editor.js';
import { kidsOf, adultsOf, careRule } from '../parenting/logic.js';
import { chooser, newChoice } from '../parenting/choose.js';
import { KIDS, WHERE, ENERGY, normaliseDate, datesOf, kidsAllowed, loved, pickDates, plannedDates, logDate, toBuy, costOf } from './logic.js';

const col = (hub) => hub.data.collection('dates', { summary: (r) => normaliseDate(r), text: (r) => r.name ?? '', prefix: 'dt' });
const load = (hub) => hub.use('all', async () => {
  const [d, dec] = await Promise.all([col(hub).list({ limit: 10000 }), hub.data.installed('decisions') ? hub.data.of('decisions', 'decisions').list({ limit: 100000 }) : { items: [] }]);
  return { dates: datesOf(d.items), decisions: dec.items };
});
const save = (hub, d) => saveRecord(hub, col(hub), normaliseDate({ ...d, id: `dt_${d.dateId}` }));
const rand = (x) => `R${Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);

/** The line under the home tile: the next planned date. */
export function tileNote(hub) {
  const r = load(hub);
  const next = r.data ? plannedDates(r.data.dates, hub.today())[0] : null;
  return next ? `Next: ${next.name}, ${next.plannedOn}` : null;
}

export function render(hub, route) {
  const r = load(hub);
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const rule = careRule(r.data.decisions, kidsOf(hub.people.list(), hub.today()));
  const list = r.data.dates.filter((d) => kidsAllowed(rule).includes(d.kids));   // never offered: outside your rule
  if (route.sub === 'ideas') return ideasScreen(hub, list);
  if (route.sub === 'date') return dateScreen(hub, list, route.rest[0]);
  if (route.sub === 'edit') return editScreen(hub, list, route.rest[0], rule);
  if (route.sub === 'new') return editScreen(hub, list, null, rule);
  return pickScreen(hub, list, rule);
}

function card(hub, d, big = false) {
  const fig = (value, label) => el('div', { class: 'panel', style: { padding: '8px 10px', margin: 0 } }, [el('div', { text: value, style: { fontSize: '1.3em', fontWeight: 700 } }), el('div', { class: 'small muted', text: label })]);
  return el('div', { class: 'panel stack', 'data-field': `date:${d.dateId}`, style: big ? { borderWidth: '2px' } : null }, [
    el('h2', { style: { margin: 0 } }, [el('a', { href: hub.href('date', d.dateId), text: d.name, style: { color: 'inherit' } })]),
    linksView(hub, d),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' } }, [fig(d.prep ? `${d.prep} min` : 'None', 'to get ready'), fig(mins(d.lasts), 'together'), fig(toBuy(d).length ? rand(costOf(d)) : 'Free', toBuy(d).length ? 'to spend' : 'with what we have')]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `${WHERE[d.where]} · ${KIDS[d.kids]} · ${ENERGY[d.energy]}${loved(d) != null ? ` · ${loved(d)}/5 so far` : ''}` }),
    d.needs.length ? el('p', { style: { margin: 0 } }, [el('strong', { text: 'You need: ' }), d.needs.map((x) => `${x.name}${x.have ? '' : ' (to buy)'}`).join(', ')]) : null,
    d.steps.length ? el('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, d.steps.map((s) => el('li', { text: s }))) : null,
    el('div', { class: 'row' }, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Done', 'data-field': `date-done:${d.dateId}`, on: { click: () => doneDialog(hub, d) } }),
      el('a', { class: 'btn', href: hub.href('date', d.dateId), text: 'Plan' })]),
  ]);
}

/** Each of you scores it, 1-5, and a note for next time. */
function doneDialog(hub, d) {
  const adults = adultsOf(hub.people.list(), hub.today());
  const picked = {};
  const scale = (p) => el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'small', text: p.name }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': p.name }, [1, 2, 3, 4, 5].map((n) => el('button', { class: 'chip', type: 'button', text: String(n), 'aria-pressed': 'false', 'data-field': `dscore:${p.id}:${n}`,
      on: { click: (e) => { picked[p.id] = n; for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target)); } } })))]);
  const note = el('textarea', { class: 'input', rows: 2, placeholder: 'Anything for next time? (optional)', 'aria-label': 'Note' });
  const { close } = modal({
    title: `How was ${d.name}?`, body: [el('p', { class: 'small muted', text: '1 = not again, 5 = again soon.' }), ...adults.map(scale), note],
    foot: [el('button', { class: 'btn', type: 'button', text: 'Skip', on: { click: () => close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'dscore-save', on: { click: async () => { close(); if (await save(hub, logDate(d, { day: hub.today(), scores: picked, note: note.value.trim() }))) hub.ui.notice('Saved.'); } } })],
  });
}

// Tonight's answers, kept while the app is open.
const ask = { kids: null, where: null, energy: null, free: false, maxMinutes: 180, ...newChoice() };

function pickScreen(hub, list, rule) {
  const today = hub.today();
  const chips = (label, opts, key) => el('div', { class: 'stack', style: { gap: '6px' } }, [el('strong', { text: label }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': label }, opts.map(([v, t]) => el('button', { class: 'chip', type: 'button', text: t, 'aria-pressed': String(ask[key] === v), 'data-field': `d-${key}:${v}`, style: { padding: '10px 16px' },
      on: { click: () => { ask[key] = ask[key] === v && key !== 'free' ? null : v; ask.chosen = null; ask.queue = null; hub.render(); } } })))]);
  const found = pickDates(list, { rule, kids: ask.kids, where: ask.where, energy: ask.energy, free: ask.free, maxMinutes: ask.maxMinutes });
  const c = chooser(hub, found, ask, { idOf: (d) => d.dateId, weightOf: loved, card: (d, big) => card(hub, d, big), prefix: 'date', label: 'Date', thisHelp: 'Take turns choosing.' });
  const soon = plannedDates(list, today);
  const out = el('strong', { text: mins(ask.maxMinutes) });
  return el('section', { class: 'stack', 'aria-label': 'Dates' }, [
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Time for the two of you. Pick one for tonight, or plan one for a day.' }),
    el('div', { class: 'row' }, [el('a', { class: 'btn', href: hub.href('ideas'), text: 'Ideas', 'data-field': 'd-ideas' }), el('a', { class: 'btn', href: hub.href('new'), text: 'Add', title: 'Add a date idea' })]),
    soon.length ? el('div', { class: 'panel stack', 'data-field': 'd-planned' }, [el('h2', { text: 'Planned', style: { margin: 0 } }),
      el('ul', { class: 'list' }, soon.map((d) => el('li', {}, [el('a', { href: hub.href('date', d.dateId), text: d.name }), el('span', { class: 'small muted', text: ` · ${d.plannedOn}` })])))]) : null,
    chips('The children', kidsAllowed(rule).map((k) => [k, KIDS[k]]), 'kids'),
    chips('Where', Object.entries(WHERE), 'where'),
    chips('Energy', [['low', 'Tired evening']], 'energy'),
    chips('Spend', [[false, 'Anything'], [true, 'Nothing new']], 'free'),
    el('label', { class: 'stack', style: { gap: '4px' } }, [el('span', {}, ['Time we have, all in: ', out]),
      el('input', { type: 'range', min: 30, max: 300, step: 15, value: ask.maxMinutes, 'data-field': 'd-time', 'aria-label': 'Time we have', style: { width: '100%', accentColor: 'var(--accent-strong)' },
        on: { input: (e) => { out.textContent = mins(Number(e.target.value)); }, change: (e) => { ask.maxMinutes = Number(e.target.value); ask.chosen = null; ask.queue = null; hub.render(); } } })]),
    el('p', { style: { margin: 0, fontWeight: 600 }, 'data-field': 'd-count', text: `${found.length} fit${found.length === 1 ? 's' : ''}` }),
    found.length ? c.modes : null,
    found.length ? c.panel : el('div', { class: 'panel empty' }, [el('p', { text: 'Nothing fits all of that - untick something, or add an idea of your own.' })]),
    c.chosen,
  ]);
}

function ideasScreen(hub, list) {
  const sorted = [...list].sort((a, b) => (loved(b) ?? 0) - (loved(a) ?? 0) || a.name.localeCompare(b.name));
  return el('section', { class: 'stack', 'aria-label': 'Date ideas' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Dates' }),
    el('h1', { text: 'Date ideas', style: { margin: 0 } }),
    el('div', { class: 'row' }, [el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add' })]),
    el('ul', { class: 'list panel' }, sorted.map((d) => el('li', {}, [el('a', { class: 'list__main', href: hub.href('date', d.dateId), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `didea:${d.dateId}` }, [
      el('strong', { text: d.name }),
      el('div', { class: 'small muted', text: `${WHERE[d.where]} · ${KIDS[d.kids]} · ready in ${d.prep} min · ${mins(d.lasts)} · ${toBuy(d).length ? rand(costOf(d)) : 'free'}${loved(d) != null ? ` · ${loved(d)}/5` : ''}${d.plannedOn ? ` · planned ${d.plannedOn}` : ''}` }),
    ])]))),
  ]);
}

function dateScreen(hub, list, id) {
  const d = list.find((x) => x.dateId === id);
  if (!d) return el('div', { class: 'panel empty' }, [el('p', { text: 'This date idea was removed.' }), el('a', { class: 'btn', href: hub.href('ideas'), text: 'Ideas' })]);
  const day = el('input', { class: 'input', type: 'date', value: d.plannedOn ?? '', min: hub.today(), 'aria-label': 'Plan it for', style: { maxWidth: '200px' }, 'data-field': 'd-day' });
  const adults = adultsOf(hub.people.list(), hub.today());
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Dates' }),
    card(hub, d, false),
    el('div', { class: 'panel row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [el('strong', { text: 'Plan it for' }), day,
      el('button', { class: 'btn', type: 'button', text: 'Plan', 'data-field': 'd-plan', on: { click: async () => { if (await save(hub, { ...d, plannedOn: day.value || null })) hub.ui.notice(day.value ? 'Planned.' : 'Plan cleared.'); } } }),
      toBuy(d).length && hub.data.installed('shopping') ? el('a', { class: 'btn', href: sendHref({ source: `date:${d.dateId}`, from: d.name, group: 'household', items: toBuy(d).map((x) => ({ name: x.name, note: x.cost ? `about R${x.cost}` : '' })) }), text: 'Shop' }) : null]),
    d.logs.length ? el('div', { class: 'panel stack' }, [el('h2', { text: 'How it went', style: { margin: 0 } }),
      el('ul', { class: 'list' }, d.logs.slice().reverse().map((l) => el('li', {}, [el('span', { class: 'list__main', text: `${l.day} · ${Object.entries(l.scores).map(([pid, s]) => `${adults.find((p) => p.id === pid)?.name ?? 'one of you'} ${s}/5`).join(', ') || 'no scores'}` }), l.note ? el('div', { class: 'small', text: l.note }) : null,
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => save(hub, { ...d, logs: d.logs.filter((x) => x !== l) }) } })])))]) : null,
    el('div', { class: 'row' }, [el('a', { class: 'btn', href: hub.href('edit', d.dateId), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${d.name}"?`, text: 'It goes from your date ideas.', confirmLabel: 'Remove', danger: true })) return;
        await save(hub, { ...d, removed: true }); hub.go('ideas');
      } } })]),
  ]);
}

function editScreen(hub, list, id, rule) {
  const d = id ? list.find((x) => x.dateId === id) : null;
  const record = d ? { ...d, needs: d.needs.map((x) => (x.have ? x.name : `${x.name} - R${x.cost}`)) } : { kids: 'asleep', where: 'home', energy: 'any', prep: 10, lasts: 90 };
  return el('section', { class: 'stack' }, [
    el('h1', { text: d ? `Edit ${d.name}` : 'A date idea' }),
    recordForm({
      record,
      fields: [
        { key: 'name', label: 'The date', required: true, placeholder: 'e.g. Lounge-floor picnic' },
        { key: 'kids', label: 'The children', type: 'select', options: kidsAllowed(rule).map((k) => [k, KIDS[k]]) },
        { key: 'where', label: 'Where', type: 'select', options: Object.entries(WHERE) },
        { key: 'energy', label: 'Energy', type: 'select', options: Object.entries(ENERGY) },
        { key: 'prep', label: 'Time to get ready (minutes)', type: 'number' },
        { key: 'lasts', label: 'Time together (minutes)', type: 'number' },
        { key: 'needs', label: 'What you need', type: 'lines', hint: 'One per line. Add " - R300" to anything to buy.' },
        { key: 'steps', label: 'How', type: 'lines', more: true },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, control: () => linksControl(hub, d ?? {}) }] : []),
      ],
      onCancel: () => (d ? hub.go('date', d.dateId) : hub.go(null)),
      onSave: async ({ links, ...v }) => {
        const dateId = d?.dateId ?? `date-${Date.now().toString(36)}`;
        if (await save(hub, { ...(d ?? { own: true }), ...v, ...(links ?? {}), dateId })) { hub.ui.notice('Saved.'); hub.go('date', dateId); }
      },
    }),
  ]);
}
