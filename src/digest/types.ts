export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log (plan.md § 1).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as "—"
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string; // ISO 8601, offset kept from the log
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse, counted never thrown
  counts: Record<RunStatus, number>; // run lines per status; bad lines excluded
};

// Returns null when runs/<night>.jsonl does not exist.
export type ReadNight = (runsDir: string, night: string) => Night | null;
