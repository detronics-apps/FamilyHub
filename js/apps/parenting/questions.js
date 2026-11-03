// The questions each topic asks you to decide (D-106, reworded D-107) - while you are calm,
// together. The app only asks: it lists approaches without verdicts, points out where people
// disagree, and leaves the research, the reasons and the decision with the parents. Each question
// becomes its own decision. Everything here can be changed, added to and removed by the family.
// Pure data - no DOM.
//
// q(id, ask, approaches, consider) - consider: questions to ask yourselves, never claims.

const q = (id, ask, approaches, consider = []) => ({ id, ask, options: approaches.map((name) => ({ name })), think: consider });

export const QUESTIONS = {
  honey: [
    q('until', 'Have you talked about honey for your baby - whether, and from what age?', ['Not until a certain age', 'From when solids start', 'Our own way'],
      ['Have you looked into why many families keep honey from young babies?', 'Does it apply to foods cooked or baked with honey, and to rusks or cereals that contain it?']),
    q('tell', 'How will everyone who feeds the baby know what you decided?', ['We tell them ourselves', 'A note for them', 'Both', 'Our own way'],
      ['Who besides you feeds the baby - grandparents, friends, anyone else?']),
  ],
  water: [
    q('before', 'Have you considered whether, and when, your baby has water?', ['Only milk for now', 'A little water on hot days', 'With meals once solids start', 'Our own way'],
      ['Have you looked into why some families give no water to young babies, and others do?', 'What will you do on very hot days, or when the baby is ill?']),
    q('formula', 'If you use formula, who makes it up, and how will you both make it the same way?', ['One of us always', 'Both of us, the same steps', 'Our own way'],
      ['Have you read the steps on the tin together?']),
  ],
  feeding: [
    q('how', 'Have you considered how your baby will be fed?', ['Breastfeeding', 'Bottles', 'Both', 'Our own way'],
      ['What matters most to each of you here?', 'What would each way ask of mum, and of dad?', 'How will night feeds be shared?']),
    q('whatin', 'If bottles, what goes in them?', ['Expressed breast milk', 'Formula', 'Both', 'Our own way'],
      ['Have you looked into the different kinds of formula, and who makes them?']),
    q('bottle', 'Have you considered what the bottles are made of?', ['Glass', 'Plastic', 'Silicone', 'Stainless steel', 'Different ones at different ages', 'Our own way'],
      ['There is ongoing discussion about plastics touching warm milk - have you looked into it?', 'Weight, breaking, and the baby holding it themselves.']),
    q('sterilise', 'How will you clean and sterilise bottles - and until when?', ['Boiling', 'A steam steriliser', 'A microwave steriliser', 'A steriliser without plastic', 'Our own way'],
      ['What is each steriliser made of?', 'Until what age will you keep sterilising?']),
    q('until', 'Until when do you see yourselves breastfeeding, and what changes after that?', ['A few months', 'About a year', 'Two years or more', 'As long as it works for us', 'Our own way'],
      ['What would make you change course - for mum, for the baby, for work?']),
  ],
  cosleep: [
    q('where', 'Have you considered where your baby will sleep?', ['A cot in our room', 'A bedside cot', 'Our bed', 'Their own room', 'Our own way'],
      ['Have you looked into why families choose differently here?', 'What would make each of you uneasy?']),
    q('never', 'Is there anything you will never do around sleep, however tired you are?', ['Our own list'],
      ['Sofas and armchairs, alcohol, smoking, medicines that make you drowsy - have you talked about each?']),
    q('3am', 'What will you do at 3am when you are both exhausted?', ['Take turns', 'One feeds, one settles', 'Our own way'],
      ['What if one of you falls asleep feeding?']),
    q('ownroom', 'When, if ever, does the baby move to their own room?', ['A set age', 'When it feels right', 'Our own way'], []),
  ],
  fever: [
    q('medicine', 'Have you talked about medicine for a fever - whether, which, how much?', ['Only when they are uncomfortable', 'By the temperature', 'Not unless a doctor says', 'Our own way'],
      ['Have you read the label and asked a pharmacist about your child’s weight?', 'Write what you decide in the medicine chart, so nobody works it out at 3am.']),
    q('who', 'Who does what when a child has a high temperature?', ['One stays, the other phones or drives', 'Whoever is with them stays', 'Our own way'],
      ['Which doctor, clinic or hospital will you go to, and are the numbers saved?']),
  ],
  choking: [
    q('course', 'Have you considered a first-aid course?', ['Both of us, soon', 'Both, and again every year or two', 'Our own way'],
      ['Who else who looks after the children would benefit from one?']),
    q('foods', 'Which foods will you cut up or keep away, and until what age?', ['Our own list'],
      ['Have you looked into which foods are most often a choking risk for small children?']),
    q('objects', 'Which small things will you keep out of reach, and where?', ['Our own list'],
      ['Batteries, coins, magnets, small toy parts - have you looked around at their height?']),
  ],
  sun: [
    q('balance', 'Have you considered how you will balance time in the sun and protecting their skin?', ['Shade', 'Long sleeves and a hat', 'Choosing the time of day', 'Short spells in the sun, then shade', 'Sunscreen', 'A mix', 'Our own way'],
      ['There is ongoing discussion about sun exposure and about sunscreen - have you looked into it?', 'What draws each of you to your way, and what worries you about the others?', 'Does it change with age, or with how strong the sun is?']),
    q('sunscreen', 'If you use sunscreen, have you considered which kind and why?', ['We do not use it', 'Our own choice'],
      ['Have you read the ingredients, and looked into them?']),
  ],
  monitors: [
    q('use', 'Have you considered whether you want a baby monitor, and what kind?', ['None', 'Sound', 'Video', 'One that tracks breathing or heart rate', 'Our own way'],
      ['What would you want it to do - and would it change what you do?', 'How do each of you feel about alarms and numbers at night?']),
    q('alarm', 'If it alarms, what will you do first?', ['Go to the baby first', 'Our own way'], []),
  ],
  childcare: [
    q('who', 'Who may look after the children, and from what age?', ['Only us, always', 'Family only', 'People we trust', 'Daycare or a nanny', 'Our own way'],
      ['What does each of you hold as the parents’ own responsibility?', 'The app follows your answer - with "Only us", nothing asks about a babysitter.']),
    q('emergency', 'If one of you cannot be there - an emergency, a hospital stay - what happens?', ['The other takes the children everywhere', 'Named family, only then', 'Our own way'], []),
    q('tell', 'How will you tell family your rule, and why?', ['Together, in person', 'A short note', 'Our own way'], ['So nobody offers and is hurt by the answer.']),
  ],
  newused: [
    q('new', 'What will you always buy new?', ['Car seats', 'Cot mattresses', 'Bottles, teats and dummies', 'Breast pumps', 'Our own list'],
      ['Which things could you never check the history of - a car seat that might have been in an accident?', 'Which things touch milk or go in the mouth?']),
    q('used', 'What are you happy to buy second-hand?', ['Clothes', 'Toys and books', 'Bikes and scooters', 'Furniture', 'Our own list'],
      ['What would you check first - damage, missing parts, recalls?']),
  ],
  nappies: [
    q('kind', 'Have you considered disposable, cloth, or both?', ['Disposable', 'Cloth', 'Both', 'Our own way'],
      ['Cost over time, washing and drying, time, waste - what matters most to each of you?']),
    q('potty', 'When will you start potty training, and how will you know they are ready?', ['When they show they are ready', 'Around a set age', 'In a warm season', 'Our own way'],
      ['What signs will you look for?', 'Why start then - readiness, school or daycare, cost?', 'What would make you pause and try again later?']),
  ],
  stock: [
    q('keep', 'What medicines and first-aid things will you keep at home?', ['Our own list'],
      ['Have you read each label for the ages and amounts, and asked a pharmacist about your children’s weights?', 'Note it in the medicine chart below, so the amount is decided calmly.', 'Who checks the expiry dates, and when?']),
    q('where', 'Where will you keep them?', ['Locked or up high', 'A small kit in the car or nappy bag too', 'Our own way'], ['Can the children reach it?']),
  ],
  wipes: [
    q('wipes', 'Have you considered which wipes you will use?', ['Unscented', 'Scented', 'Water-based', 'Cloths and water', 'Our own way'],
      ['Have you read what is in them, and looked into the ingredients?']),
    q('cream', 'Will you use a nappy cream - which, and when?', ['A barrier cream', 'Only when there is redness', 'None', 'Our own way'],
      ['What is in it?', 'When would you see a doctor about a rash?']),
  ],
  powders: [
    q('use', 'Have you considered whether to use powder on your baby?', ['No powder', 'Powder, kept away from the face', 'Our own way'],
      ['There is ongoing discussion about baby powders and what they are made of - have you looked into it?', 'What would you want to know before deciding?']),
  ],
  clothes: [
    q('room', 'How warm will you keep the baby’s room, and how will you both know?', ['A room thermometer we both trust', 'Our own way'],
      ['After the birth, mum may feel much warmer or colder than the room is - will you trust a thermometer rather than either of you?', 'How will you check if the baby is too warm or too cold?']),
    q('layers', 'At what room temperature will they wear what?', ['A chart we fill in below', 'Our own way'], ['Does it change with age, and for sleep?']),
    q('howmany', 'How many of each, in each size?', ['A few, washed often', 'Enough for a few days', 'Our own way'], ['Second-hand for the sizes they outgrow fastest?']),
  ],
};

