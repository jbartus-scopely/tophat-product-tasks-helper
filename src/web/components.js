import { api, apiPost, MAX_SCORE, getAiJob, startAiJob, cancelAiJob, resetAiJob, getModels, getSelectedModel, setSelectedModel, getQueryHistory, addQueryToHistory, toggleStarQuery, removeQueryFromHistory, clearQueryHistory } from './shared.js';

// ── Helpers ──────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function truncate(text, max) {
  if (!text) return '';
  const one = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : one.slice(0, max - 1) + '\u2026';
}

// ── Priority Badge ───────────────────────────────────────────
function priorityBadge(p) {
  if (p === 'P0') return '<span class="badge badge-p0">P0</span>';
  if (p === 'P1') return '<span class="badge badge-p1">P1</span>';
  if (p === 'P2') return '<span class="badge badge-p2">P2</span>';
  return '<span class="badge badge-none">--</span>';
}

function statusBadge(s) {
  const cls = 'status-' + (s || '').toLowerCase().replace(/[\s/]+/g, '-');
  return `<span class="badge-status ${cls}"><span class="status-dot"></span>${esc(s || '--')}</span>`;
}

const GROUP_COLORS = {
  'Timings': '#d29922', 'UI/UX': '#58a6ff', 'MRG': '#bc8cff', 'Album': '#3fb950',
  'SD/BH': '#f85149', 'Social': '#388bfd', 'Cosmetics': '#f778ba', 'Rolling': '#f0883e',
  'QW': '#ffd700', 'Bug': '#ff7b72', 'Tournaments': '#9370db', 'Bots': '#20b2aa',
  'Delight': '#ff6347', 'FTUE': '#4682b4', 'Networth': '#32cd32',
};

function groupBadge(g) {
  if (!g) return '<span class="badge-group" style="color:var(--text-dim)">--</span>';
  const color = GROUP_COLORS[g] || '#7d8590';
  return `<span class="badge-group" style="color:${color}">${esc(g)}</span>`;
}

function scoreBar(score) {
  const ratio = Math.max(0, Math.min(1, score / MAX_SCORE));
  const pct = (ratio * 100).toFixed(0);
  let color = '#f85149';
  if (ratio >= 0.7) color = '#3fb950';
  else if (ratio >= 0.45) color = '#d29922';
  return `<span class="score-bar">
    <span class="score-bar-track"><span class="score-bar-fill" style="width:${pct}%;background-color:${color}"></span></span>
    <span class="score-bar-num" style="color:${color}">${score}</span>
  </span>`;
}

function preproBadge(p) {
  if (p === '0 - Low') return '<span class="badge-prepro low">Low</span>';
  if (p === '1 - Mid') return '<span class="badge-prepro mid">Mid</span>';
  if (p === '2 - High') return '<span class="badge-prepro high">High</span>';
  return '<span class="badge-prepro" style="color:var(--text-dim)">--</span>';
}

function aiActionBadge(action) {
  const norm = (action || '').trim().toLowerCase();
  const map = {
    'todo': 'action-todo', 'take next': 'action-take-next', 'consider': 'action-consider',
    'skip': 'action-skip', 'discard': 'action-discard', 'merge': 'action-merge',
    'keep triage': 'action-keep-triage', 'hold': 'action-hold',
    'prioritize': 'action-prioritize', 'keep todo': 'action-keep-todo',
  };
  const cls = map[norm] || 'action-skip';
  return `<span class="badge-ai-action ${cls}">${esc(action || '--')}</span>`;
}

function groupSelect(groups, id) {
  let html = `<select id="${id}"><option value="">All groups</option>`;
  for (const g of groups) html += `<option value="${esc(g)}">${esc(g)}</option>`;
  return html + '</select>';
}

// ── Query Input with History ─────────────────────────────────
function queryInputHtml() {
  return `<div class="ai-form-field" style="flex:3">
    <label>Question</label>
    <div class="query-input-wrap">
      <input type="text" id="ai-ask" placeholder="What are the top quick wins?" autocomplete="off">
      <button type="button" class="query-history-btn" id="query-history-toggle" title="Query history"><i data-lucide="history" style="width:14px;height:14px"></i></button>
    </div>
    <div class="query-dropdown" id="query-dropdown" style="display:none"></div>
  </div>`;
}

