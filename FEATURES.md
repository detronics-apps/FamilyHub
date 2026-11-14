# Family Hub: features and the thinking behind them

This file lists only what actually made it into the app, with why each feature is there and the
purpose behind it. It is written so each part can become a video: a feature, a decision, or a
principle.

- **What is still to come** lives in [BACKLOG.md](BACKLOG.md).
- **Ideas we decided against** are in [REJECTED.md](REJECTED.md).
- **How each piece was built** is in [DECISIONS.md](DECISIONS.md). The D-numbers below point there.

Quotes are the owner's own words from the conversations while building, lightly tidied for
spelling. Each feature shows the
version and date it first shipped. **Show it** says where to go and what to press for a screen
recording.

Live: https://familyhub.detronics.co.za/. Building started on 25 October 2026.

---

## Why Family Hub exists

**It is for busy families.** A household has a lot of decisions and choices to make:
- balancing family, partnership and relationships;
- parenting styles and faith;
- managing the house and doing the finances;
- eating healthily and exercising.

These are overwhelming topics, and the busiest families have the least time for them. The owner
(2026-11-04):

> "If you search on like how to exercise, is like wake up this early, spend this amount of time in
> the gym... Where that's not possible for full-size families that are in the crux of having
> newborns, having toddlers, like me and my wife can't just go an hour to the gym. I don't have an
> hour to clean every day. And some days I will clean and some days I won't."

> "Sometimes life is just too busy and I really don't have the energy to make decisions. And then I
> just want to open up, just tell me what I need to make food that is at least somewhat nutritional.
> And just give me 15 minutes of exercise I can just quickly do before I go to bed."

> "Don't care if you didn't make it today. We'll do it then tomorrow. This is a helping app and
> people should not get frustrated because they couldn't keep up to the standard... Life happens.
> And even if I forget to exercise for a week, then I just want to continue... Just help me get
> started again. Make the ease of entry as low as possible and then we build on that."

**What it sets out to do.** It carries the everyday load (the chores, the meals, the shopping) and
helps a family think through the big things: a home, a car, a job, the children's future, how they
will parent and what they believe. The owner (2026-10-27):

> "The entire goal of this app is to help people think of those things that they have not thought
> about and help them make the best decisions with the information they had at the moment of making
> the decisions... Life is so hectic at this stage and people just don't know what to hit where."

**What it deliberately is not:**
- **Not a standard to keep up with.** There are no streaks, no "missed" and no schedule you must
  follow.
- **Not a business product.** "This is a family app. For you and your family. For me and my family."
  (2026-10-25)
- **Not a place that holds your data.** Nobody signs in, and the family's information stays in their
  own Google Drive.
- **Not a crisis manual.** Parenting is for planning ahead, calmly.
- **Not a spending tracker.** Finance is for decisions.
- **Not medical records.** Medical tracks accounts and paperwork.
- **Not an advisor.** It shows the options and the numbers. The family decides.

---

## The core philosophy

These are the principles that surfaced while building, in the order they came up. Each one names
the features that follow it.

### Your data is yours: no publisher, no sign-in (2026-10-25)
Family Hub talks to no server. Nobody signs in to anything, and each family's data is theirs alone.
**How it surfaced:** connecting Google Drive, the build drifted towards Google's API and a cloud
project. The owner stopped it: "I don't want to be the publisher of this app. Like, that's the
entire thing of all my apps. It is tools to help people and all data is stored locally just for
them." (D-013)
**Where it shows:** your own Drive folder; phones that swap one family file; no accounts, adverts
or tracking.

### Warm, never business (2026-10-25)
**How it surfaced:** the app started in Detronics' cool blues, and the owner said they felt cold:
"It must not seem like a business thing at all... It should give no business vibes." (D-005)
**Where it shows:** the cream, cocoa, terracotta, sage and honey palette, a small house icon, and no
company logo inside. The only Detronics pieces kept are the coffee button, the footer link and the
licence.

### Plan · Check · Do: the time you actually have (2026-10-26)
Every section offers ways in by the time you have.
**How it surfaced:** "Planning is for when I'm relaxed with no time crush; doing is for when I have
20 min to 1 hour available." Sometimes you just want to check a calorie count, or save a meal you
saw on TikTok. (D-045)
**Where it shows:** Plan, Check and Do on every section page, Cook today, At the shop, and Play now.

### Nothing depends on spelling (2026-10-26)
**How it surfaced:** making a salad dressing, the owner typed units by hand: "I do not ever want to
rely on people's spelling to break the app." (D-039)
**Where it shows:** ingredients, units and meal times are picked from lists, with "Other…" for your
own. Names and notes stay free text, and nothing is calculated from them.

### Help people explore, not only find (2026-10-26)
**How it surfaced:** "We can not assume people know about something like tofu, and without any
guidance they might never add it to their meals or search for it. We want to help them explore."
(D-046)
**Where it shows:** browse foods by colour, type and nutrient; Shopping's "Everything" list; ideas
in the Meal Assistant.

### A button is a name (2026-10-27)
A button says one word, two at most. The explanation sits beside it.
**How it surfaced:** a filter was labelled "bought before and added by us". The owner: "The button
itself should only be a heading, of like, one max two words." (D-050)
**Where it shows:** every screen. A test reads every button label in the code.

### Better decisions with what you know now (2026-10-27)
Show the factors people forget, let them put their own figures in, and show what moves the answer.
**How it surfaced:** the rent-or-buy debate at the owner's office. Calculators assume 2 to 5% of a
home's value on maintenance, while their own was small, and their upgrades added more value than
they cost. "I want to compare apples with apples, but in this case it is apples with pears, but at
least bring it as close as possible to realistic values." (D-072)
**Where it shows:** every Finance tool, "Did you think of…", and Estimated tags on rule-of-thumb
figures.

### Graphs that answer a question (2026-10-27 to 2026-10-30)
Each graph answers one question, compares with something real, and says exactly what it compares.
**How it surfaced:**
- "Add graphs. That tells a story, that makes sense." (D-073)
- On the first property report: "Everywhere you say 'ahead' I need to know ahead of what?"
- From the owner's brief: "A beautiful graph of the wrong comparison is still the wrong answer."
  (D-086)
**Where it shows:** the Homes report, its graphs titled as questions, and the tested range.

### Nothing is put off (2026-10-28)
**How it surfaced:** the chores had a "Not now" button. The owner: "I never want to schedule
something out because I might have had to do it by today, and now I'm scheduling out to do it next
week Wednesday, but throughout the week from now till then I actually had some time to do it, I just
didn't see it on the list... It just should not exist." (D-080)
**Where it shows:** chores stay on the list until done; workouts are not given days; tallies never
reset.

