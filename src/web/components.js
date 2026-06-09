// ── Helpers ──────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function linkify(escaped) {
  return escaped.replace(/https?:\/\/[^\s<&"']+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

function csvJiraKeyCell(value) {
  const key = String(value || '').trim();
  if (!key) return '--';
  const href = `https://scopely.atlassian.net/browse/${encodeURIComponent(key)}`;
  return `<a class="jira-key" href="${href}" target="_blank" rel="noopener noreferrer">${esc(key)}</a>`;
}

function truncate(text, max) {
  if (!text) return '';
  const one = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : one.slice(0, max - 1) + '\u2026';
}

// ── Priority Badge ───────────────────────────────────────────
function priorityBadge(p) {
  const label = csvPriorityLabel(p);
  const normalized = csvPriorityKey(label);
  let level = 'none';
  if (normalized === 'critical') level = 'highest';
  else if (normalized === 'major') level = 'high';
  else if (normalized === 'minor') level = 'low';
  return `<span class="badge badge-priority jira-priority-badge jira-priority-${level}">${esc(label || '--')}</span>`;
}

function csvPriorityKey(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const aliases = {
    p0: 'critical',
    critical: 'critical',
    p0critical: 'critical',
    criticalp0: 'critical',
    p1: 'major',
    major: 'major',
    p1major: 'major',
    majorp1: 'major',
    p2: 'minor',
    minor: 'minor',
    p2minor: 'minor',
    minorp2: 'minor',
    p3: 'unprioritized',
    unprioritized: 'unprioritized',
    p3unprioritized: 'unprioritized',
    unprioritizedp3: 'unprioritized',
  };
  if (aliases[key]) return aliases[key];
  if (key.includes('critical') || key.startsWith('p0')) return 'critical';
  if (key.includes('major') || key.startsWith('p1')) return 'major';
  if (key.includes('minor') || key.startsWith('p2')) return 'minor';
  if (key.includes('unprioritized') || key.startsWith('p3')) return 'unprioritized';
  return key;
}

function csvPriorityLabel(value) {
  const labels = {
    critical: 'Critical',
    major: 'Major',
    minor: 'Minor',
    unprioritized: 'Unprioritized',
  };
  return labels[csvPriorityKey(value)] || String(value || '').trim();
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
  return `<select id="${id}"><option value="">All priorities</option><option value="Critical">Critical</option><option value="Major">Major</option><option value="Minor">Minor</option><option value="Unprioritized">Unprioritized</option></select>`;
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
      html += `<td>${priorityBadge(t.aiPriority === 'High' ? 'Critical' : t.aiPriority === 'Mid' ? 'Major' : 'Minor')}</td>`;
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
const PRIORITY_RANK = { critical: 0, major: 1, minor: 2, unprioritized: 3, '': 4, '--': 4 };
const AI_PRIORITY_RANK = { 'High': 0, 'Mid': 1, 'Low': 2, '': 3 };
const PREPRO_RANK = { '0 - Low': 0, '1 - Mid': 1, '2 - High': 2, '': 3 };

function sortTasks(tasks, field, dir, showAi) {
  const sorted = [...tasks];
  const d = dir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    let va, vb;
    if (field === 'score') { va = a.score; vb = b.score; return (va - vb) * d; }
    if (field === 'priority') { va = PRIORITY_RANK[csvPriorityKey(a.priority)] ?? 4; vb = PRIORITY_RANK[csvPriorityKey(b.priority)] ?? 4; return (va - vb) * d; }
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
      html += `<td>${priorityBadge(t.aiPriority === 'High' ? 'Critical' : t.aiPriority === 'Mid' ? 'Major' : 'Minor')}</td>`;
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

// ── CSV Dashboard View ──────────────────────────────────────
function csvData(state) {
  return state.csv?.data || { tasks: [], warnings: [], filtered: 0, totalRaw: 0 };
}

function csvTasks(state) {
  return Array.isArray(csvData(state).tasks) ? csvData(state).tasks : [];
}

function csvTaskSearchText(task) {
  return `${task.id || ''} ${task.jira || ''} ${task.description || ''}`.toLowerCase();
}

const CSV_STATUS_ORDER = ['Prioritized', 'TODO', 'HOLD', 'TRIAGE'];
const CSV_DASHBOARD_TABS = [
  { id: 'active', label: 'Prioritized/TODO' },
  { id: 'hold', label: 'HOLD' },
];
const CSV_NO_STATUS_LABEL = 'No status';

function csvDashboardVisibleTasks(tasks, dashboard) {
  const filters = dashboard.filters || {};
  const statuses = selectedValues(filters.status);
  const initiatives = selectedValues(filters.initiative);
  const search = (dashboard.search || '').trim().toLowerCase();
  const activeView = dashboard.activeView === 'hold' ? 'hold' : 'active';

  return tasks.filter(task => {
    if (activeView === 'hold' && task.status !== 'HOLD') return false;
    if (activeView !== 'hold' && task.status === 'HOLD') return false;
    if (statuses.length > 0 && !statuses.includes(task.status || '')) return false;
    if (initiatives.length > 0 && !initiatives.includes(task.initiative || '')) return false;
    if (search && !csvTaskSearchText(task).includes(search)) return false;
    return true;
  });
}

function csvBreakdown(tasks, field) {
  const counts = new Map();
  for (const task of tasks) {
    const value = task[field] || '(none)';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (field === 'status') {
        const ar = csvStatusRank(a.label);
        const br = csvStatusRank(b.label);
        if (ar !== br) return ar - br;
      }
      return b.count - a.count || a.label.localeCompare(b.label);
    });
}

function csvDashboardSummaryHtml(data, visibleTasks) {
  const statusData = csvBreakdown(visibleTasks, 'status');
  const initiativeData = csvBreakdown(visibleTasks, 'initiative');
  let html = '<div class="summary-row csv-summary-row">';
  html += `<div class="summary-card accent"><div class="summary-card-top"><i data-lucide="layers" class="summary-icon"></i></div><div class="summary-value">${data.tasks.length}</div><div class="summary-label">Loaded Tasks</div></div>`;
  html += `<div class="summary-card yellow"><div class="summary-card-top"><i data-lucide="triangle-alert" class="summary-icon"></i></div><div class="summary-value">${data.warnings.length}</div><div class="summary-label">Warnings</div></div>`;
  html += `<div class="card csv-breakdown-card"><div class="card-title"><i data-lucide="activity" style="width:14px;height:14px;vertical-align:-2px"></i> Status</div>${barChart(statusData, '#3fb950')}</div>`;
  html += `<div class="card csv-breakdown-card"><div class="card-title"><i data-lucide="folder" style="width:14px;height:14px;vertical-align:-2px"></i> Initiative</div>${barChart(initiativeData, '#bc8cff')}</div>`;
  html += '</div>';
  return html;
}

function csvDashboardWarningsHtml(warnings) {
  if (!warnings.length) return '';
  let html = '<div class="warnings"><div class="warnings-title"><i data-lucide="triangle-alert" style="width:14px;height:14px;vertical-align:-2px"></i> CSV Warnings</div><ul class="warnings-list">';
  for (const warning of warnings) html += `<li>${esc(warning)}</li>`;
  html += '</ul></div>';
  return html;
}

function csvDashboardTabsHtml(activeView) {
  const active = activeView === 'hold' ? 'hold' : 'active';
  let html = '<div class="jira-dashboard-tabs csv-dashboard-tabs">';
  for (const tab of CSV_DASHBOARD_TABS) {
    html += `<button type="button" class="jira-dashboard-tab csv-dashboard-tab${active === tab.id ? ' active' : ''}" data-csv-dashboard-tab="${esc(tab.id)}">${esc(tab.label)}</button>`;
  }
  html += '</div>';
  return html;
}

function csvMultiFilterSelectHtml(id, label, options, values) {
  const selected = selectedValues(values);
  const summary = multiFilterLabel(label, options, selected, false);
  let html = `<div class="ai-form-field jira-filter-field jira-multi-field csv-multi-field"><label>${esc(label)}</label><div class="jira-multi-dropdown csv-multi-dropdown" data-csv-multi-dropdown="${esc(id)}">`;
  html += `<button type="button" class="jira-multi-toggle csv-multi-toggle" data-csv-multi-toggle="${esc(id)}" aria-expanded="false"><span>${esc(summary)}</span><i data-lucide="chevron-down" style="width:14px;height:14px"></i></button>`;
  html += `<div class="jira-multi-menu csv-multi-menu" data-csv-multi-menu="${esc(id)}" hidden>`;
  for (const option of options) html += `<label class="jira-multi-option csv-multi-option"><input type="checkbox" data-csv-multi-input="${esc(id)}" value="${esc(option)}"${selected.includes(option) ? ' checked' : ''}><span>${esc(option)}</span></label>`;
  if (options.length === 0) html += '<div class="jira-multi-empty">No options</div>';
  html += '</div></div></div>';
  return html;
}

function csvDashboardControlsHtml(tasks, dashboard) {
  const filters = dashboard.filters || {};
  const statuses = uniqueSorted(tasks.map(task => task.status || ''), compareCsvStatusValues);
  const initiatives = uniqueSorted(tasks.map(task => task.initiative || ''));
  let html = '<div class="table-controls jira-dashboard-controls csv-dashboard-controls">';
  html += csvMultiFilterSelectHtml('csv-dashboard-status-filter', 'Status', statuses, filters.status || []);
  html += csvMultiFilterSelectHtml('csv-dashboard-initiative-filter', 'Initiative', initiatives, filters.initiative || []);
  html += '<div class="jira-version-bulk-actions csv-status-bulk-actions"><button type="button" class="btn" data-csv-status-bulk="open"><i data-lucide="chevrons-down" style="width:14px;height:14px"></i> Open all</button><button type="button" class="btn" data-csv-status-bulk="collapse"><i data-lucide="chevrons-up" style="width:14px;height:14px"></i> Collapse all</button></div>';
  html += `<div class="ai-form-field jira-search-field"><label>Search</label><input type="text" id="csv-dashboard-search" value="${esc(dashboard.search || '')}"></div>`;
  html += '<button type="button" class="btn clear-filters-btn" data-csv-dashboard-clear-filters><i data-lucide="filter-x" style="width:14px;height:14px"></i> Clear filters</button>';
  html += '</div>';
  return html;
}

function csvStatusRank(status) {
  const idx = CSV_STATUS_ORDER.indexOf(status);
  return idx === -1 ? CSV_STATUS_ORDER.length : idx;
}

function compareCsvStatusValues(a, b) {
  const ar = csvStatusRank(a);
  const br = csvStatusRank(b);
  if (ar !== br) return ar - br;
  return a.localeCompare(b);
}

function csvStatusLabel(task) {
  return task.status || CSV_NO_STATUS_LABEL;
}

function csvGroupedByStatus(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const label = csvStatusLabel(task);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(task);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const ar = csvStatusRank(a === CSV_NO_STATUS_LABEL ? '' : a);
    const br = csvStatusRank(b === CSV_NO_STATUS_LABEL ? '' : b);
    if (ar !== br) return ar - br;
    if (a === CSV_NO_STATUS_LABEL) return 1;
    if (b === CSV_NO_STATUS_LABEL) return -1;
    return a.localeCompare(b);
  });
}

function csvDashboardRowsHtml(tasks) {
  if (!tasks.length) return '<tr><td colspan="6" class="jira-empty-cell">No CSV tasks found.</td></tr>';
  return tasks.map(task => `<tr>
    <td class="col-id">${esc(task.id || '--')}</td>
    <td class="col-id">${csvJiraKeyCell(task.jira)}</td>
    <td class="col-desc">${linkify(esc(task.description || '--'))}</td>
    <td>${priorityBadge(task.priority)}</td>
    <td>${csvInitiativeHtml(task.initiative)}</td>
    <td class="col-pod">${esc(task.priorityPod || '--')}</td>
  </tr>`).join('');
}

function csvDashboardTableHtml(tasks) {
  const rows = csvDashboardSortedRows(tasks);
  return `<table class="data-table csv-dashboard-table"><thead><tr>
    <th>ID</th>
    <th>JIRA</th>
    <th>Description/Problem</th>
    <th>Priority</th>
    <th>Initiative</th>
    <th>Priority pod</th>
  </tr></thead><tbody>${csvDashboardRowsHtml(rows)}</tbody></table>`;
}

function csvStatusGroupHtml(status, rows, dashboard) {
  const expanded = dashboard.expandedStatuses?.[status] !== false;
  let html = `<div class="jira-group csv-status-group"><button type="button" class="jira-group-toggle" data-csv-status-toggle="${esc(status)}" aria-expanded="${expanded}">
    <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" style="width:14px;height:14px"></i>
    <span class="csv-status-group-title">${esc(status)}</span>
    <span>${rows.length}</span>
  </button>`;
  if (expanded) html += csvDashboardTableHtml(rows);
  html += '</div>';
  return html;
}

function csvStatusGroupsHtml(visibleTasks, dashboard) {
  const groups = csvGroupedByStatus(visibleTasks);
  let html = '<section class="jira-section-card csv-status-groups">';
  if (groups.length === 0) {
    html += jiraInlineEmptyHtml('No CSV tasks found.');
  } else {
    for (const [status, rows] of groups) {
      html += csvStatusGroupHtml(status, rows, dashboard);
    }
  }
  html += '</section>';
  return html;
}

function checkedCsvMultiValues($el, id) {
  return [...$el.querySelectorAll(`[data-csv-multi-input="${id}"]:checked`)].map(input => input.value);
}

function openCsvMultiMenus($el, openId) {
  $el.querySelectorAll('[data-csv-multi-menu]').forEach(menu => {
    const id = menu.dataset.csvMultiMenu;
    const isOpen = id === openId;
    menu.hidden = !isOpen;
    $el.querySelector(`[data-csv-multi-toggle="${id}"]`)?.setAttribute('aria-expanded', String(isOpen));
  });
}

export function renderCsvDashboardView($el, state, actions = {}) {
  const data = csvData(state);
  const tasks = csvTasks(state);
  const dashboard = state.csv?.dashboard || {};
  const visibleTasks = csvDashboardVisibleTasks(tasks, dashboard);

  let html = '<div class="jira-shell csv-shell">';
  html += csvDashboardSummaryHtml(data, visibleTasks);
  html += csvDashboardWarningsHtml(data.warnings || []);
  html += csvDashboardTabsHtml(dashboard.activeView);
  html += csvDashboardControlsHtml(tasks, dashboard);
  html += csvStatusGroupsHtml(visibleTasks, dashboard);
  html += `<div class="table-footer">Showing ${visibleTasks.length} of ${tasks.length} CSV tasks</div>`;
  html += '</div>';
  $el.innerHTML = html;
  openCsvMultiMenus($el, state.csv?.openMultiDropdown || null);

  $el.querySelectorAll('[data-csv-multi-dropdown]').forEach(dropdown => {
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  });
  $el.querySelectorAll('[data-csv-multi-toggle]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.onMultiDropdownToggle?.(button.dataset.csvMultiToggle);
    });
  });
  $el.querySelectorAll('[data-csv-multi-input]').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.csvMultiInput;
      const values = checkedCsvMultiValues($el, id);
      if (id === 'csv-dashboard-status-filter') actions.onFilterChange?.('status', values);
      if (id === 'csv-dashboard-initiative-filter') actions.onFilterChange?.('initiative', values);
    });
  });
  $el.querySelectorAll('[data-csv-dashboard-tab]').forEach(button => {
    button.addEventListener('click', () => actions.onDashboardTabChange?.(button.dataset.csvDashboardTab));
  });
  $el.querySelectorAll('[data-csv-status-toggle]').forEach(button => {
    button.addEventListener('click', () => actions.onStatusGroupToggle?.(button.dataset.csvStatusToggle));
  });
  $el.querySelectorAll('[data-csv-status-bulk]').forEach(button => {
    button.addEventListener('click', () => {
      const statuses = [...$el.querySelectorAll('[data-csv-status-toggle]')]
        .map(toggle => toggle.dataset.csvStatusToggle)
        .filter(Boolean);
      actions.onStatusGroupsSet?.(statuses, button.dataset.csvStatusBulk === 'open');
    });
  });
  $el.querySelector('[data-csv-dashboard-clear-filters]')?.addEventListener('click', () => actions.onClearFilters?.());
  if (state.csv?.openMultiDropdown) {
    setTimeout(() => {
      document.addEventListener('click', () => actions.onMultiDropdownClose?.(), { once: true });
    }, 0);
  }
  document.getElementById('csv-dashboard-search')?.addEventListener('input', (e) => actions.onSearchChange?.(e.target.value));
  if (window.lucide) lucide.createIcons();
}