// Signs some families put in their plan for going straight to a doctor - a starting point to keep,
// change, remove or add to. Taken from what first-aid courses commonly teach.
export const FEVER_SIGNS = [
  'Hard to wake, floppy or unusually drowsy', 'Struggling to breathe', 'Blue, grey or very pale lips or skin', 'A fit',
  'A rash that does not fade when a glass is pressed on it', 'A stiff neck', 'Not drinking, or far fewer wet nappies', 'Getting worse',
];

// Short, neutral words for topics that so far have only their questions.
export const ABOUT_LATER = {
  newused: { question: 'What will you buy new, and what second-hand?', summary: 'Most things can be second-hand. Decide together which you would rather buy new, and why.' },
  nappies: { question: 'Which nappies, and when to start potty training?', summary: 'Disposable, cloth or both - and how you will know your child is ready for the potty.' },
  stock: { question: 'What will you keep at home, and what will you give at what age?', summary: 'Decide calmly what you keep and where, and write down what you give at what age and amount - from the labels and your pharmacist - so nobody works it out at 3am.' },
  wipes: { question: 'Which wipes and creams?', summary: 'Decide which you will use, after reading what is in them.' },
  powders: { question: 'Powder on the baby - yes or no?', summary: 'There is ongoing discussion about baby powders. Look into it, and decide what you are comfortable with.' },
  clothes: { question: 'What will they wear at what temperature, and how warm is the room?', summary: 'A thermometer you both trust, the room temperature you aim for, and what they wear at each - so neither of you has to guess.' },
};