### Plan ahead, not in a crisis (2026-11-02)
**How it surfaced:** "The idea is not for parents to open this app in a crisis but rather to preplan
how they will manage a situation if or when it occurs." (D-096)
**Where it shows:** Parenting opens on Agreements, Ideas and Play now. There is a fever plan the
parents write themselves, and steps to practise beforehand.

### If you are wondering whether to see a doctor, go (2026-11-02)
**How it surfaced:** "Nowhere should we ever tell or suggest parents not to seek medical help. If
they are wondering about it, it should always be rather go and it is nothing, rather than not going
and it was something."
**Where it shows:** every health topic, tracker and fever plan ends with that line.

### Nothing hidden within the family, nothing duplicated (2026-11-02)
**How it surfaced:** planning a space for the couple, the owner said: "We are seen as an entire
family, so I don't want anything to be like hidden from each other." They also pointed out that
check-ins would repeat what Tickets and Decisions already hold. (D-102)
**Where it shows:** profiles are not logins; Us reuses Decisions instead of copying it.

### A family's rule shapes the app (2026-11-02)
**How it surfaced:** "One of our rules are at all times, either my wife or I need to be with the
kids... So we never even want to be asked if a babysitter will be needed." (D-102)
**Where it shows:** with "Only us", no date or plan anywhere offers or asks about someone else
looking after the children.

### Awareness, not direction (2026-11-02 to 2026-11-03)
The app asks. It does not push.
**How it surfaced:** a sun-safety topic stated what sunscreen protects. The owner: "If there is any
evidence that people are not agreeing on anything yet, the decision needs to be with the parents...
Just want people to be aware that there is different ways, and to make their own decisions."
(D-107)
**Where it shows:**
- Topics ask "Have you considered…?" and never recommend.
- Each parent writes their own reasons, and the other's answer stays hidden until you give yours.

### Every add has a remove (2026-11-02)
**How it surfaced:** the fever plan had a "Step" button and no way to take a step away. "If you're
able to add something, you should also be able to remove it, because we can add stuff by mistake."
(D-107)
**Where it shows:** "Add step" with "Remove step", Remove beside Edit, and every suggested list.

### Structure, not content (2026-10-27 onwards)
The app gives the structure and a few starting examples. The family brings the content.
**How it surfaced:** asking for sample chores, the owner said: "This is all just to help the user get
an idea of how to use the app. They can delete or add new ones as they want." Later: "Parents should
also always be able to add their own topics and decisions; we just supply a starting point." (D-065,
D-095)
**Where it shows:** sample chores, starter meals, starting topics, checklists and example creators.
All of them can be changed and removed.

### Notice, never judge (2026-11-02)
**How it surfaced:** screen time could easily have become a scorecard for a child. (D-097)
**Where it shows:** screen time gives plain observations, with no streaks, badges or scores for a
child. Exercise keeps yearly tallies that never reset.

### Big purchases deserve the most care (2026-11-04)
**How it surfaced:** "It's not the short, small purchases, it's these big purchases... I'd rather ask
the questions and prevent a life-changing decision versus being too ashamed to ask these simple
questions." The owner's examples were mould behind fresh paint, and a second-hand bus with a kinked
chassis. (D-111)
**Where it shows:** Homes and Cars cover Story, Financing, Online, General, Viewing and Feeling.

### Link the source, don't copy it (2026-11-04)
**How it surfaced:** "So you can like link different videos there instead of trying to copy all the
info from the video into the app." (D-112)
**Where it shows:** "Creators" at the end of the top line in every app, the topic's own page, and on recipes, workouts, journal
entries and decisions.

---

## Features that made it

### Home and the platform

#### Sections of family life, with small apps inside (v0.3.0, 2026-10-26)
**What it does:** Home shows the parts of family life: Chores, Meals, Finance, Parenting and the
rest. Each section holds small apps that can be switched on or off without losing their data.
**Why it is there:** the owner noticed that Health was really two things, food and exercise, and
that what gets installed or removed should be the tools inside a section, not the section itself.
**How it was decided:** sections are part of Family Hub and never removed. A section with one app
opens that app directly. Uninstalling keeps the data. (D-022, D-020)
**Show it:** any section page › Mini-apps; switch one off and back on.

#### Your own Drive folder, shared between laptops (v0.2, 2026-10-25)
**What it does:** pick a folder in Google Drive for Desktop once. Every change is saved there as
readable files, and other laptops pick it up.
**Why it is there:** "I don't want, with each publication, to refill in all my family detail." The
owner also refused to become the publisher of anyone's data.
**How it was decided:** the Google Drive API was rejected because it needs a registered publisher.
The folder method keeps "nothing leaves the browser". Changes made in two places are merged by kind
of data and never silently overwritten. (D-013, D-015, D-016)
**Show it:** Settings › Your Drive folder; change something on one laptop and open it on another.

#### Phones: Get latest and Send back (v0.8.0 to v0.9.23, 2026-10-27 to 2026-10-29)
**What it does:** a phone keeps up with one tap each way, from any page. When two phones send back
in turn, both keep their changes.
**Why it is there:** "How do I see the same data on my phone?" Later: "What happens if I send from my
phone, and then my wife also sends from hers? Will we lose my changes?"
**How it was decided:**
- A phone can only reach Drive through its file picker and share sheet, so a laptop keeps one family
  file ready.
- A phone's file carries the copy it started from. Two phones adding milk and bread to one list keep
  both. (D-052, D-064, D-082)
**Show it:** on a phone, press Get latest, add an item, then press Send back.

#### "Phone and laptop": every setup step on one page (v0.9.6, 2026-10-27)
**What it does:** shows every step in order: the laptop, getting Drive into a phone's file window
(iPhone and Android), adding the app to the home screen, and what can go wrong.
**Why it is there:** "Please automate this as much as you can. Because I do want other users to be
able to do it on their computers as well, to set up their own Family Hub." (D-063)
**Show it:** the link at the bottom of every page.

#### How to use, in your own words (v0.2 to v0.23.1, 2026-10-25 to 2026-11-11)
**What it does:**
- Search in your own words: "amrap", "date night" or "postpone" all find the right page.
- Pick any how-to by its group, and the steps show below it.
- Questions answered, the ideas the app stands for, Plan · Check · Do, and the features worth knowing.
- The welcome tells the app's story in numbered first steps, and opens again from "New here?".
**Why it is there:** the target is an app that needs no support: a stranger reaches a real result with
nobody to ask. The owner asked for the how-to section to meet everything the skill requires (2026-11-11).
**How it was decided:**
- Every new feature adds its tile, and an answer if it changes a number.
- Achievements were left out, because the family decided against badges and scores. (D-115)
**Show it:** the "How to use" link at the bottom of any page.

