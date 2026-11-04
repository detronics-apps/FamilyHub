// Before you buy a home or a car second-hand (D-111): what to look at online, what to ask,
// what to inspect, and how it feels - so a problem is either negotiated into the price or a
// reason to walk away. The checks are a family's own list: seeded from the maker's checklist
// (and marked "suggested" where added), and every one can be changed, removed or added to.
// Pure: no DOM, no storage.

import { toCSV, parseCSV } from '../../csv.js';

export const STAGES = [
  { id: 'online', label: 'Online', title: 'Before you enquire', says: 'What the ad, its photos and the map already show. Some of these you can answer without a viewing.' },
  { id: 'questions', label: 'Questions', title: 'Before the viewing', says: 'To ask the agent, seller or dealer. Print them, or export them to fill in and read back in.' },
  { id: 'viewing', label: 'Viewing', title: 'At the viewing', says: 'Inspect and take notes. A worry with a cost can be negotiated into the price; a walk-away is a walk-away.' },
  { id: 'feeling', label: 'Feeling', title: 'The feeling', says: 'Sit together and answer how you feel about each one.' },
];

/** Marks: inspection-like stages, and the feeling. */
export const MARKS = { ok: 'OK', worry: 'Worry', walk: 'Walk away' };
export const FEELS = { yes: 'Yes', unsure: 'Unsure', no: 'No' };
export const FROM = { photos: 'Photos', asked: 'Asked', seen: 'Seen' };
export const MATTERS = { must: 'Must have', nice: 'Nice to have' };
export const marksFor = (stage) => (stage === 'feeling' ? FEELS : MARKS);

const c = (stage, id, text, more = {}) => ({ stage, id, text, ...more });
const S = { suggested: true };

export const HOME_RULE = 'Rather a house with potential in a good area, then lift it up over time, than a perfect house in a bad area.';

