type JiraEnvKey = 'JIRA_BASE_URL' | 'JIRA_EMAIL' | 'JIRA_API_TOKEN';
type JiraReadMethod = 'GET' | 'POST';
type JiraFetch = (input: string, init?: RequestInit) => Promise<Response>;
type JiraQueryValue = string | number | boolean | null | undefined;

export interface JiraClientEnv extends Partial<Record<JiraEnvKey, string | undefined>> {}

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

export type JiraCredentialsResult =
  | { ok: true; credentials: JiraCredentials }
  | { ok: false; error: JiraRequestError };

export type JiraReadResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: JiraRequestError };

// Required .env keys for Jira API token auth: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.
const REQUIRED_JIRA_ENV: JiraEnvKey[] = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];

export function loadJiraCredentials(env: JiraClientEnv = process.env): JiraCredentialsResult {
  const missing = REQUIRED_JIRA_ENV.filter((key) => !readEnvString(env, key));

  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: 'jira_env_missing',
        message: 'Missing required Jira environment variable(s).',
        details: missing,
      },
    };
  }

  const baseUrl = readEnvString(env, 'JIRA_BASE_URL');
  const email = readEnvString(env, 'JIRA_EMAIL');
  const apiToken = readEnvString(env, 'JIRA_API_TOKEN');

  if (!isHttpUrl(baseUrl)) {
    return {
      ok: false,
      error: {
        code: 'jira_base_url_invalid',
        message: 'JIRA_BASE_URL must be a valid HTTP or HTTPS URL.',
      },
    };
  }

  return {
    ok: true,
    credentials: {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      email,
      apiToken,
    },
  };
}

export async function jiraReadJson<T>(
  request: JiraReadRequest,
  options: JiraClientOptions = {},
): Promise<JiraReadResult<T>> {
  const credentialsResult = loadJiraCredentials(options.env);
  if (!credentialsResult.ok) return credentialsResult;

  const urlResult = buildJiraUrl(credentialsResult.credentials.baseUrl, request.path, request.query);
  if (!urlResult.ok) return urlResult;

  const fetchFn = options.fetchFn ?? fetch;
  const method = request.method ?? 'GET';
  if (!isReadMethod(method)) {
    return {
      ok: false,
      error: {
        code: 'jira_method_not_allowed',
        message: 'Only read-oriented Jira request methods are allowed.',
      },
    };
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: buildBasicAuthHeader(credentialsResult.credentials),
  };
  const init: RequestInit = { method, headers };

  if (method === 'POST' && request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(request.body);
  }

  let response: Response;
  try {
    response = await fetchFn(urlResult.url, init);
  } catch {
    return {
      ok: false,
      error: {
        code: 'jira_network_error',
        message: 'Jira request failed before receiving a response.',
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: 'jira_request_failed',
        message: `Jira request failed with status ${response.status}.`,
        status: response.status,
      },
    };
  }

  try {
    return { ok: true, data: await response.json() as T, status: response.status };
  } catch {
    return {
      ok: false,
      error: {
        code: 'jira_response_invalid',
        message: 'Jira response was not valid JSON.',
        status: response.status,
      },
    };
  }
}

function buildJiraUrl(
  baseUrl: string,
  path: string,
  query?: JiraReadRequest['query'],
): { ok: true; url: string } | { ok: false; error: JiraRequestError } {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(path)) {
    return {
      ok: false,
      error: {
        code: 'jira_path_invalid',
        message: 'Jira API path must be relative to JIRA_BASE_URL.',
      },
    };
  }

  const url = new URL(path.replace(/^\/+/, ''), `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== null && item !== undefined) {
        url.searchParams.append(key, String(item));
      }
    }
  }
  return { ok: true, url: url.toString() };
}

function buildBasicAuthHeader(credentials: JiraCredentials): string {
  const token = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
  return `Basic ${token}`;
}

function readEnvString(env: JiraClientEnv, key: JiraEnvKey): string {
  return (env[key] ?? '').trim();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isReadMethod(method: string): method is JiraReadMethod {
  return method === 'GET' || method === 'POST';
}
