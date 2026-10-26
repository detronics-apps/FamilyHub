// Settings: household, people, this person's dashboard, data, appearance.

import { el, download } from '../dom.js';
import { avatar, confirmAction, removeExamples, modal } from '../common.js';
import { setHouseholdName, addPerson, updatePerson, removePerson, PERSON_COLOURS, hasDemo, ALLERGENS, DIETS, LIFE_STAGES, FOCUS, ageOn, lifeStageAllowed } from '../../model.js';
import { resolveDashboard, moveModule, hideModule, showModule } from '../../dashboard.js';
import { exportData, exportFilename, parseImport } from '../../storage.js';
import { prefsKey } from './dashboard.js';
import { driveSection } from './drive.js';
import { availableImporters, importFromDevice, downloadTemplate } from '../imports.js';
import { OFFER, END_ACTIONS, END_ACTION_LABEL } from '../../music.js';

export function settingsView(ctx, route) {
  const sections = [householdSection(ctx), peopleSection(ctx), driveSection(ctx), importSection(ctx), dashboardSection(ctx), musicSection(ctx), dataSection(ctx)];
  const target = { people: 'set-people', dashboard: 'set-dashboard', drive: 'set-drive', music: 'set-music', import: 'set-import' }[route.sub];
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

  return el('div', { class: 'panel stack', id: 'set-people' }, [
    el('h2', { text: 'People' }),
    el('p', { class: 'small muted', text: 'Choosing a person at the top of the screen is a convenience, not a login - anyone using this device can pick any name. Everyone in the family can see what is here, food details included.' }),
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
      el('select', {
        class: 'select', 'aria-label': `Gender: ${p.name}`, 'data-field': `psex:${p.id}`, style: { width: 'auto' },
        on: { change: (e) => ctx.commit(updatePerson(ctx.app.household, p.id, { sex: e.target.value })) },
      }, [['', 'Gender'], ['female', 'Female'], ['male', 'Male']].map(([v, t]) => el('option', { value: v, text: t, selected: p.sex === v }))),
      el('div', { class: 'row', role: 'group', 'aria-label': `Colour for ${p.name}` }, PERSON_COLOURS.map((c, i) => el('button', {
        class: 'colour-dot', type: 'button', style: { background: c }, 'aria-pressed': String(p.colour === c), 'aria-label': `Colour ${i + 1}`,
        on: { click: () => ctx.commit(updatePerson(ctx.app.household, p.id, { colour: c })) },
      }))),
      p.demo ? el('span', { class: 'badge badge--demo', text: 'Example' }) : null,
      el('button', {
        class: 'btn btn-small', type: 'button', text: 'Food details', 'aria-label': `Food details for ${p.name}`, 'data-field': `pfood:${p.id}`,
        title: foodSummary(p, ctx.today()) || 'Age, allergies, pregnancy and what they would like more of - used by the Meals section',
        on: { click: () => editFood(ctx, p) },
      }),
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

function foodSummary(p, today) {
  const age = ageOn(p.born, today);
  return [age !== null ? `${age} years` : null, lifeStageAllowed(p, today) ? LIFE_STAGES[p.lifeStage] : null, p.allergies.length ? `allergic to ${p.allergies.join(', ')}` : null, ...p.focus.map((f) => FOCUS[f].toLowerCase())].filter(Boolean).join(' · ');
}

/** The food side of a profile, read by the Meals section. Every field is optional. */
function editFood(ctx, p) {
  const ticks = (name, options, chosen) => el('div', { class: 'chipset', role: 'group', 'aria-label': name }, Object.entries(options).map(([value, label]) => el('label', { class: 'checkline small' }, [
    el('input', { type: 'checkbox', name, value, checked: chosen.includes(value) }), label,
  ])));
  const input = (id, label, attrs, hint) => el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id, text: label }), el('input', { class: 'input', id, ...attrs }), hint ? el('div', { class: 'field__hint', text: hint }) : null,
  ]);
  const choice = (id, label, options, value) => el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id, text: label }),
    el('select', { class: 'select', id }, Object.entries(options).map(([v, t]) => el('option', { value: v, text: t, selected: v === value }))),
  ]);
  // Only for a female aged 16 or more; follows the birthday as it is typed. Gender is set on the People list.
  const stage = choice('pf-stage', 'Pregnant or breastfeeding', { '': 'Neither', ...LIFE_STAGES }, p.lifeStage);
  const showStage = () => { stage.hidden = !lifeStageAllowed({ ...p, born: form.querySelector('#pf-born').value }, ctx.today()); };
  const form = el('form', { class: 'stack' }, [
    el('p', { class: 'small muted', text: 'Used by the Meals section to fit suggestions to each person. Leave anything blank you would rather not say.' }),
    input('pf-born', 'Birthday', { type: 'date', value: p.born, max: ctx.today(), on: { input: () => showStage() } }, 'Age decides child-sized portions and safety, like no whole nuts under 5.'),
    p.sex ? null : el('p', { class: 'small muted', text: 'Choose a gender on the People list for nutrition values that fit.' }),
    stage,
    input('pf-weight', 'Weight in kg', { type: 'number', min: '1', max: '400', step: '0.1', value: p.weightKg ?? '' }, 'Optional. Only used to size an adult’s protein.'),
    el('fieldset', {}, [el('legend', { class: 'field__label', text: 'Allergies' }), ticks('allergies', Object.fromEntries(ALLERGENS.map((a) => [a, a])), p.allergies)]),
    input('pf-avoid', 'Anything else to avoid', { value: p.avoid.join(', '), placeholder: 'e.g. lactose, chilli' }),
    el('fieldset', {}, [el('legend', { class: 'field__label', text: 'Diet' }), ticks('diet', DIETS, p.diet)]),
    el('fieldset', {}, [el('legend', { class: 'field__label', text: 'Would like more of' }), ticks('focus', FOCUS, p.focus),
      el('div', { class: 'field__hint', text: 'A wish, not a diagnosis.' })]),
    input('pf-likes', 'Likes', { value: p.likes.join(', '), placeholder: 'e.g. carrots, bananas' }),
    input('pf-dislikes', 'Dislikes', { value: p.dislikes.join(', '), placeholder: 'e.g. mushrooms' }),
  ]);
  const save = () => {
    const v = (id) => form.querySelector(`#${id}`).value;
    const all = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
    ctx.commit(updatePerson(ctx.app.household, p.id, {
      born: v('pf-born'), lifeStage: stage.hidden ? '' : v('pf-stage'), weightKg: v('pf-weight'),
      allergies: all('allergies'), diet: all('diet'), focus: all('focus'), avoid: v('pf-avoid'), likes: v('pf-likes'), dislikes: v('pf-dislikes'),
    }));
    close();
  };
  showStage();
  const { close } = modal({
    title: `Food details: ${p.name}`,
    body: [form],
    foot: [el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }), el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'pf-save', on: { click: save } })],
  });
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
    el('ol', { class: 'list' }, visible.map((m, i) => el('li', {}, [
      el('span', { class: 'list__main' }, [el('strong', { text: m.name }), null]),
      el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '↑', 'aria-label': `Move ${m.name} up`, disabled: i === 0, 'data-field': `up:${m.id}`, on: { click: () => save(moveModule(prefs, m.id, -1, mods)) } }),
      el('button', { class: 'btn btn-small btn-icon', type: 'button', text: '↓', 'aria-label': `Move ${m.name} down`, disabled: i === visible.length - 1, 'data-field': `down:${m.id}`, on: { click: () => save(moveModule(prefs, m.id, 1, mods)) } }),
      m.id === 'settings' || m.id === 'library'
        ? el('span', { class: 'small muted', style: { minWidth: '64px' }, text: 'always shown' })
        : el('button', { class: 'btn btn-small', type: 'button', text: 'Hide', 'data-field': `hide:${m.id}`, 'aria-label': `Hide ${m.name}`, on: { click: () => save(hideModule(prefs, m.id, mods)) } }),
    ]))),
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
      prefs.source === 'device' || !ctx.folderSupported() ? el('button', { class: 'btn', type: 'button', text: 'Choose music files', on: { click: () => picker.click() } }) : null,
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
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Import a file', 'data-field': 'import-file-csv', on: { click: () => importFromDevice(ctx) } }),
      folder ? el('button', { class: 'btn', type: 'button', text: 'Check the Import folder now', on: { click: async () => { const r = await ctx.scanImports(); if (!r.length) { ctx.flash({ id: `inbox-empty:${Date.now()}`, level: 'info', text: 'Nothing waiting in the Import folder.' }); ctx.render(); } } } }) : null,
    ]),
    el('p', { class: 'small muted', text: folder
      ? 'Or drop filled-in files into the Import folder inside your Family Hub Drive folder - they are brought in automatically and moved to Import/Imported with a short report. Empty templates are waiting in Import/Templates.'
      : 'With your Drive folder connected, you can also drop filled-in files into its Import folder and they are brought in automatically.' }),
  ]);
}
