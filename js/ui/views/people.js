// People: the family, each with their details, food details and a dated
// record of height and weight (handy at the clinic or hospital: "what did
// she weigh in March?"). Its own page on the home screen, not inside Settings.

import { el } from '../dom.js';
import { guidanceFor } from '../../guidance.js';
import { fmtWeight, fmtHeight, kgFrom, cmFrom } from '../../units.js';
import { avatar, confirmAction, modal } from '../common.js';
import {
  addPerson, updatePerson, removePerson, PERSON_COLOURS, ALLERGENS, DIETS, FOCUS, ageOn, lifeStageAllowed,
  addMeasurement, removeMeasurement, measurementsFor, latestMeasure, personName, ENERGY_GOALS, energyGoalAllowed, STAGES, stageOf, pregnancyInfo,
} from '../../model.js';
const fmt = (n) => (n === null ? null : String(n).replace(/\.0$/, ''));
// A record someone may read out at a clinic: always the full date, with the year.
const fmtDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function peopleView(ctx) {
  const h = ctx.app.household;
  const newName = el('input', { class: 'input', id: 'new-person', placeholder: 'Name', 'data-field': 'new-person', style: { maxWidth: '200px' } });
  const newBorn = el('input', { class: 'input', id: 'new-born', type: 'date', max: ctx.today(), 'data-field': 'new-born', style: { width: 'auto' } });
  const newRole = el('select', { class: 'select', 'aria-label': 'Adult or child (only used without a birthday)', 'data-field': 'new-role', style: { width: 'auto' } }, [
    el('option', { value: 'adult', text: 'Adult' }), el('option', { value: 'child', text: 'Child' }),
  ]);
  newBorn.addEventListener('input', () => { newRole.hidden = Boolean(newBorn.value); });
  const add = () => {
    if (!newName.value.trim()) { newName.focus(); return; }
    const colour = PERSON_COLOURS[h.people.length % PERSON_COLOURS.length];
    ctx.commit(addPerson(ctx.app.household, { name: newName.value, born: newBorn.value, role: newRole.value, colour }).household);
  };
  const current = new Set(h.people.map((p) => p.id));
  const former = [...new Set(h.measurements.map((m) => m.personId))].filter((id) => !current.has(id));

  return el('section', { class: 'stack', 'aria-labelledby': 'people-title' }, [
    el('h1', { id: 'people-title', text: 'People' }),
    el('p', { class: 'muted', text: 'Everyone in the family. Choosing a name at the top of the screen is a convenience, not a login - anyone using this device can pick any name, and everyone in the family can see what is here.' }),
    ...h.people.map((p) => personCard(ctx, p)),
    h.people.length ? null : el('p', { class: 'panel', text: 'No one added yet.' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'row' }, [
        el('label', { class: 'sr-only', for: 'new-person', text: 'New person name' }), newName,
        el('label', { class: 'small', for: 'new-born', text: 'Birthday' }), newBorn, newRole,
        el('button', { class: 'btn', type: 'button', text: 'Add person', 'data-field': 'add-person', on: { click: add } }),
      ]),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'With a birthday, Family Hub works out whether someone is a baby, toddler, child, teen or adult, and keeps it up to date as they grow. Without one, choose adult or child.' }),
    ]),
    former.length ? el('p', { class: 'small muted', text: `Heights and weights of ${former.length} former member${former.length > 1 ? 's' : ''} are kept in the family’s data.` }) : null,
  ]);
}

/** "3 years", or "8 months" for a baby. */
function ageText(p, today) {
  const years = ageOn(p.born, today);
  if (years >= 1) return `${years} year${years === 1 ? '' : 's'}`;
  const [y, m, d] = p.born.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const months = Math.max(0, (ty - y) * 12 + tm - m - (td < d ? 1 : 0));
  return months < 1 ? 'under a month' : `${months} month${months === 1 ? '' : 's'}`;
}

