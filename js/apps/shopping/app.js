// Shopping (its own section): the family's one list. the Cookbook, This
// Week and Chores send items here through a link (`add/<json>`), shown for a
// yes before anything is added; anyone can also just type things in. A list
// kept by the Cookbook before Shopping was its own mini-app is picked up.

import { el } from '../../ui/dom.js';
import { loading, failure, saveRecord } from '../kit.js';
import { formatIngredient, combineIngredients, parseIngredient } from '../meals/logic.js';
import { inSystem } from '../../units.js';
import {
  GROUPS, KINDS, LIST_ID, normaliseShopping, addFromSource, addShoppingItem, toggleItem, clearBought, removeItem, byGroup, readSend, listText,
  findItems, kindOf, categorise,
} from './logic.js';

// find: what the finder shows - words, a kind, and only our own items or everything there is.
const ui = { find: { query: '', kind: '', ours: true } };
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
  if (route.sub === 'shop') return shopScreen(hub, l.data, save);
  return listScreen(hub, l.data, save);
}

/**
 * Find something to put on the list: by words or by kind ("what hygiene things
 * do we buy?"), from our own items (bought before or added by us) or from
 * everything there is - or add it as a new item. Typing redraws only the results.
 */
function finder(hub, list, save) {
  const st = ui.find;
  const results = el('div', { class: 'stack', 'data-field': 'shop-results' });
  const add = (name, group) => save(addShoppingItem(list, name, undefined, group));
  const draw = () => {
    const words = parseIngredient(st.query).name || st.query.trim();
    if (!words && !st.kind && !st.ours) { results.replaceChildren(el('p', { class: 'small muted', text: 'Choose a kind - Cleaning, Hygiene... - or type, to see what there is.' })); return; }
    const found = findItems(list, { query: words, kind: st.kind || null, ours: st.ours });
    const exact = found.some((f) => f.name.toLowerCase() === words.toLowerCase());
    const fresh = st.query.trim() && !exact ? newItem(st.query.trim()) : null;
    results.replaceChildren(
      found.length ? el('ul', { class: 'list' }, found.slice(0, 40).map((f) => el('li', {}, [
        el('span', { class: 'list__main' }, [
          el('strong', { text: f.name }),
          el('span', { class: 'small muted', text: ` · ${KINDS[kindOf(f.group)]}${f.times ? ` · bought ${f.times} time${f.times === 1 ? '' : 's'}${f.last ? `, last ${f.last}` : ''}` : f.ours ? ' · added by us' : ''}` }),
        ]),
        f.onList ? el('span', { class: 'badge badge--ok', text: 'On the list' })
          : el('button', { class: 'btn btn-small', type: 'button', text: '+ Add', 'data-field': `find-add:${f.name}`, on: { click: () => add(f.name, f.group) } }),
      ]))) : el('p', { class: 'small muted', text: st.ours ? 'Nothing of ours matches yet - choose "Everything" to see more, or add it as a new item.' : 'Nothing matches.' }),
      found.length > 40 ? el('p', { class: 'small muted', text: `${found.length - 40} more - type a word to narrow it down.` }) : null,
      fresh,
    );
  };
  // A new item, in the kind being looked at (food goes to its aisle).
  const newItem = (text) => {
    const name = parseIngredient(text).name || text;
    const guess = st.kind && st.kind !== 'food' ? st.kind : categorise(name) !== 'food' || st.kind === 'food' ? categorise(name) : 'other';
    const group = el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Where it goes', 'data-field': 'new-group' },
      Object.entries(GROUPS).map(([k, t]) => el('option', { value: k, text: t, selected: k === guess })));
    return el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-small btn-primary', type: 'button', text: `+ Add "${text}" as a new item`, 'data-field': 'find-new', on: { click: () => add(text, group.value) } }),
      el('span', { class: 'small', text: 'in' }), group,
    ]);
  };
  const input = el('input', {
    class: 'input', type: 'search', value: st.query, placeholder: 'Find or add, e.g. "milk", "2 l milk" or "light bulbs"', 'aria-label': 'Find or add something', 'data-field': 'shop-add', style: { flex: '1 1 220px' },
    on: {
      input: (e) => { st.query = e.target.value; draw(); },
      keydown: (e) => { if (e.key === 'Enter' && st.query.trim()) { e.preventDefault(); results.querySelector('[data-field="find-new"], [data-field^="find-add:"]')?.click(); } },
    },
  });
  const chip = (pressed, text, field, click) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(pressed), text, 'data-field': field, on: { click } });
  draw();
  return el('div', { class: 'panel stack no-print', 'aria-label': 'Find or add' }, [
    el('div', { class: 'row' }, [input]),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Kind' }, [
      chip(!st.kind, 'All', 'find-kind:all', () => { st.kind = ''; hub.render(); }),
      ...Object.entries(KINDS).map(([k, t]) => chip(st.kind === k, t, `find-kind:${k}`, () => { st.kind = k; hub.render(); })),
    ]),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Look in' }, [
      chip(st.ours, `Ours - bought before or added by us (${list.known.length})`, 'find-ours', () => { st.ours = true; hub.render(); }),
      chip(!st.ours, 'Everything', 'find-all', () => { st.ours = false; hub.render(); }),
    ]),
    results,
  ]);
}

