// The questions to decide on a topic (D-106): each with what to think about, the options and
// their trade-offs, each parent's answer (the other's shown once you have given yours) - why,
// and what would change your mind - and Decide, which makes it a decision. And the fever plan,
// written by the two of you, with the warning signs to choose from.

import { el } from '../../ui/dom.js';
import { answersFor, setAnswer, adultsOf, normalisePlan, planText, rangeLabel, ageLabel, normaliseQuestions } from './logic.js';
import { FEVER_SIGNS } from './questions.js';

const decideHref = (id) => `#/decisions/new/${encodeURIComponent(`parenting:${id}`)}`;

// Topics whose questions are being changed, kept while the app is open.
const editing = new Set();

export function questionsPanel(hub, t, decisions, put) {
  if (editing.has(t.id)) return questionsEditor(hub, t, put);
  const me = hub.people.current()?.id ?? null;
  const adults = adultsOf(hub.people.list(), hub.today());
  const mine = decisions.filter((d) => d.topicId === t.id);
  const card = (q, i) => {
    const a = answersFor(t.record, q.id, adults, me);
    const decided = mine.find((d) => d.questionId === q.id && (d.hasAgreement || d.agreement));
    const pick = el('select', { class: 'select', 'aria-label': 'What I would choose', 'data-field': `q-pick:${q.id}`, style: { maxWidth: '360px' } },
      [el('option', { value: '', text: 'Not sure yet' }), ...q.options.map((o) => el('option', { value: o.name, text: o.name, selected: a.mine?.pick === o.name })), el('option', { value: 'Something else', text: 'Something else', selected: a.mine?.pick === 'Something else' })]);
    const pro = el('textarea', { class: 'input', rows: 2, placeholder: 'What draws me to it', 'aria-label': 'What draws me to it', text: a.mine?.pro ?? '', 'data-field': `q-pro:${q.id}` });
    const con = el('textarea', { class: 'input', rows: 2, placeholder: 'What worries me about it - or about the others', 'aria-label': 'What worries me', text: a.mine?.con ?? '', 'data-field': `q-con:${q.id}` });
    const why = el('textarea', { class: 'input', rows: 2, placeholder: 'Why I choose it', 'aria-label': 'Why', text: a.mine?.why ?? '', 'data-field': `q-why:${q.id}` });
    const change = el('input', { class: 'input', placeholder: 'What would change my mind', value: a.mine?.change ?? '', 'aria-label': 'What would change my mind', 'data-field': `q-change:${q.id}` });
    const differ = a.mine && a.others.some((o) => o.shown && o.shown.pick !== a.mine.pick);
    return el('div', { class: 'panel stack', 'data-field': `q:${q.id}`, style: { gap: '8px' } }, [
      el('h3', { text: `${i + 1}. ${q.ask}`, style: { margin: 0 } }),
      decided ? el('div', { class: 'done-panel', 'data-field': `q-decided:${q.id}` }, [el('strong', { text: 'We decided: ' }), el('a', { href: `#/decisions/item/${encodeURIComponent(decided.id)}`, text: decided.title })]) : null,
      q.options.length ? el('p', { class: 'small', style: { margin: 0 } }, [el('strong', { text: 'Have you considered: ' }), q.options.map((o) => o.name).join(' · ')]) : null,
      q.think.length ? el('ul', { class: 'small', style: { margin: 0, paddingLeft: '1.2em' } }, q.think.map((x) => el('li', { text: x }))) : null,
      me ? el('div', { class: 'stack', style: { gap: '6px' } }, [pick, pro, con, why, change,
        el('div', { class: 'row' }, [
          el('button', { class: 'btn btn-small', type: 'button', text: 'Save', 'data-field': `q-save:${q.id}`, on: { click: () => put({ answers: setAnswer(t.record, q.id, me, { pick: pick.value, pro: pro.value, con: con.value, why: why.value, change: change.value, at: new Date().toISOString() }) }) } }),
          hub.data.installed('decisions') ? el('a', { class: 'btn btn-small btn-primary', href: decideHref(`${t.id}:${q.id}`), text: decided ? 'Change' : 'Decide', 'data-field': `q-decide:${q.id}` }) : null,
        ])]) : el('p', { class: 'small muted', style: { margin: 0 }, text: 'Choose who you are at the top of the page to answer.' }),
      ...a.others.map((o) => el('p', { class: 'small', style: { margin: 0 } }, [el('strong', { text: `${o.name}: ` }), o.shown ? [o.shown.pick || 'Not sure yet', o.shown.pro ? `draws me: ${o.shown.pro}` : null, o.shown.con ? `worries me: ${o.shown.con}` : null, o.shown.why ? `why: ${o.shown.why}` : null, o.shown.change ? `would change: ${o.shown.change}` : null].filter(Boolean).join(' · ') : o.answered ? 'has answered - give yours to see it.' : 'not yet.'])),
      differ ? el('p', { class: 'small fin-worse', style: { margin: 0 }, text: 'You chose differently - talk it through, then Decide together.' }) : null,
    ]);
  };
  return el('div', { class: 'stack', 'data-field': 'q-list' }, [
    el('h2', { text: 'Decide together', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Decide now, with a clear head, so that on a tired night you can open this and follow what you agreed. The app only asks - the research, the reasons and the decision are yours.' }),
    ...t.questions.map(card),
    el('div', {}, [el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Change questions', 'data-field': 'q-edit', title: 'Add, change or remove questions and approaches', on: { click: () => { editing.add(t.id); hub.render(); } } })]),
  ]);
}

/** Change the questions themselves: what each asks, its approaches, what to consider - add and remove. */
function questionsEditor(hub, t, put) {
  const qs = t.questions.map((q) => ({ id: q.id, ask: q.ask, options: q.options.map((o) => o.name).join('\n'), think: q.think.join('\n') }));
  const box = el('div', { class: 'stack' });
  const draw = () => box.replaceChildren(...qs.map((q, i) => el('div', { class: 'panel stack', style: { gap: '6px' }, 'data-field': `qe:${i}` }, [
    el('input', { class: 'input', value: q.ask, placeholder: 'The question', 'aria-label': 'The question', on: { input: (e) => { q.ask = e.target.value; } } }),
    el('label', { class: 'stack', style: { gap: '2px' } }, [el('span', { class: 'small muted', text: 'Approaches to consider - one per line' }), el('textarea', { class: 'input', rows: 3, text: q.options, on: { input: (e) => { q.options = e.target.value; } } })]),
    el('label', { class: 'stack', style: { gap: '2px' } }, [el('span', { class: 'small muted', text: 'Things to ask yourselves - one per line' }), el('textarea', { class: 'input', rows: 2, text: q.think, on: { input: (e) => { q.think = e.target.value; } } })]),
    el('div', {}, [el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove question', 'data-field': `qe-remove:${i}`, on: { click: () => { qs.splice(i, 1); draw(); } } })]),
  ])));
  draw();
  const done = () => { editing.delete(t.id); hub.render(); };
  return el('div', { class: 'stack', 'data-field': 'q-editor' }, [
    el('h2', { text: 'Change the questions', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Make them yours: reword, add the approaches you are weighing, remove what does not apply.' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Add question', 'data-field': 'qe-add', on: { click: () => { qs.push({ id: `q-${Date.now().toString(36)}`, ask: '', options: '', think: '' }); draw(); } } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'qe-save', on: { click: async () => { await put({ questions: normaliseQuestions(qs.map((q) => ({ ...q, options: q.options.split('\n'), think: q.think.split('\n') }))) }); done(); } } }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Cancel', on: { click: done } }),
    ]),
  ]);
}

const AGES = [0, 3, 6, 12, 24, 36, 60, 96, 144, 216];

/** Our fever plan: per age band, steps by temperature, and when we go straight to a doctor. */
export function feverPlanPanel(hub, t, put) {
  const plan = normalisePlan(t.record?.plan ?? { bands: [{ from: 0, to: 3, steps: [{}], signs: [] }, { from: 3, to: null, steps: [{}], signs: [] }] });
  const box = el('div', { class: 'stack' });
  const numIn = (obj, key, ph, w = '90px') => el('input', { class: 'input', type: 'number', step: 'any', inputmode: 'decimal', placeholder: ph, value: obj[key] ?? '', style: { maxWidth: w }, 'aria-label': ph, on: { input: (e) => { obj[key] = e.target.value === '' ? null : Number(e.target.value); } } });
  const ageSel = (b, key, none) => el('select', { class: 'select', style: { maxWidth: '150px' }, 'aria-label': key === 'from' ? 'From the age of' : 'Until', on: { change: (e) => { b[key] = e.target.value === '' ? null : Number(e.target.value); } } },
    [el('option', { value: '', text: none, selected: b[key] == null }), ...AGES.map((m) => el('option', { value: m, text: m === 0 ? 'Birth' : ageLabel(m), selected: b[key] === m }))]);
  const draw = () => box.replaceChildren(...plan.bands.map((b, bi) => el('div', { class: 'panel stack', 'data-field': `plan-band:${bi}`, style: { gap: '8px' } }, [
    el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [el('strong', { text: 'For ages' }), ageSel(b, 'from', 'Any age'), el('span', { text: 'to' }), ageSel(b, 'to', 'No end'),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove band', on: { click: () => { plan.bands.splice(bi, 1); draw(); } } })]),
    ...b.steps.map((s, si) => el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
      el('span', { class: 'small', text: 'From' }), numIn(s, 'temp', '°C', '80px'), el('span', { class: 'small', text: 'for' }), numIn(s, 'forMins', 'min', '80px'), el('span', { class: 'small', text: 'we' }),
      el('input', { class: 'input', value: s.actions, placeholder: 'e.g. light clothes, a cool cloth, fluids', style: { flex: '2 1 200px' }, 'aria-label': 'What we do', on: { input: (e) => { s.actions = e.target.value; } } }),
      el('span', { class: 'small', text: 'checking every' }), numIn(s, 'every', 'min', '80px'),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove step', on: { click: () => { b.steps.splice(si, 1); draw(); } } }),
    ])),
    el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add step', 'data-field': `plan-add-step:${bi}`, on: { click: () => { b.steps.push({}); draw(); } } })]),
    el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [el('strong', { text: 'We go to a doctor or hospital straight away at' }), numIn(b, 'goTemp', '°C', '80px'), el('span', { class: 'small', text: 'for' }), numIn(b, 'goMins', 'min', '80px'), el('span', { class: 'small', text: 'or if any of these:' })]),
    // The signs are yours: keep, reword, remove, add - the suggestions are only a starting point.
    ...b.signs.map((sign, gi) => el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
      el('input', { class: 'input', value: sign, style: { flex: '1 1 220px' }, 'aria-label': 'A sign', on: { input: (e) => { b.signs[gi] = e.target.value; } } }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove sign', on: { click: () => { b.signs.splice(gi, 1); draw(); } } }),
    ])),
    el('div', { class: 'row', style: { gap: '6px' } }, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add sign', 'data-field': `plan-add-sign:${bi}`, on: { click: () => { b.signs.push(''); draw(); } } })]),
    FEVER_SIGNS.some((x) => !b.signs.includes(x)) ? el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'small muted', text: 'Some families include these - tap to add, then change as you like:' }),
      el('div', { class: 'chipset' }, FEVER_SIGNS.filter((x) => !b.signs.includes(x)).map((x) => el('button', { class: 'chip', type: 'button', text: x, on: { click: () => { b.signs.push(x); draw(); } } })))]) : null,
  ])));
  draw();
  const text = planText(t.record?.plan ?? {});
  return el('div', { class: 'panel stack', 'data-field': 'fever-plan' }, [
    el('h2', { text: 'Our fever plan', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Written by the two of you, with a clear head: at what temperature, for how long, what you do and how often you check - and when you go straight to a doctor. The app fills in nothing; the signs are yours to keep, change, remove and add to. You can always go sooner than your plan says.' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Add band', title: 'Add an age band', on: { click: () => { plan.bands.push({ from: null, to: null, steps: [{}], signs: [], own: '' }); draw(); } } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'plan-save', on: { click: () => put({ plan: normalisePlan(plan) }) } }),
      text && hub.data.installed('decisions') ? el('a', { class: 'btn', href: decideHref(`${t.id}:plan`), text: 'Decide', title: 'Agree it together in Decisions', 'data-field': 'plan-decide' }) : null,
      text ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'Print', on: { click: () => printText('Our fever plan', text) } }) : null,
    ]),
    text ? el('pre', { class: 'small', style: { whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }, 'data-field': 'plan-text', text }) : null,
  ]);
}

