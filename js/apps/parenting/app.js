// Parenting (D-095, D-096, D-097): planned ahead, not opened in a crisis. It opens on four doors:
// Agreements (topics talked through and decided together - the dashboard, sections, a topic,
// the form for our own), Ideas (activities, with time to think), Play now (no time to think)
// and Screen time (awareness, and shows rated on our values). Decisions themselves are kept in
// the Decisions app; this reads them back.

import { el } from '../../ui/dom.js';
import { confirmAction, modal } from '../../ui/common.js';
import { loading, failure, recordForm, saveRecord } from '../kit.js';
import { LEVELS, SOURCES, OUTCOMES, GO_LINE, COUNTRY_NUMBERS, numbersOf } from './content.js';
import {
  SECTIONS, topicsOf, dashboard, kidsOf, adultsOf, timing, rangeLabel, ageLabel, leaningsFor, topicStatus, parentingDecisions,
  normaliseRecord, normaliseSection, STATUS_LABEL, careRule, tileNote as noteFor, stepAt, ownId,
} from './logic.js';
import { activitiesOf, planned, plannedOn } from './activities.js';
import { activitiesCol, playScreen, ideasScreen, ideaScreen, ideaEdit } from './play.js';
import { loadScreen, screenHome, logScreen, showsScreen, showScreen, showEdit, todayMinutes } from './screens.js';
import { loadTrack, trackHome, trackerScreen, scenarioEdit, trackNote } from './track.js';
import { videosPanel } from './videos.js';
import { loadRoutines, routinesHome, routineRun, routineEdit } from './kidtasks.js';
import { loadPlanner, plannerScreen, planEdit } from './plannerview.js';
import { questionsPanel, feverPlanPanel, chartPanel } from './questionsview.js';

const topicsCol = (hub) => hub.data.collection('topics', { summary: (r) => normaliseRecord(r), text: (r) => [r.title, r.question, r.summary].join(' '), prefix: 'pt' });
const settingsCol = (hub) => hub.data.collection('settings', { summary: (r) => r, prefix: 'pset' });
// The family's emergency numbers, read on each render (D-103).
let EMERGENCY = numbersOf(null);
const sectionsCol = (hub) => hub.data.collection('sections', { summary: (r) => normaliseSection(r), prefix: 'ps' });
const AGES = [-6, -3, -1, 0, 1, 2, 3, 4, 6, 9, 12, 18, 24, 36, 48, 60, 72, 96, 120, 144, 168, 192, 216];

const load = (hub) => hub.use('all', async () => {
  const [t, s, d, a, sc, tr, st, rt, pl] = await Promise.all([
    topicsCol(hub).list({ limit: 100000 }), sectionsCol(hub).list({ limit: 1000 }),
    hub.data.installed('decisions') ? hub.data.of('decisions', 'decisions').list({ limit: 100000 }) : { items: [] },
    activitiesCol(hub).list({ limit: 100000 }),
    loadScreen(hub),
    loadTrack(hub),
    settingsCol(hub).list({ limit: 10 }),
    loadRoutines(hub),
    loadPlanner(hub),
  ]);
  return { records: t.items, ownSections: s.items.map(normaliseSection), decisions: d.items, activities: activitiesOf(a.items), screen: sc, track: tr, settings: st.items.find((x) => x.id === 'numbers') ?? null, routines: rt, planner: pl };
});
const sectionsOf = (data) => [...SECTIONS, ...data.ownSections];

/** The line under the home tile. */
export function tileNote(hub) {
  const r = load(hub);
  if (!r.data) return null;
  const due = trackNote(r.data.track, kidsOf(hub.people.list(), hub.today()));
  if (due) return due;
  const today = plannedOn(r.data.activities, hub.today());
  if (today.length) return `Planned today: ${today[0].name}`;
  return noteFor(dashboard(topicsOf(r.data.records), r.data.decisions, kidsOf(hub.people.list(), hub.today()), sectionsOf(r.data)));
}

