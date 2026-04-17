import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
const HEADER_MAP = {
    'JIRA ': 'jira',
    'JIRA': 'jira',
    'ID': 'id',
    'Reporter': 'reporter',
    'Description/Problem': 'description',
    'Group': 'group',
    'TEMP: CK NOTE': 'ckNote',
    'Priority': 'priority',
    'Type': 'type',
    'Status': 'status',
    'Prepro work': 'preproWork',
    'Live version': 'liveVersion',
    'Appareance': 'appearance',
    'Source': 'source',
    'Risk': 'risk',
    'Assigned POD': 'assignedPod',
    'PT OWNER': 'ptOwner',
    'FO': 'fo',
    'UX/Design': 'uxDesign',
    'GD/UX need': 'gdUxNeed',
    'Solution links': 'solutionLinks',
    'Comments': 'comments',
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
export function parseBacklog(filePath) {
    const raw = readFileSync(filePath, 'utf-8');
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
        // Map columns using header map
        const mapped = {};
        for (const [csvCol, taskKey] of Object.entries(HEADER_MAP)) {
            const value = record[csvCol] ?? record[csvCol.trim()] ?? '';
            mapped[taskKey] = normalize(value);
        }
        const id = mapped.id || '';
        // Skip #NUM! rows
        if (id === '#NUM!' || id.startsWith('#NUM')) {
            filtered++;
            continue;
        }
        // Skip completely empty rows
        if (!id && !mapped.description) {
            filtered++;
            continue;
        }
        // Track duplicate IDs
        if (id) {
            idCount.set(id, (idCount.get(id) || 0) + 1);
        }
        const task = {
            jira: mapped.jira || '',
            id: id,
            reporter: mapped.reporter || '',
            description: mapped.description || '',
            group: mapped.group || '',
            ckNote: mapped.ckNote || '',
            priority: mapped.priority || '',
            type: mapped.type || '',
            status: mapped.status || '',
            preproWork: mapped.preproWork || '',
            liveVersion: mapped.liveVersion || '',
            appearance: mapped.appearance || '',
            source: mapped.source || '',
            risk: mapped.risk || '',
            assignedPod: mapped.assignedPod || '',
            ptOwner: mapped.ptOwner || '',
            fo: mapped.fo || '',
            uxDesign: mapped.uxDesign || '',
            gdUxNeed: mapped.gdUxNeed || '',
            solutionLinks: mapped.solutionLinks || '',
            comments: mapped.comments || '',
            score: 0,
            scoreBreakdown: { ...emptyBreakdown },
        };
        tasks.push(task);
    }
    // Find actual duplicates (count > 1)
    const duplicateIds = new Map();
    for (const [id, count] of idCount) {
        if (count > 1) {
            duplicateIds.set(id, count);
            warnings.push(`Duplicate ID: ${id} appears ${count} times`);
        }
    }
    // Warn about tasks with no ID
    const noIdCount = tasks.filter((t) => !t.id).length;
    if (noIdCount > 0) {
        warnings.push(`${noIdCount} task(s) have no ID`);
    }
    // Warn about tasks with no priority
    const noPriorityCount = tasks.filter((t) => !t.priority && t.status !== 'Live' && t.status !== 'HOLD').length;
    if (noPriorityCount > 0) {
        warnings.push(`${noPriorityCount} active task(s) have no priority set`);
    }
    return { tasks, duplicateIds, warnings, totalRaw, filtered };
}
//# sourceMappingURL=parser.js.map