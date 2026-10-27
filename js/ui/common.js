// Shared UI pieces: avatars, dialogs, and the chore card used by every chore screen.

import { el } from './dom.js';
import { addDays, fmtAgo, fmtDay, fmtFrequency } from '../dates.js';
import { personName, roomName, removeDemo } from '../model.js';

export const HOUSE_ICON = '<svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">'
  + '<rect width="64" height="64" rx="12" fill="var(--accent)"/>'
  + '<path d="M14 31 L32 15 L50 31" fill="none" stroke="var(--panel)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M19 29 V49 H45 V29" fill="var(--panel)"/>'
  + '<path d="M32 45 c-6 -4 -9 -7 -9 -10.5 a4.5 4.5 0 0 1 9 -1.5 a4.5 4.5 0 0 1 9 1.5 c0 3.5 -3 6.5 -9 10.5 z" fill="var(--accent)"/>'
  + '</svg>';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export function avatar(person) {
  if (!person) return el('span', { class: 'avatar avatar--none', 'aria-hidden': 'true', text: '?' });
  return el('span', { class: 'avatar', 'aria-hidden': 'true', style: { background: person.colour }, text: initials(person.name) });
}

/**
 * A native <dialog>: Escape closes it, focus stays inside, and a click on the
 * backdrop closes it too. It lives on <body>, outside the re-rendered app.
 */
export function modal({ title, body = [], foot = [], onClose = null, wide = false }) {
  let closed = false;
  const dialog = el('dialog', { class: 'modal', 'aria-label': title, style: wide ? { width: 'min(720px, calc(100vw - 24px))' } : null });
  const close = () => {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose?.();
  };
  dialog.append(
    el('div', { class: 'modal__head' }, [
      el('h2', { text: title }),
      el('button', { class: 'btn btn-quiet btn-icon x-btn', type: 'button', 'aria-label': 'Close', title: 'Close', text: '×', on: { click: close } }),
    ]),
    el('div', { class: 'modal__body' }, body),
    foot.length ? el('div', { class: 'modal__foot' }, foot) : null,
  );
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });   // the backdrop
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

/** Ask before anything that cannot be undone. Resolves true only on the confirm button. */
export function confirmAction({ title, text, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const { close } = modal({
      title,
      body: (Array.isArray(text) ? text : [text]).map((t) => (typeof t === 'string' ? el('p', { text: t }) : t)),
      foot: [
        el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
        el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', text: confirmLabel, on: { click: () => { answer = true; close(); } } }),
      ],
      onClose: () => resolve(answer),
    });
  });
}

const EFFORT_WORD = { low: 'low effort', medium: 'some effort', high: 'a big effort' };

/** "Kitchen · about 5 min · low effort · weekly" - every estimate says it is one. */
export function choreMeta(h, chore, { room = true } = {}) {
  return [
    room ? roomName(h, chore.roomId) : null,
    chore.minutes != null ? `about ${chore.minutes} min` : null,
    chore.effort ? EFFORT_WORD[chore.effort] : null,
    fmtFrequency(chore.frequency),
    chore.cost != null ? `about ${chore.cost} to spend` : null,
  ].filter(Boolean).join(' · ');
}

/** Where a chore stands, in words, without a guilt count. */
export function statusLine(h, occ, today) {
  const last = occ.lastDone ? `Last done ${fmtAgo(occ.lastDone.day, today)} by ${personName(h, occ.lastDone.by)}.` : 'Not done yet.';
  if (occ.state === 'closed') return `Finished. ${last}`;
  if (occ.state === 'waiting') return `${last} Next ${fmtDay(occ.dueDay, today)}.`;
  return `${last} Ready now.`;
}

/**
 * One chore with Done and "Not now". `label` heads the card (momentum picks),
 * `reasons` become pills (why it was suggested).
 */
