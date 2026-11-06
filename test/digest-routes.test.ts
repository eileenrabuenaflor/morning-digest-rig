import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Fixtures live in a temp dir, never in runs/ (read-only real nights).
let runsDir: string;

const config = () => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const line = (at: string, job: string, status: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, ...extra });

const NORMAL = '2026-11-02';
const EMPTY = '2026-11-03';
const BAD = '2026-11-04';
const MISSING_NIGHT = '2026-11-05';

// Job names in the page's table body, in rendered order.
function pageJobs(html: string): string[] {
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...body.matchAll(/<tr[^>]*>\s*<td>(?:<span class="warn">\[!\] <\/span>)?([^<]*)<\/td>/g)].map((m) => m[1]!);
}

beforeAll(async () => {
  runsDir = await mkdtemp(join(tmpdir(), 'rig-routes-'));
  // Unsorted on purpose, so the sort is actually exercised.
  await writeFile(
    join(runsDir, `${NORMAL}.jsonl`),
    [
      line('2026-11-02T01:00:00+01:00', 'lane/sync', 'ok', { owner: 'lane' }),
      line('2026-11-02T02:00:00+01:00', 'digest/render', 'retry', { error: 'timeout' }),
      line('2026-11-02T02:10:00+01:00', 'digest/render', 'retry', { error: 'timeout' }),
      line('2026-11-02T02:20:00+01:00', 'digest/render', 'fail', { error: 'disk full' }),
      line('2026-11-02T03:00:00+01:00', 'fixtures/refresh', 'ok'),
    ].join('\n') + '\n',
    'utf8',
  );
  await writeFile(join(runsDir, `${EMPTY}.jsonl`), '', 'utf8');
  await writeFile(
    join(runsDir, `${BAD}.jsonl`),
    [
      line('2026-11-04T01:00:00+01:00', 'lane/sync', 'ok'),
      'this is not json',
      line('2026-11-04T02:00:00+01:00', 'notes/backup', 'ok'),
    ].join('\n') + '\n',
    'utf8',
  );
});

afterAll(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

describe('routes over a temp runs dir', () => {
  it('normal night: 200 on both routes, page and JSON list the same jobs in the same order', async () => {
    const app = createApp(config());

    const page = await app.request(`/digest/${NORMAL}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(`digest · ${NORMAL}`);

    const api = await app.request(`/api/digest/${NORMAL}`);
    expect(api.status).toBe(200);
    const body = (await api.json()) as { night: string; rows: { job: string }[] };
    expect(body.night).toBe(NORMAL);

    const jsonJobs = body.rows.map((r) => r.job);
    expect(jsonJobs).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync']);
    expect(pageJobs(html)).toEqual(jsonJobs);
  });

  it('night with no file: 404 on both routes', async () => {
    const app = createApp(config());

    const page = await app.request(`/digest/${MISSING_NIGHT}`);
    expect(page.status).toBe(404);
    expect(await page.text()).toContain('no digest');

    const api = await app.request(`/api/digest/${MISSING_NIGHT}`);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: 'not found' });
  });

  it('empty night (empty file): page says "nothing ran", JSON has rows []', async () => {
    const app = createApp(config());

    const page = await app.request(`/digest/${EMPTY}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
    expect(html).toContain('0 bad lines skipped');

    const api = await app.request(`/api/digest/${EMPTY}`);
    expect(api.status).toBe(200);
    const body = (await api.json()) as { rows: unknown[]; badLines: number };
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('night with a bad line: 200 on both routes, page shows the count, JSON badLines matches', async () => {
    const app = createApp(config());

    const page = await app.request(`/digest/${BAD}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('1 bad line skipped');

    const api = await app.request(`/api/digest/${BAD}`);
    expect(api.status).toBe(200);
    const body = (await api.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
  });
});
