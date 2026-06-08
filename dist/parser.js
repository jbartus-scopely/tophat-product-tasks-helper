import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { CSV_REQUIRED_FIELDS, CSV_VALID_PRIORITIES, CSV_VALID_STATUSES, } from './types.js';
const HEADER_MAP = {
    'Date': 'date',
    'JIRA': 'jira',
    'JIRA ': 'jira',
    'ID': 'id',
    'Reporter': 'reporter',
    'Description/Problem': 'description',
    'Priority': 'priority',
    'Status': 'status',
    'Initiative': 'initiative',
    'Priority pod': 'priorityPod',
    'Comments': 'comments',
};
const REQUIRED_FIELD_KEYS = {
    ID: 'id',
    'Description/Problem': 'description',
    Status: 'status',
};
const VALID_PRIORITIES = new Set(CSV_VALID_PRIORITIES);
const VALID_STATUSES = new Set(CSV_VALID_STATUSES);
const PRIORITY_ALIASES = {
    p0: 'Critical',
    critical: 'Critical',
    p0critical: 'Critical',
    criticalp0: 'Critical',
    p1: 'Major',
    major: 'Major',
    p1major: 'Major',
    majorp1: 'Major',
    p2: 'Minor',
    minor: 'Minor',
    p2minor: 'Minor',
    minorp2: 'Minor',
    p3: 'Unprioritized',
    unprioritized: 'Unprioritized',
    p3unprioritized: 'Unprioritized',
    unprioritizedp3: 'Unprioritized',
};
const emptyBreakdown = {
    priority: 0,
    status: 0,
    prepro: 0,
    risk: 0,
    appearance: 0,
    type: 0,
    metadataQuality: 0,
};
function normalize(val) {
    if (!val)
        return '';
    const trimmed = val.trim().replace(/\s+/g, ' ');
    if (/^n\/?a$/i.test(trimmed))
        return '';
    return trimmed;
}
function normalizePriority(value) {
    const normalized = normalize(value);
    const key = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (PRIORITY_ALIASES[key])
        return PRIORITY_ALIASES[key];
    if (key.includes('critical') || key.startsWith('p0'))
        return 'Critical';
    if (key.includes('major') || key.startsWith('p1'))
        return 'Major';
    if (key.includes('minor') || key.startsWith('p2'))
        return 'Minor';
    if (key.includes('unprioritized') || key.startsWith('p3'))
        return 'Unprioritized';
    return normalized;
}
function recordValue(record, csvCol) {
    return record[csvCol] ?? record[csvCol.trim()] ?? '';
}
function isEmptyTask(task) {
    return !task.date &&
        !task.jira &&
        !task.id &&
        !task.reporter &&
        !task.description &&
        !task.priority &&
        !task.status &&
        !task.initiative &&
        !task.priorityPod &&
        !task.comments;
}
function validateTask(task, rowNumber, warnings) {
    for (const field of CSV_REQUIRED_FIELDS) {
        const key = REQUIRED_FIELD_KEYS[field];
        if (!task[key])
            warnings.push(`Missing ${field} on row ${rowNumber}`);
    }
    if (task.priority && !VALID_PRIORITIES.has(task.priority)) {
        warnings.push(`Invalid Priority "${task.priority}" on row ${rowNumber}; expected Critical, Major, Minor, or Unprioritized`);
    }
    if (task.status && !VALID_STATUSES.has(task.status)) {
        warnings.push(`Invalid Status "${task.status}" on row ${rowNumber}; expected TRIAGE, TODO, Prioritized, or HOLD`);
    }
}
export function parseBacklog(filePath) {
    return parseBacklogFromString(readFileSync(filePath, 'utf-8'));
}
export function parseBacklogFromString(raw) {
    const records = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
    });
    const warnings = [];
    const idCount = new Map();
    const tasks = [];
    let totalRaw = 0;
    let filtered = 0;
    for (const record of records) {
        totalRaw++;
        const mapped = {};
        for (const [csvCol, taskKey] of Object.entries(HEADER_MAP)) {
            const value = recordValue(record, csvCol);
            mapped[taskKey] = normalize(value);
        }
        const id = mapped.id || '';
        // Skip #NUM! rows
        if (id === '#NUM!' || id.startsWith('#NUM')) {
            filtered++;
            continue;
        }
        const task = {
            date: mapped.date || '',
            jira: mapped.jira || '',
            id,
            reporter: mapped.reporter || '',
            description: mapped.description || '',
            initiative: mapped.initiative || '',
            priorityPod: mapped.priorityPod || '',
            priority: normalizePriority(mapped.priority || ''),
            status: mapped.status || '',
            comments: mapped.comments || '',
            group: mapped.initiative || '',
            ckNote: '',
            type: '',
            preproWork: '',
            liveVersion: '',
            appearance: '',
            source: '',
            risk: '',
            assignedPod: mapped.priorityPod || '',
            ptOwner: '',
            fo: '',
            uxDesign: '',
            gdUxNeed: '',
            solutionLinks: '',
            score: 0,
            scoreBreakdown: { ...emptyBreakdown },
        };
        if (isEmptyTask(task)) {
            filtered++;
            continue;
        }
        if (id) {
            idCount.set(id, (idCount.get(id) || 0) + 1);
        }
        validateTask(task, totalRaw + 1, warnings);
        tasks.push(task);
    }
    const duplicateIds = new Map();
    for (const [id, count] of idCount) {
        if (count > 1) {
            duplicateIds.set(id, count);
            warnings.push(`Duplicate ID: ${id} appears ${count} times`);
        }
    }
    return { tasks, duplicateIds, warnings, totalRaw, filtered };
}
//# sourceMappingURL=parser.js.map