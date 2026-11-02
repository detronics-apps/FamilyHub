// Goals (D-102): dreams and goals the two of you share - why it matters, by when, the next small
// step, and where it stands. Money stays in Finance and trips in Holidays: a goal only links to them.
// Pure - no DOM.

export const STATUS = { someday: 'Someday', planning: 'Planning', doing: 'Doing', done: 'Done' };

const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function normaliseGoal(g = {}) {
  return {
    ...g,
    goalId: str(g.goalId ?? g.id, 80), name: str(g.name, 120) || 'Our goal', why: str(g.why, 2000), next: str(g.next, 300),
    by: isDay(g.by) ? g.by : null, status: STATUS[g.status] ? g.status : 'someday',
    doneOn: isDay(g.doneOn) ? g.doneOn : null,
    financeGoal: str(g.financeGoal, 80) || null, trip: str(g.trip, 80) || null,
  };
}

/** Doing first, then planning, then someday - each soonest first; done kept apart, latest first. */
export function grouped(goals) {
  const by = (a, b) => (a.by ?? '9999').localeCompare(b.by ?? '9999') || a.name.localeCompare(b.name);
  return {
    doing: goals.filter((g) => g.status === 'doing').sort(by),
    planning: goals.filter((g) => g.status === 'planning').sort(by),
    someday: goals.filter((g) => g.status === 'someday').sort(by),
    done: goals.filter((g) => g.status === 'done').sort((a, b) => (b.doneOn ?? '').localeCompare(a.doneOn ?? '')),
  };
}

/** Moving to Done records the day; moving away clears it. */
export const setStatus = (g, status, today) => ({ ...g, status, doneOn: status === 'done' ? g.doneOn ?? today : null });

/** "R12 000 of R40 000 (30%)" from the linked Finance goal's summary. */
export function moneyLine(fin) {
  if (!fin || !(Number(fin.target) > 0)) return null;
  const r = (x) => `R${Math.round(Number(x) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
  return `${r(fin.current)} of ${r(fin.target)} (${Math.min(100, Math.round(((Number(fin.current) || 0) / Number(fin.target)) * 100))}%)`;
}
