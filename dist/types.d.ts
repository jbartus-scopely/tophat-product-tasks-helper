export interface Task {
    date: string;
    jira: string;
    id: string;
    reporter: string;
    description: string;
    initiative: string;
    priorityPod: string;
    priority: string;
    status: string;
    comments: string;
    group: string;
    ckNote: string;
    type: string;
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
export interface JiraSavedSection {
    id: string;
    title: string;
    jql: string;
}
export interface JiraWarning {
    code: string;
    message: string;
}
export interface JiraNormalizedIssue {
    key: string;
    url: string;
    summary: string;
    issueType: string;
    status: string;
    priority: string;
    fixVersions: string[];
    labels: string[];
    updated: string;
    pod: string;
    sourceSectionId: string;
    sourceSectionTitle: string;
}
export interface JiraSavedSectionsResponse {
    sections: JiraSavedSection[];
    warnings?: JiraWarning[];
}
export interface JiraIssueSearchResponse {
    issues: JiraNormalizedIssue[];
    warnings: JiraWarning[];
}
export interface JiraApiErrorResponse {
    error: string;
    details?: string[];
}
export interface JiraConfigError {
    code: string;
    message: string;
    path: string;
    details?: string[];
}
export type JiraSavedSectionsConfigResult = {
    ok: true;
    sections: JiraSavedSection[];
} | {
    ok: false;
    error: JiraConfigError;
};
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
export declare const PRIORITY_ORDER: readonly ["P0", "P1", "P2", ""];
export declare const CSV_DISPLAY_COLUMNS: readonly ["ID", "JIRA", "Description/Problem", "Priority", "Status", "Initiative", "Priority pod", "Reporter", "Date", "Comments"];
export declare const CSV_REQUIRED_FIELDS: readonly ["ID", "Description/Problem", "Status"];
export declare const CSV_VALID_PRIORITIES: readonly ["P0", "P1", "P2"];
export declare const CSV_VALID_STATUSES: readonly ["TRIAGE", "TODO", "Prioritized", "HOLD"];
export declare const STATUS_ORDER: readonly ["Prioritized", "Pre-Pro Ready", "Ready for release", "Prepro-In Progress", "TODO", "Pod Working", "BLOCK", "TRIAGE", "HOLD", "Live", ""];
export declare const PREPRO_VALUES: readonly ["0 - Low", "1 - Mid", "2 - High"];
export declare const RISK_VALUES: readonly ["Low", "High"];
export declare const APPEARANCE_VALUES: readonly ["All Sessions", "Daily", "Sometimes", "Uncommon"];
