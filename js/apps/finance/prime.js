// Prime over the years (D-166): every change to the prime lending rate since 2005, so a bond can
// be worked out as prime plus the family's own margin, against what prime has really done.
// Prime is the Reserve Bank's repo rate plus 3.5 points. Pure - no DOM.

/** [day it took effect, prime %]. Checked 2026-11-26; prime 10.75% confirmed on resbank.co.za that day. */
export const PRIME_CHANGES = [
  ['2005-04-18', 10.5],
  ['2006-06-12', 11], ['2006-08-04', 11.5], ['2006-10-16', 12], ['2006-12-08', 12.5],
  ['2007-06-08', 13], ['2007-08-16', 13.5], ['2007-10-12', 14], ['2007-12-07', 14.5],
  ['2008-04-11', 15], ['2008-06-13', 15.5], ['2008-12-12', 15],
  ['2009-02-06', 14], ['2009-03-25', 13], ['2009-05-04', 12], ['2009-05-28', 11], ['2009-08-14', 10.5],
  ['2010-03-26', 10], ['2010-09-10', 9.5], ['2010-11-19', 9],
  ['2012-07-20', 8.5],
  ['2014-01-30', 9], ['2014-07-18', 9.25],
  ['2015-07-24', 9.5], ['2015-11-19', 9.75],
  ['2016-01-29', 10.25], ['2016-03-18', 10.5],
  ['2017-07-21', 10.25],
  ['2018-03-29', 10], ['2018-11-23', 10.25],
  ['2019-07-19', 10],
  ['2020-01-17', 9.75], ['2020-03-20', 8.75], ['2020-04-15', 7.75], ['2020-05-22', 7.25], ['2020-07-24', 7],
  ['2021-11-19', 7.25],
  ['2022-01-28', 7.5], ['2022-03-25', 7.75], ['2022-05-20', 8.25], ['2022-07-22', 9], ['2022-09-23', 9.75], ['2022-11-25', 10.5],
  ['2023-01-27', 10.75], ['2023-03-31', 11.25], ['2023-05-26', 11.75],
  ['2024-09-20', 11.5], ['2024-11-22', 11.25],
  ['2025-01-31', 11], ['2025-05-30', 10.75], ['2025-08-01', 10.5], ['2025-11-21', 10.25],
  ['2026-05-29', 10.5], ['2026-09-25', 10.75],
];
export const PRIME_TO = '2026-11';   // the last month the list was checked
export const PRIME_SOURCE = 'BetterBond prime rate table (2005 to 2016) and Unmapped Dataworks, every Reserve Bank change since 2015 (2016 to 2026); prime today from resbank.co.za';

/**
 * What is normal (sourced): through ooba, the average bond in Q2 2026 was granted at prime less
 * 0.66 points. Each bank sets its own margin from the deposit, income and credit record.
 */
export const MARGIN_NORMAL = { value: -0.66, source: 'ooba Home Loans, average for Q2 2026' };

/** Prime in force on a day ('YYYY-MM-DD'), or at the end of a month ('YYYY-MM'). Null before the list starts. */
export function primeAt(when) {
  const day = /^\d{4}-\d{2}$/.test(when) ? `${when}-31` : String(when);
  let pct = null;
  for (const [d, p] of PRIME_CHANGES) { if (d <= day) pct = p; else break; }
  return pct;
}

const addMonths = (ym, k) => { const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

/** Month by month: [{ ym, pct }] from `fromYM` to `toYM`, both included. */
export function primeMonths(fromYM, toYM = PRIME_TO) {
  const out = [];
  for (let ym = fromYM; ym <= toYM; ym = addMonths(ym, 1)) out.push({ ym, pct: primeAt(ym) });
  return out.filter((x) => x.pct != null);
}

/** The last `years` years up to PRIME_TO: lowest, highest (the first month each was reached), average, now. */
export function primeStats(years = 20) {
  const months = primeMonths(addMonths(PRIME_TO, -(years * 12 - 1)));
  const low = Math.min(...months.map((m) => m.pct)); const high = Math.max(...months.map((m) => m.pct));
  return {
    years, months, low, high,
    lowYM: months.find((m) => m.pct === low).ym, highYM: months.find((m) => m.pct === high).ym,
    avg: Math.round((months.reduce((s, m) => s + m.pct, 0) / months.length) * 100) / 100,
    now: months.at(-1).pct,
  };
}

/**
 * Bad start or good start (D-166): the bond rate at the 20-year high (or low) for the first
 * `years`, then at the 20-year average - each plus the family's margin - as "Rate changes" what-ifs.
 */
export function startTest(kind, { fromYM, margin = 0, years = 5 }) {
  const s = primeStats();
  const first = kind === 'bad' ? s.high : s.low;
  const r = (p) => Math.round((p + margin) * 100) / 100;
  return [
    { kind: 'rate', from: fromYM, to: null, amount: r(first), on: true, note: kind === 'bad' ? 'Bad start' : 'Good start' },
    { kind: 'rate', from: addMonths(fromYM, years * 12), to: null, amount: r(s.avg), on: true, note: kind === 'bad' ? 'Bad start: then the average' : 'Good start: then the average' },
  ];
}
