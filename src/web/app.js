import {
  api,
  apiPost,
  getJiraSettings,
  normalizeJiraSettings,
  saveJiraSettings,
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
  getCsvLists,
  saveCsvLists,
} from './shared.js';
import {
  renderJiraView,
  renderJiraSettingsModal,
  renderCsvDashboardView,
  renderCsvAllDataView,
} from './components.js';

const JIRA_MASKED_TOKEN = '********';

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
    lists: getCsvLists(),
    listEdit: {
      active: false,
      selectedIds: [],
      targetListId: '',
      newListName: '',
    },
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
    settings: getJiraSettings(),
    settingsModal: {
      open: false,
      baseUrl: '',
      email: '',
      apiToken: '',
      tokenMasked: false,
      validating: false,
      error: '',
    },
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
const $csvListNav = document.getElementById('csv-list-nav');
const $modalRoot = document.getElementById('modal-root');
const $jiraSettingsBtn = document.getElementById('jira-settings-btn');

const VIEW_TITLES = {
  'csv-dashboard': 'CSV Dashboard',
  'csv-all-data': 'CSV All Data',
  'jira-dashboard': 'Jira Dashboard',
  'jira-all-data': 'Jira All Data',
};

const CSV_VIEWS = ['csv-dashboard', 'csv-all-data'];
const JIRA_VIEWS = ['jira-dashboard', 'jira-all-data'];
const CSV_LIST_VIEW_PREFIX = 'csv-list:';
const JIRA_FOCUSABLE_INPUT_IDS = new Set(['jira-dashboard-search', 'jira-filter-search']);
const CSV_FOCUSABLE_INPUT_IDS = new Set(['csv-dashboard-search', 'csv-filter-search', 'csv-list-new-name']);

// ── Init ─────────────────────────────────────────────────────
async function init() {
  renderCsvListNav();
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
  const keyPriority = (value) => String(value || '').trim().toLowerCase();
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
    quickWins: data.tasks.filter(task => ['critical', 'major', 'p0', 'p1'].includes(keyPriority(task.priority))).length,
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
  return CSV_VIEWS.includes(view) || isCsvListView(view);
}

function isJiraView(view) {
  return JIRA_VIEWS.includes(view);
}

function isCsvListView(view) {
  return view.startsWith(CSV_LIST_VIEW_PREFIX);
}

function csvListIdFromView(view) {
  return isCsvListView(view) ? decodeURIComponent(view.slice(CSV_LIST_VIEW_PREFIX.length)) : '';
}

function csvListHash(listId) {
  return `#${CSV_LIST_VIEW_PREFIX}${encodeURIComponent(listId)}`;
}

function csvListById(listId) {
  return state.csv.lists.find(list => list.id === listId) || null;
}