function personCard(ctx, p) {
  const food = foodSummary(p, ctx.today());
  const stage = stageOf(p, ctx.today());
  const preg = pregnancyInfo(p, ctx.today());
  // Shown beside the age label, in the same style.
  const life = !lifeStageAllowed(p, ctx.today()) || !p.lifeStage ? null
    : p.lifeStage === 'breastfeeding' ? 'Breastfeeding'
      : !preg ? 'Pregnant'
        : preg.overdue ? `Pregnant · due ${longDay(preg.due)} (passed)` : `Pregnant · ${preg.weeks} weeks · due ${longDay(preg.due)}`;
  const update = (patch) => ctx.commit(updatePerson(ctx.app.household, p.id, patch));
  return el('article', { class: 'panel stack', 'aria-label': p.name, 'data-field': `person:${p.id}` }, [
    el('div', { class: 'row' }, [
      avatar(p),
      el('input', {
        class: 'input', value: p.name, 'aria-label': `Name for ${p.name}`, 'data-field': `pname:${p.id}`, style: { flex: '1 1 140px', width: 'auto' },
        on: { change: (e) => update({ name: e.target.value }) },
      }),
      el('input', {
        class: 'input', type: 'date', value: p.born, max: ctx.today(), 'aria-label': `Birthday: ${p.name}`, 'data-field': `pborn:${p.id}`, style: { width: 'auto' },
        on: { change: (e) => update({ born: e.target.value }) },
      }),
      stage ? null : el('select', {
        class: 'select', 'aria-label': `Adult or child: ${p.name} (until a birthday is added)`, 'data-field': `prole:${p.id}`, style: { width: 'auto' },
        on: { change: (e) => update({ role: e.target.value }) },
      }, [el('option', { value: 'adult', text: 'Adult', selected: p.role === 'adult' }), el('option', { value: 'child', text: 'Child', selected: p.role === 'child' })]),
      el('select', {
        class: 'select', 'aria-label': `Gender: ${p.name}`, 'data-field': `psex:${p.id}`, style: { width: 'auto' },
        on: { change: (e) => update({ sex: e.target.value }) },
      }, [['', 'Gender'], ['female', 'Female'], ['male', 'Male']].map(([v, t]) => el('option', { value: v, text: t, selected: p.sex === v }))),
    ]),
    pregnancyRow(ctx, p, update),
    // Labels on their own line, under the inputs and above the colours.
    stage || p.demo || life ? el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
      stage ? el('span', { class: 'badge', 'data-field': `pstage:${p.id}`, text: `${STAGES[stage]} · ${ageText(p, ctx.today())}` }) : null,
      life ? el('span', { class: 'badge', 'data-field': `ppreg:${p.id}`, text: life }) : null,
      p.demo ? el('span', { class: 'badge badge--demo', text: 'Example' }) : null,
    ]) : null,
    el('div', { class: 'row', role: 'group', 'aria-label': `Colour for ${p.name}` }, PERSON_COLOURS.map((c, i) => el('button', {
      class: 'colour-dot', type: 'button', style: { background: c }, 'aria-pressed': String(p.colour === c), 'aria-label': `Colour ${i + 1}`,
      on: { click: () => update({ colour: c }) },
    }))),
    el('div', { class: 'row' }, [
      el('span', { class: 'small', style: { flex: '1 1 200px' }, text: food ? `Food: ${food}` : 'No food details yet - allergies, diet and wishes help the Meals section.' }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Food details', 'aria-label': `Food details for ${p.name}`, 'data-field': `pfood:${p.id}`, on: { click: () => editFood(ctx, p) } }),
    ]),
    guidanceBlock(ctx, p),
    goalsBlock(ctx, p, update),
    measuresBlock(ctx, p),
    el('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [
      el('button', {
        class: 'btn btn-small btn-quiet', type: 'button', text: `Remove ${p.name}`,
        on: {
          click: async () => {
            if (!await confirmAction({ title: `Remove ${p.name}?`, text: 'Chores they completed stay in the history, shown as "a former member". Their heights and weights are kept too.', confirmLabel: 'Remove' })) return;
            if (ctx.app.device.currentPersonId === p.id) ctx.setDevice({ currentPersonId: null });
            ctx.commit(removePerson(ctx.app.household, p.id));
          },
        },
      }),
    ]),
  ]);
}

/** Things worth knowing for this person's age, stage and diet - open while there is something to watch out for. */
function guidanceBlock(ctx, p) {
  const list = guidanceFor(p, ctx.today());
  if (!list.length) return null;
  const warns = list.filter((r) => r.level === 'warn').length;
  const tips = list.length - warns;
  const closed = (ctx.app.ui.guidanceClosed ??= new Set());
  return el('details', {
    class: 'measures', open: warns > 0 && !closed.has(p.id), 'data-field': `pguide:${p.id}`,
    on: { toggle: (e) => { if (e.target.open) closed.delete(p.id); else closed.add(p.id); } },
  }, [
    el('summary', {}, [el('strong', { text: `Good to know for ${p.name}` }), ` - ${[warns ? `${warns} to watch out for` : null, tips ? `${tips} tip${tips === 1 ? '' : 's'}` : null].filter(Boolean).join(', ')}`]),
    el('ul', { class: 'guidance' }, list.map((r) => el('li', { class: r.level === 'warn' ? 'guidance--warn' : '' }, [
      r.level === 'warn' ? el('strong', { text: 'Watch out: ' }) : null, r.text, ' ', el('span', { class: 'small muted', text: `(${r.source})` }),
    ]))),
  ]);
}

const longDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Pregnant or breastfeeding, for a female aged 16 or more; with the conception date when pregnant. */
function pregnancyRow(ctx, p, update) {
  if (!lifeStageAllowed(p, ctx.today())) return null;
  const today = ctx.today();
  return el('div', { class: 'row' }, [
    el('label', { class: 'small', for: `pstage-${p.id}`, text: 'Pregnancy' }),
    el('select', {
      class: 'select', id: `pstage-${p.id}`, 'data-field': `plife:${p.id}`, style: { width: 'auto' },
      on: { change: (e) => update({ lifeStage: e.target.value }) },
    }, [['', 'Not pregnant or breastfeeding'], ['pregnant', 'Pregnant'], ['breastfeeding', 'Breastfeeding']].map(([v, t]) => el('option', { value: v, text: t, selected: p.lifeStage === v }))),
    p.lifeStage === 'pregnant' ? el('label', { class: 'small', for: `pconc-${p.id}`, text: 'Conception date' }) : null,
    p.lifeStage === 'pregnant' ? el('input', {
      class: 'input', type: 'date', id: `pconc-${p.id}`, value: p.conceived, max: today, min: addDaysIso(today, -300), 'data-field': `pconc:${p.id}`, style: { width: 'auto' },
      on: { change: (e) => update({ conceived: e.target.value }) },
    }) : null,
    p.lifeStage === 'pregnant' && !p.conceived ? el('span', { class: 'small muted', text: 'An estimate is fine - it gives the weeks and the due date.' }) : null,
    pregnancyInfo(p, today)?.overdue ? el('span', { class: 'small muted', text: 'The due date has passed - change this to Breastfeeding or Not pregnant once the baby has arrived.' }) : null,
  ]);
}

const addDaysIso = (day, n) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Their own goals: words, and (adults only) an energy goal the portion guide follows. */
function goalsBlock(ctx, p, update) {
  const allowed = energyGoalAllowed(p, ctx.today());
  return el('div', { class: 'row', style: { alignItems: 'flex-start' } }, [
    el('div', { class: 'field', style: { flex: '1 1 260px' } }, [
      el('label', { class: 'field__label small', for: `goals-${p.id}`, text: 'Personal goals' }),
      el('textarea', {
        class: 'input', id: `goals-${p.id}`, rows: '2', text: p.goals, placeholder: 'e.g. walk to work twice a week, cook more at home', 'data-field': `pgoals:${p.id}`,
        on: { change: (e) => update({ goals: e.target.value }) },
      }),
    ]),
    allowed ? el('div', { class: 'field', style: { flex: '0 1 260px' } }, [
      el('label', { class: 'field__label small', for: `egoal-${p.id}`, text: 'Energy goal' }),
      el('select', { class: 'select', id: `egoal-${p.id}`, 'data-field': `pegoal:${p.id}`, on: { change: (e) => update({ energyGoal: Number(e.target.value) }) } },
        Object.entries(ENERGY_GOALS).sort((a, b) => a[0] - b[0]).map(([v, t]) => el('option', { value: v, text: t, selected: Number(v) === p.energyGoal }))),
      el('div', { class: 'field__hint', text: `Their portions follow it. About 500 kcal a day less is roughly ${ctx.app.device.units === 'imperial' ? 'a pound' : 'half a kilo'} a week; for anything more, or a health condition, talk to a doctor or dietitian.` }),
    ]) : el('p', { class: 'small muted', style: { flex: '0 1 260px' }, text: 'Energy goals are for adults who are not pregnant or breastfeeding.' }),
  ]);
}

const small = (id, label, control) => el('div', { class: 'field' }, [el('label', { class: 'field__label small', for: id, text: label }), control]);

