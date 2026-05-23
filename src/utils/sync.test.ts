import { describe, it, expect } from 'vitest';
import { flatToKvMap, kvMapToFlat, mergeTasks } from './sync';

describe('flatToKvMap', () => {
  it('converts flat array to date-keyed map', () => {
    expect(flatToKvMap(['2026-01-01:Mt1', '2026-01-01:Mt2', '2026-01-02:Mk1']))
      .toEqual({ '2026-01-01': ['Mt1', 'Mt2'], '2026-01-02': ['Mk1'] });
  });

  it('preserves extra colons in task body (verse ranges like Ps119:1-16)', () => {
    expect(flatToKvMap(['2026-04-29:Ps119:1-16']))
      .toEqual({ '2026-04-29': ['Ps119:1-16'] });
  });

  it('handles empty array', () => {
    expect(flatToKvMap([])).toEqual({});
  });

  it('skips malformed entries without a colon', () => {
    expect(flatToKvMap(['no-colon-here'])).toEqual({});
  });
});

describe('kvMapToFlat', () => {
  it('converts date-keyed map to sorted flat array', () => {
    expect(kvMapToFlat({ '2026-01-02': ['Mk1'], '2026-01-01': ['Mt1'] }))
      .toEqual(['2026-01-01:Mt1', '2026-01-02:Mk1']);
  });

  it('handles empty map', () => {
    expect(kvMapToFlat({})).toEqual([]);
  });

  it('round-trips with flatToKvMap', () => {
    const original = ['2026-01-01:Mt1', '2026-01-02:Mk1', '2026-04-29:Ps119:1-16'];
    expect(kvMapToFlat(flatToKvMap(original))).toEqual(original);
  });
});

describe('mergeTasks', () => {
  it('returns union of two arrays', () => {
    expect(mergeTasks(['2026-01-01:Mt1', '2026-01-02:Mk1'], ['2026-01-01:Mt1', '2026-01-03:Lk1']))
      .toEqual(['2026-01-01:Mt1', '2026-01-02:Mk1', '2026-01-03:Lk1']);
  });

  it('deduplicates identical entries', () => {
    expect(mergeTasks(['2026-01-01:Mt1'], ['2026-01-01:Mt1'])).toEqual(['2026-01-01:Mt1']);
  });

  it('handles first array empty', () => {
    expect(mergeTasks([], ['2026-01-01:Mt1'])).toEqual(['2026-01-01:Mt1']);
  });

  it('handles second array empty', () => {
    expect(mergeTasks(['2026-01-01:Mt1'], [])).toEqual(['2026-01-01:Mt1']);
  });

  it('handles both arrays empty', () => {
    expect(mergeTasks([], [])).toEqual([]);
  });

  it('returns sorted output', () => {
    expect(mergeTasks(['2026-01-03:Lk1'], ['2026-01-01:Mt1']))
      .toEqual(['2026-01-01:Mt1', '2026-01-03:Lk1']);
  });
});
