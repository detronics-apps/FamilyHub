/** Small DOM helpers, so the UI modules read as structure rather than plumbing. */

import { groupDigits, caretAfter, countBefore, showGrouped } from '../digits.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an element.
 * @param {string} tag
 * @param {object} [attrs] properties: `class`, `text`, `on` (event map), `dataset`, `style`
 *                         (object), `money`, plus any attribute name. There is no `html`: markup
 *                         from a string is how cross-site scripting gets in - build elements, or
 *                         use `icon()` for a line icon (security baseline, D-129).
 * @param {Array<Node|string|null|undefined>} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  if (attrs.money) moneyBox(node, { negative: attrs.money === 'signed' });
  append(node, children);
  return node;
}

/**
 * An amount box that groups in threes as you type (D-127): 1500000 shows as "1 500 000".
 * `el('input', { money: true, ... })` - or `money: 'signed'` where it can go below nothing.
 * The box still reads as plain digits ("1500000"), so every `Number(box.value)` keeps working;
 * only what is shown carries the spaces.
 */
const nativeValue = typeof HTMLInputElement === 'undefined' ? null : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
export function moneyBox(node, { negative = false } = {}) {
  const shown = node.value;
  node.type = 'text'; node.inputMode = 'decimal'; node.autocomplete = 'off';
  node.removeAttribute('step'); node.removeAttribute('min'); node.removeAttribute('max');
  Object.defineProperty(node, 'value', {
    configurable: true,
    get() { const v = groupDigits(nativeValue.get.call(node), { negative }).value; return v === null ? '' : String(v); },
    set(v) { nativeValue.set.call(node, showGrouped(v === '' ? null : v, { negative })); },
  });
  node.value = shown;
  node.addEventListener('input', () => {
    const raw = nativeValue.get.call(node);
    const g = groupDigits(raw, { negative });
    if (g.text === raw) return;
    const count = countBefore(raw, node.selectionStart ?? raw.length);
    nativeValue.set.call(node, g.text);
    try { const at = caretAfter(g.text, count); node.setSelectionRange(at, at); } catch { /* not focused */ }
  }, { capture: true });
  return node;
}

/** Same as `el`, in the SVG namespace. */
export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs, true);
  append(node, children);
  return node;
}

/*
 * Line icons, by name only (D-129). The paths are fixed here and the map is frozen, so nothing a
 * family types or a file brings can become markup: icon() builds <svg>/<path> nodes, it never
 * parses a string.
 */