function renderQueryDropdown() {
  const dd = document.getElementById('query-dropdown');
  if (!dd) return;
  const entries = getQueryHistory();

  if (entries.length === 0) {
    dd.style.display = 'none';
    return;
  }

  let html = '<div class="query-dropdown-header"><span>Query History</span><button type="button" class="query-clear-all" id="query-clear-all">Clear all</button></div>';
  for (const e of entries) {
    const starCls = e.starred ? 'starred' : '';
    html += `<div class="query-dropdown-item" data-query="${esc(e.query)}">
      <button type="button" class="query-star ${starCls}" data-star-query="${esc(e.query)}" title="${e.starred ? 'Unstar' : 'Star'}"><i data-lucide="${e.starred ? 'star' : 'star'}" style="width:12px;height:12px"></i></button>
      <span class="query-text">${esc(truncate(e.query, 80))}</span>
      <button type="button" class="query-remove" data-remove-query="${esc(e.query)}" title="Remove"><i data-lucide="x" style="width:12px;height:12px"></i></button>
    </div>`;
  }

  dd.innerHTML = html;
  dd.style.display = 'block';
  if (window.lucide) lucide.createIcons();

  dd.querySelectorAll('.query-dropdown-item').forEach(item => {
    item.querySelector('.query-text')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const input = document.getElementById('ai-ask');
      if (input) input.value = item.dataset.query;
      dd.style.display = 'none';
    });
  });

  dd.querySelectorAll('.query-star').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleStarQuery(btn.dataset.starQuery);
      renderQueryDropdown();
    });
  });

  dd.querySelectorAll('.query-remove').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeQueryFromHistory(btn.dataset.removeQuery);
      renderQueryDropdown();
    });
  });

  document.getElementById('query-clear-all')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    clearQueryHistory();
    dd.style.display = 'none';
  });
}

function wireQueryHistory() {
  const toggle = document.getElementById('query-history-toggle');
  const dd = document.getElementById('query-dropdown');
  if (!toggle || !dd) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dd.style.display === 'none') renderQueryDropdown();
    else dd.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
      dd.style.display = 'none';
    }
  }, { once: false });
}

// ── Bar Chart ────────────────────────────────────────────────
function barChart(data, color) {
  const max = Math.max(...data.map(d => d.count), 1);
  let html = '<div class="bar-chart">';
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
  for (const { label, count } of sorted) {
    const pct = ((count / max) * 100).toFixed(0);
    html += `<div class="bar-row">
      <span class="bar-label" title="${esc(label)}">${esc(label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background-color:${color}"></span></span>
      <span class="bar-count">${count}</span>
    </div>`;
  }
  return html + '</div>';
}

// ── Model Selector ───────────────────────────────────────────
function modelSelect() {
  const models = getModels();
  const selected = getSelectedModel();
  if (!models.length) return '<select id="ai-model" class="model-select"><option value="">Default (CLI setting)</option></select>';

  const CATEGORY_LABELS = { default: '', fast: 'Fast', balanced: 'Balanced', thoughtful: 'Thoughtful' };
  const CATEGORY_ORDER = ['default', 'fast', 'balanced', 'thoughtful'];
  const grouped = {};
  for (const m of models) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  let html = '<select id="ai-model" class="model-select">';
  for (const cat of CATEGORY_ORDER) {
    const items = grouped[cat];
    if (!items) continue;
    if (cat !== 'default') html += `<optgroup label="${CATEGORY_LABELS[cat]}">`;
    for (const m of items) {
      const sel = m.id === selected ? ' selected' : '';
      const label = m.desc ? `${m.label} — ${m.desc}` : m.label;
      html += `<option value="${esc(m.id)}"${sel}>${esc(label)}</option>`;
    }
    if (cat !== 'default') html += '</optgroup>';
  }
  return html + '</select>';
}

