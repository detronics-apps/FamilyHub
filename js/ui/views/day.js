// Our day (D-149): each person's average day from midnight to midnight, side by side - through
// the day, or added up by category - with the day we want to get to, and the share of the
// chores each person takes. People › Our day.

import { el } from '../dom.js';
import { avatar } from '../common.js';
import { shows } from '../levels.js';
import { updatePerson } from '../../model.js';
import { weeklyLoad } from '../../progress.js';
import { kindsOf, normaliseDay, normaliseKinds, timeline, totals, choreShare, nextBlock, fmtSpan, KIND_COLOURS, DAY_MINUTES } from '../../day.js';

// What this screen shows, kept while it redraws (a save redraws the page).
const view = { version: 'now', mode: 'day', only: null, open: new Set() };
const pct = (m) => `${(m / DAY_MINUTES) * 100}%`;
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function dayView(ctx) {
  const h = ctx.app.household;
  const kinds = kindsOf(h);
  const kind = (id) => kinds.find((k) => k.id === id);
  if (!shows('advanced')) view.version = 'now';
  const blocksOf = (p) => normaliseDay(p.day)[view.version];
  const saveDay = (p, patch) => ctx.commit(updatePerson(ctx.app.household, p.id, { day: { ...normaliseDay(p.day), ...patch } }));
  const saveKinds = (list) => ctx.commit({ ...ctx.app.household, household: { ...ctx.app.household.household, dayKinds: normaliseKinds(list) } });
  const choreDay = weeklyLoad(h).day;

  const chip = (label, on, click, field) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), text: label, 'data-field': field, on: { click } });
  const seg = (start, end, k, faded) => el('div', {
    title: `${k ? k.name : 'Not planned'} ${hhmm(start)}-${hhmm(end)}`,
    style: { width: pct(end - start), background: k ? k.colour : 'transparent', opacity: faded ? '0.15' : '1' },
  });
  const bar = (children) => el('div', { style: { flex: '1 1 auto', display: 'flex', height: '28px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', minWidth: 0 } }, children);

  const row = (p) => {
    const blocks = blocksOf(p);
    const t = totals(blocks, kinds);
    const only = view.only ? t.byKind.find((k) => k.id === view.only)?.minutes ?? 0 : null;
    const nowT = view.version === 'goal' ? totals(normaliseDay(p.day).now, kinds) : null;
    const parts = view.mode === 'day'
      ? timeline(blocks).map((r) => seg(r.start, r.end, kind(r.kind), view.only && r.kind !== view.only))
      : t.byKind.filter((k) => !view.only || k.id === view.only).map((k) => seg(0, k.minutes, k, false));
    const words = !blocks.length ? 'Nothing planned yet - Edit day below.'
      : view.only ? `${kind(view.only)?.name}: ${fmtSpan(only)}${nowT ? ` (now ${fmtSpan(nowT.byKind.find((k) => k.id === view.only)?.minutes ?? 0)})` : ''}`
        : view.mode === 'totals' ? t.byKind.map((k) => `${k.name} ${fmtSpan(k.minutes)}${nowT ? ` (now ${fmtSpan(nowT.byKind.find((x) => x.id === k.id)?.minutes ?? 0)})` : ''}`).join(' · ')
          : t.unplanned ? '' : `Awake ${fmtSpan(t.awake)}`;
    return el('div', { class: 'stack', style: { gap: '2px' }, 'data-field': `day-row:${p.id}` }, [
      el('div', { class: 'row', style: { gap: '8px', flexWrap: 'nowrap', alignItems: 'center' } }, [
        el('span', { class: 'small', style: { width: '80px', flex: '0 0 80px', overflow: 'hidden', textOverflow: 'ellipsis' }, text: p.name }), bar(parts)]),
      el('div', { class: 'small muted', style: { marginLeft: '88px' }, 'data-field': `day-words:${p.id}`, text: [words,
        t.unplanned && blocks.length && !view.only ? `Not planned ${fmtSpan(t.unplanned)}` : null,
        t.overlap ? `Two blocks overlap at ${t.overlap} - the later one counts` : null].filter(Boolean).join(' · ') }),
    ]);
  };

  const axis = el('div', { class: 'small muted', style: { marginLeft: '88px', display: 'flex', justifyContent: 'space-between' } },
    view.mode === 'day' ? ['00', '03', '06', '09', '12', '15', '18', '21', '24'].map((x) => el('span', { text: x })) : ['0 h', '6 h', '12 h', '18 h', '24 h'].map((x) => el('span', { text: x })));

  return el('section', { class: 'stack', 'aria-labelledby': 'day-title' }, [
    el('div', { class: 'row' }, [el('h1', { id: 'day-title', text: 'Our day', style: { margin: 0 } }), el('a', { class: 'btn btn-quiet', href: '#/people', text: 'People' })]),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'An average day for each person, from midnight to midnight, so you can see each other’s side. Everyone has the same 24 hours - only where they fall is different.' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'row', style: { gap: '6px' } }, [
        chip('Day', view.mode === 'day', () => { view.mode = 'day'; ctx.render(); }, 'day-mode:day'),
        chip('Totals', view.mode === 'totals', () => { view.mode = 'totals'; ctx.render(); }, 'day-mode:totals'),
        shows('advanced') ? el('span', { style: { width: '12px' } }) : null,
        shows('advanced') ? chip('Now', view.version === 'now', () => { view.version = 'now'; ctx.render(); }, 'day-version:now') : null,
        shows('advanced') ? chip('Goal', view.version === 'goal', () => { view.version = 'goal'; ctx.render(); }, 'day-version:goal') : null,
      ]),
      view.version === 'goal' ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'The day you want to get to. In brackets: what it is now.' }) : null,
      ...h.people.map(row),
      h.people.length ? axis : el('p', { text: 'Add the family in People first.' }),
      el('div', { class: 'stack', style: { gap: '4px' } }, [
        el('span', { class: 'small muted', text: view.only ? 'Showing one category - tap it again for all of them.' : 'Tap a category to see only that, for everyone:' }),
        el('div', { class: 'chipset' }, kinds.map((k) => el('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(view.only === k.id), 'data-field': `day-only:${k.id}`,
          on: { click: () => { view.only = view.only === k.id ? null : k.id; ctx.render(); } },
        }, [el('span', { 'aria-hidden': 'true', style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: k.colour, marginRight: '6px' } }), k.name]))),
      ]),
    ]),
    shows('advanced') ? choresPanel(ctx, h, choreDay, saveDay) : null,
    ...h.people.map((p) => editor(ctx, p, h, kinds, saveDay)),
    kindsPanel(kinds, saveKinds),
    shows('expert') ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
      el('p', { class: 'small', style: { margin: 0 }, text: 'The day is a circle laid flat: a block whose end is before its start crosses midnight, so 18:30 to 01:00 is drawn from 18:30 to 24:00 and from 00:00 to 01:00. A total is the minutes a category covers - every block of it added together, wherever it falls. Awake = 24 h - Sleep. Where two blocks overlap, the later one in the list counts, and the app says where.' }),
      el('p', { class: 'small', style: { margin: 0 }, text: 'Chores share = the family’s chores a day × the person’s percent. The family’s chores a day = each chore’s minutes × how often it comes round in a week ÷ 7, from Chores.' }),
    ]) : null,
  ]);
}

