// First-run welcome: what this is, and three ways to start. Shown once
// (a stored timestamp), and again any time from "I am new here".

import { el } from '../dom.js';
import { modal } from '../common.js';
import { emptyHousehold, hasDemo } from '../../model.js';

export function openWelcome(ctx) {
  const h = ctx.app.household;
  const fresh = !h || (!h.people.length && !h.chores.length);
  const demoHere = !!h && hasDemo(h);
  const familyName = el('input', { class: 'input', id: 'w-family', placeholder: 'e.g. The Smiths', value: h && !fresh ? h.household.name : '', autocomplete: 'off' });
  const yourName = el('input', { class: 'input', id: 'w-you', placeholder: 'e.g. Jo', autocomplete: 'given-name' });

  const finish = (hash) => {
    ctx.setDevice({ onboardedAt: new Date().toISOString() });
    close();
    ctx.go(hash);
  };

  const steps = [
    el('li', {}, [el('div', {}, [
      el('strong', { text: demoHere ? 'Look around the example family' : 'Try it with an example family' }),
      el('span', { class: 'small muted', text: 'A pretend household with a kitchen, bathroom and living room, clearly labelled. Remove it with one button whenever you like.' }),
      el('div', {}, [el('button', {
        class: 'btn btn-primary', type: 'button', 'data-field': 'w-demo',
        text: demoHere ? 'Show me' : (fresh ? 'Load example' : 'Add example'), title: fresh ? 'Load the example family' : 'Add the example family alongside yours',
        on: { click: () => { if (!demoHere) ctx.seedDemo(); finish('#/chores'); } },
      })]),
    ])]),
    fresh ? el('li', {}, [el('div', {}, [
      el('strong', { text: 'Or start with your own household' }),
      el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'w-family', text: 'Household name' }), familyName]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'w-you', text: 'Your first name' }), yourName]),
      ]),
      el('span', { class: 'small muted', text: 'Both optional. You can add the rest of the family later in Settings.' }),
      el('div', {}, [el('button', {
        class: 'btn', type: 'button', text: 'Get started', 'data-field': 'w-own',
        on: { click: () => { ctx.startOwn(familyName.value || 'Our family', yourName.value); finish('#/chores/plan'); } },
      })]),
    ])]) : null,
    el('li', {}, [el('div', {}, [
      el('strong', { text: 'Keep it safe in your own Google Drive' }),
      el('span', { class: 'small muted', text: ctx.folderSupported()
        ? 'On a computer with Google Drive for Desktop, pick your Drive folder once and everything saves there - shared across your laptops, never lost with an update.'
        : 'On a phone, save a family file to your Drive now and then - Settings shows how.' }),
      el('div', {}, [el('button', { class: 'btn', type: 'button', text: 'Set up', on: { click: () => finish('#/settings/drive') } })]),
    ])]),
    el('li', {}, [el('div', {}, [
      el('strong', { text: 'Whenever you have a few minutes' }),
      el('span', { class: 'small', text: 'Open Chores. It starts on "Do something now": say how much time and energy you have, and it suggests something that fits. Do one, or more, or stop - all are fine.' }),
    ])]),
  ];

  const { close } = modal({
    title: 'Welcome to Family Hub',
    body: [
      el('p', { text: 'A calm place to share the everyday load of running a home. Capture quickly, think deeply later, and keep the useful outcome.' }),
      el('ol', { class: 'welcome-steps' }, steps),
      el('p', { class: 'small muted', text: 'Everything stays in this browser on this device. Nothing is uploaded.' }),
    ],
    foot: [el('a', { class: 'btn btn-quiet', href: '#/help', text: 'Read guide', on: { click: () => finish('#/help') } })],
    onClose: () => {
      ctx.setDevice({ onboardedAt: ctx.app.device.onboardedAt ?? new Date().toISOString() });
      if (!ctx.app.household) ctx.commit(emptyHousehold());
    },
  });
}
