# Family Hub / Family Management System

## Product vision, architecture, phased implementation plan, and testing guide

**Document purpose:** This is the product and delivery brief for
building the Family Hub with Claude or another coding agent. It
describes the intended product, the important decisions already made,
the major modules, the proposed technical direction, and a staged plan
that starts with a small, testable foundation and expands without losing
the bigger picture.

**Working product name:** Family Hub (also referred to as Family
Management System / FMS). Treat this as a working name, not a final
brand decision.

**How to use this document:** Give this file to Claude along with the
instruction prompt at the end. Ask Claude to read the entire document
first, then work only on the current phase and step. Claude should not
attempt to build the entire app in one pass.

**Status convention** - **Defined:** An intention or product requirement
already established. - **Proposed:** A sensible implementation approach
that should be validated before being treated as final. - **Open
decision:** Something to resolve through a small, explicit decision
rather than silently guessing. - **Later:** A future capability that
should inform the architecture but does not belong in the first
prototype.

------------------------------------------------------------------------

# 1. Executive summary

Family Hub is a modular, customizable family-management app designed to
help a household coordinate everyday life, make thoughtful decisions,
and maintain shared information without creating another source of
pressure.

The app should be **simple on the surface and capable underneath**. A
person should be able to complete a common action in seconds, while
deeper planning, history, explanations, and configuration remain
available when needed.

The app is not intended to impose a rigid ideal household schedule. It
should help a family decide what matters, understand its real capacity,
take useful action, and adjust when a system does not work.

The product has four connected layers:

1.  **Family workspace:** shared household profiles, records, documents,
    and common data.
2.  **Customizable dashboard:** large, easy-to-use module buttons,
    ordered to suit each person's priorities.
3.  **Specialized modules:** Finance, Meals, Chores, Medical, Tickets,
    Principles, and other areas.
4.  **Shared planning logic:** tasks, decisions, resources, schedules,
    people, and records can connect across modules without forcing users
    to enter the same information repeatedly.

A core product philosophy is:

> Capture quickly, think deeply later, and keep the useful outcome.

Another is:

> Missed tasks are information about workload and systems, not an
> automatic reason to add more work tomorrow.

The first release should not try to deliver every module. It should
establish a robust foundation, then prove one everyday workflow
end-to-end. The recommended first vertical slice is **Chores: Plan →
Execute → Complete → Suggest next task → Review shared progress**. This
directly tests the product's most distinctive interaction model while
exercising navigation, family data, recurring work, filters, history,
and local persistence.

------------------------------------------------------------------------

# 2. Product vision and outcomes

## 2.1 The problem to solve

Family life contains many connected but different types of work: -
Repeated household maintenance. - One-off tasks and larger projects. -
Meals, recipes, shopping, and nutrition. - Medical and emergency
information. - Money, budgets, savings, debt, and future planning. -
Family agreements, values, decisions, and ongoing experiments. -
Conversations that should be captured now but discussed later. -
Holidays, exercise, faith, and other family priorities.

These needs often end up scattered across messages, notes, calendars,
documents, spreadsheets, and memory. The result can be duplication,
forgotten work, poor visibility, repeated conversations, and an unfair
sense that one person is carrying everything.

Family Hub should connect these needs while keeping the daily
interaction lightweight.

## 2.2 Product outcomes

The app should help a family:

1.  See the information and actions relevant to them.
2.  Share household information without re-entering it in multiple
    places.
3.  Capture an issue or positive moment in seconds.
4.  Find a useful task that fits available time, energy, location, and
    ability.
5.  Plan recurring work without turning the calendar into a rigid
    command system.
6.  Understand why a plan is not working and adjust the plan,
    expectations, or environment.
7.  Make decisions with context, alternatives, consequences, and a
    review point.
8.  Keep important family and medical information accessible when
    needed.
9.  Make longer-term plans for money, meals, holidays, health, and
    family development.
10. Preserve privacy and user control over family data.

## 2.3 Non-goals

The app must not: - Become a punitive productivity tracker. - Treat
every overdue item as equally important. - Automatically move every
missed task to tomorrow. - Assume that a missed task means laziness or
lack of care. - Require every user to see the same dashboard. - Force a
family to adopt every module. - Make a decision appear permanent or
unquestionable. - Pretend nutritional, medical, financial, or projection
estimates are exact when they are not. - Require all family data to be
stored in a developer-controlled database. - Make the first version a
huge, untestable collection of unfinished modules.

------------------------------------------------------------------------

# 3. Product principles

These principles guide product decisions and code review.

## 3.1 Fast at the surface, deep when requested

-   Common actions should require as few steps as practical.
-   Capture should be possible before a person has fully categorized or
    solved an issue.
-   Advanced settings and explanations should be available without
    blocking basic use.
-   Use progressive disclosure rather than showing every field at once.

## 3.2 Shared information, personal views

-   Household records can be shared while each parent arranges their own
    dashboard.
-   A personal dashboard order is a preference, not a separate copy of
    family data.
-   Where privacy matters, explicitly define who can see, edit, or share
    a record.

## 3.3 Flexible, not rigid

-   Support routines and recommended timing without requiring fixed
    weekdays for every task.
-   Preserve unfinished important work, but do not automatically
    overload the next day.
-   Let people choose what is feasible right now.

## 3.4 Assume positive intent

The product should encourage the family to investigate constraints and
system problems before assigning blame. A missed chore may indicate
insufficient time, energy, unclear ownership, poor storage, unrealistic
frequency, or a broken process.

This does not mean ignoring the outcome. It means addressing the outcome
respectfully and looking for a workable solution.

## 3.5 Use three resource "batteries"

The initial shared resource model includes: - **Time:** how long
something takes and what time is available. - **Energy:** physical or
mental effort required and currently available. - **Money:** financial
cost and available budget.

Other resources such as attention, help, or emotional capacity may be
considered later, but should not complicate the first version.

## 3.6 Explain estimates and uncertainty

If a task duration, nutrition value, projection, or other figure is
estimated, label it accordingly. Do not imply precision unsupported by
the inputs.

## 3.7 Useful history, not punishment

Record what happened so the family can learn. Do not use streaks, shame,
or escalating overdue counts as the primary motivation system.

## 3.8 Modular and expandable

A new module should be addable without redesigning the whole app. Shared
concepts such as people, tasks, files, dates, decisions, and resources
should be reusable.

## 3.9 Privacy by design

Medical, financial, relationship, and other sensitive information needs
clear visibility rules. A shared family workspace must not imply that
every thought or record is automatically visible to everyone.

------------------------------------------------------------------------

# 4. Users, profiles, and access

## 4.1 Household members

The app should support a family containing: - Parent/adult profiles. -
Child profiles. - Potentially other trusted household members in a later
version.

Each profile may contain name, display icon, age/date of birth where
relevant, preferences, permissions, and other information needed by
modules.

## 4.2 Profile selector

A simple profile selector near the top of the interface may show human
icons for household members and ask "Who are you?" where useful.

Important security rule: **selecting a profile icon is not
authentication**. It is only a convenient UI selection. Anyone who can
access a shared workspace may be able to select another profile unless
real authentication and permissions prevent it.

