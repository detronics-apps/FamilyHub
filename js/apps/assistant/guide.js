// The Meal Assistant's vocabulary: everyday foods it recognises in a meal and
// may suggest. Nutrient values are NOT here - each food points at its USDA
// record (`fdc`, SR Legacy) in the shared food database, so there is one source
// of numbers for the whole Meals section. What is here is what USDA does not
// say: colour, allergens, how it fits a meal, and safety for small children
// and in pregnancy.
//
//   g        a typical adult serving in grams (children get a smaller share)
//   group    veg | fruit | grain | protein | legume | dairy | fat | nutseed | sweet | drink
//   colour   red | orange | green | purple | white - plant foods only
//   fits     which meals it suits: breakfast, savoury, sweet, snack
//   animal   what diets need to know: meat, beef, pork, fish, dairy, egg, honey
//   iron     'haem' (meat, fish) or 'plant' (a notable non-haem source)
//   suggest  false = recognised in a meal, never suggested as an addition
//   child    { under, prep } prepare it this way below that age, or { under, avoid: true }
//   preg     { note } or { avoid: true, note } in pregnancy
//   cost, effort  1 (cheap, no work) to 3
//   dense    plenty of energy and nourishment in a small amount
//
// Safety notes follow NHS Start for Life and NHS pregnancy food guidance;
// they are conservative on purpose. Reviewed 2026-10-26.

const F = (o) => ({ also: [], colour: null, fits: ['savoury'], allergens: [], animal: null, iron: null, suggest: true, child: null, preg: null, cost: 1, effort: 1, dense: false, ...o });

const CHOKE_ROUND = { under: 5, prep: 'cut into quarters lengthways' };
const CHOKE_HARD = { under: 5, prep: 'cook until soft, or grate it' };
const NUT_BUTTER = { under: 5, prep: 'spread thinly - never by the spoonful' };
const OILY_FISH = { note: 'Up to 2 portions of oily fish a week in pregnancy.' };

