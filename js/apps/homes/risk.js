// "Can you carry it?" (D-084): what could make this home financially uncomfortable for
// this household - the home's own risks and the family's ability to absorb them. No
// score: each factor says what it is based on, and a factor without the figures it
// needs says "not assessed" instead of assuming anything. Pure - no DOM.

import { homePlan } from './home.js';

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const R = (x) => `R${Math.round(x).toLocaleString('en-ZA').replace(/,/g, ' ')}`;
const pc = (x) => `${Math.round(x * 100)}%`;

export const COMFORT = { steady: 'I prefer to know what is coming', some: 'Some ups and downs are fine', fine: 'I am comfortable with risk' };

/**
 * @param v      the home's values (with the optional personal ones)
 * @param plan   homePlan(v, today)
 * @param range  scenarioRange for this home against its comparison, or null
 * @param names  [this, the other], as the comparison names them
 * @returns { factors: [{ level: 'ok'|'watch'|'strain'|'unknown', title, text }], options: [string] }
 */
export function carryIt(v, plan, today, range = null, names = null) {
  const factors = [];
  const options = new Set();
  const add = (level, title, text) => factors.push({ level, title, text });
  const income = num(v.income);
  const other = num(v.otherCosts);
  const cash = num(v.cashNow);
  const month = plan.monthNow;
  const buying = plan.kind === 'buy';

  // 1. What it costs a month against income.
  if (income) {
    const share = month / income;
    add(share > 0.4 ? 'strain' : share > 0.3 ? 'watch' : 'ok', 'A month, against income',
      `${R(month)} a month is ${pc(share)} of the ${R(income)} household income before tax. Banks often look at the bond instalment as a share of income, with about 30% a common limit${other != null ? `; with the ${R(other)} you spend on everything else, ${R(income - month - other)} is left before tax` : ''}.`);
    if (share > 0.3) { options.add('A bigger deposit or a cheaper home lowers the monthly cost.'); options.add('A longer bond lowers the instalment, but costs more interest in all.'); }
  } else add('unknown', 'A month, against income', 'Not assessed - add the household income to see what share of it this takes.');

  // 2. The bond rate rising two points.
  if (plan.bond) {
    const higher = homePlan({ ...v, ratePct: (num(v.ratePct) ?? 0) + 2, bondRate: (num(v.bondRate) ?? 0) + 2, scenarios: [] }, today);
    const more = higher.missing ? 0 : higher.monthNow - homePlan({ ...v, scenarios: [] }, today).monthNow;
    add(income && (month + more) / income > 0.4 ? 'strain' : 'watch', 'If the rate rises 2 points',
      `The instalment would be about ${R(more)} more a month${income ? ` - ${pc((month + more) / income)} of income` : ''}. Rates have moved that much within a few years before.`);
  }

  // 3. Cash left after moving in (owning already: the buffer you have now).
  const cashTitle = plan.kind === 'own' ? 'Your cash buffer' : 'Cash after moving in';
  if (cash != null) {
    const left = cash - (buying ? plan.fromPocket : plan.kind === 'rent' ? plan.fromPocket : 0);
    const burn = month + (other ?? 0);
    const months = burn > 0 ? left / burn : null;
    if (left < 0) { add('strain', cashTitle, `Moving in needs ${R(plan.fromPocket)}; the ${R(cash)} you have falls ${R(-left)} short.`); options.add('Save longer, borrow less, or look at a less expensive home.'); }
    else {
      add(months != null && months < 3 ? 'strain' : months != null && months < 6 ? 'watch' : 'ok', cashTitle,
        `${R(left)} would be left${months != null ? ` - about ${Math.floor(months)} month${Math.floor(months) === 1 ? '' : 's'} of ${other != null ? 'all your spending' : 'housing costs'}` : ''}. Three to six months is a common buffer for a lost income or a big repair.`);
      if (months != null && months < 6) options.add('Keeping more cash aside, rather than in the deposit, gives a bigger buffer.');
    }
  } else add('unknown', cashTitle, 'Not assessed - add the cash and savings you have to see what buffer is left.');

  // 4. A big repair.
  if (plan.kind !== 'rent') {
    const value = plan.months[Math.max(0, plan.now)]?.value ?? plan.value0;
    const big = Math.max(30000, value * 0.02);
    add(cash == null ? 'unknown' : cash - (buying ? plan.fromPocket : 0) >= big ? 'ok' : 'watch', 'A big repair',
      `A roof, a geyser or plumbing can cost ${R(big)} or more at once (about 2% of the value is used here).${cash == null ? ' Add your cash to see whether it would be covered.' : ''}`);
  }

  // 5. Leaving sooner (D-086): against the comparison, never against paying nothing for a home.
  if (buying || plan.story) {
    if (!range || !names) add('unknown', 'Leaving sooner', 'Not assessed - it needs something to compare with (the rent for a similar home).');
    else {
      const s = range.central.series; const H = Math.min(s.length, plan.stay);
      let k = -1; for (let i = H - 1; i >= 0; i -= 1) if (s[i][1] < 0) { k = i; break; }
      const year = (i) => plan.months[s[i][0] - 1]?.ym.slice(0, 4);
      if (k === H - 1) add('watch', 'Leaving sooner', `At your figures ${names[1].toLowerCase()} leaves you more right up to when you plan to leave. Duty, fees and the agent are paid however short the stay.`);
      else if (k < 0) add('ok', 'Leaving sooner', `At your figures ${names[0].toLowerCase()} leaves you more from the start, even selling soon.`);
      else if (s[k + 1][0] <= plan.now) add('ok', 'Leaving sooner', `${names[0]} has left you more than ${names[1].toLowerCase()} since about ${year(k + 1)} - so selling sooner than planned would still leave you more, at your figures.`);
      else add(k + 1 > H - 24 ? 'watch' : 'ok', 'Leaving sooner', `${names[0]} leaves you more than ${names[1].toLowerCase()} only from about ${year(k + 1)}. Selling before then - a job move, a change in the family - would leave you with less, because duty, fees and the agent take years to earn back.`);
    }
  }

  // 6. How sure the answer is.
  if (range) {
    if (range.flips.length) add('watch', 'How sure the answer is', `It depends on the assumptions: ${range.flips.map((e) => e.label.toLowerCase()).join(' or ')} going the other way can, on its own, change which leaves you more.`);
    else add(range.verdict === 'crosses' ? 'watch' : 'ok', 'How sure the answer is', range.verdict === 'crosses' ? 'The tested range crosses zero when several assumptions go the same way - which leaves you more depends on them.' : `Across the tested range ${(range.verdict === 'all-above' ? names?.[0] : names?.[1])?.toLowerCase() ?? 'the same one'} leaves you more.`);
  }

  // Personal resilience - only what was given.
  if (v.incomes === 'one') add('watch', 'One income', `Everything rests on one income.${cash != null ? ' The cash buffer above is what would carry you if it stopped.' : ' Add your cash to see how long a buffer you have.'}`);
  if (num(v.dependants)) add('watch', 'People who depend on you', `${num(v.dependants)} ${num(v.dependants) === 1 ? 'person depends' : 'people depend'} on this income - a larger buffer matters more.`);
  const toGoal = num(v.yearsToGoal);
  if (toGoal != null && toGoal < (num(v.stayYears) ?? 10)) { add('watch', 'Needing the money sooner', `You may need this money in ${toGoal} years - before the ${num(v.stayYears) ?? 10} years you plan to stay. Selling early costs the agent and fees, and prices may be down then.`); options.add('Test a shorter stay, or keep part of the money where it is easy to reach.'); }
  if (v.comfort === 'steady' && range && (range.verdict === 'crosses' || range.flips.length)) add('watch', 'Your comfort with uncertainty', 'You prefer to know what is coming, and this answer moves a lot with the assumptions. That is worth weighing alongside the money.');
  if (v.comfort === 'fine' && factors.some((f) => f.level === 'strain')) add('watch', 'Comfort and capacity', 'You are comfortable with risk - but comfort is not the same as the room to absorb a loss. The strains above are about room.');
  return { factors, options: [...options] };
}
