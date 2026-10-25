// Faith (product plan section 18): Bible reading by book and chapter, reading
// plans, reflections, lessons, questions and family discussion notes.
// Progress is shown as where you are - never as "behind" or a streak. Pure.

import { dayDiff } from '../../dates.js';

/** The 66 books (Protestant canon) with their chapter counts. */
export const BOOKS = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34], ['Joshua', 24], ['Judges', 21], ['Ruth', 4],
  ['1 Samuel', 31], ['2 Samuel', 24], ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10], ['Nehemiah', 13],
  ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31], ['Ecclesiastes', 12], ['Song of Songs', 8], ['Isaiah', 66], ['Jeremiah', 52],
  ['Lamentations', 5], ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9], ['Obadiah', 1], ['Jonah', 4], ['Micah', 7],
  ['Nahum', 3], ['Habakkuk', 3], ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13],
  ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6],
  ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1],
  ['3 John', 1], ['Jude', 1], ['Revelation', 22],
];
export const OLD_TESTAMENT = BOOKS.slice(0, 39).map(([b]) => b);
export const NEW_TESTAMENT = BOOKS.slice(39).map(([b]) => b);
const CHAPTERS = new Map(BOOKS);

/** Ready-made selections for a new plan. */
export const PRESETS = {
  gospels: { title: 'The four Gospels', books: ['Matthew', 'Mark', 'Luke', 'John'] },
  nt: { title: 'The New Testament', books: NEW_TESTAMENT },
  psalms: { title: 'Psalms', books: ['Psalms'] },
  proverbs: { title: 'Proverbs', books: ['Proverbs'] },
  whole: { title: 'The whole Bible', books: BOOKS.map(([b]) => b) },
};

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const key = (book, ch) => `${book}|${ch}`;

export function normalisePlan(p = {}) {
  const books = (Array.isArray(p.books) ? p.books : []).filter((b) => CHAPTERS.has(b));
  return {
    ...p,
    title: str(p.title, 150) || 'Reading plan',
    books: books.length ? [...new Set(books)] : ['John'],
    perDay: Math.min(20, Math.max(1, Math.round(Number(p.perDay) || 1))),
    startDay: typeof p.startDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.startDay) ? p.startDay : null,
    read: (Array.isArray(p.read) ? p.read : []).filter((k) => typeof k === 'string' && CHAPTERS.has(k.split('|')[0])),
    who: Array.isArray(p.who) ? p.who.filter((x) => typeof x === 'string') : [],
  };
}

/** Every chapter in the plan, in order. */
export function chapters(plan) {
  return plan.books.flatMap((b) => Array.from({ length: CHAPTERS.get(b) }, (_, i) => ({ book: b, chapter: i + 1, key: key(b, i + 1) })));
}

export function planProgress(plan) {
  const all = chapters(plan);
  const read = new Set(plan.read);
  const done = all.filter((c) => read.has(c.key)).length;
  return { done, total: all.length, share: all.length ? done / all.length : 0, daysLeft: Math.ceil((all.length - done) / plan.perDay) };
}

/** The next portion: the first unread chapters, as many as the plan reads a day. */
export function nextReading(plan) {
  const read = new Set(plan.read);
  return chapters(plan).filter((c) => !read.has(c.key)).slice(0, plan.perDay);
}

/** "John 3-4" or "John 21, Acts 1" */
export function describe(portion) {
  const parts = [];
  for (const c of portion) {
    const last = parts.at(-1);
    if (last && last.book === c.book && last.to === c.chapter - 1) last.to = c.chapter;
    else parts.push({ book: c.book, from: c.chapter, to: c.chapter });
  }
  return parts.map((p) => `${p.book} ${p.from}${p.to !== p.from ? `-${p.to}` : ''}`).join(', ');
}

export const markRead = (plan, keys) => ({ ...plan, read: [...new Set([...plan.read, ...keys])] });
export const markUnread = (plan, k) => ({ ...plan, read: plan.read.filter((x) => x !== k) });

export const planSummary = (p) => {
  const pr = planProgress(p);
  return { title: p.title, done: pr.done, total: pr.total, perDay: p.perDay };
};

/** Days since the plan started - offered as context, never compared with a target. */
export const daysIn = (plan, today) => (plan.startDay ? Math.max(0, dayDiff(plan.startDay, today)) + 1 : null);

export const NOTE_KINDS = { reflection: 'Reflection', lesson: 'Lesson', question: 'Question', passage: 'Meaningful passage', discussion: 'Family discussion' };

export function normaliseNote(n = {}, today) {
  return {
    ...n,
    kind: NOTE_KINDS[n.kind] ? n.kind : 'reflection',
    passage: str(n.passage, 120),
    text: str(n.text, 6000) || '(empty)',
    day: typeof n.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.day) ? n.day : today,
    who: typeof n.who === 'string' ? n.who : null,
  };
}

export const noteSummary = (n) => ({ title: n.text.split('\n')[0].slice(0, 90), kind: n.kind, passage: n.passage, day: n.day, who: n.who });
export const noteText = (n) => `${n.passage} ${n.text} ${NOTE_KINDS[n.kind]}`;