Do not use the profile selector as the security boundary for sensitive
data.

## 4.3 Personal dashboard preferences

Each parent should be able to: - Reorder dashboard modules. - Hide
modules they do not use. - Restore hidden modules. - Choose a default
landing page or preferred module. - Have a different dashboard layout
from their partner.

These settings should be stored as personal preferences associated with
a real user identity where authentication exists, not mixed into shared
household data.

## 4.4 Permissions

At minimum, plan for these conceptual access levels: - **Owner/admin:**
manages household configuration and access. - **Adult member:** uses
shared modules and manages permitted records. - **Child member:** sees
age-appropriate tasks and content, with limited editing. -
**Restricted/private record:** visible only to authorized people.

The exact role model is an open implementation decision. Define and test
it before adding sensitive data.

------------------------------------------------------------------------

# 5. Storage, synchronization, and privacy architecture

This is a major architectural constraint and must be considered early.

## 5.1 Data ownership requirement

**Defined:** The product should avoid storing persistent family data on
a developer-hosted server. The preferred direction is user-controlled
storage, such as a family folder in Google Drive or OneDrive, or local
storage for a local-only mode.

The user wants to be able to access the folder structure directly
through the provider's own app or website, and manually add or manage
files when practical.

## 5.2 Proposed storage strategy

Do not immediately build a custom cloud backend. First create a storage
abstraction and a local prototype. Then evaluate the practical options
for provider-backed storage.

Potential storage modes: 1. **Local-only prototype:** records saved in
the browser/device for development and early testing. 2.
**Export/import:** users can export a household data package and import
it elsewhere. 3. **User-controlled cloud provider:** connect Google
Drive or OneDrive and store structured app data and documents in a
family folder. 4. **Offline support:** retain a deliberate subset of
essential data locally, with clear sync behavior.

The final storage approach must be validated against provider API
capabilities, authentication, permissions, conflict handling, file
discovery, mobile browser limitations, and data portability.

## 5.3 Important technical distinction

Using Google Drive or OneDrive means the data is stored with that
provider, not exclusively on the device. The intended privacy benefit is
to avoid a separate developer-hosted family database, not to claim that
data never leaves the device.

## 5.4 Required architecture boundaries

Create a storage interface so UI components do not directly assume a
specific provider. For example, conceptual methods may include: -
`loadHousehold()` - `saveHousehold()` - `listFiles(folder)` -
`readFile(fileId)` - `writeFile(folder, file)` - `exportData()` -
`importData()`

These are examples, not a mandatory API. Use clear types, error
handling, and tests.

Separate: - Domain/business logic. - UI and navigation. - Storage
adapter. - Authentication and authorization. - File/document handling. -
Sync/conflict logic.

## 5.5 Sync and conflicts

Before multi-device cloud sync is considered production-ready, decide: -
What happens if two people edit the same record offline? - Is there a
last-write-wins policy, field-level merge, or conflict screen? - How are
deleted records represented and synchronized? - How does the app recover
from partial saves? - How are backups and exports performed? - What
happens if cloud permission is revoked or a file is moved manually?

Do not silently overwrite potentially important family data.

## 5.6 Sensitive data and emergency access

Medical and financial records require more care than ordinary chore
records. Plan for: - Explicit access controls. - Minimal collection of
sensitive data. - Separate emergency summary from full medical
documents. - Optional offline access to a deliberately selected
emergency summary. - Clear warning and recovery behavior if
local/offline information may be stale. - Export and deletion paths. -
No claim of end-to-end encryption unless it is actually implemented and
independently reviewed.

------------------------------------------------------------------------

# 6. Main dashboard and module map

The dashboard should use a small number of large, easy-to-tap buttons on
mobile, while remaining comfortable on desktop.

Current proposed categories:

  -----------------------------------------------------------------------
  Module                  Primary purpose         Initial status
  ----------------------- ----------------------- -----------------------
  Finance                 Budget, debt, savings,  Later
                          investment goals and    
                          projections             

  Meals                   Recipes, meal planning, Later
                          shopping, nutrition     

  Health                  General health goals,   Later
                          routines and            
                          non-emergency health    
                          information             

  Exercise                Fitness, activity and   Later
                          exercise planning       

  Chores                  Recurring household     First vertical slice
                          maintenance and         
                          cleaning                

  Tasks                   One-off actions and     Early foundation /
                          larger projects         later expansion

  Holidays                Trips, activities,      Later
                          itineraries and budgets 

  Medical                 Emergency details and   Later,
                          individual medical      privacy-sensitive
                          records                 

  Tickets                 Fast capture of         Early
                          concerns, ideas,        
                          observations and        
                          appreciation            

  Principles              Family values,          Early
                          guidelines, practical   
                          agreements and          
                          rationale               

  Decisions               Agreements and          Early concept;
                          experiments, with       placement open
                          review and history      

  Faith                   Bible reading,          Later
                          learning, reflections   
                          and family discussion   

  Settings                Profiles, dashboard     Foundation
                          layout, storage,        
                          permissions and         
                          preferences             
  -----------------------------------------------------------------------

These names and module boundaries remain configurable. "Principles" is
the preferred current name for the family-guidelines area because
"Rules" sounds too strict. Alternatives discussed include "Family Guide"
and "Agreements." Do not silently treat the name as permanently
finalized.

"Decisions" may be a top-level module or a workflow linked to Tickets
and Principles. Keep the data model able to support it either way.

------------------------------------------------------------------------

# 7. Shared domain model

Avoid designing every module as an isolated mini-app. Build reusable
domain concepts.

## 7.1 Core entities

A proposed initial model includes:

-   **Household:** shared workspace and configuration.
-   **Person:** family member profile.
-   **User identity:** authenticated account, if/when real
    authentication is implemented.
-   **Module preference:** per-user dashboard order and visibility.
-   **Task:** an action that can be assigned, scheduled, completed,
    deferred, or dropped.
-   **Chore definition:** a recurring or repeatable household action.
-   **Task occurrence:** one instance of a recurring chore, with its own
    due state and completion history.
-   **Project:** a larger outcome containing multiple tasks.
-   **Ticket:** a captured observation, concern, appreciation, idea,
    success, or opportunity.
-   **Principle:** a durable value or guideline, including rationale and
    practical application.
-   **Decision/experiment:** a time-bounded or revisable agreement, with
    alternatives, reasoning, owner(s), review date, and outcome.
-   **Resource estimate:** time, energy, and money requirements.
-   **File/document reference:** a link or ID to a file stored in
    user-controlled storage.
-   **Event/history record:** what happened, when, and by whom.
-   **Reminder:** a request to surface an action at a relevant time.
-   **Recipe, meal plan, shopping item, budget, goal, medical record:**
    future module-specific entities.

Use stable IDs, timestamps, schema versioning, and explicit
relationships. Avoid making a person's display name the primary
identifier.

## 7.2 Keep definitions separate from occurrences

For recurring chores, distinguish the reusable chore definition from
individual occurrences. Example: "Clean bathroom basin" is the
definition; completing it today is an occurrence/history event. This
avoids losing history when the frequency changes.