export function render(hub, route) {
  const r = load(hub);
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  EMERGENCY = numbersOf(r.data.settings);
  const ctx = { hub, data: r.data, topics: topicsOf(r.data.records), sections: sectionsOf(r.data), kids: kidsOf(hub.people.list(), hub.today()), decisions: parentingDecisions(r.data.decisions) };
  if (route.sub === 'agree') return dashScreen(ctx);
  if (route.sub === 'play') return playScreen(hub, r.data.activities, ctx.kids);
  if (route.sub === 'ideas') return ideasScreen(hub, r.data.activities);
  if (route.sub === 'idea') return ideaScreen(hub, r.data.activities, route.rest[0], ctx.kids);
  if (route.sub === 'idea-edit') return ideaEdit(hub, r.data.activities, route.rest[0]);
  if (route.sub === 'idea-new') return ideaEdit(hub, r.data.activities, null);
  if (route.sub === 'planner') return plannerScreen(hub, r.data.planner, r.data.activities, careRule(r.data.decisions, ctx.kids));
  if (route.sub === 'plan-new') return planEdit(hub, r.data.planner, null);
  if (route.sub === 'plan-edit') return planEdit(hub, r.data.planner, route.rest[0]);
  if (route.sub === 'routines') return routinesHome(hub, r.data.routines, ctx.kids);
  if (route.sub === 'routine') return routineRun(hub, r.data.routines, route.rest[0], ctx.kids);
  if (route.sub === 'routine-edit') return routineEdit(hub, r.data.routines, route.rest[0], ctx.kids);
  if (route.sub === 'routine-new') return routineEdit(hub, r.data.routines, null, ctx.kids);
  if (route.sub === 'numbers') return numbersScreen(hub, r.data.settings);
  if (route.sub === 'track') return trackHome(hub, r.data.track, ctx.kids);
  if (route.sub === 'tracker') return trackerScreen(hub, r.data.track, route.rest[0], ctx.kids, Object.fromEntries(r.data.records.filter((x) => x.plan).map((x) => [x.topicId, x.plan])));
  if (route.sub === 'scenario-new') return scenarioEdit(hub, r.data.track, null);
  if (route.sub === 'scenario-edit') return scenarioEdit(hub, r.data.track, route.rest[0]);
  if (route.sub === 'screen') return screenHome(hub, r.data.screen, ctx.kids, r.data.decisions);
  if (route.sub === 'screen-log') return logScreen(hub, r.data.screen, ctx.kids, r.data.decisions);
  if (route.sub === 'shows') return showsScreen(hub, r.data.screen, ctx.kids, r.data.decisions);
  if (route.sub === 'show') return showScreen(hub, r.data.screen, route.rest[0]);
  if (route.sub === 'show-edit') return showEdit(hub, r.data.screen, route.rest[0]);
  if (route.sub === 'show-new') return showEdit(hub, r.data.screen, null);
  if (route.sub === 'section') return sectionScreen(ctx, route.rest[0]);
  if (route.sub === 'topic') return topicScreen(ctx, route.rest[0]);
  if (route.sub === 'edit') return editScreen(ctx, route.rest[0]);
  if (route.sub === 'new') return editScreen(ctx, null, route.rest[0]);
  return doorsScreen(ctx);
}

/** The first page: think it through together, plan activities, or something to do right now. */
function doorsScreen(ctx) {
  const { hub, topics, kids } = ctx;
  const dash = dashboard(topics, ctx.data.decisions, kids, ctx.sections);
  const today = plannedOn(ctx.data.activities, hub.today());
  const soon = planned(ctx.data.activities, hub.today());
  const door = (screen, name, purpose, meta, field) => el('a', { class: 'tile', href: hub.href(screen), 'data-field': field, style: { minHeight: '9rem' } }, [
    el('span', { class: 'tile__name', text: name }), el('span', { class: 'tile__purpose', text: purpose }), meta ? el('span', { class: 'tile__meta', text: meta }) : null]);
  return el('section', { class: 'stack', 'aria-label': 'Parenting' }, [
    el('p', { class: 'muted', style: { margin: 0 }, text: 'For planning ahead - so when something happens, you have already worked out together how you will handle it.' }),
    el('div', { class: 'tiles' }, [
      door('agree', 'Agreements', 'Talk it through and decide ahead, together: the options, the trade-offs and the science.',
        [dash.worthAgreeing.length ? `${dash.worthAgreeing.length} worth agreeing now` : null, dash.comingUp.length ? `${dash.comingUp.length} coming up` : null, `${dash.agreed} of ${dash.total} agreed`].filter(Boolean).join(' · '), 'door:agree'),
      door('ideas', 'Ideas', 'Time to think: add activities and games, plan a day for one, adjust the rules.', soon.length ? `${soon.length} planned` : `${ctx.data.activities.length} ideas`, 'door:ideas'),
      door('play', 'Play now', 'No time to think: a few taps and something to do.', today.length ? `Planned today: ${today[0].name}` : null, 'door:play'),
      door('planner', 'Planner', 'What is on this week - each child and each of you, with trips and plans alongside.', null, 'door:planner'),
      door('routines', 'Routines', 'Leaving the house, bedtime, the morning - each child ticks off their own list.', null, 'door:routines'),
      door('track', 'Track', 'Something worrying you? Track it for a few days - for the doctor, or just to see.', trackNote(ctx.data.track, kids), 'door:track'),
      door('screen', 'Screen time', 'Notice, not judge: the week beside what you agreed, and shows ranked on your values.', (() => { const m = todayMinutes(ctx.data.screen.logs, hub.today()); return m ? `${m} min logged today` : null; })(), 'door:screen'),
    ]),
  ]);
}

