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

// ── Query History (localStorage) ─────────────────────────────
const HISTORY_KEY = 'pth_query_history';
const JIRA_DASHBOARD_VERSIONS_KEY = 'pth_jira_dashboard_versions';
const JIRA_ALL_DATA_FILTERS_KEY = 'pth_jira_all_data_filters';
const MAX_HISTORY = 30;
const JIRA_ALL_DATA_GROUP_BY_VALUES = ['none', 'status', 'priority', 'fixVersion', 'pod', 'labels'];

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveStorageHistory(key, entries) {
  localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

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

function normalizeJiraAllDataGroupBy(value) {
  return JIRA_ALL_DATA_GROUP_BY_VALUES.includes(value) ? value : 'none';
}

function saveHistory(entries) {
  saveStorageHistory(HISTORY_KEY, entries);
}

export function getQueryHistory() { return loadHistory(); }

export function addQueryToHistory(query) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const entries = loadHistory();
  const existing = entries.findIndex(e => e.query === trimmed);
  if (existing !== -1) entries[existing].usedAt = Date.now();
  else entries.unshift({ query: trimmed, starred: false, usedAt: Date.now() });
  entries.sort((a, b) => { if (a.starred !== b.starred) return a.starred ? -1 : 1; return b.usedAt - a.usedAt; });
  saveHistory(entries);
}

export function toggleStarQuery(query) {
  const entries = loadHistory();
  const entry = entries.find(e => e.query === query);
  if (entry) {
    entry.starred = !entry.starred;
    entries.sort((a, b) => { if (a.starred !== b.starred) return a.starred ? -1 : 1; return b.usedAt - a.usedAt; });
    saveHistory(entries);
  }
}

export function removeQueryFromHistory(query) { saveHistory(loadHistory().filter(e => e.query !== query)); }
export function clearQueryHistory() { localStorage.removeItem(HISTORY_KEY); }

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

// ── AI Models ────────────────────────────────────────────────
let aiModels = [];
let selectedModel = '';
let modelSupported = true;

export async function loadModels() {
  try {
    aiModels = await api('/api/ai/models');
  } catch {
    aiModels = [];
  }
}

export function getModels() { return aiModels; }
export function getSelectedModel() { return selectedModel; }
export function setSelectedModel(id) { selectedModel = id; }
export function isModelSupported() { return modelSupported; }
export function setModelSupported(v) { modelSupported = v; }

// ── AI Job State ─────────────────────────────────────────────
const aiJobs = {
  analyze:    { status: 'idle', result: null, error: null, params: null, startedAt: null },
  groom:      { status: 'idle', result: null, error: null, params: null, startedAt: null },
  prioritize: { status: 'idle', result: null, error: null, params: null, startedAt: null },
  duplicates: { status: 'idle', result: null, error: null, params: null, startedAt: null },
};

let currentAbort = null;
const listeners = new Set();

export function getAiJob(view) { return aiJobs[view]; }

export function onAiJobChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.error('AI job listener error:', e); }
  }
}

export function isAnyAiRunning() {
  return Object.values(aiJobs).some(j => j.status === 'running');
}

export function getRunningAiView() {
  for (const [view, job] of Object.entries(aiJobs)) {
    if (job.status === 'running') return view;
  }
  return null;
}

export async function startAiJob(view, endpoint, body) {
  const running = getRunningAiView();
  if (running && running !== view) {
    const names = { analyze: 'Analyze', groom: 'Groom Triage', prioritize: 'Prioritize', duplicates: 'Duplicates' };
    alert(`AI is already running: ${names[running] || running}. Cancel it first or wait.`);
    return false;
  }

  const abort = new AbortController();
  currentAbort = abort;

  aiJobs[view] = { status: 'running', result: null, error: null, params: body, startedAt: Date.now() };
  notify();

  try {
    const result = await apiPost(endpoint, body, abort.signal);
    if (abort.signal.aborted) return false;
    if (result.error) {
      aiJobs[view] = { status: 'error', result: null, error: result.error, params: body, startedAt: null };
    } else {
      aiJobs[view] = { status: 'done', result, error: null, params: body, startedAt: null };
    }
  } catch (e) {
    if (abort.signal.aborted) return false;
    aiJobs[view] = { status: 'error', result: null, error: e.message, params: body, startedAt: null };
  }

  currentAbort = null;
  notify();
  return true;
}

export function cancelAiJob(view) {
  if (currentAbort) currentAbort.abort();
  currentAbort = null;
  aiJobs[view] = { status: 'idle', result: null, error: null, params: aiJobs[view]?.params || null, startedAt: null };
  notify();
}

export function resetAiJob(view) {
  aiJobs[view] = { status: 'idle', result: null, error: null, params: null, startedAt: null };
  notify();
}

// ── Task Selection Cart (localStorage) ──────────────────────
const SELECTION_KEY = 'pth_selection';
const selectionListeners = new Set();

function loadSelection() {
  try { return JSON.parse(localStorage.getItem(SELECTION_KEY)) || []; }
  catch { return []; }
}

function saveSelection(items) {
  localStorage.setItem(SELECTION_KEY, JSON.stringify(items));
  for (const fn of selectionListeners) {
    try { fn(); } catch (e) { console.error('Selection listener error:', e); }
  }
}

export function onSelectionChange(fn) {
  selectionListeners.add(fn);
  return () => selectionListeners.delete(fn);
}

export function getSelection() { return loadSelection(); }
export function getSelectionCount() { return loadSelection().length; }
export function isSelected(taskId) { return loadSelection().some(t => t.id === taskId); }

export function addToSelection(task, source) {
  const items = loadSelection();
  if (items.some(t => t.id === task.id)) return;
  items.push({
    id: task.id,
    score: task.score || 0,
    priority: task.priority || '',
    status: task.status || '',
    group: task.group || '',
    assignedPod: task.assignedPod || '',
    description: task.description || task.aiDescription || '',
    aiNotes: task.aiNotes || '',
    source: source || 'manual',
    addedAt: Date.now(),
    overrides: {},
  });
  saveSelection(items);
}

export function addAiTaskToSelection(aiTask, source) {
  const items = loadSelection();
  if (items.some(t => t.id === aiTask.taskId)) return;
  items.push({
    id: aiTask.taskId,
    score: aiTask.score || 0,
    priority: '',
    status: '',
    group: aiTask.aiGroup || '',
    assignedPod: '',
    description: aiTask.aiDescription || '',
    aiNotes: aiTask.aiNotes || '',
    source: source || 'ai',
    addedAt: Date.now(),
    overrides: {},
  });
  saveSelection(items);
}

export function removeFromSelection(taskId) {
  saveSelection(loadSelection().filter(t => t.id !== taskId));
}

export function clearSelection() {
  localStorage.removeItem(SELECTION_KEY);
  for (const fn of selectionListeners) {
    try { fn(); } catch (e) { console.error('Selection listener error:', e); }
  }
}

export function updateSelectionOverride(taskId, field, value) {
  const items = loadSelection();
  const item = items.find(t => t.id === taskId);
  if (!item) return;
  if (!item.overrides) item.overrides = {};
  if (value === '' || value === item[field]) {
    delete item.overrides[field];
  } else {
    item.overrides[field] = value;
  }
  saveSelection(items);
}

export function updateSelectionNotes(taskId, notes) {
  const items = loadSelection();
  const item = items.find(t => t.id === taskId);
  if (!item) return;
  item.aiNotes = notes;
  saveSelection(items);
}
