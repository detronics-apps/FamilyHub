// The shared music player: one <audio> element for the whole app, so starting
// another task never restarts the playlist, and any mini-app with the
// `media:audio` permission uses the same player through hub.media.
//
// Sources (DECISIONS.md D-021):
//   'folder' - audio files in Data/Media/Music of the connected Drive folder.
//              Only the names are listed; each file is read when it is played.
//   'device' - files chosen on this device for this session (phones).
// Nothing is uploaded anywhere. The only cache is the track currently loaded,
// held as an object URL and released when the next one starts.
//
// Playback starts only from a click: browsers block sound that starts by itself.
// Every failure is caught and reported here; nothing in this file can stop a
// task from being completed.

import { el, clear } from './dom.js';
import { isAudioName, trackTitle, makeQueue, currentTrack, nextInQueue, dropTrack, fadeSteps, AUDIO_TYPES, extension } from '../music.js';
import { PATHS } from '../folder-sync.js';

export function createMedia({ getStore, getPrefs, onChange }) {
  const audio = new Audio();
  audio.preload = 'auto';
  let queue = makeQueue([]);
  let url = null;
  let deviceFiles = [];
  let fading = null;
  const state = { status: 'idle', title: '', error: '', source: null, count: 0 };
  const listeners = new Set();
  let bar = null;

  const emit = () => { paintBar(); onChange?.(); for (const fn of listeners) fn(state); };
  const set = (patch) => { Object.assign(state, patch); emit(); };

  /** Names of the music files available now (no audio is read). */
  async function listTracks(source = getPrefs().source) {
    if (source === 'device') return deviceFiles.map((f, i) => ({ id: `d${i}`, name: f.name, file: f }));
    const store = getStore();
    if (!store || store.kind !== 'folder') return [];
    const entries = (await store.list(PATHS.music)) ?? [];
    return entries.filter((e) => e.kind === 'file' && isAudioName(e.name)).map((e) => ({ id: e.name, name: e.name, path: `${PATHS.music}/${e.name}` }));
  }

  function chooseDeviceFiles(fileList) {
    deviceFiles = [...fileList].filter((f) => isAudioName(f.name) || f.type.startsWith('audio/'));
    return deviceFiles.length;
  }

  async function load(track) {
    const file = track.file ?? await getStore()?.file(track.path);
    if (!file) throw new Error(`${track.name} could not be read.`);
    const blob = file.type ? file : new Blob([file], { type: AUDIO_TYPES[extension(track.name)] });
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    audio.src = url;
  }

  /** Play the current track, skipping any that cannot be played. */
  async function playCurrent() {
    for (let guard = 0; guard < 50; guard += 1) {
      const track = currentTrack(queue);
      if (!track) { set({ status: 'error', error: 'None of the music files could be played. The task carries on without music.' }); return false; }
      try {
        await load(track);
        audio.volume = getPrefs().volume;
        await audio.play();
        set({ status: 'playing', title: trackTitle(track.name), error: '' });
        return true;
      } catch (err) {
        if (err?.name === 'NotAllowedError') {
          set({ status: 'paused', title: trackTitle(track.name), error: 'Press play to start the music - the browser needs a tap first.' });
          return false;
        }
        queue = dropTrack(queue, queue.index);
      }
    }
    return false;
  }

  /** Start music (call from a click). Keeps playing if already playing. */
  async function start({ source = getPrefs().source } = {}) {
    try {
      if (state.status === 'playing') return true;
      if (state.status === 'paused' && queue.tracks.length && state.source === source) return resume();
      set({ status: 'loading', error: '', source });
      const tracks = await listTracks(source);
      if (!tracks.length) {
        set({
          status: 'error',
          error: source === 'device'
            ? 'No music files were chosen. You can choose some in Settings, under Music.'
            : 'No music found in your Drive folder (Data / Media / Music). The task carries on without music.',
        });
        return false;
      }
      queue = makeQueue(tracks, { shuffle: getPrefs().shuffle });
      set({ count: tracks.length });
      return playCurrent();
    } catch (err) {
      set({ status: 'error', error: `Music could not start: ${err.message}` });
      return false;
    }
  }

  function pause() { cancelFade(); audio.pause(); if (state.status === 'playing') set({ status: 'paused' }); }
  async function resume() {
    try { await audio.play(); set({ status: 'playing', error: '' }); return true; } catch (err) { set({ error: err.message }); return false; }
  }
  async function skip() { queue = nextInQueue(queue); cancelFade(); return playCurrent(); }

  function stop() {
    cancelFade();
    audio.pause();
    audio.removeAttribute('src');
    if (url) { URL.revokeObjectURL(url); url = null; }
    set({ status: 'idle', title: '', error: '' });
  }

  function cancelFade() {
    if (fading) { clearInterval(fading); fading = null; audio.volume = getPrefs().volume; }
  }

  function fadeOut(ms = 6000) {
    if (state.status !== 'playing') return;
    const steps = fadeSteps(audio.volume, 12);
    let i = 0;
    cancelFade();
    fading = setInterval(() => {
      audio.volume = steps[i] ?? 0;
      i += 1;
      if (i >= steps.length) { clearInterval(fading); fading = null; stop(); }
    }, ms / steps.length);
  }

  /** What the timer asks for when it runs out: 'stop' | 'fade' | 'continue'. ('ask' is handled by the screen.) */
  function onTimerEnd(action) {
    if (action === 'stop') stop();
    else if (action === 'fade') fadeOut();
  }

  // A track ending in the middle of a fade-out finishes the fade, rather than starting the next song.
  audio.addEventListener('ended', () => { if (fading) stop(); else skip(); });
  audio.addEventListener('error', () => { if (state.status === 'playing') { queue = dropTrack(queue, queue.index); playCurrent(); } });

  /** A small player bar that lives outside the re-rendered page, so it never flickers or resets. */
  function paintBar() {
    if (!bar) {
      bar = el('div', { class: 'player', role: 'region', 'aria-label': 'Music' });
      document.body.append(bar);
    }
    const active = state.status === 'playing' || state.status === 'paused' || state.status === 'loading';
    bar.hidden = !active;
    clear(bar);
    if (!active) return;
    bar.append(
      el('span', { class: 'player__note', 'aria-hidden': 'true', text: '♪' }),
      el('span', { class: 'player__title', text: state.status === 'loading' ? 'Starting music…' : state.title }),
      state.status === 'playing'
        ? el('button', { class: 'btn btn-small', type: 'button', text: 'Pause', 'data-field': 'music-pause', on: { click: pause } })
        : el('button', { class: 'btn btn-small', type: 'button', text: 'Play', 'data-field': 'music-play', on: { click: resume } }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Skip', 'aria-label': 'Next track', on: { click: skip } }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Stop', on: { click: stop } }),
    );
  }

  return {
    state,
    listTracks, chooseDeviceFiles, start, pause, resume, skip, stop, fadeOut, onTimerEnd,
    deviceFileCount: () => deviceFiles.length,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
