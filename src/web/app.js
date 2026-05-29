import { api, apiPost, onAiJobChange, getAiJob, getRunningAiView, loadModels, onSelectionChange, getSelectionCount, addJiraQueryToHistory } from './shared.js';
import { renderDashboard, renderTaskList, renderAiView, renderSelectionView, renderJiraView } from './components.js';

let state = {
  backlogLoaded: false,
  stats: null,
  groups: [],
  pods: [],
  scores: {},
  aiAvailable: false,
  jira: {
    activeTab: 'dashboard',
    status: 'idle',
    sections: [],
    error: null,
    loaded: false,
    startedAt: null,
    lastLoadedAt: null,
    allData: {
      mode: 'saved',
      selectedSectionId: '__all__',
      filters: {
        status: '',
        priority: '',
        fixVersion: '',
        pod: '',
        search: '',
      },
      sort: {
        field: 'key',
        dir: 'asc',
      },
      adHocJql: '',
      adHocStatus: 'idle',
      adHocIssues: [],
      adHocWarnings: [],
      adHocError: null,
    },
  },
};

const $view = document.getElementById('view-container');
const $title = document.getElementById('page-title');
const $aiBadge = document.getElementById('ai-badge');
const $backlogBadge = document.getElementById('backlog-badge');
const $csvInput = document.getElementById('csv-input');
const $dropZone = document.getElementById('drop-zone');

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  triage: 'Triage',
  backlog: 'Backlog',
  inprogress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
  analyze: 'AI: Analyze',
  groom: 'AI: Groom Triage',
  prioritize: 'AI: Prioritize',
  duplicates: 'AI: Find Duplicates',
  selection: 'Selection',
  jira: 'Jira Watch',
};

const AI_VIEWS = ['analyze', 'groom', 'prioritize', 'duplicates'];

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const [backlog, aiStatus] = await Promise.all([
    api('/api/backlog'),
    api('/api/ai/status'),
    loadModels(),
  ]);

  state.aiAvailable = aiStatus.available;
  updateAiBadge();

  if (backlog.loaded) {
    state.backlogLoaded = true;
    state.stats = await api('/api/stats');
    state.groups = await api('/api/groups');
    state.pods = await api('/api/pods');
    state.scores = await api('/api/scores');
    updateBacklogBadge();
  }

  updateAiNavItems();
  updateSelectionBadge();

  onSelectionChange(() => {
    updateSelectionBadge();
    if (getView() === 'selection') {
      const active = document.activeElement;
      const isEditing = active && (active.classList.contains('sel-notes-input') || active.classList.contains('sel-override'));
      if (!isEditing) {
        renderSelectionView($view, state);
        if (window.lucide) lucide.createIcons();
      }
    }
  });

  // When any AI job changes state, update nav spinners and re-render current AI view
  onAiJobChange(() => {
    try {
      updateNavSpinners();
      const current = getView();
      if (AI_VIEWS.includes(current)) {
        renderAiView($view, current, state);
        if (window.lucide) lucide.createIcons();
      }
    } catch (e) {
      console.error('AI view render error:', e);
    }
  });

  route();
}

function updateAiBadge() {
  $aiBadge.textContent = state.aiAvailable ? 'AI: ready' : 'AI: unavailable';
  $aiBadge.className = 'ai-badge ' + (state.aiAvailable ? 'available' : 'unavailable');
}

function updateBacklogBadge() {
  if (state.stats) {
    $backlogBadge.textContent = `${state.stats.total} tasks`;
    $backlogBadge.className = 'backlog-badge loaded';
  } else {
    $backlogBadge.textContent = 'No data';
    $backlogBadge.className = 'backlog-badge';
  }
}

