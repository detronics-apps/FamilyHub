// How a family meal might be shared out: each person's portion as a share of
// one standard adult portion, from a rough estimate of their daily energy
// needs. A guide for how much to cook and serve - appetites differ from day to
// day, and nobody should be pushed to finish a plate. Pure: no DOM.
//
// Energy estimates: with age, gender, height and weight, the US National
// Academies' Estimated Energy Requirement equations at the "low active" level
// (2005); otherwise typical needs by age and gender for a moderately active
// person (Dietary Guidelines for Americans 2020-2025, Appendix 2). Pregnancy
// adds 340 kcal (the second-trimester figure), breastfeeding 330. A person's own
// energy goal (People page; adults only) moves their figure up or down.

import { ageOn, energyGoalAllowed } from './model.js';

/** One standard portion = a 2,000 kcal-a-day adult's share of a meal. */
export const STANDARD_KCAL = 2000;

// Typical daily needs, moderately active, by age 2-19 and adult bands.
const TYPICAL = {
  male: [1000, 1400, 1400, 1600, 1600, 1600, 1600, 1800, 1800, 2000, 2200, 2200, 2400, 2600, 2800, 2800, 2800, 2800],
  female: [1000, 1200, 1400, 1400, 1400, 1600, 1600, 1600, 1800, 1800, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2200],
};
const adultTypical = (sex, age) => (sex === 'male' ? (age <= 25 ? 2800 : age <= 45 ? 2600 : age <= 65 ? 2400 : 2200) : (age <= 25 ? 2200 : age <= 50 ? 2000 : 1800));

function typical(sex, age) {
  if (age < 2) return 900;
  if (age < 20) return TYPICAL[sex][age - 2];
  return adultTypical(sex, age);
}

/** National Academies EER, "low active". Height in metres, weight in kg. */
function measured(sex, age, kg, m) {
  if (age < 3) return 89 * kg - 100 + 20;
  if (age < 19) {
    const extra = age <= 8 ? 20 : 25;
    return sex === 'male' ? 88.5 - 61.9 * age + 1.13 * (26.7 * kg + 903 * m) + extra : 135.3 - 30.8 * age + 1.16 * (10 * kg + 934 * m) + extra;
  }
  return sex === 'male' ? 662 - 9.53 * age + 1.11 * (15.91 * kg + 539.6 * m) : 354 - 6.91 * age + 1.12 * (9.36 * kg + 726 * m);
}

/**
 * A rough daily energy need for one person, or null for a baby under one.
 * @param p a profile with born, role, sex, lifeStage, and weightKg/heightCm if recorded
 * @returns {{ kcal, basis: 'measured'|'typical'|'assumed' }}
 */
export function energyGuide(p, today) {
  const known = ageOn(p.born, today);
  const age = known ?? (p.role === 'child' ? 6 : 35);
  if (age < 1) return null;
  const sexes = p.sex ? [p.sex] : ['female', 'male'];             // gender not given: halfway between
  const useMeasured = known !== null && p.weightKg && p.heightCm;
  const each = sexes.map((s) => (useMeasured ? measured(s, age, p.weightKg, p.heightCm / 100) : typical(s, age)));
  let kcal = each.reduce((a, b) => a + b, 0) / each.length;
  if (p.sex === 'female' && age >= 16) kcal += p.lifeStage === 'pregnant' ? 340 : p.lifeStage === 'breastfeeding' ? 330 : 0;
  // Their own goal, where it is allowed (an adult, not pregnant or breastfeeding).
  const goal = p.energyGoal && energyGoalAllowed(p, today) ? p.energyGoal : 0;
  kcal += goal;
  return { kcal: Math.round(kcal), goal, basis: useMeasured ? 'measured' : known === null ? 'assumed' : 'typical' };
}

/** Each person's portion, as a share of a standard portion, to the nearest quarter. */
export function portionShares(profiles, today) {
  return profiles.map((p) => {
    const e = energyGuide(p, today);
    if (!e) return { id: p.id, name: p.name, share: 0, kcal: null, basis: 'baby' };
    return { id: p.id, name: p.name, share: Math.max(0.25, Math.round((e.kcal / STANDARD_KCAL) * 4) / 4), kcal: e.kcal, basis: e.basis };
  });
}

export const LEFTOVERS = { none: 'No leftovers', one: 'Leftovers for one', two: 'Leftovers for two', meal: 'Enough for another family meal' };

/** How many standard portions to cook for these people, with or without leftovers. */
export function portionPlan(shares, leftovers = 'none') {
  const eating = shares.reduce((sum, s) => sum + s.share, 0);
  const extra = { none: 0, one: 1, two: 2, meal: eating }[leftovers] ?? 0;
  const total = eating + extra;
  return { eating, extra, total, cook: Math.max(1, Math.ceil(total)) };
}

/** 1.25 -> "1¼", 0.5 -> "½" */
export function fmtShare(n) {
  const whole = Math.floor(n);
  const part = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[Math.round((n - whole) * 4) / 4] ?? '';
  return `${whole || !part ? whole : ''}${part}`;
}
