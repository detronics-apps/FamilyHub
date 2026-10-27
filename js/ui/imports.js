// Bringing in data from spreadsheets: from Settings (with a summary to
// confirm first), or by dropping filled-in templates into the Import folder of
// the family's Drive folder, which is picked up after each save.
//
// Import/                 drop filled-in .csv files here
// Import/Templates/       one empty template per kind, with an example row
// Import/Imported/        files that were brought in, with a short report
// Import/Not imported/    files Family Hub could not use, with the reason

import { el, download } from './dom.js';
import { modal } from './common.js';
import { STARTERS } from '../apps/catalogue.js';
import { templateCSV, templateName, planImport, detectImporter, describeImport } from '../importer.js';
import { parseCSV, toObjects } from '../csv.js';
import { addChore, addRoom } from '../model.js';

export const IMPORT_DIR = 'Import';

/** The templates of the installed (and enabled) mini-apps that accept imports. */
export async function availableImporters(ctx) {
  const out = [];
  for (const s of STARTERS) {
    const a = ctx.app.registry.apps[s.manifest.id];
    if (!s.importer || !a || !a.enabled) continue;
    try { out.push(await s.importer()); } catch { /* an app whose importer fails to load is simply not offered */ }
  }
  return out;
}

async function existingKeys(ctx, imp) {
  if (imp.household) return new Set(ctx.app.household.chores.map((c) => imp.key(c)));
  const col = ctx.collectionFor(imp.app, imp.collection, { summary: imp.summary, text: imp.text, prefix: imp.prefix });
  const { items } = await col.list({ limit: 1e7 });
  return new Set(items.map((s) => String(s.title ?? '').trim().toLowerCase()));
}

/** Add the planned rows. Chores go into the household (creating rooms by name); the rest into the app's records. */
async function apply(ctx, imp, plan) {
  if (!plan.add.length) return;
  if (imp.household) {
    let h = ctx.app.household;
    for (const { record } of plan.add) {
      let roomId = null;
      if (record.room) {
        const found = h.rooms.find((r) => r.name.toLowerCase() === record.room.toLowerCase());
        if (found) roomId = found.id;
        else { const res = addRoom(h, record.room); h = res.household; roomId = res.room.id; }
      }
      const { room, ...fields } = record;
      h = addChore(h, { ...fields, roomId, startDay: ctx.today() }).household;
    }
    ctx.commit(h, { quiet: true });
  } else {
    const col = ctx.collectionFor(imp.app, imp.collection, { summary: imp.summary, text: imp.text, prefix: imp.prefix });
    for (const { record } of plan.add) await col.put(record);
  }
  ctx.invalidateAll();
}

/** Read a file, work out what it is, and what importing it would do. */
export async function prepare(ctx, fileName, text) {
  const importers = await availableImporters(ctx);
  const headers = toObjects(parseCSV(text)).headers;
  const imp = detectImporter(fileName, headers, importers);
  if (!imp) return { imp: null, reason: `Family Hub could not tell what "${fileName}" holds. Start from one of the templates (${importers.map((i) => i.label.toLowerCase()).join(', ')}), keep its first row, and include the kind in the file name - e.g. "recipes.csv".` };
  return { imp, plan: planImport(imp, text, await existingKeys(ctx, imp)) };
}

