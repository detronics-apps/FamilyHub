// Medical: outstanding medical accounts for the whole family. Screens: the list
// (with its filters), one account, the add/edit form, and the tax year.
// Data through hub.data only.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import { rand } from '../finance/pod.js';
import {
  normaliseAccount, accountSummary, accountText, owed, paidByUs, outOfPocket, nextStep, sortAccounts, followUpDue,
  FILTERS, KINDS, KIND_LABEL, CLAIM, CLAIM_LABEL, tileNote as noteFor, yearView, yearsOf, taxYear, taxYearSpan, missingProof,
} from './logic.js';
import { notesScreen } from './notes.js';

const ui = { person: '', year: null };

const col = (hub) => hub.data.collection('accounts', { summary: accountSummary, text: accountText, prefix: 'med' });
const allSummaries = (hub) => hub.use('all', async () => (await col(hub).list({ limit: 100000 })).items.map(normaliseAccount));

/** The line under the home tile: due this week and follow-ups, or nothing. */
export function tileNote(hub) {
  const all = allSummaries(hub);
  return all.data ? noteFor(all.data, hub.today()) : null;
}

export function render(hub, route) {
  const screen = route.sub ?? 'outstanding';
  if (screen === 'item') return itemScreen(hub, route.rest[0]);
  if (screen === 'new') return editScreen(hub, null);
  if (screen === 'edit') return editScreen(hub, route.rest[0]);
  if (screen === 'year') return yearScreen(hub);
  if (screen === 'notes') return notesScreen(hub, nav(hub, 'notes'));
  return listScreen(hub, FILTERS[screen] ? screen : 'outstanding');
}

function nav(hub, current) {
  return tabs(hub, [
    { screen: null, label: 'Outstanding' }, { screen: 'followup', label: 'Follow-up' },
    { screen: 'aid', label: 'Medical aid' }, { screen: 'gap', label: 'Gap cover' },
    { screen: 'all', label: 'All' }, { screen: 'year', label: 'Tax year' }, { screen: 'notes', label: 'Notes' },
  ], current === 'outstanding' ? null : current);
}

const EMPTY = {
  outstanding: 'Nothing owed. Add an account, invoice or quote when one arrives.',
  followup: 'No follow-ups due.',
  aid: 'Nothing waiting to go to medical aid or to come back from it.',
  gap: 'Nothing waiting on gap cover.',
  all: 'Nothing logged yet.',
};

function personPicker(hub) {
  const people = hub.people.list();
  if (people.length < 2) return null;
  return el('select', {
    class: 'select', 'aria-label': 'Family member', 'data-field': 'med-person', style: { maxWidth: '220px' },
    on: { change: (e) => { ui.person = e.target.value; hub.render(); } },
  }, [el('option', { value: '', text: 'Everyone', selected: !ui.person }), ...people.map((p) => el('option', { value: p.id, text: p.name, selected: ui.person === p.id }))]);
}

function listScreen(hub, filter) {
  const all = allSummaries(hub);
  let body;
  if (all.loading) body = loading();
  else if (all.error) body = failure(all.error);
  else {
    const items = all.data.filter((r) => FILTERS[filter](r, hub.today()) && (!ui.person || r.personId === ui.person)).sort(sortAccounts);
    const total = items.reduce((a, r) => a + owed(r), 0);
    body = items.length
      ? el('div', { class: 'stack' }, [
        total ? el('p', { class: 'small muted', text: `${rand(total)} still owed across ${items.filter((r) => owed(r) > 0).length}.` }) : null,
        el('ul', { class: 'list panel' }, items.map((r) => row(hub, r))),
      ])
      : el('div', { class: 'panel empty' }, [el('p', { text: EMPTY[filter] })]);
  }
  return el('section', { class: 'stack', 'aria-label': 'Medical' }, [
    nav(hub, filter),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add', title: 'Add an account, invoice or quote' }),
      personPicker(hub),
    ]),
    body,
  ]);
}

function row(hub, r) {
  const people = hub.people.list();
  const today = hub.today();
  const left = owed(r);
  const meta = [
    r.personId ? nameOf(people, r.personId) : null,
    r.kind !== 'account' ? KIND_LABEL[r.kind] : null,
    left > 0 ? `${rand(left)} owed` : r.amount != null ? rand(r.amount) : null,
    left > 0 && r.due ? (r.due < today ? `was due ${fmtDay(r.due, today)}` : `due ${fmtDay(r.due, today)}`) : null,
    nextStep(r, today),
  ].filter(Boolean).join(' · ');
  return el('li', {}, [
    el('a', { class: 'list__main', href: hub.href('item', r.id), style: { color: 'inherit', textDecoration: 'none' } }, [
      el('strong', { text: r.provider }),
      el('div', { class: 'small muted', text: meta }),
    ]),
  ]);
}

