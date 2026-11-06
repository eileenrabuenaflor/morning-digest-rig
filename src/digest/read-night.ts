import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, RunStatus } from './types.js';

type Line = {
  at: string;
  ms: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse one log line at the edge; null when it is not a usable run line.
function parseLine(text: string): Line | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || typeof o.status !== 'string') return null;
  if (o.job === '' || !STATUSES.includes(o.status)) return null;
  const ms = Date.parse(o.at);
  if (Number.isNaN(ms)) return null;
  return {
    at: o.at,
    ms,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
}

export function readNight(runsDir: string, night: string): Night | null {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  let badLines = 0;
  const byJob = new Map<string, Line[]>();
  for (const text of readFileSync(file, 'utf8').split('\n')) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (!line) {
      badLines++;
      continue;
    }
    const list = byJob.get(line.job);
    if (list) list.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows: DigestRow[] = [];
  for (const [job, lines] of byJob) {
    let first = lines[0]!;
    let last = lines[0]!;
    for (const l of lines) {
      if (l.ms < first.ms) first = l;
      if (l.ms >= last.ms) last = l;
    }
    rows.push({
      job,
      owner: last.owner,
      runs: lines.length,
      retries: lines.filter((l) => l.status === 'retry').length,
      lastStatus: last.status,
      lastError: last.error,
      firstAt: first.at,
      lastAt: last.at,
    });
  }
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}