/** Each person's share of the family's chores, and how much of it is in their day. */
function choresPanel(ctx, h, choreDay, saveDay) {
  const total = h.people.reduce((s, p) => s + (normaliseDay(p.day).choreShare ?? 0), 0);
  return el('div', { class: 'panel stack', 'data-field': 'day-chores' }, [
    el('h2', { text: 'Chores', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: choreDay
      ? `The family’s chores take about ${fmtSpan(Math.round(choreDay))} a day, from Chores. Give each person a share; put it in their day as Chores blocks.`
      : 'Give chores a time in Chores to see how long they take a day. Until then, the shares have nothing to share out.' }),
    ...h.people.map((p) => {
      const c = choreShare(p.day, choreDay, normaliseDay(p.day)[view.version]);
      return el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
        el('span', { class: 'small', style: { width: '80px' }, text: p.name }),
        el('input', { class: 'input', type: 'number', min: '0', max: '100', step: '5', inputmode: 'numeric', value: normaliseDay(p.day).choreShare ?? '', placeholder: '%', 'aria-label': `${p.name}’s share of the chores, percent`, 'data-field': `day-share:${p.id}`, style: { maxWidth: '80px' },
          on: { change: (e) => saveDay(p, { choreShare: e.target.value === '' ? null : Number(e.target.value) }) } }),
        el('span', { class: 'small muted', text: c ? `${fmtSpan(c.share)} a day · in their day ${fmtSpan(c.placed)}${c.toPlace ? ` · ${fmtSpan(c.toPlace)} still to place` : ''}` : '%' }),
      ]);
    }),
    total && total !== 100 ? el('p', { class: 'small muted', style: { margin: 0 }, text: `The shares add up to ${total}%.` }) : null,
  ]);
}

