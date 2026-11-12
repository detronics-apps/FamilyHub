// The non-money side of buying a home or a car (D-111), shared by Homes and Cars:
// the section bar, a stage's checks, what matters to us, the story, the compare rows,
// and the question sheet - printed, exported and read back in. Rules in checks.js.
//
// `ctx` (from the app): { hub, seed, prefix, word, screen, d, fam, famCol, rule, save, saveAs }
//   d.values.look = { answers: { [id]: { mark, note, cost, from } }, own: [], address, link, draws, worries }

import { el, download } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { rand } from '../finance/pod.js';
import { saveRecord } from '../kit.js';
import { STAGES, MARKS, FROM, MATTERS, marksFor, checksFor, removedSeeds, tally, stageLine, sheetCSV, readSheet, ownId, whereItStands } from './checks.js';

// In the order you go through them (D-116): the story is the hub (the name, and where it stands), then the money,
// then the questions stage by stage - Online, General, Viewing, Feeling.
export const SECTIONS = [{ id: 'story', label: 'Story' }, { id: 'financing', label: 'Financing' }, ...STAGES.map((s) => ({ id: s.id, label: s.label }))];

export const lookOf = (values) => {
  const l = values.look ?? {};
  return { answers: {}, own: [], ...l };
};

/**
 * Keep one home or car as it is now - its figures and its notes, in the same saved record.
 * Quiet (no redraw) while notes are typed; `loud` redraws; `create` makes it if it is new.
 */
export async function keep(hub, col, kind, d, summary, { loud = false, create = false } = {}) {
  if (!d.savedId && !create) return;
  const rec = { ...(d.savedId ? { id: d.savedId } : {}), kind, title: d.title || 'Untitled', values: { ...d.values }, result: summary(), savedAt: new Date().toISOString() };
  let saved;
  try { saved = await col.put(rec); if (loud || create) hub.invalidate(); } catch { saved = await saveRecord(hub, col, rec); }
  if (saved) { d.savedId = saved.id; d.savedKind = kind; }
}

export const checklistCol = (hub) => hub.data.collection('checklist', { summary: () => ({ kind: 'checklist' }), text: () => 'checklist', prefix: 'chk' });

/** The family's list (one record per app), loaded once. */
export const famOf = (hub, col) => hub.use('checklist', async () => {
  const { items } = await col.list({ limit: 1 });
  return items[0] ? (await col.get(items[0].id)) ?? {} : {};
});
async function saveFam(ctx, fam) {
  await ctx.famCol.put({ ...fam, id: fam.id });
  ctx.hub.invalidate();
}

/** Story · Financing · Online · General · Viewing · Feeling - one home or car in each. The story is where it opens. */
export function sectionBar(hub, screen, current) {
  return el('nav', { class: 'chipset no-print', 'aria-label': 'Sections', 'data-field': 'sections' }, SECTIONS.map((s) => el('a', {
    class: 'chip', href: hub.href(screen, s.id === 'story' ? null : s.id), 'aria-current': s.id === current ? 'page' : null, 'data-field': `sec:${s.id}`, text: s.label,
  })));
}

/**
 * The end of a stage: go on to the next, or stop here. A choice, never a gate - the next stage stays open either way.
 * Its criteria are the stage's own walk-aways and must-haves not met.
 */
