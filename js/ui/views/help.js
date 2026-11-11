// How to use: one search over how-tos and FAQs - or pick a how-to by group - then the ideas behind
// it, the time you have, and features worth knowing.

import { el, clear } from '../dom.js';
import { HOWTOS, FAQS, FEATURES, IDEAS, LANES, HOWTO_GROUPS, guideMatches } from '../../guide.js';
import { openWelcome } from './welcome.js';

export function helpView(ctx) {
  const results = el('div', { class: 'stack' });
  const search = el('input', {
    class: 'input', id: 'help-q', type: 'search', 'data-field': 'help-q', placeholder: 'Try "backup", "five minutes", "postpone"...',
    value: ctx.app.ui.helpQuery ?? '',
    // Only the results are redrawn while typing, so the box keeps focus and caret.
    on: { input: (e) => { ctx.app.ui.helpQuery = e.target.value; fill(); } },
  });

  // Without a search: pick one how-to by group, its steps below. With one: every match, opened.
  const byId = (id) => HOWTOS.find((h) => h.id === id);
  const steps = (h) => el('ol', { class: 'howto-steps' }, h.steps.map((s) => el('li', { text: s })));
  function picker() {
    const chosen = byId(ctx.app.ui.helpPick) ?? byId('quick');
    const select = el('select', { class: 'select', id: 'help-pick', 'data-field': 'help-pick', 'aria-label': 'Choose what you want to do',
      on: { change: (e) => { ctx.app.ui.helpPick = e.target.value; fill(); } } },
    HOWTO_GROUPS.map(([group, ids]) => el('optgroup', { label: group }, ids.map(byId).filter(Boolean).map((h) => el('option', { value: h.id, text: h.title, selected: h.id === chosen.id })))));
    return el('div', { class: 'stack', style: { gap: 'var(--space-2)' } }, [select, el('h3', { text: chosen.title, style: { margin: 0 } }), steps(chosen)]);
  }

  function fill() {
    const q = ctx.app.ui.helpQuery ?? '';
    const howtos = HOWTOS.filter((h) => guideMatches(`${h.title} ${h.steps.join(' ')}`, q));
    const faqs = FAQS.filter((f) => guideMatches(`${f.q} ${f.a}`, q));
    clear(results).append(
      el('div', { class: 'panel' }, [
        el('h2', { text: 'How do I...' }),
        !q.trim() ? picker()
          : howtos.length ? el('div', {}, howtos.map((h) => el('details', { class: 'more', open: true }, [el('summary', { text: h.title }), steps(h)])))
            : el('p', { class: 'muted', text: 'No how-to matches that.' }),
      ]),
      el('div', { class: 'panel' }, [
        el('h2', { text: 'Questions' }),
        faqs.length ? el('div', {}, faqs.map((f) => el('div', { class: 'faq' }, [el('div', { class: 'faq__q', text: f.q }), el('p', { text: f.a })])))
          : el('p', { class: 'muted', text: 'No question matches that. Try fewer or different words.' }),
      ]),
    );
  }
  fill();

  return el('section', { class: 'stack', 'aria-labelledby': 'help-title' }, [
    el('h1', { id: 'help-title', text: 'How to use Family Hub' }),
    el('p', { class: 'panel', 'data-field': 'help-connect' }, ['Setting up Google Drive, a phone, or the home screen? ', el('a', { href: '#/connect', text: 'All the steps for laptops and phones' }), ', and what can go wrong.']),
    el('div', { class: 'panel stack' }, [
      el('label', { class: 'field__label', for: 'help-q', text: 'Search in your own words' }),
      search,
    ]),
    results,
    el('div', { class: 'panel' }, [
      el('h2', { text: 'The ideas behind it' }),
      el('div', { class: 'stats' }, IDEAS.map((i) => idea(i.name, i.what))),
    ]),
    el('div', { class: 'panel', 'data-field': 'help-lanes' }, [
      el('h2', { text: 'The time you have' }),
      el('p', { class: 'small muted', text: 'Each section offers its ways in by the time you have - under its mini-apps, in "Extra help".' }),
      el('div', { class: 'stats' }, LANES.map((l) => el('div', { class: 'stat' }, [
        el('strong', { text: l.name }), el('div', { class: 'small muted', text: l.when }),
        el('ul', { class: 'small', style: { margin: 0, paddingLeft: '1.1em' } }, l.what.map((t) => el('li', { text: t }))),
      ]))),
    ]),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Features worth knowing' }),
      el('div', { class: 'stats' }, FEATURES.map((f) => idea(f.name, f.what, f.where))),
    ]),
    el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'button', text: 'Tour again', title: 'Show me around again', on: { click: () => openWelcome(ctx) } })]),
  ]);
}

const idea = (title, text, where) => el('div', { class: 'stat' }, [
  el('strong', { text: title }),
  where ? el('div', { class: 'small muted', text: where }) : null,
  el('div', { class: 'small', text }),
]);