const statusChip = (st) => el('span', { class: `small ${st === 'agreed' ? 'fin-better' : st === 'discussing' ? '' : 'muted'}`, text: `· ${STATUS_LABEL[st]}` });
const kidsWord = (ks) => ks.map((k) => `${k.name} (${ageLabel(k.months)})`).join(', ');
const decideHref = (id = '') => `#/decisions/new/${encodeURIComponent(`parenting:${id}`)}`;

function topicRow(ctx, t, status) {
  const tm = t.ages ? timing(t.ages.from, t.ages.to, ctx.kids) : null;
  return el('li', {}, [el('a', { class: 'list__main', href: ctx.hub.href('topic', t.id), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `topic:${t.id}` }, [
    el('strong', { text: t.title }), ' ', statusChip(status),
    el('div', { class: 'small muted', text: [t.ages ? rangeLabel(t.ages.from, t.ages.to) : null, tm?.when === 'now' ? `now for ${kidsWord(tm.now)}` : tm?.when === 'soon' ? `soon for ${tm.soon.map((k) => k.name).join(', ')}` : null, t.later ? 'not written yet' : null, t.own ? 'our own' : null].filter(Boolean).join(' · ') }),
  ])]);
}

function dashScreen(ctx) {
  const { hub, topics, sections, kids } = ctx;
  const dash = dashboard(topics, ctx.data.decisions, kids, sections);
  const decRow = ({ d, t }) => el('li', {}, [el('a', { href: `#/decisions/item/${encodeURIComponent(d.id)}`, text: d.title }),
    el('span', { class: 'small muted', text: ` · ${rangeLabel(d.ageFrom, d.ageTo)}${t.now.length ? ` · ${kidsWord(t.now)}` : t.soon.length ? ` · soon for ${t.soon.map((k) => k.name).join(', ')}` : ''}${d.hasAgreement ? '' : ' · not agreed yet'}` })]);
  const list = (title, rows, help, field) => (rows.length ? el('div', { class: 'panel stack', 'data-field': field }, [el('h2', { text: title, style: { margin: 0 } }), help ? el('p', { class: 'small muted', style: { margin: 0 }, text: help }) : null, el('ul', { class: 'list' }, rows)]) : null);
  return el('section', { class: 'stack', 'aria-label': 'Parenting' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Parenting' }),
    el('h1', { text: 'Agreements', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Decide how you will handle things before they happen, so you are not working it out at 3am. Not how to parent - the options, what each costs, how sure the science is, and what the two of you need to agree on. A starting point: change it, remove it, add your own.' }),
    el('div', { class: 'stats' }, [
      el('div', { class: 'stat', 'data-field': 'p-agreed' }, [el('div', { class: 'stat__value', text: `${dash.agreed} of ${dash.total}` }), el('div', { class: 'stat__label', text: 'topics agreed' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat__value', text: String(dash.discussing) }), el('div', { class: 'stat__label', text: 'being discussed' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'stat__value', text: String(dash.inForce.length) }), el('div', { class: 'stat__label', text: 'decisions in force now' })]),
    ]),
    el('p', { class: 'small', style: { margin: 0 }, 'data-field': 'p-kids', text: kids.length ? `Our children: ${kids.map((k) => `${k.name}, ${k.months == null ? 'no birthday yet' : k.months < 0 ? `due in ${-k.months} month${k.months === -1 ? '' : 's'}` : ageLabel(k.months)}`).join(' · ')}.` : 'Add the children - or the due date - on the People page, and each decision will say when it applies.' }),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add', title: 'Add our own topic', 'data-field': 'p-add' }),
      hub.data.installed('decisions') ? el('a', { class: 'btn', href: decideHref(), text: 'Decide', title: 'A decision without a topic, straight to Decisions' }) : null,
      el('button', { class: 'btn', type: 'button', text: 'Section', title: 'Add our own section', on: { click: () => addSection(hub) } }),
    ]),
    list('Worth agreeing now', dash.worthAgreeing.slice(0, 12).map((t) => topicRow(ctx, t, dash.status.get(t.id))), 'A child is this age now, or will be within 3 months, and it is not agreed yet.', 'p-worth'),
    list('Coming up', dash.comingUp.map(decRow), 'Agreed for an age a child reaches within 3 months.', 'p-soon'),
    list('In force now', dash.inForce.map(decRow), null, 'p-now'),
    dash.notNeeded.length ? el('details', { class: 'panel more' }, [el('summary', { text: `Not needed now (${dash.notNeeded.length})` }),
      el('p', { class: 'small muted', text: 'Kept - they apply again if a child reaches that age.' }), el('ul', { class: 'list' }, dash.notNeeded.map(decRow))]) : null,
    el('div', { class: 'tiles', 'data-field': 'p-sections' }, dash.bySection.map((s) => el('a', { class: 'tile', href: hub.href('section', s.id), 'data-field': `p-sec:${s.id}` }, [
      el('span', { class: 'tile__name', text: s.name }),
      el('span', { class: 'tile__purpose', text: s.purpose }),
      el('span', { class: 'tile__meta', text: s.total ? `${s.agreed} of ${s.total} agreed${s.discussing ? ` · ${s.discussing} discussing` : ''}` : 'Nothing yet' }),
    ]))),
    hub.data.installed('decisions') ? null : el('p', { class: 'small muted', text: 'Switch on Decisions under Settings to keep what you agree.' }),
  ]);
}

function addSection(hub) {
  const name = el('input', { class: 'input', placeholder: 'e.g. Faith at home', 'aria-label': 'Section name' });
  const purpose = el('input', { class: 'input', placeholder: 'What goes in it (optional)', 'aria-label': 'What goes in it' });
  const { close } = modal({
    title: 'Our own section', body: [name, purpose],
    foot: [el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Add', on: { click: async () => {
        if (!name.value.trim()) return;
        close();
        const saved = await saveRecord(hub, sectionsCol(hub), normaliseSection({ id: `s-${Date.now().toString(36)}`, name: name.value, purpose: purpose.value }));
        if (saved) hub.go('section', saved.id);
      } } })],
  });
}