function goOnPanel(ctx, look, stageId, t, checks) {
  const { hub } = ctx;
  const i = STAGES.findIndex((s) => s.id === stageId);
  const next = STAGES[i + 1];
  const go = look.go ?? {};
  const said = go[stageId];
  const walks = checks.filter((x) => look.answers[x.id]?.mark === 'walk');
  const unmet = t.must.missing.filter((x) => x.stage === stageId);
  const reasons = [
    walks.length ? `Walk away: ${walks.map((x) => x.text).join('; ')}.` : null,
    unmet.length ? `Must-have not met: ${unmet.map((x) => x.text).join('; ')}.` : null,
  ].filter(Boolean);
  const choose = (k) => {
    const g = { ...go };
    if (g[stageId] === k) delete g[stageId]; else g[stageId] = k;
    look.go = g;
    ctx.save(true);
    if (g[stageId] === 'go' && next) hub.go(ctx.screen, next.id);
    else if (g[stageId]) hub.go(ctx.screen);
    else hub.render();
  };
  const chip = (k, text) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(said === k), 'data-field': `go:${stageId}:${k}`, text, on: { click: () => choose(k) } });
  return el('div', { class: 'panel stack', 'data-field': 'go-on' }, [
    el('h3', { text: next ? `Go on to ${next.label}?` : `Overall: this ${ctx.word}?`, style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: reasons.length ? reasons.join(' ') : `Nothing here says stop${t.stages[stageId].answered ? '' : ' yet - nothing is answered'}.` }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': next ? `Go on to ${next.label}` : 'Overall decision' }, [
      chip('go', next ? 'Go on' : 'Buy it'),
      chip('stop', next ? 'Stop here' : 'Walk away'),
      el('a', { class: 'btn btn-small btn-quiet', href: hub.href(ctx.screen), text: 'Story', title: 'Everything about it, and where it stands', 'data-field': 'to-story' }),
    ]),
  ]);
}

export function checksOf(ctx) {
  const look = lookOf(ctx.d.values);
  return checksFor(ctx.seed, ctx.fam, look.own);
}

/** One line per section for a list of saved ones. */
export function progressLine(seed, fam, values) {
  const look = lookOf(values);
  const t = tally(checksFor(seed, fam, look.own), look.answers);
  if (!t.answered) return null;
  return STAGES.filter((s) => t.stages[s.id].answered).map((s) => `${s.label} ${stageLine(t.stages[s.id])}`).join(' · ');
}

const tag = (text, cls = '') => el('span', { class: `small muted ${cls}`.trim(), text: ` · ${text}` });

function needsName(ctx) {
  if (ctx.d.savedId) return null;
  const name = el('input', { class: 'input', value: ctx.d.title, placeholder: `Give this ${ctx.word} a name`, 'data-field': 'look-name', style: { flex: '1 1 220px' } });
  return el('div', { class: 'panel stack', 'data-field': 'needs-name' }, [
    el('p', { style: { margin: 0 }, text: `Give this ${ctx.word} a name to keep what you note here. It is kept with its finances, in the same saved ${ctx.word}.` }),
    el('div', { class: 'row' }, [name, el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'look-save', on: { click: () => ctx.saveAs(name.value.trim() || 'Untitled') } })]),
  ]);
}

/* ----------------------------------------------------------- a stage */

