# Scroll Bar Overlay — Design Spec

Date: 2026-05-22

## Problem

Mobile and desktop content areas have no visible scroll position indicator and no quick way to jump to the top or bottom of a long chapter. Native scrollbars are hidden by default on mobile browsers.

## Goals

- Show a custom scrollbar (track + draggable thumb + top/bottom buttons) on the right edge of the main content area.
- Appear when the user scrolls; auto-hide 2 seconds after scrolling stops.
- Work on both mobile and desktop.
- No layout shift — overlay sits on top of content, does not push it.

## Non-Goals

- Styling scrollbars inside mobile sheets (plan, calendar, settings).
- Hiding or replacing the browser's native scrollbar on desktop.

---

## Architecture

### `ScrollablePane` (wrapper component, lives in `App.tsx`)

Replaces the raw `<div ref={mainScrollRef} style={{ overflowY: 'auto' }}>` at two locations:

| Location | Line | Notes |
|---|---|---|
| Mobile content area | ~1207 | Has `padding: '20px 20px 130px'` for bottom nav |
| Desktop content area | ~2102 | No bottom padding |

Props:

```ts
interface ScrollablePaneProps {
  scrollRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
  style?: React.CSSProperties;        // applied to outer wrapper
  innerStyle?: React.CSSProperties;   // applied to inner scrollable div
}
```

Structure:

```
<div style={{ position: 'relative', overflow: 'hidden', ...style }}>
  <div ref={scrollRef} style={{ overflowY: 'auto', height: '100%', ...innerStyle }}>
    {children}
  </div>
  <ScrollBarOverlay scrollRef={scrollRef} />
</div>
```

`mainScrollRef` is passed in as `scrollRef` and assigned to the inner scrollable div — all existing `mainScrollRef.current?.scrollTo(...)` callers continue to work unchanged.

---

### `ScrollBarOverlay` (display component, lives in `App.tsx`)

Props:

```ts
interface ScrollBarOverlayProps {
  scrollRef: React.RefObject<HTMLDivElement>;
}
```

#### Layout

```
position: absolute, right: 0, top: 0, bottom: 0
width: 20px
pointer-events: auto (only for interactive elements)
opacity: 0 | 1 (CSS transition 0.2s)

┌────┐
│ ↑  │  28×28px circle — onClick: scrollTo({ top: 0 })
├────┤
│    │
│ ██ │  track (flex: 1)
│    │  thumb: position absolute, draggable
│    │
├────┤
│ ↓  │  28×28px circle — onClick: scrollTo({ top: scrollHeight })
└────┘
```

#### Thumb sizing

```
thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight)
thumbTop    = (scrollTop / (scrollHeight - clientHeight)) * (trackHeight - thumbHeight)
```

Hidden entirely when `scrollHeight <= clientHeight` (nothing to scroll).

#### Show/hide logic

- `visible` state, starts `false`.
- On `scroll` event: set `visible = true`, clear existing timer, start 2s timer → `visible = false`.
- CSS: `opacity: visible ? 1 : 0`, `transition: 'opacity 0.2s ease'`.
- `pointerEvents: visible ? 'auto' : 'none'` so hidden bar doesn't block taps.

#### Thumb drag

1. `onPointerDown` on thumb → `e.currentTarget.setPointerCapture(e.pointerId)`, record `startY` and `startScrollTop`.
2. `onPointerMove` on thumb → `delta = e.clientY - startY` → `scrollRef.current.scrollTop = startScrollTop + delta * (scrollHeight - clientHeight) / (trackHeight - thumbHeight)`.
3. `onPointerUp` → release.
4. During drag: keep `visible = true`, suppress the hide timer.

#### Design tokens

| Element | Token |
|---|---|
| Track background | `theme.faint` at 0.6 opacity |
| Thumb | `theme.inkSoft`, border-radius 4px |
| Arrow button bg | `theme.surface` at 0.85 opacity |
| Arrow icon | `theme.ink` |

All colors pulled from `T[settings.theme]` (the `theme` object already in scope).

#### State (all local, zero App.tsx state changes)

```ts
const [visible, setVisible] = useState(false);
const [thumbRatio, setThumbRatio] = useState(0);   // clientHeight / scrollHeight
const [thumbOffset, setThumbOffset] = useState(0); // 0–1, scrollTop fraction
const trackRef = useRef<HTMLDivElement>(null);
const hideTimer = useRef<ReturnType<typeof setTimeout>>();
const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null);
```

A single `useEffect` attaches `scroll` and `resize` listeners to `scrollRef.current` and updates `thumbRatio` + `thumbOffset`.

---

## Integration Checklist

- [ ] Replace mobile `<div ref={mainScrollRef}>` (line ~1207) with `<ScrollablePane scrollRef={mainScrollRef} style={{ flex: 1 }} innerStyle={{ padding: '20px 20px 130px' }}>`.
- [ ] Replace desktop `<div ref={mainScrollRef}>` (line ~2102) with `<ScrollablePane scrollRef={mainScrollRef} style={{ flex: 1 }}>`.
- [ ] Ensure parent containers at both sites already have `position: relative` or `overflow: hidden` — or that the wrapper div provides it.
- [ ] Verify `mainScrollRef` still works for existing callers after the swap (it will, since `scrollRef` prop is assigned to the inner div).

---

## Testing

- Long chapter (e.g. Psalms 119) on mobile: scrollbar appears on scroll, fades after 2s.
- Thumb drag: dragging thumb repositions content correctly.
- Short chapter (e.g. Obadiah 1): scrollbar hidden (nothing to scroll).
- Top/bottom buttons: jump instantly with smooth scroll.
- mobileSheet open (plan/settings): scrollbar not visible (it's inside the main content wrapper, sheets render above it).
- `npm run lint && npm run test && npm run build` all pass.
