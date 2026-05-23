import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveBookCode, resolveBookZh, parseSearchResponse, searchBible } from './bible-search';
import { BIBLE_CHAPTER_COUNTS, OT_BOOK_NAMES, NT_BOOK_NAMES, BIBLE_BOOKS, BIBLE_ALIASES } from '../constants';

describe('resolveBookCode', () => {
  it('resolves single-char alias 約 to Joh', () => {
    expect(resolveBookCode('約')).toBe('Joh');
  });
  it('resolves 太 to Mt', () => {
    expect(resolveBookCode('太')).toBe('Mt');
  });
  it('resolves multi-char alias 約一 to 約一', () => {
    expect(resolveBookCode('約一')).toBe('約一');
  });
  it('resolves 林前 to 林前', () => {
    expect(resolveBookCode('林前')).toBe('林前');
  });
  it('falls back to input for unknown value', () => {
    expect(resolveBookCode('Unknown')).toBe('Unknown');
  });
});

describe('resolveBookZh', () => {
  it('resolves 約 to 約翰福音', () => {
    expect(resolveBookZh('約')).toBe('約翰福音');
  });
  it('resolves 太 to 馬太福音', () => {
    expect(resolveBookZh('太')).toBe('馬太福音');
  });
  it('returns input unchanged for unknown', () => {
    expect(resolveBookZh('Unknown')).toBe('Unknown');
  });
  it('resolves API code Joh to 約翰福音 via reverse lookup', () => {
    expect(resolveBookZh('Joh')).toBe('約翰福音');
  });
});

describe('parseSearchResponse', () => {
  it('maps a record to SearchResult', () => {
    const raw = [{ chineses: '約', engs: 'John', chap: 3, sec: 16, bible_text: '神愛世人' }];
    expect(parseSearchResponse(raw)).toEqual([{
      bookCode: 'Joh',
      bookZh: '約翰福音',
      chapter: 3,
      verse: 16,
      text: '神愛世人',
    }]);
  });
  it('returns empty array for empty input', () => {
    expect(parseSearchResponse([])).toEqual([]);
  });
  it('handles 約一 (1 John) correctly', () => {
    const raw = [{ chineses: '約一', engs: '1John', chap: 4, sec: 9, bible_text: '神差他獨生子' }];
    const result = parseSearchResponse(raw);
    expect(result[0].bookCode).toBe('約一');
    expect(result[0].bookZh).toBe('約翰一書');
  });
});

describe('BIBLE_CHAPTER_COUNTS', () => {
  it('has Genesis at 50 chapters', () => {
    expect(BIBLE_CHAPTER_COUNTS['Ge']).toBe(50);
  });
  it('has Psalms at 150 chapters', () => {
    expect(BIBLE_CHAPTER_COUNTS['Ps']).toBe(150);
  });
  it('has Revelation at 22 chapters', () => {
    expect(BIBLE_CHAPTER_COUNTS['Re']).toBe(22);
  });
  it('has Obadiah at 1 chapter', () => {
    expect(BIBLE_CHAPTER_COUNTS['Ob']).toBe(1);
  });
  it('has all 66 books', () => {
    expect(Object.keys(BIBLE_CHAPTER_COUNTS)).toHaveLength(66);
  });
});

describe('OT_BOOK_NAMES / NT_BOOK_NAMES', () => {
  it('OT ends with 瑪拉基書', () => {
    expect(OT_BOOK_NAMES.at(-1)).toBe('瑪拉基書');
  });
  it('NT starts with 馬太福音', () => {
    expect(NT_BOOK_NAMES[0]).toBe('馬太福音');
  });
  it('OT has 39 books', () => {
    expect(OT_BOOK_NAMES).toHaveLength(39);
  });
  it('NT has 27 books', () => {
    expect(NT_BOOK_NAMES).toHaveLength(27);
  });
});

describe('BIBLE_ALIASES integrity', () => {
  it('every alias value resolves to a BIBLE_BOOKS key', () => {
    const bookKeys = Object.keys(BIBLE_BOOKS);
    for (const [alias, fullName] of Object.entries(BIBLE_ALIASES)) {
      expect(bookKeys, `alias "${alias}" maps to "${fullName}" which is not in BIBLE_BOOKS`).toContain(fullName);
    }
  });

  it('BIBLE_BOOKS has no duplicate API codes', () => {
    const values = Object.values(BIBLE_BOOKS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('searchBible', () => {
  afterEach(() => vi.unstubAllGlobals());

  function mockFetchWith(data: object) {
    // Escape non-ASCII to \uXXXX so the resulting string is pure ASCII,
    // which round-trips correctly through TextEncoder + TextDecoder('big5').
    const asciiJson = Array.from(JSON.stringify(data), c =>
      c.charCodeAt(0) > 127
        ? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
        : c,
    ).join('');
    const buf = new TextEncoder().encode(asciiJson).buffer;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(buf),
    }));
  }

  it('returns parsed results on success', async () => {
    mockFetchWith({
      status: 'success',
      record: [{ chineses: '約', engs: 'John', chap: 3, sec: 16, bible_text: '神愛世人' }],
    });
    const results = await searchBible('神愛世人', 'unv');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ bookCode: 'Joh', chapter: 3, verse: 16 });
  });

  it('returns [] when status is not success', async () => {
    mockFetchWith({ status: 'error', record: [] });
    const results = await searchBible('q', 'unv');
    expect(results).toEqual([]);
  });

  it('returns [] when record is not an array', async () => {
    mockFetchWith({ status: 'success', record: null });
    const results = await searchBible('q', 'unv');
    expect(results).toEqual([]);
  });

  it('propagates fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    await expect(searchBible('q', 'unv')).rejects.toThrow('network error');
  });
});
