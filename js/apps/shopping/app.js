// Shopping (its own section): the family's one list. Meals & Recipes, This
// Week and Chores send items here through a link (`add/<json>`), shown for a
// yes before anything is added; anyone can also just type things in. A list
// kept by Meals & Recipes before Shopping was its own mini-app is picked up.

import { el } from '../../ui/dom.js';
import { loading, failure, saveRecord } from '../kit.js';
import { formatIngredient } from '../meals/logic.js';
import { inSystem } from '../../units.js';
import { GROUPS, LIST_ID, normaliseShopping, addFromSource, addShoppingItem, toggleItem, clearBought, removeItem, byGroup, readSend, listText } from './logic.js';

const ui = { group: 'other' };
const shopping = (hub) => hub.data.collection('list', { summary: (l) => ({ title: 'Shopping list', count: l.items.filter((i) => !i.checked).length }) });

const loadList = (hub) => hub.use('list', async () => {
  const own = await shopping(hub).get(LIST_ID);
  const old = own || !hub.data.installed('meals') ? null : await hub.data.of('meals', 'shopping').get(LIST_ID).catch(() => null);
  return normaliseShopping(own ?? old ?? { id: LIST_ID });
});

export function render(hub, route) {
  const l = loadList(hub);
  if (l.loading) return loading();
  if (l.error) return failure(l.error);
  const save = async (next) => { await saveRecord(hub, shopping(hub), { ...next, id: LIST_ID }); };
  if (route.sub === 'add') return addScreen(hub, l.data, save, route.rest[0] ?? '');
  return listScreen(hub, l.data, save);
}

function listScreen(hub, list, save) {
  const input = el('input', { class: 'input', id: 'shop-add', placeholder: 'Add something, e.g. "2 l milk" or "light bulbs"', 'data-field': 'shop-add', style: { flex: '1 1 220px' } });
  const group = el('select', { class: 'select', 'aria-label': 'Kind', 'data-field': 'shop-group', style: { width: 'auto' }, on: { change: (e) => { ui.group = e.target.value; } } },
    Object.entries(GROUPS).map(([k, label]) => el('option', { value: k, text: label, selected: k === ui.group })));
  const add = (e) => { e.preventDefault(); if (input.value.trim()) save(addShoppingItem(list, input.value, undefined, group.value)); };
  const bought = list.items.filter((i) => i.checked);
  const item = (i) => el('li', {}, [
    el('label', { class: 'checkline list__main' }, [
      el('input', { type: 'checkbox', checked: i.checked, 'data-field': `shop:${i.id}`, on: { change: () => save(toggleItem(list, i.id)) } }),
      el('span', {}, [
        el('span', { text: formatIngredient(inSystem(i, hub.units())), style: i.checked ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : null }),
        i.note ? el('span', { class: 'small muted', text: ` (${i.note})` }) : null,
        i.from ? el('span', { class: 'small muted', text: ` · ${i.from}` }) : null,
      ]),
    ]),
    el('button', { class: 'btn btn-quiet btn-small', type: 'button', text: '×', 'aria-label': `Remove ${i.name}`, on: { click: () => save(removeItem(list, i.id)) } }),
  ]);

  return el('section', { class: 'stack', 'aria-label': 'Shopping list' }, [
    el('form', { class: 'row no-print', on: { submit: add } }, [
      el('label', { class: 'sr-only', for: 'shop-add', text: 'Add to the list' }), input, group,
      el('button', { class: 'btn', type: 'submit', text: 'Add' }),
    ]),
    ...byGroup({ items: list.items.filter((i) => !i.checked) }).map(([g, items]) => el('div', { class: 'panel' }, [
      el('h2', { text: `${GROUPS[g]} (${items.length})` }),
      el('ul', { class: 'list' }, items.map(item)),
    ])),
    list.items.some((i) => !i.checked) ? el('div', { class: 'row no-print' }, [
      el('button', {
        class: 'btn btn-small', type: 'button', text: 'Copy the list', 'data-field': 'shop-copy',
        on: { click: async () => { try { await navigator.clipboard.writeText(listText(list, (i) => formatIngredient(inSystem(i, hub.units())))); hub.ui.notice('Copied - paste it into a message or notes.'); } catch { hub.ui.notice('This browser would not allow copying. Use Print instead.', 'warn'); } } },
      }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Print', 'data-field': 'shop-print', on: { click: () => window.print() } }),
    ]) : el('p', { class: 'panel', text: 'Nothing to buy. Send a meal or the week’s plan from the Meals section, supplies from Chores - or type things in above.' }),
    bought.length ? el('div', { class: 'panel' }, [
      el('h2', { text: `Bought (${bought.length})` }),
      el('ul', { class: 'list' }, bought.map(item)),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Clear bought items', on: { click: () => save(clearBought(list)) } }),
    ]) : null,
    el('p', { class: 'small muted', text: 'Amounts in grams and kilos (or millilitres and litres) are added together. Different kinds of measure - cups and grams, say - are listed separately rather than guessed. Sending the same meal or week again updates its items instead of doubling them.' }),
  ]);
}

/** Items sent by another mini-app: shown, ticked, and only added on Add. */
function addScreen(hub, list, save, param) {
  const send = readSend(param);
  if (!send) return el('div', { class: 'panel' }, [el('p', { text: 'Nothing to add - the link was incomplete.' }), el('a', { class: 'btn', href: hub.href(), text: 'Open the list' })]);
  const already = list.items.some((i) => i.source === send.source);
  const boxes = send.items.map((i, n) => el('label', { class: 'checkline' }, [
    el('input', { type: 'checkbox', checked: true, 'data-index': String(n) }), formatIngredient(inSystem(i, hub.units())), i.note ? el('span', { class: 'small muted', text: ` (${i.note})` }) : null,
  ]));
  return el('section', { class: 'stack' }, [
    el('h1', { text: `Add to the shopping list${send.from ? `: ${send.from}` : ''}` }),
    already ? el('p', { class: 'small', text: 'These are already on the list from before - adding replaces them with the amounts below. Anything already bought stays bought.' }) : null,
    send.items.length ? el('div', { class: 'panel stack' }, [
      el('p', { class: 'small muted', text: 'Untick anything you already have.' }),
      ...boxes,
    ]) : el('p', { class: 'panel', text: 'There is nothing to buy for this.' }),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Add to the list', 'data-field': 'shop-confirm', disabled: !send.items.length,
        on: {
          click: async () => {
            const chosen = boxes.map((b) => b.querySelector('input')).filter((b) => b.checked).map((b) => send.items[Number(b.dataset.index)]);
            await save(addFromSource(list, send, chosen));
            hub.invalidate('list');
            hub.ui.notice(`${chosen.length} item${chosen.length === 1 ? '' : 's'} on the list.`);
            hub.go();
          },
        },
      }),
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => history.back() } }),
    ]),
  ]);
}
