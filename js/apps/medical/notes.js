// Notes per person (D-103): not medical records - a few things worth having to hand for each
// member of the family: allergies, regular medicines, conditions to know about, blood group,
// their doctor. Visible to the whole family. Food allergies from the People page show too, so
// they are not typed twice.

import { el } from '../../ui/dom.js';
import { saveRecord } from '../kit.js';

export const notesCol = (hub) => hub.data.collection('notes', { summary: (r) => r, prefix: 'mn' });
const FIELDS = [
  ['allergies', 'Allergies', 'e.g. penicillin, bee stings'],
  ['medicines', 'Regular medicines', 'what, and how much'],
  ['conditions', 'Conditions to know about', 'e.g. asthma'],
  ['blood', 'Blood group', 'e.g. O+'],
  ['doctor', 'Their doctor', 'name and number'],
  ['other', 'Anything else', ''],
];
const ALLERGEN = { gluten: 'gluten', dairy: 'dairy', egg: 'egg', nuts: 'tree nuts', peanuts: 'peanuts', soy: 'soy', fish: 'fish', shellfish: 'shellfish', sesame: 'sesame' };

export function notesScreen(hub, nav) {
  const r = hub.use('notes', async () => (await notesCol(hub).list({ limit: 1000 })).items);
  const food = hub.foodProfiles ? hub.foodProfiles() : [];
  const people = hub.people.list();
  const card = (p) => {
    const rec = (r.data ?? []).find((x) => x.personId === p.id) ?? { id: `mn_${p.id}`, personId: p.id };
    const foodAll = (food.find((f) => f.id === p.id)?.allergies ?? []).map((a) => ALLERGEN[a] ?? a);
    const inputs = {};
    return el('div', { class: 'panel stack', 'data-field': `mnote:${p.id}` }, [
      el('h2', { text: p.name, style: { margin: 0 } }),
      foodAll.length ? el('p', { class: 'small', style: { margin: 0 } }, [el('strong', { text: 'Food allergies (from People): ' }), foodAll.join(', ')]) : null,
      ...FIELDS.map(([k, label, ph]) => {
        const i = el(k === 'other' ? 'textarea' : 'input', { class: 'input', placeholder: ph, 'aria-label': `${label}: ${p.name}`, 'data-field': `mn:${p.id}:${k}`, ...(k === 'other' ? { rows: 2, text: rec[k] ?? '' } : { value: rec[k] ?? '' }) });
        inputs[k] = i;
        return el('label', { class: 'stack', style: { gap: '2px' } }, [el('span', { class: 'small muted', text: label }), i]);
      }),
      el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Save', 'data-field': `mn-save:${p.id}`, on: { click: async () => {
        const next = { ...rec, ...Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim().slice(0, 1000)])) };
        if (await saveRecord(hub, notesCol(hub), next)) hub.ui.notice('Saved.');
      } } })]),
    ]);
  };
  return el('section', { class: 'stack', 'aria-label': 'Notes' }, [
    nav,
    el('p', { class: 'muted', style: { margin: 0 }, text: 'A few things worth having to hand for each of you - not medical records. Everyone in the family can see them.' }),
    r.loading ? el('p', { class: 'muted', text: 'Loading…' }) : null,
    ...(r.data ? people.map(card) : []),
  ]);
}