## 7.3 Shared data versus private data

Every record should have an explicit visibility concept, even if the
first version only supports shared records. Later access rules should
not require redesigning the entire model.

------------------------------------------------------------------------

# 8. Chores: first flagship workflow

Chores are the recommended first end-to-end module because they prove
the app's core philosophy and interaction patterns.

## 8.1 Two main modes: Plan and Execute

### Plan

The family defines what needs doing and how the system should work.

Planning should support: - Task name and description. - Room or area, if
relevant. - Frequency: daily, weekly, monthly, seasonal, annual, custom,
or one-off. - Estimated duration. - Energy/effort requirement. -
Importance/urgency. - Money cost, if any. - Instructions or checklist. -
People who can do the task. - Dependencies. - Last completion and next
due logic. - Optional versus necessary status. - Whether it is a
routine, maintenance item, one-off task, or improvement. - Notes on what
makes the task easier or more practical.

Do not require every field. Use sensible defaults and progressive
disclosure.

### Execute

The person starts with their current reality: - "I have five minutes." -
"I have ten minutes." - "I have more time." - "I have low energy." - "I
can tackle something bigger." - "I want to work in the kitchen." - "I
don't care which room." - "Show me something useful I can do now."

The app suggests suitable tasks based on available time, energy,
location preference, eligibility, due state, importance, and
dependencies.

The user may select another task or change filters at any time.

## 8.2 Cross-room task discovery

Room-based navigation should remain available, but must not be the only
way to find work. A person may have five minutes and want a task
anywhere in the house. Another person may have five minutes but
specifically not want to tackle the bathroom.

Provide both: - Browse by room/area. - Find a task by time, energy, and
other filters across the household.

## 8.3 Momentum without pressure

After a task is completed: 1. Confirm the completion. 2. Update the
task's occurrence/history and next-due logic. 3. Show a brief positive
acknowledgement without excessive gamification. 4. Offer a small
selection of suitable next tasks. 5. Let the user continue, change
filters, or stop.

The interface may say something like: "That's one thing taken care of.
Want to do anything else?" Do not imply that continuing is expected.

The next-task list should mix: - A useful/high-priority task. - An easy
task that maintains momentum. - A task that fits the same location or
context, where helpful.

Avoid recommending tasks that are not yet due unless they are explicitly
optional improvements or the user requests them.

## 8.4 Recurrence and completion

Track each task occurrence separately. The system should know: - What
was completed. - When it was completed. - Who completed it. - When it is
next due, if applicable. - Whether the task was skipped, deferred,
rescheduled, or no longer needed.

Do not use a hard weekly reset that erases unfinished work or blindly
moves every missed task forward.

Distinguish: 1. Routine work: resumes its normal cycle while recording
the last completion. 2. Important unfinished work: remains visible until
completed, rescheduled, or intentionally dropped. 3. Optional
improvements: remain available without being treated as urgent. 4.
Repeatedly missed work: prompts a review of the plan, capacity,
expectations, or underlying problem.

## 8.5 Room checklists

Room-based checklists should list individual actions. Completing one
item must not mark all items in the room complete.

Example kitchen tasks: - Load/unload dishwasher. - Wipe counters. -
Clean floor. - Clean oven. - Clean refrigerator. - Wipe cupboard fronts.

Example bathroom tasks: - Clean basin. - Clean toilet. - Clean shower. -
Replace towels. - Empty bin. - Periodic cupboard organization.

The examples are seed content for a prototype, not fixed requirements
for every household.

## 8.6 Flexible recovery

Avoid rigid schedules such as "Monday must be bathroom day." A household
can use suggested intervals without being trapped by them.

If a day is unusually hectic: - Do not automatically move every missed
item into tomorrow. - Keep genuinely important unfinished work
visible. - Let routine tasks resume their normal cycle, while preserving
completion history. - Let the next day be deliberately lighter if
needed. - If the same work repeatedly fails to happen, offer a review of
the workload and system.

Core rule: **missed tasks create information about workload, not
automatic extra burden.**

## 8.7 Workload pressure indicator

If a future dashboard shows household workload pressure, do not
calculate it by simply counting overdue tasks.

Consider: - Importance. - Frequency. - Time since last completion. -
Estimated effort. - Dependencies. - Whether the task is optional. - How
many tasks can realistically be completed with available time and
energy.

A cupboard reorganization should not weigh like a safety-related or
genuinely urgent task. Any indicator should explain its inputs and be
tested to ensure it supports decisions rather than creating guilt.

## 8.8 Three resource batteries

Tasks and projects can carry estimates for: - Time. - Energy. - Money.

Execution should match task demands to current availability where the
user has provided that information. These are decision aids, not
judgments about a person's worth or contribution.

------------------------------------------------------------------------

# 9. Tasks and projects

Keep Chores, Tasks, and Projects conceptually distinct.

-   **Chores:** recurring cleaning and household maintenance.
-   **Tasks:** one-off actions, repairs, errands, replacements, and
    other doings.
-   **Projects:** multi-step outcomes, such as reorganizing a bathroom,
    building storage, or redesigning a play area.

Projects may initially live within Tasks rather than being a top-level
dashboard module.

Tasks should support: - Description and category. - Assignee or people
who can do it. - Due date or flexible timing. - Status. - Recurrence
where relevant. - Estimated time, energy, and money. -
Checklist/instructions. - Dependencies. - Reminders. - Completion
history. - Related ticket, decision, principle, room, or project.

Children may see and complete age-appropriate assigned tasks according
to configured permissions.

------------------------------------------------------------------------

# 10. Tickets: capture now, discuss later

Tickets are a low-friction capture system for things a family wants to
remember and possibly discuss. They are not automatically accusations,
formal complaints, or commitments to take action.

## 10.1 Capture experience

A ticket should be possible to capture in seconds: 1. Open Tickets. 2.
Tap "Log a ticket." 3. Select a simple type or enter free text. 4.
Optionally add a voice note or photo, if supported. 5. Save and return
to life.

Do not require the user to choose a solution, assign blame, determine
responsibility, or fully categorize the issue during capture.

## 10.2 Ticket types

At minimum, consider: - Appreciation / connection. - Observation. -
Concern. - Idea / opportunity. - Success. - Household improvement.

Example appreciation: "You took over bedtime when I was exhausted. I
felt supported and cared for."

Example concern: "Screen-time transitions have been difficult this week.
I'm worried that the current routine is creating conflict."

## 10.3 Ticket lifecycle

Tickets can be: - Captured. - Clarified later. - Added to a family
discussion. - Linked to another ticket. - Converted into a
decision/experiment. - Converted into one or more tasks. - Deferred. -
Closed with no action, with an optional reason.

Private or restricted tickets may be needed. Do not assume every
reflection is automatically visible to all household members.

## 10.4 Weekly alignment meeting

A suggested flow: 1. Review appreciations and positive moments. 2.
Select concerns and opportunities worth discussing. 3. Understand each
person's perspective. 4. Explore alternatives and consequences. 5. Agree
on an experiment, action, or no change. 6. Record the reasoning. 7. Set
a review point where useful.

