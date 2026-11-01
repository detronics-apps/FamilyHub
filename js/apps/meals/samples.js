// Starter recipes (D-093): one meal each with its versions, plus the fillings,
// sauces, dough and rice they are made with. Added as the family's own items -
// change or remove any of them after. Every ingredient is linked to a food in
// data/foods.json (water is the only exception). Amounts are sensible family
// amounts for 4, a starting point rather than tested recipes.
// Pure - no DOM.

import { normaliseRecipe, setLinked } from './logic.js';

// An ingredient: name, amount, unit ('' for a count), food id, and anything else (each, whole, recipeId, variation).
const i = (name, qty, unit, fdcId, more = {}) => ({ name, qty, unit, ...(fdcId ? { fdcId } : {}), ...more });
const v = (id, name, { leaveOut = [], add = [], steps = [] } = {}) => ({ id, name, leaveOut, add, steps });
const own = (id, name, qty, unit, variation) => ({ name, qty, unit, recipeId: id, ...(variation ? { variation } : {}) });

const F = {
  mince: 2705853, roll: 172796, cheddar: 328637, chicken: 171077, thigh: 2646171, lettuce: 2709789, tomato: 170457, onion: 170000,
  mayo: 2710204, ketchup: 168556, mustard: 172234, pepper: 170931, garlic: 169230, butter: 173410, cream: 2346386, mushroom: 169251,
  olive: 171413, oil: 172336, spaghetti: 2758998, pasta: 169736, tinned: 170501, carrot: 170393, basil: 172232, tuna: 334194,
  flour: 168894, milk: 2705385, egg: 171287, salt: 173468, sugar: 169655, cinnamon: 171320, lemon: 167747, ham: 173864,
  bread: 325871, chuck: 170810, lamb: 174330, kidney: 174285, lentils: 172420, potato: 170026, celery: 169988, peas: 170419,
  beefStock: 172883, chickenStock: 172884, yeast: 175043, mozzarella: 2705722, salami: 2759005, pineapple: 2709263, feta: 173420,
  bacon: 168277, greenPepper: 170427, redPepper: 170108, oregano: 171328, oats: 2708489, peanutButter: 324860, honey: 169640,
  banana: 173944, blueberry: 171711, strawberry: 167762, maize: 168922, rice: 168877, soy: 2707442, turmeric: 172231,
  raisins: 2709212, syrup: 2710273, bakingPowder: 172804, paprika: 171329, springOnion: 170005, tomatoSauce: 170054,
  avocado: 171705, sweetPotato: 2346404, spinach: 168462, broccoli: 170379, greenBeans: 169961, fish: 171955, steak: 168726,
  butternut: 169295, ricotta: 170851, jam: 2710301, nutmeg: 171326,
};

const ID = {
  sauce: 'rec_s_sauce', burgers: 'rec_s_burgers', pasta: 'rec_s_pasta', stew: 'rec_s_stew', pancakes: 'rec_s_pancakes',
  toasties: 'rec_s_toasties', dough: 'rec_s_pizzadough', pizza: 'rec_s_pizza', flapjacks: 'rec_s_flapjacks',
  porridge: 'rec_s_porridge', rice: 'rec_s_rice', friedRice: 'rec_s_friedrice', lasagne: 'rec_s_lasagne', vetkoek: 'rec_s_vetkoek',
  plate: 'rec_s_plate',
  chickenMayo: 'rec_s_chickenmayo', tunaMayo: 'rec_s_tunamayo', cheeseTomato: 'rec_s_cheesetomato',
  hamCheese: 'rec_s_hamcheese', mince: 'rec_s_mince', cinnamonSugar: 'rec_s_cinnamonsugar',
};

const SAUCE = 'Sauce';

