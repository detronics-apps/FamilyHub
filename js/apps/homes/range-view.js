// The scenario range on screen (D-084, D-086): the comparison graph with its shaded range
// and what it says in words, "Explore how the result could change" right under it (lower,
// your estimate and upper for each assumption, as numbers), and "What could change the
// answer?" as bars. Every change recalculates through the real model (scenarios.js).

import { el } from '../../ui/dom.js';
import { lineChart, barsChart, shows, rand, pct } from '../finance/pod.js';
import { scenarioRange, relevant, defaultRanges, presetRanges, VARS } from './scenarios.js';
import { PLAN_DEFAULTS } from './home.js';

const yrs = (y) => `${y} year${y === 1 ? '' : 's'}`;
const signed = (x, unit) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x)}${unit === 'percent' ? '%' : ' points'}`;
const num = (x, d = 0) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? Number(d) : Number(x));

/** The same, as one block (Compare). */
export function rangePanel(args) {
  const p = rangeParts(args);
  return el('div', { class: 'stack', 'data-field': 'range-panel' }, [p.chart, p.explore, p.moves]);
}

/**
 * In three parts a page can place: the graph with its reading, Explore, and the bars.
 * @param names   [A, B]: positive means A leaves you more
 * @param H       months at which the answer is read
 * @param title   the graph's question, e.g. "Buying or renting: which leaves you more?"
 * @param onCentral(field, value)  changes the first home's own figure (its page only)
 * @param endX    the month the page's graphs end at (D-089); the graph still reaches H
 */
export function rangeParts({ values, today, state, names, H, opts = {}, xLabel = null, onCentral = null, title = null, todayX = null, endX = null }) {
  const parts = { chart: el('div', { class: 'stack', 'data-field': 'range-chart' }), explore: el('div', { class: 'stack' }), moves: el('div', { class: 'stack' }) };
  const keys = relevant(values).map((x) => x.key).join();
  if (!state.ranges || state.keys !== keys) { state.ranges = defaultRanges(values); state.keys = keys; state.preset = 'narrow'; }
  state.extra ??= new Set();
  const [A, B] = names;
  const when = xLabel ? `by ${xLabel(H)}` : `after ${yrs(Math.round(H / 12))}`;
  const draw = () => {
    const r = scenarioRange(values, today, state.ranges, H, opts);
    if (!r) { parts.chart.replaceChildren(el('p', { class: 'panel muted', text: 'Fill in the homes to see the comparison.' })); parts.explore.replaceChildren(); parts.moves.replaceChildren(); return; }
    parts.chart.replaceChildren(chartPanel(r));
    parts.explore.replaceChildren(explore(r));
    parts.moves.replaceChildren(moves(r));
  };

  function chartPanel(r) {
    // Where the page says the graphs end - never before the year the answer is read at.
    const span = Math.min(r.central.series.length, endX != null ? Math.max(endX, H) : Math.max(H + 24, 120));
    const step = (s) => s.series.slice(0, span).filter(([t]) => t % 3 === 0 || t === H);
    const fav = step(r.favourable); const unf = step(r.unfavourable);
    const band = step(r.central).map(([t], i) => [t, Math.min(fav[i][1], unf[i][1]), Math.max(fav[i][1], unf[i][1])]);
    const c = r.at.central;
    const marks = [{ x: H, label: when[0].toUpperCase() + when.slice(1) }, todayX ? { x: todayX, label: 'Today' } : null].filter(Boolean);
    const cross = r.crossings.central;
    if (cross != null && cross <= span) {
      const up = r.central.series[cross - 1][1] > 0;
      marks.push({ x: cross, label: `${up ? A : B} leaves more${xLabel ? ` from ${xLabel(cross)}` : ''}` });
    }
    const lo = Math.min(r.at.favourable, r.at.unfavourable); const hi = Math.max(r.at.favourable, r.at.unfavourable);
    return el('div', { class: 'panel stack', 'data-field': 'main-graph' }, [
      el('h2', { text: title ?? `${A} or ${B.toLowerCase()}: which leaves you more?`, style: { margin: 0 } }),
      el('p', { style: { margin: 0, fontWeight: 600 }, 'data-field': 'main-answer', text: Math.abs(c) < 1000 ? `${A} and ${B.toLowerCase()} come out about the same ${when}.` : `${c > 0 ? A : B} leaves you about ${rand(Math.abs(c))} more ${when}, at your figures.` }),
      lineChart([{ name: `${A} minus ${B.toLowerCase()}`, points: step(r.central) }], {
        label: `How much more ${A.toLowerCase()} leaves you than ${B.toLowerCase()}, over time`, marks, xLabel,
        zones: { above: `${A} leaves more`, below: `${B} leaves more` },
        dots: [{ x: H, y: c, label: `${c >= 0 ? '+' : '−'}${rand(Math.abs(c))}`, below: c < 0 }],
        band: { name: `Tested range: ${rand(lo)} to ${rand(hi)}`, points: band },
        story: `Each point is what ${A.toLowerCase()} would leave you, minus what ${B.toLowerCase()} would, if you stopped then - homes sold after selling costs, bonds and tax, plus everything invested, on the same money each month. The shaded range is the less and the more favourable assumptions, each worked out again in full.`,
      }),
      ...readRange(r, names, when).map((t) => el('p', { style: { margin: 0 }, text: t })),
      el('details', { class: 'more' }, [el('summary', { text: 'What this range is - and is not' }),
        el('p', { class: 'small', text: 'The favourable and unfavourable lines are each worked out again through the whole calculation with their assumptions - not drawn a fixed distance from the central line - so you see how the assumptions really interact.' }),
        el('p', { class: 'small', text: `Favourable for ${A.toLowerCase()}: ${scenarioWords(r.favDeltas)}. Unfavourable: ${scenarioWords(r.unfDeltas)}. All at once on purpose - a stress test, not a prediction of what is likely. It is not a probability: things not tested (losing an income, a special levy, a slow sale) can push the result outside it.` })]),
    ]);
  }

  function explore(r) {
    const top = r.effects.slice(0, 3).map((e) => e.key);
    const vars = relevant(values).filter((x) => shows('advanced') || top.includes(x.key) || state.extra.has(x.key));
    const preset = (key) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.preset === key), text: { narrow: 'Narrow', wider: 'Wider' }[key], 'data-field': `range-preset:${key}`,
      on: { click: () => { state.ranges = presetRanges(values, key); state.preset = key; draw(); } } });
    return el('div', { class: 'panel stack', 'data-field': 'range-sliders' }, [
      el('h2', { text: 'Explore how the result could change', style: { margin: 0 } }),
      el('p', { class: 'small', style: { margin: 0 }, text: 'The line uses your own figures. Set a lower and an upper value for each assumption to see the result if things go less or more favourably - the graph works out the whole comparison again with them.' }),
      el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [el('span', { class: 'small muted', text: 'Range' }),
        el('div', { class: 'chipset', role: 'group', 'aria-label': 'How wide a range' }, [preset('narrow'), preset('wider'),
          el('span', { class: 'chip', 'aria-pressed': String(state.preset === 'custom'), text: 'Custom', title: 'Set by the sliders below' })])]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: `Narrow tests about 2 points either side of your figure (repairs 50%); wider, half as much again. Testing choices, not forecasts or historical ranges - widen them if you are less sure.${shows('advanced') ? '' : ' Shown: the three that move the answer most - all of them in Advanced, or Adjust beside any below.'}` }),
      ...vars.map(row),
    ]);
  }

  // One assumption: lower · your estimate · upper, each as a number, with a slider either side.
  function row(x) {
    const r = state.ranges[x.key];
    const field = x.field(values[0]);
    const money = field === 'maintYearly';
    const central = num(values[0][field], PLAN_DEFAULTS[field] ?? 0);
    const at = (d) => (x.unit === 'percent' ? central * (1 + d / 100) : central + d);
    const show = (y) => (money ? `${rand(y)} a year` : `${pct(y, 2)}${field === 'upkeepPct' ? ' of the value' : ''}`);
    const lowOut = el('strong', { text: show(at(r.low)) }); const highOut = el('strong', { text: show(at(r.high)) });
    const slider = (side, min, max, out) => el('input', { type: 'range', min, max, step: x.step, value: r[side], style: { width: '100%' }, 'aria-label': `${x.label}: ${side === 'low' ? 'lower' : 'upper'} value`, 'data-field': `range:${x.key}:${side}`,
      on: { input: (e) => { r[side] = Number(e.target.value); out.textContent = show(at(r[side])); }, change: () => { state.preset = 'custom'; draw(); } } });
    const mine = onCentral
      ? el('input', { class: 'input', type: 'number', inputmode: 'decimal', step: money ? 1000 : 0.25, value: central, style: { maxWidth: '7em', textAlign: 'center' }, 'aria-label': `${x.label}: your estimate`, 'data-field': `range-central:${x.key}`,
        on: { change: (e) => { if (e.target.value !== '' && Number.isFinite(Number(e.target.value))) onCentral(field, Number(e.target.value)); } } })
      : el('strong', { text: show(central) });
    const cell = (head, body, extra) => el('div', { class: 'stack', style: { gap: '2px', flex: '1 1 0', minWidth: 0, alignItems: 'center', textAlign: 'center' } }, [el('span', { class: 'small muted', text: head }), body, extra].filter(Boolean));
    return el('fieldset', { class: 'stack', style: { gap: 'var(--space-1)', border: 0, borderTop: '1px solid var(--border)', padding: 'var(--space-2) 0 0', margin: 0 }, 'data-field': `range-row:${x.key}` }, [
      el('label', { class: 'checkline' }, [el('input', { type: 'checkbox', checked: r.on !== false, 'data-field': `range-on:${x.key}`, on: { change: (e) => { r.on = e.target.checked; state.preset = 'custom'; draw(); } } }), el('strong', { text: x.label }), el('span', { class: 'small muted', text: r.on === false ? ' - not tested' : '' })]),
      el('div', { class: 'row', style: { gap: 'var(--space-2)', flexWrap: 'nowrap', alignItems: 'flex-end' } }, [
        cell('Lower', lowOut, slider('low', -x.max, 0, lowOut)),
        cell(onCentral ? 'Your estimate' : 'Your figure', mine, onCentral ? el('span', { class: 'small muted', text: money ? 'a year' : '% a year' }) : null),
        cell('Upper', highOut, slider('high', 0, x.max, highOut)),
      ]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: `${x.why} ${x.how}` }),
    ]);
  }

  function moves(r) {
    const towards = (d) => (Math.abs(d) < 1000 ? 'hardly changes it' : `moves it ${rand(Math.abs(d))} towards ${d > 0 ? A.toLowerCase() : B.toLowerCase()}`);
    const adjust = (key) => {
      state.extra.add(key); draw();
      const s = parts.explore.querySelector(`[data-field="range:${key}:low"]`);
      s?.scrollIntoView({ block: 'center' }); s?.focus();
    };
    const homes = values.some((v) => v.kind !== 'rent');
    const noRepairs = homes && !relevant(values).some((x) => x.key === 'repairs');
    return el('div', { class: 'panel stack', 'data-field': 'moves' }, [
      el('h2', { text: 'What could change the answer?', style: { margin: 0 } }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: `Each assumption moved on its own from its lower to its upper value, ${when}. Longest bar first. This order belongs to these homes and these years - it is not a general ranking of risks.` }),
      barsChart(r.effects.map((e) => ({ label: e.label, low: Math.min(e.atLow, e.atHigh), high: Math.max(e.atLow, e.atHigh) })), { label: 'What could change the answer', worse: `more for ${B.toLowerCase()}`, better: `more for ${A.toLowerCase()}` }),
      el('ul', { class: 'list' }, r.effects.map((e) => el('li', {}, [
        el('div', { class: 'list__main' }, [
          el('strong', { text: e.label }),
          el('div', { class: 'small', text: `${signed(e.low, e.unit)}: ${towards(e.atLow)} · ${signed(e.high, e.unit)}: ${towards(e.atHigh)}${r.flips.includes(e) ? ' - on its own this can change which leaves you more' : ''}` }),
        ]),
        el('button', { class: 'btn btn-small', type: 'button', text: 'Adjust', 'aria-label': `Adjust the range for ${e.label.toLowerCase()}`, 'data-field': `adjust:${e.key}`, on: { click: () => adjust(e.key) } }),
      ]))),
      noRepairs ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'Repairs are not tested: no maintenance figure is filled in, and 50% more than nothing is still nothing. Add yours under "Running it".' }) : null,
    ]);
  }

  draw();
  return parts;
}

function scenarioWords(d) {
  const parts = VARS.filter((x) => d[x.key] !== undefined && d[x.key] !== 0).map((x) => `${x.label.toLowerCase()} ${signed(d[x.key], x.unit)}`);
  return parts.length ? parts.join(', ') : 'nothing moved';
}

/** The range in words - read from the results, nothing assumed. Positive favours names[0]. */
export function readRange(r, names, when) {
  const [A, B] = names;
  const out = [];
  const lo = Math.min(r.at.favourable, r.at.unfavourable); const hi = Math.max(r.at.favourable, r.at.unfavourable);
  if (r.verdict === 'all-above') out.push(`Across every scenario tested, ${A.toLowerCase()} leaves you more ${when} - from about ${rand(lo)} to ${rand(hi)} more than ${B.toLowerCase()}.`);
  else if (r.verdict === 'all-below') out.push(`Across every scenario tested, ${B.toLowerCase()} leaves you more ${when} - from about ${rand(-hi)} to ${rand(-lo)} more than ${A.toLowerCase()}.`);
  else out.push(`The range crosses zero: ${when}, ${(r.at.favourable > 0 ? A : B).toLowerCase()} leaves you more if things go its way, and ${(r.at.unfavourable > 0 ? A : B).toLowerCase()} if they do not. Which is better depends on how the assumptions turn out.`);
  const mid = Math.abs(r.at.central);
  out.push(r.width > mid ? `The range is wide - about ${rand(r.width)} from one end to the other, more than the answer itself - so the answer is sensitive to the assumptions.` : `The range is about ${rand(r.width)} from one end to the other - less than the answer itself, so it holds up fairly well across what was tested, though risks not tested here still exist.`);
  if (r.flips.length) out.push(`On its own, ${r.flips.map((e) => e.label.toLowerCase()).join(' or ')} going the other way can change which leaves you more.`);
  else if (r.verdict === 'crosses') out.push('No single assumption changes the answer on its own - it takes several going the same way.');
  return out;
}
