// Home: large module buttons in this person's own order.

import { el } from '../dom.js';
import { resolveDashboard } from '../../dashboard.js';
import { findTasks } from '../../matching.js';
import { hasDemo } from '../../model.js';
import { demoNotice } from '../common.js';

export const prefsKey = (ctx) => ctx.currentPerson()?.id ?? 'anyone';

export function dashboardView(ctx, route, notices) {
  const h = ctx.app.household;
  const person = ctx.currentPerson();
  if (hasDemo(h)) notices.push(demoNotice(ctx));
  const { visible, hidden } = resolveDashboard(ctx.app.device.prefs[prefsKey(ctx)], ctx.dashboardModules());
  const ready = findTasks(h, { personId: person?.id ?? null }, ctx.today()).filter((t) => t.occ.category !== 'optional').length;

  return el('section', { class: 'stack', 'aria-labelledby': 'home-title' }, [
    el('h1', { id: 'home-title', text: person ? `Hello, ${person.name}` : h.household.name }),
    el('p', { class: 'muted', text: 'Pick what you want to look at.' }),
    el('nav', { class: 'tiles', 'aria-label': 'Mini-apps' }, visible.map((m) => el('a', {
      class: `tile${m.id === 'library' || m.id === 'settings' ? ' tile--core' : ''}`,
      href: `#/${m.id}`,
      'data-field': `tile:${m.id}`,
    }, [
      el('span', { class: 'tile__name' }, [m.name, m.source === 'folder' ? el('span', { class: 'badge', text: 'Added' }) : null]),
      el('span', { class: 'tile__purpose', text: m.purpose }),
      m.id === 'chores'
        ? el('span', { class: 'tile__meta', text: ready ? `${ready} ready${person ? ' for you' : ''} now` : 'Nothing waiting right now' })
        : null,
    ]))),
    el('p', { class: 'small' }, [
      el('a', { href: '#/settings/dashboard', text: 'Rearrange or hide these buttons' }),
      hidden.length ? ` · ${hidden.length} hidden` : '',
    ]),
  ]);
}