export const SAMPLE_RECIPES = [
  { id: ID.sauce, group: 'Sauces', type: 'own', title: SAUCE, servings: 4, yield: { qty: 400, unit: 'ml' }, cookMinutes: 10,
    description: 'A cream sauce to start from. Its versions are the ones burgers, steak and pasta use.',
    ingredients: [i('Butter', 30, 'g', F.butter), i('Onion', 0.5, '', F.onion, { note: 'finely chopped' }), i('Cream', 250, 'ml', F.cream), i('Milk', 125, 'ml', F.milk), i('Salt', 0.5, 'tsp', F.salt)],
    instructions: ['Soften the onion in the butter over a low heat.', 'Add the cream and milk and let it bubble gently until it thickens, about 5 minutes.', 'Season with the salt.'],
    variations: [
      v('pepper', 'Pepper', { add: [i('Black pepper', 2, 'tsp', F.pepper, { note: 'coarsely ground' }), i('Beef stock', 100, 'ml', F.beefStock)], steps: ['Stir in the pepper and stock and simmer 2 more minutes.'] }),
      v('garlic', 'Garlic', { add: [i('Garlic', 3, 'clove', F.garlic, { note: 'crushed' })], steps: ['Add the garlic with the onion.'] }),
      v('mushroom', 'Mushroom', { add: [i('Mushrooms', 250, 'g', F.mushroom, { note: 'sliced' })], steps: ['Fry the mushrooms with the onion until golden before adding the cream.'] }),
      v('cheese', 'Cheese', { leaveOut: ['onion'], add: [i('Cheddar', 120, 'g', F.cheddar, { note: 'grated' })], steps: ['Take it off the heat and stir in the cheese until it melts.'] }),
    ] },

  { id: ID.burgers, group: 'Burgers', title: 'Burgers', servings: 4, prepMinutes: 15, cookMinutes: 12, tags: ['dinner'],
    description: 'Beef burgers with ketchup and mustard. The versions change the patty and the sauce.',
    ingredients: [i('Beef mince', 600, 'g', F.mince), i('Burger rolls', 4, '', F.roll, { each: 50 }), i('Lettuce', 80, 'g', F.lettuce), i('Tomato', 1, '', F.tomato, { note: 'sliced' }),
      i('Onion', 1, '', F.onion, { note: 'sliced' }), i('Ketchup', 4, 'tbsp', F.ketchup), i('Mustard', 2, 'tsp', F.mustard), i('Oil', 1, 'tbsp', F.oil), i('Salt', 1, 'tsp', F.salt), i('Black pepper', 0.5, 'tsp', F.pepper)],
    instructions: ['Season the mince with the salt and pepper and shape into 4 patties.', 'Fry in the oil over a medium-high heat, about 5 minutes a side.', 'Toast the rolls and build: lettuce, patty, tomato, onion, sauce.'],
    variations: [
      v('cheese', 'Cheese burger', { add: [i('Cheddar', 80, 'g', F.cheddar, { note: '4 slices' })], steps: ['Lay the cheese on the patties for the last minute, with a lid on.'] }),
      v('chicken', 'Chicken burger', { leaveOut: ['beef mince', 'ketchup', 'mustard'], add: [i('Chicken breast', 600, 'g', F.chicken, { note: 'flattened' }), own(ID.sauce, `${SAUCE} (garlic)`, 200, 'ml', 'garlic')], steps: ['Cook the chicken through, 6 to 7 minutes a side, and top with the garlic sauce.'] }),
      v('pepper', 'Pepper steak burger', { leaveOut: ['ketchup', 'mustard'], add: [own(ID.sauce, `${SAUCE} (pepper)`, 250, 'ml', 'pepper')], steps: ['Pour the pepper sauce over the patties.'] }),
      v('mushroom', 'Mushroom burger', { leaveOut: ['ketchup', 'mustard'], add: [own(ID.sauce, `${SAUCE} (mushroom)`, 250, 'ml', 'mushroom')], steps: ['Spoon the mushroom sauce over the patties.'] }),
    ] },

  { id: ID.pasta, group: 'Pasta', title: 'Pasta', servings: 4, prepMinutes: 10, cookMinutes: 20, tags: ['dinner'],
    description: 'Spaghetti in a tomato and garlic sauce. The versions make it a bolognese, a creamy chicken, a mac and cheese or a tuna bake.',
    ingredients: [i('Spaghetti', 400, 'g', F.spaghetti), i('Olive oil', 2, 'tbsp', F.olive), i('Onion', 1, '', F.onion, { note: 'chopped' }), i('Garlic', 2, 'clove', F.garlic, { note: 'crushed' }),
      i('Chopped tomatoes', 400, 'g', F.tinned, { note: '1 tin' }), i('Basil', 5, 'g', F.basil), i('Salt', 1, 'tsp', F.salt)],
    instructions: ['Cook the pasta in salted boiling water and drain.', 'Soften the onion and garlic in the oil, add the tomatoes and simmer 10 minutes.', 'Toss the pasta through the sauce and finish with the basil.'],
    variations: [
      v('bolognese', 'Bolognese', { leaveOut: ['basil'], add: [i('Beef mince', 500, 'g', F.mince), i('Carrot', 1, '', F.carrot, { note: 'grated' }), i('Tomato sauce', 200, 'g', F.tomatoSauce)], steps: ['Brown the mince with the onion first, then add the carrot, tomatoes and tomato sauce and simmer 20 minutes.'] }),
      v('chicken', 'Creamy chicken & mushroom', { leaveOut: ['chopped tomatoes', 'basil'], add: [i('Chicken breast', 400, 'g', F.chicken, { note: 'in strips' }), own(ID.sauce, `${SAUCE} (mushroom)`, 400, 'ml', 'mushroom')], steps: ['Fry the chicken through, then stir in the mushroom sauce instead of the tomatoes.'] }),
      v('macaroni', 'Mac & cheese', { leaveOut: ['spaghetti', 'chopped tomatoes', 'basil', 'garlic'], add: [i('Macaroni', 400, 'g', F.pasta), own(ID.sauce, `${SAUCE} (cheese)`, 400, 'ml', 'cheese'), i('Cheddar', 60, 'g', F.cheddar, { note: 'for the top' })], steps: ['Mix the macaroni with the cheese sauce, top with the cheddar and grill until golden.'] }),
      v('tuna', 'Tuna bake', { leaveOut: ['spaghetti', 'basil'], add: [i('Macaroni', 400, 'g', F.pasta), i('Tuna', 340, 'g', F.tuna, { note: '2 tins, drained' }), own(ID.sauce, `${SAUCE} (cheese)`, 400, 'ml', 'cheese')], steps: ['Mix the pasta, tomato sauce, tuna and cheese sauce in a dish and bake at 180 °C for 20 minutes.'] }),
    ] },

  { id: ID.stew, group: 'Stew', title: 'Stew', servings: 4, prepMinutes: 20, cookMinutes: 120, tags: ['dinner'],
    description: 'A slow beef stew with potatoes and carrots. The versions swap the meat or leave it out.',
    ingredients: [i('Beef chuck', 800, 'g', F.chuck, { note: 'cubed' }), i('Flour', 2, 'tbsp', F.flour), i('Oil', 2, 'tbsp', F.oil), i('Onion', 2, '', F.onion, { note: 'chopped' }),
      i('Carrots', 3, '', F.carrot, { note: 'in chunks' }), i('Celery', 2, '', F.celery, { note: 'sticks, sliced' }), i('Potatoes', 4, '', F.potato, { note: 'in chunks' }),
      i('Chopped tomatoes', 400, 'g', F.tinned), i('Beef stock', 750, 'ml', F.beefStock), i('Paprika', 1, 'tsp', F.paprika), i('Salt', 1, 'tsp', F.salt), i('Black pepper', 0.5, 'tsp', F.pepper)],
    instructions: ['Toss the meat in the flour and brown it in the oil in batches.', 'Soften the onion, then return the meat with the paprika, tomatoes and stock.', 'Cover and simmer gently for 1 hour.', 'Add the carrots, celery and potatoes and simmer another hour, until tender. Season.'],
    variations: [
      v('lamb', 'Lamb', { leaveOut: ['beef chuck'], add: [i('Lamb shoulder', 800, 'g', F.lamb, { note: 'cubed' })] }),
      v('chicken', 'Chicken', { leaveOut: ['beef chuck', 'beef stock'], add: [i('Chicken thighs', 800, 'g', F.thigh, { note: 'boneless' }), i('Chicken stock', 750, 'ml', F.chickenStock)], steps: ['Chicken needs only 40 minutes in all - add the vegetables with it.'] }),
      v('beans', 'Bean & lentil', { leaveOut: ['beef chuck', 'flour'], add: [i('Kidney beans', 400, 'g', F.kidney, { note: '1 tin, drained' }), i('Lentils', 200, 'g', F.lentils, { note: 'rinsed' })], steps: ['Add the lentils with the stock and the beans for the last 15 minutes; 1 hour in all is enough.'] }),
    ] },

  { id: ID.pancakes, group: 'Pancakes', title: 'Pancakes', servings: 4, prepMinutes: 10, cookMinutes: 25, tags: ['lunch', 'dinner'],
    description: 'Thin pancakes. Any filling that says it goes with pancakes shows up here as a choice.',
    ingredients: [i('Flour', 250, 'g', F.flour), i('Eggs', 2, '', F.egg, { whole: true }), i('Milk', 500, 'ml', F.milk), i('Oil', 2, 'tbsp', F.oil), i('Salt', 0.5, 'tsp', F.salt)],
    instructions: ['Whisk the flour, eggs, milk and salt into a smooth batter and rest it 10 minutes.', 'Heat a little oil in a pan, pour in a thin layer and cook each side until golden.', 'Fill and roll.'] },

  { id: ID.toasties, group: 'Toasted sandwiches', title: 'Toasted sandwiches', servings: 4, prepMinutes: 5, cookMinutes: 10, tags: ['lunch'],
    description: 'Buttered bread, toasted in a pan or a sandwich maker. Any filling that says it goes with toasted sandwiches shows up here as a choice.',
    ingredients: [i('White bread', 8, 'slice', F.bread, { each: 28 }), i('Butter', 40, 'g', F.butter)],
    instructions: ['Butter the bread on the outside.', 'Fill, close and toast until golden on both sides and hot in the middle.'] },

  { id: ID.chickenMayo, group: 'Fillings', type: 'own', title: 'Chicken mayo filling', servings: 4, yield: { qty: 500, unit: 'g' }, cookMinutes: 15, goesWith: [ID.pancakes, ID.toasties, ID.vetkoek],
    ingredients: [i('Chicken breast', 400, 'g', F.chicken), i('Mayonnaise', 120, 'ml', F.mayo), i('Spring onions', 2, '', F.springOnion, { note: 'sliced' }), i('Salt', 0.5, 'tsp', F.salt), i('Black pepper', 0.25, 'tsp', F.pepper)],
    instructions: ['Poach or fry the chicken through, cool and shred it.', 'Mix with the mayonnaise, spring onions, salt and pepper.'] },
  { id: ID.tunaMayo, group: 'Fillings', type: 'own', title: 'Tuna mayo filling', servings: 4, yield: { qty: 420, unit: 'g' }, prepMinutes: 5, goesWith: [ID.pancakes, ID.toasties, ID.vetkoek],
    ingredients: [i('Tuna', 340, 'g', F.tuna, { note: '2 tins, drained' }), i('Mayonnaise', 90, 'ml', F.mayo), i('Lemon juice', 1, 'tbsp', F.lemon), i('Black pepper', 0.25, 'tsp', F.pepper)],
    instructions: ['Flake the tuna and mix in the mayonnaise, lemon juice and pepper.'] },
  { id: ID.cheeseTomato, group: 'Fillings', type: 'own', title: 'Cheese & tomato filling', servings: 4, yield: { qty: 400, unit: 'g' }, prepMinutes: 5, goesWith: [ID.toasties],
    ingredients: [i('Cheddar', 200, 'g', F.cheddar, { note: 'grated' }), i('Tomatoes', 2, '', F.tomato, { note: 'sliced' })],
    instructions: ['Grate the cheese and slice the tomatoes.'] },
  { id: ID.hamCheese, group: 'Fillings', type: 'own', title: 'Ham & cheese filling', servings: 4, yield: { qty: 350, unit: 'g' }, prepMinutes: 5, goesWith: [ID.toasties, ID.pancakes, ID.vetkoek],
    ingredients: [i('Ham', 200, 'g', F.ham, { note: 'sliced' }), i('Cheddar', 150, 'g', F.cheddar, { note: 'grated' })],
    instructions: ['Layer the ham and cheese.'] },
  { id: ID.mince, group: 'Fillings', type: 'own', title: 'Savoury mince filling', servings: 4, yield: { qty: 650, unit: 'g' }, cookMinutes: 25, goesWith: [ID.pancakes, ID.vetkoek],
    ingredients: [i('Beef mince', 500, 'g', F.mince), i('Onion', 1, '', F.onion, { note: 'chopped' }), i('Tomato sauce', 200, 'g', F.tomatoSauce), i('Oil', 1, 'tbsp', F.oil), i('Salt', 0.5, 'tsp', F.salt), i('Black pepper', 0.25, 'tsp', F.pepper)],
    instructions: ['Soften the onion in the oil, add the mince and brown it.', 'Stir in the tomato sauce and simmer 15 minutes. Season.'] },
  { id: ID.cinnamonSugar, group: 'Fillings', type: 'own', title: 'Cinnamon sugar', servings: 4, yield: { qty: 110, unit: 'g' }, prepMinutes: 2, goesWith: [ID.pancakes, ID.flapjacks, ID.vetkoek],
    ingredients: [i('Sugar', 100, 'g', F.sugar), i('Ground cinnamon', 4, 'tsp', F.cinnamon)],
    instructions: ['Mix the sugar and cinnamon. Sprinkle over, with a squeeze of lemon if you like.'] },

  { id: ID.dough, group: 'Pizza', type: 'own', title: 'Pizza dough', servings: 4, yield: { qty: 820, unit: 'g' }, prepMinutes: 15, tags: [],
    description: 'Makes two large bases. Rises in about an hour.',
    ingredients: [i('Flour', 500, 'g', F.flour), i('Dry yeast', 7, 'g', F.yeast), i('Sugar', 1, 'tsp', F.sugar), i('Salt', 1, 'tsp', F.salt), i('Olive oil', 2, 'tbsp', F.olive), i('Warm water', 300, 'ml', null)],
    instructions: ['Mix the flour, yeast, sugar and salt, then the oil and warm water.', 'Knead 10 minutes until smooth, cover and leave to rise until doubled, about 1 hour.', 'Knock it back and roll out two bases.'] },
  { id: ID.pizza, group: 'Pizza', title: 'Pizza', servings: 4, prepMinutes: 20, cookMinutes: 15, tags: ['dinner'],
    description: 'Home-made pizza on our own dough: tomato and mozzarella, then the toppings of each version.',
    ingredients: [own(ID.dough, 'Pizza dough', 820, 'g'), i('Tomato sauce', 200, 'g', F.tomatoSauce), i('Mozzarella', 250, 'g', F.mozzarella, { note: 'grated' }), i('Dried oregano', 1, 'tsp', F.oregano), i('Olive oil', 1, 'tbsp', F.olive)],
    instructions: ['Heat the oven as hot as it goes, 220 to 250 °C.', 'Spread the bases with the tomato sauce, scatter the oregano and the cheese.', 'Add the toppings and bake 10 to 15 minutes, until the edges are golden. Drizzle with the oil.'],
    variations: [
      v('margherita', 'Margherita', { add: [i('Basil', 10, 'g', F.basil, { note: 'fresh leaves, after baking' })] }),
      v('salami', 'Salami', { add: [i('Salami', 100, 'g', F.salami, { note: 'sliced' })] }),
      v('hawaiian', 'Ham & pineapple', { add: [i('Ham', 150, 'g', F.ham), i('Pineapple', 200, 'g', F.pineapple, { note: 'tinned, drained' })] }),
      v('chicken', 'Chicken & mushroom', { add: [i('Chicken breast', 250, 'g', F.chicken, { note: 'cooked, sliced' }), i('Mushrooms', 150, 'g', F.mushroom, { note: 'sliced' })] }),
      v('veggie', 'Veggie', { add: [i('Green pepper', 1, '', F.greenPepper, { note: 'sliced' }), i('Red pepper', 1, '', F.redPepper, { note: 'sliced' }), i('Onion', 1, '', F.onion, { note: 'thinly sliced' }), i('Mushrooms', 100, 'g', F.mushroom)] }),
      v('baconfeta', 'Bacon & feta', { add: [i('Bacon', 150, 'g', F.bacon, { note: 'chopped' }), i('Feta', 100, 'g', F.feta, { note: 'crumbled' })] }),
    ] },

  { id: ID.flapjacks, group: 'Breakfast', title: 'Flapjacks', servings: 4, prepMinutes: 10, cookMinutes: 15, tags: ['breakfast'],
    description: 'Small thick pancakes. Cinnamon sugar, or any filling that goes with flapjacks, shows up here as a choice.',
    ingredients: [i('Flour', 250, 'g', F.flour), i('Baking powder', 2, 'tsp', F.bakingPowder), i('Sugar', 50, 'g', F.sugar), i('Salt', 0.5, 'tsp', F.salt),
      i('Eggs', 2, '', F.egg, { whole: true }), i('Milk', 250, 'ml', F.milk), i('Butter', 30, 'g', F.butter, { note: 'melted' })],
    instructions: ['Mix the flour, baking powder, sugar and salt.', 'Whisk in the eggs, milk and melted butter until just smooth.', 'Drop spoonfuls into a hot greased pan; turn when bubbles show on top.'],
    variations: [
      v('syrup', 'With syrup', { add: [i('Syrup', 120, 'ml', F.syrup)] }),
      v('banana', 'With banana', { add: [i('Bananas', 2, '', F.banana, { note: 'sliced' })] }),
    ] },

  { id: ID.porridge, group: 'Breakfast', title: 'Porridge', servings: 4, cookMinutes: 10, tags: ['breakfast'],
    description: 'Oats cooked in milk. The versions add peanut butter or fruit, or make it white pap instead.',
    ingredients: [i('Oats', 160, 'g', F.oats), i('Milk', 750, 'ml', F.milk), i('Salt', 1, 'pinch', F.salt)],
    instructions: ['Bring the oats, milk and salt to a simmer, stirring.', 'Cook 4 to 5 minutes until creamy.'],
    variations: [
      v('peanutbutter', 'Peanut butter', { add: [i('Peanut butter', 4, 'tbsp', F.peanutButter)], steps: ['Stir in the peanut butter at the end.'] }),
      v('berries', 'Berries', { add: [i('Blueberries', 150, 'g', F.blueberry), i('Strawberries', 150, 'g', F.strawberry, { note: 'halved' })], steps: ['Top with the berries.'] }),
      v('kids', 'Kids\' (banana, peanut butter & honey)', { add: [i('Bananas', 2, '', F.banana, { note: 'sliced' }), i('Peanut butter', 3, 'tbsp', F.peanutButter), i('Honey', 2, 'tbsp', F.honey)], steps: ['Stir in the peanut butter, top with the banana and drizzle with the honey.'] }),
      v('pap', 'White pap', { leaveOut: ['oats', 'milk'], add: [i('White maize meal', 250, 'g', F.maize), i('Water', 1000, 'ml', null)], steps: ['For pap instead: bring the water and salt to the boil, whisk in the maize meal, cover and cook on low for 20 minutes, stirring now and then. Serve with milk and sugar if you like.'] }),
    ] },

  { id: ID.rice, group: 'Rice', type: 'own', title: 'Cooked rice', servings: 4, yield: { qty: 900, unit: 'g' }, cookMinutes: 20,
    description: 'Plain rice, to serve with anything or to make fried rice from.',
    ingredients: [i('Rice', 300, 'g', F.rice), i('Salt', 1, 'tsp', F.salt), i('Water', 600, 'ml', null)],
    instructions: ['Rinse the rice, then bring it to the boil with the water and salt.', 'Cover and cook on the lowest heat for 15 minutes; leave covered 5 more.'],
    variations: [
      v('yellow', 'Yellow rice', { add: [i('Turmeric', 1, 'tsp', F.turmeric), i('Raisins', 60, 'g', F.raisins), i('Sugar', 1, 'tbsp', F.sugar), i('Butter', 15, 'g', F.butter)], steps: ['Add the turmeric, sugar and butter with the water and stir in the raisins when it is done.'] }),
    ] },
  { id: ID.friedRice, group: 'Rice', title: 'Fried rice', servings: 4, prepMinutes: 10, cookMinutes: 10, tags: ['dinner', 'lunch'],
    description: 'Egg fried rice from our cooked rice - best with yesterday\'s.',
    ingredients: [own(ID.rice, 'Cooked rice', 900, 'g'), i('Eggs', 3, '', F.egg, { whole: true }), i('Oil', 2, 'tbsp', F.oil), i('Soy sauce', 3, 'tbsp', F.soy), i('Spring onions', 3, '', F.springOnion, { note: 'sliced' }), i('Peas', 150, 'g', F.peas)],
    instructions: ['Scramble the eggs in half the oil and set aside.', 'Fry the rice in the rest of the oil on a high heat with the peas, 3 to 4 minutes.', 'Stir in the egg, soy sauce and spring onions.'],
    variations: [
      v('chicken', 'Chicken', { add: [i('Chicken breast', 300, 'g', F.chicken, { note: 'diced' })], steps: ['Fry the chicken through before the rice.'] }),
      v('veg', 'Veg', { add: [i('Carrots', 2, '', F.carrot, { note: 'diced' }), i('Red pepper', 1, '', F.redPepper, { note: 'diced' })], steps: ['Fry the carrot and pepper for 3 minutes before the rice.'] }),
    ] },

  { id: ID.lasagne, group: 'Lasagne', title: 'Lasagne', servings: 6, prepMinutes: 30, cookMinutes: 45, tags: ['dinner'],
    description: 'Layers of pasta, a tomato mince sauce and our cheese sauce. The versions swap the mince for chicken or vegetables.',
    ingredients: [i('Lasagne sheets', 250, 'g', F.pasta), i('Beef mince', 500, 'g', F.mince), i('Onion', 1, '', F.onion, { note: 'chopped' }), i('Garlic', 2, 'clove', F.garlic, { note: 'crushed' }),
      i('Chopped tomatoes', 400, 'g', F.tinned), i('Tomato sauce', 200, 'g', F.tomatoSauce), i('Oil', 1, 'tbsp', F.oil), i('Salt', 1, 'tsp', F.salt),
      own(ID.sauce, `${SAUCE} (cheese)`, 600, 'ml', 'cheese'), i('Cheddar', 100, 'g', F.cheddar, { note: 'grated, for the top' })],
    instructions: ['Soften the onion and garlic in the oil, brown the mince, add the tomatoes and tomato sauce and simmer 15 minutes. Season.', 'Make the cheese sauce.',
      'In a dish, layer sauce, sheets and cheese sauce three times, ending with cheese sauce. Top with the cheddar.', 'Bake at 180 °C for 40 to 45 minutes, until golden and the sheets are soft.'],
    variations: [
      v('chicken', 'Chicken & mushroom', { leaveOut: ['beef mince', 'chopped tomatoes'], add: [i('Chicken breast', 500, 'g', F.chicken, { note: 'diced' }), i('Mushrooms', 250, 'g', F.mushroom, { note: 'sliced' })], steps: ['Fry the chicken and mushrooms instead of the mince.'] }),
      v('veggie', 'Spinach & butternut', { leaveOut: ['beef mince'], add: [i('Butternut', 600, 'g', F.butternut, { note: 'peeled, in small cubes' }), i('Spinach', 200, 'g', F.spinach), i('Ricotta', 250, 'g', F.ricotta), i('Nutmeg', 0.25, 'tsp', F.nutmeg)], steps: ['Roast the butternut at 200 °C for 25 minutes and stir it into the tomato sauce. Wilt the spinach, mix it with the ricotta and nutmeg and spread it on each layer.'] }),
    ] },

  { id: ID.vetkoek, group: 'Vetkoek', title: 'Vetkoek', servings: 4, prepMinutes: 15, cookMinutes: 20, tags: ['lunch', 'dinner'],
    description: 'Fried bread, split open and filled. Every filling that goes with pancakes goes with vetkoek too, and shows here as a choice.',
    ingredients: [i('Flour', 500, 'g', F.flour), i('Dry yeast', 7, 'g', F.yeast), i('Sugar', 1, 'tbsp', F.sugar), i('Salt', 1, 'tsp', F.salt), i('Warm water', 350, 'ml', null),
      i('Oil', 100, 'ml', F.oil, { note: 'what soaks in; fry in a pot of oil about 5 cm deep' })],
    instructions: ['Mix the flour, yeast, sugar and salt, add the warm water and knead to a soft dough.', 'Cover and leave to rise until doubled, about 1 hour.',
      'Shape into 12 balls and fry in hot oil on a medium heat, 4 to 5 minutes a side, until golden and hollow-sounding.', 'Drain, split and fill.'],
    variations: [
      v('syrup', 'With syrup', { add: [i('Syrup', 120, 'ml', F.syrup)] }),
      v('jamcheese', 'Jam & cheese', { add: [i('Jam', 150, 'g', F.jam), i('Cheddar', 150, 'g', F.cheddar, { note: 'grated' })] }),
    ] },

  { id: ID.plate, group: 'Plates', title: 'Plate of food', servings: 4, prepMinutes: 15, cookMinutes: 25, tags: ['lunch', 'dinner'],
    description: 'A balanced plate: a quarter protein, a quarter starch, half vegetables, and something fresh. The versions swap each part.',
    ingredients: [i('Chicken breast', 600, 'g', F.chicken), own(ID.rice, 'Cooked rice', 600, 'g'), i('Carrots', 4, '', F.carrot, { note: 'in sticks' }),
      i('Eggs', 4, '', F.egg, { whole: true }), i('Avocados', 2, '', F.avocado), i('Lemon juice', 1, 'tbsp', F.lemon), i('Oil', 1, 'tbsp', F.oil), i('Paprika', 1, 'tsp', F.paprika), i('Salt', 1, 'tsp', F.salt)],
    instructions: ['Cook the rice.', 'Rub the chicken with the oil, paprika and salt and grill or pan-fry 6 to 7 minutes a side, until cooked through. Slice.',
      'Steam or boil the carrots until just tender, 8 to 10 minutes.', 'Boil the eggs 8 minutes, cool and halve.', 'Slice the avocado and squeeze the lemon over it. Plate everything side by side.'],
    variations: [
      v('steak', 'Steak, sweet potato & green beans', { leaveOut: ['chicken breast', 'cooked rice', 'carrots', 'eggs'], add: [i('Sirloin steak', 600, 'g', F.steak), i('Sweet potatoes', 800, 'g', F.sweetPotato, { note: 'in wedges' }), i('Green beans', 300, 'g', F.greenBeans)], steps: ['Roast the sweet potato wedges at 200 °C for 30 minutes. Fry the steak 3 to 4 minutes a side and rest it 5 minutes. Steam the beans 5 minutes.'] }),
      v('fish', 'Fish, potatoes & broccoli', { leaveOut: ['chicken breast', 'cooked rice', 'carrots', 'eggs'], add: [i('White fish', 600, 'g', F.fish, { note: 'hake or cod fillets' }), i('Potatoes', 800, 'g', F.potato, { note: 'baby, or in chunks' }), i('Broccoli', 300, 'g', F.broccoli)], steps: ['Boil the potatoes until tender. Pan-fry or bake the fish 8 to 10 minutes. Steam the broccoli 4 minutes.'] }),
      v('yellowrice', 'Chicken, yellow rice & butternut', { leaveOut: ['cooked rice', 'carrots', 'eggs'], add: [own(ID.rice, 'Cooked rice (yellow)', 600, 'g', 'yellow'), i('Butternut', 600, 'g', F.butternut, { note: 'in cubes' })], steps: ['Roast the butternut at 200 °C for 25 minutes with a little oil and salt.'] }),
      v('mince', 'Mince, pap & spinach', { leaveOut: ['chicken breast', 'cooked rice', 'eggs', 'avocados', 'lemon juice'], add: [i('Beef mince', 500, 'g', F.mince), i('Tomato sauce', 200, 'g', F.tomatoSauce), i('White maize meal', 250, 'g', F.maize), i('Water', 1000, 'ml', null), i('Spinach', 300, 'g', F.spinach)], steps: ['Brown the mince, add the tomato sauce and simmer 15 minutes. For the pap, boil the water, whisk in the maize meal, cover and cook on low 20 minutes. Wilt the spinach.'] }),
    ] },
];