function modelWarningHtml() {
  return '<div class="model-warning" id="model-warning" style="display:none"><i data-lucide="triangle-alert" style="width:11px;height:11px"></i> Model override not supported by your CLI. Using default.</div>';
}

// ── CSV Export Helpers ───────────────────────────────────────
function allTasksToTsv(tasks, showAi) {
  const rows = [];
  if (showAi) {
    rows.push(['Task ID', 'AI Priority', 'AI Action', 'Group', 'AI Description', 'AI Notes'].join('\t'));
    tasks.forEach(t => rows.push([t.taskId, t.aiPriority, t.aiAction, t.aiGroup || '', t.aiDescription, t.aiNotes || ''].join('\t')));
  } else {
    rows.push(['ID', 'Score', 'Priority', 'Status', 'Group', 'Prepro', 'Description'].join('\t'));
    tasks.forEach(t => rows.push([t.id, t.score, t.priority || '--', t.status || '--', t.group || '--', t.preproWork || '--', truncate(t.description, 200)].join('\t')));
  }
  return rows.join('\n');
}

function allTasksToCsv(tasks, showAi) {
  const f = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [];
  if (showAi) {
    rows.push('Task ID,AI Priority,AI Action,Group,AI Description,AI Notes');
    tasks.forEach(t => rows.push([t.taskId, t.aiPriority, t.aiAction, t.aiGroup || '', t.aiDescription, t.aiNotes || ''].map(f).join(',')));
  } else {
    rows.push('ID,Score,Priority,Status,Group,Prepro,Description');
    tasks.forEach(t => rows.push([t.id, t.score, t.priority || '--', t.status || '--', t.group || '--', t.preproWork || '--', truncate(t.description, 200)].map(f).join(',')));
  }
  return rows.join('\n');
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportToolbar(toolbarId) {
  return `<div class="table-toolbar" id="${toolbarId}">
    <button type="button" class="btn btn-sm" data-action="copy"><i data-lucide="clipboard-copy" style="width:12px;height:12px"></i> Copy for Sheets</button>
    <button type="button" class="btn btn-sm" data-action="download"><i data-lucide="download" style="width:12px;height:12px"></i> Download CSV</button>
  </div>`;
}

function wireExportToolbar(toolbarId, getAllTasks, showAi) {
  const toolbar = document.getElementById(toolbarId);
  if (!toolbar) return;
  toolbar.querySelector('[data-action="copy"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const tsv = allTasksToTsv(getAllTasks(), showAi);
    navigator.clipboard.writeText(tsv).then(() => {
      const btn = toolbar.querySelector('[data-action="copy"]');
      const orig = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px"></i> Copied!';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => { btn.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 2000);
    });
  });
  toolbar.querySelector('[data-action="download"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadBlob(allTasksToCsv(getAllTasks(), showAi), 'tasks.csv', 'text/csv');
  });
}