export function stageScreen(ctx, stageId) {
  const { hub, d } = ctx;
  const stage = STAGES.find((s) => s.id === stageId);
  const look = (d.values.look = lookOf(d.values));
  const checks = checksOf(ctx).filter((x) => x.stage === stageId);
  const t = tally(checksOf(ctx), look.answers);
  const marks = marksFor(stageId);
  const set = (id, patch, redraw = true) => {
    const next = { ...(look.answers[id] ?? {}), ...patch };
    for (const k of Object.keys(next)) if (next[k] == null || next[k] === '') delete next[k];
    if (Object.keys(next).length) look.answers[id] = next; else delete look.answers[id];
    ctx.save(redraw);
    if (redraw) hub.render();
  };

  const row = (x) => {
    const a = look.answers[x.id] ?? {};
    const more = a.mark ? el('div', { class: 'row', style: { gap: '6px' } }, [
      stageId !== 'feeling' ? el('select', { class: 'select', style: { width: 'auto' }, 'aria-label': 'Answered from', 'data-field': `from:${x.id}`, on: { change: (e) => set(x.id, { from: e.target.value || null }, false) } },
        [el('option', { value: '', text: 'From…' }), ...Object.entries(FROM).map(([k, l]) => el('option', { value: k, selected: a.from === k, text: l }))]) : null,
      el('input', { class: 'input', value: a.note ?? '', placeholder: stageId === 'questions' ? 'What they said' : 'Note', 'aria-label': `Note on ${x.text}`, 'data-field': `note:${x.id}`, style: { flex: '1 1 200px' }, on: { change: (e) => set(x.id, { note: e.target.value.trim() }, false) } }),
      a.mark === 'worry' ? el('input', { class: 'input', type: 'number', min: 0, step: 500, value: a.cost ?? '', placeholder: 'Cost to fix', 'aria-label': `Cost to fix ${x.text}`, 'data-field': `cost:${x.id}`, style: { width: '9em' }, on: { change: (e) => set(x.id, { cost: Number(e.target.value) || null }, false) } }) : null,
    ]) : null;
    return el('li', { class: 'stack look-check', style: { gap: '6px' }, 'data-field': `check:${x.id}` }, [
      el('div', {}, [
        x.matters ? el('strong', { text: `${MATTERS[x.matters]}: ` }) : null,
        el('span', { text: x.text }),
        x.photos ? tag('can be seen in photos') : null,
        x.suggested ? tag('suggested') : null,
        x.here ? tag(`only this ${ctx.word}`) : null,
      ]),
      x.hint ? el('div', { class: 'small muted', text: x.hint }) : null,
      el('div', { class: 'chipset', role: 'group', 'aria-label': x.text }, [
        ...Object.entries(marks).map(([k, l]) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(a.mark === k), 'data-field': `mark:${x.id}:${k}`, text: l, on: { click: () => set(x.id, { mark: a.mark === k ? null : k }) } })),
        x.here ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${x.text}`, on: { click: () => { look.own = look.own.filter((o) => o.id !== x.id); delete look.answers[x.id]; ctx.save(true); hub.render(); } } }) : null,
      ]),
      more,
    ]);
  };

  const newText = el('input', { class: 'input', placeholder: `A check of your own`, 'data-field': 'own-text', style: { flex: '1 1 220px' } });
  const forAll = el('input', { type: 'checkbox', 'data-field': 'own-all' });
  const add = async () => {
    const text = newText.value.trim(); if (!text) return;
    const item = { id: ownId(ctx.prefix), stage: stageId, text };
    if (forAll.checked) await saveFam(ctx, { ...ctx.fam, added: [...(ctx.fam.added ?? []), item] });
    else { look.own = [...look.own, item]; ctx.save(true); hub.render(); }
  };

  const st = t.stages[stageId];
  return [
    needsName(ctx),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: stage.title, style: { margin: 0 } }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: stage.says }),
      el('p', { class: 'small', style: { margin: 0 }, 'data-field': 'stage-tally', text: `Answered ${stageLine(st)}.${t.walks.length ? ` Your walk-aways so far: ${t.walks.map((x) => x.text).join('; ')}.` : ''}` }),
      whereItStands(look.go).stopped ? el('p', { class: 'small', style: { margin: 0 }, 'data-field': 'stopped', text: `${whereItStands(look.go).text} - this stage is still here if you want it.` }) : null,
      stageId === 'online' ? whereBox(ctx, look) : null,
      ctx.rule && (stageId === 'online' || stageId === 'feeling') ? ruleCard(ctx) : null,
      stageId === 'questions' || stageId === 'viewing' ? sheetBar(ctx, [stageId], stageId === 'questions' ? 'Questions' : 'Checklist') : null,
    ]),
    el('ul', { class: 'panel stack', style: { listStyle: 'none', paddingLeft: 'var(--space-3)', margin: 0 } }, checks.map(row)),
    stageId === 'feeling' ? wordsBox(ctx, look) : null,
    goOnPanel(ctx, look, stageId, t, checks),
    el('div', { class: 'panel stack' }, [
      el('h3', { text: 'Add a check', style: { margin: 0 } }),
      el('div', { class: 'row' }, [newText, el('button', { class: 'btn', type: 'button', text: 'Add', 'data-field': 'own-add', on: { click: add } })]),
      el('label', { class: 'checkline small' }, [forAll, `For every ${ctx.word}, not only this one`]),
      el('p', { class: 'small muted', style: { margin: 0 } }, ['Change or remove the suggested checks, and say what matters to you, in ', el('a', { href: ctx.hub.href('matters'), text: 'What matters to us' }), '.']),
    ]),
  ];
}

function whereBox(ctx, look) {
  const save = (k) => (e) => { look[k] = e.target.value.trim() || undefined; ctx.save(true); ctx.hub.render(); };
  const map = look.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(look.address)}` : null;
  return el('div', { class: 'stack', style: { gap: '6px' } }, [
    ctx.word === 'home' ? el('div', { class: 'row' }, [
      el('input', { class: 'input', value: look.address ?? '', placeholder: 'Address or area', 'aria-label': 'Address or area', 'data-field': 'look-address', style: { flex: '1 1 220px' }, on: { change: save('address') } }),
      map ? el('a', { class: 'btn btn-small', href: map, target: '_blank', rel: 'noopener noreferrer', text: 'Map', title: 'Open it on Google Maps - look around quite wide' }) : null,
    ]) : null,
    el('div', { class: 'row' }, [
      el('input', { class: 'input', value: look.link ?? '', placeholder: 'Link to the ad', 'aria-label': 'Link to the ad', 'data-field': 'look-link', style: { flex: '1 1 220px' }, on: { change: save('link') } }),
      /^https?:\/\//.test(look.link ?? '') ? el('a', { class: 'btn btn-small', href: look.link, target: '_blank', rel: 'noopener noreferrer', text: 'Ad' }) : null,
    ]),
  ]);
}

function wordsBox(ctx, look) {
  const box = (k, label) => el('label', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'small', text: label }),
    el('textarea', { class: 'input', rows: 3, text: look[k] ?? '', 'data-field': `look-${k}`, on: { change: (e) => { look[k] = e.target.value.trim() || undefined; ctx.save(false); } } })]);
  return el('div', { class: 'panel stack' }, [
    el('h3', { text: 'In your own words', style: { margin: 0 } }),
    box('draws', 'What draws us to it'),
    box('worries', 'What worries us, and why'),
  ]);
}

