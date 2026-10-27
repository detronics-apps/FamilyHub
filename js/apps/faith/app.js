// Faith: Bible reading plans, a journal, the questions it holds, and a guide to
// the Bible. Writing an entry and looking back through the journal are separate
// screens. Screens: reading (default), journal, write, entry, edit, questions,
// guide, plan, new-plan.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, saveRecord, nameOf } from '../kit.js';
import {
  BOOKS, PRESETS, normalisePlan, planSummary, planProgress, nextReading, describe, markRead, markUnread, chapters, daysIn,
  NOTE_KINDS, QUESTION_STATUS, QUESTION_SHORT, VERSIONS, chaptersIn, normaliseNote, noteSummary, noteText, passageRef, filterNotes, allQuestions, termsUsed, loggedOn, bookNoteId, normaliseBookNote,
} from './logic.js';
import { BOOK_GUIDE, TOPICS } from './guide.js';

const plans = (hub) => hub.data.collection('plans', { summary: planSummary, text: (p) => p.title, prefix: 'rdp' });
const notes = (hub) => hub.data.collection('notes', { summary: noteSummary, text: noteText, prefix: 'fnt' });
const books = (hub) => hub.data.collection('books', { summary: (b) => ({ book: b.book, why: b.why, about: b.about }) });
// Journal filters, the entry being written, the question filter and the guide's choices.
const ui = { query: '', kind: '', topic: '', term: '', status: '', draft: null, qStatus: '', book: 'John', topicGuide: 'marriage', version: '' };

export function render(hub, route) {
  if (route.sub === 'journal') return journalScreen(hub);
  if (route.sub === 'write') return writeScreen(hub, null);
  if (route.sub === 'edit') return writeScreen(hub, route.rest[0]);
  if (route.sub === 'entry') return entryScreen(hub, route.rest[0]);
  if (route.sub === 'questions') return questionsScreen(hub);
  if (route.sub === 'guide') return guideScreen(hub);
  if (route.sub === 'plan') return planScreen(hub, route.rest[0]);
  if (route.sub === 'new-plan') return newPlanScreen(hub);
  return readingScreen(hub);
}

const nav = (hub, current) => tabs(hub, [
  { screen: null, label: 'Reading' }, { screen: 'journal', label: 'Journal' }, { screen: 'questions', label: 'Questions' }, { screen: 'guide', label: 'Bible guide' },
], current);

/** Every entry's index line - rebuilt once when written before entries had headings, questions and topics. */
const allNotes = (hub) => hub.use('notes', async () => {
  let { items } = await notes(hub).list({ limit: 100000 });
  if (items.some((n) => n.ix !== 2)) { await notes(hub).rebuildIndex(); ({ items } = await notes(hub).list({ limit: 100000 })); }
  return items;
});

function readingScreen(hub) {
  const r = hub.use('plans', async () => {
    const { items } = await plans(hub).list({ limit: 100 });
    return Promise.all(items.map(async (s) => normalisePlan(await plans(hub).get(s.id))));
  });
  if (r.loading) return el('section', { class: 'stack' }, [nav(hub, null), loading()]);
  if (r.error) return el('section', { class: 'stack' }, [nav(hub, null), failure(r.error)]);
  const list = r.data.filter((p) => p.id);

  return el('section', { class: 'stack', 'aria-label': 'Reading' }, [
    nav(hub, null),
    list.length ? el('div', { class: 'cards' }, list.map((p) => {
      const pr = planProgress(p);
      const next = nextReading(p);
      return el('article', { class: 'card' }, [
        el('a', { class: 'card__title', href: hub.href('plan', p.id), text: p.title }),
        el('div', { class: 'card__meta', text: `${pr.done} of ${pr.total} chapters read` }),
        el('div', { class: 'progress', role: 'img', 'aria-label': `${Math.round(pr.share * 100)} percent read` }, [el('div', { class: 'progress__bar', style: { width: `${Math.round(pr.share * 100)}%` } })]),
        next.length ? el('div', { class: 'row' }, [
          el('span', { class: 'list__main' }, [`Next: ${describe(next)} `, el('a', { class: 'small', href: hub.href('guide'), text: `About ${next[0].book}`, on: { click: () => { ui.book = next[0].book; } } })]),
          el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Read it', 'data-field': `read:${p.id}`, on: { click: async () => { await saveRecord(hub, plans(hub), markRead(p, next.map((c) => c.key))); hub.ui.notice(`${describe(next)} - read.`); } } }),
        ]) : el('p', { class: 'small', text: 'Finished - every chapter read.' }),
      ]);
    })) : el('div', { class: 'panel empty' }, [el('p', { text: 'No reading plan yet. Choose what to read and how many chapters at a time - there is no deadline.' })]),
    el('a', { class: 'btn', href: hub.href('new-plan'), text: 'New plan', title: 'Start a reading plan', 'data-field': 'new-plan' }),
  ]);
}

