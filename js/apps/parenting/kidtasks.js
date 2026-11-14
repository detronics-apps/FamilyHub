// Routines screens (D-105): pick a routine, choose who is in it, and the screen splits - one
// column per child, big cards they tick themselves. And the form to change a routine's tasks,
// who does each, and its picture.

import { el, icon as domIcon, ICON_PATHS } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { saveRecord } from '../kit.js';
import { ageLabel } from './logic.js';
import { ICONS, normaliseRoutine, normaliseTask, routinesOf, tasksFor, start, tick, progress } from './routines.js';

export const routinesCol = (hub) => hub.data.collection('routines', { summary: (r) => normaliseRoutine(r), prefix: 'rt' });
export const loadRoutines = async (hub) => routinesOf((await routinesCol(hub).list({ limit: 1000 })).items);
const save = (hub, r) => saveRecord(hub, routinesCol(hub), normaliseRoutine({ ...r, id: `rt_${r.routineId}` }));

// Pictures for children who cannot read yet: fixed line icons from dom.js (D-129).
const icon = (name, size = 40) => el('span', { 'aria-hidden': 'true', style: { display: 'inline-flex' } }, [domIcon(ICON_PATHS[name] ? name : 'star', { size, strokeWidth: 1.6 })]);

export function routinesHome(hub, list, kids) {
  return el('section', { class: 'stack', 'aria-label': 'Routines' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Parenting' }),
    el('h1', { text: 'Routines', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Little responsibilities for a moment - leaving the house, bedtime, the morning. Start one and each child ticks off their own list on their half of the screen.' }),
    !kids.length ? el('p', { class: 'small muted', text: 'Add the children on the People page first.' }) : null,
    el('div', { class: 'tiles' }, list.map((r) => el('div', { class: 'tile', style: { cursor: 'default' } }, [
      el('span', { class: 'tile__name', text: r.name }),
      el('span', { class: 'tile__purpose', text: r.tasks.map((x) => x.name).join(' · ') }),
      el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
        el('a', { class: 'btn btn-primary', href: hub.href('routine', r.routineId), text: 'Start', 'data-field': `rt-start:${r.routineId}` }),
        el('a', { class: 'btn btn-small btn-quiet', href: hub.href('routine-edit', r.routineId), text: 'Change' }),
      ]),
    ]))),
    el('div', {}, [el('a', { class: 'btn', href: hub.href('routine-new'), text: 'Add', title: 'A routine of our own' })]),
  ]);
}

