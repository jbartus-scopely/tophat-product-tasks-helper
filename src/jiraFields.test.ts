import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverJiraPodField } from './jiraFields.js';
import type { JiraClientEnv } from './jiraClient.js';

const VALID_ENV: JiraClientEnv = {
  JIRA_BASE_URL: 'https://example.atlassian.net/',
  JIRA_EMAIL: 'product@example.com',
  JIRA_API_TOKEN: 'secret-token',
};

test('discovers the Pod field id through Jira field metadata', async () => {
  let requestedUrl = '';
  const result = await discoverJiraPodField({
    env: VALID_ENV,
    fetchFn: async (input) => {
      requestedUrl = input;
      return new Response(JSON.stringify([
        { id: 'summary', name: 'Summary' },
        { id: 'customfield_12345', name: 'Pod' },
      ]));
    },
  });

  assert.equal(requestedUrl, 'https://example.atlassian.net/rest/api/3/field');
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail('Expected Pod discovery to succeed.');
  assert.equal(result.fieldId, 'customfield_12345');
  assert.deepEqual(result.warnings, []);
});

test('matches only an exact Pod field name', async () => {
  const result = await discoverJiraPodField({
    env: VALID_ENV,
    fetchFn: async () => new Response(JSON.stringify([
      { id: 'customfield_lower', name: 'pod' },
      { id: 'customfield_spaced', name: 'Pod ' },
    ])),
  });

  assert.equal(result.ok, true);
  if (!result.ok) assert.fail('Expected missing Pod to be non-fatal.');
  assert.equal(result.fieldId, null);
  assert.equal(result.warnings[0].code, 'jira_pod_field_missing');
});

test('returns a non-fatal warning when Pod metadata is missing', async () => {
  const result = await discoverJiraPodField({
    env: VALID_ENV,
    fetchFn: async () => new Response(JSON.stringify([
      { id: 'customfield_11111', name: 'Team' },
    ])),
  });

  assert.equal(result.ok, true);
  if (!result.ok) assert.fail('Expected missing Pod to be non-fatal.');
  assert.equal(result.fieldId, null);
  assert.deepEqual(result.warnings, [
    {
      code: 'jira_pod_field_missing',
      message: 'Jira field metadata did not include a field named Pod.',
    },
  ]);
});

test('does not include Jira credentials in discovery output', async () => {
  const result = await discoverJiraPodField({
    env: VALID_ENV,
    fetchFn: async () => new Response(JSON.stringify([])),
  });

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /secret-token/);
  assert.doesNotMatch(serialized, /product@example\.com/);
  assert.doesNotMatch(serialized, /Authorization/i);
});