function newPlanScreen(hub) {
  let preset = 'gospels';
  const presetSel = el('select', { class: 'select', id: 'preset', 'aria-label': 'What to read' }, [
    ...Object.entries(PRESETS).map(([k, p]) => el('option', { value: k, text: p.title })),
    el('option', { value: 'custom', text: 'Choose books myself' }),
  ]);
  const books = el('div', { class: 'stack', hidden: true, style: { maxHeight: '240px', overflowY: 'auto' } }, BOOKS.map(([b, n]) => el('label', { class: 'checkline' }, [el('input', { type: 'checkbox', value: b }), `${b} (${n})`])));
  presetSel.addEventListener('change', () => { preset = presetSel.value; books.hidden = preset !== 'custom'; });
  const perDay = el('input', { class: 'input', type: 'number', min: '1', max: '20', value: '1', 'aria-label': 'Chapters at a time', style: { maxWidth: '90px' } });
  const who = hub.people.list().map((p) => { const box = el('input', { type: 'checkbox', value: p.id }); return { box, node: el('label', { class: 'checkline' }, [box, p.name]) }; });
  return el('section', { class: 'stack' }, [
    nav(hub, null),
    el('div', { class: 'panel stack' }, [
      el('h1', { text: 'Start a reading plan', style: { margin: 0 } }),
      el('label', { class: 'field__label', for: 'preset', text: 'What to read' }), presetSel, books,
      el('div', { class: 'row' }, [el('span', { text: 'Chapters at a time' }), perDay]),
      who.length ? el('fieldset', {}, [el('legend', { text: 'Reading together (optional)' }), el('div', { class: 'row' }, who.map((w) => w.node))]) : null,
      el('div', { class: 'row row--end' }, [el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Start', 'data-field': 'plan-start',
        on: {
          click: async () => {
            const chosen = preset === 'custom' ? [...books.querySelectorAll('input:checked')].map((x) => x.value) : PRESETS[preset].books;
            if (!chosen.length) return;
            const saved = await saveRecord(hub, plans(hub), normalisePlan({
              title: preset === 'custom' ? (chosen.length === 1 ? chosen[0] : `${chosen[0]} and ${chosen.length - 1} more`) : PRESETS[preset].title,
              books: chosen, perDay: perDay.value, startDay: hub.today(), who: who.filter((w) => w.box.checked).map((w) => w.box.value),
            }));
            if (saved) hub.go('plan', saved.id);
          },
        },
      })]),
    ]),
  ]);
}

