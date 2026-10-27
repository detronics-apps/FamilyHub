// Places to go: local outings with what each is good for. Screens: list (default), item, new, edit.

import { el } from '../../ui/dom.js';
import { confirmAction, fold, roomy } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { loading, failure, recordForm, saveRecord } from '../kit.js';
import { normalisePlace, placeSummary, placeText, filterPlaces, areasOf, KINDS, TAGS, STATUSES, VERDICTS } from './logic.js';

const col = (hub) => hub.data.collection('places', { summary: placeSummary, text: placeText, prefix: 'plc' });
const all = (hub) => hub.use('all', async () => (await col(hub).list({ limit: 100000 })).items.map((s) => ({ ...normalisePlace(s), id: s.id })));
const ui = { area: '', kind: '', status: '', tags: [] };

export function render(hub, route) {
  if (route.sub === 'item') return placeScreen(hub, route.rest[0]);
  if (route.sub === 'new') return editScreen(hub, null);
  if (route.sub === 'edit') return editScreen(hub, route.rest[0]);
  return listScreen(hub);
}

function listScreen(hub) {
  const list = all(hub);
  if (list.loading) return loading();
  if (list.error) return failure(list.error);
  const set = (patch) => { Object.assign(ui, patch); hub.render(); };
  const chip = (pressed, text, field, click) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(pressed), text, 'data-field': field, on: { click } });
  const areas = areasOf(list.data);
  const shown = filterPlaces(list.data, ui);
  const select = (key, label, options, any) => el('label', { class: 'small stack', style: { gap: '2px' } }, [label, el('select', {
    class: 'select', style: { width: 'auto' }, 'data-field': `place-${key}`, on: { change: (e) => set({ [key]: e.target.value }) },
  }, [['', any], ...options].map(([v, t]) => el('option', { value: v, text: t, selected: ui[key] === v })))]);

  return el('section', { class: 'stack', 'aria-label': 'Places to go' }, [
    el('div', { class: 'row' }, [
      el('p', { class: 'muted', style: { margin: 0, flex: '1 1 260px' }, text: 'Places nearby you would like to go, or have been - for a free Saturday morning. Big trips with travel and packing are in Holidays.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'New place', 'data-field': 'add-place' }),
    ]),
    list.data.length ? fold('place-filters', 'Filters', [
      el('div', { class: 'row' }, [
        areas.length > 1 ? select('area', 'Where', areas.map((a) => [a, a]), 'Anywhere') : null,
        select('kind', 'Kind of place', Object.entries(KINDS), 'Any kind'),
      ]),
      el('div', { class: 'chipset', role: 'group', 'aria-label': 'Been or not' }, [
        chip(!ui.status, 'All', 'place-status:all', () => set({ status: '' })),
        ...Object.entries(STATUSES).map(([k, t]) => chip(ui.status === k, t, `place-status:${k}`, () => set({ status: k }))),
      ]),
      el('div', { class: 'chipset', role: 'group', 'aria-label': 'Good for' }, Object.entries(TAGS).map(([k, t]) => chip(ui.tags.includes(k), t, `place-tag:${k}`,
        () => set({ tags: ui.tags.includes(k) ? ui.tags.filter((x) => x !== k) : [...ui.tags, k] })))),
    ], { open: roomy(), cls: 'panel', note: [ui.area, KINDS[ui.kind], STATUSES[ui.status], ...ui.tags.map((t) => TAGS[t])].filter(Boolean).join(' · ') || 'Everything' }) : el('div', { class: 'panel empty' }, [el('p', { text: 'No places yet. Add the next one someone mentions - "that farm with the tractor rides" - and how it suits the family.' })]),
    list.data.length ? (shown.length ? el('ul', { class: 'list panel', 'data-field': 'places' }, shown.map((p) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('item', p.id), style: { color: 'inherit', textDecoration: 'none' } }, [
        el('strong', { text: p.title }),
        el('div', { class: 'small muted', text: [p.area, KINDS[p.kind], p.status === 'been' ? (VERDICTS[p.verdict] ?? 'Been') : 'Want to go', p.tags.map((t) => TAGS[t]).join(', ')].filter(Boolean).join(' · ') }),
      ]),
    ]))) : el('p', { class: 'panel', text: 'No place matches all of those. Untick a filter.' })) : null,
  ]);
}

