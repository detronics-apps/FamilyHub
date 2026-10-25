// Faith: Bible reading plans and a journal of reflections, lessons, questions,
// meaningful passages and family discussion. Screens: reading (default),
// journal, plan, new-plan.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import {
  BOOKS, PRESETS, normalisePlan, planSummary, planProgress, nextReading, describe, markRead, markUnread, chapters, daysIn,
  NOTE_KINDS, normaliseNote, noteSummary, noteText,
} from './logic.js';

const plans = (hub) => hub.data.collection('plans', { summary: planSummary, text: (p) => p.title, prefix: 'rdp' });
const notes = (hub) => hub.data.collection('notes', { summary: noteSummary, text: noteText, prefix: 'fnt' });
const ui = { kind: 'reflection', query: '' };

export function render(hub, route) {
  if (route.sub === 'journal') return journalScreen(hub);
  if (route.sub === 'plan') return planScreen(hub, route.rest[0]);
  if (route.sub === 'new-plan') return newPlanScreen(hub);
  return readingScreen(hub);
}

const nav = (hub, current) => tabs(hub, [{ screen: null, label: 'Reading' }, { screen: 'journal', label: 'Journal' }], current);

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
          el('span', { class: 'list__main', text: `Next: ${describe(next)}` }),
          el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Read it', 'data-field': `read:${p.id}`, on: { click: async () => { await saveRecord(hub, plans(hub), markRead(p, next.map((c) => c.key))); hub.ui.notice(`${describe(next)} - read.`); } } }),
        ]) : el('p', { class: 'small', text: 'Finished - every chapter read.' }),
      ]);
    })) : el('div', { class: 'panel empty' }, [el('p', { text: 'No reading plan yet. Choose what to read and how many chapters at a time - there is no deadline.' })]),
    el('a', { class: 'btn', href: hub.href('new-plan'), text: 'Start a reading plan', 'data-field': 'new-plan' }),
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
    el('button', { class: 'btn btn-quiet', type: 'button', text: 'Delete this plan', on: { click: async () => { if (!await confirmAction({ title: `Delete ${p.title}?`, text: 'Your journal entries are kept.', confirmLabel: 'Delete', danger: true })) return; await plans(hub).remove(p.id); hub.invalidate(); hub.go(null); } } }),
  ]);
}

function journalScreen(hub) {
  const r = hub.use(`notes:${ui.query}`, () => notes(hub).search(ui.query, { limit: 200 }));
  const me = hub.people.current();
  const people = hub.people.list();
  const passage = el('input', { class: 'input', placeholder: 'Passage (optional), e.g. John 15:5', 'aria-label': 'Passage' });
  const text = el('textarea', { class: 'input', rows: 4, placeholder: 'What stood out? A question, a lesson, something to talk about together...', 'aria-label': 'Journal entry', 'data-field': 'note-text' });
  return el('section', { class: 'stack', 'aria-label': 'Journal' }, [
    nav(hub, 'journal'),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'chipset' }, Object.entries(NOTE_KINDS).map(([k, label]) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(ui.kind === k), text: label, on: { click: () => { ui.kind = k; hub.render(); } } }))),
      passage, text,
      el('div', { class: 'row row--end' }, [el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'note-save',
        on: { click: async () => { if (!text.value.trim()) { text.focus(); return; } await saveRecord(hub, notes(hub), normaliseNote({ kind: ui.kind, passage: passage.value, text: text.value, who: me?.id ?? null }, hub.today())); hub.ui.notice('Saved.'); } },
      })]),
    ]),
    el('input', { class: 'input', type: 'search', placeholder: 'Search the journal', 'aria-label': 'Search the journal', value: ui.query, on: { change: (e) => { ui.query = e.target.value; hub.render(); } } }),
    r.loading ? loading() : r.error ? failure(r.error) : r.data.items.length ? el('ul', { class: 'list panel' }, r.data.items.map((n) => el('li', { style: { alignItems: 'flex-start' } }, [
      el('div', { class: 'list__main' }, [
        el('div', { class: 'card__label', text: NOTE_KINDS[n.kind] + (n.passage ? ` · ${n.passage}` : '') }),
        el('div', { text: n.title }),
        el('div', { class: 'small muted', text: [fmtDay(n.day, hub.today()), n.who ? nameOf(people, n.who) : null].filter(Boolean).join(' · ') }),
      ]),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: async () => { await notes(hub).remove(n.id); hub.invalidate(); } } }),
    ]))) : el('p', { class: 'small muted', text: ui.query ? 'Nothing matches.' : 'Nothing written yet.' }),
  ]);
}
