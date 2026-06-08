import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

test('CSV upload state uses dedicated localStorage helpers', () => {
  const shared = readProjectFile('src/web/shared.js');

  assert.match(shared, /pth_csv_latest_upload/);
  assert.match(shared, /function normalizeCsvDataset/);
  assert.match(shared, /export function getStoredCsvData/);
  assert.match(shared, /export function saveStoredCsvData/);
  assert.match(shared, /localStorage\.setItem\(CSV_DATA_KEY/);
});

test('sidebar exposes CSV and Jira main sections without legacy backlog tools', () => {
  const html = readProjectFile('src/web/index.html');

  assert.match(html, /href="#csv-dashboard"/);
  assert.match(html, /data-view="csv-dashboard"/);
  assert.match(html, /CSV Dashboard/);
  assert.match(html, /href="#csv-all-data"/);
  assert.match(html, /data-view="csv-all-data"/);
  assert.match(html, /CSV All Data/);
  assert.match(html, /Jira Dashboard/);
  assert.match(html, /Jira All Data/);
  assert.doesNotMatch(html, />Triage</);
  assert.doesNotMatch(html, />Backlog</);
  assert.doesNotMatch(html, />In Progress</);
  assert.doesNotMatch(html, />Done</);
  assert.doesNotMatch(html, />Blocked</);
  assert.doesNotMatch(html, />Analyze</);
  assert.doesNotMatch(html, />Groom Triage</);
  assert.doesNotMatch(html, />Prioritize</);
  assert.doesNotMatch(html, />Duplicates</);
  assert.doesNotMatch(html, />Selection/);
});

test('client defaults to Jira Dashboard and routes CSV views explicitly', () => {
  const app = readProjectFile('src/web/app.js');

  assert.match(app, /location\.hash \|\| '#jira-dashboard'/);
  assert.match(app, /'csv-dashboard': 'CSV Dashboard'/);
  assert.match(app, /'csv-all-data': 'CSV All Data'/);
  assert.match(app, /const CSV_VIEWS = \['csv-dashboard', 'csv-all-data'\]/);
  assert.match(app, /function isCsvView/);
  assert.match(app, /renderCsvView\(view\)/);
  assert.match(app, /location\.hash = '#csv-dashboard'/);
});

test('client restores CSV data from browser storage instead of server backlog state', () => {
  const app = readProjectFile('src/web/app.js');

  assert.match(app, /const storedCsv = getStoredCsvData\(\)/);
  assert.match(app, /applyCsvData\(storedCsv\)/);
  assert.doesNotMatch(app, /api\('\/api\/backlog'/);
  assert.doesNotMatch(app, /api\('\/api\/stats'/);
  assert.doesNotMatch(app, /api\('\/api\/groups'/);
  assert.doesNotMatch(app, /api\('\/api\/pods'/);
  assert.doesNotMatch(app, /api\('\/api\/scores'/);
});

test('failed CSV upload shows an error without clearing restored CSV state', () => {
  const app = readProjectFile('src/web/app.js');

  assert.match(app, /function showUploadError/);
  assert.match(app, /state\.csv = \{\s*\.\.\.state\.csv,\s*uploadError: message,\s*\}/);
  assert.match(app, /showUploadError\(result\.error\)/);
  assert.match(app, /showUploadError\(e\.message\)/);
  assert.doesNotMatch(app, /state\.csv\.data = null/);
  assert.doesNotMatch(app, /localStorage\.removeItem\('pth_csv_latest_upload'\)/);
});

test('CSV Dashboard provides persisted filters, search state, and summary widgets', () => {
  const shared = readProjectFile('src/web/shared.js');
  const app = readProjectFile('src/web/app.js');
  const components = readProjectFile('src/web/components.js');

  assert.match(shared, /pth_csv_dashboard_filters/);
  assert.match(shared, /export function getCsvDashboardFilters/);
  assert.match(shared, /export function saveCsvDashboardFilters/);
  assert.match(app, /filters: getCsvDashboardFilters\(\)/);
  assert.match(app, /saveCsvDashboardFilters\(filters\)/);
  assert.match(app, /activeView: 'active'/);
  assert.match(app, /function setCsvDashboardTab/);
  assert.match(app, /onDashboardTabChange: setCsvDashboardTab/);
  assert.match(app, /function setCsvDashboardSearch/);
  assert.match(app, /CSV_FOCUSABLE_INPUT_IDS/);
  assert.match(app, /preserveFocus: true/);
  assert.match(app, /preserveDropdownScroll: true/);
  assert.match(components, /export function renderCsvDashboardView/);
  assert.match(components, /Loaded Tasks/);
  assert.match(components, /Warnings/);
  assert.match(components, /const CSV_DASHBOARD_TABS = \[\s*\{ id: 'active', label: 'Prioritized\/TODO' \},\s*\{ id: 'hold', label: 'HOLD' \},\s*\]/);
  assert.match(components, /data-csv-dashboard-tab/);
  assert.match(components, /csvBreakdown\(visibleTasks, 'status'\)/);
  assert.match(components, /csvBreakdown\(visibleTasks, 'initiative'\)/);
  assert.match(components, /csv-dashboard-status-filter/);
  assert.match(components, /csv-dashboard-initiative-filter/);
  assert.match(components, /id="csv-dashboard-search"/);
  assert.match(components, /data-csv-multi-input/);
});

test('CSV Dashboard groups by status with session-only expansion controls', () => {
  const shared = readProjectFile('src/web/shared.js');
  const app = readProjectFile('src/web/app.js');
  const components = readProjectFile('src/web/components.js');

  assert.match(app, /expandedStatuses: \{\}/);
  assert.match(app, /function toggleCsvStatusGroup/);
  assert.match(app, /function setCsvStatusGroups/);
  assert.match(app, /onStatusGroupToggle: toggleCsvStatusGroup/);
  assert.match(app, /onStatusGroupsSet: setCsvStatusGroups/);
  assert.match(components, /function csvGroupedByStatus/);
  assert.match(components, /const CSV_STATUS_ORDER = \['Prioritized', 'TODO', 'HOLD', 'TRIAGE'\]/);
  assert.match(components, /activeView === 'hold' && task\.status !== 'HOLD'/);
  assert.match(components, /activeView !== 'hold' && task\.status === 'HOLD'/);
  assert.match(components, /function csvDashboardSortedRows/);
  assert.match(components, /csvDashboardRowsHtml\(rows\)/);
  assert.match(components, /class="csv-status-group-title"/);
  assert.doesNotMatch(components, /statusBadge\(status === CSV_NO_STATUS_LABEL/);
  assert.match(components, /data-csv-status-toggle/);
  assert.match(components, /data-csv-status-bulk="open"/);
  assert.match(components, /data-csv-status-bulk="collapse"/);
  assert.match(components, /dashboard\.expandedStatuses\?\.\[status\] !== false/);
  assert.match(components, /function csvTaskSearchText\(task\) \{\s*return `\$\{task\.id \|\| ''\} \$\{task\.jira \|\| ''\} \$\{task\.description \|\| ''\}`\.toLowerCase\(\);/);
  assert.doesNotMatch(shared, /expandedStatuses/);
  assert.doesNotMatch(shared, /csv_dashboard_expanded/);
});

test('CSV All Data renders required columns and sortable priority order', () => {
  const app = readProjectFile('src/web/app.js');
  const components = readProjectFile('src/web/components.js');
  const style = readProjectFile('src/web/style.css');

  assert.match(app, /renderCsvAllDataView/);
  assert.match(app, /function setCsvAllDataSort/);
  assert.match(app, /sort: \{\s*field: 'id',\s*dir: 'asc',\s*\}/);
  assert.match(components, /export function renderCsvAllDataView/);
  assert.match(components, /renderCsvAllDataView[\s\S]*openCsvMultiMenus\(\$el, state\.csv\?\.openMultiDropdown \|\| null\)/);
  assert.match(components, /const CSV_ALL_DATA_COLUMNS = \[\s*\{ label: 'ID', field: 'id' \},\s*\{ label: 'JIRA', field: 'jira' \},\s*\{ label: 'Description\/Problem', field: 'description' \},\s*\{ label: 'Comments', field: 'comments' \},\s*\{ label: 'Priority', field: 'priority' \},\s*\{ label: 'Status', field: 'status' \},\s*\{ label: 'Initiative', field: 'initiative' \},\s*\{ label: 'Priority pod', field: 'priorityPod' \},\s*\]/);
  assert.doesNotMatch(components, /\{ label: 'Date', field: 'date' \}/);
  assert.match(components, /function csvAllDataColGroupHtml/);
  assert.match(components, /<colgroup>\$\{CSV_ALL_DATA_COLUMNS\.map/);
  assert.match(components, /\$\{csvAllDataColGroupHtml\(\)\}<thead><tr>/);
  assert.match(components, /function csvJiraKeyCell/);
  assert.match(components, /https:\/\/scopely\.atlassian\.net\/browse\/\$\{encodeURIComponent\(key\)\}/);
  assert.match(components, /<td class="col-id">\$\{csvJiraKeyCell\(task\.jira\)\}<\/td>/);
  assert.doesNotMatch(components, /\{ label: 'Reporter', field: 'reporter' \}/);
  assert.match(components, /linkify\(esc\(task\.description \|\| '--'\)\)/);
  assert.match(components, /function csvCommentCell/);
  assert.match(components, /data-lucide="message-square-text"/);
  assert.match(components, /title="\$\{esc\(comment\)\}"/);
  assert.match(components, /data-comment="\$\{esc\(comment\)\}"/);
  assert.match(components, /<td class="col-desc">\$\{linkify\(esc\(task\.description \|\| '--'\)\)\}<\/td>\s*<td class="col-comments">\$\{csvCommentCell\(task\.comments\)\}<\/td>/);
  assert.doesNotMatch(components, /linkify\(esc\(task\.comments/);
  assert.match(components, /function csvInitiativeHtml/);
  assert.match(components, /data-csv-sort/);
  assert.match(components, /function csvPriorityRank/);
  assert.match(components, /P0: 0/);
  assert.match(components, /P1: 1/);
  assert.match(components, /P2: 2/);
  assert.match(components, /return \[\.{3}tasks\]\.sort/);
  assert.match(components, /tasks\.map\(task => `<tr>/);
  assert.match(style, /\.csv-shell \.badge-priority/);
  assert.match(style, /\.csv-shell \.status-prioritized/);
  assert.match(style, /\.csv-shell \.status-todo/);
  assert.match(style, /\.csv-shell \.status-hold/);
  assert.match(style, /\.data-table \.col-desc a/);
  assert.match(style, /color: var\(--cyan\)/);
  assert.match(style, /border-bottom: 1px solid rgba\(57, 210, 192, 0\.45\)/);
  assert.match(style, /\.data-table \.col-comments/);
  assert.match(style, /\.csv-comment-icon/);
  assert.match(style, /\.csv-comment-icon::after/);
  assert.match(style, /content: attr\(data-comment\)/);
  assert.match(style, /\.csv-all-data-table\s*\{\s*table-layout: fixed;/);
  assert.match(style, /\.csv-all-data-table col\.csv-col-description \{ width: 50%; \}/);
  assert.match(style, /\.csv-all-data-table col\.csv-col-comments \{ width: 4%; \}/);
  assert.doesNotMatch(style, /csv-col-date/);
});

test('CSV All Data provides persisted filters, group-by, and scoped search', () => {
  const shared = readProjectFile('src/web/shared.js');
  const app = readProjectFile('src/web/app.js');
  const components = readProjectFile('src/web/components.js');

  assert.match(shared, /pth_csv_all_data_filters/);
  assert.match(shared, /CSV_ALL_DATA_GROUP_BY_VALUES = \['none', 'status', 'priority', 'initiative', 'priorityPod', 'reporter'\]/);
  assert.match(shared, /export function getCsvAllDataFilters/);
  assert.match(shared, /export function saveCsvAllDataFilters/);
  assert.match(app, /\.\.\.getCsvAllDataFilters\(\)/);
  assert.match(app, /function setCsvAllDataFilter/);
  assert.match(app, /saveCsvAllDataFilters\(filters\)/);
  assert.match(app, /CSV_FOCUSABLE_INPUT_IDS = new Set\(\['csv-dashboard-search', 'csv-filter-search'\]\)/);
  assert.match(components, /csv-filter-status/);
  assert.match(components, /csv-filter-priority/);
  assert.match(components, /csv-filter-initiative/);
  assert.match(components, /csv-filter-priority-pod/);
  assert.match(components, /csv-filter-reporter/);
  assert.match(components, /id="csv-group-by"/);
  assert.match(components, /CSV_ALL_DATA_GROUP_BY_OPTIONS/);
  assert.match(components, /\{ value: 'none', label: 'None' \}/);
  assert.match(components, /\{ value: 'status', label: 'Status' \}/);
  assert.match(components, /\{ value: 'priority', label: 'Priority' \}/);
  assert.match(components, /\{ value: 'initiative', label: 'Initiative' \}/);
  assert.match(components, /\{ value: 'priorityPod', label: 'Priority pod' \}/);
  assert.match(components, /\{ value: 'reporter', label: 'Reporter' \}/);
  assert.match(components, /function groupCsvAllDataTasks/);
  assert.match(components, /function csvTaskMatchesAllDataFilters/);
  assert.match(components, /csvTaskSearchText\(task\)/);
  assert.doesNotMatch(components, /comments \|\| ''\}\.toLowerCase\(\)/);
});

test('web and server active surfaces omit AI selection and legacy backlog routes', () => {
  const app = readProjectFile('src/web/app.js');
  const shared = readProjectFile('src/web/shared.js');
  const components = readProjectFile('src/web/components.js');
  const server = readProjectFile('src/server.ts');

  assert.doesNotMatch(app, /\/api\/ai/);
  assert.doesNotMatch(app, /AI_VIEWS/);
  assert.doesNotMatch(app, /renderAiView/);
  assert.doesNotMatch(app, /renderSelectionView/);
  assert.doesNotMatch(app, /view === 'selection'/);
  assert.doesNotMatch(app, /renderTaskList/);
  assert.doesNotMatch(app, /case 'triage'/);
  assert.doesNotMatch(app, /case 'backlog'/);
  assert.doesNotMatch(app, /case 'inprogress'/);
  assert.doesNotMatch(app, /case 'done'/);
  assert.doesNotMatch(app, /case 'blocked'/);
  assert.doesNotMatch(shared, /\/api\/ai/);
  assert.doesNotMatch(shared, /pth_selection/);
  assert.doesNotMatch(shared, /startAiJob/);
  assert.doesNotMatch(components, /AI_VIEW_CONFIG/);
  assert.doesNotMatch(components, /export function renderAiView/);
  assert.doesNotMatch(components, /export function renderSelectionView/);
  assert.doesNotMatch(components, /\/api\/ai/);
  assert.doesNotMatch(server, /\/api\/ai/);
});

test('package metadata exposes web workflow without pth CLI entry points', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));
  const packageLock = JSON.parse(readProjectFile('package-lock.json'));
  const app = readProjectFile('src/web/app.js');
  const server = readProjectFile('src/server.ts');

  assert.equal(packageJson.bin, undefined);
  assert.equal(packageJson.scripts.pth, undefined);
  assert.equal(packageJson.scripts.web, 'tsx src/server.ts');
  assert.equal(packageJson.scripts.build, 'tsc');
  assert.match(packageJson.scripts.test, /npm run build/);
  assert.match(packageJson.scripts.test, /node --test/);
  assert.equal(packageLock.packages[''].bin, undefined);
  assert.doesNotMatch(app, /src\/cli|bin\/pth/);
  assert.doesNotMatch(server, /src\/cli|bin\/pth/);
});
