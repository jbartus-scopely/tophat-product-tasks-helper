import { type JiraClientOptions, type JiraRequestError } from './jiraClient.js';
import type { JiraWarning } from './types.js';
export type JiraPodFieldDiscoveryResult = {
    ok: true;
    fieldId: string | null;
    warnings: JiraWarning[];
} | {
    ok: false;
    error: JiraRequestError;
};
export declare function discoverJiraPodField(options?: JiraClientOptions): Promise<JiraPodFieldDiscoveryResult>;