#### Your own dashboard, by dragging (v0.9.0, 2026-10-27)
**What it does:** drag a row to put your apps in your own order. Two apps reach the top in two
drags.
**Why it is there:** "It's very tedious to put them in order because you have to like click up,
click up, click up." (D-054)
**Show it:** Settings › Your dashboard.

#### A way back at the bottom of every page (v0.5.3, 2026-10-26)
**What it does:** every page ends with "‹ Back to …", drawn by the frame, so no app can forget it.
**Why it is there:** the owner opened a recipe to check it and wanted to get back to the Cookbook
without scrolling up to the breadcrumb. (D-041)

#### Filters and long forms fold away (v0.9.5, 2026-10-27)
**What it does:** on a phone, filters and long forms fold into one line that still says what is on,
such as "2 on". The app remembers whether you had each one open.
**Why it is there:** on a phone, the filters filled the whole screen. (D-062)

#### People: birthdays decide the stage of life (v0.4.0 to v0.4.3, 2026-10-26)
**What it does:**
- Each person's birthday works out baby, toddler, child, teen or adult, and they move on by
  themselves as they grow.
- Heights and weights are kept with their dates, along with food details.
- A pregnancy can be noted with its date.
**Why it is there:**
- "Can I not rather add all the people in the family's birthdays and then the app determines if it
  is a baby, toddler, teen or adult?"
- Weights matter "even for just going to hospital, then we can at least state when who was what
  weight and height". (D-026, D-030)
**Show it:** Home › People.

#### Guidance by age (v0.5.0, 2026-10-26)
**What it does:** shows warnings tied to age or stage, such as no honey or water in a baby's first
year. They appear on the person and on any meal that holds those foods.
**Why it is there:** the owner asked for "warning against honey and water in the first year of a
baby's life", and shared the Dietary Guidelines for Americans to plan from. (D-031)

#### Creators and videos on every topic (v0.9.33, v0.15.0, v0.22.0 and v0.22.2, 2026-11-01 to 2026-11-05)
**What it does:** keeps one family list of the people you learn from.
- Link them, and specific videos, on a recipe, exercise, workout, journal entry, goal, parenting
  topic, activity, decision or date idea.
- Each topic also has its own place for creators, reached from "Creators" at the end of the top line
  in every app of that topic. It gathers every link from inside that topic and shows where each one
  is linked from.
**Why it is there:** "Link different videos there instead of trying to copy all the info from the
video into the app."
**How it was decided:**
- Plain links only, opening in a new tab; nothing is embedded or fetched.
- No made-up creators: the "Example - replace" placeholders were removed (v0.24.2). Only real creators
  the owner follows go in, as the family's own - moneywithcarla so far.
- Each parent can say whether they agree with a video.
- At first it sat only on the topic page, which Home skips when a topic has one app, so nobody saw
  it; the link on every app's top line fixed that. (D-091, D-101, D-112, D-113)
**Changed (v0.24.2, 2026-11-13):** a topic with several apps (Finance) showed Creators and videos at the
foot of its page; now its top line has Creators, like every app, opening the topic's own page. (D-118)
**Show it:** Home › Faith, tap Creators at the top right; then open a recipe's links in the Cookbook.

### Chores

#### Chores that wait until they are done (v0.9.20, 2026-10-28)
**What it does:** a chore shows when it is due and stays until it is done. A weekly chore shows all
week, and a monthly one appears when it falls due again. There is no Not now, no Skip and no
"Move to a date".
**Why it is there:** putting a chore off to a date hid it on the days when there was time for it.
"It just should not exist. The not now button." (D-080, D-008)
**The philosophy it shows:** Life happens; nothing is put off.
**Show it:** Home › Chores, then Done on a chore.

#### Start, the timer ring and your own music (v0.2 and v0.9.20, 2026-10-25 and 2026-10-28)
**What it does:**
- Start is optional. It shows a ring that fills towards the expected time and changes colour when
  the job runs over.
- Cancel is there for when you get pulled away.
- Music can play from your own files.
**Why it is there:** Done stays one tap. Start is for "if I do want to time myself... where we
estimated it to take 3 minutes, then we can actually see it took 5 minutes". (D-021, D-080)
**Show it:** Chores › Start on any chore.

#### Real times, suggested (v0.9.21, 2026-10-28)
**What it does:** when a chore keeps taking longer than planned, the app offers the average of its
timed runs: "took 7, 10, 7 minutes - make it 8?"
**Why it is there:** "If taking out the trash each time takes me 7 to 10 minutes and I planned 5,
then after the third time it should suggest 8 minutes." (D-081)

#### Time a day for the house (v0.9.20, 2026-10-28)
**What it does:** adds up every chore for a week and averages it to a day, with where the time goes
by room.
**Why it is there:** "So I can mentally prep myself and plan for an hour a day of cleaning if
needed." (D-079)
**Show it:** Chores › Plan › Progress.

#### Sample chores per room (v0.9.8 and v0.9.13, 2026-10-27)
**What it does:** offers starting jobs for the kitchen, bathrooms, bedrooms, a baby room, a kids'
room, the steps, a workshop and the laundry, each with daily, weekly and monthly work. Tick what
fits.
**Why it is there:** "I'm not even aware of all the types of cleaning that needs to be done in a
house." (D-065)
**The philosophy it shows:** structure, not content.

#### Something that fits right now (v0.1.0, 2026-10-25)
**What it does:** "Do something now" filters by the time and energy you have, and by room. Nothing is
scored; the order is explained in words.
**Why it is there:** on a low-energy day, a smaller job still counts. (D-009, D-010)

### Family life together

#### Tickets and the family meeting (v0.2, 2026-10-25)
**What it does:** capture a concern, an idea or a thank-you in seconds, and talk it through at the
family meeting. A ticket can become a decision or a task.
**Show it:** Home › Tickets.

#### Principles, with the reasons behind them (v0.2, 2026-10-25)
**What it does:** keeps the family's values and agreements with their reasons and exceptions, and
when to look at them again.

#### Decisions as experiments, for an age, with what would change our mind (v0.2 and v0.10.0, 2026-10-25 and 2026-11-02)
**What it does:**
- Try something, see how it goes, look back, and adapt.
- A decision can apply only while a child is a certain age: sugar under one is a different decision
  from sugar at four.
- Each decision records what would change your mind.
**Why it is there:** "Some decisions also need to apply only for a certain time period of the kids'
life." (D-095, D-106)
**Show it:** Home › Us › Decisions.