/** Settings: choose a file, see what it holds, then bring it in. */
export function importFromDevice(ctx) {
  const input = el('input', { type: 'file', accept: '.csv,text/csv', hidden: true });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    const { imp, plan, reason } = await prepare(ctx, file.name, await file.text());
    if (!imp) { ctx.flash({ id: `imp:${file.name}`, level: 'error', text: reason }); ctx.render(); return; }
    const { close } = modal({
      title: `Bring in ${imp.label.toLowerCase()}?`,
      body: [
        el('p', { text: describeImport(imp, plan, file.name) }),
        plan.add.length ? el('details', { class: 'more' }, [el('summary', { text: `The ${plan.add.length} new ones` }), el('ul', {}, plan.add.slice(0, 50).map((x) => el('li', { text: x.record.title ?? x.record.name })))]) : null,
        plan.errors.length ? el('details', { class: 'more' }, [el('summary', { text: 'Lines with a problem (left out)' }), el('ul', {}, plan.errors.map((e) => el('li', { text: `Line ${e.line}: ${e.message}` })))]) : null,
        el('p', { class: 'small muted', text: 'Ones that are already there (same name) are left as they are, so importing the same file twice adds nothing.' }),
      ],
      foot: [
        el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
        el('button', {
          class: 'btn btn-primary', type: 'button', text: plan.add.length ? `Add ${plan.add.length}` : 'Nothing new', disabled: !plan.add.length, 'data-field': 'import-confirm',
          on: { click: async () => { close(); await apply(ctx, imp, plan); ctx.flash({ id: `imp-ok:${Date.now()}`, level: 'ok', text: `Brought in ${plan.add.length} ${plan.add.length === 1 ? imp.singular : imp.label.toLowerCase()}.` }); ctx.render(); } },
        }),
      ],
    });
  });
  document.body.append(input);
  input.click();
}

export function downloadTemplate(imp) {
  download(new Blob([`﻿${templateCSV(imp)}`], { type: 'text/csv' }), templateName(imp));
}

const README = (importers) => `Bring data into Family Hub

1. Open the template you need in Templates/ (or download it in Family Hub: Settings, Bring in data).
2. Fill it in with a spreadsheet - Excel, Google Sheets, Numbers. Keep the first row as it is.
   Columns marked * are needed; the rest are optional.
3. Save it as CSV, with the kind in the name (for example "recipes.csv"), into this Import folder.

Family Hub picks it up the next time it saves or you come back to it, adds what is new,
and moves the file to Imported/ with a short report. Rows whose name already exists are
left alone, so the same file twice adds nothing.

Templates available: ${importers.map((i) => i.label).join(', ')}.
`;

const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.');

/**
 * Pick up files dropped into the Import folder (folder mode only). Each file is
 * brought in and moved away, with a report beside it. Returns what happened.
 */
export async function scanImportFolder(ctx) {
  const store = ctx.sync.appStore();
  if (!store || store.kind !== 'folder') return [];
  const importers = await availableImporters(ctx);
  // Keep the templates and the instructions in the folder, so it explains itself.
  if ((await store.read(`${IMPORT_DIR}/README.txt`)) !== README(importers)) await store.write(`${IMPORT_DIR}/README.txt`, README(importers));
  for (const imp of importers) {
    const path = `${IMPORT_DIR}/Templates/${templateName(imp)}`;
    const text = `﻿${templateCSV(imp)}`;
    if ((await store.read(path)) !== text) await store.write(path, text);
  }

  const files = ((await store.list(IMPORT_DIR)) ?? []).filter((e) => e.kind === 'file' && /\.csv$/i.test(e.name));
  const reports = [];
  for (const f of files) {
    const path = `${IMPORT_DIR}/${f.name}`;
    const text = await store.read(path);
    if (text == null) continue;
    const { imp, plan, reason } = await prepare(ctx, f.name, text);
    const dest = imp && plan.add.length + plan.matched.length > 0 ? 'Imported' : 'Not imported';
    let report = reason;
    if (imp) {
      await apply(ctx, imp, plan);
      report = describeImport(imp, plan, f.name);
      if (plan.errors.length) report += `\n\nLines left out:\n${plan.errors.map((e) => `  line ${e.line}: ${e.message}`).join('\n')}`;
    }
    const name = `${stamp()} ${f.name}`;
    await store.write(`${IMPORT_DIR}/${dest}/${name}`, text);
    await store.write(`${IMPORT_DIR}/${dest}/${name}.txt`, `${report}\n`);
    await store.remove(path);
    reports.push({ file: f.name, ok: dest === 'Imported', text: report.split('\n')[0] });
  }
  for (const r of reports) ctx.flash({ id: `inbox:${r.file}:${Date.now()}`, level: r.ok ? 'ok' : 'warn', text: `From your Import folder - ${r.text}` });
  if (reports.length) ctx.render();
  return reports;
}
