import { jiraReadJson } from './jiraClient.js';
const JIRA_FIELD_METADATA_PATH = '/rest/api/3/field';
const POD_FIELD_NAME = 'Pod';
export async function discoverJiraPodField(options = {}) {
    const result = await jiraReadJson(pickFieldMetadataRequest(), options);
    if (!result.ok)
        return result;
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
function isPodField(value) {
    if (!isRecord(value))
        return false;
    return value.name === POD_FIELD_NAME && typeof value.id === 'string' && value.id.trim().length > 0;
}
function podFieldMissingWarning() {
    return {
        code: 'jira_pod_field_missing',
        message: 'Jira field metadata did not include a field named Pod.',
    };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=jiraFields.js.map