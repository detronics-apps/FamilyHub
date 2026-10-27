// Small building blocks the starter mini-apps share: tabs, record forms with
// progressive disclosure, saving with conflict handling, and loading states.
// UI only - each app's rules live in its own logic.js (pure, tested).

import { el } from '../ui/dom.js';
import { modal } from '../ui/common.js';
import { CollectionConflict } from '../collections.js';

export function tabs(hub, list, current) {
  return el('nav', { class: 'tabs', 'aria-label': hub.app.name }, list.map((t) => el('a', {
    class: 'tab', href: hub.href(t.screen), 'aria-current': t.screen === current ? 'page' : null, 'data-field': `tab:${t.screen ?? 'main'}`, text: t.label,
  })));
}

export const loading = (text = 'Loading…') => el('p', { class: 'muted', role: 'status', text });

export const failure = (err) => el('div', { class: 'panel', role: 'alert' }, [
  el('p', { text: err?.code === 'no-store' ? 'Your Drive folder needs reconnecting - use the notice at the top.' : `This could not be loaded: ${err?.message || err}` }),
]);

/** One labelled control. `hint` stays short. */
export function field(label, control, hint = null) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: control.id, text: label }),
    control,
    hint ? el('div', { class: 'field__hint', text: hint }) : null,
  ]);
}

let uid = 0;
const nextId = (key) => `f-${key}-${(uid += 1)}`;

// What has been typed into a form, per screen, so a redraw of the page (a list
// finishing loading, a warning) never puts back the old values. Forgotten on leaving the screen.
const drafts = new Map();
globalThis.addEventListener?.('hashchange', () => drafts.clear());

/**
 * A form built from a field list. Fields marked `more` go under "More details".
 * Field types: text, textarea, select, day, number, lines (one item per line),
 * people (tick boxes), check. Values are read only on Save.
 */
export function recordForm({ fields, record = {}, people = [], onSave, onCancel = null, saveLabel = 'Save', extra = [] }) {
  const getters = {};
  const draftKey = `${globalThis.location?.hash ?? ''}|${fields.map((f) => f.key).join()}`;
  const draft = drafts.get(draftKey);
  const errors = el('div', { class: 'field__hint', role: 'alert', style: { color: 'var(--danger)' } });

  const build = (f) => {
    const id = nextId(f.key);
    const v = draft && f.key in draft ? draft[f.key] : record[f.key];
    let control;
    switch (f.type) {
      case 'textarea':
        control = el('textarea', { class: 'input', id, rows: f.rows ?? 3, text: v ?? '', placeholder: f.placeholder ?? '' });
        getters[f.key] = () => control.value.trim();
        break;
      case 'lines':
        control = el('textarea', { class: 'input', id, rows: f.rows ?? 3, text: (v ?? []).join('\n'), placeholder: f.placeholder ?? 'One per line' });
        getters[f.key] = () => control.value.split('\n').map((x) => x.trim()).filter(Boolean);
        break;
      case 'select':
        control = el('select', { class: 'select', id }, f.options.map(([val, label]) => el('option', { value: val, text: label, selected: String(val) === String(v ?? f.default ?? '') })));
        getters[f.key] = () => control.value || null;
        break;
      case 'day':
        control = el('input', { class: 'input', id, type: 'date', value: v ?? '', style: { maxWidth: '200px' } });
        getters[f.key] = () => control.value || null;
        break;
      case 'number':
        control = el('input', { class: 'input', id, type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: v ?? '', style: { maxWidth: '160px' }, placeholder: f.placeholder ?? '' });
        getters[f.key] = () => (control.value === '' ? null : Math.max(0, Number(control.value)));
        break;
      case 'custom': {
        // A control built by the caller: { node, get }.
        const c = f.control();
        getters[f.key] = c.get;
        return el('div', { class: 'field' }, [el('span', { class: 'field__label', text: f.label }), c.node, f.hint ? el('div', { class: 'field__hint', text: f.hint }) : null]);
      }
      case 'check': {
        const box = el('input', { type: 'checkbox', id, checked: Boolean(v) });
        getters[f.key] = () => box.checked;
        return el('label', { class: 'checkline', for: id }, [box, f.label]);
      }
      case 'choices': {
        // Tick boxes over [[value, label]] options; the value is the list of ticked ones.
        const boxes = (f.options ?? []).map(([val, label]) => {
          const box = el('input', { type: 'checkbox', value: val, checked: (v ?? []).includes(val) });
          return { box, node: el('label', { class: 'checkline' }, [box, label]) };
        });
        getters[f.key] = () => boxes.filter((b) => b.box.checked).map((b) => b.box.value);
        return el('fieldset', {}, [el('legend', { text: f.label }),
          boxes.length ? el('div', { style: { maxHeight: '180px', overflowY: 'auto' } }, boxes.map((b) => b.node)) : el('p', { class: 'small muted', text: f.empty ?? 'Nothing to choose from yet.' }),
          f.hint ? el('div', { class: 'field__hint', text: f.hint }) : null]);
      }
      case 'people': {
        const boxes = people.map((p) => {
          const box = el('input', { type: 'checkbox', value: p.id, checked: (v ?? []).includes(p.id) });
          return { box, node: el('label', { class: 'checkline' }, [box, p.name]) };
        });
        getters[f.key] = () => boxes.filter((b) => b.box.checked).map((b) => b.box.value);
        return el('fieldset', {}, [el('legend', { text: f.label }),
          boxes.length ? el('div', { class: 'row' }, boxes.map((b) => b.node)) : el('p', { class: 'small muted', text: 'Add people on the People page to choose.' }),
          f.hint ? el('div', { class: 'field__hint', text: f.hint }) : null]);
      }
      default:
        control = el('input', { class: 'input', id, value: v ?? '', placeholder: f.placeholder ?? '', autocomplete: 'off', maxlength: f.max ?? 200, ...(f.suggest?.length ? { list: `${id}-list` } : {}) });
        getters[f.key] = () => control.value.trim();
        // Earlier answers offered as you type, so the same thing is spelt the same way.
        if (f.suggest?.length) return field(f.label, el('span', {}, [control, el('datalist', { id: `${id}-list` }, f.suggest.map((s) => el('option', { value: s })))]), f.hint);
    }
    if (f.required) control.required = true;
    return field(`${f.label}${f.required ? ' *' : ''}`, control, f.hint);
  };

  const main = fields.filter((f) => !f.more).map(build);
  const more = fields.filter((f) => f.more).map(build);

  const submit = (e) => {
    e?.preventDefault();
    const values = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
    const missing = fields.filter((f) => f.required && !values[f.key]);
    if (missing.length) { errors.textContent = `Please fill in: ${missing.map((f) => f.label).join(', ')}.`; return; }
    errors.textContent = '';
    onSave(values);
  };

  const remember = () => drafts.set(draftKey, Object.fromEntries(fields.filter((f) => f.type !== 'custom' && getters[f.key]).map((f) => [f.key, getters[f.key]()])));
  return el('form', { class: 'panel stack', on: { submit, input: remember, change: remember } }, [
    ...main,
    more.length ? el('details', { class: 'more' }, [el('summary', { text: 'More details' }), el('div', { class: 'stack' }, more)]) : null,
    errors,
    el('div', { class: 'row row--end' }, [
      ...extra,
      onCancel ? el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: onCancel } }) : null,
      el('button', { class: 'btn btn-primary', type: 'submit', text: saveLabel, 'data-field': 'record-save' }),
    ]),
  ]);
}