The meeting should produce decisions, experiments, actions, or an
explicit deferral rather than merely accumulating discussion notes.

------------------------------------------------------------------------

# 11. Principles: shared values and household guidelines

The preferred working module name is **Principles**, not "Rules,"
because the intention is mutual guidance rather than rigid control.

Principles may include: - Core values. - Household guidelines. -
Practical agreements. - Exceptions and context. - Reasons behind each
guideline. - Measurable targets where appropriate. - Links to related
decisions, tickets, and tasks. - Review triggers.

## 11.1 Example principle: "Assume positive intent"

**What we believe:** Everyone wants to succeed and contribute, even when
something goes wrong.

**How to apply it:** - Do not assume laziness when a chore is missed. -
Ask what prevented the task from happening. - Consider time, energy,
clarity, storage, and system design. - Describe problems in order to
find solutions. - Address repeated failures respectfully.

**Important distinction:** Assuming positive intent does not mean
ignoring a problem. It changes how the family investigates and responds
to it.

## 11.2 Example principle: "Put it away, don't put it down"

**Purpose:** Small actions prevent clutter from building up and reduce
the burden of deep cleaning later.

**Application:** When practical, return items to their designated
places.

**Exceptions:** Exhaustion, urgent needs, childcare, or situations where
putting something away is not practical.

**Review trigger:** If clutter continues to build, investigate whether
storage, room layout, workload, or the principle's practical application
needs to change.

## 11.3 Measurable guidelines

Some guidelines can have targets, such as a family-agreed screen-time
limit. Where measurement is available, compare the target with actual
behavior and discuss the result. Do not assume that a number alone tells
the whole story.

Principles should be revisable when their rationale no longer makes
sense or their effects are harmful.

------------------------------------------------------------------------

# 12. Decisions and experiments

Keep **Principles** and **Decisions** distinct in the domain model: - A
Principle expresses a durable value or guideline. - A Decision records
what the family currently agrees to do in a particular situation.

Whether Decisions becomes a top-level module or remains a workflow
linked to Tickets and Principles is an open UX decision.

A decision record should support: - The original ticket or issue. - The
purpose of the decision. - Alternatives considered. - Reasoning and
trade-offs. - Agreement and participants. - Actions needed. - Trial
period or review date. - Success indicators or observations. - Outcome
and lessons learned. - Whether the agreement is retained, improved,
reversed, or replaced.

Example: a screen-time transition experiment. 1. Identify the problem
and desired outcome. 2. Choose a possible routine. 3. Explain why it
might help. 4. Try it for an agreed period. 5. Observe child reactions,
transition ease, and practicality for parents. 6. Review what happened.
7. Keep, modify, reverse, or explore an alternative.

Core cycle:

**Observe → Discuss → Decide → Experiment → Review → Adapt**

A decision is the best current agreement given the information
available, not an immutable rule.

------------------------------------------------------------------------

# 13. Meals and nutrition

Meals should be its own module, distinct from general Health and
Exercise.

## 13.1 Recipe library

A recipe may contain: - Name and description. - Ingredients and
quantities. - Instructions. - Serving count and scaling behavior. -
Estimated preparation/cooking time. - Nutritional information where
known. - Family ratings and notes. - Allergens and dietary
restrictions. - Age suitability where relevant. - Source/reference if
imported.

Distinguish supplied nutrition values from calculated estimates and
unknown values.

## 13.2 Weekly meal planner

-   Plan recipes by day and meal slot.
-   Drag and drop where supported.
-   Adjust serving counts.
-   Reuse previous plans.
-   Account for who will eat a meal.
-   Recalculate ingredient quantities.
-   Provide a combined view of the week's meals.

The UX should not require every meal to be planned for the week.

## 13.3 Shopping planner

-   Generate a shopping list from planned meals.
-   Combine duplicate ingredients and quantities where safely possible.
-   Scale quantities based on servings.
-   Add unrelated items manually.
-   Check off purchased items.
-   Preserve items not yet purchased.
-   Avoid pretending ingredient units can always be combined
    automatically when units or ingredient forms differ.

## 13.4 Nutrition analysis and meal optimization

Potential capabilities: - Estimate calories, macros, and relevant
vitamins/minerals. - Compare intake with appropriate reference values. -
Show daily and weekly summaries for individuals and the family. -
Identify likely gaps and uncertainty. - Suggest practical additions or
substitutions based on identified needs, taste, cost, availability,
allergies, and dietary restrictions.

Do not assume that adding a particular ingredient automatically makes a
meal healthier. Recommendations should be evidence-informed and
transparent about uncertainty.

## 13.5 Children and infant nutrition

The data model may need age, date of birth, allergies, dietary needs,
portions, developmental stage, and feeding method where relevant. Infant
nutrition requires extra care, including breastfed/formula-fed infants
and the transition to solids. A breastfed infant should not
automatically be counted as eating the same dinner portion as the rest
of the family. A breastfeeding parent's nutritional needs may be
relevant to that adult's own profile.

Do not make unsafe clinical claims or position the app as a substitute
for personalized medical advice. Implement this area only after
selecting reliable clinical reference sources and reviewing its safety
requirements.

------------------------------------------------------------------------

# 14. Finance

Potential Finance tools: - Income and expense tracking. - Monthly
budgets. - Planned-versus-actual spending. - Debt repayment plans. -
Savings goals. - Large future expenses. - Scenario comparisons. -
Individual and household investment goals. - Contributions and current
values. - Future projections with visible assumptions and uncertainty. -
Target dates and progress tracking.

Do not imply projections are guaranteed outcomes. Keep household and
individual views clear. Financial account integrations are optional
future work, not required for the first version.

------------------------------------------------------------------------

# 15. Medical and emergency information

Medical is sensitive and should be implemented only after access control
and data-handling decisions are explicit.

## 15.1 Emergency summary

A fast-access screen may include: - Allergies. - Critical conditions. -
Current medications and doses, where verified. - Emergency contacts. -
Medical aid/provider and membership details. - Critical alerts.

Essential emergency information should be available offline if feasible,
with a clear way to see when it was last updated and a warning that
stored information may be stale.

## 15.2 Individual medical profiles

Potential records: - Medical history and diagnoses. - Procedures and
hospital visits. - Vaccinations. - Prescriptions. - Doctors and
providers. - Medical aid details. - Relevant documents and notes.

## 15.3 Documents

Potential documents include medical aid cards, IDs, prescriptions, lab
results, discharge summaries, and insurance documents. Treat these as
sensitive records with explicit visibility and export/delete controls.

Separate the quick emergency summary from full documents. Parents should
manage children's records, while adult record visibility must be
configurable. Do not assume all adult records should be shared simply
because the family shares an app.

------------------------------------------------------------------------

# 16. Health and Exercise

## Health

Possible functions: - General health goals and routines. - Appointment
notes and reminders. - Family health references. - Non-emergency health
records. - Individual goals and progress. - Connections to relevant
medical records, with permissions.

## Exercise

