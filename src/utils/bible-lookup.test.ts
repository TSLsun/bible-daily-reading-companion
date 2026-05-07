import { describe, it, expect } from 'vitest';
import { findBookCode } from './bible-lookup';

describe('findBookCode', () => {
  it('matches a full Chinese book name', () => {
    expect(findBookCode('馬太福音 1')).toMatchObject({ en: 'Mt', zh: '馬太福音', matchedLen: 4 });
  });

  it('matches a single-character alias', () => {
    expect(findBookCode('太 1')).toMatchObject({ en: 'Mt', zh: '馬太福音', matchedLen: 1 });
  });

  it('matches a multi-character alias (撒上 before 撒)', () => {
    expect(findBookCode('撒上 1')).toMatchObject({ en: '撒上', matchedLen: 2 });
  });

  it('matches 詩篇 full name', () => {
    expect(findBookCode('詩篇 119')).toMatchObject({ en: 'Ps', zh: '詩篇', matchedLen: 2 });
  });

  it('matches 詩 alias', () => {
    expect(findBookCode('詩 119')).toMatchObject({ en: 'Ps', zh: '詩篇', matchedLen: 1 });
  });

  it('matches 約翰福音 full name (not confused with 約一/約二/約三 aliases)', () => {
    expect(findBookCode('約翰福音 3')).toMatchObject({ en: 'Joh', zh: '約翰福音' });
  });

  it('matches 創世記 full name', () => {
    expect(findBookCode('創世記 1')).toMatchObject({ en: 'Ge', matchedLen: 3 });
  });

  it('matches 創 alias', () => {
    expect(findBookCode('創 1')).toMatchObject({ en: 'Ge', matchedLen: 1 });
  });

  it('returns null for completely unknown text', () => {
    expect(findBookCode('Unknown book')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(findBookCode('')).toBeNull();
  });
});
