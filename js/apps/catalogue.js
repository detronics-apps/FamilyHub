// The starter pack: mini-apps that ship with Family Hub. Each is a manifest
// (validated exactly like a third-party one) plus a loader, so its code is only
// fetched when it is first opened. Adding a starter app is one entry here and a
// folder under js/apps/ - nothing else in the core names it.

import { validateManifest } from '../miniapps.js';

const RAW = [
  {
    manifest: {
      fhManifest: 1, id: 'chores', section: 'chores', name: 'Chores', version: '1.1.1',
      description: 'Recurring household work: plan it, then find something that fits right now.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'do', title: 'Do something now' }, { id: 'rooms', title: 'Rooms' },
        { id: 'plan', title: 'Plan' }, { id: 'progress', title: 'Progress' },
      ],
      modes: [
        { mode: 'do', screen: 'do', label: 'Find a chore that fits right now', hint: 'By the time you have and where you are' },
        { mode: 'plan', screen: 'plan', label: 'Plan the chores', hint: 'Who does what, and how often' },
        { mode: 'note', screen: 'progress', label: 'See how the chores are going' },
      ],
      data: { collections: [] },
      permissions: ['household:chores', 'people:read', 'rooms:read', 'notify', 'media:audio', 'timer'],
    },
    load: () => import('./chores/app.js'),
    importer: () => import('./chores/importer.js').then((m) => m.IMPORTER),
  },
  {
    manifest: {
      fhManifest: 1, id: 'tasks', section: 'tasks', name: 'Tasks', version: '1.0.1',
      description: 'One-off jobs, repairs, errands and bigger projects.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'open', title: 'To do' }, { id: 'mine', title: 'Mine' }, { id: 'projects', title: 'Projects' },
        { id: 'finished', title: 'Finished' }, { id: 'item', title: 'Task', nav: false }, { id: 'new', title: 'Add a task', nav: false },
      ],
      modes: [
        { mode: 'do', screen: 'mine', label: 'My tasks - knock some out' },
        { mode: 'plan', screen: 'projects', label: 'Plan the bigger projects' },
        { mode: 'note', screen: 'new', label: 'Note a job before you forget it' },
      ],
      data: { collections: [{ name: 'tasks', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'data:tickets:read', 'data:decisions:read'],
    },
    load: () => import('./tasks/app.js'),
    importer: () => import('./tasks/logic.js').then((m) => m.IMPORTER),
  },
  {
    manifest: {
      fhManifest: 1, id: 'tickets', section: 'tickets', name: 'Tickets', version: '1.0.0',
      description: 'Capture a concern, idea or appreciation in seconds - talk about it at the family meeting.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'capture', title: 'Log a ticket' }, { id: 'all', title: 'All tickets' }, { id: 'meeting', title: 'Family meeting' },
        { id: 'item', title: 'Ticket', nav: false },
      ],
      modes: [
        { mode: 'note', screen: 'capture', label: 'Note a concern, idea or thank-you' },
        { mode: 'do', screen: 'meeting', label: 'Hold the family meeting' },
        { mode: 'plan', screen: 'all', label: 'Look through every ticket' },
      ],
      data: { collections: [{ name: 'tickets', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'data:tasks:read', 'data:decisions:read'],
    },
    load: () => import('./tickets/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'principles', section: 'principles', name: 'Principles', version: '1.0.0',
      description: 'Family values and practical agreements, with the reasons behind them.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'list', title: 'Principles' }, { id: 'item', title: 'Principle', nav: false }, { id: 'new', title: 'Add a principle', nav: false }],
      modes: [
        { mode: 'note', screen: 'list', label: 'Look up a family principle' },
        { mode: 'plan', screen: 'new', label: 'Write down a new principle' },
      ],
      data: { collections: [{ name: 'principles', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./principles/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'decisions', section: 'us', name: 'Decisions', version: '1.4.0',
      description: 'Agreements and experiments: try something, look back, adapt.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'list', title: 'Decisions' }, { id: 'item', title: 'Decision', nav: false }, { id: 'new', title: 'New decision', nav: false }],
      modes: [
        { mode: 'note', screen: 'list', label: 'Check what we agreed' },
        { mode: 'plan', screen: 'new', label: 'Think through a decision or experiment' },
      ],
      data: { collections: [{ name: 'decisions', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'data:tickets:read', 'data:tasks:read', 'data:parenting:read', 'people:ages', 'household:creators'],
    },
    load: () => import('./decisions/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'dates', section: 'us', name: 'Dates', version: '1.0.0',
      description: 'Time for the two of you: date ideas that fit tonight and your own rule on who looks after the children, planned for a day and scored by you both.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'pick', title: 'Dates' }, { id: 'ideas', title: 'Date ideas' }, { id: 'date', title: 'Date', nav: false }, { id: 'edit', title: 'Edit a date', nav: false }, { id: 'new', title: 'A date idea', nav: false }],
      modes: [
        { mode: 'do', screen: 'pick', label: 'Find a date for tonight' },
        { mode: 'plan', screen: 'ideas', label: 'Plan a date' },
      ],
      data: { collections: [{ name: 'dates', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'people:ages', 'notify', 'data:decisions:read', 'household:creators'],
    },
    load: () => import('./dates/app.js'),
    tile: true,   // the next planned date under the tile
  },
  {
    manifest: {
      fhManifest: 1, id: 'goals', section: 'us', name: 'Goals', version: '1.0.0',
      description: 'Dreams and goals the two of you share: why each matters, by when, the next small step - linked to its Finance goal or trip.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'list', title: 'Goals' }, { id: 'goal', title: 'Goal', nav: false }, { id: 'edit', title: 'Edit a goal', nav: false }, { id: 'new', title: 'A goal or dream', nav: false }],
      modes: [
        { mode: 'plan', screen: 'list', label: 'Look at the goals we share' },
        { mode: 'note', screen: 'new', label: 'Add a dream or goal' },
      ],
      data: { collections: [{ name: 'goals', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'data:finance:read', 'data:holidays:read'],
    },
    load: () => import('./goals/app.js'),
    tile: true,
  },
  {
    manifest: {
      fhManifest: 1, id: 'meals', section: 'meals', name: 'Cookbook', version: '1.7.0',
      description: 'Your family’s meals, recipes and own ingredients, and how much each person might eat.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [
        { id: 'recipes', title: 'Cookbook' }, { id: 'item', title: 'Item', nav: false }, { id: 'new', title: 'Add an item', nav: false },
        { id: 'import', title: 'Import a recipe', nav: false },
      ],
      modes: [
        { mode: 'note', screen: 'new', label: 'Write down a meal to try', hint: 'Saw something good? Save it before you forget' },
        { mode: 'plan', screen: 'recipes', label: 'Look through the Cookbook' },
      ],
      // Plans and the shopping list were kept here before This Week and Shopping became
      // mini-apps of their own; those apps still read the old files, which stay untouched.
      data: { collections: [{ name: 'recipes', schema: 1 }, { name: 'sizes', schema: 1 }] },
      permissions: ['data:own', 'notify', 'food:read', 'people:food', 'household:creators'],
    },
    load: () => import('./meals/app.js'),
    importer: () => import('./meals/logic.js').then((m) => m.IMPORTER),
  },
  {
    manifest: {
      fhManifest: 1, id: 'mealplan', section: 'meals', name: 'Meal Planner', version: '1.3.0',
      description: 'Choose the meals, then drag them onto days - a week or a month ahead - and send what they need to the shopping list.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [
        { id: 'plan', title: 'Planned meals' }, { id: 'assign', title: 'Assign' }, { id: 'week', title: 'Calendar' },
        { id: 'add', title: 'Plan a meal', nav: false }, { id: 'choose', title: 'Choose a meal', nav: false },
        { id: 'slot', title: 'Planned meal', nav: false }, { id: 'mix', title: 'Suggest meals', nav: false }, { id: 'review', title: 'How the week looks', nav: false },
        { id: 'modify', title: 'Change a planned meal', nav: false }, { id: 'today', title: 'Cook today' },
        { id: 'sent', title: 'Sent to Shopping', nav: false },
      ],
      modes: [
        { mode: 'plan', screen: 'plan', label: 'Plan the next meals', hint: 'Choose the meals, then drag them onto days' },
        { mode: 'note', screen: 'week', label: 'See what is planned', hint: 'The calendar, a week or a month at a time' },
        { mode: 'do', screen: 'today', label: 'Cook today’s meals', hint: 'Ingredients and method, one meal at a time' },
      ],
      data: { collections: [{ name: 'plans', schema: 1 }] },
      permissions: ['data:own', 'notify', 'data:meals:read', 'food:read', 'people:food'],
    },
    load: () => import('./mealplan/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'shopping', section: 'shopping', name: 'Shopping', version: '1.1.1',
      description: 'One family shopping list. Find what you buy by kind - food, cleaning, hygiene - add anything new, and tick it off at the shop.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'list', title: 'Shopping list' }, { id: 'shop', title: 'At the shop' }, { id: 'add', title: 'Add to the list', nav: false }],
      modes: [
        { mode: 'note', screen: 'list', label: 'Add what we need', hint: 'As you notice it, during the week' },
        { mode: 'do', screen: 'shop', label: 'At the shop - tick things off' },
      ],
      data: { collections: [{ name: 'list', schema: 1 }] },
      permissions: ['data:own', 'notify', 'data:meals:read'],
    },
    load: () => import('./shopping/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'calories', section: 'meals', name: 'Calorie Checker', version: '1.2.0',
      description: 'What is in a food, in the amount you actually eat. Build up an item for the family or one person, and save it to the Cookbook.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'check', title: 'Check a food' }],
      modes: [
        { mode: 'note', screen: 'check', label: 'Check what is in a food', hint: 'Calories, protein, fibre - or explore foods you may not know' },
      ],
      data: { collections: [] },
      permissions: ['food:read', 'people:food'],
    },
    load: () => import('./calories/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'assistant', section: 'meals', name: 'Meal Assistant', version: '1.2.0',
      description: 'Type what you are eating and get one or two easy ways to make it a little better for the people at the table.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'meal', title: 'Improve a meal' }, { id: 'about', title: 'How it decides' }],
      modes: [
        { mode: 'note', screen: 'meal', label: 'One easy way to make a meal better' },
      ],
      data: { collections: [] },
      permissions: ['data:own', 'food:read', 'people:food', 'data:meals:read', 'data:mealplan:read'],
    },
    load: () => import('./assistant/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'holidays', section: 'holidays', name: 'Holidays', version: '1.0.1',
      description: 'Big trips: ideas, travel, itineraries, packing lists and budgets.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'list', title: 'Holidays' }, { id: 'item', title: 'Trip', nav: false }, { id: 'new', title: 'Add a trip', nav: false }],
      modes: [
        { mode: 'plan', screen: 'list', label: 'Plan a big trip', hint: 'Travel, itinerary, packing and budget' },
      ],
      data: { collections: [{ name: 'trips', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify'],
    },
    load: () => import('./holidays/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'places', section: 'holidays', name: 'Places to go', version: '1.0.0',
      description: 'Local outings - where you would like to go, or have been, and what each place is good for: great for kids, pet friendly, free.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [{ id: 'list', title: 'Places to go' }, { id: 'item', title: 'Place', nav: false }, { id: 'new', title: 'Add a place', nav: false }],
      modes: [
        { mode: 'note', screen: 'list', label: 'Find a place for a free day', hint: 'Great for kids, pet friendly, free...' },
        { mode: 'note', screen: 'new', label: 'Save a place someone mentioned' },
      ],
      data: { collections: [{ name: 'places', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./places/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'finance', section: 'finance', name: 'Budget and goals', version: '1.2.0',
      description: 'Monthly budgets, and savings and debt goals with the assumptions in plain view.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'month', title: 'Budget' }, { id: 'goals', title: 'Goals' }, { id: 'goal', title: 'Goal', nav: false }, { id: 'new-goal', title: 'Add a goal', nav: false }],
      modes: [
        { mode: 'plan', screen: 'month', label: 'Plan this month’s budget' },
        { mode: 'note', screen: 'goals', label: 'Check our savings and debt goals' },
      ],
      data: { collections: [{ name: 'months', schema: 1 }, { name: 'goals', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'household:creators'],
    },
    load: () => import('./finance/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'calculators', section: 'finance', name: 'Money calculators', version: '1.0.0',
      description: 'Quick answers to one money question at a time - simple, advanced, or every step explained.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'tools', title: 'Calculators' }, { id: 'compound', title: 'Compound interest' }, { id: 'compare', title: 'Side by side', nav: false }],
      modes: [{ mode: 'plan', screen: 'compound', label: 'See what savings could grow to' }],
      data: { collections: [{ name: 'saved', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./calculators/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'cars', section: 'finance', name: 'Cars', version: '1.1.0',
      description: 'What a car really costs to own: instalments, interest, fees, running costs, and what it is worth - and still owed - when you sell.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'cost', title: 'True cost' }, { id: 'compare', title: 'Side by side', nav: false }],
      modes: [{ mode: 'plan', screen: 'cost', label: 'Work out what a car really costs' }],
      data: { collections: [{ name: 'saved', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./cars/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'homes', section: 'finance', name: 'Homes', version: '2.0.0',
      description: 'Each home on one page - buying, owning or renting - with every cost, your bond’s history and what-ifs; then compare any of them.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'homes', title: 'Our homes' }, { id: 'home', title: 'A home' }, { id: 'compare', title: 'Compare' }],
      modes: [
        { mode: 'plan', screen: 'home', label: 'Work out what a home really costs' },
        { mode: 'plan', screen: 'compare', label: 'Compare homes - buy, rent or keep ours' },
      ],
      data: { collections: [{ name: 'saved', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./homes/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'jobs', section: 'finance', name: 'Job offers', version: '1.0.0',
      description: 'One job against another on what reaches the household: take-home, increases, benefits, moving costs and how long a move takes to pay back.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'offer', title: 'A job' }, { id: 'compare', title: 'Which job', nav: false }],
      modes: [{ mode: 'plan', screen: 'offer', label: 'Compare a job offer' }],
      data: { collections: [{ name: 'saved', schema: 1 }] },
      permissions: ['data:own', 'notify'],
    },
    load: () => import('./jobs/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'children', section: 'finance', name: 'Children’s future', version: '1.0.0',
      description: 'School, studies and starting out for each child, from their birthdays - and every child together, year by year.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'family', title: 'Children’s future' }, { id: 'child', title: 'One child', nav: false }],
      modes: [{ mode: 'plan', screen: 'family', label: 'Plan for the children’s big costs' }],
      data: { collections: [{ name: 'plans', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'people:ages', 'notify'],
    },
    load: () => import('./children/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'moneyplan', section: 'finance', name: 'Money plan', version: '1.0.0',
      description: 'Every goal on one timeline - trips, cars, homes, the children - with what to put aside each month and where it does not fit.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'plan', title: 'Money plan' }],
      modes: [{ mode: 'plan', screen: 'plan', label: 'Check that the plan still fits' }],
      data: { collections: [{ name: 'plan', schema: 1 }] },
      permissions: ['data:own', 'notify', 'people:read', 'people:ages', 'data:finance:read', 'data:holidays:read', 'data:cars:read', 'data:homes:read', 'data:children:read', 'data:jobs:read'],
    },
    load: () => import('./moneyplan/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'exercise', section: 'exercise', name: 'Exercise', version: '1.3.0',
      description: 'Your own exercises and workouts made from them - pick one that fits the time you have, work through a round whenever; log activity, keep flexible weekly plans, and see what the family did together.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [{ id: 'week', title: 'This week' }, { id: 'log', title: 'Log activity' }, { id: 'exercises', title: 'Exercises' }, { id: 'workouts', title: 'Workouts' }, { id: 'plans', title: 'Plans and goals' },
        { id: 'exercise', title: 'Exercise', nav: false }, { id: 'exercise-new', title: 'A new exercise', nav: false }, { id: 'exercise-edit', title: 'Edit an exercise', nav: false },
        { id: 'workout', title: 'Workout', nav: false }, { id: 'workout-new', title: 'A new workout', nav: false }, { id: 'workout-edit', title: 'Edit a workout', nav: false }],
      modes: [
        { mode: 'note', screen: 'log', label: 'Log some activity' },
        { mode: 'note', screen: 'week', label: 'See this week' },
        { mode: 'plan', screen: 'plans', label: 'Plan how we move each week' },
        { mode: 'plan', screen: 'workouts', label: 'Plan workouts from our own exercises' },
      ],
      data: { collections: [{ name: 'activities', schema: 1 }, { name: 'plans', schema: 1 }, { name: 'exercises', schema: 1 }, { name: 'workouts', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'household:creators', 'people:weights'],
    },
    load: () => import('./exercise/app.js'),
  },
  {
    manifest: {
      fhManifest: 1, id: 'medical', section: 'medical', name: 'Medical', version: '1.1.0',
      description: 'Every account, invoice and quote from a doctor or provider, for the whole family: paid or owed, claims to medical aid and gap cover, follow-ups, the SARS tax year, and where the proof is.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [
        { id: 'outstanding', title: 'Outstanding' }, { id: 'followup', title: 'Follow-up' }, { id: 'aid', title: 'Medical aid' },
        { id: 'gap', title: 'Gap cover' }, { id: 'all', title: 'All' }, { id: 'year', title: 'Tax year' }, { id: 'notes', title: 'Notes' },
        { id: 'item', title: 'Account', nav: false }, { id: 'new', title: 'Add an account', nav: false },
      ],
      modes: [
        { mode: 'note', screen: 'new', label: 'Log an account, invoice or quote', hint: 'From any doctor or provider' },
        { mode: 'do', screen: 'outstanding', label: 'Pay, claim or follow up' },
        { mode: 'plan', screen: 'year', label: 'Check the tax year is all logged' },
        { mode: 'note', screen: 'notes', label: 'Allergies, medicines and each person’s doctor' },
      ],
      data: { collections: [{ name: 'accounts', schema: 1 }, { name: 'notes', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'people:food'],
    },
    load: () => import('./medical/app.js'),
    tile: true,   // its module is loaded for Home, to say what is due under the tile
  },
  {
    manifest: {
      fhManifest: 1, id: 'parenting', section: 'parenting', name: 'Parenting', version: '1.7.0',
      description: 'Parenting topics as questions to decide together while calm - each of you writes your own reasons, and what you agree is kept in Decisions for the ages it applies to.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.3.0' },
      screens: [
        { id: 'home', title: 'Parenting' }, { id: 'agree', title: 'Agreements' }, { id: 'ideas', title: 'Ideas' }, { id: 'play', title: 'Play now' },
        { id: 'section', title: 'Section', nav: false }, { id: 'topic', title: 'Topic', nav: false },
        { id: 'edit', title: 'Edit a topic', nav: false }, { id: 'new', title: 'Our own topic', nav: false },
        { id: 'idea', title: 'Activity', nav: false }, { id: 'idea-edit', title: 'Edit an activity', nav: false }, { id: 'idea-new', title: 'A new activity', nav: false },
        { id: 'screen', title: 'Screen time' }, { id: 'screen-log', title: 'Log screen time', nav: false }, { id: 'shows', title: 'Shows', nav: false },
        { id: 'show', title: 'Show', nav: false }, { id: 'show-edit', title: 'Edit a show', nav: false }, { id: 'show-new', title: 'Add a show', nav: false },
        { id: 'numbers', title: 'Who to call', nav: false },
        { id: 'planner', title: 'Planner' }, { id: 'plan-new', title: 'Something on', nav: false }, { id: 'plan-edit', title: 'Change it', nav: false },
        { id: 'routines', title: 'Routines' }, { id: 'routine', title: 'Routine', nav: false }, { id: 'routine-edit', title: 'Change a routine', nav: false }, { id: 'routine-new', title: 'A routine of our own', nav: false },
        { id: 'track', title: 'Track' }, { id: 'tracker', title: 'Tracker', nav: false }, { id: 'scenario-new', title: 'Our own tracker', nav: false }, { id: 'scenario-edit', title: 'Edit a tracker', nav: false },
      ],
      modes: [
        { mode: 'plan', screen: 'agree', label: 'Talk through a parenting decision together' },
        { mode: 'plan', screen: 'ideas', label: 'Plan activities and games for the children' },
        { mode: 'do', screen: 'play', label: 'Find something to do with the children right now' },
        { mode: 'note', screen: 'new', label: 'Add a topic of our own' },
        { mode: 'note', screen: 'screen-log', label: 'Log screen time' },
        { mode: 'plan', screen: 'shows', label: 'Choose a show by what matters to us' },
        { mode: 'plan', screen: 'planner', label: 'See what is on this week' },
        { mode: 'do', screen: 'routines', label: 'Get the children ready - leaving the house, bedtime' },
        { mode: 'note', screen: 'track', label: 'Track a temperature, sleep, wees and poos - for the doctor' },
      ],
      data: { collections: [{ name: 'topics', schema: 1 }, { name: 'sections', schema: 1 }, { name: 'activities', schema: 1 }, { name: 'screenlog', schema: 1 }, { name: 'shows', schema: 1 }, { name: 'screenset', schema: 1 }, { name: 'scenarios', schema: 1 }, { name: 'trackers', schema: 1 }, { name: 'settings', schema: 1 }, { name: 'routines', schema: 1 }, { name: 'events', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'people:ages', 'notify', 'data:decisions:read', 'household:creators', 'data:holidays:read', 'data:dates:read', 'data:exercise:read'],
    },
    load: () => import('./parenting/app.js'),
    tile: true,   // its module is loaded for Home, to say what is worth agreeing now
  },
  {
    manifest: {
      fhManifest: 1, id: 'faith', section: 'faith', name: 'Faith', version: '1.2.0',
      description: 'Bible reading plans, a journal with the questions you are working through, and a guide to who wrote each book, when, to whom and why.',
      author: 'Family Hub', requires: { api: 1, core: '>=0.2.0' },
      screens: [
        { id: 'reading', title: 'Reading' }, { id: 'journal', title: 'Journal' }, { id: 'write', title: 'Write an entry' }, { id: 'questions', title: 'Questions' },
        { id: 'guide', title: 'Bible guide' }, { id: 'entry', title: 'Entry', nav: false }, { id: 'plan', title: 'Reading plan', nav: false },
        { id: 'topics', title: 'Topics', nav: false },
      ],
      modes: [
        { mode: 'note', screen: 'write', label: 'Write down a message or a question', hint: 'Something you heard or saw, to come back to' },
        { mode: 'note', screen: 'guide', label: 'Who wrote a book, and where to start on a question' },
        { mode: 'do', screen: 'reading', label: 'A study session - today’s reading' },
        { mode: 'plan', screen: 'questions', label: 'Come back to your questions' },
        { mode: 'plan', screen: 'journal', label: 'Look back through the journal' },
      ],
      data: { collections: [{ name: 'plans', schema: 1 }, { name: 'notes', schema: 1 }, { name: 'books', schema: 1 }, { name: 'topics', schema: 1 }] },
      permissions: ['data:own', 'people:read', 'notify', 'household:creators'],
    },
    load: () => import('./faith/app.js'),
  },
];

function check({ manifest, load, importer = null, tile = false }) {
  const r = validateManifest(manifest, { source: 'starter' });
  if (!r.ok) throw new Error(`Starter app ${manifest.id} has an invalid manifest: ${r.errors.join(' ')}`);
  return { manifest: r.manifest, load, importer, tile };
}

export const STARTERS = RAW.map(check);
export const starterManifests = () => STARTERS.map((s) => s.manifest);
export const starter = (id) => STARTERS.find((s) => s.manifest.id === id) ?? null;

/** On the roadmap, not built. Shown in the library so nobody mistakes them for working apps. */
// Nothing announced for later: the Planner is in Parenting (D-104), and medical records will not come -
// Medical keeps accounts and each person's notes (D-103).
export const COMING_LATER = [];
