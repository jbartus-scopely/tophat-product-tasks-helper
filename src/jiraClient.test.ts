import test from 'node:test';
import assert from 'node:assert/strict';
import * as jiraClient from './jiraClient.js';
import {
  jiraReadJson,
  loadJiraCredentials,
  type JiraClientEnv,
} from './jiraClient.js';

const VALID_ENV: JiraClientEnv = {
  JIRA_BASE_URL: 'https://example.atlassian.net/',
  JIRA_EMAIL: 'product@example.com',
  JIRA_API_TOKEN: 'secret-token',
};

test('loads Jira credentials from required environment variables', () => {
  const result = loadJiraCredentials(VALID_ENV);

  assert.equal(result.ok, true);
  if (!result.ok) assert.fail('Expected Jira credentials to load.');
  assert.deepEqual(result.credentials, {
    baseUrl: 'https://example.atlassian.net',
    email: 'product@example.com',
    apiToken: 'secret-token',
  });
});

test('returns a structured error before network calls when required env is missing', async () => {
  let called = false;
  const result = await jiraReadJson(
    { path: '/rest/api/3/field' },
    {
      env: { JIRA_BASE_URL: 'https://example.atlassian.net', JIRA_EMAIL: 'product@example.com' },
      fetchFn: async () => {
        called = true;
        return new Response('{}');
      },
    },
  );

  assert.equal(called, false);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Expected missing env to fail.');
  assert.equal(result.error.code, 'jira_env_missing');
  assert.deepEqual(result.error.details, ['JIRA_API_TOKEN']);
});

test('applies Basic auth in the server-side request helper', async () => {
  let requestedUrl = '';
  let authorization = '';
  const result = await jiraReadJson<{ ok: boolean }>(
    { path: '/rest/api/3/field', query: { maxResults: 50 } },
    {
      env: VALID_ENV,
      fetchFn: async (input, init) => {
        requestedUrl = input;
        authorization = String(new Headers(init?.headers).get('Authorization'));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    },
  );

  const expectedAuth = `Basic ${Buffer.from('product@example.com:secret-token').toString('base64')}`;
  assert.equal(result.ok, true);
  assert.equal(requestedUrl, 'https://example.atlassian.net/rest/api/3/field?maxResults=50');
  assert.equal(authorization, expectedAuth);
});

test('returns sanitized errors for Jira HTTP failures', async () => {
  const result = await jiraReadJson(
    { path: '/rest/api/3/field' },
    {
      env: VALID_ENV,
      fetchFn: async () => new Response('Authorization secret-token product@example.com', {
        status: 401,
        statusText: 'Unauthorized',
      }),
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Expected Jira HTTP failure.');
  const serialized = JSON.stringify(result.error);
  assert.equal(result.error.code, 'jira_request_failed');
  assert.equal(result.error.status, 401);
  assert.doesNotMatch(serialized, /secret-token/);
  assert.doesNotMatch(serialized, /product@example\.com/);
  assert.doesNotMatch(serialized, /Authorization/i);
});

test('returns sanitized errors for network failures', async () => {
  const result = await jiraReadJson(
    { path: '/rest/api/3/field' },
    {
      env: VALID_ENV,
      fetchFn: async () => {
        throw new Error('secret-token product@example.com Authorization');
      },
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Expected Jira network failure.');
  const serialized = JSON.stringify(result.error);
  assert.equal(result.error.code, 'jira_network_error');
  assert.doesNotMatch(serialized, /secret-token/);
  assert.doesNotMatch(serialized, /product@example\.com/);
  assert.doesNotMatch(serialized, /Authorization/i);
});

test('exposes read-oriented helpers without mutation-specific exports', () => {
  const exports = Object.keys(jiraClient).join(' ');

  assert.match(exports, /jiraReadJson/);
  assert.doesNotMatch(exports, /create|edit|transition|assign|comment|delete/i);
});

test('rejects mutation HTTP methods before network calls', async () => {
  let called = false;
  const result = await jiraReadJson(
    { path: '/rest/api/3/issue/ABC-1', method: 'DELETE' as any },
    {
      env: VALID_ENV,
      fetchFn: async () => {
        called = true;
        return new Response('{}');
      },
    },
  );

  assert.equal(called, false);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('Expected mutation method to fail.');
  assert.equal(result.error.code, 'jira_method_not_allowed');
});
