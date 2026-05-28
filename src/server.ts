import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { parseBacklog } from './parser.js';
import { scoreTasks } from './scorer.js';
import {
  loadBacklog,
  computeStats,
  getGroups,
  getPods,
  getCategoryStatuses,
  getScoreMap,
  filterTasks,
  getTask,
  isAiAvailable,
  isClaudeAvailable,
  isCodexAvailable,
  apiAnalyze,
  apiGroom,
  apiPrioritize,
  apiFindDuplicates,
} from './api.js';
import type { BacklogData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEB_DIR = resolve(__dirname, '..', 'src', 'web');
const DEFAULT_CSV = 'Forever Game Roadmap - Product Tasks Backlog.csv';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

let backlog: BacklogData | null = null;

function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function log(icon: string, msg: string): void {
  console.log(`  ${icon}  [${timestamp()}] ${msg}`);
}

function tryLoadDefaultCsv(filePath?: string): void {
  const candidates = filePath
    ? [resolve(filePath)]
    : [
        resolve(process.cwd(), DEFAULT_CSV),
        resolve(process.cwd(), '..', DEFAULT_CSV),
      ];

  for (const c of candidates) {
    if (existsSync(c)) {
      const csv = readFileSync(c, 'utf-8');
      backlog = loadBacklog(csv);
      return;
    }
  }
}

function serializeBacklog(b: BacklogData): object {
  return {
    tasks: b.tasks,
    duplicateIds: Object.fromEntries(b.duplicateIds),
    warnings: b.warnings,
    totalRaw: b.totalRaw,
    filtered: b.filtered,
  };
}

function requireBacklog(): BacklogData {
  if (!backlog) throw new Error('No backlog loaded. Upload a CSV first.');
  return backlog;
}

export function startServer(port: number, filePath?: string): void {
  tryLoadDefaultCsv(filePath);

  const app = new Hono();

  // ── Static files ─────────────────────────────────────────
  app.get('/', (c) => {
    const html = readFileSync(resolve(WEB_DIR, 'index.html'), 'utf-8');
    return c.html(html);
  });

  app.get('/:file{.+\\.(css|js|svg|png)}', (c) => {
    const file = c.req.param('file');
    const filePath = resolve(WEB_DIR, file);
    if (!filePath.startsWith(WEB_DIR) || !existsSync(filePath)) {
      return c.notFound();
    }
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath, 'utf-8');
    return c.text(content, 200, { 'Content-Type': mime });
  });

  // ── API: Upload CSV ──────────────────────────────────────
  app.post('/api/upload', async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!file || typeof file === 'string') {
        return c.json({ error: 'No file uploaded' }, 400);
      }
      const csv = await (file as File).text();
      log('>>', 'CSV upload received');
      backlog = loadBacklog(csv);
      log('<<', `CSV loaded — ${backlog.tasks.length} tasks`);
      return c.json({ success: true, stats: computeStats(backlog) });
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  // ── API: Backlog data ────────────────────────────────────
  app.get('/api/backlog', (c) => {
    if (!backlog) return c.json({ loaded: false });
    return c.json({ loaded: true, ...serializeBacklog(backlog) });
  });

  app.get('/api/stats', (c) => {
    try {
      return c.json(computeStats(requireBacklog()));
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.get('/api/groups', (c) => {
    try {
      return c.json(getGroups(requireBacklog()));
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.get('/api/pods', (c) => {
    try {
      return c.json(getPods(requireBacklog()));
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.get('/api/scores', (c) => {
    try {
      return c.json(getScoreMap(requireBacklog()));
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.get('/api/categories/:name/statuses', (c) => {
    return c.json(getCategoryStatuses(c.req.param('name')));
  });

  app.get('/api/tasks', (c) => {
    try {
      const category = c.req.query('category') || 'backlog';
      const group = c.req.query('group') || undefined;
      const limit = parseInt(c.req.query('limit') || '50');
      const priority = c.req.query('priority') || undefined;
      const pod = c.req.query('pod') || undefined;
      const status = c.req.query('status') || undefined;
      return c.json(filterTasks(requireBacklog(), category, group, limit, priority, pod, status));
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.get('/api/tasks/:id', (c) => {
    try {
      const task = getTask(requireBacklog(), c.req.param('id'));
      if (!task) return c.json({ error: 'Task not found' }, 404);
      return c.json(task);
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  // ── API: AI ──────────────────────────────────────────────
  app.get('/api/ai/status', (c) => {
    return c.json({
      available: isAiAvailable(),
      claude: isClaudeAvailable(),
      codex: isCodexAvailable(),
    });
  });

  app.get('/api/ai/models', (c) => {
    const claude = isClaudeAvailable();
    const codex = isCodexAvailable();
    const models: Array<{ id: string; label: string; category: string; desc?: string; provider?: string }> = [
      { id: '', label: 'Default (CLI setting)', category: 'default' },
    ];
    if (claude) {
      models.push(
        { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', category: 'fast', desc: 'Fastest, good for simple queries', provider: 'claude' },
        { id: 'claude-sonnet-4-5-20250514', label: 'Sonnet 4.5', category: 'fast', desc: 'Fast and capable', provider: 'claude' },
        { id: 'claude-sonnet-4-6-20250514', label: 'Sonnet 4.6', category: 'balanced', desc: 'Best balance of speed and quality', provider: 'claude' },
        { id: 'claude-opus-4-6-20250414', label: 'Opus 4.6', category: 'thoughtful', desc: 'Deep analysis, slower', provider: 'claude' },
        { id: 'claude-opus-4-7-20250506', label: 'Opus 4.7', category: 'thoughtful', desc: 'Most capable, slowest', provider: 'claude' },
      );
    }
    if (codex) {
      models.push(
        { id: 'o3-mini', label: 'o3-mini', category: 'codex-fast', desc: 'Fast reasoning model', provider: 'codex' },
        { id: 'o4-mini', label: 'o4-mini', category: 'codex-fast', desc: 'Fast and efficient', provider: 'codex' },
        { id: 'gpt-4.1', label: 'GPT-4.1', category: 'codex-balanced', desc: 'Balanced capability', provider: 'codex' },
        { id: 'o3', label: 'o3', category: 'codex-thoughtful', desc: 'Deep reasoning', provider: 'codex' },
      );
    }
    return c.json(models);
  });

  app.post('/api/ai/analyze', async (c) => {
    try {
      const { ask, group, model } = await c.req.json();
      if (!ask) return c.json({ error: 'Missing "ask" field' }, 400);
      const label = group ? `analyze [${group}]` : 'analyze';
      log('>>',  `${label} — "${ask}"${model ? ` (${model})` : ''}`);
      const start = Date.now();
      const result = await apiAnalyze(requireBacklog(), ask, group, model || undefined);
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      const count = result?.tasks.length ?? 0;
      log('<<', `${label} done — ${count} tasks, ${sec}s`);
      return c.json(result || { tasks: [], prose: '' });
    } catch (e: any) {
      log('!!', `analyze error — ${e.message}`);
      return c.json({ error: e.message }, 500);
    }
  });

  app.post('/api/ai/groom', async (c) => {
    try {
      const { group, cache, model } = await c.req.json();
      const label = group ? `groom [${group}]` : 'groom';
      log('>>', `${label}${cache ? ' (cached)' : ''}${model ? ` (${model})` : ''}`);
      const start = Date.now();
      const result = await apiGroom(requireBacklog(), group, cache, model || undefined);
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      const count = result?.tasks.length ?? 0;
      log('<<', `${label} done — ${count} tasks, ${sec}s`);
      return c.json(result || { tasks: [], prose: '' });
    } catch (e: any) {
      log('!!', `groom error — ${e.message}`);
      return c.json({ error: e.message }, 500);
    }
  });

  app.post('/api/ai/prioritize', async (c) => {
    try {
      const { group, cache, model } = await c.req.json();
      const label = group ? `prioritize [${group}]` : 'prioritize';
      log('>>', `${label}${cache ? ' (cached)' : ''}${model ? ` (${model})` : ''}`);
      const start = Date.now();
      const result = await apiPrioritize(requireBacklog(), group, cache, model || undefined);
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      const count = result?.tasks.length ?? 0;
      log('<<', `${label} done — ${count} tasks, ${sec}s`);
      return c.json(result || { tasks: [], prose: '' });
    } catch (e: any) {
      log('!!', `prioritize error — ${e.message}`);
      return c.json({ error: e.message }, 500);
    }
  });

  app.post('/api/ai/duplicates', async (c) => {
    try {
      const { cache, model } = await c.req.json();
      log('>>', `duplicates${cache ? ' (cached)' : ''}${model ? ` (${model})` : ''}`);
      const start = Date.now();
      const result = await apiFindDuplicates(requireBacklog(), cache, model || undefined);
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      log('<<', `duplicates done — ${sec}s`);
      return c.json(result || { text: '' });
    } catch (e: any) {
      log('!!', `duplicates error — ${e.message}`);
      return c.json({ error: e.message }, 500);
    }
  });

  serve({ fetch: app.fetch, port }, () => {
    const loaded = backlog ? `${backlog.tasks.length} tasks loaded` : 'no CSV loaded';
    console.log(`\n  PTH Web UI running at http://localhost:${port}`);
    console.log(`  ${loaded}\n`);
  });
}

// Allow running directly: npx tsx src/server.ts
const isMain = process.argv[1] && (
  process.argv[1].endsWith('/server.ts') ||
  process.argv[1].endsWith('/server.js')
);
if (isMain) {
  await import('dotenv/config');
  const port = parseInt(process.env.PTH_PORT || '3000');
  startServer(port);
}
