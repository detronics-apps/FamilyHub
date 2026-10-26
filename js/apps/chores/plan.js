// Plan: the household's chore definitions, the editor, and the rooms.

import { el } from '../../ui/dom.js';
import { modal, confirmAction, choreMeta, statusLine } from '../../ui/common.js';
import { occurrences, occurrence } from '../../recurrence.js';
import { addChore, updateChore, deleteChore, addRoom, renameRoom, removeRoom, normaliseChore, roleOf } from '../../model.js';
import { sendHref } from '../shopping/logic.js';

/** Shopping owns the list; chores send supplies over in a link, confirmed there. */
const shoppingOn = (ctx) => Boolean(ctx.app.registry.apps.shopping?.enabled);
const suppliesHref = (source, from, names) => sendHref({ source, from, group: 'cleaning', items: names.map((name) => ({ name })) });

export function planView(ctx, notices) {
  const h = ctx.app.household;
  const today = ctx.today();
  const occ = occurrences(h, today);

  for (const c of h.chores.filter((x) => occ.get(x.id).needsReview)) {
    const o = occ.get(c.id);
    notices.push({
      id: `review:${c.id}`,
      level: 'warn',
      text: o.putOffCount >= 3
        ? `"${c.name}" has been put off ${o.putOffCount} times in a row. Worth a look at whether the plan fits?`
        : `"${c.name}" has waited about ${o.missedCycles} whole cycles. Worth a look at whether the plan fits?`,
      action: { label: 'Review', onClick: () => openEditor(ctx, c.id) },
    });
  }

  const groups = [...h.rooms.map((r) => ({ id: r.id, name: r.name })), { id: null, name: 'No particular room' }]
    .map((g) => ({ ...g, chores: h.chores.filter((c) => c.roomId === g.id) }))
    .filter((g) => g.chores.length);

  return el('div', { class: 'stack' }, [
    el('div', { class: 'row' }, [
      el('p', { class: 'muted', style: { margin: 0, flex: '1 1 240px' }, text: 'Decide what needs doing and roughly how often. Only a name is needed - the rest can come later.' }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Add a chore', 'data-field': 'add-chore', on: { click: () => openEditor(ctx, null) } }),
      shoppingOn(ctx) && h.chores.some((c) => c.supplies.length) ? el('a', {
        class: 'btn', 'data-field': 'send-supplies',
        href: suppliesHref('chores:supplies', 'Cleaning supplies', [...new Set(h.chores.flatMap((c) => c.supplies))]), text: 'Send cleaning supplies to Shopping',
      }) : null,
    ]),
    groups.length ? null : el('div', { class: 'panel empty' }, [el('p', { text: 'No chores yet. Add the first one - "Wipe counters, daily, 5 minutes" is a good start.' })]),
    ...groups.map((g) => el('div', { class: 'panel' }, [
      el('h2', { text: g.name }),
      el('ul', { class: 'list' }, g.chores.map((c) => el('li', {}, [
        el('div', { class: 'list__main' }, [
          el('div', {}, [el('strong', { text: c.name }), c.demo ? ' ' : null, c.demo ? el('span', { class: 'badge badge--demo', text: 'Example' }) : null,
            occ.get(c.id).needsReview ? el('span', { class: 'badge badge--demo', style: { marginLeft: '6px' }, text: 'Review' }) : null]),
          el('div', { class: 'small muted', text: choreMeta(h, c, { room: false }) }),
          el('div', { class: 'small muted', text: statusLine(h, occ.get(c.id), today) }),
        ]),
        el('button', { class: 'btn btn-small', type: 'button', text: 'Edit', 'data-field': `edit:${c.id}`, 'aria-label': `Edit ${c.name}`, on: { click: () => openEditor(ctx, c.id) } }),
      ]))),
    ])),
    roomsPanel(ctx),
  ]);
}

/* -------------------------------------------------------------- rooms */

function roomsPanel(ctx) {
  const h = ctx.app.household;
  const name = el('input', { class: 'input', id: 'new-room', placeholder: 'e.g. Laundry', 'data-field': 'new-room', style: { maxWidth: '240px' } });
  const add = () => { if (name.value.trim()) ctx.commit(addRoom(ctx.app.household, name.value).household); };
  return el('details', { class: 'panel more', open: ctx.app.ui.roomsOpen ?? false, on: { toggle: (e) => { ctx.app.ui.roomsOpen = e.currentTarget.open; } } }, [
    el('summary', { text: `Rooms and areas (${h.rooms.length})` }),
    el('ul', { class: 'list' }, h.rooms.map((r) => el('li', {}, [
      el('input', {
        class: 'input', value: r.name, 'aria-label': `Rename ${r.name}`, 'data-field': `room:${r.id}`, style: { flex: '1 1 160px', width: 'auto' },
        on: { change: (e) => ctx.commit(renameRoom(ctx.app.household, r.id, e.target.value)) },
      }),
      el('button', {
        class: 'btn btn-small', type: 'button', text: 'Remove', 'aria-label': `Remove ${r.name}`,
        on: {
          click: async () => {
            const n = ctx.app.household.chores.filter((c) => c.roomId === r.id).length;
            const ok = await confirmAction({ title: `Remove ${r.name}?`, text: n ? `Its ${n} chore${n === 1 ? '' : 's'} will be kept, under "No particular room".` : 'It has no chores.', confirmLabel: 'Remove room' });
            if (ok) ctx.commit(removeRoom(ctx.app.household, r.id));
          },
        },
      }),
    ]))),
    el('div', { class: 'row', style: { marginTop: 'var(--space-3)' } }, [
      el('label', { class: 'sr-only', for: 'new-room', text: 'New room name' }),
      name,
      el('button', { class: 'btn', type: 'button', text: 'Add room', on: { click: add } }),
    ]),
  ]);
}

/* ------------------------------------------------------------- editor */

const FREQ_PRESETS = [
  { id: 'daily', label: 'Daily', f: { unit: 'day', every: 1 } },
  { id: 'weekly', label: 'Weekly', f: { unit: 'week', every: 1 } },
  { id: 'fortnightly', label: 'Every 2 weeks', f: { unit: 'week', every: 2 } },
  { id: 'monthly', label: 'Monthly', f: { unit: 'month', every: 1 } },
  { id: 'seasonal', label: 'Seasonal (every 3 months)', f: { unit: 'month', every: 3 } },
  { id: 'yearly', label: 'Yearly', f: { unit: 'year', every: 1 } },
  { id: 'once', label: 'Just once', f: { unit: 'once', every: 1 } },
  { id: 'custom', label: 'Something else...', f: null },
];

const presetFor = (f) => FREQ_PRESETS.find((p) => p.f && p.f.unit === f.unit && p.f.every === f.every)?.id ?? 'custom';

function field(label, control, hint) {
  return el('div', { class: 'field' }, [el('label', { class: 'field__label', for: control.id, text: label }), control, hint ? el('div', { class: 'field__hint', text: hint }) : null]);
}

function selectOf(id, options, value) {
  return el('select', { class: 'select', id }, options.map(([v, label]) => el('option', { value: v, text: label, selected: String(v) === String(value ?? '') })));
}

/**
 * The editor edits a draft; nothing is saved until Save. It lives in a
 * <dialog>, outside the re-rendered app, so typing is never interrupted.
 */
export function openEditor(ctx, choreId) {
  const h = ctx.app.household;
  const today = ctx.today();
  const existing = choreId ? h.chores.find((c) => c.id === choreId) : null;
  const d = existing ? { ...existing } : normaliseChore({ name: '', startDay: today }, new Date().toISOString());
  const occ = existing ? occurrence(existing, h.events, today) : null;

  const name = el('input', { class: 'input', id: 'ed-name', value: existing ? d.name : '', required: true, autocomplete: 'off', placeholder: 'e.g. Clean the basin' });
  const nameError = el('div', { class: 'field__hint', role: 'alert', style: { color: 'var(--danger)' } });
  const room = selectOf('ed-room', [['', 'No particular room'], ...h.rooms.map((r) => [r.id, r.name])], d.roomId ?? '');
  const freq = selectOf('ed-freq', FREQ_PRESETS.map((p) => [p.id, p.label]), presetFor(d.frequency));
  const every = el('input', { class: 'input', id: 'ed-every', type: 'number', min: '1', max: '999', step: '1', value: String(d.frequency.every), style: { maxWidth: '100px' } });
  const unit = selectOf('ed-unit', [['day', 'days'], ['week', 'weeks'], ['month', 'months'], ['year', 'years']], d.frequency.unit === 'once' ? 'week' : d.frequency.unit);
  const custom = el('div', { class: 'row', hidden: presetFor(d.frequency) !== 'custom' }, [el('span', { text: 'Every' }), every, unit]);
  freq.addEventListener('change', () => { custom.hidden = freq.value !== 'custom'; });
  const minutes = el('input', { class: 'input', id: 'ed-min', type: 'number', min: '0', step: '1', inputmode: 'numeric', value: d.minutes ?? '', placeholder: 'not sure' });
  const effort = selectOf('ed-effort', [['', 'Not sure'], ['low', 'Low - fine when tired'], ['medium', 'Some effort'], ['high', 'A big effort']], d.effort ?? '');
  const importance = selectOf('ed-imp', [['normal', 'Normal'], ['high', 'Important - keep it visible'], ['low', 'Low']], d.importance);
  const kind = selectOf('ed-kind', [['routine', 'Routine'], ['maintenance', 'Maintenance'], ['oneoff', 'One-off job'], ['improvement', 'Improvement - nice to do, never urgent']], d.kind);
  const start = el('input', { class: 'input', id: 'ed-start', type: 'date', value: d.startDay, style: { maxWidth: '200px' } });
  const description = el('textarea', { class: 'input', id: 'ed-desc', text: d.description, rows: '2' });
  const instructions = el('textarea', { class: 'input', id: 'ed-how', text: d.instructions, rows: '3', placeholder: 'Steps or a checklist, one per line' });
  const easier = el('textarea', { class: 'input', id: 'ed-easier', text: d.easier, rows: '2', placeholder: 'What would make this easier or more likely to happen?' });
  const supplies = el('textarea', { class: 'input', id: 'ed-supplies', text: (d.supplies ?? []).join(', '), rows: '2', placeholder: 'e.g. bleach, sponges, bin bags' });
  const cost = el('input', { class: 'input', id: 'ed-cost', type: 'number', min: '0', step: 'any', value: d.cost ?? '', placeholder: 'none', style: { maxWidth: '160px' } });
  const optional = el('input', { type: 'checkbox', id: 'ed-opt', checked: d.optional });

  const people = h.people.map((p) => {
    const box = el('input', { type: 'checkbox', value: p.id, checked: d.eligible.includes(p.id) });
    return { box, node: el('label', { class: 'checkline' }, [box, `${p.name}${roleOf(p, today) === 'child' ? ' (child)' : ''}`]) };
  });
  // A chore may not wait on itself, nor on a chore that already waits on it.
  const candidates = h.chores.filter((c) => c.id !== choreId && !(choreId && c.dependsOn.includes(choreId)));
  const deps = candidates.map((c) => {
    const box = el('input', { type: 'checkbox', value: c.id, checked: d.dependsOn.includes(c.id) });
    return { box, node: el('label', { class: 'checkline' }, [box, c.name]) };
  });

  const review = occ?.needsReview ? el('div', { class: 'banner banner--warn', role: 'note' }, [el('span', { class: 'banner__text' }, [
    el('strong', { text: 'This one has not been fitting in. ' }),
    'That is useful to know - not a failing. Worth asking: does it need doing this often? Is there a better time, or someone else who could do it? Would something make it easier (see "What makes it easier")? Or is it no longer needed?',
  ])]) : null;

  const save = (then = null) => {
    if (!name.value.trim()) { nameError.textContent = 'Give the chore a name - that is the only thing needed.'; name.focus(); return; }
    const preset = FREQ_PRESETS.find((p) => p.id === freq.value);
    const fields = {
      name: name.value,
      roomId: room.value || null,
      frequency: preset?.f ?? { unit: unit.value, every: Number(every.value) || 1 },
      minutes: minutes.value,
      effort: effort.value || null,
      importance: importance.value,
      kind: kind.value,
      startDay: start.value || today,
      description: description.value,
      instructions: instructions.value,
      easier: easier.value,
      cost: cost.value,
      supplies: supplies.value,
      optional: optional.checked,
      eligible: people.filter((p) => p.box.checked).map((p) => p.box.value),
      dependsOn: deps.filter((x) => x.box.checked).map((x) => x.box.value),
    };
    const next = existing ? updateChore(ctx.app.household, existing.id, fields) : addChore(ctx.app.household, fields).household;
    close();
    ctx.flash({ id: `saved:${Date.now()}`, level: 'ok', text: existing ? `Saved changes to ${fields.name.trim()}.` : `Added ${fields.name.trim()}.` });
    ctx.commit(next);
    if (then) ctx.go(then(next));
  };

  const { close } = modal({
    title: existing ? `Edit ${existing.name}` : 'Add a chore',
    wide: true,
    body: [
      review,
      el('form', { class: 'stack', on: { submit: (e) => { e.preventDefault(); save(); } } }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'ed-name', text: 'What needs doing? *' }), name, nameError]),
        el('div', { class: 'grid-2' }, [
          field('Room or area', room),
          el('div', { class: 'stack' }, [field('How often', freq), custom]),
          field('About how long (minutes)', minutes, 'A rough guess is fine.'),
          field('Effort', effort),
        ]),
        el('details', { class: 'more' }, [
          el('summary', { text: 'More details' }),
          el('div', { class: 'stack' }, [
            el('div', { class: 'grid-2' }, [
              field('Importance', importance),
              field('Kind', kind),
              field(d.frequency.unit === 'once' || !existing ? 'Ready from' : 'First ready on', start),
              field('Cost, if any', cost, 'Roughly what it costs to do, in your own currency.'),
            ]),
            el('label', { class: 'checkline' }, [optional, 'Optional - available any time, never urgent']),
            field('Description', description),
            field('Instructions or checklist', instructions),
            field('What makes it easier', easier),
            field('Supplies it uses', supplies, 'Separated by commas. Send them to the shopping list when you run low.'),
            el('fieldset', {}, [
              el('legend', { text: 'Who can do it' }),
              people.length ? el('div', {}, people.map((p) => p.node)) : el('p', { class: 'small muted', text: 'Add people on the People page to choose.' }),
              el('div', { class: 'field__hint', text: 'Tick no one and any adult can do it. Children only see chores they are ticked on.' }),
            ]),
            deps.length ? el('fieldset', {}, [
              el('legend', { text: 'Wait until these are done first' }),
              el('div', { style: { maxHeight: '180px', overflowY: 'auto' } }, deps.map((x) => x.node)),
            ]) : null,
          ]),
        ]),
        el('button', { type: 'submit', hidden: true, tabindex: '-1', 'aria-hidden': 'true' }),
      ]),
    ],
    foot: [
      existing ? el('button', {
        class: 'btn btn-danger', type: 'button', text: 'Delete', style: { marginRight: 'auto' },
        on: {
          click: async () => {
            const n = ctx.app.household.events.filter((e) => e.choreId === existing.id).length;
            const ok = await confirmAction({
              title: `Delete ${existing.name}?`,
              text: n ? `Its history (${n} record${n === 1 ? '' : 's'}) goes too. If it only needs doing less often, change "How often" instead.` : 'This cannot be undone.',
              confirmLabel: 'Delete chore', danger: true,
            });
            if (ok) { close(); ctx.commit(deleteChore(ctx.app.household, existing.id)); }
          },
        },
      }) : null,
      existing && shoppingOn(ctx) ? el('button', {
        class: 'btn', type: 'button', text: 'Save and send supplies to Shopping', 'data-field': 'ed-send',
        on: { click: () => save((h2) => suppliesHref(`chore:${existing.id}`, existing.name, h2.chores.find((c) => c.id === existing.id)?.supplies ?? [])) },
      }) : null,
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'ed-save', on: { click: () => save() } }),
    ].filter(Boolean),
  });
  name.focus();
}