function planScreen(hub, id) {
  const r = hub.use(`plan:${id}`, () => plans(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This plan no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'Reading' })]);
  const p = normalisePlan(r.data);
  const pr = planProgress(p);
  const read = new Set(p.read);
  const byBook = new Map();
  for (const c of chapters(p)) { if (!byBook.has(c.book)) byBook.set(c.book, []); byBook.get(c.book).push(c); }
  const days = daysIn(p, hub.today());
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Reading' }),
    el('div', { class: 'panel stack' }, [
      el('h1', { text: p.title, style: { margin: 0 } }),
      el('p', { text: `${pr.done} of ${pr.total} chapters read${pr.done < pr.total ? ` - about ${pr.daysLeft} more reading${pr.daysLeft === 1 ? '' : 's'} at ${p.perDay} at a time` : ''}.` }),
      days ? el('p', { class: 'small muted', text: `Started ${fmtDay(p.startDay, hub.today())}. Read at your own pace - there is no schedule to keep up with.` }) : null,
      p.who.length ? el('p', { class: 'small muted', text: `Reading together: ${p.who.map((w) => nameOf(hub.people.list(), w)).join(', ')}` }) : null,
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Chapters' }),
      el('p', { class: 'small muted', text: 'Tap a chapter to mark it read, or unread.' }),
      ...[...byBook].map(([book, list]) => el('div', {}, [
        el('h3', { text: book }),
        el('div', { class: 'chipset' }, list.map((c) => el('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(read.has(c.key)), text: String(c.chapter), 'aria-label': `${book} ${c.chapter}`,
          on: { click: () => saveRecord(hub, plans(hub), read.has(c.key) ? markUnread(p, c.key) : markRead(p, [c.key])) },
        }))),
      ])),
    ]),
    el('button', { class: 'btn btn-quiet', type: 'button', text: 'Delete', on: { click: async () => { if (!await confirmAction({ title: `Delete ${p.title}?`, text: 'Your journal entries are kept.', confirmLabel: 'Delete', danger: true })) return; await plans(hub).remove(p.id); hub.invalidate(); hub.go(null); } } }),
  ]);
}

/* ------------------------------------------------------------- journal */

const chip = (pressed, text, field, click, title) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(pressed), text, title, 'data-field': field, on: { click } });
const select = (value, options, any, field, change, label) => el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': label, 'data-field': field, on: { change: (e) => change(e.target.value) } },
  [['', any], ...options].map(([v, t]) => el('option', { value: v, text: t, selected: value === v })));
const open = (qs) => qs.filter((q) => q.status !== 'answered').length;

