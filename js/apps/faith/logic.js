// Faith (product plan section 18): Bible reading by book and chapter, reading
// plans, reflections, lessons, questions and family discussion notes.
// Progress is shown as where you are - never as "behind" or a streak. Pure.

import { dayDiff } from '../../dates.js';
import { TOPICS } from './guide.js';

const TOPIC_IDS = new Set(Object.keys(TOPICS));
const TOPIC_LABELS = Object.fromEntries(Object.entries(TOPICS).map(([k, t]) => [k, t.label]));

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

// A journal entry. Each kind has a heading of its own, the questions it is trying
// to answer (each with where it stands), the passages it is about (picked, not
// typed), notes, topics from a list and finer terms of your own - so it can be
// found again. Entries written before kept their text as notes.
export const NOTE_KINDS = {
  reflection: 'Reflection', lesson: 'Lesson', question: 'Question', passage: 'Meaningful passage',
  message: 'Message heard', discussion: 'Family discussion',
};
export const QUESTION_STATUS = { new: 'Only the question so far', research: 'Needs more reading', answered: 'Found a reasonable answer' };
/** The same, as one-word names for chips and badges - the longer wording is their hover text. */
export const QUESTION_SHORT = { new: 'New', research: 'Reading', answered: 'Answered' };
export const VERSIONS = {
  niv: 'NIV', esv: 'ESV', kjv: 'KJV', nkjv: 'NKJV', nlt: 'NLT', nasb: 'NASB', csb: 'CSB', msg: 'The Message',
  afr53: 'Afrikaans 1933/53', afr83: 'Afrikaans 1983', nlv: 'Nuwe Lewende Vertaling', b2020: 'Bybel 2020', other: 'Other',
};
export const chaptersIn = (book) => CHAPTERS.get(book) ?? 0;

const int = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 && n <= max ? n : null; };
const terms = (v) => [...new Set((Array.isArray(v) ? v : []).map((t) => str(t, 40).toLowerCase()).filter(Boolean))].slice(0, 30);

/** One passage: a book and chapter from the canon, verses optional ("John 15", "John 15:5", "John 15:5-8"). */
export function normalisePassage(p = {}) {
  if (!CHAPTERS.has(p.book)) return null;
  const chapter = int(p.chapter, CHAPTERS.get(p.book)) ?? 1;
  const from = int(p.from, 200);
  const to = from ? int(p.to, 200) : null;
  return { version: VERSIONS[p.version] ? p.version : '', book: p.book, chapter, from, to: to && to > from ? to : null };
}
export const passageRef = (p) => `${p.book} ${p.chapter}${p.from ? `:${p.from}${p.to ? `-${p.to}` : ''}` : ''}${p.version ? ` (${VERSIONS[p.version]})` : ''}`;

export function normaliseNote(n = {}, today) {
  const text = str(n.notes ?? n.text, 6000);
  return {
    ...n,
    kind: NOTE_KINDS[n.kind] ? n.kind : 'reflection',
    heading: str(n.heading, 150) || text.split('\n')[0].slice(0, 90) || 'Untitled',
    questions: (Array.isArray(n.questions) ? n.questions : []).filter((q) => q && str(q.text)).slice(0, 20).map((q, i) => ({
      id: str(q.id, 40) || `q${i}`, text: str(q.text, 500), status: QUESTION_STATUS[q.status] ? q.status : 'new', answer: str(q.answer, 4000),
    })),
    passages: (Array.isArray(n.passages) ? n.passages : []).map(normalisePassage).filter(Boolean).slice(0, 30),
    passage: str(n.passage, 120),                  // a passage typed before passages were picked from lists
    notes: text,
    topics: [...new Set((Array.isArray(n.topics) ? n.topics : []).filter((t) => TOPIC_IDS.has(t)))],
    terms: terms(n.terms),
    day: typeof n.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.day) ? n.day : today,
    who: typeof n.who === 'string' ? n.who : null,
    text: undefined,
  };
}

export const noteSummary = (n) => ({
  ix: 2,
  title: n.heading, kind: n.kind, day: n.day, who: n.who, topics: n.topics, terms: n.terms,
  refs: [...n.passages.map(passageRef), n.passage].filter(Boolean),
  questions: n.questions.map((q) => ({ id: q.id, text: q.text, status: q.status })),
});
export const noteText = (n) => [n.heading, NOTE_KINDS[n.kind], n.notes, n.passage, ...n.passages.map(passageRef), ...n.topics.map((t) => TOPIC_LABELS[t]), ...n.terms, ...n.questions.flatMap((q) => [q.text, q.answer])].join(' ');

/** Entries matching a kind, a topic, a term and a question status - every one chosen must match. */
export function filterNotes(list, { kind = '', topic = '', term = '', status = '' } = {}) {
  return list.filter((n) => (!kind || n.kind === kind) && (!topic || n.topics.includes(topic)) && (!term || n.terms.includes(term))
    && (!status || n.questions.some((q) => q.status === status)));
}

/** Every question across the journal, newest entry first - to come back to and reflect on. */
export const allQuestions = (list, status = '') => list.flatMap((n) => n.questions.filter((q) => !status || q.status === status).map((q) => ({ ...q, entry: n.id, heading: n.heading, day: n.day })))
  .sort((a, b) => String(b.day).localeCompare(String(a.day)));

/** The family's own notes on a book's "why" and "about", one record per book - "1 John" is kept as book-1-john. */
export const bookNoteId = (book) => `book-${book.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
export const normaliseBookNote = (b = {}, book = b.book) => ({ id: bookNoteId(book), book, why: String(b.why ?? '').trim().slice(0, 2000), about: String(b.about ?? '').trim().slice(0, 2000) });

/** What the family has logged on a topic - its passages and questions, newest entry first - shown with the guide's starting points. */
export function loggedOn(list, topic) {
  const on = filterNotes(list, { topic }).sort((a, b) => String(b.day).localeCompare(String(a.day)));
  return { passages: on.flatMap((n) => n.refs.map((ref) => ({ ref, entry: n.id, heading: n.heading }))), questions: allQuestions(on) };
}

/** The terms already used, most used first - offered when adding one, so "tattoos" is always spelt the same. */
export function termsUsed(list) {
  const n = new Map();
  for (const x of list) for (const t of x.terms) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}
