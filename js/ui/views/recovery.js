// Shown when the saved household cannot be read. Nothing is overwritten
// until the person chooses what to do, and the damaged data can be kept.

import { el, download } from '../dom.js';
import { confirmAction } from '../common.js';
import { KEYS } from '../../storage.js';
import { emptyHousehold } from '../../model.js';

export function recoveryView(ctx) {
  const { error, previousAvailable } = ctx.app.loadError;
  const done = (household) => { ctx.app.loadError = null; ctx.commit(household); };
  // Each way out: a short button, and what it does beside it.
  const option = (button, hint) => el('div', { class: 'row' }, [button, el('span', { class: 'small muted', text: hint })]);

  return el('section', { class: 'panel stack', role: 'alert' }, [
    el('h1', { text: 'Your saved household could not be opened' }),
    el('p', { text: error }),
    el('p', { text: 'Nothing has been changed or deleted. Choose what to do:' }),
    el('div', { class: 'stack' }, [
      previousAvailable ? option(el('button', {
        class: 'btn btn-primary', type: 'button', text: 'Restore',
        on: { click: () => { const r = ctx.store.restorePrevious(); if (r.ok) { ctx.app.loadError = null; ctx.app.household = r.household; ctx.render(); } } },
      }), 'Go back to the copy saved before the last change.') : null,
      option(el('button', {
        class: 'btn', type: 'button', text: 'Download',
        on: { click: () => download(new Blob([window.localStorage.getItem(KEYS.household) ?? ''], { type: 'application/json' }), 'family-hub-damaged.json') },
      }), 'The damaged data, to keep or to send to someone who can help.'),
      option(el('a', { class: 'btn', href: '#/settings', text: 'Import file', on: { click: () => { ctx.app.loadError = null; ctx.app.household = emptyHousehold(); } } }), 'Bring in a file you exported before.'),
      option(el('button', {
        class: 'btn btn-danger', type: 'button', text: 'Start again',
        on: {
          click: async () => {
            if (await confirmAction({ title: 'Start again?', text: 'The damaged data will be replaced. Download it first if you might want it.', confirmLabel: 'Start again', danger: true })) done(emptyHousehold());
          },
        },
      }), 'An empty household.'),
    ]),
  ]);
}