/** Dated heights and weights: the latest at a glance, the full list folded away. */
function measuresBlock(ctx, p) {
  const h = ctx.app.household;
  const today = ctx.today();
  const list = measurementsFor(h, p.id);
  const last = latestMeasure(h, p.id);
  const open = (ctx.app.ui.openMeasures ??= new Set());
  const sys = ctx.app.device.units;
  const imperial = sys === 'imperial';
  const glance = [
    last.weightKg !== null ? `${fmtWeight(last.weightKg, sys)} (${fmtDay(last.weightDay, today)})` : null,
    last.heightCm !== null ? `${fmtHeight(last.heightCm, sys)} (${fmtDay(last.heightDay, today)})` : null,
  ].filter(Boolean).join(' · ');
  const id = (k) => `m-${k}-${p.id}`;
  // What is typed survives a redraw (a save from another laptop arriving mid-entry).
  const drafts = (ctx.app.ui.measureDrafts ??= {});
  const draft = drafts[p.id] ?? { day: today, w: '', h: '', hi: '', note: '' };
  const form = el('form', {
    class: 'row', 'aria-label': `Add a height or weight for ${p.name}`,
    on: {
      input: () => { drafts[p.id] = { day: v('day'), w: v('w'), h: v('h'), hi: v('hi'), note: v('note') }; },
      submit: (e) => {
        e.preventDefault();
        try {
          const { household } = addMeasurement(ctx.app.household, {
            // Typed in the chosen units, saved in metric.
            personId: p.id, day: v('day'), weightKg: kgFrom(v('w'), sys), heightCm: cmFrom(v('h'), v('hi'), sys), note: v('note'), by: ctx.currentPerson()?.id ?? null,
          });
          delete drafts[p.id];
          ctx.flash({ id: `m:${p.id}`, level: 'ok', text: `Saved for ${p.name}.` });
          ctx.commit(household);
        } catch (err) {
          ctx.flash({ id: `m-err:${p.id}`, level: 'error', text: err.message });
          ctx.render();
        }
      },
    },
  }, [
    small(id('day'), 'Date', el('input', { class: 'input', id: id('day'), type: 'date', value: draft.day, max: today, required: true, 'data-field': `md:${p.id}` })),
    small(id('w'), imperial ? 'Weight (lb)' : 'Weight (kg)', el('input', { class: 'input', id: id('w'), type: 'number', min: '1', max: imperial ? '880' : '400', step: '0.1', inputmode: 'decimal', value: draft.w, style: { width: '7em' }, 'data-field': `mw:${p.id}` })),
    imperial
      ? small(id('h'), 'Height (ft, in)', el('span', { class: 'row', style: { gap: '4px', flexWrap: 'nowrap' } }, [
        el('input', { class: 'input', id: id('h'), type: 'number', min: '0', max: '8', step: '1', inputmode: 'numeric', value: draft.h, placeholder: 'ft', 'aria-label': 'Feet', style: { width: '4.5em' }, 'data-field': `mh:${p.id}` }),
        el('input', { class: 'input', id: id('hi'), type: 'number', min: '0', max: '11.9', step: '0.5', inputmode: 'decimal', value: draft.hi, placeholder: 'in', 'aria-label': 'Inches', style: { width: '4.5em' }, 'data-field': `mhi:${p.id}` }),
      ]))
      : small(id('h'), 'Height (cm)', el('input', { class: 'input', id: id('h'), type: 'number', min: '20', max: '250', step: '0.1', inputmode: 'decimal', value: draft.h, style: { width: '7em' }, 'data-field': `mh:${p.id}` })),
    small(id('note'), 'Note', el('input', { class: 'input', id: id('note'), placeholder: 'e.g. clinic visit', maxlength: '200', value: draft.note, 'data-field': `mn:${p.id}` })),
    el('button', { class: 'btn btn-small', type: 'submit', text: 'Add', 'data-field': `madd:${p.id}`, style: { alignSelf: 'flex-end' } }),
  ]);
  function v(k) { return form.querySelector(`#${id(k)}`)?.value ?? ''; }
  return el('details', {
    class: 'measures', open: open.has(p.id),
    on: { toggle: (e) => { if (e.target.open) open.add(p.id); else open.delete(p.id); } },
  }, [
    el('summary', {}, [el('strong', { text: 'Height and weight' }), glance ? ` - ${glance}` : ' - nothing recorded yet']),
    el('div', { class: 'stack', style: { marginTop: 'var(--space-2)' } }, [
      form,
      p.weightKg !== null && !list.some((m) => m.weightKg !== null)
        ? el('p', { class: 'small muted', text: `A weight of ${fmtWeight(p.weightKg, sys)} was entered earlier without a date. Add it above with a date to keep it in the record.` })
        : null,
      list.length ? el('table', { class: 'facts measures__table' }, [
        el('thead', {}, el('tr', {}, ['Date', 'Weight', 'Height', 'Note', ''].map((t) => el('th', { scope: 'col', text: t })))),
        el('tbody', {}, list.map((m) => el('tr', {}, [
          el('td', { text: fmtDay(m.day, today) }),
          el('td', { text: m.weightKg !== null ? fmtWeight(m.weightKg, sys) : '-' }),
          el('td', { text: m.heightCm !== null ? fmtHeight(m.heightCm, sys) : '-' }),
          el('td', { text: [m.note, m.by && m.by !== p.id ? `by ${personName(h, m.by)}` : ''].filter(Boolean).join(' · ') }),
          el('td', {}, el('button', {
            class: 'btn btn-quiet btn-small', type: 'button', text: '×', 'aria-label': `Delete the ${fmtDay(m.day, today)} entry`,
            on: {
              click: async () => {
                if (!await confirmAction({ title: 'Delete this entry?', text: `${p.name}, ${fmtDay(m.day, today)}.`, confirmLabel: 'Delete' })) return;
                ctx.commit(removeMeasurement(ctx.app.household, m.id));
              },
            },
          })),
        ]))),
      ]) : null,
    ]),
  ]);
}

