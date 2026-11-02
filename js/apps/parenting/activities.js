// Activities (D-096): ideas planned with time to think (Ideas), and a few taps to find one
// when there is no time to think (Play now). Each: ages, inside or out, the weather it suits,
// setup time, how long it keeps them busy, what is needed and what that costs, how to do it,
// a game's rules with their history, when it is planned, and how it went (child and parent).
// Ages in months. Pure - no DOM.

export const WEATHER = { any: 'Any weather', sun: 'Sunny or hot', cool: 'Cool or cloudy', rain: 'Rainy', wind: 'Windy' };
export const PLACES = { inside: 'Inside', outside: 'Outside', either: 'Either' };

const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const lines = (v, max = 40) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, max);
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const score = (v) => { const n = num(v); return n == null ? null : Math.max(1, Math.min(5, Math.round(n))); };

/** One needed thing: "Cushions" (have it) or "Water balloons - R40" (to buy). */
export function normaliseNeed(x) {
  if (typeof x === 'string') { const m = x.match(/^(.*?)(?:\s*[-–]\s*R\s?(\d+(?:[.,]\d+)?))?$/); return { name: str(m[1], 120), have: !m[2], cost: m[2] ? Number(m[2].replace(',', '.')) : 0 }; }
  return { name: str(x?.name, 120), have: x?.have !== false, cost: Math.max(0, num(x?.cost) ?? 0) };
}

export function normaliseActivity(a = {}) {
  return {
    ...a,
    activityId: str(a.activityId ?? a.id, 80),
    name: str(a.name, 120) || 'An activity',
    ageFrom: num(a.ageFrom), ageTo: num(a.ageTo),
    place: PLACES[a.place] ? a.place : 'either',
    weather: (Array.isArray(a.weather) ? a.weather : ['any']).filter((w) => WEATHER[w]),
    setup: Math.max(0, num(a.setup) ?? 5),
    lasts: Math.max(1, num(a.lasts) ?? 20),
    needs: (Array.isArray(a.needs) ? a.needs : []).map(normaliseNeed).filter((x) => x.name).slice(0, 40),
    steps: lines(a.steps),
    safety: str(a.safety, 600),
    game: a.game === true,
    rules: lines(a.rules),
    rulesHistory: (Array.isArray(a.rulesHistory) ? a.rulesHistory : []).filter((h) => h && Array.isArray(h.rules)).slice(-20),
    plannedOn: isDay(a.plannedOn) ? a.plannedOn : null,
    logs: (Array.isArray(a.logs) ? a.logs : []).filter((l) => l && isDay(l.day)).map((l) => ({
      day: l.day, kids: (Array.isArray(l.kids) ? l.kids : []).filter((k) => k && k.id).map((k) => ({ id: str(k.id, 40), score: score(k.score) })),
      parent: score(l.parent), note: str(l.note, 1000),
    })).slice(-100),
    own: a.own === true, removed: a.removed === true,
  };
}

/** What still has to be bought. */
export const toBuy = (a) => a.needs.filter((x) => !x.have);
export const costOf = (a) => toBuy(a).reduce((s, x) => s + x.cost, 0);

/**
 * Busy time for the setup: minutes it keeps them busy per minute of setting up (5 min setup and
 * 30 busy = 6; 30 setup and 45 busy = 1.5). No setup counts as one minute, so it stays finite.
 */
export const payoff = (a) => Math.round((a.lasts / Math.max(1, a.setup)) * 10) / 10;
/** Best first: how it went counts most (middling before the first time); busy time for the setup adds up to 2.5. */
export const rank = (a) => { const s = scores(a); return (s.kid ?? 3) + (s.parent ?? 3) + Math.min(payoff(a), 10) / 4; };

/** How it went, on average: { kid, parent, times } (null before the first time). */
export function scores(a) {
  const ks = a.logs.flatMap((l) => l.kids.map((k) => k.score)).filter((x) => x != null);
  const ps = a.logs.map((l) => l.parent).filter((x) => x != null);
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
  return { kid: avg(ks), parent: avg(ps), times: a.logs.length };
}

/** The starting ideas with the family's own versions on top, minus removed ones, plus their own. */
export function activitiesOf(records, starter = STARTER_ACTIVITIES) {
  const byId = new Map(records.map((r) => [r.activityId, r]));
  const out = [];
  for (const s of starter) {
    const r = byId.get(s.id);
    if (r?.removed) continue;
    out.push(normaliseActivity(r ? { ...s, ...r, activityId: s.id, starter: true } : { ...s, activityId: s.id, starter: true }));
  }
  for (const r of records) if (r.own && !r.removed) out.push(normaliseActivity(r));
  return out;
}

/**
 * Play now: what fits, best first.
 * @param ask { kids: [months], place: 'inside'|'outside'|null, weather, minutes, buy: false (only what we have) }
 */
