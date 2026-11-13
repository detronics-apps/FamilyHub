// How much detail (D-121): one choice for the whole app - Simple, Advanced or Expert - kept on this
// device, in a bar under the top bar that follows you down the page and folds to a small tab. Every
// app reads the same choice (`shows`). Expert is what the Finance tools first called Learn.

import { el } from './dom.js';
import { KEYS } from '../storage.js';

export const LEVELS = [
  { id: 'simple', label: 'Simple', says: 'Just what you need - the answer and the few things that matter most.' },
  { id: 'advanced', label: 'Advanced', says: 'Every figure and choice, the timelines, and what moves the answer.' },
  { id: 'expert', label: 'Expert', says: 'Everything in Advanced, plus how each number is worked out, step by step.' },
];
const RANK = { simple: 0, advanced: 1, expert: 2, learn: 2 };   // "learn": the Finance tools' old name for Expert

export function level() {
  try {
    const v = localStorage.getItem(KEYS.level) ?? { learn: 'expert' }[localStorage.getItem(KEYS.financeLevel)] ?? localStorage.getItem(KEYS.financeLevel);
    return LEVELS.some((l) => l.id === v) ? v : 'simple';
  } catch { return 'simple'; }
}
export function setLevel(id) { try { localStorage.setItem(KEYS.level, id); } catch { /* this device only */ } }

/** Is this much detail on? `shows('advanced')`, `shows('expert')` (`'learn'` still works). */
export const shows = (want) => RANK[level()] >= (RANK[want] ?? 0);

const folded = () => { try { return localStorage.getItem(KEYS.levelFolded) === '1'; } catch { return false; } };

/** The bar under the top bar: the three, the chosen one's sentence, and Hide - or, hidden, a small tab to open it. */
export function levelBar(render) {
  const now = level();
  const fold = (on) => { try { localStorage.setItem(KEYS.levelFolded, on ? '1' : '0'); } catch { /* this device only */ } render(); };
  if (folded()) {
    return el('div', { class: 'level-bar level-bar--folded' }, [
      el('button', { class: 'level-tab', type: 'button', text: '⋯', 'aria-label': `How much detail: ${LEVELS.find((l) => l.id === now).label} - open`, title: 'How much detail', 'data-field': 'level-open', on: { click: () => fold(false) } }),
    ]);
  }
  return el('div', { class: 'level-bar', role: 'group', 'aria-label': 'How much detail' }, [
    el('div', { class: 'chipset' }, LEVELS.map((l) => el('button', {
      class: 'chip chip--small', type: 'button', 'aria-pressed': String(l.id === now), 'data-field': `level:${l.id}`, text: l.label,
      on: { click: () => { setLevel(l.id); render(); } },
    }))),
    el('span', { class: 'level-bar__says small muted', text: LEVELS.find((l) => l.id === now).says }),
    el('button', { class: 'btn btn-small btn-quiet level-bar__hide', type: 'button', text: 'Hide', title: 'Fold this away - a small tab stays to open it', 'data-field': 'level-hide', on: { click: () => fold(true) } }),
  ]);
}