/** A plain page to print (or save as PDF) - opened in a new window so the app's chrome stays out. */
export function printText(title, text, note = '') {
  const w = globalThis.open?.('', '_blank');
  if (!w) return;
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem;color:#222}h1{font-size:1.4rem}pre{white-space:pre-wrap;font:inherit}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 8px;text-align:left;vertical-align:top}.n{color:#555;font-size:.9rem}</style><h1>${esc(title)}</h1>${text.startsWith('<table') ? text : `<pre>${esc(text)}</pre>`}<p class="n">${esc(note || `Printed ${new Date().toLocaleDateString('en-ZA')} from Family Hub. If you are wondering whether to go to a doctor, go.`)}</p>`);
  w.document.close();
  w.focus();
  w.print();
}
export { rangeLabel };

/**
 * A chart you fill in yourselves (D-106) - the medicines you keep and what you give at what age,
 * or what they wear at what room temperature - saved on the topic and printable (or saved as PDF).
 * @param o { key, title, help, columns: [[key, label, placeholder]] }
 */
export function chartPanel(hub, t, put, o) {
  const rows = (Array.isArray(t.record?.[o.key]) ? t.record[o.key] : []).map((r) => ({ ...r }));
  if (!rows.length) rows.push({});
  const box = el('div', { class: 'stack', style: { gap: '6px' } });
  const draw = () => box.replaceChildren(...rows.map((r, i) => el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' }, 'data-field': `${o.key}-row:${i}` }, [
    ...o.columns.map(([k, label, ph]) => el('input', { class: 'input', value: r[k] ?? '', placeholder: ph ?? label, 'aria-label': label, style: { flex: '1 1 120px' }, on: { input: (e) => { r[k] = e.target.value; } } })),
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': 'Remove this line', on: { click: () => { rows.splice(i, 1); draw(); } } }),
  ])));
  draw();
  const clean = () => rows.filter((r) => o.columns.some(([k]) => String(r[k] ?? '').trim())).map((r) => Object.fromEntries(o.columns.map(([k]) => [k, String(r[k] ?? '').trim().slice(0, 300)])));
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const table = (list) => `<table><tr>${o.columns.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr>${list.map((r) => `<tr>${o.columns.map(([k]) => `<td>${esc(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</table>`;
  return el('div', { class: 'panel stack', 'data-field': `chart:${o.key}` }, [
    el('h2', { text: o.title, style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: o.help }),
    el('div', { class: 'row small muted', style: { gap: '6px' } }, o.columns.map(([, label]) => el('span', { style: { flex: '1 1 120px' }, text: label }))),
    box,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-small', type: 'button', text: 'Add line', on: { click: () => { rows.push({}); draw(); } } }),
      el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Save', 'data-field': `${o.key}-save`, on: { click: () => put({ [o.key]: clean() }) } }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Print', title: 'Print or save as PDF', on: { click: () => printText(o.title, table(clean()), o.printNote) } }),
    ]),
  ]);
}