export const HOME_CHECKS = [
  c('online', 'h-sewage', 'Sewage works nearby - look quite wide on Google Maps, and find the usual wind direction', { hint: 'An example: a cheap area next to a golf course in Somerset West, with a sewage works upwind.' }),
  c('online', 'h-o-water', 'In the photos: water stains, damp patches or mould on ceilings and walls', { photos: true, ...S }),
  c('online', 'h-o-cracks', 'In the photos: cracks, or freshly painted patches of wall', { photos: true, ...S }),
  c('online', 'h-o-roof', 'In the photos: the roof - moss, dark patches, a flat roof', { photos: true, ...S }),
  c('online', 'h-o-slope', 'Is it on a slope?', { hint: 'Cracks on a slope need extra care.', ...S }),
  c('online', 'h-o-area', 'The area on the map and Street View: kept up, and close to what you need', S),
  c('online', 'h-o-market', 'How long it has been on the market, and whether the price has dropped', S),

  c('questions', 'h-q-roof', 'When was the roof last replaced?'),
  c('questions', 'h-q-leaks', 'Have there been leaks or damp, and what was done about them?', S),
  c('questions', 'h-q-cracks', 'Any cracks or foundation movement, and were they repaired?', S),
  c('questions', 'h-q-paint', 'When was it last painted, and why?', S),
  c('questions', 'h-q-rules', 'What are the estate or complex rules - pets, building changes, renting out part of it?'),
  c('questions', 'h-q-plans', 'Are there approved building plans for everything built?', S),
  c('questions', 'h-q-elec', 'Is there an electrical compliance certificate, and how old is the panel?', S),
  c('questions', 'h-q-gas', 'Is there a gas compliance certificate?', S),
  c('questions', 'h-q-why', 'Why are they selling?', S),

  c('viewing', 'h-mould', 'Mould and water getting in: the roof space, under sinks, the garage - any black mould?', { hint: 'Note whether it is local (a mould spray will do) or in the roof and walls (much more work).' }),
  c('viewing', 'h-roof', 'Roof and ceilings: leak marks, watermarks, stains, dark patches, moss, a musty smell', { photos: true, hint: 'Look at the roof, the ceiling and the roof beams. Viewings often happen in the dry season, and sellers paint over damage. Flat roofs are a particular risk.' }),
  c('viewing', 'h-pressure', 'Water pressure: run every tap and the shower'),
  c('viewing', 'h-leaks', 'Leaks: dripping pipes, and under sinks and cabinets for long-term damage'),
  c('viewing', 'h-cracks', 'Cracks in walls, and recently painted patches that may hide old ones', { photos: true, hint: 'About 1 cm or wider means real movement - take extra care on a slope. Foundation movement can cost hundreds of thousands to fix.' }),
  c('viewing', 'h-gutters', 'Gutters: loose, or not securely fastened', { photos: true }),
  c('viewing', 'h-elec', 'Electrical: is it earthed, any open wires, is the panel old or new?'),
  c('viewing', 'h-smell', 'Smells: smoky or musty, which can mean water damage'),
  c('viewing', 'h-paint', 'Fresh paint that may cover damage', { photos: true }),
  c('viewing', 'h-gas', 'Gas: does it work, and is there a shut-off valve?'),
  c('viewing', 'h-damp', 'Damp at the bottom of walls, or bubbling paint', { photos: true, ...S }),
  c('viewing', 'h-geyser', 'The geyser: how old, and any leaks into the drip tray', S),
  c('viewing', 'h-doors', 'Windows and doors open, close and lock', S),
  c('viewing', 'h-drains', 'Drains: slow, or smelling', S),

  c('feeling', 'h-k-cab', 'Kitchen: enough cabinets, or space for them'),
  c('feeling', 'h-k-fit', 'Kitchen: room for two fridges, a dishwasher, a modern sink and an oven'),
  c('feeling', 'h-k-size', 'Kitchen: big enough, and usable'),
  c('feeling', 'h-k-tri', 'Kitchen: sink, fridge and stove in a work triangle, with the counter close by'),
  c('feeling', 'h-storage', 'Storage: will everything you own fit, moving boxes included?'),
  c('feeling', 'h-beds', 'Bedrooms: does a king-size bed fit, with room to walk around it?', { hint: 'Their sizes matter more than how many there are. Note the floor size.' }),
  c('feeling', 'h-play', 'Play areas for the children'),
  c('feeling', 'h-hobby', 'Space for hobbies, or a den'),
  c('feeling', 'h-live', 'Can you actually live in it?'),
  c('feeling', 'h-plot', 'The plot: room for children and pets'),
  c('feeling', 'h-pets', 'Pet-friendly - for the pets you have, or plan to have'),
  c('feeling', 'h-braai', 'A braai, and space for guests'),
  c('feeling', 'h-rules', 'Estate or complex rules: do they clash with what you want?', { hint: 'For example adding a door to rent out part of the house. Plans need body corporate approval.' }),
  c('feeling', 'h-clean', 'The area: clean and well kept'),
  c('feeling', 'h-safe', 'Safe: would you be happy for your partner and children to walk there while you are at work?'),
  c('feeling', 'h-near', 'Distance to work, shops, school, daycare, church and anywhere you go often'),
  c('feeling', 'h-invite', 'Would you be happy inviting people over - or can you see the potential to get there?'),
  c('feeling', 'h-carry', 'Cost: could you carry the payments?', { hint: 'See "Can you carry it?" in Financing.' }),
  c('feeling', 'h-surprise', 'Could you take a large breakdown or a surprise?'),
  c('feeling', 'h-reno', 'Could you afford renovations, or would the bond leave nothing for them?'),
  c('feeling', 'h-potential', 'Overall: can you see its potential to build up and lift up?'),
];

