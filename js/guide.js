// The "How to use" content, the search over it, and the privacy/about text.
// Plain data so it can grow without touching layout code.

// Each app term carries the everyday words a person might search with instead.
export const SEARCH_ALIASES = {
  later: ['postpone', 'not now', 'put off', 'snooze', 'defer', 'missed', 'skip'],
  'do something now': ['five minutes', 'spare time', 'what should i do', 'quick job', 'suggest', 'find a task', 'execute'],
  chore: ['housework', 'cleaning', 'job', 'tidy'],
  plan: ['add a chore', 'create', 'new chore', 'set up', 'schedule', 'how often', 'sample', 'examples', 'ideas', 'which chores', 'starter'],
  'drive folder': ['google drive', 'sync', 'cloud', 'save to drive', 'lost', 'safe', 'other laptop', 'another computer', 'backup', 'back up'],
  'family file': ['phone', 'mobile', 'iphone', 'android', 'export', 'import', 'transfer', 'move to another device', 'save a copy', 'download'],
  backup: ['restore', 'undo everything', 'go back', 'old version', 'recover'],
  'two places': ['conflict', 'both changed', 'overwrite', 'which one', 'clash'],
  'mini-app': ['module', 'install', 'uninstall', 'remove', 'add on', 'plugin', 'extension', 'turn off', 'disable'],
  dashboard: ['home screen', 'tiles', 'buttons', 'reorder', 'hide', 'rearrange'],
  'who are you': ['profile', 'switch person', 'login', 'sign in', 'user', 'account'],
  example: ['demo', 'sample', 'fake data', 'pretend family'],
  room: ['kitchen', 'bathroom', 'area', 'place'],
  review: ['keeps getting missed', 'never gets done', 'too much', 'overwhelmed', 'falling behind'],
  music: ['song', 'songs', 'playlist', 'audio', 'mp3', 'sound', 'spotify'],
  timer: ['start', 'countdown', 'how long', 'minutes'],
  ticket: ['note', 'remember', 'complaint', 'thank you', 'appreciation', 'concern', 'idea', 'log'],
  'family meeting': ['weekly meeting', 'talk', 'discuss', 'agenda', 'check-in'],
  decision: ['agreement', 'experiment', 'try', 'trial', 'rule'],
  principle: ['value', 'values', 'rules', 'guideline', 'agreement'],
  task: ['to do', 'todo', 'errand', 'repair', 'project', 'job'],
  'bring in data': ['import', 'csv', 'spreadsheet', 'excel', 'google sheets', 'template', 'upload', 'existing', 'already have'],
  recipe: ['meal', 'meals', 'cooking', 'food', 'dinner', 'menu'],
  variation: ['version', 'versions', 'variant', 'alteration', 'different way', 'swap', 'sauce', 'cheese sauce', 'without', 'instead of'],
  'shopping list': ['groceries', 'shop', 'buy', 'ingredients'],
  trip: ['holiday', 'vacation', 'travel', 'packing', 'itinerary'],
  budget: ['money', 'spending', 'expenses', 'finance', 'savings', 'debt'],
  'money plan': ['plan', 'goals', 'afford', 'can we afford', 'timeline', 'save each month', 'forecast', 'emergency fund', 'all our goals'],
  'children’s future': ['children', 'kids', 'school fees', 'university', 'studies', 'education', 'tuition', 'first car', 'wedding', 'save for school', 'baby'],
  job: ['job offer', 'offer', 'salary', 'career', 'new job', 'take-home', 'take home', 'payslip', 'tax', 'paye', 'increase', 'raise', 'relocate', 'relocation', 'moving for work', 'payback'],
  'our bond': ['bond history', 'extra payments', 'pay extra', 'paid more', 'access bond', 're-advance', 'took money out', 'withdraw from bond', 'bond balance', 'rate change', 'minimum payment'],
  'sell to buy': ['sell our house', 'selling costs', 'agent commission', 'agent fees', 'bond cancellation', 'compliance certificate', 'electrical certificate', 'beetle certificate', 'transfer costs', 'attorney fees', 'conveyancing', 'deeds office', 'bond registration', 'deposit from the sale', 'hidden costs'],
  'own or rent': ['rent or buy', 'buy or rent', 'renting', 'is renting better', 'sell and rent', 'keep our house', 'invest the difference', 'maintenance', 'upgrade', 'capital gains'],
  home: ['house', 'bond', 'mortgage', 'home loan', 'rent', 'renting', 'buy a house', 'transfer duty', 'commute', 'travel to work', 'closer to work', 'move', 'moving'],
  'true cost': ['fuel', 'petrol', 'diesel', 'electric car', 'ev', 'hybrid', 'plug-in', 'charging', 'kwh', 'fuel consumption', 'litres per 100', 'insurance', 'service', 'oil', 'tyres', 'car', 'vehicle', 'car finance', 'loan', 'instalment', 'balloon', 'resale', 'total cost of ownership', 'compare cars'],
  'compound interest': ['interest', 'grow', 'growth', 'investment', 'savings growth', 'calculator', 'inflation'],
  activity: ['exercise', 'sport', 'walk', 'run', 'fitness', 'move'],
  calories: ['kcal', 'kilojoules', 'nutrition', 'nutrients', 'how much is in', 'food values'],
  assistant: ['healthy', 'healthier', 'improve a meal', 'suggestions', 'pregnant', 'iron', 'protein', 'picky eater', 'fussy'],
  section: ['category', 'area', 'group'],
  'reading plan': ['bible', 'scripture', 'devotion', 'faith', 'chapter'],
};

export function searchText(text) {
  const low = String(text || '').toLowerCase();
  let extra = '';
  for (const [term, syns] of Object.entries(SEARCH_ALIASES)) {
    if (low.includes(term)) extra += ` ${syns.join(' ')}`;
  }
  return low + extra;
}

