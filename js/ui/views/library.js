// Mini-apps: what is installed, what is kept from earlier installs, what was
// found in the Drive folder, and what is still to come.
//   Hide        -> Settings > Your dashboard (still installed, still running)
//   Turn off    -> not loaded at all; data kept
//   Uninstall   -> removed; data kept in the folder for a reinstall
//   Delete data -> separate, confirmed, after uninstalling

import { el } from '../dom.js';
import { modal, confirmAction } from '../common.js';
import { install, update, uninstall, setEnabled, forgetRetained, permissionInfo, retainedDataCheck } from '../../miniapps.js';
import { STARTERS, starter, COMING_LATER } from '../../apps/catalogue.js';
import { discover, forgetPackage } from '../packages.js';
import { clearLoadError } from '../sandbox.js';
import { SECTIONS, section, sectionOf, appsIn } from '../../sections.js';

let found = null;          // last discovery result
let scanning = false;

async function scan(ctx) {
  const store = ctx.sync.appStore();
  if (!store || store.kind !== 'folder') { found = null; return; }
  scanning = true;
  ctx.render();
  try { found = await discover(store, ctx.app.registry); } catch (err) { found = { error: err.message }; }
  scanning = false;
  ctx.render();
}

const SOURCE = { starter: 'Comes with Family Hub', folder: 'From your Drive folder' };

export function libraryView(ctx) {
  const reg = ctx.app.registry;
  const order = (id) => SECTIONS.findIndex((x) => x.id === sectionOf(ctx.manifestFor(id)));
  const installed = Object.entries(reg.apps).sort(([a], [b]) => order(a) - order(b));
  const retained = Object.entries(reg.retained);
  const folderMode = ctx.sync.appStore()?.kind === 'folder';
  if (folderMode && found === null && !scanning) scan(ctx);

  return el('section', { class: 'stack', 'aria-labelledby': 'lib-title' }, [
    el('h1', { id: 'lib-title', text: 'Mini-apps' }),
    el('p', { class: 'muted', text: 'Each section of Family Hub - Meals, Chores, Finance and the rest - is made of mini-apps. Turn them off, remove them or add new ones - removing one never deletes its records unless you separately ask.' }),

    el('div', { class: 'panel' }, [
      el('h2', { text: 'Installed' }),
      installed.length ? el('ul', { class: 'list' }, installed.map(([id, a]) => el('li', {}, [
        el('div', { class: 'list__main' }, [
          el('strong', { text: a.name }), ' ',
          el('span', { class: `badge${a.enabled ? ' badge--ok' : ''}`, text: a.enabled ? 'On' : 'Off' }),
          el('div', { class: 'small muted', text: `${section(sectionOf(ctx.manifestFor(id)))?.name ?? 'More'} · ${SOURCE[a.source]} · version ${a.version}` }),
          a.source === 'folder' ? el('div', { class: 'small muted', text: `Allowed to: ${a.granted.map((p) => permissionInfo(p)?.label.toLowerCase()).join('; ')}` }) : null,
        ]),
        el('button', {
          class: 'btn btn-small', type: 'button', text: a.enabled ? 'Turn off' : 'Turn on', 'data-field': `toggle:${id}`,
          on: { click: () => ctx.saveRegistry(setEnabled(reg, id, !a.enabled)) },
        }),
        el('button', {
          class: 'btn btn-small', type: 'button', text: 'Uninstall', 'data-field': `uninstall:${id}`,
          on: {
            click: async () => {
              const ok = await confirmAction({
                title: `Uninstall ${a.name}?`,
                text: [`${a.name} will be removed from Family Hub. Its records stay in your folder${id === 'chores' ? ' (the chores and their history in your household)' : ` (Data/${id})`}, and come back if you reinstall it.`, 'To only take it off your home screen, hide it in Settings instead.'],
                confirmLabel: 'Uninstall',
              });
              if (!ok) return;
              forgetPackage(id);
              ctx.saveRegistry(uninstall(reg, id));
            },
          },
        }),
      ]))) : el('p', { class: 'muted', text: 'No mini-apps installed.' }),
      el('p', { class: 'small' }, ['To only hide one from your home screen, use ', el('a', { href: '#/settings/dashboard', text: 'Settings › Your dashboard' }), '.']),
    ]),

    retained.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Uninstalled, records kept' }),
      el('ul', { class: 'list' }, retained.map(([id, r]) => {
        const st = starter(id);
        const pkg = found && !found.error ? found.find((f) => f.manifest?.id === id && f.ok) : null;
        const manifest = st?.manifest ?? pkg?.manifest ?? null;
        const check = manifest ? retainedDataCheck(r, manifest) : null;
        return el('li', {}, [
          el('div', { class: 'list__main' }, [
            el('strong', { text: r.name }),
            el('div', { class: 'small muted', text: `Uninstalled ${r.uninstalledAt ? new Date(r.uninstalledAt).toLocaleDateString() : ''} · records kept` }),
            check && !check.ok ? el('div', { class: 'small', text: check.problems.join(' ') }) : null,
          ]),
          manifest ? el('button', {
            class: 'btn btn-small', type: 'button', text: 'Reinstall', 'data-field': `reinstall:${id}`, disabled: check && !check.ok,
            on: { click: () => (st ? doInstall(ctx, st.manifest, { source: 'starter' }) : reviewInstall(ctx, pkg)) },
          }) : el('span', { class: 'small muted', text: 'Package not found in your folder' }),
          el('button', {
            class: 'btn btn-small btn-danger', type: 'button', text: 'Delete records',
            on: { click: () => deleteData(ctx, id, r.name) },
          }),
        ]);
      })),
    ]) : null,

    el('div', { class: 'panel' }, [
      el('h2', { text: 'Come with Family Hub, by section' }),
      ...SECTIONS.map((sec) => {
        const apps = appsIn(sec.id, STARTERS.map((x) => x.manifest));
        return apps.length ? [el('h3', { text: sec.name }), el('ul', { class: 'list' }, apps.map((m) => el('li', {}, [
          el('div', { class: 'list__main' }, [el('strong', { text: m.name }), el('div', { class: 'small muted', text: m.description })]),
          reg.apps[m.id] ? el('span', { class: 'badge badge--ok', text: 'Installed' })
            : reg.retained[m.id] ? el('span', { class: 'small muted', text: 'Uninstalled - see above' })
              : el('button', { class: 'btn btn-small', type: 'button', text: 'Install', 'data-field': `install:${m.id}`, on: { click: () => doInstall(ctx, m, { source: 'starter' }) } }),
        ])))] : [];
      }).flat(),
    ]),

    folderPanel(ctx, folderMode),

    el('div', { class: 'panel panel--soft' }, [
      el('h2', { text: 'Coming later' }),
      el('p', { class: 'small muted', text: 'Planned, not built yet. They will appear here as installable mini-apps.' }),
      el('ul', { class: 'list' }, COMING_LATER.map((p) => el('li', {}, [el('div', { class: 'list__main' }, [el('strong', { text: p.name }), el('div', { class: 'small muted', text: p.purpose })])]))),
    ]),
    el('p', { class: 'small' }, ['Building your own? ', el('a', { href: 'MINIAPPS.md', target: '_blank', rel: 'noopener', text: 'The mini-app developer guide' }), ' explains the package format and the hub interface.']),
  ]);
}