/** Looking back: find entries by kind, topic, term, question status and words. Writing is its own screen. */
function journalScreen(hub) {
  const all = allNotes(hub);
  const found = hub.use(`notes:${ui.query}`, () => notes(hub).search(ui.query, { limit: 100000 }));
  const set = (patch) => { Object.assign(ui, patch); hub.render(); };
  if (all.loading || found.loading) return el('section', { class: 'stack' }, [nav(hub, 'journal'), loading()]);
  if (all.error || found.error) return el('section', { class: 'stack' }, [nav(hub, 'journal'), failure(all.error ?? found.error)]);
  const byId = new Map(all.data.map((n) => [n.id, n]));
  const shown = filterNotes(found.data.items.map((n) => byId.get(n.id) ?? n).filter((n) => n.ix === 2), ui);
  const people = hub.people.list();
  return el('section', { class: 'stack', 'aria-label': 'Journal' }, [
    nav(hub, 'journal'),
    el('div', { class: 'row' }, [
      el('p', { class: 'muted', style: { margin: 0, flex: '1 1 260px' }, text: 'Everything you have written - find it again by kind, topic, term or a question still open.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('write'), text: 'New entry', 'data-field': 'note-new' }),
    ]),
    el('div', { class: 'panel stack' }, [
      el('input', { class: 'input', type: 'search', placeholder: 'Search the journal', 'aria-label': 'Search the journal', value: ui.query, 'data-field': 'journal-search', on: { change: (e) => set({ query: e.target.value }) } }),
      el('div', { class: 'chipset', role: 'group', 'aria-label': 'Kind' }, [chip(!ui.kind, 'All', 'jkind:all', () => set({ kind: '' })), ...Object.entries(NOTE_KINDS).map(([k, t]) => chip(ui.kind === k, t, `jkind:${k}`, () => set({ kind: k })))]),
      el('div', { class: 'row' }, [
        select(ui.topic, Object.entries(TOPICS).map(([k, t]) => [k, t.label]), 'Any topic', 'jtopic', (v) => set({ topic: v }), 'Topic'),
        termsUsed(all.data).length ? select(ui.term, termsUsed(all.data).map((t) => [t, t]), 'Any term', 'jterm', (v) => set({ term: v }), 'Term') : null,
        select(ui.status, Object.entries(QUESTION_STATUS), 'Any question', 'jstatus', (v) => set({ status: v }), 'Question status'),
      ]),
    ]),
    shown.length ? el('ul', { class: 'list panel', 'data-field': 'journal-list' }, shown.map((n) => el('li', { style: { alignItems: 'flex-start' } }, [
      el('a', { class: 'list__main', href: hub.href('entry', n.id), style: { color: 'inherit', textDecoration: 'none' } }, [
        el('div', { class: 'card__label', text: [NOTE_KINDS[n.kind], ...n.refs].join(' · ') }),
        el('strong', { text: n.title }),
        el('div', { class: 'small muted', text: [
          fmtDay(n.day, hub.today()), n.who ? nameOf(people, n.who) : null,
          n.questions.length ? `${n.questions.length} question${n.questions.length === 1 ? '' : 's'}${open(n.questions) ? `, ${open(n.questions)} still open` : ', answered'}` : null,
          [...n.topics.map((t) => TOPICS[t]?.label), ...n.terms].filter(Boolean).join(', ') || null,
        ].filter(Boolean).join(' · ') }),
      ]),
    ]))) : el('p', { class: 'small muted', text: all.data.length ? 'Nothing matches - clear a filter.' : 'Nothing written yet.' }),
  ]);
}

/** One entry, read back. */
function entryScreen(hub, id) {
  const r = hub.use(`note:${id}`, () => notes(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This entry no longer exists.' }), el('a', { class: 'btn', href: hub.href('journal'), text: 'The journal' })]);
  const n = normaliseNote(r.data, hub.today());
  return el('section', { class: 'stack' }, [
    nav(hub, 'journal'),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: `${NOTE_KINDS[n.kind]} · ${fmtDay(n.day, hub.today())}${n.who ? ` · ${nameOf(hub.people.list(), n.who)}` : ''}` }),
      el('h1', { text: n.heading, style: { margin: 0 } }),
      n.questions.length ? el('div', { class: 'stack' }, [el('h2', { text: n.questions.length === 1 ? 'The question' : 'The questions', style: { margin: 0 } }), ...n.questions.map((q) => el('div', {}, [
        el('strong', { text: q.text }), ' ', el('span', { class: `badge${q.status === 'answered' ? ' badge--ok' : ''}`, text: QUESTION_STATUS[q.status] }),
        q.answer ? el('p', { text: q.answer, style: { whiteSpace: 'pre-wrap', margin: '4px 0 0' } }) : null,
      ]))]) : null,
      n.passages.length || n.passage ? el('div', {}, [el('h2', { text: 'Passages', style: { margin: 0 } }), el('ul', {}, [...n.passages.map(passageRef), n.passage].filter(Boolean).map((t) => el('li', { text: t })))]) : null,
      n.notes ? el('p', { text: n.notes, style: { whiteSpace: 'pre-wrap' } }) : null,
      n.topics.length || n.terms.length ? el('div', { class: 'chipset' }, [...n.topics.map((t) => el('span', { class: 'badge badge--accent', text: TOPICS[t].label })), ...n.terms.map((t) => el('span', { class: 'badge', text: t }))]) : null,
    ]),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn', href: hub.href('edit', n.id), text: 'Edit', 'data-field': 'note-edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Delete', on: { click: async () => { if (!await confirmAction({ title: `Delete "${n.heading}"?`, confirmLabel: 'Delete', danger: true })) return; await notes(hub).remove(n.id); hub.invalidate(); hub.go('journal'); } } }),
    ]),
  ]);
}

/**
 * Writing an entry: the kind, a heading, the questions it is trying to answer,
 * the passages it is about (version, book, chapter and verses from lists - as
 * many as it needs), notes, topics and finer terms. The editor redraws only
 * itself, so typing is never interrupted.
 */
