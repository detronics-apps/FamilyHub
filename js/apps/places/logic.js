// Places to go (Holidays section): local outings - where in Cape Town (or
// anywhere) the family would like to go, or has been, with what each place is
// good for. Big trips with travel, packing and budget are in Holidays. Pure.

export const KINDS = {
  outdoors: 'Outdoors and nature', beach: 'Beach', park: 'Park or playground', food: 'Restaurant or café', market: 'Market',
  museum: 'Museum or gallery', activity: 'Activity or sport', animals: 'Animals and farms', event: 'Event or show', other: 'Other',
};
// Chosen from a list, never typed, so "great for kids" is always the same tag to filter by.
export const TAGS = {
  kids: 'Great for kids', play: 'Play area', pets: 'Pet friendly', free: 'Free', rainy: 'Good on a rainy day', shade: 'Shade',
  toilets: 'Toilets', pram: 'Pram or wheelchair friendly', food: 'Food and drinks there', parking: 'Easy parking', booking: 'Book ahead',
};
export const STATUSES = { want: 'Want to go', been: 'Been' };
export const VERDICTS = { loved: 'Loved it', fine: 'It was fine', not: 'Not again' };

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const keys = (v, of) => [...new Set((Array.isArray(v) ? v : []).filter((x) => of[x]))];

export function normalisePlace(p = {}) {
  return {
    ...p,
    title: str(p.title, 200) || 'A place',
    area: str(p.area, 80),                                   // the town or suburb: "Cape Town", "Stellenbosch"
    kind: KINDS[p.kind] ? p.kind : 'other',
    tags: keys(p.tags, TAGS),
    status: STATUSES[p.status] ? p.status : 'want',
    verdict: p.status === 'been' && VERDICTS[p.verdict] ? p.verdict : null,
    lastVisit: day(p.lastVisit),
    link: /^https?:\/\/\S+$/i.test(str(p.link, 500)) ? str(p.link, 500) : '',
    notes: str(p.notes),
  };
}

export const placeSummary = (p) => ({ title: p.title, area: p.area, kind: p.kind, tags: p.tags, status: p.status, verdict: p.verdict, lastVisit: p.lastVisit });
export const placeText = (p) => [p.title, p.area, KINDS[p.kind], ...p.tags.map((t) => TAGS[t]), p.notes].join(' ');

/** Places matching every chosen filter: an area, a kind, a status, and all the chosen tags. */
export function filterPlaces(list, { area = '', kind = '', status = '', tags = [] } = {}) {
  return list.filter((p) => (!area || p.area.toLowerCase() === area.toLowerCase())
    && (!kind || p.kind === kind) && (!status || p.status === status) && tags.every((t) => p.tags.includes(t)))
    .sort((a, b) => (a.status === b.status ? a.title.localeCompare(b.title) : a.status === 'want' ? -1 : 1));
}

/** The areas already used, most used first - offered when adding a place, so one town is one spelling. */
export function areasOf(list) {
  // "Cape Town" and "cape town" are one area, shown as first written.
  const n = new Map();
  for (const p of list) {
    if (!p.area) continue;
    const k = p.area.toLowerCase();
    const cur = n.get(k) ?? { name: p.area, count: 0 };
    n.set(k, { ...cur, count: cur.count + 1 });
  }
  return [...n.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((a) => a.name);
}