export function choreCard(ctx, chore, occ, { label = null, reasons = [], onDone = null, showRoom = true } = {}) {
  const h = ctx.app.household;
  const today = ctx.today();
  const open = ctx.app.ui.openLater === chore.id;
  const details = [chore.description, chore.instructions && `How: ${chore.instructions}`, chore.easier && `Makes it easier: ${chore.easier}`].filter(Boolean);

  const pillClass = (r) => (r === 'Important' ? 'pill pill--important' : r === 'Optional improvement' ? 'pill pill--optional' : 'pill');

  return el('article', { class: 'card', 'aria-label': chore.name }, [
    label ? el('div', { class: 'card__label', text: label }) : null,
    el('div', { class: 'card__top' }, [
      el('div', { class: 'list__main' }, [
        el('div', { class: 'card__title' }, [chore.name, chore.demo ? ' ' : null, chore.demo ? el('span', { class: 'badge badge--demo', text: 'Example' }) : null]),
        el('div', { class: 'card__meta', text: choreMeta(h, chore, { room: showRoom }) }),
        el('div', { class: 'card__meta muted', text: statusLine(h, occ, today) }),
      ]),
    ]),
    reasons.length ? el('div', { class: 'pills' }, reasons.map((r) => el('span', { class: pillClass(r), text: r }))) : null,
    details.length ? el('details', { class: 'more' }, [el('summary', { text: 'Details' }), ...details.map((t) => el('p', { class: 'small', text: t }))]) : null,
    occ.state === 'closed' ? null : el('div', { class: 'card__actions' }, [
      el('button', {
        class: 'btn', type: 'button', 'aria-expanded': String(open), 'data-field': `later:${chore.id}`,
        text: 'Not now',
        on: { click: () => { ctx.app.ui.openLater = open ? null : chore.id; ctx.render(); } },
      }),
      ctx.session && ctx.session.state()?.id !== chore.id ? el('button', {
        class: 'btn', type: 'button', 'data-field': `start:${chore.id}`, text: 'Start',
        title: 'Start a timer for this chore (with optional music)',
        on: {
          click: () => ctx.session.start({
            id: chore.id,
            title: chore.name,
            minutes: chore.minutes ?? ctx.app.execute.filters.minutes ?? null,
            onDone: () => { const ev = ctx.act(chore.id, 'done'); onDone?.(ev); },
          }),
        },
      }) : null,
      el('button', {
        class: 'btn btn-primary', type: 'button', 'data-field': `done:${chore.id}`, text: 'Done',
        on: {
          click: () => {
            if (ctx.session?.state()?.id === chore.id) ctx.session.stop();
            const ev = ctx.act(chore.id, 'done');
            onDone?.(ev);
          },
        },
      }),
    ]),
    open ? laterMenu(ctx, chore, today) : null,
  ]);
}

function laterMenu(ctx, chore, today) {
  const once = chore.frequency.unit === 'once';
  const date = el('input', { class: 'input', type: 'date', min: addDays(today, 1), value: addDays(today, 3), 'data-field': `date:${chore.id}`, 'aria-label': 'Move to this date', style: { width: 'auto' } });
  return el('div', { class: 'later-menu', role: 'group', 'aria-label': `Put off ${chore.name}` }, [
    el('button', { class: 'btn btn-small', type: 'button', text: 'Tomorrow', on: { click: () => ctx.act(chore.id, 'deferred', addDays(today, 1)) } }),
    el('button', { class: 'btn btn-small', type: 'button', text: 'Next week', on: { click: () => ctx.act(chore.id, 'deferred', addDays(today, 7)) } }),
    el('span', { class: 'row' }, [
      date,
      el('button', { class: 'btn btn-small', type: 'button', text: 'Move date', on: { click: () => { if (date.value) ctx.act(chore.id, 'rescheduled', date.value); } } }),
    ]),
    once
      ? el('button', { class: 'btn btn-small', type: 'button', text: 'Not needed', on: { click: () => ctx.act(chore.id, 'dropped') } })
      : el('button', { class: 'btn btn-small', type: 'button', text: 'Skip', title: 'Let this round go. It comes back on its normal cycle.', on: { click: () => ctx.act(chore.id, 'skipped') } }),
  ]);
}

/** Notice for example data, shown on the screens that display it. */
export function demoNotice(ctx) {
  return {
    id: 'demo-data',
    level: 'warn',
    text: 'You are looking at an example family. Try anything - then remove it when you are ready to add your own.',
    action: { label: 'Remove examples', onClick: () => removeExamples(ctx) },
  };
}

export async function removeExamples(ctx) {
  const ok = await confirmAction({
    title: 'Remove the example family?',
    text: 'This removes every example person, room and chore, and their history. Anything you added yourself stays.',
    confirmLabel: 'Remove examples',
  });
  if (!ok) return;
  const next = removeDemo(ctx.app.household);
  if (!next.people.some((p) => p.id === ctx.app.device.currentPersonId)) ctx.setDevice({ currentPersonId: null });
  ctx.commit(next);
}
