import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import Table from 'cli-table3';
import { MAX_SCORE } from './scorer.js';
// ── CSV File Helper ──────────────────────────────────────────
function outputCsv(content, filePath) {
    if (filePath) {
        const absPath = resolve(filePath);
        writeFileSync(absPath, content, 'utf-8');
        console.log('');
        console.log(chalk.green(`  CSV written to ${absPath}`));
        console.log('');
    }
    else {
        console.log('');
        console.log(colors.header('  CSV (copy/paste)'));
        console.log(colors.muted('  ' + '─'.repeat(40)));
        console.log('');
        console.log(content);
        console.log('');
    }
}
// ── Color Scheme ──────────────────────────────────────────────
const colors = {
    header: chalk.bold.white,
    subheader: chalk.dim,
    accent: chalk.cyan,
    muted: chalk.dim,
    success: chalk.green,
    warning: chalk.yellow,
    danger: chalk.red,
    info: chalk.blue,
};
// ── Priority Badges ───────────────────────────────────────────
function priorityBadge(priority) {
    switch (normalizePriorityLabel(priority)) {
        case 'Critical': return chalk.bgRed.white.bold(` Critical `);
        case 'Major': return chalk.bgYellow.black.bold(` Major `);
        case 'Minor': return chalk.bgGreen.black.bold(` Minor `);
        case 'Unprioritized': return chalk.bgGray.white(` Unprioritized `);
        default: return chalk.bgGray.white(` -- `);
    }
}
function priorityText(priority) {
    switch (normalizePriorityLabel(priority)) {
        case 'Critical': return chalk.red.bold('Critical');
        case 'Major': return chalk.yellow.bold('Major');
        case 'Minor': return chalk.green.bold('Minor');
        case 'Unprioritized': return chalk.dim('Unprioritized');
        default: return chalk.dim('--');
    }
}
function normalizePriorityLabel(priority) {
    const key = priority.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    const aliases = {
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
    if (aliases[key])
        return aliases[key];
    if (key.includes('critical') || key.startsWith('p0'))
        return 'Critical';
    if (key.includes('major') || key.startsWith('p1'))
        return 'Major';
    if (key.includes('minor') || key.startsWith('p2'))
        return 'Minor';
    if (key.includes('unprioritized') || key.startsWith('p3'))
        return 'Unprioritized';
    return priority;
}
// ── Status Indicators ─────────────────────────────────────────
function statusIndicator(status) {
    switch (status) {
        case 'Prioritized': return chalk.green('●') + ' ' + chalk.green('Prioritized');
        case 'Pre-Pro Ready': return chalk.green('●') + ' ' + chalk.green('Pre-Pro Ready');
        case 'Ready for release': return chalk.greenBright('●') + ' ' + chalk.greenBright('Ready');
        case 'Prepro-In Progress': return chalk.yellow('●') + ' ' + chalk.yellow('Prepro-InProg');
        case 'TODO': return chalk.blue('●') + ' ' + chalk.blue('TODO');
        case 'Pod Working': return chalk.magenta('●') + ' ' + chalk.magenta('Pod Working');
        case 'BLOCK': return chalk.red('●') + ' ' + chalk.red('BLOCK');
        case 'TRIAGE': return chalk.gray('●') + ' ' + chalk.gray('TRIAGE');
        case 'HOLD': return chalk.dim('○') + ' ' + chalk.dim('HOLD');
        case 'Live': return chalk.magentaBright('●') + ' ' + chalk.magentaBright('Live');
        default: return chalk.dim('○') + ' ' + chalk.dim('--');
    }
}
// ── Score Bar ─────────────────────────────────────────────────
function scoreBar(score, width = 8) {
    const ratio = Math.max(0, Math.min(1, score / MAX_SCORE));
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    let color;
    if (ratio >= 0.7)
        color = chalk.green;
    else if (ratio >= 0.45)
        color = chalk.yellow;
    else
        color = chalk.red;
    const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
    const num = color(String(score).padStart(3));
    return `${bar} ${num}`;
}
// ── Text Helpers ──────────────────────────────────────────────
function truncate(text, maxLen) {
    // Collapse newlines to spaces
    const oneLine = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (oneLine.length <= maxLen)
        return oneLine;
    return oneLine.slice(0, maxLen - 1) + '…';
}
function groupBadge(group) {
    if (!group)
        return chalk.dim('--');
    const groupColors = {
        'Timings': chalk.yellow,
        'UI/UX': chalk.cyan,
        'MRG': chalk.magenta,
        'Album': chalk.green,
        'SD/BH': chalk.red,
        'Social': chalk.blue,
        'Cosmetics': chalk.hex('#FF69B4'),
        'Rolling': chalk.hex('#FFA500'),
        'QW': chalk.hex('#FFD700'),
        'Bug': chalk.redBright,
        'Tournaments': chalk.hex('#9370DB'),
        'Bots': chalk.hex('#20B2AA'),
        'Delight': chalk.hex('#FF6347'),
        'FTUE': chalk.hex('#4682B4'),
        'Networth': chalk.hex('#32CD32'),
        'Other': chalk.gray,
    };
    const colorFn = groupColors[group] || chalk.white;
    return colorFn(group);
}
// ── Banner ────────────────────────────────────────────────────
export function printBanner(backlog) {
    const totalTasks = backlog.tasks.length;
    const actionable = backlog.tasks.filter((t) => !['Live', 'HOLD', ''].includes(t.status) && t.status !== '').length;
    const quickWins = backlog.tasks.filter((t) => t.preproWork === '0 - Low' && t.risk === 'Low' && !['Live', 'HOLD'].includes(t.status)).length;
    const line1 = colors.header('  PRODUCT TASKS HELPER');
    const line2 = colors.subheader(`  ${totalTasks} tasks`) +
        colors.muted(' · ') +
        colors.accent(`${actionable} actionable`) +
        colors.muted(' · ') +
        colors.success(`${quickWins} quick wins`) +
        colors.muted(' · ') +
        colors.muted(`${backlog.filtered} rows skipped`);
    const width = 62;
    const border = colors.muted('─'.repeat(width));
    console.log('');
    console.log(colors.muted('  ┌' + '─'.repeat(width) + '┐'));
    console.log(colors.muted('  │') + line1 + ' '.repeat(Math.max(0, width - stripAnsi(line1).length)) + colors.muted('│'));
    console.log(colors.muted('  │') + ' '.repeat(width) + colors.muted('│'));
    console.log(colors.muted('  │') + line2 + ' '.repeat(Math.max(0, width - stripAnsi(line2).length)) + colors.muted('│'));
    console.log(colors.muted('  └' + '─'.repeat(width) + '┘'));
    console.log('');
}
// ── Warnings ──────────────────────────────────────────────────
export function printWarnings(backlog) {
    if (backlog.warnings.length === 0)
        return;
    console.log(colors.warning('  ⚠ Data Warnings:'));
    for (const w of backlog.warnings) {
        console.log(colors.warning(`    · ${w}`));
    }
    console.log('');
}
// ── Stats Dashboard ───────────────────────────────────────────
export function printStats(backlog) {
    printBanner(backlog);
    const tasks = backlog.tasks;
    // Priority distribution
    const byPriority = new Map();
    for (const t of tasks) {
        const p = t.priority || '(none)';
        byPriority.set(p, (byPriority.get(p) || 0) + 1);
    }
    // Status distribution
    const byStatus = new Map();
    for (const t of tasks) {
        const s = t.status || '(none)';
        byStatus.set(s, (byStatus.get(s) || 0) + 1);
    }
    // Group distribution
    const byGroup = new Map();
    for (const t of tasks) {
        const g = t.group || '(none)';
        byGroup.set(g, (byGroup.get(g) || 0) + 1);
    }
    const maxCount = Math.max(...[...byPriority.values(), ...byStatus.values(), ...byGroup.values()]);
    function miniBar(count, maxW = 20) {
        const ratio = count / maxCount;
        const filled = Math.max(1, Math.round(ratio * maxW));
        return chalk.cyan('█'.repeat(filled)) + chalk.dim(` ${count}`);
    }
    // Print columns side by side
    console.log(colors.header('  PRIORITY'));
    console.log(colors.muted('  ' + '─'.repeat(35)));
    for (const [p, count] of [...byPriority.entries()].sort()) {
        const label = (p === '(none)' ? chalk.dim('--') : priorityText(p)).padEnd(20);
        console.log(`  ${label} ${miniBar(count)}`);
    }
    console.log('');
    console.log(colors.header('  STATUS'));
    console.log(colors.muted('  ' + '─'.repeat(35)));
    for (const [s, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
        const label = truncate(s, 18).padEnd(18);
        console.log(`  ${chalk.white(label)} ${miniBar(count)}`);
    }
    console.log('');
    console.log(colors.header('  GROUP'));
    console.log(colors.muted('  ' + '─'.repeat(35)));
    for (const [g, count] of [...byGroup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
        const label = truncate(g, 18).padEnd(18);
        console.log(`  ${chalk.white(label)} ${miniBar(count)}`);
    }
    console.log('');
    printWarnings(backlog);
}
// ── Task Table ────────────────────────────────────────────────
export function printTaskTable(tasks, title, options) {
    const showGroup = options?.showGroup ?? true;
    console.log(colors.header(`  ${title}`));
    console.log(colors.muted('  ' + '═'.repeat(title.length)));
    console.log('');
    if (tasks.length === 0) {
        console.log(colors.muted('  No tasks match the criteria.'));
        console.log('');
        return;
    }
    const head = [
        chalk.dim('#'),
        chalk.dim('Score'),
        chalk.dim('ID'),
        chalk.dim('Pr'),
        chalk.dim('Status'),
        ...(showGroup ? [chalk.dim('Group')] : []),
        chalk.dim('Prepro'),
        chalk.dim('Description'),
    ];
    const colWidths = [
        5, // #
        15, // Score (bar)
        10, // ID
        6, // Priority
        17, // Status
        ...(showGroup ? [13] : []), // Group
        8, // Prepro
        60, // Description
    ];
    const table = new Table({
        head,
        colWidths,
        chars: {
            'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
            'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
            'left': '  ', 'left-mid': '', 'mid': '', 'mid-mid': '',
            'right': '', 'right-mid': '', 'middle': ' ',
        },
        style: {
            head: [],
            border: [],
            'padding-left': 0,
            'padding-right': 0,
        },
        wordWrap: false,
    });
    // Separator row
    table.push([
        chalk.dim('─'.repeat(3)),
        chalk.dim('─'.repeat(13)),
        chalk.dim('─'.repeat(8)),
        chalk.dim('─'.repeat(4)),
        chalk.dim('─'.repeat(15)),
        ...(showGroup ? [chalk.dim('─'.repeat(11))] : []),
        chalk.dim('─'.repeat(6)),
        chalk.dim('─'.repeat(58)),
    ]);
    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const row = [
            chalk.dim(String(i + 1)),
            scoreBar(t.score),
            colors.accent(t.id || '--'),
            priorityText(t.priority),
            statusIndicator(t.status),
            ...(showGroup ? [groupBadge(t.group)] : []),
            preproLabel(t.preproWork),
            chalk.white(truncate(t.description, 58)),
        ];
        table.push(row);
    }
    console.log(table.toString());
    console.log('');
    console.log(colors.muted(`  Showing ${tasks.length} task(s)`));
    console.log('');
}
function preproLabel(prepro) {
    switch (prepro) {
        case '0 - Low': return chalk.green('Low');
        case '1 - Mid': return chalk.yellow('Mid');
        case '2 - High': return chalk.red('High');
        default: return chalk.dim('--');
    }
}
// ── Task Detail ───────────────────────────────────────────────
export function printTaskDetail(task) {
    const width = 64;
    const border = colors.muted('─'.repeat(width));
    console.log('');
    console.log(colors.muted('  ┌' + '─'.repeat(width) + '┐'));
    console.log(colors.muted('  │') + colors.header(` ${task.id}`) + ' '.repeat(Math.max(0, width - task.id.length - 1)) + colors.muted('│'));
    console.log(colors.muted('  └' + '─'.repeat(width) + '┘'));
    console.log('');
    const fields = [
        ['Score', `${scoreBar(task.score, 12)}  /  ${MAX_SCORE}`],
        ['Priority', priorityBadge(task.priority)],
        ['Status', statusIndicator(task.status)],
        ['Group', groupBadge(task.group)],
        ['Type', task.type || chalk.dim('--')],
        ['Prepro Work', preproLabel(task.preproWork)],
        ['Risk', task.risk ? (task.risk === 'Low' ? chalk.green(task.risk) : chalk.red(task.risk)) : chalk.dim('--')],
        ['Appearance', task.appearance || chalk.dim('--')],
        ['Reporter', task.reporter || chalk.dim('--')],
        ['Assigned Pod', task.assignedPod || chalk.dim('--')],
        ['PT Owner', task.ptOwner || chalk.dim('--')],
        ['JIRA', task.jira || chalk.dim('--')],
    ];
    for (const [label, value] of fields) {
        console.log(`  ${chalk.dim(label.padEnd(14))} ${value}`);
    }
    console.log('');
    console.log(colors.header('  Description'));
    console.log(colors.muted('  ' + '─'.repeat(40)));
    const descLines = task.description.split('\n');
    for (const line of descLines) {
        console.log(`  ${chalk.white(line)}`);
    }
    if (task.ckNote) {
        console.log('');
        console.log(colors.header('  CK Note'));
        console.log(colors.muted('  ' + '─'.repeat(40)));
        console.log(`  ${chalk.yellow(task.ckNote)}`);
    }
    if (task.comments) {
        console.log('');
        console.log(colors.header('  Comments'));
        console.log(colors.muted('  ' + '─'.repeat(40)));
        const commentLines = task.comments.split('\n');
        for (const line of commentLines) {
            console.log(`  ${chalk.dim(line)}`);
        }
    }
    // Score breakdown
    console.log('');
    console.log(colors.header('  Score Breakdown'));
    console.log(colors.muted('  ' + '─'.repeat(40)));
    const bd = task.scoreBreakdown;
    const breakdownFields = [
        ['Priority', bd.priority, 40],
        ['Status', bd.status, 30],
        ['Prepro Work', bd.prepro, 25],
        ['Risk', bd.risk, 15],
        ['Appearance', bd.appearance, 15],
        ['Type (Bug)', bd.type, 5],
        ['Metadata', bd.metadataQuality, 0],
    ];
    for (const [label, score, max] of breakdownFields) {
        const sign = score >= 0 ? '+' : '';
        const colorFn = score > 0 ? chalk.green : score < 0 ? chalk.red : chalk.dim;
        console.log(`  ${chalk.dim(label.padEnd(14))} ${colorFn(`${sign}${score}`.padStart(4))} ${chalk.dim(`/ ${max}`)}`);
    }
    console.log(`  ${chalk.dim('─'.repeat(20))}`);
    console.log(`  ${chalk.white('Total'.padEnd(14))} ${chalk.bold(String(task.score).padStart(4))} ${chalk.dim(`/ ${MAX_SCORE}`)}`);
    console.log('');
}
// ── Groom Table ──────────────────────────────────────────────
function aiPriorityBadge(priority) {
    const norm = priority.toLowerCase().trim();
    if (norm === 'high')
        return chalk.red.bold('High');
    if (norm === 'mid')
        return chalk.yellow.bold('Mid');
    if (norm === 'low')
        return chalk.green.bold('Low');
    return chalk.dim(priority || '--');
}
function aiActionBadge(action) {
    const norm = action.trim().toLowerCase();
    if (norm === 'todo')
        return chalk.green.bold('TODO');
    if (norm === 'discard')
        return chalk.red.bold('Discard');
    if (norm === 'merge')
        return chalk.magenta.bold('Merge');
    if (norm === 'keep triage')
        return chalk.yellow.bold('Keep Triage');
    if (norm === 'hold')
        return chalk.blue.bold('Hold');
    return chalk.dim(action || '--');
}
function aiNotesFormatted(notes) {
    const norm = notes.trim();
    if (!norm || norm === '--')
        return chalk.dim('--');
    if (/^TODO candidate/i.test(norm))
        return chalk.green(norm);
    if (/^Discard.*duplicate/i.test(norm))
        return chalk.red(norm);
    if (/^Discard.*too big/i.test(norm))
        return chalk.magenta(norm);
    if (/^Keep in TRIAGE/i.test(norm))
        return chalk.yellow(norm);
    // Legacy fallbacks
    if (/duplicate/i.test(norm))
        return chalk.red(norm);
    if (/missing|incomplete|unclear|stale/i.test(norm))
        return chalk.yellow(norm);
    return chalk.white(norm);
}
const GROOM_CATEGORIES = {
    'todo': { title: 'TODO CANDIDATES', colorFn: chalk.green, icon: '+' },
    'discard-duplicate': { title: 'DISCARD — Duplicates', colorFn: chalk.red, icon: 'x' },
    'discard-toobig': { title: 'DISCARD — Too Big (Feature)', colorFn: chalk.magenta, icon: '!' },
    'keep': { title: 'KEEP IN TRIAGE', colorFn: chalk.yellow, icon: '?' },
    'other': { title: 'UNCATEGORIZED', colorFn: chalk.white, icon: '-' },
};
const CATEGORY_ORDER = ['todo', 'discard-duplicate', 'discard-toobig', 'keep', 'other'];
function categorizeGroomedTask(task) {
    const action = task.aiAction.trim().toLowerCase();
    const notes = task.aiNotes.trim().toLowerCase();
    // Primary: use the AI Action field
    if (action === 'todo')
        return 'todo';
    if (action === 'discard') {
        if (/duplicate/i.test(notes))
            return 'discard-duplicate';
        if (/too big|feature|epic/i.test(notes))
            return 'discard-toobig';
        return 'discard-duplicate'; // default discard subcategory
    }
    if (action === 'merge')
        return 'discard-duplicate';
    if (action === 'keep triage')
        return 'keep';
    if (action === 'hold')
        return 'keep';
    // Fallback: parse from notes for backward compatibility
    if (/^todo candidate/i.test(task.aiNotes.trim()))
        return 'todo';
    if (/^discard.*duplicate/i.test(task.aiNotes.trim()))
        return 'discard-duplicate';
    if (/^discard.*too big/i.test(task.aiNotes.trim()))
        return 'discard-toobig';
    if (/^keep in triage/i.test(task.aiNotes.trim()))
        return 'keep';
    if (/duplicate/i.test(notes))
        return 'discard-duplicate';
    if (/too big|feature|epic/i.test(notes))
        return 'discard-toobig';
    if (/todo/i.test(notes))
        return 'todo';
    return 'other';
}
function printGroomSection(tasks, meta, _category) {
    console.log(meta.colorFn(`  [${meta.icon}] `) +
        colors.header(meta.title) +
        colors.muted(` (${tasks.length})`));
    console.log(colors.muted('  ' + '─'.repeat(meta.title.length + 6)));
    const descWidth = 58;
    const notesWidth = 58;
    const head = [
        chalk.dim('#'),
        chalk.dim('Task ID'),
        chalk.dim('AI Description'),
        chalk.dim('Pri'),
        chalk.dim('Action'),
        chalk.dim('Group'),
        chalk.dim('AI Notes'),
    ];
    const colWidths = [
        4, // #
        12, // Task ID
        descWidth + 2, // AI Description
        6, // Pri (High/Mid/Low)
        14, // Action
        13, // Group
        notesWidth + 2, // AI Notes
    ];
    const table = new Table({
        head,
        colWidths,
        chars: {
            'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
            'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
            'left': '  ', 'left-mid': '', 'mid': '', 'mid-mid': '',
            'right': '', 'right-mid': '', 'middle': ' ',
        },
        style: {
            head: [],
            border: [],
            'padding-left': 0,
            'padding-right': 0,
        },
        wordWrap: false,
    });
    table.push([
        chalk.dim('─'.repeat(2)),
        chalk.dim('─'.repeat(10)),
        chalk.dim('─'.repeat(descWidth)),
        chalk.dim('─'.repeat(4)),
        chalk.dim('─'.repeat(12)),
        chalk.dim('─'.repeat(11)),
        chalk.dim('─'.repeat(notesWidth)),
    ]);
    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        table.push([
            chalk.dim(String(i + 1)),
            colors.accent(t.taskId),
            chalk.white(truncate(t.aiDescription, descWidth)),
            aiPriorityBadge(t.aiPriority),
            aiActionBadge(t.aiAction),
            groupBadge(t.aiGroup),
            aiNotesFormatted(truncate(t.aiNotes, notesWidth)),
        ]);
    }
    console.log(table.toString());
    console.log('');
}
export function printGroomTable(tasks) {
    console.log('');
    const title = 'TRIAGE GROOMING';
    console.log(colors.header(`  ${title}`));
    console.log(colors.muted('  ' + '═'.repeat(title.length)));
    console.log('');
    if (tasks.length === 0) {
        console.log(colors.muted('  No groomed tasks parsed.'));
        console.log('');
        return;
    }
    // Group tasks by category
    const grouped = new Map();
    for (const t of tasks) {
        const cat = categorizeGroomedTask(t);
        if (!grouped.has(cat))
            grouped.set(cat, []);
        grouped.get(cat).push(t);
    }
    // Print each non-empty category in order
    for (const cat of CATEGORY_ORDER) {
        const catTasks = grouped.get(cat);
        if (catTasks && catTasks.length > 0) {
            printGroomSection(catTasks, GROOM_CATEGORIES[cat], cat);
        }
    }
    console.log(colors.muted(`  ${tasks.length} task(s) groomed`));
    console.log('');
}
export function printGroomProse(text) {
    console.log('');
    const width = 78;
    console.log(colors.muted('  ┌─') +
        chalk.cyan.bold(' GROOMING NOTES ') +
        colors.muted('─'.repeat(Math.max(0, width - 19)) + '┐'));
    const lines = text.split('\n');
    for (const line of lines) {
        const chunks = wrapText(line, width - 4);
        for (const chunk of chunks) {
            const padding = width - 2 - visibleLength(chunk);
            console.log(colors.muted('  │ ') + chunk + ' '.repeat(Math.max(0, padding)) + colors.muted('│'));
        }
    }
    console.log(colors.muted('  └' + '─'.repeat(width) + '┘'));
    console.log('');
}
const ANALYZE_STATUS_GROUPS = [
    { statuses: ['Live', 'Ready for release'], meta: { title: 'DONE', colorFn: chalk.greenBright, icon: '✓' } },
    { statuses: ['Pre-Pro Ready', 'Prepro-In Progress', 'Pod Working'], meta: { title: 'IN PROGRESS', colorFn: chalk.yellow, icon: '~' } },
    { statuses: ['TODO', 'Prioritized'], meta: { title: 'BACKLOG', colorFn: chalk.blue, icon: '○' } },
    { statuses: ['TRIAGE'], meta: { title: 'TRIAGE', colorFn: chalk.gray, icon: '?' } },
    { statuses: ['BLOCK'], meta: { title: 'BLOCKED', colorFn: chalk.red, icon: '✕' } },
    { statuses: ['HOLD'], meta: { title: 'HOLD', colorFn: chalk.dim, icon: '-' } },
];
const ANALYZE_STATUS_DEFAULT_META = { title: 'OTHER', colorFn: chalk.dim, icon: '·' };
function analyzeActionBadge(action) {
    const norm = action.trim().toLowerCase();
    if (norm === 'take next')
        return chalk.green.bold('Take Next');
    if (norm === 'consider')
        return chalk.yellow.bold('Consider');
    return chalk.dim('Skip');
}
function printAnalyzeSection(tasks, meta, statusMap) {
    console.log(meta.colorFn(`  [${meta.icon}] `) +
        colors.header(meta.title) +
        colors.muted(` (${tasks.length})`));
    console.log(colors.muted('  ' + '─'.repeat(meta.title.length + 6)));
    const descWidth = 52;
    const notesWidth = 50;
    const head = [
        chalk.dim('#'),
        chalk.dim('Task ID'),
        chalk.dim('Status'),
        chalk.dim('AI Description'),
        chalk.dim('Pri'),
        chalk.dim('Action'),
        chalk.dim('Group'),
        chalk.dim('AI Notes'),
    ];
    const colWidths = [
        4,
        12,
        16,
        descWidth + 2,
        6,
        14,
        13,
        notesWidth + 2,
    ];
    const table = new Table({
        head,
        colWidths,
        chars: {
            'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
            'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
            'left': '  ', 'left-mid': '', 'mid': '', 'mid-mid': '',
            'right': '', 'right-mid': '', 'middle': ' ',
        },
        style: {
            head: [],
            border: [],
            'padding-left': 0,
            'padding-right': 0,
        },
        wordWrap: false,
    });
    table.push([
        chalk.dim('─'.repeat(2)),
        chalk.dim('─'.repeat(10)),
        chalk.dim('─'.repeat(14)),
        chalk.dim('─'.repeat(descWidth)),
        chalk.dim('─'.repeat(4)),
        chalk.dim('─'.repeat(12)),
        chalk.dim('─'.repeat(11)),
        chalk.dim('─'.repeat(notesWidth)),
    ]);
    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const status = statusMap?.get(t.taskId) || '';
        table.push([
            chalk.dim(String(i + 1)),
            colors.accent(t.taskId),
            statusIndicator(status),
            chalk.white(truncate(t.aiDescription, descWidth)),
            aiPriorityBadge(t.aiPriority),
            analyzeActionBadge(t.aiAction),
            groupBadge(t.aiGroup),
            aiNotesFormatted(truncate(t.aiNotes, notesWidth)),
        ]);
    }
    console.log(table.toString());
    console.log('');
}
export function printAnalyzeTable(tasks, backlog) {
    console.log('');
    const title = 'AI ANALYSIS';
    console.log(colors.header(`  ${title}`));
    console.log(colors.muted('  ' + '═'.repeat(title.length)));
    console.log('');
    if (tasks.length === 0) {
        console.log(colors.muted('  No tasks parsed.'));
        console.log('');
        return;
    }
    // Build status lookup from backlog
    const statusMap = new Map();
    if (backlog) {
        for (const t of backlog.tasks) {
            if (t.id)
                statusMap.set(t.id, t.status);
        }
    }
    // Group tasks by status groups (matching the list command categories)
    const assigned = new Set();
    for (const group of ANALYZE_STATUS_GROUPS) {
        const matching = tasks.filter((t) => {
            const status = statusMap.get(t.taskId) || '';
            return group.statuses.includes(status) && !assigned.has(t);
        });
        if (matching.length > 0) {
            for (const t of matching)
                assigned.add(t);
            printAnalyzeSection(matching, group.meta, statusMap);
        }
    }
    // Any tasks whose status didn't match a known group
    const remaining = tasks.filter((t) => !assigned.has(t));
    if (remaining.length > 0) {
        printAnalyzeSection(remaining, ANALYZE_STATUS_DEFAULT_META, statusMap);
    }
    const takeNextCount = tasks.filter((t) => t.aiAction.trim().toLowerCase() === 'take next').length;
    console.log(colors.muted(`  ${tasks.length} task(s) analyzed — ${takeNextCount} recommended to take next`));
    console.log('');
}
export function printAnalyzeProse(text) {
    console.log('');
    const width = 78;
    console.log(colors.muted('  ┌─') +
        chalk.cyan.bold(' ANALYSIS NOTES ') +
        colors.muted('─'.repeat(Math.max(0, width - 19)) + '┐'));
    const lines = text.split('\n');
    for (const line of lines) {
        const chunks = wrapText(line, width - 4);
        for (const chunk of chunks) {
            const padding = width - 2 - visibleLength(chunk);
            console.log(colors.muted('  │ ') + chunk + ' '.repeat(Math.max(0, padding)) + colors.muted('│'));
        }
    }
    console.log(colors.muted('  └' + '─'.repeat(width) + '┘'));
    console.log('');
}
const PRIORITIZE_CATEGORIES = {
    'prioritize': { title: 'PROMOTE TO PRIORITIZED', colorFn: chalk.green, icon: '^' },
    'keep-todo': { title: 'KEEP IN TODO', colorFn: chalk.blue, icon: '-' },
};
const PRIORITIZE_CATEGORY_ORDER = ['prioritize', 'keep-todo'];
function categorizePrioritizeTask(task) {
    const action = task.aiAction.trim().toLowerCase();
    if (action === 'prioritize')
        return 'prioritize';
    return 'keep-todo';
}
function printPrioritizeSection(tasks, meta) {
    console.log(meta.colorFn(`  [${meta.icon}] `) +
        colors.header(meta.title) +
        colors.muted(` (${tasks.length})`));
    console.log(colors.muted('  ' + '─'.repeat(meta.title.length + 6)));
    const descWidth = 58;
    const notesWidth = 58;
    const head = [
        chalk.dim('#'),
        chalk.dim('Task ID'),
        chalk.dim('AI Description'),
        chalk.dim('Pri'),
        chalk.dim('Action'),
        chalk.dim('Group'),
        chalk.dim('AI Notes'),
    ];
    const colWidths = [
        4, // #
        12, // Task ID
        descWidth + 2, // AI Description
        6, // Pri (High/Mid/Low)
        14, // Action
        13, // Group
        notesWidth + 2, // AI Notes
    ];
    const table = new Table({
        head,
        colWidths,
        chars: {
            'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
            'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
            'left': '  ', 'left-mid': '', 'mid': '', 'mid-mid': '',
            'right': '', 'right-mid': '', 'middle': ' ',
        },
        style: {
            head: [],
            border: [],
            'padding-left': 0,
            'padding-right': 0,
        },
        wordWrap: false,
    });
    table.push([
        chalk.dim('─'.repeat(2)),
        chalk.dim('─'.repeat(10)),
        chalk.dim('─'.repeat(descWidth)),
        chalk.dim('─'.repeat(4)),
        chalk.dim('─'.repeat(12)),
        chalk.dim('─'.repeat(11)),
        chalk.dim('─'.repeat(notesWidth)),
    ]);
    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        table.push([
            chalk.dim(String(i + 1)),
            colors.accent(t.taskId),
            chalk.white(truncate(t.aiDescription, descWidth)),
            aiPriorityBadge(t.aiPriority),
            prioritizeActionBadge(t.aiAction),
            groupBadge(t.aiGroup),
            aiNotesFormatted(truncate(t.aiNotes, notesWidth)),
        ]);
    }
    console.log(table.toString());
    console.log('');
}
function prioritizeActionBadge(action) {
    const norm = action.trim().toLowerCase();
    if (norm === 'prioritize')
        return chalk.green.bold('Prioritize');
    return chalk.blue.bold('Keep TODO');
}
export function printPrioritizeTable(tasks) {
    console.log('');
    const title = 'TODO PRIORITIZATION';
    console.log(colors.header(`  ${title}`));
    console.log(colors.muted('  ' + '═'.repeat(title.length)));
    console.log('');
    if (tasks.length === 0) {
        console.log(colors.muted('  No tasks parsed.'));
        console.log('');
        return;
    }
    // Group tasks by category
    const grouped = new Map();
    for (const t of tasks) {
        const cat = categorizePrioritizeTask(t);
        if (!grouped.has(cat))
            grouped.set(cat, []);
        grouped.get(cat).push(t);
    }
    // Print each non-empty category in order
    for (const cat of PRIORITIZE_CATEGORY_ORDER) {
        const catTasks = grouped.get(cat);
        if (catTasks && catTasks.length > 0) {
            printPrioritizeSection(catTasks, PRIORITIZE_CATEGORIES[cat]);
        }
    }
    // Summary counts
    const promoteCount = grouped.get('prioritize')?.length || 0;
    console.log(colors.muted(`  ${tasks.length} task(s) analyzed — ${promoteCount} recommended for promotion`));
    console.log('');
}
export function printPrioritizeProse(text) {
    console.log('');
    const width = 78;
    console.log(colors.muted('  ┌─') +
        chalk.cyan.bold(' PRIORITIZATION NOTES ') +
        colors.muted('─'.repeat(Math.max(0, width - 25)) + '┐'));
    const lines = text.split('\n');
    for (const line of lines) {
        const chunks = wrapText(line, width - 4);
        for (const chunk of chunks) {
            const padding = width - 2 - visibleLength(chunk);
            console.log(colors.muted('  │ ') + chunk + ' '.repeat(Math.max(0, padding)) + colors.muted('│'));
        }
    }
    console.log(colors.muted('  └' + '─'.repeat(width) + '┘'));
    console.log('');
}
// ── CSV Output ────────────────────────────────────────────────
export function printCsv(tasks, filePath) {
    const lines = ['Task ID,Score,AI Description,AI Priority,AI Notes'];
    for (const t of tasks) {
        const desc = truncate(t.description, 80).replace(/,/g, ';').replace(/"/g, "'");
        const pri = t.priority || '--';
        const notes = [];
        if (!t.priority)
            notes.push('No priority set');
        if (t.status === 'BLOCK')
            notes.push('Blocked');
        if (t.preproWork === '2 - High')
            notes.push('High prepro effort');
        if (t.risk === 'High')
            notes.push('High risk');
        const noteStr = notes.join('; ') || '--';
        lines.push(`${t.id},${t.score},${desc},${pri},${noteStr}`);
    }
    outputCsv(lines.join('\n'), filePath);
}
// ── Groom CSV Output ─────────────────────────────────────────
export function printGroomCsv(tasks, backlog, filePath) {
    const lines = ['Task ID,Score,AI Description,AI Priority,AI Action,AI Notes,AI Group'];
    // Build a score lookup from the backlog if available
    const scoreMap = new Map();
    if (backlog) {
        for (const t of backlog.tasks) {
            if (t.id)
                scoreMap.set(t.id, t.score);
        }
    }
    for (const t of tasks) {
        const score = scoreMap.get(t.taskId) ?? '--';
        const desc = t.aiDescription.replace(/,/g, ';').replace(/"/g, "'");
        const action = t.aiAction.replace(/,/g, ';').replace(/"/g, "'");
        const notes = t.aiNotes.replace(/,/g, ';').replace(/"/g, "'");
        const group = t.aiGroup.replace(/,/g, ';') || '--';
        lines.push(`${t.taskId},${score},${desc},${t.aiPriority},${action},${notes},${group}`);
    }
    outputCsv(lines.join('\n'), filePath);
}
// ── Show CSV Output ──────────────────────────────────────────
export function printTaskDetailCsv(task, filePath) {
    const desc = task.description
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/,/g, ';')
        .replace(/"/g, "'");
    const lines = [
        'Task ID,Priority,Status,Group,Type,Prepro,Risk,Appearance,Score,Description',
        [
            task.id,
            task.priority || '--',
            task.status || '--',
            task.group || '--',
            task.type || '--',
            task.preproWork || '--',
            task.risk || '--',
            task.appearance || '--',
            task.score,
            desc,
        ].join(','),
    ];
    outputCsv(lines.join('\n'), filePath);
}
// ── Stats CSV Output ─────────────────────────────────────────
export function printStatsCsv(backlog, filePath) {
    const lines = [];
    lines.push('Priority,Count');
    const byPriority = new Map();
    for (const t of backlog.tasks) {
        const p = t.priority || '(none)';
        byPriority.set(p, (byPriority.get(p) || 0) + 1);
    }
    for (const [p, count] of [...byPriority.entries()].sort()) {
        lines.push(`${p},${count}`);
    }
    lines.push('');
    lines.push('Status,Count');
    const byStatus = new Map();
    for (const t of backlog.tasks) {
        const s = t.status || '(none)';
        byStatus.set(s, (byStatus.get(s) || 0) + 1);
    }
    for (const [s, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`${s},${count}`);
    }
    lines.push('');
    lines.push('Group,Count');
    const byGroup = new Map();
    for (const t of backlog.tasks) {
        const g = t.group || '(none)';
        byGroup.set(g, (byGroup.get(g) || 0) + 1);
    }
    for (const [g, count] of [...byGroup.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`${g},${count}`);
    }
    outputCsv(lines.join('\n'), filePath);
}
// ── AI Response Box ───────────────────────────────────────────
export function printAiResponse(text) {
    console.log('');
    const width = 70;
    console.log(colors.muted('  ┌─') + chalk.cyan.bold(' AI ANALYSIS ') + colors.muted('─'.repeat(width - 16) + '┐'));
    const lines = text.split('\n');
    for (const line of lines) {
        // Wrap long lines
        const chunks = wrapText(line, width - 2);
        for (const chunk of chunks) {
            const padding = width - visibleLength(chunk);
            console.log(colors.muted('  │ ') + chunk + ' '.repeat(Math.max(0, padding)) + colors.muted('│'));
        }
    }
    console.log(colors.muted('  └' + '─'.repeat(width) + '┘'));
    console.log('');
}
function wrapText(text, maxWidth) {
    if (visibleLength(text) <= maxWidth)
        return [text];
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        if (current && visibleLength(current) + 1 + visibleLength(word) > maxWidth) {
            lines.push(current);
            current = word;
        }
        else {
            current = current ? current + ' ' + word : word;
        }
    }
    if (current)
        lines.push(current);
    return lines.length > 0 ? lines : [''];
}
// ── Helpers ───────────────────────────────────────────────────
// Strip ANSI escape codes for length calculation
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*m/g, '');
}
function visibleLength(str) {
    return stripAnsi(str).length;
}
//# sourceMappingURL=display.js.map