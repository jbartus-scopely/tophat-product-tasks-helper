import { type JiraClientOptions, type JiraRequestError } from './jiraClient.js';
import type { JiraNormalizedIssue, JiraWarning } from './types.js';
export interface JiraIssueSearchParams {
    jql: string;
    sourceSectionId: string;
    sourceSectionTitle: string;
}
export type JiraIssueSearchResult = {
    ok: true;
    issues: JiraNormalizedIssue[];
    warnings: JiraWarning[];
} | {
    ok: false;
    error: JiraRequestError;
};
export declare function searchJiraIssues(params: JiraIssueSearchParams, options?: JiraClientOptions): Promise<JiraIssueSearchResult>;