export const CAR_CHECKS = [
  c('online', 'c-o-panels', 'In the photos: panels in different colours, dents, rust', { photos: true, ...S }),
  c('online', 'c-o-roof', 'In the photos: scrapes on the roof of a tall vehicle', { photos: true, ...S }),
  c('online', 'c-o-km', 'Kilometres for its age, and the price against similar cars', S),

  c('questions', 'c-q-why', 'Why are you selling it?', { hint: 'There is usually a reason, often frustration with a problem. Would you be ready for a big repair on the way home, or in the next year or two? If not, walk away.' }),
  c('questions', 'c-q-accident', 'Has it been in an accident?', { hint: '"Not that I know of" is not a no.' }),
  c('questions', 'c-q-service', 'Is there a full service history?', S),
  c('questions', 'c-q-owed', 'Is money still owed on it? Ask for a settlement letter.', S),
  c('questions', 'c-q-owners', 'How many owners has it had?', S),
  c('questions', 'c-q-papers', 'Do the registration papers match the VIN and engine number?', S),

  c('viewing', 'c-roof', 'Roof: on a tall vehicle, stand on a chair - scrapes from low places, and water getting in', { photos: true }),
  c('viewing', 'c-sounds', 'Funny sounds: listen for any'),
  c('viewing', 'c-damage', 'Accident damage: panels in different colours, uneven gaps, under the seats, the chassis', { photos: true, hint: 'A story from the maker of Family Hub: a bus with glass under the seat brackets, a kink in the chassis, and cheap rewiring that left out the second battery.' }),
  c('viewing', 'c-brakes', 'Brakes'),
  c('viewing', 'c-wipers', 'Wipers'),
  c('viewing', 'c-tyres', 'Tyres: tread, even wear', S),
  c('viewing', 'c-fluids', 'Fluids: oil, coolant and brake fluid - level and colour', S),
  c('viewing', 'c-rust', 'Rust: under the car, the wheel arches, the door sills', S),
  c('viewing', 'c-elec', 'Electrics: lights, windows, aircon, the battery', S),
  c('viewing', 'c-drive', 'A test drive: a cold start, the gears, steering that pulls, warning lights', S),

  c('feeling', 'c-why', 'Would you be ready for a big repair on the way home, or in the next year or two?'),
  c('feeling', 'c-fit', 'Does the family fit, car seats included?', S),
  c('feeling', 'c-boot', 'Room for what you carry', S),
  c('feeling', 'c-drive-feel', 'Comfortable for whoever drives it most', S),
  c('feeling', 'c-carry', 'Could you carry the payments and running costs?', { hint: 'See Financing.', ...S }),
];

/**
 * The family's list: the seeded checks with their changes, less those removed, plus their
 * own (for every one), plus this one's own. `fam` = { edits, removed, added, matters }.
 */
export function checksFor(seed, fam = {}, own = []) {
  const removed = new Set(fam.removed ?? []);
  const edits = fam.edits ?? {};
  const matters = fam.matters ?? {};
  const list = [...seed, ...(fam.added ?? []).map((x) => ({ ...x, mine: true })), ...own.map((x) => ({ ...x, mine: true, here: true }))];
  return list.filter((x) => !removed.has(x.id)).map((x) => ({ ...x, text: edits[x.id] ?? x.text, matters: matters[x.id] ?? null, changed: x.id in edits }));
}

/** Seeded checks the family removed, to bring back. */
export const removedSeeds = (seed, fam = {}) => seed.filter((x) => (fam.removed ?? []).includes(x.id));

const n = (x) => Number(x) || 0;
/** An answer counts as met for a must-have: OK, or Yes. */
const met = (a) => a?.mark === 'ok' || a?.mark === 'yes';
const notMet = (a) => ['worry', 'walk', 'no'].includes(a?.mark);

/** What one home or car's answers add up to. `answers` = { [checkId]: { mark, note, cost, from } }. */
export function tally(checks, answers = {}) {
  const stages = Object.fromEntries(STAGES.map((s) => [s.id, { total: 0, answered: 0, worry: 0, walk: 0, no: 0 }]));
  const worries = []; const walks = []; const unsure = []; const open = [];
  let repairs = 0;
  for (const x of checks) {
    const a = answers[x.id]; const st = stages[x.stage];
    if (!st) continue;
    st.total += 1;
    if (a?.mark) st.answered += 1; else open.push(x);
    if (a?.mark === 'worry') { st.worry += 1; worries.push(x); repairs += n(a.cost); }
    if (a?.mark === 'walk') { st.walk += 1; walks.push(x); }
    if (a?.mark === 'no') { st.no += 1; unsure.push(x); }
    if (a?.mark === 'unsure') unsure.push(x);
  }
  const must = checks.filter((x) => x.matters === 'must');
  const nice = checks.filter((x) => x.matters === 'nice');
  const side = (list) => ({ total: list.length, met: list.filter((x) => met(answers[x.id])), missing: list.filter((x) => notMet(answers[x.id])), unknown: list.filter((x) => !answers[x.id]?.mark || answers[x.id].mark === 'unsure') });
  return { stages, worries, walks, unsure, open, repairs, must: side(must), nice: side(nice), answered: checks.filter((x) => answers[x.id]?.mark).length, total: checks.length };
}

