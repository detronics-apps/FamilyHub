// Decisions and experiments: agree something, try it, look back, adapt.
// Screens: list (default), item, new (optionally from a ticket), edit.

import { el } from '../../ui/dom.js';
import { confirmAction, modal } from '../../ui/common.js';
import { fmtDay, addDays } from '../../dates.js';
import { loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import {
  normaliseDecision, decisionSummary, decisionText, stage, startTrial, addObservation, recordOutcome, revise,
  STAGES, STAGE_LABEL, OUTCOMES, categoryOf, CATEGORY_LABEL, CARE_LABEL,
} from './logic.js';
import { STARTER } from '../parenting/content.js';
import { QUESTIONS } from '../parenting/questions.js';
import { kidsOf, timing, rangeLabel, ageLabel, planText } from '../parenting/logic.js';
import { videosPanel } from '../parenting/videos.js';

const ui = { cat: '', topic: '' };   // the list's filters (D-095)
// Ages a decision can apply from and to, in months.
const AGES = [-6, -3, 0, 1, 2, 3, 4, 6, 9, 12, 18, 24, 36, 48, 60, 72, 96, 120, 144, 168, 192, 216];

/**
 * A Parenting topic's title and question: a starting one, or the family's own (read from Parenting).
 * "topic:question" is one question of it (D-106); "fever:plan" is the fever plan the parents wrote.
 */
function parentingTopic(hub, ref) {
  const [id, qid] = String(ref ?? '').split(':');
  const s = STARTER.find((t) => t.id === id);
  if (s && qid === 'plan') {
    if (!hub.data.installed('parenting')) return { data: { ...s, title: `${s.title}: our plan` } };
    return hub.use(`pplan:${id}`, async () => {
      const { items } = await hub.data.of('parenting', 'topics').list({ filter: (r) => r.topicId === id, limit: 1 });
      return { ...s, title: `Our ${s.title.toLowerCase()} plan`, question: 'Our plan, by age: what we do at what temperature, and when we go to a doctor.', agreementText: planText(items[0]?.plan ?? {}), options: [] };
    });
  }
  const q = s && qid ? (QUESTIONS[id] ?? []).find((x) => x.id === qid) : null;
  if (q) return { data: { ...s, title: `${s.title}: ${q.ask}`, question: [q.ask, ...q.think.map((x) => `- ${x}`)].join('\n'), options: q.options } };
  if (s) return { data: s };
  if (!id || !hub.data.installed('parenting')) return { data: null };
  return hub.use(`ptopic:${id}`, async () => {
    const { items } = await hub.data.of('parenting', 'topics').list({ filter: (r) => r.topicId === id, limit: 1 });
    return items[0] ? { id, title: items[0].title, question: items[0].question, ages: { from: items[0].ageFrom ?? null, to: items[0].ageTo ?? null } } : null;
  });
}
/** "From birth to 12 months - now to Emma (8 months)". */
function appliesLine(hub, d) {
  if (d.ageFrom == null && d.ageTo == null) return null;
  const t = timing(d.ageFrom, d.ageTo, kidsOf(hub.people.list(), hub.today()));
  const who = t.now.length ? ` - now to ${t.now.map((k) => `${k.name} (${ageLabel(k.months)})`).join(', ')}` : t.soon.length ? ` - soon for ${t.soon.map((k) => k.name).join(', ')}` : t.when === 'past' ? ' - not needed now' : '';
  return `${rangeLabel(d.ageFrom, d.ageTo)}${who}`;
}

const col = (hub) => hub.data.collection('decisions', { summary: decisionSummary, text: decisionText, prefix: 'dec' });
const all = (hub) => hub.use('all', async () => (await col(hub).list({ limit: 100000 })).items);

export function render(hub, route) {
  if (route.sub === 'item') return itemScreen(hub, route.rest[0]);
  if (route.sub === 'new') return editScreen(hub, null, route.rest[0] ?? null);
  if (route.sub === 'edit') return editScreen(hub, route.rest[0]);
  return listScreen(hub);
}

function cycle(current) {
  return el('ol', { class: 'cycle', 'aria-label': 'Where this is in the cycle' }, STAGES.map((s) => el('li', {
    class: `cycle__step${s === current ? ' cycle__step--now' : ''}`, 'aria-current': s === current ? 'step' : null, text: STAGE_LABEL[s],
  })));
}

function listScreen(hub) {
  const list = all(hub);
  if (list.loading) return loading();
  if (list.error) return failure(list.error);
  const today = hub.today();
  const cats = [...new Set(list.data.map(categoryOf).filter((c) => CATEGORY_LABEL[c]))];
  if (ui.cat && !cats.includes(ui.cat)) { ui.cat = ''; ui.topic = ''; }
  const shown = list.data.filter((s) => (!ui.cat || categoryOf(s) === ui.cat) && (!ui.topic || (s.source ?? '').slice(10).split(':')[0] === ui.topic));
  const topicIds = [...new Set(list.data.filter((s) => categoryOf(s) === 'parenting').map((s) => s.source.slice(10)))];
  const filters = cats.length ? el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Show' }, [['', 'All'], ...cats.map((c) => [c, CATEGORY_LABEL[c]])].map(([c, label]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(ui.cat === c), text: label, 'data-field': `dec-cat:${c || 'all'}`,
      on: { click: () => { ui.cat = c; ui.topic = ''; hub.render(); } } }))),
    ui.cat === 'parenting' && new Set(topicIds.map((id) => id.split(':')[0])).size > 1 ? el('select', { class: 'select', 'aria-label': 'Topic', 'data-field': 'dec-topic', style: { maxWidth: '240px' }, on: { change: (e) => { ui.topic = e.target.value; hub.render(); } } },
      [el('option', { value: '', text: 'Every topic', selected: !ui.topic }), ...[...new Set(topicIds.map((id) => id.split(':')[0]))].map((id) => el('option', { value: id, text: STARTER.find((t) => t.id === id)?.title ?? (id ? 'Our own topic' : 'No topic'), selected: ui.topic === id }))]) : null,
  ]) : null;
  const by = (st) => shown.filter((s) => stage(s, today) === st || (st === 'discuss' && ['observe', 'discuss', 'decide'].includes(stage(s, today))));
  const section = (title, items, help) => (items.length ? el('div', { class: 'panel' }, [
    el('h2', { text: title }),
    help ? el('p', { class: 'small muted', text: help }) : null,
    el('ul', { class: 'list' }, items.map((s) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
        el('strong', { text: s.title }),
        el('div', { class: 'small muted', text: [STAGE_LABEL[stage(s, today)], appliesLine(hub, s), s.reviewOn && s.status === 'trying' ? `look back ${fmtDay(s.reviewOn, today)}` : null, s.outcome ? OUTCOMES[s.outcome] : null].filter(Boolean).join(' · ') }),
      ]),
    ]))),
  ]) : null);
  const settled = shown.filter((s) => s.status === 'settled');

  return el('section', { class: 'stack', 'aria-label': 'Decisions' }, [
    el('div', { class: 'row' }, [
      el('p', { class: 'muted', style: { margin: 0, flex: '1 1 260px' }, text: 'Agreements and experiments. Each is the best idea for now - try it, look back, and change it if it is not working.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'New decision', 'data-field': 'add-decision' }),
    ]),
    filters,
    list.data.length ? null : el('div', { class: 'panel empty' }, [el('p', { text: 'Nothing yet. A decision often starts from a ticket discussed at the family meeting - or start one here.' })]),
    section('Time to look back', by('review'), 'The trial period is up. How did it go?'),
    section('Trying now', by('experiment')),
    section('Being worked out', by('discuss')),
    settled.length ? el('details', { class: 'panel more' }, [
      el('summary', { text: `Settled (${settled.length})` }),
      el('ul', { class: 'list' }, settled.map((s) => el('li', {}, [el('a', { href: hub.href('item', s.id), text: s.title }), el('span', { class: 'small muted', text: ` · ${OUTCOMES[s.outcome] ?? ''}` })]))),
    ]) : null,
  ]);
}

function itemScreen(hub, id) {
  const r = hub.use(`item:${id}`, () => col(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This decision no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'All decisions' })]);
  const d = normaliseDecision(r.data);
  const today = hub.today();
  const people = hub.people.list();
  const me = hub.people.current();
  const st = stage(d, today);
  const save = (next, message) => saveRecord(hub, col(hub), next).then((x) => { if (x && message) hub.ui.notice(message); });
  const actions = hub.data.installed('tasks') ? hub.use(`actions:${id}`, () => hub.data.of('tasks', 'tasks').list({ filter: (s) => s.source === `decisions:${id}`, limit: 50 })) : null;
  const sourceTicket = d.source?.startsWith('tickets:') && hub.data.installed('tickets')
    ? hub.use(`ticket:${d.source}`, () => hub.data.of('tickets', 'tickets').get(d.source.slice(8)))
    : null;
  const obs = el('input', { class: 'input', placeholder: 'What did you notice?', 'aria-label': 'Add an observation', 'data-field': 'add-observation' });
  obs.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(addObservation(d, obs.value, { by: me?.id ?? null, today })); } });
  const block = (title, body) => (body && (!Array.isArray(body) || body.length)
    ? el('div', {}, [el('h3', { text: title }), Array.isArray(body) ? el('ul', {}, body.map((x) => el('li', { text: x }))) : el('p', { text: body, style: { whiteSpace: 'pre-wrap' } })])
    : null);

  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Decisions' }),
    el('article', { class: 'panel stack' }, [
      el('h1', { text: d.title, style: { margin: 0 } }),
      cycle(st),
      d.source?.startsWith('parenting:') ? el('p', { class: 'small' }, ['From Parenting: ', el('a', { href: `#/parenting/topic/${encodeURIComponent(d.source.slice(10).split(':')[0])}`, text: parentingTopic(hub, d.source.slice(10).split(':')[0]).data?.title ?? 'the topic' })]) : null,
      appliesLine(hub, d) ? el('p', { class: 'small', 'data-field': 'dec-applies', text: `Applies: ${appliesLine(hub, d)}.` }) : null,
      d.careBy ? el('p', { class: 'small', text: `Who looks after the children: ${CARE_LABEL[d.careBy]}.` }) : null,
      d.screenMinutes != null || d.screenMinScore != null ? el('p', { class: 'small', text: `Screen time: ${[d.screenMinutes != null ? `up to ${d.screenMinutes} minutes a day` : null, d.screenMinScore != null ? `only shows scoring ${d.screenMinScore} or more` : null].filter(Boolean).join('; ')}.` }) : null,
      sourceTicket?.data ? el('p', { class: 'small' }, ['Started from a ticket: ', el('a', { href: `#/tickets/item/${encodeURIComponent(sourceTicket.data.id)}`, text: (sourceTicket.data.text || '').split('\n')[0].slice(0, 80) })]) : null,
      block('What is happening', d.issue),
      block('What we want', d.purpose),
      block('Options we considered', d.alternatives),
      block('Our reasoning', d.reasoning),
      d.agreement ? el('div', { class: 'done-panel' }, [el('h3', { text: 'What we agreed' }), el('p', { text: d.agreement, style: { whiteSpace: 'pre-wrap', margin: 0 } })]) : null,
      d.participants.length ? el('p', { class: 'small muted', text: `Agreed by ${d.participants.map((x) => nameOf(people, x)).join(', ')}` }) : null,
      block('What would change our mind', d.changeMind),
      block('How we will know it is working', d.indicators),
      d.status === 'trying' && d.reviewOn ? el('p', { class: 'small', text: st === 'review' ? `The trial period ended ${fmtDay(d.reviewOn, today)} - time to look back.` : `Look back on ${fmtDay(d.reviewOn, today)}.` }) : null,
      d.outcome ? el('p', { text: `Outcome: ${OUTCOMES[d.outcome]}.` }) : null,
      block('What we learned', d.lessons),
    ]),
    el('div', { class: 'row' }, [
      d.status === 'discussing' ? el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Start trying', 'data-field': 'start-trial',
        on: { click: () => { if (!d.agreement) { hub.go('edit', d.id); return; } save(startTrial(d, today), 'Trying it now. You will be reminded to look back.'); } },
      }) : null,
      d.status === 'trying' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Look back', 'data-field': 'look-back', on: { click: () => lookBack(hub, d, save) } }) : null,
      d.status !== 'discussing' ? el('button', { class: 'btn', type: 'button', text: 'Edit agreement', on: { click: () => reviseDialog(hub, d, save, today) } }) : null,
      el('a', { class: 'btn', href: hub.href('edit', d.id), text: 'Edit' }),
    ]),
    videosPanel(hub, d, (changes) => save({ ...d, ...changes }, 'Saved.'), { help: 'Videos that explain a side of this decision - watch, then say where you each stand.' }),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Observations' }),
      d.observations.length ? el('ul', { class: 'list' }, d.observations.map((o) => el('li', {}, [
        el('span', { class: 'list__main', text: o.text }),
        el('span', { class: 'small muted', text: [o.day ? fmtDay(o.day, today) : null, o.by ? nameOf(people, o.by) : null].filter(Boolean).join(' · ') }),
      ]))) : el('p', { class: 'small muted', text: 'Notice how it is going - reactions, how easy it is, how it works for parents. A line at a time is plenty.' }),
      obs,
    ]),
    actions ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Actions' }),
      actions.data?.items?.length ? el('ul', { class: 'list' }, actions.data.items.map((s) => el('li', {}, [el('a', { href: `#/tasks/item/${encodeURIComponent(s.id)}`, text: s.title }), el('span', { class: 'small muted', text: ` · ${{ open: 'to do', doing: 'in progress', done: 'done', dropped: 'no longer needed' }[s.status] ?? s.status}` })]))) : el('p', { class: 'small muted', text: 'No actions yet.' }),
      el('a', { class: 'btn', href: `#/tasks/new/${encodeURIComponent(`decisions:${d.id}`)}`, text: 'New action' }),
    ]) : null,
    d.history.length ? el('details', { class: 'panel more' }, [
      el('summary', { text: `Earlier agreements (${d.history.length})` }),
      el('ul', { class: 'list' }, d.history.slice().reverse().map((h) => el('li', {}, [el('span', { class: 'list__main', text: h.agreement }), el('span', { class: 'small muted', text: `until ${fmtDay(h.at.slice(0, 10), today)}${h.outcome ? ` · ${OUTCOMES[h.outcome]}` : ''}` })]))),
    ]) : null,
    el('button', {
      class: 'btn btn-danger', type: 'button', text: 'Delete',
      on: {
        click: async () => {
          if (!await confirmAction({ title: `Delete "${d.title}"?`, text: 'Settled decisions keep their reasoning for later; deleting cannot be undone.', confirmLabel: 'Delete', danger: true })) return;
          await col(hub).remove(d.id);
          hub.invalidate();
          hub.go(null);
        },
      },
    }),
  ]);
}