Possible functions: - Fitness goals. - Exercise plans. - Activity
tracking. - Weekly schedules with flexibility. - Progress tracking. -
Family-friendly activities.

Keep these separate from Meals, while allowing relevant information to
be reused when permission and context make sense.

------------------------------------------------------------------------

# 17. Holidays

Potential features: - Trip and activity ideas. - Destination
comparisons. - Budget estimates. - Itineraries. - Packing lists. -
Calendars and dates. - Family preferences. - Filters for children's
ages, available time, budget, and interests. - Links to relevant tasks,
bookings, and documents.

Do not build travel integrations before the core planning patterns have
been tested.

------------------------------------------------------------------------

# 18. Faith

A possible Faith module can support: - Bible reading by book and
chapter. - Reading plans. - Reflections, lessons, and questions. -
Meaningful passages. - Family discussion notes. - Progress without
making the experience only a checklist.

Keep the module optional and customizable like the others.

------------------------------------------------------------------------

# 19. Settings and onboarding

Settings should eventually manage: - Household setup. - Family members
and profile icons. - Dashboard order and visibility. - Module
settings. - Storage provider and connection state. - Local-only mode. -
Import/export. - Permissions and private records. - Reminders. -
Appearance and accessibility. - Data version and migration. - Help and
troubleshooting.

Onboarding should be short and staged. Do not ask the user to configure
every module before they can use the app. Begin with a household name or
workspace, a minimal set of profiles, and a first useful workflow. More
detail can be added as needed.

------------------------------------------------------------------------

# 20. UX and interaction requirements

## 20.1 Navigation

-   Mobile-first, responsive desktop support.
-   Large, easy-to-tap dashboard buttons.
-   Consistent back/navigation behavior.
-   Visible current module and clear path back home.
-   Do not hide critical actions behind hover-only interactions.

## 20.2 Progressive disclosure

For most workflows: 1. Show the primary action. 2. Ask only for the
information needed now. 3. Offer optional detail afterward. 4. Make
advanced settings discoverable but not obstructive.

## 20.3 Accessibility

-   Keyboard navigation.
-   Visible focus states.
-   Adequate contrast.
-   Readable type and touch targets.
-   Labels that do not rely on icons alone.
-   Screen-reader-friendly semantics.
-   Avoid color-only status communication.

## 20.4 Feedback

After an action: - Confirm what changed. - Explain relevant next
steps. - Allow correction or undo when practical. - Do not celebrate
every trivial action excessively. - Avoid guilt-inducing language.

## 20.5 Empty states

Every module should explain: - What it is for. - What the user can do
first. - Whether example/demo data is being shown. - How to remove demo
data or replace it with real information.

## 20.6 Demo data

Use clearly labelled demo data during development. Never mix example
family members, medical details, or household records into a real user's
data without explicit action.

------------------------------------------------------------------------

# 21. Technical implementation approach

The exact stack is an open decision and should be selected after Claude
inspects the existing project/repository, if one exists.

## 21.1 First instruction to the coding agent

Before writing code: 1. Inspect the current repository and its files. 2.
Identify the existing stack, build commands, tests, and deployment
setup. 3. Report what already exists. 4. Compare it with this
specification. 5. Propose the smallest implementation plan for Phase 0
and Phase 1. 6. Identify decisions that materially affect data safety or
architecture. 7. Do not overwrite or replace existing work without
explaining why and obtaining approval where appropriate.

If no repository exists, recommend a simple, maintainable web stack
suitable for a responsive browser app. Explain the trade-offs before
committing to a complex stack.

## 21.2 Architectural expectations

-   Typed domain models where supported.
-   Reusable UI components.
-   Clear separation of presentation, domain logic, and persistence.
-   Schema/version migration strategy.
-   Unit tests for business rules.
-   Integration tests for storage and critical flows.
-   End-to-end tests for the first complete workflow.
-   Linting and formatting.
-   Error and loading states.
-   No secrets committed to source control.
-   No unnecessary server-side storage of family data.
-   Avoid overengineering future modules before the first workflow is
    validated.

## 21.3 Storage-first discipline

Implement a local persistence adapter behind an interface first. Test
save/load, refresh behavior, schema changes, export, and import before
adding cloud-provider complexity.

Do not claim local browser storage is a backup or a multi-device
synchronization solution.

## 21.4 Documentation

Maintain: - `README.md`: setup, run, test, build, deploy. -
`PRODUCT_SPEC.md`: current product requirements, if this file is not
itself maintained as the canonical spec. - `IMPLEMENTATION_PLAN.md`:
phases, steps, and current status. - `ARCHITECTURE.md`: domain model,
storage, security, and key decisions. - `TEST_PLAN.md`: manual and
automated test cases. - `DECISIONS.md` or an architecture decision log:
important choices and why. - `.env.example` where configuration is
needed, with no real secrets.

Avoid duplicating this document in many places without a clear source of
truth. If this file is kept as the canonical product brief, other
documents should link to it and record implementation details
separately.

------------------------------------------------------------------------

# 22. Phased build and validation roadmap

The roadmap is deliberately incremental. Each phase must produce
something runnable and testable. Do not begin the next phase merely
because the code has been written; first verify the exit criteria.

## Phase 0: Inspect, clarify, and plan

### Step 0.1: Inspect the current project

-   Inspect repository structure and current files.
-   Identify framework, dependencies, entry points, build and test
    commands.
-   Identify any existing data models and persistence.
-   Check deployment and hosting assumptions.
-   Report any risks or incompatible assumptions.

**Test/evidence:** A short project audit that cites actual files and
commands, not guesses.

### Step 0.2: Establish the minimum architecture

-   Identify the first vertical slice: Chores Plan → Execute → Complete
    → Suggest next.
-   Define core entities needed for that slice.
-   Decide how to store local prototype data.
-   Define boundaries between UI, domain logic, and persistence.
-   Identify future constraints that must be respected now, especially
    user-controlled storage and permissions.

**Test/evidence:** A small architecture proposal and a list of
decisions, with assumptions clearly marked.

### Step 0.3: Create project working documents

Create or update README, implementation plan, test plan, and
architecture/decision log. Avoid generating large volumes of
documentation that are not used.

**Exit criteria for Phase 0** - Existing project has been understood. -
The first slice is agreed. - No major storage/security decision is being
silently guessed. - A small, ordered task list exists.

## Phase 1: App shell and customizable dashboard

### Step 1.1: Build responsive app shell

-   Create the main layout for mobile and desktop.
-   Add a home/dashboard view.
-   Add consistent navigation and page headings.
-   Use temporary placeholder module pages where needed.

### Step 1.2: Add module tiles

-   Show the current proposed module names.
-   Make each tile easy to tap.
-   Support hidden/visible modules and ordering in the UI.
-   Use clear empty/placeholder pages for modules not yet implemented.

### Step 1.3: Persist dashboard preferences locally

-   Save module order and visibility.
-   Restore preferences after refresh/reopen.
-   Keep dashboard preferences separate from shared family records in
    the model.

### Step 1.4: Add minimal household profiles

-   Create a small profile selector for demo use.
-   Clearly treat it as a convenience UI, not secure authentication.
-   Add a settings page for the demo household and profile display
    names/icons.

