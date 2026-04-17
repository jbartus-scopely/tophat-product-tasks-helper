import { spawn, execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';
import chalk from 'chalk';
import type { Task, BacklogData, GroomedTask, GroomResult } from './types.js';
import { printGroomTable, printGroomProse } from './display.js';
import { getCached, getLastCached, saveCache } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = resolve(__dirname, '..', 'prompts');
function getModelArgs(): string[] {
  const model = process.env.PTH_MODEL;
  return model ? ['--model', model] : [];
}

function loadPrompt(name: string, vars: Record<string, string> = {}): string {
  const filePath = resolve(PROMPTS_DIR, `${name}.txt`);
  let content = readFileSync(filePath, 'utf-8').trim();
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}

function getSystemPrompt(): string {
  return loadPrompt('system');
}

function tasksToCompactCsv(tasks: Task[]): string {
  const header = 'ID,Priority,Status,Group,Type,Prepro,Risk,Appearance,Description';
  const rows = tasks.map((t) => {
    const desc = t.description
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
      .replace(/,/g, ';')
      .replace(/"/g, "'");
    return [
      t.id,
      t.priority || '--',
      t.status || '--',
      t.group || '--',
      t.type || '--',
      t.preproWork || '--',
      t.risk || '--',
      t.appearance || '--',
      desc,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function findClaudeCli(): string | null {
  try {
    const path = execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim();
    return path || null;
  } catch {
    return null;
  }
}

export function checkAiAvailable(): boolean {
  return findClaudeCli() !== null;
}

export function printAiUnavailable(): void {
  console.log('');
  console.log(chalk.yellow('  AI features require the Claude CLI to be installed.'));
  console.log(chalk.dim('  Install it from: https://claude.ai/claude-code'));
  console.log('');
}

async function runClaudeCollect(prompt: string): Promise<string | null> {
  const claudePath = findClaudeCli();
  if (!claudePath) {
    printAiUnavailable();
    return null;
  }

  const spinner = ora({
    text: chalk.dim('Asking Claude...'),
    spinner: 'dots',
    color: 'cyan',
  }).start();

  return new Promise<string | null>((resolve) => {
    const child = spawn(claudePath, [
      '--print',
      ...getModelArgs(),
      '--system-prompt', getSystemPrompt(),
      prompt,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      spinner.stop();
      if (code !== 0) {
        console.log(chalk.red(`  Claude CLI error (exit ${code}):`));
        if (stderr.trim()) {
          console.log(chalk.dim(`  ${stderr.trim()}`));
        }
        console.log('');
        resolve(null);
      } else {
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      spinner.stop();
      console.log(chalk.red(`  Failed to run Claude CLI: ${err.message}`));
      console.log('');
      resolve(null);
    });
  });
}

async function runClaude(prompt: string, title: string): Promise<void> {
  const claudePath = findClaudeCli();
  if (!claudePath) {
    printAiUnavailable();
    return;
  }

  const spinner = ora({
    text: chalk.dim('Asking Claude...'),
    spinner: 'dots',
    color: 'cyan',
  }).start();

  const width = 70;

  return new Promise<void>((resolve) => {
    const child = spawn(claudePath, [
      '--print',
      ...getModelArgs(),
      '--system-prompt', getSystemPrompt(),
      prompt,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let started = false;
    let lineLen = 0;

    function openBox() {
      if (!started) {
        spinner.stop();
        console.log('');
        console.log(
          chalk.dim('  ┌─') +
          chalk.cyan.bold(` ${title} `) +
          chalk.dim('─'.repeat(Math.max(0, width - title.length - 4)) + '┐')
        );
        process.stdout.write(chalk.dim('  │ '));
        started = true;
      }
    }

    child.stdout.on('data', (data: Buffer) => {
      openBox();
      const text = data.toString();
      for (const char of text) {
        if (char === '\n') {
          process.stdout.write(
            ' '.repeat(Math.max(0, width - 2 - lineLen)) +
            chalk.dim('│') + '\n' + chalk.dim('  │ ')
          );
          lineLen = 0;
        } else {
          process.stdout.write(char);
          lineLen++;
          if (lineLen >= width - 2) {
            process.stdout.write(chalk.dim('│') + '\n' + chalk.dim('  │ '));
            lineLen = 0;
          }
        }
      }
    });

    let stderrBuf = '';
    child.stderr.on('data', (data: Buffer) => {
      stderrBuf += data.toString();
    });

    child.on('close', (code) => {
      if (started) {
        // Close the box
        process.stdout.write(
          ' '.repeat(Math.max(0, width - 2 - lineLen)) +
          chalk.dim('│') + '\n'
        );
        console.log(chalk.dim('  └' + '─'.repeat(width) + '┘'));
        console.log('');
      } else {
        spinner.stop();
        if (code !== 0) {
          console.log(chalk.red(`  Claude CLI error (exit ${code}):`));
          if (stderrBuf.trim()) {
            console.log(chalk.dim(`  ${stderrBuf.trim()}`));
          }
          console.log('');
        }
      }
      resolve();
    });

    child.on('error', (err) => {
      spinner.stop();
      console.log(chalk.red(`  Failed to run Claude CLI: ${err.message}`));
      console.log('');
      resolve();
    });
  });
}

export async function analyzeBacklog(backlog: BacklogData, ask: string, group?: string): Promise<GroomResult | null> {
  const relevantTasks = backlog.tasks.filter((t) => t.id && t.description);
  const csv = tasksToCompactCsv(relevantTasks);

  const warnings = backlog.warnings.length > 0
    ? `\n\nData warnings:\n${backlog.warnings.map((w) => `- ${w}`).join('\n')}`
    : '';

  const userPrompt = group
    ? `Focus on the "${group}" group. ${ask}`
    : ask;

  const prompt = loadPrompt('analyze', {
    taskCount: String(relevantTasks.length),
    csv,
    warnings,
    userPrompt,
  });

  const raw = await runClaudeCollect(prompt);
  if (!raw) return null;

  const result = parseGroomResponse(raw);

  if (result.tasks.length > 0) {
    const { printAnalyzeTable } = await import('./display.js');
    printAnalyzeTable(result.tasks, backlog);
  }

  if (result.tasks.length === 0 && !result.prose) {
    const { printAiResponse } = await import('./display.js');
    printAiResponse(raw);
  }

  return result;
}

function parseGroomResponse(raw: string): GroomResult {
  const lines = raw.split('\n');
  const tasks: GroomedTask[] = [];
  const proseLines: string[] = [];

  // Find CSV block — could be inside ```csv ... ``` or bare rows starting with a task ID
  let inCsvBlock = false;
  let headerSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect fenced CSV block
    if (/^```csv/i.test(trimmed)) {
      inCsvBlock = true;
      continue;
    }
    if (inCsvBlock && trimmed === '```') {
      inCsvBlock = false;
      continue;
    }

    // Inside a CSV block or bare CSV header
    if (inCsvBlock || (!headerSeen && /^Task\s*ID\s*,/i.test(trimmed))) {
      // Skip header row
      if (/^Task\s*ID\s*,/i.test(trimmed)) {
        headerSeen = true;
        if (!inCsvBlock) inCsvBlock = false; // bare CSV, just skip header
        continue;
      }

      if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('|')) {
        continue; // skip separators or empty lines within the block
      }

      // Parse CSV row — split on comma but respect quoted fields
      const fields = parseCsvRow(trimmed);
      if (fields.length >= 5) {
        // Expected: Task ID, AI Description, AI Priority, AI Action, AI Notes, AI Group
        // If 6+ fields: last one is AI Group, fields 4..n-1 are AI Notes (rejoin with commas)
        const hasGroup = fields.length >= 6;
        const aiGroup = hasGroup ? fields[fields.length - 1].trim() : '';
        const notesFields = hasGroup ? fields.slice(4, fields.length - 1) : fields.slice(4);
        tasks.push({
          taskId: fields[0].trim(),
          aiDescription: fields[1].trim(),
          aiPriority: fields[2].trim(),
          aiAction: fields[3].trim(),
          aiNotes: notesFields.join(',').trim(),
          aiGroup,
        });
      }
      continue;
    }

    // Everything else is prose
    proseLines.push(line);
  }

  // Clean up leading/trailing blank lines in prose
  const prose = proseLines.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trimEnd();

  return { tasks, prose };
}

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export async function groomTasks(backlog: BacklogData, group?: string, verbose?: boolean, cache?: boolean): Promise<GroomResult | null> {
  // Focus on TRIAGE tasks only
  let triageTasks = backlog.tasks.filter((t) => t.id && t.description && t.status === 'TRIAGE');
  if (group) {
    triageTasks = triageTasks.filter((t) => t.group.toLowerCase() === group.toLowerCase());
  }

  if (triageTasks.length === 0) {
    console.log(chalk.yellow('  No TRIAGE tasks found' + (group ? ` in group "${group}"` : '') + '.'));
    console.log('');
    return null;
  }

  const limited = triageTasks.slice(0, 80);
  const triageCsv = tasksToCompactCsv(limited);

  // Also provide non-TRIAGE tasks as context so Claude can spot overlaps
  const activeTasks = backlog.tasks.filter(
    (t) => t.id && t.description && t.status !== 'TRIAGE' && !['Live', 'HOLD'].includes(t.status) && t.status
  );
  const activeCsv = tasksToCompactCsv(activeTasks);

  const prompt = loadPrompt('groom', {
    taskCount: String(limited.length),
    groupFilter: group ? ` filtered to group "${group}"` : '',
    triageCsv,
    activeCount: String(activeTasks.length),
    activeCsv,
  });

  let raw: string | null = null;

  if (cache) {
    raw = getCached('groom', prompt) ?? getLastCached('groom');
    if (!raw) {
      console.log(chalk.yellow('  No cached response found, calling AI...'));
    }
  }

  if (!raw) {
    raw = await runClaudeCollect(prompt);
    if (!raw) return null;
    saveCache('groom', prompt, raw);
  }

  const result = parseGroomResponse(raw);

  if (result.tasks.length > 0) {
    printGroomTable(result.tasks);
  }

  if (verbose && result.prose) {
    printGroomProse(result.prose);
  }

  if (result.tasks.length === 0 && !result.prose) {
    const { printAiResponse } = await import('./display.js');
    printAiResponse(raw);
  }

  return result;
}

export async function prioritizeTasks(backlog: BacklogData, group?: string, verbose?: boolean, cache?: boolean): Promise<GroomResult | null> {
  // Focus on TODO tasks
  let todoTasks = backlog.tasks.filter((t) => t.id && t.description && t.status === 'TODO');
  if (group) {
    todoTasks = todoTasks.filter((t) => t.group.toLowerCase() === group.toLowerCase());
  }

  if (todoTasks.length === 0) {
    console.log(chalk.yellow('  No TODO tasks found' + (group ? ` in group "${group}"` : '') + '.'));
    console.log('');
    return null;
  }

  const limited = todoTasks.slice(0, 80);
  const todoCsv = tasksToCompactCsv(limited);

  // Provide already-prioritized tasks as context
  const prioritizedTasks = backlog.tasks.filter(
    (t) => t.id && t.description && ['Prioritized', 'Pre-Pro Ready'].includes(t.status)
  );
  const prioritizedCsv = tasksToCompactCsv(prioritizedTasks);

  const prompt = loadPrompt('prioritize', {
    taskCount: String(limited.length),
    groupFilter: group ? ` filtered to group "${group}"` : '',
    todoCsv,
    prioritizedCount: String(prioritizedTasks.length),
    prioritizedCsv,
  });

  let raw: string | null = null;

  if (cache) {
    raw = getCached('prioritize', prompt) ?? getLastCached('prioritize');
    if (!raw) {
      console.log(chalk.yellow('  No cached response found, calling AI...'));
    }
  }

  if (!raw) {
    raw = await runClaudeCollect(prompt);
    if (!raw) return null;
    saveCache('prioritize', prompt, raw);
  }

  const result = parseGroomResponse(raw);

  if (result.tasks.length > 0) {
    const { printPrioritizeTable } = await import('./display.js');
    printPrioritizeTable(result.tasks);
  }

  if (verbose && result.prose) {
    const { printPrioritizeProse } = await import('./display.js');
    printPrioritizeProse(result.prose);
  }

  if (result.tasks.length === 0 && !result.prose) {
    const { printAiResponse } = await import('./display.js');
    printAiResponse(raw);
  }

  return result;
}

export async function findDuplicates(backlog: BacklogData, cache?: boolean): Promise<void> {
  const tasks = backlog.tasks.filter((t) => t.id && t.description);
  const csv = tasksToCompactCsv(tasks);

  const prompt = loadPrompt('duplicates', {
    taskCount: String(tasks.length),
    csv,
    knownDuplicates: backlog.warnings.filter((w) => w.startsWith('Duplicate')).join(', ') || 'none detected by ID',
  });

  if (cache) {
    const cached = getCached('duplicates', prompt) ?? getLastCached('duplicates');
    if (cached) {
      const { printAiResponse } = await import('./display.js');
      printAiResponse(cached);
      return;
    }
    console.log(chalk.yellow('  No cached response found, calling AI...'));
  }

  const raw = await runClaudeCollect(prompt);
  if (!raw) return;

  saveCache('duplicates', prompt, raw);

  const { printAiResponse } = await import('./display.js');
  printAiResponse(raw);
}
