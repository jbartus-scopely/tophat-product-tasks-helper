export const MAX_SCORE = 130;

export async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  return res.json();
}

export async function apiPost(path, body, signal) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

const CSV_DATA_KEY = 'pth_csv_latest_upload';
const CSV_DASHBOARD_FILTERS_KEY = 'pth_csv_dashboard_filters';
const CSV_ALL_DATA_FILTERS_KEY = 'pth_csv_all_data_filters';
const CSV_LISTS_KEY = 'pth_csv_task_lists';
const JIRA_DASHBOARD_VERSIONS_KEY = 'pth_jira_dashboard_versions';
const JIRA_ALL_DATA_FILTERS_KEY = 'pth_jira_all_data_filters';
const CSV_ALL_DATA_GROUP_BY_VALUES = ['none', 'status', 'priority', 'initiative', 'priorityPod', 'reporter'];
const JIRA_ALL_DATA_GROUP_BY_VALUES = ['none', 'status', 'priority', 'fixVersion', 'pod', 'labels'];

function loadStorageObject(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function loadStorageStringArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return normalizeStringArray(value);
  } catch {
    return [];
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
}

function normalizeCsvListEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const id = String(entry.id || '').trim();
  const name = String(entry.name || '').trim();
  const taskIds = normalizeStringArray(entry.taskIds);
  if (!id || !name) return null;
  return { id, name, taskIds };
}

function normalizeCsvLists(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCsvListEntry).filter(Boolean);
}

function normalizeCsvTask(task) {
  if (!task || typeof task !== 'object') return null;
  return {
    id: String(task.id || ''),
    jira: String(task.jira || ''),
    description: String(task.description || ''),
    priority: String(task.priority || ''),
    status: String(task.status || ''),
    initiative: String(task.initiative || task.group || ''),
    priorityPod: String(task.priorityPod || task.assignedPod || ''),
    reporter: String(task.reporter || ''),
    date: String(task.date || ''),
    comments: String(task.comments || ''),
  };
}

function normalizeCsvDataset(value) {
  if (!value || typeof value !== 'object') return null;
  const tasks = Array.isArray(value.tasks) ? value.tasks.map(normalizeCsvTask).filter(Boolean) : [];
  return {
    tasks,
    warnings: normalizeStringArray(value.warnings),
    duplicateIds: value.duplicateIds && typeof value.duplicateIds === 'object' && !Array.isArray(value.duplicateIds) ? value.duplicateIds : {},
    totalRaw: Number.isFinite(Number(value.totalRaw)) ? Number(value.totalRaw) : tasks.length,
    filtered: Number.isFinite(Number(value.filtered)) ? Number(value.filtered) : 0,
  };
}

function saveStorageStringArray(key, values) {
  localStorage.setItem(key, JSON.stringify(normalizeStringArray(values)));
}

function normalizeJiraAllDataFilters(value) {
  return {
    status: normalizeStringArray(value?.status),
    priority: normalizeStringArray(value?.priority),
    fixVersion: normalizeStringArray(value?.fixVersion),
    pod: normalizeStringArray(value?.pod),
    label: normalizeStringArray(value?.label),
    groupBy: normalizeJiraAllDataGroupBy(value?.groupBy),
  };
}

function normalizeCsvDashboardFilters(value) {
  return {
    status: normalizeStringArray(value?.status),
    initiative: normalizeStringArray(value?.initiative),
  };
}

function normalizeCsvAllDataFilters(value) {
  return {
    status: normalizeStringArray(value?.status),
    priority: normalizeStringArray(value?.priority),
    initiative: normalizeStringArray(value?.initiative),
    priorityPod: normalizeStringArray(value?.priorityPod),
    reporter: normalizeStringArray(value?.reporter),
    groupBy: normalizeCsvAllDataGroupBy(value?.groupBy),
  };
}

function normalizeCsvAllDataGroupBy(value) {
  return CSV_ALL_DATA_GROUP_BY_VALUES.includes(value) ? value : 'none';
}

function normalizeJiraAllDataGroupBy(value) {
  return JIRA_ALL_DATA_GROUP_BY_VALUES.includes(value) ? value : 'none';
}

export function getJiraDashboardVersions() {
  return loadStorageStringArray(JIRA_DASHBOARD_VERSIONS_KEY);
}

export function saveJiraDashboardVersions(values) {
  saveStorageStringArray(JIRA_DASHBOARD_VERSIONS_KEY, values);
}

export function getJiraAllDataFilters() {
  return normalizeJiraAllDataFilters(loadStorageObject(JIRA_ALL_DATA_FILTERS_KEY, {}));
}

export function saveJiraAllDataFilters(filters) {
  localStorage.setItem(JIRA_ALL_DATA_FILTERS_KEY, JSON.stringify(normalizeJiraAllDataFilters(filters)));
}

export function getStoredCsvData() {
  try {
    return normalizeCsvDataset(JSON.parse(localStorage.getItem(CSV_DATA_KEY)));
  } catch {
    return null;
  }
}

export function saveStoredCsvData(value) {
  const normalized = normalizeCsvDataset(value);
  if (!normalized) return null;
  localStorage.setItem(CSV_DATA_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getCsvDashboardFilters() {
  return normalizeCsvDashboardFilters(loadStorageObject(CSV_DASHBOARD_FILTERS_KEY, {}));
}

export function saveCsvDashboardFilters(filters) {
  localStorage.setItem(CSV_DASHBOARD_FILTERS_KEY, JSON.stringify(normalizeCsvDashboardFilters(filters)));
}

export function getCsvAllDataFilters() {
  return normalizeCsvAllDataFilters(loadStorageObject(CSV_ALL_DATA_FILTERS_KEY, {}));
}

export function saveCsvAllDataFilters(filters) {
  localStorage.setItem(CSV_ALL_DATA_FILTERS_KEY, JSON.stringify(normalizeCsvAllDataFilters(filters)));
}

export function getCsvLists() {
  try {
    return normalizeCsvLists(JSON.parse(localStorage.getItem(CSV_LISTS_KEY)));
  } catch {
    return [];
  }
}

export function saveCsvLists(lists) {
  const normalized = normalizeCsvLists(lists);
  localStorage.setItem(CSV_LISTS_KEY, JSON.stringify(normalized));
  return normalized;
}
