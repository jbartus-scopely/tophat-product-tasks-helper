import test from 'node:test';
import assert from 'node:assert/strict';
import { searchJiraIssues } from './jiraSearch.js';
const VALID_ENV = {
    JIRA_BASE_URL: 'https://example.atlassian.net/',
    JIRA_EMAIL: 'product@example.com',
    JIRA_API_TOKEN: 'secret-token',
};
test('executes raw JQL search with requested fields and normalizes issue output', async () => {
    const searchRequests = [];
    const result = await searchJiraIssues({
        jql: 'project = EXAMPLE ORDER BY updated DESC',
        sourceSectionId: 'coming',
        sourceSectionTitle: 'Coming soon',
    }, {
        env: VALID_ENV,
        fetchFn: async (input, init) => {
            if (String(input).endsWith('/rest/api/3/field')) {
                return jsonResponse([{ id: 'customfield_12345', name: 'Pod' }]);
            }
            searchRequests.push(captureSearchRequest(input, init));
            return jsonResponse({
                isLast: true,
                issues: [
                    {
                        key: 'EX-1',
                        fields: {
                            summary: 'Ship dashboard',
                            issuetype: { name: 'Story' },
                            status: { name: 'To Do' },
                            priority: { name: 'High' },
                            fixVersions: [{ name: '1.2.0' }],
                            updated: '2026-05-28T10:15:00.000+0000',
                            customfield_12345: { value: 'Pod31' },
                        },
                    },
                ],
            });
        },
    });
    assert.equal(result.ok, true);
    if (!result.ok)
        assert.fail('Expected Jira search to succeed.');
    assert.equal(searchRequests.length, 1);
    assert.equal(searchRequests[0].url, 'https://example.atlassian.net/rest/api/3/search/jql');
    assert.equal(searchRequests[0].method, 'POST');
    assert.deepEqual(searchRequests[0].body, {
        jql: 'project = EXAMPLE ORDER BY updated DESC',
        maxResults: 100,
        fields: ['summary', 'issuetype', 'status', 'priority', 'fixVersions', 'updated', 'customfield_12345'],
    });
    assert.deepEqual(result.issues, [
        {
            key: 'EX-1',
            url: 'https://example.atlassian.net/browse/EX-1',
            summary: 'Ship dashboard',
            issueType: 'Story',
            status: 'To Do',
            priority: 'High',
            fixVersions: ['1.2.0'],
            updated: '2026-05-28T10:15:00.000+0000',
            pod: 'Pod31',
            sourceSectionId: 'coming',
            sourceSectionTitle: 'Coming soon',
        },
    ]);
    assert.deepEqual(result.warnings, []);
});
test('paginates Jira search results up to the 500 issue cap', async () => {
    const searchRequests = [];
    const result = await searchJiraIssues({
        jql: 'project = EXAMPLE',
        sourceSectionId: 'all',
        sourceSectionTitle: 'All Jira',
    }, {
        env: VALID_ENV,
        fetchFn: async (input, init) => {
            if (String(input).endsWith('/rest/api/3/field')) {
                return jsonResponse([{ id: 'customfield_12345', name: 'Pod' }]);
            }
            const request = captureSearchRequest(input, init);
            searchRequests.push(request);
            const pageIndex = searchRequests.length - 1;
            return jsonResponse({
                isLast: false,
                nextPageToken: `page-${pageIndex + 1}`,
                issues: makeIssues(pageIndex * 100, request.body.maxResults),
            });
        },
    });
    assert.equal(result.ok, true);
    if (!result.ok)
        assert.fail('Expected Jira search to succeed.');
    assert.equal(result.issues.length, 500);
    assert.deepEqual(searchRequests.map((request) => request.body.nextPageToken), [
        undefined,
        'page-1',
        'page-2',
        'page-3',
        'page-4',
    ]);
    assert.deepEqual(searchRequests.map((request) => request.body.maxResults), [100, 100, 100, 100, 100]);
});
test('returns missing Pod warning and searches without a Pod field when discovery misses', async () => {
    const searchRequests = [];
    const result = await searchJiraIssues({
        jql: 'project = EXAMPLE',
        sourceSectionId: 'no-pod',
        sourceSectionTitle: 'No Pod',
    }, {
        env: VALID_ENV,
        fetchFn: async (input, init) => {
            if (String(input).endsWith('/rest/api/3/field')) {
                return jsonResponse([]);
            }
            searchRequests.push(captureSearchRequest(input, init));
            return jsonResponse({
                isLast: true,
                issues: [{ key: 'EX-2', fields: { summary: 'No pod field' } }],
            });
        },
    });
    assert.equal(result.ok, true);
    if (!result.ok)
        assert.fail('Expected missing Pod to be non-fatal.');
    assert.deepEqual(searchRequests[0].body.fields, ['summary', 'issuetype', 'status', 'priority', 'fixVersions', 'updated']);
    assert.equal(result.issues[0].pod, '');
    assert.deepEqual(result.warnings, [
        {
            code: 'jira_pod_field_missing',
            message: 'Jira field metadata did not include a field named Pod.',
        },
    ]);
});
test('normalizes null or unexpected Jira field values without throwing', async () => {
    const result = await searchJiraIssues({
        jql: 'project = EXAMPLE',
        sourceSectionId: 'defensive',
        sourceSectionTitle: 'Defensive',
    }, {
        env: VALID_ENV,
        fetchFn: async (input) => {
            if (String(input).endsWith('/rest/api/3/field')) {
                return jsonResponse([{ id: 'customfield_12345', name: 'Pod' }]);
            }
            return jsonResponse({
                isLast: true,
                issues: [
                    {
                        key: 42,
                        fields: {
                            summary: null,
                            issuetype: null,
                            status: null,
                            priority: 123,
                            fixVersions: { name: 'not-an-array' },
                            updated: [],
                            customfield_12345: { unexpected: 'shape' },
                        },
                    },
                ],
            });
        },
    });
    assert.equal(result.ok, true);
    if (!result.ok)
        assert.fail('Expected Jira search to succeed.');
    assert.deepEqual(result.issues[0], {
        key: '',
        url: '',
        summary: '',
        issueType: '',
        status: '',
        priority: '',
        fixVersions: [],
        updated: '',
        pod: '',
        sourceSectionId: 'defensive',
        sourceSectionTitle: 'Defensive',
    });
});
function jsonResponse(body) {
    return new Response(JSON.stringify(body), { status: 200 });
}
function captureSearchRequest(input, init) {
    return {
        url: input,
        method: init?.method || 'GET',
        body: JSON.parse(String(init?.body || '{}')),
    };
}
function makeIssues(startAt, count) {
    return Array.from({ length: count }, (_, index) => {
        const issueNumber = startAt + index + 1;
        return {
            key: `EX-${issueNumber}`,
            fields: {
                summary: `Issue ${issueNumber}`,
                issuetype: { name: 'Story' },
                status: { name: 'Open' },
                priority: { name: 'Medium' },
                fixVersions: [],
                updated: '2026-05-28T10:15:00.000+0000',
                customfield_12345: 'Pod31',
            },
        };
    });
}
//# sourceMappingURL=jiraSearch.test.js.map