/** Every word of the query must appear. */
export function guideMatches(text, q) {
  if (!q || !q.trim()) return true;
  const hay = searchText(text);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export const HOWTOS = [
  { id: 'quick', title: 'Find something to do right now', steps: [
    'On the home screen, press Chores. It opens on "Do something now".',
    'Optionally say how much time you have, how your energy is, and where you want to be.',
    'Pick any suggestion and press Done when it is finished - or Start, for a timer and optional music. The ring fills to the expected time and turns honey if it takes longer; Done records how long it took, Cancel records nothing.',
    'Do another one if you like, or press "Finish". Stopping is always fine.',
  ] },
  { id: 'drive', title: 'Keep everything safe in your Google Drive folder (computer)', steps: [
    'Install Google Drive for Desktop (free, from Google) and sign in. Your Drive appears as a folder on the computer.',
    'In Family Hub, open Settings, then Google Drive, and press "Choose folder". Use Chrome or Edge.',
    'Pick a folder in your Drive, for example My Drive. Family Hub makes a FamilyHub folder inside it and saves everything there.',
    'The status at the top says "Saved to Drive" after each change. On another laptop, do the same and pick the same FamilyHub folder.',
    'Every step, phones and the home screen included, and what can go wrong: "Phone and laptop" at the bottom of any page.',
  ] },
  { id: 'phone', title: 'Use Family Hub on a phone', steps: [
    'Set it up on a computer first (Keep everything safe in your Google Drive folder). From then on, that laptop keeps one file for phones up to date: FamilyHub › Phone › "Family Hub.json".',
    'On the phone, open the same web address (add it to the home screen). Press "Get family", or Settings, "Get latest", and choose Google Drive › FamilyHub › Phone › "Family Hub.json". Your family is on the phone.',
    'To send the phone’s changes back: tap "Send" at the top (it lights up when there is something to send), choose Drive, and save into the FamilyHub › Phone folder. The next time a laptop has Family Hub open, it adds them in by itself - nothing to press.',
    'Before planning something big on the phone, tap "↓ Get" at the top first. Combining always keeps everything from both sides, and asks only when the same thing was changed in both places.',
    'iPhone: install the Google Drive app and sign in, then open Apple’s Files app, Browse, ⋯, Edit, and switch Google Drive on. Android: tap ☰ in the window and choose Drive.',
    'Every step, the home screen included, and what can go wrong: "Phone and laptop" at the bottom of any page.',
  ] },
  { id: 'reconnect', title: 'The top says "Not in Drive yet"', steps: [
    'After the browser restarts it may ask again before Family Hub can use your folder. Press Reconnect on the notice, then Allow.',
    'Your changes were kept on this device in the meantime and are saved to the folder as soon as you reconnect.',
  ] },
  { id: 'conflict', title: 'Something was "changed in two places"', steps: [
    'This happens when two laptops changed the same thing before Drive had passed the change along.',
    'Press Choose on the notice. Each item shows both versions - pick the one to keep. Everything else was already combined.',
    'Nothing is overwritten until you choose. "Decide later" leaves it waiting.',
  ] },
  { id: 'backup', title: 'Make a backup, or go back to one', steps: [
    'Settings, Google Drive, "Back up" saves a complete copy in the folder’s Backups folder.',
    'To go back, press Restore next to a backup. The household is replaced by the backup; mini-app records are combined.',
    'Google Drive also keeps earlier versions of every file: right-click it in Drive, Manage versions.',
  ] },
  { id: 'add', title: 'Plan a new chore', steps: [
    'Open Chores, then the Plan tab.',
    'Press "New chore". Only the name is needed.',
    'Not sure what to add? Press Samples: pick a room (Kitchen, Bathroom, Baby room...), tick what fits your home, choose which room it goes into, and press Add.',
    'Choose how often, roughly how long, and how much effort it takes, if you know.',
    'Open "More details" for instructions, who can do it, and what it depends on.',
  ] },
  { id: 'later', title: 'A chore I could not get to', steps: [
    'Leave it for later. A chore shows when it is due and stays on the list until it is done - a daily one is there tomorrow, a weekly one carries on day by day.',
    'Missing it never doubles it up: there is only ever one of each chore waiting.',
    'A one-off job that is no longer needed: open it under Plan, press Edit, then Delete.',
  ] },
  { id: 'music', title: 'Play music while you work', steps: [
    'Put music files in your Drive folder under Data, Media, Music (or, on a phone, choose files in Settings, Music).',
    'Press Start on a chore. Family Hub asks "Music while you work?" - press Play music, or No thanks.',
    'Tick "Remember my answer" to stop being asked. Settings, Music, sets what happens when the timer ends: stop, fade out, keep playing, or ask.',
    'Done always works, whatever the music is doing.',
  ] },
  { id: 'ticket', title: 'Log a ticket in seconds', steps: [
    'Open Tickets. Choose the kind - appreciation, concern, idea and so on.',
    'Write a sentence and press Save. No need to solve anything or decide who is responsible.',
  ] },
  { id: 'meeting', title: 'Hold the weekly family meeting', steps: [
    'Open Tickets, then Family meeting.',
    'Read out what went well first.',
    'Choose which concerns or ideas to talk about now; the rest wait.',
    'For each: talk it through, then make a decision or experiment, turn it into a task, put it off, or close it.',
  ] },
  { id: 'decision', title: 'Try a decision as an experiment', steps: [
    'Open Decisions, New decision (or "Make a decision" from a ticket).',
    'Write what you agree to try, then press "Start trying". You will be invited to look back in two weeks.',
    'Add observations as you go. When it is time, press "Look back" and choose: keep it, change it, stop, or try something else.',
  ] },
  { id: 'import', title: 'Bring in data you already have (recipes, chores, tasks)', steps: [
    'Open Settings, then "Bring in data", and press "Download template" for the kind you need. (With your Drive folder connected, the templates are also in its Import/Templates folder.)',
    'Fill it in with a spreadsheet - Excel, Google Sheets or Numbers. Keep the first row; columns marked * are needed.',
    'Save it as CSV. Then either press "Import" in Settings, or put the file in the Import folder inside your Family Hub Drive folder.',
    'Things whose name already exists are left alone, so nothing is doubled. Lines with a problem are listed by line number.',
  ] },
  { id: 'meals', title: 'Plan the meals and make the shopping list', steps: [
    'Open Meals, then Meal Planner. Step 1, gather: press "+ Add" and choose a meal - or just type one, like "Carrots" - or press "Suggest meals" for a mix of favourites and new ones. No need to decide which meal or which day yet.',
    'Changed your mind about a meal? Drag it to the bin that shows at the right-hand edge while you drag - from the list or from a day. "Clear" under step 1 takes all planned meals off the list to start over (meals already on days stay). Both can be undone straight after.',
    'Rather cook them in any order? Press "To Shopping" right there under step 1: everything the planned meals need goes to the list, with no sorting or days. Each sent meal gets a ✓, and Cook today shows them under "Any day" - drag the one you feel like onto today.',
    'Step 2, sort: drag each gathered meal into Breakfasts, Lunches, Dinners or Snacks (on a phone, press and hold first). Or open a meal and choose its meal there. The little B, L, D and S circles on a meal say what it is good for - open the meal and press Change next to "Good for" to set them, for example after cooking it.',
    'Press Assign: the planned meals sit beside a calendar. Drag each one onto a day (on a phone, press and hold first) - a week at a time, or a whole month. It keeps the meal it was sorted into (a lunch stays lunch) unless you drop it on another meal’s row. Drag one back to the list to take it off its day.',
    'Calendar shows just the calendar. Drag a meal to another day to swap them; tap a meal to open it, change it, or rate it.',
    'Press "To Shopping" and say which days you are shopping for - from the day you shop, say Wednesday, for 7 days. Their meals’ amounts are added up, scaled to the servings you chose; untick what you already have.',
    'On the day, open Cook today: today’s meals, and at the bottom every meal of that shop. In the mood for another one? Drag it onto today’s and the two swap days. Where you can drop is outlined, and the place under your finger lights up.',
    'Tick things off in Shopping as you buy them. Added a meal, or more people? Send again: only what is new goes over - each meal is asked for once, even when two shops overlap or the first lot was bought.',
  ] },
  { id: 'shopping', title: 'Keep one shopping list', steps: [
    'Open Shopping from the home screen. Type what you need, or choose a kind - Food, Cleaning, Hygiene, Medical, Stationery... - to see the things you buy and add them with "+ Add".',
    '"Ours" shows what the family has bought before or added; "Everything" also shows common things of each kind, for something you are buying for the first time. Anything not there: "+ Add ...".',
    'At the shop, press "Start shopping": just the list, big, by aisle. "Done" clears what you bought.',
    'Send things to it from elsewhere: "To Shopping" on a meal, "To Shopping" in Meal Planner, or a chore’s supplies in Chores.',
    'You see what is being sent and untick what you already have before it is added.',
  ] },
  { id: 'portions', title: 'See how much each person might eat', steps: [
    'Open a meal in the Cookbook. "Portions for the family" shows a rough share for each person, from their age, gender, height and weight on the People page.',
    'Choose who is eating and whether you want leftovers, then press the "Use ... servings" button to scale the ingredients.',
    'An adult can set an energy goal on the People page (for example about 500 kcal a day less); their portion follows it. Appetites vary - let everyone eat to their hunger.',
  ] },
  { id: 'meal-to-recipe', title: 'Build a meal and turn it into a recipe', steps: [
    'In Calorie Checker, choose "Family" or one person, and add foods in the amounts you use - they build up into an item.',
    'Press "Save as a meal", give it a name and save. It is a meal: a name and its ingredients.',
    'Whenever you like, edit it and add the method. Once it has steps, it is a recipe. Every recipe is a meal; not every meal is a recipe.',
  ] },
  { id: 'assistant', title: 'Get an easy idea to improve a meal', steps: [
    'On the People page, press "Food details" for each person: birthday, allergies, pregnancy, and what they would like more of. All optional.',
    'Open Meals, then Meal Assistant. Choose who is eating, type the meal in a few words ("oats with butter and sugar") and press Get ideas.',
    'Or open one of your recipes from the list (or press "Improve" on a recipe in the Cookbook) to see ideas for it.',
    'On a recipe, press "Apply" on each idea you like. At the bottom, Replace puts them into the recipe and New saves a new version - either way you check the ingredients before saving.',
    'Each idea says who it helps and why. Press "Not today" to keep it for next time, or "No thanks" to hide it.',
  ] },
  { id: 'plan-meal', title: 'Plan a meal with leftovers or guests', steps: [
    'In Meal Planner, open Calendar and press + on a day (or drag a planned meal onto it). Search or filter your meals (protein, rating, someone’s favourite, quick ones under 20 minutes) and press Choose.',
    'Set how many are eating and the leftovers: cook extra to decide later, or set portions aside for a later meal. The later meal shows them as already cooked.',
    'Open the planned meal to add guests, change its ingredients for this time only, add a note, or send it to Meal Assistant for ideas.',
  ] },
  { id: 'ingredients', title: 'Add ingredients, and use your own sauces in other recipes', steps: [
    'In the Cookbook, press Add an item (or Edit) and say what it is - or leave it as an item for now: a meal (what the family eats at one sitting), a recipe (one thing, like a cake) or an own ingredient (like home-made mayo). Press "+ Ingredient", start typing and pick from the list - ✓ means its calories count.',
    'Enter the total amount for the whole recipe and choose the unit. Say what one batch makes, e.g. 12 pancakes.',
    'For something home-made like mayo, make it an own ingredient and choose what one batch makes from the list (leave the amount empty with g and it is the weight of its ingredients, e.g. 239 g). Anything of your own can go into another entry - when adding an ingredient, the chips choose what to search: All, Meals, Recipes, Own ingredients or Ingredients (the food database).',
    'Have the list somewhere else? "Import .csv" takes columns ingredient, amount, unit and note - "Download an example file" shows the layout. Pick each line from the list afterwards so its calories count.',
    'Enter what you buy: after picking a food, the unit list has its own sizes (½ head of lettuce, 1 cucumber, 1 tin) and the weight shows next to the line. Not there? Choose "+ Add our own size" and type it off the packet once.',
    'When planning, the recipe is made x1, x1.5 or x2 so eggs and other whole-only items stay whole.',
    'Already made the mayo? When sending to the shopping list, tick "We already have the Home-made mayo" under Made at home - its eggs and oil are left off.',
  ] },
  { id: 'rate', title: 'Rate a meal and record favourites', steps: [
    'Open a meal in the Cookbook. Tick "We have tried it", then choose a family rating from 1 to 10.',
    'Set each person’s preference - favourite, likes, neutral or dislikes. A 7/10 meal can still be one child’s favourite.',
    'Add notes for next time. A note about one particular meal goes on that day in Meal Planner.',
  ] },
  { id: 'people', title: 'Add the family', steps: [
    'Open People from the home screen. Type a name and a birthday, and press Add person.',
    'With a birthday, Family Hub shows whether someone is a baby, toddler, child, teen or adult, and keeps it up to date. Without one, choose adult or child.',
    'Choose a gender, then press Food details for allergies, diet and what they would like more of.',
  ] },
  { id: 'measures', title: 'Keep a record of height and weight', steps: [
    'Open People from the home screen and open "Height and weight" under the person.',
    'Enter the date, a weight, a height or both, and a note if you like ("clinic visit"), then press Add.',
    'The list shows every entry with its full date - useful when a doctor asks what someone weighed and when.',
  ] },
  { id: 'calories', title: 'Check what is in a food', steps: [
    'Open Meals, then Calorie Checker, and look up the food.',
    'Choose the amount - a cup, a slice, or grams - to see the calories and nutrients in what you actually eat.',
    'Not sure what to look for? Browse the everyday foods: choose a type of food, a colour, or "Sort by - most protein / fibre / fat / carbs first", 15 at a time. A good way to discover foods like tofu or lentils. "All foods" browses all 13,000.',
    'Press "Add to the item" to add several foods up. Nothing is saved or logged.',
  ] },
  { id: 'places', title: 'Keep a list of places to go nearby', steps: [
    'Open Holidays, then Places to go, and press "New place". Say where (pick a town you used before), what kind of place it is, and tick what it is good for - great for kids, play area, pet friendly, free...',
    'On a free day, filter by area, kind and "good for" to find somewhere. Press "We went" afterwards, and say how it was.',
  ] },
  { id: 'trip', title: 'Plan a trip', steps: [
    'Open Holidays and press "New trip". Only a name is needed - dates can come later.',
    'Add the plan day by day, start a packing list (each item can be for one person), and add costs against a budget.',
  ] },
  { id: 'budget', title: 'Keep a monthly budget', steps: [
    'Open Finance. Add the categories you want to watch with a planned amount.',
    'When you spend something, add it under "Spent something?". The table shows what is left in each category.',
    'Next month, press "Reuse" with last month’s name.',
  ] },
  { id: 'ourbond', title: 'See what our extra bond payments did', steps: [
    'Open Finance, then Homes, and Add a home: "Ours already". Under The bond, put in the bond when it started, the month, the years and the rate then.',
    'Under "What happened, over the years", add a line for each thing: "Paid each month" for a period (R12 000 from 2020 to 2026), "Paid in once", "Took out" (R100 000 for a car), "Rate changed".',
    'Under "What if…", add "Pay more each month" from now: the graphs show the bond with it and without it, and how many months sooner it is paid off.',
  ] },
  { id: 'selltobuy', title: 'Sell our home to buy the next one', steps: [
    'Open Finance, then Homes, and Add a home: "Buying". Put in the price of the one you would buy.',
    'Tick "Selling our current home first": what your home will sell for, what is still owed on it, the agent’s commission - and what to keep back for renovations and a reserve.',
    'It works out the cash from the sale, item by item, pays the new deposit and buying costs from it, and keeps the rest invested.',
  ] },
  { id: 'variations', title: 'Make one meal several ways (variations)', steps: [
    'Open the meal in the Cookbook and press Variations.',
    'Type a name - "Cheese sauce" - and press Add. Tap what it leaves out, add what it needs with the ingredient search (to swap, do both), and add any extra steps. Save.',
    'On the meal, tap a variation to see its ingredients, method and what is in it. "Plan it" and "To Shopping" use the variation shown.',
    'A planned meal can be switched between variations under "Which way" - the shopping list and cooking follow.',
  ] },
  { id: 'moneyplan', title: 'See whether all our plans fit', steps: [
    'Open Finance, then Money plan. Fill in the money coming in after tax and the monthly commitments - or press "Use these" to take them from this month’s budget.',
    'Under "Bring in from the other apps", press Add for trips with a budget, saving goals, saved cars and homes, and each child. Or add your own goal with an amount and a month.',
    'It says what to put aside each month, whether everything fits, and for each goal that does not: how much it is short, how many months later would fit, or how much smaller.',
    'Under "What if we take a new job?", choose a saved offer to see the plan with that job and its move.',
  ] },
  { id: 'children', title: 'Plan for the children’s big costs', steps: [
    'Make sure each child has a birthday in People - the ages come from there.',
    'Open Finance, then Children’s future. It shows what to put aside each month for studies and starting out, and when school fees and the like step up the monthly budget - for each child and all of them together.',
    'Press "Change … list" on a child to tick what fits, put in your own school’s fees, choose "From budget" or "Save ahead" for each, and add your own (braces, a gap year).',
    'The year-by-year table shades the years when more than one child has costs, so a crowded year shows early.',
  ] },
  { id: 'job', title: 'Compare a job offer with the job you have', steps: [
    'Open Finance, then Job offers. Fill in the job you have now: the salary, and the take-home from your payslip if you have it. Save it as "Staying".',
    'Change it for the offer: its salary (the take-home is estimated with the SARS tables until you have a payslip), the yearly increase you expect, travel and other costs it changes, and moving costs if it means moving. Save it with the company’s name.',
    'Tick both and press Compare. Choose which one to compare with, and over how many years.',
    'It says which leaves the household better off, what cash a move needs first and how long saving it takes, and how long the move takes to pay back.',
  ] },
  { id: 'home', title: 'Compare homes - buying, renting, or keeping ours', steps: [
    'Open Finance, then Homes. Add a home: "Buying", "Ours already" or "Renting". Each is one page, in sections.',
    'Fill in what applies. Tick a section "Left out" to leave it out (travel, say, when both homes are the same distance from work), and fold away what you do not need. Tap (i) beside any heading or figure to see what it is and where to find yours.',
    'Give it a name, like "Closer to work", and press Save. Add the next home the same way.',
    'Press Compare and tick any of your homes - a house against a house, against a rental, or against keeping the one you own. Each has the same money every month; whoever needs less invests the difference.',
  ] },
  { id: 'ownrent', title: 'Own or rent - with your own numbers', steps: [
    'Save the home you might buy (or the one you own, as "Ours already") and the place you might rent, each in Homes.',
    'For selling yours to rent, tick "Selling our current home first" on the rental: what the sale leaves is invested while you rent.',
    'Press Compare and tick both. "Where each would leave you" shows, year by year, what each would leave you - and when the other one starts to leave you more.',
  ] },
  { id: 'car', title: 'Work out the true cost of a car - and compare', steps: [
    'Open Finance, then Cars. Fill in the price, the rate on your quote, how long the loan runs and how long you will keep the car.',
    'Choose what it runs on - petrol, diesel, hybrid, plug-in hybrid or electric - and the distance you drive a year. Fuel or charging is worked out from the consumption and the current price. Add insurance, the yearly service, oil, tyres and licence for the full picture.',
    'Give it a name, like "Polo over 6 years", and press Save. Change the term, give it a new name and Save again.',
    'Tick two or more saved ones and press Compare to see them side by side, with the differences in words.',
    'Choose Advanced for every fee, the balloon and a timeline - or Learn to see each sum worked out with your numbers.',
  ] },
  { id: 'exercise', title: 'Log exercise and plan to move more', steps: [
    'Open Exercise, then "Log activity". Tick everyone who took part - doing it together counts for the family.',
    'In "Plans and goals", add a flexible plan like "walk three times a week", and set your own weekly minutes goal.',
  ] },
  { id: 'reading', title: 'Follow a Bible reading plan', steps: [
    'Open Faith and press "New plan". Choose the Gospels, a book, or your own selection, and how many chapters at a time.',
    'Press "Read it" after each reading. There is no schedule and no catching up - it simply remembers where you are.',
    'Press "About ..." next to the reading for who wrote the book, when, to whom, why and what it is about.',
  ] },
  { id: 'journal', title: 'Keep a faith journal, and the questions you are working on', steps: [
    'In Faith, press "New entry" (Journal tab). Choose the kind - a reflection, a question, a message you heard... - and give it a heading.',
    'Add the questions it is trying to answer, each with where it stands: only the question so far, needs more reading, or found a reasonable answer.',
    'Add the passages it is about from the lists - version, book, chapter and verses - as many as you need. Tick topics like Marriage or End times, and add finer terms of your own like tattoos or trinity.',
    'A topic that is not listed? Type it under the topics and press "+ Topic" - it is added to the list and ticked. "Edit topics" (also in the Bible guide) hides ones you do not use, shows them again, and removes your own.',
    'Look back in the Journal tab with filters, and go through your questions in the Questions tab. The Bible guide shows where to start reading on a topic, with the passages and questions you have logged on it underneath.',
    'In the Bible guide, press "+ Notes" under Why or What it is about to keep your own notes on a book.',
  ] },
  { id: 'modes', title: 'Plan, check or do', steps: [
    'Under the mini-apps on each section page, open "Extra help". It groups what you can do by the time you have: Plan (time to sit and think), Check (a quick look, or writing something down) and Do (20 minutes to an hour to get things done).',
    'For example in Meals: plan the next meals; check what is in a food or write down a meal to try; cook today’s meals.',
  ] },
  { id: 'miniapps', title: 'Turn off, remove or add mini-apps', steps: [
    'Open Mini-apps from the home screen.',
    'Turn off: it stops loading, everything is kept. Uninstall: it is removed, its records stay in your folder for a reinstall.',
    'To delete an uninstalled app’s records, use "Delete records" - this is separate and asks first.',
    'To add someone else’s mini-app, copy its folder into MiniApps/ThirdParty in your Drive folder, then press "Look again" and review it.',
  ] },
  { id: 'who', title: 'Say who is using the app', steps: [
    'Press the person button at the top right ("Who are you?").',
    'Choose your name. Completed chores are recorded under that name, and your dashboard order is your own.',
    'This is a convenience, not a login: anyone using this device can choose any name.',
  ] },
  { id: 'dash', title: 'Rearrange or hide dashboard buttons', steps: [
    'Open Settings, then "Your dashboard".',
    'Drag a row to where you want it (on a phone, press and hold first), or use the arrows. Hide tucks a button away; hidden ones can be shown again.',
  ] },
  { id: 'demo', title: 'Remove the example family', steps: [
    'Press "Remove examples" on the notice, or in Settings under "Your data".',
    'Only the example records go. Anything you added yourself stays.',
  ] },
];

/**
 * Connect your laptop and phones (D-063): every step to put the family in your Google Drive,
 * get it onto a phone and its home screen, use it day to day - and what can go wrong.
 * `{address}` is replaced with the address Family Hub is open at.
 */
export const CONNECT = {
  title: 'Connect your laptop and phones',
  intro: 'Family Hub keeps your family’s data in your own Google Drive - there is no Family Hub account and no company in between. A laptop saves straight into a folder in your Drive. A phone cannot do that, so it swaps one file with that folder. Set up a laptop first, then the phones.',
  how: [
    'Laptop: Google Drive for Desktop shows your Drive as a folder on the computer. Family Hub saves into a FamilyHub folder in it after every change, and Drive uploads it.',
    'Phone: keeps its own copy. "Get latest" opens FamilyHub › Phone › "Family Hub.json", which a laptop keeps up to date while Family Hub is open on it. "Send back" saves the phone’s changes as a new file in that same Phone folder; the next time a laptop has Family Hub open, it adds them in by itself.',
    'So phones stay in step as long as a laptop opens Family Hub now and then. Nothing a phone sends back is lost while the laptops are off - it waits in the Phone folder.',
  ],
  parts: [
    { id: 'laptop', title: '1. Set up the laptop (once per laptop)', steps: [
      'Use Chrome or Microsoft Edge on the computer. Firefox and Safari cannot save into a folder.',
      'Install Google Drive for Desktop - free, from Google (search for "Google Drive for desktop"). Sign in with the Google account the family will use. "Google Drive" now shows in File Explorer (Windows) or Finder (Mac), with "My Drive" inside it.',
      'Open Family Hub at {address}.',
      'Go to Settings › Google Drive and press "Choose folder". Choose Google Drive › My Drive - not Desktop or Documents.',
      'Allow access when the browser asks. If Chrome offers "Allow on every visit", choose that - then it will not ask again after a restart.',
      'Family Hub makes a FamilyHub folder in My Drive and saves everything there. The top of the page says "Saved to Drive" after each change.',
      'A second laptop: the same steps, choosing the same My Drive. Family Hub finds the FamilyHub folder already there and asks - "Use the folder’s family" is the right choice.',
      'Optional: put it in its own window with a desktop icon. Chrome: ⋮ › Cast, save and share › Install page as app. Edge: ⋯ › Apps › Install this site as an app.',
    ] },
    { id: 'drive-app', title: '2. Get Google Drive onto the phone (once per phone)', devices: [
      { name: 'iPhone', steps: [
        'Install "Google Drive" from the App Store (free, by Google LLC).',
        'Open it once and sign in with the same Google account as the laptop. Wait until your files show.',
        'Open Apple’s Files app and tap Browse at the bottom.',
        'Tap ⋯ (the circle with three dots, top right), then Edit.',
        'Switch Google Drive on, then tap Done. It now shows under Locations.',
        'Not there? Close Files fully (swipe it away) and open it again. Still not? Open the Google Drive app once more and check it is signed in.',
      ] },
      { name: 'Android', steps: [
        'The Google Drive app is usually there already; if not, install it from the Play Store (free, by Google LLC).',
        'Open it and check it is signed in with the same Google account as the laptop.',
        'That is all: in the window for choosing a file, tap ☰ (top left) and Drive is in the list.',
      ] },
    ] },
    { id: 'home-screen', title: '3. Put Family Hub on the phone’s home screen', devices: [
      { name: 'iPhone', steps: [
        'Open {address} in Safari.',
        'Tap the Share button (a square with an arrow pointing up) - at the bottom, or behind ⋯ on newer iPhones.',
        'Scroll down and tap "Add to Home Screen", then Add.',
        'From now on, open Family Hub from that icon - and only from that icon. On some iPhones it keeps its own copy, separate from Safari, so do step 4 after opening it there.',
      ] },
      { name: 'Android', steps: [
        'Open {address} in Chrome.',
        'Tap ⋮ (top right), then "Add to home screen" (or "Install app"), then Add.',
        'From now on, open Family Hub from that icon.',
      ] },
    ] },
    { id: 'first-time', title: '4. Get the family onto the phone (first time)', steps: [
      'Make sure a laptop is set up (step 1) and has had Family Hub open since your last change, so the phone file is fresh.',
      'Open Family Hub from the home-screen icon. On the welcome screen, under "Already using Family Hub on a computer?", press "Get family". (Already past the welcome? Settings › Google Drive › "Get latest".)',
      'In the window: iPhone - Browse › Google Drive › My Drive › FamilyHub › Phone › "Family Hub.json". Android - ☰ › Drive › My Drive › FamilyHub › Phone › "Family Hub.json".',
      'A notice says your family is on this device now. Choose who you are at the top (a convenience, not a login).',
    ] },
    { id: 'daily', title: '5. Use it day to day', steps: [
      'Laptops: nothing to do. Keep Google Drive for Desktop running (it starts with the computer). Every change saves; the top says "Saved to Drive".',
      'Phone, before you plan anything: tap "↓ Get" at the top of any page and choose "Family Hub.json" again (also in Settings › Google Drive). Opening the app after an hour away, it offers "Get latest" too.',
      'Phone, after making changes: tap "Send" at the top - it lights up (●) whenever this phone has something Drive does not, the shopping list and meals included. iPhone: in the share menu choose "Save to Files" › Google Drive › My Drive › FamilyHub › Phone › Save. Android: choose Drive, pick the folder FamilyHub › Phone, then Save. If a day goes by without sending, a reminder asks too.',
      'The next time a laptop has Family Hub open (within a couple of minutes), it adds the phone’s changes in, says so, and moves that file to Phone › "Brought in". The phone’s next "Get latest" then includes everything.',
      'If the same thing was changed on the phone and on a laptop, the laptop asks which to keep and shows both. Everything else is combined - nothing is overwritten without asking.',
    ] },
  ],
  problems: [
    { q: 'Google Drive is not in the Files app (iPhone)', a: 'The Google Drive app must be installed and signed in first. Then Files › Browse › ⋯ › Edit › switch Google Drive on › Done. If it still does not show, close Files fully and open it again.' },
    { q: 'The window only shows Recent or Downloads (Android)', a: 'Tap ☰ at the top left and choose Drive. If Drive is not listed, install the Google Drive app and sign in.' },
    { q: '"Family Hub.json" has an old date, like yesterday', a: 'A laptop only rewrites it while Family Hub is open there, and only when something changed - so an old date can simply mean nothing has changed. To be sure: open Family Hub on a laptop, wait for "Saved to Drive", give Google Drive for Desktop a minute to upload (its icon shows when it is busy), then press "Get latest" on the phone again.' },
    { q: 'I am not sure which file, or which folder, is the right one', a: 'The phone file is always FamilyHub › Phone › "Family Hub.json". On a laptop, Settings › Google Drive says which folder it is connected to. Files called "family-hub-…json" elsewhere (Downloads, My Drive) are copies saved earlier - not the one to use.' },
    { q: 'The phone’s changes did not arrive on the laptop', a: 'Only files saved inside FamilyHub › Phone are picked up, and only while Family Hub is open on a laptop. If you saved somewhere else, move the file into the Phone folder in the Google Drive app (⋮ › Move). Then open Family Hub on the laptop.' },
    { q: 'A file was moved to Phone › "Not brought in"', a: 'It held a different family, or it was damaged. The laptop’s notice says which. Usually the phone got its family from another Drive or account - get the family again from FamilyHub › Phone › "Family Hub.json" in the right Drive.' },
    { q: 'The phone is signed in to a different Google account', a: 'Simplest: sign the phone’s Google Drive app in to the same account as the laptop (the app can hold more than one account). Sharing the FamilyHub folder with another account also works in Drive, but how shared folders show in a phone’s file window differs between phones, so the same account is the reliable way.' },
    { q: 'The laptop says "Not in Drive yet", or asks to Reconnect', a: 'After the browser restarts it may ask again before it can use the folder. Press Reconnect, then Allow. Nothing is lost - changes wait on the laptop until then. Choosing "Allow on every visit" stops it asking.' },
    { q: '"Choose folder" is not there, or a folder cannot be chosen', a: 'Folders work on a computer, in Chrome or Edge. On a phone, or in Firefox or Safari, Family Hub uses the family file instead.' },
    { q: 'The phone opens empty, or shows the welcome again', a: 'The phone’s copy was lost or is a different one: the browser’s website data was cleared, it was opened in private browsing, or (on some iPhones) it was opened from Safari instead of the home-screen icon, which keep separate copies. Press "Get family" or "Get latest" - everything already sent back is in Drive.' },
    { q: 'Changes made on the phone disappeared', a: 'A phone’s changes reach Drive only when you press "Send back". If the phone’s website data was cleared before that, those changes are gone. Send back after each time you change something.' },
    { q: 'The laptop is asleep or closed', a: 'Nothing is lost. What phones send back waits in the Phone folder, and "Get latest" gives the last version a laptop wrote. It all catches up the next time Family Hub is open on a laptop.' },
    { q: 'Google Drive for Desktop is paused or signed out', a: 'Family Hub still saves into the folder on the laptop, but nothing reaches the phones. Click its icon (taskbar or menu bar), resume syncing or sign in again.' },
    { q: '"Send back" on iPhone does not show Google Drive', a: 'In the share menu choose "Save to Files" - Google Drive is listed there once it is switched on in the Files app (see the first question).' },
  ],
};

export const FAQS = [
  { q: 'Where is our data kept?', a: 'If you connected your Google Drive folder: in that folder, as ordinary files you can see and back up in Drive. Nobody else - including whoever made this app - can see it. If not: only in this browser, on this device, which is not a backup. The header always says which.' },
  { q: 'Will I lose my details when the app is updated?', a: 'No. Updates change the app, not your data. Data in your Drive folder or in this browser stays, and older data is brought up to date automatically.' },
  { q: 'Does the phone sync with Google Drive?', a: 'Half by itself. Phone browsers cannot keep a live link to a folder, and the only other way would be signing in to a Google app run by a publisher, which Family Hub deliberately avoids. So laptops keep FamilyHub › Phone › "Family Hub.json" up to date for phones, and add in whatever a phone sends back into that Phone folder. On the phone it is two buttons at the top of every page, Get and Send - one tap each, because a phone’s browser may only open or save a Drive file when you pick it.' },
  { q: 'What happens if two of us change something at the same time?', a: 'Different things are combined automatically - two chores ticked off on two laptops are both kept. Only when the very same detail was changed differently does Family Hub ask which to keep, showing both. Nothing is overwritten silently.' },
  { q: 'What happens when we miss a chore?', a: 'Nothing piles up. A repeating chore has one current turn: if it is missed, it simply stays ready until someone does it or skips it, then its normal cycle carries on. Missed chores are information about how much the week can hold, not extra work for tomorrow.' },
  { q: 'Why is a chore asking for a review?', a: 'If a chore has waited two whole cycles, the Plan tab gently asks whether the plan still fits. Nothing is added or changed unless you change it.' },
  { q: 'How are suggestions chosen?', a: 'Your filters remove what does not fit. What is left is ordered: ready chores before optional ones, important before ordinary, then whatever has waited longest for its own cycle, then the quickest. "Why these suggestions?" shows this with your current choices.' },
  { q: 'Does uninstalling a mini-app delete its data?', a: 'No. Uninstalling keeps its records in your folder, and reinstalling brings them back. Deleting the records is a separate step that asks first.' },
  { q: 'Is it safe to add someone else’s mini-app?', a: 'Family Hub runs it sealed off: no internet, no access to your other data, and only the permissions you approve when installing. But anything you let it see, it could misuse - so only install mini-apps from people you trust. If its files change later, it stops until you review the change.' },
  { q: 'Can I bring in the recipes (or chores, or tasks) I already have?', a: 'Yes. Settings, Bring in data: download the template, fill it in with a spreadsheet, and import it - or drop it into the Import folder in your Drive folder. Importing the same file twice adds nothing, because names that already exist are left alone.' },
  { q: 'Does Meals judge how healthy a meal is?', a: 'No. Meal Assistant never scores a meal or calls food good or bad - it offers one or two easy improvements, says who they help and why, and never claims anyone lacks something. Its food values come from USDA FoodData Central, and anything the source does not report is shown as "not known", never as zero. It is not medical or dietary advice.' },
  { q: 'Where did Health go?', a: 'Its food side is now the Meals section (Meal Assistant and Calorie Checker) and its activity side is Exercise. If you had added appointments, they are kept in your folder: Mini-apps lists Health under "Uninstalled, records kept".' },
  { q: 'Where do the rates in the money calculators come from?', a: 'Each one says so beside it: Yours (you typed it), a reference figure with its source and date (like the prime rate from the Reserve Bank), Illustrative (an example - check your own quote), or Assumption. Reference figures go out of date: use the rate on your own quote.' },
  { q: 'Does Finance connect to the bank or give advice?', a: 'No. You enter what you want to track. Projections are arithmetic on your own amounts and rates, assumed to stay the same - not predictions and not financial advice.' },
  { q: 'Can we keep medical records?', a: 'Not yet. Medical details need private records and access rules first, which are planned for the Medical mini-app. The food details and heights and weights on the People page are visible to everyone in the family.' },
  { q: 'Which music works?', a: 'Your own files: mp3, m4a, aac, ogg, opus, wav, flac or webm (what plays depends on the browser). Spotify and other streaming services are not supported - their rules are different. Nothing is uploaded; only the track playing is held in memory.' },
  { q: 'Are the times exact?', a: 'No. Minutes and effort are rough guesses the family sets. A chore with no time set is still shown, labelled "Time not estimated".' },
  { q: 'Is choosing my name a login?', a: 'No. Anyone using this device can choose any profile. Real accounts and private records will come before anything sensitive, like medical details, is added.' },
  { q: 'Can a child use it?', a: 'A child profile only sees chores where they are named under "Who can do it". Adults see every chore that names no one, plus any that name them.' },
];

export const FEATURES = [
  { name: 'Your Drive folder', where: 'Settings › Google Drive', what: 'Everything saved as files in your own Google Drive, shared across your laptops, with backups and version history.' },
  { name: 'Timer and music', where: 'Chores › Start', what: 'A countdown for the chore you are doing, with optional music from your own files. Done works whenever you are ready.' },
  { name: 'Family meeting', where: 'Tickets › Family meeting', what: 'Appreciations first, then the concerns you choose - ending in a decision, a task, later, or closed.' },
  { name: 'Decisions as experiments', where: 'Decisions', what: 'Try an agreement for two weeks, note what you see, then keep, change or stop it. Earlier versions are kept.' },
  { name: 'Mini-apps', where: 'Home › Mini-apps', what: 'Turn apps off, remove them (keeping their records) or add others from your Drive folder.' },
  { name: 'Bring in data', where: 'Settings › Bring in data', what: 'Spreadsheet templates for recipes, chores and tasks - or drop files in the Import folder of your Drive folder.' },
  { name: 'Sections and mini-apps', where: 'Home', what: 'Each button on the home screen is a section, like Meals. Open it to see its mini-apps, or add more.' },
  { name: 'Meal Assistant', where: 'Meals › Meal Assistant', what: 'One or two easy ideas for the meal in front of you, fitted to who is eating - allergies, age, pregnancy and wishes included.' },
  { name: 'Calorie Checker', where: 'Meals › Calorie Checker', what: 'Calories and nutrients in the amount you actually eat, from 13,000 foods.' },
  { name: 'One shopping list', where: 'Home › Shopping', what: 'Meals, the week’s plan and chore supplies can all be sent to it; anything else can be typed in.' },
  { name: 'Portions and leftovers', where: 'Meals › Cookbook › an item', what: 'How much each person might eat, and how many servings to make with or without leftovers.' },
  { name: 'What if…', where: 'Finance › Homes and Cars', what: 'Pay more each month for a while, pay in a lump sum, take money back out, or a rate change - each ticked line shown on the graphs with it and without it.' },
  { name: 'The (i) beside every figure', where: 'Finance › Homes and Cars', what: 'What each heading and figure means, where to find your own, and how to get the latest - your bond statement, municipal account, the monthly fuel price.' },
  { name: 'Money in and out', where: 'Every Finance tool', what: 'What the house, car or savings are worth, against what has gone out of your pocket so far, and each month’s spending. Money growing your pocket is above zero; money coming out of it is below.' },
  { name: 'Graphs with the turning points', where: 'Every Finance tool', what: 'Each tool has a graph that tells its story, with the moments that matter marked: when owning starts to leave you more than renting, when a car is worth more than is owed, when more of the bond pays it off than interest.' },
  { name: 'Compare homes', where: 'Finance › Homes › Compare', what: 'Any saved homes side by side - buy against buy, against renting, or keeping ours - on the same money each month, with where each would leave you, year by year.' },
  { name: 'Variations', where: 'Cookbook › a meal › Variations', what: 'One meal made several ways - cheese, pepper or mushroom sauce from one white sauce - with one set of ratings, and shopping that follows the way chosen.' },
  { name: 'Money plan', where: 'Finance › Money plan', what: 'Every goal on one timeline, brought in from Holidays, Cars, Homes, Children’s future and savings goals - what to put aside each month, and where it does not fit.' },
  { name: 'Children’s future', where: 'Finance › Children’s future', what: 'School, studies and starting out for each child from their birthdays - what to save each month, when the budget steps up, and the years that crowd together.' },
  { name: 'Job offers', where: 'Finance › Job offers', what: 'Jobs compared on take-home, the household’s costs, increases, moving and payback - with a labelled SARS tax estimate when there is no payslip yet.' },
  { name: 'One page per home', where: 'Finance › Homes', what: 'Buying, ours already or renting - the home, buying it, selling ours first, the bond and its history, running it, upgrades, travel, investing after the bond - each section counted or left out.' },
  { name: 'Petrol against electric', where: 'Finance › Cars', what: 'Fuel or charging worked out from distance, consumption and the current fuel price or electricity tariff - home and public charging, hybrids and plug-ins - with insurance, service, oil and tyres. Save both and compare.' },
  { name: 'True cost of a car', where: 'Finance › Cars', what: 'The instalment, interest, fees, running costs, and what is still owed when you sell - saved by name and compared side by side.' },
  { name: 'Simple, Advanced, Learn', where: 'Finance calculators', what: 'The quick answer, every cost and assumption, or each sum worked out step by step - switch any time without losing what you typed.' },
  { name: 'Projections with their assumptions', where: 'Finance › Goals', what: 'When a goal could be reached, or a debt paid off - and plainly when it never would at the current payment.' },
  { name: 'Time a day for chores', where: 'Chores › Plan and Progress', what: 'All the chores together, a week and on average a day - so you can plan for, say, an hour a day.' },
  { name: 'The timer ring', where: 'Chores › Start', what: 'Fills to the time a chore should take, then turns honey and counts what is over. Done records the minutes; Cancel records nothing; left running, it asks "Still on it?" and stops if nobody answers.' },
  { name: 'How much could the answer move?', where: 'Finance › Homes and Compare', what: 'A favourable and an unfavourable line, each worked out again with its own assumptions, with the range shaded between - what it says in words, what moves it most, and sliders to change how far each assumption is tested.' },
  { name: 'What your bond really did', where: 'Finance › Homes › a home, under "What each one did"', what: 'When it is paid off, the interest over the whole bond and what is owed today - as it happened, without each line, and with none of them - with a graph of what is owed. Paid on top of the minimum is "Paid more each month".' },
  { name: 'Graphs run to', where: 'Finance › Homes › a home, at the top of the answer', what: 'End every graph when the bond is paid off, 5 or 10 years after, or when you leave. Year by year shows every year from the start, with interest each year to check against your statements.' },
  { name: 'Zoom in on a graph', where: 'Every Finance graph longer than six years', what: '5 years shows the two years before today and three after, with the scale fitted to them; ‹ and › move a year at a time, All shows everything again.' },
  { name: 'What each one did', where: 'Finance › Homes › a home, under the main graph', what: 'Each bond history line and each ticked what-if, taken out on its own: what it did to the end date, the interest and what the home leaves you - set against investing that money instead, or leaving it in the bond. Say whether money taken out was invested or spent.' },
  { name: 'Compared with something real', where: 'Finance › Homes › a home', what: 'Buying is set against renting a similar home, the home you own against renting one instead, renting against buying - on the same money. Add the rent (or price) of a similar home and the page says which leaves you more, and by when.' },
  { name: 'Explore how the result could change', where: 'Finance › Homes › under the main graph', what: 'Lower, your estimate and upper for each assumption, as numbers - Narrow, Wider or your own. The graph works the whole comparison out again as you move them.' },
  { name: 'Tap a graph to read it', where: 'Every Finance graph', what: 'Tap or move over a graph to see every figure at that point. Each line has its name and last value at its end.' },
  { name: 'What it costs a month, by part', where: 'Finance › Homes › a home', what: 'The bond, rates and insurance, upkeep, rent and travel - now, in 5 years, when you leave and after the bond - so you see that a paid-off home still costs something.' },
  { name: 'Your figure in the range', where: 'Finance › Homes › a home › Change the range', what: 'Change house price growth, the bond rate or any tested assumption right beside its slider; the home and the range follow.' },
  { name: 'Can you carry it?', where: 'Finance › Homes › a home', what: 'What could make a home tight for your household: the monthly cost against income, a 2-point rate rise, the cash left after moving in, a big repair, leaving sooner - and what you skip is shown as not assessed.' },
  { name: 'From when', where: 'Finance › Homes', what: 'A home starts this month - or later ("Buying in", "Renting from"), or, for ours, from when we bought it, counting the whole story with today marked. Compare lines them up from when the last one starts.' },
  { name: 'Print, PDF and CSV', where: 'Finance › any tool', what: 'Print (or Save as PDF) the page with every graph; CSV for Excel or Google Sheets with your figures, the results, the tables and each graph’s numbers.' },
  { name: 'Real times, suggested', where: 'Chores', what: 'Time a chore with Start. When the last three timed runs all took longer than planned, it offers the average of the last five - one press to use it.' },
  { name: 'Time in the kitchen', where: 'Meal Planner › Calendar', what: 'Each day’s preparation and cooking under its date, and the week’s planned meals together - a week and on average a day.' },
  { name: 'Sample chores', where: 'Chores › Plan › Samples', what: 'Ready-made chores for each room - kitchen, bathrooms, bedroom, baby room, laundry - to tick and add. They become your own to change or remove.' },
  { name: 'Avoid a room', where: 'Chores › Do something now', what: 'With "Anywhere" chosen, tap rooms under "Not today" to leave them out.' },
  { name: 'Phone and laptop', where: 'Bottom of every page', what: 'Every step to put the family in your Google Drive, onto a phone and its home screen - and what to do when something goes wrong.' },
  { name: 'Fold filters away', where: 'Cookbook, Meal Planner, Shopping, Faith, Places, Calorie Checker', what: 'Tap Filters (or Kinds, Browse) to fold them into one line that still says what is on. On a phone they start folded; this device remembers your choice. Long forms fold by part too, and Save stays at the bottom.' },
  { name: 'Undo', where: 'After pressing Done', what: 'The confirmation has an Undo button, in case it was pressed by mistake.' },
  { name: 'Your own dashboard', where: 'Settings › Your dashboard', what: 'Each profile has its own button order and hidden buttons on this device.' },
];

export const PRIVACY = {
  title: 'Privacy & your data',
  sections: [
    ['What leaves this device', 'Nothing goes to Family Hub or to whoever made it. There is no server, no account, no analytics and no cookies, and nothing loads from other websites.'],
    ['With a Google Drive folder', 'Your data is saved as files in a folder in your own Google Drive, which Google Drive for Desktop keeps in step across your computers. It is as private as the rest of your Drive. Family Hub reads and writes only that folder.'],
    ['Without a folder', 'Your data stays in this browser’s local storage, on this device only. Clearing your browser data removes it.'],
    ['It is not a backup', 'Browser storage on its own is not a backup. Use your Drive folder (with Back up now), or save a family file somewhere you control.'],
    ['Profiles are not security', 'Choosing a name is not a login. Anyone using this device - or with access to your Drive folder - can see and change everything. Do not store sensitive information, like medical details, in this version.'],
    ['Other people’s mini-apps', 'They run sealed off, with no internet access, and see only what you approve when installing them.'],
    ['Hosting', 'If you use Family Hub from a website, that host may keep ordinary server logs of page requests, as any website does. Your family data is never sent to it.'],
    ['Removing everything', 'Settings › Your data › "Delete everything on this device" removes what is kept in this browser. Your Drive folder is yours to keep or delete in Google Drive.'],
  ],
};

export const ABOUT = {
  title: 'About Family Hub',
  sections: [
    ['What it is', 'A calm place for a household to share the everyday load. Capture quickly, think deeply later, and keep the useful outcome.'],
    ['What this version does', 'Chores with a timer and optional music; Tasks and projects; Tickets and the family meeting; Principles; Decisions as experiments; Meals: a recipe book with weekly plan and shopping list, a calorie checker and a meal assistant; Holidays; Finance; Exercise; Faith reading plans and journal. Your data can live in your own Google Drive folder, and existing data can be brought in from spreadsheets. Each section is made of mini-apps that can be turned off, removed and added.'],
    ['Coming later', 'A Planner (a family calendar gathering everything dated) and Medical (once private records exist).'],
    ['What it will not do', 'Streaks, scores, leaderboards, or piling missed work onto tomorrow. Missed tasks are information about workload and systems.'],
  ],
};
