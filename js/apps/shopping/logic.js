// Shopping: one family list that anything can send to - a week's meal plan, a
// meal or recipe, a chore's supplies - plus whatever anyone types in. Pure.
//
// Each item remembers where it came from (`source`). Sending from the same
// place again replaces those items with the new amounts instead of doubling
// them; what was already bought stays bought, and typed-in items are never
// touched by a send.

import { parseIngredient, unitKey } from '../meals/logic.js';

export const GROUPS = { food: 'Food', cleaning: 'Cleaning', household: 'Household', other: 'Other' };
export const LIST_ID = 'shopping_list';

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
const nameKey = (n) => String(n).toLowerCase().trim().replace(/\s+/g, ' ').replace(/(es|s)$/, '');

export function normaliseShopping(list = {}) {
  const items = (Array.isArray(list.items) ? list.items : [])
    .filter((i) => i && str(i.name))
    .map((i, n) => ({
      id: str(i.id, 40) || `it${n}`,
      name: str(i.name, 120), qty: num(i.qty), unit: unitKey(str(i.unit, 20)), note: str(i.note, 120),
      checked: i.checked === true,
      // Lists made before Shopping was its own section said `fromWeek`.
      source: str(i.source, 80) || (typeof i.fromWeek === 'string' ? `week:${i.fromWeek}` : ''),
      from: str(i.from, 80),
      group: GROUPS[i.group] ? i.group : 'food',
    }));
  return { ...list, items };
}

/**
 * Put a source's items on the list. `needed` is [{ name, qty, unit, note }].
 * @param source  where they came from, e.g. "week:2026-10-19", "meal:rec_1", "chore:c_1"
 * @param from    a name for people to read, e.g. "Tuna pasta"
 */
export function addFromSource(list, { source, from = '', group = 'food' }, needed, newId = (i) => `${source}_${i}_${Date.now().toString(36)}`) {
  const keep = list.items.filter((i) => i.source !== source);
  const before = new Map(list.items.filter((i) => i.source === source).map((i) => [`${nameKey(i.name)}|${i.unit}`, i]));
  const added = needed.filter((n) => str(n.name)).map((n, i) => {
    const prev = before.get(`${nameKey(n.name)}|${unitKey(n.unit)}`);
    return { id: prev?.id ?? newId(i), name: str(n.name, 120), qty: num(n.qty), unit: unitKey(n.unit ?? ''), note: str(n.note, 120), checked: prev?.checked ?? false, source, from: str(from, 80), group: GROUPS[group] ? group : 'food' };
  });
  return { ...list, items: [...keep, ...added] };
}

/** The meal plan's own send, kept by name for the week screen. */
export const refreshFromPlan = (list, monday, needed, newId) => addFromSource(list, { source: `week:${monday}`, from: `Week of ${monday}`, group: 'food' }, needed, newId);

export function addShoppingItem(list, text, id = `it${Date.now().toString(36)}`, group = 'other') {
  const p = parseIngredient(text);
  if (!p.name) return list;
  return { ...list, items: [...list.items, { id, ...p, note: '', checked: false, source: '', from: '', group: GROUPS[group] ? group : 'other' }] };
}

export const toggleItem = (list, id) => ({ ...list, items: list.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)) });
export const clearBought = (list) => ({ ...list, items: list.items.filter((i) => !i.checked) });
export const removeItem = (list, id) => ({ ...list, items: list.items.filter((i) => i.id !== id) });

/** Items by group, in the order the groups are listed; empty groups left out. */
export const byGroup = (list) => Object.keys(GROUPS).map((g) => [g, list.items.filter((i) => i.group === g)]).filter(([, items]) => items.length);

/** What another app sends in the link (`#/shopping/add/<json>`). Anything odd is dropped. */
export function readSend(param) {
  let raw;
  try { raw = JSON.parse(param); } catch { return null; }
  if (!raw || !str(raw.source) || !Array.isArray(raw.items)) return null;
  return {
    source: str(raw.source, 80), from: str(raw.from, 80), group: GROUPS[raw.group] ? raw.group : 'food',
    items: raw.items.slice(0, 120).filter((i) => i && str(i.name)).map((i) => ({ name: str(i.name, 120), qty: num(i.qty), unit: unitKey(str(i.unit, 20)), note: str(i.note, 120) })),
  };
}

/** The link another app uses to send items here. */
export const sendHref = (send) => `#/shopping/add/${encodeURIComponent(JSON.stringify(send))}`;