**Tests** - Dashboard works at common mobile and desktop widths. -
Keyboard navigation works. - Reorder/hide/restore actions work and
persist. - Refresh does not reset preferences. - Placeholder modules do
not imply that functionality exists when it does not.

**Exit criteria** - A usable app shell exists. - Dashboard layout
customization works. - Navigation and basic preferences are tested.

## Phase 2: Data model and local persistence

### Step 2.1: Define versioned core types

Define household, person, module preference, chore definition, task
occurrence, resource estimate, and event/history records.

### Step 2.2: Implement storage interface

Create a storage abstraction and a local implementation. Keep UI code
from directly manipulating raw storage.

### Step 2.3: Add save/load and error handling

-   Load initial state.
-   Save updates safely.
-   Handle invalid or unavailable data.
-   Provide useful error messages and recovery options.

### Step 2.4: Add export/import

-   Export the demo household into a documented, versioned data format.
-   Import valid exports.
-   Reject malformed data safely.
-   Avoid accidentally replacing current data without confirmation.

### Step 2.5: Add migration strategy

-   Version the stored schema.
-   Test loading an older sample and migrating it.
-   Keep migration logic explicit.

**Tests** - Create, edit, reload, and delete demo records. - Refresh and
reopen the app. - Export and re-import without losing key fields. -
Invalid import leaves existing data intact. - Schema migration is
tested. - Errors are visible and recoverable.

**Exit criteria** - Core data survives normal reloads. - Export/import
works. - Storage is isolated behind an interface. - The limitations of
local-only storage are documented.

## Phase 3: Chores Planning

### Step 3.1: Build the chore definition editor

Support name, description, room/area, frequency, duration, effort,
importance, optional status, eligible people, and instructions. Use
progressive disclosure and defaults.

### Step 3.2: Build task/occurrence logic

-   Separate recurring chore definitions from individual occurrences.
-   Track last completion and next-due logic.
-   Support one-off tasks.
-   Represent completion, skip, defer, reschedule, and drop distinctly
    where appropriate.

### Step 3.3: Build room-based views

-   Show each room and its actions.
-   Completing one action must not complete other actions.
-   Show relevant due/last-done information without clutter.

### Step 3.4: Add seed examples

Create a small, clearly labelled example set for a kitchen, bathroom,
and living room. Let the user edit or remove examples.

**Tests** - Create/edit/delete chore definitions. - Recurrence creates
or identifies the correct occurrence. - Completion updates the history
and next-due information. - Changing frequency does not erase history. -
One room item completing does not mark other items complete. - Demo data
can be removed.

**Exit criteria** - A household can define and browse its own chores. -
History is retained. - Recurring work behaves predictably.

## Phase 4: Chores Execute and momentum loop

### Step 4.1: Build the "What can I do now?" flow

Allow selection of: - Available time. - Energy/effort level. - Preferred
room or any room. - Optionally person/eligible tasks.

Do not require the user to fill out every filter. Provide a sensible
default path.

### Step 4.2: Implement task matching

Match candidates using: - Time estimate. - Energy requirement. - Room
preference. - Eligibility and dependencies. - Due status and
importance. - Optional improvement status.

Avoid a misleading single "perfect score." If ranking is used, make its
logic understandable and testable.

### Step 4.3: Build task completion

-   Let user start/select and complete a task.
-   Record who completed it, when, and which occurrence.
-   Update recurring status.
-   Confirm the change.

### Step 4.4: Build momentum suggestions

After completion, offer a few additional suitable tasks: - A
useful/high-priority option. - An easy continuation option. - A
same-room/context option where relevant.

Provide clear "Continue," "Choose something else," and "Finish for now"
paths. Stopping must be a valid completion of the session.

### Step 4.5: Add recovery behavior

-   Do not auto-stack every missed task onto tomorrow.
-   Keep important unfinished work visible.
-   Let routine work follow its normal recurrence.
-   Allow repeated misses to prompt a workload/system review rather than
    an escalating guilt signal.

**Tests** - A five-minute filter never recommends a task with a known
duration above five minutes, unless the user explicitly allows
overruns. - Low-energy filter excludes tasks marked high effort. - "Any
room" includes tasks from all relevant rooms. - Room filter restricts
suggestions correctly. - Completing a task updates history and future
suggestions. - Stopping after one task is straightforward and not
penalized. - Missed routines do not automatically create a cascade of
overdue tasks. - No completed task reappears as still incomplete due to
stale UI state.

**Exit criteria** - A person can go from opening Execute to completing
one task quickly. - Suggestions reflect stated time/energy/location. -
The momentum loop is optional and non-punitive. - The workflow works on
mobile and desktop.

## Phase 5: Shared household views and usability testing

### Step 5.1: Add household-level progress

Show completed and outstanding tasks in a neutral way. Avoid rankings of
family members or a "who contributes more" score.

### Step 5.2: Add basic activity history

Make it possible to see what was completed and when. Do not expose
sensitive details unnecessarily.

### Step 5.3: Conduct realistic usability tests

Test with scenarios such as: - A parent has five minutes and low
energy. - A parent wants only kitchen tasks. - Someone completes one
task and wants to stop. - A task is repeatedly missed. - A recurring
interval changes. - A child should see only eligible tasks. - A user
hides a module and later restores it.

Observe where people hesitate. Do not only ask whether they like the
design.

### Step 5.4: Measure the right outcomes

Track test results such as: - Time to find a suitable task. - Number of
interactions to complete a task. - Successful completion rate. - Wrong
recommendations. - How often users can stop without confusion. - Whether
people understand the difference between a routine, unfinished task, and
optional improvement. - Whether the interface feels supportive rather
than punitive.

Do not add invasive analytics by default. Early tests can be observed
manually or recorded with participant consent.

**Exit criteria** - Major task-flow issues are resolved. - Users
understand the system without extensive explanation. - Shared progress
does not become a competition.

## Phase 6: Tickets, Principles, and Decisions

### Step 6.1: Build quick ticket capture

Support text first. Add voice/photo capture only when the basic flow is
proven and the storage/privacy model supports it.

### Step 6.2: Add ticket types and visibility

Start with appreciation, observation, concern, idea, and success. Define
whether each record is shared or private.

### Step 6.3: Build Principles

Support title, type, rationale, practical application, exceptions,
target where relevant, and review trigger.

### Step 6.4: Build Decisions/experiments

Support issue/context, alternatives, reasoning, agreement, actions,
review date, observations, and outcome.

### Step 6.5: Connect records

Link tickets to principles, decisions, and tasks. Keep the links
understandable and optional.

### Step 6.6: Test the alignment workflow

Test capture now, clarify later, discuss, decide, create actions,
review, and close. Ensure a ticket can be closed without action and a
decision can be revised.

**Exit criteria** - Tickets are quick to capture. - Private/shared
visibility is clear. - Principles and decisions are distinct. - The app
preserves reasoning and review history.

## Phase 7: Cloud provider and multi-device storage research/implementation

Do not start this phase until local persistence and export/import are
reliable.

