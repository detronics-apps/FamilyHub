// A page that is not a core screen or an installed mini-app. Planned modules
// say so plainly - nothing here pretends to work.

import { el } from '../dom.js';
import { COMING_LATER } from '../../apps/catalogue.js';

export function placeholderView(ctx, route) {
  const planned = COMING_LATER.find((m) => m.id === route.name);
  if (!planned) {
    return el('section', { class: 'panel empty' }, [
      el('h1', { text: 'That page does not exist' }),
      el('p', { text: 'It may belong to a mini-app that is not installed.' }),
      el('div', { class: 'row', style: { justifyContent: 'center' } }, [
        el('a', { class: 'btn btn-primary', href: '#/', text: 'Home' }),
        el('a', { class: 'btn', href: '#/library', text: 'Mini-apps' }),
      ]),
    ]);
  }
  return el('section', { class: 'panel empty' }, [
    el('h1', { text: planned.name }),
    el('p', { text: planned.purpose }),
    el('p', { class: 'muted', text: `${planned.name} is not built yet. It will arrive as a mini-app you can install.` }),
    el('a', { class: 'btn', href: '#/', text: 'Home' }),
  ]);
}