export const GUIDE = [
  // Grains and starches
  F({ id: 'oats', name: 'oats', also: ['oatmeal', 'porridge oats', 'oat porridge', 'oat'], fdc: 173905, g: 240, group: 'grain', fits: ['breakfast'], iron: 'plant', allergens: ['gluten'], suggest: false }),
  F({ id: 'pap', name: 'maize meal porridge', also: ['pap', 'mielie pap', 'mealie pap', 'maize porridge', 'putu', 'phutu', 'mieliepap', 'grits', 'polenta'], fdc: 171655, g: 250, group: 'grain', colour: 'white', fits: ['breakfast', 'savoury'], suggest: false }),
  F({ id: 'samp', name: 'samp', also: ['hominy', 'umngqusho'], fdc: 169701, g: 165, group: 'grain', suggest: false }),
  F({ id: 'rice', name: 'white rice', also: ['rice'], fdc: 168878, g: 160, group: 'grain', suggest: false }),
  F({ id: 'brownrice', name: 'brown rice', fdc: 169704, g: 160, group: 'grain', cost: 2 }),
  F({ id: 'bread', name: 'white bread', also: ['bread', 'toast', 'sandwich', 'white toast'], fdc: 174924, g: 58, group: 'grain', fits: ['breakfast', 'savoury', 'snack'], allergens: ['gluten'], suggest: false }),
  F({ id: 'wholegrain', name: 'wholewheat bread', also: ['brown bread', 'whole wheat bread', 'wholegrain bread', 'whole-wheat bread', 'seed loaf'], fdc: 172688, g: 64, group: 'grain', fits: ['breakfast', 'savoury', 'snack'], iron: 'plant', allergens: ['gluten'] }),
  F({ id: 'pasta', name: 'pasta', also: ['spaghetti', 'macaroni', 'noodles', 'penne'], fdc: 169737, g: 180, group: 'grain', allergens: ['gluten'], suggest: false }),
  F({ id: 'potato', name: 'potatoes', also: ['potato', 'mash', 'mashed potato', 'boiled potatoes'], fdc: 170438, g: 170, group: 'grain', colour: 'white', suggest: false }),
  F({ id: 'chips', name: 'chips', also: ['fries', 'french fries', 'slap chips'], fdc: 170118, g: 120, group: 'grain', suggest: false }),
  F({ id: 'sweetpotato', name: 'sweet potato', also: ['sweet potatoes', 'patat'], fdc: 168483, g: 150, group: 'veg', colour: 'orange', effort: 2 }),
  F({ id: 'corn', name: 'sweetcorn', also: ['corn', 'mealies', 'mielies', 'corn on the cob'], fdc: 169999, g: 90, group: 'veg', colour: 'orange', child: { under: 5, prep: 'cut the kernels off the cob' } }),

  // Protein
  F({ id: 'chicken', name: 'chicken', also: ['chicken breast', 'roast chicken', 'chicken thighs', 'chicken pieces'], fdc: 171477, g: 120, group: 'protein', animal: 'meat', iron: 'haem', suggest: false }),
  F({ id: 'beef', name: 'beef mince', also: ['mince', 'beef', 'steak', 'ground beef', 'burger', 'bolognese'], fdc: 171799, g: 100, group: 'protein', animal: 'beef', iron: 'haem', suggest: false }),
  F({ id: 'boerewors', name: 'boerewors', also: ['wors', 'sausage', 'sausages', 'russian'], fdc: 174579, g: 100, group: 'protein', animal: 'pork', iron: 'haem', suggest: false, child: { under: 5, prep: 'cut into thin strips, not rounds' } }),
  F({ id: 'pork', name: 'pork', also: ['pork chops', 'pork loin', 'gammon'], fdc: 168233, g: 100, group: 'protein', animal: 'pork', iron: 'haem', suggest: false }),
  F({ id: 'bacon', name: 'bacon', fdc: 167914, g: 30, group: 'protein', animal: 'pork', fits: ['breakfast', 'savoury'], suggest: false }),
  F({ id: 'biltong', name: 'biltong', also: ['droewors', 'dried beef'], fdc: 170604, g: 30, group: 'protein', animal: 'beef', iron: 'haem', fits: ['snack'], suggest: false, child: { under: 5, avoid: true }, preg: { note: 'Biltong is cured, not cooked - in pregnancy, choose cooked meat instead.' } }),
  F({ id: 'liver', name: 'liver', also: ['chicken livers', 'pate', 'pâté', 'liver pate'], fdc: 168626, g: 85, group: 'protein', animal: 'meat', iron: 'haem', suggest: false, preg: { avoid: true, note: 'Liver and liver pâté are best avoided in pregnancy: they hold a lot of vitamin A.' } }),
  F({ id: 'egg', name: 'eggs', also: ['egg', 'boiled egg', 'scrambled eggs', 'fried egg', 'omelette'], fdc: 173424, g: 100, group: 'protein', animal: 'egg', allergens: ['egg'], fits: ['breakfast', 'savoury'], dense: true, preg: { note: 'Cook eggs until the white and yolk are firm in pregnancy.' } }),
  F({ id: 'fish', name: 'white fish', also: ['hake', 'fish', 'cod', 'kingklip', 'fish fingers'], fdc: 175161, g: 120, group: 'protein', animal: 'fish', allergens: ['fish'], iron: 'haem', cost: 2, effort: 2 }),
  F({ id: 'salmon', name: 'salmon', also: ['trout'], fdc: 175168, g: 100, group: 'protein', animal: 'fish', allergens: ['fish'], iron: 'haem', cost: 3, effort: 2, dense: true, preg: OILY_FISH }),
  F({ id: 'pilchards', name: 'pilchards in tomato sauce', also: ['pilchards', 'sardines'], fdc: 175140, g: 90, group: 'protein', animal: 'fish', allergens: ['fish'], iron: 'haem', dense: true, preg: OILY_FISH, child: { under: 5, prep: 'mash well and check for large bones' } }),
  F({ id: 'tuna', name: 'tinned tuna', also: ['tuna'], fdc: 173709, g: 80, group: 'protein', animal: 'fish', allergens: ['fish'], iron: 'haem', preg: { note: 'In pregnancy, no more than 4 tins of tuna a week.' } }),
  F({ id: 'tofu', name: 'tofu', fdc: 172475, g: 120, group: 'protein', allergens: ['soy'], iron: 'plant', cost: 2, effort: 2 }),

  // Legumes
  F({ id: 'lentils', name: 'lentils', also: ['lentil', 'dhal', 'dal'], fdc: 172421, g: 100, group: 'legume', colour: 'white', iron: 'plant', effort: 2 }),
  F({ id: 'beans', name: 'sugar beans', also: ['beans', 'kidney beans', 'red beans', 'black beans', 'bean stew'], fdc: 173736, g: 120, group: 'legume', colour: 'red', iron: 'plant', effort: 2 }),
  F({ id: 'bakedbeans', name: 'baked beans', fdc: 175182, g: 130, group: 'legume', colour: 'red', iron: 'plant', fits: ['breakfast', 'savoury'] }),
  F({ id: 'chickpeas', name: 'chickpeas', also: ['chickpea'], fdc: 173757, g: 100, group: 'legume', colour: 'white', iron: 'plant' }),
  F({ id: 'hummus', name: 'hummus', also: ['houmous'], fdc: 174289, g: 30, group: 'legume', colour: 'white', iron: 'plant', allergens: ['sesame'], fits: ['savoury', 'snack'], cost: 2 }),

  // Dairy
  F({ id: 'milk', name: 'milk', also: ['full cream milk', 'whole milk'], fdc: 171265, g: 250, group: 'dairy', animal: 'dairy', allergens: ['dairy'], fits: ['breakfast', 'sweet', 'snack'] }),
  F({ id: 'maas', name: 'maas', also: ['amasi', 'buttermilk', 'kefir'], fdc: 170874, g: 250, group: 'dairy', animal: 'dairy', allergens: ['dairy'], fits: ['breakfast', 'savoury', 'snack'] }),
  F({ id: 'yoghurt', name: 'plain yoghurt', also: ['yoghurt', 'yogurt', 'greek yoghurt', 'plain yogurt'], fdc: 171284, g: 170, group: 'dairy', animal: 'dairy', allergens: ['dairy'], fits: ['breakfast', 'sweet', 'snack'], dense: true }),
  F({ id: 'cheese', name: 'cheddar cheese', also: ['cheese', 'cheddar', 'gouda'], fdc: 173414, g: 30, group: 'dairy', animal: 'dairy', allergens: ['dairy'], fits: ['breakfast', 'savoury', 'snack'], dense: true, preg: { note: 'Hard cheeses like cheddar are fine in pregnancy; avoid unpasteurised and mould-ripened soft cheeses.' } }),
  F({ id: 'softcheese', name: 'soft cheese', also: ['brie', 'camembert', 'blue cheese', 'feta'], fdc: 172177, g: 30, group: 'dairy', animal: 'dairy', allergens: ['dairy'], suggest: false, preg: { note: 'In pregnancy, avoid mould-ripened soft cheese (brie, camembert) and unpasteurised cheese unless cooked until steaming hot.' } }),

  // Fats, sweet things, drinks (recognised, rarely suggested)
  F({ id: 'butter', name: 'butter', fdc: 173410, g: 10, group: 'fat', animal: 'dairy', allergens: ['dairy'], fits: ['breakfast', 'savoury'], suggest: false }),
  F({ id: 'margarine', name: 'margarine', also: ['rama', 'spread'], fdc: 171431, g: 10, group: 'fat', fits: ['breakfast', 'savoury'], suggest: false }),
  F({ id: 'oil', name: 'olive oil', also: ['oil', 'sunflower oil', 'cooking oil'], fdc: 171413, g: 10, group: 'fat', suggest: false }),
  F({ id: 'sugar', name: 'sugar', also: ['brown sugar', 'white sugar'], fdc: 169655, g: 8, group: 'sweet', fits: ['breakfast', 'sweet'], suggest: false }),
  F({ id: 'honey', name: 'honey', fdc: 169640, g: 15, group: 'sweet', animal: 'honey', fits: ['breakfast', 'sweet'], suggest: false }),
  F({ id: 'jam', name: 'jam', also: ['syrup', 'golden syrup'], fdc: 169641, g: 20, group: 'sweet', fits: ['breakfast', 'sweet'], suggest: false }),
  F({ id: 'tea', name: 'tea', also: ['black tea', 'cup of tea'], fdc: 173227, g: 250, group: 'drink', fits: ['breakfast', 'savoury', 'snack'], suggest: false }),
  F({ id: 'coffee', name: 'coffee', fdc: 171890, g: 250, group: 'drink', fits: ['breakfast', 'savoury', 'snack'], suggest: false }),
  F({ id: 'juice', name: 'fruit juice', also: ['orange juice', 'juice'], fdc: 169098, g: 200, group: 'drink', fits: ['breakfast', 'snack'], suggest: false }),

  // Nuts and seeds
  F({ id: 'peanutbutter', name: 'peanut butter', fdc: 172470, g: 16, group: 'nutseed', allergens: ['peanuts'], iron: 'plant', fits: ['breakfast', 'sweet', 'snack'], dense: true, child: NUT_BUTTER }),
  F({ id: 'peanuts', name: 'peanuts', fdc: 173806, g: 30, group: 'nutseed', allergens: ['peanuts'], iron: 'plant', fits: ['snack'], dense: true, child: { under: 5, avoid: true } }),
  F({ id: 'almonds', name: 'almonds', also: ['nuts'], fdc: 170567, g: 30, group: 'nutseed', allergens: ['nuts'], fits: ['breakfast', 'snack'], dense: true, cost: 3, child: { under: 5, avoid: true } }),
  F({ id: 'sunflowerseeds', name: 'sunflower seeds', fdc: 170562, g: 15, group: 'nutseed', iron: 'plant', fits: ['breakfast', 'savoury'], dense: true, child: { under: 5, prep: 'grind them and stir them in' } }),
  F({ id: 'pumpkinseeds', name: 'pumpkin seeds', fdc: 170556, g: 15, group: 'nutseed', iron: 'plant', fits: ['breakfast', 'savoury'], dense: true, cost: 2, child: { under: 5, prep: 'grind them and stir them in' } }),
  F({ id: 'chia', name: 'chia seeds', fdc: 170554, g: 12, group: 'nutseed', fits: ['breakfast', 'sweet'], dense: true, cost: 3 }),
  F({ id: 'flax', name: 'ground flaxseed', also: ['flaxseed', 'linseed'], fdc: 169414, g: 10, group: 'nutseed', fits: ['breakfast', 'sweet'], cost: 2 }),

  // Vegetables
  F({ id: 'broccoli', name: 'broccoli', fdc: 169967, g: 80, group: 'veg', colour: 'green', effort: 2 }),
  F({ id: 'spinach', name: 'spinach', also: ['morogo', 'imifino', 'marog', 'swiss chard'], fdc: 168463, g: 90, group: 'veg', colour: 'green', iron: 'plant', effort: 2 }),
  F({ id: 'amaranth', name: 'amaranth leaves', also: ['pigweed', 'amaranth'], fdc: 169202, g: 90, group: 'veg', colour: 'green', iron: 'plant', effort: 2 }),
  F({ id: 'kale', name: 'kale', fdc: 169238, g: 80, group: 'veg', colour: 'green', iron: 'plant', effort: 2, cost: 2 }),
  F({ id: 'peas', name: 'peas', also: ['frozen peas', 'green peas'], fdc: 170017, g: 80, group: 'veg', colour: 'green', child: { under: 5, prep: 'squash them lightly' } }),
  F({ id: 'greenbeans', name: 'green beans', also: ['string beans'], fdc: 169141, g: 80, group: 'veg', colour: 'green', effort: 2 }),
  F({ id: 'cabbage', name: 'cabbage', also: ['coleslaw'], fdc: 169975, g: 80, group: 'veg', colour: 'green' }),
  F({ id: 'cucumber', name: 'cucumber', fdc: 168409, g: 60, group: 'veg', colour: 'green', fits: ['savoury', 'snack'], child: { under: 5, prep: 'cut into sticks, not rounds' } }),
  F({ id: 'lettuce', name: 'lettuce', also: ['salad', 'green salad'], fdc: 169247, g: 50, group: 'veg', colour: 'green' }),
  F({ id: 'carrots', name: 'carrots', also: ['carrot'], fdc: 170394, g: 80, group: 'veg', colour: 'orange', child: CHOKE_HARD }),
  F({ id: 'butternut', name: 'butternut', also: ['butternut squash'], fdc: 169296, g: 100, group: 'veg', colour: 'orange', effort: 2 }),
  F({ id: 'pumpkin', name: 'pumpkin', also: ['pampoen'], fdc: 168449, g: 100, group: 'veg', colour: 'orange', effort: 2 }),
  F({ id: 'tomato', name: 'tomatoes', also: ['tomato', 'cherry tomatoes', 'tomato and onion', 'smoor'], fdc: 170457, g: 80, group: 'veg', colour: 'red', fits: ['savoury', 'breakfast', 'snack'], child: CHOKE_ROUND }),
  F({ id: 'redpepper', name: 'red pepper', also: ['peppers', 'sweet pepper', 'red peppers'], fdc: 170108, g: 80, group: 'veg', colour: 'red', fits: ['savoury', 'snack'], cost: 2 }),
  F({ id: 'beetroot', name: 'beetroot', also: ['beets'], fdc: 169146, g: 80, group: 'veg', colour: 'purple' }),
  F({ id: 'redcabbage', name: 'red cabbage', fdc: 169977, g: 80, group: 'veg', colour: 'purple' }),
  F({ id: 'brinjal', name: 'brinjal', also: ['aubergine', 'eggplant'], fdc: 169229, g: 80, group: 'veg', colour: 'purple', effort: 2, cost: 2 }),
  F({ id: 'cauliflower', name: 'cauliflower', fdc: 169986, g: 80, group: 'veg', colour: 'white', effort: 2 }),
  F({ id: 'mushrooms', name: 'mushrooms', also: ['mushroom'], fdc: 169251, g: 70, group: 'veg', colour: 'white', fits: ['savoury', 'breakfast'], cost: 2 }),
  F({ id: 'onion', name: 'onion', also: ['onions'], fdc: 170000, g: 40, group: 'veg', colour: 'white', suggest: false }),
  F({ id: 'avocado', name: 'avocado', also: ['avo', 'avocados', 'guacamole'], fdc: 171705, g: 70, group: 'fat', colour: 'green', fits: ['breakfast', 'savoury', 'snack'], dense: true, cost: 2 }),

  // Fruit
  F({ id: 'strawberries', name: 'strawberries', also: ['strawberry'], fdc: 167762, g: 80, group: 'fruit', colour: 'red', fits: ['breakfast', 'sweet', 'snack'], cost: 2, child: CHOKE_ROUND }),
  F({ id: 'blueberries', name: 'blueberries', also: ['berries'], fdc: 171711, g: 80, group: 'fruit', colour: 'purple', fits: ['breakfast', 'sweet', 'snack'], cost: 3, child: { under: 5, prep: 'squash or halve them' } }),
  F({ id: 'grapes', name: 'grapes', fdc: 174683, g: 80, group: 'fruit', colour: 'purple', fits: ['sweet', 'snack'], child: CHOKE_ROUND }),
  F({ id: 'banana', name: 'banana', also: ['bananas'], fdc: 173944, g: 100, group: 'fruit', colour: 'orange', fits: ['breakfast', 'sweet', 'snack'] }),
  F({ id: 'apple', name: 'apple', also: ['apples'], fdc: 171688, g: 120, group: 'fruit', colour: 'red', fits: ['breakfast', 'sweet', 'snack'], child: { under: 5, prep: 'grate it, or cut thin slices' } }),
  F({ id: 'pear', name: 'pear', also: ['pears'], fdc: 169118, g: 120, group: 'fruit', colour: 'green', fits: ['breakfast', 'sweet', 'snack'] }),
  F({ id: 'orange', name: 'orange', also: ['oranges', 'naartjie', 'naartjies', 'mandarin', 'clementine'], fdc: 169097, g: 130, group: 'fruit', colour: 'orange', fits: ['breakfast', 'sweet', 'snack'] }),
  F({ id: 'kiwi', name: 'kiwi', also: ['kiwifruit', 'kiwis'], fdc: 168153, g: 75, group: 'fruit', colour: 'green', fits: ['breakfast', 'sweet', 'snack'], cost: 2 }),
  F({ id: 'mango', name: 'mango', also: ['mangoes'], fdc: 169910, g: 100, group: 'fruit', colour: 'orange', fits: ['breakfast', 'sweet', 'snack'], cost: 2 }),
  F({ id: 'papaya', name: 'pawpaw', also: ['papaya', 'pawpaw'], fdc: 169926, g: 100, group: 'fruit', colour: 'orange', fits: ['breakfast', 'sweet', 'snack'] }),
  F({ id: 'pineapple', name: 'pineapple', fdc: 169124, g: 100, group: 'fruit', colour: 'orange', fits: ['sweet', 'snack', 'savoury'] }),
  F({ id: 'watermelon', name: 'watermelon', fdc: 167765, g: 150, group: 'fruit', colour: 'red', fits: ['sweet', 'snack'] }),
];

/** Small, honest swaps: the same role in the meal, a little more to it. */
export const SWAPS = [
  { from: 'bread', to: 'wholegrain', why: 'Same sandwich or toast, with more fibre and minerals.' },
  { from: 'rice', to: 'brownrice', why: 'Brown rice keeps the bran: more fibre and magnesium. Half and half is a fine start.' },
  { from: 'juice', to: 'orange', why: 'The whole fruit keeps its fibre and fills you up more than the juice.' },
  { from: 'sugar', to: 'banana', why: 'Mashed banana sweetens porridge and adds fibre and potassium.' },
  { from: 'chips', to: 'sweetpotato', why: 'Oven-baked sweet potato wedges bring vitamin A and an orange colour.' },
];

export const COLOURS = { red: 'a red', orange: 'an orange or yellow', green: 'a green', purple: 'a blue or purple', white: 'a white or beige' };