function updateSelectionBadge() {
  const badge = document.getElementById('selection-count');
  if (!badge) return;
  const count = getSelectionCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function updateAiNavItems() {
  for (const view of AI_VIEWS) {
    const el = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (!el) continue;
    if (!state.aiAvailable) el.classList.add('disabled');
    else el.classList.remove('disabled');
  }
}

function updateNavSpinners() {
  for (const view of AI_VIEWS) {
    const el = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (!el) continue;
    const icon = el.querySelector('.nav-icon, .nav-spinner');
    if (!icon) continue;

    const job = getAiJob(view);
    if (job.status === 'running') {
      if (!icon.classList.contains('nav-spinner')) {
        const spinner = document.createElement('span');
        spinner.className = 'nav-spinner';
        spinner.innerHTML = '<span class="spinner-sm"></span>';
        icon.replaceWith(spinner);
      }
    } else {
      if (icon.classList.contains('nav-spinner')) {
        const lucideNames = { analyze: 'sparkles', groom: 'scan-search', prioritize: 'arrow-up-circle', duplicates: 'copy' };
        const original = document.createElement('i');
        original.setAttribute('data-lucide', lucideNames[view]);
        original.className = 'nav-icon';
        icon.replaceWith(original);
        if (window.lucide) lucide.createIcons();
      }
    }
  }
}

// ── Routing ──────────────────────────────────────────────────
function getView() {
  return (location.hash || '#dashboard').slice(1);
}

function route() {
  const view = getView();

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  $title.textContent = VIEW_TITLES[view] || 'Dashboard';

  if (view === 'jira') {
    renderJira();
    if (state.jira.status === 'idle' && !state.jira.loaded) {
      loadJiraSections();
    }
  } else if (view === 'selection') {
    renderSelectionView($view, state);
  } else if (!state.backlogLoaded) {
    showEmptyState();
    return;
  } else if (AI_VIEWS.includes(view)) {
    renderAiView($view, view, state);
  } else {
    switch (view) {
      case 'dashboard': renderDashboard($view, state); break;
      case 'triage':
      case 'backlog':
      case 'inprogress':
      case 'done':
      case 'blocked':
        renderTaskList($view, view, state); break;
      default: renderDashboard($view, state);
    }
  }

  updateNavSpinners();
  if (window.lucide) lucide.createIcons();
}

window.addEventListener('hashchange', route);

function renderJira() {
  renderJiraView($view, state, {
    onRefresh: refreshJira,
    onTabChange: setJiraTab,
    onSectionChange: setJiraSection,
    onFilterChange: setJiraFilter,
    onSortChange: setJiraSort,
    onAdHocSearch: runJiraAdHocSearch,
    onUseSavedData: useSavedJiraData,
  });
}

function setJiraTab(tab) {
  state.jira.activeTab = tab;
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function setJiraSection(sectionId) {
  state.jira.allData = {
    ...state.jira.allData,
    mode: 'saved',
    selectedSectionId: sectionId,
  };
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function setJiraFilter(name, value) {
  state.jira.allData = {
    ...state.jira.allData,
    filters: {
      ...state.jira.allData.filters,
      [name]: value,
    },
  };
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function setJiraSort(field) {
  const current = state.jira.allData.sort;
  const dir = current.field === field && current.dir === 'asc' ? 'desc' : 'asc';
  state.jira.allData = {
    ...state.jira.allData,
    sort: { field, dir },
  };
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function useSavedJiraData() {
  state.jira.allData = {
    ...state.jira.allData,
    mode: 'saved',
    adHocStatus: 'idle',
    adHocError: null,
  };
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function refreshJira() {
  if (
    state.jira.activeTab === 'all-data' &&
    state.jira.allData.mode === 'ad-hoc' &&
    state.jira.allData.adHocJql
  ) {
    runJiraAdHocSearch(state.jira.allData.adHocJql);
    return;
  }

  loadJiraSections();
}

async function loadJiraSections() {
  if (state.jira.status === 'loading') return;

  state.jira = {
    ...state.jira,
    status: 'loading',
    sections: [],
    error: null,
    loaded: false,
    startedAt: Date.now(),
  };
  if (getView() === 'jira') renderJira();

  try {
    const result = await api('/api/jira/sections/search', { method: 'POST' });
    if (result.error) {
      state.jira = {
        ...state.jira,
        status: 'error',
        sections: [],
        error: result.error,
        loaded: false,
        startedAt: null,
      };
    } else {
      state.jira = {
        ...state.jira,
        status: 'done',
        sections: result.sections || [],
        error: null,
        loaded: true,
        startedAt: null,
        lastLoadedAt: Date.now(),
      };
    }
  } catch (e) {
    state.jira = {
      ...state.jira,
      status: 'error',
      sections: [],
      error: e.message,
      loaded: false,
      startedAt: null,
    };
  }

  if (getView() === 'jira') renderJira();
}

async function runJiraAdHocSearch(jql) {
  const trimmed = jql.trim();
  if (!trimmed || state.jira.allData.adHocStatus === 'loading') return;

  state.jira.allData = {
    ...state.jira.allData,
    mode: 'ad-hoc',
    adHocJql: trimmed,
    adHocStatus: 'loading',
    adHocIssues: [],
    adHocWarnings: [],
    adHocError: null,
  };
  renderJira();

  try {
    const result = await apiPost('/api/jira/search', { jql: trimmed });
    if (result.error) {
      state.jira.allData = {
        ...state.jira.allData,
        adHocStatus: 'error',
        adHocIssues: [],
        adHocWarnings: [],
        adHocError: result.error,
      };
    } else {
      addJiraQueryToHistory(trimmed);
      state.jira.allData = {
        ...state.jira.allData,
        adHocStatus: 'done',
        adHocIssues: result.issues || [],
        adHocWarnings: result.warnings || [],
        adHocError: null,
      };
    }
  } catch (e) {
    state.jira.allData = {
      ...state.jira.allData,
      adHocStatus: 'error',
      adHocIssues: [],
      adHocWarnings: [],
      adHocError: e.message,
    };
  }

  renderJira();
}

function showEmptyState() {
  $view.innerHTML = `
    <div class="empty-state">
      <i data-lucide="file-spreadsheet" style="width:64px;height:64px;opacity:0.5;margin-bottom:16px"></i>
      <h2>No backlog loaded</h2>
      <p>Upload a CSV file or drop it anywhere on the page to get started.</p>
      <button class="btn btn-primary" id="empty-upload-btn"><i data-lucide="upload" style="width:14px;height:14px"></i> Upload CSV</button>
    </div>`;
  if (window.lucide) lucide.createIcons();
  document.getElementById('empty-upload-btn')?.addEventListener('click', () => $csvInput.click());
}

// ── File Upload ──────────────────────────────────────────────
async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);

  $view.innerHTML = `<div class="spinner-container"><div class="spinner"></div><div class="spinner-text">Loading CSV...</div></div>`;

  try {
    const result = await api('/api/upload', { method: 'POST', body: form });
    if (result.error) {
      $view.innerHTML = `<div class="empty-state"><h2>Upload failed</h2><p>${result.error}</p></div>`;
      return;
    }
    state.backlogLoaded = true;
    state.stats = result.stats;
    state.groups = await api('/api/groups');
    state.pods = await api('/api/pods');
    state.scores = await api('/api/scores');
    updateBacklogBadge();
    location.hash = '#dashboard';
    route();
  } catch (e) {
    $view.innerHTML = `<div class="empty-state"><h2>Upload failed</h2><p>${e.message}</p></div>`;
  }
}

document.getElementById('upload-btn').addEventListener('click', () => $csvInput.click());
$csvInput.addEventListener('change', (e) => {
  if (e.target.files[0]) uploadFile(e.target.files[0]);
});

// Drag and drop
document.addEventListener('dragover', (e) => { e.preventDefault(); $dropZone.classList.add('active'); });
document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null || !document.contains(e.relatedTarget)) $dropZone.classList.remove('active');
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  $dropZone.classList.remove('active');
  const file = e.dataTransfer?.files[0];
  if (file && file.name.endsWith('.csv')) uploadFile(file);
});

init();