### Step 7.1: Compare provider options

Research current Google Drive and OneDrive API capabilities, OAuth
requirements, folder/file access, shared access, quotas, offline
constraints, and mobile behavior. Use current official documentation.

### Step 7.2: Choose a supported storage model

Write down the trade-offs and select a provider strategy. Consider
whether the app stores a structured household file, multiple files, or a
small database-like file set in a user-controlled folder.

### Step 7.3: Implement one provider adapter

-   Connect through the provider's official auth flow.
-   Create or select the household folder.
-   Store and retrieve app data.
-   Keep provider code out of domain logic.
-   Handle token expiry, permission removal, network failure, and
    moved/deleted files.

### Step 7.4: Add conflict and recovery handling

Test concurrent edits, offline edits, deletion, interrupted writes, and
stale copies. Provide conflict resolution instead of silently losing
data.

### Step 7.5: Test multi-device and shared-family access

Test two different devices and at least two household users. Confirm
which records are shared and which are private.

**Exit criteria** - Cloud storage works through the provider's
documented APIs. - The app explains where data is stored. - No
unsupported privacy or encryption claims are made. - Conflict and
recovery behavior is documented and tested.

## Phase 8: Medical and emergency information

Start only after permissions, privacy, and storage behavior are clear.

### Step 8.1: Design access levels and threat model

Define who can read/edit each kind of record, how adult privacy works,
and what emergency access means.

### Step 8.2: Build emergency summary

Keep the first emergency screen concise and fast. Show last-updated
status and stale/offline warnings.

### Step 8.3: Add individual records and document references

Add records incrementally. Make visibility explicit.

### Step 8.4: Test privacy and offline behavior

Test unauthorized access, shared-device behavior, offline stale data,
export, deletion, and permission changes.

**Exit criteria** - Access rules are explicit. - Emergency data can be
found quickly. - Offline data clearly communicates freshness
limitations. - Sensitive documents are not exposed through a generic
family view.

## Phase 9: Meals, recipes, meal planning, and shopping

### Step 9.1: Recipe library

Create/edit recipes, ingredient quantities, instructions, serving
scaling, notes, and restrictions.

### Step 9.2: Weekly meal planner

Add meals to dates/slots and adjust serving counts.

### Step 9.3: Shopping-list generation

Combine compatible ingredients, support manual additions, and check off
purchases.

### Step 9.4: Nutrition estimates

Add transparent estimates only after selecting reliable food/nutrition
data sources and a clear calculation method.

### Step 9.5: Meal improvement suggestions

Only after the data is reliable, suggest additions/substitutions tied to
actual nutritional gaps, preferences, cost, availability, and
restrictions.

### Step 9.6: Child/infant nutrition safety review

Validate age-appropriate handling and clinical source quality before
releasing this functionality.

**Exit criteria** - Recipe scaling and list generation are tested. -
Unknown data is not silently presented as exact. -
Allergies/restrictions are respected in matching. - Nutrition advice has
appropriate limits and sources.

## Phase 10: Finance

### Step 10.1: Basic budgets and transactions

Support categories, planned amounts, actual amounts, and period
summaries.

### Step 10.2: Debt and savings goals

Support target, contribution, dates, progress, and scenarios.

### Step 10.3: Investments and projections

Show assumptions, contribution schedules, possible outcomes, and
uncertainty. Avoid guaranteed-return language.

### Step 10.4: Family and individual views

Make ownership and shared/individual goals clear.

**Exit criteria** - Calculations have unit tests. - Assumptions are
visible. - Household totals do not accidentally double-count shared
assets or contributions.

## Phase 11: Health, Exercise, Holidays, and Faith

Implement each as a separate module using the established
architecture: - Health: routines, goals, appointments, and non-emergency
records. - Exercise: plans, activity, progress, and flexible
schedules. - Holidays: activities, destinations, itineraries, packing,
and budgets. - Faith: Bible reading, learning, reflection, and family
discussion.

Each module should have its own small release plan, domain model,
safety/privacy review where needed, and acceptance tests. Do not
implement them all in a single large phase if the team cannot test them
properly.

## Phase 12: Hardening and release readiness

-   Accessibility review.
-   Mobile and desktop browser testing.
-   Performance checks.
-   Data export/import verification.
-   Storage-provider failure tests.
-   Permission and privacy tests.
-   Backup and recovery documentation.
-   Error reporting that does not leak sensitive family data.
-   Dependency and security review.
-   User-facing help and onboarding.
-   Clear statement of current limitations.
-   Release checklist and rollback plan.

------------------------------------------------------------------------

# 23. Test strategy

Testing is not a final stage. Every phase includes tests before moving
forward.

## 23.1 Unit tests

Prioritize pure logic: - Recurrence and next-due calculation. - Task
filtering and ranking. - Resource/time matching. - Task occurrence
transitions. - Export/import validation. - Schema migrations. -
Shopping-list quantity merging. - Budget calculations and projections. -
Permission rules.

## 23.2 Integration tests

-   UI + domain logic + local persistence.
-   Create/edit/complete task and reload.
-   Export/import and migration.
-   Cloud adapter operations when implemented.
-   Conflict handling.
-   Visibility/access rules.

## 23.3 End-to-end tests

At minimum, the first vertical slice: 1. Open app. 2. Choose Chores →
Execute. 3. Select five minutes and low energy. 4. Choose a suitable
task. 5. Complete it. 6. Confirm it is recorded. 7. View next-task
suggestions. 8. Stop without doing another task. 9. Reload the app and
verify the state persists.

Additional end-to-end scenarios: - Create a recurring chore in Plan and
find it in Execute when due. - Complete one room task without completing
others. - Hide and restore a module. - Export and re-import a
household. - Verify that restricted records are not visible to
unauthorized users once permissions exist.

## 23.4 Manual usability tests

Observe people using the app with realistic tasks. Measure confusion and
completion, not just whether they say they like it.

## 23.5 Definition of done for every step

A step is not done merely because code exists. It is done when: - The
feature works in the running app. - Tests are added or updated. -
Existing tests still pass. - Error/empty states are considered. -
Responsive behavior is checked where relevant. - Documentation/status is
updated. - Known limitations are recorded. - No future feature is
falsely represented as already functional.

------------------------------------------------------------------------

# 24. Product risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Scope becomes too large             Build one vertical slice at a time;
                                      preserve future roadmap without
                                      implementing it now.

  Data is lost or overwritten         Storage abstraction, versioned
                                      exports, migration tests, conflict
                                      handling, backups.

  Shared account is mistaken for real Clearly distinguish profile
  permissions                         selection from authentication;
                                      design real access control before
                                      sensitive data.

  App becomes another source of       No punitive streaks; no automatic
  pressure                            overdue cascade; optional
                                      continuation.

  Task recommendations feel wrong     Transparent filters, editable
                                      estimates, realistic usability
                                      tests.

  Estimates look exact when they are  Label estimates and show
  not                                 assumptions.

  Sensitive medical/relationship data Explicit visibility, minimal data,
  is exposed                          separate emergency summaries,
                                      access tests.

  Cloud provider APIs change or are   Research current official
  limited                             documentation and isolate
                                      provider-specific code.

  Too much configuration is required  Progressive disclosure, sensible
                                      defaults, optional fields.

  Household contribution becomes a    Show shared progress without
  competition                         leaderboards or "who did more"
                                      scores.

  The app duplicates information      Shared core entities and explicit
                                      links across modules.

  Demo data is mistaken for real data Label demo records and provide a
                                      safe clear/reset action.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 25. Open decisions register

