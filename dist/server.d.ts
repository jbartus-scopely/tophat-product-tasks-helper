import { Hono } from 'hono';
import { type JiraIssueSearchParams, type JiraIssueSearchResult } from './jiraSearch.js';
import type { JiraSavedSectionsConfigResult } from './types.js';
type JiraConfigLoader = () => JiraSavedSectionsConfigResult;
type JiraIssueSearcher = (params: JiraIssueSearchParams) => Promise<JiraIssueSearchResult>;
export interface ServerAppOptions {
    jiraConfigLoader?: JiraConfigLoader;
    jiraIssueSearcher?: JiraIssueSearcher;
}
export declare function createApp(options?: ServerAppOptions): Hono;
export declare function startServer(port: number, _filePath?: string): void;
export {};
