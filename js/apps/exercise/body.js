// The little human (D-109): a body from the front and the back, each muscle shaded by how much
// it is worked - 0 is not drawn, 1 is the darkest. The muscles are named beside it, for anyone
// who cannot see the shading.

import { el, svg } from '../../ui/dom.js';
import { MUSCLES, muscleName } from './logic.js';

const e = (cx, cy, rx, ry) => ['ellipse', { cx, cy, rx, ry }];
const r = (x, y, width, height, rx = 6) => ['rect', { x, y, width, height, rx }];
const pair = (f) => [f(0), f(1)];
const mx = (x, i) => (i ? 120 - x : x);   // the mirror side

const FRONT = {
  shoulders: pair((i) => e(mx(34, i), 41, 8, 6)),
  chest: pair((i) => e(mx(50, i), 53, 10, 8)),
  biceps: pair((i) => e(mx(29, i), 60, 5, 11)),
  forearms: pair((i) => e(mx(25, i), 96, 5, 13)),
  core: [r(48, 64, 24, 38)],
  quads: pair((i) => e(mx(49, i), 136, 8, 22)),
  calves: pair((i) => e(mx(49, i), 180, 6, 13)),
};
const BACK = {
  shoulders: FRONT.shoulders,
  upperback: [r(42, 42, 36, 24, 8)],
  lowerback: [r(48, 70, 24, 26)],
  triceps: FRONT.biceps,
  forearms: FRONT.forearms,
  glutes: pair((i) => e(mx(50, i), 112, 10, 9)),
  hamstrings: pair((i) => e(mx(49, i), 142, 8, 18)),
  calves: FRONT.calves,
};
const OUTLINE = [['circle', { cx: 60, cy: 17, r: 12 }], r(54, 27, 12, 8, 3), r(37, 34, 46, 72, 12),
  ...pair((i) => r(mx(23, i) - (i ? 13 : 0), 36, 13, 44)), ...pair((i) => r(mx(19, i) - (i ? 12 : 0), 80, 12, 38)),
  ...pair((i) => r(mx(40, i) - (i ? 19 : 0), 104, 19, 100, 8))];

function side(label, regions, levels) {
  return el('figure', { style: { margin: 0, textAlign: 'center' } }, [
    svg('svg', { viewBox: '0 0 120 210', width: 96, height: 168, role: 'img', 'aria-label': label }, [
      svg('g', { fill: 'var(--panel-2)', stroke: 'var(--border-strong)', 'stroke-width': 1 }, OUTLINE.map(([t, a]) => svg(t, a))),
      svg('g', { fill: 'var(--accent)' }, Object.entries(regions).filter(([m]) => levels[m] > 0)
        .flatMap(([m, shapes]) => shapes.map(([t, a]) => svg(t, { ...a, 'fill-opacity': (0.2 + 0.8 * levels[m]).toFixed(2), 'data-muscle': m })))),
    ]),
    el('figcaption', { class: 'small muted', text: label }),
  ]);
}

/** The figure, with the muscles in words: `text(m)` says how much for each one worked. */
export function bodyFigure(levels, { text = null, none = 'No muscles chosen yet.' } = {}) {
  const worked = MUSCLES.filter(([m]) => levels[m] > 0);
  return el('div', { class: 'row', style: { alignItems: 'flex-start', gap: '12px' }, 'data-field': 'body-figure' }, [
    side('Front', FRONT, levels), side('Back', BACK, levels),
    el('div', { class: 'small', style: { flex: '1', minWidth: '140px' } }, worked.length
      ? worked.map(([m]) => el('div', { text: text ? `${muscleName(m)}: ${text(m)}` : muscleName(m) }))
      : [el('span', { class: 'muted', text: none })]),
  ]);
}
