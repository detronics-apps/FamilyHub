// Settings: household, people, this person's dashboard, data, appearance.

import { el, download } from '../dom.js';
import { avatar, confirmAction, removeExamples } from '../common.js';
import { setHouseholdName, addPerson, updatePerson, removePerson, PERSON_COLOURS, hasDemo } from '../../model.js';
import { resolveDashboard, moveModule, hideModule, showModule } from '../../dashboard.js';
import { exportData, exportFilename, parseImport } from '../../storage.js';
import { prefsKey } from './dashboard.js';

export function settingsView(ctx, route) {
  const sections = [householdSection(ctx), peopleSection(ctx), dashboardSection(ctx), dataSection(ctx)];
  if (route.sub === 'dashboard' && ctx.app.ui.scrolledTo !== location.hash) {
    // Arriving from "Rearrange these buttons": bring that section into view, once.
    ctx.app.ui.scrolledTo = location.hash;
    requestAnimationFrame(() => document.getElementById('set-dashboard')?.scrollIntoView({ block: 'start' }));
  }
  return el('section', { class: 'stack', 'aria-labelledby': 'settings-title' }, [
    el('h1', { id: 'settings-title', text: 'Settings' }),
    ...sections,
  ]);
}

function householdSection(ctx) {
  const h = ctx.app.household;
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Household' }),
    el('div', { class: 'field', style: { maxWidth: '360px' } }, [
      el('label', { class: 'field__label', for: 'hh-name', text: 'Household name' }),
      el('input', { class: 'input', id: 'hh-name', 'data-field': 'hh-name', value: h.household.name, on: { change: (e) => ctx.commit(setHouseholdName(ctx.app.household, e.target.value)) } }),
    ]),
  ]);
}

function peopleSection(ctx) {
  const h = ctx.app.household;
  const newName = el('input', { class: 'input', id: 'new-person', placeholder: 'Name', 'data-field': 'new-person', style: { maxWidth: '200px' } });
  const newRole = el('select', { class: 'select', 'aria-label': 'Adult or child', 'data-field': 'new-role', style: { width: 'auto' } }, [
    el('option', { value: 'adult', text: 'Adult' }), el('option', { value: 'child', text: 'Child' }),
  ]);
  const add = () => {
    if (!newName.value.trim()) { newName.focus(); return; }
    const colour = PERSON_COLOURS[h.people.length % PERSON_COLOURS.length];
    ctx.commit(addPerson(ctx.app.household, { name: newName.value, role: newRole.value, colour }).household);
  };

  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'People' }),
    el('p', { class: 'small muted', text: 'Choosing a person at the top of the screen is a convenience, not a login - anyone using this device can pick any name. Do not keep private or sensitive information here yet.' }),
    h.people.length ? el('ul', { class: 'list' }, h.people.map((p) => el('li', {}, [
      avatar(p),
      el('input', {
        class: 'input', value: p.name, 'aria-label': `Name for ${p.name}`, 'data-field': `pname:${p.id}`, style: { flex: '1 1 140px', width: 'auto' },
        on: { change: (e) => ctx.commit(updatePerson(ctx.app.household, p.id, { name: e.target.value })) },
      }),
      el('select', {
        class: 'select', 'aria-label': `Adult or child: ${p.name}`, 'data-field': `prole:${p.id}`, style: { width: 'auto' },
        on: { change: (e) => ctx.commit(updatePerson(ctx.app.household, p.id, { role: e.target.value })) },
      }, [el('option', { value: 'adult', text: 'Adult', selected: p.role === 'adult' }), el('option', { value: 'child', text: 'Child', selected: p.role === 'child' })]),
      el('div', { class: 'row', role: 'group', 'aria-label': `Colour for ${p.name}` }, PERSON_COLOURS.map((c, i) => el('button', {
        class: 'colour-dot', type: 'button', style: { background: c }, 'aria-pressed': String(p.colour === c), 'aria-label': `Colour ${i + 1}`,
        on: { click: () => ctx.commit(updatePerson(ctx.app.household, p.id, { colour: c })) },
      }))),
      p.demo ? el('span', { class: 'badge badge--demo', text: 'Example' }) : null,
      el('button', {
        class: 'btn btn-small', type: 'button', text: 'Remove', 'aria-label': `Remove ${p.name}`,
        on: {
          click: async () => {
            if (!await confirmAction({ title: `Remove ${p.name}?`, text: 'Chores they completed stay in the history, shown as "a former member".', confirmLabel: 'Remove' })) return;
            if (ctx.app.device.currentPersonId === p.id) ctx.setDevice({ currentPersonId: null });
            ctx.commit(removePerson(ctx.app.household, p.id));
          },
        },
      }),
    ]))) : el('p', { class: 'muted', text: 'No one added yet.' }),
    el('div', { class: 'row' }, [el('label', { class: 'sr-only', for: 'new-person', text: 'New person name' }), newName, newRole, el('button', { class: 'btn', type: 'button', text: 'Add person', on: { click: add } })]),
  ]);
}