/**
 * A list the family can change (D-107): every line editable, removable, and new ones added - the
 * app's own lines are only a starting point. `save(lines)` stores them.
 */
export function listPanel(title, lines, save, { help = '', add = 'Add', remove = 'Remove', field = 'list', placeholder = '' } = {}) {
  const rows = [...lines];
  const box = el('div', { class: 'stack', style: { gap: '6px' } });
  const draw = () => box.replaceChildren(...rows.map((x, i) => el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' }, 'data-field': `${field}:${i}` }, [
    el('input', { class: 'input', value: x, style: { flex: '1 1 220px' }, 'aria-label': title, on: { input: (e) => { rows[i] = e.target.value; } } }),
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: remove, 'data-field': `${field}-remove:${i}`, on: { click: () => { rows.splice(i, 1); draw(); } } }),
  ])));
  draw();
  return el('div', { class: 'panel stack', 'data-field': field }, [
    el('h2', { text: title, style: { margin: 0 } }),
    help ? el('p', { class: 'small muted', style: { margin: 0 }, text: help }) : null,
    box,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-small', type: 'button', text: add, 'data-field': `${field}-add`, on: { click: () => { rows.push(placeholder ? '' : ''); draw(); box.querySelector('[data-field="' + field + ':' + (rows.length - 1) + '"] input')?.focus(); } } }),
      el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Save', 'data-field': `${field}-save`, on: { click: () => save(rows.map((x) => x.trim()).filter(Boolean)) } }),
    ]),
  ]);
}
