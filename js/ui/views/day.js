// Our day (D-149): each person's average day from midnight to midnight, side by side - through
// the day, or added up by category - with the day we want to get to, and the share of the
// chores each person takes. People › Our day.

import { el, saveOnLeave } from '../dom.js';
import { avatar } from '../common.js';
import { shows } from '../levels.js';
import { updatePerson, stageOf } from '../../model.js';
import { weeklyLoad } from '../../progress.js';
import { kindsOf, normaliseDay, normaliseKinds, timeline, totals, choreShare, nextBlock, fmtSpan, KIND_COLOURS, DAY_MINUTES, EIGHT, eightEight, fmtDelta, PART_GROUPS, personalParts, keepCopy, removeCopy, sinceCopy } from '../../day.js';

// What this screen shows, kept while it redraws (a save redraws the page).
const view = { version: 'now', mode: 'day', only: null, open: new Set(), compare: {}, eightOpen: null };
// "2 Nov", with the year when it is not this year.
const shortDay = (day, today) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) });
const pct = (m) => `${(m / DAY_MINUTES) * 100}%`;
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** The copy a person's day is compared with: the one chosen, or the latest. */
const compareCopy = (d, p) => d.copies.find((c) => c.day === view.compare[p.id]) ?? d.copies.at(-1) ?? null;