/** One person's blocks: from, to and what - change, add, remove, or copy a day to start from. */
function editor(ctx, p, h, kinds, saveDay) {
  const key = view.version;
  const blocks = normaliseDay(p.day)[key];
  const put = (list) => saveDay(p, { [key]: list });
  const kindSel = (b, i) => el('select', { class: 'select', 'aria-label': 'What', style: { maxWidth: '170px' }, on: { change: (e) => put(blocks.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x))) } },
    [...(kinds.some((k) => k.id === b.kind) ? [] : [el('option', { value: b.kind, text: 'Removed category', selected: true })]),
      ...kinds.map((k) => el('option', { value: k.id, text: k.name, selected: k.id === b.kind }))]);
  const time = (b, i, f, label) => el('input', { class: 'input', type: 'time', step: '60', value: b[f], 'aria-label': label, style: { width: 'auto' },
    on: { change: (e) => { if (e.target.value) put(blocks.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x))); } } });
  const others = h.people.flatMap((o) => ['now', 'goal'].filter((v) => v === 'now' || shows('advanced')).map((v) => ({ o, v })))
    .filter(({ o, v }) => !(o.id === p.id && v === key) && normaliseDay(o.day)[v].length);
  const from = others.length ? el('select', { class: 'select', 'aria-label': 'Copy from', style: { maxWidth: '200px' } },
    others.map(({ o, v }, i) => el('option', { value: String(i), text: `${o.name}${shows('advanced') ? (v === 'now' ? ' - now' : ' - goal') : ''}` }))) : null;
  return el('details', { class: 'panel', open: view.open.has(p.id), 'data-field': `day-edit:${p.id}`,
    on: { toggle: (e) => { if (e.target.open) view.open.add(p.id); else view.open.delete(p.id); } } }, [
    el('summary', {}, [avatar(p), ' ', el('strong', { text: `Edit day: ${p.name}` }), el('span', { class: 'small muted', text: ` - ${key === 'goal' ? 'goal' : 'now'}, ${blocks.length} block${blocks.length === 1 ? '' : 's'}` })]),
    el('div', { class: 'stack', style: { gap: '6px', marginTop: '8px' } }, [
      ...blocks.map((b, i) => el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' }, 'data-field': `day-block:${p.id}:${i}` }, [
        time(b, i, 'from', 'From'), el('span', { class: 'small', text: 'to' }), time(b, i, 'to', 'To'), kindSel(b, i),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove block', on: { click: () => put(blocks.filter((_, j) => j !== i)) } }),
      ])),
      el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn btn-small', type: 'button', text: 'Add block', 'data-field': `day-add:${p.id}`, on: { click: () => put([...blocks, nextBlock(blocks, kinds)]) } }),
        from ? from : null,
        from ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Copy day', title: 'Replace this day with a copy of the one chosen', 'data-field': `day-copy:${p.id}`,
          on: { click: () => { const { o, v } = others[Number(from.value)]; put(normaliseDay(o.day)[v]); } } }) : null,
      ]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'A block that ends before it starts runs past midnight - 22:00 to 01:00 is fine.' }),
    ]),
  ]);
}

/** The family's categories: rename, recolour, remove, add. */
function kindsPanel(kinds, saveKinds) {
  return el('details', { class: 'panel', open: view.open.has('kinds'), 'data-field': 'day-kinds',
    on: { toggle: (e) => { if (e.target.open) view.open.add('kinds'); else view.open.delete('kinds'); } } }, [
    el('summary', {}, [el('strong', { text: 'Categories' }), el('span', { class: 'small muted', text: ' - shared by everyone' })]),
    el('div', { class: 'stack', style: { gap: '6px', marginTop: '8px' } }, [
      ...kinds.map((k, i) => el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
        el('input', { class: 'input', type: 'color', value: k.colour, 'aria-label': `Colour for ${k.name}`, style: { width: '44px', padding: '2px' },
          on: { change: (e) => saveKinds(kinds.map((x, j) => (j === i ? { ...x, colour: e.target.value } : x))) } }),
        el('input', { class: 'input', value: k.name, 'aria-label': 'Category name', style: { maxWidth: '200px' },
          on: { change: (e) => saveKinds(kinds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))) } }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove category', on: { click: () => saveKinds(kinds.filter((_, j) => j !== i)) } }),
      ])),
      el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add category', 'data-field': 'day-add-kind',
        on: { click: () => saveKinds([...kinds, { id: `k${Date.now().toString(36)}`, name: 'New category', colour: KIND_COLOURS[kinds.length % KIND_COLOURS.length] }]) } })]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Removing a category keeps its blocks; they show as "Removed category" until you choose another.' }),
    ]),
  ]);
}
