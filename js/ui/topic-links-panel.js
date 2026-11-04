// The Creators and videos place on a topic page (D-112): the family's own creators
// and videos for the topic, the examples left to replace, and everything already
// linked on an item inside the topic's apps, each with where it is linked from.
// Plain links only: nothing is embedded or fetched.

import { el } from './dom.js';
import { confirmAction } from './common.js';
import { createCollection } from '../collections.js';
import { hostOf } from '../links.js';
import {
  LINKED, gatherLinked, topicLinks, addTopicCreator, editCreator, removeTopicCreator,
  replaceExample, addTopicVideo, editVideo, removeVideo, setTopicHidden,
} from '../topic-links.js';

// What is linked inside each topic's apps, read once per visit to the page (a new visit reads again).
const linkedCache = new Map();
window.addEventListener('hashchange', () => linkedCache.clear());

// The one form open: 'creator', 'video', or the id of the creator/video being edited.
let open = null;
let openTopic = null;

function linkedFor(ctx, topic, apps) {
  if (linkedCache.has(topic)) return linkedCache.get(topic);
  const store = ctx.sync.appStore?.();
  const entry = { data: null };
  linkedCache.set(topic, entry);
  if (!store) { entry.data = gatherLinked([]); return entry; }   // the family file on a phone: no app records to look through
  (async () => {
    const sources = [];
    for (const app of apps) {
      for (const [name, screen] of LINKED[app.id] ?? []) {
        try { sources.push({ app, open: screen, items: (await createCollection(store, { app: app.id, name }).list({ limit: 100000 })).items }); } catch { /* unreadable: left out */ }
      }
    }
    entry.data = gatherLinked(sources);
    ctx.render();
  })();
  return entry;
}

const out = (url, text) => el('a', { href: url, text, target: '_blank', rel: 'noopener noreferrer' });
const join = (nodes) => nodes.flatMap((n, i) => (i ? [', ', n] : [n]));

/** "Linked in Cookbook: Sourdough, Pizza" - each one opens the item. */
function fromLine(from) {
  if (!from.length) return null;
  const byApp = new Map();
  for (const f of from) byApp.set(f.app, [...(byApp.get(f.app) ?? []), f]);
  return el('div', { class: 'small', 'data-field': 'tl-from' }, [...byApp].flatMap(([app, list], i) => [
    i ? ' · ' : null, `Linked in ${app}: `, ...join(list.slice(0, 8).map((f) => el('a', { href: f.href, text: f.title }))), list.length > 8 ? ` and ${list.length - 8} more` : null,
  ]));
}

/** Name, link and note - for a new creator, an example made your own, or a change. */
function creatorForm(c, onSave) {
  const name = el('input', { class: 'input', value: c?.example ? '' : c?.name ?? '', maxlength: '80', placeholder: c?.example ? c.name : 'Name', 'aria-label': 'Name', style: { maxWidth: '220px' }, 'data-field': 'tl-c-name' });
  const url = el('input', { class: 'input', value: c?.url ?? '', placeholder: 'Channel or site link', 'aria-label': 'Their link', style: { maxWidth: '280px' }, 'data-field': 'tl-c-url' });
  const note = el('input', { class: 'input', value: c?.example ? '' : c?.note ?? '', maxlength: '300', placeholder: 'Why you follow them (optional)', 'aria-label': 'Note', style: { flex: '1 1 220px' }, 'data-field': 'tl-c-note' });
  const save = () => { if (!name.value.trim()) { name.focus(); return; } onSave({ name: name.value, url: url.value, note: note.value }); };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  queueMicrotask(() => name.focus());
  return el('div', { class: 'row', 'data-field': 'tl-c-form' }, [name, url, note,
    el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Save', 'data-field': 'tl-c-save', on: { click: save } }),
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Cancel', on: { click: () => onSave(null) } }),
  ]);
}

/** Link, title, note and who made it. */
function videoForm(v, creators, onSave) {
  const url = el('input', { class: 'input', value: v?.url ?? '', placeholder: 'https://youtu.be/…', 'aria-label': 'Video link', style: { maxWidth: '280px' }, 'data-field': 'tl-v-url' });
  const title = el('input', { class: 'input', value: v?.title ?? '', maxlength: '150', placeholder: 'Title (optional)', 'aria-label': 'Title', style: { maxWidth: '220px' }, 'data-field': 'tl-v-title' });
  const note = el('input', { class: 'input', value: v?.note ?? '', maxlength: '300', placeholder: 'Note (optional)', 'aria-label': 'Note', style: { flex: '1 1 200px' }, 'data-field': 'tl-v-note' });
  const by = el('select', { class: 'input', 'aria-label': 'Who made it', style: { maxWidth: '200px' }, 'data-field': 'tl-v-by' }, [
    el('option', { value: '', text: 'Who made it (optional)' }),
    ...creators.map((c) => el('option', { value: c.id, text: c.name, selected: v?.creatorId === c.id })),
  ]);
  const save = () => { if (!url.value.trim()) { url.focus(); return; } onSave({ url: url.value, title: title.value, note: note.value, creatorId: by.value }); };
  url.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  queueMicrotask(() => url.focus());
  return el('div', { class: 'row', 'data-field': 'tl-v-form' }, [url, title, note, creators.length ? by : null,
    el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Save', 'data-field': 'tl-v-save', on: { click: save } }),
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Cancel', on: { click: () => onSave(null) } }),
  ]);
}

/**
 * @param topic the section, { id, name }
 * @param apps  the enabled mini-apps in it ({ id, name })
 */
