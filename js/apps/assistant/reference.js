// Dietary reference values the Meal Assistant uses to spot an opportunity in a
// meal. They are never shown as targets and never used to judge a day: a meal
// below a reference value is not a deficiency (spec 14).
//
// Source: National Academies Dietary Reference Intakes, as tabulated in the NIH
// Office of Dietary Supplements fact sheets (potassium: 2019 update). RDA and AI
// are kept apart because they mean different things. Reviewed 2026-10-26.
// Babies under one are deliberately not covered - see needsFor().

export const KIND = {
  protein: 'RDA', fibre: 'AI', iron: 'RDA', calcium: 'RDA', vitC: 'RDA', folate: 'RDA', vitA: 'RDA', zinc: 'RDA',
  magnesium: 'RDA', potassium: 'AI', choline: 'AI', vitD: 'RDA', b12: 'RDA', ala: 'AI',
};

// Columns: 1-3, 4-8, 9-13 m, 9-13 f, 14-18 m, 14-18 f, 19-50 m, 19-50 f, 51+ m, 51+ f, pregnancy, breastfeeding
const GROUPS = ['1-3', '4-8', '9-13m', '9-13f', '14-18m', '14-18f', '19-50m', '19-50f', '51+m', '51+f', 'preg', 'lact'];
const TABLE = {
  protein: [13, 19, 34, 34, 52, 46, 56, 46, 56, 46, 71, 71],           // g
  fibre: [19, 25, 31, 26, 38, 26, 38, 25, 30, 21, 28, 29],             // g
  iron: [7, 10, 8, 8, 11, 15, 8, 18, 8, 8, 27, 9],                      // mg
  calcium: [700, 1000, 1300, 1300, 1300, 1300, 1000, 1000, 1000, 1200, 1000, 1000], // mg
  vitC: [15, 25, 45, 45, 75, 65, 90, 75, 90, 75, 85, 120],             // mg
  folate: [150, 200, 300, 300, 400, 400, 400, 400, 400, 400, 600, 500], // µg DFE
  vitA: [300, 400, 600, 600, 900, 700, 900, 700, 900, 700, 770, 1300], // µg RAE
  zinc: [3, 5, 8, 8, 11, 9, 11, 8, 11, 8, 11, 12],                      // mg
  magnesium: [80, 130, 240, 240, 410, 360, 400, 320, 420, 320, 350, 310], // mg
  potassium: [2000, 2300, 2500, 2300, 3000, 2300, 3400, 2600, 3400, 2600, 2900, 2800], // mg
  choline: [200, 250, 375, 375, 550, 400, 550, 425, 550, 425, 450, 550], // mg
  vitD: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15],              // µg
  b12: [0.9, 1.2, 1.8, 1.8, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.6, 2.8],   // µg
  ala: [0.7, 0.9, 1.2, 1.0, 1.6, 1.1, 1.6, 1.1, 1.6, 1.1, 1.4, 1.3],   // g
};
export const NUTRIENTS = Object.keys(TABLE);

function group(age, sex, lifeStage) {
  if (lifeStage === 'pregnant') return ['preg'];
  if (lifeStage === 'breastfeeding') return ['lact'];
  if (age <= 3) return ['1-3'];
  if (age <= 8) return ['4-8'];
  const band = age <= 13 ? '9-13' : age <= 18 ? '14-18' : age <= 50 ? '19-50' : '51+';
  // Sex not given: take the higher value of the two, so an opportunity is not missed.
  return sex ? [`${band}${sex[0]}`] : [`${band}m`, `${band}f`];
}

/**
 * Reference values for one person, or null for a baby under one (whose
 * feeding follows the clinic, not this app). With no birthday, an adult
 * (or, for role 'child', a 4-8 year old) is assumed and `assumed` says so.
 */
export function needsFor({ age, role, sex, lifeStage, weightKg }) {
  const assumed = age === null || age === undefined;
  const a = assumed ? (role === 'child' ? 6 : 30) : age;
  if (a < 1) return null;
  const cols = group(a, sex, lifeStage).map((g) => GROUPS.indexOf(g));
  const ref = {};
  for (const [k, row] of Object.entries(TABLE)) ref[k] = Math.max(...cols.map((i) => row[i]));
  // Adults with a weight: protein follows body weight (0.8 g/kg; +25 g in pregnancy and breastfeeding).
  if (weightKg && a >= 19) ref.protein = Math.round(weightKg * 0.8 + (lifeStage ? 25 : 0));
  return { ref, age: a, assumed };
}
