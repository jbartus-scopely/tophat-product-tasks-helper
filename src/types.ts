export interface Task {
  jira: string;
  id: string;
  reporter: string;
  description: string;
  group: string;
  ckNote: string;
  priority: string;
  type: string;
  status: string;
  preproWork: string;
  liveVersion: string;
  appearance: string;
  source: string;
  risk: string;
  assignedPod: string;
  ptOwner: string;
  fo: string;
  uxDesign: string;
  gdUxNeed: string;
  solutionLinks: string;
  comments: string;
  // Computed fields
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  priority: number;
  status: number;
  prepro: number;
  risk: number;
  appearance: number;
  type: number;
  metadataQuality: number;
}

export interface BacklogData {
  tasks: Task[];
  duplicateIds: Map<string, number>;
  warnings: string[];
  totalRaw: number;
  filtered: number;
}

export interface FilterOptions {
  status?: string[];
  priority?: string[];
  group?: string[];
  excludeStatus?: string[];
  excludeLive?: boolean;
  excludeHold?: boolean;
  minScore?: number;
  limit?: number;
  search?: string;
}

export interface GroomedTask {
  taskId: string;
  aiDescription: string;
  aiPriority: string;
  aiAction: string;
  aiNotes: string;
  aiGroup: string;
}

export interface GroomResult {
  tasks: GroomedTask[];
  prose: string;
}

export const PRIORITY_ORDER = ['P0', 'P1', 'P2', ''] as const;

export const STATUS_ORDER = [
  'Prioritized',
  'Pre-Pro Ready',
  'Ready for release',
  'Prepro-In Progress',
  'TODO',
  'Pod Working',
  'BLOCK',
  'TRIAGE',
  'HOLD',
  'Live',
  '',
] as const;

export const PREPRO_VALUES = ['0 - Low', '1 - Mid', '2 - High'] as const;
export const RISK_VALUES = ['Low', 'High'] as const;
export const APPEARANCE_VALUES = ['All Sessions', 'Daily', 'Sometimes', 'Uncommon'] as const;
