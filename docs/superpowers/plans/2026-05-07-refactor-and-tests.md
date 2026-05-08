# Refactor & Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract pure business-logic functions from the monolithic `App.tsx` into testable modules, write a full unit-test suite with Vitest, and gate all PRs to `main` with a CI workflow that requires tests to pass.

**Architecture:** Three pure-function modules (`bible-lookup.ts`, `schedule-parser.ts`, `migrations.ts`) are extracted from `App.tsx` with no behavior change. `App.tsx` imports and calls them. All tests live alongside the source as `*.test.ts` files. A new GitHub Actions workflow blocks merges when tests fail.

**Tech Stack:** Vitest 3, TypeScript 5.6, React 19 (unchanged), GitHub Actions

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `bible-lookup.ts` | Pure `findBookCode` function |
| Create | `schedule-parser.ts` | Pure `parseScheduleLine` and `getDayPlan` |
| Create | `migrations.ts` | Pure `migrateScheduleJson` and `migrateCompletedTasks` |
| Create | `bible-lookup.test.ts` | Tests for book name/alias resolution |
| Create | `schedule-parser.test.ts` | Tests for schedule line parsing and plan building |
| Create | `migrations.test.ts` | Tests for v1/v2→v3 ID migration |
| Modify | `vite.config.ts` | Add `test` block for Vitest |
| Modify | `package.json` | Add `vitest` dev dep and `test` / `test:watch` scripts |
| Modify | `App.tsx` | Import extracted functions, remove their inline definitions |
| Modify | `.husky/pre-commit` | Run `npm test` before commit |
| Create | `.github/workflows/test.yml` | CI: run tests + lint on every PR and push to `main` |

---

## Task 1: Install Vitest and configure test runner

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add vitest to devDependencies and add test scripts**

  Open `package.json`. Change the `scripts` block and `devDependencies`:

  ```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "prepare": "husky",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "release": "standard-version"
  },
  ```

  In `devDependencies`, add:
  ```json
  "vitest": "^3.0.0"
  ```

- [ ] **Step 2: Add test config to vite.config.ts**

  Replace the entire content of `vite.config.ts` with:

  ```ts
  /// <reference types="vitest" />
  import { defineConfig } from 'vite';
  import { readFileSync } from 'node:fs';

  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
  const sha = process.env.VITE_COMMIT_SHA?.slice(0, 7) || 'dev';
  const buildDate = new Date().toISOString().split('T')[0];

  export default defineConfig({
    base: '/bible-daily-reading-companion',
    build: {
      outDir: 'dist',
    },
    define: {
      __APP_VERSION__: JSON.stringify(`v${pkg.version} (${sha}) · ${buildDate}`),
    },
    test: {
      environment: 'node',
      globals: true,
    },
  });
  ```

- [ ] **Step 3: Install dependencies**

  ```bash
  npm install
  ```

  Expected output ends with: `added N packages` (or similar, no errors)

- [ ] **Step 4: Write a smoke test to verify the runner works**

  Create `smoke.test.ts` at the project root:

  ```ts
  import { describe, it, expect } from 'vitest';

  describe('smoke', () => {
    it('test runner is working', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```

- [ ] **Step 5: Run the smoke test and verify it passes**

  ```bash
  npm test
  ```

  Expected output:
  ```
   ✓ smoke.test.ts (1)
     ✓ test runner is working

  Test Files  1 passed (1)
  Tests       1 passed (1)
  ```

- [ ] **Step 6: Delete the smoke test file**

  ```bash
  rm smoke.test.ts
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add package.json package-lock.json vite.config.ts
  git commit -m "chore: add vitest test runner"
  ```

---

## Task 2: Extract `findBookCode` to `bible-lookup.ts` + write tests

**Files:**
- Create: `bible-lookup.ts`
- Create: `bible-lookup.test.ts`
- Modify: `App.tsx:390-401` (remove `findBookCode` useCallback, add import)