// ── CSV All Data View ───────────────────────────────────────
const CSV_ALL_DATA_COLUMNS = [
  { label: 'ID', field: 'id' },
  { label: 'JIRA', field: 'jira' },
  { label: 'Description/Problem', field: 'description' },
  { label: 'Comments', field: 'comments' },
  { label: 'Priority', field: 'priority' },
  { label: 'Status', field: 'status' },
  { label: 'Initiative', field: 'initiative' },
  { label: 'Priority pod', field: 'priorityPod' },
];

const CSV_ALL_DATA_GROUP_BY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'initiative', label: 'Initiative' },
  { value: 'priorityPod', label: 'Priority pod' },
  { value: 'reporter', label: 'Reporter' },
];

const CSV_NO_GROUP_LABELS = {
  status: 'No status',
  priority: 'No priority',
  initiative: 'No initiative',
  priorityPod: 'No priority pod',
  reporter: 'No reporter',
};

const CSV_PRIORITY_RANK = {
  critical: 0,
  major: 1,
  minor: 2,
  unprioritized: 3,
  '': 4,
};

function csvPriorityRank(value) {
  return CSV_PRIORITY_RANK[csvPriorityKey(value)] ?? 4;
}

function csvSortHeader(label, field, sort) {
  const cls = sort?.field === field ? `sortable sort-${sort.dir}` : 'sortable';
  return `<th class="${cls}" data-csv-sort="${esc(field)}">${esc(label)}</th>`;
}

