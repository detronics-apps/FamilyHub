// Settings: household, this person's dashboard, Drive, data, music. People have their own page (people.js).

import { el, download } from '../dom.js';
import { confirmAction, removeExamples } from '../common.js';
import { setHouseholdName, hasDemo } from '../../model.js';
import { resolveDashboard, moveModule, placeModule, hideModule, showModule } from '../../dashboard.js';
import { draggable, dropTarget } from '../drag.js';
import { exportData, exportFilename, parseImport } from '../../storage.js';
import { prefsKey } from './dashboard.js';
import { driveSection } from './drive.js';
import { availableImporters, importFromDevice, downloadTemplate } from '../imports.js';
import { OFFER, END_ACTIONS, END_ACTION_LABEL } from '../../music.js';
import { SYSTEMS } from '../../units.js';

export function settingsView(ctx, route) {
  const sections = [householdSection(ctx), unitsSection(ctx), driveSection(ctx), importSection(ctx), dashboardSection(ctx), musicSection(ctx), dataSection(ctx)];
  const target = { units: 'set-units', dashboard: 'set-dashboard', drive: 'set-drive', music: 'set-music', import: 'set-import' }[route.sub];
  if (target && ctx.app.ui.scrolledTo !== location.hash) {
    // Arriving from a link to one section: bring it into view, once.
    ctx.app.ui.scrolledTo = location.hash;
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
  }
  return el('section', { class: 'stack', 'aria-labelledby': 'settings-title' }, [
    el('h1', { id: 'settings-title', text: 'Settings' }),
    ...sections,
  ]);
}

/** How amounts are shown and typed on this device. Everything is saved in metric either way. */
function unitsSection(ctx) {
  const current = ctx.app.device.units;
  return el('div', { class: 'panel stack', id: 'set-units' }, [
    el('h2', { text: 'Units' }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Units' }, Object.entries(SYSTEMS).map(([k, label]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(current === k), text: label, 'data-field': `units:${k}`,
      on: { click: () => { ctx.setDevice({ units: k }); ctx.render(); } },
    }))),
    el('p', { class: 'small muted', text: 'For weights and heights, food amounts, ingredients and the shopping list on this device. Family Hub keeps everything in metric underneath, so devices set differently always agree. Nutrients stay in grams and milligrams, as on food labels.' }),
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
    el('p', { class: 'small' }, ['The people in your family, with their food details and heights and weights, are on the ', el('a', { href: '#/people', text: 'People' }), ' page.']),
  ]);
}

