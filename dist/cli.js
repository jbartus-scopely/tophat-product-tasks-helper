#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { parseBacklog } from './parser.js';
import { scoreTasks } from './scorer.js';
import { printBanner, printWarnings, printStats, printTaskTable, printCsv, printGroomCsv, printStatsCsv, } from './display.js';
import { analyzeBacklog, groomTasks, prioritizeTasks, findDuplicates, checkAiAvailable, } from './ai.js';
import { select, input, confirm } from '@inquirer/prompts';
const DEFAULT_CSV = 'Forever Game Roadmap - Product Tasks Backlog.csv';
// --csv gives true (bare flag) or a string (file path)
function csvFilePath(opt) {
    if (typeof opt === 'string')
        return opt;
    return undefined;
}
function resolveFile(filePath) {
    if (filePath) {
        const abs = resolve(filePath);
        if (!existsSync(abs)) {
            console.error(chalk.red(`  File not found: ${abs}`));
            process.exit(1);
        }
        return abs;
    }
    // Search current directory and parent
    const candidates = [
        resolve(process.cwd(), DEFAULT_CSV),
        resolve(process.cwd(), '..', DEFAULT_CSV),
    ];
    for (const c of candidates) {
        if (existsSync(c))
            return c;
    }
    console.error(chalk.red(`  CSV file not found. Looked for:`));
    for (const c of candidates) {
        console.error(chalk.dim(`    ${c}`));
    }
    console.error(chalk.yellow(`\n  Specify a file with --file <path>`));
    process.exit(1);
}
function loadBacklog(filePath) {
    const file = resolveFile(filePath);
    const backlog = parseBacklog(file);
    scoreTasks(backlog);
    return backlog;
}
function getGroups(backlog) {
    const groups = new Set();
    for (const t of backlog.tasks) {
        if (t.group)
            groups.add(t.group);
    }
    return [...groups].sort();
}
async function pickGroup(backlog) {
    const groups = getGroups(backlog);
    if (groups.length === 0)
        return undefined;
    const group = await select({
        message: 'Filter by group?',
        choices: [
            { name: 'All groups', value: '' },
            ...groups.map((g) => ({ name: g, value: g })),
        ],
    });
    return group || undefined;
}
async function runInteractive(backlog) {
    printBanner(backlog);
    printWarnings(backlog);
    const aiAvailable = checkAiAvailable();
    while (true) {
        console.log('');
        const command = await select({
            message: 'What would you like to do?',
            choices: [
                { name: 'List tasks by category', value: 'list' },
                { name: 'Show backlog stats', value: 'stats' },
                { name: 'AI: Analyze backlog (ask a question)', value: 'analyze', disabled: !aiAvailable && '(Claude CLI not found)' },
                { name: 'AI: Groom triage tasks', value: 'groom', disabled: !aiAvailable && '(Claude CLI not found)' },
                { name: 'AI: Prioritize TODO tasks', value: 'prioritize', disabled: !aiAvailable && '(Claude CLI not found)' },
                { name: 'AI: Find duplicates', value: 'duplicates', disabled: !aiAvailable && '(Claude CLI not found)' },
                { name: 'Exit', value: 'exit' },
            ],
        });
        if (command === 'exit') {
            console.log(chalk.dim('  Bye!'));
            break;
        }
        if (command === 'list') {
            const category = await select({
                message: 'Which category?',
                choices: [
                    { name: 'Triage', value: 'triage' },
                    { name: 'Backlog', value: 'backlog' },
                    { name: 'In Progress', value: 'inprogress' },
                    { name: 'Done', value: 'done' },
                    { name: 'Blocked', value: 'blocked' },
                ],
            });
            const group = await pickGroup(backlog);
            const cat = LIST_CATEGORIES[category];
            let tasks = backlog.tasks.filter((t) => cat.statuses.some((s) => t.status === s));
            if (group) {
                tasks = tasks.filter((t) => t.group.toLowerCase() === group.toLowerCase());
            }
            tasks = tasks.slice(0, 30);
            printTaskTable(tasks, cat.title);
            const exportCsv = await confirm({ message: 'Export as CSV?', default: false });
            if (exportCsv) {
                printCsv(tasks);
            }
        }
        if (command === 'stats') {
            printStats(backlog);
            const exportCsv = await confirm({ message: 'Export as CSV?', default: false });
            if (exportCsv) {
                printStatsCsv(backlog);
            }
        }
        if (command === 'analyze') {
            const ask = await input({ message: 'What do you want to know about the backlog?' });
            if (!ask.trim())
                continue;
            const group = await pickGroup(backlog);
            const result = await analyzeBacklog(backlog, ask, group);
            if (result && result.tasks.length > 0) {
                const exportCsv = await confirm({ message: 'Export as CSV?', default: false });
                if (exportCsv) {
                    printGroomCsv(result.tasks, backlog);
                }
            }
        }
        if (command === 'groom') {
            const group = await pickGroup(backlog);
            const verbose = await confirm({ message: 'Show full AI reasoning?', default: false });
            const result = await groomTasks(backlog, group, verbose);
            if (result && result.tasks.length > 0) {
                const exportCsv = await confirm({ message: 'Export as CSV?', default: false });
                if (exportCsv) {
                    printGroomCsv(result.tasks, backlog);
                }
            }
        }
        if (command === 'prioritize') {
            const group = await pickGroup(backlog);
            const verbose = await confirm({ message: 'Show full AI reasoning?', default: false });
            const result = await prioritizeTasks(backlog, group, verbose);
            if (result && result.tasks.length > 0) {
                const exportCsv = await confirm({ message: 'Export as CSV?', default: false });
                if (exportCsv) {
                    printGroomCsv(result.tasks, backlog);
                }
            }
        }
        if (command === 'duplicates') {
            await findDuplicates(backlog);
        }
    }
}
// ── CLI Setup ─────────────────────────────────────────────────
const program = new Command();
program
    .name('pth')
    .description('Product Tasks Helper — backlog prioritization & analysis')
    .version('1.0.0')
    .option('-f, --file <path>', 'Path to CSV backlog file');