function csvColumnClass(field) {
  return String(field).replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function csvAllDataColGroupHtml(editMode) {
  const selectCol = editMode ? '<col class="csv-col-select">' : '';
  return `<colgroup>${selectCol}${CSV_ALL_DATA_COLUMNS.map(column => `<col class="csv-col-${csvColumnClass(column.field)}">`).join('')}</colgroup>`;
}

function csvAllDataValue(task, field) {
  return task[field] || '';
}

function compareCsvTasks(a, b, field) {
  if (field === 'priority') {
    const ar = csvPriorityRank(a.priority);
    const br = csvPriorityRank(b.priority);
    if (ar !== br) return ar - br;
    return (a.priority || '').localeCompare(b.priority || '');
  }
  return String(csvAllDataValue(a, field)).localeCompare(String(csvAllDataValue(b, field)));
}

function csvDashboardSortedRows(tasks) {
  return [...tasks].sort((a, b) => {
    const priority = compareCsvTasks(a, b, 'priority');
    if (priority !== 0) return priority;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function sortedCsvAllDataTasks(tasks, allData) {
  const sort = allData.sort || { field: 'id', dir: 'asc' };
  const direction = sort.dir === 'desc' ? -1 : 1;
  return [...tasks].sort((a, b) => compareCsvTasks(a, b, sort.field) * direction);
}

function csvTaskMatchesAllDataFilters(task, filters) {
  const statuses = selectedValues(filters.status);
  const priorities = selectedValues(filters.priority);
  const initiatives = selectedValues(filters.initiative);
  const priorityPods = selectedValues(filters.priorityPod);
  const reporters = selectedValues(filters.reporter);

  if (statuses.length > 0 && !statuses.includes(task.status || '')) return false;
  if (priorities.length > 0 && !priorities.includes(task.priority || '')) return false;
  if (initiatives.length > 0 && !initiatives.includes(task.initiative || '')) return false;
  if (priorityPods.length > 0 && !priorityPods.includes(task.priorityPod || '')) return false;
  if (reporters.length > 0 && !reporters.includes(task.reporter || '')) return false;

  const search = (filters.search || '').trim().toLowerCase();
  if (search && !csvTaskSearchText(task).includes(search)) return false;
  return true;
}

function filteredSortedCsvAllDataTasks(tasks, allData) {
  const filters = allData.filters || {};
  return sortedCsvAllDataTasks(tasks.filter(task => csvTaskMatchesAllDataFilters(task, filters)), allData);
}

function csvCommentCell(value) {
  const comment = String(value || '').trim();
  if (!comment) return '<span class="csv-comment-empty">--</span>';
  return `<span class="csv-comment-icon" title="${esc(comment)}" data-comment="${esc(comment)}" tabindex="0" aria-label="Comment: ${esc(comment)}"><i data-lucide="message-square-text" style="width:15px;height:15px"></i></span>`;
}

function csvAllDataRowsHtml(tasks, context = {}) {
  const editMode = Boolean(context.editMode);
  const selected = new Set(context.selectedIds || []);
  const colspan = CSV_ALL_DATA_COLUMNS.length + (editMode ? 1 : 0);
  if (!tasks.length) return `<tr><td colspan="${colspan}" class="jira-empty-cell">No CSV tasks found.</td></tr>`;
  return tasks.map(task => {
    const taskId = task.id || '';
    const checked = selected.has(taskId);
    const rowClass = checked ? ' class="row-selected csv-list-row-selected"' : '';
    const rowSelect = editMode ? ` data-csv-select-row="${esc(taskId)}"` : '';
    const selectCell = editMode ? `<td class="col-select"><input type="checkbox" class="csv-row-selector" data-csv-row-check="${esc(taskId)}"${checked ? ' checked' : ''} aria-label="Select ${esc(taskId || 'task')}"></td>` : '';
    return `<tr data-csv-task-id="${esc(taskId)}"${rowSelect}${rowClass}>
    ${selectCell}
    <td class="col-id">${esc(task.id || '--')}</td>
    <td class="col-id">${csvJiraKeyCell(task.jira)}</td>
    <td class="col-desc">${linkify(esc(task.description || '--'))}</td>
    <td class="col-comments">${csvCommentCell(task.comments)}</td>
    <td>${priorityBadge(task.priority)}</td>
    <td>${statusBadge(task.status)}</td>
    <td>${csvInitiativeHtml(task.initiative)}</td>
    <td class="col-pod">${esc(task.priorityPod || '--')}</td>
  </tr>`;
  }).join('');
}

function csvAllDataTableHtml(tasks, allData, context = {}) {
  const sort = allData.sort || { field: 'id', dir: 'asc' };
  let html = `<table class="data-table csv-all-data-table">${csvAllDataColGroupHtml(context.editMode)}<thead><tr>`;
  if (context.editMode) html += '<th class="col-select"></th>';
  for (const column of CSV_ALL_DATA_COLUMNS) {
    html += csvSortHeader(column.label, column.field, sort);
  }
  html += `</tr></thead><tbody>${csvAllDataRowsHtml(tasks, context)}</tbody></table>`;
  return html;
}

function currentCsvAllDataGroupBy(allData) {
  const groupBy = allData.filters?.groupBy || 'none';
  return CSV_ALL_DATA_GROUP_BY_OPTIONS.some(option => option.value === groupBy) ? groupBy : 'none';
}

function csvAllDataFilterControlsHtml(baseTasks, allData) {
  const filters = allData.filters || {};
  const statuses = uniqueSorted(baseTasks.map(task => task.status || ''), compareCsvStatusValues);
  const priorities = uniqueSorted(baseTasks.map(task => task.priority || ''));
  const initiatives = uniqueSorted(baseTasks.map(task => task.initiative || ''));
  const priorityPods = uniqueSorted(baseTasks.map(task => task.priorityPod || ''));
  const reporters = uniqueSorted(baseTasks.map(task => task.reporter || ''));

  let html = '<div class="table-controls jira-filter-controls csv-filter-controls">';
  html += csvMultiFilterSelectHtml('csv-filter-status', 'Status', statuses, filters.status || []);
  html += csvMultiFilterSelectHtml('csv-filter-priority', 'Priority', priorities, filters.priority || []);
  html += csvMultiFilterSelectHtml('csv-filter-initiative', 'Initiative', initiatives, filters.initiative || []);
  html += csvMultiFilterSelectHtml('csv-filter-priority-pod', 'Priority pod', priorityPods, filters.priorityPod || []);
  html += csvMultiFilterSelectHtml('csv-filter-reporter', 'Reporter', reporters, filters.reporter || []);
  html += csvGroupBySelectHtml(currentCsvAllDataGroupBy(allData));
  html += `<div class="ai-form-field jira-search-field"><label>Search</label><input type="text" id="csv-filter-search" value="${esc(filters.search || '')}"></div>`;
  html += '<button type="button" class="btn clear-filters-btn" data-csv-clear-filters><i data-lucide="filter-x" style="width:14px;height:14px"></i> Clear filters</button>';
  html += '</div>';
  return html;
}

function csvGroupBySelectHtml(value) {
  let html = '<div class="ai-form-field jira-group-by-field"><label>Group by</label><select id="csv-group-by">';
  for (const option of CSV_ALL_DATA_GROUP_BY_OPTIONS) {
    html += `<option value="${esc(option.value)}"${option.value === value ? ' selected' : ''}>${esc(option.label)}</option>`;
  }
  html += '</select></div>';
  return html;
}

function csvGroupLabelForTask(task, groupBy) {
  return task[groupBy] || CSV_NO_GROUP_LABELS[groupBy] || 'No value';
}

function compareCsvGroupLabels(a, b, groupBy) {
  if (groupBy === 'status') {
    const ar = csvStatusRank(a === CSV_NO_GROUP_LABELS.status ? '' : a);
    const br = csvStatusRank(b === CSV_NO_GROUP_LABELS.status ? '' : b);
    if (ar !== br) return ar - br;
  }
  if (groupBy === 'priority') {
    const ar = csvPriorityRank(a === CSV_NO_GROUP_LABELS.priority ? '' : a);
    const br = csvPriorityRank(b === CSV_NO_GROUP_LABELS.priority ? '' : b);
    if (ar !== br) return ar - br;
  }
  if (a.startsWith('No ') && !b.startsWith('No ')) return 1;
  if (!a.startsWith('No ') && b.startsWith('No ')) return -1;
  return a.localeCompare(b);
}

function groupCsvAllDataTasks(tasks, groupBy) {
  const groups = new Map();
  for (const task of tasks) {
    const label = csvGroupLabelForTask(task, groupBy);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(task);
  }
  return [...groups.entries()].sort(([a], [b]) => compareCsvGroupLabels(a, b, groupBy));
}

function csvAllDataTablesHtml(tasks, allData, context = {}) {
  const groupBy = currentCsvAllDataGroupBy(allData);
  if (groupBy === 'none') return csvAllDataTableHtml(tasks, allData, context);

  const groups = groupCsvAllDataTasks(tasks, groupBy);
  if (groups.length === 0) return csvAllDataTableHtml(tasks, allData, context);

  let html = '<div class="csv-all-data-groups">';
  for (const [label, rows] of groups) {
    html += `<div class="jira-group"><div class="jira-group-title">${esc(label)} <span>${rows.length}</span></div>${csvAllDataTableHtml(rows, allData, context)}</div>`;
  }
  html += '</div>';
  return html;
}

function csvListManagementHtml(options = {}) {
  if (options.scope !== 'list' || !options.list) return '';
  const list = options.list;
  const storedCount = Array.isArray(list.taskIds) ? list.taskIds.length : 0;
  return `<div class="csv-list-management">
    <div class="csv-list-management-title">
      <span>${esc(list.name)}</span>
      <small>${storedCount} stored IDs</small>
    </div>
    <div class="csv-list-management-actions">
      <button type="button" class="btn" data-csv-list-rename="${esc(list.id)}"><i data-lucide="pencil" style="width:14px;height:14px"></i> Rename</button>
      <button type="button" class="btn" data-csv-list-export="${esc(list.id)}"><i data-lucide="download" style="width:14px;height:14px"></i> Export IDs</button>
      <button type="button" class="btn" data-csv-list-import><i data-lucide="upload" style="width:14px;height:14px"></i> Import list</button>
      <button type="button" class="btn btn-danger" data-csv-list-delete="${esc(list.id)}"><i data-lucide="trash-2" style="width:14px;height:14px"></i> Delete</button>
    </div>
  </div>`;
}

function csvListEditControlsHtml(state, visibleTasks, options = {}) {
  const edit = state.csv?.listEdit || {};
  const active = Boolean(edit.active);
  const selectedIds = selectedValues(edit.selectedIds);
  const lists = Array.isArray(state.csv?.lists) ? state.csv.lists : [];
  const visibleIds = visibleTasks.map(task => task.id).filter(Boolean);
  const selectedCount = selectedIds.length;
  const currentList = options.scope === 'list' ? options.list : null;

  let html = '<div class="csv-list-edit-toolbar">';
  html += `<button type="button" class="btn${active ? ' btn-primary' : ''}" data-csv-list-edit-toggle="${active ? 'off' : 'on'}"><i data-lucide="${active ? 'check-square' : 'list-plus'}" style="width:14px;height:14px"></i> ${active ? 'Done selecting' : 'Edit lists'}</button>`;
  html += '<button type="button" class="btn" data-csv-list-import><i data-lucide="upload" style="width:14px;height:14px"></i> Import list</button>';
  if (active) html += `<span class="csv-list-selected-count">${selectedCount} selected</span>`;
  html += '</div>';

  if (!active) return html;

  html += '<div class="csv-list-edit-panel">';
  html += '<div class="csv-list-edit-actions">';
  html += `<button type="button" class="btn" data-csv-list-select-visible="${esc(JSON.stringify(visibleIds))}"${visibleIds.length === 0 ? ' disabled' : ''}><i data-lucide="check-square" style="width:14px;height:14px"></i> Select visible</button>`;
  html += `<button type="button" class="btn" data-csv-list-deselect-visible="${esc(JSON.stringify(visibleIds))}"${visibleIds.length === 0 ? ' disabled' : ''}>Deselect visible</button>`;
  html += `<button type="button" class="btn" data-csv-list-clear-selection${selectedCount === 0 ? ' disabled' : ''}>Clear</button>`;
  if (currentList) {
    html += `<button type="button" class="btn btn-danger" data-csv-list-remove-selected="${esc(currentList.id)}"${selectedCount === 0 ? ' disabled' : ''}><i data-lucide="minus-circle" style="width:14px;height:14px"></i> Remove from list</button>`;
  }
  html += '</div>';

  html += '<div class="csv-list-edit-actions">';
  html += '<div class="ai-form-field csv-list-field"><label>Existing list</label><select id="csv-list-target">';
  html += '<option value="">Select list</option>';
  for (const list of lists) html += `<option value="${esc(list.id)}"${edit.targetListId === list.id ? ' selected' : ''}>${esc(list.name)}</option>`;
  html += '</select></div>';
  html += `<button type="button" class="btn" data-csv-list-append${!edit.targetListId || selectedCount === 0 ? ' disabled' : ''}><i data-lucide="plus" style="width:14px;height:14px"></i> Add selected</button>`;
  html += '<div class="ai-form-field csv-list-field"><label>New list</label>';
  html += `<input type="text" id="csv-list-new-name" value="${esc(edit.newListName || '')}" placeholder="List name"></div>`;
  html += `<button type="button" class="btn btn-primary" data-csv-list-create${!String(edit.newListName || '').trim() || selectedCount === 0 ? ' disabled' : ''}><i data-lucide="list-plus" style="width:14px;height:14px"></i> Create list</button>`;
  html += '</div>';
  html += '</div>';
  return html;
}

function parseIdsDataset(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function renderCsvAllDataView($el, state, actions = {}, options = {}) {
  const tasks = Array.isArray(options.tasks) ? options.tasks : csvTasks(state);
  const allData = state.csv?.allData || {};
  const visibleTasks = filteredSortedCsvAllDataTasks(tasks, allData);
  const editMode = Boolean(state.csv?.listEdit?.active);
  const tableContext = {
    editMode,
    selectedIds: state.csv?.listEdit?.selectedIds || [],
  };

  let html = '<div class="jira-shell csv-shell">';
  html += csvListManagementHtml(options);
  html += csvListEditControlsHtml(state, visibleTasks, options);
  html += csvAllDataFilterControlsHtml(tasks, allData);
  html += csvAllDataTablesHtml(visibleTasks, allData, tableContext);
  html += `<div class="table-footer">Showing ${visibleTasks.length} of ${tasks.length} CSV tasks</div>`;
  html += '</div>';
  $el.innerHTML = html;
  openCsvMultiMenus($el, state.csv?.openMultiDropdown || null);

  $el.querySelectorAll('[data-csv-multi-dropdown]').forEach(dropdown => {
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  });
  $el.querySelectorAll('[data-csv-multi-toggle]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.onMultiDropdownToggle?.(button.dataset.csvMultiToggle);
    });
  });
  $el.querySelectorAll('[data-csv-multi-input]').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.csvMultiInput;
      const values = checkedCsvMultiValues($el, id);
      if (id === 'csv-filter-status') actions.onFilterChange?.('status', values);
      if (id === 'csv-filter-priority') actions.onFilterChange?.('priority', values);
      if (id === 'csv-filter-initiative') actions.onFilterChange?.('initiative', values);
      if (id === 'csv-filter-priority-pod') actions.onFilterChange?.('priorityPod', values);
      if (id === 'csv-filter-reporter') actions.onFilterChange?.('reporter', values);
    });
  });
  if (state.csv?.openMultiDropdown) {
    setTimeout(() => {
      document.addEventListener('click', () => actions.onMultiDropdownClose?.(), { once: true });
    }, 0);
  }
  document.getElementById('csv-filter-search')?.addEventListener('input', (e) => actions.onFilterChange?.('search', e.target.value));
  document.getElementById('csv-group-by')?.addEventListener('change', (e) => actions.onFilterChange?.('groupBy', e.target.value));
  $el.querySelector('[data-csv-clear-filters]')?.addEventListener('click', () => actions.onClearFilters?.());
  document.getElementById('csv-list-target')?.addEventListener('change', (e) => actions.onListTargetChange?.(e.target.value));
  document.getElementById('csv-list-new-name')?.addEventListener('input', (e) => actions.onListNameChange?.(e.target.value));
  $el.querySelectorAll('[data-csv-sort]').forEach(header => {
    header.addEventListener('click', () => actions.onSortChange?.(header.dataset.csvSort));
  });
  $el.querySelectorAll('[data-csv-list-edit-toggle]').forEach(button => {
    button.addEventListener('click', () => actions.onListEditToggle?.(button.dataset.csvListEditToggle === 'on'));
  });
  $el.querySelectorAll('[data-csv-row-check]').forEach(input => {
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', () => actions.onListSelectionToggle?.(input.dataset.csvRowCheck));
  });
  $el.querySelectorAll('[data-csv-select-row]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, select, textarea, label')) return;
      actions.onListSelectionToggle?.(row.dataset.csvSelectRow);
    });
  });
  $el.querySelectorAll('[data-csv-list-select-visible]').forEach(button => {
    button.addEventListener('click', () => actions.onListSelectVisible?.(parseIdsDataset(button.dataset.csvListSelectVisible), true));
  });
  $el.querySelectorAll('[data-csv-list-deselect-visible]').forEach(button => {
    button.addEventListener('click', () => actions.onListSelectVisible?.(parseIdsDataset(button.dataset.csvListDeselectVisible), false));
  });
  $el.querySelector('[data-csv-list-clear-selection]')?.addEventListener('click', () => actions.onListSelectionClear?.());
  $el.querySelector('[data-csv-list-append]')?.addEventListener('click', () => actions.onListAppend?.(state.csv?.listEdit?.targetListId || ''));
  $el.querySelector('[data-csv-list-create]')?.addEventListener('click', () => actions.onListCreate?.());
  $el.querySelectorAll('[data-csv-list-remove-selected]').forEach(button => {
    button.addEventListener('click', () => actions.onListRemoveSelected?.(button.dataset.csvListRemoveSelected));
  });
  $el.querySelectorAll('[data-csv-list-rename]').forEach(button => {
    button.addEventListener('click', () => actions.onListRename?.(button.dataset.csvListRename));
  });
  $el.querySelectorAll('[data-csv-list-delete]').forEach(button => {
    button.addEventListener('click', () => actions.onListDelete?.(button.dataset.csvListDelete));
  });
  $el.querySelectorAll('[data-csv-list-export]').forEach(button => {
    button.addEventListener('click', () => actions.onListExport?.(button.dataset.csvListExport));
  });
  $el.querySelectorAll('[data-csv-list-import]').forEach(button => {
    button.addEventListener('click', () => actions.onListImport?.());
  });

  if (window.lucide) lucide.createIcons();
}

