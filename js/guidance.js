// Things worth knowing at each age and stage: honey and water in a baby's first
// year, cow's milk, salt, sugar, caffeine, choking risks, pregnancy and more.
// One list, read by the People page, the home screen, Meal Assistant and
// Calorie Checker. Pure: no DOM.
//
// Each rule says who it is for (an age range in months, or a life stage or
// diet), how serious it is ('warn' or 'info'), and optionally which foods it is
// about, so a meal or a plate can be checked. Every rule names its source. The
// wording is guidance to talk over with a clinic, never a diagnosis.
// Reviewed 2026-10-26.

import { ageOn, lifeStageAllowed } from './model.js';

const DGA = 'Dietary Guidelines for Americans 2025-2030';
const NHS = 'NHS Start for Life';
const NHS_PREG = 'NHS - foods to avoid in pregnancy';

const Y = 12;   // months in a year, for readable ranges

/**
 * from/to: age in months, from inclusive, to exclusive.  stage: 'pregnant' | 'breastfeeding'.  diet: a diet id.
 * foods: which food names it is about.  except: names it is not about.  notice: short text for the home screen.
 */
export const RULES = [
  // The first year
  { id: 'honey', from: 0, to: Y, level: 'warn', foods: /\bhoney\b/i,
    text: 'No honey before their first birthday - not even a little in food. It can carry bacteria that cause infant botulism.', source: `${NHS}; CDC` },
  { id: 'water-early', from: 0, to: 6, level: 'warn', foods: /\b(water|juice|tea)\b/i, except: /coconut milk|watermelon/i,
    text: 'Before about 6 months, babies need only breast milk or infant formula - no water, juice or other drinks.', source: `${DGA}; ${NHS}` },
  { id: 'water-later', from: 6, to: Y, level: 'info',
    text: 'From about 6 months, small sips of water from a cup with meals are fine (cooled boiled water if your tap water is not safe to drink). Breast milk or formula stays the main drink until 12 months.', source: `${NHS}; ${DGA}` },
  { id: 'cows-milk', from: 0, to: Y, level: 'warn', foods: /^milk\b|\bcow'?s milk\b|\bwhole milk\b|\bfull cream milk\b|^milk$/i, except: /human|breast|formula/i,
    text: 'No cow’s milk as a drink before 12 months - it can go into cooking from about 6 months.', source: `${DGA}; ${NHS}` },
  { id: 'salt-baby', from: 0, to: Y, level: 'warn', foods: /\bsalt\b|stock cube|\bstock\b|soy sauce|\bgravy\b|bacon|biltong/i,
    text: 'No added salt, stock cubes or salty foods - a baby’s kidneys cannot cope with much salt.', source: NHS },
  { id: 'juice-baby', from: 0, to: Y, level: 'warn', foods: /\bjuice\b/i,
    text: 'No fruit juice in the first year - whole fruit is better.', source: 'American Academy of Pediatrics' },
  { id: 'solids', from: 3, to: 7, level: 'info', notice: 'solid food can start at about 6 months',
    text: 'Solid food starts at about 6 months, when your baby can sit up, hold their head steady, bring things to their mouth and swallow food rather than push it out. Breast milk or formula stays the main food until 12 months.', source: DGA },
  { id: 'allergens', from: 4, to: Y, level: 'info',
    text: 'Foods that can cause allergies - egg, smooth peanut butter, wheat, fish and shellfish - can be introduced from about 6 months, one at a time. With severe eczema or an egg allergy, ask your clinic about starting peanut as early as 4 to 6 months.', source: DGA },
  { id: 'vitamin-d-baby', from: 0, to: Y, level: 'info',
    text: 'Breastfed babies, and babies having less than about a litre of formula a day, are usually advised a daily vitamin D supplement - ask your clinic.', source: DGA },
  { id: 'milk-switch', from: 11, to: 14, level: 'info', notice: 'from 12 months, formula changes to whole milk',
    text: 'From 12 months, stop infant formula and give whole (full-cream) milk. Breastfeeding can go on as long as you both want.', source: DGA },

  // Young children
  { id: 'added-sugar', from: 0, to: 4 * Y, level: 'warn', foods: /\b(sugar|syrup|jam|sweets|candy|chocolate|biscuits?|cookies?|cake|soda|cooldrink|fizzy|soft drink)\b/i, except: /sugar beans|sugar snap|no sugar|unsweetened/i,
    text: 'Avoid added sugar until about 4 years old - sugar, syrup, sweets and sugary drinks.', source: DGA },
  { id: 'choking', from: 0, to: 5 * Y, level: 'warn', foods: /\b(nuts?|peanuts|almonds|grapes|popcorn|cherry tomato(es)?|hard sweets|marshmallows?|sausages?|boerewors|hot dog)\b/i, except: /butter/i,
    text: 'Choking risks under 5: no whole nuts or popcorn; cut grapes and cherry tomatoes into quarters lengthways, and sausages into strips; cook or grate hard vegetables.', source: NHS },
  { id: 'new-foods', from: 6, to: 5 * Y, level: 'info',
    text: 'It can take 8 to 10 tries before a young child accepts a new food - keep offering it alongside foods they like, without pressure.', source: DGA },
  { id: 'full-fat-dairy', from: Y, to: 11 * Y, level: 'info',
    text: 'Full-fat dairy - milk, yoghurt, cheese - helps young children meet their energy needs.', source: DGA },
  { id: 'caffeine-child', from: 0, to: 12 * Y, level: 'warn', foods: /\b(coffee|tea|cola|energy drinks?)\b/i, except: /rooibos|herbal|decaf/i,
    text: 'Avoid caffeinated drinks - coffee, tea, cola and energy drinks.', source: DGA },
  { id: 'sodium-1', from: Y, to: 4 * Y, level: 'info', text: 'Aim for less than 1,200 mg of sodium a day (about half a teaspoon of salt in all), and avoid salty processed foods.', source: DGA },
  { id: 'sodium-4', from: 4 * Y, to: 9 * Y, level: 'info', text: 'Aim for less than 1,500 mg of sodium a day, and avoid salty processed foods.', source: DGA },
  { id: 'sodium-9', from: 9 * Y, to: 14 * Y, level: 'info', text: 'Aim for less than 1,800 mg of sodium a day, and avoid salty processed foods.', source: DGA },

  // Teenagers and adults
  { id: 'teen', from: 11 * Y, to: 19 * Y, level: 'info', foods: /energy drinks?/i,
    text: 'Teenagers need more energy, protein, calcium and iron - girls especially once periods start. Dairy, leafy greens and iron-rich meat help; energy drinks and sugary drinks are best kept rare.', source: DGA },
  { id: 'sodium-adult', from: 14 * Y, to: 200 * Y, level: 'info', text: 'Aim for less than 2,300 mg of sodium a day (about a teaspoon of salt in all) - more is fine when very active and sweating a lot.', source: DGA },
  { id: 'older', from: 65 * Y, to: 200 * Y, level: 'info',
    text: 'Older adults may need fewer calories but as much or more protein, vitamin B12, vitamin D and calcium - dairy, meat, fish, eggs and legumes help.', source: DGA },

  // Pregnancy and breastfeeding
  { id: 'preg-alcohol', stage: 'pregnant', level: 'warn', foods: /\b(wine|beer|alcohol|spirits|vodka|whisk(e)?y|gin|rum|cider|brandy)\b/i,
    text: 'No alcohol in pregnancy.', source: DGA },
  { id: 'preg-food', stage: 'pregnant', level: 'warn', foods: /\b(liver|pâté|pate|brie|camembert|blue cheese|raw|sushi|swordfish|shark|marlin|biltong|droewors)\b/i,
    text: 'Avoid liver and pâté, unpasteurised and mould-ripened soft cheese, raw or undercooked meat, fish and eggs, cured meat, and high-mercury fish (shark, swordfish, marlin). Low-mercury oily fish like salmon, sardines and trout is encouraged.', source: `${NHS_PREG}; ${DGA}` },
  { id: 'preg-caffeine', stage: 'pregnant', level: 'info', foods: /\b(coffee|tea|cola|energy drinks?)\b/i, except: /rooibos|herbal|decaf/i,
    text: 'Keep caffeine under 200 mg a day - about two mugs of instant coffee.', source: NHS_PREG },
  { id: 'preg-priorities', stage: 'pregnant', level: 'info',
    text: 'Iron, folate, iodine and choline are top priorities: iron-rich meat, folate-rich greens and legumes, eggs and dairy. Talk to your clinic about a daily prenatal vitamin.', source: DGA },
  { id: 'bf-priorities', stage: 'breastfeeding', level: 'info',
    text: 'Breastfeeding needs more energy and nutrients: vitamin B12-rich protein (meat, eggs, dairy), omega-3 seafood, legumes and vitamin A-rich vegetables. Ask your clinic whether supplements are needed.', source: DGA },
  { id: 'bf-alcohol', stage: 'breastfeeding', level: 'info', foods: /\b(wine|beer|alcohol|spirits|vodka|whisk(e)?y|gin|rum|cider|brandy)\b/i,
    text: 'Not drinking alcohol is safest while breastfeeding; if you do, keep it occasional and small, and wait at least two hours before a feed.', source: 'CDC' },

  // Diets
  { id: 'vegan', diet: 'vegan', level: 'info',
    text: 'Vegan diets can fall short on vitamin B12, vitamin D, iron, calcium, iodine, zinc and protein. Vary plant proteins, and ask your clinic about B12 and checking these now and then.', source: DGA },
  { id: 'vegetarian', diet: 'vegetarian', level: 'info',
    text: 'Vegetarian diets can fall short on vitamin D, vitamin E, choline and iron - eggs, dairy, legumes and leafy greens help.', source: DGA },
];

