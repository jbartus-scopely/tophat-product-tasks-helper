import {
  api,
  getJiraDashboardVersions,
  saveJiraDashboardVersions,
  getJiraAllDataFilters,
  saveJiraAllDataFilters,
  getStoredCsvData,
  saveStoredCsvData,
  getCsvDashboardFilters,
  saveCsvDashboardFilters,
  getCsvAllDataFilters,
  saveCsvAllDataFilters,
} from './shared.js';
import { renderJiraView, renderCsvDashboardView, renderCsvAllDataView } from './components.js';

let state = {
  backlogLoaded: false,
  stats: null,
  groups: [],
  pods: [],
  scores: {},
  csv: {
    data: null,
    uploadError: null,
    openMultiDropdown: null,
    dashboard: {
      activeView: 'active',
      filters: getCsvDashboardFilters(),
      search: '',
      expandedStatuses: {},
    },
    allData: {
      filters: {
        ...getCsvAllDataFilters(),
        search: '',
      },
      sort: {
        field: 'id',
        dir: 'asc',
      },
    },
  },
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
const $backlogBadge = document.getElementById('backlog-badge');
const $csvInput = document.getElementById('csv-input');
const $dropZone = document.getElementById('drop-zone');

const VIEW_TITLES = {
  'csv-dashboard': 'CSV Dashboard',
  'csv-all-data': 'CSV All Data',
  'jira-dashboard': 'Jira Dashboard',
  'jira-all-data': 'Jira All Data',
};

const CSV_VIEWS = ['csv-dashboard', 'csv-all-data'];
const JIRA_VIEWS = ['jira-dashboard', 'jira-all-data'];
const JIRA_FOCUSABLE_INPUT_IDS = new Set(['jira-dashboard-search', 'jira-filter-search']);
const CSV_FOCUSABLE_INPUT_IDS = new Set(['csv-dashboard-search', 'csv-filter-search']);

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const storedCsv = getStoredCsvData();
  if (storedCsv) {
    applyCsvData(storedCsv);
  } else {
    updateBacklogBadge();
  }

  route();
}

function applyCsvData(data) {
  state.csv = {
    ...state.csv,
    data,
    uploadError: null,
  };
  state.backlogLoaded = data.tasks.length > 0;
  state.stats = csvStats(data);
  state.groups = uniqueCsvValues(data.tasks.map(task => task.initiative));
  state.pods = uniqueCsvValues(data.tasks.map(task => task.priorityPod));
  state.scores = {};
  updateBacklogBadge();
}

function uniqueCsvValues(values) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function csvStats(data) {
  const byPriority = {};
  const byStatus = {};
  const byGroup = {};
  for (const task of data.tasks) {
    const priority = task.priority || '(none)';
    const status = task.status || '(none)';
    const initiative = task.initiative || '(none)';
    byPriority[priority] = (byPriority[priority] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
    byGroup[initiative] = (byGroup[initiative] || 0) + 1;
  }
  return {
    total: data.tasks.length,
    actionable: data.tasks.filter(task => ['TRIAGE', 'TODO', 'Prioritized'].includes(task.status)).length,
    quickWins: data.tasks.filter(task => task.priority === 'P0' || task.priority === 'P1').length,
    filtered: data.filtered || 0,
    warnings: data.warnings || [],
    byPriority,
    byStatus,
    byGroup,
  };
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

function showUploadError(message) {
  state.csv = {
    ...state.csv,
    uploadError: message,
  };
  route();
  const banner = document.createElement('div');
  banner.className = 'warnings upload-error-banner';
  banner.innerHTML = `<div class="warnings-title"><i data-lucide="triangle-alert" style="width:14px;height:14px;vertical-align:-2px"></i> Upload failed</div><p>${escapeHtml(message)}</p>`;
  $view.prepend(banner);
  if (window.lucide) lucide.createIcons();
}

function escapeHtml(value) {
  const d = document.createElement('div');
  d.textContent = value || '';
  return d.innerHTML;
}

// ── Routing ──────────────────────────────────────────────────
function getView() {
  return (location.hash || '#jira-dashboard').slice(1);
}

function normalizeView(view) {
  if (view === 'jira') return 'jira-dashboard';
  if (view === 'dashboard') return 'csv-dashboard';
  return view;
}

function isCsvView(view) {
  return CSV_VIEWS.includes(view);
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
  } else if (isCsvView(view)) {
    if (!state.backlogLoaded) {
      showEmptyState();
      return;
    }
    renderCsvView(view);
  } else {
    if (location.hash !== '#jira-dashboard') {
      location.hash = '#jira-dashboard';
      return;
    }
    renderJira();
  }

  if (window.lucide) lucide.createIcons();
}

function renderCsvView(view) {
  if (view === 'csv-dashboard') {
    renderCsvDashboard();
    return;
  }
  renderCsvAllData();
}

function renderCsvAllData(options = {}) {
  const focusSnapshot = options.preserveFocus ? getCsvFocusSnapshot() : null;
  const dropdownScrollSnapshot = options.preserveDropdownScroll ? getCsvDropdownScrollSnapshot() : null;
  renderCsvAllDataView($view, state, {
    onFilterChange: setCsvAllDataFilter,
    onSortChange: setCsvAllDataSort,
    onMultiDropdownToggle: toggleCsvMultiDropdown,
    onMultiDropdownClose: closeCsvMultiDropdown,
  });
  restoreCsvFocus(focusSnapshot);
  restoreCsvDropdownScroll(dropdownScrollSnapshot);
  if (window.lucide) lucide.createIcons();
}

function renderActiveCsvView(options = {}) {
  const view = normalizeView(getView());
  if (view === 'csv-all-data') renderCsvAllData(options);
  else renderCsvDashboard(options);
}

function setCsvAllDataFilter(name, value) {
  const dropdownByFilter = {
    status: 'csv-filter-status',
    priority: 'csv-filter-priority',
    initiative: 'csv-filter-initiative',
    priorityPod: 'csv-filter-priority-pod',
    reporter: 'csv-filter-reporter',
  };
  const filters = {
    ...state.csv.allData.filters,
    [name]: value,
  };
  state.csv.allData = {
    ...state.csv.allData,
    filters,
  };
  state.csv.openMultiDropdown = dropdownByFilter[name] || state.csv.openMultiDropdown;
  saveCsvAllDataFilters(filters);
  renderCsvAllData({ preserveFocus: name === 'search', preserveDropdownScroll: name !== 'search' });
  if (window.lucide) lucide.createIcons();
}

function setCsvAllDataSort(field) {
  const current = state.csv.allData.sort;
  const dir = current.field === field && current.dir === 'asc' ? 'desc' : 'asc';
  state.csv.allData = {
    ...state.csv.allData,
    sort: { field, dir },
  };
  renderCsvAllData();
  if (window.lucide) lucide.createIcons();
}

function getCsvFocusSnapshot() {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !CSV_FOCUSABLE_INPUT_IDS.has(active.id)) return null;
  return {
    id: active.id,
    start: active.selectionStart,
    end: active.selectionEnd,
  };
}

