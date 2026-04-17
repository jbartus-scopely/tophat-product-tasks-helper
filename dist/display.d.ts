import type { Task, BacklogData, GroomedTask } from './types.js';
export declare function printBanner(backlog: BacklogData): void;
export declare function printWarnings(backlog: BacklogData): void;
export declare function printStats(backlog: BacklogData): void;
export declare function printTaskTable(tasks: Task[], title: string, options?: {
    showGroup?: boolean;
}): void;
export declare function printTaskDetail(task: Task): void;
export declare function printGroomTable(tasks: GroomedTask[]): void;
export declare function printGroomProse(text: string): void;
export declare function printAnalyzeTable(tasks: GroomedTask[], backlog?: BacklogData): void;
export declare function printAnalyzeProse(text: string): void;
export declare function printPrioritizeTable(tasks: GroomedTask[]): void;
export declare function printPrioritizeProse(text: string): void;
export declare function printCsv(tasks: Task[], filePath?: string): void;
export declare function printGroomCsv(tasks: GroomedTask[], backlog?: BacklogData, filePath?: string): void;
export declare function printTaskDetailCsv(task: Task, filePath?: string): void;
export declare function printStatsCsv(backlog: BacklogData, filePath?: string): void;
export declare function printAiResponse(text: string): void;
