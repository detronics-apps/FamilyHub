// Trackers (D-100): when there is a concern, start tracking a scenario for a child - a
// temperature every half hour, wees and poos, sleep - with a time and a value each time, so
// the facts are there for the doctor. Scenarios are a starting point to change and add to.
// Pure - no DOM.

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Times are local clock times, "2026-11-02T14:30" - what was on the clock when it was logged.
const pad = (n) => String(n).padStart(2, '0');
export const localTime = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export const KINDS = { number: 'A number', yesno: 'Yes or no', choice: 'One of a few', note: 'A note' };

export const SCENARIOS = [
  { id: 'fever', name: 'Fever', topicId: 'fever', health: true, remindEvery: 60, fields: [
    { id: 'temp', name: 'Temperature', kind: 'number', unit: '°C' },
    { id: 'how', name: 'How they seem', kind: 'choice', options: ['Playing', 'Quiet', 'Sleepy', 'Hard to wake'] },
    { id: 'med', name: 'Medicine (what and dose)', kind: 'note' },
    { id: 'drink', name: 'Drinking', kind: 'yesno' },
  ] },
  { id: 'tummy', name: 'Tummy bug', health: true, remindEvery: null, fields: [
    { id: 'wee', name: 'Wee or wet nappy', kind: 'yesno' },
    { id: 'poo', name: 'Poo', kind: 'choice', options: ['Normal', 'Soft', 'Runny', 'Hard'] },
    { id: 'vomit', name: 'Vomited', kind: 'yesno' },
    { id: 'drink', name: 'Drink (ml)', kind: 'number', unit: 'ml' },
    { id: 'eat', name: 'Eating', kind: 'note' },
  ] },
  { id: 'sleep', name: 'Sleep', remindEvery: null, fields: [
    { id: 'what', name: 'Sleep', kind: 'choice', options: ['Down', 'Woke', 'Back to sleep', 'Nap start', 'Nap end'] },
    { id: 'note', name: 'Note', kind: 'note' },
  ] },
  { id: 'eating', name: 'Eating', remindEvery: null, fields: [
    { id: 'food', name: 'What', kind: 'note' },
    { id: 'amount', name: 'How much', kind: 'choice', options: ['A little', 'Half', 'All'] },
    { id: 'reaction', name: 'Any reaction', kind: 'note' },
  ] },
  { id: 'rash', name: 'Rash', health: true, topicId: 'rashes', remindEvery: 240, fields: [
    { id: 'where', name: 'Where', kind: 'note' },
    { id: 'spread', name: 'Spreading', kind: 'yesno' },
    { id: 'glass', name: 'Fades under a pressed glass', kind: 'yesno' },
    { id: 'itch', name: 'Itchy', kind: 'yesno' },
    { id: 'photo', name: 'Photo taken (where it is saved)', kind: 'note' },
  ] },
  { id: 'potty', name: 'Potty', remindEvery: null, fields: [
    { id: 'what', name: 'What', kind: 'choice', options: ['Wee', 'Poo', 'Both'] },
    { id: 'accident', name: 'Accident', kind: 'yesno' },
  ] },
  { id: 'behaviour', name: 'Behaviour', remindEvery: null, fields: [
    { id: 'what', name: 'What happened', kind: 'note' },
    { id: 'before', name: 'Just before', kind: 'note' },
    { id: 'mood', name: 'Mood after', kind: 'choice', options: ['Calm', 'Upset', 'Very upset'] },
  ] },
];