const ruleText = (ctx) => (ctx.fam.rule === undefined ? ctx.rule : ctx.fam.rule);
function ruleCard(ctx) {
  const text = ruleText(ctx);
  if (!text) return null;
  return el('blockquote', { class: 'panel panel--soft small', style: { margin: 0 }, 'data-field': 'rule' }, [
    el('div', { text: `“${text}”` }),
    el('div', { class: 'muted', text: ctx.fam.rule === undefined ? 'A view from the maker of Family Hub, to weigh for yourself. Change it or remove it in What matters to us.' : 'Your own rule of thumb.' }),
  ]);
}

/* ---------------------------------------------------- what matters */

export function mattersScreen(ctx) {
  const { hub, fam } = ctx;
  const editing = mattersScreen.editing ?? (mattersScreen.editing = new Set());
  const put = (patch) => saveFam(ctx, { ...fam, ...patch });
  const checks = checksFor(ctx.seed, fam);
  const row = (x) => {
    const on = editing.has(x.id);
    const box = el('input', { class: 'input', value: x.text, 'aria-label': 'The check', 'data-field': `edit:${x.id}`, style: { flex: '1 1 260px' } });
    const done = () => {
      editing.delete(x.id);
      const text = box.value.trim();
      if (x.mine) return put({ added: (fam.added ?? []).map((y) => (y.id === x.id ? { ...y, text: text || y.text } : y)) });
      const seedText = ctx.seed.find((y) => y.id === x.id).text;
      const edits = { ...(fam.edits ?? {}) };
      if (!text || text === seedText) delete edits[x.id]; else edits[x.id] = text;
      return put({ edits });
    };
    return el('li', { class: 'stack', style: { gap: '6px' }, 'data-field': `matter:${x.id}` }, [
      on ? el('div', { class: 'row' }, [box, el('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Done', on: { click: done } })])
        : el('div', {}, [el('span', { text: x.text }), x.suggested ? tag('suggested') : null, x.mine ? tag('your own') : null, x.changed ? tag('changed') : null]),
      el('div', { class: 'chipset', role: 'group', 'aria-label': `How much ${x.text} matters` }, [
        ...Object.entries(MATTERS).map(([k, l]) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(x.matters === k), 'data-field': `matters:${x.id}:${k}`, text: l,
          on: { click: () => { const m = { ...(fam.matters ?? {}) }; if (m[x.id] === k) delete m[x.id]; else m[x.id] = k; put({ matters: m }); } } })),
        on ? null : el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Change', 'aria-label': `Change ${x.text}`, on: { click: () => { editing.add(x.id); hub.render(); } } }),
        x.changed ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Original', title: 'Back to the suggested words', on: { click: () => { const e = { ...fam.edits }; delete e[x.id]; put({ edits: e }); } } }) : null,
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${x.text}`, 'data-field': `drop:${x.id}`, on: { click: async () => {
          if (x.mine) {
            if (!(await confirmAction({ title: 'Remove this check?', text: `"${x.text}" goes from every ${ctx.word}, with what was noted on it.`, confirmLabel: 'Remove', danger: true }))) return;
            return put({ added: (fam.added ?? []).filter((y) => y.id !== x.id) });
          }
          return put({ removed: [...(fam.removed ?? []), x.id] });
        } } }),
      ]),
    ]);
  };
  const gone = removedSeeds(ctx.seed, fam);
  const rule = ruleText(ctx);
  const ruleBox = el('textarea', { class: 'input', rows: 2, text: rule ?? '', 'data-field': 'rule-text', placeholder: 'Your own rule of thumb' });
  return [
    el('p', { class: 'muted', style: { margin: 0 }, text: `Every household is different. Mark what is a must-have or nice to have for you - a pet-friendly area, room for the children to play - and Compare and each ${ctx.word}'s Story put those first. Change the words of any check, remove what does not apply, and add your own. This list is for every ${ctx.word}.` }),
    ctx.rule ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Rule of thumb', style: { margin: 0 } }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: fam.rule === undefined ? 'This one is the maker of Family Hub’s own view - yours may differ. Keep it, change it into yours, or remove it.' : 'Your own.' }),
      ruleBox,
      el('div', { class: 'row' }, [
        el('button', { class: 'btn btn-small', type: 'button', text: 'Keep', 'data-field': 'rule-keep', on: { click: () => put({ rule: ruleBox.value.trim() || null }) } }),
        rule ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'data-field': 'rule-remove', on: { click: () => put({ rule: null }) } }) : null,
        fam.rule !== undefined ? el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Original', on: { click: () => { const f = { ...fam }; delete f.rule; saveFam(ctx, f); } } }) : null,
      ]),
    ]) : null,
    ...STAGES.map((s) => {
      const text = el('input', { class: 'input', placeholder: 'A check of your own', 'data-field': `add:${s.id}`, style: { flex: '1 1 220px' } });
      return el('div', { class: 'panel stack' }, [
        el('h2', { text: `${s.label} - ${s.title.toLowerCase()}`, style: { margin: 0 } }),
        el('ul', { class: 'stack', style: { listStyle: 'none', paddingLeft: 0, margin: 0 } }, checks.filter((x) => x.stage === s.id).map(row)),
        el('div', { class: 'row' }, [text, el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: () => { const t = text.value.trim(); if (t) put({ added: [...(fam.added ?? []), { id: ownId(ctx.prefix), stage: s.id, text: t }] }); } } })]),
      ]);
    }),
    gone.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Removed', style: { margin: 0 } }),
      el('ul', { class: 'list' }, gone.map((x) => el('li', {}, [el('div', { class: 'list__main', text: x.text }),
        el('button', { class: 'btn btn-small', type: 'button', text: 'Bring back', 'data-field': `back:${x.id}`, on: { click: () => put({ removed: fam.removed.filter((id) => id !== x.id) }) } })]))),
    ]) : null,
  ];
}

