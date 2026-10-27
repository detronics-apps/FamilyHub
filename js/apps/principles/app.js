// Principles: what the family believes, how it applies it, the exceptions, and
// when to look again. Screens: list (default), item, new, edit.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { loading, failure, recordForm, saveRecord } from '../kit.js';
import { normalisePrinciple, principleSummary, principleText, reviewDue, KINDS, EXAMPLES } from './logic.js';

const col = (hub) => hub.data.collection('principles', { summary: principleSummary, text: principleText, prefix: 'prn' });
const all = (hub) => hub.use('all', async () => (await col(hub).list({ limit: 100000 })).items);

export function render(hub, route) {
  if (route.sub === 'item') return itemScreen(hub, route.rest[0]);
  if (route.sub === 'new') return editScreen(hub, null);
  if (route.sub === 'edit') return editScreen(hub, route.rest[0]);
  return listScreen(hub);
}

function listScreen(hub) {
  const list = all(hub);
  if (list.loading) return loading();
  if (list.error) return failure(list.error);
  const today = hub.today();
  const active = list.data.filter((s) => s.status === 'active');
  const retired = list.data.filter((s) => s.status === 'retired');
  const due = active.filter((s) => reviewDue(s, today));
  const hasExamples = list.data.some((s) => s.demo);

  const group = (kind) => {
    const items = active.filter((s) => s.kind === kind).sort((a, b) => a.title.localeCompare(b.title));
    return items.length ? el('div', { class: 'panel' }, [
      el('h2', { text: { value: 'Values', guideline: 'Guidelines', agreement: 'Agreements' }[kind] }),
      el('ul', { class: 'list' }, items.map((s) => el('li', {}, [
        el('a', { class: 'list__main', href: hub.href('item', s.id), text: s.title }),
        s.demo ? el('span', { class: 'badge badge--demo', text: 'Example' }) : null,
      ]))),
    ]) : null;
  };

  return el('section', { class: 'stack', 'aria-label': 'Principles' }, [
    el('div', { class: 'row' }, [
      el('p', { class: 'muted', style: { margin: 0, flex: '1 1 260px' }, text: 'What your family believes and has agreed - with the reasons, so they can be revisited when they stop making sense.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'New principle', 'data-field': 'add-principle' }),
    ]),
    due.length ? el('div', { class: 'banner banner--info' }, [el('span', { class: 'banner__text', text: `Time to look again at: ${due.map((s) => s.title).join(', ')}.` })]) : null,
    active.length ? null : el('div', { class: 'panel empty stack' }, [
      el('p', { text: 'No principles yet. Start with one thing you already agree on - "assume positive intent", say.' }),
      hasExamples ? null : el('button', {
        class: 'btn', type: 'button', text: 'Add examples', title: 'Add the two examples from the guide',
        on: { click: async () => { for (const ex of EXAMPLES) await col(hub).put(normalisePrinciple(ex)); hub.invalidate(); hub.ui.notice('Two example principles added - edit or remove them freely.'); } },
      }),
    ]),
    group('value'), group('guideline'), group('agreement'),
    retired.length ? el('details', { class: 'panel more' }, [
      el('summary', { text: `Retired (${retired.length})` }),
      el('ul', { class: 'list' }, retired.map((s) => el('li', {}, [el('a', { href: hub.href('item', s.id), text: s.title })]))),
    ]) : null,
  ]);
}

function itemScreen(hub, id) {
  const r = hub.use(`item:${id}`, () => col(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This principle no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'All principles' })]);
  const p = normalisePrinciple(r.data);
  const today = hub.today();
  const block = (title, body) => (body && (!Array.isArray(body) || body.length) ? el('div', {}, [
    el('h3', { text: title }),
    Array.isArray(body) ? el('ul', {}, body.map((x) => el('li', { text: x }))) : el('p', { text: body }),
  ]) : null);

  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Principles' }),
    el('article', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: `${KINDS[p.kind]}${p.status === 'retired' ? ' · retired' : ''}${p.demo ? ' · example' : ''}` }),
      el('h1', { text: p.title, style: { margin: 0 } }),
      block('What we believe', p.belief),
      block('How we apply it', p.apply),
      block('Why', p.rationale),
      block('Exceptions', p.exceptions),
      block('What we aim for', p.target),
      block('When to look again', p.reviewTrigger),
      p.reviewOn ? el('p', { class: 'small', text: reviewDue(p, today) ? `It is time to look at this again (planned for ${fmtDay(p.reviewOn, today)}).` : `Next look: ${fmtDay(p.reviewOn, today)}.` }) : null,
    ]),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-primary', href: hub.href('edit', p.id), text: 'Edit' }),
      reviewDue(p, today) ? el('button', {
        class: 'btn', type: 'button', text: 'Still right', title: 'We looked at it again, and it still holds',
        on: { click: async () => { await saveRecord(hub, col(hub), { ...p, reviewOn: null }); hub.ui.notice('Noted. Set a new review date in Edit if you want one.'); } },
      }) : null,
      el('button', {
        class: 'btn', type: 'button', text: p.status === 'active' ? 'Retire it' : 'Restore',
        on: { click: async () => { await saveRecord(hub, col(hub), { ...p, status: p.status === 'active' ? 'retired' : 'active' }); } },
      }),
      el('button', {
        class: 'btn btn-quiet', type: 'button', text: 'Delete',
        on: {
          click: async () => {
            if (!await confirmAction({ title: `Delete "${p.title}"?`, text: 'Retiring keeps it, with its reasons, for later. Deleting cannot be undone.', confirmLabel: 'Delete', danger: true })) return;
            await col(hub).remove(p.id);
            hub.invalidate();
            hub.go(null);
          },
        },
      }),
    ]),
  ]);
}

function editScreen(hub, id) {
  const r = id ? hub.use(`item:${id}`, () => col(hub).get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normalisePrinciple(r.data) : null;
  const record = existing ?? normalisePrinciple({ title: '' });
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add a principle' }),
    recordForm({
      record: { ...record, title: existing ? record.title : '' },
      fields: [
        { key: 'title', label: 'Name it in a few words', required: true, placeholder: 'e.g. Assume positive intent' },
        { key: 'kind', label: 'Kind', type: 'select', options: Object.entries(KINDS) },
        { key: 'belief', label: 'What we believe', type: 'textarea' },
        { key: 'apply', label: 'How we apply it', type: 'lines', hint: 'One per line.' },
        { key: 'rationale', label: 'Why it matters', type: 'textarea', more: true },
        { key: 'exceptions', label: 'Exceptions', type: 'textarea', more: true },
        { key: 'target', label: 'Something measurable we aim for (optional)', more: true, hint: 'e.g. Screen time under two hours on school days.' },
        { key: 'reviewTrigger', label: 'What should make us look at it again', type: 'textarea', more: true },
        { key: 'reviewOn', label: 'Look at it again on', type: 'day', more: true },
      ],
      onCancel: () => (existing ? hub.go('item', existing.id) : hub.go(null)),
      onSave: async (values) => {
        const saved = await saveRecord(hub, col(hub), normalisePrinciple({ ...record, ...values }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('item', saved.id); }
      },
    }),
  ]);
}