function writeScreen(hub, id) {
  const r = id ? hub.use(`note:${id}`, () => notes(hub).get(id)) : { data: null };
  const all = allNotes(hub);
  if (r.loading || all.loading) return loading();
  if (r.error) return failure(r.error);
  const key = id ?? 'new';
  if (ui.draft?.key !== key) {
    const n = normaliseNote(r.data ?? { kind: 'reflection' }, hub.today());
    ui.draft = { key, n: { ...n, heading: r.data ? n.heading : '', questions: n.questions.map((q) => ({ ...q })), passages: n.passages.map((x) => ({ ...x })), topics: [...n.topics], terms: [...n.terms] } };
  }
  const d = ui.draft.n;
  const known = termsUsed(all.data ?? []);
  const box = el('div', { class: 'panel stack' });
  const input = (value, attrs, set) => el('input', { class: 'input', value: value ?? '', ...attrs, on: { input: (e) => set(e.target.value) } });
  const redraw = () => box.replaceChildren(...parts());
  const parts = () => [
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Kind of entry' }, Object.entries(NOTE_KINDS).map(([k, t]) => chip(d.kind === k, t, `wkind:${k}`, () => { d.kind = k; redraw(); }))),
    el('label', { class: 'field__label', text: 'Heading' }),
    input(d.heading, { placeholder: d.kind === 'message' ? 'e.g. Sunday sermon on patience' : 'e.g. Loving my family better', maxlength: '150', 'data-field': 'w-heading', 'aria-label': 'Heading' }, (v) => { d.heading = v; }),

    el('h2', { text: 'Questions I am trying to answer', style: { margin: 'var(--space-2) 0 0' } }),
    ...d.questions.map((q, i) => el('div', { class: 'stack', style: { gap: '4px', borderLeft: '3px solid var(--border)', paddingLeft: '8px' } }, [
      el('div', { class: 'row' }, [
        input(q.text, { placeholder: 'e.g. How do I love my wife and kids better?', style: { flex: '1 1 240px' }, 'data-field': `w-q:${i}`, 'aria-label': `Question ${i + 1}` }, (v) => { q.text = v; }),
        el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': `Where question ${i + 1} stands`, 'data-field': `w-qs:${i}`, on: { change: (e) => { q.status = e.target.value; } } },
          Object.entries(QUESTION_STATUS).map(([k, t]) => el('option', { value: k, text: t, selected: q.status === k }))),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: '×', 'aria-label': `Remove question ${i + 1}`, on: { click: () => { d.questions.splice(i, 1); redraw(); } } }),
      ]),
      el('textarea', { class: 'input', rows: '2', placeholder: 'What I have found so far (optional)', 'aria-label': `Answer to question ${i + 1}`, text: q.answer, on: { input: (e) => { q.answer = e.target.value; } } }),
    ])),
    el('button', { class: 'btn btn-small', type: 'button', text: '+ Question', 'data-field': 'w-add-q', style: { alignSelf: 'flex-start' }, on: { click: () => { d.questions.push({ id: `q${Date.now().toString(36)}`, text: '', status: 'new', answer: '' }); redraw(); } } }),

    el('h2', { text: 'Passages', style: { margin: 'var(--space-2) 0 0' } }),
    ...d.passages.map((x, i) => el('div', { class: 'row', 'data-field': `w-p:${i}` }, [
      el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Bible version', on: { change: (e) => { x.version = e.target.value; ui.version = x.version; } } },
        [['', 'Version'], ...Object.entries(VERSIONS)].map(([k, t]) => el('option', { value: k, text: t, selected: x.version === k }))),
      el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Book', 'data-field': `w-book:${i}`, on: { change: (e) => { x.book = e.target.value; x.chapter = 1; redraw(); } } },
        BOOKS.map(([b]) => el('option', { value: b, text: b, selected: x.book === b }))),
      el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Chapter', 'data-field': `w-ch:${i}`, on: { change: (e) => { x.chapter = Number(e.target.value); } } },
        Array.from({ length: chaptersIn(x.book) }, (_, c) => el('option', { value: String(c + 1), text: `Chapter ${c + 1}`, selected: x.chapter === c + 1 }))),
      el('span', { class: 'small', text: 'verses' }),
      el('input', { class: 'input', type: 'number', min: '1', value: x.from ?? '', placeholder: 'from', 'aria-label': 'From verse', style: { width: '5em' }, on: { input: (e) => { x.from = e.target.value ? Number(e.target.value) : null; } } }),
      el('input', { class: 'input', type: 'number', min: '1', value: x.to ?? '', placeholder: 'to', 'aria-label': 'To verse', style: { width: '5em' }, on: { input: (e) => { x.to = e.target.value ? Number(e.target.value) : null; } } }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: '×', 'aria-label': `Remove passage ${i + 1}`, on: { click: () => { d.passages.splice(i, 1); redraw(); } } }),
    ])),
    d.passage ? el('p', { class: 'small muted', text: `Written before: ${d.passage}` }) : null,
    el('button', {
      class: 'btn btn-small', type: 'button', text: '+ Passage', 'data-field': 'w-add-p', style: { alignSelf: 'flex-start' },
      on: { click: () => { const last = d.passages.at(-1); d.passages.push({ version: last?.version ?? ui.version, book: last?.book ?? 'John', chapter: last?.chapter ?? 1, from: null, to: null }); redraw(); } },
    }),

    el('label', { class: 'field__label', text: 'Notes' }),
    el('textarea', { class: 'input', rows: '6', placeholder: 'What stood out, what you learnt, what to talk about together...', 'aria-label': 'Notes', 'data-field': 'w-notes', text: d.notes, on: { input: (e) => { d.notes = e.target.value; } } }),

    el('h2', { text: 'Topics', style: { margin: 'var(--space-2) 0 0' } }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Topics' }, Object.entries(TOPICS).map(([k, t]) => chip(d.topics.includes(k), t.label, `w-topic:${k}`, () => { d.topics = d.topics.includes(k) ? d.topics.filter((x) => x !== k) : [...d.topics, k]; redraw(); }))),
    el('h2', { text: 'Finer terms to search by', style: { margin: 'var(--space-2) 0 0' } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Words of your own, like tattoos, judging or trinity. Ones you used before are offered as you type.' }),
    d.terms.length ? el('div', { class: 'chipset' }, d.terms.map((t) => el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: `${t} ×`, 'aria-label': `Remove ${t}`, on: { click: () => { d.terms = d.terms.filter((x) => x !== t); redraw(); } } }))) : null,
    termAdder(known, (t) => { if (t && !d.terms.includes(t)) d.terms.push(t); redraw(); }),
  ];
  redraw();
  const save = async () => {
    if (!d.heading.trim()) { hub.ui.notice('Give the entry a heading.', 'warn'); return; }
    const saved = await saveRecord(hub, notes(hub), normaliseNote({ ...d, who: d.who ?? hub.people.current()?.id ?? null }, hub.today()));
    if (saved) { ui.draft = null; hub.ui.notice('Saved.'); hub.go('entry', saved.id); }
  };
  return el('section', { class: 'stack' }, [
    nav(hub, 'journal'),
    el('h1', { text: id ? 'Edit the entry' : 'Write an entry' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'note-save', on: { click: save } }),
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => { ui.draft = null; if (id) hub.go('entry', id); else hub.go('journal'); } } }),
    ]),
  ]);
}

