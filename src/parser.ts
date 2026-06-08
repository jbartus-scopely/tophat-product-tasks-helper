import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import {
  CSV_REQUIRED_FIELDS,
  CSV_VALID_PRIORITIES,
  CSV_VALID_STATUSES,
  type Task,
  type BacklogData,
  type ScoreBreakdown,
} from './types.js';

const HEADER_MAP: Record<string, keyof Task> = {
  'Date': 'date',
  'JIRA': 'jira',
  'JIRA ': 'jira',
  'ID': 'id',
  'Reporter': 'reporter',
  'Description/Problem': 'description',
  'Priority': 'priority',
  'Status': 'status',
  'Initiative': 'initiative',
  'Priority pod': 'priorityPod',
  'Comments': 'comments',
};

const REQUIRED_FIELD_KEYS: Record<(typeof CSV_REQUIRED_FIELDS)[number], keyof Task> = {
  ID: 'id',
  'Description/Problem': 'description',
  Status: 'status',
};

const VALID_PRIORITIES = new Set<string>(CSV_VALID_PRIORITIES);
const VALID_STATUSES = new Set<string>(CSV_VALID_STATUSES);

const emptyBreakdown: ScoreBreakdown = {
  priority: 0,
  status: 0,
  prepro: 0,
  risk: 0,
  appearance: 0,
  type: 0,
  metadataQuality: 0,
};

function normalize(val: string): string {
  if (!val) return '';
  const trimmed = val.trim().replace(/\s+/g, ' ');
  if (/^n\/?a$/i.test(trimmed)) return '';
  return trimmed;
}

function recordValue(record: Record<string, string>, csvCol: string): string {
  return record[csvCol] ?? record[csvCol.trim()] ?? '';
}

function isEmptyTask(task: Pick<Task, 'date' | 'jira' | 'id' | 'reporter' | 'description' | 'priority' | 'status' | 'initiative' | 'priorityPod' | 'comments'>): boolean {
  return !task.date &&
    !task.jira &&
    !task.id &&
    !task.reporter &&
    !task.description &&
    !task.priority &&
    !task.status &&
    !task.initiative &&
    !task.priorityPod &&
    !task.comments;
}

function validateTask(task: Task, rowNumber: number, warnings: string[]): void {
  for (const field of CSV_REQUIRED_FIELDS) {
    const key = REQUIRED_FIELD_KEYS[field];
    if (!task[key]) warnings.push(`Missing ${field} on row ${rowNumber}`);
  }

  if (task.priority && !VALID_PRIORITIES.has(task.priority)) {
    warnings.push(`Invalid Priority "${task.priority}" on row ${rowNumber}; expected P0, P1, or P2`);
  }

  if (task.status && !VALID_STATUSES.has(task.status)) {
    warnings.push(`Invalid Status "${task.status}" on row ${rowNumber}; expected TRIAGE, TODO, Prioritized, or HOLD`);
  }
}

export function parseBacklog(filePath: string): BacklogData {
  return parseBacklogFromString(readFileSync(filePath, 'utf-8'));
}

export function parseBacklogFromString(raw: string): BacklogData {
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  const warnings: string[] = [];
  const idCount = new Map<string, number>();
  const tasks: Task[] = [];
  let totalRaw = 0;
  let filtered = 0;

  for (const record of records) {
    totalRaw++;

    const mapped: Partial<Task> = {};
    for (const [csvCol, taskKey] of Object.entries(HEADER_MAP)) {
      const value = recordValue(record, csvCol);
      (mapped as any)[taskKey] = normalize(value);
    }

    const id = mapped.id || '';

    // Skip #NUM! rows
    if (id === '#NUM!' || id.startsWith('#NUM')) {
      filtered++;
      continue;
    }

    const task: Task = {
      date: mapped.date || '',
      jira: mapped.jira || '',
      id,
      reporter: mapped.reporter || '',
      description: mapped.description || '',
      initiative: mapped.initiative || '',
      priorityPod: mapped.priorityPod || '',
      priority: mapped.priority || '',
      status: mapped.status || '',
      comments: mapped.comments || '',
      group: mapped.initiative || '',
      ckNote: '',
      type: '',
      preproWork: '',
      liveVersion: '',
      appearance: '',
      source: '',
      risk: '',
      assignedPod: mapped.priorityPod || '',
      ptOwner: '',
      fo: '',
      uxDesign: '',
      gdUxNeed: '',
      solutionLinks: '',
      score: 0,
      scoreBreakdown: { ...emptyBreakdown },
    };

    if (isEmptyTask(task)) {
      filtered++;
      continue;
    }

    if (id) {
      idCount.set(id, (idCount.get(id) || 0) + 1);
    }

    validateTask(task, totalRaw + 1, warnings);
    tasks.push(task);
  }

  const duplicateIds = new Map<string, number>();
  for (const [id, count] of idCount) {
    if (count > 1) {
      duplicateIds.set(id, count);
      warnings.push(`Duplicate ID: ${id} appears ${count} times`);
    }
  }

  return { tasks, duplicateIds, warnings, totalRaw, filtered };
}