/** "Temperature: number °C", "Poo: choice Normal, Runny", "Drinking: yes/no", "Medicine: note". */
export function parseField(line, i = 0) {
  const [name, ...rest] = String(line).split(':');
  const spec = rest.join(':').trim().toLowerCase();
  const id = `f${i}-${str(name, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (/^(yes|y\/n|yes\/no)/.test(spec)) return { id, name: str(name, 60), kind: 'yesno' };
  if (spec.startsWith('choice')) return { id, name: str(name, 60), kind: 'choice', options: rest.join(':').trim().slice(6).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12) };
  if (spec.startsWith('number')) return { id, name: str(name, 60), kind: 'number', unit: str(rest.join(':').trim().slice(6), 12) };
  return { id, name: str(name, 60), kind: 'note' };
}
export const fieldLine = (f) => `${f.name}: ${f.kind === 'yesno' ? 'yes/no' : f.kind === 'choice' ? `choice ${(f.options ?? []).join(', ')}` : f.kind === 'number' ? `number ${f.unit ?? ''}`.trim() : 'note'}`;

export function normaliseScenario(s = {}) {
  return {
    ...s, scenarioId: str(s.scenarioId ?? s.id, 80), name: str(s.name, 80) || 'Our tracker',
    fields: (Array.isArray(s.fields) ? s.fields : []).filter((f) => f && str(f.name) && KINDS[f.kind]).slice(0, 12),
    remindEvery: num(s.remindEvery), health: s.health === true, own: s.own === true, removed: s.removed === true,
  };
}
export function scenariosOf(records, starter = SCENARIOS) {
  const byId = new Map(records.map((r) => [r.scenarioId, r]));
  const out = [];
  for (const s of starter) { const r = byId.get(s.id); if (!r?.removed) out.push(normaliseScenario({ ...s, ...(r ?? {}), scenarioId: s.id, starter: true })); }
  for (const r of records) if (r.own && !r.removed) out.push(normaliseScenario(r));
  return out;
}

export function normaliseTracker(t = {}) {
  return {
    ...t, trackerId: str(t.trackerId, 80), scenarioId: str(t.scenarioId, 80), kidId: str(t.kidId, 40),
    started: str(t.started, 40), stopped: str(t.stopped, 40) || null, days: num(t.days), remindEvery: num(t.remindEvery),
    entries: (Array.isArray(t.entries) ? t.entries : []).filter((e) => e && str(e.at)).map((e) => ({ at: str(e.at, 40), values: e.values && typeof e.values === 'object' ? e.values : {}, by: str(e.by, 40) || null }))
      .sort((a, b) => a.at.localeCompare(b.at)).slice(-2000),
  };
}

/** Running: not stopped, and not past its number of days. */
export function running(t, now) {
  if (t.stopped) return false;
  if (t.days && t.started) return Date.parse(now) < Date.parse(t.started) + t.days * 86400000;
  return true;
}

/** When the next reading is due (ISO), or null with no reminder. */
export function nextDue(t) {
  if (!t.remindEvery) return null;
  const last = t.entries.at(-1)?.at ?? t.started;
  return localTime(new Date(Date.parse(last) + t.remindEvery * 60000));
}

/** A number field over time: [[hours since start, value]]. */
export function series(t, fieldId) {
  const t0 = Date.parse(t.started);
  return t.entries.filter((e) => num(e.values[fieldId]) != null).map((e) => [Math.round(((Date.parse(e.at) - t0) / 3600000) * 100) / 100, num(e.values[fieldId])]);
}

const hhmm = (iso) => iso.slice(11, 16);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOf = (iso) => `${DAY[new Date(`${iso.slice(0, 10)}T12:00`).getDay()]} ${iso.slice(8, 10)}`;

/** Per day: how many entries said yes, each choice, and number highs - for "3 wet nappies yesterday". */
export function perDay(t, fields) {
  const days = [...new Set(t.entries.map((e) => e.at.slice(0, 10)))];
  return days.map((d) => {
    const es = t.entries.filter((e) => e.at.startsWith(d));
    const parts = fields.map((f) => {
      const vs = es.map((e) => e.values[f.id]).filter((v) => v !== undefined && v !== null && v !== '');
      if (!vs.length) return null;
      if (f.kind === 'yesno') { const y = vs.filter((v) => v === true || v === 'yes').length; return y ? `${f.name}: ${y}` : null; }
      if (f.kind === 'number') { const ns = vs.map(num).filter((x) => x != null); return ns.length ? `${f.name}: highest ${Math.max(...ns)}${f.unit ? ` ${f.unit}` : ''}` : null; }
      if (f.kind === 'choice') { const c = {}; for (const v of vs) c[v] = (c[v] ?? 0) + 1; return `${f.name}: ${Object.entries(c).map(([k, n]) => `${k} ${n}`).join(', ')}`; }
      return `${f.name}: ${vs.length}`;
    }).filter(Boolean);
    return { day: d, entries: es.length, parts };
  });
}

/** A summary to show or send the doctor. Facts only. */
export function summary(t, scenario, kidName) {
  if (!t.entries.length) return `${scenario.name} - ${kidName}: nothing logged yet.`;
  const first = t.entries[0].at; const last = t.entries.at(-1).at;
  // Calendar days it covers: 20:00 one evening to 02:10 the next is 2 days.
  const span = Math.round((Date.parse(`${last.slice(0, 10)}T12:00`) - Date.parse(`${first.slice(0, 10)}T12:00`)) / 86400000) + 1;
  const lines = [`${scenario.name} - ${kidName}: ${t.entries.length} entries over ${span} day${span === 1 ? '' : 's'}, from ${dayOf(first)} ${hhmm(first)} to ${dayOf(last)} ${hhmm(last)}.`];
  for (const f of scenario.fields) {
    const es = t.entries.filter((e) => e.values[f.id] !== undefined && e.values[f.id] !== null && e.values[f.id] !== '');
    if (!es.length) continue;
    if (f.kind === 'number') {
      const top = es.reduce((a, e) => (num(e.values[f.id]) > num(a.values[f.id]) ? e : a));
      const lastE = es.at(-1);
      lines.push(`${f.name}: highest ${num(top.values[f.id])}${f.unit ? ` ${f.unit}` : ''} at ${hhmm(top.at)} on ${dayOf(top.at)}; last ${num(lastE.values[f.id])}${f.unit ? ` ${f.unit}` : ''} at ${hhmm(lastE.at)} on ${dayOf(lastE.at)}.`);
    } else if (f.kind === 'yesno') {
      lines.push(`${f.name}: yes ${es.filter((e) => e.values[f.id] === true || e.values[f.id] === 'yes').length} of ${es.length} times.`);
    } else if (f.kind === 'choice') {
      const c = {}; for (const e of es) c[e.values[f.id]] = (c[e.values[f.id]] ?? 0) + 1;
      lines.push(`${f.name}: ${Object.entries(c).map(([k, n]) => `${k} ${n}`).join(', ')}.`);
    } else {
      lines.push(`${f.name}: ${es.map((e) => `${dayOf(e.at)} ${hhmm(e.at)} ${e.values[f.id]}`).join('; ')}.`);
    }
  }
  return lines.join('\n');
}
