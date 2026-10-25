// The chores spreadsheet template. Chores belong to the household (people,
// rooms and history), so an import adds to the household rather than to a
// collection; rooms named in the file are created when they do not exist.
// Pure - no DOM.

import { numOrNull, yes } from '../../importer.js';

const FREQ = {
  daily: { unit: 'day', every: 1 }, 'every day': { unit: 'day', every: 1 },
  weekly: { unit: 'week', every: 1 }, 'every week': { unit: 'week', every: 1 },
  fortnightly: { unit: 'week', every: 2 }, biweekly: { unit: 'week', every: 2 },
  monthly: { unit: 'month', every: 1 }, 'every month': { unit: 'month', every: 1 },
  seasonal: { unit: 'month', every: 3 }, quarterly: { unit: 'month', every: 3 },
  yearly: { unit: 'year', every: 1 }, annual: { unit: 'year', every: 1 }, annually: { unit: 'year', every: 1 },
  once: { unit: 'once', every: 1 }, 'one-off': { unit: 'once', every: 1 }, 'just once': { unit: 'once', every: 1 },
};

/** "weekly", "every 3 days", "every 2 weeks", "once" ... Null when not understood. */
export function parseFrequency(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return { unit: 'week', every: 1 };
  if (FREQ[t]) return FREQ[t];
  const m = /^every\s+(\d+)\s+(day|week|month|year)s?$/.exec(t);
  return m ? { unit: m[2], every: Number(m[1]) } : null;
}

export const IMPORTER = {
  kind: 'chores', label: 'Chores', singular: 'chore', app: 'chores', household: true,
  columns: [
    { name: 'name', required: true, help: 'The chore, e.g. "Wipe counters".' },
    { name: 'room', help: 'The room or area. New rooms are added for you.' },
    { name: 'how_often', help: 'daily, weekly, fortnightly, monthly, seasonal, yearly, once - or "every 3 days".' },
    { name: 'minutes', help: 'Roughly how long, in minutes.' },
    { name: 'effort', help: 'low, medium or high.' },
    { name: 'important', help: 'Write "yes" to keep it visible until done.' },
    { name: 'instructions', help: 'How to do it.' },
  ],
  example: [
    { name: 'Wipe counters', room: 'Kitchen', how_often: 'daily', minutes: '5', effort: 'low' },
    { name: 'Clean the shower', room: 'Bathroom', how_often: 'every 2 weeks', minutes: '20', effort: 'high' },
    { name: 'Test the smoke alarm', room: '', how_often: 'monthly', minutes: '2', effort: 'low', important: 'yes' },
  ],
  key: (c) => c.name.trim().toLowerCase(),
  fromRow(v) {
    if (!v.name) return { error: 'No name.' };
    const frequency = parseFrequency(v.how_often);
    if (!frequency) return { error: `"${v.how_often}" is not a frequency Family Hub understands (try "weekly" or "every 3 days").` };
    const effort = String(v.effort || '').trim().toLowerCase();
    if (effort && !['low', 'medium', 'high'].includes(effort)) return { error: `Effort must be low, medium or high, not "${v.effort}".` };
    return {
      name: v.name,
      record: {
        name: v.name.trim(), room: String(v.room || '').trim(), frequency, minutes: numOrNull(v.minutes),
        effort: effort || null, importance: yes(v.important) ? 'high' : 'normal', instructions: v.instructions ?? '',
        kind: frequency.unit === 'once' ? 'oneoff' : 'routine',
      },
    };
  },
};