export function pick(list, { kids = [], place = null, weather = null, minutes = null, buy = true } = {}) {
  const ok = (a) => {
    if (kids.length && !kids.some((m) => m != null && (a.ageFrom == null || m >= a.ageFrom) && (a.ageTo == null || m < a.ageTo))) return false;
    if (place && a.place !== 'either' && a.place !== place) return false;
    if (place === 'outside' && weather && !a.weather.includes('any') && !a.weather.includes(weather)) return false;
    if (minutes && (a.setup > Math.max(10, minutes / 2) || a.lasts < minutes * 0.6)) return false;
    if (!buy && toBuy(a).length) return false;
    return true;
  };
  return list.filter(ok).sort((a, b) => rank(b) - rank(a));
}

/** Planned for a day, and coming up (from today on). */
export const plannedOn = (list, day) => list.filter((a) => a.plannedOn === day);
export const planned = (list, today) => list.filter((a) => a.plannedOn && a.plannedOn >= today).sort((a, b) => a.plannedOn.localeCompare(b.plannedOn));

/** New rules: the old ones kept in the history, so you can see what made it more fun. */
export function changeRules(a, rules, at = new Date().toISOString()) {
  const next = lines(rules);
  if (next.join('\n') === a.rules.join('\n')) return a;
  return { ...a, rules: next, rulesHistory: a.rules.length ? [...a.rulesHistory, { at, rules: a.rules }].slice(-20) : a.rulesHistory };
}

/** We did it: the day, each child's score, the parent's, and what to change. Done plans are cleared. */
export const logDone = (a, { day, kids = [], parent = null, note = '' }) => ({
  ...a, logs: [...a.logs, { day, kids, parent, note }], plannedOn: a.plannedOn && a.plannedOn <= day ? null : a.plannedOn,
});

/** The Shopping list's link, for what needs buying. */
export const shopSend = (a) => ({ source: `activity:${a.activityId}`, from: a.name, group: 'household', items: toBuy(a).map((x) => ({ name: x.name, note: x.cost ? `about R${x.cost}` : '' })) });

