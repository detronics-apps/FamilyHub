// Homes (D-078): one page per home - bought now, already ours, or rented - made of
// sections that can each be counted or left out and folded away, the bond with its real
// history, "what if" lines shown with and without, and one Compare for any saved homes.
// Replaces the separate A home, Bond, Our bond, Sell to buy and Own or rent pages
// (D-067, D-072, D-074, D-075); their saved work opens here.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { loading, failure } from '../kit.js';
import { REFERENCE, total, SELL_DEFAULTS } from '../finance/maths.js';
import { historyGrowth, CGT } from './ownrent.js';
import { EVENT_KINDS } from './bondlog.js';
import { homePlan, withAndWithout, sameMoney, kindOf, KINDS, SECTIONS, SECTIONS_ON, SCENARIO_KINDS, PLAN_DEFAULTS } from './home.js';
import { levelBar, shows, draft, loadDraft, input, info, linesPanel as eventsPanel, stat, sums, step, lineChart, chartPanel, crossing, whenLabel, RULE, savedPanel, exportBar, rand, pct, months } from '../finance/pod.js';
import { HOME_HELP as H } from '../finance/help.js';
import { rangePanel, rangeParts } from './range-view.js';
import { scenarioRange, defaultRanges, measure } from './scenarios.js';
import { alternativeOf } from './alternative.js';
import { carryIt, COMFORT } from './risk.js';
import { situationEffects } from './situations.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => r.title, prefix: 'hom' });
const KIND = 'property';
const DEFAULTS = { ...SELL_DEFAULTS, ...PLAN_DEFAULTS, sellPrice: null, renovations: null, reserve: null, quoteTransfer: null, quoteBond: null, moveCost: null };
const D = () => draft('homes', DEFAULTS);
const valuesOf = (rec) => { const v = { ...DEFAULTS, ...(rec.values ?? {}) }; return { ...v, kind: kindOf(v, rec.kind) }; };
const ymName = (ym) => (ym ? new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-');
const n = (x) => Number(x) || 0;
const yrs = (y) => `${y} year${y === 1 ? '' : 's'}`;

export function render(hub, route) {
  if (route.sub === 'compare') return compareScreen(hub, route.rest[0] ?? '');
  if (['home', 'bond', 'rentbuy', 'selltobuy', 'ourbond'].includes(route.sub)) return homeScreen(hub);
  return listScreen(hub);
}

/* -------------------------------------------------------------- our homes */

const loadAll = (hub) => hub.use('homes-all', async () => {
  const c = col(hub);
  const { items } = await c.list({ limit: 1000 });
  return (await Promise.all(items.map((s) => c.get(s.id)))).filter(Boolean).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
});

function listScreen(hub) {
  const all = loadAll(hub);
  const start = (kind) => { loadDraft('homes', DEFAULTS, { values: { kind }, title: '', kind: KIND }); figs.open = null; hub.go('home'); };
  return el('section', { class: 'stack', 'aria-labelledby': 'homes-title' }, [
    el('h1', { id: 'homes-title', text: 'Homes', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Each home on one page - one you might buy, the one you own, or one you might rent - with everything it costs and what it leaves you. Save each one, then compare any of them.' }),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Add a home', style: { margin: 0 } }),
      el('div', { class: 'row' }, Object.entries(KINDS).map(([k, label]) => el('button', { class: 'btn', type: 'button', text: label, 'data-field': `new:${k}`, title: { buy: 'A home you might buy', own: 'The home you own now', rent: 'A home you might rent' }[k], on: { click: () => start(k) } }))),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Our homes', style: { margin: 0 } }),
      all.loading ? el('p', { class: 'muted', text: 'Loading…' }) : all.error ? failure(all.error) : all.data.length ? el('ul', { class: 'list' }, all.data.map((rec) => {
        const v = valuesOf(rec);
        return el('li', {}, [
          el('div', { class: 'list__main' }, [el('strong', { text: rec.title || 'Untitled' }), el('div', { class: 'small muted', text: [KINDS[v.kind], headline(v, hub.today()).headline, rec.savedAt ? `saved ${rec.savedAt.slice(0, 10)}` : null].filter(Boolean).join(' · ') })]),
          el('button', { class: 'btn btn-small', type: 'button', text: 'Open', 'aria-label': `Open ${rec.title}`, 'data-field': `open:${rec.id}`, on: { click: () => { loadDraft('homes', DEFAULTS, { ...rec, values: v, kind: KIND }); figs.open = null; hub.go('home'); } } }),
          el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${rec.title}`, 'data-field': `remove:${rec.id}`, on: { click: async () => {
            if (!(await confirmAction({ title: `Remove "${rec.title || 'Untitled'}"?`, text: 'The saved home is deleted. This cannot be undone.', confirmLabel: 'Remove', danger: true }))) return;
            await col(hub).remove(rec.id); cmp.picked?.delete(rec.id); hub.invalidate();
          } } }),
        ]);
      })) : el('p', { class: 'muted', style: { margin: 0 }, text: 'Nothing saved yet. Add a home above, fill it in, and save it with a name.' }),
      all.data?.length > 1 ? el('a', { class: 'btn btn-primary', href: hub.href('compare'), text: 'Compare', 'data-field': 'go-compare', title: 'Compare any of these - buy against buy, against renting, or keeping ours' }) : null,
    ]),
  ]);
}

/* ------------------------------------------------------------------ a home */

const FOLDS = 'familyhub.homefolds';
const folds = (() => { try { return new Set(JSON.parse(localStorage.getItem(FOLDS) || '[]')); } catch { return new Set(); } })();
const keepFolds = () => { try { localStorage.setItem(FOLDS, JSON.stringify([...folds])); } catch { /* this device only */ } };

const thisMonth = () => new Date().toISOString().slice(0, 7);
const f = (key, label, type, more = {}) => ({ key, label, type, level: 'simple', info: H[key], ...more });
const isBuy = (v) => v.kind === 'buy'; const isOwn = (v) => v.kind === 'own'; const isRent = (v) => v.kind === 'rent';
const hasHome = (v) => !isRent(v);

/** The page's sections, in the order a decision is made. `tick`: can be left out. */
const SECS = [
  { key: 'home', title: 'The home', when: hasHome, fields: [
    f('fromMonth', 'Buying in', 'month', { fallback: thisMonth, fallbackLabel: 'This month', when: isBuy }),
    f('price', 'Price', 'money', { when: isBuy }),
    f('worthNow', 'What it would sell for now', 'money', { when: isOwn }),
    f('boughtFor', 'We bought it for', 'money', { optional: true, when: isOwn }),
    f('boughtWhen', 'In', 'month', { optional: true, when: isOwn }),
    f('improvedSoFar', 'Spent on improvements so far', 'money', { optional: true, level: 'advanced', when: isOwn }),
    f('ownFrom', 'Work it out from', 'choice', { when: isOwn, redraw: true, choices: [{ value: 'today', label: 'Today' }, { value: 'bought', label: 'When we bought it' }] }),
    f('growthPct', 'House prices grow by', 'percent', { source: { kind: 'illustrative' } }),
  ], extra: (hub, d) => historyLine(hub, d) },
  { key: 'rentSec', title: 'The rent', when: isRent, fields: [
    f('fromMonth', 'Renting from', 'month', { fallback: thisMonth, fallbackLabel: 'This month' }),
    f('rent', 'Rent a month', 'money'),
    f('rentRisePct', 'Rent rises by', 'percent', { source: { kind: 'illustrative' } }),
    f('rentDeposit', 'Rental deposit', 'money', { optional: true }),
    f('rentMove', 'Moving in', 'money', { optional: true, level: 'advanced' }),
  ] },
  { key: 'alt', title: 'What you compare it with', fields: [
    f('likeRent', 'Rent for a similar home, a month', 'money', { optional: true, when: isBuy }),
    f('likeRent', 'What a similar home rents for now, a month', 'money', { optional: true, when: isOwn }),
    f('rentRisePct', 'Rent rises by', 'percent', { source: { kind: 'illustrative' }, when: hasHome }),
    f('price', 'A similar home would cost', 'money', { optional: true, when: isRent }),
    f('deposit', 'Deposit you would put down', 'money', { source: { kind: 'assumption' }, when: isRent }),
    f('ratePct', 'Bond interest rate', 'percent', { source: { ref: REFERENCE.prime }, when: isRent }),
    f('termYears', 'Bond over', 'years', { source: { kind: 'assumption' }, when: isRent }),
    f('ratesTaxes', 'Its rates, levies and insurance a month', 'money', { optional: true, when: isRent }),
    f('maintYearly', 'Its maintenance and repairs a year', 'money', { optional: true, when: isRent }),
    f('growthPct', 'House prices grow by', 'percent', { source: { kind: 'illustrative' }, when: isRent }),
    f('investPct', 'Investments grow by, before tax', 'percent', { source: { kind: 'illustrative' } }),
    f('investTaxPct', 'Share of growth lost to tax', 'percent', { level: 'advanced', unitText: '%', source: { kind: 'illustrative' } }),
  ] },
  { key: 'sellFirst', title: SECTIONS.sellFirst, tick: true, when: (v) => !isOwn(v), fields: [
    f('sellPrice', 'Our home will sell for', 'money'),
    f('owedNow', 'Still owed on its bond', 'money', { source: { kind: 'assumption' } }),
    f('agentPct', 'Agent’s commission', 'percent', { unitText: '% plus VAT', source: { kind: 'illustrative' } }),
    f('coc', 'Electrical certificate', 'money', { source: { kind: 'illustrative' } }),
    f('cancelFee', 'Bond cancellation attorney', 'money', { level: 'advanced', source: { kind: 'illustrative' } }),
    f('noticeShort', 'Months of notice the bank will not get', 'number', { level: 'advanced', source: { kind: 'assumption' } }),
    f('beetle', 'Beetle certificate', 'money', { level: 'advanced', optional: true }),
    f('gas', 'Gas certificate', 'money', { level: 'advanced', optional: true }),
    f('fence', 'Electric fence certificate', 'money', { level: 'advanced', optional: true }),
    f('boughtFor', 'We bought it for', 'money', { level: 'advanced', optional: true, info: 'Only to check the tax on the gain: none on the first R3 million.' }),
    f('renovations', 'Kept for renovations', 'money', { optional: true, when: isBuy }),
    f('reserve', 'Kept free, just in case', 'money', { optional: true }),
  ], extra: (hub, d, plan) => saleBox(plan) },
  { key: 'buying', title: 'Buying it', when: isBuy, fields: [
    f('deposit', 'Deposit', 'money', { source: { kind: 'assumption' }, when: (v) => !(v.on?.sellFirst) }),
    f('moveCost', 'Moving in', 'money', { optional: true }),
    f('quoteTransfer', 'Transfer attorney’s quote', 'money', { estimate: true, level: 'advanced' }),
    f('quoteBond', 'Bond attorney’s quote', 'money', { estimate: true, level: 'advanced' }),
  ], extra: (hub, d, plan) => buyingBox(plan) },
  { key: 'bond', title: SECTIONS.bond, tick: true, when: hasHome, fields: [
    f('ratePct', 'Interest rate', 'percent', { source: { ref: REFERENCE.prime }, when: isBuy }),
    f('termYears', 'Over', 'years', { source: { kind: 'assumption' }, when: isBuy }),
    f('income', 'Household income a month, before tax', 'money', { optional: true, when: isBuy }),
    f('bondLoan', 'The bond when it started', 'money', { when: isOwn }),
    f('bondStart', 'It started in', 'month', { when: isOwn }),
    f('bondYears', 'Over', 'years', { source: { kind: 'assumption' }, when: isOwn }),
    f('bondRate', 'Rate at the start', 'percent', { source: { ref: REFERENCE.prime }, when: isOwn }),
  ], extra: (hub, d, plan, refresh) => [bondBox(d.values, plan), isOwn(d.values) ? eventsPanel(d, refresh, 'bondEvents', EVENT_KINDS, 'What happened, over the years', H.history, false, true) : null] },
  { key: 'running', title: SECTIONS.running, tick: true, when: hasHome, fields: [
    f('ratesTaxes', 'Rates and taxes a month', 'money', { optional: true }),
    f('levies', 'Levies a month', 'money', { optional: true }),
    f('insurance', 'Building insurance a month', 'money', { optional: true }),
    f('maintYearly', 'Maintenance and repairs a year - what you really spend', 'money', { optional: true, when: (v) => v.maintMode !== 'percent' }),
    f('maintMode', 'Maintenance as', 'choice', { level: 'advanced', redraw: true, choices: [{ value: 'amount', label: 'Our figure' }, { value: 'percent', label: 'Percentage' }] }),
    f('upkeepPct', 'Upkeep, of the value a year', 'percent', { level: 'advanced', source: { kind: 'illustrative' }, when: (v) => v.maintMode === 'percent' }),
    f('escalatePct', 'Costs rise by', 'percent', { level: 'advanced', source: { ref: REFERENCE.cpi } }),
  ] },
  { key: 'upgrades', title: SECTIONS.upgrades, tick: true, when: hasHome, fields: [], extra: (hub, d, plan, refresh) => upgradesPanel(d, refresh) },
  { key: 'travel', title: SECTIONS.travel, tick: true, fields: [
    f('km', 'Distance to work, one way', 'kmOne', { optional: true }),
    f('minutes', 'Time to get there, one way', 'minutes', { optional: true }),
    f('days', 'Days at work a month', 'number', { level: 'advanced', source: { kind: 'assumption' } }),
    f('perKm', 'Cost per km', 'money', { level: 'advanced', source: { ref: REFERENCE.perKm } }),
    f('travelExtra', 'Tolls, parking or taxi fares a month', 'money', { level: 'advanced', optional: true }),
    f('hourValue', 'What an hour of your time is worth', 'money', { level: 'advanced', optional: true }),
  ] },
  { key: 'selling', title: 'How long, and selling later', fields: [
    f('stayYears', 'Live here for', 'years', { source: { kind: 'assumption' } }),
    f('sellPct', 'Selling later costs, of the price', 'percent', { unitText: '%', level: 'advanced', source: { kind: 'illustrative' }, when: hasHome }),
    f('marginalPct', 'Your income tax rate on the last rand', 'percent', { unitText: '%', level: 'advanced', source: { kind: 'illustrative' }, when: hasHome }),
  ] },
  { key: 'situation', title: 'Your situation', fields: [
    f('income', 'Household income a month, before tax', 'money', { optional: true, when: (v) => !isBuy(v) }),
    f('otherCosts', 'Everything else you spend a month', 'money', { optional: true }),
    f('cashNow', 'Cash and savings you have now', 'money', { optional: true }),
    f('incomes', 'Incomes in the household', 'choice', { optional: true, choices: [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two or more' }] }),
    f('dependants', 'People who depend on that income', 'number', { optional: true, level: 'advanced' }),
    f('yearsToGoal', 'Years until you need this money (retirement, a goal)', 'years', { optional: true, level: 'advanced' }),
    f('comfort', 'How you feel about uncertainty', 'choice', { optional: true, choices: Object.entries(COMFORT).map(([value, label]) => ({ value, label })) }),
  ] },
];
const ALL_FIELDS = SECS.flatMap((s) => s.fields);

function homeScreen(hub) {
  const d = D();
  const v = d.values;
  v.kind = kindOf(v);
  const today = hub.today();
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const boxes = [];      // section extras that follow what is typed
  const refresh = () => {
    const plan = homePlan(v, today);
    for (const b of boxes) b.box.replaceChildren(...[b.make(plan)].flat().filter(Boolean));
    answer.replaceChildren(...results(hub, d).filter(Boolean));
  };
  const changed = (key) => (ALL_FIELDS.find((x) => x.key === key)?.redraw ? hub.render() : refresh());
  const plan0 = homePlan(v, today);
  const sections = SECS.filter((s) => !s.when || s.when(v)).map((s) => sectionPanel(hub, d, s, plan0, refresh, changed, boxes));
  refresh();
  return el('section', { class: 'stack', 'aria-labelledby': 'home-title' }, [
    el('h1', { id: 'home-title', text: d.title || 'A home', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Everything about one home, in sections. Tick a section off to leave it out, fold away what you do not need, and tap (i) for what a figure is and where to find yours.' }),
    levelBar(() => hub.render()),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'chipset', role: 'group', 'aria-label': 'This home' }, Object.entries(KINDS).map(([k, label]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(v.kind === k), 'data-field': `kind:${k}`, text: label,
        on: { click: () => { v.kind = k; d.mine.add('kind'); hub.render(); } },
      }))),
    ]),
    figuresFold(v, today, [
      ...sections,
      hasHome(v) && (v.on?.bond ?? true) ? eventsPanel(d, refresh, 'scenarios', SCENARIO_KINDS, 'What if…', H.scenarios, true, true) : null,
    ]),
    answer,
    savedPanel(hub, {
      col: col(hub), kind: KIND, d, compareScreen: 'compare',
      summary: () => headline(v, today),
      onOpen: (rec) => { loadDraft('homes', DEFAULTS, { ...rec, values: valuesOf(rec) }); figs.open = null; hub.render(); },
    }),
  ]);
}

/** One section: its heading with (i), a tick to count it or leave it out, and folding away. */
function sectionPanel(hub, d, s, plan, refresh, changed, boxes) {
  const on = s.tick ? ({ ...SECTIONS_ON, ...(d.values.on ?? {}) })[s.key] : true;
  const foldKey = `${s.key}`;
  const folded = folds.has(foldKey) || !on;
  const [ib, ix] = info(H[s.key], s.title);
  const body = el('div', { class: 'home-sec__body stack', hidden: folded });
  const fields = s.fields.filter((x) => shows(x.level) && (!x.when || x.when(d.values)));
  body.append(...fields.map((x) => input(x, d, changed)));
  if (s.extra) { const box = el('div', { class: 'stack' }); boxes.push({ box, make: (p) => s.extra(hub, d, p, refresh) }); body.append(box); }
  const foldBtn = el('button', { class: 'home-sec__fold', type: 'button', 'aria-expanded': String(!folded), 'aria-label': `${folded ? 'Open' : 'Fold away'} ${s.title}`, text: folded ? '▸' : '▾',
    on: { click: () => { const open = body.hidden; body.hidden = !open; foldBtn.textContent = open ? '▾' : '▸'; foldBtn.setAttribute('aria-expanded', String(open)); if (open) folds.delete(foldKey); else folds.add(foldKey); keepFolds(); } } });
  return el('section', { class: `panel home-sec${on ? '' : ' home-sec--off'}`, 'data-field': `sec:${s.key}` }, [
    el('div', { class: 'home-sec__head' }, [
      foldBtn,
      el('h2', {}, [s.title, ' ', ib]),
      s.tick ? el('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), 'data-field': `tick:${s.key}`, text: on ? 'Counted' : 'Left out', title: on ? 'Counted in the answer - tap to leave it out' : 'Left out of the answer - tap to count it',
        on: { click: () => { d.values.on = { ...SECTIONS_ON, ...(d.values.on ?? {}), [s.key]: !on }; d.mine.add('on'); if (!on) folds.delete(foldKey); keepFolds(); hub.render(); } } }) : null,
    ]),
    ix ? el('div', { class: 'home-sec__body' }, [ix]) : null,
    body,
  ]);
}

/** What our own home has grown by, with "Use it" to grow prices at that rate. */
function historyLine(hub, d) {
  const v = d.values;
  const h = historyGrowth(v.boughtFor, v.boughtWhen, isOwn(v) ? v.worthNow : v.worthNow, hub.today());
  if (!isOwn(v)) return el('p', { class: 'small muted', style: { margin: 0 }, text: 'Own a home already? Fill it in as "Ours already" to see what it has grown by - and use that here.' });
  if (!h) return el('p', { class: 'small muted', style: { margin: 0 }, text: 'Fill in what you paid and when, to see what your home has grown by each year.' });
  const same = Math.abs(h.pct - n(v.growthPct)) < 0.05;
  return el('div', { class: 'row' }, [
    el('p', { class: 'small', style: { margin: 0, flex: '1 1 240px' }, text: `${rand(n(v.boughtFor))} in ${v.boughtWhen.slice(0, 4)} to ${rand(n(v.worthNow))} now is about ${pct(h.pct, 1)} a year over ${h.years.toFixed(1)} years${same ? ' - and that is what is used.' : '.'} The past is not a promise.` }),
    same ? null : el('button', { class: 'btn btn-small', type: 'button', text: 'Use it', 'data-field': 'use-history', title: 'Grow prices at our own home’s rate', on: { click: () => { v.growthPct = Math.round(h.pct * 10) / 10; d.mine.add('growthPct'); hub.render(); } } }),
  ]);
}

/** Buying costs, item by item - money out, so below zero. */
function buyingBox(plan) {
  if (plan.missing || !plan.buyItems?.length) return null;
  return [
    sums([
      { label: 'Deposit', value: -plan.deposit, note: plan.funding ? 'From selling our home' : null },
      ...plan.buyItems.map((x) => ({ label: x.label, value: -x.amount, note: [x.note, x.source].filter(Boolean).join(' · ') })),
      { label: 'Cash needed to buy', value: -(plan.deposit + total(plan.buyItems)), total: true },
    ]),
  ];
}

/** Selling our current home first: from the sale price down to what is left. */
function saleBox(plan) {
  const r = plan.funding;
  if (!r) return el('p', { class: 'small muted', style: { margin: 0 }, text: 'Fill in what your home will sell for.' });
  return [
    sums([
      { label: 'Sale price', value: r.sale },
      ...r.selling.map((x) => ({ label: x.label, value: -x.amount, note: [x.note, x.source].filter(Boolean).join(' · ') })),
      r.tax.tax ? { label: 'Tax on the gain', value: -r.tax.tax } : null,
      r.owed ? { label: 'Bond settled', value: -r.owed } : null,
      { label: 'Cash from the sale', value: r.cash, total: true, note: r.short > 0 ? `${rand(r.short)} short of the buying costs and what is kept back.` : plan.kind === 'rent' ? 'Invested while renting.' : `Pays the deposit (${rand(r.deposit)}) and buying costs; the rest stays invested.` },
    ]),
  ];
}

/** The bond in a few lines: the instalment, what it means against income, and what is still owed. */
function bondBox(v, plan) {
  if (plan.missing || !plan.bond) return null;
  const b = plan.bond;
  const lines = isOwn(v)
    ? [`Today: ${rand(b.owedNow)} owed, a minimum of ${rand(b.minNow)} a month, paid off ${ymName(b.paidOff)} at the minimum (${months(b.monthsLeft)}).`, ...b.notes.map((x) => x.text)]
    : [`${rand(plan.loan)} at ${pct(n(v.ratePct))} over ${yrs(n(v.termYears))}: ${rand(b.minNow)} a month, paid off ${ymName(b.paidOff)}, about ${rand(b.interestFromNow)} interest in all.`,
      n(v.income) ? `That is ${Math.round((b.minNow / n(v.income)) * 100)}% of the household’s income before tax. Banks often look for no more than about 30% - here about ${rand(b.minNow / 0.3)} a month. Each bank decides for itself.` : null];
  return el('div', { class: 'stack' }, lines.filter(Boolean).map((t) => el('p', { class: 'small', style: { margin: 0 }, text: t })));
}

/** Upgrades: what each costs, when, and what it adds to the selling price. */
function upgradesPanel(d, refresh) {
  const list = Array.isArray(d.values.upgrades) ? d.values.upgrades : (d.values.upgrades = []);
  const box = el('div', { class: 'stack' });
  const save = () => { d.values.upgrades = list.filter((u) => u.name || u.cost); d.mine.add('upgrades'); refresh(); };
  const numIn = (u, k, label, w = '130px') => el('input', { class: 'input', type: 'number', min: '0', step: 'any', value: u[k] ?? '', 'aria-label': label, style: { maxWidth: w }, on: { change: (e) => { u[k] = e.target.value === '' ? null : Number(e.target.value); save(); } } });
  const draw = () => box.replaceChildren(...list.map((u, i) => el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' }, 'data-field': `upgrade:${i}` }, [
    el('input', { class: 'input', value: u.name ?? '', placeholder: 'e.g. New bathroom', 'aria-label': 'Upgrade', style: { flex: '1 1 160px' }, on: { change: (e) => { u.name = e.target.value; save(); } } }),
    el('span', { class: 'small muted', text: 'in' }), numIn(u, 'inYears', 'In how many years', '70px'), el('span', { class: 'small muted', text: 'years · costs R' }),
    numIn(u, 'cost', 'What it costs'), el('span', { class: 'small muted', text: '· adds R' }), numIn(u, 'adds', 'What it adds to the selling price'),
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${u.name || 'upgrade'}`, on: { click: () => { list.splice(i, 1); draw(); save(); } } }),
  ])));
  draw();
  return [
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Put in what an agent says it would add to the selling price; if unsure, the same as it costs.' }),
    box,
    el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add upgrade', 'data-field': 'upgrade-add', on: { click: () => { list.push({ name: '', inYears: 1, cost: null, adds: null }); draw(); } } })]),
  ];
}

/* ----------------------------------------------------------------- results */

// What the home is weighed against (D-086) - and that comparison on the same money.
function comparison(v, today) {
  const alt = alternativeOf(v, today);
  if (!alt.values) return { ...alt, values: null };
  const values = [v, alt.values];
  const m = measure(values, today, {}, { a: 0, b: 1 });
  return m ? { ...alt, values, m, altPlan: m.plans[1] } : { ...alt, values: null, ask: 'the figures for both' };
}

// The graphs' question, by kind of home.
const TITLES = {
  buy: 'Buying or renting a similar home: which leaves you more?',
  story: 'Buying it, or renting a similar home all along: which leaves you more?',
  own: 'Keeping it, or selling and renting: which leaves you more?',
  rent: 'Renting, or buying a similar home: which leaves you more?',
};

/** The saved line: the month, and which leaves more by when. */
function headline(v, today) {
  const p = homePlan(v, today);
  if (p.missing) return {};
  const c = comparison(v, today);
  const H = Math.min(360, p.stay);
  if (!c.values) return { headline: `${rand(p.monthNow)} a month` };
  const diff = c.m.series[H - 1][1];
  return { headline: `${rand(p.monthNow)} a month · ${diff >= 0 ? c.names[0] : c.names[1]} leaves ${rand(Math.abs(diff))} more by ${p.months[H - 1].ym.slice(0, 4)}` };
}

/** "Your figures": every section, folded into one line once there is an answer to read. */
const figs = { open: null };   // null: open until there is an answer
function figuresFold(v, today, children) {
  const ready = !homePlan(v, today).missing && !!alternativeOf(v, today).values;
  const open = figs.open ?? !ready;
  return el('details', { class: 'home-figs', open, 'data-field': 'your-figures', on: { toggle: (e) => { figs.open = e.currentTarget.open; } } }, [
    el('summary', { class: 'panel' }, [el('strong', { text: 'Your figures' }), el('span', { class: 'small muted', text: ' · the home, its costs and what it is compared with' })]),
    el('div', { class: 'stack' }, children.filter(Boolean)),
  ]);
}

function results(hub, d) {
  const v = d.values;
  const today = hub.today();
  const w = withAndWithout(v, today);
  if (w.missing) return [el('p', { class: 'panel muted', text: `Fill in ${w.missing.join(' and ')} to see the answer.` })];
  const p = w.with; const p0 = w.without;
  const N = Math.max(0, p.now);
  const H = Math.min(360, p.stay);
  const at = p.months[H - 1];
  const leave = at.ym.slice(0, 4);
  const after = `by ${leave}`;
  // Calendar years under every graph.
  const xLabel = (x) => String(Number(p.startYM.slice(0, 4)) + Math.floor((Number(p.startYM.slice(5)) - 1 + x) / 12));
  const cmp = comparison(v, today);
  const [A, B] = cmp.names;
  const lines = [];
  if (p.story) lines.push(`Bought for ${rand(p.value0)} in ${ymName(p.startYM)}: ${rand(p.fromPocket)} came from savings - the ${rand(p.deposit)} deposit and ${rand(total(p.buyItems))} in duty and fees (at today's rates, so roughly). Everything since is counted, with today marked on the graphs.`);
  if (p.kind === 'buy' && p.now > 0) lines.push(`Bought in ${ymName(p.startYM)}: counted from then, with today marked on the graphs.`);
  if (p.kind === 'buy' && p.now < 0) lines.push(`Buying from ${ymName(p.startYM)}: until then nothing changes; costs are typed in today's money and will have risen by then.`);
  if (p.kind === 'buy') lines.push(p.funding ? `Selling our home leaves ${rand(p.funding.cash)}; it pays the ${rand(p.deposit)} deposit and ${rand(total(p.buyItems))} in buying costs${p.inv0 ? `, and ${rand(p.inv0)} stays invested` : ''}${p.fromPocket ? `. ${rand(p.fromPocket)} more comes from savings` : ''}.` : `Moving in takes ${rand(p.fromPocket)} from savings: the ${rand(p.deposit)} deposit, ${rand(total(p.buyItems))} in duty and fees${n(v.moveCost) ? ' and moving' : ''}.`);
  if (p.kind === 'own' && !p.story) lines.push(`Selling today would leave about ${rand(p.start)}, after the agent${p.owed0 ? `, the ${rand(p.owed0)} still owed` : ''} and any tax.`);
  if (p.kind === 'rent') lines.push(`Rent starts at ${rand(n(v.rent))} a month and rises about ${pct(n(v.rentRisePct))} a year${p.funding ? `; the ${rand(p.inv0)} left from selling our home is invested meanwhile` : ''}.`);
  if (w.any && p.bond && p0.bond) lines.push(`With your ticked what-ifs: the bond is paid off ${ymName(p.bond.paidOff)} instead of ${ymName(p0.bond.paidOff)} - ${w.sooner > 0 ? `${months(w.sooner)} sooner` : w.sooner < 0 ? `${months(-w.sooner)} later` : 'the same time'} - with ${rand(Math.abs(w.interestSaved))} ${w.interestSaved >= 0 ? 'less' : 'more'} interest.`);
  if (p.on.travel && n(v.km)) lines.push(`Getting to work: about ${rand(p.months[N].trip)} a month${n(v.minutes) ? ` and ${Math.round((2 * n(v.minutes) * n(v.days || 21)) / 60)} hours on the road` : ''}${cmp.values ? ' - the same for the similar home, so it does not change the comparison' : ''}.`);
  if (p.kind !== 'rent') lines.push(`Estimated proceeds if sold in ${leave}: ${rand(at.homeNet)}, after selling costs, the bond still owed and tax${at.inv ? ` - plus ${rand(at.inv)} invested` : ''}.`);
  if (cmp.values) {
    const wa = cmp.m.wealthA[H - 1].wealth; const wb = cmp.m.wealthB[H - 1].wealth; const diff = wa - wb;
    lines.push(`${A} would leave you about ${rand(wa)} ${after}; ${B.toLowerCase()} about ${rand(wb)}, on the same money each month with the differences ${v.diffCash ? 'kept as cash' : 'invested'}. ${Math.abs(diff) < Math.max(20000, 0.02 * Math.max(Math.abs(wa), Math.abs(wb))) ? 'About the same - the choice may rest on what you can carry and what you would rather live in.' : `That is ${rand(Math.abs(diff))} more with ${(diff > 0 ? A : B).toLowerCase()}.`}`);
  }
  // Once the bond is paid off (D-087): what it took each month stays with you - same money invests it.
  if (cmp.values && p.bond?.paidOff && p.bond.monthsLeft > 1) {
    const last = p.months[N + p.bond.monthsLeft - 2];
    if (last?.bondPaid > 0) lines.push(`From ${ymName(p.bond.paidOff)} the bond is paid off: the ${rand(last.bondPaid)} a month it took stays with you and is ${v.diffCash ? 'kept as cash' : 'invested'} - the graphs count it.`);
  }
  const off = Object.entries(SECTIONS).filter(([k]) => k !== 'forgone' && !({ ...SECTIONS_ON, ...(v.on ?? {}) })[k] && SECS.find((s) => s.key === k && (!s.when || s.when(v)))).map(([, t]) => t.toLowerCase());
  if (off.length) lines.push(`Left out: ${off.join(', ')}.`);

  const span = Math.min(p.months.length, Math.max(H + 24, N + 120, p.bond?.paidOff ? (N + p.bond.monthsLeft + 24) : 0));
  const payoff = p.bond?.paidOff ? { x: N + p.bond.monthsLeft, label: 'Bond paid off' } : null;
  const todayMark = p.now > 0 ? { x: p.now, label: 'Today' } : null;
  const range = cmp.values ? rangeParts({ values: cmp.values, today, state: homeRange, names: cmp.names, H, opts: { a: 0, b: 1 }, xLabel, todayX: todayMark?.x,
    title: TITLES[p.story ? 'story' : p.kind],
    onCentral: (key, val) => { v[key] = val; d.mine.add(key); hub.render(); } }) : null;
  const diffNow = cmp.values ? cmp.m.series[H - 1][1] : null;
  const switchCash = el('div', { class: 'chipset', role: 'group', 'aria-label': 'The differences' }, [[false, 'Invested'], [true, 'Kept as cash']].map(([c, label]) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(!!v.diffCash === c), text: label, 'data-field': `diff-cash:${c}`,
    on: { click: () => { v.diffCash = c; d.mine.add('diffCash'); hub.render(); } } })));
  const out = [
    el('div', { class: 'panel stack', 'data-field': 'comparing' }, [
      el('p', { style: { margin: 0 } }, [el('strong', { text: `Comparing ${d.title || 'this home'}: ` }), cmp.values ? `${A.toLowerCase()}, against ${altWords(v, p, cmp)} - up to ${leave}.` : `${A.toLowerCase()} - against what? It needs ${cmp.ask}.`]),
      cmp.values ? el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [el('span', { class: 'small muted', text: 'Whoever spends less each month:' }), switchCash]) : null,
    ]),
    el('div', { class: 'stats' }, [
      stat(rand(p.monthNow), 'a month now, all counted', 'r-month'),
      cmp.values ? stat(rand(Math.abs(diffNow)), `more with ${(diffNow >= 0 ? A : B).toLowerCase()}, ${after}`, 'r-diff') : null,
      p.bond ? stat(ymName(p.bond.paidOff), 'bond paid off', 'r-paidoff') : stat(rand(p.fromPocket), 'from savings up front', 'r-upfront'),
    ]),
    el('div', { class: 'panel stack' }, [el('h2', { text: 'What it means', style: { margin: 0 } }), ...lines.map((t) => el('p', { style: { margin: 0 }, text: t }))]),
    cmp.values ? range.chart : askPanel(hub, cmp, A),
    range?.explore,
    range?.moves,
    situationsPanel(hub, v, today, H, xLabel, span, [payoff, todayMark]),
    costSplit(p, N, span, xLabel, [payoff, todayMark], v, cmp),
    p.kind !== 'rent' ? equityPanel(p, span, xLabel, [payoff, todayMark]) : null,
    carryPanel(v, p, today, homeRange, H, cmp.values ? cmp : null),
    forgotten(v, p, cmp.values ? cmp : null),
  ];
  // Year by year, folded away: the numbers behind the graphs.
  const yearRows = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30].map((y) => N + y * 12).filter((t) => t <= Math.min(p.months.length, 360));
  out.push(el('details', { class: 'panel more', 'data-field': 'year-by-year' }, [
    el('summary', { text: 'Year by year' }),
    el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
      el('thead', {}, [el('tr', {}, ['Year', p.kind !== 'rent' ? 'Worth' : null, p.kind !== 'rent' ? 'Bond owed' : null, p.kind !== 'rent' ? 'Equity' : null, 'Paid out so far', cmp.values ? `${A} minus ${B.toLowerCase()}` : null].filter(Boolean).map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
      el('tbody', {}, yearRows.map((t) => { const m = p.months[t - 1]; const dd = cmp.values ? cmp.m.series[t - 1]?.[1] : null; return el('tr', {}, [
        el('td', { text: m.ym.slice(0, 4) }),
        p.kind !== 'rent' ? el('td', { class: 'num', text: rand(m.value) }) : null,
        p.kind !== 'rent' ? el('td', { class: 'num', text: rand(m.owed) }) : null,
        p.kind !== 'rent' ? el('td', { class: 'num', text: rand(m.value - m.owed) }) : null,
        el('td', { class: 'num', text: rand(m.paid) }),
        cmp.values ? el('td', { class: `num ${dd >= 0 ? 'fin-better' : 'fin-worse'}`, text: rand(dd) }) : null,
      ].filter(Boolean)); })),
    ])]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Paid out so far is every rand spent - it does not on its own say whether buying or renting is better; the last column does, with both sides counted.' }),
  ]));
  if (shows('learn')) {
    out.push(el('div', { class: 'panel stack fin-learn' }, [
      el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
      step('Month by month', 'Each month: what comes out of your pocket (bond, rates, upkeep, travel - or rent), and what the home is worth', null, 'Every section that is ticked is counted; one that is left out counts nothing.'),
      step('The bond', 'Owed = owed × (1 + rate ÷ 12) − what is paid', null, 'Paying more does not lower the minimum - it shortens the bond. Taking money out, or a rate change, makes the minimum be worked out again over the months left.'),
      step('Which leaves you more', 'Each side: the home sold (value − selling costs − bond − tax) or the rental deposit back + everything invested', null, 'Both start with the same savings and have the same money every month. Whoever needs less that month invests the difference (or keeps it as cash, if you choose); on day one, the money one side does not spend up front is invested too.'),
      step('Tax on selling your home', 'Taxed = gain − R3 000 000 − R50 000; tax = 40% of that × your rate', null, CGT.source),
      el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
      el('ul', { class: 'small', style: { margin: 0 } }, ['Prices, rents and returns move steadily here; real ones jump about.', 'Interest worked out monthly; banks work daily - close, not exact.', 'Security, staying put, the freedom to move - real, not money.'].map((t) => el('li', { text: t }))),
    ]));
  }
  return out;
}