/* ---------------------------------------------------------- the story */

/** The story of one home or car, in parts: { title, lines }. `money` = lines from the app. */
export function storyParts(ctx, money = []) {
  const look = lookOf(ctx.d.values);
  const checks = checksOf(ctx);
  const t = tally(checks, look.answers);
  const a = (x) => look.answers[x.id] ?? {};
  const said = (x) => (a(x).note ? ` - ${a(x).note}` : '');
  const side = (s, name) => (s.total ? [{ title: `${name}: ${s.met.length} of ${s.total} met`, lines: [
    ...s.met.map((x) => `✓ ${x.text}${said(x)}`), ...s.missing.map((x) => `✗ ${x.text}${said(x)}`), ...s.unknown.map((x) => `? ${x.text}${a(x).mark === 'unsure' ? ' (unsure)' : ' (not answered yet)'}`)] }] : []);
  const rule = ctx.rule ? ruleText(ctx) : null;
  const w = whereItStands(look.go);
  return [
    w.text ? { title: w.text, lines: STAGES.filter((s) => look.go?.[s.id]).map((s) => `${s.label}: ${look.go[s.id] === 'go' ? (s.id === 'feeling' ? 'buy it' : 'went on') : 'stopped here'}`) } : null,
    ...side(t.must, 'Must-haves'),
    ...side(t.nice, 'Nice to have'),
    t.walks.length ? { title: `You marked ${t.walks.length} walk-away${t.walks.length === 1 ? '' : 's'}`, lines: t.walks.map((x) => `${x.text}${said(x)}`) } : null,
    t.worries.length ? { title: `Worries: ${t.worries.length}${t.repairs ? `, ${rand(t.repairs)} of repairs noted` : ''}`, lines: t.worries.map((x) => `${x.text}${said(x)}${a(x).cost ? ` (${rand(Number(a(x).cost))})` : ''}`) } : null,
    money.length ? { title: 'The money', lines: money } : null,
    t.stages.feeling.total ? { title: `The feeling: ${['yes', 'unsure', 'no'].map((k) => `${checks.filter((x) => x.stage === 'feeling' && a(x).mark === k).length} ${k}`).join(', ')}`,
      lines: checks.filter((x) => x.stage === 'feeling' && (a(x).mark === 'no' || a(x).mark === 'unsure')).map((x) => `${a(x).mark === 'no' ? 'No' : 'Unsure'}: ${x.text}${said(x)}`) } : null,
    look.draws || look.worries ? { title: 'In your own words', lines: [look.draws ? `What draws us: ${look.draws}` : null, look.worries ? `What worries us: ${look.worries}` : null].filter(Boolean) } : null,
    rule ? { title: 'Rule of thumb', lines: [`“${rule}”${ctx.fam.rule === undefined ? ' - a view from the maker of Family Hub' : ''}`] } : null,
    t.open.length ? { title: `Not answered yet: ${t.open.length} of ${t.total}`, lines: STAGES.filter((s) => t.stages[s.id].total > t.stages[s.id].answered).map((s) => `${s.label}: ${t.stages[s.id].total - t.stages[s.id].answered} left`) } : { title: 'Every check answered', lines: [] },
  ].filter(Boolean);
}

