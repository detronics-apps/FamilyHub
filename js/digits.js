// Amounts grouped in threes as you type (D-127): "1 500 000", so the zeros can be counted at a glance.
// Pure - the box itself (moneyBox in js/ui/dom.js) keeps the caret where the person was typing.

/** What counts in a typed amount: digits, one decimal mark ("." or ","), a leading minus. */
const meaningful = (ch) => /[0-9.,-]/.test(ch);

/**
 * Tidy a typed amount: spaces between thousands, the decimals left as typed.
 * @returns { text, value } - value is the number (null when empty or not yet a number, e.g. "-").
 */
export function groupDigits(raw, { negative = false } = {}) {
  let s = String(raw ?? '').replace(/[^0-9.,-]/g, '');
  const minus = negative && s.startsWith('-');
  s = s.replace(/-/g, '');
  const at = s.search(/[.,]/);
  let whole = at < 0 ? s : s.slice(0, at);
  const mark = at < 0 ? '' : s[at];
  const frac = at < 0 ? '' : s.slice(at + 1).replace(/[.,]/g, '');
  whole = whole.replace(/^0+(?=\d)/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const text = `${minus ? '-' : ''}${grouped}${mark}${frac}`;
  const n = Number(`${minus ? '-' : ''}${whole || (frac ? '0' : '')}${frac ? `.${frac}` : ''}`);
  return { text, value: whole === '' && frac === '' ? null : Number.isFinite(n) ? n : null };
}

/** Where the caret goes in the tidied text: after as many digits and marks as were before it. */
export function caretAfter(text, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (meaningful(text[i])) seen += 1;
    if (seen === count) return i + 1;
  }
  return text.length;
}

/** How many digits and marks come before a position in what was typed. */
export const countBefore = (raw, pos) => [...String(raw).slice(0, pos)].filter(meaningful).length;

/** A stored number shown grouped: 1500000 → "1 500 000". */
export const showGrouped = (n, opts) => (n === null || n === undefined || n === '' ? '' : groupDigits(String(n), opts).text);
