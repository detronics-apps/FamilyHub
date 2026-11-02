// Ways to pick one (D-099, shared by Play now and Dates in D-102): a list, spin a wheel, a
// surprise, this or that, and eeny meeny. The caller keeps the state and draws the chosen card.

import { el } from '../../ui/dom.js';
import { wheel, landOn, thisOrThat } from './activities.js';

export const MODES = [['list', 'List'], ['spin', 'Spin'], ['surprise', 'Surprise'], ['this', 'This or that'], ['eeny', 'Eeny meeny']];
export const newChoice = () => ({ mode: 'list', shown: 3, off: new Set(), chosen: null, queue: null, turn: 0, rolling: false });
const calm = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const shuffle = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * @param found  what fits, best first
 * @param st     the state (newChoice()), kept by the caller
 * @param o      { idOf, weightOf, card(item, big), prefix ('play'), thisHelp, label ('activity') }
 * @returns { modes, panel, chosen } - elements (or null) to place on the page
 */
export function chooser(hub, found, st, o) {
  const { idOf, weightOf, card, prefix = 'play', thisHelp = 'Tap the one you want; the winner stays.', label = 'Activity' } = o;
  const byId = (id) => found.find((x) => idOf(x) === id);
  const pickMode = el('div', { class: 'stack', style: { gap: '6px' } }, [el('strong', { text: 'How to choose' }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'How to choose' }, MODES.map(([v, t]) => el('button', {
      class: 'chip', type: 'button', text: t, 'aria-pressed': String(st.mode === v), 'data-field': `${prefix}-mode:${v}`, style: { padding: '10px 16px', fontSize: '1.05em' },
      on: { click: () => { st.mode = v; st.chosen = null; st.queue = null; hub.render(); } } })))]);

  const wheelPanel = () => {
    const on = found.filter((x) => !st.off.has(idOf(x))).slice(0, 8);
    const slices = wheel(on, weightOf);
    const R = 140; const C = 150;
    const pt = (t, r = R) => [C + r * Math.sin(t * 2 * Math.PI), C - r * Math.cos(t * 2 * Math.PI)];
    const fills = ['var(--accent-strong)', 'var(--ok)', 'var(--warn)', 'var(--text-dim)'];
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs, kids = []) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); n.append(...kids); return n; };
    const g = mk('g', { style: `transform-origin: ${C}px ${C}px; transform: rotate(${st.turn}deg)` }, slices.map((s, i) => {
      const [x1, y1] = pt(s.from); const [x2, y2] = pt(s.to); const mid = (s.from + s.to) / 2; const [tx, ty] = pt(mid, R * 0.62);
      const name = s.a.name.length > 14 ? `${s.a.name.slice(0, 13)}…` : s.a.name;
      return mk('g', {}, [
        mk('path', { d: slices.length === 1 ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z` : `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${s.to - s.from > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`, fill: fills[i % fills.length], stroke: 'var(--bg)', 'stroke-width': 2 }),
        mk('text', { x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: 'var(--bg)', 'font-size': 12, 'font-weight': 700, transform: `rotate(${mid * 360 - 90 + (mid > 0.5 ? 180 : 0)} ${tx} ${ty})` }, [name]),
      ]);
    }));
    const svg = mk('svg', { viewBox: '0 0 300 320', role: 'img', 'aria-label': `${label} wheel`, style: 'width: 100%; max-width: 320px; display: block; margin: 0 auto' }, [g, mk('path', { d: `M ${C - 12} 2 L ${C + 12} 2 L ${C} 26 Z`, fill: 'var(--text)' })]);
    const spin = () => {
      if (!slices.length || st.rolling) return;
      const hit = landOn(slices, Math.random());
      const at = (hit.from + hit.to) / 2;
      const target = st.turn - (st.turn % 360) + 360 * 5 + (360 - at * 360);
      st.chosen = null; st.rolling = true;
      const done = () => { st.turn = target % 360; st.rolling = false; st.chosen = idOf(hit.a); hub.render(); };
      if (calm()) { done(); return; }
      g.style.transition = 'transform 3.2s cubic-bezier(0.15, 0.85, 0.25, 1)';
      requestAnimationFrame(() => { g.style.transform = `rotate(${target}deg)`; });
      setTimeout(done, 3300);
    };
    return el('div', { class: 'panel stack', 'data-field': `${prefix}-wheel` }, [
      on.length ? svg : el('p', { class: 'muted', text: 'Nothing on the wheel - tick some below.' }),
      el('div', { class: 'row', style: { justifyContent: 'center' } }, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Spin', 'data-field': `${prefix}-spin`, disabled: !on.length, on: { click: spin } })]),
      el('details', { class: 'more' }, [el('summary', { text: `On the wheel (${on.length})` }),
        el('p', { class: 'small muted', text: 'Untick any you do not want; up to 8 fit.' }),
        ...found.slice(0, 16).map((x) => el('label', { class: 'checkline' }, [el('input', { type: 'checkbox', checked: !st.off.has(idOf(x)), on: { change: (e) => { if (e.target.checked) st.off.delete(idOf(x)); else st.off.add(idOf(x)); hub.render(); } } }), x.name]))]),
    ]);
  };

  const thisPanel = () => {
    if (!st.queue) st.queue = shuffle(found.map(idOf)).slice(0, 8);
    if (st.queue.length < 2) { if (st.queue[0]) st.chosen = st.queue[0]; return null; }
    const big = (id) => el('button', { class: 'panel', type: 'button', 'data-field': `tot:${id}`, style: { flex: '1 1 140px', minHeight: '8rem', fontSize: '1.3em', fontWeight: 700, cursor: 'pointer' },
      on: { click: () => { st.queue = thisOrThat(st.queue, id); if (st.queue.length === 1) st.chosen = id; hub.render(); } } }, [byId(id)?.name ?? '']);
    return el('div', { class: 'stack', 'data-field': `${prefix}-tot` }, [
      el('p', { class: 'small muted', style: { margin: 0 }, text: `${thisHelp} ${st.queue.length - 1} more round${st.queue.length === 2 ? '' : 's'}.` }),
      el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'stretch' } }, [big(st.queue[0]), el('span', { style: { alignSelf: 'center' }, text: 'or' }), big(st.queue[1])]),
    ]);
  };

  const eenyPanel = () => {
    const xs = found.slice(0, 8);
    const cards = xs.map((x) => el('div', { class: 'panel', 'data-field': `eeny:${idOf(x)}`, style: { flex: '1 1 140px', margin: 0, fontWeight: 700, transition: 'background 0.1s' }, text: x.name }));
    const go = () => {
      if (!xs.length || st.rolling) return;
      const end = Math.floor(Math.random() * xs.length);
      if (calm()) { st.chosen = idOf(xs[end]); hub.render(); return; }
      const steps = xs.length * 3 + end; let i = 0; st.rolling = true;
      const tick = () => {
        cards.forEach((c, j) => { c.style.background = j === i % xs.length ? 'var(--accent-soft)' : ''; });
        if (i >= steps) { st.rolling = false; setTimeout(() => { st.chosen = idOf(xs[end]); hub.render(); }, 500); return; }
        i += 1; setTimeout(tick, 70 + (i / steps) ** 3 * 380);
      };
      tick();
    };
    return el('div', { class: 'stack', 'data-field': `${prefix}-eeny` }, [
      el('div', { class: 'row', style: { gap: '6px' } }, cards),
      el('div', {}, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Go', 'data-field': `${prefix}-eeny-go`, on: { click: go } })]),
    ]);
  };

  const surprise = () => { const pool = found.filter((x) => idOf(x) !== st.chosen); const x = pool[Math.floor(Math.random() * pool.length)] ?? found[0]; st.chosen = x ? idOf(x) : null; hub.render(); };
  let panel;
  if (st.mode === 'spin') panel = wheelPanel();
  else if (st.mode === 'surprise') panel = el('div', {}, [el('button', { class: 'btn btn-primary', type: 'button', text: st.chosen ? 'Another' : 'Surprise me', 'data-field': `${prefix}-surprise`, on: { click: surprise } })]);
  else if (st.mode === 'this') panel = thisPanel();
  else if (st.mode === 'eeny') panel = eenyPanel();
  else panel = el('div', { class: 'stack', 'data-field': `${prefix}-found` }, [...found.slice(0, st.shown).map((x) => card(x, false)),
    found.length > st.shown ? el('div', {}, [el('button', { class: 'btn', type: 'button', text: 'More', on: { click: () => { st.shown += 3; hub.render(); } } })]) : null]);
  const pickedItem = st.chosen ? byId(st.chosen) : null;
  const chosen = pickedItem && st.mode !== 'list' ? el('div', { class: 'stack', 'data-field': `${prefix}-chosen` }, [card(pickedItem, true),
    el('div', {}, [el('button', { class: 'btn btn-quiet', type: 'button', text: 'Choose again', on: { click: () => { st.chosen = null; st.queue = null; hub.render(); } } })])]) : null;
  return { modes: found.length > 1 ? pickMode : null, panel, chosen };
}
