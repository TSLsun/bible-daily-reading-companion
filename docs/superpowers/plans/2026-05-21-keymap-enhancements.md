# Keymap Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the vim-style keymap with 8 new shortcuts (`N`, `h`, `l`, `r`, `j`, `k`, `g h`, `g l`), change `m` to a toggle, make `[`/`]` also load the day's reading, and update the `?` help modal.

**Architecture:** All changes are in `src/App.tsx`. New action functions are wrapped in refs (same pattern as the existing `goToTodayRef` etc.) so the once-registered keydown handler stays stale-closure-free. `navigateDay` is updated to call `handleDayClickRef` instead of bare `setSelectedDate` so `[`/`]` load the reading. The `pendingG` chord block gains `h` and `l` cases alongside the existing `u`.

**Tech Stack:** React 18, TypeScript, Vite. No new dependencies.

---

### Task 1: Add refs, action functions, and `prevDayWithPlan`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add 5 new refs after `cycleThemeRef`**

  Find the line `const cycleThemeRef = useRef<() => void>(() => {});` and add immediately after:

  ```tsx
  const handleDayClickRef      = useRef<(dateKey: string) => void>(() => {});
  const goToPrevDayRef         = useRef<() => void>(() => {});
  const goToNextItemRef        = useRef<() => void>(() => {});
  const goToPrevItemRef        = useRef<() => void>(() => {});
  const toggleReadingModeRef   = useRef<() => void>(() => {});
  ```

- [ ] **Step 2: Modify `markCurrentAsRead` to toggle read/unread**

  Find the `markCurrentAsRead` function. It currently checks `if (!settings.completedTasks.includes(id))` before calling `toggleTask`. Replace the entire function body:

  ```tsx
  const markCurrentAsRead = () => {
    if (!bibleData) return;
    const id = navStatus.currentItemId || currentScheduleItemId ||
      buildVerseId(bibleData.bookCode, bibleData.chapter, bibleData.startVerse, bibleData.endVerse);
    const wasCompleted = settings.completedTasks.includes(id);
    toggleTask(id);
    showToast(wasCompleted ? `已取消：${bibleData.reference}` : `已完成：${bibleData.reference}！`);
  };
  ```

- [ ] **Step 3: Add `prevDayWithPlan` useMemo after `nextDayWithPlan`**

  Find `const nextDayWithPlan = useMemo(`. That useMemo ends with `return null;` and its closing `}, [...]);`. Insert immediately after that closing line:

  ```tsx
  const prevDayWithPlan = useMemo(() => {
    if (settings.scheduleMode !== 'daily') return null;
    try {
      const schedule = JSON.parse(settings.dailyScheduleJson);
      const yearPrefix = String(PLAN_YEAR) + '-';
      const dates = Object.keys(schedule).filter(k => k.startsWith(yearPrefix)).sort();
      const idx = dates.indexOf(selectedDate);
      if (idx === -1) return null;
      for (let i = idx - 1; i >= 0; i--) {
        if (schedule[dates[i]]?.trim()) return dates[i];
      }
    } catch { /* ignore */ }
    return null;
  }, [settings.scheduleMode, settings.dailyScheduleJson, selectedDate]);
  ```

- [ ] **Step 4: Add new action functions after `goToNextDay`**

  Find `const goToNextDay = () => {` and its closing `};`. Insert immediately after:

  ```tsx
  const goToPrevDay = () => {
    if (!prevDayWithPlan) return;
    const [y, m, d] = prevDayWithPlan.split('-').map(Number);
    setCurrentViewDate(new Date(y, m - 1, d));
    handleDayClick(prevDayWithPlan);
  };

  const goToNextItem = () => {
    if (!navStatus.nextItem) return;
    const item = navStatus.nextItem as ScheduleItem;
    fetchBible({ book: item.book, chapter: item.chapter, startVerse: item.startVerse, endVerse: item.endVerse, label: item.label, scheduleItemId: item.id });
  };

  const goToPrevItem = () => {
    if (!navStatus.prevItem) return;
    const item = navStatus.prevItem as ScheduleItem;
    fetchBible({ book: item.book, chapter: item.chapter, startVerse: item.startVerse, endVerse: item.endVerse, label: item.label, scheduleItemId: item.id });
  };

  const toggleReadingMode = () => {
    setReadingMode(m => m === 'standard' ? 'book' : 'standard');
  };
  ```

- [ ] **Step 5: Add 5 sync assignments to the existing ref-sync block**

  Find the existing sync block (search for `// Keep action refs current`). It ends with `cycleThemeRef.current = cycleTheme;`. Add immediately after:

  ```tsx
  handleDayClickRef.current    = handleDayClick;
  goToPrevDayRef.current       = goToPrevDay;
  goToNextItemRef.current      = goToNextItem;
  goToPrevItemRef.current      = goToPrevItem;
  toggleReadingModeRef.current = toggleReadingMode;
  ```

- [ ] **Step 6: Run lint and build**

  ```bash
  npm run lint && npm run build
  ```

  Expected: 0 errors, build succeeds.

