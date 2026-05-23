import { describe, it, expect } from 'vitest';
import { migrateScheduleJson, migrateCompletedTasks } from './migrations';

describe('migrateScheduleJson', () => {
  it('upgrades MM-DD keys to YYYY-MM-DD format', () => {
    const input = JSON.stringify({ '01-01': '太 1', '12-31': '啟 22' });
    const output = migrateScheduleJson(input, 2026);
    const parsed = JSON.parse(output);
    expect(Object.keys(parsed)).toEqual(['2026-01-01', '2026-12-31']);
    expect(parsed['2026-01-01']).toBe('太 1');
  });

  it('preserves YYYY-MM-DD keys unchanged', () => {
    const input = JSON.stringify({ '2026-01-01': '太 1' });
    expect(migrateScheduleJson(input, 2026)).toBe(input);
  });

  it('returns the original string when JSON is mixed format', () => {
    const input = JSON.stringify({ '2026-01-01': '太 1', '01-02': '太 2' });
    expect(migrateScheduleJson(input, 2026)).toBe(input);
  });

  it('returns the original string when JSON is invalid', () => {
    expect(migrateScheduleJson('not-json', 2026)).toBe('not-json');
  });

  it('returns the original string for empty object', () => {
    const input = JSON.stringify({});
    expect(migrateScheduleJson(input, 2026)).toBe(input);
  });
});

describe('migrateCompletedTasks', () => {
  const schedule: Record<string, string> = {
    '2026-01-01': '太 1-3\n詩 1',
    '2026-04-29': '詩 119:1-16',
  };

  it('leaves v3 YYYY-MM-DD prefixed IDs unchanged', () => {
    const tasks = ['2026-01-01:Mt1', '2026-01-01:Ps1'];
    expect(migrateCompletedTasks(tasks, schedule)).toEqual(tasks);
  });

  it('upgrades v1 bare IDs to full date-prefixed IDs', () => {
    const result = migrateCompletedTasks(['Mt1'], schedule);
    expect(result).toContain('2026-01-01:Mt1');
  });

  it('upgrades v1 bare IDs for verse ranges', () => {
    const result = migrateCompletedTasks(['Ps119:1-16'], schedule);
    expect(result).toContain('2026-04-29:Ps119:1-16');
  });

  it('upgrades v2 MM-DD prefixed IDs', () => {
    const result = migrateCompletedTasks(['01-01:Mt1'], schedule);
    expect(result).toContain('2026-01-01:Mt1');
  });

  it('returns empty array for empty input', () => {
    expect(migrateCompletedTasks([], schedule)).toEqual([]);
  });

  it('passes through IDs that cannot be resolved', () => {
    const result = migrateCompletedTasks(['UnknownId'], schedule);
    expect(result).toContain('UnknownId');
  });

  it('handles mixed v1/v2/v3 in the same array', () => {
    const tasks = ['2026-01-01:Mt1', '01-01:Mt2', 'Mt3'];
    const result = migrateCompletedTasks(tasks, schedule);
    expect(result).toContain('2026-01-01:Mt1');
    expect(result).toContain('2026-01-01:Mt2');
    expect(result).toContain('2026-01-01:Mt3');
  });

  it('upgrades v1 bare IDs for a chapter range', () => {
    const sched = { '2026-01-10': '創 1-3' };
    const result = migrateCompletedTasks(['Ge1', 'Ge2', 'Ge3'], sched);
    expect(result).toEqual(['2026-01-10:Ge1', '2026-01-10:Ge2', '2026-01-10:Ge3']);
  });

  it('upgrades v1 bare IDs for a single verse', () => {
    const sched = { '2026-02-01': '詩 1:1' };
    const result = migrateCompletedTasks(['Ps1:1'], sched);
    expect(result).toEqual(['2026-02-01:Ps1:1']);
  });
});
