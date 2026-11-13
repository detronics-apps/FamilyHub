// Creators and videos per topic (D-112). Every topic page has one place for the
// creators and videos the family follows on that topic: its own general ones,
// plus every creator or video already linked on an item inside that topic's
// apps (a recipe, a journal entry, a workout...), with where it is linked from.
// The family's own: anything added can be removed, examples are placeholders
// to replace, never real people. Pure: no DOM.

import { normaliseCreator, normaliseVideo } from './links.js';
import { newId } from './model.js';

/**
 * The collections whose records carry `creators` and `videos` in their index summaries,
 * per app, and the screen that opens one ("item/<id>" -> #/meals/item/<id>).
 */
const id = (s) => encodeURIComponent(s.id);
export const LINKED = {
  meals: [['recipes', (s) => `item/${id(s)}`]],
  exercise: [['activities', () => 'log'], ['plans', () => 'plans'], ['exercises', (s) => `exercise/${id(s)}`], ['workouts', (s) => `workout/${id(s)}`]],
  faith: [['notes', (s) => `entry/${id(s)}`]],
  finance: [['goals', (s) => `goal/${id(s)}`]],
  parenting: [['topics', (s) => `topic/${encodeURIComponent(s.topicId || s.id)}`], ['activities', (s) => `idea/${id(s)}`]],
  decisions: [['decisions', (s) => `item/${id(s)}`]],
  dates: [['dates', (s) => `date/${id(s)}`]],
};

/**
 * Starting creators: none made up (owner, 2026-11-13) - "do not make up data or information". Only
 * real creators the owner follows go in, as the family's own (they can remove them), when the owner
 * supplies them. Kept as a list so a topic's place can still show starting entries if ever needed.
 */
export const EXAMPLES = {};
const exampleId = (topic, i) => `ex-${topic}-${i}`;

/**
 * Everything linked on items inside a topic's apps.
 * @param sources [{ app: { id, name }, open: (summary) => screen, items: [summary] }]
 * @returns { creators: { [creatorId]: [From] }, videos: [{ url, title, from: [From] }] }, From = { title, href, app }
 */
export function gatherLinked(sources = []) {
  const creators = {};
  const videos = new Map();
  for (const { app, open, items } of sources) {
    for (const s of items ?? []) {
      if (!s || s.removed) continue;
      const from = { title: String(s.title || s.name || s.question || 'Untitled'), href: `#/${app.id}/${open(s)}`, app: app.name };
      for (const c of Array.isArray(s.creators) ? s.creators : []) (creators[c] ??= []).push(from);
      for (const v of Array.isArray(s.videos) ? s.videos : []) {
        if (!v?.url) continue;
        const had = videos.get(v.url) ?? { url: v.url, title: '', from: [] };
        had.title ||= v.title ?? '';
        had.from.push(from);
        videos.set(v.url, had);
      }
    }
  }
  return { creators, videos: [...videos.values()] };
}

/**
 * What a topic's place shows: the family's general creators for it, the creators linked inside
 * it, the examples not yet removed or replaced, and the videos (its own and linked ones).
 */
export function topicLinks(household, topic, linked = { creators: {}, videos: [] }) {
  const all = household.creators ?? [];
  const off = new Set(household.household?.examplesOff ?? []);
  const creators = all
    .filter((c) => c.topics?.includes(topic) || linked.creators[c.id])
    .map((c) => ({ ...c, general: Boolean(c.topics?.includes(topic)), from: linked.creators[c.id] ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const examples = (EXAMPLES[topic] ?? [])
    .map(([name, note], i) => ({ id: exampleId(topic, i), name, note, url: '', example: true, general: true, from: [] }))
    .filter((x) => !off.has(x.id));
  const own = (household.videos ?? []).filter((v) => v.topic === topic);
  const byUrl = new Map(own.map((v) => [v.url, { ...v, own: true, from: [] }]));
  for (const v of linked.videos) {
    const had = byUrl.get(v.url);
    if (had) had.from = v.from;
    else byUrl.set(v.url, { id: `ln:${v.url}`, url: v.url, title: v.title, note: '', creatorId: '', own: false, from: v.from });
  }
  return {
    creators: [...creators, ...examples],
    videos: [...byUrl.values()],
    hidden: (household.household?.hiddenTopics ?? []).includes(topic),
  };
}

/* Edits. Each returns a new household; the input is never mutated. */

const meta = (h, patch) => ({ ...h, household: { ...h.household, ...patch } });
const add = (list, x) => [...new Set([...(list ?? []), x])];

/** A general creator for this topic - or the one already listed under that name, now on this topic too. */
export function addTopicCreator(h, topic, fields) {
  const fresh = normaliseCreator({ ...fields, id: newId('cr'), topics: [topic] });
  const same = (h.creators ?? []).find((c) => c.name.toLowerCase() === fresh.name.toLowerCase());
  if (same) return { ...h, creators: h.creators.map((c) => (c === same ? normaliseCreator({ ...c, topics: add(c.topics, topic), url: c.url || fresh.url, note: c.note || fresh.note }) : c)) };
  return { ...h, creators: [...(h.creators ?? []), fresh] };
}

/** Change a creator's name, link or note - the same creator everywhere. */
export const editCreator = (h, creatorId, patch) => ({ ...h, creators: (h.creators ?? []).map((c) => (c.id === creatorId ? normaliseCreator({ ...c, ...patch, id: c.id, topics: c.topics }) : c)) });

/**
 * Off this topic. A creator then on no topic at all, and not linked on anything here, is
 * removed from the family's list (`gone` says so - items elsewhere that named them stop showing the name).
 */
export function removeTopicCreator(h, topic, creatorId, linkedHere = false) {
  const c = (h.creators ?? []).find((x) => x.id === creatorId);
  if (!c) return { household: h, gone: false };
  const topics = (c.topics ?? []).filter((t) => t !== topic);
  if (!topics.length && !linkedHere) return { household: { ...h, creators: h.creators.filter((x) => x !== c) }, gone: true };
  return { household: { ...h, creators: h.creators.map((x) => (x === c ? { ...c, topics } : x)) }, gone: false };
}

/** Make an example your own (it becomes a creator with what you typed), or just remove it. */
export function replaceExample(h, topic, exampleIdToReplace, fields = null) {
  const out = meta(h, { examplesOff: add(h.household?.examplesOff, exampleIdToReplace) });
  return fields ? addTopicCreator(out, topic, fields) : out;
}

export function addTopicVideo(h, topic, fields) {
  const v = normaliseVideo({ ...fields, id: newId('vd'), topic });
  return v ? { ...h, videos: [...(h.videos ?? []), v] } : h;
}
/** A link that is not safe keeps the one it had; the rest of the change is kept. */
export const editVideo = (h, videoId, patch) => ({ ...h, videos: (h.videos ?? []).map((v) => (v.id === videoId
  ? normaliseVideo({ ...v, ...patch, id: v.id, topic: v.topic }) ?? normaliseVideo({ ...v, ...patch, url: v.url, id: v.id, topic: v.topic })
  : v)) });
export const removeVideo = (h, videoId) => ({ ...h, videos: (h.videos ?? []).filter((v) => v.id !== videoId) });

/** Fold a topic's place away (Hide), or bring it back (Show). */
export const setTopicHidden = (h, topic, hidden) => meta(h, {
  hiddenTopics: hidden ? add(h.household?.hiddenTopics, topic) : (h.household?.hiddenTopics ?? []).filter((t) => t !== topic),
});