#### Us: decisions, date ideas and shared goals (v0.16.0, 2026-11-02)
**What it does:** gives the two of you a section:
- the decisions you make as parents;
- date ideas, with time, cost, energy and where the children are, and both of your scores;
- the goals you share, linked to Finance and Holidays.
**Why it is there:** "Different things of connecting with your partner or spouse, teammate." The
owner insisted on reusing Tickets and Decisions rather than duplicating them. (D-102)
**Show it:** Home › Us.

#### Tasks, with their steps (v0.2, 2026-10-25)
**What it does:** one-off jobs, repairs and bigger projects, with steps and what each one waits on.

### Shopping

#### One family list that knows what you buy (v0.7.0, 2026-10-26)
**What it does:** sorts everything by kind: food, cleaning, hygiene, medical, stationery, household
and pets. "Ours" shows what the family usually buys, so you can see what needs replacing. "At the
shop" shows just the list, to tick off.
**Why it is there:** "Knowing there is no more hygiene items or cleaning items in the house and
quickly wanting to see what we need to replace can help a lot." (D-047)
**Show it:** Home › Shopping › Ours › Hygiene.

#### Sending meals again adds only what is new (v0.9.4, 2026-10-27)
**What it does:** resending a week's meals adds only the difference. Overlapping trips count each
meal once, and what was already bought is not asked for again.
**Why it is there:** "What would currently happen if I export to shopping, then add more meals and
export again? Will it duplicate?" (D-059, D-060)

#### "We already have the mayo" (v0.5.2, 2026-10-26)
**What it does:** home-made items show apart when meals go to Shopping. Tick "We already have it" and
their ingredients stay off the list.
**Why it is there:** "Can I add or remove the home-made mayo from the shopping list? Like if I
already made the mayo?" (D-038)

### Meals

#### The Cookbook: meals, recipes and your own ingredients (v0.6.0, 2026-10-26)
**What it does:** an entry is a meal, a recipe or an own ingredient, such as home-made mayo or "a
21 cm cucumber". Anything can go into anything. The type only helps you find things.
**Why it is there:** "All recipes are meals but not all meals are recipes." The three words felt
inconsistent until they became filters. (D-028, D-042, D-043)
**Show it:** Meals › Cookbook, then the All · Meal · Recipe · Own ingredient filters.

#### Ingredients picked, in the amounts you buy (v0.5.1 to v0.5.3, 2026-10-26)
**What it does:**
- Each ingredient is picked from the food database, with the amount and a unit chosen from a list.
- The unit list includes sizes you actually buy: a head of lettuce, a drained can, a cucumber.
- Every line shows its weight. Your own sizes, such as a ring of feta, are added once.
**Why it is there:** making a seven-layer salad, the owner had to search "how many grams are in a
drained can of corn? How many grams is a standard-size cucumber?" (D-037, D-040)
**Show it:** add an ingredient in the Cookbook and open its unit list.

#### Versions of one meal; fillings and sauces made once (v0.9.13, v0.9.33 and v0.9.34, 2026-10-27 to 2026-11-01)
**What it does:**
- A meal keeps its versions, such as a cheese sauce, a pepper sauce or a mushroom sauce.
- A filling or sauce is made once and ticked onto every meal it goes with: chicken mayo in pancakes,
  vetkoek and toasted sandwiches.
**Why it is there:** "I don't want 50 different items of the same meal as different meals. It's one
meal." (D-071, D-093)
**Show it:** Cookbook › Pancakes, then switch between its fillings.

#### Starter meals (v0.9.33 and v0.9.34, 2026-11-01)
**What it does:** gives you meals to change and make your own: burgers, pasta, stew, pizza on our
own dough, pancakes, toasted sandwiches, flapjacks, porridge, rice, lasagne, vetkoek, and balanced
plates of cooked food. (D-093)
**The philosophy it shows:** structure, not content. They are a starting point.

#### Paste a recipe in (v0.9.33, 2026-11-01)
**What it does:** paste a recipe's text and it is split into a heading, ingredients and method. Each
ingredient is matched to the food database and converted to the app's units.
- The app remembers what you matched, for next time.
- It never guesses loosely.
**Why it is there:** "The name convention might not be the same. The quantities and units might not
be the same." (D-092)
**Show it:** Cookbook › Import.

#### Meal Planner: gather, sort, then drag onto days (v0.9.0 to v0.9.5, 2026-10-27)
**What it does:** three steps:
1. Gather meals ("what are we in the mood for?").
2. Sort them into breakfast, lunch, dinner and snacks.
3. Drag them onto days, a week or a month ahead.

While you drag, a bin appears for removing a meal, and Clear starts over.
**Why it is there:** "Step one is gathering all the meals. Step two is assigning it to breakfast,
lunch, or dinner, or snacks. Step three is then to assign it to a day of the week." (D-053, D-055,
D-061)
**Show it:** Meals › Meal Planner.

#### Good-for flags (v0.9.2, 2026-10-27)
**What it does:** small B, L, D and S circles on each meal show what it is good for, and they stay on
as you drag it.
**Why it is there:** "After I've made the meal, I can say, okay, this was a nice dinner meal." (D-057)

#### Portions per person, leftovers and guests (v0.4.0 and v0.5.0, 2026-10-26)
**What it does:**
- Shows how much each person should eat, and whether to cook extra for leftovers.
- Leftovers are counted once, for both cooking and shopping.
- Guests are added by kind, not by name.
**Why it is there:** the owner wanted portion sizes "with an indication of how much should be eaten
by each person in the family, and if we want leftovers or not". (D-028, D-033, D-036)

#### What is in a food, and finding new ones (v0.7.0, 2026-10-26)
**What it does:** covers about 13,600 foods from USDA FoodData Central. Browse them by type and by
colour, and sort them by protein, fibre, fat or carbs.
**Why it is there:** "Without any guidance they might never add it to their meals or search for it."
(D-024, D-046)
**Show it:** Meals › Calorie Checker › Browse › Colour › Yellow.

#### Nutrition that never pretends (v0.5.0, 2026-10-26)
**What it does:** one calculation feeds every recipe and plan. Anything it cannot match counts as
missing, never as zero, and calories then say "at least". (D-035)
**The philosophy it shows:** better decisions with what you know now.

#### Cook today, and a shop as any run of days (v0.9.1, 2026-10-27)
**What it does:** Cook today shows today's meals and the rest of the current shop. A shop can start
on any day and run for 2 to 14 days.
**Why it is there:** shopping does not start on a Monday, or on the same day every week. (D-056)

#### Time in the kitchen (v0.9.20, 2026-10-28)
**What it does:** shows each day's preparation and cooking time for the week, with an average for a
day. (D-079)

### Finance: decisions, not a spending tracker

