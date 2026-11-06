import type { DigestRow } from './types.js';

// Shown wherever a value is missing (plan.md § 2a, styleguide: never an empty cell).
export const MISSING = '—';

// A night name is YYYY-MM-DD; anything else never reaches the filesystem.
export function isNightName(night: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(night);
}

// Marked rows: three or more retries, or a final status of fail.
export function isFlagged(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

export function orMissing(value: string | null): string {
  return value ?? MISSING;
}
