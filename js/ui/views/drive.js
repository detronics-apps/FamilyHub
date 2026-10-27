// Everything a person sees about where their data is: the status in the
// header, the app-wide notices that need an answer, the conflict and
// first-connect questions, the Google Drive section of Settings, and the
// family file (phones, backups, moving between devices).

import { el, download } from '../dom.js';
import { modal, confirmAction } from '../common.js';
import { conflictKey } from '../../merge.js';
import { parseFamilyFile, describeFamilyFile, familyFileName, PHONE_DIR, PHONE_FILE } from '../../family-file.js';
import { fingerprint } from '../../folder-sync.js';
import { KEYS } from '../../storage.js';
import { roomName, personName } from '../../model.js';
import { privateTestMode } from '../sync.js';

const DAY_MS = 86400000;
const when = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function fileDirty(ctx) {
  try { return fingerprint(JSON.parse(localStorage.getItem(KEYS.fileBase) || 'null')) !== fingerprint(ctx.app.household); } catch { return true; }
}

/** The small status button in the header. Never says "saved to Drive" unless it was. */
export function syncChip(ctx) {
  const s = ctx.sync.status;
  const time = s.lastSavedAt ? s.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const map = {
    device: ['chip-status', '●', 'On this device', 'Saved in this browser only. Connect your Google Drive folder in Settings to keep it safe in Drive.'],
    saving: ['chip-status chip-status--busy', '↻', 'Saving…', 'Writing your changes to your Drive folder.'],
    saved: ['chip-status chip-status--ok', '✓', 'Saved to Drive', `Saved to your Drive folder${time ? ` at ${time}` : ''}. Google Drive for Desktop uploads it from there.`],
    reconnect: ['chip-status chip-status--warn', '!', 'Not in Drive yet', 'Your changes are saved on this device. Reconnect your Drive folder to save them there too.'],
    decision: ['chip-status chip-status--warn', '?', 'Needs a decision', 'Two devices changed the same thing. Choose which to keep.'],
    'first-connect': ['chip-status chip-status--warn', '?', 'Needs a decision', 'Your Drive folder already has a family in it.'],
    error: ['chip-status chip-status--warn', '!', 'Drive problem', s.message || 'Something went wrong saving to your Drive folder. Your changes are safe on this device.'],
  };
  const [cls, glyph, label, title] = map[s.state] ?? map.device;
  return el('a', { class: `btn ${cls}`, href: '#/settings/drive', title, 'aria-label': `${label}. ${title}`, 'data-field': 'sync-chip' }, [
    el('span', { 'aria-hidden': 'true', class: 'chip-status__glyph', text: glyph }),
    el('span', { class: 'chip-status__text', text: label }),
  ]);
}

/** Notices that must be answerable from any screen. */
export function syncNotices(ctx) {
  const s = ctx.sync.status;
  const out = [];
  if (s.state === 'reconnect') {
    out.push({ id: `sync:reconnect:${s.message}`, level: 'warn', text: s.message || 'Family Hub needs your permission again to save to your Drive folder. Until then, changes are kept on this device only.', action: { label: 'Reconnect', onClick: () => ctx.sync.reconnect() } });
  }
  if (s.state === 'decision' && s.conflict) {
    out.push({ id: 'sync:decision', level: 'warn', text: `${s.conflict.conflicts.length === 1 ? 'One thing was' : `${s.conflict.conflicts.length} things were`} changed in two places at once. Nothing has been overwritten - choose what to keep.`, action: { label: 'Choose', onClick: () => openConflicts(ctx) } });
  }
  if (s.state === 'first-connect' && s.firstConnect) {
    out.push({ id: 'sync:first', level: 'warn', text: `Your Drive folder already has ${s.firstConnect.theirs.household.name} in it. Decide how to use it with this device.`, action: { label: 'Decide', onClick: () => openFirstConnect(ctx) } });
  }
  if (s.state === 'error') out.push({ id: `sync:error:${s.message}`, level: 'error', text: `Saving to your Drive folder failed: ${s.message} Your changes are safe on this device.`, action: { label: 'Try again', onClick: () => ctx.sync.run() } });

  // A phone (no folder access): a gentle daily nudge to send its changes back, and to get the latest.
  if (s.mode === 'device' && !ctx.folderSupported()) {
    const sent = ctx.app.device.fileSavedAt ? Date.parse(ctx.app.device.fileSavedAt) : 0;
    const got = ctx.app.device.fileOpenedAt ? Date.parse(ctx.app.device.fileOpenedAt) : 0;
    if (ctx.app.household.chores.length && fileDirty(ctx) && Date.now() - sent > DAY_MS) {
      out.push({ id: 'sync:phone-save', level: 'info', text: 'You have changes that are only on this phone. Send them back to your Google Drive?', action: { label: 'Send back', onClick: () => saveFamilyFile(ctx) } });
    } else if (got && Date.now() - got > DAY_MS / 2) {
      out.push({ id: `sync:phone-get:${new Date().toDateString()}`, level: 'info', text: `This phone last got the latest from Drive on ${when(ctx.app.device.fileOpenedAt)}.`, action: { label: 'Get latest', onClick: () => openFamilyFile(ctx) } });
    }
  }
  return out;
}