function dashboardSection(ctx) {
  const key = prefsKey(ctx);
  const person = ctx.currentPerson();
  const prefs = ctx.app.device.prefs[key];
  const mods = ctx.dashboardModules();
  const { visible, hidden } = resolveDashboard(prefs, mods);
  const save = (next) => { ctx.setDevice({ prefs: { ...ctx.app.device.prefs, [key]: next } }); ctx.render(); };

  return el('div', { class: 'panel stack', id: 'set-dashboard' }, [
    el('h2', { text: 'Your dashboard' }),
    el('p', { class: 'small muted', text: person
      ? `The order and hidden buttons for ${person.name}, on this device. Everyone can arrange their own. Hiding only takes a button off the home screen - to turn a mini-app off or remove it, use Mini-apps.`
      : 'You have not said who you are, so this arranges the shared "just looking" dashboard on this device.' }),
    el('p', { class: 'small', text: 'Drag a row to where you want it (on a phone, press and hold first), or use the arrows.' }),
    // Each row can be dragged onto another: it takes that row's place.
    el('ol', { class: 'list reorder' }, visible.map((m, i) => dropTarget(draggable(el('li', { 'data-field': `row:${m.id}` }, [
      el('span', { class: 'grip', 'aria-hidden': 'true', text: '⠿' }),
      el('span', { class: 'list__main' }, [el('strong', { text: m.name }), null]),
      el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '↑', 'aria-label': `Move ${m.name} up`, disabled: i === 0, 'data-field': `up:${m.id}`, on: { click: () => save(moveModule(prefs, m.id, -1, mods)) } }),
      el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '↓', 'aria-label': `Move ${m.name} down`, disabled: i === visible.length - 1, 'data-field': `down:${m.id}`, on: { click: () => save(moveModule(prefs, m.id, 1, mods)) } }),
      m.id === 'settings' || m.id === 'library'
        ? el('span', { class: 'small muted', style: { minWidth: '64px' }, text: 'always shown' })
        : el('button', { class: 'btn btn-small', type: 'button', text: 'Hide', 'data-field': `hide:${m.id}`, 'aria-label': `Hide ${m.name}`, on: { click: () => save(hideModule(prefs, m.id, mods)) } }),
    ]), m.id), (id) => save(placeModule(prefs, id, m.id, mods))))),
    hidden.length ? el('div', {}, [
      el('h3', { text: 'Hidden' }),
      el('ul', { class: 'list' }, hidden.map((m) => el('li', {}, [
        el('span', { class: 'list__main', text: m.name }),
        el('button', { class: 'btn btn-small', type: 'button', text: 'Show', 'data-field': `show:${m.id}`, 'aria-label': `Show ${m.name}`, on: { click: () => save(showModule(prefs, m.id, mods)) } }),
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
      confirmLabel: 'Replace',
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
      el('button', { class: 'btn', type: 'button', text: 'Import', 'data-field': 'import', on: { click: () => file.click() } }),
      file,
    ]),
    el('p', { class: 'small muted', text: 'The export is a plain JSON file (format "family-hub-household", data version 1). Settings for this device - who you are, dashboard order, theme - are not in it.' }),
    hasDemo(h) ? el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Remove examples', 'data-field': 'remove-demo', on: { click: () => removeExamples(ctx) } }),
      el('span', { class: 'small muted', text: 'Removes only the example family. Your own records stay.' }),
    ]) : null,
    el('details', { class: 'more' }, [
      el('summary', { text: 'Delete everything on this device' }),
      el('p', { class: 'small', text: 'Removes the household, its history, mini-app records kept on this device, and this device’s settings. Your Google Drive folder is not touched. Export first if you might want any of it.' }),
      el('button', {
        class: 'btn btn-danger', type: 'button', text: 'Delete everything',
        on: {
          click: async () => {
            if (!await confirmAction({ title: 'Delete everything?', text: 'This cannot be undone.', confirmLabel: 'Delete everything', danger: true })) return;
            ctx.store.clearAll();
            try { indexedDB.deleteDatabase('familyhub'); } catch { /* nothing stored there */ }
            location.hash = '#/';
            location.reload();   // a clean start: the welcome appears again
          },
        },
      }),
    ]),
  ]);
}

