// Footer documents: privacy and about. Text lives in js/guide.js.

import { el } from '../dom.js';
import { modal } from '../common.js';
import { PRIVACY, ABOUT } from '../../guide.js';

export function openDoc(which) {
  const doc = which === 'privacy' ? PRIVACY : ABOUT;
  modal({
    title: doc.title,
    body: doc.sections.map(([heading, text]) => el('div', {}, [el('h3', { text: heading }), el('p', { text })])),
  });
}