function restoreCsvFocus(snapshot) {
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

function getCsvDropdownScrollSnapshot() {
  const openId = state.csv.openMultiDropdown;
  if (!openId) return null;
  const menu = [...document.querySelectorAll('[data-csv-multi-menu]')]
    .find(el => el.dataset.csvMultiMenu === openId);
  if (!(menu instanceof HTMLElement)) return null;
  return {
    id: openId,
    scrollTop: menu.scrollTop,
  };
}

function restoreCsvDropdownScroll(snapshot) {
  if (!snapshot) return;
  const menu = [...document.querySelectorAll('[data-csv-multi-menu]')]
    .find(el => el.dataset.csvMultiMenu === snapshot.id);
  if (!(menu instanceof HTMLElement)) return;
  menu.scrollTop = snapshot.scrollTop;
}

function renderCsvDashboard(options = {}) {
  const focusSnapshot = options.preserveFocus ? getCsvFocusSnapshot() : null;
  const dropdownScrollSnapshot = options.preserveDropdownScroll ? getCsvDropdownScrollSnapshot() : null;
  renderCsvDashboardView($view, state, {
    onDashboardTabChange: setCsvDashboardTab,
    onFilterChange: setCsvDashboardFilter,
    onSearchChange: setCsvDashboardSearch,
    onStatusGroupToggle: toggleCsvStatusGroup,
    onStatusGroupsSet: setCsvStatusGroups,
    onMultiDropdownToggle: toggleCsvMultiDropdown,
    onMultiDropdownClose: closeCsvMultiDropdown,
  });
  restoreCsvFocus(focusSnapshot);
  restoreCsvDropdownScroll(dropdownScrollSnapshot);
}

function setCsvDashboardTab(activeView) {
  state.csv.dashboard = {
    ...state.csv.dashboard,
    activeView: activeView === 'hold' ? 'hold' : 'active',
  };
  renderCsvDashboard();
  if (window.lucide) lucide.createIcons();
}

function setCsvDashboardFilter(name, value) {
  const dropdownByFilter = {
    status: 'csv-dashboard-status-filter',
    initiative: 'csv-dashboard-initiative-filter',
  };
  const filters = {
    ...state.csv.dashboard.filters,
    [name]: value,
  };
  state.csv.dashboard = {
    ...state.csv.dashboard,
    filters,
  };
  state.csv.openMultiDropdown = dropdownByFilter[name] || state.csv.openMultiDropdown;
  saveCsvDashboardFilters(filters);
  renderCsvDashboard({ preserveDropdownScroll: true });
  if (window.lucide) lucide.createIcons();
}

function setCsvDashboardSearch(search) {
  state.csv.dashboard = {
    ...state.csv.dashboard,
    search,
  };
  renderCsvDashboard({ preserveFocus: true });
  if (window.lucide) lucide.createIcons();
}

function toggleCsvStatusGroup(status) {
  const expanded = state.csv.dashboard.expandedStatuses?.[status] !== false;
  const expandedStatuses = {
    ...state.csv.dashboard.expandedStatuses,
    [status]: !expanded,
  };
  state.csv.dashboard = {
    ...state.csv.dashboard,
    expandedStatuses,
  };
  renderCsvDashboard();
  if (window.lucide) lucide.createIcons();
}

function setCsvStatusGroups(statuses, expanded) {
  const expandedStatuses = {
    ...state.csv.dashboard.expandedStatuses,
  };
  for (const status of statuses) {
    expandedStatuses[status] = expanded;
  }
  state.csv.dashboard = {
    ...state.csv.dashboard,
    expandedStatuses,
  };
  renderCsvDashboard();
  if (window.lucide) lucide.createIcons();
}

function toggleCsvMultiDropdown(id) {
  state.csv.openMultiDropdown = state.csv.openMultiDropdown === id ? null : id;
  renderActiveCsvView();
  if (window.lucide) lucide.createIcons();
}

function closeCsvMultiDropdown() {
  if (!state.csv.openMultiDropdown) return;
  state.csv.openMultiDropdown = null;
  renderActiveCsvView();
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
      <h2>No CSV uploaded</h2>
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
      showUploadError(result.error);
      return;
    }
    const stored = saveStoredCsvData(result);
    applyCsvData(stored || result);
    location.hash = '#csv-dashboard';
    route();
  } catch (e) {
    showUploadError(e.message);
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
