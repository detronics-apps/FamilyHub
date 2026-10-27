// How to use: one search over how-tos and FAQs, then features worth knowing.

import { el, clear } from '../dom.js';
import { HOWTOS, FAQS, FEATURES, guideMatches } from '../../guide.js';
import { openWelcome } from './welcome.js';

export function helpView(ctx) {
  const results = el('div', { class: 'stack' });
  const search = el('input', {
    class: 'input', id: 'help-q', type: 'search', 'data-field': 'help-q', placeholder: 'Try "backup", "five minutes", "postpone"...',
    value: ctx.app.ui.helpQuery ?? '',
    // Only the results are redrawn while typing, so the box keeps focus and caret.
    on: { input: (e) => { ctx.app.ui.helpQuery = e.target.value; fill(); } },
  });

  function fill() {
    const q = ctx.app.ui.helpQuery ?? '';
    const howtos = HOWTOS.filter((h) => guideMatches(`${h.title} ${h.steps.join(' ')}`, q));
    const faqs = FAQS.filter((f) => guideMatches(`${f.q} ${f.a}`, q));
    clear(results).append(
      el('div', { class: 'panel' }, [
        el('h2', { text: 'How do I...' }),
        howtos.length ? el('div', {}, howtos.map((h) => el('details', { class: 'more', open: !!q.trim() }, [
          el('summary', { text: h.title }),
          el('ol', { class: 'howto-steps' }, h.steps.map((s) => el('li', { text: s }))),
        ]))) : el('p', { class: 'muted', text: 'No how-to matches that.' }),
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
    el('div', { class: 'panel stack' }, [
      el('label', { class: 'field__label', for: 'help-q', text: 'Search in your own words' }),
      search,
    ]),
    results,
    el('div', { class: 'panel' }, [
      el('h2', { text: 'The ideas behind it' }),
      el('div', { class: 'stats' }, [
        idea('Capture quickly, think later', 'Common actions take seconds. Detail is there when you want it.'),
        idea('Missed is information', 'A missed chore says something about the week or the plan - it never piles onto tomorrow.'),
        idea('Your view, shared records', 'The household’s chores are shared; each person arranges their own dashboard.'),
        idea('Estimates are estimates', 'Times and effort are rough guesses, labelled as such.'),
      ]),
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