// Starting ideas - a starting point to change, remove and add to. Safety notes where it matters.
export const STARTER_ACTIVITIES = [
  { id: 'fort', name: 'Cushion fort', ageFrom: 18, ageTo: 144, place: 'inside', weather: ['any'], setup: 10, lasts: 45,
    needs: ['Couch cushions', 'Blankets or sheets', 'Pegs or clips', 'A torch'], steps: ['Make walls from cushions against the couch.', 'Throw a sheet over the top; peg it down.', 'Torch, books and snacks inside.'],
    safety: 'Nothing heavy on top - sheets only, so it can fall without hurting anyone.' },
  { id: 'sprinkler', name: 'Sprinkler game', ageFrom: 24, ageTo: 144, place: 'outside', weather: ['sun'], setup: 10, lasts: 40, game: true,
    needs: ['Hose and sprinkler', 'Towels', 'Sunscreen and hats'], steps: ['Set the sprinkler on the lawn, away from paving.', 'Play a round, then towel off in the shade.'],
    rules: ['Run through without being caught by the spray.', 'Whoever stays driest picks the next round.'],
    safety: 'An adult watching all the time; on grass, not paving - wet paving is slippery. Mind water restrictions.' },
  { id: 'treasure', name: 'Treasure hunt', ageFrom: 36, ageTo: 144, place: 'either', weather: ['any', 'sun', 'cool'], setup: 15, lasts: 30, game: true,
    needs: ['Paper and a pen', 'A small treat or toy as the treasure'], steps: ['Hide the treasure.', 'Write 5 clues, each leading to the next; picture clues for small ones.'],
    rules: ['One clue at a time.', 'Helpers can give one hint per clue.'] },
  { id: 'obstacle', name: 'Obstacle course', ageFrom: 24, ageTo: 144, place: 'either', weather: ['any', 'sun', 'cool'], setup: 15, lasts: 30, game: true,
    needs: ['Cushions', 'Chairs', 'A rope or tape for lines'], steps: ['Build a course: over, under, around, balance.', 'Time each run.'],
    rules: ['Touch every obstacle.', 'Beat your own time, not each other’s.'] },
  { id: 'kitchenband', name: 'Kitchen band', ageFrom: 9, ageTo: 96, place: 'inside', weather: ['any'], setup: 5, lasts: 20,
    needs: ['Pots and wooden spoons', 'A container with rice or beans, lid taped'], steps: ['Everyone picks an instrument.', 'Copy the leader’s rhythm; swap leaders.'] },
  { id: 'waterpaint', name: 'Painting with water', ageFrom: 12, ageTo: 72, place: 'outside', weather: ['sun'], setup: 2, lasts: 25,
    needs: ['A bucket of water', 'Old paintbrushes'], steps: ['"Paint" walls, paving and fences.', 'Watch it disappear in the sun.'] },
  { id: 'picnic', name: 'Indoor picnic', ageFrom: 12, ageTo: 144, place: 'inside', weather: ['any', 'rain'], setup: 10, lasts: 40,
    needs: ['A blanket', 'Snacks', 'Teddies as guests'], steps: ['Spread the blanket in a new spot.', 'Everyone brings a guest.'] },
  { id: 'hideseek', name: 'Hide and seek', ageFrom: 30, ageTo: 144, place: 'either', weather: ['any', 'sun', 'cool'], setup: 0, lasts: 30, game: true,
    needs: [], steps: ['Agree the boundaries first.'], rules: ['The seeker counts to 20 with eyes closed.', 'Not inside cupboards, the car or anywhere that locks.'],
    safety: 'Agree out-of-bounds places first: cars, appliances, anything that latches.' },
  { id: 'playdough', name: 'Home-made playdough', ageFrom: 24, ageTo: 96, place: 'inside', weather: ['any', 'rain'], setup: 15, lasts: 40,
    needs: ['2 cups flour', '1 cup salt', '1 cup water', '2 tbsp oil', 'Food colouring - R25'], steps: ['Mix, knead, colour.', 'Cookie cutters and a rolling pin.'],
    safety: 'Very salty - not for eating; keep away from pets.' },
  { id: 'nature', name: 'Nature hunt', ageFrom: 24, ageTo: 144, place: 'outside', weather: ['sun', 'cool'], setup: 5, lasts: 30, game: true,
    needs: ['A bag or egg box', 'A list or pictures to find'], steps: ['Find: a feather, a smooth stone, 3 different leaves, something yellow.'],
    rules: ['Only things already on the ground.'] },
  { id: 'balloon', name: 'Keep the balloon up', ageFrom: 18, ageTo: 120, place: 'inside', weather: ['any', 'rain'], setup: 1, lasts: 15, game: true,
    needs: ['Balloons - R20'], steps: ['Clear a space.'], rules: ['The balloon must not touch the floor.', 'Count the hits together.'],
    safety: 'Burst balloon pieces are a choking risk - pick them up straight away; not for under 3s unattended.' },
  { id: 'bath', name: 'Bubble bath disco', ageFrom: 9, ageTo: 72, place: 'inside', weather: ['any', 'cool', 'rain'], setup: 5, lasts: 20,
    needs: ['Bubble bath', 'Cups and jugs', 'Music'], steps: ['Bubbles, music, pouring games.'], safety: 'An adult within arm’s reach the whole time.' },
  { id: 'chalk', name: 'Chalk town', ageFrom: 30, ageTo: 120, place: 'outside', weather: ['sun', 'cool'], setup: 5, lasts: 40,
    needs: ['Sidewalk chalk - R50', 'Toy cars or bikes'], steps: ['Draw roads, a shop, a car wash on the paving.', 'Drive through it.'] },
  { id: 'sorting', name: 'Sorting basket', ageFrom: 9, ageTo: 30, place: 'inside', weather: ['any'], setup: 3, lasts: 15,
    needs: ['A basket of safe household things', 'Bowls'], steps: ['Sort by colour, size or "soft and hard".'], safety: 'Nothing small enough to fit through a toilet-roll tube for under 3s.' },
  { id: 'peekaboo', name: 'Peekaboo', ageFrom: 3, ageTo: 24, place: 'either', weather: ['any', 'sun', 'cool'], setup: 0, lasts: 10, game: true,
    needs: ['A light cloth or your hands'], steps: ['Hide your face, then "boo!"', 'Hide a toy under the cloth for them to find.'], rules: ['Their turn: let them hide you.'] },
  { id: 'tummy', name: 'Tummy time with a mirror', ageFrom: 0, ageTo: 9, place: 'inside', weather: ['any'], setup: 2, lasts: 10,
    needs: ['A blanket on the floor', 'A baby-safe mirror or a toy'], steps: ['Baby on their tummy, mirror or toy just in front.', 'Get down at their level and talk.'],
    safety: 'Only while awake and watched; sleep is always on the back.' },
  { id: 'shadeplay', name: 'Blanket in the shade', ageFrom: 3, ageTo: 18, place: 'outside', weather: ['sun', 'cool'], setup: 5, lasts: 30,
    needs: ['A blanket', 'Shade - a tree or umbrella', 'A hat', 'A few toys'], steps: ['Lie on the blanket in full shade.', 'Leaves, grass and birds to look at.'],
    safety: 'Under 6 months: shade and clothing, not sun. Check the blanket for ants first.' },
  { id: 'story', name: 'Make-up-a-story', ageFrom: 36, ageTo: 144, place: 'either', weather: ['any'], setup: 0, lasts: 15, game: true,
    needs: [], steps: ['Sit together - in the car works too.'], rules: ['Each person adds one sentence.', 'Every story needs a dragon or a dog.'] },
];
