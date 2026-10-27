// Connect your laptop and phones (D-063): every step, in order, and what can go wrong.
// The words live in ../../guide.js (CONNECT), so they are searched and tested with the rest.

import { el } from '../dom.js';
import { fold } from '../common.js';
import { CONNECT } from '../../guide.js';

export function connectView(ctx) {
  const address = `${location.origin}${location.pathname}`;
  const fill = (s) => s.replaceAll('{address}', address);
  const list = (steps) => el('ol', { class: 'howto-steps' }, steps.map((s) => el('li', { text: fill(s) })));
  const laptop = ctx.folderSupported();
  return el('section', { class: 'stack', 'aria-labelledby': 'connect-title' }, [
    el('h1', { id: 'connect-title', text: CONNECT.title }),
    el('p', { text: CONNECT.intro }),
    el('p', { class: 'panel small', 'data-field': 'connect-here', text: laptop
      ? 'You are on a computer: start with step 1. Then do steps 2 to 4 on each phone.'
      : 'You are on a phone: a laptop needs step 1 first. Then do steps 2, 3 and 4 here.' }),
    fold('connect:how', 'How it works', [el('ul', {}, CONNECT.how.map((s) => el('li', { text: s })))], { cls: 'panel' }),
    ...CONNECT.parts.map((p) => fold(`connect:${p.id}`, p.title, [
      p.steps ? list(p.steps) : null,
      ...(p.devices ?? []).map((d) => el('div', {}, [el('h3', { text: d.name, style: { margin: 'var(--space-2) 0 0' } }), list(d.steps)])),
    ], { cls: 'panel', open: true })),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What can go wrong', style: { margin: 0 } }),
      ...CONNECT.problems.map((x, i) => fold(`connect:problem:${i}`, x.q, [el('p', { style: { margin: 0 }, text: fill(x.a) })], { open: false })),
    ]),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-primary', href: '#/settings/drive', text: 'Google Drive', title: 'Settings › Google Drive on this device' }),
      el('a', { class: 'btn', href: '#/help', text: 'Guide', title: 'How to use Family Hub' }),
    ]),
  ]);
}