/**
 * Save, handling an edit made elsewhere at the same time: different fields are
 * merged by the collection; the same field changed differently is shown here,
 * and the person picks.
 */
export async function saveRecord(hub, col, record) {
  try {
    const saved = await col.put(record);
    hub.invalidate();
    return saved;
  } catch (err) {
    if (!(err instanceof CollectionConflict)) throw err;
    const choice = await new Promise((resolve) => {
      const picks = {};
      const rows = err.conflicts.map((c) => {
        picks[c.field] = 'mine';
        const name = `c-${c.field}`;
        const show = (v) => (Array.isArray(v) ? v.join(', ') || '(none)' : v === null || v === undefined || v === '' ? '(empty)' : typeof v === 'object' ? JSON.stringify(v) : String(v));
        return el('fieldset', { class: 'panel panel--soft' }, [
          el('legend', { text: c.field }),
          el('label', { class: 'checkline' }, [el('input', { type: 'radio', name, checked: true, on: { change: () => { picks[c.field] = 'mine'; } } }), `Mine: ${show(c.mine)}`]),
          el('label', { class: 'checkline' }, [el('input', { type: 'radio', name, on: { change: () => { picks[c.field] = 'theirs'; } } }), `The other device: ${show(c.theirs)}`]),
        ]);
      });
      let answered = null;
      const { close } = modal({
        title: 'Changed in two places',
        body: [el('p', { text: 'Someone changed this on another device while you were editing. Everything else was combined - choose for these:' }), ...rows],
        foot: [
          el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }),
          el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', on: { click: () => { answered = picks; close(); } } }),
        ],
        onClose: () => resolve(answered),
      });
    });
    if (!choice) return null;
    const merged = { ...err.merged };
    for (const c of err.conflicts) merged[c.field] = choice[c.field] === 'theirs' ? c.theirs : c.mine;
    const saved = await col.put({ ...merged, rev: err.theirs.rev }, { force: true });
    hub.invalidate();
    return saved;
  }
}

/** "Thu 30 Oct" etc., or a fallback. */
export const nameOf = (people, id) => people.find((p) => p.id === id)?.name ?? 'a former member';
