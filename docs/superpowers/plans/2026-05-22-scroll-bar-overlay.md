# Scroll Bar Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom scroll indicator (track + draggable thumb + top/bottom arrow buttons) that appears when the user scrolls and fades out 2 seconds after stopping, on both the mobile and desktop main content areas.

**Architecture:** `ScrollBarOverlay` is a standalone component positioned absolutely over the scroll container; it attaches `scroll` and `ResizeObserver` listeners to the passed `scrollRef` to drive thumb position and visibility. `ScrollablePane` is a thin wrapper that composes the scrollable div and overlay, hiding the native scrollbar via a CSS class. Two integration points in `App.tsx` replace the raw `<div ref={mainScrollRef}>` elements.

**Tech Stack:** React 18, TypeScript, inline styles (T/A/F token system), Pointer Events API for drag, ResizeObserver for dynamic content changes.

---

## File Map

| File | Change |
|---|---|
| `index.html` | Add `.scroll-hide` CSS rule inside existing `<style>` block (line ~60) |
| `src/App.tsx` | Add `ScrollBarOverlay` + `ScrollablePane` components before `// ─── APP ───` (line ~447); replace two `<div ref={mainScrollRef}>` integration points |

---

## Task 1: Add `.scroll-hide` CSS to `index.html`

**Files:**
- Modify: `index.html` — inside existing `<style>` block, after the `.explain` rule

- [ ] **Step 1: Add the CSS rule**

In `index.html`, find:
```css
    .explain {
      color: #64748b;
      font-size: 0.9em;
      font-style: italic;
    }
  </style>
```
Replace with:
```css
    .explain {
      color: #64748b;
      font-size: 0.9em;
      font-style: italic;
    }

    .scroll-hide {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .scroll-hide::-webkit-scrollbar {
      display: none;
    }
  </style>
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exits 0, no errors.

---

## Task 2: Add `ScrollBarOverlay` and `ScrollablePane` components to `src/App.tsx`

**Files:**
- Modify: `src/App.tsx` — insert two components before `// ─── APP ───` (currently line 447)

- [ ] **Step 1: Insert both components**

In `src/App.tsx`, find:
```tsx
// ─── APP ─────────────────────────────────────────────────────────────────────
```
Insert the following **immediately before** that line:

```tsx
// ─── SCROLL BAR OVERLAY ──────────────────────────────────────────────────────
const ScrollBarOverlay: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement>;
  theme: TK;
}> = ({ scrollRef, theme }) => {
  const [visible, setVisible] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [thumbRatio, setThumbRatio] = useState(1);
  const [thumbOffset, setThumbOffset] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const overflow = scrollHeight > clientHeight;
      setCanScroll(overflow);
      if (!overflow) return;
      setThumbRatio(clientHeight / scrollHeight);
      setThumbOffset(scrollTop / (scrollHeight - clientHeight));
    };
    const onScroll = () => {
      update();
      setVisible(true);
      clearTimeout(hideTimer.current);
      if (!dragState.current) {
        hideTimer.current = setTimeout(() => setVisible(false), 2000);
      }
    };
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      clearTimeout(hideTimer.current);
    };
  }, [scrollRef]);

  if (!canScroll) return null;

  const trackH = trackRef.current?.clientHeight ?? 0;
  const thumbH = trackH > 0 ? Math.max(24, thumbRatio * trackH) : 24;
  const thumbTop = trackH > 0 ? thumbOffset * (trackH - thumbH) : 0;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startScrollTop: scrollRef.current!.scrollTop };
    clearTimeout(hideTimer.current);
  };
  const onDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !trackRef.current || !scrollRef.current) return;
    const el = scrollRef.current;
    const trackClientH = trackRef.current.clientHeight;
    const tH = Math.max(24, (el.clientHeight / el.scrollHeight) * trackClientH);
    el.scrollTop = dragState.current.startScrollTop +
      (e.clientY - dragState.current.startY) * (el.scrollHeight - el.clientHeight) / (trackClientH - tH);
  };
  const endDrag = () => {
    dragState.current = null;
    hideTimer.current = setTimeout(() => setVisible(false), 2000);
  };

  return (
    <div style={{
      position: 'absolute', right: 2, top: 0, bottom: 0, width: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '4px 0', zIndex: 10,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <button
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{
          appearance: 'none', border: 'none', cursor: 'pointer', padding: 0,
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: theme.surface, color: theme.ink, opacity: 0.85,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChevronUp size={12} />
      </button>
      <div
        ref={trackRef}
        style={{
          flex: 1, width: 4, borderRadius: 2,
          background: theme.faint, opacity: 0.6,
          position: 'relative', margin: '2px auto',
        }}
      >
        <div
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          style={{
            position: 'absolute', left: 0, right: 0,
            top: thumbTop, height: thumbH,
            background: theme.inkSoft, borderRadius: 4,
            cursor: 'grab', touchAction: 'none',
          }}
        />
      </div>
      <button
        onClick={() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }}
        style={{
          appearance: 'none', border: 'none', cursor: 'pointer', padding: 0,
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: theme.surface, color: theme.ink, opacity: 0.85,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChevronDown size={12} />
      </button>
    </div>
  );
};

// ─── SCROLLABLE PANE ─────────────────────────────────────────────────────────
const ScrollablePane: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement>;
  theme: TK;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ scrollRef, theme, style, innerStyle, children }) => (
  <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style }}>
    <div ref={scrollRef} className="scroll-hide" style={{ flex: 1, overflowY: 'auto', minHeight: 0, ...innerStyle }}>
      {children}
    </div>
    <ScrollBarOverlay scrollRef={scrollRef} theme={theme} />
  </div>
);

```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exits 0, no TypeScript errors.

