// Planner (D-104): the family's week - sport, after-school activities, concerts - per child and
// per parent, with trips from Holidays, planned activities and planned dates shown alongside
// (read, never copied), and clashes pointed out. Pure - no DOM.

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);

export function normaliseEvent(e = {}) {
  return {
    ...e, eventId: str(e.eventId ?? e.id, 80), title: str(e.title, 120) || 'Something on',
    who: Array.isArray(e.who) ? e.who.filter((x) => typeof x === 'string') : [],
    day: isDay(e.day) ? e.day : null, start: isTime(e.start) ? e.start : null, end: isTime(e.end) ? e.end : null,
    where: str(e.where, 120), note: str(e.note, 1000),
    weekly: e.weekly === true, until: isDay(e.until) ? e.until : null,
  };
}

const D = (day) => new Date(`${day}T12:00:00Z`);
export const addDays = (day, n) => { const d = D(day); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** The Monday of the week a day falls in. */
export const weekOf = (day) => addDays(day, -((D(day).getUTCDay() + 6) % 7));

/** Every event on each day from `from` for `n` days, weekly ones repeated until their end. */
export function occurrences(events, from, n = 7) {
  const days = Array.from({ length: n }, (_, i) => addDays(from, i));
  return days.map((day) => ({
    day,
    items: events.filter((e) => e.day && (e.day === day || (e.weekly && e.day <= day && (!e.until || day <= e.until) && D(e.day).getUTCDay() === D(day).getUTCDay())))
      .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '')),
  }));
}

/** Other apps' dated things, for one day: trips (all day), planned activities and dates. */
export function alongside(day, { trips = [], activities = [], dates = [] }) {
  return [
    ...trips.filter((t) => isDay(t.startDay) && t.startDay <= day && day <= (isDay(t.endDay) ? t.endDay : t.startDay)).map((t) => ({ kind: 'trip', title: t.title, href: `#/holidays/item/${encodeURIComponent(t.id)}` })),
    ...activities.filter((a) => a.plannedOn === day).map((a) => ({ kind: 'activity', title: a.name, href: `#/parenting/idea/${encodeURIComponent(a.activityId)}` })),
    ...dates.filter((d) => d.plannedOn === day).map((d) => ({ kind: 'date', title: d.name, href: `#/dates/date/${encodeURIComponent(d.dateId)}` })),
  ];
}

const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/**
 * Two things at the same time for different people - someone has to be in two places.
 * Returns [[a, b]] for the day's timed items that overlap and share nobody.
 */
export function clashes(items) {
  const timed = items.filter((e) => e.start);
  const out = [];
  for (let i = 0; i < timed.length; i += 1) for (let j = i + 1; j < timed.length; j += 1) {
    const a = timed[i]; const b = timed[j];
    const aEnd = a.end ? mins(a.end) : mins(a.start) + 60; const bEnd = b.end ? mins(b.end) : mins(b.start) + 60;
    if (mins(a.start) < bEnd && mins(b.start) < aEnd && !a.who.some((w) => b.who.includes(w))) out.push([a, b]);
  }
  return out;
}