export function storyScreen(ctx, money) {
  const parts = storyParts(ctx, money);
  const w = whereItStands(lookOf(ctx.d.values).go);
  return [
    needsName(ctx),
    w.next ? el('div', { class: 'row no-print' }, [el('a', { class: 'btn btn-primary', href: ctx.hub.href(ctx.screen, w.next.id), 'data-field': 'story-next', text: `Next: ${w.next.label} ▶` }),
      el('span', { class: 'small muted', text: w.next.title })]) : null,
    el('p', { class: 'muted', style: { margin: 0 }, text: `Everything you noted about this ${ctx.word}, in one place - from your own marks, with no verdict. What is not answered yet is at the end: that is where a nasty surprise after buying would come from.` }),
    sheetBar(ctx, STAGES.map((s) => s.id), 'Report', parts),
    ...parts.map((p) => el('div', { class: 'panel stack', 'data-field': 'story-part' }, [
      el('h2', { text: p.title, style: { margin: 0 } }),
      p.lines.length ? el('ul', { style: { margin: 0 } }, p.lines.map((l) => el('li', { text: l }))) : null,
    ])),
  ];
}

/* ------------------------------------------------------------ compare */

/** Rows for a compare table of saved ones: must-haves first, then each stage, walk-aways and repairs. */
export function compareRows(seed, fam, recs) {
  const per = recs.map((r) => { const look = lookOf(r.values ?? {}); const checks = checksFor(seed, fam, look.own); return { look, checks, t: tally(checks, look.answers) }; });
  const all = checksFor(seed, fam);
  const sign = (p, x) => { const m = p.look.answers[x.id]?.mark; return m === 'ok' || m === 'yes' ? '✓' : ['worry', 'walk', 'no'].includes(m) ? `✗ ${(MARKS[m] ?? 'No').toLowerCase()}` : m === 'unsure' ? '? unsure' : '?'; };
  const rows = [];
  for (const kind of ['must', 'nice']) {
    const list = all.filter((x) => x.matters === kind);
    if (!list.length) continue;
    rows.push({ head: true, label: `${MATTERS[kind]}s`, cells: per.map((p) => `${p.t[kind].met.length} of ${list.length} met`) });
    for (const x of list) rows.push({ label: x.text, cells: per.map((p) => sign(p, x)) });
  }
  rows.push({ head: true, label: 'Where it stands', cells: per.map((p) => whereItStands(p.look.go).text || 'not decided yet') });
  rows.push({ head: true, label: 'Checks', cells: per.map((p) => `${p.t.answered} of ${p.t.total} answered`) });
  for (const s of STAGES) rows.push({ label: s.label, cells: per.map((p) => stageLine(p.t.stages[s.id])) });
  rows.push({ label: 'Walk-aways', cells: per.map((p) => (p.t.walks.length ? p.t.walks.map((x) => x.text).join('; ') : 'none')) });
  rows.push({ label: 'Repairs noted', cells: per.map((p) => (p.t.repairs ? rand(p.t.repairs) : '-')) });
  return rows;
}