#### Finance as decision tools (v0.9.9, 2026-10-27)
**What it does:** focused tools, each saved by name to compare and come back to: this car, that
house, this job. Each has Simple, Advanced and Learn levels.
**Why it is there:** from the owner's brief: "The purpose is not to track daily spending... Turn
vague future worries into visible costs, realistic timelines, and achievable savings plans." (D-066)
**Show it:** Home › Finance.

#### One page per home (v0.9.19, 2026-10-28)
**What it does:** one page per home, buying, owning or renting. Its sections follow the order a
decision is made, and each can be ticked "Left out". An (i) beside each heading says what the figure
is and where to find it.
**Why it is there:** "It seems like there is 5 different apps under home, the first 4 seem to be very
similar." There was no reason for them to be separate. (D-078)
**Show it:** Finance › Homes › Our homes › a home.

#### Compared with something real, on the same money (v0.9.27, 2026-10-30)
**What it does:** every home is measured against a real alternative:
- buying against renting a similar home;
- owning against having rented since you bought;
- renting against buying.

Both sides get the same money, and whoever spends less invests the difference.
**Why it is there:** the first report compared a home with "keep your money and live somewhere for
free". "Everywhere you say 'ahead' I need to know ahead of what?" (D-086)
**The philosophy it shows:** graphs that answer a question.

#### How much could the answer move? (v0.9.25, 2026-10-30)
**What it does:** works out the best and worst cases again through the real model, and shades them
on the main graph. It ranks what changes the answer most, and says in words whether the answer
holds.
**Why it is there:** the owner's report brief asked to show "what would need to happen for the
conclusion to change". (D-084)
**Show it:** a home's page, then the sliders under the main graph.

#### Your bond, as it really went (v0.9.17 to v0.9.31, 2026-10-27 to 2026-10-31)
**What it does:**
- Log extra payments, lump sums, money taken out and rate changes.
- Untick any of them to see the bond without it.
- Year by year shows each figure beside what really happened.
- A take-out shows what it has cost, building up over time.
**Why it is there:** "For the first 5 years I put down R12,000 a month... After 4 years, I took 100K
out of the house loan again to buy a car. I want to log things like that." (D-075, D-087, D-089,
D-090)
**Show it:** a home you own › "What happened", then "What each one did".

#### Examples that name no one (v0.25.4, 2026-11-13)
**What it does:** the example homes are just homes to play with - no source named, and nothing set against anyone's
figures. Each has "What to try". The creator whose post inspired them is in Finance › Creators, as someone worth
following.
**Why it is there:** "I just want to add on to that and give people the tool to do the calculations themselves...
I don't want to show where she's wrong... don't call her out in the example." (D-124)
**Show it:** Finance › Homes › either example; Finance › Creators.

#### The same home on our own figures (v0.25.3, 2026-11-13)
**What it does:**
- **A second example:** the post's Oranjezicht home with four figures moved - investments 10% instead of 13%,
  house prices 9% instead of 7%, the bond over 14 years instead of 20, selling after 15 years instead of 20 - and a
  table of what was changed and why.
- **What it shows:** the post's figures leave renting about R41m ahead; ours put the two within about R1.3m, the
  tested range centred on zero. Tap "Kept as cash" and buying leaves more across the whole range.
- **The answer row** has its own heading, darker boxes, and who wins in the wide middle.
**Why it is there:** "I kind of just want to show how finicky these values are, and that you cannot just take one
snapshot to make the estimation or to decide renting or buying to be the answer. You actually need to play
around." (D-123)
**Show it:** Finance › Homes › Oranjezicht 2-bed (our figures), then the example beside it; then Kept as cash.

#### Yours above zero, paid out below; moments at the top (v0.25.2, 2026-11-13)
**What it does:**
- **What each side is worth:** what buying and renting leave you sit above zero; what each has paid out sits
  below. The lines have short names - Buy, Rent, Buy cost, Rent cost - each explained in a key under the graph.
- **The main graph's line is the Gap:** what buying leaves you minus what renting leaves you. Above zero buying
  leaves more; below, renting.
- **Moments on every graph** - Today, Bond paid off, You sell - are dashed lines to the top with a numbered tag,
  named in a key under the graph and on hover.
- **The rental deposit:** asked for the similar rental too - cash you cannot invest, back when you leave, with the
  interest it earns. By law it sits in an interest-bearing account for you: ask the landlord the rate.
**Why it is there:** "I want to make it very clear when the money on a graph is showing a positive money for
yourself, or if it is the cost of that thing." And: "I don't know when you get the deposit back at the end. Do you
get it back with interest?" (D-122)
**Show it:** Finance › Homes › Oranjezicht 2-bed (example) › What each side is worth; then "Its rental deposit".

#### Safer by design (v0.26.0, 2026-11-14)
**What it does:**
- **Its own address:** Family Hub moves to familyhub.detronics.co.za, so no other app can reach a family's
  things; a note says how to bring them along (a family file, or reconnecting the Drive folder).
- **Only the folder it needs:** the Drive steps ask for a folder called Family Hub, and Family Hub asks before
  using a folder with other files in it.
- **Locked down:** a Content Security Policy on the app, mini-apps in a sealed page of their own, no HTML built
  from text anywhere, printing built from plain text.
- **Said straight:** Privacy says how things are stored and who can read them, what to do on a shared computer,
  how to remove the browser's access, and how to report a security problem privately.
**Why it is there:** a security audit of every Detronics app (score 74, grade C): "Never lose a family's data"
- and do not leave a door open for the day a bug slips in. (D-129 to D-135)
**Show it:** Settings › Google Drive (the new steps); the footer's Privacy (the new sections and the report link);
open Medical for the first time on a device.

#### Amounts you can read as you type (v0.25.9, 2026-11-14)
**What it does:** every amount box in Finance groups the digits in threes while you type - 1500000 becomes
"1 500 000" - so a missing or extra zero shows at once. The save box under each tool suggests a name that fits it.
**Why it is there:** "We're working perhaps with money in the range of millions, help the user out with counting
the zeros." (D-127)
**Show it:** Finance › Budget and goals › Spent something? - type 1500000 slowly and watch the spaces appear.

#### Raises when they really came (v0.25.7, 2026-11-14)
**What it does:** each raise is its own entry - Add raise, pick the month and year, put in the percentage - every
six months, a month after starting, whenever. A raise you know is coming goes in too. After the last one, the
yearly raise you expect (or the inflation rate, labelled Estimated) is spread month by month: no date is assumed.
**Why it is there:** "Don't assume it's every year and don't assume any timeline. Some people get a raise a month
after they start. So just let them add raise entries." (D-125)
**Show it:** Finance › Salary and costs › Your raises › Add raise: June 2023 10%, December 2024 5%, June 2025 2%.
**And:** a raise can be the new salary instead of the percentage - each entry shows both, "R54 000 a year, +8%". (D-126, v0.25.8)
**And:** the table under the answer is Raise by raise - a row in each raise's own month, not on the anniversary of starting. (D-128, v0.25.10)

