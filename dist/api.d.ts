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
export declare function getCategoryStatuses(category: string): string[];
export declare function loadBacklog(csvContent: string): BacklogData;
export declare function computeStats(backlog: BacklogData): StatsResponse;
export declare function getGroups(backlog: BacklogData): string[];
export declare function getPods(backlog: BacklogData): string[];
export declare function filterTasks(backlog: BacklogData, category: string, group?: string, limit?: number, priority?: string, pod?: string, status?: string): TasksResponse;
export declare function getScoreMap(backlog: BacklogData): Record<string, number>;
export declare function getTask(backlog: BacklogData, id: string): Task | undefined;
export declare function isAiAvailable(): boolean;
export declare function apiAnalyze(backlog: BacklogData, ask: string, group?: string, model?: string): Promise<GroomResult | null>;
export declare function apiGroom(backlog: BacklogData, group?: string, cache?: boolean, model?: string): Promise<GroomResult | null>;
export declare function apiPrioritize(backlog: BacklogData, group?: string, cache?: boolean, model?: string): Promise<GroomResult | null>;
export declare function apiFindDuplicates(backlog: BacklogData, cache?: boolean, model?: string): Promise<GroomResult | null>;
