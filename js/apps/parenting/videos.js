// Videos on a decision or a topic (D-101): the creators and video links, each video with every
// parent's view - Agree, Not sure, Disagree, and why - the other's shown once you have given yours.
// Used by Parenting topics and by Decisions.

import { el } from '../../ui/dom.js';
import { linksEditor } from '../../ui/links-editor.js';
import { normaliseLinks, hostOf } from '../../links.js';
import { VIEWS, viewsOn, setView, adultsOf } from './logic.js';

/**
 * @param item  has creators, videos and views
 * @param save  (changes) => Promise - saves { creators, videos } or { views } onto the item
 */
export function videosPanel(hub, item, save, { help = 'Videos that explain a side of it - watch, then say where you each stand.' } = {}) {
  if (!hub.creators) return null;
  const { creators, videos } = normaliseLinks(item);
  const me = hub.people.current()?.id ?? null;
  const adults = adultsOf(hub.people.list(), hub.today());
  const known = hub.creators.list().filter((c) => creators.includes(c.id));
  const editing = { creators: [...creators], videos: [...videos] };
  const editor = el('details', { class: 'more' }, [el('summary', { text: videos.length || known.length ? 'Change the videos' : 'Add videos', 'data-field': 'vid-edit' }),
    linksEditor(hub, editing),
    el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Save', 'data-field': 'vid-save', on: { click: () => save(normaliseLinks(editing)) } })])]);
  const one = (v) => {
    const st = viewsOn(item.views, v.url, adults, me);
    const note = el('input', { class: 'input', placeholder: 'Why (optional)', value: st.mine?.note ?? '', 'aria-label': 'Why', style: { maxWidth: '320px' } });
    return el('li', { 'data-field': `vid:${v.url}` }, [el('div', { class: 'list__main stack', style: { gap: '4px' } }, [
      el('a', { href: v.url, target: '_blank', rel: 'noopener noreferrer', text: v.title || hostOf(v.url), style: { fontWeight: 600 } }),
      me ? el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
        el('div', { class: 'chipset', role: 'group', 'aria-label': 'Where I stand' }, Object.entries(VIEWS).map(([k, t]) => el('button', {
          class: 'chip', type: 'button', text: t, 'aria-pressed': String(st.mine?.view === k), 'data-field': `vid-view:${k}`,
          on: { click: () => save({ views: setView(item.views, v.url, me, k, note.value.trim()) }) } }))),
        note,
      ]) : el('span', { class: 'small muted', text: 'Choose who you are at the top of the page to say where you stand.' }),
      ...st.others.map((o) => el('div', { class: 'small' }, [el('strong', { text: `${o.name}: ` }), o.shown ? `${VIEWS[o.shown.view]}${o.shown.note ? ` - ${o.shown.note}` : ''}` : o.answered ? 'has given theirs - give yours to see it.' : 'not yet.'])),
    ])]);
  };
  return el('div', { class: 'panel stack', 'data-field': 'videos' }, [
    el('h2', { text: 'Videos', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: help }),
    known.length ? el('p', { class: 'small', style: { margin: 0 } }, ['From ', ...known.flatMap((c, i) => [i ? ', ' : '', c.url ? el('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer', text: c.name }) : c.name])]) : null,
    videos.length ? el('ul', { class: 'list' }, videos.map(one)) : null,
    editor,
  ]);
}
