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
const MAX_HISTORY = 30;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
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
