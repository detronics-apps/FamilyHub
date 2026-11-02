// The questions each topic asks you to decide (D-106) - while you are calm, together. The app
// gives the options, what to think about and what is known; the answer and the reason are yours.
// Each question becomes its own decision. Pure data - no DOM.
// option: [name, for, against]  ·  think: things to weigh before deciding

const q = (id, ask, options, think = [], change = '') => ({ id, ask, options: options.map(([name, pro = '', con = '']) => ({ name, pro, con })), think, change });

export const QUESTIONS = {
  honey: [
    q('until', 'Until what age do we keep honey - and anything made with it - away from the baby?', [
      ['Until 12 months', 'What health bodies advise; the gut copes after that', ''],
      ['Until later, e.g. 2 years', 'Extra margin; less added sugar too', 'Not needed for botulism after 12 months'],
    ], ['Baked or cooked honey is not reliably safe either.', 'Honey on a dummy is an old habit some grandparents still have.', 'Breakfast cereals and rusks can contain honey - read labels.'],
    'A doctor’s advice for this child.'),
    q('tell', 'How do we make sure everyone who feeds the baby knows?', [
      ['We tell them in person', 'Room for questions', 'Easy to forget'],
      ['A short note to send or put on the fridge', 'Nothing lost', 'Can feel formal'],
      ['Both', 'Clear and kind', ''],
    ], ['Who feeds the baby besides us?']),
  ],
  water: [
    q('before', 'Before solids, do we give the baby water at all?', [
      ['Milk only', 'All the fluid a breastfed baby needs; no risk of too much water', 'More feeds on hot days'],
      ['A little cooled boiled water on hot days (formula-fed)', 'Extra fluid in the heat', 'Small amounts only; never instead of a feed'],
    ], ['Too much plain water can lower a baby’s blood sodium (hyponatraemia).', 'Formula made with extra water does the same - always exactly to the tin.'], 'Illness with vomiting or diarrhoea - then we ask the clinic.'),
    q('withmeals', 'From when, how and how much water with meals?', [
      ['Sips from a cup from about 6 months', 'Learning to drink from a cup', 'Milk stays the main drink to 12 months'],
      ['From when solids start, whenever that is', 'Fits our own pace', ''],
    ], ['Open or free-flow cups are easier on teeth than bottles.']),
    q('formula', 'Who makes up formula, and how do we make sure it is always exactly right?', [
      ['One of us always', 'One person, one habit', 'Not always possible'],
      ['Both, with the tin’s steps on the fridge', 'Shared and checked', ''],
    ], []),
  ],
  feeding: [
    q('how', 'Breastfeeding, bottles, or both?', [
      ['Breastfeeding', 'The living parts of milk; nothing to prepare', 'Only mum can feed; pain, mastitis, broken sleep'],
      ['Bottles', 'Anyone can feed; intake can be seen', 'Preparation, sterilising, cost'],
      ['Both', 'Shared feeds while keeping breast milk', 'Supply can drop if breastfeeds drop'],
    ], ['Mum’s health, medicines and recovery.', 'Return to work.', 'How the other parent takes night feeds either way.'], 'Supply, latch, the baby’s weight gain, mum’s wellbeing.'),
    q('whatin', 'If bottles: breast milk, formula, or both?', [
      ['Expressed breast milk', 'Most of the nutrition and immune parts', 'Pumping time, storage'],
      ['Formula', 'Consistent and measurable', 'Lacks the living parts of human milk; cost'],
      ['Both', 'Flexible', 'Two things to manage'],
    ], ['Freezing and heating change some parts of breast milk.']),
    q('bottle', 'Glass, plastic or silicone bottles?', [
      ['Glass', 'No plastic in contact with warm milk', 'Heavy; can break and hurt; slippery'],
      ['Plastic (BPA-free)', 'Light, cheap, unbreakable', 'Heating can release microplastics - the effect on babies is still being studied'],
      ['Silicone', 'Light and soft', 'Can hold smells; cost'],
      ['Glass now, something else when they hold it themselves', 'Plastic-free early on', 'Two sets to buy'],
    ], ['Microplastics: plastic bottles shed more when heated or sterilised hot - evidence of harm is still being studied.', 'Glass is heavy for a baby to hold and can break.', 'Teats are silicone either way.'], 'New evidence about microplastics; the baby holding the bottle.'),
    q('sterilise', 'How do we sterilise, and until what age?', [
      ['Electric steam steriliser', 'Quick, consistent', 'Usually plastic inside'],
      ['Microwave steam steriliser', 'Cheap, quick', 'Plastic, heated'],
      ['Boiling in a pot', 'No extra equipment, no plastic', 'Takes watching'],
      ['A glass or steel steriliser with no plastic', 'Plastic-free', 'Cost; fewer to choose from'],
    ], ['Most guidance is to sterilise feeding equipment until about 12 months.']),
    q('until', 'Until what age do we breastfeed, and what changes then?', [
      ['About 6 months', '', ''], ['About 12 months', '', ''], ['Up to 2 years or beyond', 'WHO’s recommendation', ''], ['As long as it works for both mum and baby', '', ''],
    ], ['There is no single age at which breastfeeding stops being worthwhile.', 'What replaces the feeds - and when they can hold a cup or bottle themselves.']),
  ],
  cosleep: [
    q('where', 'Where does the baby sleep for the first 6 months?', [
      ['Own cot in our room', 'Recommended for the first 6 months', 'Up for every feed'],
      ['Bedside cot', 'Close, on their own surface', 'Must be fixed with no gap'],
      ['Our bed', 'Easier night feeds', 'Advised against by the AAP; never with the dangers below'],
      ['Own room', 'Parents may sleep better', 'Earlier than recommended'],
    ], ['Back to sleep, firm flat surface, nothing soft in the cot.'], 'Prematurity, a medical reason, how we are coping.'),
    q('never', 'What will we never do, however tired we are?', [
      ['Never sleep with the baby on a sofa or armchair', '', ''], ['Never bed-share after alcohol or sedating medicine', '', ''], ['No smoking in the house or car', '', ''], ['All of these', '', ''],
    ], ['These are where the risk is greatest - not in dispute.']),
    q('3am', 'What do we do at 3am when we are exhausted?', [
      ['Take turns: one sleeps, one is on', 'Each gets proper sleep', ''], ['The one who is not feeding does the settling', 'Shares the load', ''], ['Our own plan', '', ''],
    ], ['Plan for the night you might fall asleep feeding - make the bed safe or feed in a chair you cannot fall asleep in.']),
    q('ownroom', 'When does the baby move to their own room?', [
      ['At 6 months', 'The end of the recommended time', ''], ['At 12 months', '', ''], ['When it feels right for us', '', ''],
    ], []),
  ],
  fever: [
    q('medicine', 'When do we give medicine for a fever, which one, and how much?', [
      ['When they are distressed, not just for the number', 'Matches the guidance', ''],
      ['Paracetamol first', '', ''], ['Ibuprofen or paracetamol, not both at once unless a doctor says', '', ''],
    ], ['Medicine is for comfort; it does not prevent febrile fits.', 'The dose goes by weight - write it on the box, checked with a pharmacist.'], 'A doctor’s advice for this child.'),
    q('who', 'Who does what: who stays, who phones, who drives, and where do we go?', [
      ['One stays, one phones and drives', '', ''], ['Whoever is with them stays; the other comes', '', ''],
    ], ['Which after-hours doctor or emergency unit is nearest, and its number.']),
  ],
  choking: [
    q('course', 'Who does an infant first-aid course, and how often do we refresh it?', [
      ['Both of us, before the birth', 'Both ready', ''], ['Both, and again every year or two', 'Stays fresh', ''], ['Our own plan', '', ''],
    ], ['Practice on a doll is what makes it stick.']),
    q('foods', 'Which foods do we cut up or avoid, and until what age?', [
      ['Grapes and cherry tomatoes cut lengthwise until 5', '', ''], ['No whole nuts until 5', '', ''], ['No popcorn or hard sweets for small children', '', ''], ['Our own list', '', ''],
    ], ['Round, firm foods the size of a child’s airway are the risk.']),
    q('objects', 'What small things do we put away, and where?', [
      ['Button batteries, coins, magnets, small toy parts', '', ''], ['Our own list', '', ''],
    ], ['Button batteries swallowed can burn within hours - an emergency.']),
  ],
  sun: [
    q('under6', 'Under 6 months: how do we protect them from the sun?', [
      ['Shade and clothing only', 'The usual advice', 'Planning outings around it'], ['Shade and clothing, a little mineral sunscreen on small areas if needed', '', ''],
    ], ['Babies under 6 months are best kept out of direct sun.']),
    q('combo', 'From 6 months: what is our usual combination?', [
      ['Shade + hat + clothing, sunscreen on what is left', '', ''], ['Avoid the middle of the day', '', ''], ['Our own', '', ''],
    ], ['In much of South Africa the UV index is high most of the year.']),
    q('kind', 'Which sunscreen, and why?', [
      ['Mineral (zinc oxide, titanium dioxide)', 'The strongest safety data', 'Can leave a white film'], ['Chemical filters', 'Rubs in clear', 'Some filters are still being reviewed by regulators'],
    ], ['Neither is a reason to stay out longer.']),
    q('vitd', 'Vitamin D: from the sun, a supplement, or formula?', [
      ['Ask the clinic, then decide', '', ''], ['A supplement for a breastfed baby', 'AAP: 400 IU a day', ''], ['Formula already has it', '', ''],
    ], ['There is no established "minutes of sun a day" rule for children.']),
  ],
  monitors: [
    q('use', 'Do we use a monitor, and which kind?', [
      ['None - the baby sleeps near us', 'Nothing to fail or misread', ''], ['Audio', 'Simple', ''], ['Video', 'See without going in', 'Constant watching'], ['A consumer health monitor', 'Some feel reassured', 'Not shown to prevent SIDS; false alarms'],
    ], ['Would it change what we do?', 'More information is not always more useful information.']),
    q('alarm', 'If we use a health monitor: what do we do when it alarms?', [
      ['Check the baby first, the numbers second', '', ''], ['Our own plan', '', ''],
    ], ['False alarms are common; a real problem can also be missed.']),
  ],
  childcare: [
    q('who', 'Who may look after the children, and from what age?', [
      ['Only us, always', 'The responsibility stays with the parents', 'Couple time fits around the children'],
      ['Family only', 'People who know and love them', 'Their rules may differ'],
      ['People we trust', 'Time out together', 'Less control'],
      ['Daycare or a nanny', 'Both parents can work', 'Cost; many hours in someone else’s care'],
    ], ['What each of you holds as the parents’ responsibility.', 'The app follows your answer - with "Only us", nothing asks about a babysitter.']),
    q('emergency', 'If one of us cannot be there - an emergency, a hospital stay - what happens?', [
      ['The other takes the children everywhere', '', ''], ['Named family, only then', '', ''], ['Our own plan', '', ''],
    ], []),
    q('tell', 'How do we tell family our rule, and why?', [
      ['Together, in person', '', ''], ['A short written note of the rule and the reason', '', ''],
    ], ['So nobody offers and is hurt by the answer.']),
  ],
  newused: [
    q('new', 'What do we always buy new?', [
      ['Safety things - car seats, cot mattresses, stair gates', 'Nobody knows if a used one was in a crash or damaged', 'Cost'],
      ['Things that go in the mouth or touch milk - bottles, teats, dummies, breast pumps', 'Hygiene; some cannot be cleaned inside', ''],
      ['Our own list', '', ''],
    ], ['A car seat can be damaged in a crash without showing it, and seats have an expiry date.', 'A breast pump’s tubing can hold milk and mould.'], 'A trusted source who can vouch for its history.'),
    q('used', 'What are we happy to buy second-hand?', [
      ['Clothes', 'Outgrown fast', ''], ['Toys and books', '', 'Check for small loose parts'], ['Bicycles, scooters, furniture', '', 'Check for damage and recalls'], ['Our own list', '', ''],
    ], ['Second-hand saves money and waste; the question is only what you cannot check.']),
    q('check', 'What do we check before using something second-hand?', [
      ['Recalls and safety notices', '', ''], ['Damage, missing parts, wobble', '', ''], ['Washed or cleaned before use', '', ''], ['All of these', '', ''],
    ], []),
  ],
  nappies: [
    q('kind', 'Disposable nappies, cloth, or both?', [
      ['Disposable', 'Easy, quick, away from home', 'Cost over time; waste'], ['Cloth', 'Cheaper over time; less waste', 'Washing, drying, more changes'], ['Both - cloth at home, disposable out', 'A balance', 'Two systems'],
    ], ['Water and electricity for washing.', 'How often each needs changing to avoid rash.']),
    q('potty', 'When do we start potty training, and how will we know they are ready?', [
      ['When they show the signs, whatever the age', 'Follows the child', 'Can be later'], ['Around a set age (e.g. 2 to 3)', 'A plan', 'Not every child is ready'], ['Summer, when there are fewer clothes', '', ''],
    ], ['Signs of readiness: dry for a couple of hours, telling you, interested in the toilet, pulling at a wet nappy.', 'Night dryness often comes much later - it is not the same step.', 'Why start: readiness, daycare or school rules, cost - which matters to us?'], 'A new baby, a move, illness - big changes can set it back.'),
  ],
  stock: [
    q('keep', 'What medicines and first-aid things do we keep at home?', [
      ['Children’s paracetamol', '', ''], ['Children’s ibuprofen', '', ''], ['Oral rehydration sachets', '', ''], ['Saline nose drops', '', ''], ['Antihistamine for children', '', ''], ['Plasters, antiseptic, a thermometer', '', ''],
    ], ['Every medicine says from what age and how much on the label - check it, and ask a pharmacist for this child’s weight.', 'Note it in the chart below so the dose is decided calmly, not at 3am.', 'Expiry dates.'], 'A pharmacist’s or doctor’s advice.'),
    q('where', 'Where do we keep them, and who checks the dates, when?', [
      ['Locked or high up, in one place', '', ''], ['A small kit in the car and the nappy bag too', '', ''],
    ], ['Children’s medicines taste sweet - out of reach matters.']),
  ],
  wipes: [
    q('wipes', 'Which wipes do we use?', [
      ['Unscented', 'Less to irritate', ''], ['Scented', 'Smell nice', 'Fragrance can irritate sensitive skin'], ['Water-based', 'Few ingredients', 'Cost'], ['Cotton wool and water', 'Nothing added', 'Less handy out'],
    ], ['Read the ingredients: fragrance and some preservatives cause rashes in some babies.']),
    q('cream', 'Which nappy cream, and when?', [
      ['Zinc oxide barrier cream', 'A proven barrier', 'Thick, white'], ['Petroleum jelly', 'Cheap barrier', ''], ['Only when there is redness', 'Less product', ''], ['At every change', 'Prevention', 'More product'],
    ], ['Keep it simple - fewer ingredients, fewer surprises.'], 'A rash that does not clear in a few days, blisters or bleeding - then a doctor.'),
  ],
  powders: [
    q('use', 'Do we use powder on the baby - and if so, which?', [
      ['No powder', 'Nothing to breathe in', ''], ['Cornstarch-based, kept away from the face', 'Absorbs moisture', 'Can still be breathed in'], ['Talc', 'Smells familiar', 'Breathed in, it can harm a baby’s lungs; talc was classed in 2024 as probably carcinogenic - worth reading up on'],
    ], ['This is not to frighten you - it is something worth looking into before deciding.', 'A puff of powder near the face can be breathed in.'], 'What you read when you look into it.'),
  ],
  clothes: [
    q('room', 'What temperature do we keep the baby’s room, and how do we know?', [
      ['A room thermometer both of us can read at a glance', 'Facts, not feelings', ''], ['16 to 20 °C while the baby sleeps', 'The range The Lullaby Trust gives', ''], ['Our own range', '', ''],
    ], ['After the birth, mum’s hormones can make her feel much warmer or colder than the room is - agree to trust the thermometer, not either of you.', 'Check the baby’s chest or the back of the neck, not hands and feet.'], 'Sweating, a hot chest - or cold to the touch.'),
    q('layers', 'At what temperature do they wear what?', [
      ['A chart we fill in below', '', ''], ['Roughly one layer more than us', 'A rule of thumb', 'Not exact'],
    ], ['Babies cannot take a layer off; overheating is a sleep risk.', 'No hats or hoods to sleep indoors.']),
    q('howmany', 'How many of each, in each size?', [
      ['A few - wash often', 'Less to buy', 'More washing'], ['Enough for a few days', 'Less washing', 'Outgrown fast'],
    ], ['Newborn sizes are outgrown in weeks; second-hand suits them well.']),
  ],
};

