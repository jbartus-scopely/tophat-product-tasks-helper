import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  JiraConfigError,
  JiraSavedSection,
  JiraSavedSectionsConfigResult,
} from './types.js';

export const JIRA_SAVED_SECTIONS_CONFIG_PATH = resolve(
  process.cwd(),
  'config',
  'jira-saved-sections.json',
);

export function loadJiraSavedSectionsConfig(
  filePath = JIRA_SAVED_SECTIONS_CONFIG_PATH,
): JiraSavedSectionsConfigResult {
  if (!existsSync(filePath)) {
    return configError('config_missing', 'Saved Jira sections config file was not found.', filePath);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return configError('config_malformed', 'Saved Jira sections config file is not valid JSON.', filePath);
  }

  return parseJiraSavedSectionsConfig(parsed, filePath);
}

export function parseJiraSavedSectionsConfig(
  value: unknown,
  filePath = JIRA_SAVED_SECTIONS_CONFIG_PATH,
): JiraSavedSectionsConfigResult {
  const sectionValues = getSectionValues(value);
  if (!sectionValues) {
    return configError(
      'config_invalid',
      'Saved Jira sections config must be an array or an object with a sections array.',
      filePath,
    );
  }

  const sections: JiraSavedSection[] = [];
  const details: string[] = [];

  sectionValues.forEach((section, index) => {
    const result = parseSavedSection(section, index);
    if (typeof result === 'string') {
      details.push(result);
    } else {
      sections.push(result);
    }
  });

  if (details.length > 0) {
    return configError('config_invalid', 'Saved Jira sections config contains invalid sections.', filePath, details);
  }

  return { ok: true, sections };
}

function getSectionValues(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.sections)) return value.sections;
  return null;
}

function parseSavedSection(value: unknown, index: number): JiraSavedSection | string {
  if (!isRecord(value)) {
    return `sections[${index}] must be an object.`;
  }

  const id = readRequiredString(value, 'id');
  const title = readRequiredString(value, 'title');
  const jql = readRequiredString(value, 'jql');
  const missing = [
    !id ? 'id' : '',
    !title ? 'title' : '',
    !jql ? 'jql' : '',
  ].filter(Boolean);

  if (missing.length > 0) {
    return `sections[${index}] is missing required field(s): ${missing.join(', ')}.`;
  }

  return { id, title, jql };
}

function readRequiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  return typeof field === 'string' ? field.trim() : '';
}

function configError(
  code: string,
  message: string,
  filePath: string,
  details?: string[],
): JiraSavedSectionsConfigResult {
  const error: JiraConfigError = { code, message, path: filePath };
  if (details?.length) error.details = details;
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
