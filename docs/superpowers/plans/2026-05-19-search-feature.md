# Search Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search panel with book/chapter navigation and FHL keyword search, accessible from the existing 搜尋 tab (mobile) and a new toggle in the desktop rail.

**Architecture:** A `SearchPanel` component defined in `App.tsx` handles all three states (book grid, chapter picker, keyword results) using local state only. A new `searchBible` utility in `src/utils/bible-search.ts` handles the FHL search API call with Big5 decoding. The mobile sheet at `mobileSheet === 'search'` (line 1132) is replaced with `SearchPanel`; the desktop rail gets a `railSearchOpen` toggle that replaces schedule content with `SearchPanel`.

**Tech Stack:** React + TypeScript, Vite, vitest, FHL API (`bible.fhl.net/json/se.php`), lucide-react icons already imported in App.tsx.

---

## File Map

| File | Change |
|---|---|
| `src/constants.tsx` | Add `BIBLE_CHAPTER_COUNTS`, `OT_BOOK_NAMES`, `NT_BOOK_NAMES` |
| `src/types.ts` | Add `SearchResult` interface |
| `src/utils/bible-search.ts` | **Create** — FHL search utility (resolveBookCode, resolveBookZh, parseSearchResponse, searchBible) |
| `src/utils/bible-search.test.ts` | **Create** — unit tests for pure functions |
| `src/App.tsx` | Add `SearchPanel` component; replace mobile search sheet content (line 1132); add `railSearchOpen` state + search toggle to desktop rail |

---

## Task 1: Add chapter counts and book name arrays to constants.tsx

**Files:**
- Modify: `src/constants.tsx`
- Test: `src/utils/bible-search.test.ts` (tested alongside search utility in Task 3)

- [ ] **Step 1: Add `BIBLE_CHAPTER_COUNTS` to the bottom of constants.tsx**

  Append after `FALLBACK_VERSIONS` and before `DEFAULT_DAILY_SCHEDULE`:

  ```typescript
  export const BIBLE_CHAPTER_COUNTS: Record<string, number> = {
    // Old Testament (39 books)
    Ge: 50, Ex: 40, Le: 27, Nu: 36, De: 34,
    Jos: 24, Jud: 21, Ru: 4, '撒上': 31, '撒下': 24,
    '王上': 22, '王下': 25, '代上': 29, '代下': 36,
    Ezr: 10, Ne: 13, Es: 10, Job: 42, Ps: 150,
    Pr: 31, Ec: 12, So: 8, Isa: 66,
    Jer: 52, La: 5, Eze: 48, Da: 12,
    Ho: 14, Joe: 3, Am: 9, Ob: 1, Jon: 4,
    Mic: 7, Na: 3, Hab: 3, Zep: 3, Hag: 2,
    Zec: 14, Mal: 4,
    // New Testament (27 books)
    Mt: 28, Mr: 16, Lu: 24, Joh: 21, Ac: 28,
    Ro: 16, '林前': 16, '林後': 13, Ga: 6, Eph: 6,
    Php: 4, Col: 4, '帖前': 5, '帖後': 3,
    '提前': 6, '提後': 4, Tit: 3, Phm: 1,
    Heb: 13, Jas: 5, '彼前': 5, '彼後': 3,
    '約一': 5, '約二': 1, '約三': 1, Jude: 1, Re: 22,
  };

  // Chinese book names in canonical order, split OT (39) / NT (27)
  export const OT_BOOK_NAMES = Object.keys(BIBLE_BOOKS).slice(0, 39);
  export const NT_BOOK_NAMES = Object.keys(BIBLE_BOOKS).slice(39);
  ```

- [ ] **Step 2: Verify the split is correct**

  Run in node:
  ```bash
  node -e "
  const {BIBLE_BOOKS,OT_BOOK_NAMES,NT_BOOK_NAMES} = require('./src/constants.tsx');
  console.log('OT last:', OT_BOOK_NAMES.at(-1), '| NT first:', NT_BOOK_NAMES[0]);
  console.log('OT count:', OT_BOOK_NAMES.length, '| NT count:', NT_BOOK_NAMES.length);
  "
  ```
  Expected: `OT last: 瑪拉基書 | NT first: 馬太福音`, counts `39` and `27`.

  > If node can't import TSX directly, skip this step — the test in Task 3 will cover it.

---

## Task 2: Add `SearchResult` interface to types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Append `SearchResult` to types.ts**

  ```typescript
  export interface SearchResult {
    bookCode: string;   // API book code, e.g. 'Joh', 'Mt', '約一'
    bookZh: string;     // Full Chinese book name, e.g. '約翰福音'
    chapter: number;
    verse: number;
    text: string;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/constants.tsx src/types.ts
  git commit -m "feat: add BIBLE_CHAPTER_COUNTS, book name arrays, and SearchResult type"
  ```