/** A term box: type, pick from earlier terms, Enter or Add. */
function termAdder(known, add) {
  const listId = `terms-${Date.now().toString(36)}`;
  const box = el('input', { class: 'input', list: listId, maxlength: '40', placeholder: 'e.g. tattoos', 'aria-label': 'Add a term', 'data-field': 'w-term', style: { maxWidth: '220px' }, on: { keydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(box.value.trim().toLowerCase()); } } } });
  return el('div', { class: 'row' }, [
    box, el('datalist', { id: listId }, known.map((t) => el('option', { value: t }))),
    el('button', { class: 'btn btn-small', type: 'button', text: 'Add', 'data-field': 'w-term-add', on: { click: () => add(box.value.trim().toLowerCase()) } }),
  ]);
}

/** Every question across the journal, to come back to - with where each one stands. */
function questionsScreen(hub) {
  const all = allNotes(hub);
  if (all.loading) return el('section', { class: 'stack' }, [nav(hub, 'questions'), loading()]);
  if (all.error) return el('section', { class: 'stack' }, [nav(hub, 'questions'), failure(all.error)]);
  const qs = allQuestions(all.data.filter((n) => n.ix === 2).map((n) => ({ ...n, heading: n.title })), ui.qStatus);
  const setStatus = async (entry, qid, status) => {
    const n = normaliseNote(await notes(hub).get(entry), hub.today());
    await saveRecord(hub, notes(hub), { ...n, questions: n.questions.map((q) => (q.id === qid ? { ...q, status } : q)) });
  };
  return el('section', { class: 'stack', 'aria-label': 'Questions' }, [
    nav(hub, 'questions'),
    el('p', { class: 'muted', text: 'The questions you have written down, to come back to. Change where one stands here; open the entry to add what you found.' }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Where it stands' }, [
      chip(!ui.qStatus, 'All', 'qs:all', () => { ui.qStatus = ''; hub.render(); }),
      ...Object.entries(QUESTION_SHORT).map(([k, t]) => chip(ui.qStatus === k, t, `qs:${k}`, () => { ui.qStatus = k; hub.render(); }, QUESTION_STATUS[k])),
    ]),
    qs.length ? el('ul', { class: 'list panel', 'data-field': 'questions' }, qs.map((q) => el('li', { style: { alignItems: 'flex-start' } }, [
      el('div', { class: 'list__main' }, [
        el('strong', { text: q.text }),
        el('div', { class: 'small muted' }, ['From ', el('a', { href: hub.href('entry', q.entry), text: q.heading }), ` · ${fmtDay(q.day, hub.today())}`]),
      ]),
      el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Where it stands', 'data-field': `q-status:${q.id}`, on: { change: (e) => setStatus(q.entry, q.id, e.target.value) } },
        Object.entries(QUESTION_STATUS).map(([k, t]) => el('option', { value: k, text: t, selected: q.status === k }))),
    ]))) : el('p', { class: 'small muted', text: 'No questions here yet. Add one to any journal entry - even before you know where to look.' }),
  ]);
}