#### Is your salary keeping up? (v0.25.0, 2026-11-13)
**What it does:**
- **Your salary against your own costs:** the salary you started on, each raise since, and your costs -
  rent, medical aid, petrol, the rest - each rising at its own rate: yours from then and now, or a
  starting rate labelled Estimated with its source.
- **What it buys now** in the prices of when you started, beside what CPI alone would say.
- **The years ahead:** married in 3 years, two children - each life event adds its costs from its date,
  and the graph shows the take-home you would need against the one your raises give, and where the gap opens.
**Why it is there:** "Someone started at R50 000 a year, 3.5 years ago, in Cape Town. With the raises
they've had, are they better off each year, or more broke because of what their own costs did?" Rent
rising 10% a year, medical aid above inflation, petrol at a record - one inflation figure hides them. (D-119)
**The philosophy it shows:** own figures beat rules of thumb; graphs answer one question; the gap shown
plainly, with no advice.
**Show it:** Finance › Salary and costs: R50 000 a year from May 2023, raises, rent then and now, a child in 2028.

#### Budget starting set and food per meal (v0.25.0, 2026-11-13)
**What it does:**
- **Starting set:** the categories most families have, each broken into what people forget - rates,
  security, tyres, gap cover, school trips, replacing appliances. Untick "We don't have this", rename,
  remove and add.
- **Food per meal:** what the food money allows for breakfast, lunch and dinner, a person and for the
  family, on the family's own split of the day - and how many dinners eating out uses.
**Why it is there:** the budget started empty, so everyone started from scratch. And on meals: "Breakfast
is usually cheaper than lunch, which is usually cheaper than dinner. But each person lives and works
differently... we know how much we need to spend on buying cereal and milk and bread type items." (D-119)
**Show it:** Finance › Budget › Starting set, then Plan the categories › Food.

#### Simple, Advanced, Expert - one choice for the whole app (v0.25.1, 2026-11-13)
**What it does:** a small bar under the top bar on every page: Simple, Advanced or Expert, with a line saying
what each shows. It follows you down the page; Hide folds it to a small ⋯ tab. Every app reads the same choice.
**Why it is there:** "That should be a selection that you constantly see under the top bar... I choose simple,
that means I want everything run in simple... It's called expert because it's constant over all our apps, is
part of our app design philosophy." (D-121)
**How it was decided:** this reverses the first-day decision to have no app-wide levels in a family app; the
Finance tools' own Simple / Advanced / Learn chips went, and Learn is now Expert.
**Show it:** any page - choose Expert, open a home's Financing, and "How it is worked out" appears.
**Changed (v0.25.6, 2026-11-14):** moving the level into the core briefly stopped the Finance tools ("shows is not defined"); fixed, with a test that catches the same slip.
**Changed (v0.25.5, 2026-11-13):** made thin - small pills, not like the other buttons: "a lot smaller in size... that bar should be a lot thinner."

#### Who wins, said in full (v0.24.3, 2026-11-13)
**What it does:** the box under a home's answer shows, for the year you sell, what buying leaves, what renting
leaves, and who wins by how much. Close results say "About the same".
**Why it is there:** the box said "R41 104 117 more with renting instead". The owner asked: "It's a bit unclear,
like more than what, and like, is this the delta?... It should show exactly which one wins in this instance."
(D-120)
**How it was decided:** both totals first, then the difference, named; the saved line and Story say the same.
**Show it:** Finance › Homes › Oranjezicht 2-bed (example) - it opens on Financing.

#### What each side is worth, and Bond over (v0.24.1, 2026-11-12)
**What it does:**
- **A graph of each side's whole worth over time.** Buying is the home if it were sold, plus what was
  invested along the way. Renting is the renter's investments.
- **The crossing:** the year one passes the other is marked, and said in words.
- **Money paid out:** every rand each side has paid out shows beside it as a dashed line.
- **Bond over:** a slider sets the bond's length from 5 to 30 years.
**Why it is there:** "Your total worth that you have at that time in rent and investments versus in buying...
as soon as you've paid off the bank, then the full house amount is in your worth." And: "What if I did the
bond over 14 years? That's how I bought my house." (D-117)
**How it was decided:**
- It uses the same money as the main graph, so the two always agree.
- The main graph keeps the gap; this one shows the totals behind it.
- Compare is now always on the list, and says what it needs.
**Show it:** Finance › Homes › a home › Financing, then slide Bond over to 14.

#### Sell after, and what would it take for buying to win (v0.24.0, 2026-11-12)
**What it does:**
- **Sell after:** a slider moves the year you sell, in half years. The whole page reads at that year.
- **What would it take for buying to win?** For each year you might sell, the graph shows the house-price
  growth (or investment return) at which buying and renting come out level. Your own figure is drawn
  beside it.
- **The rent line:** "Can you afford it each month?" marks the year rent passes the buyer's monthly cost.
**Why it is there:**
- "A crossover point at which renting is better or buying is better... with tolerance bands, so that you
  can also see like what percentage of what would create a break-even point at what year."
- "If I want to sell at year 12.5, like what is the best?" (D-116)
**How it was decided:**
- Each point is the whole model worked out again, not a shortcut.
- It says what would have to happen, never how likely it is.
- The day-one cash invested and the break-even graph were already there. They appear once "Rent for a
  similar home" is given.
**The philosophy it shows:** you decide; graphs that answer a question.
**Show it:** Finance › Homes › Oranjezicht 2-bed (example) › Financing, then the Sell after slider.

#### The example home: moneywithcarla's Oranjezicht 2-bed (v0.24.0, 2026-11-12)
**What it does:** every family starts with the 2-bed from moneywithcarla's post: R11,5m to buy, or R45K a
month to rent. It shows:
- the post's results beside Family Hub's, with the differences, measured and not adjusted;
- what the post leaves out, each item with Try or Show.

Remove it from Our homes when you are done.
**Why it is there:** "Put as a default into the app that can be deleted... so people can play around...
I want to see how accurate our calculations and the image calculations is. So don't modify anything to
make it similar to that." (D-116)
**How it was decided:**
- The post's figures are kept as given, and the differences are explained:
  - duty and fees item by item;
  - capital gains tax on the sale;
  - 13% a year compounded to the year;
  - the buyer investing once rent costs more.
- moneywithcarla and the post are on Finance's Creators and videos.
**The philosophy it shows:** structure, not content; link the source, don't copy it; better decisions
with what you know now.
**Show it:** Finance › Homes › Oranjezicht 2-bed (example) › Financing › "An example to play with".

