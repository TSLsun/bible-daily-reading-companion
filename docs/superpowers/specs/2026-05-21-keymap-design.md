# Keymap Feature Design

**Date:** 2026-05-21  
**Status:** Approved

## Overview

Add a vim-inspired keyboard shortcut set to the Bible Daily Reading Companion. All shortcuts are single-key (or two-key chord) with no modifier combos. The existing `⌘K` handler in `App.tsx` is removed and replaced by this system.

## Shortcut Set

### Navigation

| Key | Action | Fires in inputs? |
|-----|--------|-----------------|
| `[` | Previous day | No |
| `]` | Next day | No |
| `t` | Jump to today | No |
| `g u` | Go to first unfinished reading | No |

### Reading

| Key | Action | Fires in inputs? |
|-----|--------|-----------------|
| `m` | Mark current passage as read | No |
| `n` | Next unread passage (next day with plan) | No |

### Interface

| Key | Action | Fires in inputs? |
|-----|--------|-----------------|
| `/` | Toggle search panel | No |
| `s` | Toggle settings panel | No |
| `c` | Cycle theme (light → sepia → dark) | No |
| `Escape` | Close any open panel or modal | Yes |
| `?` | Toggle keyboard shortcuts help modal | No |

## Implementation

### Handler consolidation

The existing `⌘K`-only `useEffect` handler (App.tsx ~line 514) is removed and replaced with a single consolidated keydown handler covering all shortcuts. The handler is registered once with an empty dependency array.

### Input guard

Letter shortcuts are suppressed when the event target is an input field:

```ts
const isInInput = e.target instanceof HTMLElement &&
  (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
if (isInInput) return;
```

`Escape` bypasses this guard so it always closes panels.

### Stale closure avoidance

The handler reads `selectedDate` and calls several action functions. Since the handler is registered once, these are accessed via refs kept current on every render:

```ts
const selectedDateRef = useRef(selectedDate);
selectedDateRef.current = selectedDate;

const goToTodayRef = useRef(goToTodayInPlan);
goToTodayRef.current = goToTodayInPlan;

const goToFirstUnfinishedRef = useRef(goToFirstUnfinished);
goToFirstUnfinishedRef.current = goToFirstUnfinished;

const goToNextDayRef = useRef(goToNextDay);
goToNextDayRef.current = goToNextDay;

const markCurrentAsReadRef = useRef(markCurrentAsRead);
markCurrentAsReadRef.current = markCurrentAsRead;

const cycleThemeRef = useRef(cycleTheme);
cycleThemeRef.current = cycleTheme;
```

### Two-key chord (`g u`)

A `pendingG` ref tracks whether the previous keydown was `g` with no modifier:

```ts
const pendingGRef = useRef(false);

// In handler:
if (e.key === 'g') { pendingGRef.current = true; return; }
if (pendingGRef.current) {
  pendingGRef.current = false;
  if (e.key === 'u') { goToFirstUnfinishedRef.current(); return; }
  // unrecognised second key — fall through silently
  return;
}
pendingGRef.current = false;
```

### Per-shortcut behaviour

**`/` — toggle search**
- Desktop: `setRailOpen(true)` + toggle `railSearchOpen`. Existing `searchPanelInputRef` focus effect auto-focuses input on open.
- Mobile: toggles `mobileSheet('search')`.

**`[` / `]` — day navigation**
```ts
const d = new Date(selectedDateRef.current);
d.setDate(d.getDate() + delta); // -1 or +1
const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
setCurrentViewDate(d);
setSelectedDate(iso);
```
No boundary enforcement — consistent with existing calendar behaviour.

**`t` — today:** calls `goToTodayRef.current()`.

**`g u` — first unfinished:** calls `goToFirstUnfinishedRef.current()`.

**`m` — mark read:** calls `markCurrentAsReadRef.current()`.

**`n` — next unread:** calls `goToNextDayRef.current()`.

**`s` — settings:** toggles `settingsOpen`.

**`c` — cycle theme:** calls `cycleThemeRef.current()`.

**`Escape`:** sets `railSearchOpen(false)`, `settingsOpen(false)`, `mobileSheet(null)`, `showKeymapHelp(false)`.

**`?`:** toggles `showKeymapHelp`.

### Shortcuts help modal (`?`)

New boolean state `showKeymapHelp` (default `false`). Rendered at the bottom of the App JSX tree so it overlays everything.

**UI:** Centered card with dim full-screen backdrop using existing design tokens (`T[theme]`, `A`, `F`). Shortcuts grouped into three sections: Navigation, Reading, Interface. Each row: `<kbd>` key(s) + description. Click-outside (backdrop click) or `Escape` dismisses.

## Removed

- The `⌘K` / `Ctrl+K` shortcut and its `useEffect` handler are deleted from `App.tsx`.

## Testing

- Vitest: no new unit tests needed (event-handler wiring, no extractable pure functions).
- Manual verification: each shortcut fires correctly; input guard blocks letter keys while typing in search; `Escape` closes all panels including help modal; `g u` chord works and ignores unknown second keys; `[`/`]` navigate correctly at year boundaries.
