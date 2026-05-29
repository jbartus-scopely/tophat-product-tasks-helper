import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJiraSavedSectionsConfig, parseJiraSavedSectionsConfig, } from './jiraConfig.js';
function tempConfigPath(name = 'jira-saved-sections.json') {
    const dir = mkdtempSync(join(tmpdir(), 'pth-jira-config-'));
    return join(dir, name);
}
test('loads saved Jira sections from config object', () => {
    const path = tempConfigPath();
    writeFileSync(path, JSON.stringify({
        sections: [
            {
                id: 'example',
                title: 'Example stories',
                jql: 'project = EXAMPLE ORDER BY updated DESC',
            },
        ],
    }));
    const result = loadJiraSavedSectionsConfig(path);
    assert.equal(result.ok, true);
    if (!result.ok)
        assert.fail('Expected config to load.');
    assert.deepEqual(result.sections, [
        {
            id: 'example',
            title: 'Example stories',
            jql: 'project = EXAMPLE ORDER BY updated DESC',
        },
    ]);
});
test('accepts a top-level array of saved Jira sections', () => {
    const result = parseJiraSavedSectionsConfig([
        {
            id: 'array-example',
            title: 'Array example',
            jql: 'project = EXAMPLE',
        },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok)
        assert.fail('Expected config to parse.');
    assert.equal(result.sections[0].id, 'array-example');
});
test('returns a structured error when config file is missing', () => {
    const missingPath = join(tempConfigPath(), 'missing.json');
    const result = loadJiraSavedSectionsConfig(missingPath);
    assert.equal(result.ok, false);
    if (result.ok)
        assert.fail('Expected missing config to fail.');
    assert.equal(result.error.code, 'config_missing');
    assert.equal(result.error.path, missingPath);
});
test('returns a structured error when config JSON is malformed', () => {
    const path = tempConfigPath();
    writeFileSync(path, '{ not json');
    const result = loadJiraSavedSectionsConfig(path);
    assert.equal(result.ok, false);
    if (result.ok)
        assert.fail('Expected malformed config to fail.');
    assert.equal(result.error.code, 'config_malformed');
    assert.equal(result.error.path, path);
});
test('returns a structured error when required section fields are missing', () => {
    const path = tempConfigPath();
    writeFileSync(path, JSON.stringify({ sections: [{ id: 'missing-fields' }] }));
    const result = loadJiraSavedSectionsConfig(path);
    assert.equal(result.ok, false);
    if (result.ok)
        assert.fail('Expected invalid config to fail.');
    assert.equal(result.error.code, 'config_invalid');
    assert.deepEqual(result.error.details, [
        'sections[0] is missing required field(s): title, jql.',
    ]);
});
//# sourceMappingURL=jiraConfig.test.js.map