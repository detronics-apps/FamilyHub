// The scenario range on screen (D-084): the graph with its shaded range, what it means
// in words worked out from the results, what moves the answer most, and sliders to
// change the range. Every change recalculates through the real model (scenarios.js).

import { el } from '../../ui/dom.js';
import { lineChart, chartPanel, shows, rand } from '../finance/pod.js';
import { scenarioRange, relevant, defaultRanges, VARS } from './scenarios.js';

const yrs = (y) => `${y} year${y === 1 ? '' : 's'}`;
const signed = (x, unit) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x)}${unit === 'percent' ? '%' : ' points'}`;

/**
 * @param state   kept between renders: { ranges }
 * @param names   [A, B] for two homes; [name] for one
 * @param H       months at which the answer is read (the years chosen, or the stay)
 */
export function rangePanel({ values, today, state, names, H, opts = {}, xLabel = null }) {
  const host = el('div', { class: 'stack', 'data-field': 'range-panel' });
  const keys = relevant(values).map((x) => x.key).join();
  if (!state.ranges || state.keys !== keys) { state.ranges = defaultRanges(values); state.keys = keys; }
  const two = names.length > 1;
  const draw = () => host.replaceChildren(...build());

  function build() {
    const r = scenarioRange(values, today, state.ranges, H, opts);
    if (!r) return [el('p', { class: 'muted', text: 'Fill in the homes to see the range.' })];
    const span = Math.min(r.central.series.length, Math.max(H + 24, 120));
    const step = (s) => s.series.slice(0, span).filter(([t]) => t % 3 === 0);
    const band = step(r.central).map(([t], i) => {
      const f = step(r.favourable)[i][1]; const u = step(r.unfavourable)[i][1];
      return [t, Math.min(f, u), Math.max(f, u)];
    });
    const ylabel = two ? `${names[0]} against ${names[1]}` : 'How far ahead or behind';
    const when = xLabel ? `by ${xLabel(H)}` : `after ${yrs(Math.round(H / 12))}`;
    const marks = [{ x: H, label: when }];
    if (r.crossings.central != null && r.crossings.central <= span) marks.push({ x: r.crossings.central, label: two ? 'Central: they swap' : 'Central: break-even' });
    return [
      chartPanel('How much could the answer move?', lineChart([
        { name: 'Central - your figures', points: step(r.central) },
        { name: 'Favourable', points: step(r.favourable), dashed: true },
        { name: 'Unfavourable', points: step(r.unfavourable), dashed: true },
      ], { label: two ? `${ylabel}: above zero, ${names[0]} leaves you more; below zero, ${names[1]} does` : 'How far ahead or behind you would be if you left then', marks, xLabel,
        band: { name: 'The range tested', points: band },
        story: two ? `Above zero: ${names[0]} would leave you with more than ${names[1]}. Below zero: ${names[1]} would. The shaded range is every tested assumption going the less and the more favourable way, each worked out again in full.` : 'Above zero: ahead of keeping your money and paying nothing for a home. Below zero is what living there costs you - normal for any home; save a rental and Compare for the real choice. The shaded range is the tested assumptions going the less and the more favourable way, each worked out again in full.' })),
      el('div', { class: 'panel stack' }, [
        el('h2', { text: 'What the range says', style: { margin: 0 } }),
        ...readRange(r, names, when).map((t) => el('p', { style: { margin: 0 }, text: t })),
        el('details', { class: 'more' }, [el('summary', { text: 'What this range is - and is not' }),
          el('p', { class: 'small', text: 'A single projection assumes the future follows one set of assumptions. The shaded range shows how the comparison changes when the important ones turn out less or more favourable. The favourable and unfavourable lines are each worked out again through the whole calculation with those assumptions - not drawn a fixed distance from the central line - so you see how the assumptions really interact.' }),
          el('p', { class: 'small', text: 'It is a range of tested scenarios, not a probability: it does not say the result has some chance of falling inside it. Things not tested here (losing an income, a sale that takes long, a special levy) can push the outcome outside it.' }),
          el('p', { class: 'small', text: 'Favourable ' + (two ? `for ${names[0]}` : '') + ': ' + scenarioWords(r.favDeltas) + '. Unfavourable: ' + scenarioWords(r.unfDeltas) + '. Each assumption is moved the way that helps (or hurts) - all at once, which is unlikely; it shows how far things could go.' }),
        ]),
      ]),
      el('div', { class: 'panel stack' }, [
        el('h2', { text: 'What moves the answer most', style: { margin: 0 } }),
        el('p', { class: 'small muted', style: { margin: 0 }, text: `Each assumption moved on its own across its tested range, ${when}. The order depends on these homes and these years - not a rule.` }),
        el('ul', { class: 'list' }, r.effects.map((e) => el('li', {}, [
          el('div', { class: 'list__main' }, [
            el('strong', { text: e.label }),
            el('div', { class: 'small muted', text: e.why }),
            el('div', { class: 'small', text: `${signed(e.low, e.unit)}: ${moveWords(e.atLow, two, names)} · ${signed(e.high, e.unit)}: ${moveWords(e.atHigh, two, names)}${r.flips.includes(e) ? ' - on its own this can change the answer' : ''}` }),
          ]),
        ]))),
      ]),
      sliders(r),
    ];
  }

  function sliders() {
    const vars = relevant(values).filter((x, i) => shows('advanced') || i < 3);
    return el('details', { class: 'panel more', 'data-field': 'range-sliders' }, [
      el('summary', { text: 'Change the range' }),
      el('p', { class: 'small muted', text: `How far below and above your own figure each assumption is tested. Your own figure stays the central line - change it in the home itself.${shows('advanced') ? '' : ' More assumptions in Advanced.'}` }),
      ...vars.map((x) => {
        const r = state.ranges[x.key];
        const out = el('span', { class: 'small', text: `${signed(r.low, x.unit)} to ${signed(r.high, x.unit)}` });
        const slider = (side, min, max) => el('input', { type: 'range', min, max, step: x.step, value: r[side], 'aria-label': `${x.label}: ${side === 'low' ? 'less favourable side' : 'more'}`, 'data-field': `range:${x.key}:${side}`,
          on: { input: (e) => { r[side] = Number(e.target.value); out.textContent = `${signed(r.low, x.unit)} to ${signed(r.high, x.unit)}`; }, change: draw } });
        return el('fieldset', { class: 'stack', style: { gap: 'var(--space-1)', border: 0, padding: 0 } }, [
          el('label', { class: 'checkline' }, [el('input', { type: 'checkbox', checked: r.on !== false, 'data-field': `range-on:${x.key}`, on: { change: (e) => { r.on = e.target.checked; draw(); } } }), el('strong', { text: x.label }), ' ', out]),
          el('div', { class: 'row' }, [el('span', { class: 'small muted', text: 'below' }), slider('low', -x.max, 0), slider('high', 0, x.max), el('span', { class: 'small muted', text: 'above' })]),
        ]);
      }),
    ]);
  }

  draw();
  return host;
}

function scenarioWords(d) {
  const parts = VARS.filter((x) => d[x.key] !== undefined && d[x.key] !== 0).map((x) => `${x.label.toLowerCase()} ${signed(d[x.key], x.unit)}`);
  return parts.length ? parts.join(', ') : 'nothing moved';
}

function moveWords(delta, two, names) {
  if (Math.abs(delta) < 1000) return 'hardly changes';
  return two ? `${rand(Math.abs(delta))} ${delta > 0 ? `towards ${names[0]}` : `towards ${names[1]}`}` : `${rand(Math.abs(delta))} ${delta > 0 ? 'better' : 'worse'}`;
}

/** The range in words - read from the results, nothing assumed. */
export function readRange(r, names, when) {
  const two = names.length > 1;
  const who = (x) => (two ? (x > 0 ? names[0] : names[1]) : null);
  const out = [];
  if (r.verdict === 'all-above') out.push(two ? `Across every scenario tested, ${names[0]} leaves you with more ${when} - from about ${rand(Math.min(r.at.favourable, r.at.unfavourable))} to ${rand(Math.max(r.at.favourable, r.at.unfavourable))} more.` : `Across every scenario tested you would be ahead ${when}.`);
  else if (r.verdict === 'all-below') out.push(two ? `Across every scenario tested, ${names[1]} leaves you with more ${when} - from about ${rand(Math.min(-r.at.favourable, -r.at.unfavourable))} to ${rand(Math.max(-r.at.favourable, -r.at.unfavourable))} more.` : `Across every scenario tested you would be behind ${when}.`);
  else out.push(two ? `The range crosses zero: ${when}, ${who(r.at.favourable)} comes out ahead in the favourable scenario and ${who(r.at.unfavourable)} in the unfavourable one. Which wins depends on how the assumptions turn out.` : `The range crosses zero: ${when} you could be ahead or behind, depending on how the assumptions turn out.`);
  const mid = Math.abs(r.at.central);
  out.push(r.width > 2 * Math.max(mid, 1) ? `The range is wide - about ${rand(r.width)} between the favourable and unfavourable ends - so the answer is sensitive to the assumptions.` : `The range is about ${rand(r.width)} wide: the outcome is fairly consistent across the assumptions tested, though risks not modelled here still exist.`);
  if (r.flips.length) out.push(`On its own, ${r.flips.map((e) => e.label.toLowerCase()).join(' or ')} going the other way can change which comes out ahead.`);
  else if (r.verdict === 'crosses') out.push('No single assumption changes the answer on its own - it takes several going the same way.');
  return out;
}