function lookBack(hub, d, save) {
  let outcome = 'kept';
  const lessons = el('textarea', { class: 'input', rows: 3, placeholder: 'What did we learn?', 'aria-label': 'What we learned' });
  const { close } = modal({
    title: 'How did it go?',
    body: [
      d.observations.length ? el('ul', { class: 'small' }, d.observations.slice(-5).map((o) => el('li', { text: o.text }))) : null,
      el('fieldset', {}, [el('legend', { text: 'What now?' }), ...Object.entries(OUTCOMES).map(([k, label]) => el('label', { class: 'checkline' }, [
        el('input', { type: 'radio', name: 'outcome', value: k, checked: k === 'kept', on: { change: () => { outcome = k; } } }), label,
      ]))]),
      lessons,
    ],
    foot: [
      el('button', { class: 'btn', type: 'button', text: 'Not yet', on: { click: () => close() } }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'outcome-save',
        on: { click: () => { close(); save(recordOutcome(d, outcome, lessons.value), outcome === 'replaced' || outcome === 'improved' ? 'Saved. Use "Change the agreement" to write down the new version.' : 'Saved.'); } },
      }),
    ],
  });
}

function reviseDialog(hub, d, save, today) {
  const text = el('textarea', { class: 'input', rows: 4, text: d.agreement, 'aria-label': 'The new agreement' });
  const review = el('input', { class: 'input', type: 'date', value: addDays(today, 14), 'aria-label': 'Look back on', style: { maxWidth: '200px' } });
  const err = el('p', { class: 'small', role: 'alert', style: { color: 'var(--danger)' } });
  const { close } = modal({
    title: 'Change the agreement',
    body: [el('p', { class: 'small', text: 'The current agreement is kept in the history, so you can see how your thinking changed.' }), text, el('label', { class: 'field__label', text: 'Look back on' }), review, err],
    foot: [
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Save & try',
        on: { click: () => { try { const next = revise(d, text.value, { today, reviewOn: review.value }); close(); save(next, 'New agreement saved. Trying it now.'); } catch (e) { err.textContent = e.message; } } },
      }),
    ],
  });
}

