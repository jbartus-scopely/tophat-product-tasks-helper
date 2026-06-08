import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';
const SECTIONS = [
    {
        id: 'saved',
        title: 'Saved section',
        jql: 'project = EXAMPLE',
    },
];
function csvUploadBody(csv) {
    const form = new FormData();
    form.append('file', new File([csv], 'tasks.csv', { type: 'text/csv' }));
    return form;
}
test('does not expose a preloaded backlog before browser upload', async () => {
    const app = createApp();
    const response = await app.request('/api/backlog');
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { loaded: false });
});
test('uploading a valid CSV returns parsed task rows and warnings', async () => {
    const app = createApp();
    const csv = [
        'Date,JIRA,ID,Reporter,Description/Problem,Priority,Status,Initiative,Priority pod,Comments',
        '2026-06-01,TOP-1,FG-1,Ana,Fix tutorial,P0,TODO,Onboarding,Pod31,Needs copy',
        '2026-06-02,TOP-2,FG-1,Ben,Fix menu,P1,TRIAGE,Menus,Pod32,Duplicate row',
    ].join('\n');
    const response = await app.request('/api/upload', {
        method: 'POST',
        body: csvUploadBody(csv),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.tasks.length, 2);
    assert.equal(body.tasks[0].id, 'FG-1');
    assert.equal(body.tasks[0].initiative, 'Onboarding');
    assert.equal(body.tasks[0].priorityPod, 'Pod31');
    assert.match(body.warnings.join('\n'), /Duplicate ID: FG-1 appears 2 times/);
    assert.equal(body.stats.total, 2);
});
test('uploading valid CSV does not persist backlog data on the server', async () => {
    const app = createApp();
    const csv = [
        'Date,JIRA,ID,Reporter,Description/Problem,Priority,Status,Initiative,Priority pod,Comments',
        '2026-06-01,TOP-1,FG-1,Ana,Fix tutorial,P0,TODO,Onboarding,Pod31,Needs copy',
    ].join('\n');
    await app.request('/api/upload', {
        method: 'POST',
        body: csvUploadBody(csv),
    });
    const response = await app.request('/api/backlog');
    const body = await response.json();
    assert.deepEqual(body, { loaded: false });
});
test('uploading malformed CSV returns a non-success response with an error', async () => {
    const app = createApp();
    const response = await app.request('/api/upload', {
        method: 'POST',
        body: csvUploadBody('ID,Description/Problem\n"FG-1,unterminated'),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(typeof body.error, 'string');
    assert.match(body.error, /Quote Not Closed|Invalid Closing Quote|CSV/);
});
test('Jira routes remain available without a loaded CSV backlog', async () => {
    const app = createApp({
        jiraConfigLoader: () => ({ ok: true, sections: SECTIONS }),
    });
    const response = await app.request('/api/jira/sections');
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { sections: SECTIONS });
});
//# sourceMappingURL=csvUploadRoutes.test.js.map