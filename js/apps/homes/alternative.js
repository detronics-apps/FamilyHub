// What a home is compared with on its own page (D-086) - never "keeping your money and
// paying nothing for a home". Buying: renting a similar home. Ours already: renting a
// similar home instead (from when we bought it, or after selling today). Renting: buying a
// similar home. The alternative is built from the page's own figures, so the scenario
// range moves both alike; the two are then put on the same money (sameMoney).
// Pure - no DOM.

import { homePlan } from './home.js';

const num = (x) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? 0 : Number(x));

/**
 * @returns { values, names: [this, other], ask } - `values` null while a figure is missing;
 * `ask` then names it. `names` read in "X leaves you more".
 */
export function alternativeOf(v, today) {
  if (v.kind === 'buy') {
    const names = ['Buying', 'Renting instead'];
    if (!(num(v.likeRent) > 0)) return { values: null, names, ask: 'the rent for a similar home' };
    return { values: { ...v, kind: 'rent', rent: num(v.likeRent), rentDeposit: null, rentMove: null, upgrades: [], scenarios: [] }, names };
  }
  if (v.kind === 'own') {
    const plan = homePlan(v, today);
    const story = !plan.missing && plan.story;
    const names = story ? ['Having bought it', 'Renting instead'] : ['Keeping it', 'Selling and renting'];
    if (!(num(v.likeRent) > 0)) return { values: null, names, ask: 'what a similar home rents for' };
    if (plan.missing) return { values: null, names, ask: plan.missing.join(' and ') };
    // From when we bought it: the same start, the deposit and costs invested instead. From
    // today: our home sold today, and what that leaves is invested while renting.
    const alt = { ...v, kind: 'rent', rent: num(v.likeRent), rentToday: true, fromMonth: plan.startYM, rentDeposit: null, rentMove: null, upgrades: [], scenarios: [], bondEvents: [] };
    Object.assign(alt, story ? { on: { ...(v.on ?? {}), sellFirst: false } } : { on: { ...(v.on ?? {}), sellFirst: true }, sellPrice: num(v.worthNow), owedNow: plan.bond?.owedNow ?? 0 });
    return { values: alt, names };
  }
  const names = ['Renting', 'Buying instead'];
  if (!(num(v.price) > 0)) return { values: null, names, ask: 'what a similar home would cost to buy' };
  return { values: { ...v, kind: 'buy', upgrades: [], scenarios: [] }, names };
}