- [ ] **Step 1: Write the failing test**

  Create `bible-lookup.test.ts`:

  ```ts
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
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npm test -- bible-lookup
  ```

  Expected: FAIL with `Cannot find module './bible-lookup'`

- [ ] **Step 3: Create `bible-lookup.ts`**

  ```ts
  import { BIBLE_BOOKS, BIBLE_ALIASES } from './constants';

  export function findBookCode(text: string): { en: string; zh: string; matchedLen: number } | null {
    const lowerText = text.toLowerCase().trim();
    for (const [zh, en] of Object.entries(BIBLE_BOOKS)) {
      if (lowerText.startsWith(zh.toLowerCase())) return { en, zh, matchedLen: zh.length };
    }
    for (const [alias, full] of Object.entries(BIBLE_ALIASES)) {
      if (lowerText.startsWith(alias.toLowerCase())) {
        return { en: BIBLE_BOOKS[full], zh: full, matchedLen: alias.length };
      }
    }
    return null;
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npm test -- bible-lookup
  ```

  Expected:
  ```
   ✓ bible-lookup.test.ts (10)
  Test Files  1 passed (1)
  Tests       10 passed (10)
  ```

- [ ] **Step 5: Update `App.tsx` to import from `bible-lookup.ts`**

  In `App.tsx`, add this import after the existing imports at the top:
  ```ts
  import { findBookCode } from './bible-lookup';
  ```

  Then delete lines 390–401 (the `findBookCode` useCallback definition):
  ```ts
  // DELETE this entire block:
  const findBookCode = useCallback((text: string) => {
    const lowerText = text.toLowerCase().trim();
    for (const [zh, en] of Object.entries(BIBLE_BOOKS)) {
      if (lowerText.startsWith(zh.toLowerCase())) return { en, zh, matchedLen: zh.length };
    }
    for (const [alias, full] of Object.entries(BIBLE_ALIASES)) {
      if (lowerText.startsWith(alias.toLowerCase())) {
        return { en: BIBLE_BOOKS[full], zh: full, matchedLen: alias.length };
      }
    }
    return null;
  }, []);
  ```

  In the `parseScheduleLine` useCallback (now starting around line 391), update its deps array from `[findBookCode]` to `[]` since `findBookCode` is now a stable module import:
  ```ts
  // Change the last line of parseScheduleLine useCallback from:
  }, [findBookCode]);
  // To:
  }, []);
  ```

- [ ] **Step 6: Verify the build still type-checks**

  ```bash
  npm run build
  ```

  Expected: build completes with no TypeScript errors.

- [ ] **Step 7: Commit**

  ```bash
  git add bible-lookup.ts bible-lookup.test.ts App.tsx
  git commit -m "refactor: extract findBookCode to bible-lookup.ts with tests"
  ```

---

## Task 3: Extract `parseScheduleLine` and `getDayPlan` to `schedule-parser.ts` + tests

**Files:**
- Create: `schedule-parser.ts`
- Create: `schedule-parser.test.ts`
- Modify: `App.tsx:403-477` (replace useCallbacks with imports)

- [ ] **Step 1: Write the failing tests**

  Create `schedule-parser.test.ts`:

  ```ts
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
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npm test -- schedule-parser
  ```

  Expected: FAIL with `Cannot find module './schedule-parser'`