function dashboardSection(ctx) {
  const key = prefsKey(ctx);
  const person = ctx.currentPerson();
  const prefs = ctx.app.device.prefs[key];
  const { visible, hidden } = resolveDashboard(prefs);
  const save = (next) => { ctx.setDevice({ prefs: { ...ctx.app.device.prefs, [key]: next } }); ctx.render(); };

  return el('div', { class: 'panel stack', id: 'set-dashboard' }, [
    el('h2', { text: 'Your dashboard' }),
    el('p', { class: 'small muted', text: person
      ? `The order and hidden buttons for ${person.name}, on this device. Everyone can arrange their own.`
      : 'You have not said who you are, so this arranges the shared "just looking" dashboard on this device.' }),
    el('ol', { class: 'list' }, visible.map((m, i) => el('li', {}, [
      el('span', { class: 'list__main' }, [el('strong', { text: m.name }), m.status !== 'ready' ? el('span', { class: 'small muted', text: ' · not built yet' }) : null]),
      el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '↑', 'aria-label': `Move ${m.name} up`, disabled: i === 0, 'data-field': `up:${m.id}`, on: { click: () => save(moveModule(prefs, m.id, -1)) } }),
      el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '↓', 'aria-label': `Move ${m.name} down`, disabled: i === visible.length - 1, 'data-field': `down:${m.id}`, on: { click: () => save(moveModule(prefs, m.id, 1)) } }),
      m.id === 'settings'
        ? el('span', { class: 'small muted', style: { minWidth: '64px' }, text: 'always shown' })
        : el('button', { class: 'btn btn-small', type: 'button', text: 'Hide', 'data-field': `hide:${m.id}`, 'aria-label': `Hide ${m.name}`, on: { click: () => save(hideModule(prefs, m.id)) } }),
    ]))),
    hidden.length ? el('div', {}, [
      el('h3', { text: 'Hidden' }),
      el('ul', { class: 'list' }, hidden.map((m) => el('li', {}, [
        el('span', { class: 'list__main', text: m.name }),
        el('button', { class: 'btn btn-small', type: 'button', text: 'Show', 'data-field': `show:${m.id}`, 'aria-label': `Show ${m.name}`, on: { click: () => save(showModule(prefs, m.id)) } }),
      ]))),
    ]) : null,
  ]);
}

function dataSection(ctx) {
  const h = ctx.app.household;
  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'data-field': 'import-file' });
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (!chosen) return;
    const result = parseImport(await chosen.text());
    if (!result.ok) {
      ctx.flash({ id: `import-bad:${chosen.name}`, level: 'error', text: `"${chosen.name}" was not imported, and nothing was changed. ${result.errors.slice(0, 3).join(' ')}` });
      ctx.render();
      return;
    }
    const s = result.summary;
    const ok = await confirmAction({
      title: 'Replace this household?',
      text: [
        `"${chosen.name}" contains ${s.name}: ${s.people} people, ${s.rooms} rooms, ${s.chores} chores and ${s.events} history records${s.exportedAt ? `, exported ${s.exportedAt.slice(0, 10)}` : ''}.`,
        `Importing replaces everything currently here (${h.household.name}: ${h.chores.length} chores). Export first if you want to keep it.`,
      ],
      confirmLabel: 'Replace with this file',
      danger: true,
    });
    if (!ok) return;
    if (!result.household.people.some((p) => p.id === ctx.app.device.currentPersonId)) ctx.setDevice({ currentPersonId: null });
    ctx.flash({ id: `import-ok:${Date.now()}`, level: 'ok', text: `Imported ${s.name}.` });
    ctx.commit(result.household);
  });

  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Your data' }),
    el('p', { text: 'Everything is saved in this browser, on this device only. That is not a backup, and it does not sync to other devices. Export a file to keep a copy you control.' }),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Export household', 'data-field': 'export',
        on: { click: () => download(new Blob([exportData(ctx.app.household)], { type: 'application/json' }), exportFilename(ctx.app.household)) },
      }),
      el('button', { class: 'btn', type: 'button', text: 'Import a file', 'data-field': 'import', on: { click: () => file.click() } }),
      file,
    ]),
    el('p', { class: 'small muted', text: 'The export is a plain JSON file (format "family-hub-household", data version 1). Settings for this device - who you are, dashboard order, theme - are not in it.' }),
    hasDemo(h) ? el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Remove examples', 'data-field': 'remove-demo', on: { click: () => removeExamples(ctx) } }),
      el('span', { class: 'small muted', text: 'Removes only the example family. Your own records stay.' }),
    ]) : null,
    el('details', { class: 'more' }, [
      el('summary', { text: 'Delete everything on this device' }),
      el('p', { class: 'small', text: 'Removes the household, its history, and this device’s settings. Export first if you might want any of it.' }),
      el('button', {
        class: 'btn btn-danger', type: 'button', text: 'Delete everything',
        on: {
          click: async () => {
            if (!await confirmAction({ title: 'Delete everything?', text: 'This cannot be undone.', confirmLabel: 'Delete everything', danger: true })) return;
            ctx.store.clearAll();
            location.hash = '#/';
            location.reload();   // a clean start: the welcome appears again
          },
        },
      }),
    ]),
  ]);
}
