// Screen time screens (D-097): the week and today's rules, a quick log, and shows ranked on
// the family's own values - each parent rates separately and sees the other's after their own.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { recordForm, saveRecord } from '../kit.js';
import { rangeLabel, ageLabel, adultsOf } from './logic.js';
import { AFTER, normaliseLog, normaliseShow, criteriaOf, showsOf, ranking, suggest, week, limitFor, personScore, afterEffect, todayMinutes, allowed, minScoreFor, ALLOWED_LABEL } from './screen.js';

export const logCol = (hub) => hub.data.collection('screenlog', { summary: (r) => normaliseLog(r), prefix: 'sl' });
export const showsCol = (hub) => hub.data.collection('shows', { summary: (r) => normaliseShow(r), text: (r) => r.name ?? '', prefix: 'sh' });
export const setCol = (hub) => hub.data.collection('screenset', { summary: (r) => r, prefix: 'ss' });
export { todayMinutes };

/** Everything Screen time needs, loaded with the rest of Parenting. */
export async function loadScreen(hub) {
  const [l, s, c] = await Promise.all([logCol(hub).list({ limit: 100000 }), showsCol(hub).list({ limit: 10000 }), setCol(hub).list({ limit: 10 })]);
  return { logs: l.items.map(normaliseLog), shows: showsOf(s.items), settings: c.items.find((x) => x.id === 'settings') ?? null };
}

const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (d) => DAY[new Date(`${d}T00:00:00Z`).getUTCDay()];
const decideHref = `#/decisions/new/${encodeURIComponent('parenting:screens')}`;

export function screenHome(hub, sc, kids, decisions) {
  const today = hub.today();
  const criteria = criteriaOf(sc.settings);
  const ranked = ranking(sc.shows, criteria, sc.logs, adultsOf(hub.people.list(), today));
  const pickNow = suggest(ranked, kids, decisions);
  const scoreOf = (id) => ranked.find((r) => r.show.showId === id)?.score ?? null;
  const rules = decisions.filter((d) => d.source === 'parenting:screens');
  return el('section', { class: 'stack', 'aria-label': 'Screen time' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Parenting' }),
    el('h1', { text: 'Screen time', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Not to judge - to notice. What was watched, for how long and how it left them, beside what you agreed; and if you do watch, a show chosen by what matters to you.' }),
    el('div', { class: 'row' }, [el('a', { class: 'btn btn-primary', href: hub.href('screen-log'), text: 'Log', 'data-field': 'scr-log' }), el('a', { class: 'btn', href: hub.href('shows'), text: 'Shows', 'data-field': 'scr-shows' })]),
    pickNow ? el('div', { class: 'panel', 'data-field': 'scr-suggest' }, [el('strong', { text: 'If you watch today: ' }), `${pickNow.show.name} - ${pickNow.score}/5 on your values${pickNow.after.times ? `, wound up after ${pickNow.after.wound} of ${pickNow.after.times} times` : ''}.`])
      : ranked.some((r) => r.score != null) ? el('p', { class: 'small muted', style: { margin: 0 }, 'data-field': 'scr-suggest', text: 'Nothing rated so far clears what you agreed for the youngest - rate a few more under Shows.' }) : null,
    ...kids.map((k) => {
      const w = week(k, sc.logs, decisions, today, scoreOf);
      const top = Math.max(w.limit ?? 0, ...w.days.map((d) => d.minutes), 1);
      return el('div', { class: 'panel stack', 'data-field': `scr-week:${k.id}` }, [
        el('h2', { text: `${k.name}${k.months != null ? `, ${ageLabel(k.months)}` : ''}`, style: { margin: 0 } }),
        el('p', { class: 'small', style: { margin: 0 }, text: `${w.limit != null ? `Agreed: up to ${mins(w.limit)} a day. ` : 'No daily minutes agreed for this age. '}This week ${mins(w.total)} - about ${mins(w.average)} a day.` }),
        el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px', alignItems: 'end', height: '90px' }, 'aria-label': 'Minutes each day this week' }, w.days.map((d) => el('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', textAlign: 'center' }, title: `${d.day}: ${d.minutes} min` }, [
          el('div', { class: 'small', text: d.minutes ? String(d.minutes) : '' }),
          el('div', { style: { height: `${Math.round((d.minutes / top) * 60)}px`, minHeight: d.minutes ? '3px' : '0', background: w.limit != null && d.minutes > w.limit ? 'var(--warn)' : 'var(--accent-strong)', borderRadius: '3px 3px 0 0' } }),
          el('div', { class: 'small muted', text: d.day === today ? 'Today' : dayName(d.day) }),
        ]))),
        w.notes.length ? el('ul', { class: 'small', style: { margin: 0, paddingLeft: '1.2em' } }, w.notes.map((n) => el('li', { text: n }))) : null,
      ]);
    }),
    kids.length ? null : el('p', { class: 'small muted', text: 'Add the children on the People page to see each one’s week.' }),
    sc.logs.length ? el('details', { class: 'panel more', 'data-field': 'scr-entries' }, [el('summary', { text: `Everything logged (${sc.logs.length})` }),
      el('ul', { class: 'list' }, sc.logs.slice().sort((a, b) => `${b.day}${b.time}`.localeCompare(`${a.day}${a.time}`)).slice(0, 60).map((l) => el('li', {}, [
        el('span', { class: 'list__main', text: `${l.day}${l.time ? ` ${l.time}` : ''} · ${sc.shows.find((s) => s.showId === l.showId)?.name ?? (l.what || 'something')} · ${l.minutes} min · ${l.kids.map((id) => kids.find((k) => k.id === id)?.name ?? '').filter(Boolean).join(', ')}` }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: async () => { await logCol(hub).remove(l.id); hub.invalidate(); } } }),
      ])))]) : null,
    el('div', { class: 'panel stack', 'data-field': 'scr-rules' }, [el('h2', { text: 'What we agreed', style: { margin: 0 } }),
      rules.length ? el('ul', { class: 'list' }, rules.map((d) => el('li', {}, [el('a', { href: `#/decisions/item/${encodeURIComponent(d.id)}`, text: d.title }),
        el('span', { class: 'small muted', text: ` · ${rangeLabel(d.ageFrom, d.ageTo)}${d.screenMinutes != null ? ` · up to ${mins(d.screenMinutes)} a day` : ''}${d.screenMinScore != null ? ` · shows scoring ${d.screenMinScore}+` : ''}${d.hasAgreement ? '' : ' · not agreed yet'}` })])))
        : el('p', { class: 'small muted', style: { margin: 0 }, text: 'Nothing agreed yet. For example: under 2 none except video calls; 2 to 5 up to an hour, not in the hour before bed.' }),
      hub.data.installed('decisions') ? el('div', {}, [el('a', { class: 'btn', href: decideHref, text: 'Decide', title: 'A screen-time rule for an age, in Decisions' })]) : null]),
  ]);
}