/** "renting a similar home at R14 000 a month" - what the comparison is, in words. */
function altWords(v, p, cmp) {
  if (p.kind === 'buy') return `renting a similar home at ${rand(n(v.likeRent))} a month, rising ${pct(n(v.rentRisePct))} a year`;
  if (p.kind === 'own') return p.story ? `renting a similar home since ${ymName(p.startYM)} (${rand(n(v.likeRent))} a month today), with the deposit and buying costs invested instead` : `selling it today and renting a similar home at ${rand(n(v.likeRent))} a month, with what the sale leaves invested`;
  return `buying a similar home for ${rand(n(v.price))} with a ${rand(n(v.deposit))} deposit`;
}

/** No comparison yet: say what it needs, and open the figures at it. */
function askPanel(hub, cmp, A) {
  return el('div', { class: 'panel stack', 'data-field': 'main-ask' }, [
    el('h2', { text: `Is ${A.toLowerCase()} the better choice?`, style: { margin: 0 } }),
    el('p', { style: { margin: 0 }, text: `To answer that it needs something to compare with: ${cmp.ask}. Until then this page shows only what the home costs and what you would own - it does not compare it with anything.` }),
    el('div', {}, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Add it', 'data-field': 'ask-add', on: { click: () => {
      figs.open = true; hub.render();
      const box = document.querySelector('[data-field="in:likeRent"]') ?? document.querySelector('[data-field="in:price"]');
      box?.scrollIntoView({ block: 'center' }); box?.focus();
    } } })]),
  ]);
}