/** Whole months on `today`, or null with no birthday. */
export function monthsOn(born, today) {
  if (ageOn(born, today) === null) return null;
  const [y, m, d] = born.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.max(0, (ty - y) * 12 + tm - m - (td < d ? 1 : 0));
}

function applies(rule, p, months, today) {
  if (rule.stage) return lifeStageAllowed(p, today) && p.lifeStage === rule.stage;
  if (rule.diet) return (p.diet ?? []).includes(rule.diet);
  return months !== null && months >= rule.from && months < rule.to;
}

/** Everything that applies to one person now, warnings first. Age rules need a birthday. */
export function guidanceFor(p, today) {
  const months = monthsOn(p.born, today);
  const list = RULES.filter((r) => applies(r, p, months, today));
  return [...list.filter((r) => r.level === 'warn'), ...list.filter((r) => r.level !== 'warn')];
}

const about = (rule, name) => rule.foods.test(name) && !(rule.except && rule.except.test(name));

/**
 * Rules that apply to this person AND are about one of these foods.
 * @returns [{ rule, foods: [names it matched] }]
 */
export function foodWarnings(p, today, names, { skip = [] } = {}) {
  return guidanceFor(p, today)
    .filter((r) => r.foods && !skip.includes(r.id))
    .map((rule) => ({ rule, foods: names.filter((n) => about(rule, n)) }))
    .filter((x) => x.foods.length);
}

/**
 * Notices for the home screen: what matters most for babies, and milestones
 * coming up. Their text changes with the age, so a dismissed one comes back at
 * the next milestone.
 */
export function homeNotices(people, today) {
  const out = [];
  for (const p of people) {
    const months = monthsOn(p.born, today);
    if (months === null) continue;
    if (months < 12) {
      const first = months < 6 ? 'only breast milk or formula until about 6 months, ' : '';
      out.push({ id: `baby:${p.id}:${months < 6 ? 'early' : 'later'}`, level: 'warn', text: `${p.name} is under one: ${first}no honey, no cow’s milk as a drink, and no added salt or sugar. More on the People page.` });
    }
    for (const r of RULES.filter((x) => x.notice && months >= x.from && months < x.to)) {
      out.push({ id: `milestone:${p.id}:${r.id}`, level: 'info', text: `${p.name} (${months} months): ${r.notice}. More on the People page.` });
    }
  }
  return out;
}
