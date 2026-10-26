# Meal Assistant - how the specification is met

The owner's specification (2026-10-26) asks for a family nutrition decision assistant that answers
one question: *"What's one easy thing I could do to make this meal, or the rest of my day, a little
better for me and my family?"* - without tracking, counting, weighing or judging. This note maps
that specification onto the code.

| Spec | Where | How |
|---|---|---|
| Family recipes | `app.js`, Meals & Recipes | A recipe from the Meals & Recipes can be opened (picker, or "Ideas to improve it" on the recipe); its ingredients are read as the meal. Read-only (`data:meals:read`). |
| 2.2 No full-day tracking | `logic.js` `parseMeal` | A meal is read from a few words; typical servings stand in for weights. Nothing is stored. |
| 3 Three layers | `logic.js` `scoreFood` | A: family weights on the main nutrients, colour and plant variety, always on. B: each chosen person's wishes (`FOCUS`) and pregnancy add weight. C: add, swap, time, try next time. |
| 4 Six nutrient categories | `reference.js`, `guide.js` | Carbohydrates/fibre, fats (omega-3), minerals, phytonutrients (via colour), protein, vitamins. Used inside the engine only; never shown as boxes to tick. |
| 5 Colour and variety | `guide.js` `colour` | Five colour groups on plant foods; a colour the plate lacks earns a small bonus, more for a "colour" or "selective" wish. |
| 6 Family profiles and filter | `model.js` `normalisePerson`, the People page › Food details | Optional birthday, sex, pregnancy/breastfeeding, weight, allergies, diet, avoid, likes, dislikes, wishes. The "Who is eating?" chips choose people; duplicates are merged into one card naming everyone it helps. |
| 8 Four recommendation types | `logic.js` `suggest` | Two adds of different kinds, at most one swap (`SWAPS`), time cards only for a real reason, and one try-next-time. "Not in the house today" turns an idea into try next time. |
| 9 Interactions | `interactions.js` | Six documented effects with evidence strength, scope, limitations and source. Wording says when the effect is a single-meal one. No absorption is calculated. |
| 10 Energy density | `guide.js` `dense`, focus `dense` | Energy-dense, nourishing foods rise only for someone with a small appetite. |
| 11 Recommendation logic | `logic.js` | Safety filter → family goal → person priorities → candidates → trade-offs (cost, effort, likes, dislikes, fit with the meal) → rank → explain. |
| 13 Food database | `data/foods.json` via `tools/build_foods.py` | USDA FoodData Central, per 100 g; unknown is null, never zero. `guide.js` adds what USDA does not say: colour, allergens, meal fit, safety. |
| 14 Reference values | `reference.js` | National Academies DRIs; RDA and AI kept apart; used only to spot an opportunity, never shown. |
| 15 Pregnancy, children, safety | `guide.js` `child`, `preg`; `logic.js` `allowed` | Allergies, diet, choking risks (NHS: no whole nuts under 5, quarter round foods) and pregnancy rules (liver, cured meat, soft cheese, fish limits) remove or annotate a food before any benefit is weighed. Babies under one get no suggestions. Supplements are left to the antenatal clinic; persistent eating difficulties to a clinic or dietitian. |
| 17 What it must not do | throughout | No scores, no deficiency claims, no calorie counting, no long lists, no streaks. |

## Known limits

- The guide recognises 83 everyday foods, South African staples included (pap, samp, morogo,
  maas, boerewors, biltong, pilchards). Anything else is listed as "not recognised" and the ideas
  are based on the rest.
- South African foods use the nearest USDA food (pap = white corn grits, samp = hominy, maas =
  cultured buttermilk) until SAFOODS data can be licensed.
- Teen pregnancy uses the adult pregnancy reference values.
- Not reviewed by a registered dietitian yet. That review should happen before wide release.
