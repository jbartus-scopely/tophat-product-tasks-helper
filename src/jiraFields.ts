import { jiraReadJson, type JiraClientOptions, type JiraRequestError } from './jiraClient.js';
import type { JiraWarning } from './types.js';

interface JiraFieldMetadata {
  id?: unknown;
  name?: unknown;
}

export type JiraPodFieldDiscoveryResult =
  | { ok: true; fieldId: string | null; warnings: JiraWarning[] }
  | { ok: false; error: JiraRequestError };

const JIRA_FIELD_METADATA_PATH = '/rest/api/3/field';
const POD_FIELD_NAME = 'Pod';

export async function discoverJiraPodField(
  options: JiraClientOptions = {},
): Promise<JiraPodFieldDiscoveryResult> {
  const result = await jiraReadJson<unknown>(pickFieldMetadataRequest(), options);
  if (!result.ok) return result;

  if (!Array.isArray(result.data)) {
    return {
      ok: false,
      error: {
        code: 'jira_field_metadata_invalid',
        message: 'Jira field metadata response was not an array.',
      },
    };
  }

  const podField = result.data.find(isPodField);
  if (!podField) {
    return {
      ok: true,
      fieldId: null,
      warnings: [podFieldMissingWarning()],
    };
  }

  return {
    ok: true,
    fieldId: podField.id,
    warnings: [],
  };
}

function pickFieldMetadataRequest() {
  return { path: JIRA_FIELD_METADATA_PATH };
}

function isPodField(value: unknown): value is { id: string; name: typeof POD_FIELD_NAME } {
  if (!isRecord(value)) return false;
  return value.name === POD_FIELD_NAME && typeof value.id === 'string' && value.id.trim().length > 0;
}

function podFieldMissingWarning(): JiraWarning {
  return {
    code: 'jira_pod_field_missing',
    message: 'Jira field metadata did not include a field named Pod.',
  };
}

function isRecord(value: unknown): value is JiraFieldMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