export function compareTableOf(names, rows) {
  return el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-compare', 'data-field': 'look-compare' }, [
    el('thead', {}, [el('tr', {}, [el('th', { text: '' }), ...names.map((nm) => el('th', { text: nm }))])]),
    el('tbody', {}, rows.map((r) => el('tr', {}, [el(r.head ? 'th' : 'td', { text: r.label, scope: 'row' }), ...r.cells.map((c) => el(r.head ? 'th' : 'td', { text: c }))]))),
  ])]);
}

/* ------------------------------------------- print, export, read back */

/** Print (or Save as PDF) a sheet: the questions with room to answer, or the whole report. */
export function printSheet(title, groups) {
  const sheet = el('div', { class: 'print-sheet' }, [
    el('h1', { text: title }),
    el('p', { text: `Printed ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} from Family Hub` }),
    el('p', { class: 'print-meta', text: 'Agent, seller or dealer: ____________________   Phone: ______________   Viewing on: ____________' }),
    ...groups.flatMap((g) => [
      el('h2', { text: g.title }),
      g.lines ? el('ul', {}, g.lines.map((l) => el('li', { text: l }))) : null,
      g.checks ? el('ol', {}, g.checks.map(({ x, a }) => el('li', {}, [
        el('div', { text: x.text }),
        x.hint ? el('div', { class: 'print-hint', text: x.hint }) : null,
        a?.mark ? el('div', { text: `${marksFor(x.stage)[a.mark]}${a.note ? ` - ${a.note}` : ''}${a.cost ? ` (${rand(Number(a.cost))})` : ''}${a.from ? ` · ${FROM[a.from]}` : ''}` })
          : el('div', {}, [el('div', { class: 'print-boxes', text: Object.values(marksFor(x.stage)).map((m) => `☐ ${m}`).join('    ') }), el('div', { class: 'print-blank' }), el('div', { class: 'print-blank' })]),
      ]))) : null,
    ]),
  ]);
  const done = () => { sheet.remove(); document.body.classList.remove('printing-sheet'); };
  document.body.append(sheet);
  document.body.classList.add('printing-sheet');
  globalThis.addEventListener('afterprint', done, { once: true });
  globalThis.print();
}

