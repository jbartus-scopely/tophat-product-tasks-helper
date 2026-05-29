import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

test('web sidebar exposes a separated Jira route', () => {
  const html = readProjectFile('src/web/index.html');

  assert.match(html, /<div class="nav-label">Jira<\/div>/);
  assert.match(html, /href="#jira"/);
  assert.match(html, /data-view="jira"/);
  assert.match(html, /Jira Watch/);
});

test('client router renders Jira before the backlog-loaded guard', () => {
  const app = readProjectFile('src/web/app.js');
  const jiraBranch = app.indexOf("view === 'jira'");
  const backlogGuard = app.indexOf('!state.backlogLoaded');

  assert.notEqual(jiraBranch, -1);
  assert.notEqual(backlogGuard, -1);
  assert.ok(jiraBranch < backlogGuard);
  assert.match(app, /renderJiraView/);
  assert.match(app, /\/api\/jira\/sections\/search/);
});

test('Jira shell has tabs, refresh, loading, and error states', () => {
  const components = readProjectFile('src/web/components.js');

  assert.match(components, /Dashboard/);
  assert.match(components, /All Data/);
  assert.match(components, /id="jira-refresh"/);
  assert.match(components, /spinner-container/);
  assert.match(components, /errorHtml/);
});

test('Jira dashboard renders saved sections and predefined dashboard views', () => {
  const components = readProjectFile('src/web/components.js');

  assert.match(components, /jiraSavedSectionsHtml/);
  assert.match(components, /Coming by version/);
  assert.match(components, /Not started by priority/);
  assert.match(components, /status === 'open' \|\| status === 'to do'/);
  assert.match(components, /No fix version/);
});

test('Jira All Data view provides saved-section selection, filters, and sortable columns', () => {
  const components = readProjectFile('src/web/components.js');

  assert.match(components, /id="jira-section-select"/);
  assert.match(components, /jira-filter-status/);
  assert.match(components, /jira-filter-priority/);
  assert.match(components, /jira-filter-fix-version/);
  assert.match(components, /jira-filter-pod/);
  assert.match(components, /jira-filter-search/);
  assert.match(components, /data-jira-sort/);
  assert.match(components, /target="_blank"/);
});

test('Jira ad hoc JQL uses server API and Jira-specific localStorage history', () => {
  const app = readProjectFile('src/web/app.js');
  const shared = readProjectFile('src/web/shared.js');
  const components = readProjectFile('src/web/components.js');

  assert.match(app, /apiPost\('\/api\/jira\/search'/);
  assert.match(app, /addJiraQueryToHistory/);
  assert.match(app, /adHocIssues: \[\]/);
  assert.match(shared, /pth_jira_jql_history/);
  assert.match(components, /id="jira-adhoc-form"/);
  assert.match(components, /getJiraQueryHistory/);
});
