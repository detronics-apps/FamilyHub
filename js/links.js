// Creators and video links (D-091): one household list of creators - a YouTuber,
// a pastor, a cook - each a name and a link, reused by every app; and on a
// journal entry, recipe, exercise or goal, the creators it came from plus the
// videos it refers to. Plain hyperlinks only: nothing is embedded or fetched.
// Pure: no DOM.

/** An http(s) link as typed, or '' - anything else (javascript:, data:) is never kept. */
export function safeUrl(v) {
  const text = String(v ?? '').trim();
  if (!text) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : '';
  } catch { return ''; }
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** The creators (ids) and videos ({ url, title }) on any item. */
export function normaliseLinks(x = {}) {
  return {
    creators: [...new Set((Array.isArray(x.creators) ? x.creators : []).filter((id) => typeof id === 'string' && id))].slice(0, 20),
    videos: (Array.isArray(x.videos) ? x.videos : []).map((v) => ({ url: safeUrl(v?.url), title: str(v?.title, 150) })).filter((v) => v.url).slice(0, 20),
  };
}

/** One video per line: the link, and a title after it if you like ("https://youtu.be/x Sourdough"). */
export function parseVideos(text) {
  return String(text ?? '').split('\n').map((line) => {
    const m = /(\S+:\/\/\S+|\S+\.\S+\/\S*)/.exec(line);
    return m ? { url: safeUrl(m[1]), title: line.replace(m[1], '').replace(/^[\s\-–:|]+|[\s\-–:|]+$/g, '').slice(0, 150) } : null;
  }).filter((v) => v?.url).slice(0, 20);
}
export const videosText = (videos = []) => videos.map((v) => [v.url, v.title].filter(Boolean).join(' ')).join('\n');

/** "youtube.com" - what a link shows when it has no title. */
export const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

const topicIds = (v) => [...new Set((Array.isArray(v) ? v : []).filter((t) => typeof t === 'string' && /^[a-z]{2,20}$/.test(t)))];

/** A creator; `topics` are the topics (sections) they are one of the family's general creators for (D-112). */
export function normaliseCreator(c = {}, newId = () => `cr_${Date.now().toString(36)}`) {
  return { id: str(c.id, 40) || newId(), name: str(c.name, 80) || 'Someone', url: safeUrl(c.url), note: str(c.note, 300), topics: topicIds(c.topics) };
}

/** A video kept on a topic (D-112): the link, a title, a note, and who made it if you like. Null without a safe link. */
export function normaliseVideo(v = {}, newId = () => `vd_${Date.now().toString(36)}`) {
  const url = safeUrl(v.url);
  if (!url) return null;
  return { id: str(v.id, 40) || newId(), url, title: str(v.title, 150), note: str(v.note, 300), topic: topicIds([v.topic])[0] ?? '', creatorId: str(v.creatorId, 40) };
}
