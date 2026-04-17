import type { BacklogData, GroomResult } from './types.js';
export declare function checkAiAvailable(): boolean;
export declare function printAiUnavailable(): void;
export declare function analyzeBacklog(backlog: BacklogData, ask: string, group?: string): Promise<GroomResult | null>;
export declare function groomTasks(backlog: BacklogData, group?: string, verbose?: boolean, cache?: boolean): Promise<GroomResult | null>;
export declare function prioritizeTasks(backlog: BacklogData, group?: string, verbose?: boolean, cache?: boolean): Promise<GroomResult | null>;
export declare function findDuplicates(backlog: BacklogData, cache?: boolean): Promise<void>;