/** One line per stage, for a list or a compare row: "4/9, 2 worries, 1 walk away". */
export function stageLine(st) {
  if (!st?.total) return '-';
  const bits = [`${st.answered}/${st.total}`];
  if (st.worry) bits.push(`${st.worry} worr${st.worry === 1 ? 'y' : 'ies'}`);
  if (st.walk) bits.push(`${st.walk} walk away`);
  if (st.no) bits.push(`${st.no} no`);
  return bits.join(', ');
}

/* ----------------------------------------------------- the sheet (CSV) */

const HEAD = ['Id', 'Stage', 'Check', 'Mark', 'Answer or note', 'Cost', 'From'];
const label = (map, k) => (k ? map[k] ?? '' : '');
const keyOf = (map, text) => {
  const t = String(text ?? '').trim().toLowerCase();
  return t ? Object.keys(map).find((k) => k === t || map[k].toLowerCase() === t) ?? null : null;
};

/** The checks of the stages asked for, with what is answered so far - for a spreadsheet. */
export function sheetCSV(checks, answers = {}, stages = STAGES.map((s) => s.id)) {
  const rows = checks.filter((x) => stages.includes(x.stage)).map((x) => {
    const a = answers[x.id] ?? {};
    return [x.id, STAGES.find((s) => s.id === x.stage).label, x.text, label(marksFor(x.stage), a.mark), a.note ?? '', a.cost ? String(a.cost) : '', label(FROM, a.from)];
  });
  return toCSV([HEAD, ...rows]);
}

/**
 * Read a filled-in sheet back. Rows are matched to checks by Id (or, failing that, by the
 * check's words). Empty cells never wipe an answer. Where both have something different,
 * it is a clash for the person to choose. Returns { taken, clashes, unknown }: `taken` are
 * answers to apply as they are; `clashes` are { id, text, mine, theirs }.
 */
export function readSheet(text, checks, answers = {}) {
  const rows = parseCSV(text);
  const head = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const at = (name) => head.findIndex((h) => h.startsWith(name));
  const col = { id: at('id'), check: at('check'), mark: at('mark'), note: at('answer'), cost: at('cost'), from: at('from') };
  const taken = {}; const clashes = []; let unknown = 0;
  for (const r of rows) {
    const cell = (k) => (col[k] >= 0 ? String(r[col[k]] ?? '').trim() : '');
    const x = checks.find((y) => y.id === cell('id')) ?? checks.find((y) => y.text.toLowerCase() === cell('check').toLowerCase());
    if (!x) { unknown += 1; continue; }
    const theirs = { mark: keyOf(marksFor(x.stage), cell('mark')), note: cell('note') || null, cost: n(cell('cost').replace(/[^\d.]/g, '')) || null, from: keyOf(FROM, cell('from')) };
    const mine = answers[x.id] ?? {};
    const next = { ...mine }; let clash = false;
    for (const k of ['mark', 'note', 'cost', 'from']) {
      if (theirs[k] == null || theirs[k] === mine[k]) continue;
      if (mine[k] == null || mine[k] === '') next[k] = theirs[k]; else clash = true;
    }
    if (clash) clashes.push({ id: x.id, text: x.text, mine, theirs: Object.fromEntries(Object.entries({ ...mine, ...theirs }).map(([k, v]) => [k, theirs[k] ?? v])) });
    else if (JSON.stringify(next) !== JSON.stringify(mine)) taken[x.id] = next;
  }
  return { taken, clashes, unknown };
}

/** A new id for a family's own check. */
export const ownId = (prefix) => `${prefix}-own-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