export function dayView(ctx) {
  const h = ctx.app.household;
  const kinds = kindsOf(h);
  const kind = (id) => kinds.find((k) => k.id === id);
  if (!shows('advanced')) { view.version = 'now'; if (view.mode === 'eight') view.mode = 'day'; }
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

  const nameCell = (p) => el('span', { class: 'small', style: { width: '80px', flex: '0 0 80px', overflow: 'hidden', textOverflow: 'ellipsis' }, text: p.name });
  // 8/8/8 (D-150): the day grouped as the rule groups it, over the rule's own 8 | 8 | 8.
  // 8/8/8 (D-150, D-158): one bar of the day grouped as the rule groups it, the rule's own 8 | 8 | 8
  // under it, and a short legend. Tap a legend entry for its detail - one line, only when asked.
  const SHORT = { sleep: 'Sleep', work: 'Work', personal: 'Personal', other: 'Other' };
  const hrs = (m) => `${Math.round(m / 6) / 10}h`;
  const vs8 = (d) => (d > 0 ? `${fmtSpan(d)} more than 8 h` : d < 0 ? `${fmtSpan(-d)} less than 8 h` : 'exactly 8 h');
  const segs = (parts, height) => el('div', { style: { flex: '1 1 auto', display: 'flex', gap: '2px', height, borderRadius: '8px', overflow: 'hidden', minWidth: 0 } },
    parts.filter((x) => x.minutes).map((x) => el('div', { title: x.tip, style: { flex: `${x.minutes} 1 0`, background: x.colour } })));
  const eightRow = (p) => {
    const adult = (stageOf(p, ctx.today()) ?? p.role) === 'adult';
    const blocks = blocksOf(p);
    const head = (child) => el('div', { class: 'row', style: { gap: '8px', flexWrap: 'nowrap', alignItems: 'center' } }, [nameCell(p), child]);
    if (!adult || !blocks.length) {
      return el('div', { class: 'stack', style: { gap: '2px' }, 'data-field': `day-row:${p.id}` }, [head(el('span', { class: 'small muted', 'data-field': `day-words:${p.id}`, text: adult ? 'Nothing planned yet - Edit day below.' : '8/8/8 is a rule for adults.' }))]);
    }
    const e = eightEight(blocks, kinds);
    const pp = personalParts(blocks, kinds);
    const detail = {
      sleep: (g) => `Sleep ${fmtSpan(g.minutes)} - ${vs8(g.delta)}.`,
      work: (g) => `Work ${fmtSpan(g.minutes)} - ${vs8(g.delta)}.`,
      personal: (g) => `Personal life ${fmtSpan(g.minutes)} - ${vs8(g.delta)}. ${pp.groups.map((x) => `${x.name} ${x.minutes ? fmtSpan(x.minutes) : 0} (${x.parts.map((y) => `${y.name} ${y.minutes ? fmtSpan(y.minutes) : 0}`).join(', ')})`).join(' · ')}${pp.none.length ? ` · No part yet: ${pp.none.map((k) => `${k.name} ${fmtSpan(k.minutes)}`).join(', ')}` : ''}`,
      other: (g) => (g.minutes ? `Not in 8/8/8: ${e.left.map((k) => `${k.name} ${fmtSpan(k.minutes)}`).join(', ')}.` : 'Nothing outside 8/8/8.'),
      unplanned: () => `Not planned yet: ${fmtSpan(e.unplanned)} - add blocks under Edit day.`,
    };
    const items = [...e.groups.map((g) => ({ id: g.id, name: SHORT[g.id], colour: g.colour, minutes: g.minutes, tip: detail[g.id](g) })),
      ...(e.unplanned ? [{ id: 'unplanned', name: 'Not planned', colour: 'var(--border)', minutes: e.unplanned, tip: detail.unplanned() }] : [])];
    const openKey = view.eightOpen?.startsWith(`${p.id}:`) ? view.eightOpen.slice(p.id.length + 1) : null;
    const open = items.find((x) => x.id === openKey);
    return el('div', { class: 'stack', style: { gap: '4px' }, 'data-field': `day-row:${p.id}` }, [
      head(segs(items, '28px')),
      el('div', { class: 'row', style: { gap: '8px', flexWrap: 'nowrap', alignItems: 'center' } }, [
        el('span', { class: 'small muted', style: { width: '80px', flex: '0 0 80px' }, text: '8/8/8' }),
        segs(EIGHT.filter((g) => g.minutes).map((g) => ({ ...g, tip: `The rule: ${g.name} 8 h` })), '8px')]),
      el('div', { class: 'row', style: { gap: '4px 14px', marginLeft: '88px' }, 'data-field': `day-words:${p.id}` }, items.filter((x) => x.minutes || x.id !== 'other').map((x) => el('button', {
        type: 'button', class: 'linkish small', 'aria-expanded': String(open?.id === x.id), title: x.tip, 'data-field': `day-legend:${p.id}:${x.id}`,
        style: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text)', textDecoration: 'none', fontWeight: open?.id === x.id ? '700' : '400' },
        on: { click: () => { view.eightOpen = open?.id === x.id ? null : `${p.id}:${x.id}`; ctx.render(); } },
      }, [el('span', { 'aria-hidden': 'true', style: { width: '10px', height: '10px', borderRadius: '50%', background: x.colour, flex: '0 0 auto' } }), `${x.name} · ${hrs(x.minutes)}`]))),
      open ? el('div', { class: 'small muted', style: { marginLeft: '88px' }, 'data-field': `day-detail:${p.id}`, text: open.tip }) : null,
    ]);
  };

  const row = (p) => {
    if (view.mode === 'eight') return eightRow(p);
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
        nameCell(p), bar(parts)]),
      el('div', { class: 'small muted', style: { marginLeft: '88px' }, 'data-field': `day-words:${p.id}`, text: [words,
        t.unplanned && blocks.length && !view.only ? `Not planned ${fmtSpan(t.unplanned)}` : null,
        t.overlap ? `Two blocks overlap at ${t.overlap} - the later one counts` : null].filter(Boolean).join(' · ') }),
      view.version === 'now' && shows('advanced') ? sinceLine(p) : null,
    ]);
  };
  // Since a kept copy (D-153): what changed, and - with a goal day - how much closer to it.
  const sinceLine = (p) => {
    const d = normaliseDay(p.day);
    const copy = compareCopy(d, p);
    if (!copy) return null;
    const changes = sinceCopy(d.now, copy.blocks, d.goal, kinds).filter((x) => !view.only || x.id === view.only);
    const one = (x) => `${x.name} ${fmtDelta(x.change)}${x.closer === null ? '' : x.closer === 0 ? '' : ` (${fmtSpan(Math.abs(x.closer))} ${x.closer > 0 ? 'closer to' : 'further from'} your goal)`}`;
    return el('div', { class: 'small', style: { marginLeft: '88px' }, 'data-field': `day-since:${p.id}`,
      text: `Since ${shortDay(copy.day, ctx.today())}: ${changes.length ? changes.map(one).join(' · ') : 'no change'}` });
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
        shows('advanced') ? chip('8/8/8', view.mode === 'eight', () => { view.mode = 'eight'; view.only = null; ctx.render(); }, 'day-mode:eight') : null,
        shows('advanced') ? el('span', { style: { width: '12px' } }) : null,
        shows('advanced') ? chip('Now', view.version === 'now', () => { view.version = 'now'; ctx.render(); }, 'day-version:now') : null,
        shows('advanced') ? chip('Goal', view.version === 'goal', () => { view.version = 'goal'; ctx.render(); }, 'day-version:goal') : null,
      ]),
      view.mode === 'eight' ? el('p', { class: 'small muted', style: { margin: 0 }, 'data-field': 'day-eight-note', text: 'A rule of thumb you will often hear: 8 hours work, 8 hours sleep, 8 hours personal life. The top bar is the day grouped the same way; under it, the rule. Other is what the rule leaves out - travel, breaks at work, the time in between, screens, planning. Tap an entry under a bar for its detail, such as the 3 Fs, 3 Hs and 3 Ss of personal life. Choose what each category counts as under Categories.' }) : null,
      view.version === 'goal' ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'The day you want to get to. In brackets: what it is now.' }) : null,
      ...h.people.map(row),
      h.people.length ? axis : el('p', { text: 'Add the family in People first.' }),
      view.mode === 'eight' ? null : el('div', { class: 'stack', style: { gap: '4px' } }, [
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
      el('p', { class: 'small', style: { margin: 0 }, text: '8/8/8: each part is the minutes of the categories that count as it, and the difference is that less 8 hours. Not in 8/8/8 is everything else. The idea of a day in three eights is widely credited to Robert Owen, who campaigned for shorter working days in the 1800s: "eight hours labour, eight hours recreation, eight hours rest".' }),
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
  // Saved when you leave the box (D-157), so typing 18:30 is never cut off at 18.
  const time = (b, i, f, label) => saveOnLeave(el('input', { class: 'input', type: 'time', step: '60', value: b[f], 'aria-label': label, style: { width: 'auto' }, 'data-field': `day-${f}:${p.id}:${i}` }),
    (v) => { if (v) put(blocks.map((x, j) => (j === i ? { ...x, [f]: v } : x))); });
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
      key === 'now' && shows('advanced') ? copiesRow(ctx, p, saveDay) : null,
    ]),
  ]);
}

