import { api, MAX_SCORE, getAiJob, startAiJob, cancelAiJob, resetAiJob, getModels, getSelectedModel, setSelectedModel, getQueryHistory, addQueryToHistory, toggleStarQuery, removeQueryFromHistory, clearQueryHistory, isSelected, addToSelection, addAiTaskToSelection, removeFromSelection, getSelection, clearSelection, updateSelectionOverride, updateSelectionNotes } from './shared.js';

// ── Helpers ──────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function linkify(escaped) {
  return escaped.replace(/https?:\/\/[^\s<&"']+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
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

function priorityFilterSelect(id) {
  return `<select id="${id}"><option value="">All priorities</option><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option></select>`;
}

const CATEGORY_STATUSES = {
  triage:     ['TRIAGE'],
  backlog:    ['TODO', 'Prioritized'],
  inprogress: ['Pre-Pro Ready', 'Prepro-In Progress', 'Pod Working'],
  done:       ['Live', 'Ready for release'],
  blocked:    ['BLOCK'],
};

function statusFilterSelect(category, id) {
  const statuses = CATEGORY_STATUSES[category] || [];
  if (statuses.length <= 1) return '';
  let html = `<select id="${id}"><option value="">All statuses</option>`;
  for (const s of statuses) html += `<option value="${esc(s)}">${esc(s)}</option>`;
  return html + '</select>';
}

const EXTRA_PODS = ['Pod31'];

function podSelect(pods, id) {
  const all = [...new Set([...pods, ...EXTRA_PODS])].sort();
  let html = `<select id="${id}"><option value="">All pods</option>`;
  html += '<option value="__empty__">No pod</option>';
  for (const p of all) html += `<option value="${esc(p)}">${esc(p)}</option>`;
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

  const CATEGORY_LABELS = {
    default: '',
    fast: 'Claude — Fast',
    balanced: 'Claude — Balanced',
    thoughtful: 'Claude — Thoughtful',
    'codex-fast': 'Codex — Fast',
    'codex-balanced': 'Codex — Balanced',
    'codex-thoughtful': 'Codex — Thoughtful',
  };
  const CATEGORY_ORDER = ['default', 'fast', 'balanced', 'thoughtful', 'codex-fast', 'codex-balanced', 'codex-thoughtful'];
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
    rows.push(['Task ID', 'AI Priority', 'AI Action', 'Group', 'Pod', 'AI Description', 'AI Notes'].join('\t'));
    tasks.forEach(t => rows.push([t.taskId, t.aiPriority, t.aiAction, t.aiGroup || '', '', t.aiDescription, t.aiNotes || ''].join('\t')));
  } else {
    rows.push(['ID', 'Score', 'Priority', 'Status', 'Group', 'Pod', 'Prepro', 'Description'].join('\t'));
    tasks.forEach(t => rows.push([t.id, t.score, t.priority || '--', t.status || '--', t.group || '--', t.assignedPod || '--', t.preproWork || '--', truncate(t.description, 200)].join('\t')));
  }
  return rows.join('\n');
}

function allTasksToCsv(tasks, showAi) {
  const f = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [];
  if (showAi) {
    rows.push('Task ID,AI Priority,AI Action,Group,Pod,AI Description,AI Notes');
    tasks.forEach(t => rows.push([t.taskId, t.aiPriority, t.aiAction, t.aiGroup || '', '', t.aiDescription, t.aiNotes || ''].map(f).join(',')));
  } else {
    rows.push('ID,Score,Priority,Status,Group,Pod,Prepro,Description');
    tasks.forEach(t => rows.push([t.id, t.score, t.priority || '--', t.status || '--', t.group || '--', t.assignedPod || '--', t.preproWork || '--', truncate(t.description, 200)].map(f).join(',')));
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
  const selectable = opts.selectable !== false;
  let html = '<table class="data-table"><thead><tr>';
  if (selectable) html += '<th class="col-sel"></th>';
  html += '<th class="col-num">#</th>';
  html += '<th class="sortable" data-sort="score">Score</th>';
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
  html += '<th class="sortable" data-sort="pod">Pod</th>';
  if (!showAi) html += '<th class="sortable" data-sort="prepro">Prepro</th>';
  html += '<th>Description</th>';
  if (showAi) html += '<th>AI Notes</th>';
  html += '</tr></thead><tbody>';

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const id = showAi ? t.taskId : t.id;
    const desc = showAi ? t.aiDescription : truncate(t.description, 200);
    const pod = showAi ? '' : (t.assignedPod || '');
    const selected = selectable && isSelected(id);
    html += `<tr data-id="${esc(id)}"${selected ? ' class="row-selected"' : ''}>`;
    if (selectable) html += `<td class="col-sel"><button class="sel-btn${selected ? ' sel-active' : ''}" data-sel-id="${esc(id)}" title="${selected ? 'Remove from selection' : 'Add to selection'}"><i data-lucide="${selected ? 'check-circle' : 'circle'}" style="width:14px;height:14px"></i></button></td>`;
    html += `<td class="col-num">${i + 1}</td>`;
    html += `<td class="col-score">${scoreBar(t.score || 0)}</td>`;
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
    html += `<td class="col-pod">${esc(pod || '--')}</td>`;
    if (!showAi) html += `<td>${preproBadge(t.preproWork)}</td>`;
    html += `<td class="col-desc">${esc(desc)}</td>`;
    if (showAi) html += `<td style="font-size:12px;color:var(--text-muted);max-width:250px">${esc(t.aiNotes || '--')}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function wireSelectionButtons(container, tasks, showAi, sourceLabel) {
  container.querySelectorAll('.sel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.selId;
      if (isSelected(id)) {
        removeFromSelection(id);
      } else {
        if (showAi) {
          const t = tasks.find(t => t.taskId === id);
          if (t) addAiTaskToSelection(t, sourceLabel);
        } else {
          const t = tasks.find(t => t.id === id);
          if (t) addToSelection(t, sourceLabel);
        }
      }
      const sel = isSelected(id);
      btn.classList.toggle('sel-active', sel);
      btn.title = sel ? 'Remove from selection' : 'Add to selection';
      btn.innerHTML = `<i data-lucide="${sel ? 'check-circle' : 'circle'}" style="width:14px;height:14px"></i>`;
      btn.closest('tr')?.classList.toggle('row-selected', sel);
      if (window.lucide) lucide.createIcons();
    });
  });
}

// ── Task Detail ──────────────────────────────────────────────
function taskDetail(task, opts = {}) {
  let html = `<div class="task-detail">
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
    <div class="task-detail-section">
      <div class="task-detail-section-label">Description</div>
      <div class="task-detail-desc">${linkify(esc(task.description))}</div>
    </div>`;
  const notes = opts.aiNotes || '';
  if (notes) {
    html += `<div class="task-detail-section">
      <div class="task-detail-section-label">AI Notes</div>
      <div class="task-detail-notes">${linkify(esc(notes))}</div>
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── Click to expand ──────────────────────────────────────────
function wireClickToExpand(container, notesMap) {
  container.querySelectorAll('tr[data-id]').forEach(row => {
    if (row.dataset.expandWired) return;
    row.dataset.expandWired = '1';
    row.addEventListener('click', async (e) => {
      if (e.target.closest('button, select, input')) return;
      const existing = row.nextElementSibling;
      if (existing?.classList.contains('detail-row')) { existing.remove(); return; }
      container.querySelectorAll('.detail-row').forEach(r => r.remove());
      const task = await api(`/api/tasks/${row.dataset.id}`);
      if (task.error) return;
      const notes = notesMap ? (notesMap[row.dataset.id] || '') : '';
      const tr = document.createElement('tr');
      tr.className = 'detail-row';
      const td = document.createElement('td');
      td.colSpan = 20;
      td.innerHTML = taskDetail(task, { aiNotes: notes });
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
    if (field === 'pod') { va = a.assignedPod || ''; vb = b.assignedPod || ''; return va.localeCompare(vb) * d; }
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
      ? `<details class="ai-prose-collapse"><summary>AI Raw Output</summary><div class="ai-prose">${esc(result.text)}</div></details>`
      : '<div style="padding:20px;color:var(--text-muted)">No results returned.</div>';
  }

  if (!result.tasks || result.tasks.length === 0) {
    return result.prose
      ? `<details class="ai-prose-collapse" open><summary>AI Analysis</summary><div class="ai-prose">${esc(result.prose)}</div></details>`
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

  if (result.prose) html += `<details class="ai-prose-collapse"><summary>AI Analysis</summary><div class="ai-prose">${esc(result.prose)}</div></details>`;
  html += `<div class="table-footer">${result.tasks.length} tasks analyzed</div>`;
  return html;
}

// ── Duplicates Results Renderer ──────────────────────────────
function renderDuplicatesResultsHtml(result) {
  if (!result) return '<div style="padding:20px;color:var(--text-muted)">No results returned.</div>';

  if (result.text !== undefined) {
    return result.text
      ? `<details class="ai-prose-collapse"><summary>AI Raw Output</summary><div class="ai-prose">${esc(result.text)}</div></details>`
      : '<div style="padding:20px;color:var(--text-muted)">No results returned.</div>';
  }

  if (!result.tasks || result.tasks.length === 0) {
    return result.prose
      ? `<details class="ai-prose-collapse" open><summary>AI Analysis</summary><div class="ai-prose">${esc(result.prose)}</div></details>`
      : '<div style="padding:20px;color:var(--text-muted)">No duplicates found.</div>';
  }

  const clusters = {};
  for (const t of result.tasks) {
    const cluster = (t.aiGroup || 'Ungrouped').trim();
    if (!clusters[cluster]) clusters[cluster] = [];
    clusters[cluster].push(t);
  }

  const DUP_ACTION_META = {
    'Keep':    { icon: '\u2713', color: 'var(--green)',  bg: 'var(--green-dim)' },
    'Merge':   { icon: 'm', color: 'var(--purple)', bg: 'var(--purple-dim)' },
    'Discard': { icon: 'x', color: 'var(--red)',    bg: 'var(--red-dim)' },
  };

  const sortedClusters = Object.keys(clusters).sort((a, b) => clusters[b].length - clusters[a].length);

  let html = `<div class="dup-summary"><span class="dup-summary-count">${sortedClusters.length}</span> similarity clusters found across <span class="dup-summary-count">${result.tasks.length}</span> tasks</div>`;

  for (let ci = 0; ci < sortedClusters.length; ci++) {
    const cluster = sortedClusters[ci];
    const tasks = clusters[cluster];

    html += `<div class="ai-results-section dup-cluster">
      <div class="ai-section-header">
        <span class="ai-section-icon" style="background:var(--purple-dim);color:var(--purple)">${ci + 1}</span>
        <span class="ai-section-title">${esc(cluster)}</span>
        <span class="ai-section-count">${tasks.length} tasks</span>
      </div>
      <table class="data-table"><thead><tr>
        <th class="col-sel"></th>
        <th class="sortable" data-sort="score">Score</th>
        <th>ID</th>
        <th>Action</th>
        <th>Status</th>
        <th>Description</th>
        <th>Why</th>
      </tr></thead><tbody>`;

    for (const t of tasks) {
      const meta = DUP_ACTION_META[t.aiAction] || { icon: '?', color: 'var(--text-muted)', bg: 'var(--bg)' };
      const selected = isSelected(t.taskId);
      html += `<tr data-id="${esc(t.taskId)}"${selected ? ' class="row-selected"' : ''}>`;
      html += `<td class="col-sel"><button class="sel-btn${selected ? ' sel-active' : ''}" data-sel-id="${esc(t.taskId)}" title="${selected ? 'Remove from selection' : 'Add to selection'}"><i data-lucide="${selected ? 'check-circle' : 'circle'}" style="width:14px;height:14px"></i></button></td>`;
      html += `<td class="col-score">${scoreBar(t.score || 0)}</td>`;
      html += `<td class="col-id">${esc(t.taskId)}</td>`;
      html += `<td><span class="badge-ai-action" style="background:${meta.bg};color:${meta.color}">${esc(t.aiAction || '--')}</span></td>`;
      html += `<td>${priorityBadge(t.aiPriority === 'High' ? 'P0' : t.aiPriority === 'Mid' ? 'P1' : 'P2')}</td>`;
      html += `<td class="col-desc">${esc(t.aiDescription)}</td>`;
      html += `<td style="font-size:12px;color:var(--text-muted);max-width:300px">${esc(t.aiNotes || '--')}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table></div>';
  }

  if (result.prose) html += `<details class="ai-prose-collapse"><summary>AI Analysis</summary><div class="ai-prose">${esc(result.prose)}</div></details>`;
  html += `<div class="table-footer">${result.tasks.length} tasks in ${sortedClusters.length} clusters</div>`;
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

function simpleSpinnerHtml(text) {
  return `<div class="spinner-container"><div class="spinner"></div><div class="spinner-text">${esc(text)}</div></div>`;
}

// ── Jira View ───────────────────────────────────────────────
const JIRA_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'all-data', label: 'All Data' },
];

const JIRA_DASHBOARD_TABS = [
  { id: 'versions', label: 'Versions' },
  { id: 'not-started', label: 'Not started' },
];

const EMPTY_VALUE = '__empty__';
const NO_FIX_VERSION_LABEL = 'No fix version';
const NO_STATUS_LABEL = 'No status';
const NO_PRIORITY_LABEL = 'No priority';
const NO_POD_LABEL = 'No pod';
const JIRA_ALL_DATA_GROUP_BY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'fixVersion', label: 'Fix version' },
  { value: 'pod', label: 'Pod' },
];
const JIRA_PRIORITY_RANK = {
  blocker: 0,
  critical: 0,
  highest: 0,
  p0: 0,
  major: 1,
  high: 1,
  p1: 1,
  medium: 2,
  normal: 2,
  p2: 2,
  minor: 3,
  low: 3,
  p3: 3,
  trivial: 4,
  lowest: 4,
  p4: 4,
  unprioritized: 5,
  '': 5,
};

function jiraIssueCount(section) {
  return Array.isArray(section.issues) ? section.issues.length : 0;
}

function jiraWarningCount(section) {
  return Array.isArray(section.warnings) ? section.warnings.length : 0;
}

function jiraValueBadge(value) {
  return `<span class="badge-group">${esc(value || '--')}</span>`;
}

function jiraPriorityBadge(value) {
  const text = value || '--';
  const normalized = String(value || '').trim().toLowerCase();
  let level = 'none';
  if (['highest', 'blocker', 'critical', 'p0'].includes(normalized)) level = 'highest';
  else if (['high', 'major', 'p1'].includes(normalized)) level = 'high';
  else if (['medium', 'normal', 'p2'].includes(normalized)) level = 'medium';
  else if (['low', 'minor', 'p3'].includes(normalized)) level = 'low';
  else if (['lowest', 'trivial', 'p4'].includes(normalized)) level = 'lowest';
  return `<span class="jira-priority-badge jira-priority-${level}">${esc(text)}</span>`;
}

function jiraPriorityRank(value) {
  return JIRA_PRIORITY_RANK[String(value || '').trim().toLowerCase()] ?? 5;
}

function jiraFixVersions(issue) {
  return Array.isArray(issue.fixVersions) ? issue.fixVersions.filter(Boolean) : [];
}

function jiraFixVersionLabel(issue) {
  const versions = jiraFixVersions(issue);
  return versions.length ? versions.join(', ') : '--';
}

function isFixedJiraStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return ['closed', 'done', 'fixed', 'resolved', 'released', 'ready for release', 'live'].includes(status);
}

function jiraDisplayDate(value) {
  if (!value) return '--';
  const parsed = Date.parse(normalizeDateForParse(value));
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString();
}

function normalizeDateForParse(value) {
  return String(value).replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
}

function jiraUpdatedSortValue(issue) {
  const parsed = Date.parse(normalizeDateForParse(issue.updated || ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function jiraKeyCell(issue) {
  const key = issue.key || '--';
  if (!issue.url) return `<span class="col-id">${esc(key)}</span>`;
  return `<a class="jira-key" href="${esc(issue.url)}" target="_blank" rel="noopener noreferrer">${esc(key)}</a>`;
}

function jiraIssueRows(issues) {
  if (!issues.length) {
    return '<tr><td colspan="7" class="jira-empty-cell">No issues found.</td></tr>';
  }

  return issues.map(issue => `<tr data-jira-key="${esc(issue.key || '')}">
    <td>${jiraKeyCell(issue)}</td>
    <td class="col-desc">${esc(issue.summary || '--')}</td>
    <td>${statusBadge(issue.status)}</td>
    <td>${jiraPriorityBadge(issue.priority)}</td>
    <td>${esc(jiraFixVersionLabel(issue))}</td>
    <td>${esc(jiraDisplayDate(issue.updated))}</td>
    <td class="col-pod">${esc(issue.pod || '--')}</td>
  </tr>`).join('');
}

function sortHeader(label, field, sort) {
  const cls = sort?.field === field ? ` sortable sort-${sort.dir}` : ' sortable';
  return `<th class="${cls}" data-jira-sort="${field}">${esc(label)}</th>`;
}

function jiraIssueTableHtml(issues, opts = {}) {
  const sort = opts.sort || null;
  let html = '<table class="data-table jira-issue-table"><thead><tr>';
  html += opts.sortable ? sortHeader('Key', 'key', sort) : '<th>Key</th>';
  html += '<th>Summary</th>';
  html += opts.sortable ? sortHeader('Status', 'status', sort) : '<th>Status</th>';
  html += opts.sortable ? sortHeader('Priority', 'priority', sort) : '<th>Priority</th>';
  html += opts.sortable ? sortHeader('Fix version', 'fixVersion', sort) : '<th>Fix version</th>';
  html += opts.sortable ? sortHeader('Updated', 'updated', sort) : '<th>Updated</th>';
  html += opts.sortable ? sortHeader('Pod', 'pod', sort) : '<th>Pod</th>';
  html += '</tr></thead><tbody>';
  html += jiraIssueRows(issues);
  html += '</tbody></table>';
  return html;
}

function allSavedIssues(sections) {
  return sections.flatMap(section => Array.isArray(section.issues) ? section.issues : []);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function selectedValues(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function multiFilterLabel(label, options, values, includeEmpty) {
  const selected = selectedValues(values);
  if (selected.length === 0) return `All ${label.toLowerCase()}`;
  const labels = new Map(options.map(option => [option, option]));
  if (includeEmpty) labels.set(EMPTY_VALUE, `No ${label.toLowerCase()}`);
  if (selected.length === 1) return labels.get(selected[0]) || selected[0];
  return `${selected.length} selected`;
}

function multiFilterSelectHtml(id, label, options, values, includeEmpty = false) {
  const selected = selectedValues(values);
  const summary = multiFilterLabel(label, options, selected, includeEmpty);
  let html = `<div class="ai-form-field jira-filter-field jira-multi-field"><label>${esc(label)}</label><div class="jira-multi-dropdown" data-jira-multi-dropdown="${esc(id)}">`;
  html += `<button type="button" class="jira-multi-toggle" data-jira-multi-toggle="${esc(id)}" aria-expanded="false"><span>${esc(summary)}</span><i data-lucide="chevron-down" style="width:14px;height:14px"></i></button>`;
  html += `<div class="jira-multi-menu" data-jira-multi-menu="${esc(id)}" hidden>`;
  if (includeEmpty) html += multiFilterOptionHtml(id, EMPTY_VALUE, `No ${label.toLowerCase()}`, selected.includes(EMPTY_VALUE));
  for (const option of options) html += multiFilterOptionHtml(id, option, option, selected.includes(option));
  if (!includeEmpty && options.length === 0) html += '<div class="jira-multi-empty">No options</div>';
  html += '</div></div></div>';
  return html;
}

function multiFilterOptionHtml(id, value, label, checked) {
  return `<label class="jira-multi-option"><input type="checkbox" data-jira-multi-input="${esc(id)}" value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

function currentAllDataIssues(jira) {
  return allSavedIssues(jira.sections || []);
}

function issueMatchesFilter(issue, filters) {
  const statuses = selectedValues(filters.status);
  const priorities = selectedValues(filters.priority);
  const selectedFixVersions = selectedValues(filters.fixVersion);
  const selectedPods = selectedValues(filters.pod);

  if (statuses.length > 0 && !statuses.includes(issue.status || '')) return false;
  if (priorities.length > 0 && !priorities.includes(issue.priority || '')) return false;

  const fixVersions = jiraFixVersions(issue);
  if (selectedFixVersions.length > 0) {
    const wantsEmpty = selectedFixVersions.includes(EMPTY_VALUE);
    const hasSelectedVersion = fixVersions.some(version => selectedFixVersions.includes(version));
    if (fixVersions.length === 0 && !wantsEmpty) return false;
    if (fixVersions.length > 0 && !hasSelectedVersion) return false;
  }

  const pod = issue.pod || '';
  if (selectedPods.length > 0) {
    const wantsEmpty = selectedPods.includes(EMPTY_VALUE);
    if (!pod && !wantsEmpty) return false;
    if (pod && !selectedPods.includes(pod)) return false;
  }

  const search = (filters.search || '').trim().toLowerCase();
  if (search) {
    const haystack = `${issue.key || ''} ${issue.summary || ''}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}

function compareJiraIssues(a, b, field) {
  if (field === 'updated') return jiraUpdatedSortValue(a) - jiraUpdatedSortValue(b);
  if (field === 'priority') {
    const av = a.priority || '';
    const bv = b.priority || '';
    const ar = jiraPriorityRank(av);
    const br = jiraPriorityRank(bv);
    if (ar !== br) return ar - br;
    return av.localeCompare(bv);
  }
  if (field === 'fixVersion') {
    const av = jiraFixVersions(a).join(', ');
    const bv = jiraFixVersions(b).join(', ');
    return av.localeCompare(bv);
  }
  const av = field === 'key' ? a.key : field === 'status' ? a.status : field === 'pod' ? a.pod : '';
  const bv = field === 'key' ? b.key : field === 'status' ? b.status : field === 'pod' ? b.pod : '';
  return (av || '').localeCompare(bv || '');
}

function effectiveJiraFilters(issues, filters) {
  const statuses = new Set(issues.map(issue => issue.status || '').filter(Boolean));
  const priorities = new Set(issues.map(issue => issue.priority || '').filter(Boolean));
  const fixVersions = new Set(issues.flatMap(issue => jiraFixVersions(issue)));
  const pods = new Set(issues.map(issue => issue.pod || '').filter(Boolean));
  const hasEmptyFixVersion = issues.some(issue => jiraFixVersions(issue).length === 0);
  const hasEmptyPod = issues.some(issue => !issue.pod);

  return {
    ...filters,
    status: selectedValues(filters.status).filter(value => statuses.has(value)),
    priority: selectedValues(filters.priority).filter(value => priorities.has(value)),
    fixVersion: selectedValues(filters.fixVersion).filter(value => fixVersions.has(value) || (value === EMPTY_VALUE && hasEmptyFixVersion)),
    pod: selectedValues(filters.pod).filter(value => pods.has(value) || (value === EMPTY_VALUE && hasEmptyPod)),
  };
}

function filteredSortedJiraIssues(issues, allData) {
  const filters = effectiveJiraFilters(issues, allData.filters || {});
  const sort = allData.sort || { field: 'key', dir: 'asc' };
  const filtered = issues.filter(issue => issueMatchesFilter(issue, filters));
  const direction = sort.dir === 'desc' ? -1 : 1;
  return [...filtered].sort((a, b) => {
    if (sort.field === 'priority') {
      const aUnprioritized = jiraPriorityRank(a.priority) >= 5;
      const bUnprioritized = jiraPriorityRank(b.priority) >= 5;
      if (aUnprioritized !== bUnprioritized) return aUnprioritized ? 1 : -1;
    }
    return compareJiraIssues(a, b, sort.field) * direction;
  });
}

function currentAllDataGroupBy(allData) {
  const groupBy = allData.filters?.groupBy || 'none';
  return JIRA_ALL_DATA_GROUP_BY_OPTIONS.some(option => option.value === groupBy) ? groupBy : 'none';
}

function groupAllDataIssues(issues, groupBy) {
  const groups = new Map();
  for (const issue of issues) {
    for (const label of groupLabelsForIssue(issue, groupBy)) {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(issue);
    }
  }

  return [...groups.entries()].sort(([a], [b]) => compareAllDataGroupLabels(a, b, groupBy));
}

function groupLabelsForIssue(issue, groupBy) {
  if (groupBy === 'status') return [issue.status || NO_STATUS_LABEL];
  if (groupBy === 'priority') return [issue.priority || NO_PRIORITY_LABEL];
  if (groupBy === 'fixVersion') {
    const versions = jiraFixVersions(issue);
    return versions.length > 0 ? versions : [NO_FIX_VERSION_LABEL];
  }
  if (groupBy === 'pod') return [issue.pod || NO_POD_LABEL];
  return [];
}

function compareAllDataGroupLabels(a, b, groupBy) {
  if (groupBy === 'priority') {
    const ar = jiraPriorityRank(a === NO_PRIORITY_LABEL ? '' : a);
    const br = jiraPriorityRank(b === NO_PRIORITY_LABEL ? '' : b);
    if (ar !== br) return ar - br;
  }
  if (a.startsWith('No ') && !b.startsWith('No ')) return 1;
  if (!a.startsWith('No ') && b.startsWith('No ')) return -1;
  return a.localeCompare(b);
}

function jiraEmptyHtml(title, body) {
  return `<div class="empty-state jira-empty">
    <i data-lucide="radar" style="width:64px;height:64px;opacity:0.5;margin-bottom:16px"></i>
    <h2>${esc(title)}</h2>
    <p>${esc(body)}</p>
  </div>`;
}

function jiraInlineEmptyHtml(message) {
  return `<div class="jira-inline-empty">${esc(message)}</div>`;
}

function groupedByFixVersion(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const versions = jiraFixVersions(issue);
    const labels = versions.length ? versions : [NO_FIX_VERSION_LABEL];
    for (const label of labels) {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(issue);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === NO_FIX_VERSION_LABEL) return 1;
    if (b === NO_FIX_VERSION_LABEL) return -1;
    return a.localeCompare(b);
  });
}

function issueMatchesDashboardSearch(issue, searchValue) {
  const search = (searchValue || '').trim().toLowerCase();
  if (!search) return true;
  return `${issue.key || ''} ${issue.summary || ''}`.toLowerCase().includes(search);
}

function dashboardVersionOptions(issues) {
  return uniqueSorted(issues.flatMap(issue => jiraFixVersions(issue)));
}

function selectedDashboardVersions(issues, selectedVersions) {
  const availableVersions = new Set(issues.flatMap(issue => jiraFixVersions(issue)));
  const selected = selectedValues(selectedVersions).filter(version => availableVersions.has(version));
  return selected.length > 0 ? selected : dashboardVersionOptions(issues);
}

function dashboardTabsHtml(activeView) {
  let html = '<div class="jira-dashboard-tabs" role="tablist" aria-label="Jira dashboard views">';
  for (const tab of JIRA_DASHBOARD_TABS) {
    const active = tab.id === activeView;
    html += `<button type="button" class="jira-dashboard-tab${active ? ' active' : ''}" data-jira-dashboard-tab="${tab.id}" role="tab" aria-selected="${active}">${esc(tab.label)}</button>`;
  }
  html += '</div>';
  return html;
}

function dashboardControlsHtml(dashboard, versionOptions, activeView) {
  let html = '<div class="table-controls jira-dashboard-controls">';
  if (activeView === 'versions') {
    html += multiFilterSelectHtml('jira-dashboard-version-filter', 'Versions', versionOptions, dashboard.selectedVersions || []);
    html += '<div class="jira-version-bulk-actions"><button type="button" class="btn" data-jira-version-bulk="open"><i data-lucide="chevrons-down" style="width:14px;height:14px"></i> Open all</button><button type="button" class="btn" data-jira-version-bulk="collapse"><i data-lucide="chevrons-up" style="width:14px;height:14px"></i> Collapse all</button></div>';
  }
  html += `<div class="ai-form-field jira-search-field"><label>Search</label><input type="text" id="jira-dashboard-search" value="${esc(dashboard.search || '')}"></div>`;
  html += '</div>';
  return html;
}

function selectedDashboardVersionGroups(issues, selectedVersions) {
  const groups = new Map();
  const availableVersions = new Set(issues.flatMap(issue => jiraFixVersions(issue)));
  const selected = selectedValues(selectedVersions).filter(version => availableVersions.has(version));

  if (selected.length === 0) return groupedByFixVersion(issues);

  for (const version of selected) groups.set(version, []);
  for (const issue of issues) {
    for (const version of jiraFixVersions(issue)) {
      if (groups.has(version)) groups.get(version).push(issue);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function versionGroupHtml(version, rows, dashboard) {
  const expanded = dashboard.expandedVersions?.[version] !== false;
  let html = `<div class="jira-group"><button type="button" class="jira-group-toggle" data-jira-version-toggle="${esc(version)}" aria-expanded="${expanded}">
    <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" style="width:14px;height:14px"></i>
    <span>${esc(version)}</span>
    <span>${rows.length}</span>
  </button>`;
  if (expanded) html += rows.length > 0 ? jiraIssueTableHtml(rows) : jiraInlineEmptyHtml('No issues found.');
  html += '</div>';
  return html;
}

function versionsDashboardHtml(issues, dashboard) {
  const searchedIssues = issues.filter(issue => issueMatchesDashboardSearch(issue, dashboard.search));
  const groups = selectedDashboardVersionGroups(searchedIssues, dashboard.selectedVersions || []);
  let html = '<section class="jira-section-card">';
  if (groups.length === 0) {
    html += jiraInlineEmptyHtml('No issues found.');
  } else {
    for (const [version, rows] of groups) {
      html += versionGroupHtml(version, rows, dashboard);
    }
  }
  html += '</section>';
  return html;
}

function fixedIssueTooltipHtml(rows) {
  if (rows.length === 0) return '<div class="jira-version-bug-tooltip-empty">No fixed issues for this version.</div>';

  const visibleRows = rows.slice(0, 10);
  let html = '<div class="jira-version-bug-tooltip-title">Fixed bugs</div>';
  for (const issue of visibleRows) {
    const summary = truncate(issue.summary || issue.key || 'Untitled Jira issue', 92);
    html += `<div class="jira-version-bug-tooltip-item">
      <div class="jira-version-bug-tooltip-summary">${esc(summary)}</div>
      <div class="jira-version-bug-tooltip-meta"><span>${esc(issue.status || '--')}</span><span>${esc(issue.pod || '--')}</span></div>
    </div>`;
  }
  if (rows.length > visibleRows.length) {
    html += `<div class="jira-version-bug-tooltip-more">+${rows.length - visibleRows.length} more</div>`;
  }
  return html;
}

function versionBugFixWidgetHtml(issues, dashboard) {
  const versions = selectedDashboardVersions(issues, dashboard.selectedVersions || []);
  const fixedIssues = issues.filter(issue => isFixedJiraStatus(issue.status));
  const rowsByVersion = new Map(versions.map(version => [version, []]));

  for (const issue of fixedIssues) {
    for (const version of jiraFixVersions(issue)) {
      if (rowsByVersion.has(version)) rowsByVersion.get(version).push(issue);
    }
  }

  const maxCount = Math.max(1, ...versions.map(version => rowsByVersion.get(version)?.length || 0));
  let html = '<section class="jira-section-card jira-version-widget">';
  html += '<div class="jira-section-header"><div><div class="jira-section-title">Bugs fixed by version</div><div class="jira-section-subtitle">Selected versions</div></div></div>';

  if (versions.length === 0) {
    html += jiraInlineEmptyHtml('No versions found.');
  } else {
    html += '<div class="jira-version-bug-chart" aria-label="Fixed bugs by version">';
    for (const version of versions) {
      const rows = rowsByVersion.get(version) || [];
      const barHeight = rows.length === 0 ? 4 : Math.max(12, Math.round((rows.length / maxCount) * 44));
      html += `<div class="jira-version-bug-column" tabindex="0" aria-label="${esc(version)}: ${rows.length} fixed issues">
        <div class="jira-version-bug-count">${rows.length}</div>
        <div class="jira-version-bug-bar-track"><div class="jira-version-bug-bar" style="height:${barHeight}px"></div></div>
        <div class="jira-version-bug-label" title="${esc(version)}">${esc(version)}</div>
        <div class="jira-version-bug-tooltip" role="tooltip">${fixedIssueTooltipHtml(rows)}</div>
      </div>`;
    }
    html += '</div>';
  }

  html += '</section>';
  return html;
}

function notStartedByPriorityHtml(issues, dashboard = {}) {
  const notStarted = issues.filter(issue => {
    const status = (issue.status || '').trim().toLowerCase();
    return status === 'open' || status === 'to do';
  }).filter(issue => issueMatchesDashboardSearch(issue, dashboard.search));
  const groups = new Map();
  for (const issue of notStarted) {
    const priority = issue.priority || 'No priority';
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority).push(issue);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    const ar = jiraPriorityRank(a);
    const br = jiraPriorityRank(b);
    if (ar !== br) return ar - br;
    return a.localeCompare(b);
  });

  let html = '<section class="jira-section-card"><div class="jira-section-header"><div class="jira-section-title">Not started by priority</div></div>';
  if (notStarted.length === 0) {
    html += jiraInlineEmptyHtml('No not-started issues found.');
  } else {
    for (const [priority, rows] of sortedGroups) {
      html += `<div class="jira-group"><div class="jira-group-title">${esc(priority)} <span>${rows.length}</span></div>${jiraIssueTableHtml(rows)}</div>`;
    }
  }
  html += '</section>';
  return html;
}

function jiraDashboardShellHtml(jira, loaded) {
  const sections = jira.sections || [];
  if (!loaded) return jiraEmptyHtml('No Jira data loaded', 'Refresh Jira to load saved sections.');
  if (sections.length === 0) return jiraEmptyHtml('No Jira sections', 'Saved Jira sections returned no entries.');

  const totalIssues = sections.reduce((sum, section) => sum + jiraIssueCount(section), 0);
  const warningCount = sections.reduce((sum, section) => sum + jiraWarningCount(section), 0);
  const issues = allSavedIssues(sections);
  const dashboard = jira.dashboard || {};
  const activeView = dashboard.activeView === 'not-started' ? 'not-started' : 'versions';
  const versionOptions = dashboardVersionOptions(issues);

  let html = '<div class="summary-row jira-summary-row">';
  html += `<div class="summary-card green"><div class="summary-card-top"><i data-lucide="list-checks" class="summary-icon"></i></div><div class="summary-value">${totalIssues}</div><div class="summary-label">Loaded Issues</div></div>`;
  html += `<div class="summary-card yellow"><div class="summary-card-top"><i data-lucide="triangle-alert" class="summary-icon"></i></div><div class="summary-value">${warningCount}</div><div class="summary-label">Warnings</div></div>`;
  html += versionBugFixWidgetHtml(issues, dashboard);
  html += '</div>';
  html += dashboardTabsHtml(activeView);
  html += dashboardControlsHtml(dashboard, versionOptions, activeView);
  html += activeView === 'not-started' ? notStartedByPriorityHtml(issues, dashboard) : versionsDashboardHtml(issues, dashboard);
  return html;
}

function jiraFilterControlsHtml(baseIssues, allData) {
  const filters = allData.filters || {};
  const statuses = uniqueSorted(baseIssues.map(issue => issue.status || ''));
  const priorities = uniqueSorted(baseIssues.map(issue => issue.priority || ''));
  const fixVersions = uniqueSorted(baseIssues.flatMap(issue => jiraFixVersions(issue)));
  const pods = uniqueSorted(baseIssues.map(issue => issue.pod || ''));

  let html = '<div class="table-controls jira-filter-controls">';
  html += multiFilterSelectHtml('jira-filter-status', 'Status', statuses, filters.status || []);
  html += multiFilterSelectHtml('jira-filter-priority', 'Priority', priorities, filters.priority || []);
  html += multiFilterSelectHtml('jira-filter-fix-version', 'Fix version', fixVersions, filters.fixVersion || [], true);
  html += multiFilterSelectHtml('jira-filter-pod', 'Pod', pods, filters.pod || [], true);
  html += jiraGroupBySelectHtml(currentAllDataGroupBy(allData));
  html += `<div class="ai-form-field jira-search-field"><label>Search</label><input type="text" id="jira-filter-search" value="${esc(filters.search || '')}"></div>`;
  html += '</div>';
  return html;
}

function jiraGroupBySelectHtml(value) {
  let html = '<div class="ai-form-field jira-group-by-field"><label>Group by</label><select id="jira-group-by">';
  for (const option of JIRA_ALL_DATA_GROUP_BY_OPTIONS) {
    html += `<option value="${esc(option.value)}"${option.value === value ? ' selected' : ''}>${esc(option.label)}</option>`;
  }
  html += '</select></div>';
  return html;
}

function jiraAllDataTablesHtml(issues, allData) {
  const groupBy = currentAllDataGroupBy(allData);
  const tableOptions = { sortable: true, sort: allData.sort };
  if (groupBy === 'none') return jiraIssueTableHtml(issues, tableOptions);

  const groups = groupAllDataIssues(issues, groupBy);
  if (groups.length === 0) return jiraIssueTableHtml(issues, tableOptions);

  let html = '<div class="jira-all-data-groups">';
  for (const [label, rows] of groups) {
    html += `<div class="jira-group"><div class="jira-group-title">${esc(label)} <span>${rows.length}</span></div>${jiraIssueTableHtml(rows, tableOptions)}</div>`;
  }
  html += '</div>';
  return html;
}

function jiraAllDataShellHtml(jira, loaded) {
  const sections = jira.sections || [];
  const allData = jira.allData || {};
  if (!loaded) return jiraEmptyHtml('No Jira data loaded', 'Refresh Jira to load saved sections.');
  if (sections.length === 0) return jiraEmptyHtml('No Jira sections', 'Saved Jira sections returned no entries.');

  const baseIssues = currentAllDataIssues(jira);
  const visibleIssues = filteredSortedJiraIssues(baseIssues, allData);
  let html = '';

  html += jiraFilterControlsHtml(baseIssues, allData);
  html += jiraAllDataTablesHtml(visibleIssues, allData);
  html += `<div class="table-footer">Showing ${visibleIssues.length} of ${baseIssues.length} Jira issues</div>`;

  return html;
}

function checkedMultiValues($el, id) {
  return [...$el.querySelectorAll(`[data-jira-multi-input="${id}"]:checked`)].map(input => input.value);
}

function openMultiMenus($el, openId) {
  $el.querySelectorAll('[data-jira-multi-menu]').forEach(menu => {
    const id = menu.dataset.jiraMultiMenu;
    const isOpen = id === openId;
    menu.hidden = !isOpen;
    $el.querySelector(`[data-jira-multi-toggle="${id}"]`)?.setAttribute('aria-expanded', String(isOpen));
  });
}

function removeJiraFloatingTooltip() {
  document.querySelector('.jira-floating-tooltip')?.remove();
}

function showJiraFloatingTooltip(column) {
  const source = column.querySelector('.jira-version-bug-tooltip');
  if (!source) return;

  removeJiraFloatingTooltip();
  const tooltip = document.createElement('div');
  tooltip.className = 'jira-version-bug-tooltip jira-floating-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.innerHTML = source.innerHTML;
  document.body.appendChild(tooltip);

  const columnBox = column.getBoundingClientRect();
  const tooltipBox = tooltip.getBoundingClientRect();
  const left = Math.min(
    window.innerWidth - tooltipBox.width - 12,
    Math.max(12, columnBox.left + (columnBox.width / 2) - (tooltipBox.width / 2)),
  );
  const top = Math.max(12, columnBox.top - tooltipBox.height - 10);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function wireJiraVersionBugTooltips($el) {
  $el.querySelectorAll('.jira-version-bug-column').forEach(column => {
    column.addEventListener('mouseenter', () => showJiraFloatingTooltip(column));
    column.addEventListener('focus', () => showJiraFloatingTooltip(column));
    column.addEventListener('mouseleave', removeJiraFloatingTooltip);
    column.addEventListener('blur', removeJiraFloatingTooltip);
  });
}

export function renderJiraView($el, state, actions = {}) {
  const jira = state.jira || {};
  const activeTab = jira.activeTab === 'all-data' ? 'all-data' : 'dashboard';
  const sections = Array.isArray(jira.sections) ? jira.sections : [];
  const isLoading = jira.status === 'loading';
  const lastLoaded = jira.lastLoadedAt ? new Date(jira.lastLoadedAt).toLocaleString() : '';

  let html = '<div class="jira-shell">';
  html += '<div class="jira-toolbar">';
  html += '<div class="jira-tabs" role="tablist" aria-label="Jira views">';
  for (const tab of JIRA_TABS) {
    const active = tab.id === activeTab;
    html += `<button type="button" class="jira-tab${active ? ' active' : ''}" data-jira-tab="${tab.id}" role="tab" aria-selected="${active}">${esc(tab.label)}</button>`;
  }
  html += '</div>';
  html += '<div class="jira-actions">';
  if (lastLoaded) html += `<span class="jira-last-loaded">Updated ${esc(lastLoaded)}</span>`;
  html += `<button type="button" class="btn btn-primary" id="jira-refresh" ${isLoading ? 'disabled' : ''}><i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Refresh</button>`;
  html += '</div></div>';

  if (isLoading) {
    html += simpleSpinnerHtml('Loading Jira data...');
  } else if (jira.status === 'error') {
    html += errorHtml(jira.error || 'Jira request failed.');
  } else if (activeTab === 'dashboard') {
    html += jiraDashboardShellHtml(jira, jira.loaded);
  } else {
    html += jiraAllDataShellHtml(jira, jira.loaded);
  }

  html += '</div>';
  $el.innerHTML = html;
  openMultiMenus($el, jira.openMultiDropdown || null);

  document.getElementById('jira-refresh')?.addEventListener('click', () => actions.onRefresh?.());
  $el.querySelectorAll('[data-jira-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.jiraTab;
      if (tab && tab !== activeTab) actions.onTabChange?.(tab);
    });
  });
  $el.querySelectorAll('[data-jira-dashboard-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.jiraDashboardTab;
      if (tab) actions.onDashboardTabChange?.(tab);
    });
  });
  document.getElementById('jira-dashboard-search')?.addEventListener('input', (e) => actions.onDashboardSearchChange?.(e.target.value));
  $el.querySelectorAll('[data-jira-version-toggle]').forEach(button => {
    button.addEventListener('click', () => actions.onVersionGroupToggle?.(button.dataset.jiraVersionToggle));
  });
  $el.querySelectorAll('[data-jira-version-bulk]').forEach(button => {
    button.addEventListener('click', () => {
      const versions = [...$el.querySelectorAll('[data-jira-version-toggle]')]
        .map(toggle => toggle.dataset.jiraVersionToggle)
        .filter(Boolean);
      actions.onVersionGroupsSet?.(versions, button.dataset.jiraVersionBulk === 'open');
    });
  });
  $el.querySelectorAll('[data-jira-multi-dropdown]').forEach(dropdown => {
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  });
  $el.querySelectorAll('[data-jira-multi-toggle]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.onMultiDropdownToggle?.(button.dataset.jiraMultiToggle);
    });
  });
  $el.querySelectorAll('[data-jira-multi-input]').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.jiraMultiInput;
      const values = checkedMultiValues($el, id);
      if (id === 'jira-dashboard-version-filter') actions.onDashboardVersionChange?.(values);
      if (id === 'jira-filter-status') actions.onFilterChange?.('status', values);
      if (id === 'jira-filter-priority') actions.onFilterChange?.('priority', values);
      if (id === 'jira-filter-fix-version') actions.onFilterChange?.('fixVersion', values);
      if (id === 'jira-filter-pod') actions.onFilterChange?.('pod', values);
    });
  });
  if (jira.openMultiDropdown) {
    setTimeout(() => {
      document.addEventListener('click', () => actions.onMultiDropdownClose?.(), { once: true });
    }, 0);
  }
  document.getElementById('jira-filter-search')?.addEventListener('input', (e) => actions.onFilterChange?.('search', e.target.value));
  document.getElementById('jira-group-by')?.addEventListener('change', (e) => actions.onFilterChange?.('groupBy', e.target.value));
  $el.querySelectorAll('[data-jira-sort]').forEach(header => {
    header.addEventListener('click', () => actions.onSortChange?.(header.dataset.jiraSort));
  });
  wireJiraVersionBugTooltips($el);

  if (window.lucide) lucide.createIcons();
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
  const statusHtml = statusFilterSelect(category, 'status-filter');
  let html = '<div class="table-controls">';
  html += `<div class="ai-form-field" style="flex:0 0 180px"><label>Group</label>${groupSelect(state.groups, 'group-filter')}</div>`;
  html += `<div class="ai-form-field" style="flex:0 0 150px"><label>Priority</label>${priorityFilterSelect('priority-filter')}</div>`;
  if (statusHtml) html += `<div class="ai-form-field" style="flex:0 0 180px"><label>Status</label>${statusHtml}</div>`;
  html += `<div class="ai-form-field" style="flex:0 0 180px"><label>Pod</label>${podSelect(state.pods, 'pod-filter')}</div>`;
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
    wireSelectionButtons(container, tasks, false, category);
    sorter.wire(container);
    if (window.lucide) lucide.createIcons();
  }

  async function loadTasks() {
    const group = document.getElementById('group-filter')?.value || '';
    const priority = document.getElementById('priority-filter')?.value || '';
    const statusVal = document.getElementById('status-filter')?.value || '';
    const pod = document.getElementById('pod-filter')?.value || '';
    const container = document.getElementById('task-table-container');
    container.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';

    let url = `/api/tasks?category=${category}&limit=100`;
    if (group) url += `&group=${encodeURIComponent(group)}`;
    if (priority) url += `&priority=${encodeURIComponent(priority)}`;
    if (statusVal) url += `&status=${encodeURIComponent(statusVal)}`;
    if (pod) url += `&pod=${encodeURIComponent(pod)}`;
    const data = await api(url);
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
  document.getElementById('priority-filter')?.addEventListener('change', loadTasks);
  document.getElementById('status-filter')?.addEventListener('change', loadTasks);
  document.getElementById('pod-filter')?.addEventListener('change', loadTasks);
  if (window.lucide) lucide.createIcons();
  loadTasks();
}

// ── AI View ──────────────────────────────────────────────────
const AI_VIEW_CONFIG = {
  analyze:    { endpoint: '/api/ai/analyze',    btnText: 'Analyze',        spinnerText: 'Asking AI... this may take a minute',    hasQuestion: true,  hasGroup: true,  hasCache: false },
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
    const scores = state.scores || {};
    for (const t of allAiTasks) t.score = scores[t.taskId] ?? t.score ?? 0;
    if (allAiTasks.length) resultsHtml += exportToolbar('ai-export');
    resultsHtml += view === 'duplicates' ? renderDuplicatesResultsHtml(job.result) : renderAiResultsHtml(job.result);
    resultsHtml += `<div style="text-align:center;padding:8px"><button type="button" class="btn btn-sm" id="ai-clear"><i data-lucide="rotate-ccw" style="width:12px;height:12px"></i> New query</button></div>`;
  }

  $el.innerHTML = formHtml + `<div id="ai-results">${resultsHtml}</div>`;

  // Wire export
  if (allAiTasks.length) wireExportToolbar('ai-export', () => allAiTasks, true);

  const aiNotesMap = {};
  for (const t of allAiTasks) aiNotesMap[t.taskId] = t.aiNotes || '';
  wireClickToExpand($el, aiNotesMap);
  wireSelectionButtons($el, allAiTasks, true, view);

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
        const selected = isSelected(t.taskId);
        if (selected) tr.className = 'row-selected';
        tr.innerHTML = `<td class="col-sel"><button class="sel-btn${selected ? ' sel-active' : ''}" data-sel-id="${esc(t.taskId)}" title="${selected ? 'Remove from selection' : 'Add to selection'}"><i data-lucide="${selected ? 'check-circle' : 'circle'}" style="width:14px;height:14px"></i></button></td><td class="col-num">${i + 1}</td><td class="col-score">${scoreBar(t.score || 0)}</td><td class="col-id">${esc(t.taskId)}</td><td>${priorityBadge(t.aiPriority === 'High' ? 'P0' : t.aiPriority === 'Mid' ? 'P1' : 'P2')}</td><td>${aiActionBadge(t.aiAction)}</td><td>${groupBadge(t.aiGroup)}</td><td class="col-pod">--</td><td class="col-desc">${esc(t.aiDescription)}</td><td style="font-size:12px;color:var(--text-muted);max-width:250px">${esc(t.aiNotes || '--')}</td>`;
        tbody.appendChild(tr);
      });
      sorter.updateIndicators(section);
      wireClickToExpand(section, aiNotesMap);
      wireSelectionButtons(section, allAiTasks, true, view);
      if (window.lucide) lucide.createIcons();
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

// ── Selection Review View ───────────────────────────────────
const PRIORITY_OPTIONS = ['', 'P0', 'P1', 'P2'];
const STATUS_OPTIONS = ['', 'TRIAGE', 'TODO', 'Prioritized', 'Pre-Pro Ready', 'Prepro-In Progress', 'POD Working', 'Ready for Release', 'Live', 'BLOCK', 'HOLD'];

function selectionFieldSelect(taskId, field, currentValue, original, options) {
  const val = currentValue || '';
  let html = `<select class="sel-override" data-task="${esc(taskId)}" data-field="${field}">`;
  for (const opt of options) {
    const label = opt || (original ? `${original} (original)` : '--');
    const selected = val === opt ? ' selected' : '';
    html += `<option value="${esc(opt)}"${selected}>${esc(label)}</option>`;
  }
  html += '</select>';
  return html;
}

function selectionToCsv(items) {
  const f = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = ['ID,Priority,Status,Group,Assigned POD,Description,AI Notes'];
  for (const t of items) {
    const p = t.overrides?.priority || t.priority;
    const s = t.overrides?.status || t.status;
    const g = t.overrides?.group || t.group;
    const pod = t.overrides?.assignedPod || t.assignedPod;
    rows.push([t.id, p, s, g, pod, t.description, t.aiNotes].map(f).join(','));
  }
  return rows.join('\n');
}

function selectionToTsv(items) {
  const rows = ['ID\tPriority\tStatus\tGroup\tAssigned POD\tDescription\tAI Notes'];
  for (const t of items) {
    const p = t.overrides?.priority || t.priority;
    const s = t.overrides?.status || t.status;
    const g = t.overrides?.group || t.group;
    const pod = t.overrides?.assignedPod || t.assignedPod;
    rows.push([t.id, p, s, g, pod, t.description, t.aiNotes].join('\t'));
  }
  return rows.join('\n');
}

export function renderSelectionView($el, state) {
  const POD_OPTIONS = ['', ...[...new Set([...(state.pods || []), ...EXTRA_PODS])].sort()];
  const scores = state.scores || {};
  const items = getSelection();
  for (const t of items) t.score = scores[t.id] ?? t.score ?? 0;

  if (items.length === 0) {
    $el.innerHTML = `<div class="empty-state">
      <i data-lucide="clipboard-list" style="width:64px;height:64px;opacity:0.5;margin-bottom:16px"></i>
      <h2>No tasks selected</h2>
      <p>Select tasks from any list or AI result using the circle button on each row.</p>
    </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let html = '';

  // Toolbar
  html += '<div class="selection-toolbar">';
  html += `<span class="selection-count">${items.length} task${items.length !== 1 ? 's' : ''} selected</span>`;
  html += '<div class="selection-actions">';
  html += '<button type="button" class="btn btn-sm" id="sel-copy"><i data-lucide="clipboard-copy" style="width:12px;height:12px"></i> Copy for Sheets</button>';
  html += '<button type="button" class="btn btn-sm" id="sel-download"><i data-lucide="download" style="width:12px;height:12px"></i> Download CSV</button>';
  html += '<button type="button" class="btn btn-sm btn-danger" id="sel-clear"><i data-lucide="trash-2" style="width:12px;height:12px"></i> Clear All</button>';
  html += '</div></div>';

  // Editable table
  html += '<div id="sel-table-container">';
  html += '<table class="data-table selection-table"><thead><tr>';
  html += '<th class="col-sel"></th>';
  html += '<th class="sortable" data-sort="score">Score</th>';
  html += '<th>ID</th>';
  html += '<th class="sortable" data-sort="priority">Priority</th>';
  html += '<th class="sortable" data-sort="status">Status</th>';
  html += '<th class="sortable" data-sort="group">Group</th>';
  html += '<th class="sortable" data-sort="pod">Assigned POD</th>';
  html += '<th>Description</th>';
  html += '<th>AI Notes</th>';
  html += '<th class="sortable" data-sort="source">Source</th>';
  html += '</tr></thead><tbody>';

  for (const t of items) {
    const effPriority = t.overrides?.priority || t.priority;
    const effStatus = t.overrides?.status || t.status;
    const hasPriorityOverride = !!t.overrides?.priority;
    const hasStatusOverride = !!t.overrides?.status;

    html += `<tr data-id="${esc(t.id)}">`;
    html += `<td class="col-sel"><button class="sel-btn sel-remove" data-sel-id="${esc(t.id)}" title="Remove from selection"><i data-lucide="x-circle" style="width:14px;height:14px"></i></button></td>`;
    html += `<td class="col-score">${scoreBar(t.score || 0)}</td>`;
    html += `<td class="col-id">${esc(t.id)}</td>`;
    html += `<td>${selectionFieldSelect(t.id, 'priority', effPriority, t.priority, PRIORITY_OPTIONS)}${hasPriorityOverride ? '<span class="override-badge">edited</span>' : ''}</td>`;
    html += `<td>${selectionFieldSelect(t.id, 'status', effStatus, t.status, STATUS_OPTIONS)}${hasStatusOverride ? '<span class="override-badge">edited</span>' : ''}</td>`;
    const effPod = t.overrides?.assignedPod || t.assignedPod;
    const hasPodOverride = !!t.overrides?.assignedPod;
    html += `<td>${groupBadge(t.overrides?.group || t.group)}</td>`;
    html += `<td>${selectionFieldSelect(t.id, 'assignedPod', effPod, t.assignedPod, POD_OPTIONS)}${hasPodOverride ? '<span class="override-badge">edited</span>' : ''}</td>`;
    html += `<td class="col-desc">${esc(truncate(t.description, 200))}</td>`;
    html += `<td><input type="text" class="sel-notes-input" data-task="${esc(t.id)}" value="${esc(t.aiNotes || '')}" placeholder="Add notes..."></td>`;
    html += `<td><span class="source-badge">${esc(t.source || '--')}</span></td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';
  html += `<div class="table-footer">${items.length} tasks in selection</div>`;
  html += '</div>';

  $el.innerHTML = html;
  if (window.lucide) lucide.createIcons();

  const selNotesMap = {};
  for (const t of items) selNotesMap[t.id] = t.aiNotes || '';
  wireClickToExpand($el, selNotesMap);

  // Wire sorting
  const selSortState = { field: null, dir: 'asc' };
  function selSortItems(field) {
    if (selSortState.field === field) selSortState.dir = selSortState.dir === 'asc' ? 'desc' : 'asc';
    else { selSortState.field = field; selSortState.dir = 'asc'; }
    const d = selSortState.dir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      let va, vb;
      if (field === 'score') { return ((a.score || 0) - (b.score || 0)) * d; }
      if (field === 'priority') { va = PRIORITY_RANK[a.overrides?.priority || a.priority] ?? 3; vb = PRIORITY_RANK[b.overrides?.priority || b.priority] ?? 3; return (va - vb) * d; }
      if (field === 'status') { va = (a.overrides?.status || a.status || ''); vb = (b.overrides?.status || b.status || ''); return va.localeCompare(vb) * d; }
      if (field === 'group') { va = (a.overrides?.group || a.group || ''); vb = (b.overrides?.group || b.group || ''); return va.localeCompare(vb) * d; }
      if (field === 'pod') { va = (a.overrides?.assignedPod || a.assignedPod || ''); vb = (b.overrides?.assignedPod || b.assignedPod || ''); return va.localeCompare(vb) * d; }
      if (field === 'source') { va = a.source || ''; vb = b.source || ''; return va.localeCompare(vb) * d; }
      return 0;
    });
    renderSelectionView($el, state);
  }
  $el.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => selSortItems(th.dataset.sort));
  });

  // Wire remove buttons
  $el.querySelectorAll('.sel-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromSelection(btn.dataset.selId);
    });
  });

  // Wire override selects
  $el.querySelectorAll('.sel-override').forEach(sel => {
    sel.addEventListener('change', () => {
      updateSelectionOverride(sel.dataset.task, sel.dataset.field, sel.value);
    });
  });

  // Wire notes inputs (debounced)
  $el.querySelectorAll('.sel-notes-input').forEach(input => {
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => updateSelectionNotes(input.dataset.task, input.value), 400);
    });
  });

  // Wire export buttons
  document.getElementById('sel-copy')?.addEventListener('click', () => {
    const tsv = selectionToTsv(getSelection());
    navigator.clipboard.writeText(tsv).then(() => {
      const btn = document.getElementById('sel-copy');
      const orig = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px"></i> Copied!';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => { btn.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 2000);
    });
  });

  document.getElementById('sel-download')?.addEventListener('click', () => {
    downloadBlob(selectionToCsv(getSelection()), 'selection.csv', 'text/csv');
  });

  document.getElementById('sel-clear')?.addEventListener('click', () => {
    if (confirm('Remove all tasks from selection?')) clearSelection();
  });
}