function sectionScreen(ctx, id) {
  const { hub, topics, sections } = ctx;
  const s = sections.find((x) => x.id === id);
  if (!s) return el('div', { class: 'panel empty' }, [el('p', { text: 'This section no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'Parenting' })]);
  const mine = topics.filter((t) => t.section === id);
  const status = (t) => topicStatus(t, ctx.decisions);
  const written = mine.filter((t) => !t.later); const later = mine.filter((t) => t.later);
  const own = !SECTIONS.some((x) => x.id === id);
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('agree'), class: 'small', text: '‹ Agreements' }),
    el('h1', { text: s.name, style: { margin: 0 } }),
    s.purpose ? el('p', { class: 'muted', style: { margin: 0 }, text: s.purpose }) : null,
    id === 'emergency' ? el('div', {}, [el('a', { class: 'btn', href: hub.href('numbers'), text: 'Numbers', title: 'Who to call, where you live', 'data-field': 'p-numbers' })]) : null,
    el('div', { class: 'row' }, [el('a', { class: 'btn btn-primary', href: hub.href('new', id), text: 'Add', title: 'Add our own topic here' }),
      own ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${s.name}"?`, text: mine.length ? 'Its topics move to Decide together.' : 'It is empty.', confirmLabel: 'Remove', danger: true })) return;
        for (const t of mine) await saveRecord(hub, topicsCol(hub), normaliseRecord({ ...(t.record ?? { id: `pt_${t.id}`, topicId: t.id }), section: 'decide', edited: t.own ? t.record.edited : true, baseV: t.v ?? 0 }));
        await sectionsCol(hub).remove(id); hub.invalidate(); hub.go(null);
      } } }) : null]),
    written.length ? el('ul', { class: 'list panel' }, written.map((t) => topicRow(ctx, t, status(t)))) : el('div', { class: 'panel empty' }, [el('p', { text: 'No topics here yet - add your own.' })]),
    later.length ? el('div', { class: 'panel stack' }, [el('h2', { text: 'Not written yet', style: { margin: 0 } }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'On the list, to be written in a later version - or open one and write your own version now.' }),
      el('ul', { class: 'list' }, later.map((t) => topicRow(ctx, t, status(t))))]) : null,
  ]);
}

// Each topic's place in its flowchart, kept while the app is open.
const paths = new Map();

