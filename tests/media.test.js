import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTimer, pauseTimer, resumeTimer, remainingMs, elapsedMs, isFinished, fmtClock } from '../js/timer.js';
import { isAudioName, trackTitle, makeQueue, nextInQueue, currentTrack, dropTrack, normaliseMusicPrefs, fadeSteps, shuffled } from '../js/music.js';

test('timer counts down, pauses, resumes, and never goes negative', () => {
  let t = startTimer(5, 0);
  assert.equal(remainingMs(t, 60_000), 4 * 60_000);
  t = pauseTimer(t, 60_000);
  assert.equal(remainingMs(t, 600_000), 4 * 60_000, 'paused time does not count');
  t = resumeTimer(t, 600_000);
  assert.equal(remainingMs(t, 660_000), 3 * 60_000);
  assert.equal(isFinished(t, 10_000_000), true);
  assert.equal(remainingMs(t, 10_000_000), 0);
});

test('an open-ended session has no end', () => {
  const t = startTimer(null, 0);
  assert.equal(remainingMs(t, 999_999), null);
  assert.equal(isFinished(t, 999_999), false);
  assert.equal(elapsedMs(t, 90_000), 90_000);
});

test('clock text', () => {
  assert.equal(fmtClock(5 * 60_000), '5:00');
  assert.equal(fmtClock(61_500), '1:02');
  assert.equal(fmtClock(3_723_000), '1:02:03');
  assert.equal(fmtClock(-5), '0:00');
});

test('only audio files count as music; names become titles', () => {
  for (const n of ['a.mp3', 'B.M4A', 'c.ogg', 'd.flac', 'e.wav']) assert.ok(isAudioName(n), n);
  for (const n of ['notes.txt', 'cover.jpg', '.hidden.mp3', 'mp3']) assert.ok(!isAudioName(n), n);
  assert.equal(trackTitle('02 - Morning_Song.mp3'), 'Morning Song');
});

test('queue: shuffle is a permutation and repeatable; next wraps; a failed track is dropped', () => {
  const tracks = ['a', 'b', 'c', 'd', 'e'];
  const s = shuffled(tracks, 42);
  assert.deepEqual(s.slice().sort(), tracks);
  assert.deepEqual(shuffled(tracks, 42), s);
  let q = makeQueue(tracks, { shuffle: false });
  assert.equal(currentTrack(q), 'a');
  for (let i = 0; i < 5; i += 1) q = nextInQueue(q);
  assert.equal(currentTrack(q), 'a', 'wraps round');
  q = dropTrack(q, 0);
  assert.equal(currentTrack(q), 'b');
  assert.equal(currentTrack(dropTrack({ tracks: ['x'], index: 0 }, 0)), null);
  assert.equal(currentTrack(makeQueue([])), null);
});

test('preferences are repaired; fade goes to silence', () => {
  assert.deepEqual(normaliseMusicPrefs({ offer: 'sometimes', endAction: 'explode', volume: 7 }), { offer: 'ask', endAction: 'fade', source: 'folder', shuffle: true, volume: 1 });
  const f = fadeSteps(0.8, 4);
  assert.deepEqual(f, [0.6, 0.4, 0.2, 0]);
});

test('a long chore still counts; an abandoned timer asks, then stops', async () => {
  const { checkInMs, checkState, ringOf, ANSWER_MS } = await import('../js/timer.js');
  const MIN = 60000;
  const t = startTimer(5, 0);                               // unpack the dishwasher, 5 min
  assert.deepEqual(ringOf(t, 2.5 * MIN), { fill: 0.5, over: false });
  assert.deepEqual(ringOf(t, 7.5 * MIN), { fill: 0.5, over: true }, 'past 5 min: a second lap');
  assert.equal(ringOf(t, 60 * MIN).fill, 1);
  assert.equal(checkInMs(t), 30 * MIN, 'at least half an hour');
  assert.equal(checkInMs(startTimer(45, 0)), 135 * MIN, 'three times the expected');
  assert.equal(checkInMs(startTimer(null, 0)), 60 * MIN);
  assert.equal(checkState(t, 29 * MIN, 30 * MIN), 'running');
  assert.equal(checkState(t, 30 * MIN, 30 * MIN), 'ask');
  assert.equal(checkState(t, 30 * MIN + ANSWER_MS - 1, 30 * MIN, 30 * MIN), 'ask');
  assert.equal(checkState(t, 30 * MIN + ANSWER_MS, 30 * MIN, 30 * MIN), 'stop', 'nobody answered');
  assert.equal(checkState(t, 50 * MIN, 60 * MIN, null), 'running', 'after "Still going" the next check-in is further on');
});