function folderPanel(ctx, folderMode) {
  if (!folderMode) {
    return el('div', { class: 'panel' }, [
      el('h2', { text: 'From your Drive folder' }),
      el('p', { class: 'small muted', text: 'Mini-apps made by others are added by copying their folder into your Drive folder’s MiniApps/ThirdParty. Connect your Drive folder in Settings to use them.' }),
      el('a', { class: 'btn btn-small', href: '#/settings/drive', text: 'Connect Drive' }),
    ]);
  }
  const STATUS = { new: 'Not installed', installed: 'Installed', update: 'Update available', changed: 'Changed since you approved it', invalid: 'Cannot be used' };
  return el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h2', { text: 'From your Drive folder', style: { margin: 0, flex: '1 1 auto' } }),
      el('button', { class: 'btn btn-small', type: 'button', text: scanning ? 'Looking…' : 'Look again', disabled: scanning, 'data-field': 'scan', on: { click: () => scan(ctx) } }),
    ]),
    el('p', { class: 'small muted', text: 'Copy a mini-app’s folder into MiniApps/ThirdParty in your Drive folder. Nothing in it runs until you review it here and press Install.' }),
    found?.error ? el('p', { class: 'small', text: found.error }) : null,
    found && !found.error ? (found.length ? el('ul', { class: 'list' }, found.map((f) => el('li', {}, [
      el('div', { class: 'list__main' }, [
        el('strong', { text: f.manifest?.name ?? f.folder }),
        f.manifest ? el('span', { class: 'small muted', text: ` ${f.manifest.version}${f.manifest.author ? ` by ${f.manifest.author}` : ''}` }) : null,
        el('div', { class: 'small', text: STATUS[f.status] }),
        f.errors.length ? el('div', { class: 'small muted', text: f.errors.slice(0, 3).join(' ') }) : null,
      ]),
      f.status === 'new' ? el('button', { class: 'btn btn-small', type: 'button', text: 'Review', 'data-field': `review:${f.manifest.id}`, on: { click: () => reviewInstall(ctx, f) } }) : null,
      f.status === 'update' || f.status === 'changed' ? el('button', { class: 'btn btn-small', type: 'button', text: 'Review', on: { click: () => reviewInstall(ctx, f, { updating: true }) } }) : null,
    ]))) : el('p', { class: 'small muted', text: 'Nothing found in MiniApps/ThirdParty yet.' })) : null,
  ]);
}