- [ ] **Step 7: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(keymap): add refs, prevDayWithPlan, and action functions for enhancements"
  ```

---

### Task 2: Update the keymap handler

**Files:**
- Modify: `src/App.tsx` (inside the `useEffect` keymap handler)

- [ ] **Step 1: Update `navigateDay` to load the day's reading**

  Inside the keymap `useEffect`, find `navigateDay`. It currently ends with:

  ```tsx
  setCurrentViewDate(d);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  setSelectedDate(iso);
  ```

  Replace those three lines with:

  ```tsx
  setCurrentViewDate(d);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  handleDayClickRef.current(iso);
  ```

  (`handleDayClick` calls `setSelectedDate` internally and also loads the passage — this is what makes `[`/`]` actually enter the day's reading.)

- [ ] **Step 2: Extend the `pendingG` chord block with `h` and `l`**

  Find the `pendingG.current` block. It currently has:

  ```tsx
  if (pendingG.current) {
    pendingG.current = false;
    if (e.key === 'u') { goToFirstUnfinishedRef.current(); return; }
    // unrecognised second key — fall through to handle it normally
  }
  ```

  Replace with:

  ```tsx
  if (pendingG.current) {
    pendingG.current = false;
    if (e.key === 'u') { goToFirstUnfinishedRef.current(); return; }
    if (e.key === 'h') { navigateDay(-1); return; }
    if (e.key === 'l') { navigateDay(1); return; }
    // unrecognised second key — fall through to handle it normally
  }
  ```

- [ ] **Step 3: Add new cases to the `switch` statement**

  Find `case 'n':` in the switch. After its `break;`, add `case 'N':`:

  ```tsx
  case 'n':
    goToNextDayRef.current();
    break;
  case 'N':
    goToPrevDayRef.current();
    break;
  ```

  Then find `case 'c':` and after its `break;`, add the remaining new cases:

  ```tsx
  case 'c':
    cycleThemeRef.current();
    break;
  case 'h':
    goToPrevItemRef.current();
    break;
  case 'l':
    goToNextItemRef.current();
    break;
  case 'r':
    toggleReadingModeRef.current();
    break;
  case 'j':
    mainScrollRef.current?.scrollBy({ top: 300, behavior: 'smooth' });
    break;
  case 'k':
    mainScrollRef.current?.scrollBy({ top: -300, behavior: 'smooth' });
    break;
  ```

  Note: `h` and `l` also appear in the `pendingG` chord block. The chord block runs before the switch, so `g h` → prev day and standalone `h` → prev passage. No conflict.

- [ ] **Step 4: Run lint, tests, and build**

  ```bash
  npm run lint && npm run test && npm run build
  ```

  Expected: 0 lint errors, 56 tests pass, build succeeds.

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(keymap): add N, h, l, r, j, k shortcuts and g-h/g-l chords"
  ```

---

### Task 3: Update the `?` help modal

**Files:**
- Modify: `src/App.tsx` (the `showKeymapHelp` modal JSX)

- [ ] **Step 1: Replace the sections array in the modal**

  Inside the `showKeymapHelp` modal JSX, find the inline array that starts with:

  ```tsx
  { section: 'NAVIGATION', rows: [
    { keys: ['[', ']'], label: 'Previous / next day' },
  ```

  Replace the entire array (all three sections) with:

  ```tsx
  { section: 'NAVIGATION', rows: [
    { keys: ['[', ']'],      label: 'Previous / next day' },
    { keys: ['g→h', 'g→l'], label: 'Prev / next day (chord)' },
    { keys: ['t'],           label: 'Jump to today' },
    { keys: ['g→u'],         label: 'First unfinished' },
    { keys: ['N', 'n'],      label: 'Prev / next unread day' },
  ]},
  { section: 'READING', rows: [
    { keys: ['h', 'l'],  label: 'Prev / next passage' },
    { keys: ['m'],       label: 'Toggle read / unread' },
    { keys: ['r'],       label: 'Toggle reading mode' },
  ]},
  { section: 'INTERFACE', rows: [
    { keys: ['/'],       label: 'Toggle search' },
    { keys: ['j', 'k'],  label: 'Scroll down / up' },
    { keys: ['s'],       label: 'Toggle settings' },
    { keys: ['c'],       label: 'Cycle theme' },
    { keys: ['Esc'],     label: 'Close panels' },
    { keys: ['?'],       label: 'This help' },
  ]},
  ```

- [ ] **Step 2: Run lint, tests, and build**

  ```bash
  npm run lint && npm run test && npm run build
  ```

  Expected: 0 lint errors, 56 tests pass, build succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(keymap): update ? modal with new shortcuts"
  ```

---

### Task 4: Manual verification

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

  Open `http://localhost:5173/bible-daily-reading-companion`.

- [ ] **Step 2: Verify changed behaviors**

  | Key | Expected |
  |-----|----------|
  | `[` | Moves to previous day AND loads that day's first reading |
  | `]` | Moves to next day AND loads that day's first reading |
  | `m` | Marks passage as read; press again → unmarks (toast: `已取消：…`) |

- [ ] **Step 3: Verify new shortcuts**

  | Key | Expected |
  |-----|----------|
  | `N` | Jumps to previous calendar day with plan entries |
  | `h` | Loads previous passage in today's plan (no-op if on first item) |
  | `l` | Loads next passage in today's plan (no-op if on last item) |
  | `r` | Switches between standard and book reading modes |
  | `j` | Scrolls main content down ~300 px |
  | `k` | Scrolls main content up ~300 px |
  | `g` then `h` | Moves to previous day + loads reading (same as `[`) |
  | `g` then `l` | Moves to next day + loads reading (same as `]`) |

- [ ] **Step 4: Verify `?` modal**

  Press `?` — modal should show all three updated sections including `g→h`/`g→l`, `N`/`n`, `h`/`l`, `r`, `j`/`k`.

- [ ] **Step 5: Verify input guard still holds**

  Click into the search input and press `h`, `l`, `j`, `k`, `r`, `N` — none should trigger; characters should type normally. Press `Esc` — search panel closes.