export function logScreen(hub, sc, kids, decisions = []) {
  const ranked = ranking(sc.shows, criteriaOf(sc.settings), sc.logs, adultsOf(hub.people.list(), hub.today()));
  const below = (id) => kids.map((k) => [k, minScoreFor(k, decisions), ranked.find((r) => r.show.showId === id)?.score ?? null]).filter(([, bar, s]) => bar != null && s != null && s < bar);
  const shows = sc.shows.slice().sort((a, b) => a.name.localeCompare(b.name));
  const now = new Date();
  const record = { day: hub.today(), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, kids: kids.map((k) => k.id), minutes: 30, after: 'fine' };
  const showPick = () => {
    const note = el('p', { class: 'small fin-worse', style: { margin: '4px 0 0' }, 'data-field': 'scr-below' });
    const say = () => { const b = below(s.value); note.textContent = b.length ? b.map(([k, bar, sc2]) => `Below the ${bar} you agreed for ${k.name} (${sc2}/5)`).join('; ') : ''; };
    const s = el('select', { class: 'select', style: { maxWidth: '280px' }, 'data-field': 'scr-show', on: { change: say } }, [el('option', { value: '', text: 'Something else' }), ...shows.map((x) => el('option', { value: x.showId, text: x.name }))]);
    return { node: el('div', {}, [s, note]), get: () => s.value || null };
  };
  return el('section', { class: 'stack' }, [
    el('h1', { text: 'Log screen time' }),
    recordForm({
      record,
      fields: [
        { key: 'kids', label: 'Who watched', type: 'choices', options: kids.map((k) => [k.id, k.name]), empty: 'Add the children on the People page.' },
        { key: 'showId', label: 'What', type: 'custom', control: showPick },
        { key: 'what', label: 'Or name it', placeholder: 'A game, a video call, a film…' },
        { key: 'minutes', label: 'About how long (minutes)', type: 'number' },
        { key: 'after', label: 'Afterwards', type: 'select', options: Object.entries(AFTER) },
        { key: 'day', label: 'Day', type: 'day', more: true },
        { key: 'time', label: 'Started at', more: true, placeholder: '17:30' },
      ],
      onCancel: () => hub.go('screen'),
      onSave: async (v) => {
        if (await saveRecord(hub, logCol(hub), normaliseLog({ ...v, by: hub.people.current()?.id ?? null }))) { hub.ui.notice('Logged.'); hub.go('screen'); }
      },
    }),
  ]);
}

