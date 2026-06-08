import {
  api,
  onAiJobChange,
  getAiJob,
  getRunningAiView,
  loadModels,
  onSelectionChange,
  getSelectionCount,
  getJiraDashboardVersions,
  saveJiraDashboardVersions,
  getJiraAllDataFilters,
  saveJiraAllDataFilters,
} from './shared.js';
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
    openMultiDropdown: null,
    dashboard: {
      activeView: 'versions',
      selectedVersions: getJiraDashboardVersions(),
      search: '',
      expandedVersions: {},
    },
    allData: {
      filters: {
        ...getJiraAllDataFilters(),
        search: '',
      },
      sort: {
        field: 'key',
        dir: 'asc',
      },
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
  'jira-dashboard': 'Jira Dashboard',
  'jira-all-data': 'Jira All Data',
};

const AI_VIEWS = ['analyze', 'groom', 'prioritize', 'duplicates'];
const JIRA_VIEWS = ['jira-dashboard', 'jira-all-data'];
const JIRA_FOCUSABLE_INPUT_IDS = new Set(['jira-dashboard-search', 'jira-filter-search']);

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

function normalizeView(view) {
  return view === 'jira' ? 'jira-dashboard' : view;
}

function isJiraView(view) {
  return JIRA_VIEWS.includes(view);
}

function jiraTabForView(view) {
  return view === 'jira-all-data' ? 'all-data' : 'dashboard';
}

function route() {
  const view = normalizeView(getView());

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  $title.textContent = VIEW_TITLES[view] || 'Dashboard';

  if (isJiraView(view)) {
    state.jira.activeTab = jiraTabForView(view);
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

function getJiraFocusSnapshot() {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !JIRA_FOCUSABLE_INPUT_IDS.has(active.id)) return null;
  return {
    id: active.id,
    start: active.selectionStart,
    end: active.selectionEnd,
  };
}

function restoreJiraFocus(snapshot) {
  if (!snapshot) return;
  const input = document.getElementById(snapshot.id);
  if (!(input instanceof HTMLInputElement)) return;
  input.focus();
  if (typeof snapshot.start === 'number' && typeof snapshot.end === 'number') {
    try {
      input.setSelectionRange(snapshot.start, snapshot.end);
    } catch {
      // Some input types do not support selection ranges.
    }
  }
}

function getJiraDropdownScrollSnapshot() {
  const openId = state.jira.openMultiDropdown;
  if (!openId) return null;
  const menu = [...document.querySelectorAll('[data-jira-multi-menu]')]
    .find(el => el.dataset.jiraMultiMenu === openId);
  if (!(menu instanceof HTMLElement)) return null;
  return {
    id: openId,
    scrollTop: menu.scrollTop,
  };
}

function restoreJiraDropdownScroll(snapshot) {
  if (!snapshot) return;
  const menu = [...document.querySelectorAll('[data-jira-multi-menu]')]
    .find(el => el.dataset.jiraMultiMenu === snapshot.id);
  if (!(menu instanceof HTMLElement)) return;
  menu.scrollTop = snapshot.scrollTop;
}

function renderJira(options = {}) {
  const focusSnapshot = options.preserveFocus ? getJiraFocusSnapshot() : null;
  const dropdownScrollSnapshot = options.preserveDropdownScroll ? getJiraDropdownScrollSnapshot() : null;
  renderJiraView($view, state, {
    onRefresh: refreshJira,
    onDashboardTabChange: setJiraDashboardTab,
    onDashboardVersionChange: setJiraDashboardVersions,
    onDashboardSearchChange: setJiraDashboardSearch,
    onVersionGroupToggle: toggleJiraVersionGroup,
    onVersionGroupsSet: setJiraVersionGroups,
    onMultiDropdownToggle: toggleJiraMultiDropdown,
    onMultiDropdownClose: closeJiraMultiDropdown,
    onFilterChange: setJiraFilter,
    onSortChange: setJiraSort,
  });
  restoreJiraFocus(focusSnapshot);
  restoreJiraDropdownScroll(dropdownScrollSnapshot);
}

function setJiraDashboardTab(tab) {
  state.jira.dashboard = {
    ...state.jira.dashboard,
    activeView: tab,
  };
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function setJiraDashboardVersions(versions) {
  const selectedVersions = Array.isArray(versions) ? versions : [];
  state.jira.dashboard = {
    ...state.jira.dashboard,
    selectedVersions,
  };
  state.jira.openMultiDropdown = 'jira-dashboard-version-filter';
  saveJiraDashboardVersions(selectedVersions);
  renderJira({ preserveDropdownScroll: true });
  if (window.lucide) lucide.createIcons();
}

function setJiraDashboardSearch(search) {
  state.jira.dashboard = {
    ...state.jira.dashboard,
    search,
  };
  renderJira({ preserveFocus: true });
  if (window.lucide) lucide.createIcons();
}

function toggleJiraVersionGroup(version) {
  const expanded = state.jira.dashboard.expandedVersions?.[version] !== false;
  const expandedVersions = {
    ...state.jira.dashboard.expandedVersions,
    [version]: !expanded,
  };
  state.jira.dashboard = {
    ...state.jira.dashboard,
    expandedVersions,
  };
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function setJiraVersionGroups(versions, expanded) {
  const expandedVersions = {
    ...state.jira.dashboard.expandedVersions,
  };
  for (const version of versions) {
    expandedVersions[version] = expanded;
  }
  state.jira.dashboard = {
    ...state.jira.dashboard,
    expandedVersions,
  };
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function toggleJiraMultiDropdown(id) {
  state.jira.openMultiDropdown = state.jira.openMultiDropdown === id ? null : id;
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function closeJiraMultiDropdown() {
  if (!state.jira.openMultiDropdown) return;
  state.jira.openMultiDropdown = null;
  renderJira();
  if (window.lucide) lucide.createIcons();
}

function setJiraFilter(name, value) {
  const dropdownByFilter = {
    status: 'jira-filter-status',
    priority: 'jira-filter-priority',
    fixVersion: 'jira-filter-fix-version',
    pod: 'jira-filter-pod',
    label: 'jira-filter-label',
  };
  const filters = {
    ...state.jira.allData.filters,
    [name]: value,
  };
  state.jira.allData = {
    ...state.jira.allData,
    filters,
  };
  state.jira.openMultiDropdown = dropdownByFilter[name] || state.jira.openMultiDropdown;
  saveJiraAllDataFilters(filters);
  renderJira({ preserveFocus: name === 'search', preserveDropdownScroll: name !== 'search' });
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

function refreshJira() {
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
  if (isJiraView(normalizeView(getView()))) renderJira();

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
        dashboard: {
          ...state.jira.dashboard,
          expandedVersions: {},
        },
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

  if (isJiraView(normalizeView(getView()))) renderJira();
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