/** A file name, a folder in the Drive folder, or a link - a link opens, the rest is shown to find. */
const proof = (label, v) => el('li', {}, [
  el('span', { class: 'list__main' }, [
    el('strong', { text: label }),
    el('div', { class: 'small' }, [v ? (/^https?:\/\//i.test(v) ? el('a', { href: v, target: '_blank', rel: 'noopener', text: v }) : el('span', { text: v, style: { wordBreak: 'break-all' } })) : el('span', { class: 'muted', text: 'Not noted yet' })]),
  ]),
]);

function claimLine(name, status, sent, back, to, today) {
  return [
    `${name}: ${CLAIM_LABEL[status].toLowerCase()}`,
    sent && status !== 'none' && status !== 'tosend' ? `sent ${fmtDay(sent, today)}` : null,
    back != null ? `${rand(back)} paid ${to === 'us' ? 'back to us' : 'to the provider'}` : null,
  ].filter(Boolean).join(' · ');
}

function itemScreen(hub, id) {
  const r0 = hub.use(`acc:${id}`, () => col(hub).get(id));
  if (r0.loading) return loading();
  if (r0.error) return failure(r0.error);
  if (!r0.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This entry no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'Back' })]);
  const r = normaliseAccount(r0.data);
  const people = hub.people.list();
  const today = hub.today();
  const save = async (next, message) => { await saveRecord(hub, col(hub), next); if (message) hub.ui.notice(message); };

  const pDay = el('input', { class: 'input', type: 'date', value: today, 'aria-label': 'Day paid', style: { maxWidth: '170px' } });
  const pAmount = el('input', { class: 'input', type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: owed(r) || '', placeholder: 'Amount', 'aria-label': 'Amount paid', style: { maxWidth: '130px' } });
  const pRef = el('input', { class: 'input', placeholder: 'Reference', 'aria-label': 'Reference', style: { maxWidth: '170px' } });
  const pTo = el('input', { class: 'input', placeholder: `Paid to (${r.provider})`, 'aria-label': 'Paid to', style: { maxWidth: '220px' } });
  const addPayment = () => {
    if (pAmount.value === '') return;
    save({ ...r, payments: [...r.payments, { day: pDay.value || null, amount: Math.max(0, Number(pAmount.value)), ref: pRef.value.trim(), to: pTo.value.trim() || r.provider }] }, 'Payment added.');
  };
  const left = owed(r);
  const missing = missingProof(r);

  return el('section', { class: 'stack', 'aria-label': r.provider }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Medical' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: KIND_LABEL[r.kind] }),
      el('h1', { text: r.provider, style: { margin: 0 } }),
      el('p', { class: 'small muted', text: [
        r.personId ? `for ${nameOf(people, r.personId)}` : 'for the family',
        r.day ? fmtDay(r.day, today) : null,
        r.amount != null ? rand(r.amount) : 'no amount yet',
        r.due ? `due ${fmtDay(r.due, today)}` : null,
      ].filter(Boolean).join(' · ') }),
      el('p', { text: r.kind === 'quote' ? 'A quote - nothing is owed until it becomes an account.' : left > 0 ? `${rand(left)} still owed.` : 'Nothing owed.' }),
      el('p', { class: 'small', text: claimLine('Medical aid', r.aidStatus, r.aidSent, r.aidBack, r.aidTo, today) }),
      el('p', { class: 'small', text: claimLine('Gap cover', r.gapStatus, r.gapSent, r.gapBack, r.gapTo, today) }),
      r.followUp ? el('p', { class: 'small', text: `${followUpDue(r, today) ? 'Follow up now' : `Follow up ${fmtDay(r.followUp, today)}`}${r.followNote ? `: ${r.followNote}` : ''}` }) : null,
      r.notes ? el('p', { text: r.notes }) : null,
      el('div', { class: 'row' }, [
        el('a', { class: 'btn', href: hub.href('edit', r.id), text: 'Edit' }),
        r.kind === 'quote' ? el('button', { class: 'btn', type: 'button', text: 'Now owed', title: 'The work was done: it is now an account', on: { click: () => save({ ...r, kind: 'account' }, 'Now an account.') } }) : null,
        r.followUp ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'Followed up', on: { click: () => save({ ...r, followUp: null, followNote: '' }, 'Follow-up cleared.') } }) : null,
      ]),
    ]),
    r.kind !== 'quote' ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Paid by us' }),
      r.payments.length ? el('ul', { class: 'list' }, r.payments.map((p, i) => el('li', {}, [
        el('span', { class: 'list__main', text: [rand(p.amount), p.day ? fmtDay(p.day, today) : null, p.to ? `to ${p.to}` : null, p.ref ? `ref ${p.ref}` : null].filter(Boolean).join(' · ') }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => save({ ...r, payments: r.payments.filter((_, j) => j !== i) }) } }),
      ]))) : el('p', { class: 'small muted', text: 'Nothing paid yet.' }),
      el('div', { class: 'row' }, [pDay, pAmount, pRef, pTo, el('button', { class: 'btn btn-primary', type: 'button', text: 'Add payment', on: { click: addPayment } })]),
      r.payments.length ? el('p', { class: 'small muted', text: `${rand(paidByUs(r))} paid by us; ${rand(outOfPocket(r))} after anything paid back to us.` }) : null,
    ]) : null,
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Where the proof is' }),
      el('ul', { class: 'list' }, [proof('Invoice or account', r.proofInvoice), proof('Proof of payment', r.proofPayment), proof('Claim statement', r.proofClaim)]),
      missing.length ? el('p', { class: 'small', text: `Still to note: ${missing.join(', ')}.` }) : null,
      el('p', { class: 'small muted', text: 'Write a file name, a folder in your Drive folder, or a link. Nothing is uploaded.' }),
    ]),
    el('button', {
      class: 'btn btn-danger', type: 'button', text: 'Delete',
      on: {
        click: async () => {
          if (!await confirmAction({ title: `Delete ${r.provider}?`, text: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) return;
          await col(hub).remove(r.id);
          hub.invalidate();
          hub.go(null);
        },
      },
    }),
  ]);
}

