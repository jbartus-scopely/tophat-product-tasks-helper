type JiraReadMethod = 'GET' | 'POST';
type JiraFetch = (input: string, init?: RequestInit) => Promise<Response>;
type JiraQueryValue = string | number | boolean | null | undefined;
export interface JiraClientSettings {
    baseUrl?: string;
    email?: string;
    apiToken?: string;
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
    settings?: JiraClientSettings;
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
export declare function loadJiraCredentials(settings?: JiraClientSettings): JiraCredentialsResult;
export declare function jiraReadJson<T>(request: JiraReadRequest, options?: JiraClientOptions): Promise<JiraReadResult<T>>;
export {};