#### Selling to buy, every cost item by item (v0.9.16, 2026-10-27)
**What it does:** itemises transfer duty, attorneys, Deeds Office and bank fees, and the agent's own
percentage plus VAT. It shows what is left after the bond, split into the next deposit and money
kept for renovating.
**Why it is there:** "Different sales agents for the houses ask different percentages. And I know
there's also lawyers' fees and the hidden fees for buying the house." (D-074)

#### Homes and Cars: the whole decision, not only the money (v0.21.0, 2026-11-04)
**What it does:** each home or car has six sections, in the order you go through them (v0.23.2):
- **Story:** where it opens - the name, where it stands, and everything noted.
- **Financing.**
- **Online:** what the ad and the map show.
- **General:** the questions for the agent, seller or dealer.
- **Viewing:** mould, roofs, cracks, plumbing and electrics; on a car, accident damage and the roof
  of a tall vehicle.
- **Feeling.**

Each question stage ends with **Go on** or **Stop here** (Feeling: **Buy it** or **Walk away**),
with that stage's walk-aways and unmet must-haves as the reasons to weigh. The Story and Compare say
where each one got to. A choice, never a lock: a later stage stays open.

Each check is marked OK, Worry or Walk away, with a note and a cost to fix. Print the questions,
export them, fill them in, and import them back.
**Why it is there:** "I don't want people to be taken for a ride and be regretful afterwards...
People sell houses because there's mould and they got a quote... and now they put their family at a
health risk." (D-111)
**Show it:** Finance › Homes › a home › Viewing.

#### Cars: the true cost, and petrol against electric (v0.9.9 and v0.9.18, 2026-10-27 to 2026-10-28)
**What it does:** works out fuel and charging from distance and consumption, using the official fuel
price. It compares a petrol car with an electric one, including the differences in upkeep, tyres and
insurance.
**Why it is there:** "Is fuel consumption also part of it? Or for EVs and hybrids, the cost of
electricity?" (D-076)

#### Job offers (v0.9.11, 2026-10-27)
**What it does:** compares job offers using take-home pay from a payslip, or a labelled SARS
estimate. It counts increases, benefits, moving costs, and how long it takes to get ahead of the
job you have.
**Why it is there:** from the owner's brief: "A higher salary is not necessarily the better
opportunity." (D-068)

#### Children's future (v0.9.12, 2026-10-27)
**What it does:** builds each child's milestones and costs from their birthday, and shows the whole
family's years ahead, with the busiest year marked.
**Why it is there:** from the owner's brief: "If I have multiple children with different ages and
future needs, how much should I plan for all of them?" (D-069)

#### The money plan (v0.9.13, 2026-10-27)
**What it does:** puts every goal on one timeline: holidays, cars, homes, children and jobs. It shows
what to put aside each month, and where things do not fit. (D-070)

#### Graphs that tell the story (v0.9.15 to v0.9.31, 2026-10-27 to 2026-10-31)
**What it does:**
- Each graph marks the moments that matter: Today, Bond paid off, and where one option pulls ahead.
- Money in your pocket is above zero; money going out is below.
- Tap anywhere to read every line.
- Zoom to 5 years, choose where the graphs end, and see future prices in today's money.
**Why it is there:**
- "Like if I plan on staying there more than 10 years, then it's better to buy. It's nice to see it
  on graphs."
- "Make all values going out of my pocket negative and all values growing my pocket positive."
  (D-073, D-077, D-088, D-089, D-090)

#### Print, PDF and CSV (v0.9.24, 2026-10-29)
**What it does:** print a report or save it as a PDF, and export the numbers to CSV, so it can be
shared or checked elsewhere. (D-083)

### Medical

#### Doctors' accounts, claims and the SARS tax year (v0.9.36, 2026-11-02)
**What it does:** tracks every account, invoice and quote for the family:
- what is owed and when it is due;
- payments, and who was paid;
- medical aid and gap cover claims, and follow-ups;
- where the invoice and proof of payment are kept.

The SARS tax year view checks that everything is logged.
**Why it is there:** "This is not to keep medical history, but rather to keep track of outstanding
medical expenses... And then at the end of the year, compare it for the financial year of SARS."
(D-094)
**Show it:** Home › Medical.

#### Notes per person (v0.17.0, 2026-11-02)
**What it does:** keeps allergies, medicines, blood group and each person's doctor. Food allergies
from People are shown, not retyped.
**Why it is there:** "I will not add medical records. But there can perhaps be... a note section
where we can add specific notes like allergies." (D-103)

### Parenting

#### Planned ahead: Agreements, Ideas and Play now (v0.11.0, 2026-11-02)
**What it does:** Parenting opens on doors that keep "time to think" apart from "no time to think".
**Why it is there:** "The plan section is when we have time to think of activities... the activities
section is when you do not have the mental capacity to think and just want to execute." (D-096)
**Show it:** Home › Parenting.

#### Topics are questions you decide together (v0.10.0 to v0.18.0, 2026-11-02 to 2026-11-03)
**What it does:** each topic is a set of questions, for example bottles: breast, bottle or both;
which kind; until when.
- Each parent writes what draws them, what worries them, and what would change their mind.
- The other parent's answer shows once you have given yours.
- Then you decide, and the decision is recorded.
- A dashboard counts how many topics are agreed.
**Why it is there:** "The Parenting side of the app brings the discussions to light and has it as a
dashboard keeping track of which topics and how many have been concluded and agreed on." (D-095,
D-106, D-107)
**The philosophy it shows:** awareness, not direction; plan ahead.

#### Our fever plan, the medicine chart and Be prepared (v0.17.0, 2026-11-02)
**What it does:** the parents write the fever plan for each age band: from what temperature, for how
long, what we do, and when we go straight to a doctor. Print it, or print the medicine chart.
**Why it is there:** "The decision you're making is when it hits what temperature, for how long, are
we heading out? There shouldn't be, in a stressful situation like this, a discussion." (D-106)

#### Ideas and Play now (v0.11.0 and v0.13.0, 2026-11-02)
**What it does:**
- Activities by age, with setup time against how long they keep children busy.
- Sliders set what fits right now.
- Choose by a list, spin the wheel, a surprise, "this or that" for the children, or eeny meeny.
**Why it is there:** "Something that takes 5 minutes to set up and entertains for 30 minutes is
better than a 30-minute setup and 45 minutes of entertainment." (D-096, D-099)
**Show it:** Parenting › Play now, then Spin.

#### Screen time: notice, not judge (v0.12.0 and v0.12.1, 2026-11-02)
**What it does:**
- A quick log of who watched what, for how long, and how it left them.
- Each child's week is shown beside the minutes you agreed.
- Shows are ranked on your own values, and a decision can set the lowest score you are happy with.
**Why it is there:** "Part of the decision section can be to only watch shows that score above a
certain value." (D-097, D-098)