function musicSection(ctx) {
  const prefs = ctx.app.device.music;
  const save = (patch) => { ctx.setDevice({ music: { ...prefs, ...patch } }); ctx.render(); };
  const folderMode = ctx.sync.appStore()?.kind === 'folder';
  const count = el('span', { class: 'small muted' });
  if (prefs.source === 'folder') {
    ctx.media.listTracks('folder').then((t) => {
      count.textContent = folderMode
        ? `${t.length} music file${t.length === 1 ? '' : 's'} found in Data / Media / Music.`
        : 'Connect your Drive folder to play music from it, or choose files on this device.';
    }).catch(() => {});
  } else {
    const n = ctx.media.deviceFileCount();
    count.textContent = `${n} file${n === 1 ? '' : 's'} chosen for this session.`;
  }
  const picker = el('input', { type: 'file', accept: 'audio/*', multiple: true, hidden: true });
  picker.addEventListener('change', () => { ctx.media.chooseDeviceFiles(picker.files); save({ source: 'device' }); });
  const sel = (id, value, options, onChange) => el('select', {
    class: 'select', id, 'data-field': id, style: { maxWidth: '320px' }, on: { change: (e) => onChange(e.target.value) },
  }, options.map(([v, label]) => el('option', { value: v, text: label, selected: v === value })));
  const m = ctx.media.state;
  const playing = m.status === 'playing' || m.status === 'loading';
  const field = (id, label, control) => el('div', { class: 'field' }, [el('label', { class: 'field__label', for: id, text: label }), control]);

  return el('div', { class: 'panel stack', id: 'set-music' }, [
    el('h2', { text: 'Music' }),
    el('p', { class: 'small', text: 'Optional music while you do a timed task. It plays from your own files - nothing is uploaded, and only the track that is playing is held in memory.' }),
    el('div', { class: 'grid-2' }, [
      field('mu-offer', 'When I start a timed task', sel('mu-offer', prefs.offer, OFFER.map((o) => [o, { ask: 'Ask me', always: 'Play music', never: 'No music' }[o]]), (v) => save({ offer: v }))),
      field('mu-end', 'When the timer ends', sel('mu-end', prefs.endAction, END_ACTIONS.map((a) => [a, END_ACTION_LABEL[a]]), (v) => save({ endAction: v }))),
      field('mu-src', 'Play from', sel('mu-src', prefs.source, [['folder', 'My Drive folder (Data / Media / Music)'], ['device', 'Files I choose on this device']], (v) => save({ source: v }))),
      field('mu-vol', 'Volume', el('input', { type: 'range', id: 'mu-vol', min: '0', max: '1', step: 'any', value: String(prefs.volume), 'data-field': 'mu-vol', on: { change: (e) => save({ volume: Number(e.target.value) }) } })),
    ]),
    el('label', { class: 'checkline' }, [el('input', { type: 'checkbox', checked: prefs.shuffle, on: { change: (e) => save({ shuffle: e.target.checked }) } }), 'Shuffle']),
    count,
    el('div', { class: 'row' }, [
      prefs.source === 'device' || !ctx.folderSupported() ? el('button', { class: 'btn', type: 'button', text: 'Choose music', on: { click: () => picker.click() } }) : null,
      playing
        ? el('button', { class: 'btn', type: 'button', text: 'Stop music', on: { click: () => ctx.media.stop() } })
        : el('button', { class: 'btn', type: 'button', text: 'Try it', 'data-field': 'mu-try', on: { click: () => ctx.media.start() } }),
      picker,
    ]),
    m.status === 'error' && m.error ? el('p', { class: 'small muted', role: 'status', text: m.error }) : null,
    el('p', { class: 'small muted', text: 'Spotify and other streaming services are not supported - their playback rules are different. Formats: mp3, m4a, aac, ogg, opus, wav, flac, webm (what plays depends on your browser).' }),
  ]);
}

/** Bring in data: a template per kind, an import from this device, and the Import folder. */
function importSection(ctx) {
  const list = el('div', { class: 'stack' }, [el('p', { class: 'small muted', text: 'Loading the templates…' })]);
  availableImporters(ctx).then((importers) => {
    list.replaceChildren(el('ul', { class: 'list' }, importers.map((imp) => el('li', {}, [
      el('div', { class: 'list__main' }, [
        el('strong', { text: imp.label }),
        el('details', { class: 'more' }, [
          el('summary', { class: 'small', text: 'What goes in each column' }),
          el('ul', { class: 'small' }, imp.columns.map((c) => el('li', {}, [el('strong', { text: `${c.name}${c.required ? ' *' : ''}` }), ` - ${c.help}`]))),
        ]),
      ]),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Download template', 'data-field': `template:${imp.kind}`, on: { click: () => downloadTemplate(imp) } }),
    ]))));
  });
  const folder = ctx.sync.appStore()?.kind === 'folder';
  return el('div', { class: 'panel stack', id: 'set-import' }, [
    el('h2', { text: 'Bring in data' }),
    el('p', { class: 'small', text: 'Already have recipes, chores or a to-do list somewhere? Download a template, fill it in with a spreadsheet (Excel, Google Sheets, Numbers), save it as CSV and bring it in. Things whose name already exists are left alone, so nothing is doubled.' }),
    list,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Import', 'data-field': 'import-file-csv', on: { click: () => importFromDevice(ctx) } }),
      folder ? el('button', { class: 'btn', type: 'button', text: 'Check now', title: 'Check the Import folder now', on: { click: async () => { const r = await ctx.scanImports(); if (!r.length) { ctx.flash({ id: `inbox-empty:${Date.now()}`, level: 'info', text: 'Nothing waiting in the Import folder.' }); ctx.render(); } } } }) : null,
    ]),
    el('p', { class: 'small muted', text: folder
      ? 'Or drop filled-in files into the Import folder inside your Family Hub Drive folder - they are brought in automatically and moved to Import/Imported with a short report. Empty templates are waiting in Import/Templates.'
      : 'With your Drive folder connected, you can also drop filled-in files into its Import folder and they are brought in automatically.' }),
  ]);
}
