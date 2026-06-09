const REQUIRED_JIRA_SETTINGS = ['baseUrl', 'email', 'apiToken'];
export function loadJiraCredentials(settings = {}) {
    const missing = REQUIRED_JIRA_SETTINGS.filter((key) => !readSettingString(settings, key));
    if (missing.length > 0) {
        return {
            ok: false,
            error: {
                code: 'jira_settings_missing',
                message: 'Missing required Jira setting(s).',
                details: missing,
            },
        };
    }
    const baseUrl = readSettingString(settings, 'baseUrl');
    const email = readSettingString(settings, 'email');
    const apiToken = readSettingString(settings, 'apiToken');
    if (!isHttpUrl(baseUrl)) {
        return {
            ok: false,
            error: {
                code: 'jira_base_url_invalid',
                message: 'Jira base URL must be a valid HTTP or HTTPS URL.',
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
export async function jiraReadJson(request, options = {}) {
    const credentialsResult = loadJiraCredentials(options.settings);
    if (!credentialsResult.ok)
        return credentialsResult;
    const urlResult = buildJiraUrl(credentialsResult.credentials.baseUrl, request.path, request.query);
    if (!urlResult.ok)
        return urlResult;
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
    const headers = {
        Accept: 'application/json',
        Authorization: buildBasicAuthHeader(credentialsResult.credentials),
    };
    const init = { method, headers };
    if (method === 'POST' && request.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(request.body);
    }
    let response;
    try {
        response = await fetchFn(urlResult.url, init);
    }
    catch {
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
        return { ok: true, data: await response.json(), status: response.status };
    }
    catch {
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
function buildJiraUrl(baseUrl, path, query) {
    if (/^[a-z][a-z\d+\-.]*:\/\//i.test(path)) {
        return {
            ok: false,
            error: {
                code: 'jira_path_invalid',
                message: 'Jira API path must be relative to the configured Jira base URL.',
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
function buildBasicAuthHeader(credentials) {
    const token = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
    return `Basic ${token}`;
}
function readSettingString(settings, key) {
    return (settings[key] ?? '').trim();
}
function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function isReadMethod(method) {
    return method === 'GET' || method === 'POST';
}
//# sourceMappingURL=jiraClient.js.map