// ── Task Table ───────────────────────────────────────────────
function taskTable(tasks, opts = {}) {
  const showAi = opts.ai || false;
  let html = '<table class="data-table"><thead><tr>';
  html += '<th class="col-num">#</th>';
  if (!showAi) html += '<th class="sortable" data-sort="score">Score</th>';
  html += '<th>ID</th>';
  if (!showAi) {
    html += '<th class="sortable" data-sort="priority">Priority</th>';
    html += '<th class="sortable" data-sort="status">Status</th>';
  }
  if (showAi) {
    html += '<th class="sortable" data-sort="aiPriority">AI Priority</th>';
    html += '<th class="sortable" data-sort="aiAction">AI Action</th>';
  }
  html += '<th class="sortable" data-sort="group">Group</th>';
  if (!showAi) html += '<th class="sortable" data-sort="prepro">Prepro</th>';
  html += '<th>Description</th>';
  if (showAi) html += '<th>AI Notes</th>';
  html += '</tr></thead><tbody>';

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const id = showAi ? t.taskId : t.id;
    const desc = showAi ? t.aiDescription : truncate(t.description, 80);
    html += `<tr data-id="${esc(id)}">`;
    html += `<td class="col-num">${i + 1}</td>`;
    if (!showAi) html += `<td class="col-score">${scoreBar(t.score)}</td>`;
    html += `<td class="col-id">${esc(id)}</td>`;
    if (!showAi) {
      html += `<td>${priorityBadge(t.priority)}</td>`;
      html += `<td>${statusBadge(t.status)}</td>`;
    }
    if (showAi) {
      html += `<td>${priorityBadge(t.aiPriority === 'High' ? 'P0' : t.aiPriority === 'Mid' ? 'P1' : 'P2')}</td>`;
      html += `<td>${aiActionBadge(t.aiAction)}</td>`;
    }
    html += `<td>${groupBadge(showAi ? t.aiGroup : t.group)}</td>`;
    if (!showAi) html += `<td>${preproBadge(t.preproWork)}</td>`;
    html += `<td class="col-desc">${esc(desc)}</td>`;
    if (showAi) html += `<td style="font-size:12px;color:var(--text-muted);max-width:250px">${esc(t.aiNotes || '--')}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// ── Task Detail ──────────────────────────────────────────────
function taskDetail(task) {
  return `<div class="task-detail">
    <div class="task-detail-header">
      <span class="task-detail-id">${esc(task.id)}</span>
      ${priorityBadge(task.priority)}
      ${statusBadge(task.status)}
      ${groupBadge(task.group)}
    </div>
    <div class="task-detail-grid">
      <div class="task-detail-field"><label>Score</label><span>${scoreBar(task.score)}</span></div>
      <div class="task-detail-field"><label>Prepro</label><span>${preproBadge(task.preproWork)}</span></div>
      <div class="task-detail-field"><label>Risk</label><span style="color:${task.risk === 'Low' ? 'var(--green)' : task.risk === 'High' ? 'var(--red)' : 'var(--text-dim)'}">${esc(task.risk || '--')}</span></div>
      <div class="task-detail-field"><label>Appearance</label><span>${esc(task.appearance || '--')}</span></div>
      <div class="task-detail-field"><label>Reporter</label><span>${esc(task.reporter || '--')}</span></div>
      <div class="task-detail-field"><label>Assigned Pod</label><span>${esc(task.assignedPod || '--')}</span></div>
      <div class="task-detail-field"><label>Type</label><span>${esc(task.type || '--')}</span></div>
      <div class="task-detail-field"><label>JIRA</label><span>${esc(task.jira || '--')}</span></div>
    </div>
    <div class="task-detail-desc">${esc(task.description)}</div>
  </div>`;
}

// ── Click to expand ──────────────────────────────────────────
function wireClickToExpand(container) {
  container.querySelectorAll('tr[data-id]').forEach(row => {
    if (row.dataset.expandWired) return;
    row.dataset.expandWired = '1';
    row.addEventListener('click', async (e) => {
      if (e.target.closest('button')) return;
      const existing = row.nextElementSibling;
      if (existing?.classList.contains('detail-row')) { existing.remove(); return; }
      container.querySelectorAll('.detail-row').forEach(r => r.remove());
      const task = await api(`/api/tasks/${row.dataset.id}`);
      if (task.error) return;
      const tr = document.createElement('tr');
      tr.className = 'detail-row';
      const td = document.createElement('td');
      td.colSpan = 20;
      td.innerHTML = taskDetail(task);
      tr.appendChild(td);
      row.after(tr);
    });
  });
}

// ── Sorting ──────────────────────────────────────────────────
const PRIORITY_RANK = { 'P0': 0, 'P1': 1, 'P2': 2, '': 3, '--': 3 };
const AI_PRIORITY_RANK = { 'High': 0, 'Mid': 1, 'Low': 2, '': 3 };
const PREPRO_RANK = { '0 - Low': 0, '1 - Mid': 1, '2 - High': 2, '': 3 };

function sortTasks(tasks, field, dir, showAi) {
  const sorted = [...tasks];
  const d = dir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    let va, vb;
    if (field === 'score') { va = a.score; vb = b.score; return (va - vb) * d; }
    if (field === 'priority') { va = PRIORITY_RANK[a.priority] ?? 3; vb = PRIORITY_RANK[b.priority] ?? 3; return (va - vb) * d; }
    if (field === 'aiPriority') { va = AI_PRIORITY_RANK[a.aiPriority] ?? 3; vb = AI_PRIORITY_RANK[b.aiPriority] ?? 3; return (va - vb) * d; }
    if (field === 'status') { va = a.status || ''; vb = b.status || ''; return va.localeCompare(vb) * d; }
    if (field === 'aiAction') { va = a.aiAction || ''; vb = b.aiAction || ''; return va.localeCompare(vb) * d; }
    if (field === 'group') { va = (showAi ? a.aiGroup : a.group) || ''; vb = (showAi ? b.aiGroup : b.group) || ''; return va.localeCompare(vb) * d; }
    if (field === 'prepro') { va = PREPRO_RANK[a.preproWork] ?? 3; vb = PREPRO_RANK[b.preproWork] ?? 3; return (va - vb) * d; }
    return 0;
  });
  return sorted;
}

function makeSortController(baseTasks, showAi, onSort) {
  const state = { field: null, dir: 'asc' };

  function toggle(field) {
    if (state.field === field) {
      state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    } else {
      state.field = field;
      state.dir = 'asc';
    }
    onSort(sortTasks(baseTasks, state.field, state.dir, showAi));
  }

  function wire(container) {
    container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => toggle(th.dataset.sort));
    });
    updateIndicators(container);
  }

  function updateIndicators(container) {
    container.querySelectorAll('th.sortable').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    if (state.field) {
      const th = container.querySelector(`th[data-sort="${state.field}"]`);
      if (th) th.classList.add(state.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  }

  function getState() { return { ...state }; }
  function setTasks(tasks) { baseTasks = tasks; }

  return { wire, updateIndicators, getState, setTasks };
}

// ── AI Results Renderer ──────────────────────────────────────
function renderAiResultsHtml(result) {
  if (!result) return '<div style="padding:20px;color:var(--text-muted)">No results returned.</div>';

  if (result.text !== undefined) {
    return result.text
      ? `<div class="ai-prose">${esc(result.text)}</div>`
      : '<div style="padding:20px;color:var(--text-muted)">No results returned.</div>';
  }

  if (!result.tasks || result.tasks.length === 0) {
    return result.prose
      ? `<div class="ai-prose">${esc(result.prose)}</div>`
      : '<div style="padding:20px;color:var(--text-muted)">No results returned.</div>';
  }

  const groups = {};
  for (const t of result.tasks) {
    const action = (t.aiAction || 'Other').trim();
    if (!groups[action]) groups[action] = [];
    groups[action].push(t);
  }

  const ACTION_META = {
    'TODO':         { icon: '+', color: 'var(--green)',  bg: 'var(--green-dim)' },
    'Take Next':    { icon: '!', color: 'var(--green)',  bg: 'var(--green-dim)' },
    'Prioritize':   { icon: '^', color: 'var(--green)',  bg: 'var(--green-dim)' },
    'Consider':     { icon: '~', color: 'var(--accent)', bg: 'var(--accent-dim)' },
    'Keep TODO':    { icon: '-', color: 'var(--accent)', bg: 'var(--accent-dim)' },
    'Keep Triage':  { icon: '?', color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
    'Discard':      { icon: 'x', color: 'var(--red)',    bg: 'var(--red-dim)' },
    'Merge':        { icon: 'm', color: 'var(--purple)', bg: 'var(--purple-dim)' },
    'Hold':         { icon: '-', color: 'var(--text-muted)', bg: 'var(--bg)' },
    'Skip':         { icon: '-', color: 'var(--text-dim)',   bg: 'var(--bg)' },
  };

  const order = ['TODO', 'Take Next', 'Prioritize', 'Consider', 'Keep TODO', 'Keep Triage', 'Discard', 'Merge', 'Hold', 'Skip'];
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  let html = '';
  for (const action of sortedKeys) {
    const tasks = groups[action];
    const meta = ACTION_META[action] || { icon: '?', color: 'var(--text-muted)', bg: 'var(--bg)' };
    html += `<div class="ai-results-section">
      <div class="ai-section-header">
        <span class="ai-section-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</span>
        <span class="ai-section-title">${esc(action)}</span>
        <span class="ai-section-count">${tasks.length}</span>
      </div>
      ${taskTable(tasks, { ai: true })}
    </div>`;
  }

  if (result.prose) html += `<div class="ai-prose">${esc(result.prose)}</div>`;
  html += `<div class="table-footer">${result.tasks.length} tasks analyzed</div>`;
  return html;
}

// ── Spinner HTML ─────────────────────────────────────────────
let timerInterval = null;

function spinnerHtml(text, startedAt) {
  const elapsed = startedAt ? formatElapsed(Date.now() - startedAt) : '0s';
  return `<div class="spinner-container"><div class="spinner"></div><div class="spinner-text">${esc(text)}</div><div class="spinner-timer" id="ai-timer">${elapsed}</div></div>`;
}

function formatElapsed(ms) {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${(secs % 60).toString().padStart(2, '0')}s`;
}