---

## Task 3: Create `src/utils/bible-search.ts` with tests

**Files:**
- Create: `src/utils/bible-search.ts`
- Create: `src/utils/bible-search.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `src/utils/bible-search.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { resolveBookCode, resolveBookZh, parseSearchResponse } from './bible-search';
  import { BIBLE_CHAPTER_COUNTS, OT_BOOK_NAMES, NT_BOOK_NAMES } from '../constants';

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
  ```

- [ ] **Step 2: Run tests to confirm they all fail**

  ```bash
  npm run test -- bible-search
  ```

  Expected: all tests fail (module not found).

- [ ] **Step 3: Create `src/utils/bible-search.ts`**

  ```typescript
  import { BIBLE_ALIASES, BIBLE_BOOKS } from '../constants';
  import { SearchResult } from '../types';

  interface RawRecord {
    chineses: string;
    engs: string;
    chap: number;
    sec: number;
    bible_text: string;
  }

  export function resolveBookCode(chineses: string): string {
    const fullName = BIBLE_ALIASES[chineses] ?? chineses;
    return BIBLE_BOOKS[fullName] ?? chineses;
  }

  export function resolveBookZh(chineses: string): string {
    return BIBLE_ALIASES[chineses] ?? chineses;
  }

  export function parseSearchResponse(records: RawRecord[]): SearchResult[] {
    return records.map(r => ({
      bookCode: resolveBookCode(r.chineses),
      bookZh: resolveBookZh(r.chineses),
      chapter: r.chap,
      verse: r.sec,
      text: r.bible_text,
    }));
  }

  export async function searchBible(query: string, version: string): Promise<SearchResult[]> {
    const res = await fetch(
      `https://bible.fhl.net/json/se.php?VERSION=${version}&q=${encodeURIComponent(query)}&gb=0`
    );
    const buf = await res.arrayBuffer();
    const text = new TextDecoder('big5').decode(buf);
    const data = JSON.parse(text);
    if (data.status !== 'success' || !Array.isArray(data.record)) return [];
    return parseSearchResponse(data.record);
  }
  ```

- [ ] **Step 4: Run tests and confirm all pass**

  ```bash
  npm run test -- bible-search
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/utils/bible-search.ts src/utils/bible-search.test.ts
  git commit -m "feat: add bible-search utility with FHL se.php integration and tests"
  ```

---

## Task 4: Add `SearchPanel` component to App.tsx

**Files:**
- Modify: `src/App.tsx`

The panel manages three view states internally: book grid, chapter picker, keyword results.

- [ ] **Step 1: Add the import for new exports at the top of App.tsx**

  Find the existing import:
  ```typescript
  import {
    BIBLE_BOOKS, FALLBACK_VERSIONS, DEFAULT_DAILY_SCHEDULE
  } from './constants';
  ```

  Replace with:
  ```typescript
  import {
    BIBLE_BOOKS, FALLBACK_VERSIONS, DEFAULT_DAILY_SCHEDULE,
    BIBLE_CHAPTER_COUNTS, OT_BOOK_NAMES, NT_BOOK_NAMES,
  } from './constants';
  ```

  And add `SearchResult` to the types import:
  ```typescript
  import {
    AppSettings, BibleData, BibleVerse, ScheduleItem, VersionInfo, Theme, SearchResult
  } from './types';
  ```

  And add after the existing utils imports:
  ```typescript
  import { searchBible } from './utils/bible-search';
  ```

- [ ] **Step 2: Define `SearchPanel` component**

  Add this component in App.tsx, immediately before the `const App: React.FC = () => {` line (around line 460). Place it after `BookPageVerses`:

  ```tsx
  // ─── SEARCH PANEL ────────────────────────────────────────────────────────────

  const SearchPanel: React.FC<{
    theme: TK;
    accent: AccentTone;
    primaryVersion: string;
    onSelect: (book: string, chapter: number) => void;
  }> = ({ theme, accent, primaryVersion, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[] | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedBook, setSelectedBook] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleQuery = (val: string) => {
      setQuery(val);
      setSelectedBook(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!val.trim()) { setResults(null); return; }
      debounceRef.current = setTimeout(async () => {
        setSearchLoading(true);
        try {
          setResults(await searchBible(val.trim(), primaryVersion));
        } catch {
          setResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 400);
    };

    const chapterCount = selectedBook ? (BIBLE_CHAPTER_COUNTS[BIBLE_BOOKS[selectedBook]] ?? 1) : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.surface, borderRadius: 10,
          padding: '8px 12px',
          border: `1px solid ${query ? accent.base : theme.lineStrong}`,
          transition: 'border-color .12s',
        }}>
          <Search size={14} style={{ color: theme.muted, flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => handleQuery(e.target.value)}
            placeholder="關鍵字搜尋…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: F.sans, fontSize: 14, color: theme.ink,
            }}
          />
          {query && (
            <button
              onClick={() => handleQuery('')}
              style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.muted, display: 'flex', alignItems: 'center', padding: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Content area */}
        {query && results !== null ? (
          // ── Keyword search results ──────────────────────────────────────
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {searchLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: F.label, fontSize: 12, color: theme.muted }}>
                搜尋中…
              </div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: F.label, fontSize: 12, color: theme.muted }}>
                無符合結果
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: F.label, fontSize: 10, color: theme.muted, padding: '2px 2px 4px', letterSpacing: '0.06em' }}>
                  搜尋結果 · {results.length} 節
                </div>
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => onSelect(r.bookCode, r.chapter)}
                    style={{
                      appearance: 'none', border: 'none', cursor: 'pointer',
                      background: theme.surface, borderRadius: 8,
                      padding: '8px 10px', textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{ fontFamily: F.label, fontSize: 11, fontWeight: 600, color: accent.base, marginBottom: 3 }}>
                      {r.bookZh} {r.chapter}:{r.verse}
                    </div>
                    <div style={{ fontFamily: F.serif, fontSize: 12, color: theme.inkSoft, lineHeight: 1.5 }}>
                      {r.text.length > 70 ? r.text.slice(0, 70) + '…' : r.text}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : selectedBook ? (
          // ── Chapter picker ──────────────────────────────────────────────
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <button
                onClick={() => setSelectedBook(null)}
                style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.muted, display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: theme.ink }}>{selectedBook}</span>
              <span style={{ fontFamily: F.label, fontSize: 11, color: theme.muted }}>{chapterCount} 章</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map(ch => (
                <button
                  key={ch}
                  onClick={() => onSelect(BIBLE_BOOKS[selectedBook], ch)}
                  style={{
                    appearance: 'none', border: 'none', cursor: 'pointer',
                    background: theme.surface, borderRadius: 6,
                    padding: '7px 0', textAlign: 'center',
                    fontFamily: F.label, fontSize: 11, color: theme.ink,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // ── Book grid ───────────────────────────────────────────────────
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[{ label: '舊約', books: OT_BOOK_NAMES }, { label: '新約', books: NT_BOOK_NAMES }].map(({ label, books }) => (
              <div key={label}>
                <div style={{
                  fontFamily: F.label, fontSize: 10, fontWeight: 600,
                  color: theme.muted, letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  {label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {books.map(bookZh => (
                    <button
                      key={bookZh}
                      onClick={() => setSelectedBook(bookZh)}
                      style={{
                        appearance: 'none', border: 'none', cursor: 'pointer',
                        background: theme.surface, borderRadius: 7,
                        padding: '6px 4px', textAlign: 'center',
                        fontFamily: F.sans, fontSize: 11, color: theme.ink,
                        lineHeight: 1.3,
                      }}
                    >
                      {bookZh}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  ```

- [ ] **Step 3: Confirm the file compiles (no TS errors yet)**

  ```bash
  npm run build 2>&1 | grep -E 'error|Error' | head -20
  ```

---

## Task 5: Wire SearchPanel into mobile bottom sheet

**Files:**
- Modify: `src/App.tsx` (around line 1132)

- [ ] **Step 1: Find the mobile search sheet block**

  It starts at line 1132 with `{/* Bottom sheet (search) */}` and currently contains a simple text-input form ending before `{/* Bottom sheet (menu/settings) */}` at line ~1164.

- [ ] **Step 2: Replace the sheet content**

  Replace the entire content _inside_ the outer sheet `<div>` (the part after the drag handle and title row) with `SearchPanel`. The new block looks like:

  ```tsx
  {/* Bottom sheet (search) */}
  {mobileSheet === 'search' && (
    <>
      <div onClick={() => setMobileSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: theme.surface,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        boxShadow: '0 -16px 40px rgba(0,0,0,0.15)',
        zIndex: 41,
        padding: '10px 0 32px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Drag handle */}
        <div style={{ padding: '0 0 8px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: theme.faint }} />
        </div>
        {/* Header */}
        <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, color: theme.ink }}>搜尋</span>
          <button onClick={() => setMobileSheet(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        {/* Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          <SearchPanel
            theme={theme}
            accent={A}
            primaryVersion={settings.primaryVersion}
            onSelect={(book, chapter) => {
              fetchBible({ book, chapter });
              setMobileSheet(null);
            }}
          />
        </div>
      </div>
    </>
  )}
  ```

- [ ] **Step 3: Start dev server and test on mobile viewport**

  ```bash
  npm run dev
  ```

  Open browser, set viewport to 390×844 (iPhone), tap 搜尋 tab. Verify:
  - Sheet slides up with drag handle and close button
  - Book grid visible with OT / NT sections
  - Tapping a book shows chapter numbers
  - Tapping a chapter loads the passage and closes the sheet
  - Tapping back (‹) returns to the book grid
  - Typing text in the input shows search results from FHL API
  - Clearing text returns to the book grid

- [ ] **Step 4: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: wire SearchPanel into mobile bottom sheet"
  ```

---

## Task 6: Wire SearchPanel into the desktop rail

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `railSearchOpen` state**

  Find the state declarations block (around line 359). After `const [railOpen, setRailOpen] = useState(true);` add:

  ```typescript
  const [railSearchOpen, setRailSearchOpen] = useState(false);
  ```

- [ ] **Step 2: Add Search icon to collapsed rail icon stack**

  Find the collapsed icon stack (around line 1284). It currently has three buttons (CalendarDays, Target, BookMarked). Add a fourth:

  ```tsx
  { icon: <Search size={17} />, title: '搜尋章節', action: () => { setRailOpen(true); setRailSearchOpen(true); } },
  ```

- [ ] **Step 3: Add Search toggle button to expanded rail header**

  Find the rail header `{railOpen && (...)}` block (around line 1259). The header currently shows the month title and a collapse button. Add a Search icon button next to the collapse button:

  ```tsx
  {railOpen && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => setRailSearchOpen(o => !o)}
        title="搜尋章節"
        style={{
          ...iconBtn(theme),
          color: railSearchOpen ? A.base : theme.muted,
          background: railSearchOpen ? A.tint : 'transparent',
        }}
      >
        <Search size={16} />
      </button>
      <button
        onClick={() => setRailOpen(r => !r)}
        style={{ ...iconBtn(theme), color: theme.muted }}
        title="收合"
      >
        <ChevronLeft size={16} />
      </button>
    </div>
  )}
  ```

  > The existing collapse button is currently a standalone `<button>` — replace it with this `<div>` wrapper containing both buttons.

- [ ] **Step 4: Replace expanded rail content when search is open**

  Find `{/* Expanded rail */}` comment at line ~1303. The `{railOpen && (...)}` block wraps a `<div>` with flex column and `gap: 16` containing `{/* CALENDAR */}` and `{/* TODAY'S PLAN */}` sections.

  Wrap the existing sections in a conditional, and add the search view:

  ```tsx
  {/* Expanded rail */}
  {railOpen && (
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: '0 16px 20px',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {railSearchOpen ? (
        <SearchPanel
          theme={theme}
          accent={A}
          primaryVersion={settings.primaryVersion}
          onSelect={(book, chapter) => {
            fetchBible({ book, chapter });
            setRailSearchOpen(false);
          }}
        />
      ) : (
        <>
          {/* CALENDAR */}
          <section>
            {/* ... existing calendar section content unchanged ... */}
          </section>

          {/* TODAY'S PLAN */}
          <section>
            {/* ... existing plan section content unchanged ... */}
          </section>
        </>
      )}
    </div>
  )}
  ```

  > **Important:** Do not delete or modify the existing CALENDAR and TODAY'S PLAN sections — just wrap them in `<>...</>` inside the `else` branch.

- [ ] **Step 5: Test desktop layout**

  With `npm run dev` still running, test at full desktop width (1280px+):
  - Click the Search icon in the rail header → book grid appears filling the rail
  - Tapping a book shows chapter numbers in the same rail panel
  - Tapping a chapter loads the passage and closes the search view (returns to schedule)
  - The collapsed rail icon stack (when rail is narrow) shows a Search icon that expands rail and opens search
  - Clicking the Search icon again (when search is open) toggles it closed

- [ ] **Step 6: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: add SearchPanel to desktop left rail with toggle"
  ```

---

## Task 7: Verification

- [ ] **Step 1: Run lint**

  ```bash
  npm run lint
  ```

  Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run full test suite**

  ```bash
  npm run test
  ```

  Expected: all 35 existing tests + new bible-search tests pass.

- [ ] **Step 3: Run build**

  ```bash
  npm run build
  ```

  Expected: TypeScript type-check passes, Vite build succeeds, no errors.

- [ ] **Step 4: Final manual check — mobile**

  At 390px viewport:
  - 搜尋 tab → sheet opens
  - OT/NT book grid visible
  - Tap 詩篇 → 150 chapter buttons appear
  - Tap 23 → 詩篇 23 loads, sheet closes
  - Reopen search → type 神愛 → results appear (约 3:16 etc.)
  - Tap a result → navigates to that chapter, sheet closes
  - Tap ✕ → clears search, book grid reappears

- [ ] **Step 5: Final manual check — desktop**

  At 1280px viewport:
  - Search icon in rail header → search panel fills rail
  - Same browse + keyword search flow works
  - Selecting a chapter closes search, returns to schedule view
  - Collapsing and re-expanding the rail while search is open: rail collapses cleanly
