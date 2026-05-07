import { describe, it, expect } from 'vitest';
import { parseScheduleLine, getDayPlan } from './schedule-parser';

describe('parseScheduleLine', () => {
  it('parses a single chapter', () => {
    const result = parseScheduleLine('太 1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ book: 'Mt', chapter: 1, id: 'Mt1', label: '馬太福音 1' });
  });

  it('parses a chapter range', () => {
    const result = parseScheduleLine('太 1-3');
    expect(result).toHaveLength(3);
    expect(result.map(r => r.chapter)).toEqual([1, 2, 3]);
    expect(result[0].id).toBe('Mt1');
    expect(result[2].id).toBe('Mt3');
  });

  it('parses a verse range', () => {
    const result = parseScheduleLine('詩 119:1-16');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      book: 'Ps',
      chapter: 119,
      startVerse: 1,
      endVerse: 16,
      id: 'Ps119:1-16',
      label: '詩篇 119:1-16',
    });
  });

  it('parses a single verse', () => {
    const result = parseScheduleLine('詩 1:1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ startVerse: 1, endVerse: 1, id: 'Ps1:1' });
  });

  it('handles Chinese enumeration comma (、)', () => {
    const result = parseScheduleLine('俄 1、拿 1-2');
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ book: 'Ob', chapter: 1 });
    expect(result[1]).toMatchObject({ book: 'Jon', chapter: 1 });
    expect(result[2]).toMatchObject({ book: 'Jon', chapter: 2 });
  });

  it('returns empty array for unknown book', () => {
    expect(parseScheduleLine('Unknown 1')).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(parseScheduleLine('')).toHaveLength(0);
  });

  it('parses full Chinese name without alias', () => {
    const result = parseScheduleLine('創世記 1');
    expect(result).toHaveLength(1);
    expect(result[0].book).toBe('Ge');
  });
});

describe('getDayPlan', () => {
  const scheduleJson = JSON.stringify({
    '2026-01-01': '太 1-3\n詩 1',
    '2026-04-29': '詩 119:1-16',
  });

  it('returns items prefixed with the date key', () => {
    const items = getDayPlan('2026-01-01', scheduleJson);
    expect(items).toHaveLength(4);
    expect(items[0].id).toBe('2026-01-01:Mt1');
    expect(items[3].id).toBe('2026-01-01:Ps1');
  });

  it('prefixes verse-range items correctly', () => {
    const items = getDayPlan('2026-04-29', scheduleJson);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('2026-04-29:Ps119:1-16');
  });

  it('returns empty array for a date not in the schedule', () => {
    expect(getDayPlan('2026-12-31', scheduleJson)).toHaveLength(0);
  });

  it('returns empty array for invalid JSON', () => {
    expect(getDayPlan('2026-01-01', 'not-json')).toHaveLength(0);
  });

  it('returns empty array when the date entry is an empty string', () => {
    const json = JSON.stringify({ '2026-01-01': '' });
    expect(getDayPlan('2026-01-01', json)).toHaveLength(0);
  });
});