The coding agent should not silently invent answers to decisions that
materially affect data safety, product behavior, or architecture. Record
options and a recommendation, then ask the user when necessary.

1.  **Existing codebase and technology stack:** inspect first; do not
    assume.
2.  **Final product name:** Family Hub / Family Management System is a
    working name.
3.  **Cloud provider priority:** Google Drive, OneDrive, or both;
    research current API constraints.
4.  **Authentication model:** shared workspace versus individual
    authenticated users and permissions.
5.  **Local-only mode:** how much functionality and data should remain
    available without cloud storage.
6.  **Decisions navigation:** top-level module or workflow linked to
    Tickets and Principles.
7.  **Final module names and ordering:** current names are provisional
    and customizable.
8.  **Recurrence semantics:** define exact behavior for
    daily/weekly/monthly/custom chores and missed occurrences.
9.  **Task ranking:** determine a transparent, testable balance between
    urgency, effort, momentum, and context.
10. **Privacy levels:** define shared, adult-only, private, and
    child-visible records.
11. **Notifications/reminders:** browser-only, provider integration, or
    later.
12. **Analytics:** default to minimal collection; decide whether any
    optional telemetry is needed.
13. **Nutrition data source:** choose trustworthy data and
    age-appropriate references before building advice.
14. **Medical data and offline policy:** decide exactly what is cached
    and who can access it.
15. **Data format and folder structure:** agree on a portable,
    documented structure for user-controlled storage.

For each decision, document: - The question. - Why it matters. -
Available options. - Pros/cons. - A recommended default. - Whether user
approval is required. - The date/status of the decision.

------------------------------------------------------------------------

# 26. First release acceptance criteria

The first meaningful release should not claim to be the full Family Hub.
It should prove that the foundation and Chores workflow are useful.

A first release candidate should satisfy:

-   [ ] Responsive app shell works on mobile and desktop.
-   [ ] Dashboard modules can be reordered, hidden, and restored.
-   [ ] Dashboard preferences persist locally.
-   [ ] Household/profile demo selection works but is not presented as
    secure authentication.
-   [ ] Local storage is isolated behind a storage interface.
-   [ ] Household data can be exported and imported safely.
-   [ ] Users can define chores in Plan.
-   [ ] Users can find tasks in Execute using time, energy, and room
    preferences.
-   [ ] "Any room" works.
-   [ ] Completing one task updates its history without completing other
    tasks.
-   [ ] Recurring chore definitions and occurrences are separate.
-   [ ] Completing a task can offer optional next-task suggestions.
-   [ ] Stopping after one task is a normal path.
-   [ ] Missed tasks do not automatically overload tomorrow.
-   [ ] The app has useful empty, loading, and error states.
-   [ ] Tests cover the critical workflow.
-   [ ] Setup, test, build, and known limitations are documented.

Cloud synchronization, medical records, nutrition recommendations, and
financial projections should not be represented as production-ready
until their respective phases are implemented and validated.

------------------------------------------------------------------------

# 27. Recommended working method for Claude

Use a disciplined loop:

1.  Read this full specification.
2.  Inspect the current codebase and report what exists.
3.  Identify the current phase and step.
4.  State the specific outcome for the next step.
5.  List the files likely to change.
6.  Implement only that step, unless a small dependency is necessary.
7.  Run relevant tests and the build.
8.  Report actual results, including failures.
9.  Explain how a human can manually verify the behavior.
10. Update the implementation plan and decision log.
11. Stop and wait for review before taking a major architectural leap.

Claude should maintain a concise progress section with: - Current
phase/step. - Completed steps. - Test results. - Known issues. - Next
step. - Decisions awaiting the user.

If a test fails, do not hide it or claim success. Diagnose it, fix it if
in scope, and rerun the test. If a requirement is ambiguous, prefer a
small reversible implementation and explicitly state the assumption. Ask
the user before decisions that could compromise privacy, data integrity,
or cause substantial rework.

------------------------------------------------------------------------

# 28. Copy-and-paste prompt to give Claude

Use the following prompt together with this Markdown document.

------------------------------------------------------------------------

You are the technical lead and implementation partner for the Family Hub
/ Family Management System described in the attached specification.

**Read the entire specification before making changes.** Treat it as the
product vision and roadmap. Do not attempt to build all modules at once.

## Your first task

1.  Inspect the current repository and report its actual structure,
    framework, key files, build commands, tests, and deployment setup.
    If there is no existing project, say so and propose a minimal
    suitable stack before creating it.
2.  Summarize the product vision and identify the first vertical slice.
3.  Propose the smallest safe implementation plan for Phase 0 and Phase
    1.
4.  Identify any architectural decisions that must be resolved before
    they can affect data safety or create expensive rework.
5.  Start with **Phase 0, Step 0.1: inspect the project**. Do not skip
    ahead into building all features.
6.  After the audit, give me a concise report and your proposed next
    action. Where an action is safe, reversible, and clearly within the
    agreed scope, you may proceed step by step; pause for my input
    before major stack, authentication, cloud-storage, privacy, or
    data-format decisions.

## Working rules

-   Build incrementally. One small, testable step at a time.
-   Keep the future roadmap in mind, but do not implement future modules
    prematurely.
-   Do not silently invent product requirements. Mark assumptions and
    ask when a decision materially affects privacy, security, data
    integrity, or architecture.
-   Do not overwrite existing work without explaining the reason.
-   Prefer simple, maintainable code over unnecessary abstraction, but
    establish the storage/domain boundaries needed for future growth.
-   Do not introduce a developer-hosted persistent family database
    without explicit approval. The intended direction is local data
    and/or user-controlled storage such as Google Drive or OneDrive.
-   Never treat a profile icon selector as authentication.
-   Treat medical, financial, and relationship information as sensitive.
-   Keep UI, domain logic, persistence, and provider-specific storage
    code separate.
-   Add tests as features are built. Run tests and builds; report the
    actual output and failures.
-   Never claim a feature, test, or deployment works unless you have
    verified it.
-   Do not use punitive streaks, guilt-based language, automatic overdue
    cascades, or contribution leaderboards.
-   Keep the interface fast and forgiving. For Chores, the first major
    workflow is **Plan → Execute → Complete → Offer optional next task →
    Stop or continue**.
-   Maintain the project README, implementation plan, test plan,
    architecture notes, and decision log as appropriate, without
    unnecessary duplication.
-   At the end of each step, report: what changed, files changed, tests
    run and results, manual verification steps, known limitations,
    decisions needed, and the next proposed step.

Begin by inspecting the project. Do not start by generating the whole
app in one pass.

------------------------------------------------------------------------
