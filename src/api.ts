import { parseBacklogFromString } from './parser.js';
import { scoreTasks } from './scorer.js';
import {
  checkAiAvailable,
  loadPrompt,
  tasksToCompactCsv,
  parseGroomResponse,
  runClaudeCollectRaw,
} from './ai.js';
import { getCached, getLastCached, saveCache } from './cache.js';
import type { BacklogData, Task, GroomResult } from './types.js';

export interface StatsResponse {
  total: number;
  actionable: number;
  quickWins: number;
  filtered: number;
  warnings: string[];
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  byGroup: Record<string, number>;
}

export interface TasksResponse {
  tasks: Task[];
  title: string;
  total: number;
}

const LIST_CATEGORIES: Record<string, { statuses: string[]; title: string }> = {
  triage:     { statuses: ['TRIAGE'],                                             title: 'TRIAGE' },
  backlog:    { statuses: ['TODO', 'Prioritized'],                                title: 'BACKLOG (TODO + Prioritized)' },
  inprogress: { statuses: ['Pre-Pro Ready', 'Prepro-In Progress', 'Pod Working'], title: 'IN PROGRESS' },
  done:       { statuses: ['Live', 'Ready for release'],                          title: 'DONE' },
  blocked:    { statuses: ['BLOCK'],                                              title: 'BLOCKED' },
};

export function getCategoryStatuses(category: string): string[] {
  return LIST_CATEGORIES[category]?.statuses || [];
}

export function loadBacklog(csvContent: string): BacklogData {
  const backlog = parseBacklogFromString(csvContent);
  scoreTasks(backlog);
  return backlog;
}

export function computeStats(backlog: BacklogData): StatsResponse {
  const tasks = backlog.tasks;
  const actionable = tasks.filter(
    (t) => !['Live', 'HOLD', ''].includes(t.status) && t.status !== ''
  ).length;
  const quickWins = tasks.filter(
    (t) => t.preproWork === '0 - Low' && t.risk === 'Low' && !['Live', 'HOLD'].includes(t.status)
  ).length;

  const byPriority: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byGroup: Record<string, number> = {};

  for (const t of tasks) {
    const p = t.priority || '(none)';
    byPriority[p] = (byPriority[p] || 0) + 1;
    const s = t.status || '(none)';
    byStatus[s] = (byStatus[s] || 0) + 1;
    const g = t.group || '(none)';
    byGroup[g] = (byGroup[g] || 0) + 1;
  }

  return {
    total: tasks.length,
    actionable,
    quickWins,
    filtered: backlog.filtered,
    warnings: backlog.warnings,
    byPriority,
    byStatus,
    byGroup,
  };
}

export function getGroups(backlog: BacklogData): string[] {
  const groups = new Set<string>();
  for (const t of backlog.tasks) {
    if (t.group) groups.add(t.group);
  }
  return [...groups].sort();
}

export function getPods(backlog: BacklogData): string[] {
  const pods = new Set<string>();
  for (const t of backlog.tasks) {
    if (t.assignedPod) pods.add(t.assignedPod);
  }
  return [...pods].sort();
}

export function filterTasks(
  backlog: BacklogData,
  category: string,
  group?: string,
  limit = 50,
  priority?: string,
  pod?: string,
  status?: string,
): TasksResponse {
  const cat = LIST_CATEGORIES[category];
  if (!cat) {
    return { tasks: [], title: 'Unknown Category', total: 0 };
  }

  let tasks = backlog.tasks.filter((t) =>
    cat.statuses.some((s) => t.status === s)
  );

  if (group) {
    tasks = tasks.filter((t) => t.group.toLowerCase() === group.toLowerCase());
  }
  if (priority) {
    tasks = tasks.filter((t) => t.priority === priority);
  }
  if (pod === '__empty__') {
    tasks = tasks.filter((t) => !t.assignedPod);
  } else if (pod) {
    tasks = tasks.filter((t) => t.assignedPod.toLowerCase() === pod.toLowerCase());
  }
  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  const total = tasks.length;
  tasks = tasks.slice(0, limit);

  return { tasks, title: cat.title, total };
}

export function getScoreMap(backlog: BacklogData): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of backlog.tasks) {
    if (t.id) map[t.id] = t.score;
  }
  return map;
}

export function getTask(backlog: BacklogData, id: string): Task | undefined {
  return backlog.tasks.find((t) => t.id === id);
}

function enrichWithScores(result: GroomResult | null, backlog: BacklogData): GroomResult | null {
  if (!result?.tasks) return result;
  const scoreMap = new Map(backlog.tasks.map((t) => [t.id, t.score]));
  for (const t of result.tasks) {
    (t as any).score = scoreMap.get(t.taskId) ?? 0;
  }
  return result;
}

