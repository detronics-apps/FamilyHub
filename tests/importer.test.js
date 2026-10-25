import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, toObjects, toCSV } from '../js/csv.js';
import { templateCSV, planImport, detectImporter, describeImport } from '../js/importer.js';
import { IMPORTER as RECIPES } from '../js/apps/meals/logic.js';
import { IMPORTER as TASKS } from '../js/apps/tasks/logic.js';
import { IMPORTER as CHORES, parseFrequency } from '../js/apps/chores/importer.js';

const ALL = [RECIPES, TASKS, CHORES];

test('CSV: quotes, doubled quotes, line breaks in cells, CRLF, BOM, semicolons', () => {
  assert.deepEqual(parseCSV('a,b\r\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
  assert.deepEqual(parseCSV('﻿title,ingredients\nSoup,"2 carrots\n1 onion"'), [['title', 'ingredients'], ['Soup', '2 carrots\n1 onion']]);
  assert.deepEqual(parseCSV('a;b\n1,5;2'), [['a', 'b'], ['1,5', '2']], 'semicolon files keep decimal commas');
  assert.deepEqual(parseCSV('a,b\n\n,\n1,2'), [['a', 'b'], ['1', '2']], 'blank rows skipped');
  const back = parseCSV(toCSV([['x', 'a,b', 'q"q', 'two\nlines']]));
  assert.deepEqual(back, [['x', 'a,b', 'q"q', 'two\nlines']], 'round trip');
  assert.deepEqual(toObjects(parseCSV('Title*,Prep Minutes\nSoup,10')).records[0], { line: 2, values: { title: 'Soup', prep_minutes: '10' } });
});

test('every template imports its own example rows cleanly', () => {
  for (const imp of ALL) {
    const plan = planImport(imp, templateCSV(imp), new Set());
    assert.deepEqual(plan.errors, [], imp.kind);
    assert.equal(plan.add.length, imp.example.length, imp.kind);
    assert.ok(templateCSV(imp).split('\r\n')[0].includes(`${imp.columns.find((c) => c.required).name}*`), 'required columns are marked');
  }
});

test('recipes: ingredients and steps from one cell; nothing duplicated; problems reported by line', () => {
  const csv = [
    'title,servings,ingredients,method,contains,calories',
    'Soup,2,"2 carrots; 500 ml stock",Chop; Simmer,,',
    'Pancakes,4,200 g flour; 2 eggs,Whisk; Fry,"gluten, egg",210',
    'soup,4,,,,',                      // already there (case does not matter)
    ',4,,,,',                          // no title
    'Satay,4,peanut butter,,peanutz,', // unknown allergen
  ].join('\n');
  const plan = planImport(RECIPES, csv, new Set(['pancakes']));
  assert.deepEqual(plan.add.map((x) => x.record.title), ['Soup']);
  assert.deepEqual(plan.add[0].record.ingredients[1], { name: 'stock', qty: 500, unit: 'ml', note: '' });
  assert.deepEqual(plan.add[0].record.instructions, ['Chop', 'Simmer']);
  assert.deepEqual(plan.matched.map((x) => x.line), [3, 4]);
  assert.deepEqual(plan.errors.map((e) => e.line), [5, 6]);
  assert.match(describeImport(RECIPES, plan, 'recipes.csv'), /^recipes\.csv: 1 new recipe, 2 already there, 2 lines with a problem/);
});

test('a file without the required column is refused as a whole, with the reason', () => {
  const plan = planImport(RECIPES, 'name,servings\nSoup,2', new Set());
  assert.equal(plan.add.length, 0);
  assert.match(plan.errors[0].message, /missing: title/);
});

test('tasks: dates checked, steps become a checklist, projects marked', () => {
  const plan = planImport(TASKS, 'title,planned_for,steps,project\nGate,2026-11-02,Buy hinge; Fit,\nGarage,,,yes\nBad date,next week,,', new Set());
  assert.equal(plan.add[0].record.due, '2026-11-02');
  assert.equal(plan.add[0].record.checklist.length, 2);
  assert.equal(plan.add[1].record.kind, 'project');
  assert.match(plan.errors[0].message, /YYYY-MM-DD/);
});

test('chores: frequencies in plain words', () => {
  assert.deepEqual(parseFrequency('Fortnightly'), { unit: 'week', every: 2 });
  assert.deepEqual(parseFrequency('every 3 days'), { unit: 'day', every: 3 });
  assert.deepEqual(parseFrequency(''), { unit: 'week', every: 1 });
  assert.equal(parseFrequency('now and then'), null);
  const plan = planImport(CHORES, 'name,room,how_often,effort,important\nMop,Kitchen,weekly,medium,\nAlarm,,monthly,low,yes\nDust,,sometimes,,\nSweep,,weekly,huge,', new Set());
  assert.equal(plan.add[1].record.importance, 'high');
  assert.equal(plan.errors.length, 2);
});

test('which template a file is: by its name, else by its columns', () => {
  assert.equal(detectImporter('My Recipes 2026.csv', [], ALL).kind, 'recipes');
  assert.equal(detectImporter('export.csv', ['name', 'room', 'how_often'], ALL).kind, 'chores');
  assert.equal(detectImporter('export.csv', ['title', 'planned_for', 'steps'], ALL).kind, 'tasks');
  assert.equal(detectImporter('export.csv', ['colour', 'size'], ALL), null);
});