export const ICON_PATHS = Object.freeze({
  coffee: Object.freeze(['M6.5 8 H15.5 V13 A4.5 4.5 0 0 1 6.5 13 Z', 'M15.5 9.5 h1.8 a2.6 2.6 0 0 1 0 5.2 h-1.8', 'M4 19.5 Q 11 21.8 18 19.5', 'M9.3 5.2 q -1.4 -1.1 0 -2.2 q 1.4 -1.1 0 -2.2', 'M12.7 5.2 q -1.4 -1.1 0 -2.2 q 1.4 -1.1 0 -2.2']),
  // Routines' pictures, for children who cannot read yet.
  shoes: 'M3 17 h18 v2 H3 Z M3 17 c0-4 2-7 5-7 l3 3 h4 c3 0 6 2 6 4',
  cup: 'M6 6 H16 V14 A5 5 0 0 1 6 14 Z M16 8 h2 a2.5 2.5 0 0 1 0 5 h-2',
  hat: 'M3 17 h18 M7 17 c0-6 2-9 5-9 s5 3 5 9',
  toilet: 'M6 3 h6 v8 H6 Z M4 11 h14 c0 4 -3 6 -6 6 v4 H8 v-4',
  toothbrush: 'M4 20 L15 9 M13 7 l4 4 M15 5 v2 M17 7 v2 M19 9 v2',
  bath: 'M3 12 h18 v2 a5 5 0 0 1 -5 5 H8 a5 5 0 0 1 -5 -5 Z M6 12 V6 a2 2 0 0 1 4 0 M7 19 l-1 2 M17 19 l1 2',
  pyjamas: 'M8 4 L4 7 l2 3 2 -1 v11 h8 V9 l2 1 2 -3 -4 -3 c-1 2 -5 2 -6 0',
  book: 'M3 5 h7 a2 2 0 0 1 2 2 v12 a2 2 0 0 0 -2 -2 H3 Z M21 5 h-7 a2 2 0 0 0 -2 2 M21 5 v12 h-7 a2 2 0 0 0 -2 2',
  bag: 'M5 8 h14 l-1 12 H6 Z M9 8 V6 a3 3 0 0 1 6 0 v2',
  sun: 'M12 8 a4 4 0 1 0 0.01 0 Z M12 2 v2 M12 20 v2 M2 12 h2 M20 12 h2 M5 5 l1.5 1.5 M17.5 17.5 L19 19 M5 19 l1.5 -1.5 M17.5 6.5 L19 5',
  jacket: 'M8 3 L4 6 v15 h6 V9 M16 3 l4 3 v15 h-6 V9 M8 3 c1 2 7 2 8 0 M12 9 v12',
  hands: 'M7 21 v-8 l-2 -3 a1.2 1.2 0 0 1 2 -1 l2 2 V4 a1.2 1.2 0 0 1 2.4 0 v6 V3 a1.2 1.2 0 0 1 2.4 0 v7 V5 a1.2 1.2 0 0 1 2.4 0 v9 c0 4 -2 7 -5 7 Z',
  bed: 'M3 18 V7 M3 13 h18 v5 M21 18 v-2 M3 18 v-2 M6 13 v-2 a2 2 0 0 1 4 0 v2',
  star: 'M12 3 l2.6 5.6 6 .7 -4.5 4.1 1.3 6 -5.4 -3.1 -5.4 3.1 1.3 -6 -4.5 -4.1 6 -.7 Z',
});

/**
 * A line icon on a 24x24 grid in currentColor: a name from ICON_PATHS (an unknown name throws),
 * or - for the skill's shared test - an array of fixed path strings. Size is a number of pixels.
 */
export function icon(name, { size = 18, label = '', strokeWidth = 1.8 } = {}) {
  const paths = Array.isArray(name) ? name : ICON_PATHS[name];
  if (!paths) throw new Error(`icon(): no icon called ${String(name).slice(0, 40)}`);
  const px = Number(size) > 0 ? Number(size) : 18;
  return svg('svg', {
    viewBox: '0 0 24 24', width: px, height: px, fill: 'none', stroke: 'currentColor',
    'stroke-width': Number(strokeWidth) || 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }),
  }, [].concat(paths).map((d) => svg('path', { d })));
}

// Attributes a browser follows as a URL. A `javascript:` (or `vbscript:`) value runs code when
// clicked, so a link built from a share link, a file or typed text must never carry one.
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);
const RUNS_CODE = /^(?:javascript|vbscript):/i;

function applyAttrs(node, attrs, isSvg = false) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'text') { node.textContent = value; continue; }
    if (key === 'money') continue;
    if (key === 'html') {
      throw new Error('el(): the html attribute was removed (security baseline, D-129) - build elements, or use icon().');
    }
    // Dropped rather than thrown: bad data must not stop the screen. Browsers ignore control
    // characters and spaces inside a scheme, so they are ignored here too.
    if (URL_ATTRS.has(key) && RUNS_CODE.test(String(value).replace(/[\u0000- ]/g, ''))) continue;
    if (key === 'on') {
      for (const [type, fn] of Object.entries(value)) node.addEventListener(type, fn);
      continue;
    }
    if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
      continue;
    }
    if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
      continue;
    }
    if (!isSvg && key === 'value') { node.value = value; continue; }
    node.setAttribute(key, value === true ? '' : value);
  }
  // A new tab never gets a handle back to this page, and the site it opens is not told where
  // the click came from.
  if (attrs.target === '_blank' && !attrs.rel) node.setAttribute('rel', 'noopener noreferrer');
}

