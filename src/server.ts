import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { parseBacklogFromString } from './parser.js';
import { computeStats } from './api.js';
import { loadJiraSavedSectionsConfig } from './jiraConfig.js';
import { searchJiraIssues, type JiraIssueSearchParams, type JiraIssueSearchResult } from './jiraSearch.js';
import type {
  BacklogData,
  JiraConfigError,
  JiraSavedSectionsConfigResult,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEB_DIR = resolve(__dirname, '..', 'src', 'web');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

type JiraConfigLoader = () => JiraSavedSectionsConfigResult;
type JiraIssueSearcher = (params: JiraIssueSearchParams) => Promise<JiraIssueSearchResult>;

export interface ServerAppOptions {
  jiraConfigLoader?: JiraConfigLoader;
  jiraIssueSearcher?: JiraIssueSearcher;
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function log(icon: string, msg: string): void {
  console.log(`  ${icon}  [${timestamp()}] ${msg}`);
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

export function createApp(options: ServerAppOptions = {}): Hono {
  const app = new Hono();
  const jiraConfigLoader = options.jiraConfigLoader ?? loadJiraSavedSectionsConfig;
  const jiraIssueSearcher = options.jiraIssueSearcher ?? searchJiraIssues;

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
      const parsed = parseBacklogFromString(csv);
      log('<<', `CSV parsed — ${parsed.tasks.length} tasks`);
      return c.json({
        success: true,
        ...serializeBacklog(parsed),
        stats: computeStats(parsed),
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  // ── API: Backlog data ────────────────────────────────────
  app.get('/api/backlog', (c) => {
    return c.json({ loaded: false });
  });

  app.get('/api/stats', (c) => {
    return c.json({ error: 'CSV data is stored in the browser. Upload a CSV first.' }, 400);
  });

  app.get('/api/groups', (c) => {
    return c.json({ error: 'CSV data is stored in the browser. Upload a CSV first.' }, 400);
  });

  app.get('/api/pods', (c) => {
    return c.json({ error: 'CSV data is stored in the browser. Upload a CSV first.' }, 400);
  });

  app.get('/api/scores', (c) => {
    return c.json({});
  });

  app.get('/api/categories/:name/statuses', (c) => {
    return c.json([]);
  });

  app.get('/api/tasks', (c) => {
    return c.json({ tasks: [], title: 'CSV data is stored in the browser', total: 0 });
  });

  app.get('/api/tasks/:id', (c) => {
    return c.json({ error: 'CSV data is stored in the browser.' }, 404);
  });

  // ── API: Jira ────────────────────────────────────────────
  app.get('/api/jira/sections', (c) => {
    const result = jiraConfigLoader();
    if (!result.ok) return c.json(jiraConfigErrorResponse(result.error), 400);

    return c.json({ sections: result.sections });
  });

  app.post('/api/jira/sections/search', async (c) => {
    const config = jiraConfigLoader();
    if (!config.ok) return c.json(jiraConfigErrorResponse(config.error), 400);

    const sections = [];
    for (const section of config.sections) {
      const result = await jiraIssueSearcher({
        jql: section.jql,
        sourceSectionId: section.id,
        sourceSectionTitle: section.title,
      });

      if (result.ok) {
        sections.push({
          ...section,
          issues: result.issues,
          warnings: result.warnings,
        });
      } else {
        sections.push({
          ...section,
          issues: [],
          warnings: [],
          error: routeErrorMessage(result.error),
        });
      }
    }

    return c.json({ sections });
  });

  app.post('/api/jira/search', async (c) => {
    const body = await parseJsonBody(c.req.raw);
    if (!body.ok) return c.json({ error: body.error }, 400);

    const jql = typeof body.value.jql === 'string' ? body.value.jql.trim() : '';
    if (!jql) return c.json({ error: 'Missing "jql" field.' }, 400);

    const result = await jiraIssueSearcher({
      jql,
      sourceSectionId: 'ad-hoc',
      sourceSectionTitle: 'Ad hoc JQL',
    });

    if (!result.ok) {
      return c.json(routeErrorResponse(result.error), routeErrorStatus(result.error));
    }

    return c.json({
      issues: result.issues,
      warnings: result.warnings,
    });
  });

  return app;
}

export function startServer(port: number, _filePath?: string): void {
  const app = createApp();

  serve({ fetch: app.fetch, port }, () => {
    console.log(`\n  PTH Web UI running at http://localhost:${port}`);
    console.log('  CSV data is loaded from browser uploads\n');
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

function jiraConfigErrorResponse(error: JiraConfigError): { error: string; details?: string[] } {
  const response: { error: string; details?: string[] } = { error: sanitizeRouteText(error.message) };
  if (error.details?.length) response.details = error.details.map(sanitizeRouteText);
  return response;
}

function routeErrorResponse(error: { message: string; details?: string[] }): { error: string; details?: string[] } {
  const response: { error: string; details?: string[] } = { error: routeErrorMessage(error) };
  if (error.details?.length) response.details = error.details.map(sanitizeRouteText);
  return response;
}

function routeErrorMessage(error: { message: string }): string {
  return sanitizeRouteText(error.message || 'Jira request failed.');
}

function routeErrorStatus(error: { code?: string; status?: number }): 400 | 502 | 500 {
  if (error.status && error.status >= 400 && error.status < 500) return 400;
  if (error.status && error.status >= 500) return 502;
  if (error.code?.includes('env') || error.code?.includes('invalid')) return 400;
  return 500;
}

async function parseJsonBody(request: Request): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }
> {
  try {
    const value = await request.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { ok: true, value: value as Record<string, unknown> };
    }
    return { ok: false, error: 'Request body must be a JSON object.' };
  } catch {
    return { ok: false, error: 'Request body must be valid JSON.' };
  }
}

function sanitizeRouteText(value: string): string {
  let sanitized = value;
  for (const secret of [process.env.JIRA_API_TOKEN, process.env.JIRA_EMAIL].filter(Boolean)) {
    sanitized = sanitized.split(secret as string).join('[redacted]');
  }
  return sanitized.replace(/authorization/gi, '[redacted]');
}