export function isAiAvailable(): boolean {
  return checkAiAvailable();
}

export async function apiAnalyze(
  backlog: BacklogData,
  ask: string,
  group?: string,
  model?: string
): Promise<GroomResult | null> {
  const relevantTasks = backlog.tasks.filter((t) => t.id && t.description);
  const csv = tasksToCompactCsv(relevantTasks);
  const warnings = backlog.warnings.length > 0
    ? `\n\nData warnings:\n${backlog.warnings.map((w) => `- ${w}`).join('\n')}`
    : '';
  const userPrompt = group ? `Focus on the "${group}" group. ${ask}` : ask;

  const prompt = loadPrompt('analyze', {
    taskCount: String(relevantTasks.length),
    csv,
    warnings,
    userPrompt,
  });

  const raw = await runClaudeCollectRaw(prompt, model);
  if (!raw) return null;

  return enrichWithScores(parseGroomResponse(raw), backlog);
}

export async function apiGroom(
  backlog: BacklogData,
  group?: string,
  cache?: boolean,
  model?: string
): Promise<GroomResult | null> {
  let triageTasks = backlog.tasks.filter((t) => t.id && t.description && t.status === 'TRIAGE');
  if (group) {
    triageTasks = triageTasks.filter((t) => t.group.toLowerCase() === group.toLowerCase());
  }
  if (triageTasks.length === 0) return null;

  const limited = triageTasks.slice(0, 80);
  const triageCsv = tasksToCompactCsv(limited);

  const activeTasks = backlog.tasks.filter(
    (t) => t.id && t.description && t.status !== 'TRIAGE' && !['Live', 'HOLD'].includes(t.status) && t.status
  );
  const activeCsv = tasksToCompactCsv(activeTasks);

  const prompt = loadPrompt('groom', {
    taskCount: String(limited.length),
    groupFilter: group ? ` filtered to group "${group}"` : '',
    triageCsv,
    activeCount: String(activeTasks.length),
    activeCsv,
  });

  let raw: string | null = null;
  if (cache) {
    raw = getCached('groom', prompt) ?? getLastCached('groom');
  }
  if (!raw) {
    raw = await runClaudeCollectRaw(prompt, model);
    if (!raw) return null;
    saveCache('groom', prompt, raw);
  }

  return enrichWithScores(parseGroomResponse(raw), backlog);
}

export async function apiPrioritize(
  backlog: BacklogData,
  group?: string,
  cache?: boolean,
  model?: string
): Promise<GroomResult | null> {
  let todoTasks = backlog.tasks.filter((t) => t.id && t.description && t.status === 'TODO');
  if (group) {
    todoTasks = todoTasks.filter((t) => t.group.toLowerCase() === group.toLowerCase());
  }
  if (todoTasks.length === 0) return null;

  const limited = todoTasks.slice(0, 80);
  const todoCsv = tasksToCompactCsv(limited);

  const prioritizedTasks = backlog.tasks.filter(
    (t) => t.id && t.description && ['Prioritized', 'Pre-Pro Ready'].includes(t.status)
  );
  const prioritizedCsv = tasksToCompactCsv(prioritizedTasks);

  const prompt = loadPrompt('prioritize', {
    taskCount: String(limited.length),
    groupFilter: group ? ` filtered to group "${group}"` : '',
    todoCsv,
    prioritizedCount: String(prioritizedTasks.length),
    prioritizedCsv,
  });

  let raw: string | null = null;
  if (cache) {
    raw = getCached('prioritize', prompt) ?? getLastCached('prioritize');
  }
  if (!raw) {
    raw = await runClaudeCollectRaw(prompt, model);
    if (!raw) return null;
    saveCache('prioritize', prompt, raw);
  }

  return enrichWithScores(parseGroomResponse(raw), backlog);
}

export async function apiFindDuplicates(
  backlog: BacklogData,
  cache?: boolean,
  model?: string
): Promise<GroomResult | null> {
  const tasks = backlog.tasks.filter((t) => t.id && t.description);
  const csv = tasksToCompactCsv(tasks);

  const prompt = loadPrompt('duplicates', {
    taskCount: String(tasks.length),
    csv,
    knownDuplicates: backlog.warnings.filter((w) => w.startsWith('Duplicate')).join(', ') || 'none detected by ID',
  });

  let raw: string | null = null;
  if (cache) {
    raw = getCached('duplicates', prompt) ?? getLastCached('duplicates');
  }
  if (!raw) {
    raw = await runClaudeCollectRaw(prompt, model);
    if (!raw) return null;
    saveCache('duplicates', prompt, raw);
  }

  return enrichWithScores(parseGroomResponse(raw), backlog);
}
