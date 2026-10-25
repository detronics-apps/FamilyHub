// Calendar days as 'YYYY-MM-DD' strings. A chore is due on a day, not at a
// minute, so all recurrence logic works in whole local days. Arithmetic goes
// through UTC so daylight-saving changes can never shift a day.

const pad = (n) => String(n).padStart(2, '0');
const DAY_MS = 86400000;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (s) => typeof s === 'string' && DAY_RE.test(s) && !Number.isNaN(ms(s));

function ms(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromMs(t) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The local calendar day of a Date. */
export const toDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** b - a, in days. */
export const dayDiff = (a, b) => Math.round((ms(b) - ms(a)) / DAY_MS);

export const addDays = (day, n) => fromMs(ms(day) + n * DAY_MS);

/** Add months, clamping to the end of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const total = (m - 1) + n;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, last))}`;
}

/** One step of a frequency. `once` has no next step. */
export function addInterval(day, freq) {
  const every = Math.max(1, Math.round(Number(freq?.every) || 1));
  switch (freq?.unit) {
    case 'day': return addDays(day, every);
    case 'week': return addDays(day, every * 7);
    case 'month': return addMonths(day, every);
    case 'year': return addMonths(day, every * 12);
    default: return null;
  }
}

/** Rough length of one cycle in days, for "how many cycles has this waited". */
export function intervalDays(freq) {
  const every = Math.max(1, Number(freq?.every) || 1);
  return { day: 1, week: 7, month: 30.44, year: 365.25 }[freq?.unit] * every || null;
}

/** The Monday of the week a day falls in. */
export function weekStart(day) {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();   // 0 = Sunday
  return addDays(day, -((d + 6) % 7));
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'today', 'tomorrow', 'yesterday', else 'Thu 30 Oct'. */
export function fmtDay(day, today) {
  const diff = dayDiff(today, day);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  const d = new Date(ms(day));
  const year = day.slice(0, 4) === today.slice(0, 4) ? '' : ` ${day.slice(0, 4)}`;
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}${year}`;
}

/** 'today', 'yesterday', '3 days ago', '2 weeks ago', '4 months ago'. */
export function fmtAgo(day, today) {
  const diff = dayDiff(day, today);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 14) return `${diff} days ago`;
  if (diff < 60) return `${Math.round(diff / 7)} weeks ago`;
  if (diff < 730) return `${Math.round(diff / 30.44)} months ago`;
  return `${Math.round(diff / 365.25)} years ago`;
}

/** How often, in words: 'daily', 'every 2 weeks', 'just once'. */
export function fmtFrequency(freq) {
  const every = Math.max(1, Number(freq?.every) || 1);
  if (freq?.unit === 'once') return 'just once';
  if (freq?.unit === 'month' && every === 3) return 'seasonal (every 3 months)';
  const single = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }[freq?.unit];
  if (every === 1 && single) return single;
  return `every ${every} ${freq?.unit}s`;
}