const slug = (t) => String(t || 'family-hub').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Print, Export and Import for the stages given. `parts` (the story) makes it the full report. */
function sheetBar(ctx, stages, what, parts = null) {
  const { hub, d } = ctx;
  const title = () => `${d.title || `This ${ctx.word}`} - ${what === 'Report' ? 'the full report' : what === 'Questions' ? 'questions to ask' : 'viewing checklist'}`;
  const pick = () => { const look = lookOf(d.values); return checksOf(ctx).filter((x) => stages.includes(x.stage)).map((x) => ({ x, a: look.answers[x.id] })); };
  const file = el('input', { type: 'file', accept: '.csv,text/csv', hidden: true, 'data-field': 'sheet-file', on: { change: async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const look = (d.values.look = lookOf(d.values));
    const r = readSheet(await f.text(), checksOf(ctx), look.answers);
    Object.assign(look.answers, r.taken);
    let used = 0;
    if (r.clashes.length && await confirmAction({ title: `${r.clashes.length} answer${r.clashes.length === 1 ? '' : 's'} differ`, text: [`The sheet says something different from what you have for: ${r.clashes.map((c) => c.text).join('; ')}.`, 'Use the sheet’s answers for these, or keep yours?'], confirmLabel: 'Use sheet' })) {
      for (const c of r.clashes) look.answers[c.id] = c.theirs; used = r.clashes.length;
    }
    ctx.save(true);
    hub.ui.notice(`Read ${Object.keys(r.taken).length + used} answer${Object.keys(r.taken).length + used === 1 ? '' : 's'} from the sheet${r.unknown ? `; ${r.unknown} row${r.unknown === 1 ? '' : 's'} matched no check` : ''}.`);
  } } });
  return el('div', { class: 'row no-print', 'data-field': 'sheet-bar' }, [
    el('button', { class: 'btn btn-small', type: 'button', text: 'Print', title: 'Print, or choose Save as PDF', 'data-field': 'sheet-print', on: { click: () => {
      printSheet(title(), parts ? [...parts, ...STAGES.map((s) => ({ title: `${s.label} - ${s.title.toLowerCase()}`, checks: pick().filter(({ x }) => x.stage === s.id) }))]
        : stages.map((id) => ({ title: STAGES.find((s) => s.id === id).title, checks: pick().filter(({ x }) => x.stage === id) })));
    } } }),
    el('button', { class: 'btn btn-small', type: 'button', text: 'Export', title: 'A spreadsheet (CSV) to fill in - in Excel, Google Sheets or on a phone - and read back in with Import', 'data-field': 'sheet-export', on: { click: () => {
      download(new Blob([`﻿${sheetCSV(checksOf(ctx), lookOf(d.values).answers, stages)}`], { type: 'text/csv;charset=utf-8' }), `${slug(title())}.csv`);
    } } }),
    el('button', { class: 'btn btn-small', type: 'button', text: 'Import', title: 'Read a filled-in sheet back in. Empty cells never wipe an answer; where both differ, you choose.', 'data-field': 'sheet-import', on: { click: () => file.click() } }),
    file,
  ]);
}
