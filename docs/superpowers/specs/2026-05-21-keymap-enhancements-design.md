# Keymap Enhancements Design

**Date:** 2026-05-21  
**Status:** Approved  
**Extends:** `2026-05-21-keymap-design.md`

## Overview

Enhance the vim-inspired keymap with richer navigation (within-day passage navigation, `N`/`n` day pair, `j`/`k` scroll, `g h`/`g l` chords for day navigation) and fix two behaviors (`m` becomes a toggle, `[`/`]` now also load the reading).

## Shortcut Changes

### Changed

| Key | Old | New |
|-----|-----|-----|
| `m` | Mark current as read (one-way) | Toggle read ↔ unread |
| `[` / `]` | Calendar navigation only | Navigate day **and** load that day's first unread reading |

### Added

| Key | Action |
|-----|--------|
| `N` | Previous day with readings |
| `h` | Previous passage in today's plan |
| `l` | Next passage in today's plan |
| `r` | Toggle reading mode (standard ↔ book) |
| `j` | Scroll content down ~300 px |
| `k` | Scroll content up ~300 px |
| `g h` | Previous day + load reading (alias for `[`) |
| `g l` | Next day + load reading (alias for `]`) |

## Implementation

### New refs (declare after `cycleThemeRef`)

```tsx
const handleDayClickRef = useRef<(dateKey: string) => void>(() => {});
const goToPrevDayRef    = useRef<() => void>(() => {});
const goToNextItemRef   = useRef<() => void>(() => {});
const goToPrevItemRef   = useRef<() => void>(() => {});
const toggleReadingModeRef = useRef<() => void>(() => {});
```

### Render-time sync (add to existing sync block after `goToNextDay`)

```tsx
handleDayClickRef.current    = handleDayClick;
goToPrevDayRef.current       = goToPrevDay;
goToNextItemRef.current      = goToNextItem;
goToPrevItemRef.current      = goToPrevItem;
toggleReadingModeRef.current = toggleReadingMode;
```

### `markCurrentAsRead` — change to toggle

Replace the one-way mark with a bidirectional toggle:

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

### `prevDayWithPlan` useMemo (add after `nextDayWithPlan`)

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

### New action functions (add after `goToNextDay`)

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

### Keymap handler changes

**`navigateDay` — add `handleDayClick` call (replaces bare `setSelectedDate`):**

```tsx
const navigateDay = (delta: number) => {
  const [yr, mo, dy] = selectedDateRef.current.split('-').map(Number);
  const d = new Date(yr, mo - 1, dy);
  d.setDate(d.getDate() + delta);
  setCurrentViewDate(d);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  handleDayClickRef.current(iso);
};
```

**`pendingG` chord block — add `h` and `l` cases:**

```tsx
if (pendingG.current) {
  pendingG.current = false;
  if (e.key === 'u') { goToFirstUnfinishedRef.current(); return; }
  if (e.key === 'h') { navigateDay(-1); return; }
  if (e.key === 'l') { navigateDay(1); return; }
  // unrecognised second key — fall through to handle it normally
}
```

**New `switch` cases (add to existing switch):**

```tsx
case 'N':
  goToPrevDayRef.current();
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

Note: `h`/`l` as standalone keys fire passage navigation. When preceded by `g`, they fire day navigation (handled in the chord block before the switch). `mainScrollRef` is a ref — no stale closure issue; no additional ref needed.

### Help modal update

Replace the NAVIGATION and READING section rows, add a scroll row to INTERFACE:

```tsx
{ section: 'NAVIGATION', rows: [
  { keys: ['[', ']'],  label: 'Previous / next day' },
  { keys: ['g→h', 'g→l'], label: 'Prev / next day (chord)' },
  { keys: ['t'],       label: 'Jump to today' },
  { keys: ['g→u'],     label: 'First unfinished' },
  { keys: ['N', 'n'],  label: 'Prev / next unread day' },
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

## Key Interaction Notes

- `h` standalone → prev passage; `g h` chord → prev day. Chord takes priority (checked before switch).
- `l` standalone → next passage; `g l` chord → next day. Same priority rule.
- `j`/`k` access `mainScrollRef` directly (ref, no stale closure issue, not in deps array).
- `N` is uppercase (`Shift+n`) — `isInInput` guard still applies since `e.key` is `'N'`, not `'n'`.

## Testing

Manual verification:
- `[`/`]` navigate day AND load the reading (not just calendar highlight)
- `m` marks and then, pressed again, unmarks; toast reflects both directions
- `g h` / `g l` behave identically to `[` / `]`
- `h` / `l` navigate passages within today's plan
- `N` jumps to the previous calendar day that has plan entries
- `r` switches between standard and book reading modes
- `j` / `k` scroll the main content area
- `g→u`, `g→h`, `g→l` all show correctly in the `?` help modal
