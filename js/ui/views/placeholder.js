// Modules that are planned but not built. They say so plainly - nothing here
// pretends to work.

import { el } from '../dom.js';
import { MODULES } from '../../dashboard.js';

export function placeholderView(ctx, route) {
  const mod = MODULES.find((m) => m.id === route.name);
  if (!mod) {
    return el('section', { class: 'panel empty' }, [
      el('h1', { text: 'That page does not exist' }),
      el('a', { class: 'btn btn-primary', href: '#/', text: 'Back to home' }),
    ]);
  }
  return el('section', { class: 'panel empty' }, [
    el('h1', { text: mod.name }),
    el('p', { text: mod.purpose }),
    el('p', { class: 'muted', text: `${mod.name} is not built yet. This first version builds Chores properly before adding more. You can hide this button in Settings if you will not use it.` }),
    el('div', { class: 'row', style: { justifyContent: 'center' } }, [
      el('a', { class: 'btn btn-primary', href: '#/chores', text: 'Go to Chores' }),
      el('a', { class: 'btn', href: '#/', text: 'Back to home' }),
    ]),
  ]);
}