const show = (v) => {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(none)';
  if (typeof v === 'object') return v.name ?? v.title ?? JSON.stringify(v);
  return String(v);
};

function describeConflict(ctx, c) {
  const h = ctx.app.household;
  const rec = (list, id) => (h[list] ?? []).find((x) => x.id === id);
  const what = {
    household: 'The household',
    people: `Person "${(rec('people', c.id) ?? c.mine ?? c.theirs)?.name ?? '?'}"`,
    rooms: `Room "${(rec('rooms', c.id) ?? c.mine ?? c.theirs)?.name ?? '?'}"`,
    chores: `Chore "${(rec('chores', c.id) ?? c.mine ?? c.theirs)?.name ?? '?'}"`,
    events: 'A chore record',
  }[c.collection];
  if (c.kind === 'edit-delete') {
    return { what, mine: c.mine ? 'Changed here' : 'Deleted here', theirs: c.theirs ? 'Changed on the other device' : 'Deleted on the other device' };
  }
  const val = (v) => (c.field === 'roomId' ? roomName(h, v) : c.field === 'by' ? personName(h, v) : show(v));
  return { what: `${what} - ${c.field}`, mine: val(c.mine), theirs: val(c.theirs) };
}

/** Both devices changed the same thing: show both, keep what the person picks. */
export function openConflicts(ctx) {
  const c = ctx.sync.status.conflict;
  if (!c) return;
  const choices = {};
  const rows = c.conflicts.map((conf) => {
    const key = conflictKey(conf);
    const d = describeConflict(ctx, conf);
    const name = `conf-${key}`;
    choices[key] = 'mine';
    const radio = (value, label) => el('label', { class: 'checkline' }, [
      el('input', { type: 'radio', name, value, checked: value === 'mine', on: { change: () => { choices[key] = value; } } }),
      label,
    ]);
    return el('fieldset', { class: 'panel panel--soft' }, [
      el('legend', { text: d.what }),
      radio('mine', `This device: ${d.mine}`),
      radio('theirs', `${c.fromFile ? 'The file' : 'Your Drive folder'}: ${d.theirs}`),
    ]);
  });
  const { close } = modal({
    title: 'Choose what to keep',
    wide: true,
    body: [
      el('p', { text: 'These were changed in two places at the same time. Everything else has already been combined. Nothing is lost until you choose.' }),
      ...rows,
    ],
    foot: [
      el('button', { class: 'btn', type: 'button', text: 'Decide later', on: { click: () => close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save choices', 'data-field': 'conflict-apply', on: { click: () => { close(); ctx.sync.resolveConflict(choices); } } }),
    ],
  });
}

export function openFirstConnect(ctx) {
  const f = ctx.sync.status.firstConnect;
  if (!f) return;
  const t = f.theirs;
  const mine = ctx.app.household;
  const { close } = modal({
    title: 'Your Drive folder already has a family',
    body: [
      el('p', { text: `The folder holds ${t.household.name}: ${t.people.length} people and ${t.chores.length} chores. This device has ${mine.household.name}: ${mine.people.length} people and ${mine.chores.length} chores.` }),
      el('p', { class: 'small muted', text: 'On a second laptop or after reinstalling, "Use the folder’s family" is usually right.' }),
    ],
    foot: [
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => { close(); ctx.sync.chooseFirstConnect('cancel'); } } }),
      el('button', { class: 'btn', type: 'button', text: 'Merge', title: 'Add this device’s family into the folder’s', 'data-field': 'first-merge', on: { click: () => { close(); ctx.sync.chooseFirstConnect('merge'); } } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Use folder', title: 'Use the family already in the folder', 'data-field': 'first-use', on: { click: () => { close(); ctx.sync.chooseFirstConnect('use'); } } }),
    ],
  });
}

/* --------------------------------------------------------- family file */

export async function saveFamilyFile(ctx) {
  const text = await ctx.sync.familyFileText({ withBase: ctx.sync.status.mode !== 'folder' });
  const name = familyFileName(ctx.app.household);
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Family Hub' });     // the phone's share menu -> Drive
    } else {
      download(file, name);
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;                              // they closed the share menu
    download(file, name);
  }
  ctx.sync.rememberFileBase();
  ctx.setDevice({ fileSavedAt: new Date().toISOString() });
  ctx.flash({ id: `file:${Date.now()}`, level: 'ok', text: ctx.folderSupported()
    ? `Family file saved (${name}).`
    : `Sent (${name}). If you saved it into FamilyHub › ${PHONE_DIR} in Drive, a laptop adds it in the next time Family Hub is open there.` });
  ctx.render();
}

export function openFamilyFile(ctx) {
  const input = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  input.addEventListener('change', async () => {
    const chosen = input.files?.[0];
    input.remove();
    if (!chosen) return;
    const parsed = parseFamilyFile(await chosen.text());
    if (!parsed.ok) {
      ctx.flash({ id: `file-bad:${chosen.name}`, level: 'error', text: `"${chosen.name}" was not opened, and nothing was changed. ${parsed.errors.slice(0, 3).join(' ')}` });
      ctx.render();
      return;
    }
    // Nothing here yet, or the same family: no question to ask - combining keeps everything from both.
    const h = ctx.app.household;
    const fresh = !h.people.length && !h.chores.length;
    if (fresh || parsed.household.household.id === h.household.id) {
      const r = await ctx.sync.importFamilyFile(parsed, fresh ? 'replace' : 'merge', { quiet: true });
      ctx.setDevice({ fileOpenedAt: new Date().toISOString() });
      ctx.flash({ id: `file-in:${Date.now()}`, level: 'ok', text: `${fresh ? `${parsed.household.household.name} is on this device now` : 'Up to date'} - from the copy saved ${parsed.exportedAt ? when(parsed.exportedAt) : 'earlier'}.` });
      ctx.render();
      if (r.conflicts) openConflicts(ctx);
      return;
    }
    const { close } = modal({
      title: 'Open this family file?',
      body: [
        el('p', { text: describeFamilyFile(parsed) }),
        el('p', { text: '"Combine" keeps everything from both - this device and the file - and asks you if the same thing was changed in both. "Use the file" replaces this device’s household with the one in the file.' }),
      ],
      foot: [
        el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
        el('button', {
          class: 'btn btn-danger', type: 'button', text: 'Use file',
          on: {
            click: async () => {
              close();
              if (!await confirmAction({ title: 'Replace this device’s household?', text: `${ctx.app.household.household.name} on this device will be replaced by the file. Mini-app records are combined, not replaced.`, confirmLabel: 'Replace', danger: true })) return;
              await ctx.sync.importFamilyFile(parsed, 'replace');
            },
          },
        }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Combine', 'data-field': 'file-merge', on: { click: async () => { close(); const r = await ctx.sync.importFamilyFile(parsed, 'merge'); ctx.setDevice({ fileOpenedAt: new Date().toISOString() }); if (r.conflicts) openConflicts(ctx); } } }),
      ],
    });
  });
  document.body.append(input);
  input.click();
}

/* ------------------------------------------------------- settings section */

export function driveSection(ctx) {
  const s = ctx.sync.status;
  const supported = ctx.folderSupported() || privateTestMode();
  const body = [
    el('h2', { text: 'Google Drive' }),
    el('p', { class: 'small', style: { margin: 0 } }, [el('a', { href: '#/connect', 'data-field': 'drive-steps', text: 'All the steps for laptops and phones' }), ' - including the home screen, and what can go wrong.']),
  ];

  if (s.mode === 'folder') {
    const statusLine = {
      saved: `Connected to the folder "${s.folderName}". Last saved ${s.lastSavedAt ? s.lastSavedAt.toLocaleTimeString() : 'just now'}. Google Drive for Desktop uploads it to your Drive.`,
      saving: `Connected to "${s.folderName}". Saving…`,
      reconnect: `"${s.folderName ?? 'Your folder'}" needs permission again. Changes are kept on this device until you reconnect.`,
      decision: `Connected to "${s.folderName}". Waiting for your decision before saving.`,
      'first-connect': `Connected to "${s.folderName}", which already has a family in it. Decide how to use it.`,
      error: `Connected to "${s.folderName}", but the last save failed: ${s.message}`,
    }[s.state] ?? `Connected to "${s.folderName}".`;
    body.push(
      el('p', { text: statusLine }),
      el('div', { class: 'row' }, [
        s.state === 'reconnect' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Reconnect', 'data-field': 'drive-reconnect', on: { click: () => ctx.sync.reconnect() } }) : null,
        s.state === 'decision' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Choose', title: 'Choose what to keep', on: { click: () => openConflicts(ctx) } }) : null,
        s.state === 'first-connect' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Decide', on: { click: () => openFirstConnect(ctx) } }) : null,
        s.state !== 'reconnect' ? el('button', { class: 'btn', type: 'button', text: 'Save now', 'data-field': 'drive-save-now', on: { click: () => ctx.sync.run() } }) : null,
        el('button', {
          class: 'btn btn-quiet', type: 'button', text: 'Disconnect', title: 'Stop using this folder',
          on: {
            click: async () => {
              if (!await confirmAction({ title: 'Stop using the Drive folder?', text: 'Nothing is deleted. The folder keeps everything; this device keeps its own copy and stops saving to Drive.', confirmLabel: 'Disconnect' })) return;
              ctx.sync.disconnect({ keepCopy: true });
            },
          },
        }),
      ]),
    );
    body.push(
      el('h3', { text: 'Phones' }),
      el('p', { class: 'small', text: `Phones cannot link to the folder, so this laptop keeps one file up to date for them: FamilyHub › ${PHONE_DIR} › "${PHONE_FILE}". A phone sends its changes back into that ${PHONE_DIR} folder, and this laptop adds them in by itself while Family Hub is open. Nothing to do here.` }),
      backupsBlock(ctx),
    );
  } else if (supported) {
    body.push(
      el('p', { text: 'Keep your family’s data in your own Google Drive, so it is never lost and every laptop you sign in on sees the same thing. Nobody else - including whoever made this app - can see it.' }),
      el('ol', { class: 'howto-steps' }, [
        el('li', { text: 'Install Google Drive for Desktop (free, from Google) and sign in. Your Drive appears as a folder on this computer.' }),
        el('li', { text: 'Press "Choose my Drive folder" and pick a folder in your Drive - for example "My Drive". Family Hub makes a "FamilyHub" folder inside it.' }),
        el('li', { text: 'Allow access when the browser asks. That is all - from then on everything saves there automatically.' }),
      ]),
      privateTestMode() ? el('p', { class: 'small muted', text: 'Test mode: this uses the browser’s private storage instead of a real Drive folder.' }) : null,
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Choose folder', 'data-field': 'drive-connect', on: { click: () => ctx.sync.connect() } }),
    );
  } else {
    // A phone: swap one file with the Drive folder; a laptop with Family Hub open does the rest.
    const d = ctx.app.device;
    body.push(
      el('p', { text: 'A phone cannot link to your Drive folder like a laptop does, so it swaps one file with it. Your data stays on this phone in between.' }),
      el('div', { class: 'stack' }, [
        el('h3', { text: 'Get the latest', style: { margin: 0 } }),
        el('p', { class: 'small', style: { margin: 0 }, text: `In the window that opens, go to Google Drive › FamilyHub › ${PHONE_DIR} and choose "${PHONE_FILE}". Laptops with Family Hub keep it up to date.` }),
        el('div', {}, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Get latest', 'data-field': 'phone-get', on: { click: () => openFamilyFile(ctx) } })]),
        d.fileOpenedAt ? el('p', { class: 'small muted', style: { margin: 0 }, text: `Last got the latest on ${when(d.fileOpenedAt)}.` }) : null,
      ]),
      el('div', { class: 'stack' }, [
        el('h3', { text: 'Send your changes back', style: { margin: 0 } }),
        el('p', { class: 'small', style: { margin: 0 }, text: `Choose Drive, then save into the FamilyHub › ${PHONE_DIR} folder. A laptop adds your changes in the next time Family Hub is open on it.` }),
        el('div', {}, [el('button', { class: 'btn', type: 'button', text: 'Send back', 'data-field': 'phone-send', on: { click: () => saveFamilyFile(ctx) } })]),
        d.fileSavedAt ? el('p', { class: 'small muted', style: { margin: 0 }, text: `Last sent back on ${when(d.fileSavedAt)}.` }) : null,
      ]),
      el('p', { class: 'small muted', text: 'Not set up on a laptop yet? Do that first: on a computer, Settings › Google Drive › Choose folder.' }),
    );
    return el('div', { class: 'panel stack', id: 'set-drive' }, body);
  }

  body.push(
    el('h3', { text: 'Family file' }),
    el('p', { class: 'small', text: 'One file with everything: the household and every mini-app’s records. Use it on a phone to save to or open from Google Drive, to move between devices, or as a backup you keep.' }),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Save file', title: ctx.folderSupported() ? 'Save a family file' : 'Save a family file to your Drive', 'data-field': 'file-save', on: { click: () => saveFamilyFile(ctx) } }),
      el('button', { class: 'btn', type: 'button', text: 'Open file', title: ctx.folderSupported() ? 'Open a family file' : 'Open a family file from your Drive', 'data-field': 'file-open', on: { click: () => openFamilyFile(ctx) } }),
    ]),
    ctx.app.device.fileSavedAt ? el('p', { class: 'small muted', text: `Last saved a family file on ${new Date(ctx.app.device.fileSavedAt).toLocaleString()}.` }) : null,
  );
  return el('div', { class: 'panel stack', id: 'set-drive' }, body);
}

function backupsBlock(ctx) {
  const list = el('div', { class: 'stack' });
  const fill = async () => {
    const names = await ctx.sync.listBackups().catch(() => []);
    list.replaceChildren(...(names.length
      ? [el('ul', { class: 'list' }, names.slice(0, 10).map((n) => el('li', {}, [
        el('span', { class: 'list__main small', text: n.replace(/^backup-|\.json$/g, '') }),
        el('button', {
          class: 'btn btn-small', type: 'button', text: 'Restore…',
          on: {
            click: async () => {
              const parsed = await ctx.sync.readBackup(n);
              if (!parsed.ok) { ctx.flash({ id: `bk:${n}`, level: 'error', text: `That backup could not be read: ${parsed.errors.join(' ')}` }); ctx.render(); return; }
              if (!await confirmAction({ title: 'Restore this backup?', text: [describeFamilyFile(parsed), 'The household is replaced by the backup; mini-app records are combined (newer copies win). Make a fresh backup first if unsure.'], confirmLabel: 'Restore', danger: true })) return;
              await ctx.sync.importFamilyFile(parsed, 'replace');
            },
          },
        }),
      ])))]
      : [el('p', { class: 'small muted', text: 'No backups yet.' })]));
  };
  fill();
  return el('div', { class: 'stack' }, [
    el('h3', { text: 'Backups' }),
    el('p', { class: 'small', text: 'A backup is a complete copy saved in the folder’s Backups/ folder. Google Drive also keeps earlier versions of each file (right-click a file in Drive › Manage versions).' }),
    el('div', {}, [el('button', {
      class: 'btn', type: 'button', text: 'Back up', 'data-field': 'backup-now',
      on: { click: async () => { try { const n = await ctx.sync.backupNow(); ctx.flash({ id: `bk:${n}`, level: 'ok', text: `Backup saved: Backups/${n}` }); fill(); ctx.render(); } catch (err) { ctx.flash({ id: 'bk:err', level: 'error', text: err.message }); ctx.render(); } } },
    })]),
    list,
  ]);
}