function placeScreen(hub, id) {
  const r = hub.use(`place:${id}`, () => col(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This place no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'All places' })]);
  const p = normalisePlace(r.data);
  const save = async (patch) => { await saveRecord(hub, col(hub), normalisePlace({ ...p, ...patch })); };
  return el('section', { class: 'stack' }, [
    el('h1', { text: p.title }),
    el('p', { class: 'small muted', text: [p.area, KINDS[p.kind]].filter(Boolean).join(' · ') }),
    p.tags.length ? el('div', { class: 'chipset' }, p.tags.map((t) => el('span', { class: 'badge', text: TAGS[t] }))) : null,
    p.notes ? el('p', { text: p.notes, style: { whiteSpace: 'pre-wrap' } }) : null,
    p.link ? el('p', {}, [el('a', { href: p.link, target: '_blank', rel: 'noopener noreferrer', text: 'Their website' })]) : null,
    el('div', { class: 'panel stack' }, [
      el('h2', { text: p.status === 'been' ? `Been${p.lastVisit ? ` - last on ${fmtDay(p.lastVisit, hub.today())}` : ''}` : 'Not been yet', style: { margin: 0 } }),
      p.status === 'been' ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'How it was' }, Object.entries(VERDICTS).map(([k, t]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(p.verdict === k), text: t, 'data-field': `verdict:${k}`, on: { click: () => save({ verdict: k }) },
      }))) : null,
      el('button', { class: 'btn', type: 'button', text: p.status === 'been' ? 'Went again' : 'We went', title: 'Mark as been, today', 'data-field': 'mark-been', style: { alignSelf: 'flex-start' }, on: { click: () => save({ status: 'been', lastVisit: hub.today() }) } }),
    ]),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn', href: hub.href('edit', p.id), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Delete', on: { click: async () => { if (await confirmAction({ title: `Delete ${p.title}?`, confirmLabel: 'Delete', danger: true })) { await col(hub).remove(p.id); hub.invalidate(); hub.go(); } } } }),
    ]),
  ]);
}

function editScreen(hub, id) {
  const r = id ? hub.use(`place:${id}`, () => col(hub).get(id)) : { data: null };
  const list = all(hub);
  if (r.loading || list.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normalisePlace(r.data) : null;
  const rec = existing ?? normalisePlace({ title: '', area: areasOf(list.data ?? [])[0] ?? '' });
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add a place' }),
    recordForm({
      record: { ...rec, title: existing ? rec.title : '' },
      fields: [
        { key: 'title', label: 'Name', required: true, placeholder: 'e.g. Kirstenbosch Gardens' },
        { key: 'area', label: 'Where', placeholder: 'e.g. Cape Town', suggest: areasOf(list.data ?? []), hint: 'The town or area - pick one you used before so they group together.' },
        { key: 'kind', label: 'Kind of place', type: 'select', options: Object.entries(KINDS) },
        { key: 'tags', label: 'Good for', type: 'choices', options: Object.entries(TAGS) },
        { key: 'status', label: 'Been there?', type: 'select', options: Object.entries(STATUSES) },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'e.g. Go early, parking fills up; the tea garden has a jungle gym' },
        { key: 'link', label: 'Website (optional)', placeholder: 'https://...', more: true },
      ],
      onCancel: () => (existing ? hub.go('item', existing.id) : hub.go(null)),
      onSave: async (values) => {
        const saved = await saveRecord(hub, col(hub), normalisePlace({ ...rec, ...values }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('item', saved.id); }
      },
    }),
  ]);
}