export function showsScreen(hub, sc, kids = [], decisions = []) {
  const today = hub.today();
  const criteria = criteriaOf(sc.settings);
  const raters = adultsOf(hub.people.list(), today);
  const ranked = ranking(sc.shows, criteria, sc.logs, raters);
  const weights = el('div', { class: 'stack', style: { gap: '6px' } }, criteria.map((c) => el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [
    el('span', { style: { flex: '1 1 160px' }, text: c.name, title: c.hint }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': `How much ${c.name} matters` }, [[0, 'Ignore'], [1, 'Some'], [2, 'More'], [3, 'Most']].map(([w, t]) => el('button', {
      class: 'chip', type: 'button', text: t, 'aria-pressed': String(c.weight === w), 'data-field': `scr-w:${c.id}:${w}`,
      on: { click: () => saveRecord(hub, setCol(hub), { ...(sc.settings ?? {}), id: 'settings', criteria: criteria.map((x) => (x.id === c.id ? { ...x, weight: w } : x)) }) } }))),
  ])));
  const addCrit = el('input', { class: 'input', placeholder: 'Add a value, e.g. Shows real families', 'aria-label': 'Add a value', style: { maxWidth: '320px' } });
  return el('section', { class: 'stack', 'aria-label': 'Shows' }, [
    el('a', { href: hub.href('screen'), class: 'small', text: '‹ Screen time' }),
    el('h1', { text: 'Shows', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Ranked on your own values. Each of you rates separately; the score is the average of both, with each of your own beside it. Nothing here is anyone else’s rating.' }),
    el('div', { class: 'row' }, [el('a', { class: 'btn btn-primary', href: hub.href('show-new'), text: 'Add', title: 'Add a show' })]),
    el('ul', { class: 'list panel', 'data-field': 'scr-ranking' }, ranked.map((r, i) => el('li', {}, [el('a', { class: 'list__main', href: hub.href('show', r.show.showId), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `show:${r.show.showId}` }, [
      el('strong', { text: `${r.score != null ? `${i + 1}. ` : ''}${r.show.name}` }), r.score != null ? el('span', { text: ` · ${r.score}/5` }) : el('span', { class: 'small muted', text: ' · not rated yet' }),
      el('div', { class: 'small muted', text: [rangeLabel(r.show.ageFrom, r.show.ageTo), ...r.each.filter((x) => x.score != null).map((x) => `${x.name} ${x.score}`), r.after.times ? `wound up ${r.after.wound} of ${r.after.times} times` : null].filter(Boolean).join(' · ') }),
      ...kids.map((k) => [k, allowed(r.score, k, decisions)]).filter(([, a]) => a).map(([k, a]) => el('div', { class: `small ${a === 'ok' ? 'fin-better' : a === 'below' ? 'fin-worse' : 'muted'}`, 'data-field': `allowed:${r.show.showId}:${k.id}`, text: `${k.name}: ${ALLOWED_LABEL[a]}${a === 'unrated' ? ' - rate it first' : ''}` })),
    ])]))),
    el('details', { class: 'panel more', 'data-field': 'scr-values' }, [el('summary', { text: 'Our values and how much each matters' }),
      el('p', { class: 'small muted', text: 'Changing a weight re-ranks every show straight away.' }), weights,
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [addCrit, el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: () => {
        if (!addCrit.value.trim()) return;
        saveRecord(hub, setCol(hub), { ...(sc.settings ?? {}), id: 'settings', criteria: [...criteria, { id: `c-${Date.now().toString(36)}`, name: addCrit.value.trim(), weight: 1 }] });
      } } })])]),
  ]);
}