export function append(parent, children) {
  // Nested lists are flattened and numbers become text: `[' ', link]` inside the children, or a
  // count, once stopped a whole screen ("parameter 1 is not of type 'Node'").
  const list = (Array.isArray(children) ? children : [children]).flat(Infinity);
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);

/*
 * Info tooltips.
 *
 * The bubble cannot live inside the icon: the sidebar is a scroll container,
 * and anything overflowing it gets clipped no matter how high its z-index is.
 * Instead one shared bubble sits on <body> and is positioned in viewport
 * coordinates, which no ancestor can clip.
 */

let bubble = null;
let bubbleAnchor = null;

function ensureBubble() {
  if (!bubble) {
    bubble = el('div', { class: 'info__bubble', role: 'tooltip' });
    document.body.appendChild(bubble);
    // A tooltip pinned to viewport coordinates goes stale the moment anything
    // moves, so retire it rather than let it drift away from its icon.
    for (const event of ['scroll', 'resize']) {
      window.addEventListener(event, hideTooltip, true);
    }
  }
  return bubble;
}

export function hideTooltip() {
  if (bubble) bubble.style.display = 'none';
  bubbleAnchor = null;
}

function showTooltip(anchor, text) {
  const node = ensureBubble();
  bubbleAnchor = anchor;
  node.textContent = text;
  node.style.display = 'block';
  node.style.left = '0px';
  node.style.top = '0px';

  const a = anchor.getBoundingClientRect();
  const b = node.getBoundingClientRect();
  const margin = 8;

  // Centre on the icon, then pull back inside the viewport at either edge.
  const left = Math.min(
    Math.max(margin, a.left + a.width / 2 - b.width / 2),
    window.innerWidth - b.width - margin,
  );
  // Above by preference; below when there is no room up there.
  const above = a.top - b.height - margin;
  const top = above >= margin ? above : a.bottom + margin;

  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

/** An inline info icon whose tooltip appears on hover and on keyboard focus. */
export function infoIcon(text) {
  const icon = el('button', {
    class: 'info',
    type: 'button',
    'aria-label': text,
    tabindex: '0',
    text: 'i',
    on: {
      mouseenter: () => showTooltip(icon, text),
      mouseleave: () => hideTooltip(),
      focus: () => showTooltip(icon, text),
      blur: () => hideTooltip(),
      click: (e) => {
        // On touch there is no hover, so a tap toggles it.
        e.preventDefault();
        if (bubbleAnchor === icon) hideTooltip();
        else showTooltip(icon, text);
      },
    },
  });
  return icon;
}

/** A labelled form field, optionally with an info icon and a hint line. */
export function field(label, control, { info, hint } = {}) {
  const id = control.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  control.id = id;
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id }, [label, info ? infoIcon(info) : null]),
    control,
    hint ? el('div', { class: 'field__hint', text: hint }) : null,
  ]);
}

/** A <select> bound to a change handler. */
export function select(options, value, onChange, attrs = {}) {
  const node = el('select', { class: 'select', ...attrs, on: { change: (e) => onChange(e.target.value) } });
  for (const opt of options) {
    node.appendChild(el('option', {
      value: String(opt.value),
      text: opt.label,
      selected: String(opt.value) === String(value),
    }));
  }
  node.value = String(value);
  return node;
}

/** A row of mutually exclusive chips. */
export function chips(options, value, onChange) {
  return el('div', { class: 'chipset' }, options.map((opt) => el('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': String(String(opt.value) === String(value)),
    text: opt.label,
    title: opt.title || null,
    on: { click: () => onChange(opt.value) },
  })));
}

/** A short-lived confirmation message. */
export function toast(message) {
  const existing = $('.toast');
  if (existing) existing.remove();
  const node = el('div', { class: 'toast', role: 'status', text: message });
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

/** Trigger a download of `blob` without ever leaving the page. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
