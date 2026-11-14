// Salary and costs, budget starting set and food per meal (D-119).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, whatMoves, startingRate, costsFromBudget, kindFromName, addMonth, monthsBetween, CPI, RENT } from '../js/apps/salary/logic.js';
import { normaliseMonth, monthSummary, copyMonth, startingSet, setLine, addItem, setItem, removeItem, perMeal, plannedOf, STARTING_SET } from '../js/apps/finance/logic.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const TODAY = '2026-11-13';

test('D-119 months: between and on', () => {
  assert.equal(monthsBetween('2023-05', '2026-11'), 42);
  assert.equal(addMonth('2023-05', 42), '2026-11');
  assert.equal(addMonth('2026-12', 1), '2027-01');
});

test('D-125 raises are dated entries on no assumed timeline; a payslip figure is not taxed again', () => {
  // A raise a month after starting, then December and June ones - entered in any order.
  const raises = [{ month: '2024-12', pct: 5 }, { month: '2023-06', pct: 10 }, { month: '2025-06', pct: 2 }];
  const p = plan({ salary: 60000, salaryPer: 'year', salaryKind: 'takehome', start: '2023-05', raises, raisePct: 0 }, TODAY);
  assert.equal(p.T, 42);
  near(p.at(0).takeHome, 5000);
  near(p.at(1).takeHome, 5500);            // June 2023
  near(p.at(18).takeHome, 5500);           // November 2024
  near(p.at(19).takeHome, 5775);           // December 2024
  near(p.at(25).takeHome, 5775 * 1.02);    // June 2025
  near(p.at(80).takeHome, 5775 * 1.02);    // nothing assumed: 0% from now on
  assert.deepEqual(plan({}, TODAY).missing, ['the salary you started on']);
});

test('D-126 a raise as the new salary from that month: the percentage worked out, and the other way round', () => {
  const raises = [{ id: 'a', month: '2024-01', salary: 54000 }, { id: 'b', month: '2025-01', pct: 10 }];
  const p = plan({ salary: 50000, salaryPer: 'year', salaryKind: 'takehome', start: '2023-05', raises, raisePct: 0 }, TODAY);
  near(p.at(8).takeHome, 4500);                   // January 2024: R54 000 a year
  near(p.entries[0].pct, 8);                       // +8%
  near(p.entries[1].salary, 59400);                // +10%: R59 400 a year
  near(p.at(20).takeHome, 4950);
});

test('D-125 after the last raise entry the assumed raise is spread month by month; old anniversary raises still read', () => {
  const v = { salary: 12000, salaryPer: 'month', salaryKind: 'takehome', raisePct: 12 };
  const p = plan(v, TODAY);                                       // a new job, no entries
  near(p.at(12).takeHome, 12000 * 1.12);                          // a year on: 12% in all
  near(p.at(1).takeHome, 12000 * 1.12 ** (1 / 12));               // a twelfth of it each month, no anniversary
  const q = plan({ ...v, raises: [{ month: '2027-03', pct: 5 }] }, TODAY);   // a raise you know is coming
  near(q.at(4).takeHome, 12000 * 1.05);                           // nothing assumed until it
  near(q.at(16).takeHome, 12000 * 1.05 * 1.12);                   // then 12% a year after it
  const old = plan({ salary: 60000, salaryKind: 'takehome', start: '2023-05', raises: [10, null, 5], raisePct: 0 }, TODAY);
  near(old.at(12).takeHome, 5500);                                // May 2024, the first anniversary
  near(old.at(36).takeHome, 5775);                                // May 2026, the third
  assert.equal(old.entries.length, 2);
});

test('D-119 a gross salary goes through the SARS tables; a new job starts today', () => {
  const p = plan({ salary: 30000, salaryPer: 'month' }, TODAY);
  assert.equal(p.T, 0);
  assert.ok(p.estimated);
  near(p.at(0).takeHome, 30000 - 56172 / 12 - 177.12);
});