export function showScreen(hub, sc, id) {
  const s = sc.shows.find((x) => x.showId === id);
  if (!s) return el('div', { class: 'panel empty' }, [el('p', { text: 'This show was removed.' }), el('a', { class: 'btn', href: hub.href('shows'), text: 'Shows' })]);
  const criteria = criteriaOf(sc.settings);
  const me = hub.people.current()?.id ?? null;
  const mine = me ? s.ratings[me] ?? {} : {};
  const others = adultsOf(hub.people.list(), hub.today()).filter((p) => p.id !== me);
  const rate = (cid, n) => saveRecord(hub, showsCol(hub), normaliseShow({ ...s, id: `sh_${s.showId}`, ratings: { ...s.ratings, [me]: { ...mine, [cid]: n } } }));
  const fx = afterEffect(s, sc.logs);
  const gaveMine = Object.keys(mine).length > 0;
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('shows'), class: 'small', text: '‹ Shows' }),
    el('h1', { text: s.name, style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `Made for about ${rangeLabel(s.ageFrom, s.ageTo).replace(/^From/, 'from').toLowerCase()}${fx.times ? ` · logged ${fx.times} times: calm ${fx.calm}, wound up ${fx.wound}` : ''}` }),
    el('div', { class: 'panel stack', 'data-field': 'show-rate' }, [el('h2', { text: me ? 'My scores' : 'Scores', style: { margin: 0 } }),
      !me ? el('p', { class: 'small muted', text: 'Choose who you are at the top of the page to rate.' }) : el('p', { class: 'small muted', style: { margin: 0 }, text: '1 = not at all, 5 = very. Yours stay yours; the other’s show once you have given yours.' }),
      ...(me ? criteria.map((c) => el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', {}, [el('strong', { text: c.name }), c.hint ? el('span', { class: 'small muted', text: ` - ${c.hint}` }) : null]),
        el('div', { class: 'chipset', role: 'group', 'aria-label': c.name }, [1, 2, 3, 4, 5].map((n) => el('button', { class: 'chip', type: 'button', text: String(n), 'aria-pressed': String(mine[c.id] === n), 'data-field': `rate:${c.id}:${n}`, on: { click: () => rate(c.id, n) } })))])) : []),
      me && gaveMine ? el('p', { style: { margin: 0 }, text: `Mine: ${personScore(s, me, criteria) ?? '-'}/5 on our values.` }) : null,
      ...others.map((p) => el('p', { style: { margin: 0 } }, [el('strong', { text: `${p.name}: ` }), s.ratings[p.id] ? (gaveMine ? `${personScore(s, p.id, criteria) ?? '-'}/5 - ${criteria.filter((c) => s.ratings[p.id][c.id] != null).map((c) => `${c.name} ${s.ratings[p.id][c.id]}`).join(', ')}` : 'has rated it - give yours to see it.') : 'not yet.'])),
    ]),
    el('div', { class: 'row' }, [el('a', { class: 'btn', href: hub.href('show-edit', s.showId), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${s.name}"?`, text: 'Its scores go with it; the log keeps what was watched.', confirmLabel: 'Remove', danger: true })) return;
        await saveRecord(hub, showsCol(hub), normaliseShow({ ...s, id: `sh_${s.showId}`, removed: true })); hub.go('shows');
      } } })]),
  ]);
}

const AGES = [0, 6, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120, 144, 168, 216];
export function showEdit(hub, sc, id) {
  const s = id ? sc.shows.find((x) => x.showId === id) : null;
  const ageSel = (key, label, none) => ({ key, label, type: 'custom', control: () => {
    const x = el('select', { class: 'select', style: { maxWidth: '200px' } }, [el('option', { value: '', text: none, selected: s?.[key] == null }), ...AGES.map((m) => el('option', { value: m, text: m === 0 ? 'Birth' : ageLabel(m).replace(/^./, (c) => c.toUpperCase()), selected: s?.[key] === m }))]);
    return { node: x, get: () => (x.value === '' ? null : Number(x.value)) };
  } });
  return el('section', { class: 'stack' }, [
    el('h1', { text: s ? `Edit ${s.name}` : 'Add a show' }),
    recordForm({
      record: s ?? {},
      fields: [{ key: 'name', label: 'Show', required: true, placeholder: 'e.g. Bluey' }, ageSel('ageFrom', 'Made for ages from', 'Any age'), ageSel('ageTo', 'Until', 'No end'), { key: 'note', label: 'Notes', type: 'textarea', more: true }],
      onCancel: () => (s ? hub.go('show', s.showId) : hub.go('shows')),
      onSave: async (v) => {
        const showId = s?.showId ?? `show-${Date.now().toString(36)}`;
        if (await saveRecord(hub, showsCol(hub), normaliseShow({ ...(s ?? { own: true }), ...v, id: `sh_${showId}`, showId }))) { hub.ui.notice('Saved.'); hub.go('show', showId); }
      },
    }),
  ]);
}
