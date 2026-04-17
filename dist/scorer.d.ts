import type { Task, ScoreBreakdown, BacklogData } from './types.js';
export declare function scoreTask(task: Task, duplicateIds: Map<string, number>): ScoreBreakdown;
export declare function totalScore(breakdown: ScoreBreakdown): number;
export declare function scoreTasks(backlog: BacklogData): Task[];
export declare const MAX_SCORE: number;