/** The passages and questions the family has logged on a guide topic, each linking to its entry. */
function ourOwn(hub, t) {
  const all = allNotes(hub);
  if (all.loading) return loading();
  if (all.error) return failure(all.error);
  const { passages, questions } = loggedOn(all.data.filter((n) => n.ix === 2).map((n) => ({ ...n, heading: n.title })), ui.topicGuide);
  const from = (x) => el('a', { href: hub.href('entry', x.entry), text: x.heading });
  if (!passages.length && !questions.length) return el('p', { class: 'small muted', 'data-field': 'guide-ours', text: `Nothing logged on ${t.label} yet. Tick this topic on a journal entry, and its passages and questions show here too.` });
  return el('div', { class: 'stack', 'data-field': 'guide-ours' }, [
    passages.length ? el('div', {}, [
      el('h3', { text: 'Passages we have noted on this', style: { margin: '0 0 4px' } }),
      el('ul', { style: { margin: 0 } }, passages.map((x) => el('li', {}, [x.ref, el('span', { class: 'small muted' }, [' · from ', from(x)])]))),
    ]) : null,
    questions.length ? el('div', {}, [
      el('h3', { text: 'Our questions on this', style: { margin: '0 0 4px' } }),
      el('ul', { style: { margin: 0 } }, questions.map((q) => el('li', {}, [q.text, el('span', { class: 'small muted' }, [` · ${QUESTION_STATUS[q.status]} · from `, from(q)])]))),
    ]) : null,
  ]);
}

