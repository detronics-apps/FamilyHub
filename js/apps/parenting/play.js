// Activities screens (D-096). Ideas: time to think - make, change and plan activities, adjust a
// game's rules, look at how they went. Play now: no time to think - a few big taps and something
// to do, then two scores.

import { el } from '../../ui/dom.js';
import { confirmAction, modal } from '../../ui/common.js';
import { recordForm, saveRecord } from '../kit.js';
import { sendHref } from '../shopping/logic.js';
import { linksControl, linksView } from '../../ui/links-editor.js';
import { chooser } from './choose.js';
import { rangeLabel, ageLabel } from './logic.js';
import { WEATHER, PLACES, INVOLVE, normaliseActivity, toBuy, costOf, scores, pick, planned, plannedOn, changeRules, logDone, shopSend, payoff, rank } from './activities.js';

export const activitiesCol = (hub) => hub.data.collection('activities', { summary: (r) => normaliseActivity(r), text: (r) => [r.name, ...(r.steps ?? [])].join(' '), prefix: 'pa' });
const AGES = [0, 6, 9, 12, 18, 24, 30, 36, 48, 60, 72, 96, 120, 144, 168, 192, 216];
const rand = (x) => `R${Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
const save = (hub, a) => saveRecord(hub, activitiesCol(hub), normaliseActivity({ ...a, id: `pa_${a.activityId}` }));

/** "Set up 10 min · keeps them busy about 45 min · R40 to buy". */
const scoreLine = (a) => { const s = scores(a); return s.times ? `Done ${s.times}× · children ${s.kid ?? '-'}/5 · us ${s.parent ?? '-'}/5` : 'Not tried yet'; };

/** Setup, busy time and cost as three figures, and what the setup buys you. */
function figures(a) {
  // Side by side even on a phone: three short figures read at a glance.
  const fig = (value, label, field) => el('div', { class: 'panel', 'data-field': field, style: { padding: '8px 10px', margin: 0 } }, [el('div', { text: value, style: { fontSize: '1.35em', fontWeight: 700, lineHeight: 1.2 } }), el('div', { class: 'small muted', text: label })]);
  return el('div', { class: 'stack', style: { gap: '4px' } }, [
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' } }, [
      fig(a.setup ? `${a.setup} min` : 'None', 'to set up', 'act-setup'),
      fig(`${a.lasts} min`, 'keeps them busy', 'act-lasts'),
      fig(toBuy(a).length ? rand(costOf(a)) : 'Free', toBuy(a).length ? 'to buy' : 'with what we have', 'act-cost'),
    ]),
    el('p', { class: 'small', style: { margin: 0 }, 'data-field': 'act-payoff', text: `${a.setup ? `Busy ${payoff(a)}× as long as it takes to set up.` : 'No setup at all.'} ${INVOLVE[a.involve]}.` }),
  ]);
}

/** The whole activity, for doing it: what you need, how, the rules, and safety. */
function doCard(hub, a, kids, { big = false } = {}) {
  return el('div', { class: 'panel stack', 'data-field': `act:${a.activityId}`, style: big ? { borderWidth: '2px' } : null }, [
    el('h2', { text: a.name, style: { margin: 0 } }),
    linksView(hub, a),
    figures(a),
    a.needs.length ? el('p', { style: { margin: 0 } }, [el('strong', { text: 'You need: ' }), a.needs.map((x) => `${x.name}${x.have ? '' : ' (to buy)'}`).join(', ')]) : null,
    a.steps.length ? el('ol', { style: { margin: 0, paddingLeft: '1.2em' } }, a.steps.map((s) => el('li', { text: s }))) : null,
    a.game && a.rules.length ? el('div', {}, [el('strong', { text: 'Rules' }), el('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, a.rules.map((r) => el('li', { text: r })))]) : null,
    a.safety ? el('p', { class: 'small', style: { margin: 0 } }, [el('strong', { text: 'Safety: ' }), a.safety]) : null,
    el('div', { class: 'row' }, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Done', 'data-field': `act-done:${a.activityId}`, on: { click: () => doneDialog(hub, a, kids) } })]),
  ]);
}

/** Two quick scores - each child's and ours - and what to change next time. */
function doneDialog(hub, a, kids) {
  const picked = { parent: null };
  const scale = (key, label) => el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'small', text: label }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': label }, [1, 2, 3, 4, 5].map((n) => el('button', {
      class: 'chip', type: 'button', text: String(n), 'aria-pressed': 'false', 'data-field': `score:${key}:${n}`,
      on: { click: (e) => { picked[key] = n; for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target)); } } })))]);
  const note = el('textarea', { class: 'input', rows: 2, placeholder: 'What would make it better next time? (optional)', 'aria-label': 'What to change' });
  const { close } = modal({
    title: `How was ${a.name}?`,
    body: [el('p', { class: 'small muted', text: '1 = not again, 5 = loved it.' }), ...kids.map((k) => scale(k.id, k.name)), scale('parent', 'Us'), note],
    foot: [el('button', { class: 'btn', type: 'button', text: 'Skip', on: { click: () => close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'done-save', on: { click: async () => {
        close();
        const next = logDone(a, { day: hub.today(), kids: kids.map((k) => ({ id: k.id, score: picked[k.id] ?? null })), parent: picked.parent, note: note.value.trim() });
        if (await save(hub, next)) hub.ui.notice(note.value.trim() && a.game ? 'Saved. Change the rules under Ideas when you have a moment.' : 'Saved.');
      } } })],
  });
}

// Play now's answers, kept while the app is open (D-099: sliders, and ways to choose).
const ask = { kids: null, place: null, weather: null, us: null, buy: false, maxSetup: 10, minLasts: 15, minPayoff: 0, mode: 'list', shown: 3, off: new Set(), chosen: null, queue: null, turn: 0, rolling: false };
/** A slider whose figure moves as you slide; the list is worked out again when you let go. */
function slider(hub, key, label, { min, max, step = 1, show }) {
  const out = el('strong', { text: show(ask[key]) });
  return el('label', { class: 'stack', style: { gap: '4px' } }, [el('span', {}, [`${label}: `, out]),
    el('input', { type: 'range', min, max, step, value: ask[key], 'data-field': `play-${key}`, 'aria-label': label, style: { width: '100%', accentColor: 'var(--accent-strong)' },
      on: { input: (e) => { out.textContent = show(Number(e.target.value)); }, change: (e) => { ask[key] = Number(e.target.value); ask.chosen = null; ask.queue = null; hub.render(); } } })]);
}

export function playScreen(hub, list, kids) {
  const today = hub.today();
  if (!ask.kids) ask.kids = new Set(kids.map((k) => k.id));
  const chips = (label, opts, key, field) => el('div', { class: 'stack', style: { gap: '6px' } }, [el('strong', { text: label }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': label }, opts.map(([v, t]) => el('button', {
      class: 'chip', type: 'button', text: t, 'aria-pressed': String(key === 'kids' ? ask.kids.has(v) : ask[key] === v), 'data-field': `${field}:${v}`, style: { padding: '10px 16px', fontSize: '1.05em' },
      on: { click: () => { if (key === 'kids') { if (ask.kids.has(v)) ask.kids.delete(v); else ask.kids.add(v); } else ask[key] = ask[key] === v && key !== 'buy' && key !== 'mode' ? null : v; ask.shown = 3; ask.chosen = null; ask.queue = null; hub.render(); } } })))]);
  const who = kids.filter((k) => ask.kids.has(k.id));
  const found = pick(list, { kids: who.map((k) => k.months), place: ask.place, weather: ask.weather, buy: ask.buy, maxSetup: ask.maxSetup, minLasts: ask.minLasts, minPayoff: ask.minPayoff || null, us: ask.us });
  const todays = plannedOn(list, today);
  const c = chooser(hub, found, ask, { idOf: (a) => a.activityId, card: (a, big) => doCard(hub, a, who, { big }), prefix: 'play', thisHelp: 'Read them out - they tap the one they want.' });
  return el('section', { class: 'stack', 'aria-label': 'Play now' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Parenting' }),
    el('h1', { text: 'Play now', style: { margin: 0 } }),
    todays.length ? el('div', { class: 'stack', 'data-field': 'play-today' }, [el('p', { style: { margin: 0, fontWeight: 600 }, text: 'Planned for today' }), ...todays.map((a) => doCard(hub, a, who, { big: true }))]) : null,
    kids.length > 1 ? chips('Who', kids.map((k) => [k.id, k.name]), 'kids', 'play-kid') : null,
    chips('Where', [['inside', 'Inside'], ['outside', 'Outside']], 'place', 'play-place'),
    ask.place === 'outside' ? chips('Weather', [['sun', 'Sunny'], ['cool', 'Cool'], ['wind', 'Windy']], 'weather', 'play-weather') : null,
    chips('And us?', [['with', 'We play too'], ['free', 'We need to get things done']], 'us', 'play-us'),
    el('div', { class: 'panel stack', 'data-field': 'play-sliders' }, [
      slider(hub, 'maxSetup', 'Set up in at most', { min: 0, max: 30, show: (v) => (v ? `${v} min` : 'no setup') }),
      slider(hub, 'minLasts', 'Keeps them busy at least', { min: 5, max: 90, step: 5, show: (v) => `${v} min` }),
      slider(hub, 'minPayoff', 'Worth the setup: busy at least', { min: 0, max: 10, show: (v) => (v ? `${v}× as long as the setup` : 'any') }),
    ]),
    chips('Buy anything?', [[false, 'Only what we have'], [true, 'Can buy']], 'buy', 'play-buy'),
    el('p', { style: { margin: 0, fontWeight: 600 }, 'data-field': 'play-count', text: `${found.length} fit${found.length === 1 ? 's' : ''}` }),
    found.length ? c.modes : null,
    found.length ? c.panel : el('div', { class: 'panel empty' }, [el('p', { text: 'Nothing fits all of that. Slide or untick something above.' })]),
    c.chosen,
  ]);
}

let ideaSort = 'best';   // Ideas' order, kept while the app is open

// Ideas' filters (owner, D-107): your children's ages by default, setup, how long, where.
const idf = { ages: 'ours', maxSetup: 30, minLasts: 5, place: null };

export function ideasScreen(hub, allIdeas, kids = []) {
  const ages = kids.map((k) => k.months).filter((m) => m != null);
  const list = pick(allIdeas, { kids: idf.ages === 'ours' ? ages : [], place: idf.place, maxSetup: idf.maxSetup, minLasts: idf.minLasts });
  const range = (key, label, min, max, step, show) => { const out = el('strong', { text: show(idf[key]) });
    return el('label', { class: 'stack', style: { gap: '2px', flex: '1 1 200px' } }, [el('span', { class: 'small' }, [`${label}: `, out]),
      el('input', { type: 'range', min, max, step, value: idf[key], 'data-field': `idf-${key}`, 'aria-label': label, style: { width: '100%', accentColor: 'var(--accent-strong)' },
        on: { input: (e) => { out.textContent = show(Number(e.target.value)); }, change: (e) => { idf[key] = Number(e.target.value); hub.render(); } } })]); };
  const chip = (label, key, v) => el('button', { class: 'chip', type: 'button', text: label, 'aria-pressed': String(idf[key] === v), 'data-field': `idf-${key}:${v}`, on: { click: () => { idf[key] = idf[key] === v && key !== 'ages' ? null : v; hub.render(); } } });
  const filters = el('div', { class: 'panel stack', 'data-field': 'idea-filters', style: { gap: '8px' } }, [
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Ages' }, [ages.length ? chip('Our children’s ages', 'ages', 'ours') : null, chip('All ages', 'ages', 'all')].filter(Boolean)),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Where' }, [chip('Inside', 'place', 'inside'), chip('Outside', 'place', 'outside')]),
    el('div', { class: 'row', style: { gap: 'var(--space-3)' } }, [
      range('maxSetup', 'Set up in at most', 0, 30, 1, (v) => (v ? `${v} min` : 'no setup')),
      range('minLasts', 'Lasts at least', 5, 90, 5, (v) => `${v} min`),
    ]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `${list.length} of ${allIdeas.length} shown` }),
  ]);
  const today = hub.today();
  const soon = planned(list, today);
  const by = { best: (a, b) => rank(b) - rank(a), payoff: (a, b) => payoff(b) - payoff(a), quick: (a, b) => a.setup - b.setup || b.lasts - a.lasts, loved: (a, b) => ((scores(b).kid ?? 0) + (scores(b).parent ?? 0)) - ((scores(a).kid ?? 0) + (scores(a).parent ?? 0)) };
  const sorted = [...list].sort((a, b) => by[ideaSort](a, b) || a.name.localeCompare(b.name));
  const sortChips = el('div', { class: 'chipset', role: 'group', 'aria-label': 'Order' }, [['best', 'Best'], ['payoff', 'Least effort'], ['quick', 'Quickest'], ['loved', 'Most loved']].map(([k, t]) => el('button', {
    class: 'chip', type: 'button', text: t, 'aria-pressed': String(ideaSort === k), 'data-field': `idea-sort:${k}`, on: { click: () => { ideaSort = k; hub.render(); } } })));
  const row = (a) => el('li', {}, [el('a', { class: 'list__main', href: hub.href('idea', a.activityId), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `idea:${a.activityId}` }, [
    el('strong', { text: a.name }), a.game ? el('span', { class: 'small muted', text: ' · game' }) : null,
    el('div', { class: 'small', text: `Set up ${a.setup ? `${a.setup} min` : 'none'} · busy about ${a.lasts} min${a.setup ? ` (${payoff(a)}×)` : ''} · ${toBuy(a).length ? `${rand(costOf(a))} to buy` : 'free'}` }),
    el('div', { class: 'small muted', text: `${rangeLabel(a.ageFrom, a.ageTo)} · ${PLACES[a.place]} · ${INVOLVE[a.involve]}` }),
    el('div', { class: 'small', text: `${a.plannedOn ? `Planned ${a.plannedOn} · ` : ''}${scoreLine(a)}` }),
  ])]);
  return el('section', { class: 'stack', 'aria-label': 'Ideas' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Parenting' }),
    el('h1', { text: 'Ideas', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'For when there is time to think: add ideas, change them, plan a day for one, and adjust a game’s rules after you have played it. Play now uses what is here.' }),
    el('div', { class: 'row', style: { alignItems: 'center' } }, [el('a', { class: 'btn btn-primary', href: hub.href('idea-new'), text: 'Add', title: 'Add an activity or game', 'data-field': 'idea-add' }), sortChips]),
    soon.length ? el('div', { class: 'panel stack', 'data-field': 'ideas-planned' }, [el('h2', { text: 'Planned', style: { margin: 0 } }), el('ul', { class: 'list' }, soon.map(row))]) : null,
    filters,
    sorted.length ? el('ul', { class: 'list panel' }, sorted.map(row)) : el('div', { class: 'panel empty' }, [el('p', { text: 'Nothing fits those filters - change one, or add an idea of your own.' })]),
  ]);
}

export function ideaScreen(hub, list, id, kids) {
  const a = list.find((x) => x.activityId === id);
  if (!a) return el('div', { class: 'panel empty' }, [el('p', { text: 'This activity was removed.' }), el('a', { class: 'btn', href: hub.href('ideas'), text: 'Ideas' })]);
  const rules = el('textarea', { class: 'input', rows: 4, text: a.rules.join('\n'), 'aria-label': 'Rules, one per line', 'data-field': 'idea-rules' });
  const day = el('input', { class: 'input', type: 'date', value: a.plannedOn ?? '', min: hub.today(), 'aria-label': 'Plan it for', style: { maxWidth: '200px' }, 'data-field': 'idea-day' });
  const notes = a.logs.filter((l) => l.note);
  const nameOf = (pid) => kids.find((k) => k.id === pid)?.name ?? 'a child';
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('ideas'), class: 'small', text: '‹ Ideas' }),
    el('h1', { text: a.name, style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `${rangeLabel(a.ageFrom, a.ageTo)} · ${PLACES[a.place]}${a.place !== 'inside' ? ` · ${a.weather.map((w) => WEATHER[w]).join(', ')}` : ''} · ${INVOLVE[a.involve]}` }),
    el('p', { class: 'small', style: { margin: 0 }, text: scoreLine(a) }),
    doCard(hub, a, kids),
    el('div', { class: 'panel row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [el('strong', { text: 'Plan it for' }), day,
      el('button', { class: 'btn', type: 'button', text: 'Plan', on: { click: async () => { if (await save(hub, { ...a, plannedOn: day.value || null })) hub.ui.notice(day.value ? 'Planned.' : 'Plan cleared.'); } } }),
      toBuy(a).length && hub.data.installed('shopping') ? el('a', { class: 'btn', href: sendHref(shopSend(a)), text: 'Shop', title: 'Send what needs buying to the shopping list', 'data-field': 'idea-shop' }) : null]),
    a.game ? el('div', { class: 'panel stack', 'data-field': 'idea-rules-panel' }, [el('h2', { text: 'Rules', style: { margin: 0 } }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Change them to make it more fun or more creative - earlier rules are kept below.' }), rules,
      el('div', {}, [el('button', { class: 'btn', type: 'button', text: 'Save', 'data-field': 'idea-rules-save', on: { click: async () => { if (await save(hub, changeRules(a, rules.value))) hub.ui.notice('Rules saved.'); } } })]),
      a.rulesHistory.length ? el('details', { class: 'more' }, [el('summary', { text: `Earlier rules (${a.rulesHistory.length})` }),
        ...a.rulesHistory.slice().reverse().map((h) => el('div', { class: 'small' }, [el('div', { class: 'muted', text: `Until ${h.at.slice(0, 10)}` }), el('ul', { style: { margin: 0 } }, h.rules.map((r) => el('li', { text: r })))]))]) : null]) : null,
    a.logs.length ? el('div', { class: 'panel stack', 'data-field': 'idea-logs' }, [el('h2', { text: 'How it went', style: { margin: 0 } }),
      el('ul', { class: 'list' }, a.logs.slice().reverse().map((l) => el('li', {}, [el('span', { class: 'list__main', text: `${l.day} · ${l.kids.filter((k) => k.score).map((k) => `${nameOf(k.id)} ${k.score}/5`).join(', ') || 'no child score'}${l.parent ? ` · us ${l.parent}/5` : ''}` }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => save(hub, { ...a, logs: a.logs.filter((x) => x !== l) }) } }),
        l.note ? el('div', { class: 'small', text: l.note }) : null])))]) : null,
    notes.length && a.game ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'Your notes are above - worth a look when changing the rules.' }) : null,
    el('div', { class: 'row' }, [el('a', { class: 'btn', href: hub.href('idea-edit', a.activityId), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${a.name}"?`, text: 'It goes from Ideas and Play now.', confirmLabel: 'Remove', danger: true })) return;
        await save(hub, { ...a, removed: true }); hub.go('ideas');
      } } })]),
  ]);
}

