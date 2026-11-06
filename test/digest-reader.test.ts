import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

describe('readNight on the real night', () => {
  const night = readNight('runs', '2026-10-28');

  it('has 5 jobs sorted by job and 1 bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('counts retries, keeps null owner and offsets', () => {
    const rows = night!.rows;
    const fx = rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fx).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(fx.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
    expect(rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'digest-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a missing night', () => {
    expect(readNight(dir, '2000-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(dir, 'n.jsonl'), '');
    expect(readNight(dir, 'n')).toEqual({ night: 'n', rows: [], badLines: 0 });
  });

  it('counts garbage and incomplete lines without throwing', () => {
    writeFileSync(
      join(dir, 'n.jsonl'),
      [
        'not json',
        '[1]',
        'null',
        '{"job":"a","status":"ok"}',
        '{"at":"2026-01-01T00:00:00Z","status":"ok"}',
        '{"at":"2026-01-01T00:00:00Z","job":"a","status":"weird"}',
        '{"at":"nope","job":"a","status":"ok"}',
        '{"at":"2026-01-01T00:00:00Z","job":"a","status":"ok"}',
      ].join('\n'),
    );
    const n = readNight(dir, 'n')!;
    expect(n.badLines).toBe(7);
    expect(n.rows).toHaveLength(1);
  });

  it('picks the latest line by at, not by position, across offsets', () => {
    writeFileSync(
      join(dir, 'n.jsonl'),
      [
        '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"fail","owner":"x","error":"late"}',
        '{"at":"2026-01-01T00:30:00-02:00","job":"a","status":"retry","owner":"x","error":"early"}',
      ].join('\n'),
    );
    // 00:30-02:00 is 02:30Z, later than 01:00Z.
    const row = readNight(dir, 'n')!.rows[0]!;
    expect(row).toMatchObject({
      lastStatus: 'retry',
      lastError: 'early',
      retries: 1,
      firstAt: '2026-01-01T02:00:00+01:00',
      lastAt: '2026-01-01T00:30:00-02:00',
    });
  });
});