/** Who wrote each book, when, to whom, why and what it is about - and where to start reading on a question. */
function guideScreen(hub) {
  const g = BOOK_GUIDE[ui.book];
  const t = TOPICS[ui.topicGuide];
  const row = (label, text, extra = null) => el('div', { class: 'glance__item' }, [el('dt', { text: label }), el('dd', { text }), extra]);
  const ours = hub.use('books', () => books(hub).list({ limit: 1000 }));
  const mine = ours.data?.items.find((b) => b.id === bookNoteId(ui.book)) ?? {};
  // The family's own notes under "why" and "about" - shown below the guide's text, edited in place.
  const own = (field) => {
    if (ours.loading || ours.error) return null;
    if (ui.bookEdit?.field === field && ui.bookEdit.book === ui.book) {
      const save = async () => { await saveRecord(hub, books(hub), normaliseBookNote({ ...mine, [field]: ui.bookEdit.text }, ui.book)); ui.bookEdit = null; };
      return el('div', { class: 'stack', style: { marginTop: 'var(--space-2)', gap: 'var(--space-2)' } }, [
        el('textarea', { class: 'input', rows: '3', maxlength: '2000', 'aria-label': 'Our notes', 'data-field': `book-${field}-text`, text: ui.bookEdit.text, on: { input: (e) => { ui.bookEdit.text = e.target.value; } } }),
        el('div', { class: 'row' }, [
          el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Save', 'data-field': `book-${field}-save`, on: { click: save } }),
          el('button', { class: 'btn btn-small', type: 'button', text: 'Cancel', on: { click: () => { ui.bookEdit = null; hub.render(); } } }),
        ]),
      ]);
    }
    return el('div', { class: 'glance__own' }, [
      mine[field] ? el('p', { class: 'glance__note', 'data-field': `book-${field}-note` }, [el('strong', { text: 'Our notes: ' }), mine[field]]) : null,
      el('button', { class: 'btn btn-small', type: 'button', text: mine[field] ? 'Edit notes' : '+ Notes', 'data-field': `book-${field}-edit`, on: { click: () => { ui.bookEdit = { book: ui.book, field, text: mine[field] ?? '' }; hub.render(); } } }),
    ]);
  };
  return el('section', { class: 'stack', 'aria-label': 'Bible guide' }, [
    nav(hub, 'guide'),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'A book at a glance', style: { margin: 0 } }),
      el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Book', 'data-field': 'guide-book', on: { change: (e) => { ui.book = e.target.value; hub.render(); } } },
        BOOKS.map(([b, n]) => el('option', { value: b, text: `${b} (${n} chapter${n === 1 ? '' : 's'})`, selected: ui.book === b }))),
      // The three short answers side by side, then the two longer ones.
      el('dl', { class: 'glance', 'data-field': 'guide-5w' }, [
        row('Who wrote it', g.who), row('When', g.when), row('To whom', g.to), row('Why', g.why, own('why')), row('Who and what it is about', g.about, own('about')),
      ]),
      el('p', { class: 'small muted', text: 'Authorship and dates follow the traditional view most churches hold; where scholars widely differ, it says so. A way in, not a commentary.' }),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Where to start reading on a question', style: { margin: 0 } }),
      el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Topic', 'data-field': 'guide-topic', on: { change: (e) => { ui.topicGuide = e.target.value; hub.render(); } } },
        Object.entries(TOPICS).map(([k, x]) => el('option', { value: k, text: x.label, selected: ui.topicGuide === k }))),
      el('ul', { 'data-field': 'guide-start' }, t.start.map((ref) => el('li', { text: ref }))),
      ourOwn(hub, t),
      el('a', { class: 'btn btn-small', href: hub.href('write'), text: 'New question', title: 'Write down a question on this topic', style: { alignSelf: 'flex-start' }, on: { click: () => { ui.draft = { key: 'new', n: { ...normaliseNote({ kind: 'question', topics: [ui.topicGuide] }, hub.today()), heading: '', questions: [{ id: 'q1', text: '', status: 'new', answer: '' }], passages: [], terms: [] } }; } } }),
    ]),
  ]);
}
