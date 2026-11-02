// Footer documents: privacy, about, and the licence and terms. Text lives in js/guide.js.

import { el } from '../dom.js';
import { modal } from '../common.js';
import { PRIVACY, ABOUT, LICENCE } from '../../guide.js';

export function openDoc(which) {
  const doc = which === 'privacy' ? PRIVACY : which === 'licence' ? LICENCE : ABOUT;
  modal({
    title: doc.title,
    body: [
      ...doc.sections.map(([heading, text]) => el('div', {}, [el('h3', { text: heading }), el('p', { text, style: { whiteSpace: 'pre-wrap' } })])),
      which === 'licence' ? el('p', {}, ['If Family Hub helps your family: ', el('a', { href: 'https://buymeacoffee.com/detronics', target: '_blank', rel: 'noopener noreferrer', text: 'Buy me a coffee', 'data-field': 'licence-coffee' }), '.']) : null,
    ],
  });
}
