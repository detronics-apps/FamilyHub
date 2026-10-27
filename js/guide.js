// The "How to use" content, the search over it, and the privacy/about text.
// Plain data so it can grow without touching layout code.

// Each app term carries the everyday words a person might search with instead.
export const SEARCH_ALIASES = {
  'do something now': ['five minutes', 'spare time', 'what should i do', 'quick job', 'suggest', 'find a task', 'execute'],
  chore: ['housework', 'cleaning', 'job', 'tidy'],
  plan: ['add a chore', 'create', 'new chore', 'set up', 'schedule', 'how often'],
  later: ['postpone', 'not now', 'tomorrow', 'defer', 'put off', 'snooze'],
  skip: ['miss', 'missed', 'not this time', 'skip it'],
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
  'shopping list': ['groceries', 'shop', 'buy', 'ingredients'],
  trip: ['holiday', 'vacation', 'travel', 'packing', 'itinerary'],
  budget: ['money', 'spending', 'expenses', 'finance', 'savings', 'debt', 'loan'],
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
    'Pick any suggestion and press Done when it is finished - or Start, for a timer and optional music.',
    'Do another one if you like, or press "Finish". Stopping is always fine.',
  ] },
  { id: 'drive', title: 'Keep everything safe in your Google Drive folder (computer)', steps: [
    'Install Google Drive for Desktop (free, from Google) and sign in. Your Drive appears as a folder on the computer.',
    'In Family Hub, open Settings, then Google Drive, and press "Choose folder". Use Chrome or Edge.',
    'Pick a folder in your Drive, for example My Drive. Family Hub makes a FamilyHub folder inside it and saves everything there.',
    'The status at the top says "Saved to Drive" after each change. On another laptop, do the same and pick the same FamilyHub folder.',
  ] },
  { id: 'phone', title: 'Use Family Hub on a phone', steps: [
    'Set it up on a computer first (Keep everything safe in your Google Drive folder). From then on, that laptop keeps one file for phones up to date: FamilyHub › Phone › "Family Hub.json".',
    'On the phone, open the same web address (add it to the home screen). Press "Get family", or Settings, "Get latest", and choose Google Drive › FamilyHub › Phone › "Family Hub.json". Your family is on the phone.',
    'To send the phone’s changes back: Settings, "Send back", choose Drive, and save into the FamilyHub › Phone folder. The next time a laptop has Family Hub open, it adds them in by itself - nothing to press.',
    'Before planning something big on the phone, press "Get latest" first. Combining always keeps everything from both sides, and asks only when the same thing was changed in both places.',
    'iPhone: if Google Drive is not in the window, open Apple’s Files app, Browse, ⋯, Edit, and switch Google Drive on. Android: tap ☰ in the window and choose Drive.',
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
    'Choose how often, roughly how long, and how much effort it takes, if you know.',
    'Open "More details" for instructions, who can do it, and what it depends on.',
  ] },
  { id: 'later', title: 'Put a chore off without guilt', steps: [
    'On any chore, press "Not now".',
    'Choose Tomorrow, Next week, or a date of your own - it comes back later, on that day. For a repeating chore you can also Skip this time.',
    'A routine chore that is skipped simply comes round again on its normal cycle.',
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
    'Step 2, sort: drag each gathered meal into Breakfasts, Lunches, Dinners or Snacks (on a phone, press and hold first). Or open a meal and choose its meal there. The little B, L, D and S circles on a meal say what it is good for - open the meal and press Change next to "Good for" to set them, for example after cooking it.',
    'Press Assign: the planned meals sit beside a calendar. Drag each one onto a day (on a phone, press and hold first) - a week at a time, or a whole month. It keeps the meal it was sorted into (a lunch stays lunch) unless you drop it on another meal’s row. Drag one back to the list to take it off its day.',
    'Calendar shows just the calendar. Drag a meal to another day to swap them; tap a meal to open it, change it, or rate it.',
    'Press "To Shopping" and say which days you are shopping for - from the day you shop, say Wednesday, for 7 days. Their meals’ amounts are added up, scaled to the servings you chose; untick what you already have.',
    'On the day, open Cook today: today’s meals, and at the bottom every meal of that shop. In the mood for another one? Drag it onto today’s and the two swap days. Where you can drop is outlined, and the place under your finger lights up.',
    'Tick things off in Shopping as you buy them. Sending the week again updates its items; your own additions and ticked items stay.',
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

export const FAQS = [
  { q: 'Where is our data kept?', a: 'If you connected your Google Drive folder: in that folder, as ordinary files you can see and back up in Drive. Nobody else - including whoever made this app - can see it. If not: only in this browser, on this device, which is not a backup. The header always says which.' },
  { q: 'Will I lose my details when the app is updated?', a: 'No. Updates change the app, not your data. Data in your Drive folder or in this browser stays, and older data is brought up to date automatically.' },
  { q: 'Does the phone sync with Google Drive?', a: 'Half by itself. Phone browsers cannot keep a live link to a folder, and the only other way would be signing in to a Google app run by a publisher, which Family Hub deliberately avoids. So laptops keep FamilyHub › Phone › "Family Hub.json" up to date for phones, and add in whatever a phone sends back into that Phone folder. On the phone it is two buttons: "Get latest" and "Send back".' },
  { q: 'What happens if two of us change something at the same time?', a: 'Different things are combined automatically - two chores ticked off on two laptops are both kept. Only when the very same detail was changed differently does Family Hub ask which to keep, showing both. Nothing is overwritten silently.' },
  { q: 'What happens when we miss a chore?', a: 'Nothing piles up. A repeating chore has one current turn: if it is missed, it simply stays ready until someone does it or skips it, then its normal cycle carries on. Missed chores are information about how much the week can hold, not extra work for tomorrow.' },
  { q: 'Why is a chore asking for a review?', a: 'If a chore has been put off three times in a row, or has waited two whole cycles, the Plan tab gently asks whether the plan still fits. Nothing is added or changed unless you change it.' },
  { q: 'How are suggestions chosen?', a: 'Your filters remove what does not fit. What is left is ordered: ready chores before optional ones, important before ordinary, then whatever has waited longest for its own cycle, then the quickest. "Why these suggestions?" shows this with your current choices.' },
  { q: 'Does uninstalling a mini-app delete its data?', a: 'No. Uninstalling keeps its records in your folder, and reinstalling brings them back. Deleting the records is a separate step that asks first.' },
  { q: 'Is it safe to add someone else’s mini-app?', a: 'Family Hub runs it sealed off: no internet, no access to your other data, and only the permissions you approve when installing. But anything you let it see, it could misuse - so only install mini-apps from people you trust. If its files change later, it stops until you review the change.' },
  { q: 'Can I bring in the recipes (or chores, or tasks) I already have?', a: 'Yes. Settings, Bring in data: download the template, fill it in with a spreadsheet, and import it - or drop it into the Import folder in your Drive folder. Importing the same file twice adds nothing, because names that already exist are left alone.' },
  { q: 'Does Meals judge how healthy a meal is?', a: 'No. Meal Assistant never scores a meal or calls food good or bad - it offers one or two easy improvements, says who they help and why, and never claims anyone lacks something. Its food values come from USDA FoodData Central, and anything the source does not report is shown as "not known", never as zero. It is not medical or dietary advice.' },
  { q: 'Where did Health go?', a: 'Its food side is now the Meals section (Meal Assistant and Calorie Checker) and its activity side is Exercise. If you had added appointments, they are kept in your folder: Mini-apps lists Health under "Uninstalled, records kept".' },
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
  { name: 'Projections with their assumptions', where: 'Finance › Goals', what: 'When a goal could be reached, or a debt paid off - and plainly when it never would at the current payment.' },
  { name: 'Avoid a room', where: 'Chores › Do something now', what: 'With "Anywhere" chosen, tap rooms under "Not today" to leave them out.' },
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
