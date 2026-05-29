type JiraEnvKey = 'JIRA_BASE_URL' | 'JIRA_EMAIL' | 'JIRA_API_TOKEN';
type JiraReadMethod = 'GET' | 'POST';
type JiraFetch = (input: string, init?: RequestInit) => Promise<Response>;
type JiraQueryValue = string | number | boolean | null | undefined;
export interface JiraClientEnv extends Partial<Record<JiraEnvKey, string | undefined>> {
}
export interface JiraCredentials {
    baseUrl: string;
    email: string;
    apiToken: string;
}
export interface JiraReadRequest {
    path: string;
    method?: JiraReadMethod;
    query?: Record<string, JiraQueryValue | JiraQueryValue[]>;
    body?: unknown;
}
export interface JiraClientOptions {
    env?: JiraClientEnv;
    fetchFn?: JiraFetch;
}
export interface JiraRequestError {
    code: string;
    message: string;
    status?: number;
    details?: string[];
}
export type JiraCredentialsResult = {
    ok: true;
    credentials: JiraCredentials;
} | {
    ok: false;
    error: JiraRequestError;
};
export type JiraReadResult<T> = {
    ok: true;
    data: T;
    status: number;
} | {
    ok: false;
    error: JiraRequestError;
};
export declare function loadJiraCredentials(env?: JiraClientEnv): JiraCredentialsResult;
export declare function jiraReadJson<T>(request: JiraReadRequest, options?: JiraClientOptions): Promise<JiraReadResult<T>>;
export {};