- [ ] **Step 3: Create `schedule-parser.ts`**

  ```ts
  import { ScheduleItem } from './types';
  import { findBookCode } from './bible-lookup';

  export function parseScheduleLine(line: string): ScheduleItem[] {
    const segments = line.split('、');
    if (segments.length > 1) {
      return segments.flatMap(seg => parseScheduleLine(seg.trim()));
    }

    const items: ScheduleItem[] = [];
    const bookInfo = findBookCode(line);
    if (!bookInfo) return items;
    const remaining = line.slice(bookInfo.matchedLen).trim();

    if (remaining.includes(':')) {
      const parts = remaining.split(':');
      const chapter = parseInt(parts[0].trim());
      const versePart = parts[1].trim();
      let startVerse: number | undefined;
      let endVerse: number | undefined;
      if (versePart.includes('-')) {
        const vNumbers = versePart.match(/\d+/g);
        if (vNumbers && vNumbers.length >= 2) {
          startVerse = parseInt(vNumbers[0]);
          endVerse = parseInt(vNumbers[1]);
        }
      } else {
        const vNum = versePart.match(/\d+/);
        if (vNum) {
          startVerse = parseInt(vNum[0]);
          endVerse = startVerse;
        }
      }
      const label = startVerse
        ? `${bookInfo.zh} ${chapter}:${startVerse}${endVerse && endVerse !== startVerse ? '-' + endVerse : ''}`
        : `${bookInfo.zh} ${chapter}`;
      const id = `${bookInfo.en}${chapter}${startVerse ? ':' + startVerse + (endVerse ? '-' + endVerse : '') : ''}`;
      items.push({ label, book: bookInfo.en, chapter, id, startVerse, endVerse });
    } else {
      const numericPart = remaining.split(/[^\d-]/)[0];
      const numbers = numericPart.match(/\d+/g);
      if (numbers) {
        if (numericPart.includes('-') && numbers.length >= 2) {
          const start = parseInt(numbers[0]);
          const end = parseInt(numbers[1]);
          for (let i = start; i <= end; i++) {
            items.push({ label: `${bookInfo.zh} ${i}`, book: bookInfo.en, chapter: i, id: `${bookInfo.en}${i}` });
          }
        } else {
          numbers.forEach(n => {
            const ch = parseInt(n);
            items.push({ label: `${bookInfo.zh} ${ch}`, book: bookInfo.en, chapter: ch, id: `${bookInfo.en}${ch}` });
          });
        }
      }
    }
    return items;
  }

  export function getDayPlan(dateKey: string, scheduleJson: string): ScheduleItem[] {
    try {
      const json = JSON.parse(scheduleJson);
      const sourceText: string = json[dateKey] || '';
      const items = sourceText.split('\n').filter(l => l.trim()).flatMap(parseScheduleLine);
      return items.map(item => ({ ...item, id: `${dateKey}:${item.id}` }));
    } catch {
      return [];
    }
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npm test -- schedule-parser
  ```

  Expected:
  ```
   ✓ schedule-parser.test.ts (13)
  Test Files  1 passed (1)
  Tests       13 passed (13)
  ```

- [ ] **Step 5: Update `App.tsx` — add imports**

  Add to the imports at the top of `App.tsx` (after the `bible-lookup` import added in Task 2):
  ```ts
  import { parseScheduleLine, getDayPlan } from './schedule-parser';
  ```

