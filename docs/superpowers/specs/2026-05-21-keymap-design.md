# Keymap Feature Design

**Date:** 2026-05-21  
**Status:** Approved

## Overview

Add a small vim-inspired keyboard shortcut set to the Bible Daily Reading Companion. All shortcuts are single-key (no modifier combos) except Escape. The existing `⌘K` handler in `App.tsx` is removed and replaced by this system.

## Shortcut Set

| Key | Action | Fires in input fields? |
|-----|--------|------------------------|
| `/` | Toggle search panel | No |
| `Escape` | Close any open panel or modal | Yes |
| `[` | Go to previous day | No |
| `]` | Go to next day | No |
| `t` | Jump to today in plan | No |
| `?` | Toggle keyboard shortcuts help modal | No |

## Implementation

### Handler consolidation

The existing `⌘K`-only `useEffect` handler (App.tsx ~line 514) is replaced with a single consolidated keydown handler covering all six shortcuts. The handler is registered once with an empty dependency array.

### Input guard

Letter shortcuts (`/`, `[`, `]`, `t`, `?`) are suppressed when the event target is an input field:

```ts
const isInInput = e.target instanceof HTMLElement &&
  (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
if (isInInput) return;
```

`Escape` bypasses this guard so it always closes panels.

### Stale closure avoidance

The handler reads `selectedDate` and calls `goToTodayInPlan`. Since the handler is registered once, these are accessed via refs that are kept current on every render:

```ts
const selectedDateRef = useRef(selectedDate);
selectedDateRef.current = selectedDate;

const goToTodayRef = useRef(goToTodayInPlan);
goToTodayRef.current = goToTodayInPlan;
```

### Search panel behavior (`/`)

- **Desktop:** opens the left rail (`setRailOpen(true)`) and the search panel (`setRailSearchOpen(true)`). If already open, closes it (`setRailSearchOpen(false)`).
- **Mobile:** toggles `mobileSheet('search')`.
- Existing `searchPanelInputRef` focus effect (already in `main`) continues to auto-focus the input when `railSearchOpen` becomes true.

### Day navigation (`[` / `]`)

Adds one calendar day to `selectedDate` and syncs `currentViewDate`:

```ts
const d = new Date(selectedDateRef.current);
d.setDate(d.getDate() + delta); // delta = -1 for [, +1 for ]
// Use local-time components to match the app's existing date key format (not UTC via toISOString)
const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
setCurrentViewDate(d);
setSelectedDate(iso);
```

No boundary enforcement — navigating beyond the plan year is allowed (consistent with existing calendar behaviour).

### Today (`t`)

Calls `goToTodayRef.current()`, which is the existing `goToTodayInPlan` function already defined in `App.tsx`.

### Shortcuts help modal (`?`)

New boolean state `showKeymapHelp` (default `false`). Pressing `?` toggles it; `Escape` closes it along with other panels.

**UI:** Centered card with dim full-screen backdrop, using the app's existing design tokens (`T[theme]`, `A`, `F`). Rendered at the bottom of the App component JSX tree so it overlays everything. Lists all shortcuts in a `<table>` with `<kbd>` styling. Click-outside (backdrop click) also dismisses.

## Removed

- The `⌘K` / `Ctrl+K` shortcut and its `useEffect` handler are deleted. No other `⌘K` references exist in the codebase.

## Testing

- Vitest: no new unit tests needed (all logic is event-handler wiring; no pure functions to extract).
- Manual: verify each shortcut fires correctly, input guard blocks letter keys while typing in the search field, Escape closes the help modal, `?` toggles correctly, `[`/`]` wrap correctly at year boundaries.
