// Children's future (D-069): the big costs of growing up, for each child and for the
// family together, from the birthdays in People. Each child's list starts from a
// common set of milestones that the family switches on, changes, removes or adds to.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { loading, failure, saveRecord } from '../kit.js';
import { REFERENCE } from '../finance/maths.js';
import { levelBar, shows, stat, step, lineChart, chartPanel, crossing, whenLabel, rand, pct, months } from '../finance/pod.js';
import { normalisePlan, schedule, family, savingAt, startingLater, exactAge } from './logic.js';

const plans = (hub) => hub.data.collection('plans', { summary: (r) => ({ title: r.personId ?? 'settings' }), prefix: 'kid' });
const SETTINGS = 'settings';
const DEFAULT_SAVINGS = 6;

/** Children: anyone under 25 with a birthday, or marked as a child. */
function kids(hub) {
  const today = hub.today();
  return hub.people.list().filter((p) => p.role === 'child' || (p.born && exactAge(p.born, today) < 25));
}

const load = (hub) => hub.use('plans', async () => {
  const col = plans(hub);
  const { items } = await col.list({ limit: 1000 });
  const all = await Promise.all(items.map((s) => col.get(s.id)));
  return new Map(all.filter(Boolean).map((r) => [r.id, r]));
});

export function render(hub, route) {
  const r = load(hub);
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (route.sub === 'child') return childScreen(hub, r.data, route.rest[0]);
  return familyScreen(hub, r.data);
}

const savingsPct = (data) => Number(data.get(SETTINGS)?.savingsPct ?? DEFAULT_SAVINGS);
const planFor = (data, id) => normalisePlan(data.get(`kid_${id}`) ?? {});
const save = (hub, data, id, items) => saveRecord(hub, plans(hub), { ...(data.get(`kid_${id}`) ?? {}), id: `kid_${id}`, personId: id, items });

/* --------------------------------------------------------------- family */

