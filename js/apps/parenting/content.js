// The starting topics (D-095): a starting point the family changes, removes and adds to.
// Each written topic lays out the options, the why, what changes the answer, how sure the
// science is, and what to align on. Health topics never suggest not seeing a doctor.
// Ages are in months. `v` goes up when a topic is improved, so an edited copy can offer it.
// Pure data - no DOM.

export const LEVELS = {
  established: { name: 'Established', text: 'Strong, consistent evidence; major health bodies agree.' },
  supported: { name: 'Supported', text: 'Good evidence, but with limits - often observational, or not every study agrees.' },
  studied: { name: 'Being studied', text: 'An interesting mechanism or early findings; not settled.' },
  unknown: { name: 'Unknown', text: 'Nobody has a good answer yet.' },
};

const S = {
  cdcBotulism: { name: 'CDC - Botulism', url: 'https://www.cdc.gov/botulism/', checked: '2026-11-02' },
  cdphBotulism: { name: 'California Department of Public Health - Infant Botulism: prevention', url: 'https://infantbotulism.org/parent/prevention.php', checked: '2026-11-02' },
  nhsDrinks: { name: 'NHS - Drinks and cups for babies and young children', url: 'https://www.nhs.uk/conditions/baby/weaning-and-feeding/drinks-and-cups-for-babies-and-young-children/', checked: '2026-11-02' },
  whoFeeding: { name: 'WHO - Infant and young child feeding (fact sheet)', url: 'https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding', checked: '2026-11-02' },
  whoExclusive: { name: 'WHO - Exclusive breastfeeding for six months', url: 'https://www.who.int/tools/elena/interventions/exclusive-breastfeeding', checked: '2026-11-02' },
  whoSecondYear: { name: 'WHO - Systematic review: continued breastfeeding in the second year', url: 'https://cdn.who.int/media/docs/default-source/nutrition-and-food-safety/complementary-feeding/cf-guidelines/systematic-review-continued-breastfeeding.pdf', checked: '2026-11-02' },
  ahrq: { name: 'AHRQ 2025 - Breastfeeding and health outcomes for infants and children (systematic review)', url: 'https://pubmed.ncbi.nlm.nih.gov/40240318/', checked: '2026-11-02' },
  circadian: { name: 'Systematic review - circadian variation in human milk', url: 'https://pubmed.ncbi.nlm.nih.gov/32759654/', checked: '2026-11-02' },
  immuneCells: { name: 'Review - immune cells in breast milk', url: 'https://pubmed.ncbi.nlm.nih.gov/25979492/', checked: '2026-11-02' },
  saliva: { name: 'Review - breast milk and infant saliva', url: 'https://pubmed.ncbi.nlm.nih.gov/41601664/', checked: '2026-11-02' },
  infantInfection: { name: 'Study - milk immune cells when the infant has an infection', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10490220/', checked: '2026-11-02' },
  aapSleep: { name: 'AAP 2022 - Sleep-related infant deaths: updated recommendations (Pediatrics 150(1))', url: 'https://doi.org/10.1542/peds.2022-057990', checked: '2026-11-02' },
  lullaby: { name: 'The Lullaby Trust - Co-sleeping', url: 'https://www.lullabytrust.org.uk/safer-sleep-advice/co-sleeping/', checked: '2026-11-02' },
  nhsFever: { name: 'NHS - High temperature (fever) in children', url: 'https://www.nhs.uk/conditions/fever-in-children/', checked: '2026-11-02' },
  nice: { name: 'NICE NG143 - Fever in under 5s: assessment and initial management', url: 'https://www.nice.org.uk/guidance/ng143', checked: '2026-11-02' },
  nhsChoking: { name: 'NHS - How to stop a child from choking', url: 'https://www.nhs.uk/conditions/baby/first-aid-and-safety/first-aid/how-to-stop-a-child-from-choking/', checked: '2026-11-02' },
  whoUV: { name: 'WHO - Ultraviolet radiation (fact sheet)', url: 'https://www.who.int/news-room/fact-sheets/detail/ultraviolet-radiation', checked: '2026-11-02' },
  aapSun: { name: 'AAP (HealthyChildren.org) - Sun safety', url: 'https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Sun-Safety.aspx', checked: '2026-11-02' },
  fdaSun: { name: 'FDA - Sunscreen: how to help protect your skin from the sun', url: 'https://www.fda.gov/drugs/understanding-over-counter-medicines/sunscreen-how-help-protect-your-skin-sun', checked: '2026-11-02' },
  nihVitD: { name: 'NIH Office of Dietary Supplements - Vitamin D', url: 'https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/', checked: '2026-11-02' },
  fdaMonitors: { name: 'FDA, 16 Sep 2025 - Do not use unauthorized infant devices for monitoring vital signs', url: 'https://www.fda.gov/medical-devices/safety-communications/do-not-use-unauthorized-infant-devices-monitoring-vital-signs-fda-safety-communication', checked: '2026-11-02' },
  wcEmergency: { name: 'Western Cape Government - Know who you can call in an emergency', url: 'https://westerncape.gov.za/know-who-you-can-call-emergency', checked: '2026-11-02' },
};

// Who to call - checked 2026-11-02. Your own doctor and clinic are worth adding to People.
export const EMERGENCY = [
  ['Ambulance', '10177'],
  ['From any cell phone (even without airtime)', '112'],
  ['ER24', '084 124'],
  ['Netcare 911', '082 911'],
  ['Poisons Information Helpline', '0861 555 777'],
];

// Outcomes of a health flowchart. There is no "stay home": the gentlest is still "see someone".
export const OUTCOMES = {
  now: 'Call for help now',
  today: 'See a doctor today',
  doctor: 'See your doctor or clinic - sooner if you are worried',
};
export const GO_LINE = 'If you are wondering whether to go, go. Better to go and it is nothing than not go and it was something.';

const WRITTEN = [
  {
    id: 'honey', v: 1, section: 'decide', title: 'Honey before 12 months', ages: { from: 0, to: 12 }, health: true,
    question: 'Why is honey different from other sweet things for a baby?',
    summary: 'Honey can carry spores of the bacterium that causes botulism. An adult’s gut stops them; a baby’s gut, still settling, can let them grow and make toxin. That is why the rule is about honey and age, not about sugar.',
    why: [
      { text: 'Honey can contain spores of Clostridium botulinum. In an infant’s immature gut the spores can grow and produce botulinum toxin, which weakens the muscles (infant botulism).', level: 'established', source: 'cdcBotulism' },
      { text: 'Health bodies advise no honey before 12 months - not in food, drinks, formula, or on a dummy. Cooking or baking into a product does not reliably destroy the spores.', level: 'established', source: 'cdphBotulism' },
      { text: 'Spores are also in soil and dust, so honey is not the only source; it is the one a family can avoid.', level: 'established', source: 'cdphBotulism' },
    ],
    options: [
      { name: 'No honey until 12 months', strengths: ['Removes the one avoidable source'], weaknesses: ['Needs telling grandparents and minders - honey on a dummy is an old habit'], fits: 'Every baby under 12 months' },
      { name: 'Honey from 12 months', strengths: ['By then the gut copes like an older child’s'], weaknesses: ['It is still added sugar - see Sugar'], fits: 'From the first birthday' },
    ],
    changes: ['Age: the rule ends at 12 months.', 'Who feeds the baby: everyone who does needs to know.'],
    align: ['Who tells grandparents and minders, and how.'],
    family: ['No honey for the baby - not in tea, porridge or on a dummy - until 12 months, because of infant botulism.'],
    signs: 'Constipation, a weak cry or suck, poor feeding, a floppy body or drooping eyelids in a baby: see a doctor today, and call for help now if breathing is affected.',
  },
  {
    id: 'water', v: 1, section: 'decide', title: 'Water for babies', ages: { from: 0, to: 12 }, health: true,
    question: 'Does a baby need water - and can too much do harm?',
    summary: 'Breast milk or formula gives a young baby all the fluid they need. Water starts as sips with meals once solids begin, from about 6 months. Too much plain water in a small baby can lower the sodium in the blood - that is the real reason behind "no water", not "it dilutes the blood".',
    why: [
      { text: 'Fully breastfed babies do not need water before they start solids; formula-fed babies may need a little extra (cooled boiled water) in hot weather.', level: 'established', source: 'nhsDrinks' },
      { text: 'From about 6 months, sips of water from an open or free-flow cup can be offered with meals.', level: 'established', source: 'nhsDrinks' },
      { text: 'Too much free water - or formula made up with too much water - can cause water intoxication (hyponatraemia): sodium in the blood falls, which in severe cases affects the brain and can cause fits.', level: 'established', source: 'nhsDrinks' },
      { text: 'Breast milk itself changes with the weather and the feed, so a baby feeding on demand usually takes more milk, not water, when it is hot.', level: 'supported', source: 'whoFeeding' },
    ],
    options: [
      { name: 'Milk only until solids', strengths: ['Matches the guidance for breastfed babies', 'No risk of too much water'], weaknesses: ['Hot days need more feeds'], fits: 'Under 6 months, breastfed', timing: '0-6 months' },
      { name: 'A little cooled boiled water in hot weather', strengths: ['Extra fluid for a formula-fed baby'], weaknesses: ['Small amounts only; never instead of feeds'], fits: 'Formula-fed under 6 months, hot days', timing: '0-6 months' },
      { name: 'Sips with meals', strengths: ['Learning to use a cup'], weaknesses: ['Milk stays the main drink until 12 months'], fits: 'From about 6 months', timing: '6-12 months' },
    ],
    steps: {
      start: 'age',
      nodes: {
        age: { q: 'How old is the baby?', answers: [['Under 6 months', 'feed'], ['6 months or more', 'solids']] },
        feed: { q: 'How is the baby fed?', answers: [['Breast milk only', 'bf'], ['Formula, or both', 'ff']] },
        bf: { say: 'No water needed - offer more feeds when it is hot. Always make formula with the exact amount of water on the tin, never extra.' },
        ff: { say: 'A little cooled boiled water on hot days is fine; it never replaces a feed. Make formula exactly as the tin says.' },
        solids: { say: 'Offer sips of water with meals from a cup. Milk stays the main drink until 12 months.' },
      },
    },
    changes: ['Age and whether solids have started.', 'Breast milk or formula.', 'Heat, and illness with vomiting or diarrhoea - then ask your doctor or clinic about fluids.'],
    align: ['What we do on hot days.', 'Who makes up formula, and that it is always exactly to the tin.'],
    family: ['Please don’t give the baby water or juice under 6 months without asking us.'],
    signs: 'Unusual sleepiness, irritability, puffiness or a fit after a lot of water: call for help now.',
  },
  {
    id: 'feeding', v: 1, section: 'decide', title: 'Breast milk, formula, or both', ages: { from: 0, to: 24 },
    question: 'What does each way of feeding give - and what does each cost?',
    summary: 'Formula is designed to give the nutrition a baby needs to grow when breast milk is not available, not enough, or not chosen. It does not reproduce everything in human milk, which is a living, changing fluid. Neither is a measure of a good parent; this lays out what changes, so you can choose.',
    why: [
      { text: 'WHO recommends exclusive breastfeeding for the first 6 months, then other foods with continued breastfeeding up to 2 years or beyond.', level: 'established', source: 'whoExclusive' },
      { text: 'Human milk carries antibodies (especially secretory IgA), immune cells, lactoferrin, enzymes, hormones and oligosaccharides that formula does not fully copy.', level: 'established', source: 'immuneCells' },
      { text: 'More breastfeeding is linked with fewer respiratory and stomach infections and ear infections; most of this evidence is observational, and there is no single duration that is best for every outcome.', level: 'supported', source: 'ahrq' },
      { text: 'Milk composition changes - colostrum, then transitional, then mature milk - and over the day (fats, melatonin, cortisol and more).', level: 'supported', source: 'circadian' },
      { text: 'Infant saliva and milk interact, and milk immune cells can change when the baby has an infection. How much this is a targeted response is still being worked out.', level: 'studied', source: 'infantInfection' },
      { text: 'Evidence for extra health benefits from continuing beyond the first year is less certain - which is not the same as there being none.', level: 'supported', source: 'whoSecondYear' },
    ],
    options: [
      { name: 'Breastfeeding directly', strengths: ['All the living parts of milk', 'Milk adapts over time', 'No preparation or sterilising'], weaknesses: ['Pain, mastitis risk, broken sleep', 'Intake cannot be measured', 'Only mum can feed', 'Work and medicines can make it hard'] },
      { name: 'Expressed (pumped) breast milk', strengths: ['Most of the nutrition and immune parts kept', 'Others can feed', 'Intake can be seen'], weaknesses: ['Pumping time and equipment', 'Storage, and some changes on freezing', 'The direct saliva-milk contact is missing'] },
      { name: 'Formula', strengths: ['Consistent, measurable', 'Anyone can feed', 'No dependence on lactation'], weaknesses: ['Cost', 'Preparation, safe water, sterilising', 'Lacks the living parts of human milk'] },
      { name: 'Combination', strengths: ['Keeps some breast milk while sharing feeds'], weaknesses: ['Can lower supply if breastfeeds drop'] },
    ],
    changes: ['Mum’s health, medicines and recovery.', 'Return to work.', 'Supply, latch and the baby’s weight gain - a clinic or lactation consultant helps here.', 'Who else will be feeding.'],
    align: ['What we will try first, and what we do if it is not working.', 'How the other parent helps with night feeds either way.', 'How long - and that "until it stops working for us" is a valid answer.'],
    family: ['However we feed, please support it rather than comment on it.'],
  },
  {
    id: 'cosleep', v: 1, section: 'decide', title: 'Co-sleeping and safe sleep', ages: { from: 0, to: 12 }, health: true,
    question: 'Where does the baby sleep, and how do we make it as safe as possible?',
    summary: 'Sharing a room is recommended for the first 6 months. Sharing a bed is where the views differ: the AAP advises against it, while UK guidance accepts that many families do and sets out how to make it safer. The dangerous situations are not in dispute.',
    why: [
      { text: 'Babies should sleep on their back, on a firm flat surface, with nothing soft in the cot - no pillows, bumpers or loose blankets.', level: 'established', source: 'aapSleep' },
      { text: 'Sharing a room (baby in their own cot or bassinet) is recommended, ideally for at least the first 6 months.', level: 'established', source: 'aapSleep' },
      { text: 'Sleeping with a baby on a sofa or armchair, after alcohol, drugs or sedating medicine, with a smoker, or with a premature or low-birth-weight baby, greatly raises the risk of death.', level: 'established', source: 'aapSleep' },
      { text: 'For families who do bed-share, a clear firm mattress, baby on their back away from pillows, and none of the dangers above lowers the risk.', level: 'supported', source: 'lullaby' },
    ],
    options: [
      { name: 'Own cot in our room', strengths: ['The recommended set-up for 6 months', 'Baby close for feeds'], weaknesses: ['Getting up for every feed'], timing: '0-6 months and beyond' },
      { name: 'Bedside (side-car) cot', strengths: ['Very close, but on their own surface'], weaknesses: ['Must be fixed firmly with no gap'] },
      { name: 'Bed-sharing', strengths: ['Easier night feeds', 'Many families end up doing it'], weaknesses: ['Advised against by the AAP', 'Never with the dangers above'], notFits: 'After alcohol or sedating medicine, smokers, premature or low-birth-weight babies' },
      { name: 'Own room', strengths: ['Parents may sleep better'], weaknesses: ['Earlier than the 6 months recommended'], timing: 'Usually after 6 months' },
    ],
    prepare: {
      ready: ['A cot or bassinet with a firm, flat mattress and nothing soft in it', 'A plan for the night feeds when you are exhausted'],
      who: ['Who does which night feeds', 'Who babysits, and that they know the safe-sleep rules'],
      practise: [],
    },
    changes: ['Smoking, alcohol and medicines in the house.', 'Prematurity and birth weight.', 'How exhausted we are - plan for the nights you might fall asleep with the baby (see Exhausted nights).'],
    align: ['Where the baby sleeps, and what we do at 3am when we are exhausted.', 'Never on the sofa with the baby.'],
    family: ['Baby sleeps on their back in their own cot - please keep it that way when you babysit.'],
  },
  {
    id: 'fever', v: 1, section: 'normal', title: 'Temperature and fever', ages: { from: 0, to: 60 }, health: true,
    question: 'What is a fever for, and when does it need a doctor?',
    summary: 'A fever is the body raising its temperature to fight an infection - it is a sign, not the illness. How the child is (drinking, alert, breathing, colour) tells you more than the number. The youngest babies are the exception: in them, the number alone is reason to go.',
    why: [
      { text: 'A fever is usually 38°C or more. It is part of the immune response, and most fevers come from viral infections.', level: 'established', source: 'nhsFever' },
      { text: 'A baby under 3 months with 38°C or more needs to be seen urgently; 3-6 months with 39°C or more needs a doctor.', level: 'established', source: 'nhsFever' },
      { text: 'Doctors look for warning signs - colour, activity, breathing, fluids - alongside the temperature (the traffic-light approach).', level: 'established', source: 'nice' },
      { text: 'Medicine for fever is to make a distressed child comfortable, not to bring the number down; it does not prevent febrile fits.', level: 'established', source: 'nice' },
      { text: 'A fever lasting 5 days or more needs a doctor.', level: 'established', source: 'nice' },
    ],
    steps: {
      start: 'red',
      nodes: {
        red: { q: 'Any of these? Hard to wake or floppy · struggling to breathe or grunting · blue, grey or very pale lips or skin · a fit · a rash that does not fade when a glass is pressed on it · stiff neck', answers: [['Yes', 'now'], ['No', 'age']] },
        age: { q: 'How old is the child?', answers: [['Under 3 months', 'under3'], ['3 to 6 months', 'mid'], ['Over 6 months', 'older']] },
        under3: { q: 'Is the temperature 38°C or more?', answers: [['Yes', 'now'], ['No, but they seem unwell', 'today'], ['No', 'doctor']] },
        mid: { q: 'Is the temperature 39°C or more, or are they not feeding or unusually sleepy?', answers: [['Yes', 'today'], ['No', 'doctor']] },
        older: { q: 'Not drinking, fewer wet nappies, a fever for 5 days or more, or getting worse?', answers: [['Yes', 'today'], ['No', 'doctor']] },
        now: { out: 'now' },
        today: { out: 'today' },
        doctor: { out: 'doctor', say: 'Meanwhile: offer fluids often, dress them lightly, check on them at night. Go sooner if anything above changes or you are worried.' },
      },
    },
    options: [
      { name: 'Digital thermometer under the arm', strengths: ['Recommended for under-5s', 'Cheap'], weaknesses: ['Takes a minute of holding still'] },
      { name: 'Ear thermometer', strengths: ['Quick'], weaknesses: ['Less reliable in young babies'] },
      { name: 'Forehead strips', strengths: ['Easy'], weaknesses: ['Not accurate - do not rely on them'] },
    ],
    prepare: {
      ready: ['A digital thermometer, where both of you know to find it', 'Children’s paracetamol in the right strength for their age, with the dose for their weight written on the box', 'The doctor, the clinic, the after-hours number and 10177 saved on both phones'],
      who: ['Who phones, who stays with the child', 'Who drives, and where the nearest emergency unit is'],
      practise: ['Take a temperature together when the child is well, so it is familiar', 'Go through the steps below together'],
    },
    changes: ['Age - the younger, the sooner to go.', 'How the child is, more than the number.', 'How long it lasts.'],
    align: ['Which thermometer we keep, and where.', 'The doctor, clinic and after-hours numbers we use.'],
  },
  {
    id: 'choking', v: 1, section: 'emergency', title: 'Choking', ages: { from: 0, to: 144 }, health: true,
    question: 'What do we do in the first minute?',
    summary: 'Coughing is the body clearing the airway - if they are coughing well, let them. If they cannot cough, cry or breathe, act at once. Learn this on a first-aid course with a practice doll; reading is not enough.',
    why: [
      { text: 'Effective coughing clears most obstructions; back blows and thrusts are for when coughing has stopped working.', level: 'established', source: 'nhsChoking' },
      { text: 'Under 1 year: up to 5 back blows, then up to 5 chest thrusts. Over 1 year: up to 5 back blows, then up to 5 abdominal thrusts.', level: 'established', source: 'nhsChoking' },
      { text: 'Do not sweep blindly in the mouth - it can push the object further in.', level: 'established', source: 'nhsChoking' },
      { text: 'Anyone who had chest or abdominal thrusts should be checked by a doctor afterwards.', level: 'established', source: 'nhsChoking' },
    ],
    steps: {
      start: 'cough',
      nodes: {
        cough: { q: 'Can they cough, cry or breathe?', answers: [['Yes, coughing hard', 'coughing'], ['No - silent, cannot breathe', 'age']] },
        coughing: { say: 'Encourage them to keep coughing and stay with them. Do not pat the back while they are coughing well. If the coughing stops working, go back.', next: [['Coughing stopped working', 'age'], ['It came out', 'after']] },
        age: { q: 'Shout for someone to call 10177 or 112. How old is the child?', answers: [['Under 1 year', 'baby'], ['1 year or older', 'child']] },
        baby: { say: 'Lay the baby face down along your thigh or forearm, head lower, supporting the jaw. Up to 5 firm back blows between the shoulder blades. Check the mouth - remove only what you can see. Still blocked: turn face up, 2 fingers on the middle of the breastbone just below the nipples, up to 5 sharp chest thrusts. Repeat.', next: [['It came out', 'after'], ['They stopped responding', 'cpr']] },
        child: { say: 'Lean them forward. Up to 5 firm back blows between the shoulder blades. Check the mouth - remove only what you can see. Still blocked: stand behind, fist just above the belly button, pull sharply in and up, up to 5 times. Repeat.', next: [['It came out', 'after'], ['They stopped responding', 'cpr']] },
        cpr: { out: 'now', say: 'Call 10177 or 112 on speaker and start CPR - the call-taker will talk you through it.' },
        after: { out: 'today', say: 'After back blows or thrusts, have them checked by a doctor today, even if they seem fine.' },
      },
    },
    prepare: {
      ready: ['10177 and 112 saved on both phones and on the fridge', 'Small things (coins, button batteries, grapes left whole) out of reach'],
      who: ['Whoever is nearest acts; the other phones and puts it on speaker'],
      practise: ['An infant and child first-aid course for both of you, with a practice doll', 'Go through the steps below together every few months'],
    },
    changes: ['Age: under 1 year is chest thrusts, never abdominal thrusts.'],
    align: ['Both of us do an infant and child first-aid course before the birth.', 'Which foods we cut up (grapes, cherry tomatoes lengthwise) and what we avoid (whole nuts, popcorn) for small children.'],
    family: ['Anyone who looks after the baby should know what to do when they choke.'],
  },
  {
    id: 'sun', v: 1, section: 'out', title: 'Sun, sunscreen and vitamin D', ages: { from: 0, to: 216 },
    question: 'What are we trying to achieve - and what are all the ways of getting there?',
    summary: 'Not "sunscreen good, sun bad". The aims are outdoor play, no sunburn, less UV damage over a lifetime, enough vitamin D and a child who is not overheated. Shade, clothes, a hat, timing and sunscreen are all tools - usually best combined.',
    why: [
      { text: 'UV radiation is a cause of skin cancer; sunburn in childhood adds to lifetime risk.', level: 'established', source: 'whoUV' },
      { text: 'Shade, clothing and hats come first; sunscreen protects skin that cannot be covered and should not be used to stay out longer.', level: 'established', source: 'whoUV' },
      { text: 'Babies under 6 months are best kept out of direct sun; small amounts of sunscreen on exposed areas are acceptable when shade and clothing are not possible.', level: 'established', source: 'aapSun' },
      { text: 'Zinc oxide and titanium dioxide have the strongest safety data; several other filters are still being reviewed by regulators. That is a different claim from "sunscreen causes cancer", which the evidence does not support.', level: 'supported', source: 'fdaSun' },
      { text: 'Sunlight makes vitamin D, but how much depends on skin colour, season, time of day, latitude and clothing. There is no established "5 minutes" or "30-60 minutes" rule for children.', level: 'unknown', source: 'nihVitD' },
      { text: 'For breastfed infants, 400 IU (10 µg) of vitamin D a day is recommended by the AAP; formula already contains it.', level: 'established', source: 'nihVitD' },
    ],
    options: [
      { name: 'Shade', strengths: ['Cuts UV a lot'], weaknesses: ['Does not remove reflected UV'] },
      { name: 'Long sleeves and UV clothing', strengths: ['A reliable barrier'], weaknesses: ['Can be hot'] },
      { name: 'Wide-brimmed hat', strengths: ['Face, ears and neck'], weaknesses: ['Only the head'] },
      { name: 'Sunscreen (SPF 30+, broad spectrum)', strengths: ['Protects what clothes cannot'], weaknesses: ['Thick enough, and again every 2 hours and after swimming'], timing: 'From 6 months; small areas only before' },
      { name: 'Timing', strengths: ['Avoids the strongest UV (late morning to mid-afternoon, or when the UV index is 3 or more)'], weaknesses: ['Does not suit every day'] },
      { name: 'Combination', strengths: ['Each covers what the others miss'], weaknesses: ['More to remember'] },
    ],
    changes: ['Age (under 6 months: shade and clothes).', 'The UV index - in much of South Africa it is high most of the year.', 'Skin type.', 'Whether vitamin D comes from formula, a supplement, or the sun.'],
    align: ['Our usual combination, and what we do at the pool and beach.', 'Vitamin D: supplement or not - ask the clinic.'],
    family: ['Please keep the baby in the shade and covered; ask us before using sunscreen under 6 months.'],
  },
  {
    id: 'monitors', v: 1, section: 'decide', title: 'Baby monitors', ages: { from: 0, to: 36 },
    question: 'What problem does a monitor solve - and does it change what we would do?',
    summary: 'Audio and video monitors let you hear or see the baby from another room. Consumer devices that track breathing, heart rate or oxygen go further, but none has been shown to prevent SIDS, and false alarms are common. More information is not always more useful information.',
    why: [
      { text: 'Home heart-rate and oxygen monitors should not be used as a way to reduce the risk of SIDS; they have not been shown to prevent it.', level: 'established', source: 'aapSleep' },
      { text: 'The FDA warned in September 2025 against unauthorised infant vital-sign monitors: they may miss real problems, raise false alarms, or cause burns and rashes. No device is authorised to prevent SIDS.', level: 'established', source: 'fdaMonitors' },
      { text: 'False alarms can cause anxiety, extra hospital visits and broken sleep - for parents and baby.', level: 'supported', source: 'aapSleep' },
    ],
    options: [
      { name: 'Direct observation', strengths: ['Nothing to fail or misread'], weaknesses: ['Baby must be near'], fits: 'Room-sharing, daytime naps nearby' },
      { name: 'Audio monitor', strengths: ['Simple, cheap'], weaknesses: ['Only sound'] },
      { name: 'Video monitor', strengths: ['See without going in'], weaknesses: ['Can turn into constant watching'] },
      { name: 'Consumer health monitor', strengths: ['Some feel reassured'], weaknesses: ['Not shown to prevent SIDS', 'False alarms', 'Accuracy varies'] },
      { name: 'Monitoring a doctor prescribes', strengths: ['For a specific medical reason, with support'], weaknesses: ['Only when indicated'] },
      { name: 'Combination', strengths: ['For example: room-sharing, safe sleep, a look in - and no physiological monitor'], weaknesses: [] },
    ],
    changes: ['House layout - how far the baby sleeps from us.', 'A medical reason a doctor has given.', 'How we each react to alarms and numbers.'],
    align: ['What we want a monitor to do - and whether it would change what we do.', 'That a monitor never replaces safe sleep.'],
  },
  {
    id: 'predelivery', v: 1, section: 'ready', title: 'Before the baby arrives', ages: { from: -4, to: 1 }, kind: 'checklist',
    question: 'What is easier to sort out before the birth than after it?',
    summary: 'A starting list - tick what is done, remove what does not apply and add your own.',
    items: [
      'Car seat bought and fitted (practise before the day)', 'Hospital bag packed, with the paperwork and medical aid card',
      'Paediatrician or clinic chosen', 'Medical aid: how and by when to add the baby (most schemes set a deadline)',
      'Home Affairs: what is needed to register the birth (within 30 days)', 'Cot or bassinet set up for safe sleep - firm, flat, nothing soft',
      'Infant first-aid course done by both of us', 'Emergency numbers saved on both phones',
      'Thermometer (digital, underarm)', 'Nappies, wipes and a barrier cream - see Diapers, wipes and creams',
      'Newborn clothes: a few vests and sleepsuits in newborn and 0-3 months', 'Freezer meals for the first weeks',
      'Who helps in the first weeks, and when', 'Visitor rules agreed - see Visitors and kissing newborns',
      'Pets: how they will meet the baby', 'Smoke alarm working',
    ],
  },
];

// Not written yet: shown so the whole list is visible, with a section and the ages it matters.
const LATER = [
  ['dummies', 'decide', 'Dummies', 0, 48], ['sugar', 'decide', 'Sugar: when and how much', 0, 72], ['screens', 'decide', 'Screen time', 0, 216],
  ['cryitout', 'decide', 'Crying it out, and the alternatives', 4, 36], ['regulation', 'decide', 'Dysregulation and self-regulation', 12, 144],
  ['potty', 'decide', 'Potty training', 18, 48], ['daycare', 'decide', 'Daycare', 3, 72], ['homeschool', 'decide', 'Homeschooling', 48, 216],
  ['allergies', 'decide', 'Food and allergies', 4, 60], ['foodrules', 'decide', 'Food and drink: do’s, don’ts and why', 4, 60],
  ['medicalaid', 'decide', 'Medical aid for the baby', -6, 216], ['newused', 'ready', 'New or second-hand', -6, 60],
  ['bottles', 'ready', 'Bottles and teats', -2, 18], ['sterilising', 'ready', 'Sterilising: how and for how long', -1, 12],
  ['glassplastic', 'ready', 'Glass or plastic (bottles, containers)', -2, 72], ['nappies', 'ready', 'Disposable or cloth nappies', -3, 36],
  ['wipes', 'ready', 'Diapers, wipes and creams', -3, 36], ['powders', 'ready', 'Powders: risks', -3, 36],
  ['stock', 'ready', 'Medicines and creams to keep at home', -2, 144], ['clothes', 'ready', 'Clothes: layers, materials, how many', -3, 36],
  ['stairs', 'ready', 'Stairs and heights', 4, 48], ['pets', 'ready', 'Pets and the baby', -3, 72],
  ['milestones', 'ages', 'Milestones by age', 0, 72], ['leaps', 'ages', 'Leaps and developmental jumps', 0, 24],
  ['poop', 'normal', 'Normal poop: colour and consistency', 0, 36], ['rashes', 'normal', 'Rashes', 0, 144],
  ['falls', 'emergency', 'Falls and bumps to the head', 0, 144], ['breathing', 'emergency', 'Stopped breathing', 0, 144],
  ['rules', 'rules', 'Our house rules', 12, 216], ['grandparents', 'rules', 'Grandparents: boundaries and the reasons', -3, 216],
  ['visitors', 'rules', 'Visitors, illness and kissing newborns', -1, 6], ['sleepovers', 'rules', 'Sleepovers', 36, 216],
  ['exhausted', 'rules', 'Exhausted nights: a system', -1, 24], ['public', 'out', 'Out in public: crowds and germs', 0, 6],
  ['water-safety', 'out', 'Water safety and swimsuit colour', 6, 144],
];

export const STARTER = [
  ...WRITTEN.map((t) => ({ kind: 'decision', ...t, starter: true })),
  ...LATER.map(([id, section, title, from, to]) => ({ id, v: 0, section, title, ages: { from, to }, kind: 'decision', starter: true, later: true })),
];

export const SOURCES = S;