export function routineRun(hub, list, id, kids) {
  let r = list.find((x) => x.routineId === id);
  if (!r) return el('div', { class: 'panel empty' }, [el('p', { text: 'This routine was removed.' }), el('a', { class: 'btn', href: hub.href('routines'), text: 'Routines' })]);
  // Opening it from Routines starts fresh; ticking (which redraws) keeps going.
  if (!runs.has(r.routineId)) { r = start(r, r.who ?? kids.map((k) => k.id), new Date().toISOString()); runs.set(r.routineId, r.run.startedAt); save(hub, r); }
  const who = kids.filter((k) => (r.who ?? kids.map((x) => x.id)).includes(k.id));
  const put = (next) => { r = next; save(hub, next); };
  const column = (k) => {
    const mine = tasksFor(r, k); const p = progress(r, k); const ticked = new Set(r.run?.done?.[k.id] ?? []);
    return el('div', { class: 'panel stack', 'data-field': `rt-kid:${k.id}`, style: { margin: 0, gap: '8px', borderWidth: p.ready ? '3px' : '1px', borderColor: p.ready ? 'var(--ok)' : null } }, [
      el('div', { style: { textAlign: 'center' } }, [el('strong', { text: k.name, style: { fontSize: '1.3em' } }), el('div', { class: 'small muted', text: p.ready ? '' : `${p.done} of ${p.total}` })]),
      p.ready ? el('div', { style: { textAlign: 'center', fontSize: '1.8em', fontWeight: 800, color: 'var(--ok)' }, 'data-field': `rt-ready:${k.id}`, text: 'Ready!' }) : null,
      ...mine.map((x) => el('button', { type: 'button', class: 'panel', 'data-field': `rt-task:${k.id}:${x.id}`, 'aria-pressed': String(ticked.has(x.id)),
        style: { margin: 0, display: 'flex', alignItems: 'center', gap: '10px', minHeight: '64px', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '1.1em', fontWeight: 600,
          background: ticked.has(x.id) ? 'var(--accent-soft)' : null, textDecoration: ticked.has(x.id) ? 'line-through' : 'none' },
        on: { click: () => { put(tick(r, k.id, x.id)); hub.render(); } } }, [icon(x.icon), el('span', { style: { flex: '1' }, text: x.name }), el('span', { 'aria-hidden': 'true', style: { fontSize: '1.4em' }, text: ticked.has(x.id) ? '✓' : '' })])),
      !mine.length ? el('p', { class: 'small muted', text: 'Nothing on this list for them.' }) : null,
    ]);
  };
  return el('section', { class: 'stack', 'aria-label': r.name }, [
    el('a', { href: hub.href('routines'), class: 'small', text: '‹ Routines' }),
    el('h1', { text: r.name, style: { margin: 0 } }),
    kids.length > 1 ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'Who' }, kids.map((k) => el('button', { class: 'chip', type: 'button', text: k.name, 'aria-pressed': String(who.some((w) => w.id === k.id)), 'data-field': `rt-who:${k.id}`,
      on: { click: () => { const ids = new Set(who.map((w) => w.id)); if (ids.has(k.id)) ids.delete(k.id); else ids.add(k.id); put({ ...r, who: [...ids] }); hub.render(); } } }))) : null,
    el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, who.length)}, minmax(0, 1fr))`, gap: '10px' }, 'data-field': 'rt-split' }, who.map(column)),
    el('div', {}, [el('button', { class: 'btn btn-quiet', type: 'button', text: 'Start again', on: { click: () => { runs.delete(r.routineId); put(start(r, who.map((w) => w.id), new Date().toISOString())); runs.set(r.routineId, r.run.startedAt); hub.render(); } } })]),
  ]);
}
// The run started on this device, per routine - leaving the routine and opening it again starts fresh.
const runs = new Map();
globalThis.addEventListener?.('hashchange', () => { if (!/#\/parenting\/routine\//.test(globalThis.location?.hash ?? '')) runs.clear(); });

export function routineEdit(hub, list, id, kids) {
  const r = id ? list.find((x) => x.routineId === id) : null;
  const rows = (r?.tasks ?? []).map((x) => ({ ...x, kids: x.kids ? [...x.kids] : null }));
  if (!rows.length) rows.push(normaliseTask({ name: '' }, 0));
  const name = el('input', { class: 'input', value: r?.name ?? '', placeholder: 'e.g. Going to school', 'aria-label': 'Routine', 'data-field': 'rt-name' });
  const box = el('div', { class: 'stack' });
  const draw = () => box.replaceChildren(...rows.map((x, i) => el('div', { class: 'panel stack', style: { gap: '6px' }, 'data-field': `rt-row:${i}` }, [
    el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
      icon(x.icon, 28),
      el('input', { class: 'input', value: x.name, placeholder: 'e.g. Shoes on', 'aria-label': 'Task', style: { flex: '2 1 160px' }, on: { input: (e) => { x.name = e.target.value; } } }),
      el('select', { class: 'select', 'aria-label': 'Picture', style: { maxWidth: '130px' }, on: { change: (e) => { x.icon = e.target.value; draw(); } } }, ICONS.map((n) => el('option', { value: n, text: n, selected: x.icon === n }))),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => { rows.splice(i, 1); draw(); } } }),
    ]),
    kids.length ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'Who does it' }, [
      el('button', { class: 'chip', type: 'button', text: x.ageFrom != null ? `By age (from ${ageLabel(x.ageFrom)})` : 'Everyone', 'aria-pressed': String(!x.kids), on: { click: () => { x.kids = null; draw(); } } }),
      ...kids.map((k) => el('button', { class: 'chip', type: 'button', text: k.name, 'aria-pressed': String(!!x.kids?.includes(k.id)), on: { click: () => { x.kids = x.kids ?? []; x.kids = x.kids.includes(k.id) ? x.kids.filter((y) => y !== k.id) : [...x.kids, k.id]; draw(); } } })),
    ]) : null,
  ])));
  draw();
  return el('section', { class: 'stack' }, [
    el('h1', { text: r ? `Change ${r.name}` : 'A routine of our own' }),
    el('label', { class: 'stack', style: { gap: '4px' } }, [el('strong', { text: 'Routine' }), name]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Each task: what to do, a picture, and who does it - by age, or chosen children.' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: () => { rows.push(normaliseTask({ id: `t-${Date.now().toString(36)}`, name: '' }, rows.length)); draw(); } } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'rt-save', on: { click: async () => {
        const routineId = r?.routineId ?? `rtn-${Date.now().toString(36)}`;
        const tasks = rows.filter((x) => x.name.trim()).map((x, i) => normaliseTask({ ...x, id: x.id || `t${i}` }, i));
        if (await save(hub, { ...(r ?? { own: true }), routineId, name: name.value.trim() || r?.name || 'Our routine', tasks, run: null })) { hub.ui.notice('Saved.'); hub.go('routines'); }
      } } }),
      r ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${r.name}"?`, text: 'It goes from Routines.', confirmLabel: 'Remove', danger: true })) return;
        await save(hub, { ...r, removed: true }); hub.go('routines');
      } } }) : null,
    ]),
  ]);
}