const homeRange = {};   // this page's scenario range settings
const hiddenSits = new Set();   // lines hidden on "What each one did"

/** "R4 000 more" - a line's name at the end of its graph line. */
const sitShort = (e) => (e.kind === 'rate' ? `Rate ${n(e.amount)}%` : `${rand(n(e.amount))}${{ more: ' more', pay: ' a month', extra: ' in', withdraw: ' out' }[e.kind]}`);

/** What it is set against when the line is taken out. */
function withoutWords(e, v) {
  const rest = v.diffCash ? 'keeping that money as cash' : 'investing that money instead';
  if (e.kind === 'more' || e.kind === 'extra') return `not paying it and ${rest}`;
  if (e.kind === 'pay') return `paying only the bank's minimum and ${rest}`;
  if (e.kind === 'withdraw') return `leaving it in the bond${e.use === 'spent' ? '' : ' (the money taken out counted as invested - if it was spent, say so on the line)'}`;
  return 'the rate staying as it was';
}

/**
 * "What each one did" (D-087): every situation taken out on its own and the home worked out
 * again on the same money - one line each on the graph, its effect in words below.
 */
function situationsPanel(hub, v, today, H, xLabel, span, marks) {
  const r = situationEffects(v, today, H);
  if (!r || !r.items.length) return null;
  const leave = r.plan.months[H - 1].ym.slice(0, 4);
  const live = r.items.filter((x) => !x.past);
  const lines = [...live.map((x) => ({ key: x.key, name: sitShort(x.e), points: x.points })), r.together ? { key: 'together', name: 'All together', points: r.together.points } : null].filter(Boolean);
  const chips = el('div', { class: 'chipset', role: 'group', 'aria-label': 'Lines shown' }, lines.map((l) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(!hiddenSits.has(l.key)), text: l.name, 'data-field': `sit:${l.key}`,
    on: { click: () => { if (hiddenSits.has(l.key)) hiddenSits.delete(l.key); else hiddenSits.add(l.key); hub.render(); } },
  })));
  const shown = lines.filter((l) => !hiddenSits.has(l.key));
  const say = (x) => {
    if (x.past) return 'Before today, so not measured from here - choose "When we bought it" under "Work it out from" to see what it did.';
    const bond = x.sooner ? `The bond is paid off ${months(Math.abs(x.sooner))} ${x.sooner > 0 ? 'sooner' : 'later'}` : 'The bond ends at the same time';
    const parts = [`${bond}, with ${rand(Math.abs(x.interest))} ${x.interest >= 0 ? 'less' : 'more'} interest. By ${leave} it leaves you ${rand(Math.abs(x.effect))} ${x.effect >= 0 ? 'more' : 'less'} than ${withoutWords(x.e, v)}.`];
    if (x.kept != null) parts.push(`Had you kept paying it until the bond was done: paid off ${ymName(x.keptPaidOff)}, and ${rand(Math.abs(x.kept))} ${x.kept >= 0 ? 'more' : 'less'} by ${leave} than as it is.`);
    if (x.moreThanAhead != null) parts.push(`That is more than the ${rand(x.moreThanAhead)} paid ahead by then - a bank usually treats it as a re-advance or a further loan, with its own fees.`);
    return parts.join(' ');
  };
  const sum = live.reduce((s, x) => s + x.effect, 0);
  return el('div', { class: 'panel stack', 'data-field': 'situations' }, [
    el('h2', { text: 'What each one did', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Each line under "What happened" and each ticked what-if, taken out on its own and the whole home worked out again on the same money: paying more is set against investing that money instead, taking money out against leaving it in the bond. Above zero it left you more by then; below, less.' }),
    live.length ? chips : null,
    shown.length ? lineChart(shown.map((l) => ({ name: l.name, points: l.points.slice(0, span) })), { label: 'What each situation did, month by month', xLabel, marks, zones: { above: 'Left you more', below: 'Left you less' } }) : null,
    el('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, r.items.map((x) => el('li', { 'data-field': `sit-say:${x.key}` }, [el('strong', { text: `${x.label}: ` }), say(x)]))),
    r.together ? el('p', { style: { margin: 0 }, text: `All of them together: ${rand(Math.abs(r.together.effect))} ${r.together.effect >= 0 ? 'more' : 'less'} by ${leave} than none of them.${Math.abs(r.together.effect - sum) > Math.max(5000, 0.05 * Math.abs(sum)) ? ' Not the same as adding them up - they affect each other: taking money out, for one, has the bank work the instalment out again over the years left, so what was paid ahead no longer brings the end closer.' : ''}` }) : null,
  ]);
}

// A month's cost, part by part (D-085). Improvements are one-off, so they are left to the totals.
const PARTS = [
  ['bondPaid', 'The bond'],
  ['fixed', 'Rates, levies and insurance'],
  ['upkeep', 'Upkeep and repairs'],
  ['rent', 'Rent'],
  ['trip', 'Getting to work'],
];
const partOf = (m, k) => (k === 'fixed' ? m.running - m.upkeep : m[k]);

/** "Can you afford it each month?" (D-086): the parts stacked, with the alternative and 30% of income. */
function costSplit(p, N, span, xLabel, marks, v, cmp) {
  const parts = PARTS.filter(([k]) => p.months.slice(N, span).some((m) => partOf(m, k) > 0.5));
  if (!parts.length) return null;
  const alt = cmp.values ? cmp.altPlan : null;
  const altOut = (t) => (alt ? (alt.months[t - 1] ? alt.months[t - 1].out - alt.months[t - 1].upgradeNow : 0) : null);
  const after = p.bond && p.bond.monthsLeft > 0 && N + p.bond.monthsLeft < p.months.length ? N + p.bond.monthsLeft : null;
  const cols = [[N, 'Now'], N + 60 < p.stay - 1 ? [N + 60, p.months[N + 60].ym.slice(0, 4)] : null, [p.stay - 1, `When you leave (${p.months[p.stay - 1].ym.slice(0, 4)})`], after != null && after > p.stay ? [after, 'After the bond'] : null].filter(Boolean);
  const monthly = p.months.slice(N, p.stay).reduce((s, m) => s + m.out - m.upgradeNow, 0);
  const stayYrs = yrs(Math.round((p.stay - N) / 12));
  const afterBond = after != null ? p.months[after] : null;
  const income = n(v.income);
  const lines = [
    `${(p.kind === 'own' && !p.story) || p.fromPocket < 1 || p.now > 0 ? '' : `Up front: ${rand(p.fromPocket)} once${p.kind === 'rent' ? '' : ' - the deposit, duty and fees'}. `}Every month: ${rand(p.months[N].out)} now, about ${rand(monthly)} in all over the ${stayYrs} you plan to stay.`,
    alt ? `${cmp.names[1]}: ${rand(altOut(N + 1))} a month now. ${p.months[N].out > altOut(N + 1) ? `This home costs ${rand(p.months[N].out - altOut(N + 1))} more a month now - on the other side that difference is ${v.diffCash ? 'kept' : 'invested'}.` : `This home costs ${rand(altOut(N + 1) - p.months[N].out)} less a month now - that difference is ${v.diffCash ? 'kept' : 'invested'} on this side.`}` : null,
    !afterBond ? null : afterBond.running > 0.5 ? `A paid-off home is not free: rates, insurance and upkeep stay - about ${rand(afterBond.out - afterBond.upgradeNow)} a month once the bond is done in ${afterBond.ym.slice(0, 4)}, still rising with costs.`
      : `After the bond is done in ${afterBond.ym.slice(0, 4)} nothing more is counted, because rates, insurance and upkeep are ${p.on.running ? 'not filled in' : 'left out'} - a paid-off home still has those.`,
    p.kind === 'rent' ? 'Rent has no rates, levies or upkeep - the landlord pays those out of it - but it rises every year and none of it comes back.' : null,
  ].filter(Boolean);
  const pts = (get) => p.months.slice(0, span).filter((m) => m.t % 3 === 0).map((m) => [m.t, get(m)]);
  return el('div', { class: 'panel stack', 'data-field': 'cost-split' }, [
    el('h2', { text: 'Can you afford it each month?', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'The long-term result matters, but you also have to pay each month along the way. This is cash out of your pocket each month - a different question from which leaves you more.' }),
    ...lines.map((t) => el('p', { style: { margin: 0 }, text: t })),
    lineChart([
      ...parts.map(([k, label]) => ({ name: label, points: pts((m) => partOf(m, k)) })),
      ...(alt ? [{ name: cmp.names[1], points: pts((m) => altOut(m.t)), over: true, dashed: true, colour: 'var(--text)' }] : []),
    ], { label: `What this home costs each month, part by part, stacked${alt ? `, with ${cmp.names[1].toLowerCase()} as a dashed line` : ''}`, stack: true, marks, xLabel,
      yLines: [income ? { y: income * 0.3, label: `30% of income (${rand(income * 0.3)})` } : null],
      story: `${p.kind === 'rent' ? 'Rent rises every year.' : `Stacked, so the top edge is the whole month. ${p.bond ? 'The bond stays level unless the rate changes, then stops when it is paid off; ' : ''}rates, insurance and upkeep carry on and rise with costs.`}${alt ? ` The dashed line is ${cmp.names[1].toLowerCase()} each month.` : ''}` }),
    el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
      el('thead', {}, [el('tr', {}, ['A month', ...cols.map(([, h]) => h)].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
      el('tbody', {}, [
        ...parts.map(([k, label]) => el('tr', {}, [el('td', { text: label }), ...cols.map(([t]) => el('td', { class: 'num', text: rand(partOf(p.months[t], k)) }))])),
        el('tr', {}, [el('th', { text: 'All of it' }), ...cols.map(([t]) => el('th', { class: 'num', text: rand(p.months[t].out - p.months[t].upgradeNow) }))]),
        alt ? el('tr', {}, [el('td', { text: cmp.names[1] }), ...cols.map(([t]) => el('td', { class: 'num', text: rand(altOut(t + 1)) }))]) : null,
      ]),
    ])]),
  ]);
}

/** "How much of the home is yours?" (D-086): what it is worth, split into owed and yours. */
function equityPanel(p, span, xLabel, marks) {
  const pts = (get) => [[0, get({ value: p.value0, owed: p.owed0 || p.loan })], ...p.months.slice(0, span).filter((m) => m.t % 3 === 0).map((m) => [m.t, get(m)])];
  const now = p.months[Math.max(0, p.now)] ?? p.months[0];
  return el('div', { class: 'panel stack', 'data-field': 'equity' }, [
    el('h2', { text: 'How much of the home is yours?', style: { margin: 0 } }),
    el('p', { style: { margin: 0 }, text: `${p.now > 0 ? 'Today' : 'At the start'} it is worth about ${rand(now.value)}; ${rand(now.owed)} is owed to the bank and ${rand(Math.max(0, now.value - now.owed))} is yours.` }),
    lineChart([
      { name: 'Owed to the bank', points: pts((m) => Math.min(m.owed, m.value)), colour: 'var(--text-dim)' },
      { name: 'Yours (equity)', points: pts((m) => Math.max(0, m.value - m.owed)), colour: 'var(--ok)' },
    ], { label: 'What the home is worth, split into what is owed and what is yours', stack: true, marks, xLabel,
      story: 'The top edge is what the home is worth. Equity is the part you own once the bond is subtracted - not cash you can spend: selling costs, tax and the time it takes to sell still apply.' }),
  ]);
}

/** "Can you carry it?" (D-084): the home's own risks and the household's room to absorb them. */
function carryPanel(v, p, today, state, H, cmp) {
  const range = cmp ? scenarioRange(cmp.values, today, state.ranges ?? defaultRanges(cmp.values), H, { a: 0, b: 1 }) : null;
  const { factors, options } = carryIt(v, p, today, range, cmp?.names);
  const mark = { ok: ['fin-better', 'Fine'], watch: ['', 'Worth a look'], strain: ['fin-worse', 'Tight'], unknown: ['muted', 'Not assessed'] };
  return el('div', { class: 'panel stack', 'data-field': 'carry' }, [
    el('h2', { text: 'Can you carry it?', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Your ability to handle an unexpected expense or a lost income can matter as much as the projected numbers. No score - each line says what it is based on. Fill in "Your situation" above for more of them.' }),
    el('ul', { class: 'list' }, factors.map((f) => el('li', {}, [el('div', { class: 'list__main' }, [
      el('strong', { text: f.title }), ' ', el('span', { class: `small ${mark[f.level][0]}`, text: `· ${mark[f.level][1]}` }),
      el('div', { class: 'small', text: f.text }),
    ])]))),
    options.length ? el('div', { class: 'stack', style: { gap: 'var(--space-1)' } }, [el('strong', { class: 'small', text: 'Options to consider' }), el('ul', { class: 'small', style: { margin: 0 } }, options.map((t) => el('li', { text: t })))]) : null,
    el('details', { class: 'more' }, [el('summary', { text: 'Room to absorb, and comfort with risk' }),
      el('p', { class: 'small', text: 'Two different things. Room to absorb (risk capacity) is whether you could actually get through a loss or a bad patch - cash, income, other commitments. Comfort (risk tolerance) is how you feel about uncertainty. Someone can be comfortable with risk but have little room, or have plenty of room but prefer a predictable outcome. Both are yours to weigh; this only shows what the figures say.' })]),
  ]);
}

/** The things people forget - counted (with their value) or plainly not counted yet. */
function forgotten(v, p, cmp) {
  const on = p.on;
  const items = [
    p.kind === 'buy' ? [n(v.quoteTransfer) && n(v.quoteBond) ? true : 'est', `Transfer duty ${rand(p.buyItems.find((x) => x.key === 'duty')?.amount ?? 0)} and attorneys’, Deeds Office and bank fees, paid however short the stay${n(v.quoteTransfer) && n(v.quoteBond) ? ' - from your quotes' : ' - attorneys estimated from the fee guideline until you add quotes'}`] : null,
    p.kind === 'rent' ? [true, 'Is the rent what a comparable home really rents for? Check a few listings nearby'] : null,
    [n(v.cashNow) ? true : false, n(v.cashNow) ? 'The cash buffer left after moving in - see "Can you carry it?"' : 'Would moving in eat into your emergency savings? Add your cash under "Your situation"'],
    p.kind !== 'rent' ? [n(v.sellPct) > 0, `Selling later costs ${pct(n(v.sellPct), 1)} of the price - mostly the agent, with VAT`] : null,
    p.kind === 'rent' ? [n(v.rentRisePct) > 0, `Rent rising ${pct(n(v.rentRisePct), 1)} a year, while a bond instalment stays the same`] : null,
    p.kind !== 'rent' ? [on.running && v.maintMode === 'percent' ? 'est' : on.running && n(v.maintYearly) > 0, on.running ? (v.maintMode === 'percent' ? `Maintenance as ${pct(n(v.upkeepPct), 1)} of the value - estimated with a rule of thumb; your own figure is better` : n(v.maintYearly) ? `Your own maintenance: ${rand(n(v.maintYearly))} a year` : 'Maintenance - not counted yet') : 'Running costs - left out'] : null,
    p.kind !== 'rent' ? [on.upgrades && (v.upgrades ?? []).length > 0, (v.upgrades ?? []).length ? 'Upgrades that add value' : 'Upgrades that add value - none planned'] : null,
    [on.travel && n(v.km) > 0, on.travel ? (n(v.km) ? 'Getting to work, every month' : 'Getting to work - not counted yet') : 'Getting to work - left out'],
    [!!cmp, cmp ? `What it is compared with: ${cmp.names[1].toLowerCase()} - on the same money, the differences ${v.diffCash ? 'kept as cash' : 'invested'}` : `What it is compared with - add ${alternativeOf(v, new Date().toISOString().slice(0, 10)).ask} under "What you compare it with"`],
    p.kind !== 'rent' ? [true, 'Tax on selling the home you live in: none on the first R3 million of gain'] : null,
    [scenarioCount(v) > 0, scenarioCount(v) ? `${scenarioCount(v)} what-if${scenarioCount(v) === 1 ? '' : 's'} ticked - each one's effect under "What each one did"` : 'What if you paid more, or took money out? Add a line under "What if…"'],
  ].filter(Boolean);
  return el('div', { class: 'panel stack', 'data-field': 'forgotten' }, [
    el('h2', { text: 'Did you think of…', style: { margin: 0 } }),
    // Counted (✓), estimated until you give your own (≈), or not counted / left out (○) - never an unknown quietly taken as zero.
    el('ul', { style: { margin: 0, paddingLeft: 0, listStyle: 'none' } }, items.map(([ok, t]) => el('li', { class: ok ? null : 'muted', text: `${ok === 'est' ? '≈' : ok ? '✓' : '○'} ${t}` }))),
    el('p', { class: 'small muted', style: { margin: 0 }, text: '✓ counted · ≈ estimated - your own figure replaces it · ○ not counted or left out' }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'And what is not money: being able to stay, making the place your own, the freedom to move.' }),
  ]);
}
const scenarioCount = (v) => (v.scenarios ?? []).filter((s) => s && s.on !== false && s.from).length;

/* ----------------------------------------------------------------- compare */

const cmp = { picked: null, years: 10, a: null, b: null };
const cmpRange = {};   // the scenario range's settings, kept while you move around

function compareScreen(hub, param) {
  const all = loadAll(hub);
  if (all.loading) return loading();
  if (all.error) return failure(all.error);
  const today = hub.today();
  if (cmp.picked == null) cmp.picked = new Set(param ? param.split(',') : all.data.slice(0, 2).map((r) => r.id));
  const recs = all.data.filter((r) => cmp.picked.has(r.id));
  const items = recs.map((rec) => ({ rec, v: valuesOf(rec) })).map((x) => ({ ...x, plan: homePlan(x.v, today) })).filter((x) => !x.plan.missing);
  const pickList = el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Which homes', style: { margin: 0 } }),
    el('ul', { class: 'list' }, all.data.map((rec) => el('li', {}, [
      el('label', { class: 'checkline' }, [
        el('input', { type: 'checkbox', checked: cmp.picked.has(rec.id), 'data-field': `pick:${rec.id}`, on: { change: (e) => { if (e.target.checked) cmp.picked.add(rec.id); else cmp.picked.delete(rec.id); hub.render(); } } }),
        el('span', {}, [el('strong', { text: rec.title || 'Untitled' }), el('span', { class: 'small muted', text: ` · ${KINDS[valuesOf(rec).kind]}` })]),
      ]),
    ]))),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Compare after' }, [1, 3, 5, 10, 15, 20, 30].map((y) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(cmp.years === y), text: yrs(y), on: { click: () => { cmp.years = y; hub.render(); } },
    }))),
  ]);
  const head = [
    el('h1', { id: 'cmp-title', text: 'Compare homes', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Any of your saved homes, side by side: buying against buying, against renting, or keeping the one you own. Each has the same money every month - whoever needs less that month invests the difference - so different things compare fairly.' }),
    pickList,
  ];
  if (items.length < 2) return el('section', { class: 'stack', 'aria-labelledby': 'cmp-title' }, [...head, el('p', { class: 'panel muted', text: 'Tick two or more homes.' })]);
  const v0 = items[0].v;
  const sm = sameMoney(items.map((x) => x.plan), { investPct: n(v0.investPct) || 9, investTaxPct: n(v0.investTaxPct) || 15, investShare: v0.investShare ?? 100, cash: v0.diffCash === true });
  const H = cmp.years * 12;
  const fromLater = sm.align !== today.slice(0, 7);
  const wealth = sm.series.map((s) => s[H - 1].wealth);
  const best = wealth.indexOf(Math.max(...wealth));
  const words = items.map((x, i) => (i === best ? null : `${x.rec.title} would leave you ${rand(wealth[best] - wealth[i])} less than ${items[best].rec.title} after ${yrs(cmp.years)}.`)).filter(Boolean);
  const flips = items.map((x, i) => {
    if (i === best) return null;
    const c = crossing(sm.series[best].map((s) => [s.t, s.wealth]), sm.series[i].map((s) => [s.t, s.wealth]));
    return c != null && c < 360 ? `${items[best].rec.title} starts to leave you more than ${x.rec.title} in ${whenLabel(c)}${c > H ? ' - after the time you chose' : ''}.` : null;
  }).filter(Boolean);
  // The two being weighed up (D-084): the one you are looking at, and its alternative.
  const ids = items.map((x) => x.rec.id);
  if (!ids.includes(cmp.a)) cmp.a = items.find((x) => x.plan.kind === 'buy')?.rec.id ?? ids[0];
  if (!ids.includes(cmp.b) || cmp.b === cmp.a) cmp.b = ids.find((id) => id !== cmp.a);
  const ia = ids.indexOf(cmp.a); const ib = ids.indexOf(cmp.b);
  const nameOf = (i) => items[i].rec.title || `Home ${i + 1}`;
  const after = fromLater ? `by ${Number(sm.align.slice(0, 4)) + cmp.years}` : `after ${yrs(cmp.years)}`;
  const diff = wealth[ia] - wealth[ib];
  const close = Math.abs(diff) < Math.max(20000, 0.02 * Math.max(Math.abs(wealth[ia]), Math.abs(wealth[ib])));
  const pickOne = (key, label) => items.length > 2 ? el('label', { class: 'small row', style: { gap: '6px' } }, [label, el('select', { class: 'select', style: { width: 'auto' }, 'data-field': `cmp-${key}`, on: { change: (e) => { cmp[key] = e.target.value; hub.render(); } } },
    items.map((x, i) => el('option', { value: x.rec.id, selected: x.rec.id === cmp[key], text: nameOf(i) })))]) : null;
  const ka = items[ia].v; const kinds = items.map((x) => x.plan.kind);
  const assumptions = [
    kinds.some((k) => k !== 'rent') ? `house prices growing ${pct(n(ka.growthPct ?? PLAN_DEFAULTS.growthPct))} a year` : null,
    `investments growing ${pct(n(v0.investPct ?? PLAN_DEFAULTS.investPct))} a year before tax`,
    kinds.includes('rent') ? `rent rising ${pct(n(items.find((x) => x.plan.kind === 'rent').v.rentRisePct ?? PLAN_DEFAULTS.rentRisePct))} a year` : null,
    kinds.includes('buy') ? `a bond rate of ${pct(n(items.find((x) => x.plan.kind === 'buy').v.ratePct ?? PLAN_DEFAULTS.ratePct))}` : null,
  ].filter(Boolean);
  const answer = close
    ? `${nameOf(ia)} and ${nameOf(ib)} come out about the same ${after} (within ${rand(Math.abs(diff))}). With money this close, the choice may rest more on what you can comfortably carry, flexibility, and what you would rather live in.`
    : `Under these assumptions, ${diff > 0 ? nameOf(ia) : nameOf(ib)} could leave you with about ${rand(Math.abs(diff))} more ${after} than ${diff > 0 ? nameOf(ib) : nameOf(ia)}.`;
  return el('section', { class: 'stack', 'aria-labelledby': 'cmp-title' }, [
    ...head,
    el('div', { class: 'panel stack', 'data-field': 'cmp-answer' }, [
      el('h2', { text: 'Which would leave you better off?', style: { margin: 0 } }),
      items.length > 2 ? el('div', { class: 'row' }, [pickOne('a', 'This'), pickOne('b', 'against')]) : null,
      el('div', { class: 'stats' }, [
        stat(rand(wealth[ia]), `${nameOf(ia)}: what you would have ${after}`, 'r-a'),
        stat(rand(wealth[ib]), `${nameOf(ib)}: what you would have ${after}`, 'r-b'),
        stat(rand(Math.abs(diff)), close ? 'about the same' : `more with ${diff > 0 ? nameOf(ia) : nameOf(ib)}`, 'r-diff'),
      ]),
      el('p', { style: { margin: 0, fontWeight: 600 }, text: answer }),
      el('p', { class: 'small', style: { margin: 0 }, text: `Mainly assuming ${assumptions.join(', ')}. If these turn out differently, so can the answer - the range below shows how much.` }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: '"What you would have" is the home sold (or the deposit back) plus everything invested, on the same money each month. It is about money only: whether a home gains value, whether you can carry it, and what you would prefer to live in are separate questions - each home\'s own page has "Can you carry it?".' }),
    ]),
    el('div', { class: 'panel stack' }, [el('h2', { text: 'In plain words', style: { margin: 0 } }), ...[...words, ...flips].map((t) => el('p', { style: { margin: 0 }, text: t })),
      fromLater ? el('p', { style: { margin: 0 }, text: `Compared from ${ymName(sm.align)}, when the last of them starts - until then nothing differs between them.` }) : null,
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Each home is worked out with its own ticks and what-ifs, as saved. Change one by opening it. A home started earlier (ours, since we bought it) joins with what it has by then - what it cost before is the same whichever you choose.' })]),
    chartPanel('Where each would leave you', lineChart(items.map((x, i) => ({ name: x.rec.title || `Home ${i + 1}`, points: sm.series[i].filter((s) => s.t % 6 === 0).map((s) => [s.t, s.wealth]) })), {
      label: 'What each household would have, year by year, on the same money', marks: [{ x: H, label: `${yrs(cmp.years)}` }],
      xLabel: fromLater ? (x) => String(Number(sm.align.slice(0, 4)) + Math.floor((Number(sm.align.slice(5)) - 1 + x) / 12)) : null,
      story: 'Each line is what that choice would leave you if you stopped then: the home sold after selling costs, bonds and tax (or the rental deposit back), plus everything invested - on the same money each month.' })),
    rangePanel({ values: items.map((x) => x.v), today, state: cmpRange, names: [nameOf(ia), nameOf(ib)], H, opts: { a: ia, b: ib }, xLabel: fromLater ? (x) => String(Number(sm.align.slice(0, 4)) + Math.floor((Number(sm.align.slice(5)) - 1 + x) / 12)) : null }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums fin-compare' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: '' }), ...items.map((x) => el('th', { class: 'num', text: x.rec.title || 'Untitled' }))])]),
        el('tbody', {}, [
          ['Kind', (x) => KINDS[x.plan.kind]],
          ['From savings on day one', (x, i) => rand(-sm.day1[i])],
          ['A month now', (x) => rand(-x.plan.monthNow)],
          ['Bond paid off', (x) => (x.plan.bond ? ymName(x.plan.bond.paidOff) : '-')],
          [`Would leave you, after ${yrs(cmp.years)}`, (x, i) => rand(wealth[i])],
          ['Against the best', (x, i) => (i === best ? 'best' : rand(wealth[i] - wealth[best]))],
        ].map(([label, get]) => el('tr', {}, [el('td', { text: label }), ...items.map((x, i) => el('td', { class: 'num', text: get(x, i) }))]))),
      ])]),
      exportBar(`Homes compared - ${items.map((x) => x.rec.title || 'Untitled').join(', ')}`),
    ]),
  ]);
}