function familyScreen(hub, data) {
  const today = hub.today();
  const children = kids(hub);
  const rate = savingsPct(data);
  const known = children.filter((c) => c.born).map((c) => ({ ...c, plan: schedule(c, planFor(data, c.id).items, today, { savingsPct: rate }) }));
  const noBirthday = children.filter((c) => !c.born);
  const f = family(known);
  const name = Object.fromEntries(known.map((c) => [c.id, c.name]));

  const head = [
    el('h1', { id: 'kids-title', text: 'What will the children need?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'School, studies and starting out, for each child - and all of them together, so the years when costs pile up show early.' }),
    levelBar(() => hub.render()),
  ];
  if (!children.length) {
    return el('section', { class: 'stack', 'aria-labelledby': 'kids-title' }, [...head,
      el('div', { class: 'panel stack' }, [
        el('p', { style: { margin: 0 }, text: 'No children in Family Hub yet. Add them in People, with their birthdays, and their costs appear here.' }),
        el('a', { class: 'btn btn-primary', href: '#/people', text: 'People' }),
      ])]);
  }
  const later = startingLater(known.flatMap((c) => c.plan.payments), 12, rate);
  return el('section', { class: 'stack', 'aria-labelledby': 'kids-title' }, [
    ...head,
    noBirthday.length ? el('p', { class: 'panel', role: 'note' }, [`${noBirthday.map((c) => c.name).join(' and ')} ${noBirthday.length === 1 ? 'has' : 'have'} no birthday in People yet, so ${noBirthday.length === 1 ? 'is' : 'are'} not counted. `, el('a', { href: '#/people', text: 'Add it in People' }), '.']) : null,
    known.length ? el('div', { class: 'stats' }, [
      stat(rand(f.monthlyNow), 'to put aside each month for studies and starting out', 'r-save'),
      stat(rand(f.nowMonthly), 'a month from the budget now', 'r-now'),
      f.budgetPeak?.budget ? stat(rand(f.budgetPeak.budget / 12), `a month from the budget at most, in ${f.budgetPeak.year}`, 'r-budget-peak') : null,
    ]) : null,
    known.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it means', style: { margin: 0 } }),
      ...known.map((c) => {
        const firstOf = new Map(); for (const p of c.plan.payments) if (p.budget && !firstOf.has(p.item)) firstOf.set(p.item, p);
        const steps = [...firstOf.values()].slice(0, 3).map((p) => `${p.name.toLowerCase()} from ${p.year} (about ${rand(p.amount / 12)} a month)`);
        const ahead = c.plan.payments.find((p) => !p.budget);
        return el('p', { style: { margin: 0 } }, [
          el('strong', { text: `${c.name} (${Math.floor(c.plan.age)}): ` }),
          c.plan.nowMonthly ? `${rand(c.plan.nowMonthly)} a month from the budget now. ` : '',
          steps.length ? `From the budget as they come: ${steps.join(', ')}. ` : '',
          ahead ? `Put aside ${rand(c.plan.monthlyNow)} a month from now for ${[...new Set(c.plan.payments.filter((p) => !p.budget).map((p) => p.name.toLowerCase()))].slice(0, 3).join(', ')} - the first in ${ahead.year}. ` : 'Nothing to save ahead for on the list. ',
          ' ', el('a', { href: hub.href('child', c.id), 'data-field': `child:${c.id}`, text: `Change ${c.name}’s list` }),
        ]);
      }),
      f.overlap.length ? el('p', { style: { margin: 0 }, text: `${f.overlap.length === 1 ? `In ${f.overlap[0].year}` : `In ${f.overlap.length} of the years ahead (${f.overlap.slice(0, 3).map((y) => y.year).join(', ')}${f.overlap.length > 3 ? '…' : ''})`}, more than one child has costs. The biggest year is ${f.peak.year}: ${rand(f.peak.total)}${f.peak.children > 1 ? `, for ${Object.keys(f.peak.by).map((id) => name[id]).join(' and ')}` : ''}.` }) : null,
      el('p', { style: { margin: 0 }, text: `Putting aside ${rand(f.monthlyNow)} a month from now covers every save-ahead cost when it falls due - if savings grow ${pct(rate)} a year. It falls as each is paid. School fees and the like are left to the budget, year by year - switch any of them to Save ahead on a child’s list.` }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'The costs are illustrative starting points - change them to your own school’s fees and your own plans. Future costs are projections, not promises.' }),
    ]) : null,
    known.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What would change it', style: { margin: 0 } }),
      el('ul', { style: { margin: 0 } }, [
        el('li', { text: `Starting a year from now instead: ${rand(later.monthly)} a month${later.unfunded > 0 ? `, and ${rand(later.unfunded)} due in the meantime would have to come straight from the budget` : ''}.` }),
        el('li', { text: 'Money already saved for a cost, or help expected (a bursary, grandparents), lowers the monthly amount - add it under Advanced on each child’s list.' }),
      ]),
    ]) : null,
    known.length && f.rows.length ? chartPanel('What falls due each year', lineChart([{ name: 'All the children together', points: f.rows.map((y) => [(y.year - Number(today.slice(0, 4))) * 12, y.total]) }], {
      label: 'What falls due each year, all the children together',
      marks: f.peak ? [{ x: (f.peak.year - Number(today.slice(0, 4))) * 12, label: `Biggest year: ${f.peak.year}` }] : [],
      story: 'The peaks are the years to be ready for - often when two children’s schooling or studies overlap.' })) : null,
    known.length ? yearTable(f, known) : null,
    known.length && shows('advanced') ? advanced(hub, data, f, known, rate) : null,
    known.length && shows('learn') ? learn(rate) : null,
  ]);
}