// ── list ──────────────────────────────────────────────────────
const LIST_CATEGORIES = {
    triage: { statuses: ['TRIAGE'], title: 'TRIAGE' },
    backlog: { statuses: ['TODO', 'Prioritized'], title: 'BACKLOG (TODO + Prioritized)' },
    inprogress: { statuses: ['Pre-Pro Ready', 'Prepro-In Progress', 'Pod Working'], title: 'IN PROGRESS' },
    done: { statuses: ['Live', 'Ready for release'], title: 'DONE' },
    blocked: { statuses: ['BLOCK'], title: 'BLOCKED' },
};
program
    .command('list <category>')
    .description('List tasks by category: triage, backlog, inprogress, done, blocked')
    .option('-n, --limit <n>', 'Number of tasks to show', '30')
    .option('-g, --group <group>', 'Filter by group')
    .option('--csv [file]', 'Output as CSV (to stdout or to file if path given)')
    .action(async (category, opts) => {
    const key = category.toLowerCase();
    const cat = LIST_CATEGORIES[key];
    if (!cat) {
        console.error(chalk.red(`  Unknown category: ${category}`));
        console.error(chalk.dim(`  Valid categories: triage, backlog, inprogress, done, blocked`));
        process.exit(1);
    }
    const backlog = loadBacklog(program.opts().file);
    printBanner(backlog);
    let tasks = backlog.tasks.filter((t) => cat.statuses.some((s) => t.status === s));
    if (opts.group) {
        const g = opts.group.toLowerCase();
        tasks = tasks.filter((t) => t.group.toLowerCase().includes(g));
    }
    tasks = tasks.slice(0, parseInt(opts.limit));
    printTaskTable(tasks, cat.title);
    if (opts.csv) {
        printCsv(tasks, csvFilePath(opts.csv));
    }
});
// ── stats ─────────────────────────────────────────────────────
program
    .command('stats')
    .description('Show backlog statistics dashboard')
    .option('--csv [file]', 'Output as CSV (to stdout or to file if path given)')
    .action(async (opts) => {
    const backlog = loadBacklog(program.opts().file);
    printStats(backlog);
    if (opts.csv) {
        printStatsCsv(backlog, csvFilePath(opts.csv));
    }
});
// ── analyze ───────────────────────────────────────────────────
program
    .command('analyze <ask>')
    .description('AI-powered backlog analysis — pass your question as the argument')
    .option('-g, --group <group>', 'Focus analysis on a specific group')
    .option('--csv [file]', 'Output as CSV (to stdout or to file if path given)')
    .action(async (ask, opts) => {
    const backlog = loadBacklog(program.opts().file);
    printBanner(backlog);
    const result = await analyzeBacklog(backlog, ask, opts.group);
    if (opts.csv && result && result.tasks.length > 0) {
        printGroomCsv(result.tasks, backlog, csvFilePath(opts.csv));
    }
});
// ── groom ─────────────────────────────────────────────────────
program
    .command('groom')
    .description('AI-powered triage grooming — propose TODO candidates, duplicates, and scope issues')
    .option('-g, --group <group>', 'Focus on a specific group')
    .option('--verbose', 'Show full AI reasoning notes')
    .option('--cache', 'Use cached AI response instead of calling AI again')
    .option('--csv [file]', 'Output as CSV (to stdout or to file if path given)')
    .action(async (opts) => {
    const backlog = loadBacklog(program.opts().file);
    printBanner(backlog);
    const result = await groomTasks(backlog, opts.group, opts.verbose, opts.cache);
    if (opts.csv && result && result.tasks.length > 0) {
        printGroomCsv(result.tasks, backlog, csvFilePath(opts.csv));
    }
});
// ── prioritize ───────────────────────────────────────────────
program
    .command('prioritize')
    .description('AI-powered analysis of TODO tasks — propose which should be promoted to Prioritized')
    .option('-g, --group <group>', 'Focus on a specific group')
    .option('--verbose', 'Show full AI reasoning notes')
    .option('--cache', 'Use cached AI response instead of calling AI again')
    .option('--csv [file]', 'Output as CSV (to stdout or to file if path given)')
    .action(async (opts) => {
    const backlog = loadBacklog(program.opts().file);
    printBanner(backlog);
    const result = await prioritizeTasks(backlog, opts.group, opts.verbose, opts.cache);
    if (opts.csv && result && result.tasks.length > 0) {
        printGroomCsv(result.tasks, backlog, csvFilePath(opts.csv));
    }
});
// ── duplicates ────────────────────────────────────────────────
program
    .command('duplicates')
    .description('Find duplicate and related tasks (requires ANTHROPIC_API_KEY)')
    .option('--cache', 'Use cached AI response instead of calling AI again')
    .action(async (opts) => {
    const backlog = loadBacklog(program.opts().file);
    printBanner(backlog);
    printWarnings(backlog);
    await findDuplicates(backlog, opts.cache);
});
// ── web ──────────────────────────────────────────────────────
program
    .command('web')
    .description('Start the web UI')
    .option('-p, --port <port>', 'Port number', '3000')
    .action(async (opts) => {
    const { startServer } = await import('./server.js');
    startServer(parseInt(opts.port), program.opts().file);
});
// ── Default (interactive mode) ───────────────────────────────
program.action(async () => {
    const backlog = loadBacklog(program.opts().file);
    await runInteractive(backlog);
});
program.parseAsync(process.argv);
//# sourceMappingURL=cli.js.map