function stepsPanel(t) {
  const box = el('div', { class: 'stack', 'data-field': 'p-steps' });
  const draw = () => {
    const path = paths.get(t.id) ?? [t.steps.start];
    const node = stepAt(t.steps, path.at(-1));
    const go = (to) => { paths.set(t.id, [...path, to]); draw(); };
    const back = path.length > 1 ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: '‹ Back', on: { click: () => { paths.set(t.id, path.slice(0, -1)); draw(); } } }) : null;
    const again = path.length > 1 ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Start again', on: { click: () => { paths.delete(t.id); draw(); } } }) : null;
    const out = node.out ? el('div', { class: `panel ${node.out === 'now' ? 'fin-worse' : ''}`, style: { borderWidth: '2px' }, 'data-field': `p-out:${node.out}` }, [
      el('strong', { text: OUTCOMES[node.out] }),
      node.out === 'now' ? el('p', { style: { margin: '6px 0 0' }, text: EMERGENCY.slice(0, 2).map(([w, n]) => `${w}: ${n}`).join(' · ') }) : null,
    ]) : null;
    box.replaceChildren(...[
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Go through it together now, so it is familiar if it is ever needed.' }),
      node.q ? el('p', { style: { margin: 0, fontWeight: 600 }, text: node.q }) : null,
      out,
      node.say ? el('p', { style: { margin: 0 }, text: node.say }) : null,
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [...(node.answers ?? node.next ?? []).map(([label, to]) => el('button', { class: 'btn', type: 'button', text: label, on: { click: () => go(to) } })), back, again]),
      t.health ? el('p', { class: 'small', style: { margin: 0 }, text: GO_LINE }) : null,
    ].filter(Boolean));
  };
  draw();
  return box;
}

function leaningPanel(ctx, t) {
  const { hub } = ctx;
  const adults = adultsOf(hub.people.list(), hub.today());
  const me = hub.people.current()?.id ?? null;
  const l = leaningsFor(t.record, adults, me);
  const picks = (t.options ?? []).map((o) => o.name);
  const pick = el('select', { class: 'select', 'aria-label': 'Where I lean', 'data-field': 'p-pick', style: { maxWidth: '320px' } },
    [el('option', { value: '', text: 'Not sure yet' }), ...picks.map((p) => el('option', { value: p, text: p, selected: l.mine?.pick === p })), el('option', { value: 'Something else', text: 'Something else', selected: l.mine?.pick === 'Something else' })]);
  const why = el('textarea', { class: 'input', rows: 2, placeholder: 'Why - what matters most to me here', 'aria-label': 'Why', text: l.mine?.why ?? '', 'data-field': 'p-lean-why' });
  const save = () => saveRecord(hub, topicsCol(hub), normaliseRecord({ ...(t.record ?? { id: `pt_${t.id}`, topicId: t.id, own: false }), leanings: { ...(t.record?.leanings ?? {}), [me]: { pick: pick.value, why: why.value, at: new Date().toISOString() } } }));
  const shown = l.others.filter((o) => o.shown);
  const differ = l.mine && shown.some((o) => o.shown.pick !== l.mine.pick);
  return el('div', { class: 'panel stack', 'data-field': 'p-lean' }, [
    el('h2', { text: 'Where we each lean', style: { margin: 0 } }),
    !me ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'Choose who you are at the top of the page to give your view.' }) : el('div', { class: 'stack' }, [
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Each of you gives your own first - the other’s shows once you have given yours, so neither sways the other.' }),
      picks.length ? pick : null, why,
      el('div', {}, [el('button', { class: 'btn', type: 'button', text: 'Save', 'data-field': 'p-lean-save', on: { click: save } })]),
    ]),
    ...l.others.map((o) => el('p', { style: { margin: 0 } }, [el('strong', { text: `${o.name}: ` }),
      o.shown ? `${o.shown.pick || 'Not sure yet'}${o.shown.why ? ` - ${o.shown.why}` : ''}` : o.answered ? 'has given theirs - give yours to see it.' : 'not yet.'])),
    l.mine && shown.length ? el('p', { class: differ ? 'fin-worse' : 'fin-better', style: { margin: 0 }, text: differ ? 'You lean differently. The trade-offs above are what separate you - go through "Align on" together.' : 'You lean the same way.' }) : null,
  ]);
}