const claimOptions = CLAIM.map((c) => [c, CLAIM_LABEL[c]]);
const toOptions = [['provider', 'The provider'], ['us', 'Us']];

function editScreen(hub, id) {
  const r0 = id ? hub.use(`acc:${id}`, () => col(hub).get(id)) : { loading: false, data: null };
  const all = allSummaries(hub);
  if (r0.loading || all.loading) return loading();
  if (r0.error) return failure(r0.error);
  const existing = r0.data ? normaliseAccount(r0.data) : null;
  const record = existing ?? normaliseAccount({ day: hub.today(), personId: ui.person || hub.people.current()?.id || null });
  const providers = [...new Set((all.data ?? []).map((r) => r.provider))].sort();
  const people = hub.people.list();

  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.provider}` : 'Add an account, invoice or quote' }),
    recordForm({
      record: { ...record, provider: existing ? record.provider : '' },
      fields: [
        { key: 'provider', label: 'Doctor or provider', required: true, suggest: providers },
        { key: 'personId', label: 'For', type: 'select', options: [['', 'The family'], ...people.map((p) => [p.id, p.name])] },
        { key: 'kind', label: 'Kind', type: 'select', options: KINDS.map((k) => [k, KIND_LABEL[k]]) },
        { key: 'day', label: 'Date of the account', type: 'day', hint: 'The day of the visit or the account - it decides the tax year.' },
        { key: 'amount', label: 'Amount (R)', type: 'number' },
        { key: 'due', label: 'Due', type: 'day' },
        { key: 'aidStatus', label: 'Medical aid', type: 'select', options: claimOptions, group: 'Medical aid' },
        { key: 'aidSent', label: 'Sent on', type: 'day', group: 'Medical aid' },
        { key: 'aidBack', label: 'Medical aid paid (R)', type: 'number', group: 'Medical aid' },
        { key: 'aidTo', label: 'Paid to', type: 'select', options: toOptions, group: 'Medical aid' },
        { key: 'gapStatus', label: 'Gap cover', type: 'select', options: claimOptions, group: 'Gap cover', hint: 'Gap cover usually asks for the medical aid statement first.' },
        { key: 'gapSent', label: 'Sent on', type: 'day', group: 'Gap cover' },
        { key: 'gapBack', label: 'Gap cover paid (R)', type: 'number', group: 'Gap cover' },
        { key: 'gapTo', label: 'Paid to', type: 'select', options: toOptions, group: 'Gap cover' },
        { key: 'followUp', label: 'Follow up on', type: 'day', group: 'Follow-up' },
        { key: 'followNote', label: 'What to follow up', group: 'Follow-up', placeholder: 'e.g. phone the practice about the code' },
        { key: 'proofInvoice', label: 'Invoice or account', group: 'Where the proof is', placeholder: 'File name, folder or link', max: 500 },
        { key: 'proofPayment', label: 'Proof of payment', group: 'Where the proof is', placeholder: 'File name, folder or link', max: 500 },
        { key: 'proofClaim', label: 'Claim statement', group: 'Where the proof is', placeholder: 'File name, folder or link', max: 500 },
        { key: 'notes', label: 'Notes', type: 'textarea', more: true },
      ],
      onCancel: () => (existing ? hub.go('item', existing.id) : hub.go(null)),
      onSave: async (values) => {
        const saved = await saveRecord(hub, col(hub), normaliseAccount({ ...record, ...values }));
        if (!saved) return;
        hub.ui.notice(existing ? 'Saved.' : 'Added.');
        hub.go('item', saved.id);
      },
    }),
  ]);
}

function yearScreen(hub) {
  const all = allSummaries(hub);
  if (all.loading) return loading();
  if (all.error) return failure(all.error);
  const today = hub.today();
  const years = yearsOf(all.data, today);
  // Before 1 March's year is over, last year is the one to gather for.
  const year = ui.year && years.includes(ui.year) ? ui.year : (years.includes(taxYear(today) - 1) ? taxYear(today) - 1 : years[0]);
  const v = yearView(all.data, year);
  const people = hub.people.list();
  const who = (id) => (id ? nameOf(people, id) : 'The family');
  const fmt = (d) => fmtDay(d, today);
  const line = (r) => el('li', {}, [el('a', { class: 'list__main', href: hub.href('item', r.id), style: { color: 'inherit', textDecoration: 'none' } }, [
    el('strong', { text: r.provider }), el('div', { class: 'small muted', text: [who(r.personId), r.day ? fmt(r.day) : null, r.amount != null ? rand(r.amount) : null].filter(Boolean).join(' · ') }),
  ])]);
  const cols = ['Charged', 'Paid by us', 'Medical aid', 'Gap cover', 'Out of pocket'];
  const cells = (t) => [t.charged, t.paidByUs, t.aidBack, t.gapBack, t.outOfPocket].map((n) => el('td', { class: 'num', text: rand(n) }));

  return el('section', { class: 'stack', 'aria-label': 'Tax year' }, [
    nav(hub, 'year'),
    el('div', { class: 'row' }, [
      el('label', { for: 'med-year', class: 'small', text: 'SARS tax year' }),
      el('select', { class: 'select', id: 'med-year', 'data-field': 'med-year', style: { maxWidth: '260px' }, on: { change: (e) => { ui.year = Number(e.target.value); hub.render(); } } },
        years.map((y) => el('option', { value: y, selected: y === year, text: `${y}: 1 Mar ${y - 1} - ${taxYearSpan(y).to.slice(8)} Feb ${y}` }))),
    ]),
    v.family.count ? el('div', { class: 'panel table-scroll' }, [
      el('table', { class: 'plain' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: '' }), ...cols.map((c) => el('th', { class: 'num', text: c }))])]),
        el('tbody', {}, [
          ...v.perPerson.map((p) => el('tr', {}, [el('th', { text: who(p.personId) }), ...cells(p)])),
          v.perPerson.length > 1 ? el('tr', {}, [el('th', { text: 'Everyone' }), ...cells(v.family)]) : null,
        ]),
      ]),
      el('p', { class: 'small muted', text: `${v.family.count} logged in this year. Out of pocket is what we paid less anything paid back to us.${v.family.owed ? ` ${rand(v.family.owed)} is still owed.` : ''}` }),
    ]) : el('div', { class: 'panel empty' }, [el('p', { text: 'Nothing logged in this tax year.' })]),
    v.missing.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Proof still to note' }),
      el('ul', { class: 'list' }, v.missing.map(({ r, what }) => el('li', {}, [el('a', { class: 'list__main', href: hub.href('item', r.id), style: { color: 'inherit', textDecoration: 'none' } }, [
        el('strong', { text: r.provider }), el('div', { class: 'small muted', text: `${who(r.personId)} · ${what.join(', ')}` }),
      ])]))),
    ]) : null,
    v.waiting.length ? el('div', { class: 'panel stack' }, [el('h2', { text: 'Claims not settled' }), el('ul', { class: 'list' }, v.waiting.map(line))]) : null,
    v.notClaimed.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Paid, never sent to medical aid' }),
      el('p', { class: 'small muted', text: 'These will not be on the medical aid’s tax certificate, so their invoices and proof of payment are the only record.' }),
      el('ul', { class: 'list' }, v.notClaimed.map(line)),
    ]) : null,
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'To gather for this year' }),
      el('ul', {}, [
        el('li', { text: 'The medical aid’s tax certificate for the year (from the scheme, usually after the year ends).' }),
        el('li', { text: 'Invoices and proof of payment for anything paid ourselves.' }),
        el('li', { text: 'Gap cover statements, for what they paid back.' }),
        el('li', { text: 'Anything still owed or waiting on a claim, settled or noted.' }),
      ]),
      el('p', { class: 'small muted', text: 'This lists what was logged. It is not tax advice - what can be claimed is set by SARS.' }),
    ]),
    el('div', { class: 'row' }, [el('span', { class: 'small muted', text: 'Make sure everything is logged:' }), el('a', { class: 'btn', href: hub.href('all'), text: 'See all' })]),
  ]);
}