function listScreen(hub, list, save) {
  const bought = list.items.filter((i) => i.checked);
  const item = (i) => el('li', {}, [
    el('label', { class: 'checkline list__main' }, [
      el('input', { type: 'checkbox', checked: i.checked, 'data-field': `shop:${i.id}`, on: { change: () => save(toggleItem(list, i.id, hub.today())) } }),
      el('span', {}, [
        el('span', { text: formatIngredient(inSystem(i, hub.units())), style: i.checked ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : null }),
        i.note ? el('span', { class: 'small muted', text: ` (${i.note})` }) : null,
        i.from ? el('span', { class: 'small muted', text: ` · ${i.from}` }) : null,
      ]),
    ]),
    el('button', { class: 'btn btn-quiet btn-small', type: 'button', text: '×', 'aria-label': `Remove ${i.name}`, on: { click: () => save(removeItem(list, i.id)) } }),
  ]);

  return el('section', { class: 'stack', 'aria-label': 'Shopping list' }, [
    list.items.some((i) => !i.checked) ? el('a', { class: 'btn btn-primary no-print', href: hub.href('shop'), text: 'At the shop - tick things off', 'data-field': 'go-shop', style: { alignSelf: 'flex-start' } }) : null,
    finder(hub, list, save),
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

/**
 * At the shop: only the list, big, by aisle - tick each thing as it goes in the
 * trolley. Nothing to add or change here; that is for the list screen.
 */
function shopScreen(hub, list, save) {
  const left = list.items.filter((i) => !i.checked);
  const got = list.items.filter((i) => i.checked);
  const tick = (i) => el('label', { class: 'checkline shop-tick', 'data-field': `tick:${i.id}` }, [
    el('input', { type: 'checkbox', checked: i.checked, on: { change: () => save(toggleItem(list, i.id, hub.today())) } }),
    el('span', { text: formatIngredient(inSystem(i, hub.units())), style: i.checked ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : null }),
    i.note ? el('span', { class: 'small muted', text: ` (${i.note})` }) : null,
  ]);
  return el('section', { class: 'stack shop-mode', 'aria-label': 'At the shop' }, [
    el('h1', { text: left.length ? `At the shop - ${left.length} to get` : 'Everything is in the trolley' }),
    ...byGroup({ items: left }).map(([g, items]) => el('div', { class: 'panel stack' }, [el('h2', { text: GROUPS[g], style: { margin: 0 } }), ...items.map(tick)])),
    got.length ? el('details', { class: 'panel' }, [el('summary', { text: `In the trolley (${got.length})` }), el('div', { class: 'stack' }, got.map(tick))]) : null,
    el('div', { class: 'row' }, [
      got.length ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Done - clear what we bought', 'data-field': 'shop-done', on: { click: async () => { await save(clearBought(list)); hub.go(); } } }) : null,
      el('a', { class: 'btn', href: hub.href(), text: 'Back to the list' }),
    ]),
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
  // Home-made items (mayo): bought as their ingredients, unless some is already made.
  const fmt = (i) => formatIngredient(inSystem(i, hub.units()));
  const made = send.own.map((g, n) => el('div', { class: 'stack', style: { gap: '0.25rem' } }, [
    el('label', { class: 'checkline' }, [
      el('input', { type: 'checkbox', 'data-own': String(n), 'data-field': `own-have:${g.id}` }),
      el('span', {}, [el('strong', { text: `We already have the ${g.name}` }), g.qty != null ? ` (${fmt({ ...g, name: '' }).trim()} needed)` : '']),
    ]),
    el('p', { class: 'small muted', style: { margin: '0 0 0 1.8rem' }, text: `Otherwise the list gets: ${g.items.map(fmt).join(', ')}.` }),
  ]));
  const anything = send.items.length || send.own.length;
  return el('section', { class: 'stack' }, [
    el('h1', { text: `Add to the shopping list${send.from ? `: ${send.from}` : ''}` }),
    already ? el('p', { class: 'small', text: 'These are already on the list from before - adding replaces them with the amounts below. Anything already bought stays bought.' }) : null,
    send.items.length ? el('div', { class: 'panel stack' }, [
      el('p', { class: 'small muted', text: 'Untick anything you already have.' }),
      ...boxes,
    ]) : null,
    send.own.length ? el('div', { class: 'panel stack' }, [el('h2', { text: 'Made at home', style: { margin: 0 } }), ...made]) : null,
    anything ? null : el('p', { class: 'panel', text: 'There is nothing to buy for this.' }),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Add to the list', 'data-field': 'shop-confirm', disabled: !anything,
        on: {
          click: async () => {
            const picked = boxes.map((b) => b.querySelector('input')).filter((b) => b.checked).map((b) => send.items[Number(b.dataset.index)]);
            const toMake = made.map((m) => m.querySelector('input')).filter((b) => !b.checked).flatMap((b) => send.own[Number(b.dataset.own)].items);
            const chosen = combineIngredients([...picked, ...toMake]);
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
