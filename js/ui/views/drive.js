// Everything a person sees about where their data is: the status in the
// header, the app-wide notices that need an answer, the conflict and
// first-connect questions, the Google Drive section of Settings, and the
// family file (phones, backups, moving between devices).

import { el, download } from '../dom.js';
import { modal, confirmAction } from '../common.js';
import { conflictKey } from '../../merge.js';
import { parseFamilyFile, describeFamilyFile, familyFileName } from '../../family-file.js';
import { fingerprint } from '../../folder-sync.js';
import { KEYS } from '../../storage.js';
import { roomName, personName } from '../../model.js';
import { privateTestMode } from '../sync.js';

const DAY_MS = 86400000;

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

  // A phone (no folder access) gets a gentle daily reminder to save to Drive.
  if (s.mode === 'device' && !ctx.folderSupported() && ctx.app.household.chores.length && fileDirty(ctx)) {
    const last = ctx.app.device.fileSavedAt ? Date.parse(ctx.app.device.fileSavedAt) : 0;
    if (Date.now() - last > DAY_MS) {
      out.push({ id: 'sync:phone-save', level: 'info', text: 'You have changes that are only on this phone. Save them to your Google Drive?', action: { label: 'Save file', onClick: () => saveFamilyFile(ctx) } });
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
  const text = await ctx.sync.familyFileText();
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
  ctx.flash({ id: `file:${Date.now()}`, level: 'ok', text: `Family file prepared (${name}). If you chose Drive, it is in your Drive now.` });
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
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Combine', 'data-field': 'file-merge', on: { click: async () => { close(); const r = await ctx.sync.importFamilyFile(parsed, 'merge'); if (r.conflicts) openConflicts(ctx); } } }),
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
  const body = [el('h2', { text: 'Google Drive' })];

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
    body.push(backupsBlock(ctx));
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
    body.push(
      el('p', { text: 'This browser cannot keep a live link to a Drive folder (phones and some browsers cannot). Your data is saved on this device. To keep it in Google Drive, save a family file there - and open the newest one when you switch devices.' }),
    );
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