export function doInstall(ctx, manifest, { source, codeHash = null, packagePath = null } = {}) {
  try {
    const { registry, recovered } = install(ctx.app.registry, manifest, { granted: manifest.permissions, source, codeHash, packagePath });
    ctx.flash({ id: `inst:${manifest.id}`, level: 'ok', text: `${manifest.name} is installed${recovered ? ', with the records kept from before' : ''}.` });
    ctx.saveRegistry(registry);
  } catch (err) {
    ctx.flash({ id: `inst-err:${manifest.id}`, level: 'error', text: err.message });
    ctx.render();
  }
}

/** The install (or update) screen for someone else's code: what it is, what it may do, and a plain warning. */
function reviewInstall(ctx, pkg, { updating = false } = {}) {
  const m = pkg.manifest;
  const cur = ctx.app.registry.apps[m.id];
  const trust = el('input', { type: 'checkbox', id: 'trust', 'data-field': 'trust' });
  const err = el('p', { class: 'small', role: 'alert', style: { color: 'var(--danger)' } });
  const perms = m.permissions.map((p) => {
    const info = permissionInfo(p);
    const isNew = updating && cur && !cur.granted.includes(p);
    return el('li', {}, [info.label, isNew ? ' (new)' : '', info.risk === 'high' ? ' — sensitive' : '']);
  });
  const { close } = modal({
    title: `${updating ? 'Update' : 'Install'} ${m.name}?`,
    body: [
      el('p', { text: `${m.name} ${m.version}${m.author ? ` by ${m.author}` : ''}. ${m.description}` }),
      el('p', { class: 'small muted', text: `From ${pkg.path} in your Drive folder.` }),
      el('h3', { text: 'It asks to' }),
      perms.length ? el('ul', {}, perms) : el('p', { class: 'small', text: 'Nothing beyond showing its own screen.' }),
      el('div', { class: 'banner banner--warn' }, [el('span', { class: 'banner__text', text: 'This is someone else’s code. Family Hub runs it in a sealed space with no internet access and only the permissions above, but anything it is allowed to see, it could show or misuse. Only install mini-apps from people you trust.' })]),
      el('label', { class: 'checkline', for: 'trust' }, [trust, 'I trust whoever made this']),
      err,
    ],
    foot: [
      el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
      el('button', {
        class: 'btn btn-primary', type: 'button', text: updating ? 'Update' : 'Install', 'data-field': 'install-confirm',
        on: {
          click: () => {
            if (!trust.checked) { err.textContent = 'Tick the box to confirm you trust it - or cancel.'; return; }
            close();
            if (!updating) { doInstall(ctx, m, { source: 'folder', codeHash: pkg.hash, packagePath: pkg.path }); return; }
            try {
              let registry;
              if (cur.version === m.version) registry = { ...ctx.app.registry, apps: { ...ctx.app.registry.apps, [m.id]: { ...cur, codeHash: pkg.hash } } };
              else registry = update(ctx.app.registry, m, { granted: m.permissions, codeHash: pkg.hash }).registry;
              forgetPackage(m.id);
              clearLoadError(m.id);
              ctx.flash({ id: `upd:${m.id}`, level: 'ok', text: `${m.name} is updated.` });
              ctx.saveRegistry(registry);
              found = null;
            } catch (e) {
              ctx.flash({ id: `upd-err:${m.id}`, level: 'error', text: e.message });
              ctx.render();
            }
          },
        },
      }),
    ],
  });
}

async function deleteData(ctx, id, name) {
  const ok = await confirmAction({
    title: `Delete ${name}’s records?`,
    text: [`This permanently removes everything ${name} kept${id === 'chores' ? ' - every chore and its history' : ` - the Data/${id} folder`}. If the folder is in Google Drive, the files go to Drive’s bin, where they can be recovered for a while.`, 'Make a backup first if you might want them.'],
    confirmLabel: 'Delete records',
    danger: true,
  });
  if (!ok) return;
  try {
    if (id === 'chores') {
      ctx.commit({ ...ctx.app.household, chores: [], events: [] }, { quiet: true });
    } else {
      const store = ctx.sync.appStore();
      if (!store) throw new Error('Reconnect your Drive folder first.');
      await store.remove(`Data/${id}`);
    }
    ctx.flash({ id: `del:${id}`, level: 'ok', text: `${name}’s records were deleted.` });
    ctx.saveRegistry(forgetRetained(ctx.app.registry, id));
  } catch (err) {
    ctx.flash({ id: `del-err:${id}`, level: 'error', text: err.message });
    ctx.render();
  }
}
