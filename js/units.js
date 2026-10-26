// Metric or imperial, for showing and typing amounts. Everything is SAVED in
// metric (kg, cm, g, ml) whatever is chosen, so two devices set differently
// never disagree about the data. Imperial here means US customary (lb, ft/in,
// oz, fl oz, quarts). Nutrient amounts stay in g and mg, as on food labels.
// Pure: no DOM.

export const SYSTEMS = { metric: 'Metric (kg, cm, g, ml)', imperial: 'Imperial (lb, ft and in, oz, fl oz)' };
export const systemOf = (v) => (v === 'imperial' ? 'imperial' : 'metric');

const KG_PER_LB = 0.45359237;
const G_PER_OZ = 28.349523125;
const CM_PER_IN = 2.54;
const ML_PER_FLOZ = 29.5735295625;

const round = (n, step) => Math.round(n / step) * step;
const trim = (n) => String(Math.round(n * 10) / 10).replace(/\.0$/, '');

/** 64.5 kg, or 142 lb (a baby: 13 lb 4 oz). */
export function fmtWeight(kg, sys) {
  if (kg === null || kg === undefined) return '';
  if (systemOf(sys) === 'metric') return `${trim(kg)} kg`;
  const lb = kg / KG_PER_LB;
  if (lb < 30) {
    let whole = Math.floor(lb);
    let oz = Math.round((lb - whole) * 16);
    if (oz === 16) { whole += 1; oz = 0; }
    return `${whole} lb${oz ? ` ${oz} oz` : ''}`;
  }
  return `${trim(round(lb, 0.5))} lb`;
}

/** 168 cm, or 5 ft 6 in. */
export function fmtHeight(cm, sys) {
  if (cm === null || cm === undefined) return '';
  if (systemOf(sys) === 'metric') return `${trim(cm)} cm`;
  const inches = Math.round(cm / CM_PER_IN);
  const ft = Math.floor(inches / 12);
  return ft ? `${ft} ft ${inches % 12} in` : `${inches} in`;
}

/** What was typed, back to metric: pounds -> kg; feet and inches -> cm. Empty stays empty. */
export const kgFrom = (value, sys) => {
  if (value === '' || value === null || value === undefined) return '';
  return systemOf(sys) === 'metric' ? Number(value) : Math.round(Number(value) * KG_PER_LB * 10) / 10;
};
export function cmFrom(a, b, sys) {
  if (systemOf(sys) === 'metric') return a === '' ? '' : Number(a);
  if (a === '' && b === '') return '';
  return Math.round(((Number(a) || 0) * 12 + (Number(b) || 0)) * CM_PER_IN * 10) / 10;
}

/** A mass of food in grams: 100 g, or 3.5 oz (1.3 lb from a pound up). */
export function fmtMass(g, sys) {
  if (systemOf(sys) === 'metric') return g >= 1000 ? `${trim(g / 1000)} kg` : `${Math.round(g)} g`;
  const oz = g / G_PER_OZ;
  return oz >= 16 ? `${trim(oz / 16)} lb` : `${oz >= 10 ? Math.round(oz) : trim(oz)} oz`;
}
export const gramsFromOz = (oz) => (Number(oz) || 0) * G_PER_OZ;

/**
 * An ingredient or shopping amount in the chosen system. Only grams, kilos,
 * millilitres and litres convert; cups, spoons, tins and "2 eggs" stay as written.
 */
export function inSystem(item, sys) {
  if (systemOf(sys) === 'metric' || item.qty === null || item.qty === undefined) return item;
  const g = { g: 1, kg: 1000 }[item.unit];
  if (g) {
    const oz = (item.qty * g) / G_PER_OZ;
    return oz >= 16 ? { ...item, qty: Math.round((oz / 16) * 10) / 10, unit: 'lb' } : { ...item, qty: oz >= 10 ? Math.round(oz) : Math.round(oz * 10) / 10, unit: 'oz' };
  }
  const ml = { ml: 1, l: 1000 }[item.unit];
  if (ml) {
    const floz = (item.qty * ml) / ML_PER_FLOZ;
    return floz >= 32 ? { ...item, qty: Math.round((floz / 32) * 10) / 10, unit: 'qt' } : { ...item, qty: Math.round(floz * 10) / 10, unit: 'fl oz' };
  }
  return item;
}

/**
 * A portion name from the food database in the chosen system. The source is
 * American, so in metric `cucumber (8-1/4")` reads `cucumber (21 cm)`,
 * `wedge (1.33 oz)` reads `wedge (38 g)` and `1/2" pieces` reads `1.3 cm pieces`.
 */
export function sizeLabel(label, sys) {
  if (systemOf(sys) !== 'metric') return label;
  const cm = (inches) => (inches * 2.54 >= 3 ? String(Math.round(inches * 2.54)) : trim(inches * 2.54));
  return String(label)
    .replace(/(\d+)-(\d+)\/(\d+)"/g, (_, w, a, b) => `${cm(Number(w) + a / b)} cm`)
    .replace(/(\d+)\/(\d+)"/g, (_, a, b) => `${cm(a / b)} cm`)
    .replace(/(\d+(?:\.\d+)?)"/g, (_, n) => `${cm(Number(n))} cm`)
    .replace(/(\d+(?:\.\d+)?)\s*oz\b/g, (_, n) => `${Math.round(n * G_PER_OZ)} g`)
    .replace(/\bcubic inch\b/g, '2.5 cm cube');
}