// ── Jira View ───────────────────────────────────────────────
const JIRA_DASHBOARD_TABS = [
  { id: 'versions', label: 'Versions' },
  { id: 'not-started', label: 'Not started' },
];

const EMPTY_VALUE = '__empty__';
const NO_FIX_VERSION_LABEL = 'No fix version';
const NO_STATUS_LABEL = 'No status';
const NO_PRIORITY_LABEL = 'No priority';
const NO_POD_LABEL = 'No pod';
const NO_LABEL_LABEL = 'No label';
const JIRA_LABELS = [
  { label: 'BetterCasual', color: 'var(--accent)' },
  { label: 'BetterSocial', color: 'var(--green)' },
  { label: 'Other', color: 'var(--text-muted)' },
  { label: 'ReturnExperience', color: 'var(--purple)' },
  { label: 'TimeToRoll', color: 'var(--orange)' },
  { label: 'UXFoundations', color: 'var(--cyan)' },
];
const JIRA_VISIBLE_LABELS = JIRA_LABELS.map(item => item.label);
const JIRA_NO_LABEL_COLOR = 'var(--text-dim)';
const JIRA_ALL_DATA_GROUP_BY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'fixVersion', label: 'Fix version' },
  { value: 'pod', label: 'Pod' },
  { value: 'labels', label: 'Label' },
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