function topicScreen(ctx, id) {
  const { hub, kids } = ctx;
  const t = ctx.topics.find((x) => x.id === id);
  if (!t) return el('div', { class: 'panel empty' }, [el('p', { text: 'This topic was removed.' }), el('a', { class: 'btn', href: hub.href(), text: 'Parenting' })]);
  const sec = ctx.sections.find((s) => s.id === t.section);
  const status = topicStatus(t, ctx.decisions);
  const tm = t.ages ? timing(t.ages.from, t.ages.to, kids) : null;
  const mine = ctx.decisions.filter((d) => d.topicId === t.id);
  const rec = t.record ?? { id: `pt_${t.id}`, topicId: t.id };
  const put = (next) => saveRecord(hub, topicsCol(hub), normaliseRecord({ ...rec, ...next }));
  const ul = (xs) => el('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, xs.map((x) => el('li', { text: x })));
  const block = (title, body, field) => el('div', { class: 'panel stack', 'data-field': field }, [el('h2', { text: title, style: { margin: 0 } }), body]);
  const done = new Set(t.record?.done ?? []);
  const items = t.items ?? [];
  const health = t.health && el('p', { class: 'panel', style: { margin: 0, fontWeight: 600 }, 'data-field': 'p-go', text: GO_LINE });
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('section', t.section), class: 'small', text: `‹ ${sec?.name ?? 'Parenting'}` }),
    el('h1', { text: t.title, style: { margin: 0 } }),
    el('p', { class: 'small', style: { margin: 0 } }, [statusChip(status), t.ages ? ` · ${rangeLabel(t.ages.from, t.ages.to)}` : '', tm?.now.length ? ` · now for ${kidsWord(tm.now)}` : tm?.soon.length ? ` · soon for ${tm.soon.map((k) => k.name).join(', ')}` : '']),
    health,
    t.newer ? el('div', { class: 'panel row', 'data-field': 'p-newer', style: { alignItems: 'center', gap: 'var(--space-2)' } }, [el('span', { style: { flex: '1 1 200px' }, text: 'Newer version: this topic has been improved since you changed it.' }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Keep mine', on: { click: () => put({ baseV: t.v }) } }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Take new', on: { click: () => put({ edited: false, baseV: t.v }) } })]) : null,
    t.later ? el('div', { class: 'panel empty' }, [el('p', { text: 'Not written yet - it will come in a later version. You can write your own version now, or decide on it straight away.' })]) : null,
    t.question ? el('p', { style: { margin: 0, fontSize: '1.1em', fontStyle: 'italic' }, text: t.question }) : null,
    t.summary ? el('p', { style: { margin: 0 }, text: t.summary }) : null,
    t.prepare ? el('div', { class: 'panel stack', 'data-field': 'p-prepare' }, [el('h2', { text: 'Prepare now', style: { margin: 0 } }),
      ...[['Have ready', t.prepare.ready], ['Who does what', t.prepare.who], ['Practise', t.prepare.practise]].filter(([, xs]) => xs?.length).map(([h, xs]) => el('div', {}, [el('strong', { text: h }), el('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, xs.map((x) => el('li', { text: x })))]))]) : null,
    t.id === 'fever' ? feverPlanPanel(hub, t, put) : null,
    t.id === 'stock' ? chartPanel(hub, t, put, { key: 'meds', title: 'Our medicine chart', help: 'What each medicine is for, from what age, and how much - copied from the label and checked with your pharmacist for each child’s weight. Print it every few months as they grow.', printNote: 'From the labels and our pharmacist - check the label before every dose. If you are wondering whether to see a doctor, go.',
      columns: [['name', 'Medicine', 'e.g. Children’s paracetamol'], ['for', 'For', 'e.g. fever, pain'], ['age', 'From what age', 'e.g. 3 months'], ['dose', 'How much', 'as on the label'], ['often', 'How often / most a day', 'e.g. every 6 h, 4 a day'], ['note', 'Note', '']] }) : null,
    t.id === 'clothes' ? chartPanel(hub, t, put, { key: 'layers', title: 'What they wear at what temperature', help: 'Your own chart for the room temperature the thermometer shows - by age if it changes.',
      columns: [['age', 'Age', 'e.g. 0-6 months'], ['temp', 'Room temperature', 'e.g. 16-18 °C'], ['wear', 'What they wear', 'e.g. vest, sleepsuit, sleeping bag'], ['note', 'Note', '']] }) : null,
    t.steps ? el('details', { class: 'panel more', 'data-field': 'p-practise' }, [el('summary', { text: t.id === 'fever' ? 'What health services advise - to practise and compare with your plan' : 'Practise the steps' }), stepsPanel(t)]) : null,
    t.signs ? block('Signs to act on', el('p', { style: { margin: 0 }, text: t.signs }), 'p-signs') : null,
    t.health || t.section === 'emergency' ? block('Who to call', el('div', { class: 'stack' }, [el('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, EMERGENCY.map(([w, n]) => el('li', {}, [`${w}: `, el('a', { href: `tel:${n.replace(/[^\d+]/g, '')}`, text: n })]))),
      el('div', {}, [el('a', { class: 'btn btn-small', href: hub.href('numbers'), text: 'Change', title: 'Your numbers, for where you live' })])]), 'p-call') : null,
    items.length ? block('Checklist', el('div', { class: 'stack', style: { gap: '4px' } }, items.map((x) => el('label', { class: 'checkline' }, [
      el('input', { type: 'checkbox', checked: done.has(x), on: { change: (e) => { const next = new Set(done); if (e.target.checked) next.add(x); else next.delete(x); put({ done: [...next] }); } } }), x]))), 'p-check') : null,
    t.options?.length ? block('The options', el('div', { class: 'stack' }, t.options.map((o) => el('div', { class: 'panel panel--soft stack', style: { gap: '4px' } }, [
      el('strong', { text: o.name }),
      o.note ? el('div', { text: o.note }) : null,
      o.strengths?.length ? el('div', { class: 'small fin-better', text: `For: ${o.strengths.join('; ')}` }) : null,
      o.weaknesses?.length ? el('div', { class: 'small fin-worse', text: `Against: ${o.weaknesses.join('; ')}` }) : null,
      o.fits ? el('div', { class: 'small', text: `Fits: ${o.fits}` }) : null,
      o.notFits ? el('div', { class: 'small', text: `Not for: ${o.notFits}` }) : null,
      o.timing ? el('div', { class: 'small muted', text: `When: ${o.timing}` }) : null,
    ]))), 'p-options') : null,
    t.why?.length ? block('Why - and how sure we are', el('ul', { class: 'list' }, t.why.map((w) => el('li', {}, [el('div', { class: 'list__main' }, [
      el('div', { text: w.text }),
      el('div', { class: 'small muted' }, [el('strong', { text: LEVELS[w.level]?.name ?? '', title: LEVELS[w.level]?.text ?? '' }), SOURCES[w.source] ? [' · ', el('a', { href: SOURCES[w.source].url, target: '_blank', rel: 'noopener', text: SOURCES[w.source].name })] : null].flat().filter(Boolean)),
    ])]))), 'p-why') : null,
    t.changes?.length ? block('What changes the answer', ul(t.changes), 'p-changes') : null,
    t.kind !== 'checklist' ? videosPanel(hub, { creators: rec.creators, videos: rec.videos, views: rec.views }, (changes) => put(changes)) : null,
    t.questions?.length ? questionsPanel(hub, t, ctx.decisions, put) : t.kind !== 'checklist' && !t.later ? leaningPanel(ctx, t) : null,
    t.align?.length ? block('Align on together', ul(t.align), 'p-align') : null,
    t.family?.length ? block('Discuss with family', el('div', { class: 'stack' }, [ul(t.family),
      el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Copy', title: 'Copy these for the family', on: { click: async () => { try { await navigator.clipboard.writeText(`${t.title}\n${t.family.map((x) => `- ${x}`).join('\n')}`); hub.ui.notice('Copied.'); } catch { hub.ui.notice('Could not copy - select the text instead.'); } } } })])]), 'p-family') : null,
    block('Our decisions', el('div', { class: 'stack' }, [
      mine.length ? el('ul', { class: 'list' }, mine.map((d) => el('li', {}, [el('a', { href: `#/decisions/item/${encodeURIComponent(d.id)}`, text: d.title }),
        el('span', { class: 'small muted', text: ` · ${rangeLabel(d.ageFrom, d.ageTo)} · ${d.hasAgreement ? 'agreed' : 'being worked out'}` })]))) : el('p', { class: 'small muted', style: { margin: 0 }, text: 'Nothing decided yet. One topic can hold several decisions - for example one for under 1 and another for 4 to 5.' }),
      hub.data.installed('decisions') ? el('div', {}, [el('a', { class: 'btn btn-primary', href: decideHref(t.id), text: 'Decide', 'data-field': 'p-decide' })]) : el('p', { class: 'small muted', text: 'Switch on Decisions under Settings to keep what you agree.' }),
    ]), 'p-decisions'),
    t.why?.length ? el('p', { class: 'small muted', style: { margin: 0 }, text: `Sources checked ${SOURCES[t.why[0].source]?.checked ?? ''}. ${Object.values(LEVELS).map((x) => `${x.name}: ${x.text}`).join(' ')}` }) : null,
    health ? el('p', { class: 'small', style: { margin: 0, fontWeight: 600 }, text: GO_LINE }) : null,
    el('div', { class: 'row' }, [
      el('a', { class: 'btn', href: hub.href('edit', t.id), text: t.later ? 'Write' : 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${t.title}"?`, text: t.own ? 'Your topic is removed. Decisions made from it stay in Decisions.' : 'It is hidden from your Parenting. Decisions made from it stay in Decisions.', confirmLabel: 'Remove', danger: true })) return;
        await put({ removed: true }); hub.go('section', t.section);
      } } }),
    ]),
  ]);
}

function editScreen(ctx, id, sectionId = null) {
  const { hub } = ctx;
  const t = id ? ctx.topics.find((x) => x.id === id) : null;
  if (id && !t) return el('div', { class: 'panel empty' }, [el('p', { text: 'This topic was removed.' })]);
  const ageSel = (key, label, none, v) => ({ key, label, type: 'custom', control: () => {
    const s = el('select', { class: 'select', style: { maxWidth: '240px' }, 'data-field': `p-${key}` }, [el('option', { value: '', text: none, selected: v == null }),
      ...AGES.map((m) => el('option', { value: m, text: m === 0 ? 'Birth' : ageLabel(m).replace(/^./, (c) => c.toUpperCase()), selected: v === m }))]);
    return { node: s, get: () => (s.value === '' ? null : Number(s.value)) };
  } });
  const starter = t && !t.own;
  const record = t ? { title: t.title, section: t.section, question: t.question ?? '', summary: t.summary ?? '', align: t.align ?? [], family: t.family ?? [], items: t.items ?? [], options: t.own ? (t.options ?? []).map((o) => (o.note ? `${o.name}: ${o.note}` : o.name)) : [] }
    : { section: sectionId ?? 'decide' };
  return el('section', { class: 'stack' }, [
    el('h1', { text: t ? `${t.later ? 'Write' : 'Edit'} ${t.title}` : 'Our own topic' }),
    starter && !t.later ? el('p', { class: 'small muted', text: 'Your changes are kept. If this topic is improved later, it offers the newer version and you choose.' }) : null,
    recordForm({
      record,
      fields: [
        { key: 'title', label: 'Topic', required: true, placeholder: 'e.g. Bedtime routine' },
        { key: 'section', label: 'Section', type: 'select', options: ctx.sections.map((s) => [s.id, s.name]) },
        { key: 'question', label: 'The question', placeholder: 'What are we trying to decide or understand?' },
        ageSel('ageFrom', 'Matters from the age of', 'Any age', t?.ages?.from ?? null),
        ageSel('ageTo', 'Until the age of', 'No end', t?.ages?.to ?? null),
        { key: 'summary', label: 'What we know', type: 'textarea', rows: 4 },
        !starter || t.later ? { key: 'options', label: 'The options', type: 'lines', hint: 'One per line. "Name: what we think of it" if you like.' } : null,
        { key: 'align', label: 'Align on together', type: 'lines', more: true },
        { key: 'family', label: 'Discuss with family', type: 'lines', more: true },
        { key: 'items', label: 'Checklist', type: 'lines', more: true, hint: 'Only for a checklist: one item per line.' },
      ].filter(Boolean),
      onCancel: () => (t ? hub.go('topic', t.id) : hub.go(null)),
      onSave: async (values) => {
        const topicId = t ? t.id : ownId(values.title);
        const base = t?.record ?? { id: `pt_${topicId}`, topicId, own: !t };
        const saved = await saveRecord(hub, topicsCol(hub), normaliseRecord({ ...base, ...values, edited: !!t && !t.own ? true : base.edited, own: base.own, baseV: t?.v ?? 0 }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('topic', topicId); }
      },
    }),
  ]);
}

/** The family's emergency numbers (D-103): start from a country, then change, remove and add your own. */
function numbersScreen(hub, settings) {
  const rows = numbersOf(settings).map(([l, n]) => ({ l, n }));
  const box = el('div', { class: 'stack', 'data-field': 'num-rows' });
  const draw = () => box.replaceChildren(...rows.map((r, i) => el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [
    el('input', { class: 'input', value: r.l, 'aria-label': 'What it is', style: { flex: '2 1 160px' }, 'data-field': `num-l:${i}`, on: { input: (e) => { r.l = e.target.value; } } }),
    el('input', { class: 'input', value: r.n, inputmode: 'tel', 'aria-label': 'Number', style: { flex: '1 1 110px' }, 'data-field': `num-n:${i}`, on: { input: (e) => { r.n = e.target.value; } } }),
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => { rows.splice(i, 1); draw(); } } }),
  ])));
  draw();
  const country = el('select', { class: 'select', style: { maxWidth: '240px' }, 'aria-label': 'Country', 'data-field': 'num-country' }, [el('option', { value: '', text: 'Start from a country…' }), ...Object.entries(COUNTRY_NUMBERS).map(([k, c]) => el('option', { value: k, text: c.name }))]);
  country.addEventListener('change', () => { const c = COUNTRY_NUMBERS[country.value]; if (!c) return; rows.splice(0, rows.length, ...c.numbers.map(([l, n]) => ({ l, n }))); draw(); });
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('section', 'emergency'), class: 'small', text: '‹ Be prepared' }),
    el('h1', { text: 'Who to call', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'The numbers shown on every health topic and plan. Start from your country, check them for where you live, and add your own doctor, clinic and after-hours line.' }),
    country, box,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: () => { rows.push({ l: '', n: '' }); draw(); } } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'num-save', on: { click: async () => {
        const numbers = rows.filter((r) => r.n.trim()).map((r) => [r.l.trim() || 'Number', r.n.trim()]);
        if (await saveRecord(hub, settingsCol(hub), { ...(settings ?? {}), id: 'numbers', numbers })) hub.ui.notice('Saved.');
      } } }),
    ]),
  ]);
}
