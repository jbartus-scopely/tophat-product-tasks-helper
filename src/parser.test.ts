import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBacklogFromString } from './parser.js';

test('parses the new CSV task fields and ignores placeholder Column N fields', () => {
  const csv = [
    'Date,JIRA,ID,Reporter,Description/Problem,Priority,Status,Initiative,Priority pod,Comments,Column 11,Column 12',
    '2026-06-01,TOP-1,FG-1,Ana,Fix tutorial,P0,TODO,Onboarding,Pod31,Needs copy,ignored,also ignored',
  ].join('\n');

  const result = parseBacklogFromString(csv);

  assert.equal(result.tasks.length, 1);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    {
      date: result.tasks[0].date,
      jira: result.tasks[0].jira,
      id: result.tasks[0].id,
      reporter: result.tasks[0].reporter,
      description: result.tasks[0].description,
      priority: result.tasks[0].priority,
      status: result.tasks[0].status,
      initiative: result.tasks[0].initiative,
      priorityPod: result.tasks[0].priorityPod,
      comments: result.tasks[0].comments,
    },
    {
      date: '2026-06-01',
      jira: 'TOP-1',
      id: 'FG-1',
      reporter: 'Ana',
      description: 'Fix tutorial',
      priority: 'P0',
      status: 'TODO',
      initiative: 'Onboarding',
      priorityPod: 'Pod31',
      comments: 'Needs copy',
    },
  );
  assert.equal(Object.hasOwn(result.tasks[0], 'Column 11'), false);
  assert.equal(Object.hasOwn(result.tasks[0], 'Column 12'), false);
});

test('keeps rows with missing required fields without warning for missing priority or initiative', () => {
  const csv = [
    'Date,JIRA,ID,Reporter,Description/Problem,Priority,Status,Initiative,Priority pod,Comments',
    '2026-06-01,TOP-1,,Ana,, ,,,Pod31,Needs copy',
  ].join('\n');

  const result = parseBacklogFromString(csv);

  assert.equal(result.tasks.length, 1);
  assert.deepEqual(result.warnings, [
    'Missing ID on row 2',
    'Missing Description/Problem on row 2',
    'Missing Status on row 2',
  ]);
});

test('keeps invalid priority and status rows and reports validation warnings', () => {
  const csv = [
    'Date,JIRA,ID,Reporter,Description/Problem,Priority,Status,Initiative,Priority pod,Comments',
    '2026-06-01,TOP-1,FG-1,Ana,Fix tutorial,P3,Live,Onboarding,Pod31,Needs copy',
  ].join('\n');

  const result = parseBacklogFromString(csv);

  assert.equal(result.tasks.length, 1);
  assert.deepEqual(result.warnings, [
    'Invalid Priority "P3" on row 2; expected P0, P1, or P2',
    'Invalid Status "Live" on row 2; expected TRIAGE, TODO, Prioritized, or HOLD',
  ]);
});

test('reports duplicate IDs while keeping duplicate rows independent', () => {
  const csv = [
    'Date,JIRA,ID,Reporter,Description/Problem,Priority,Status,Initiative,Priority pod,Comments',
    '2026-06-01,TOP-1,FG-1,Ana,Fix tutorial,P0,TODO,Onboarding,Pod31,First',
    '2026-06-02,TOP-2,FG-1,Ben,Fix menu,P1,TRIAGE,Menus,Pod32,Second',
  ].join('\n');

  const result = parseBacklogFromString(csv);

  assert.equal(result.tasks.length, 2);
  assert.equal(result.duplicateIds.get('FG-1'), 2);
  assert.deepEqual(result.tasks.map((task) => task.comments), ['First', 'Second']);
  assert.match(result.warnings.join('\n'), /Duplicate ID: FG-1 appears 2 times/);
});

test('filters #NUM rows and completely empty rows', () => {
  const csv = [
    'Date,JIRA,ID,Reporter,Description/Problem,Priority,Status,Initiative,Priority pod,Comments',
    '2026-06-01,TOP-1,#NUM!,Ana,Fix tutorial,P0,TODO,Onboarding,Pod31,Ignored',
    ',,,,,,,,,',
    '2026-06-02,TOP-2,FG-2,Ben,Fix menu,P1,Prioritized,Menus,Pod32,Kept',
  ].join('\n');

  const result = parseBacklogFromString(csv);

  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].id, 'FG-2');
  assert.equal(result.filtered, 2);
});