- [ ] **Step 6: Remove `parseScheduleLine` useCallback from `App.tsx`**

  Delete the entire `parseScheduleLine` useCallback block (approximately lines 403–457 before this task's edits):
  ```ts
  // DELETE this entire block:
  const parseScheduleLine = useCallback((line: string): ScheduleItem[] => {
    // Split on Chinese enumeration comma 、 to support entries like "耶 52、哀 1-2"
    const segments = line.split('、');
    if (segments.length > 1) {
      return segments.flatMap(seg => parseScheduleLine(seg.trim()));
    }
    // ... (entire body)
  }, [findBookCode]);
  ```

- [ ] **Step 7: Remove `getDayPlan` useCallback from `App.tsx`**

  Delete the entire `getDayPlan` useCallback block:
  ```ts
  // DELETE this entire block:
  const getDayPlan = useCallback((dateKey: string): ScheduleItem[] => {
    try {
      const json = JSON.parse(settings.dailyScheduleJson);
      const sourceText = json[dateKey] || "";
      const items = sourceText.split('\n').filter((l: string) => l.trim()).flatMap(parseScheduleLine);
      return items.map((item: ScheduleItem) => ({ ...item, id: `${dateKey}:${item.id}` }));
    } catch {
      return [];
    }
  }, [settings.dailyScheduleJson, parseScheduleLine]);
  ```

- [ ] **Step 8: Fix `parsedSchedule` useMemo in `App.tsx`**

  The `parsedSchedule` useMemo currently calls `getDayPlan(selectedDate)` (one arg). Update it to pass `settings.dailyScheduleJson` and remove the stale deps:

  ```ts
  // Replace:
  const parsedSchedule = useMemo(() => {
    if (settings.scheduleMode === 'static') {
      return settings.scheduleText.split('\n').filter(l => l.trim()).flatMap(parseScheduleLine);
    }
    return getDayPlan(selectedDate);
  }, [settings.scheduleMode, settings.scheduleText, selectedDate, getDayPlan, parseScheduleLine]);

  // With:
  const parsedSchedule = useMemo(() => {
    if (settings.scheduleMode === 'static') {
      return settings.scheduleText.split('\n').filter(l => l.trim()).flatMap(parseScheduleLine);
    }
    return getDayPlan(selectedDate, settings.dailyScheduleJson);
  }, [settings.scheduleMode, settings.scheduleText, selectedDate, settings.dailyScheduleJson]);
  ```

- [ ] **Step 9: Fix `calendarDays` useMemo in `App.tsx`**

  Find the `calendarDays` useMemo. Inside the loop body, change `getDayPlan(dateKey)` to `getDayPlan(dateKey, settings.dailyScheduleJson)`. Update deps to remove `getDayPlan` and add `settings.dailyScheduleJson`:

  ```ts
  // Change:
  const plan = getDayPlan(dateKey);
  // To:
  const plan = getDayPlan(dateKey, settings.dailyScheduleJson);

  // Change the deps from:
  }, [currentViewDate, getDayPlan, settings.completedTasks]);
  // To:
  }, [currentViewDate, settings.dailyScheduleJson, settings.completedTasks]);
  ```

- [ ] **Step 10: Fix `handleDayClick` in `App.tsx`**

  Find `handleDayClick`. Change `getDayPlan(dateKey)` to `getDayPlan(dateKey, settings.dailyScheduleJson)`:

  ```ts
  // Change:
  const plan = getDayPlan(dateKey);
  // To:
  const plan = getDayPlan(dateKey, settings.dailyScheduleJson);
  ```

- [ ] **Step 11: Verify the build type-checks cleanly**

  ```bash
  npm run build
  ```

  Expected: no TypeScript errors, build succeeds.

- [ ] **Step 12: Run all tests**

  ```bash
  npm test
  ```

  Expected:
  ```
   ✓ bible-lookup.test.ts (10)
   ✓ schedule-parser.test.ts (13)
  Test Files  2 passed (2)
  Tests       23 passed (23)
  ```

- [ ] **Step 13: Commit**

  ```bash
  git add schedule-parser.ts schedule-parser.test.ts App.tsx
  git commit -m "refactor: extract parseScheduleLine and getDayPlan to schedule-parser.ts with tests"
  ```

---

## Task 4: Extract migration logic to `migrations.ts` + tests

**Files:**
- Create: `migrations.ts`
- Create: `migrations.test.ts`
- Modify: `App.tsx:238-348` (replace inline migration block)

- [ ] **Step 1: Write the failing tests**

  Create `migrations.test.ts`:

  ```ts
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

    it('returns the original string when JSON is mixed format (some already migrated)', () => {
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
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npm test -- migrations
  ```

  Expected: FAIL with `Cannot find module './migrations'`

- [ ] **Step 3: Create `migrations.ts`**

  ```ts
  import { BIBLE_BOOKS, BIBLE_ALIASES } from './constants';

  const HAS_YEAR_PREFIX = /^\d{4}-\d{2}-\d{2}:/;
  const HAS_DATE_PREFIX = /^\d{2}-\d{2}:/;

  export function migrateScheduleJson(json: string, year: number): string {
    try {
      const scheduleObj = JSON.parse(json);
      const keys = Object.keys(scheduleObj);
      if (keys.length === 0) return json;
      const isOldFormat = keys.every(k => /^\d{2}-\d{2}$/.test(k));
      if (!isOldFormat) return json;
      const upgraded: Record<string, string> = {};
      for (const [k, v] of Object.entries(scheduleObj)) {
        upgraded[`${year}-${k}`] = v as string;
      }
      return JSON.stringify(upgraded, null, 2);
    } catch {
      return json;
    }
  }

  function parseBareIds(text: string): string[] {
    const ids: string[] = [];
    const lines = text.split('\n').filter(Boolean);
    for (const line of lines) {
      for (const seg of line.split('、')) {
        const s = seg.trim();
        let bookEn: string | null = null;
        let matchedLen = 0;
        outer: {
          for (const [zh, en] of Object.entries(BIBLE_BOOKS)) {
            if (s.toLowerCase().startsWith(zh.toLowerCase())) {
              bookEn = en; matchedLen = zh.length; break outer;
            }
          }
          for (const [alias, full] of Object.entries(BIBLE_ALIASES)) {
            if (s.toLowerCase().startsWith(alias.toLowerCase())) {
              bookEn = BIBLE_BOOKS[full]; matchedLen = alias.length; break outer;
            }
          }
        }
        if (!bookEn) continue;
        const rest = s.slice(matchedLen).trim();
        if (rest.includes(':')) {
          const [chStr, verStr] = rest.split(':');
          const ch = parseInt(chStr);
          const vNums = verStr.match(/\d+/g);
          if (vNums && vNums.length >= 2) ids.push(`${bookEn}${ch}:${vNums[0]}-${vNums[1]}`);
          else if (vNums) ids.push(`${bookEn}${ch}:${vNums[0]}`);
        } else {
          const numericPart = rest.split(/[^\d-]/)[0];
          const nums = numericPart.match(/\d+/g);
          if (!nums) continue;
          if (numericPart.includes('-') && nums.length >= 2) {
            for (let i = parseInt(nums[0]); i <= parseInt(nums[1]); i++) ids.push(`${bookEn}${i}`);
          } else {
            for (const n of nums) ids.push(`${bookEn}${parseInt(n)}`);
          }
        }
      }
    }
    return ids;
  }

  export function migrateCompletedTasks(
    tasks: string[],
    schedule: Record<string, string>
  ): string[] {
    const needsMigration = tasks.some(id => !HAS_YEAR_PREFIX.test(id));
    if (!needsMigration) return tasks;

    const bareToFull = new Map<string, string>();
    const dateToFull = new Map<string, string>();
    for (const [dateKey, text] of Object.entries(schedule)) {
      const mmDdKey = dateKey.length === 10 ? dateKey.slice(5) : dateKey;
      for (const bareId of parseBareIds(text)) {
        const fullId = `${dateKey}:${bareId}`;
        if (!bareToFull.has(bareId)) bareToFull.set(bareId, fullId);
        dateToFull.set(`${mmDdKey}:${bareId}`, fullId);
      }
    }

    return tasks.map(id => {
      if (HAS_YEAR_PREFIX.test(id)) return id;
      if (HAS_DATE_PREFIX.test(id)) return dateToFull.get(id) ?? id;
      return bareToFull.get(id) ?? id;
    });
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npm test -- migrations
  ```

  Expected:
  ```
   ✓ migrations.test.ts (12)
  Test Files  1 passed (1)
  Tests       12 passed (12)
  ```

- [ ] **Step 5: Update `App.tsx` — add migration imports**

  Add to the import block at the top of `App.tsx`:
  ```ts
  import { migrateScheduleJson, migrateCompletedTasks } from './migrations';
  ```

- [ ] **Step 6: Replace the inline migration block in `App.tsx`**

  Find the settings load `useEffect` (starts at line ~226). Replace the entire migration block (from the `// ── Backward-compat migration` comment down to the closing `// ──────` comment, approximately lines 238–348) with this compact replacement:

  ```ts
  // Migrate legacy schedule JSON keys (MM-DD → YYYY-MM-DD)
  if (parsed.dailyScheduleJson) {
    parsed.dailyScheduleJson = migrateScheduleJson(parsed.dailyScheduleJson, 2026);
  }

  // Migrate legacy completed task IDs (v1/v2 → v3 YYYY-MM-DD prefix)
  if ((parsed.completedTasks ?? []).some((id: string) => !/^\d{4}-\d{2}-\d{2}:/.test(id))) {
    let schedule: Record<string, string>;
    try {
      schedule = parsed.dailyScheduleJson ? JSON.parse(parsed.dailyScheduleJson) : DEFAULT_DAILY_SCHEDULE;
    } catch {
      schedule = DEFAULT_DAILY_SCHEDULE;
    }
    parsed.completedTasks = migrateCompletedTasks(parsed.completedTasks ?? [], schedule);
  }
  ```

- [ ] **Step 7: Verify the build type-checks cleanly**

  ```bash
  npm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 8: Run all tests**

  ```bash
  npm test
  ```

  Expected:
  ```
   ✓ bible-lookup.test.ts (10)
   ✓ schedule-parser.test.ts (13)
   ✓ migrations.test.ts (12)
  Test Files  3 passed (3)
  Tests       35 passed (35)
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add migrations.ts migrations.test.ts App.tsx
  git commit -m "refactor: extract migration logic to migrations.ts with tests"
  ```

---

## Task 5: Add CI workflow and update pre-commit hook

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `.husky/pre-commit`

- [ ] **Step 1: Create the CI test workflow**

  Create `.github/workflows/test.yml`:

  ```yaml
  name: Test

  on:
    pull_request:
      branches: [main]
    push:
      branches: [main]

  jobs:
    test:
      name: Tests & Lint
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: 'npm'
        - name: Install dependencies
          run: npm ci
        - name: Run tests
          run: npm test
        - name: Run lint
          run: npm run lint
  ```

- [ ] **Step 2: Update pre-commit hook to run tests**

  Replace the entire contents of `.husky/pre-commit` with:

  ```sh
  npx lint-staged
  npm test
  ```

- [ ] **Step 3: Run the full test suite one final time**

  ```bash
  npm test
  ```

  Expected:
  ```
   ✓ bible-lookup.test.ts (10)
   ✓ schedule-parser.test.ts (13)
   ✓ migrations.test.ts (12)
  Test Files  3 passed (3)
  Tests       35 passed (35)
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add .github/workflows/test.yml .husky/pre-commit
  git commit -m "ci: add test workflow and run tests in pre-commit hook"
  ```

- [ ] **Step 5: Enable branch protection in GitHub (manual step)**

  This must be done in the GitHub repository UI — it cannot be done from code:

  1. Go to `Settings → Branches` on the GitHub repository page.
  2. Click **Add branch protection rule** (or edit the existing rule for `main`).
  3. Set **Branch name pattern** to `main`.
  4. Check **Require status checks to pass before merging**.
  5. Search for and add the status check named **`Tests & Lint`** (the `name:` value from the workflow's `jobs.test` key).
  6. Check **Require branches to be up to date before merging**.
  7. Click **Save changes**.

  After this, any PR to `main` will be blocked until the `Tests & Lint` CI job passes.

---

## Self-Review

**Spec coverage:**
- ✅ Worktree for isolated work — addressed by using this branch
- ✅ Refactor `App.tsx` — three pure modules extracted, App.tsx updated
- ✅ Add test cases — 35 unit tests across three files
- ✅ CI gate to block merge if tests fail — `test.yml` workflow + branch protection instructions

**Placeholder scan:** No TBDs, no "implement later", all code blocks contain real, complete code.

**Type consistency:**
- `findBookCode` returns `{ en, zh, matchedLen }` — used consistently in `bible-lookup.test.ts`, `schedule-parser.ts`
- `getDayPlan(dateKey, scheduleJson)` two-arg signature — matches all call sites in `App.tsx` edits
- `migrateCompletedTasks(tasks, schedule)` — matches test and App.tsx call site

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-refactor-and-tests.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
