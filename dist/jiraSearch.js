import { jiraReadJson, loadJiraCredentials, } from './jiraClient.js';
import { discoverJiraPodField } from './jiraFields.js';
const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const SEARCH_PAGE_SIZE = 100;
const SEARCH_ISSUE_CAP = 500;
const BASE_SEARCH_FIELDS = ['summary', 'issuetype', 'status', 'priority', 'fixVersions', 'updated'];
export async function searchJiraIssues(params, options = {}) {
    const credentialsResult = loadJiraCredentials(options.env);
    if (!credentialsResult.ok)
        return credentialsResult;
    const podFieldResult = await discoverJiraPodField(options);
    if (!podFieldResult.ok)
        return podFieldResult;
    const fields = getSearchFields(podFieldResult.fieldId);
    const issues = [];
    let nextPageToken = '';
    while (issues.length < SEARCH_ISSUE_CAP) {
        const maxResults = Math.min(SEARCH_PAGE_SIZE, SEARCH_ISSUE_CAP - issues.length);
        const body = {
            jql: params.jql,
            maxResults,
            fields,
        };
        if (nextPageToken)
            body.nextPageToken = nextPageToken;
        const result = await jiraReadJson({
            path: JIRA_SEARCH_PATH,
            method: 'POST',
            body,
        }, options);
        if (!result.ok)
            return result;
        const pageIssues = Array.isArray(result.data.issues) ? result.data.issues : [];
        for (const issue of pageIssues) {
            issues.push(normalizeJiraIssue(issue, params, credentialsResult.credentials.baseUrl, podFieldResult.fieldId));
            if (issues.length >= SEARCH_ISSUE_CAP)
                break;
        }
        nextPageToken = readNextPageToken(result.data);
        if (shouldStopPaging(result.data, pageIssues.length, nextPageToken))
            break;
    }
    return {
        ok: true,
        issues,
        warnings: podFieldResult.warnings,
    };
}
function getSearchFields(podFieldId) {
    return podFieldId ? [...BASE_SEARCH_FIELDS, podFieldId] : [...BASE_SEARCH_FIELDS];
}
function shouldStopPaging(payload, pageIssueCount, nextPageToken) {
    if (pageIssueCount === 0)
        return true;
    if (payload.isLast === true)
        return true;
    return !nextPageToken;
}
function readNextPageToken(payload) {
    return typeof payload.nextPageToken === 'string' ? payload.nextPageToken.trim() : '';
}
function normalizeJiraIssue(value, params, baseUrl, podFieldId) {
    const issue = isRecord(value) ? value : {};
    const key = readString(issue.key);
    const fields = isRecord(issue.fields) ? issue.fields : {};
    return {
        key,
        url: key ? `${baseUrl}/browse/${encodeURIComponent(key)}` : '',
        summary: readString(fields.summary),
        issueType: readNamedValue(fields.issuetype),
        status: readNamedValue(fields.status),
        priority: readNamedValue(fields.priority),
        fixVersions: readFixVersions(fields.fixVersions),
        updated: readString(fields.updated),
        pod: podFieldId ? readDisplayValue(fields[podFieldId]) : '',
        sourceSectionId: params.sourceSectionId,
        sourceSectionTitle: params.sourceSectionTitle,
    };
}
function readFixVersions(value) {
    if (!Array.isArray(value))
        return [];
    return value.map(readDisplayValue).filter((item) => item.length > 0);
}
function readNamedValue(value) {
    if (typeof value === 'string')
        return value;
    if (!isRecord(value))
        return '';
    return readString(value.name);
}
function readDisplayValue(value) {
    if (typeof value === 'string')
        return value;
    if (!isRecord(value))
        return '';
    const name = readString(value.name);
    if (name)
        return name;
    return readString(value.value);
}
function readString(value) {
    return typeof value === 'string' ? value : '';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=jiraSearch.js.map