function editScreen(hub, id, from = null) {
  const r = id ? hub.use(`item:${id}`, () => col(hub).get(id)) : { data: null };
  const ticket = !id && from?.startsWith('tickets:') && hub.data.installed('tickets')
    ? hub.use(`ticket:${from}`, () => hub.data.of('tickets', 'tickets').get(from.slice(8)))
    : null;
  const topic = !id && from?.startsWith('parenting:') ? parentingTopic(hub, from.slice(10)) : null;
  if (r.loading || ticket?.loading || topic?.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseDecision(r.data) : null;
  const t = ticket?.data;
  const pt = topic?.data;
  const record = existing ?? normaliseDecision({
    title: t ? t.text.split('\n')[0].slice(0, 80) : pt ? pt.title : '',
    issue: t ? t.text : pt?.question ?? '',
    alternatives: pt?.options?.map((o) => o.name) ?? [],
    source: t ? `tickets:${t.id}` : from?.startsWith('parenting:') ? from : null,
    ageFrom: pt?.ages?.from ?? null, ageTo: pt?.ages?.to ?? null,
    agreement: pt?.agreementText ?? '',
  });
  const ageField = (key, label, none) => ({ key, label, type: 'custom', control: () => {
    const s = el('select', { class: 'select', 'data-field': `dec-${key}`, style: { maxWidth: '240px' } }, [el('option', { value: '', text: none, selected: record[key] == null }),
      ...AGES.map((m) => el('option', { value: m, text: m === 0 ? 'Birth' : ageLabel(m).replace(/^./, (c) => c.toUpperCase()), selected: record[key] === m }))]);
    return { node: s, get: () => (s.value === '' ? null : Number(s.value)) };
  } });
  const parenting = record.source?.startsWith('parenting:');
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'New decision' }),
    t ? el('p', { class: 'small muted', text: 'Started from a ticket - the ticket is linked, and will show this decision.' }) : null,
    !existing && parenting ? el('p', { class: 'small muted', text: `From Parenting${pt ? `: ${pt.title}` : ''}. It shows there as agreed once "What we agree" is filled in.` }) : null,
    recordForm({
      record: { ...record, title: existing || t || pt ? record.title : '' },
      people: hub.people.list(),
      fields: [
        { key: 'title', label: 'What is it about?', required: true, placeholder: 'e.g. Screen-time transitions' },
        { key: 'issue', label: 'What is happening', type: 'textarea' },
        { key: 'agreement', label: parenting ? 'What we agree' : 'What we agree to try', type: 'textarea', hint: 'Can stay empty while you talk it through.' },
        record.source?.startsWith('parenting:childcare') ? { key: 'careBy', label: 'Who may look after the children', type: 'select', options: [['', 'Not set'], ...Object.entries(CARE_LABEL)], hint: 'The app follows this: with "Only us", nothing ever asks about a babysitter.' } : null,
        record.source === 'parenting:screens' ? { key: 'screenMinutes', label: 'Screen time a day, at most (minutes)', type: 'number', hint: 'Empty for none set. Screen time shows each day against it.' } : null,
        record.source === 'parenting:screens' ? { key: 'screenMinScore', label: 'Only shows scoring at least (out of 5)', type: 'number', placeholder: 'e.g. 3.5', hint: 'Your own scores under Screen time › Shows. Empty for no minimum.' } : null,
        ageField('ageFrom', 'Applies from the age of', 'Any age'),
        ageField('ageTo', 'Until the age of', 'No end'),
        { key: 'purpose', label: 'What we want to achieve', type: 'textarea', more: true },
        { key: 'alternatives', label: 'Options we considered', type: 'lines', more: true },
        { key: 'reasoning', label: parenting ? 'Why we chose it' : 'Our reasoning and trade-offs', type: 'textarea', more: !parenting },
        parenting ? { key: 'changeMind', label: 'What would change our mind', type: 'textarea', hint: 'The signs you are watching for - so a tired night can check them.' } : null,
        { key: 'participants', label: 'Who agreed', type: 'people', more: true },
        { key: 'indicators', label: 'How we will know it is working', type: 'textarea', more: true },
        { key: 'reviewOn', label: 'Look back on', type: 'day', more: true },
      ].filter(Boolean),
      onCancel: () => (existing ? hub.go('item', existing.id) : hub.go(null)),
      onSave: async (values) => {
        const saved = await saveRecord(hub, col(hub), normaliseDecision({ ...record, ...values }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('item', saved.id); }
      },
    }),
  ]);
}
