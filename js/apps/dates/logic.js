// Dates (D-102): ideas for time as a couple, shaped by your own childcare rule - with "only
// us", a date is never one that needs someone else to look after the children, and nothing
// asks. Prep, how long, cost, at home or out, energy, planned days, and both of you scoring it.
// Pure - no DOM.

import { normaliseNeed, toBuy, costOf } from '../parenting/activities.js';
import { normaliseLinks } from '../../links.js';

export { toBuy, costOf };
// Where the children are during the date.
export const KIDS = { asleep: 'Asleep at home', with: 'With us', away: 'Someone else has them' };
export const WHERE = { home: 'At home', out: 'Out' };
export const ENERGY = { low: 'Tired evening', any: 'Up for anything' };

const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const lines = (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const score = (v) => { const n = num(v); return n == null ? null : Math.max(1, Math.min(5, Math.round(n))); };

export function normaliseDate(d = {}) {
  return {
    ...d,
    dateId: str(d.dateId ?? d.id, 80), name: str(d.name, 120) || 'A date',
    kids: KIDS[d.kids] ? d.kids : 'asleep', where: WHERE[d.where] ? d.where : 'home', energy: ENERGY[d.energy] ? d.energy : 'any',
    prep: Math.max(0, num(d.prep) ?? 10), lasts: Math.max(5, num(d.lasts) ?? 90),
    needs: (Array.isArray(d.needs) ? d.needs : []).map(normaliseNeed).filter((x) => x.name).slice(0, 40),
    steps: lines(d.steps), plannedOn: isDay(d.plannedOn) ? d.plannedOn : null,
    logs: (Array.isArray(d.logs) ? d.logs : []).filter((l) => l && isDay(l.day)).map((l) => ({
      day: l.day, note: str(l.note, 1000),
      scores: Object.fromEntries(Object.entries(l.scores ?? {}).map(([k, v]) => [str(k, 40), score(v)]).filter(([, v]) => v != null)),
    })).slice(-100),
    own: d.own === true, removed: d.removed === true,
    ...normaliseLinks(d),
  };
}

export function datesOf(records, starter = STARTER_DATES) {
  const byId = new Map(records.map((r) => [r.dateId, r]));
  const out = [];
  for (const s of starter) { const r = byId.get(s.id); if (!r?.removed) out.push(normaliseDate({ ...s, ...(r ?? {}), dateId: s.id, starter: true })); }
  for (const r of records) if (r.own && !r.removed) out.push(normaliseDate(r));
  return out;
}

/** Where the children can be, under your childcare rule: with "only us", never with someone else. */
export const kidsAllowed = (rule) => (rule === 'us' ? ['asleep', 'with'] : Object.keys(KIDS));

/** How much you both liked it, 1-5 (null before the first time). */
export function loved(d) {
  const all = d.logs.flatMap((l) => Object.values(l.scores));
  return all.length ? Math.round((all.reduce((s, x) => s + x, 0) / all.length) * 10) / 10 : null;
}

/**
 * Dates that fit: always within the childcare rule; then where, energy, money and time.
 * @param ask { rule, kids: 'asleep'|'with'|'away'|null, where, energy: 'low'|null, free: true (nothing to buy), maxMinutes }
 */
export function pickDates(list, { rule = null, kids = null, where = null, energy = null, free = false, maxMinutes = null } = {}) {
  const ok = kidsAllowed(rule);
  return list.filter((d) => ok.includes(d.kids) && (!kids || d.kids === kids) && (!where || d.where === where) && (energy !== 'low' || d.energy === 'low')
    && (!free || !toBuy(d).length) && (maxMinutes == null || d.prep + d.lasts <= maxMinutes))
    .sort((a, b) => (loved(b) ?? 3) - (loved(a) ?? 3) || a.prep - b.prep);
}

export const plannedDates = (list, today) => list.filter((d) => d.plannedOn && d.plannedOn >= today).sort((a, b) => a.plannedOn.localeCompare(b.plannedOn));
export const logDate = (d, { day, scores = {}, note = '' }) => ({ ...d, logs: [...d.logs, { day, scores, note }], plannedOn: d.plannedOn && d.plannedOn <= day ? null : d.plannedOn });

// A starting point - change, remove, add your own. Most need nobody else to look after the children.
export const STARTER_DATES = [
  { id: 'floorpicnic', name: 'Lounge-floor picnic', kids: 'asleep', where: 'home', energy: 'low', prep: 15, lasts: 90, needs: ['A blanket', 'Candles', 'Picnic food'], steps: ['After bedtime: blanket on the lounge floor, candles, the food you both like.'] },
  { id: 'cooktogether', name: 'Cook something new together', kids: 'asleep', where: 'home', energy: 'any', prep: 10, lasts: 120, needs: ['Ingredients for a recipe neither of you has made'], steps: ['Choose the recipe together beforehand; one cooks, one is sous-chef, then swap.'] },
  { id: 'gametakeaway', name: 'Board game and takeaway', kids: 'asleep', where: 'home', energy: 'low', prep: 5, lasts: 120, needs: ['A board or card game', 'Takeaway - R300'], steps: ['Order in, phones away, best of three.'] },
  { id: 'filmwechose', name: 'A film you both chose', kids: 'asleep', where: 'home', energy: 'low', prep: 5, lasts: 130, needs: ['Snacks'], steps: ['Each picks three; the other chooses one of them.'] },
  { id: 'stargaze', name: 'Stargazing on the stoep', kids: 'asleep', where: 'home', energy: 'low', prep: 5, lasts: 60, needs: ['Blankets', 'Hot chocolate', 'A star app'], steps: ['Lights off outside; find three constellations.'] },
  { id: 'dessertoff', name: 'Dessert cook-off', kids: 'asleep', where: 'home', energy: 'any', prep: 10, lasts: 75, needs: ['Baking basics'], steps: ['Each makes a dessert in 30 minutes; judge each other kindly.'] },
  { id: 'spaathome', name: 'Spa evening at home', kids: 'asleep', where: 'home', energy: 'low', prep: 15, lasts: 90, needs: ['Bath salts or oil', 'Massage oil', 'Candles'], steps: ['Take turns: a foot rub, a shoulder massage, a long bath.'] },
  { id: 'questions', name: 'Questions night', kids: 'asleep', where: 'home', energy: 'low', prep: 0, lasts: 60, needs: ['Something nice to drink'], steps: ['Take turns: "What were you like at 10?", "What are you looking forward to?", "What made you laugh this week?"'] },
  { id: 'dreams', name: 'Dream-planning evening', kids: 'asleep', where: 'home', energy: 'any', prep: 5, lasts: 60, needs: ['Paper and pens'], steps: ['Each writes three dreams for the next five years; compare and add any to Goals.'] },
  { id: 'dance', name: 'Kitchen dance', kids: 'asleep', where: 'home', energy: 'any', prep: 2, lasts: 30, needs: ['Your song, or songs from when you met'], steps: ['Lights low, music on.'] },
  { id: 'sunrisewalk', name: 'Sunrise walk with coffee', kids: 'with', where: 'out', energy: 'any', prep: 10, lasts: 60, needs: ['A flask of coffee', 'The pram or carrier'], steps: ['Out early; the children come along, the conversation is yours.'] },
  { id: 'breakfastout', name: 'Early breakfast out', kids: 'with', where: 'out', energy: 'any', prep: 15, lasts: 75, needs: ['Breakfast - R350'], steps: ['Somewhere with space for the children; you two sit side by side.'] },
  { id: 'picnicpark', name: 'Picnic in the park', kids: 'with', where: 'out', energy: 'any', prep: 20, lasts: 120, needs: ['A blanket', 'Picnic food', 'Something for the children to play with'], steps: ['The children play nearby; you two sit and talk.'] },
  { id: 'drive', name: 'A drive to a viewpoint', kids: 'with', where: 'out', energy: 'low', prep: 10, lasts: 90, needs: ['Snacks', 'Your playlist'], steps: ['The children nap in the car; you talk, or just look.'] },
  { id: 'markets', name: 'Saturday market', kids: 'with', where: 'out', energy: 'any', prep: 10, lasts: 120, needs: ['Cash - R300'], steps: ['Wander, taste, choose one thing for each other.'] },
  { id: 'dinnerout', name: 'Dinner out, just the two of you', kids: 'away', where: 'out', energy: 'any', prep: 30, lasts: 150, needs: ['Dinner - R800'], steps: ['Book somewhere neither of you has been.'] },
  { id: 'show', name: 'A show or concert', kids: 'away', where: 'out', energy: 'any', prep: 30, lasts: 180, needs: ['Tickets - R600'], steps: ['Book early; dinner before if you can.'] },
  { id: 'hike', name: 'A hike together', kids: 'away', where: 'out', energy: 'any', prep: 20, lasts: 240, needs: ['Water', 'Snacks', 'Hats and sunscreen'], steps: ['A trail you both can manage; lunch at the top.'] },
];