/** Keep a dated copy of the day as it is now, to compare with later (D-153) - whenever you like. */
function copiesRow(ctx, p, saveDay) {
  const d = normaliseDay(p.day);
  const today = ctx.today();
  const chosen = compareCopy(d, p);
  const pick = d.copies.length ? el('select', { class: 'select', 'aria-label': 'Compare with the copy of', style: { maxWidth: '170px' }, 'data-field': `day-compare:${p.id}`,
    on: { change: (e) => { view.compare[p.id] = e.target.value; ctx.render(); } } },
  [...d.copies].reverse().map((c) => el('option', { value: c.day, text: shortDay(c.day, today), selected: c.day === chosen?.day }))) : null;
  return el('div', { class: 'stack', style: { gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '8px' } }, [
    el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
      el('button', { class: 'btn btn-small', type: 'button', text: 'Keep copy', title: 'Keep this day with today’s date, to see later what changed', 'data-field': `day-keep:${p.id}`,
        on: { click: () => { view.compare[p.id] = null; saveDay(p, keepCopy(p.day, today)); } } }),
      pick ? el('span', { class: 'small', text: 'Compare with' }) : null, pick,
      pick ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove copy', 'data-field': `day-remove-copy:${p.id}`,
        on: { click: () => { view.compare[p.id] = null; saveDay(p, removeCopy(p.day, chosen.day)); } } }) : null,
    ]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: d.copies.length
      ? `${d.copies.length} cop${d.copies.length === 1 ? 'y' : 'ies'} kept. The line under ${p.name}’s day says what changed since the one chosen - and, with a goal day, how much closer to it.`
      : 'Keep a copy now and then - every week, every month, whenever. Later, the line under the day shows what changed since.' }),
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
        shows('advanced') ? el('select', { class: 'select', 'aria-label': `In 8/8/8, ${k.name} counts as`, title: 'What it counts as in 8/8/8', style: { maxWidth: '170px' }, 'data-field': `day-eight:${k.id}`,
          on: { change: (e) => saveKinds(kinds.map((x, j) => (j === i ? { ...x, eight: e.target.value } : x))) } },
        EIGHT.map((g) => el('option', { value: g.id, text: g.id === 'other' ? 'Not in 8/8/8' : `8/8/8: ${g.name}`, selected: k.eight === g.id }))) : null,
        shows('advanced') && k.eight === 'personal' ? el('select', { class: 'select', 'aria-label': `Part of personal life for ${k.name}`, title: 'Which of the 3 Fs, 3 Hs and 3 Ss', style: { maxWidth: '150px' }, 'data-field': `day-part:${k.id}`,
          on: { change: (e) => saveKinds(kinds.map((x, j) => (j === i ? { ...x, part: e.target.value } : x))) } },
        [el('option', { value: '', text: 'No part', selected: !k.part }), ...PART_GROUPS.map((g) => el('optgroup', { label: g.name }, g.parts.map((x) => el('option', { value: x.id, text: x.name, selected: k.part === x.id }))))]) : null,
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove category', on: { click: () => saveKinds(kinds.filter((_, j) => j !== i)) } }),
      ])),
      el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add category', 'data-field': 'day-add-kind',
        on: { click: () => saveKinds([...kinds, { id: `k${Date.now().toString(36)}`, name: 'New category', colour: KIND_COLOURS[kinds.length % KIND_COLOURS.length] }]) } })]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Removing a category keeps its blocks; they show as "Removed category" until you choose another.' }),
    ]),
  ]);
}