function renderCsvListNav() {
  if (!$csvListNav) return;
  const lists = state.csv?.lists || [];
  $csvListNav.innerHTML = lists.map(list => `
    <a href="${csvListHash(list.id)}" class="nav-item csv-list-nav-item" data-view="csv-list" data-list-id="${escapeHtml(list.id)}" title="${escapeHtml(list.name)}">
      <i data-lucide="list-checks" class="nav-icon"></i> <span>${escapeHtml(list.name)}</span>
    </a>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function jiraTabForView(view) {
  return view === 'jira-all-data' ? 'all-data' : 'dashboard';
}

function route() {
  const view = normalizeView(getView());
  renderCsvListNav();

  document.querySelectorAll('.nav-item').forEach(el => {
    const isActiveList = isCsvListView(view) && el.dataset.listId === csvListIdFromView(view);
    el.classList.toggle('active', el.dataset.view === view || isActiveList);
  });

  if (isCsvListView(view)) {
    const list = csvListById(csvListIdFromView(view));
    $title.textContent = list ? list.name : 'CSV List';
  } else {
    $title.textContent = VIEW_TITLES[view] || 'Dashboard';
  }

  if (isJiraView(view)) {
    state.jira.activeTab = jiraTabForView(view);
    renderJira();
    if (state.jira.settings && state.jira.status === 'idle' && !state.jira.loaded) {
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
  renderJiraSettings();
}

function renderCsvView(view) {
  if (view === 'csv-dashboard') {
    renderCsvDashboard();
    return;
  }
  if (isCsvListView(view)) {
    renderCsvList(csvListIdFromView(view));
    return;
  }
  renderCsvAllData();
}

function renderCsvAllData(options = {}) {
  const focusSnapshot = options.preserveFocus ? getCsvFocusSnapshot() : null;
  const dropdownScrollSnapshot = options.preserveDropdownScroll ? getCsvDropdownScrollSnapshot() : null;
  renderCsvAllDataView($view, state, {
    onFilterChange: setCsvAllDataFilter,
    onClearFilters: clearCsvAllDataFilters,
    onSortChange: setCsvAllDataSort,
    onMultiDropdownToggle: toggleCsvMultiDropdown,
    onMultiDropdownClose: closeCsvMultiDropdown,
    onListEditToggle: toggleCsvListEditMode,
    onListSelectionToggle: toggleCsvListSelection,
    onListSelectVisible: setCsvVisibleSelection,
    onListSelectionClear: clearCsvListSelection,
    onListTargetChange: setCsvListTarget,
    onListNameChange: setCsvNewListName,
    onListCreate: createCsvListFromSelection,
    onListAppend: appendSelectionToCsvList,
    onListImport: importCsvList,
  });
  restoreCsvFocus(focusSnapshot);
  restoreCsvDropdownScroll(dropdownScrollSnapshot);
  if (window.lucide) lucide.createIcons();
}

function renderCsvList(listId, options = {}) {
  const list = csvListById(listId);
  if (!list) {
    location.hash = '#csv-all-data';
    return;
  }
  const focusSnapshot = options.preserveFocus ? getCsvFocusSnapshot() : null;
  const dropdownScrollSnapshot = options.preserveDropdownScroll ? getCsvDropdownScrollSnapshot() : null;
  renderCsvAllDataView($view, state, {
    onFilterChange: setCsvAllDataFilter,
    onClearFilters: clearCsvAllDataFilters,
    onSortChange: setCsvAllDataSort,
    onMultiDropdownToggle: toggleCsvMultiDropdown,
    onMultiDropdownClose: closeCsvMultiDropdown,
    onListEditToggle: toggleCsvListEditMode,
    onListSelectionToggle: toggleCsvListSelection,
    onListSelectVisible: setCsvVisibleSelection,
    onListSelectionClear: clearCsvListSelection,
    onListTargetChange: setCsvListTarget,
    onListNameChange: setCsvNewListName,
    onListCreate: createCsvListFromSelection,
    onListAppend: appendSelectionToCsvList,
    onListRemoveSelected: removeSelectedFromCsvList,
    onListRename: renameCsvList,
    onListDelete: deleteCsvList,
    onListExport: exportCsvList,
    onListImport: importCsvList,
  }, {
    scope: 'list',
    list,
    tasks: csvTasksForList(list),
  });
  restoreCsvFocus(focusSnapshot);
  restoreCsvDropdownScroll(dropdownScrollSnapshot);
  if (window.lucide) lucide.createIcons();
}

function renderActiveCsvView(options = {}) {
  const view = normalizeView(getView());
  if (view === 'csv-all-data') renderCsvAllData(options);
  else if (isCsvListView(view)) renderCsvList(csvListIdFromView(view), options);
  else renderCsvDashboard(options);
}

function csvTasksForList(list) {
  const taskById = new Map((state.csv.data?.tasks || []).map(task => [task.id, task]));
  return list.taskIds.map(id => taskById.get(id)).filter(Boolean);
}

function persistCsvLists(lists) {
  state.csv = {
    ...state.csv,
    lists: saveCsvLists(lists),
  };
  renderCsvListNav();
}

function generateCsvListId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `csv-list-${Date.now().toString(36)}-${random}`;
}

function selectedCsvListIds() {
  return Array.isArray(state.csv.listEdit.selectedIds) ? state.csv.listEdit.selectedIds : [];
}

function updateCsvListEdit(changes) {
  state.csv = {
    ...state.csv,
    listEdit: {
      ...state.csv.listEdit,
      ...changes,
    },
  };
}

function toggleCsvListEditMode(active) {
  const nextActive = typeof active === 'boolean' ? active : !state.csv.listEdit.active;
  updateCsvListEdit({
    active: nextActive,
    selectedIds: nextActive ? selectedCsvListIds() : [],
  });
  renderActiveCsvView();
}

function toggleCsvListSelection(taskId) {
  if (!taskId) return;
  const selected = new Set(selectedCsvListIds());
  if (selected.has(taskId)) selected.delete(taskId);
  else selected.add(taskId);
  updateCsvListEdit({ selectedIds: [...selected] });
  renderActiveCsvView();
}

function setCsvVisibleSelection(taskIds, selected) {
  const visibleIds = Array.isArray(taskIds) ? taskIds.filter(Boolean) : [];
  const next = new Set(selectedCsvListIds());
  for (const taskId of visibleIds) {
    if (selected) next.add(taskId);
    else next.delete(taskId);
  }
  updateCsvListEdit({ selectedIds: [...next] });
  renderActiveCsvView();
}

function clearCsvListSelection() {
  updateCsvListEdit({ selectedIds: [] });
  renderActiveCsvView();
}

function setCsvListTarget(listId) {
  updateCsvListEdit({ targetListId: listId || '' });
  renderActiveCsvView();
}

function setCsvNewListName(name) {
  updateCsvListEdit({ newListName: name || '' });
  renderActiveCsvView({ preserveFocus: true });
}

function createCsvListFromSelection() {
  const taskIds = selectedCsvListIds();
  const name = String(state.csv.listEdit.newListName || '').trim();
  if (!name || taskIds.length === 0) return;
  const list = {
    id: generateCsvListId(),
    name,
    taskIds,
  };
  persistCsvLists([...state.csv.lists, list]);
  updateCsvListEdit({
    targetListId: list.id,
    newListName: '',
  });
  renderActiveCsvView();
}

function appendSelectionToCsvList(listId) {
  const taskIds = selectedCsvListIds();
  if (!listId || taskIds.length === 0) return;
  persistCsvLists(state.csv.lists.map(list => {
    if (list.id !== listId) return list;
    return {
      ...list,
      taskIds: [...new Set([...list.taskIds, ...taskIds])],
    };
  }));
  updateCsvListEdit({ targetListId: listId });
  renderActiveCsvView();
}

function removeSelectedFromCsvList(listId) {
  const selected = new Set(selectedCsvListIds());
  if (!listId || selected.size === 0) return;
  persistCsvLists(state.csv.lists.map(list => {
    if (list.id !== listId) return list;
    return {
      ...list,
      taskIds: list.taskIds.filter(taskId => !selected.has(taskId)),
    };
  }));
  updateCsvListEdit({ selectedIds: [] });
  renderActiveCsvView();
}

function renameCsvList(listId) {
  const list = csvListById(listId);
  if (!list) return;
  const name = window.prompt('List name', list.name);
  if (name === null || !name.trim()) return;
  persistCsvLists(state.csv.lists.map(item => item.id === listId ? { ...item, name: name.trim() } : item));
  route();
}

function deleteCsvList(listId) {
  const list = csvListById(listId);
  if (!list) return;
  if (!window.confirm(`Delete list "${list.name}"?`)) return;
  persistCsvLists(state.csv.lists.filter(item => item.id !== listId));
  updateCsvListEdit({ selectedIds: [], targetListId: '' });
  if (isCsvListView(normalizeView(getView())) && csvListIdFromView(normalizeView(getView())) === listId) {
    location.hash = '#csv-all-data';
    return;
  }
  route();
}

function csvEscapeCell(value) {
  const text = String(value || '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsvList(listId) {
  const list = csvListById(listId);
  if (!list) return;
  const csv = ['ID', ...list.taskIds.map(csvEscapeCell)].join('\n') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `${list.name || 'csv-list'}`.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'csv-list';
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function importCsvList() {
  if (!state.csv.data?.tasks?.length) return;
  const name = window.prompt('List name');
  if (name === null || !name.trim()) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvRows(text);
    if (rows.length === 0) return;
    const header = rows[0].map(cell => cell.trim().toLowerCase());
    const idIndex = header.indexOf('id');
    const dataRows = idIndex === -1 ? rows : rows.slice(1);
    const columnIndex = idIndex === -1 ? 0 : idIndex;
    const validIds = new Set((state.csv.data?.tasks || []).map(task => task.id).filter(Boolean));
    const taskIds = [...new Set(dataRows.map(row => String(row[columnIndex] || '').trim()).filter(id => id && validIds.has(id)))];
    if (taskIds.length === 0) return;
    const list = {
      id: generateCsvListId(),
      name: name.trim(),
      taskIds,
    };
    persistCsvLists([...state.csv.lists, list]);
    location.hash = csvListHash(list.id);
    route();
  }, { once: true });
  input.click();
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
  renderActiveCsvView({ preserveFocus: name === 'search', preserveDropdownScroll: name !== 'search' });
  if (window.lucide) lucide.createIcons();
}

function clearCsvAllDataFilters() {
  const filters = {
    status: [],
    priority: [],
    initiative: [],
    priorityPod: [],
    reporter: [],
    groupBy: 'none',
    search: '',
  };
  state.csv.allData = {
    ...state.csv.allData,
    filters,
  };
  state.csv.openMultiDropdown = null;
  saveCsvAllDataFilters(filters);
  renderActiveCsvView();
  if (window.lucide) lucide.createIcons();
}

function setCsvAllDataSort(field) {
  const current = state.csv.allData.sort;
  const dir = current.field === field && current.dir === 'asc' ? 'desc' : 'asc';
  state.csv.allData = {
    ...state.csv.allData,
    sort: { field, dir },
  };
  renderActiveCsvView();
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
    onClearFilters: clearCsvDashboardFilters,
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

function clearCsvDashboardFilters() {
  const filters = {
    status: [],
    initiative: [],
  };
  state.csv.dashboard = {
    ...state.csv.dashboard,
    filters,
    search: '',
  };
  state.csv.openMultiDropdown = null;
  saveCsvDashboardFilters(filters);
  renderCsvDashboard();
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
    onConfigureSettings: openJiraSettingsModal,
    onDashboardTabChange: setJiraDashboardTab,
    onDashboardVersionChange: setJiraDashboardVersions,
    onDashboardSearchChange: setJiraDashboardSearch,
    onDashboardClearFilters: clearJiraDashboardFilters,
    onVersionGroupToggle: toggleJiraVersionGroup,
    onVersionGroupsSet: setJiraVersionGroups,
    onMultiDropdownToggle: toggleJiraMultiDropdown,
    onMultiDropdownClose: closeJiraMultiDropdown,
    onFilterChange: setJiraFilter,
    onClearFilters: clearJiraAllDataFilters,
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

function clearJiraDashboardFilters() {
  state.jira.dashboard = {
    ...state.jira.dashboard,
    selectedVersions: [],
    search: '',
  };
  state.jira.openMultiDropdown = null;
  saveJiraDashboardVersions([]);
  renderJira();
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

function clearJiraAllDataFilters() {
  const filters = {
    status: [],
    priority: [],
    fixVersion: [],
    pod: [],
    label: [],
    groupBy: 'none',
    search: '',
  };
  state.jira.allData = {
    ...state.jira.allData,
    filters,
  };
  state.jira.openMultiDropdown = null;
  saveJiraAllDataFilters(filters);
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

function refreshJira() {
  loadJiraSections();
}

async function fetchJiraSections(settings) {
  return apiPost('/api/jira/sections/search', { settings });
}

function jiraLoadValidationError(result) {
  if (!result || typeof result !== 'object') return 'Jira validation failed before receiving a response.';
  if (result.error) return result.error;
  const sections = Array.isArray(result.sections) ? result.sections : [];
  const failedSection = sections.find(section => section?.error);
  if (!failedSection) return '';
  return failedSection.error || `Jira section "${failedSection.title || failedSection.id || 'unknown'}" failed.`;
}

async function loadJiraSections(settings = state.jira.settings) {
  if (state.jira.status === 'loading') return;
  if (!settings) {
    state.jira = {
      ...state.jira,
      status: 'idle',
      error: null,
      loaded: false,
      startedAt: null,
    };
    if (isJiraView(normalizeView(getView()))) renderJira();
    return;
  }

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
    const result = await fetchJiraSections(settings);
    const validationError = jiraLoadValidationError(result);
    if (validationError) {
      state.jira = {
        ...state.jira,
        status: 'error',
        sections: [],
        error: validationError,
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

function openJiraSettingsModal() {
  const settings = state.jira.settings;
  state.jira = {
    ...state.jira,
    settingsModal: {
      open: true,
      baseUrl: settings?.baseUrl || '',
      email: settings?.email || '',
      apiToken: settings?.apiToken ? JIRA_MASKED_TOKEN : '',
      tokenMasked: Boolean(settings?.apiToken),
      validating: false,
      error: '',
    },
  };
  renderJiraSettings();
}

function closeJiraSettingsModal() {
  state.jira = {
    ...state.jira,
    settingsModal: {
      ...state.jira.settingsModal,
      open: false,
      validating: false,
      error: '',
    },
  };
  renderJiraSettings();
}

function setJiraSettingsField(name, value) {
  const nextModal = {
    ...state.jira.settingsModal,
    [name]: value,
  };
  if (name === 'apiToken') {
    nextModal.tokenMasked = value === JIRA_MASKED_TOKEN && Boolean(state.jira.settings?.apiToken);
  }
  state.jira = {
    ...state.jira,
    settingsModal: nextModal,
  };
}

function settingsFromModal() {
  const modal = state.jira.settingsModal || {};
  const apiToken = modal.tokenMasked ? state.jira.settings?.apiToken : modal.apiToken;
  return normalizeJiraSettings({
    baseUrl: modal.baseUrl,
    email: modal.email,
    apiToken,
  });
}

async function saveJiraSettingsFromModal() {
  const candidate = settingsFromModal();
  if (!candidate) {
    state.jira = {
      ...state.jira,
      settingsModal: {
        ...state.jira.settingsModal,
        error: 'Jira base URL, email, and API token are required.',
      },
    };
    renderJiraSettings();
    return;
  }

  state.jira = {
    ...state.jira,
    settingsModal: {
      ...state.jira.settingsModal,
      validating: true,
      error: '',
    },
  };
  renderJiraSettings();

  try {
    const result = await fetchJiraSections(candidate);
    const validationError = jiraLoadValidationError(result);
    if (validationError) throw new Error(validationError);

    const saved = saveJiraSettings(candidate);
    if (!saved) throw new Error('Jira base URL, email, and API token are required.');

    state.jira = {
      ...state.jira,
      settings: saved,
      settingsModal: {
        open: false,
        baseUrl: '',
        email: '',
        apiToken: '',
        tokenMasked: false,
        validating: false,
        error: '',
      },
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
    renderJiraSettings();
    if (isJiraView(normalizeView(getView()))) renderJira();
  } catch (error) {
    state.jira = {
      ...state.jira,
      settingsModal: {
        ...state.jira.settingsModal,
        validating: false,
        error: error.message || 'Jira validation failed.',
      },
    };
    renderJiraSettings();
  }
}

function renderJiraSettings() {
  renderJiraSettingsModal($modalRoot, state.jira.settingsModal, {
    onClose: closeJiraSettingsModal,
    onFieldChange: setJiraSettingsField,
    onSave: saveJiraSettingsFromModal,
  });
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

$jiraSettingsBtn?.addEventListener('click', openJiraSettingsModal);
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