function foodSummary(p, today) {
  return [p.allergies.length ? `allergic to ${p.allergies.join(', ')}` : null, ...p.focus.map((f) => FOCUS[f].toLowerCase())].filter(Boolean).join(' · ');
}

/** The food side of a profile, read by the Meals section. Every field is optional. */
function editFood(ctx, p) {
  const ticks = (name, options, chosen) => el('div', { class: 'chipset', role: 'group', 'aria-label': name }, Object.entries(options).map(([value, label]) => el('label', { class: 'checkline small' }, [
    el('input', { type: 'checkbox', name, value, checked: chosen.includes(value) }), label,
  ])));
  const input = (id, label, attrs, hint) => el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id, text: label }), el('input', { class: 'input', id, ...attrs }), hint ? el('div', { class: 'field__hint', text: hint }) : null,
  ]);
  const form = el('form', { class: 'stack' }, [
    el('p', { class: 'small muted', text: 'Used by the Meals section to fit suggestions to each person. Leave anything blank you would rather not say. Weight comes from the height and weight record.' }),
    p.born && p.sex ? null : el('p', { class: 'small muted', text: 'Add a birthday and gender on the person’s card: age decides child-sized portions and safety (no whole nuts under 5), and both decide nutrition values. Pregnancy is on the card too.' }),
    el('fieldset', {}, [el('legend', { class: 'field__label', text: 'Allergies' }), ticks('allergies', Object.fromEntries(ALLERGENS.map((a) => [a, a])), p.allergies)]),
    input('pf-avoid', 'Anything else to avoid', { value: p.avoid.join(', '), placeholder: 'e.g. lactose, chilli' }),
    el('fieldset', {}, [el('legend', { class: 'field__label', text: 'Diet' }), ticks('diet', DIETS, p.diet)]),
    el('fieldset', {}, [el('legend', { class: 'field__label', text: 'Would like more of' }), ticks('focus', FOCUS, p.focus),
      el('div', { class: 'field__hint', text: 'A wish, not a diagnosis.' })]),
    input('pf-likes', 'Likes', { value: p.likes.join(', '), placeholder: 'e.g. carrots, bananas' }),
    input('pf-dislikes', 'Dislikes', { value: p.dislikes.join(', '), placeholder: 'e.g. mushrooms' }),
  ]);
  const save = () => {
    const v = (id) => form.querySelector(`#${id}`).value;
    const all = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
    ctx.commit(updatePerson(ctx.app.household, p.id, {
      allergies: all('allergies'), diet: all('diet'), focus: all('focus'), avoid: v('pf-avoid'), likes: v('pf-likes'), dislikes: v('pf-dislikes'),
    }));
    close();
  };
  const { close } = modal({
    title: `Food details: ${p.name}`,
    body: [form],
    foot: [el('button', { class: 'btn', type: 'button', text: 'Cancel', on: { click: () => close() } }), el('button', { class: 'btn btn-primary', type: 'button', text: 'Save', 'data-field': 'pf-save', on: { click: save } })],
  });
}
