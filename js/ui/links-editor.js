// Creators and videos on an item (D-091), the same in every app: tick the
// family's creators (or add one right here), and paste video links one per
// line. Shown as plain links that open in a new tab. Redraws only itself.

import { el } from './dom.js';
import { normaliseLinks, parseVideos, videosText, hostOf } from '../links.js';

const out = (url, text) => el('a', { href: url, text, target: '_blank', rel: 'noopener noreferrer' });

/** Edits `item.creators` and `item.videos` in place. Null when the app cannot see the creators list. */
export function linksEditor(hub, item) {
  if (!hub.creators) return null;
  Object.assign(item, normaliseLinks(item));
  const box = el('div', { class: 'stack', style: { gap: 'var(--space-1)' }, 'data-field': 'links' });
  const videos = el('textarea', {
    class: 'input', rows: '2', text: videosText(item.videos), placeholder: 'https://youtu.be/… Title (one per line)', 'aria-label': 'Videos', 'data-field': 'links-videos',
    on: { input: (e) => { item.videos = parseVideos(e.target.value); } },
  });
  const redraw = () => {
    const name = el('input', { class: 'input', maxlength: '80', placeholder: 'Name', 'aria-label': 'New creator', style: { maxWidth: '180px' }, 'data-field': 'creator-name' });
    const url = el('input', { class: 'input', placeholder: 'Channel or site link', 'aria-label': 'Their link', style: { maxWidth: '260px' }, 'data-field': 'creator-url' });
    const add = () => {
      if (!name.value.trim()) { name.focus(); return; }
      const c = hub.creators.add({ name: name.value, url: url.value });
      if (!item.creators.includes(c.id)) item.creators.push(c.id);
      redraw();
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    const all = hub.creators.list();
    box.replaceChildren(
      el('span', { class: 'field__label', text: 'Creators' }),
      all.length ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'Creators' }, all.map((c) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(item.creators.includes(c.id)), text: c.name, title: c.url || 'No link', 'data-field': `creator:${c.id}`,
        on: { click: () => { item.creators = item.creators.includes(c.id) ? item.creators.filter((x) => x !== c.id) : [...item.creators, c.id]; redraw(); } },
      }))) : null,
      el('div', { class: 'row' }, [name, url, el('button', { class: 'btn btn-small', type: 'button', text: '+ Creator', 'data-field': 'creator-add', on: { click: add } })]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Someone whose work this comes from - a channel, a pastor, a cook. The list is shared by every app; change or remove one in Creators and videos on its topic’s page.' }),
      el('label', { class: 'field__label', text: 'Videos' }),
      videos,
    );
  };
  redraw();
  return box;
}

/** For recordForm: { node, get } giving { creators, videos }. */
export function linksControl(hub, record) {
  const item = { creators: record.creators, videos: record.videos };
  return { node: linksEditor(hub, item) ?? el('span'), get: () => normaliseLinks(item) };
}

/** "From: Pastor Sam · Videos: Sourdough at home" as links, or null when there are none. */
export function linksView(hub, item, { small = true } = {}) {
  const { creators, videos } = normaliseLinks(item);
  const known = (hub.creators?.list() ?? []).filter((c) => creators.includes(c.id));
  if (!known.length && !videos.length) return null;
  const join = (nodes) => nodes.flatMap((n, i) => (i ? [', ', n] : [n]));
  return el('p', { class: small ? 'small' : null, style: { margin: 0 }, 'data-field': 'links-view' }, [
    known.length ? el('span', {}, ['From ', ...join(known.map((c) => (c.url ? out(c.url, c.name) : el('span', { text: c.name }))))]) : null,
    known.length && videos.length ? ' · ' : null,
    videos.length ? el('span', {}, [videos.length === 1 ? 'Video: ' : 'Videos: ', ...join(videos.map((v) => out(v.url, v.title || hostOf(v.url))))]) : null,
  ]);
}
