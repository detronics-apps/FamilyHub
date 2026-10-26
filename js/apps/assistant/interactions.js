// Documented food-nutrient interactions the Meal Assistant may mention (spec 9).
// Only effects with published evidence are listed, with how far they reach:
// most are measured in single meals, and the long-term effect on someone's
// iron status is smaller and less certain - the wording on screen says so.
// Reviewed 2026-10-26.

export const INTERACTIONS = [
  {
    id: 'vitc-iron', nutrient: 'iron', form: 'non-haem', direction: 'enhances', factor: 'vitamin C',
    evidence: 'strong', scope: 'meal',
    conditions: 'Vitamin C eaten in the same meal as plant sources of iron (grains, beans, leafy greens).',
    limitations: 'Measured in single meals; the effect on long-term iron status is smaller.',
    say: 'Vitamin C in the same meal helps the body take up iron from plant foods',
    source: 'Hurrell R, Egli I. Iron bioavailability and dietary reference values. Am J Clin Nutr 2010;91:1461S-7S. NIH ODS Iron fact sheet.',
  },
  {
    id: 'meat-iron', nutrient: 'iron', form: 'non-haem', direction: 'enhances', factor: 'meat, fish or poultry',
    evidence: 'strong', scope: 'meal',
    conditions: 'A little meat, fish or chicken eaten with plant sources of iron.',
    limitations: 'Single-meal studies; amounts vary.',
    say: 'Meat, fish or chicken in the meal also helps iron from plant foods to be absorbed',
    source: 'Hurrell R, Egli I. Am J Clin Nutr 2010;91:1461S-7S. NIH ODS Iron fact sheet.',
  },
  {
    id: 'calcium-iron', nutrient: 'iron', form: 'both', direction: 'inhibits', factor: 'calcium',
    evidence: 'moderate', scope: 'meal',
    conditions: 'Calcium-rich foods (milk, yoghurt, cheese) in the same meal as iron sources.',
    limitations: 'Clear in single meals, but studies over weeks and months show little effect on iron status. Only worth acting on when iron is a priority.',
    say: 'Calcium can reduce how much iron is absorbed from the same meal, although over time the effect looks small',
    source: 'Lönnerdal B. Calcium and iron absorption - mechanisms and public health relevance. Int J Vitam Nutr Res 2010;80:293-9.',
  },
  {
    id: 'tea-iron', nutrient: 'iron', form: 'non-haem', direction: 'inhibits', factor: 'polyphenols in tea and coffee',
    evidence: 'strong', scope: 'meal',
    conditions: 'Black tea or coffee drunk with a meal.',
    limitations: 'Measured in single meals; having the drink an hour or so later avoids most of it.',
    say: 'Tea and coffee with a meal reduce how much iron is absorbed from plant foods',
    source: 'Hurrell RF, Reddy M, Cook JD. Inhibition of non-haem iron absorption in man by polyphenolic-containing beverages. Br J Nutr 1999;81:289-95.',
  },
  {
    id: 'phytate-iron', nutrient: 'iron', form: 'non-haem', direction: 'inhibits', factor: 'phytates in whole grains, beans, nuts and seeds',
    evidence: 'strong', scope: 'meal',
    conditions: 'Phytate-rich foods eaten with plant sources of iron.',
    limitations: 'These foods are still very nourishing; vitamin C in the meal offsets much of the effect, and soaking or fermenting reduces phytate.',
    say: 'Whole grains, beans, nuts and seeds contain phytates, which lower iron uptake a little - vitamin C in the meal helps offset this',
    source: 'Hurrell R, Egli I. Am J Clin Nutr 2010;91:1461S-7S.',
  },
  {
    id: 'fat-carotenoid', nutrient: 'carotenoids', form: 'beta-carotene, lycopene, lutein', direction: 'enhances', factor: 'some fat in the meal',
    evidence: 'moderate', scope: 'meal',
    conditions: 'Orange, red and green vegetables eaten with a little oil, avocado or other fat.',
    limitations: 'Small amounts of fat are enough.',
    say: 'A little fat in the meal (oil, avocado, butter) helps the body absorb the carotenoids in orange, red and green vegetables',
    source: 'Brown MJ et al. Carotenoid bioavailability is higher from salads ingested with full-fat than with fat-reduced salad dressings. Am J Clin Nutr 2004;80:396-403.',
  },
];

export const interaction = (id) => INTERACTIONS.find((i) => i.id === id) ?? null;