function startTimer(startedAt) {
  stopTimer();
  if (!startedAt) return;
  timerInterval = setInterval(() => {
    const el = document.getElementById('ai-timer');
    if (el) el.textContent = formatElapsed(Date.now() - startedAt);
    else stopTimer();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function errorHtml(msg) {
  return `<div class="warnings"><div class="warnings-title"><i data-lucide="triangle-alert" style="width:14px;height:14px;vertical-align:-2px"></i> Error</div><p>${esc(msg)}</p></div>`;
}

// ── Dashboard View ───────────────────────────────────────────
export function renderDashboard($el, state) {
  const s = state.stats;
  if (!s) return;

  const priorityData = Object.entries(s.byPriority).map(([label, count]) => ({ label, count }));
  const statusData = Object.entries(s.byStatus).map(([label, count]) => ({ label, count }));
  const groupData = Object.entries(s.byGroup).map(([label, count]) => ({ label, count }));

  let html = '<div class="summary-row">';
  html += `<div class="summary-card accent"><div class="summary-card-top"><i data-lucide="layers" class="summary-icon"></i></div><div class="summary-value">${s.total}</div><div class="summary-label">Total Tasks</div></div>`;
  html += `<div class="summary-card green"><div class="summary-card-top"><i data-lucide="target" class="summary-icon"></i></div><div class="summary-value">${s.actionable}</div><div class="summary-label">Actionable</div></div>`;
  html += `<div class="summary-card yellow"><div class="summary-card-top"><i data-lucide="zap" class="summary-icon"></i></div><div class="summary-value">${s.quickWins}</div><div class="summary-label">Quick Wins</div></div>`;
  html += `<div class="summary-card dim"><div class="summary-card-top"><i data-lucide="filter-x" class="summary-icon"></i></div><div class="summary-value">${s.filtered}</div><div class="summary-label">Rows Skipped</div></div>`;
  html += '</div>';

  if (s.warnings.length > 0) {
    html += '<div class="warnings"><div class="warnings-title"><i data-lucide="triangle-alert" style="width:14px;height:14px;vertical-align:-2px"></i> Data Warnings</div><ul class="warnings-list">';
    for (const w of s.warnings) html += `<li>${esc(w)}</li>`;
    html += '</ul></div>';
  }

  html += '<div class="charts-row">';
  html += `<div class="card"><div class="card-title"><i data-lucide="signal" style="width:14px;height:14px;vertical-align:-2px"></i> Priority</div>${barChart(priorityData, '#58a6ff')}</div>`;
  html += `<div class="card"><div class="card-title"><i data-lucide="activity" style="width:14px;height:14px;vertical-align:-2px"></i> Status</div>${barChart(statusData, '#3fb950')}</div>`;
  html += `<div class="card"><div class="card-title"><i data-lucide="folder" style="width:14px;height:14px;vertical-align:-2px"></i> Group</div>${barChart(groupData, '#bc8cff')}</div>`;
  html += '</div>';

  $el.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// ── Task List View ───────────────────────────────────────────
export function renderTaskList($el, category, state) {
  let html = '<div class="table-controls">';
  html += `<div class="ai-form-field" style="flex:0 0 180px"><label>Group</label>${groupSelect(state.groups, 'group-filter')}</div>`;
  html += '</div>';
  html += exportToolbar('list-export');
  html += '<div id="task-table-container"><div class="spinner-container"><div class="spinner"></div></div></div>';
  $el.innerHTML = html;

  let currentTasks = [];
  let sorter = null;

  function renderTable(tasks) {
    const container = document.getElementById('task-table-container');
    container.innerHTML = taskTable(tasks) + `<div class="table-footer">Showing ${tasks.length} tasks</div>`;
    wireClickToExpand(container);
    sorter.wire(container);
    if (window.lucide) lucide.createIcons();
  }

  async function loadTasks() {
    const group = document.getElementById('group-filter')?.value || '';
    const container = document.getElementById('task-table-container');
    container.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';

    const data = await api(`/api/tasks?category=${category}&group=${encodeURIComponent(group)}&limit=100`);
    if (!data.tasks || data.tasks.length === 0) {
      currentTasks = [];
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">No tasks found.</div>';
      return;
    }
    currentTasks = data.tasks;
    sorter = makeSortController(currentTasks, false, renderTable);
    renderTable(currentTasks);
  }

  wireExportToolbar('list-export', () => currentTasks, false);
  document.getElementById('group-filter')?.addEventListener('change', loadTasks);
  if (window.lucide) lucide.createIcons();
  loadTasks();
}

// ── AI View ──────────────────────────────────────────────────
const AI_VIEW_CONFIG = {
  analyze:    { endpoint: '/api/ai/analyze',    btnText: 'Analyze',        spinnerText: 'Asking Claude... this may take a minute', hasQuestion: true,  hasGroup: true,  hasCache: false },
  groom:      { endpoint: '/api/ai/groom',      btnText: 'Groom Triage',   spinnerText: 'Grooming triage tasks...',               hasQuestion: false, hasGroup: true,  hasCache: true },
  prioritize: { endpoint: '/api/ai/prioritize', btnText: 'Prioritize TODO',spinnerText: 'Analyzing TODO tasks...',                hasQuestion: false, hasGroup: true,  hasCache: true },
  duplicates: { endpoint: '/api/ai/duplicates', btnText: 'Find Duplicates',spinnerText: 'Scanning for duplicates...',             hasQuestion: false, hasGroup: false, hasCache: true },
};

export function renderAiView($el, view, state) {
  const config = AI_VIEW_CONFIG[view];
  const job = getAiJob(view);
  const isRunning = job.status === 'running';

  // Build form
  let formHtml = '<div class="ai-form"><div class="ai-form-row">';
  if (config.hasQuestion) formHtml += queryInputHtml();
  if (config.hasGroup) {
    formHtml += `<div class="ai-form-field" style="flex:0 0 180px"><label>Group</label>${groupSelect(state.groups, 'ai-group')}</div>`;
  }
  formHtml += `<div class="ai-form-field" style="flex:0 0 220px"><label><i data-lucide="cpu" style="width:11px;height:11px;vertical-align:-1px"></i> Model</label>${modelSelect()}${modelWarningHtml()}</div>`;
  if (config.hasCache) {
    formHtml += `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);margin-bottom:1px"><input type="checkbox" id="ai-cache"> Use cache</label>`;
  }
  if (isRunning) {
    formHtml += `<button type="button" class="btn btn-danger" id="ai-cancel" style="margin-bottom:1px"><i data-lucide="square" style="width:12px;height:12px"></i> Cancel</button>`;
  } else {
    formHtml += `<button type="button" class="btn btn-primary" id="ai-submit" style="margin-bottom:1px">${config.btnText}</button>`;
  }
  formHtml += '</div></div>';

  // Results area
  let resultsHtml = '';
  let allAiTasks = [];
  if (isRunning) {
    resultsHtml = spinnerHtml(config.spinnerText, job.startedAt);
  } else if (job.status === 'error') {
    resultsHtml = errorHtml(job.error);
    resultsHtml += `<div style="text-align:center;padding:8px"><button type="button" class="btn btn-sm" id="ai-clear">Clear</button></div>`;
  } else if (job.status === 'done') {
    if (job.result?.tasks?.length) allAiTasks = job.result.tasks;
    if (allAiTasks.length) resultsHtml += exportToolbar('ai-export');
    resultsHtml += renderAiResultsHtml(job.result);
    resultsHtml += `<div style="text-align:center;padding:8px"><button type="button" class="btn btn-sm" id="ai-clear"><i data-lucide="rotate-ccw" style="width:12px;height:12px"></i> New query</button></div>`;
  }

  $el.innerHTML = formHtml + `<div id="ai-results">${resultsHtml}</div>`;

  // Wire export
  if (allAiTasks.length) wireExportToolbar('ai-export', () => allAiTasks, true);

  wireClickToExpand($el);

  // Wire sorting on each AI results table
  $el.querySelectorAll('.ai-results-section').forEach(section => {
    const table = section.querySelector('.data-table');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tbody tr[data-id]'));
    const sectionTasks = rows.map(r => allAiTasks.find(t => t.taskId === r.dataset.id)).filter(Boolean);
    const sorter = makeSortController(sectionTasks, true, (sorted) => {
      const tbody = table.querySelector('tbody');
      tbody.innerHTML = '';
      sorted.forEach((t, i) => {
        const tr = document.createElement('tr');
        tr.dataset.id = t.taskId;
        tr.innerHTML = `<td class="col-num">${i + 1}</td><td class="col-id">${esc(t.taskId)}</td><td>${priorityBadge(t.aiPriority === 'High' ? 'P0' : t.aiPriority === 'Mid' ? 'P1' : 'P2')}</td><td>${aiActionBadge(t.aiAction)}</td><td>${groupBadge(t.aiGroup)}</td><td class="col-desc">${esc(t.aiDescription)}</td><td style="font-size:12px;color:var(--text-muted);max-width:250px">${esc(t.aiNotes || '--')}</td>`;
        tbody.appendChild(tr);
      });
      sorter.updateIndicators(section);
      wireClickToExpand(section);
    });
    sorter.wire(section);
  });

  if (window.lucide) lucide.createIcons();

  if (isRunning) startTimer(job.startedAt);
  else stopTimer();

  // Restore form values from params
  if (job.params) {
    if (config.hasQuestion && job.params.ask) {
      const el = document.getElementById('ai-ask');
      if (el) el.value = job.params.ask;
    }
    if (config.hasGroup && job.params.group) {
      const el = document.getElementById('ai-group');
      if (el) el.value = job.params.group;
    }
  }

  // Model change persists
  document.getElementById('ai-model')?.addEventListener('change', (e) => setSelectedModel(e.target.value));

  // Wire query history
  if (config.hasQuestion) wireQueryHistory();

  // Cancel button
  document.getElementById('ai-cancel')?.addEventListener('click', () => cancelAiJob(view));

  // Submit handler
  if (!isRunning) {
    const submit = () => {
      const body = {};
      if (config.hasQuestion) {
        const ask = document.getElementById('ai-ask')?.value.trim();
        if (!ask) return;
        body.ask = ask;
        addQueryToHistory(ask);
      }
      // Read group value directly
      if (config.hasGroup) {
        const groupVal = document.getElementById('ai-group')?.value;
        if (groupVal) body.group = groupVal;
      }
      if (config.hasCache) body.cache = document.getElementById('ai-cache')?.checked || false;
      // Read model — only include if non-empty (non-Default)
      const modelVal = document.getElementById('ai-model')?.value;
      if (modelVal) body.model = modelVal;
      startAiJob(view, config.endpoint, body);
    };
    document.getElementById('ai-submit')?.addEventListener('click', submit);
    document.getElementById('ai-ask')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  document.getElementById('ai-clear')?.addEventListener('click', () => resetAiJob(view));
}