function yearTable(f, known) {
  const rows = f.rows.slice(0, shows('advanced') ? 40 : 25);
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Year by year', style: { margin: 0 } }),
    el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: 'Year' }), ...known.map((c) => el('th', { class: 'num', text: c.name })), el('th', { class: 'num', text: 'Together' }), el('th', { class: 'num', text: 'From the budget, a month' })])]),
      el('tbody', {}, rows.map((y) => el('tr', { class: y.children > 1 ? 'fin-overlap' : null }, [
        el('td', { text: String(y.year) }),
        ...known.map((c) => el('td', { class: 'num', text: y.by[c.id] ? rand(y.by[c.id]) : '' })),
        el('td', { class: 'num', text: rand(y.total) }),
        el('td', { class: 'num', text: y.budget ? rand(y.budget / 12) : '' }),
      ]))),
    ])]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Shaded years have costs for more than one child. Amounts are in the money of that year, grown from today’s cost.' }),
  ]);
}

function advanced(hub, data, f, known, rate) {
  const all = known.flatMap((c) => c.plan.payments);
  const horizon = Math.max(12, ...all.map((p) => p.months));
  const pts = []; for (let m = 0; m <= horizon; m += 6) pts.push([m, savingAt(all, m)]);
  const input = el('input', { class: 'input', id: 'kids-rate', type: 'number', step: 'any', value: rate, style: { maxWidth: '120px' }, 'data-field': 'in:savingsPct',
    on: { change: (e) => saveRecord(hub, plans(hub), { ...(data.get(SETTINGS) ?? {}), id: SETTINGS, savingsPct: Number(e.target.value) || 0 }) } });
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Over the years', style: { margin: 0 } }),
    lineChart([{ name: 'To put aside each month', points: pts }], { label: 'What to put aside each month, falling as each cost is paid' }),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'kids-rate' }, ['Savings grow by ', el('span', { class: 'fin-tag', text: Number(data.get(SETTINGS)?.savingsPct ?? NaN) ? 'Yours' : 'Illustrative - check your own' })]),
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [input, el('span', { class: 'small muted', text: '% a year' })]),
      el('div', { class: 'field__hint', text: 'What the money put aside earns until it is needed - for the whole family.' }),
    ]),
  ]);
}

function learn(rate) {
  return el('div', { class: 'panel stack fin-learn' }, [
    el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
    step('When a cost falls', 'A yearly cost falls on the birthday the child turns each age from "from" to "to"; a once-off cost at "from"', null, 'The year of age a child is in now is already under way: it belongs in the monthly budget, not in savings. School years start in January, so treat the year as approximate.'),
    step('What it will cost then', 'Cost then = cost today × (1 + growth)^years', null, 'School and university fees are grown at 8% a year (illustrative - they have tended to rise faster than prices); other costs at inflation. Change any of them.'),
    step('What to put aside for it', 'S = still needed × r ÷ ((1 + r)^n − 1)', `r = (1 + ${pct(rate)})^(1/12) − 1 a month; n = months until it falls due`, 'Each payment is its own small savings goal. Saved already (and help expected) is used for the earliest payments first.'),
    step('From the budget, or saved ahead', 'From budget: paid that year from income, shown as a monthly amount = cost ÷ 12. Save ahead: S as above', null, 'School fees are usually paid as they come; studies and a first car are easier saved for. Choose for each item.'),
    step('The family', 'Monthly amount now = the sum for every save-ahead payment, for every child', null, 'It falls each time a payment is made. Costs that fall in the same year for two or more children are shaded in the year-by-year table.'),
    el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
    el('ul', { class: 'small', style: { margin: 0 } }, [
      'Bursaries, loans and grandparents’ help are only counted if you enter them as help expected.',
      'Savings growth is steady here; real growth goes up and down, and tax on it is not counted.',
      'Your children will choose their own paths. This is a plan to be ready, not a plan for them.',
    ].map((t) => el('li', { text: t }))),
  ]);
}

/* ---------------------------------------------------------------- child */