#### Track a worry (v0.14.0, 2026-11-02)
**What it does:** start a tracker when something worries you, such as a fever, sleep or eating. Log
a reading in a tap or two, see when the next one is due, and get a summary for the doctor. (D-100)

#### Routines the children tick off (v0.17.0, 2026-11-02)
**What it does:** start "Leaving the house" or "Bedtime" and the screen splits into a column per
child, with pictures for children who cannot read yet. There are no races between them.
**Why it is there:** "Have they brushed their teeth? Have they taken a bath? Have they read a story?
...Little responsibilities you can assign to the kid, and then they have a place to tick it off."
(D-105)

#### The Planner (v0.17.0, 2026-11-02)
**What it does:** shows the week for each child and parent: sport, after-school activities and
concerts, with trips and planned dates alongside. It points out when two things clash. (D-104)

#### Who looks after the children, and who to call (v0.16.0 and v0.17.0, 2026-11-02)
**What it does:** the family's childcare rule shapes the whole app. The emergency numbers are your
own, starting from your country.
**Why it is there:** "All the emergency phone numbers should be editable depending on your location
across the world." (D-102, D-103)

### Faith

#### A journal of questions and the passages you found (v0.7.0, 2026-10-26)
**What it does:** each entry has a heading, the questions you are trying to answer, and whether you
found an answer, need more reading, or have only the question so far. It also keeps several
passages picked from lists, notes, and topics.
**Why it is there:** "I also want to be able to add the question I tried to answer as a separate
input that I can then later reflect on." (D-049)
**Show it:** Faith › Journal › New entry.

#### A guide to every book (v0.7.0 and v0.7.2, 2026-10-26 to 2026-10-27)
**What it does:** covers all 66 books: who wrote it, when, to whom, why, and what it is about, laid
out as blocks you can read at a glance.
**Why it is there:** "I want guidance in the five ways: who wrote it, why and to whom and when and
who is it about." (D-049)

#### The family's own topics (v0.9.3, 2026-10-27)
**What it does:** add a topic straight from an entry. Hide, show or remove any topic. Each one
gathers the passages and questions you have logged on it.
**Why it is there:** the 25 starting topics were fixed. The owner asked: "How do I add and remove
topics under faith?... I just want that easier, more intuitive." (D-058) Giving each topic its own
verses, and turning a topic into a page, is still to come (BACKLOG.md).

#### Reading plans (v0.2, 2026-10-25)
**What it does:** shows the next portion, lets you mark it read, and tracks progress, alone or
together.

### Exercise

#### Your own exercises and workouts (v0.19.0, 2026-11-03)
**What it does:** keep exercises with their steps, sets and reps or seconds, and what you need. Put
them together into workouts of any length.
**Why it is there:** the owner wanted to plan exercise the way meals and the children's activities
are planned. (D-108)

#### "I have 25 minutes", rounds and tallies that never reset (v0.20.0, 2026-11-03)
**What it does:**
- Workouts are not given days.
- "I have 15, 25 or 45 minutes" shows what fits.
- A round can be done in any order, whenever you can.
- The year's tally never resets, and an empty week just says "any time you have 15 minutes".
**Why it is there:** an hour planned today can go to a child who needs you. "Even if I forget to
exercise for a week, then I just want to continue." (D-110)
**Changed (v0.23.0, 2026-11-11):** the Workouts tab stopped as soon as a family had a workout. It used
a word it never imported, from v0.20.0 on. That is fixed, and a test now catches the same mistake on
any screen. (D-114)
**The philosophy it shows:** Life happens; the lowest way in.
**Show it:** Exercise › This week › I have 25 min.

#### Timed workouts: one Start, nothing to touch, then what you did (v0.23.0, 2026-11-11)
**What it does:** three workouts every family starts with, each changeable and removable:
- **The Sydney workout:** 5 pull-ups, 10 push-ups and 15 squats; as many rounds as you can in 20
  minutes.
- **20 minutes a day:** pull-ups, push-ups, curls, dips, shrugs and lateral raises, each to failure,
  then the next, round and round for 20 minutes.
- **One exercise a day:** eight exercises in turn, one a session: pull-ups, dips, push-ups, rows, pike
  push-ups, squats, lunges and Romanian deadlifts. As many as you can, rest, and again.

**Start** sets a 20-minute timer and shows what to do in big letters. The screen stays on, buzzes a
minute before the end, and chimes at the end. Then you log what you did: the rounds, how many of
each, or how many of today's one. The workout's page shows the last time and your best.
**Why it is there:** "While I exercise, I don't want to interact with a phone or device. And if it is
required, it's to a moderate sense." The second is from a creator whose "entire thing is it's only 20
minutes a day". The third "only exercises one type of exercise a day... but he rotates between 8
exercises". (D-114)
**How it was decided:**
- These are a new kind of workout ("How it goes"), so any family can make their own.
- One a day continues from the last one logged, never from the calendar. A missed week carries on
  with the next one, not a backlog.
- The only button on the way is optional: **Round done** counts rounds for you.
- The two creators are left for the owner to link (Edit › Creators and videos). The app never names
  real people.
**The philosophy it shows:** life happens; the lowest way in.
**Show it:** Exercise › Workouts › The Sydney workout › Start.

#### What each exercise works, on a little figure (v0.20.0, 2026-11-03)
**What it does:** a front-and-back body figure shades what an exercise, a workout or your week
works, and names what a workout leaves out. (D-109)

#### Exercises with your children (v0.20.0, 2026-11-03)
**What it does:** squats holding your child, or push-ups with them on your back. The weight moved
uses their latest weight from People.
**Why it is there:** "My kids are like 2.5, so they weigh like 16 kg each. I have twins, so like
doing squats with them or doing push-ups with them on my back." (D-109)

#### Filters under headings, and Remove beside Edit (v0.22.1, 2026-11-04)
**What it does:**
- The filters sit under Where, Type and Muscles.
- Change beside Type adds or removes a type, and a removed type comes off its exercises too.
- Remove sits beside Edit.
**Why it is there:** "It feels like they should be categorized." The owner could not find how to
remove an exercise or a filter. (D-113)

### Holidays

#### Big trips, and places nearby for a free day (v0.2 and v0.7.0, 2026-10-25 and 2026-10-26)
**What it does:** plans trips with travel, an itinerary, packing and a budget. Separately, it keeps
places nearby, tagged great for kids, play area, pet friendly, free or rainy day.
**Why it is there:** "Big holiday planning, which requires saving, traveling and all of that, and
then local things to do, for example in Cape Town." (D-048)