export function ideaEdit(hub, list, id) {
  const a = id ? list.find((x) => x.activityId === id) : null;
  const ageSel = (key, label, none) => ({ key, label, type: 'custom', control: () => {
    const s = el('select', { class: 'select', style: { maxWidth: '200px' } }, [el('option', { value: '', text: none, selected: a?.[key] == null }),
      ...AGES.map((m) => el('option', { value: m, text: m === 0 ? 'Birth' : ageLabel(m).replace(/^./, (c) => c.toUpperCase()), selected: a?.[key] === m }))]);
    return { node: s, get: () => (s.value === '' ? null : Number(s.value)) };
  } });
  const record = a ? { ...a, needs: a.needs.map((x) => (x.have ? x.name : `${x.name} - R${x.cost}`)) } : { place: 'either', weather: ['any'], setup: 5, lasts: 20 };
  return el('section', { class: 'stack' }, [
    el('h1', { text: a ? `Edit ${a.name}` : 'A new activity' }),
    recordForm({
      record,
      fields: [
        { key: 'name', label: 'Activity', required: true, placeholder: 'e.g. Cushion fort' },
        ageSel('ageFrom', 'From the age of', 'Any age'), ageSel('ageTo', 'Until the age of', 'No end'),
        { key: 'place', label: 'Where', type: 'select', options: Object.entries(PLACES) },
        { key: 'involve', label: 'How much of us it needs', type: 'select', options: Object.entries(INVOLVE), hint: 'Under-3s always need someone nearby, whatever this says.' },
        { key: 'weather', label: 'Weather it suits (outside)', type: 'choices', options: Object.entries(WEATHER) },
        { key: 'setup', label: 'Setup time (minutes)', type: 'number' },
        { key: 'lasts', label: 'Keeps them busy for about (minutes)', type: 'number' },
        { key: 'needs', label: 'What you need', type: 'lines', hint: 'One per line. Add " - R40" to anything you would need to buy.' },
        { key: 'steps', label: 'How to do it', type: 'lines' },
        { key: 'game', label: 'It is a game with rules', type: 'check' },
        { key: 'rules', label: 'Rules', type: 'lines' },
        { key: 'safety', label: 'Safety', type: 'textarea', more: true },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, hint: 'Whoever explains it best - a video to watch before you set it up.', control: () => linksControl(hub, a ?? {}) }] : []),
      ],
      onCancel: () => (a ? hub.go('idea', a.activityId) : hub.go('ideas')),
      onSave: async ({ links, ...v }) => {
        Object.assign(v, links ?? {});
        const activityId = a?.activityId ?? `act-${Date.now().toString(36)}`;
        const next = a ? changeRules({ ...a, ...v, rules: a.rules }, v.rules) : { ...v, activityId, own: true };
        if (await save(hub, { ...next, activityId, own: a ? a.own : true })) { hub.ui.notice('Saved.'); hub.go('idea', activityId); }
      },
    }),
  ]);
}