function csvInitiativeHtml(value) {
  if (!value) return '<span class="jira-labels-empty">--</span>';
  return `<div class="jira-labels csv-initiative-labels"><span class="jira-label csv-initiative-label">${esc(value)}</span></div>`;
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

function jiraVisibleLabels(labels) {
  if (!Array.isArray(labels)) return [];
  const normalized = new Set(labels.map(label => String(label || '').trim().toLowerCase()).filter(Boolean));
  return JIRA_VISIBLE_LABELS.filter(label => normalized.has(label.toLowerCase()));
}

function jiraPrimaryLabel(issue) {
  const labels = jiraVisibleLabels(issue.labels);
  return labels[0] || NO_LABEL_LABEL;
}

function jiraLabelColor(label) {
  return JIRA_LABELS.find(item => item.label === label)?.color || JIRA_NO_LABEL_COLOR;
}

function jiraLabelStyle(label) {
  return `--jira-label-color:${jiraLabelColor(label)}`;
}

function jiraLabelsHtml(labels) {
  const values = jiraVisibleLabels(labels);
  if (values.length === 0) return '<span class="jira-labels-empty">--</span>';
  return `<div class="jira-labels">${values.map(label => `<span class="jira-label">${esc(label)}</span>`).join('')}</div>`;
}

function jiraIssueRows(issues) {
  if (!issues.length) {
    return '<tr><td colspan="8" class="jira-empty-cell">No issues found.</td></tr>';
  }

  return issues.map(issue => `<tr data-jira-key="${esc(issue.key || '')}">
    <td>${jiraKeyCell(issue)}</td>
    <td class="col-desc">${esc(issue.summary || '--')}</td>
    <td class="col-labels">${jiraLabelsHtml(issue.labels)}</td>
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
  html += opts.sortable ? sortHeader('Labels', 'labels', sort) : '<th>Labels</th>';
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

function uniqueSorted(values, compare = (a, b) => a.localeCompare(b)) {
  return [...new Set(values.filter(Boolean))].sort(compare);
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
  const selectedLabels = selectedValues(filters.label);

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

  const labels = jiraVisibleLabels(issue.labels);
  if (selectedLabels.length > 0 && !labels.some(label => selectedLabels.includes(label))) return false;

  const search = (filters.search || '').trim().toLowerCase();
  if (search) {
    const haystack = `${issue.key || ''} ${issue.summary || ''} ${labels.join(' ')}`.toLowerCase();
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
  if (field === 'labels') {
    const av = jiraVisibleLabels(a.labels).join(', ');
    const bv = jiraVisibleLabels(b.labels).join(', ');
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
  const labels = new Set(issues.flatMap(issue => jiraVisibleLabels(issue.labels)));
  const hasEmptyFixVersion = issues.some(issue => jiraFixVersions(issue).length === 0);
  const hasEmptyPod = issues.some(issue => !issue.pod);

  return {
    ...filters,
    status: selectedValues(filters.status).filter(value => statuses.has(value)),
    priority: selectedValues(filters.priority).filter(value => priorities.has(value)),
    fixVersion: selectedValues(filters.fixVersion).filter(value => fixVersions.has(value) || (value === EMPTY_VALUE && hasEmptyFixVersion)),
    pod: selectedValues(filters.pod).filter(value => pods.has(value) || (value === EMPTY_VALUE && hasEmptyPod)),
    label: selectedValues(filters.label).filter(value => labels.has(value)),
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
  if (groupBy === 'labels') {
    const labels = jiraVisibleLabels(issue.labels);
    return labels.length > 0 ? labels : [NO_LABEL_LABEL];
  }
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

function jiraSettingsRequiredHtml() {
  return `<div class="empty-state jira-empty jira-settings-required">
    <i data-lucide="settings" style="width:64px;height:64px;opacity:0.5;margin-bottom:16px"></i>
    <h2>Configure Jira settings</h2>
    <p>Set the Jira base URL, email, and API token before loading Jira data.</p>
    <button type="button" class="btn btn-primary" data-open-jira-settings><i data-lucide="settings" style="width:14px;height:14px"></i> Configure settings</button>
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
  html += '<button type="button" class="btn clear-filters-btn" data-jira-dashboard-clear-filters><i data-lucide="filter-x" style="width:14px;height:14px"></i> Clear filters</button>';
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

function jiraLabelBuckets(issues) {
  const buckets = new Map([...JIRA_VISIBLE_LABELS, NO_LABEL_LABEL].map(label => [label, []]));
  for (const issue of issues) {
    const label = jiraPrimaryLabel(issue);
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label).push(issue);
  }
  return [...buckets.entries()]
    .map(([label, rows]) => ({ label, rows, count: rows.length }))
    .filter(bucket => bucket.count > 0 || bucket.label !== NO_LABEL_LABEL);
}

function jiraNonFixedIssues(issues) {
  return issues.filter(issue => !isFixedJiraStatus(issue.status));
}

function versionBugStackHtml(buckets, total, barHeight) {
  if (total === 0) return `<div class="jira-version-bug-bar jira-version-bug-bar-empty" style="height:${barHeight}px"></div>`;
  const segments = buckets
    .filter(bucket => bucket.count > 0)
    .map(bucket => `<span class="jira-version-bug-segment" style="${jiraLabelStyle(bucket.label)};flex:${bucket.count}" title="${esc(bucket.label)}: ${bucket.count}"></span>`)
    .join('');
  return `<div class="jira-version-bug-bar jira-version-bug-bar-stacked" style="height:${barHeight}px">${segments}</div>`;
}

function fixedIssueBreakdownHtml(buckets) {
  const visibleBuckets = buckets.filter(bucket => bucket.count > 0);
  if (visibleBuckets.length === 0) return '';
  return `<div class="jira-version-bug-tooltip-breakdown">${visibleBuckets.map(bucket => `<span style="${jiraLabelStyle(bucket.label)}"><i></i>${esc(bucket.label)} ${bucket.count}</span>`).join('')}</div>`;
}

function fixedIssueTooltipHtml(rows) {
  if (rows.length === 0) return '<div class="jira-version-bug-tooltip-empty">No fixed issues for this version.</div>';

  const buckets = jiraLabelBuckets(rows);
  const visibleRows = rows.slice(0, 10);
  let html = '<div class="jira-version-bug-tooltip-title">Fixed bugs</div>';
  html += fixedIssueBreakdownHtml(buckets);
  for (const issue of visibleRows) {
    const summary = truncate(issue.summary || issue.key || 'Untitled Jira issue', 92);
    html += `<div class="jira-version-bug-tooltip-item">
      <div class="jira-version-bug-tooltip-summary">${esc(summary)}</div>
      <div class="jira-version-bug-tooltip-meta"><span>${esc(issue.status || '--')}</span><span>${esc(jiraPrimaryLabel(issue))}</span><span>${esc(issue.pod || '--')}</span></div>
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
      const buckets = jiraLabelBuckets(rows);
      const barHeight = rows.length === 0 ? 4 : Math.max(12, Math.round((rows.length / maxCount) * 44));
      html += `<div class="jira-version-bug-column" tabindex="0" aria-label="${esc(version)}: ${rows.length} fixed issues">
        <div class="jira-version-bug-count">${rows.length}</div>
        <div class="jira-version-bug-bar-track">${versionBugStackHtml(buckets, rows.length, barHeight)}</div>
        <div class="jira-version-bug-label" title="${esc(version)}">${esc(version)}</div>
        <div class="jira-version-bug-tooltip" role="tooltip">${fixedIssueTooltipHtml(rows)}</div>
      </div>`;
    }
    html += '</div>';
  }

  html += '</section>';
  return html;
}

function pendingFixesByLabelWidgetHtml(issues) {
  const pendingIssues = jiraNonFixedIssues(issues);
  const buckets = jiraLabelBuckets(pendingIssues);
  const maxCount = Math.max(1, ...buckets.map(bucket => bucket.count));
  let html = '<section class="jira-section-card jira-label-widget">';
  html += `<div class="jira-section-header"><div><div class="jira-section-title">Pending fixes by label</div><div class="jira-section-subtitle">${pendingIssues.length} pending</div></div></div>`;

  if (pendingIssues.length === 0) {
    html += jiraInlineEmptyHtml('No pending fixes found.');
  } else {
    html += '<div class="jira-label-fix-chart" aria-label="Pending fixes by label">';
    for (const bucket of buckets) {
      const width = bucket.count === 0 ? 0 : Math.max(8, Math.round((bucket.count / maxCount) * 100));
      html += `<div class="jira-label-fix-row">
        <div class="jira-label-fix-name"><span class="jira-label-dot" style="${jiraLabelStyle(bucket.label)}"></span><span>${esc(bucket.label)}</span></div>
        <div class="jira-label-fix-track"><span class="jira-label-fix-bar" style="${jiraLabelStyle(bucket.label)};width:${width}%"></span></div>
        <div class="jira-label-fix-count">${bucket.count}</div>
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
  html += pendingFixesByLabelWidgetHtml(issues);
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
  const labels = uniqueSorted(baseIssues.flatMap(issue => jiraVisibleLabels(issue.labels)));

  let html = '<div class="table-controls jira-filter-controls">';
  html += multiFilterSelectHtml('jira-filter-status', 'Status', statuses, filters.status || []);
  html += multiFilterSelectHtml('jira-filter-priority', 'Priority', priorities, filters.priority || []);
  html += multiFilterSelectHtml('jira-filter-fix-version', 'Fix version', fixVersions, filters.fixVersion || [], true);
  html += multiFilterSelectHtml('jira-filter-pod', 'Pod', pods, filters.pod || [], true);
  html += multiFilterSelectHtml('jira-filter-label', 'Label', labels, filters.label || []);
  html += jiraGroupBySelectHtml(currentAllDataGroupBy(allData));
  html += `<div class="ai-form-field jira-search-field"><label>Search</label><input type="text" id="jira-filter-search" value="${esc(filters.search || '')}"></div>`;
  html += '<button type="button" class="btn clear-filters-btn" data-jira-clear-filters><i data-lucide="filter-x" style="width:14px;height:14px"></i> Clear filters</button>';
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
  const hasSettings = Boolean(jira.settings);
  const lastLoaded = jira.lastLoadedAt ? new Date(jira.lastLoadedAt).toLocaleString() : '';

  let html = '<div class="jira-shell">';
  html += '<div class="jira-toolbar">';
  html += '<div class="jira-actions">';
  if (lastLoaded) html += `<span class="jira-last-loaded">Updated ${esc(lastLoaded)}</span>`;
  html += `<button type="button" class="btn btn-primary" id="jira-refresh" ${isLoading || !hasSettings ? 'disabled' : ''}><i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Refresh</button>`;
  html += '</div></div>';

  if (isLoading) {
    html += simpleSpinnerHtml('Loading Jira data...');
  } else if (!hasSettings) {
    html += jiraSettingsRequiredHtml();
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
  $el.querySelector('[data-open-jira-settings]')?.addEventListener('click', () => actions.onConfigureSettings?.());
  $el.querySelectorAll('[data-jira-dashboard-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.jiraDashboardTab;
      if (tab) actions.onDashboardTabChange?.(tab);
    });
  });
  document.getElementById('jira-dashboard-search')?.addEventListener('input', (e) => actions.onDashboardSearchChange?.(e.target.value));
  $el.querySelector('[data-jira-dashboard-clear-filters]')?.addEventListener('click', () => actions.onDashboardClearFilters?.());
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
      if (id === 'jira-filter-label') actions.onFilterChange?.('label', values);
    });
  });
  if (jira.openMultiDropdown) {
    setTimeout(() => {
      document.addEventListener('click', () => actions.onMultiDropdownClose?.(), { once: true });
    }, 0);
  }
  document.getElementById('jira-filter-search')?.addEventListener('input', (e) => actions.onFilterChange?.('search', e.target.value));
  document.getElementById('jira-group-by')?.addEventListener('change', (e) => actions.onFilterChange?.('groupBy', e.target.value));
  $el.querySelector('[data-jira-clear-filters]')?.addEventListener('click', () => actions.onClearFilters?.());
  $el.querySelectorAll('[data-jira-sort]').forEach(header => {
    header.addEventListener('click', () => actions.onSortChange?.(header.dataset.jiraSort));
  });
  wireJiraVersionBugTooltips($el);

  if (window.lucide) lucide.createIcons();
}