function childScreen(hub, data, id) {
  const child = kids(hub).find((c) => c.id === id);
  if (!child) return el('p', { class: 'panel', text: 'That child is not in Family Hub.' });
  if (!child.born) return el('div', { class: 'panel stack' }, [el('p', { style: { margin: 0 }, text: `${child.name} needs a birthday in People first.` }), el('a', { class: 'btn', href: '#/people', text: 'People' })]);
  const today = hub.today();
  const plan = planFor(data, id);
  const s = schedule(child, plan.items, today, { savingsPct: savingsPct(data) });
  const items = plan.items;
  const put = (itemId, patch) => save(hub, data, id, items.map((x) => (x.id === itemId ? { ...x, ...patch } : x)));
  const moneyIn = (it, key, label) => el('input', { class: 'input', type: 'number', step: 'any', min: '0', value: it[key] ?? '', 'aria-label': `${label}: ${it.name}`, 'data-field': `${key}:${it.id}`, style: { maxWidth: '130px' }, on: { change: (e) => put(it.id, { [key]: Number(e.target.value) || 0 }) } });
  const ageIn = (it, key) => el('input', { class: 'input', type: 'number', min: '0', max: '60', value: it[key], 'aria-label': `${key === 'from' ? 'From age' : 'To age'}: ${it.name}`, style: { maxWidth: '76px' }, on: { change: (e) => put(it.id, { [key]: Number(e.target.value) || 0, ...(key === 'from' && it.every === 'once' ? { to: Number(e.target.value) || 0 } : {}) }) } });
  const shown = plan.shown;
  const groups = [...new Set(shown.map((x) => x.group))];
  const due = new Map(); for (const p of s.payments) due.set(p.item, (due.get(p.item) ?? 0) + p.monthly);

  const add = { name: el('input', { class: 'input', id: 'own-name', placeholder: 'e.g. Braces', 'data-field': 'own-name' }), age: el('input', { class: 'input', type: 'number', min: '0', id: 'own-age', value: Math.ceil(s.age), style: { maxWidth: '90px' } }), cost: el('input', { class: 'input', type: 'number', min: '0', id: 'own-cost', style: { maxWidth: '130px' } }) };
  let every = 'once';

  return el('section', { class: 'stack', 'aria-labelledby': 'child-title' }, [
    el('h1', { id: 'child-title', text: `${child.name}’s future`, style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: `${child.name} is ${Math.floor(s.age)}. Tick what fits your plans and put in your own costs - everything is a starting point.` }),
    levelBar(() => hub.render()),
    el('div', { class: 'stats' }, [
      stat(rand(s.monthlyNow), 'to put aside each month, for save-ahead costs', 'r-child-save'),
      stat(rand(s.nowMonthly), 'a month from the budget now', 'r-child-now'),
      stat(rand(s.total), 'still ahead, in the money of the day', 'r-child-total'),
    ]),
    ...groups.map((g) => el('div', { class: 'panel stack' }, [
      el('h2', { text: g, style: { margin: 0 } }),
      el('ul', { class: 'list' }, shown.filter((x) => x.group === g).map((it) => el('li', { class: 'stack', style: { alignItems: 'stretch', gap: 'var(--space-2)' } }, [
        el('label', { class: 'checkline' }, [
          el('input', { type: 'checkbox', checked: !!it.on, 'data-field': `on:${it.id}`, on: { change: (e) => put(it.id, { on: e.target.checked }) } }),
          el('span', {}, [el('strong', { text: it.name }), el('span', { class: 'small muted', text: ` · ${it.every === 'once' ? `at ${it.from}` : `ages ${it.from} to ${it.to}`}${it.on && due.get(it.id) ? ` · ${rand(due.get(it.id))} a month` : ''}` })]),
        ]),
        it.on ? el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [
          el('span', { class: 'muted', text: 'R' }), moneyIn(it, 'cost', 'Cost'), el('span', { class: 'small muted', text: it.every === 'once' ? 'once, in today’s money' : 'a year, in today’s money' }),
          shows('advanced') ? el('span', { class: 'small muted', text: it.every === 'once' ? '· at age' : '· ages' }) : null,
          shows('advanced') ? ageIn(it, 'from') : null,
          shows('advanced') && it.every !== 'once' ? ageIn(it, 'to') : null,
        ]) : null,
        it.on ? el('div', { class: 'chipset', role: 'group', 'aria-label': `How to pay for ${it.name}` }, [['budget', 'From budget'], ['save', 'Save ahead']].map(([v, l]) => el('button', {
          class: 'chip', type: 'button', 'aria-pressed': String((it.how ?? 'save') === v), 'data-field': `how:${it.id}:${v}`, text: l,
          title: v === 'budget' ? 'Paid from the monthly budget as it comes' : 'Saved for ahead, a little each month from now',
          on: { click: () => put(it.id, { how: v }) },
        }))) : null,
        it.on && shows('advanced') ? el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [
          el('span', { class: 'small muted', text: 'Rises' }), el('input', { class: 'input', type: 'number', step: 'any', value: it.growthPct, 'aria-label': `Rises a year: ${it.name}`, style: { maxWidth: '80px' }, on: { change: (e) => put(it.id, { growthPct: Number(e.target.value) || 0 }) } }), el('span', { class: 'small muted', text: '% a year' }),
          el('span', { class: 'small muted', text: '· Saved already R' }), moneyIn(it, 'saved', 'Saved already'),
          el('span', { class: 'small muted', text: '· Help expected R' }), moneyIn(it, 'others', 'Help expected'),
        ]) : null,
        it.hint && it.on ? el('div', { class: 'field__hint', text: it.hint }) : null,
        el('div', {}, [el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${it.name}`, on: { click: async () => {
          if (await confirmAction({ title: `Remove "${it.name}" for ${child.name}?`, text: 'It comes off this list. You can add your own items any time.', confirmLabel: 'Remove' })) put(it.id, { removed: true });
        } } })]),
      ]))),
    ])),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Add your own', style: { margin: 0 } }),
      el('div', { class: 'row' }, [
        el('div', { class: 'field', style: { flex: '1 1 200px' } }, [el('label', { class: 'field__label', for: 'own-name', text: 'What' }), add.name]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'own-age', text: 'At age' }), add.age]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'own-cost', text: 'Cost, R' }), add.cost]),
      ]),
      el('div', { class: 'chipset', role: 'group', 'aria-label': 'How often' }, [['once', 'Once'], ['year', 'Yearly']].map(([v, l]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(v === every), text: l,
        on: { click: (e) => { every = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } },
      }))),
      el('div', {}, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Add', 'data-field': 'own-add', on: { click: () => {
        if (!add.name.value.trim()) { add.name.focus(); return; }
        const from = Number(add.age.value) || 0;
        save(hub, data, id, [...items, { id: `own${Date.now().toString(36)}`, name: add.name.value.trim(), group: 'Our own', every, from, to: every === 'year' ? Math.max(from, 17) : from, cost: Number(add.cost.value) || 0, growthPct: REFERENCE.cpi.value, saved: 0, others: 0, on: true }]);
      } } })]),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'When the costs fall', style: { margin: 0 } }),
      s.payments.length ? el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
        el('thead', {}, [el('tr', {}, ['When', 'Age', 'What', 'About', 'Put aside a month'].map((h, i) => el('th', { class: i > 2 ? 'num' : null, text: h })))]),
        el('tbody', {}, s.payments.slice(0, shows('advanced') ? 200 : 15).map((p) => el('tr', {}, [
          el('td', { text: `${p.year} (${months(p.months)})` }), el('td', { text: String(p.age) }), el('td', { text: p.name }),
          el('td', { class: 'num', text: rand(p.amount) }), el('td', { class: 'num', text: p.budget ? 'from budget' : p.monthly ? rand(p.monthly) : 'covered' }),
        ]))),
      ])]) : el('p', { class: 'muted', style: { margin: 0 }, text: 'Nothing ahead on the list.' }),
    ]),
  ]);
}
