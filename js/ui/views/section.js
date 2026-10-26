// One section of family life (Meals, Chores...): the mini-apps installed in it,
// and the ones that could be added. The section itself is never installed or
// removed - only the mini-apps inside it are.

import { el } from '../dom.js';
import { section, appsIn } from '../../sections.js';
import { setEnabled } from '../../miniapps.js';
import { STARTERS } from '../../apps/catalogue.js';
import { doInstall } from './library.js';

export function sectionView(ctx, route) {
  const s = section(route.sub);
  if (!s) return el('section', { class: 'panel empty' }, [el('h1', { text: 'Not found' }), el('a', { class: 'btn', href: '#/', text: 'Back to home' })]);
  const reg = ctx.app.registry;
  // Starter apps in the order they ship (most-used first), anything added after them.
  const rank = (m) => { const i = STARTERS.findIndex((x) => x.manifest.id === m.id); return i < 0 ? 999 : i; };
  const installed = appsIn(s.id, ctx.installedManifests()).sort((a, b) => rank(a) - rank(b));
  const offered = appsIn(s.id, STARTERS.map((x) => x.manifest)).filter((m) => !reg.apps[m.id]);

  return el('section', { class: 'stack', 'aria-labelledby': 'section-title' }, [
    el('h1', { id: 'section-title', text: s.name }),
    el('p', { class: 'muted', text: s.purpose }),
    installed.length
      ? el('nav', { class: 'tiles', 'aria-label': `${s.name} mini-apps` }, installed.map((m) => {
        const on = reg.apps[m.id].enabled;
        return on
          ? el('a', { class: 'tile', href: `#/${m.id}`, 'data-field': `app:${m.id}` }, [
            el('span', { class: 'tile__name', text: m.name }),
            el('span', { class: 'tile__purpose', text: m.description }),
          ])
          : el('div', { class: 'tile tile--off' }, [
            el('span', { class: 'tile__name' }, [m.name, ' ', el('span', { class: 'badge', text: 'Off' })]),
            el('span', { class: 'tile__purpose', text: m.description }),
            el('button', { class: 'btn btn-small', type: 'button', text: 'Turn on', on: { click: () => ctx.saveRegistry(setEnabled(reg, m.id, true)) } }),
          ]);
      }))
      : el('p', { class: 'panel', text: `No mini-apps are installed in ${s.name} yet.` }),
    offered.length ? el('div', { class: 'panel' }, [
      el('h2', { text: `Add to ${s.name}` }),
      el('ul', { class: 'list' }, offered.map((m) => el('li', {}, [
        el('div', { class: 'list__main' }, [el('strong', { text: m.name }), el('div', { class: 'small muted', text: m.description })]),
        reg.retained[m.id]
          ? el('button', { class: 'btn btn-small', type: 'button', text: 'Reinstall', on: { click: () => doInstall(ctx, m, { source: 'starter' }) } })
          : el('button', { class: 'btn btn-small', type: 'button', text: 'Install', 'data-field': `install:${m.id}`, on: { click: () => doInstall(ctx, m, { source: 'starter' }) } }),
      ]))),
    ]) : null,
    el('p', { class: 'small' }, ['To turn a mini-app off or remove it, use ', el('a', { href: '#/library', text: 'Mini-apps' }), '. Its records are kept unless you separately delete them.']),
  ]);
}