/** The picker's groups, in order. */
export const SAMPLE_GROUPS = [...new Set(SAMPLE_RECIPES.map((r) => r.group))];

/**
 * The records to save for the ticked samples, with what each needs (a version of the sauce,
 * the dough, the rice) brought along, and the fillings' choices put on the meals they go with.
 * `have`: ids already in the cookbook - left alone, never overwritten.
 */
export function samplesToAdd(ids, have = new Set()) {
  const byId = new Map(SAMPLE_RECIPES.map((r) => [r.id, r]));
  const want = new Set();
  const take = (id) => {
    if (want.has(id) || !byId.has(id)) return;
    want.add(id);
    const r = byId.get(id);
    for (const line of [...r.ingredients, ...(r.variations ?? []).flatMap((x) => x.add)]) if (line.recipeId) take(line.recipeId);
  };
  ids.forEach(take);
  const out = new Map([...want].filter((id) => !have.has(id)).map((id) => {
    const { group, ...rest } = byId.get(id);
    return [id, normaliseRecipe({ ...rest, ...(rest.goesWith ? { goesWith: rest.goesWith.filter((m) => want.has(m) || have.has(m)) } : {}) })];
  }));
  // A filling being added shows on each meal being added with it. (A meal already in the cookbook
  // is not returned here; the Samples screen puts the filling on it.)
  for (const item of out.values()) {
    for (const mealId of item.goesWith) if (out.has(mealId)) out.set(mealId, setLinked(out.get(mealId), item, true));
  }
  return [...out.values()];
}