---

## Task 3: Wire mobile content area

**Files:**
- Modify: `src/App.tsx` — replace mobile `<div ref={mainScrollRef}>` and its closing tag

> Note: after Task 2 insertions, line numbers shift by ~110 lines. Use the unique string matches below, not line numbers.

- [ ] **Step 1: Replace mobile scroll div opening tag**

Find (this string is unique in the file):
```tsx
          <div ref={mainScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 130px' }}>
```
Replace with:
```tsx
          <ScrollablePane scrollRef={mainScrollRef} theme={theme} style={{ flex: 1 }} innerStyle={{ padding: '20px 20px 130px' }}>
```

- [ ] **Step 2: Replace mobile scroll div closing tag**

Find the `</div>` immediately before `{/* Floating bottom tab bar */}`. It appears in this exact context:
```tsx
            )}
          </div>

          {/* Floating bottom tab bar */}
```
Replace `          </div>` with `          </ScrollablePane>`:
```tsx
            )}
          </ScrollablePane>

          {/* Floating bottom tab bar */}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: exits 0.

---

## Task 4: Wire desktop content area

**Files:**
- Modify: `src/App.tsx` — replace desktop `<div ref={mainScrollRef}>` and its closing tag

- [ ] **Step 1: Replace desktop scroll div opening tag**

Find (unique — note the comment on the line above):
```tsx
          {/* SCROLL CONTAINER */}
          <div ref={mainScrollRef} style={{ flex: 1, overflowY: 'auto' }}>
```
Replace with:
```tsx
          {/* SCROLL CONTAINER */}
          <ScrollablePane scrollRef={mainScrollRef} theme={theme} style={{ flex: 1 }}>
```

- [ ] **Step 2: Replace desktop scroll div closing tag**

Find (unique context — bibleData footer conditional closing, then the main scroll div, then `</main>`):
```tsx
            )}
          </div>
        </main>
```
Replace `          </div>` with `          </ScrollablePane>`:
```tsx
            )}
          </ScrollablePane>
        </main>
```

- [ ] **Step 3: Run full verification**

```bash
npm run lint && npm run test && npm run build
```
Expected: lint 0 errors, all tests pass, build exits 0.

---

## Task 5: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/App.tsx index.html
git commit -m "feat: scroll bar overlay with top/bottom nav for mobile and desktop"
```