export function renderJiraSettingsModal($el, modal, actions = {}) {
  if (!$el) return;
  if (!modal?.open) {
    $el.innerHTML = '';
    return;
  }

  const validating = Boolean(modal.validating);
  const error = modal.error ? `<div class="settings-error" role="alert">${esc(modal.error)}</div>` : '';
  $el.innerHTML = `<div class="settings-modal-backdrop" data-jira-settings-close>
    <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="jira-settings-title">
      <div class="settings-modal-header">
        <div>
          <h2 id="jira-settings-title">Jira settings</h2>
          <p>Configure the Jira connection used by dashboard requests.</p>
        </div>
        <button type="button" class="icon-btn" data-jira-settings-close aria-label="Close Jira settings"><i data-lucide="x" style="width:16px;height:16px"></i></button>
      </div>
      <div class="settings-form">
        <label class="ai-form-field settings-field">
          <span>Jira base URL</span>
          <input type="url" id="jira-settings-base-url" value="${esc(modal.baseUrl || '')}" placeholder="https://scopely.atlassian.net" autocomplete="off"${validating ? ' disabled' : ''}>
        </label>
        <label class="ai-form-field settings-field">
          <span>Email</span>
          <input type="email" id="jira-settings-email" value="${esc(modal.email || '')}" placeholder="name@example.com" autocomplete="username"${validating ? ' disabled' : ''}>
        </label>
        <label class="ai-form-field settings-field">
          <span>API token</span>
          <input type="password" id="jira-settings-api-token" value="${esc(modal.apiToken || '')}" autocomplete="current-password"${validating ? ' disabled' : ''}>
        </label>
        ${error}
      </div>
      <div class="settings-modal-actions">
        <button type="button" class="btn" data-jira-settings-close ${validating ? 'disabled' : ''}>Cancel</button>
        <button type="button" class="btn btn-primary" data-jira-settings-save ${validating ? 'disabled' : ''}>
          ${validating ? '<span class="mini-spinner"></span> Validating' : '<i data-lucide="save" style="width:14px;height:14px"></i> Save'}
        </button>
      </div>
    </section>
  </div>`;

  const backdrop = $el.querySelector('.settings-modal-backdrop');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop && !validating) actions.onClose?.();
  });
  $el.querySelectorAll('[data-jira-settings-close]').forEach(button => {
    button.addEventListener('click', (event) => {
      if (event.currentTarget === backdrop) return;
      if (!validating) actions.onClose?.();
    });
  });
  $el.querySelector('#jira-settings-base-url')?.addEventListener('input', (event) => actions.onFieldChange?.('baseUrl', event.target.value));
  $el.querySelector('#jira-settings-email')?.addEventListener('input', (event) => actions.onFieldChange?.('email', event.target.value));
  $el.querySelector('#jira-settings-api-token')?.addEventListener('input', (event) => actions.onFieldChange?.('apiToken', event.target.value));
  $el.querySelector('[data-jira-settings-save]')?.addEventListener('click', () => actions.onSave?.());

  if (window.lucide) lucide.createIcons();
}
