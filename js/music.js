// The decisions behind the shared music player: which files count as music,
// the play order, what to do when a timer ends, and the remembered preferences.
// The player itself (an <audio> element) lives in js/ui/media.js.

export const AUDIO_TYPES = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm',
};

export const extension = (name) => (/\.([a-z0-9]+)$/i.exec(String(name)) ?? [])[1]?.toLowerCase() ?? '';
export const isAudioName = (name) => Boolean(AUDIO_TYPES[extension(name)]) && !String(name).startsWith('.');

/** "02 - Morning Song.mp3" -> "Morning Song" */
export function trackTitle(name) {
  return String(name).replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]+/, '').replace(/[_]+/g, ' ').trim() || String(name);
}

/** A small seeded shuffle (mulberry32), so an order can be repeated in a test. */
export function shuffled(list, seed = Date.now()) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The queue as data: tracks in play order and the current position. */
export function makeQueue(tracks, { shuffle = true, seed } = {}) {
  const order = shuffle ? shuffled(tracks, seed) : tracks.slice();
  return { tracks: order, index: order.length ? 0 : -1 };
}

export const currentTrack = (q) => (q.index >= 0 ? q.tracks[q.index] : null);

/** Next track, wrapping round; a queue of nothing stays empty. */
export function nextInQueue(q) {
  if (!q.tracks.length) return q;
  return { ...q, index: (q.index + 1) % q.tracks.length };
}

/** Drop a track that failed to play, keeping the position sensible. */
export function dropTrack(q, index) {
  const tracks = q.tracks.filter((_, i) => i !== index);
  if (!tracks.length) return { tracks, index: -1 };
  return { tracks, index: Math.min(index, tracks.length - 1) };
}

export const OFFER = ['ask', 'always', 'never'];
export const END_ACTIONS = ['stop', 'fade', 'continue', 'ask'];

export const defaultMusicPrefs = () => ({ offer: 'ask', endAction: 'fade', source: 'folder', shuffle: true, volume: 0.8 });

export function normaliseMusicPrefs(p) {
  const d = defaultMusicPrefs();
  const r = p && typeof p === 'object' ? p : {};
  const v = Number(r.volume);
  return {
    offer: OFFER.includes(r.offer) ? r.offer : d.offer,
    endAction: END_ACTIONS.includes(r.endAction) ? r.endAction : d.endAction,
    source: ['folder', 'device'].includes(r.source) ? r.source : d.source,
    shuffle: typeof r.shuffle === 'boolean' ? r.shuffle : d.shuffle,
    volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d.volume,
  };
}

/** Volumes for a fade-out: from `volume` to 0 in `steps` equal steps. */
export function fadeSteps(volume, steps = 10) {
  return Array.from({ length: steps }, (_, i) => Number((volume * (1 - (i + 1) / steps)).toFixed(4)));
}

export const END_ACTION_LABEL = {
  stop: 'Stop the music',
  fade: 'Fade the music out',
  continue: 'Keep playing',
  ask: 'Ask me',
};