test('D-119 own inflation: then and now for the past, starting rates by calendar year, own % ahead', () => {
  const costs = [
    { id: 'r', kind: 'rent', amount: 8000, now: 10000 },          // the family's own then and now
    { id: 'o', kind: 'other', amount: 2000 },                      // CPI by year
  ];
  const p = plan({ salary: 10000, salaryPer: 'month', salaryKind: 'takehome', start: '2023-05', raisePct: 0, costs }, TODAY);
  const t = p.at(p.T);
  // Rent reaches exactly the "now" figure today.
  near(p.where.find((w) => w.id === 'r').now, 10000);
  // Everything else: CPI month by month through 2023 to 2026.
  let f = 1;
  for (let m = 1; m <= 42; m += 1) f *= (1 + CPI.byYear[Number(addMonth('2023-05', m).slice(0, 4))] / 100) ** (1 / 12);
  near(p.where.find((w) => w.id === 'o').now, 2000 * f);
  near(t.basket, 10000 + 2000 * f);
  near(t.own, t.basket / 10000);
  near(t.real, 10000 / t.own);
  // From now on the rent rises by the starting figure; one year on:
  near(p.at(p.T + 12).basket - 2000 * f * (1 + CPI.future / 100), 10000 * (1 + RENT.national / 100), 0.5);
  // Its own % from now on beats it.
  const q = plan({ salary: 10000, salaryPer: 'month', salaryKind: 'takehome', start: '2023-05', raisePct: 0, costs: [{ ...costs[0], pct: 10 }] }, TODAY);
  near(q.at(q.T + 12).basket, 11000, 0.5);
});

test('D-119 starting rates name their source', () => {
  assert.equal(startingRate({ kind: 'bond' }).pct, 0);
  assert.equal(startingRate({ kind: 'rent', region: 'wc' }).pct, RENT.wc);
  assert.equal(startingRate({ kind: 'rent' }, 2024).pct, CPI.byYear[2024]);   // no rent figure for 2024: CPI
  assert.equal(startingRate({ kind: 'medical', scheme: 'bonitas' }, 2025).pct, 10.2);
  assert.equal(startingRate({ kind: 'medical', scheme: 'bonitas' }).pct, 8.8);
  assert.equal(startingRate({ kind: 'medical' }).pct, CPI.future);
  assert.equal(startingRate({ kind: 'electricity' }).pct, 9.01);
  for (const k of ['bond', 'rent', 'medical', 'electricity', 'other']) assert.ok(startingRate({ kind: k, scheme: 'discovery' }).source);
});

test('D-119 needed salary: costs, life events and what was left over, against the take-home', () => {
  const v = { salary: 20000, salaryPer: 'month', salaryKind: 'takehome', raisePct: 0, costs: [{ id: 'm', kind: 'bond', amount: 15000 }],
    events: [{ kind: 'cost', from: '2028-01', amount: 3000, risesWith: 'm' }, { kind: 'income', from: '2029-01', amount: 1000, risesWith: 'm' }] };
  const p = plan(v, TODAY);
  near(p.left0, 5000);
  near(p.at(0).needed, 20000);
  near(p.at(0).gap, 0);
  const jan28 = monthsBetween('2026-11', '2028-01');
  near(p.at(jan28 - 1).added, 0);
  near(p.at(jan28).added, 3000);                     // a bond does not rise, so neither does this
  near(p.at(jan28).gap, -3000);
  assert.equal(p.shortFrom, jan28);
  near(p.at(jan28 + 12).gap, -2000);                 // the income added from 2029
  // Raises are what close it most.
  const moves = whatMoves(v, TODAY, 60);
  assert.equal(moves[0].label, 'Your raises');
  assert.ok(moves[0].low < 0 && moves[0].high > 0);
});

