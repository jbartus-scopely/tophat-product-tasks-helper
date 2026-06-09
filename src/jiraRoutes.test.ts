import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';
import type { JiraIssueSearchParams } from './jiraSearch.js';
import type { JiraClientOptions } from './jiraClient.js';
import type { JiraSavedSection } from './types.js';

const VALID_SETTINGS = {
  baseUrl: 'https://example.atlassian.net/',
  email: 'product@example.com',
  apiToken: 'secret-token',
};

const NORMALIZED_SETTINGS = {
  baseUrl: 'https://example.atlassian.net',
  email: 'product@example.com',
  apiToken: 'secret-token',
};

const SECTIONS: JiraSavedSection[] = [
  {
    id: 'coming',
    title: 'Coming soon',
    jql: 'project = EXAMPLE ORDER BY updated DESC',
  },
];

test('returns saved Jira sections without requiring a loaded backlog', async () => {
  const app = createApp({
    jiraConfigLoader: () => ({ ok: true, sections: SECTIONS }),
  });

  const response = await app.request('/api/jira/sections');
  const body = await response.json();
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.deepEqual(body, { sections: SECTIONS });
  assert.doesNotMatch(serialized, /secret-token/);
});

test('executes saved Jira sections and returns issues by section', async () => {
  const seenParams: JiraIssueSearchParams[] = [];
  const seenOptions: Array<JiraClientOptions | undefined> = [];
  const app = createApp({
    jiraConfigLoader: () => ({ ok: true, sections: SECTIONS }),
    jiraIssueSearcher: async (params, options) => {
      seenParams.push(params);
      seenOptions.push(options);
      return {
        ok: true,
        issues: [
          {
            key: 'EX-1',
            url: 'https://example.atlassian.net/browse/EX-1',
            summary: 'Ship dashboard',
            issueType: 'Story',
            status: 'To Do',
            priority: 'High',
            fixVersions: ['1.2.0'],
            labels: ['dashboard'],
            updated: '2026-05-28T10:15:00.000+0000',
            pod: 'Pod31',
            sourceSectionId: params.sourceSectionId,
            sourceSectionTitle: params.sourceSectionTitle,
          },
        ],
        warnings: [],
      };
    },
  });

  const response = await app.request('/api/jira/sections/search', {
    method: 'POST',
    body: JSON.stringify({ settings: VALID_SETTINGS }),
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(seenParams, [
    {
      jql: 'project = EXAMPLE ORDER BY updated DESC',
      sourceSectionId: 'coming',
      sourceSectionTitle: 'Coming soon',
    },
  ]);
  assert.deepEqual(seenOptions, [{ settings: NORMALIZED_SETTINGS }]);
  assert.equal(body.sections[0].id, 'coming');
  assert.equal(body.sections[0].issues[0].sourceSectionId, 'coming');
  assert.equal(body.sections[0].issues[0].sourceSectionTitle, 'Coming soon');
});

test('rejects missing Jira settings before executing saved sections', async () => {
  let called = false;
  const app = createApp({
    jiraConfigLoader: () => ({ ok: true, sections: SECTIONS }),
    jiraIssueSearcher: async () => {
      called = true;
      return { ok: true, issues: [], warnings: [] };
    },
  });

  const response = await app.request('/api/jira/sections/search', {
    method: 'POST',
    body: JSON.stringify({
      settings: {
        baseUrl: 'https://example.atlassian.net',
        email: 'product@example.com',
      },
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.match(body.error, /Missing required Jira setting/);
  assert.deepEqual(body.details, ['apiToken']);
});

test('executes ad hoc JQL from the request body', async () => {
  let seenParams: JiraIssueSearchParams | null = null;
  let seenOptions: JiraClientOptions | undefined;
  const app = createApp({
    jiraIssueSearcher: async (params, options) => {
      seenParams = params;
      seenOptions = options;
      return { ok: true, issues: [], warnings: [] };
    },
  });

  const response = await app.request('/api/jira/search', {
    method: 'POST',
    body: JSON.stringify({ jql: 'project = EXAMPLE', settings: VALID_SETTINGS }),
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(seenParams, {
    jql: 'project = EXAMPLE',
    sourceSectionId: 'ad-hoc',
    sourceSectionTitle: 'Ad hoc JQL',
  });
  assert.deepEqual(seenOptions, { settings: NORMALIZED_SETTINGS });
  assert.deepEqual(body, { issues: [], warnings: [] });
});

test('returns JSON error objects for Jira route failures', async () => {
  const app = createApp({
    jiraConfigLoader: () => ({
      ok: false,
      error: {
        code: 'config_missing',
        message: 'Saved Jira sections config file was not found.',
        path: '/tmp/missing.json',
      },
    }),
  });

  const response = await app.request('/api/jira/sections');
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: 'Saved Jira sections config file was not found.' });
});

test('does not include Jira token values in Jira error responses', async () => {
  const app = createApp({
    jiraIssueSearcher: async () => ({
      ok: false,
      error: {
        code: 'jira_request_failed',
        message: 'Authorization failed for secret-token and product@example.com.',
        status: 401,
        details: ['secret-token', 'product@example.com'],
      },
    }),
  });

  const response = await app.request('/api/jira/search', {
    method: 'POST',
    body: JSON.stringify({ jql: 'project = EXAMPLE', settings: VALID_SETTINGS }),
    headers: { 'Content-Type': 'application/json' },
  });
  const serialized = JSON.stringify(await response.json());

  assert.equal(response.status, 400);
  assert.doesNotMatch(serialized, /secret-token/);
  assert.doesNotMatch(serialized, /product@example.com/);
  assert.doesNotMatch(serialized, /Authorization/i);
  assert.match(serialized, /error/);
});

test('returns non-fatal Pod warnings with empty Pod values', async () => {
  const app = createApp({
    jiraConfigLoader: () => ({ ok: true, sections: SECTIONS }),
    jiraIssueSearcher: async (params) => ({
      ok: true,
      issues: [
        {
          key: 'EX-2',
          url: 'https://example.atlassian.net/browse/EX-2',
          summary: 'No pod field',
          issueType: 'Story',
          status: 'Open',
          priority: '',
          fixVersions: [],
          labels: [],
          updated: '2026-05-28T10:15:00.000+0000',
          pod: '',
          sourceSectionId: params.sourceSectionId,
          sourceSectionTitle: params.sourceSectionTitle,
        },
      ],
      warnings: [
        {
          code: 'jira_pod_field_missing',
          message: 'Jira field metadata did not include a field named Pod.',
        },
      ],
    }),
  });

  const response = await app.request('/api/jira/sections/search', {
    method: 'POST',
    body: JSON.stringify({ settings: VALID_SETTINGS }),
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.sections[0].issues[0].pod, '');
  assert.deepEqual(body.sections[0].warnings, [
    {
      code: 'jira_pod_field_missing',
      message: 'Jira field metadata did not include a field named Pod.',
    },
  ]);
});