export function topicLinksPanel(ctx, topic, apps, { heading = true } = {}) {
  const h = ctx.app.household;
  if (!h) return null;
  if (openTopic !== topic.id) { open = null; openTopic = topic.id; }
  const linked = linkedFor(ctx, topic.id, apps.filter((a) => LINKED[a.id]));
  const t = topicLinks(h, topic.id, linked.data ?? undefined);
  const commit = (next) => { open = null; ctx.commit(next); };
  const toggle = (what) => { open = open === what ? null : what; ctx.render(); };

  if (t.hidden) {
    return el('div', { class: 'panel row', 'data-field': 'topic-links' }, [
      el('span', { class: 'muted', style: { flex: '1' }, text: 'Creators and videos is hidden.' }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Show', 'data-field': 'tl-show', on: { click: () => ctx.commit(setTopicHidden(h, topic.id, false)) } }),
    ]);
  }

  const real = t.creators.filter((c) => !c.example);
  const creatorRow = (c) => {
    if (open === c.id) {
      return el('li', { 'data-field': `tl-c:${c.id}` }, [creatorForm(c, (f) => {
        if (!f) return toggle(c.id);
        commit(c.example ? replaceExample(h, topic.id, c.id, f) : editCreator(h, c.id, f));
      })]);
    }
    const remove = async () => {
      if (c.example) return commit(replaceExample(h, topic.id, c.id));
      const r = removeTopicCreator(h, topic.id, c.id, c.from.length > 0);
      if (r.gone && !(await confirmAction({ title: `Remove ${c.name}?`, text: 'They are on no other topic, so they leave the family’s list. Anything elsewhere that named them stops showing the name.', confirmLabel: 'Remove' }))) return;
      commit(r.household);
    };
    return el('li', { 'data-field': `tl-c:${c.id}` }, [
      el('div', { class: 'list__main' }, [
        el('div', {}, [c.url ? out(c.url, c.name) : el('strong', { text: c.name }), ...(c.example ? [' ', el('span', { class: 'badge badge--demo', text: 'Example - replace' })] : [])]),
        c.note ? el('div', { class: 'small muted', text: c.note }) : null,
        fromLine(c.from),
      ]),
      el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn btn-small', type: 'button', text: c.example ? 'Make mine' : 'Edit', 'data-field': `tl-c-edit:${c.id}`, on: { click: () => toggle(c.id) } }),
        c.general ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'data-field': `tl-c-remove:${c.id}`, on: { click: remove } }) : null,
      ]),
    ]);
  };

  const videoRow = (v) => {
    if (open === v.id) return el('li', {}, [videoForm(v, real, (f) => (f ? commit(editVideo(h, v.id, f)) : toggle(v.id)))]);
    const maker = real.find((c) => c.id === v.creatorId);
    return el('li', { 'data-field': `tl-v:${v.id}` }, [
      el('div', { class: 'list__main' }, [
        el('div', {}, [out(v.url, v.title || hostOf(v.url)), maker ? el('span', { class: 'small muted', text: ` · ${maker.name}` }) : null]),
        v.note ? el('div', { class: 'small muted', text: v.note }) : null,
        fromLine(v.from),
      ]),
      v.own ? el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn btn-small', type: 'button', text: 'Edit', on: { click: () => toggle(v.id) } }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'data-field': `tl-v-remove:${v.id}`, on: { click: () => commit(removeVideo(h, v.id)) } }),
      ]) : null,
    ]);
  };

  const linkingApps = apps.filter((a) => LINKED[a.id]).map((a) => a.name);
  return el('section', { class: 'panel stack', 'aria-labelledby': 'tl-title', 'data-field': 'topic-links' }, [
    el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
      heading ? el('h2', { id: 'tl-title', text: 'Creators and videos', style: { margin: 0 } }) : el('span'),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Hide', title: 'Fold this away - Show brings it back', 'data-field': 'tl-hide', on: { click: () => ctx.commit(setTopicHidden(h, topic.id, true)) } }),
    ]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `Who and what your family follows on ${topic.id === 'us' ? 'being the two of you' : topic.name.toLowerCase()} - link the source instead of copying it in. ${linkingApps.length ? `Anyone or anything linked in ${linkingApps.join(' and ').replace(/ and (?=.* and )/g, ', ')} shows here too.` : ''}`.trim() }),
    linked.data ? null : el('p', { class: 'small muted', style: { margin: 0 }, text: 'Looking through what is linked…' }),

    el('h3', { text: 'Creators', style: { margin: 0 } }),
    t.creators.length ? el('ul', { class: 'list' }, t.creators.map(creatorRow)) : el('p', { class: 'small muted', style: { margin: 0 }, text: 'None yet.' }),
    open === 'creator'
      ? creatorForm(null, (f) => (f ? commit(addTopicCreator(h, topic.id, f)) : toggle('creator')))
      : el('div', { class: 'row' }, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add creator', 'data-field': 'tl-add-creator', on: { click: () => toggle('creator') } }),
        el('span', { class: 'small muted', text: 'a channel, a pastor, a coach - with their link' })]),

    el('h3', { text: 'Videos', style: { margin: 0 } }),
    t.videos.length ? el('ul', { class: 'list' }, t.videos.map(videoRow)) : el('p', { class: 'small muted', style: { margin: 0 }, text: 'None yet.' }),
    open === 'video'
      ? videoForm(null, real, (f) => (f ? commit(addTopicVideo(h, topic.id, f)) : toggle('video')))
      : el('div', { class: 'row' }, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add video', 'data-field': 'tl-add-video', on: { click: () => toggle('video') } }),
        el('span', { class: 'small muted', text: 'a link, opened in a new tab' })]),
  ]);
}