// The signs health services treat as needing a doctor straight away - you choose which go in your plan.
export const FEVER_SIGNS = [
  'Hard to wake, floppy or unusually drowsy', 'Struggling to breathe, or grunting', 'Blue, grey or very pale lips or skin', 'A fit',
  'A rash that does not fade when a glass is pressed on it', 'A stiff neck', 'Not drinking, or far fewer wet nappies',
  'Under 3 months old with 38 °C or more', 'A fever lasting 5 days or more', 'Getting worse',
];

// Short write-ups for topics that so far have only their questions.
export const ABOUT_LATER = {
  newused: { question: 'What do we buy new, and what are we happy to buy second-hand?', summary: 'Most things can be second-hand. The ones worth thinking about are those whose history you cannot check (a car seat that may have been in a crash) and those that touch milk or go in the mouth.' },
  nappies: { question: 'Which nappies, and when do we start potty training?', summary: 'Disposable, cloth or both - and the readiness signs that matter more than age for potty training.' },
  stock: { question: 'What do we keep at home, and what do we give at what age?', summary: 'Decide calmly what you keep, where, and what you give at what age and dose - written in your own chart from the labels and your pharmacist, printed and kept up to date.' },
  wipes: { question: 'Which wipes and creams, and why?', summary: 'Scented or unscented, what is in them, and which barrier cream - fewer ingredients, fewer surprises.' },
  powders: { question: 'Powder on the baby - yes or no?', summary: 'Powders smell nice, but there are reasons to look into them first: breathing powder in can harm a baby’s lungs, and talc has health questions. Read up, then decide.' },
  clothes: { question: 'What do they wear at what temperature, and how warm is the room?', summary: 'A thermometer you both trust, the room temperature you aim for, and what they wear at each temperature - so neither of you has to guess.' },
};