test('D-119 costs from the budget: own-rate items stand alone, the rest by category', () => {
  assert.equal(kindFromName('Rent or bond'), 'rent');
  assert.equal(kindFromName('Home loan'), 'bond');
  assert.equal(kindFromName('Medical aid'), 'medical');
  const m = { lines: [
    { category: 'Home', items: [{ name: 'Rent or bond', planned: 9000 }, { name: 'Electricity', planned: 1200 }, { name: 'Water', planned: 400 }, { name: 'Garden', planned: 300 }] },
    { category: 'Food', items: [{ name: 'Groceries', planned: 6000 }] },
    { category: 'Gym', planned: 500 },
    { category: 'Children', off: true, items: [{ name: 'School fees', planned: 3000 }] },
  ] };
  const c = costsFromBudget(m);
  assert.deepEqual(c.map((x) => [x.name, x.kind, x.amount]), [['Rent or bond', 'rent', 9000], ['Electricity', 'electricity', 1200], ['Home', 'other', 700], ['Food', 'food', 6000], ['Gym', 'other', 500]]);
});

test('D-119 budget starting set: categories with items, no amounts, untick, rename, add and remove', () => {
  let m = startingSet(normaliseMonth({}, '2026-11'));
  assert.equal(m.lines.length, STARTING_SET.length);
  assert.ok(m.lines.every((l) => l.items.length && l.items.every((x) => x.planned === 0)));
  const food = m.lines.find((l) => l.category === 'Food');
  m = setItem(m, food.id, food.items[0].id, { planned: 6000 });
  m = addItem(m, food.id, 'Coffee out', 300);
  m = setLine(m, food.id, { category: 'Food and home' });
  const kids = m.lines.find((l) => l.category === 'Children');
  m = setLine(m, kids.id, { off: true });
  m = removeItem(m, food.id, food.items[1].id);
  m = normaliseMonth(m, '2026-11');                   // survives a save and reload
  const f = m.lines.find((l) => l.id === food.id);
  assert.equal(f.category, 'Food and home');
  assert.equal(plannedOf(f), 6300);
  assert.equal(f.items.length, STARTING_SET[1][1].length);
  const s = monthSummary(m);
  assert.equal(s.planned, 6300);
  assert.ok(!s.rows.some((r) => r.category === 'Children'));   // "We don't have this"
  const next = copyMonth(m, '2026-12');
  assert.equal(plannedOf(next.lines.find((l) => l.id === food.id)), 6300);
  next.lines[0].items[0].name = 'changed';
  assert.notEqual(m.lines[0].items[0].name, 'changed');        // a copy, not the same items
});

test('D-119 food per meal: the family’s own split of the day', () => {
  // R6 000 for 4: about R49 a person a day (365/12 days a month).
  const p = perMeal(6000, { people: 4 }, 800);
  near(p.perPersonDay, 6000 / 4 / (365 / 12));
  const d = p.meals.find((x) => x.key === 'dinner');
  near(d.perPerson, p.perPersonDay * 0.5);
  near(d.family, p.perPersonDay * 0.5 * 4);
  near(p.meals.reduce((s, x) => s + x.month, 0), 6000);
  near(p.dinnersOut, 800 / d.family);
  // Groceries too: the cleaning and toiletries come off first; shares need not add to 100.
  const q = perMeal(7000, { people: 4, groceriesToo: true, cleaning: 1000, shares: { breakfast: 1, lunch: 1, dinner: 2 } });
  near(q.forFood, 6000);
  near(q.meals[2].share, 50);
  assert.equal(perMeal(6000, {}), null);
});

test('the table follows the raises: a row in each raise month, never the anniversaries of starting', () => {
  const p = plan({ salary: 600000, start: '2022-03', raises: [{ month: '2022-12', pct: 6 }, { month: '2023-06', pct: 3 }], ahead: 5 }, '2026-11-14');
  const rows = p.years.map((r) => r.month);
  assert.deepEqual(rows.slice(0, 4), ['2022-03', '2022-12', '2023-06', '2026-11']);
  assert.ok(!rows.includes('2023-03') && !rows.includes('2024-03'), 'no anniversary rows');
  const dec = p.years[1]; const jun = p.years[2];
  assert.ok(dec.raise && Math.abs(dec.payPct - 6) < 0.01, 'December shows its own 6%');
  assert.ok(jun.raise && Math.abs(jun.payPct - 3) < 0.01, 'June shows its own 3%');
  assert.equal(p.years[3].payPct, 0, 'no raise between June 2023 and today');
});
