# Search Feature Design

**Date:** 2026-05-19  
**Status:** Approved

## Overview

Add a search panel to the Bible Daily Reading Companion that gives users two ways to navigate to any passage:

1. **Book/chapter browser** — tap a book from a grid, then pick a chapter number
2. **Keyword search** — type a phrase, get matching verses from the FHL API

Both modes live in the same panel with no mode-switching required.

---

## UI Layout

### Mobile (bottom sheet)

The `搜尋` tab in the floating bottom tab bar already exists and is wired to `mobileSheet === 'search'`. The sheet currently renders nothing — this feature fills it.

```
┌─────────────────────────────┐
│ 🔍 關鍵字搜尋…              │  ← always-visible search input
├─────────────────────────────┤
│ 舊約                        │  ← OT section label
│ 創世記  出埃及記  利未記…   │  ← 4-column book grid
│ 新約                        │  ← NT section label
│ 馬太福音  馬可福音…         │
└─────────────────────────────┘

When typing:
┌─────────────────────────────┐
│ 🔍 神愛世人            [✕] │  ← input active, clear button
├─────────────────────────────┤
│ 搜尋結果 · 1 節             │
│ 約翰福音 3:16               │
│ 「神愛世人，甚至將他的…」   │
│ …                           │
└─────────────────────────────┘

After tapping a book:
┌─────────────────────────────┐
│ ‹ 返回   詩篇   150 章      │
├─────────────────────────────┤
│  1   2   3   4   5   6   7  │  ← chapter number grid (7 cols)
│  8   9  10  11  12  13  14  │
│ …                           │
└─────────────────────────────┘
```

### Desktop (left rail)

A new collapsible section appears in the left rail panel, above the schedule section. It mirrors the mobile layout with a 3-column book grid to fit the narrower rail width. When a book is selected, the chapter grid replaces the book grid inline (no navigation needed — plenty of vertical space).

---

## Interaction Flow

### Browse mode
1. User taps a book cell → book grid replaced by chapter number grid with a back button
2. User taps a chapter → calls existing `fetchBible({ book, chapter })` → closes sheet (mobile) or collapses panel focus (desktop)

### Keyword search mode
1. User types in the search input → debounced call to FHL search API
2. Book grid is replaced by a scrollable results list (reference + verse snippet)
3. User taps a result → calls `fetchBible({ book, chapter })` → closes sheet
4. User clears input → results disappear, book grid returns

---

## Data & API

### Book list
Derived from `BIBLE_BOOKS` in `constants.tsx` — no API call needed. Grouped into OT (39 books) and NT (27 books) using a fixed split at 創世記…瑪拉基書 / 馬太福音…啟示錄.

### Chapter counts
Hardcoded in a new constant `BIBLE_CHAPTER_COUNTS: Record<string, number>` — the Bible's chapter counts are fixed. This avoids any API round-trip for the chapter picker.

### Keyword search API
```
GET https://bible.fhl.net/json/se.php?VERSION=<ver>&q=<keyword>&gb=0
```
- Response is Big5-encoded (same `TextDecoder('big5')` pattern already used in the app)
- Response shape per result: `{ chineses: string, engs: string, chap: number, sec: number, bible_text: string }`
- `chineses` is a Chinese abbreviation (e.g. `"約"`) — map via `BIBLE_ALIASES` to get the full book name, then via `BIBLE_BOOKS` to get the API book code
- Uses the user's currently selected `primaryVersion` for consistency

---

## State

All new state is local to the search panel component — nothing persisted to `localStorage`.

| State variable | Type | Purpose |
|---|---|---|
| `searchQuery` | `string` | Current text in the search input |
| `searchResults` | `BibleVerse[]`-like array or `null` | Results from keyword API, null when input is empty |
| `searchLoading` | `boolean` | Loading indicator during API call |
| `selectedBook` | `string \| null` | API book code of the book whose chapter grid is showing |

---

## Out of Scope

- Completed-chapter highlighting in the chapter grid (too much visual noise)
- "最近閱讀" (Recent reads) tab — not needed for v1
- Verse-level deep linking from search results — tapping a result navigates to the chapter, not a specific verse

---

## Files to Change

| File | Change |
|---|---|
| `src/App.tsx` | Add `SearchPanel` component; fill `mobileSheet === 'search'` sheet; add search section to desktop rail |
| `src/constants.tsx` | Add `BIBLE_CHAPTER_COUNTS` constant |
| `src/types.ts` | Add `SearchResult` interface if needed |
