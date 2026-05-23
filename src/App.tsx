
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, CheckCircle2, AlertCircle, BookOpen,
  Sun, Moon, Coffee, X, PartyPopper, ChevronUp,
  ChevronRight, ChevronLeft, ChevronDown, Settings,
  Save, Download, Upload, Target, BookMarked,
  CalendarDays, List, Type,
} from 'lucide-react';
import {
  BIBLE_BOOKS, FALLBACK_VERSIONS, DEFAULT_DAILY_SCHEDULE,
  BIBLE_CHAPTER_COUNTS, OT_BOOK_NAMES, NT_BOOK_NAMES,
} from './constants';
import {
  AppSettings, BibleData, BibleVerse, ScheduleItem, VersionInfo, Theme, SearchResult,
} from './types';
import { parseScheduleLine, getDayPlan, buildVerseId } from './utils/schedule-parser';
import { migrateScheduleJson, migrateCompletedTasks } from './utils/migrations';
import { searchBible } from './utils/bible-search';
import { QRCodeSVG } from 'qrcode.react';
import { pullSync, pushSync, WORKER_URL } from './utils/sync';

declare const __APP_VERSION__: string;

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────

type TK = {
  bg: string; surface: string; panel: string;
  ink: string; inkSoft: string; muted: string;
  faint: string; line: string; lineStrong: string;
  pill: string; success: string;
};

const T: Record<Theme, TK> = {
  sepia: {
    bg: '#f6efde', surface: '#fbf5e6', panel: '#f1e8d2',
    ink: '#2a2114', inkSoft: '#5b4a32', muted: '#8a7758',
    faint: '#b8a583',
    line: 'rgba(91,70,54,0.12)', lineStrong: 'rgba(91,70,54,0.22)',
    pill: 'rgba(91,70,54,0.08)', success: '#5a7a44',
  },
  light: {
    bg: '#fafaf7', surface: '#ffffff', panel: '#f3f1eb',
    ink: '#1a1a17', inkSoft: '#4a4a44', muted: '#7a7a72',
    faint: '#c4c4bc',
    line: 'rgba(0,0,0,0.08)', lineStrong: 'rgba(0,0,0,0.14)',
    pill: 'rgba(0,0,0,0.05)', success: '#4a6b3a',
  },
  dark: {
    bg: '#1c1a16', surface: '#252219', panel: '#2f2c24',
    ink: '#ede5cf', inkSoft: '#bdb49a', muted: '#8a8270',
    faint: '#52493a',
    line: 'rgba(237,229,207,0.14)', lineStrong: 'rgba(237,229,207,0.26)',
    pill: 'rgba(237,229,207,0.07)', success: '#7ab860',
  },
} as const;

// ─── ACCENT SYSTEM ───────────────────────────────────────────────────────────

type AccentTone = { base: string; soft: string; tint: string };

const ACCENT_PRESETS: Record<string, { label: string; light: AccentTone; dark: AccentTone }> = {
  ink:     { label: '墨藍', light: { base: '#1e3a5f', soft: '#3a5d8a', tint: 'rgba(30,58,95,0.10)'    }, dark: { base: '#7aafd4', soft: '#9dc3e0', tint: 'rgba(122,175,212,0.16)' } },
  pine:    { label: '松綠', light: { base: '#2d5a3d', soft: '#4a8060', tint: 'rgba(45,90,61,0.10)'    }, dark: { base: '#6ab88a', soft: '#8ecba6', tint: 'rgba(106,184,138,0.16)' } },
  crimson: { label: '暗紅', light: { base: '#7a1e35', soft: '#9f3652', tint: 'rgba(122,30,53,0.10)'   }, dark: { base: '#d47a8f', soft: '#e09aaa', tint: 'rgba(212,122,143,0.16)' } },
  umber:   { label: '赭褐', light: { base: '#7a4020', soft: '#a05c35', tint: 'rgba(122,64,32,0.10)'   }, dark: { base: '#d4956b', soft: '#e0aa87', tint: 'rgba(212,149,107,0.16)' } },
  violet:  { label: '紫墨', light: { base: '#3d2060', soft: '#60418a', tint: 'rgba(61,32,96,0.10)'    }, dark: { base: '#9d7dd4', soft: '#b89de0', tint: 'rgba(157,125,212,0.16)' } },
};

const A_DEFAULT: AccentTone = ACCENT_PRESETS.ink.light;

const FONT_STYLE_PRESETS: Record<string, { label: string; family: string; weight: number }> = {
  'serif':      { label: '明體',   family: "'Noto Serif TC', serif",    weight: 400 },
  'serif-bold': { label: '明體·粗', family: "'Noto Serif TC', serif",    weight: 700 },
  'sans':       { label: '黑體',   family: "'Noto Sans TC', sans-serif", weight: 400 },
  'sans-bold':  { label: '黑體·粗', family: "'Noto Sans TC', sans-serif", weight: 600 },
};

function getAccent(key: string, theme: Theme): AccentTone {
  const preset = ACCENT_PRESETS[key] ?? ACCENT_PRESETS.ink;
  return theme === 'dark' ? preset.dark : preset.light;
}

const F = {
  serif: `"Noto Serif TC","Source Han Serif TC",Georgia,"Times New Roman",serif`,
  sans:  `"Noto Sans TC","PingFang TC","Heiti TC",ui-sans-serif,system-ui,sans-serif`,
  label: `"Inter",ui-sans-serif,system-ui,sans-serif`,
};

const PAPER_NOISE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
)}`;

// ─── STYLE HELPERS ───────────────────────────────────────────────────────────

function iconBtn(t: TK): React.CSSProperties {
  return {
    appearance: 'none', border: 'none', cursor: 'pointer',
    background: 'transparent', color: t.muted,
    width: 26, height: 26, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };
}

function modeBtn(active: boolean, t: TK): React.CSSProperties {
  return {
    appearance: 'none', border: 'none', cursor: 'pointer',
    padding: '5px 8px', borderRadius: 6,
    background: active ? t.surface : 'transparent',
    color: active ? t.ink : t.muted,
    boxShadow: active ? `0 1px 0 ${t.line}` : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .12s ease',
  };
}

function navBtn(filled: boolean, t: TK, accent: AccentTone = A_DEFAULT): React.CSSProperties {
  return {
    appearance: 'none', cursor: 'pointer',
    padding: '10px 18px', borderRadius: 8,
    border: filled ? 'none' : `1px solid ${t.line}`,
    background: filled ? accent.tint : 'transparent',
    color: filled ? accent.base : t.inkSoft,
    fontFamily: F.sans, fontSize: 13, fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    letterSpacing: '0.01em',
    transition: 'all .12s ease',
  };
}

// ─── VERSE TEXT ──────────────────────────────────────────────────────────────

const VerseText: React.FC<{ text: string; theme: Theme; accent?: AccentTone }> = ({ text, theme, accent = A_DEFAULT }) => {
  if (text.trim() === 'a') {
    return <span style={{ opacity: 0.3, fontStyle: 'italic', fontSize: '0.8em' }}>[併入上節]</span>;
  }

  const renderContent = (content: string) => {
    if (/<[a-z][\s\S]*?>/i.test(content)) {
      return <span dangerouslySetInnerHTML={{ __html: content }} />;
    }
    return content;
  };

  const parts = text.split(/(<h2[\s\S]*?<\/h2>|<h3[\s\S]*?<\/h3>|<subheading[\s\S]*?<\/subheading>|<u[\s\S]*?<\/u>|<br\s*\/?>)/gi);
  const t = T[theme];

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^<h2/i.test(part)) {
          const content = part.replace(/<\/?h2>/gi, '').trim();
          return (
            <h2 key={i} style={{
              display: 'block', fontSize: '1.2em', fontWeight: 700,
              marginBottom: '0.5em', marginTop: '0.3em',
              color: accent.base, letterSpacing: '-0.01em',
            }}>{renderContent(content)}</h2>
          );
        }
        if (/^<h3/i.test(part)) {
          const content = part.replace(/<\/?h3>/gi, '').trim();
          return (
            <h3 key={i} style={{
              display: 'block', fontSize: '1.1em', fontWeight: 600,
              marginBottom: '0.4em', marginTop: '0.2em', color: accent.soft,
            }}>{renderContent(content)}</h3>
          );
        }
        if (/^<subheading/i.test(part)) {
          const content = part.replace(/<\/?subheading>/gi, '').trim();
          return (
            <h4 key={i} style={{
              display: 'block', fontSize: '1em', fontWeight: 600,
              marginBottom: '0.3em', marginTop: '0.1em', color: t.inkSoft,
            }}>{renderContent(content)}</h4>
          );
        }
        if (/^<u/i.test(part)) {
          const content = part.replace(/<\/?u>/gi, '').trim();
          return <u key={i} style={{ textDecorationColor: 'rgba(0,0,0,0.3)', textUnderlineOffset: 3 }}>{renderContent(content)}</u>;
        }
        if (/^<br/i.test(part)) return <br key={i} />;

        const prevPart = i > 0 ? parts[i - 1] : null;
        const isAfterHeader = prevPart && (/^<h[23]/i.test(prevPart) || /^<subheading/i.test(prevPart));
        const displayPart = isAfterHeader ? part.replace(/^\s+/, '') : part;

        if (/<[a-z][\s\S]*?>/i.test(displayPart)) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: displayPart }} />;
        }
        return <span key={i}>{displayPart}</span>;
      })}
    </>
  );
};

// ─── BOOK PAGE VERSES ────────────────────────────────────────────────────────

// Split leading h2/h3/subheading tags from verse text so drop-cap lands on
// the first real character, not on a `<`.
function splitLeadingHeaders(text: string): { headers: string[]; body: string } {
  const re = /^(<(?:h2|h3|subheading)[^>]*>[\s\S]*?<\/(?:h2|h3|subheading)>)\s*/i;
  const headers: string[] = [];
  let rest = text;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    headers.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  return { headers, body: rest };
}

const BookPageVerses: React.FC<{
  verses: BibleVerse[];
  theme: Theme;
  fontSize: number;
  lineHeight: number;
  accent?: AccentTone;
  fontStyle?: string;
}> = ({ verses, theme, fontSize, lineHeight, accent = A_DEFAULT, fontStyle = 'serif' }) => {
  const t: TK = T[theme];
  const vF = FONT_STYLE_PRESETS[fontStyle] ?? FONT_STYLE_PRESETS.serif;
  const baseSize = fontSize + 1;
  const sup: React.CSSProperties = {
    fontFamily: F.label, fontSize: 10, fontWeight: 600,
    color: accent.base, marginRight: 3, marginLeft: 2,
    verticalAlign: 'super', letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
  };

  if (!verses.length) return null;

  // Build segments: alternate between header blocks and verse runs so that
  // headers embedded inside verse text are rendered as block elements, not
  // dropped into an inline <p> context.
  type VerseEntry = { verse: number; text: string };
  type Seg = { type: 'header'; html: string } | { type: 'run'; items: VerseEntry[] };

  const segments: Seg[] = [];
  let currentRun: VerseEntry[] = [];

  for (const v of verses) {
    const { headers, body } = splitLeadingHeaders(v.text);
    if (headers.length > 0) {
      if (currentRun.length > 0) { segments.push({ type: 'run', items: currentRun }); currentRun = []; }
      for (const h of headers) segments.push({ type: 'header', html: h });
      if (body.trim()) currentRun.push({ verse: v.verse, text: body });
    } else {
      currentRun.push({ verse: v.verse, text: v.text });
    }
  }
  if (currentRun.length > 0) segments.push({ type: 'run', items: currentRun });

  const firstRunIdx = segments.findIndex(s => s.type === 'run');

  return (
    <div style={{
      fontFamily: vF.family, fontWeight: vF.weight, fontSize: baseSize,
      lineHeight: lineHeight + 0.05, color: t.ink,
      textAlign: 'justify', hyphens: 'auto',
    }}>
      {segments.map((seg, si) => {
        if (seg.type === 'header') {
          return (
            <div key={si} style={{ marginBottom: '0.5em', marginTop: si > 0 ? '1em' : 0, clear: 'both' }}>
              <VerseText text={seg.html} theme={theme} accent={accent} />
            </div>
          );
        }

        const applyDropCap = si === firstRunIdx;
        const first = seg.items[0];
        const rest = seg.items.slice(1);
        const dropChar = applyDropCap ? (first.text[0] ?? '') : '';
        const firstBody = applyDropCap ? first.text.slice(1) : first.text;

        return (
          <p key={si} style={{ margin: '0 0 1.2em', clear: si > 0 ? 'both' : undefined }}>
            {applyDropCap && dropChar && (
              <span style={{
                float: 'left', fontFamily: vF.family,
                fontSize: baseSize * 4, lineHeight: 0.88,
                color: accent.base, fontWeight: 600,
                marginRight: 12, marginTop: 6, letterSpacing: '-0.02em',
              }}>{dropChar}</span>
            )}
            <sup style={sup}>{first.verse}</sup>
            <VerseText text={firstBody} theme={theme} accent={accent} />{' '}
            {rest.map(v => (
              <React.Fragment key={v.verse}>
                <sup style={sup}>{v.verse}</sup>
                <VerseText text={v.text} theme={theme} accent={accent} />{' '}
              </React.Fragment>
            ))}
          </p>
        );
      })}

      <div style={{ marginTop: 32, textAlign: 'center', color: t.faint, fontSize: 20, clear: 'both' }}>❦</div>
    </div>
  );
};

// ─── ACCENT SWATCHES ─────────────────────────────────────────────────────────

const AccentSwatches: React.FC<{
  current: string; theme: Theme; size?: number; gap?: number;
  onChange: (key: string) => void;
}> = ({ current, theme, size = 28, gap = 8, onChange }) => (
  <div style={{ display: 'flex', gap }}>
    {Object.entries(ACCENT_PRESETS).map(([key, preset]) => {
      const col = theme === 'dark' ? preset.dark.base : preset.light.base;
      const isSel = current === key;
      return (
        <button key={key} onClick={() => onChange(key)} title={preset.label} style={{
          appearance: 'none', cursor: 'pointer', padding: 0,
          width: size, height: size, borderRadius: '50%', background: col,
          border: `${size <= 28 ? 2.5 : 3}px solid ${isSel ? col : 'transparent'}`,
          outline: isSel ? `2px solid ${theme === 'dark' ? '#252219' : theme === 'sepia' ? '#fbf5e6' : '#ffffff'}` : 'none',
          outlineOffset: -Math.round(size * 0.14),
          transition: 'outline .12s ease',
        }} />
      );
    })}
  </div>
);

// ─── SEARCH PANEL ────────────────────────────────────────────────────────────

const SearchPanel: React.FC<{
  theme: TK;
  accent: AccentTone;
  primaryVersion: string;
  columns?: 3 | 4;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSelect: (book: string, chapter: number) => void;
}> = ({ theme, accent, primaryVersion, columns = 4, inputRef, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await searchBible(query.trim(), primaryVersion, controller.signal);
        if (!controller.signal.aborted) setResults(r);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [query, primaryVersion]);

  const chapterCount = selectedBook ? (BIBLE_CHAPTER_COUNTS[BIBLE_BOOKS[selectedBook] ?? ''] ?? 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: theme.pill }}>
        <Search size={14} style={{ color: theme.muted, flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedBook(null); }}
          placeholder="關鍵字搜尋…"
          style={{ appearance: 'none', border: 'none', outline: 'none', background: 'transparent', color: theme.ink, fontFamily: F.sans, fontSize: 14, flex: 1, minWidth: 0 }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.muted, padding: 0, display: 'flex', alignItems: 'center' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {query && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {searchLoading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: F.label, fontSize: 12, color: theme.muted }}>搜尋中…</div>
          ) : results.length > 0 ? (
            <>
              <div style={{ fontFamily: F.label, fontSize: 10, color: theme.muted, padding: '2px 2px 4px', letterSpacing: '0.06em' }}>
                搜尋結果 · {results.length} 節
              </div>
              {results.map((r) => (
                <button key={`${r.bookCode}-${r.chapter}-${r.verse}`} onClick={() => onSelect(r.bookCode, r.chapter)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: theme.surface, textAlign: 'left', padding: '8px 10px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                  <span style={{ fontFamily: F.label, fontSize: 11, fontWeight: 600, color: accent.base }}>{r.bookZh} {r.chapter}:{r.verse}</span>
                  <span style={{ fontFamily: F.serif, fontSize: 12, color: theme.inkSoft, lineHeight: 1.5 }}>{r.text.replace(/<[^>]+>/g, '').slice(0, 70)}</span>
                </button>
              ))}
            </>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: F.label, fontSize: 12, color: theme.faint }}>無結果</div>
          )}
        </div>
      )}

      {!query && selectedBook && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setSelectedBook(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', padding: 0, color: theme.muted }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: theme.ink }}>{selectedBook}</span>
            <span style={{ fontFamily: F.label, fontSize: 11, color: theme.muted }}>{chapterCount} 章</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map(ch => (
              <button key={ch} onClick={() => onSelect(BIBLE_BOOKS[selectedBook] ?? selectedBook, ch)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: theme.pill, color: theme.ink, fontFamily: F.label, fontSize: 12, padding: '6px 0', borderRadius: 6, textAlign: 'center' }}>
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {!query && !selectedBook && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[{ label: '舊約', books: OT_BOOK_NAMES }, { label: '新約', books: NT_BOOK_NAMES }].map(({ label, books }) => (
            <div key={label}>
              <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 4 }}>
                {books.map(book => (
                  <button key={book} onClick={() => setSelectedBook(book)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: theme.pill, color: theme.ink, fontFamily: F.sans, fontSize: 11, padding: '6px 4px', borderRadius: 6, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                    {book}
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

// ─── SCROLL BAR OVERLAY ──────────────────────────────────────────────────────
const ScrollBarOverlay: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement | null>;
  theme: TK;
}> = ({ scrollRef, theme }) => {
  const [visible, setVisible] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [thumbRatio, setThumbRatio] = useState(1);
  const [thumbOffset, setThumbOffset] = useState(0);
  const [trackH, setTrackH] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
      const denom = scrollHeight - clientHeight;
      setThumbOffset(denom > 0 ? scrollTop / denom : 0);
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

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    setTrackH(track.clientHeight);
    const ro = new ResizeObserver(() => setTrackH(track.clientHeight));
    ro.observe(track);
    return () => ro.disconnect();
  }, [canScroll]);

  if (!canScroll) return null;

  const thumbH = trackH > 0 ? Math.max(24, thumbRatio * trackH) : 24;
  const thumbTop = trackH > 0 ? thumbOffset * (trackH - thumbH) : 0;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!scrollRef.current) return;
    dragState.current = { startY: e.clientY, startScrollTop: scrollRef.current.scrollTop };
    clearTimeout(hideTimer.current);
  };
  const onDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTop = dragState.current.startScrollTop +
      (e.clientY - dragState.current.startY) * (el.scrollHeight - el.clientHeight) / (trackH - thumbH);
  };
  const endDrag = () => {
    dragState.current = null;
    hideTimer.current = setTimeout(() => setVisible(false), 2000);
  };

  const navBtnStyle: React.CSSProperties = {
    appearance: 'none', border: 'none', cursor: 'pointer', padding: 0,
    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
    background: theme.surface, color: theme.ink, opacity: 0.85,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        style={navBtnStyle}
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
          onPointerCancel={endDrag}
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
        style={navBtnStyle}
      >
        <ChevronDown size={12} />
      </button>
    </div>
  );
};

// ─── SCROLLABLE PANE ─────────────────────────────────────────────────────────
const ScrollablePane: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement | null>;
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

// ─── APP ─────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>({
    scheduleText: "馬太福音 1-3\n詩篇 1",
    dailyScheduleJson: JSON.stringify(DEFAULT_DAILY_SCHEDULE, null, 2),
    scheduleMode: 'daily',
    completedTasks: [],
    fontSize: 18,
    lineHeight: 1.75,
    theme: 'sepia',
    accent: 'ink',
    primaryVersion: 'unv',
    secondaryVersion: null,
    scheduleHash: "",
    fontStyle: 'serif',
    syncId: null,
    deviceId: '',
    lastSyncedAt: null,
  });

  const [migrationInput, setMigrationInput] = useState('');
  const [availableVersions] = useState<VersionInfo[]>(FALLBACK_VERSIONS);
  const [showVersionPicker, setShowVersionPicker] = useState<{ active: boolean; target: 'primary' | 'secondary' }>({ active: false, target: 'primary' });
  const [versionSearch, setVersionSearch] = useState('');
  const [bibleData, setBibleData] = useState<BibleData | null>(null);
  const [parallelData, setParallelData] = useState<BibleVerse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Layout & UI state
  const [railOpen, setRailOpen] = useState(true);
  const [railSearchOpen, setRailSearchOpen] = useState(false);
  const [readingMode, setReadingMode] = useState<'standard' | 'book'>('standard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(true);
  const [currentScheduleItemId, setCurrentScheduleItemId] = useState<string | null>(null);
  const [showImportField, setShowImportField] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileSheet, setMobileSheet] = useState<'plan' | 'calendar' | 'menu' | 'search' | null>(null);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [showKeymapHelp, setShowKeymapHelp] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [syncError, setSyncError] = useState('');
  const [syncShowQr, setSyncShowQr] = useState(false);
  const [syncShowIdInput, setSyncShowIdInput] = useState(false);
  const [syncIdInput, setSyncIdInput] = useState('');

  // Refs
  const settingsRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const searchPanelInputRef = useRef<HTMLInputElement>(null);
  const keymapModalRef = useRef<HTMLDivElement>(null);
  const selectedDateRef = useRef<string>('');
  const goToTodayRef = useRef<() => void>(() => {});
  const goToFirstUnfinishedRef = useRef<() => void>(() => {});
  const goToNextDayRef = useRef<() => void>(() => {});
  const markCurrentAsReadRef = useRef<() => void>(() => {});
  const cycleThemeRef = useRef<() => void>(() => {});
  const handleDayClickRef      = useRef<(dateKey: string) => void>(() => {});
  const goToPrevDayRef         = useRef<() => void>(() => {});
  const goToNextItemRef        = useRef<() => void>(() => {});
  const goToPrevItemRef        = useRef<() => void>(() => {});
  const toggleReadingModeRef   = useRef<() => void>(() => {});

  const PLAN_YEAR = 2026;

  const [currentViewDate, setCurrentViewDate] = useState(() => {
    const today = new Date();
    if (today.getFullYear() !== PLAN_YEAR) return new Date(PLAN_YEAR, 0, 1);
    return today;
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const target = today.getFullYear() === PLAN_YEAR ? today : new Date(PLAN_YEAR, 0, 1);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const pendingG = { current: false };

    const navigateDay = (delta: number) => {
      const [yr, mo, dy] = selectedDateRef.current.split('-').map(Number);
      const d = new Date(yr, mo - 1, dy);
      d.setDate(d.getDate() + delta);
      setCurrentViewDate(d);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      handleDayClickRef.current(iso);
    };

    const pendingDigits = { current: '' };
    const scrollTarget = { current: 0 };
    const scrollAnimating = { current: false };
    const animateScroll = () => {
      const el = mainScrollRef.current;
      if (!el) { scrollAnimating.current = false; return; }
      const diff = scrollTarget.current - el.scrollTop;
      if (Math.abs(diff) < 0.5) {
        el.scrollTop = scrollTarget.current;
        scrollAnimating.current = false;
        return;
      }
      el.scrollTop += diff * 0.15;
      requestAnimationFrame(animateScroll);
    };
    const smoothScrollTo = (top: number) => {
      const el = mainScrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      scrollTarget.current = Math.max(0, Math.min(max, top));
      if (!scrollAnimating.current) {
        scrollAnimating.current = true;
        requestAnimationFrame(animateScroll);
      }
    };
    const jumpToVerse = (verseNum: number) => {
      const container = mainScrollRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-verse="${verseNum}"]`) as HTMLElement | null;
      if (!el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      smoothScrollTo(elRect.top - containerRect.top + container.scrollTop - 60);
    };
    const smoothScrollBy = (delta: number) => {
      const el = mainScrollRef.current;
      if (!el) return;
      if (!scrollAnimating.current) scrollTarget.current = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      const cap = el.clientHeight * 0.8;
      const raw = scrollTarget.current + delta;
      scrollTarget.current = Math.max(
        el.scrollTop - cap,
        Math.min(el.scrollTop + cap, Math.max(0, Math.min(max, raw)))
      );
      if (!scrollAnimating.current) {
        scrollAnimating.current = true;
        requestAnimationFrame(animateScroll);
      }
    };

    const handler = (e: KeyboardEvent) => {
      const isInInput =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable);

      if (e.key === 'Escape') {
        pendingG.current = false;
        pendingDigits.current = '';
        setRailSearchOpen(false);
        setSettingsOpen(false);
        setMobileSheet(null);
        setShowKeymapHelp(false);
        return;
      }

      if (isInInput) return;

      if (pendingDigits.current) {
        if (e.key >= '0' && e.key <= '9') { pendingDigits.current += e.key; return; }
        const n = parseInt(pendingDigits.current, 10);
        pendingDigits.current = '';
        jumpToVerse(n);
        if (e.key === 'Enter') return;
        // fall through to also handle the triggering key
      }

      if (pendingG.current) {
        pendingG.current = false;
        if (e.key === 'u') { goToFirstUnfinishedRef.current(); return; }
        if (e.key === 'h') { navigateDay(-1); return; }
        if (e.key === 'l') { navigateDay(1); return; }
        if (e.key === 'g') { smoothScrollTo(0); return; }
        if (e.key >= '1' && e.key <= '9') { pendingDigits.current = e.key; return; }
        // unrecognised second key — fall through to handle it normally
      }

      switch (e.key) {
        case 'g':
          pendingG.current = true;
          break;
        case 'G':
          smoothScrollTo(Number.MAX_SAFE_INTEGER);
          break;
        case '/':
          e.preventDefault();
          if (isMobile) {
            setMobileSheet(s => s === 'search' ? null : 'search');
          } else {
            setRailOpen(true);
            setRailSearchOpen(s => !s);
          }
          break;
        case '[':
          navigateDay(-1);
          break;
        case ']':
          navigateDay(1);
          break;
        case 't':
          goToTodayRef.current();
          break;
        case 'n':
          goToNextDayRef.current();
          break;
        case 'N':
          goToPrevDayRef.current();
          break;
        case 'm':
          markCurrentAsReadRef.current();
          break;
        case 's':
          if (isMobile) {
            setMobileSheet(s => s === 'menu' ? null : 'menu');
          } else {
            setSettingsOpen(prev => !prev);
          }
          break;
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
          smoothScrollBy(150);
          break;
        case 'k':
          smoothScrollBy(-150);
          break;
        case '?':
          setShowKeymapHelp(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isMobile]);

  // Defer one frame so the panel is in the DOM before attempting focus
  useEffect(() => {
    if (!railSearchOpen) return;
    const id = requestAnimationFrame(() => searchPanelInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [railSearchOpen]);

  useEffect(() => {
    if (!showKeymapHelp) return;
    const id = requestAnimationFrame(() => keymapModalRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [showKeymapHelp]);

  useEffect(() => {
    if (!loading && bibleData) {
      const timer = setTimeout(() => {
        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, bibleData, bibleData?.reference]);

  useEffect(() => {
    const saved = localStorage.getItem('bible_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validIds = FALLBACK_VERSIONS.map(v => v.id);
        if (parsed.primaryVersion && !validIds.includes(parsed.primaryVersion)) parsed.primaryVersion = 'unv';
        if (parsed.secondaryVersion && !validIds.includes(parsed.secondaryVersion)) parsed.secondaryVersion = null;
        if (parsed.dailyScheduleJson) {
          parsed.dailyScheduleJson = migrateScheduleJson(parsed.dailyScheduleJson, 2026);
        }
        if ((parsed.completedTasks ?? []).some((id: string) => !/^\d{4}-\d{2}-\d{2}:/.test(id))) {
          let schedule: Record<string, string>;
          try {
            schedule = parsed.dailyScheduleJson ? JSON.parse(parsed.dailyScheduleJson) : DEFAULT_DAILY_SCHEDULE;
          } catch {
            schedule = DEFAULT_DAILY_SCHEDULE;
          }
          parsed.completedTasks = migrateCompletedTasks(parsed.completedTasks ?? [], schedule);
        }
        setSettings(prev => {
          const next = { ...prev, ...parsed };
          if (!next.deviceId) next.deviceId = crypto.randomUUID();
          localStorage.setItem('bible_settings', JSON.stringify(next));
          return next;
        });
      } catch {
        console.error('Failed to load settings');
      }
    }
    setSettings(prev => {
      if (prev.deviceId) return prev;
      const next = { ...prev, deviceId: crypto.randomUUID() };
      localStorage.setItem('bible_settings', JSON.stringify(next));
      return next;
    });
    setSettingsInitialized(true);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [settingsOpen]);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Scroll the import field into view when it appears in the mobile settings sheet.
  useEffect(() => {
    if (showImportField) {
      const t = setTimeout(() => importInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      return () => clearTimeout(t);
    }
  }, [showImportField]);

  // Auto-open today's first unfinished reading on page load.
  // Fires once after settings are loaded from localStorage (or immediately
  // for first-time visitors using default settings).
  useEffect(() => {
    if (!settingsInitialized) return;
    if (settings.scheduleMode !== 'daily') return;
    const now = new Date();
    if (now.getFullYear() !== PLAN_YEAR) return;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const plan = getDayPlan(today, settings.dailyScheduleJson);
    if (!plan.length) return;
    const target = plan.find((item: ScheduleItem) => !settings.completedTasks.includes(item.id)) ?? plan[0];
    fetchBible({ book: target.book, chapter: target.chapter, startVerse: target.startVerse, endVerse: target.endVerse, label: target.label, scheduleItemId: target.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsInitialized]);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const saveSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    localStorage.setItem('bible_settings', JSON.stringify(s));
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    saveSettings(updated);
    return updated;
  };

  const clearSecondaryVersion = () => {
    updateSetting('secondaryVersion', null);
    setParallelData(null);
  };

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'sepia', 'dark'];
    updateSetting('theme', order[(order.indexOf(settings.theme) + 1) % 3]);
  };

  const handleEnableSync = useCallback(() => {
    const id = crypto.randomUUID();
    setSettings(prev => {
      const next = { ...prev, syncId: id };
      localStorage.setItem('bible_settings', JSON.stringify(next));
      return next;
    });
    showToast('同步已啟用');
  }, []);

  const handleDisableSync = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, syncId: null };
      localStorage.setItem('bible_settings', JSON.stringify(next));
      return next;
    });
    setSyncStatus('idle');
    setSyncError('');
    setSyncShowQr(false);
    showToast('同步已停用');
  }, []);

  const handlePull = useCallback(async (syncId: string) => {
    setSyncStatus('syncing');
    setSyncError('');
    try {
      const { mergedTasks, needsReconciliation } = await pullSync(
        syncId, settings.deviceId, settings.completedTasks, WORKER_URL
      );
      const now = new Date().toISOString();
      setSettings(prev => {
        const next = { ...prev, completedTasks: mergedTasks, lastSyncedAt: now };
        localStorage.setItem('bible_settings', JSON.stringify(next));
        return next;
      });
      if (needsReconciliation) {
        await pushSync(syncId, settings.deviceId, mergedTasks, WORKER_URL);
        const reconciledAt = new Date().toISOString();
        setSettings(prev => {
          const next = { ...prev, lastSyncedAt: reconciledAt };
          localStorage.setItem('bible_settings', JSON.stringify(next));
          return next;
        });
      }
      setSyncStatus('idle');
      showToast('拉取完成');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : '同步失敗');
    }
  }, [settings.deviceId, settings.completedTasks]);

  const handlePush = useCallback(async () => {
    if (!settings.syncId) return;
    setSyncStatus('syncing');
    setSyncError('');
    try {
      const mergedTasks = await pushSync(
        settings.syncId, settings.deviceId, settings.completedTasks, WORKER_URL
      );
      const now = new Date().toISOString();
      setSettings(prev => {
        const next = { ...prev, completedTasks: mergedTasks, lastSyncedAt: now };
        localStorage.setItem('bible_settings', JSON.stringify(next));
        return next;
      });
      setSyncStatus('idle');
      showToast('推送完成');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : '同步失敗');
    }
  }, [settings.syncId, settings.deviceId, settings.completedTasks]);

  const handleImportSyncId = useCallback((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(trimmed)) { showToast('無效的同步 ID', 'error'); return; }
    updateSetting('syncId', trimmed);
    setSyncShowIdInput(false);
    setSyncIdInput('');
    handlePull(trimmed);
  }, [handlePull]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (message: string, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  // ── Memos ──────────────────────────────────────────────────────────────────

  const parsedSchedule = useMemo(() => {
    if (settings.scheduleMode === 'static') {
      return settings.scheduleText.split('\n').filter(l => l.trim()).flatMap(parseScheduleLine);
    }
    return getDayPlan(selectedDate, settings.dailyScheduleJson);
  }, [settings.scheduleMode, settings.scheduleText, selectedDate, settings.dailyScheduleJson]);

  const navStatus = useMemo(() => {
    if (!bibleData) return { inPlan: false, nextItem: null, prevItem: null, currentItemId: null };
    const currentBaseId = `${bibleData.bookCode}${bibleData.chapter}`;
    const currentFullId = buildVerseId(bibleData.bookCode, bibleData.chapter, bibleData.startVerse, bibleData.endVerse);
    const todayFullId = `${selectedDate}:${currentFullId}`;
    const todayBaseId = `${selectedDate}:${currentBaseId}`;
    const idToSearch = currentScheduleItemId || todayFullId;

    let idx = (parsedSchedule as ScheduleItem[]).findIndex(item => item.id === idToSearch);
    if (idx === -1 && !currentScheduleItemId) {
      idx = (parsedSchedule as ScheduleItem[]).findIndex(item => item.id === todayBaseId);
    }
    if (idx === -1 && !currentScheduleItemId) {
      idx = (parsedSchedule as ScheduleItem[]).findIndex(item => item.id === currentFullId);
      if (idx === -1) idx = (parsedSchedule as ScheduleItem[]).findIndex(item => item.id === currentBaseId);
    }

    const current = idx !== -1 ? (parsedSchedule as ScheduleItem[])[idx] : null;
    return {
      inPlan: idx !== -1,
      nextItem: idx !== -1 && idx < parsedSchedule.length - 1 ? parsedSchedule[idx + 1] : null,
      prevItem: idx > 0 ? parsedSchedule[idx - 1] : null,
      currentItemId: current ? current.id : null,
    };
  }, [bibleData, parsedSchedule, currentScheduleItemId, selectedDate]);

  const nextDayWithPlan = useMemo(() => {
    if (settings.scheduleMode !== 'daily') return null;
    try {
      const schedule = JSON.parse(settings.dailyScheduleJson);
      const yearPrefix = String(PLAN_YEAR) + '-';
      const dates = Object.keys(schedule).filter(k => k.startsWith(yearPrefix)).sort();
      const idx = dates.indexOf(selectedDate);
      if (idx === -1) return null;
      for (let i = idx + 1; i < dates.length; i++) {
        if (schedule[dates[i]]?.trim()) return dates[i];
      }
    } catch { /* ignore */ }
    return null;
  }, [settings.scheduleMode, settings.dailyScheduleJson, selectedDate]);

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

  const calendarDays = useMemo(() => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (null | { day: number; dateKey: string; hasPlan: boolean; isFullyCompleted: boolean; progress: number })[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const dateKey = `${year}-${mm}-${dd}`;
      const plan = getDayPlan(dateKey, settings.dailyScheduleJson);
      const hasPlan = plan.length > 0;
      const completedCount = plan.filter((p: ScheduleItem) => settings.completedTasks.includes(p.id)).length;
      days.push({
        day: i, dateKey, hasPlan,
        isFullyCompleted: hasPlan && completedCount === plan.length,
        progress: hasPlan ? completedCount / plan.length : 0,
      });
    }
    return days;
  }, [currentViewDate, settings.dailyScheduleJson, settings.completedTasks]);

  const yearProgress = useMemo(() => {
    if (settings.scheduleMode !== 'daily') return null;
    try {
      const schedule = JSON.parse(settings.dailyScheduleJson);
      const yearPrefix = String(PLAN_YEAR) + '-';
      let total = 0, completed = 0;
      for (const dateKey of Object.keys(schedule).filter(k => k.startsWith(yearPrefix))) {
        const plan = getDayPlan(dateKey, settings.dailyScheduleJson);
        total += plan.length;
        completed += plan.filter((p: ScheduleItem) => settings.completedTasks.includes(p.id)).length;
      }
      return { total, completed };
    } catch {
      return null;
    }
  }, [settings.scheduleMode, settings.dailyScheduleJson, settings.completedTasks]);

  const filteredVersions = useMemo(() => {
    const s = versionSearch.toLowerCase().trim();
    return s ? availableVersions.filter(v => v.id.toLowerCase().includes(s) || v.name.toLowerCase().includes(s)) : availableVersions;
  }, [availableVersions, versionSearch]);

  const filteredVerses = useMemo(() => {
    if (!bibleData) return [];
    if (!bibleData.startVerse) return bibleData.verses;
    const start = bibleData.startVerse;
    const end = bibleData.endVerse || start;
    return bibleData.verses.filter(v => v.verse >= start && v.verse <= end);
  }, [bibleData]);

  const filteredParallel = useMemo(() => {
    if (!bibleData || !parallelData) return null;
    if (!bibleData.startVerse) return parallelData;
    const start = bibleData.startVerse;
    const end = bibleData.endVerse || start;
    return parallelData.filter(v => v.verse >= start && v.verse <= end);
  }, [bibleData, parallelData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const fetchBible = async (
    refInfo: { book: string; chapter: number; startVerse?: number; endVerse?: number; label?: string; scheduleItemId?: string } | null = null,
    customPrimary?: string,
    customSecondary?: string | null
  ) => {
    const search = refInfo;
    if (!search?.book || !search.chapter) return;

    const pVer = customPrimary || settings.primaryVersion;
    const sVer = customSecondary !== undefined ? customSecondary : settings.secondaryVersion;
    setLoading(true);
    setError('');
    const bookZh = Object.keys(BIBLE_BOOKS).find(key => BIBLE_BOOKS[key] === search?.book) || search.book;
    const qstr = `${search.book}${search.chapter}`;

    try {
      const fetchVersion = async (ver: string) => {
        const res = await fetch(`https://bible.fhl.net/json/qsb.php?qstr=${encodeURIComponent(qstr)}&version=${ver}&strong=0&gb=0`);
        const buffer = await res.arrayBuffer();
        const text = new TextDecoder('big5').decode(buffer);
        const data = JSON.parse(text);
        if (data.status !== 'success') throw new Error(`API Error: ${data.status}`);
        return data.record.map((r: { sec: number; bible_text: string }) => ({ verse: r.sec, text: r.bible_text }));
      };
      const [data1, data2] = await Promise.all([
        fetchVersion(pVer),
        sVer ? fetchVersion(sVer) : Promise.resolve(null),
      ]);
      const reference = search.label || (search.startVerse
        ? `${bookZh} ${search.chapter}:${search.startVerse}${search.endVerse && search.endVerse !== search.startVerse ? '-' + search.endVerse : ''}`
        : `${bookZh} ${search.chapter}`);
      setBibleData({ reference, bookCode: search.book, chapter: search.chapter, startVerse: search.startVerse, endVerse: search.endVerse, verses: data1 });
      setParallelData(data2);
      setCurrentScheduleItemId(refInfo?.scheduleItemId ?? null);
    } catch (err: unknown) {
      console.error(err);
      setError('讀取失敗，請檢查網路或稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    const isCompleted = settings.completedTasks.includes(id);
    updateSetting('completedTasks', isCompleted
      ? settings.completedTasks.filter(t => t !== id)
      : [...settings.completedTasks, id]
    );
  };

  const markCurrentAsRead = () => {
    if (!bibleData) return;
    const id = navStatus.currentItemId || currentScheduleItemId ||
      buildVerseId(bibleData.bookCode, bibleData.chapter, bibleData.startVerse, bibleData.endVerse);
    const wasCompleted = settings.completedTasks.includes(id);
    toggleTask(id);
    showToast(wasCompleted ? `已取消：${bibleData.reference}` : `已完成：${bibleData.reference}！`);
  };

  const handleExportProgress = () => {
    const text = JSON.stringify(settings.completedTasks);
    const fallback = () => {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(el);
      el.focus(); el.select();
      try { document.execCommand('copy'); showToast('進度代碼已複製到剪貼簿'); }
      catch { showToast('複製失敗，請手動複製進度代碼', 'error'); }
      document.body.removeChild(el);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast('進度代碼已複製到剪貼簿'),
        fallback,
      );
    } else {
      fallback();
    }
  };

  const handleImportProgress = () => {
    if (!migrationInput.trim()) return;
    try {
      const parsed = JSON.parse(migrationInput);
      if (Array.isArray(parsed)) {
        const merged = Array.from(new Set([...settings.completedTasks, ...parsed]));
        updateSetting('completedTasks', merged);
        showToast(`匯入成功！已新增 ${merged.length - settings.completedTasks.length} 條紀錄。`);
        setMigrationInput('');
        setShowImportField(false);
      } else {
        showToast('格式錯誤，請確認貼上的內容。', 'error');
      }
    } catch {
      showToast('解析失敗，請確認代碼完整性。', 'error');
    }
  };

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    const plan = getDayPlan(dateKey, settings.dailyScheduleJson);
    if (plan.length > 0) {
      const target = plan.find((item: ScheduleItem) => !settings.completedTasks.includes(item.id)) || plan[0];
      fetchBible({ book: target.book, chapter: target.chapter, startVerse: target.startVerse, endVerse: target.endVerse, label: target.label, scheduleItemId: target.id });
    }
  };

  const goToTodayInPlan = () => {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setCurrentViewDate(today);
    handleDayClick(dateKey);
  };

  const goToFirstUnfinished = () => {
    try {
      const schedule = JSON.parse(settings.dailyScheduleJson);
      const yearPrefix = String(PLAN_YEAR) + '-';
      const dates = Object.keys(schedule).filter(k => k.startsWith(yearPrefix)).sort();
      for (const dateKey of dates) {
        const plan = getDayPlan(dateKey, settings.dailyScheduleJson);
        if (plan.some((item: ScheduleItem) => !settings.completedTasks.includes(item.id))) {
          const [y, m, d] = dateKey.split('-').map(Number);
          setCurrentViewDate(new Date(y, m - 1, d));
          handleDayClick(dateKey);
          return;
        }
      }
      showToast('本年度讀經計劃已全部完成！');
    } catch { /* ignore */ }
  };

  const goToNextDay = () => {
    if (!nextDayWithPlan) return;
    const [y, m, d] = nextDayWithPlan.split('-').map(Number);
    setCurrentViewDate(new Date(y, m - 1, d));
    handleDayClick(nextDayWithPlan);
  };

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

  // Keep action refs current so the keymap handler always calls the latest closures
  selectedDateRef.current = selectedDate;
  goToTodayRef.current = goToTodayInPlan;
  goToFirstUnfinishedRef.current = goToFirstUnfinished;
  goToNextDayRef.current = goToNextDay;
  markCurrentAsReadRef.current = markCurrentAsRead;
  cycleThemeRef.current = cycleTheme;
  handleDayClickRef.current    = handleDayClick;
  goToPrevDayRef.current       = goToPrevDay;
  goToNextItemRef.current      = goToNextItem;
  goToPrevItemRef.current      = goToPrevItem;
  toggleReadingModeRef.current = toggleReadingMode;

  // ── Derived ────────────────────────────────────────────────────────────────

  const theme = T[settings.theme];
  const A = getAccent(settings.accent ?? 'ink', settings.theme);
  const vF = FONT_STYLE_PRESETS[settings.fontStyle ?? 'serif'] ?? FONT_STYLE_PRESETS.serif;
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0-dev';

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // ── SyncSection ────────────────────────────────────────────────────────────

  const SyncSection: React.FC = () => {
    const labelStyle: React.CSSProperties = {
      fontFamily: F.label, fontSize: 9, fontWeight: 600,
      letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.muted,
    };
    const btnPrimary: React.CSSProperties = {
      flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
      padding: '7px 0', borderRadius: 8, background: A.base, color: '#fff',
      fontFamily: F.label, fontSize: 11, fontWeight: 600,
    };
    const btnOutline: React.CSSProperties = {
      flex: 1, appearance: 'none', border: `1px solid ${theme.lineStrong}`,
      cursor: 'pointer', padding: '7px 0', borderRadius: 8,
      background: 'transparent', color: theme.ink, fontFamily: F.label, fontSize: 11,
    };

    if (!settings.syncId) {
      return (
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>裝置同步</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleEnableSync} style={btnPrimary}>啟用同步</button>
            <button
              onClick={() => setSyncShowIdInput(s => !s)}
              style={btnOutline}
            >輸入現有 ID</button>
          </div>
          {syncShowIdInput && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="貼上同步 ID…"
                value={syncIdInput}
                onChange={e => setSyncIdInput(e.target.value)}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8,
                  border: `1px solid ${theme.lineStrong}`, background: theme.bg,
                  color: theme.ink, fontFamily: 'ui-monospace, monospace',
                  fontSize: 11, outline: 'none',
                }}
              />
              <button
                onClick={() => handleImportSyncId(syncIdInput)}
                disabled={!syncIdInput.trim()}
                style={{
                  ...btnPrimary, flex: 'none', padding: '7px 14px',
                  opacity: syncIdInput.trim() ? 1 : 0.4,
                  cursor: syncIdInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >確認</button>
            </div>
          )}
        </div>
      );
    }

    const lastSync = settings.lastSyncedAt
      ? new Date(settings.lastSyncedAt).toLocaleString('zh-TW', {
          month: 'numeric', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '從未';
    const isSyncing = syncStatus === 'syncing';

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={labelStyle}>裝置同步</span>
          <span style={{ fontFamily: F.label, fontSize: 10, color: A.base, fontWeight: 600 }}>● 已啟用</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10, color: theme.ink,
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {settings.syncId}
          </span>
          <button
            onClick={() => void navigator.clipboard.writeText(settings.syncId!).then(() => showToast('已複製')).catch(() => showToast('複製失敗'))}
            style={{ appearance: 'none', border: `1px solid ${theme.lineStrong}`, cursor: 'pointer', padding: '3px 8px', borderRadius: 6, background: 'transparent', color: theme.muted, fontFamily: F.label, fontSize: 10 }}
          >複製</button>
          <button
            onClick={() => setSyncShowQr(s => !s)}
            style={{ appearance: 'none', border: `1px solid ${theme.lineStrong}`, cursor: 'pointer', padding: '3px 8px', borderRadius: 6, background: syncShowQr ? theme.pill : 'transparent', color: theme.muted, fontFamily: F.label, fontSize: 10 }}
          >QR</button>
        </div>
        {syncShowQr && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <QRCodeSVG value={settings.syncId!} size={120} bgColor={theme.surface} fgColor={theme.ink} />
          </div>
        )}
        <div style={{ fontFamily: F.label, fontSize: 10, color: theme.faint, marginBottom: 8 }}>
          上次同步：{lastSync}
        </div>
        {syncStatus === 'error' && (
          <div style={{ fontFamily: F.label, fontSize: 10, color: '#c0392b', marginBottom: 6 }}>
            ⚠ {syncError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handlePush}
            disabled={isSyncing}
            style={{ ...btnPrimary, opacity: isSyncing ? 0.6 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
          >{isSyncing ? '同步中…' : '↑ 推送'}</button>
          <button
            onClick={() => handlePull(settings.syncId!)}
            disabled={isSyncing}
            style={{ ...btnOutline, opacity: isSyncing ? 0.6 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
          >↓ 拉取</button>
          <button
            onClick={handleDisableSync}
            style={{ appearance: 'none', border: `1px solid ${theme.lineStrong}`, cursor: 'pointer', padding: '7px 10px', borderRadius: 8, background: 'transparent', color: theme.muted, fontFamily: F.label, fontSize: 11 }}
          >停用</button>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: theme.bg,
      backgroundImage: settings.theme === 'sepia' ? `url("${PAPER_NOISE}")` : 'none',
      color: theme.ink,
      fontFamily: F.sans,
      overflow: 'hidden',
    }}>
      {/* Toast */}
      {toast.show && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, padding: '10px 18px', borderRadius: 999,
          background: toast.type === 'success' ? A.base : '#e11d48',
          color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: F.label, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          whiteSpace: 'nowrap',
        }}>
          {toast.type === 'success' ? <PartyPopper size={15} /> : <AlertCircle size={15} />}
          {toast.message}
        </div>
      )}

      {isMobile ? (
        /* ─── MOBILE LAYOUT ──────────────────────────────────────────────── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* Mobile top bar */}
          <div style={{
            padding: '8px 18px 10px', flexShrink: 0,
            display: 'flex', alignItems: 'center', position: 'relative',
            borderBottom: `1px solid ${theme.line}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => setMobileSheet(s => s === 'calendar' ? null : 'calendar')}
                style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="月曆"
              ><CalendarDays size={19} /></button>
              <button
                onClick={goToFirstUnfinished}
                style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="補進度"
                title="跳至最早未完成進度"
              ><BookMarked size={19} /></button>
            </div>
            <div style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              fontFamily: F.serif, fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: '-0.01em',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              2026 每日讀經
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
              <button
                onClick={cycleTheme}
                style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="切換外觀"
              >
                {settings.theme === 'dark' ? <Moon size={17} /> : settings.theme === 'sepia' ? <Coffee size={17} /> : <Sun size={17} />}
              </button>
            </div>
          </div>

          {/* Mobile reading area */}
          <ScrollablePane scrollRef={mainScrollRef} theme={theme} style={{ flex: 1 }} innerStyle={{ padding: '20px 20px 130px' }}>
            {loading ? (
              <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <BookOpen size={40} style={{ color: A.base, opacity: 0.25 }} />
                <p style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: theme.muted }}>正在開啟聖經卷軸</p>
              </div>
            ) : error ? (
              <div style={{ margin: '8px 0', padding: 16, borderRadius: 12, background: 'rgba(225,29,72,0.07)', border: '1px solid rgba(225,29,72,0.18)', color: '#e11d48', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, margin: 0 }}>{error}</p>
              </div>
            ) : bibleData ? (
              <>
                {/* Reference header */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.muted, marginBottom: 6 }}>
                    {settings.scheduleMode === 'daily' && navStatus.inPlan ? `讀經進度 · ${selectedDate.slice(5).replace('-', '月')}日` : '自由閱讀'}
                  </div>
                  <h1 style={{ fontFamily: vF.family, fontSize: 30, fontWeight: vF.weight, letterSpacing: '-0.02em', margin: 0, color: theme.ink, lineHeight: 1.15 }}>
                    {bibleData.reference}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setShowVersionPicker({ active: true, target: 'primary' })}
                        style={{ display: 'inline-flex', alignItems: 'center', fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: A.tint, color: A.base, appearance: 'none', border: 'none', cursor: 'pointer' }}
                      >{settings.primaryVersion}</button>
                      {settings.secondaryVersion ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: A.base, overflow: 'hidden' }}>
                          <button onClick={() => setShowVersionPicker({ active: true, target: 'secondary' })} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: '#fff', fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px' }}>{settings.secondaryVersion}</button>
                          <button onClick={clearSecondaryVersion} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.75)', padding: '3px 7px 3px 0', display: 'flex', alignItems: 'center' }}><X size={10} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setShowVersionPicker({ active: true, target: 'secondary' })} disabled={readingMode === 'book'} style={{ appearance: 'none', border: 'none', cursor: readingMode === 'book' ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: theme.pill, color: theme.muted, opacity: readingMode === 'book' ? 0.35 : 1 }}>+ 對照</button>
                      )}
                      <span style={{ fontFamily: F.label, fontSize: 11, color: theme.muted }}>{filteredVerses.length} 節</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: 2, borderRadius: 8, background: theme.pill }}>
                      <button onClick={() => setReadingMode('standard')} title="標準閱讀" style={modeBtn(readingMode === 'standard', theme)}><List size={13} /></button>
                      <button onClick={() => { setReadingMode('book'); if (settings.secondaryVersion) clearSecondaryVersion(); }} title="書頁模式" style={modeBtn(readingMode === 'book', theme)}><BookOpen size={13} /></button>
                    </div>
                  </div>
                </div>

                {/* Verses */}
                {readingMode === 'standard' ? (
                  <div style={{ display: 'grid', rowGap: Math.max(10, Math.round(settings.lineHeight * 14) - 4), fontFamily: vF.family, fontWeight: vF.weight, fontSize: Math.max(15, settings.fontSize - 2), lineHeight: settings.lineHeight, color: theme.ink }}>
                    {filteredVerses.map((v, i) => {
                      const pv = filteredParallel?.[i];
                      return (
                        <div key={i} data-verse={v.verse} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                          <span style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, color: A.base, minWidth: 18, textAlign: 'right', opacity: 0.7, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{v.verse}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ textAlign: 'justify' }}><VerseText text={v.text} theme={settings.theme} accent={A} /></div>
                            {pv && <div style={{ marginTop: 4, textAlign: 'justify', fontStyle: 'italic', color: theme.inkSoft, opacity: 0.75 }}><VerseText text={pv.text} theme={settings.theme} accent={A} /></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <BookPageVerses verses={filteredVerses} theme={settings.theme} fontSize={Math.max(15, settings.fontSize - 2)} lineHeight={settings.lineHeight} accent={A} fontStyle={settings.fontStyle} />
                )}

                {/* Completion + nav footer */}
                <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${theme.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  {navStatus.inPlan && (
                    <button onClick={markCurrentAsRead} style={{
                      appearance: 'none', border: 'none', cursor: 'pointer',
                      width: '100%', padding: '14px', borderRadius: 12,
                      background: (navStatus.currentItemId && settings.completedTasks.includes(navStatus.currentItemId)) ? theme.success : A.base,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      fontFamily: F.sans, fontSize: 15, fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.10)', transition: 'background .2s ease',
                    }}>
                      {(navStatus.currentItemId && settings.completedTasks.includes(navStatus.currentItemId))
                        ? <><CheckCircle2 size={18} /> 已完成 · {bibleData.reference}</>
                        : <><PartyPopper size={18} /> 讀完了</>}
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    {navStatus.inPlan ? (
                      <>
                        {navStatus.prevItem && (
                          <button onClick={() => fetchBible({ book: (navStatus.prevItem as ScheduleItem).book, chapter: (navStatus.prevItem as ScheduleItem).chapter, startVerse: (navStatus.prevItem as ScheduleItem).startVerse, endVerse: (navStatus.prevItem as ScheduleItem).endVerse, label: (navStatus.prevItem as ScheduleItem).label, scheduleItemId: (navStatus.prevItem as ScheduleItem).id })}
                            style={{ flex: 1, appearance: 'none', border: `1px solid ${theme.line}`, cursor: 'pointer', background: 'transparent', color: theme.inkSoft, padding: '10px 14px', borderRadius: 10, fontFamily: F.sans, fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <ChevronLeft size={14} /> {(navStatus.prevItem as ScheduleItem).label}
                          </button>
                        )}
                        {navStatus.nextItem && (
                          <button onClick={() => fetchBible({ book: (navStatus.nextItem as ScheduleItem).book, chapter: (navStatus.nextItem as ScheduleItem).chapter, startVerse: (navStatus.nextItem as ScheduleItem).startVerse, endVerse: (navStatus.nextItem as ScheduleItem).endVerse, label: (navStatus.nextItem as ScheduleItem).label, scheduleItemId: (navStatus.nextItem as ScheduleItem).id })}
                            style={{ flex: 1, appearance: 'none', border: 'none', cursor: 'pointer', background: A.tint, color: A.base, padding: '10px 14px', borderRadius: 10, fontFamily: F.sans, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            {(navStatus.nextItem as ScheduleItem).label} <ChevronRight size={14} />
                          </button>
                        )}
                        {!navStatus.nextItem && nextDayWithPlan && (
                          <button onClick={goToNextDay} style={{ flex: 1, appearance: 'none', border: 'none', cursor: 'pointer', background: A.tint, color: A.base, padding: '10px 14px', borderRadius: 10, fontFamily: F.sans, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            前往下一天 <CalendarDays size={13} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button onClick={() => fetchBible({ book: bibleData.bookCode, chapter: Math.max(1, bibleData.chapter - 1) })}
                          style={{ flex: 1, appearance: 'none', border: `1px solid ${theme.line}`, cursor: 'pointer', background: 'transparent', color: theme.inkSoft, padding: '10px 14px', borderRadius: 10, fontFamily: F.sans, fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <ChevronLeft size={14} /> 上一章
                        </button>
                        <button onClick={() => fetchBible({ book: bibleData.bookCode, chapter: bibleData.chapter + 1 })}
                          style={{ flex: 1, appearance: 'none', border: 'none', cursor: 'pointer', background: A.tint, color: A.base, padding: '10px 14px', borderRadius: 10, fontFamily: F.sans, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          下一章 <ChevronRight size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <BookOpen size={44} style={{ color: A.base, opacity: 0.18 }} />
                <h3 style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 600, color: theme.ink, opacity: 0.35, margin: 0, textAlign: 'center' }}>靈修從此刻開始</h3>
                <p style={{ fontFamily: F.sans, fontSize: 13, color: theme.muted, textAlign: 'center', maxWidth: 260, lineHeight: 1.65, margin: 0 }}>
                  點選下方「計劃」查看日曆，<br />或點選「搜尋」查閱章節。
                </p>
              </div>
            )}
          </ScrollablePane>

          {/* Floating bottom tab bar */}
          <div style={{
            position: 'absolute', left: 14, right: 14, bottom: 34,
            padding: '10px 12px', borderRadius: 18,
            background: settings.theme === 'dark' ? 'rgba(45,42,34,0.90)' : settings.theme === 'sepia' ? 'rgba(246,239,222,0.90)' : 'rgba(250,250,247,0.90)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: `1px solid ${theme.lineStrong}`,
            boxShadow: '0 12px 30px rgba(0,0,0,0.10)',
            display: 'flex', alignItems: 'center', gap: 4, zIndex: 30,
          }}>
            {([
              { label: '今日',  icon: <Target      size={19} strokeWidth={1.8} />, active: selectedDate === todayStr && settings.scheduleMode === 'daily', onClick: () => { setMobileSheet(null); goToTodayInPlan(); } },
              { label: '計劃',  icon: <List         size={19} strokeWidth={1.8} />, active: mobileSheet === 'plan',   onClick: () => setMobileSheet(s => s === 'plan'   ? null : 'plan')   },
              { label: '搜尋',  icon: <Search       size={19} strokeWidth={1.8} />, active: mobileSheet === 'search', onClick: () => setMobileSheet(s => s === 'search' ? null : 'search') },
              { label: '設定',  icon: <Settings     size={19} strokeWidth={1.8} />, active: mobileSheet === 'menu',   onClick: () => setMobileSheet(s => s === 'menu'   ? null : 'menu')   },
            ]).map(tab => (
              <button key={tab.label} onClick={tab.onClick} style={{
                flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
                background: tab.active ? A.base : 'transparent',
                color: tab.active ? '#fff' : theme.inkSoft,
                padding: '8px 4px', borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                fontFamily: F.label, fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                transition: 'all .12s ease',
              }}>
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Bottom sheet (plan) */}
          {mobileSheet === 'plan' && (
            <>
              <div onClick={() => setMobileSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', background: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -16px 40px rgba(0,0,0,0.15)', zIndex: 41, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
                <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: theme.faint }} />
                </div>
                <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, color: theme.ink }}>今日計劃</span>
                  <button onClick={() => setMobileSheet(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
                  <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 8 }}>今日章節</div>
                  {parsedSchedule.length > 0 ? (parsedSchedule as ScheduleItem[]).map(item => {
                    const done = settings.completedTasks.includes(item.id);
                    const isCurr = navStatus.currentItemId === item.id || (bibleData && !navStatus.currentItemId && bibleData.bookCode === item.book && bibleData.chapter === item.chapter);
                    return (
                      <div key={item.id} onClick={() => { fetchBible({ book: item.book, chapter: item.chapter, startVerse: item.startVerse, endVerse: item.endVerse, label: item.label, scheduleItemId: item.id }); setMobileSheet(null); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px', borderRadius: 10, background: isCurr ? A.tint : 'transparent', marginBottom: 4, cursor: 'pointer' }}>
                        <button onClick={e => { e.stopPropagation(); toggleTask(item.id); }} style={{ appearance: 'none', cursor: 'pointer', border: `1.5px solid ${done ? theme.success : theme.faint}`, background: done ? theme.success : 'transparent', width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, transition: 'all .12s ease' }}>
                          {done && <CheckCircle2 size={11} />}
                        </button>
                        <span style={{ flex: 1, fontFamily: F.sans, fontSize: 14, fontWeight: isCurr ? 600 : 500, color: done ? theme.muted : theme.ink, textDecoration: done ? 'line-through' : 'none', textDecorationColor: theme.faint }}>{item.label}</span>
                        {isCurr && <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 600, color: A.base, letterSpacing: '0.1em' }}>讀</span>}
                      </div>
                    );
                  }) : (
                    <div style={{ padding: '14px 0', textAlign: 'center', fontFamily: F.label, fontSize: 12, color: theme.faint, border: `1px dashed ${theme.line}`, borderRadius: 8 }}>本日無指定內容</div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Bottom sheet (calendar) */}
          {mobileSheet === 'calendar' && (
            <>
              <div onClick={() => setMobileSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', background: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -16px 40px rgba(0,0,0,0.15)', zIndex: 41, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
                <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: theme.faint }} />
                </div>
                <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, color: theme.ink }}>本月日曆</span>
                  <button onClick={() => setMobileSheet(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <button onClick={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1))} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={14} /></button>
                    <span style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 600, color: theme.ink }}>{currentViewDate.getFullYear()}年 {currentViewDate.getMonth() + 1}月</span>
                    <button onClick={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1))} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={14} /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                      <div key={d} style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, color: theme.faint, textAlign: 'center', padding: 4 }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                    {calendarDays.map((d, idx) => {
                      if (!d) return <div key={`mc${idx}`} style={{ aspectRatio: '1' }} />;
                      const isSel = d.dateKey === selectedDate;
                      const isToday = d.dateKey === todayStr;
                      return (
                        <button key={d.dateKey} onClick={() => setSelectedDate(d.dateKey)} style={{
                          appearance: 'none', border: 'none', cursor: 'pointer',
                          aspectRatio: '1', borderRadius: 8,
                          background: isSel ? A.base : 'transparent',
                          color: isSel ? '#fff' : !d.hasPlan ? theme.faint : theme.ink,
                          fontFamily: F.label, fontSize: 12, fontWeight: 500, position: 'relative',
                          boxShadow: isToday && !isSel ? `inset 0 0 0 1.5px ${A.base}` : 'none',
                          opacity: !d.hasPlan && !isSel ? 0.28 : 1,
                        }}>
                          {d.day}
                          {d.hasPlan && (() => {
                            const dotColor = isSel ? 'rgba(255,255,255,0.7)' : d.isFullyCompleted ? theme.success : d.progress > 0 ? A.soft : theme.faint;
                            return <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: dotColor }} />;
                          })()}
                        </button>
                      );
                    })}
                  </div>
                  {/* Selected day plan */}
                  <div style={{ height: 1, background: theme.line, margin: '16px 0 12px' }} />
                  {(() => {
                    const [, m, dd] = selectedDate.split('-').map(Number);
                    const dateLabel = `${m}月${dd}日${selectedDate === todayStr ? ' · 今天' : ''}`;
                    const dayItems = parsedSchedule as ScheduleItem[];
                    return (
                      <>
                        <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: theme.muted, marginBottom: 8 }}>{dateLabel}</div>
                        {dayItems.length > 0 ? dayItems.map(item => {
                          const done = settings.completedTasks.includes(item.id);
                          return (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 10, marginBottom: 2, cursor: 'pointer' }}
                              onClick={() => { fetchBible({ book: item.book, chapter: item.chapter, startVerse: item.startVerse, endVerse: item.endVerse, label: item.label, scheduleItemId: item.id }); setMobileSheet(null); }}>
                              <button onClick={e => { e.stopPropagation(); toggleTask(item.id); }} style={{ appearance: 'none', cursor: 'pointer', border: `1.5px solid ${done ? theme.success : theme.faint}`, background: done ? theme.success : 'transparent', width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, transition: 'all .12s ease' }}>
                                {done && <CheckCircle2 size={11} />}
                              </button>
                              <span style={{ flex: 1, fontFamily: F.sans, fontSize: 14, fontWeight: 500, color: done ? theme.muted : theme.ink, textDecoration: done ? 'line-through' : 'none', textDecorationColor: theme.faint }}>{item.label}</span>
                            </div>
                          );
                        }) : (
                          <div style={{ padding: '12px 0', textAlign: 'center', fontFamily: F.label, fontSize: 12, color: theme.faint, border: `1px dashed ${theme.line}`, borderRadius: 8 }}>本日無指定內容</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

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
                <div style={{ padding: '0 0 8px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: theme.faint }} />
                </div>
                <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, color: theme.ink }}>搜尋</span>
                  <button onClick={() => setMobileSheet(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} />
                  </button>
                </div>
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

          {/* Bottom sheet (menu/settings) */}
          {mobileSheet === 'menu' && (
            <>
              <div onClick={() => setMobileSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%', background: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -16px 40px rgba(0,0,0,0.15)', zIndex: 41, display: 'flex', flexDirection: 'column', paddingBottom: 28 }}>
                <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: theme.faint }} />
                </div>
                <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, color: theme.ink }}>設定</span>
                  <button onClick={() => setMobileSheet(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>
                      配色&nbsp;<span style={{ color: theme.ink, textTransform: 'none', letterSpacing: 0 }}>{ACCENT_PRESETS[settings.accent ?? 'ink']?.label}</span>
                    </div>
                    <AccentSwatches current={settings.accent ?? 'ink'} theme={settings.theme} size={34} gap={10} onChange={key => updateSetting('accent', key)} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>字體大小&nbsp;<span style={{ color: theme.ink }}>{settings.fontSize}px</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: F.serif, fontSize: 12, color: theme.muted }}>A</span>
                      <input type="range" min="12" max="32" step="1" value={settings.fontSize} onChange={e => updateSetting('fontSize', parseInt(e.target.value))} style={{ flex: 1, accentColor: A.base, cursor: 'pointer' }} />
                      <span style={{ fontFamily: F.serif, fontSize: 22, color: theme.muted }}>A</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>行間距&nbsp;<span style={{ color: theme.ink }}>{settings.lineHeight}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: F.label, fontSize: 11, color: theme.muted, lineHeight: 1.2 }}>緊</span>
                      <input type="range" min="1.4" max="2.1" step="0.05" value={settings.lineHeight} onChange={e => updateSetting('lineHeight', parseFloat(e.target.value))} style={{ flex: 1, accentColor: A.base, cursor: 'pointer' }} />
                      <span style={{ fontFamily: F.label, fontSize: 11, color: theme.muted, lineHeight: 1.6 }}>鬆</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>字體風格</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                      {Object.entries(FONT_STYLE_PRESETS).map(([key, p]) => {
                        const isSel = (settings.fontStyle ?? 'serif') === key;
                        return <button key={key} onClick={() => updateSetting('fontStyle', key)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', padding: '9px 0', borderRadius: 8, background: isSel ? A.base : theme.pill, color: isSel ? '#fff' : theme.muted, fontFamily: p.family, fontWeight: p.weight, fontSize: 11 }}>{p.label}</button>;
                      })}
                    </div>
                  </div>
                  <div style={{ height: 1, background: theme.line, margin: '8px 0 14px' }} />
                  {([
                    { icon: <Type size={15} />, label: '編輯讀經計劃', sub: '進階設定', action: () => { setIsEditingSchedule(true); setMobileSheet(null); } },
                    { icon: <Download size={15} />, label: '匯出進度', sub: '備份', action: () => { handleExportProgress(); setMobileSheet(null); } },
                    { icon: <Upload size={15} />, label: '匯入進度', sub: '還原', action: () => setShowImportField(f => !f) },
                  ]).map((row, i, arr) => (
                    <div key={i} onClick={row.action} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 6px', borderBottom: i < arr.length - 1 ? `1px solid ${theme.line}` : 'none', cursor: 'pointer' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: theme.pill, color: theme.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: theme.ink, fontFamily: F.sans }}>{row.label}</div>
                        <div style={{ fontSize: 11, color: theme.muted, fontFamily: F.label, marginTop: 1 }}>{row.sub}</div>
                      </div>
                      <ChevronRight size={14} style={{ color: theme.faint }} />
                    </div>
                  ))}
                  {showImportField && (
                    <div style={{ padding: '12px 0 0' }}>
                      <input ref={importInputRef} type="text" placeholder="在此貼上進度代碼…" value={migrationInput} onChange={e => setMigrationInput(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.lineStrong}`, background: theme.bg, color: theme.ink, fontFamily: 'ui-monospace, monospace', fontSize: 11, outline: 'none', boxSizing: 'border-box' as const }} />
                      <button onClick={handleImportProgress} style={{ width: '100%', marginTop: 8, appearance: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', borderRadius: 10, background: A.base, color: '#fff', fontFamily: F.label, fontSize: 13, fontWeight: 600 }}>確認匯入</button>
                    </div>
                  )}

                  <div style={{ height: 1, background: theme.line, margin: '14px 0 14px' }} />
                  <div style={{ padding: '0 0 4px' }}>
                    <SyncSection />
                  </div>

                  <div style={{ height: 1, background: theme.line, margin: '14px 0 10px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 }}>
                    <span style={{ fontFamily: F.label, fontSize: 11, color: theme.faint }}>版本資訊</span>
                    <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: theme.muted }}>{appVersion}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ─── LEFT RAIL ──────────────────────────────────────────────── */}
        <aside style={{
          width: railOpen ? 320 : 52,
          flexShrink: 0,
          borderRight: `1px solid ${theme.line}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width .22s ease',
          overflow: 'hidden',
        }}>
          {/* Rail header */}
          <div style={{
            padding: railOpen ? '18px 16px 12px' : '18px 6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: railOpen ? 'space-between' : 'center',
            flexShrink: 0,
          }}>
            {railOpen && (
              <div>
                <div style={{
                  fontFamily: F.label, fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: theme.muted, marginBottom: 3,
                }}>2026 · 每日讀經</div>
                <div style={{
                  fontFamily: F.serif, fontSize: 18, fontWeight: 600,
                  color: theme.ink, letterSpacing: '-0.01em',
                }}>
                  {currentViewDate.toLocaleDateString('zh-Hant-TW', { month: 'long' })}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {railOpen && (
                <button
                  onClick={() => setRailSearchOpen(o => !o)}
                  title="搜尋章節"
                  style={{ ...iconBtn(theme), color: railSearchOpen ? A.base : theme.muted, background: railSearchOpen ? A.tint : 'transparent' }}
                >
                  <Search size={16} />
                </button>
              )}
              <button
                onClick={() => { setRailOpen(r => !r); if (railOpen) setRailSearchOpen(false); }}
                style={{ ...iconBtn(theme), color: theme.muted }}
                title={railOpen ? '收合' : '展開'}
              >
                {railOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          </div>

          {/* Collapsed icon stack */}
          {!railOpen && (
            <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { icon: <CalendarDays size={17} />, title: '日曆 / 今日計劃', action: () => setRailOpen(true) },
                { icon: <Target size={17} />, title: '回到今天', action: goToTodayInPlan },
                { icon: <BookMarked size={17} />, title: '跳到第一個未讀', action: goToFirstUnfinished },
                { icon: <Search size={17} />, title: '搜尋章節', action: () => { setRailOpen(true); setRailSearchOpen(true); } },
              ].map((b, i) => (
                <button key={i} onClick={b.action} title={b.title} style={{
                  appearance: 'none', border: 'none', cursor: 'pointer',
                  background: 'transparent', color: theme.muted,
                  padding: 10, borderRadius: 8,
                  display: 'flex', justifyContent: 'center',
                }}>
                  {b.icon}
                </button>
              ))}
            </div>
          )}

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
                  columns={3}
                  inputRef={searchPanelInputRef}
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
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 4px', marginBottom: 6,
                }}>
                  <span style={{
                    fontFamily: F.label, fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted,
                  }}>日曆</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      onClick={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1))}
                      style={iconBtn(theme)} title="上月"
                    ><ChevronLeft size={12} /></button>
                    <button
                      onClick={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1))}
                      style={iconBtn(theme)} title="下月"
                    ><ChevronRight size={12} /></button>
                  </div>
                </div>

                <div style={{
                  fontFamily: F.serif, fontSize: 13, fontWeight: 600,
                  color: theme.inkSoft, textAlign: 'center', marginBottom: 6,
                }}>
                  {currentViewDate.getFullYear()}年 {currentViewDate.getMonth() + 1}月
                </div>

                {/* Week labels */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, marginBottom: 3 }}>
                  {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} style={{
                      fontFamily: F.label, fontSize: 10, fontWeight: 600,
                      color: theme.faint, textAlign: 'center', padding: '2px 0',
                    }}>{d}</div>
                  ))}
                </div>

                {/* Days */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {calendarDays.map((d, idx) => {
                    if (!d) return <div key={`e${idx}`} style={{ aspectRatio: '1', minHeight: 26 }} />;
                    const isSel = d.dateKey === selectedDate;
                    const isToday = d.dateKey === todayStr;
                    return (
                      <button key={d.dateKey} onClick={() => handleDayClick(d.dateKey)} style={{
                        appearance: 'none', border: 'none', cursor: 'pointer',
                        aspectRatio: '1', minHeight: 30,
                        borderRadius: 6,
                        background: isSel ? A.base : 'transparent',
                        color: isSel ? '#fff' : !d.hasPlan ? theme.faint : theme.ink,
                        fontFamily: F.label, fontSize: 12, fontWeight: 500,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', position: 'relative',
                        boxShadow: isToday && !isSel ? `inset 0 0 0 1.5px ${A.base}` : 'none',
                        opacity: !d.hasPlan && !isSel ? 0.28 : 1,
                        transition: 'all .1s ease',
                      }}>
                        {d.day}
                        {d.hasPlan && (() => {
                          const dotColor = isSel ? 'rgba(255,255,255,0.7)' : d.isFullyCompleted ? theme.success : d.progress > 0 ? A.soft : theme.faint;
                          return <span style={{ position: 'absolute', bottom: 2, width: 3, height: 3, borderRadius: '50%', background: dotColor }} />;
                        })()}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div style={{ height: 1, background: theme.line, margin: '0 4px' }} />

              {/* TODAY'S PLAN */}
              <section>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 4px', marginBottom: 8,
                }}>
                  <button
                    onClick={() => setIsScheduleExpanded(e => !e)}
                    style={{
                      flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
                      background: 'transparent', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span style={{
                      fontFamily: F.label, fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.10em', textTransform: 'uppercase', color: theme.muted,
                    }}>
                      {selectedDate.slice(5).replace('-', '月')}日
                    </span>
                    {isScheduleExpanded
                      ? <ChevronUp size={12} style={{ color: theme.faint }} />
                      : <ChevronDown size={12} style={{ color: theme.faint }} />}
                  </button>
                  {/* Quiet catch-up — jumps to first unread day without any badge or nudge */}
                  <button
                    onClick={goToFirstUnfinished}
                    title="跳到本年第一個未讀的一天"
                    style={{ ...iconBtn(theme), width: 20, height: 20 }}
                  ><BookMarked size={11} /></button>
                  <button
                    onClick={goToTodayInPlan}
                    title="回到今天"
                    style={{ ...iconBtn(theme), width: 20, height: 20 }}
                  ><Target size={11} /></button>
                </div>

                {isScheduleExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {parsedSchedule.length > 0 ? (parsedSchedule as ScheduleItem[]).map(item => {
                      const done = settings.completedTasks.includes(item.id);
                      const isCurr = navStatus.currentItemId === item.id
                        || (bibleData && !navStatus.currentItemId
                          && bibleData.bookCode === item.book
                          && bibleData.chapter === item.chapter);
                      return (
                        <div
                          key={item.id}
                          onClick={() => fetchBible({ book: item.book, chapter: item.chapter, startVerse: item.startVerse, endVerse: item.endVerse, label: item.label, scheduleItemId: item.id })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 7,
                            cursor: 'pointer',
                            background: isCurr ? A.tint : 'transparent',
                            borderLeft: isCurr ? `2px solid ${A.base}` : '2px solid transparent',
                            transition: 'background .1s ease',
                          }}
                        >
                          <button
                            onClick={e => { e.stopPropagation(); toggleTask(item.id); }}
                            style={{
                              appearance: 'none', cursor: 'pointer',
                              border: `1.5px solid ${done ? theme.success : theme.faint}`,
                              background: done ? theme.success : 'transparent',
                              width: 14, height: 14, borderRadius: 3,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', flexShrink: 0,
                              transition: 'all .12s ease',
                            }}
                          >
                            {done && <CheckCircle2 size={9} />}
                          </button>
                          <span style={{
                            fontFamily: F.sans, fontSize: 14, fontWeight: isCurr ? 600 : 500,
                            color: done ? theme.muted : theme.ink,
                            textDecoration: done ? 'line-through' : 'none',
                            textDecorationColor: theme.faint,
                            flex: 1,
                          }}>{item.label}</span>
                          {isCurr && !done && (
                            <span style={{
                              fontFamily: F.label, fontSize: 9, fontWeight: 700,
                              letterSpacing: '0.08em', color: A.base,
                            }}>讀</span>
                          )}
                        </div>
                      );
                    }) : (
                      <div style={{
                        padding: '14px 0', textAlign: 'center',
                        fontFamily: F.label, fontSize: 11, color: theme.faint,
                        border: `1px dashed ${theme.line}`, borderRadius: 8,
                      }}>本日無指定內容</div>
                    )}
                  </div>
                )}
              </section>

              {/* YEAR PROGRESS */}
              {yearProgress && (
                <section style={{
                  padding: 14, borderRadius: 10, background: theme.pill,
                  marginTop: 'auto',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{
                      fontFamily: F.label, fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.10em', textTransform: 'uppercase', color: theme.muted,
                    }}>年度進度</span>
                    <span style={{
                      fontFamily: F.label, fontSize: 13, fontWeight: 600,
                      color: theme.ink, fontVariantNumeric: 'tabular-nums',
                    }}>{yearProgress.completed} / {yearProgress.total}</span>
                  </div>
                  <div style={{ height: 4, background: theme.line, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      width: `${yearProgress.total > 0 ? (yearProgress.completed / yearProgress.total * 100) : 0}%`,
                      height: '100%', background: A.base, borderRadius: 999,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </section>
              )}
              </>
              )}
            </div>
          )}
        </aside>

        {/* ─── MAIN COLUMN ──────────────────────────────────────────────── */}
        <main style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}>
          {/* TOP BAR */}
          <div style={{
            height: 58, flexShrink: 0,
            borderBottom: `1px solid ${theme.line}`,
            display: 'flex', alignItems: 'center',
            padding: '0 24px', gap: 10,
          }}>
            <div style={{ flex: 1 }} />

            {/* Reading mode toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 1,
              padding: 3, borderRadius: 8, background: theme.pill,
            }}>
              <button
                onClick={() => setReadingMode('standard')}
                title="標準閱讀 · 一節一行"
                style={modeBtn(readingMode === 'standard', theme)}
              ><List size={13} /></button>
              <button
                onClick={() => { setReadingMode('book'); if (settings.secondaryVersion) clearSecondaryVersion(); }}
                title="書頁模式 · 連續排版 · 首字下沉"
                style={modeBtn(readingMode === 'book', theme)}
              ><BookOpen size={13} /></button>
            </div>

            {/* Version chips */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 1,
              padding: 3, borderRadius: 8, background: theme.pill,
            }}>
              <button
                onClick={() => setShowVersionPicker({ active: true, target: 'primary' })}
                style={{
                  appearance: 'none', border: 'none', cursor: 'pointer',
                  padding: '5px 10px', borderRadius: 6,
                  background: theme.surface, color: theme.ink,
                  fontFamily: F.label, fontSize: 11, fontWeight: 600,
                  boxShadow: `0 1px 0 ${theme.line}`,
                }}
              >{settings.primaryVersion}</button>
              {settings.secondaryVersion ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: A.base, overflow: 'hidden', opacity: readingMode === 'book' ? 0.35 : 1 }}>
                  <button onClick={() => setShowVersionPicker({ active: true, target: 'secondary' })} disabled={readingMode === 'book'} title="更換對照譯本" style={{ appearance: 'none', border: 'none', cursor: readingMode === 'book' ? 'not-allowed' : 'pointer', background: 'transparent', color: '#fff', fontFamily: F.label, fontSize: 11, fontWeight: 600, padding: '5px 8px' }}>{settings.secondaryVersion}</button>
                  <button onClick={clearSecondaryVersion} disabled={readingMode === 'book'} title="移除對照" style={{ appearance: 'none', border: 'none', cursor: readingMode === 'book' ? 'not-allowed' : 'pointer', background: 'rgba(0,0,0,0.15)', color: 'rgba(255,255,255,0.8)', padding: '5px 7px', display: 'flex', alignItems: 'center' }}><X size={11} /></button>
                </div>
              ) : (
                <button onClick={() => setShowVersionPicker({ active: true, target: 'secondary' })} disabled={readingMode === 'book'} title={readingMode === 'book' ? '書頁模式下不支援對照' : '新增對照譯本'} style={{ appearance: 'none', border: 'none', cursor: readingMode === 'book' ? 'not-allowed' : 'pointer', padding: '5px 10px', borderRadius: 6, background: 'transparent', color: theme.muted, opacity: readingMode === 'book' ? 0.35 : 1, fontFamily: F.label, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, transition: 'all .12s ease' }}>+ 對照</button>
              )}
            </div>

            {/* Theme cycle button */}
            <button
              onClick={cycleTheme}
              title="切換外觀"
              style={{ appearance: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, background: 'transparent', color: theme.inkSoft, transition: 'background .12s ease' }}
            >
              {settings.theme === 'dark' ? <Moon size={16} /> : settings.theme === 'sepia' ? <Coffee size={16} /> : <Sun size={16} />}
            </button>

            {/* Settings gear */}
            <div ref={settingsRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setSettingsOpen(o => !o)}
                style={{
                  appearance: 'none', border: 'none', cursor: 'pointer',
                  padding: 8, borderRadius: 8,
                  background: settingsOpen ? theme.pill : 'transparent',
                  color: theme.inkSoft,
                  transition: 'background .12s ease',
                }}
                title="設定"
              ><Settings size={16} /></button>

              {settingsOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 280, padding: 8, borderRadius: 12,
                  background: theme.surface, border: `1px solid ${theme.lineStrong}`,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.14)', zIndex: 60,
                }}>
                  {/* Accent color */}
                  <div style={{ padding: '6px 8px 10px' }}>
                    <div style={{
                      fontFamily: F.label, fontSize: 9, fontWeight: 600,
                      letterSpacing: '0.16em', textTransform: 'uppercase',
                      color: theme.muted, marginBottom: 8,
                    }}>配色&nbsp;<span style={{ color: theme.ink, textTransform: 'none', letterSpacing: 0 }}>{ACCENT_PRESETS[settings.accent ?? 'ink']?.label}</span></div>
                    <AccentSwatches current={settings.accent ?? 'ink'} theme={settings.theme} size={28} gap={8} onChange={key => updateSetting('accent', key)} />
                  </div>

                  <div style={{ height: 1, background: theme.line, margin: '0 6px 6px' }} />

                  {/* Font size */}
                  <div style={{ padding: '4px 8px 8px' }}>
                    <div style={{
                      fontFamily: F.label, fontSize: 9, fontWeight: 600,
                      letterSpacing: '0.16em', textTransform: 'uppercase',
                      color: theme.muted, marginBottom: 8,
                    }}>
                      字體大小&nbsp;
                      <span style={{ color: theme.ink, fontVariantNumeric: 'tabular-nums' }}>{settings.fontSize}px</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: F.serif, fontSize: 12, color: theme.muted }}>A</span>
                      <input
                        type="range" min="12" max="32" step="1"
                        value={settings.fontSize}
                        onChange={e => updateSetting('fontSize', parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: A.base, cursor: 'pointer' }}
                      />
                      <span style={{ fontFamily: F.serif, fontSize: 22, color: theme.muted }}>A</span>
                    </div>
                  </div>

                  {/* Line height */}
                  <div style={{ padding: '0 8px 8px' }}>
                    <div style={{
                      fontFamily: F.label, fontSize: 9, fontWeight: 600,
                      letterSpacing: '0.16em', textTransform: 'uppercase',
                      color: theme.muted, marginBottom: 8,
                    }}>行間距&nbsp;<span style={{ color: theme.ink, fontVariantNumeric: 'tabular-nums' }}>{settings.lineHeight}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: F.label, fontSize: 10, color: theme.muted, lineHeight: 1.2 }}>緊</span>
                      <input type="range" min="1.4" max="2.1" step="0.05" value={settings.lineHeight} onChange={e => updateSetting('lineHeight', parseFloat(e.target.value))} style={{ flex: 1, accentColor: A.base, cursor: 'pointer' }} />
                      <span style={{ fontFamily: F.label, fontSize: 10, color: theme.muted, lineHeight: 1.6 }}>鬆</span>
                    </div>
                  </div>

                  {/* Font style */}
                  <div style={{ padding: '0 8px 8px' }}>
                    <div style={{
                      fontFamily: F.label, fontSize: 9, fontWeight: 600,
                      letterSpacing: '0.16em', textTransform: 'uppercase',
                      color: theme.muted, marginBottom: 8,
                    }}>字體風格</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
                      {Object.entries(FONT_STYLE_PRESETS).map(([key, p]) => {
                        const isSel = (settings.fontStyle ?? 'serif') === key;
                        return <button key={key} onClick={() => updateSetting('fontStyle', key)} style={{
                          appearance: 'none', border: 'none', cursor: 'pointer',
                          padding: '6px 0', borderRadius: 6,
                          background: isSel ? A.base : theme.pill,
                          color: isSel ? '#fff' : theme.muted,
                          fontFamily: p.family, fontWeight: p.weight, fontSize: 11,
                          transition: 'all .12s ease',
                        }}>{p.label}</button>;
                      })}
                    </div>
                  </div>

                  <div style={{ height: 1, background: theme.line, margin: '4px 6px 6px' }} />

                  {/* Actions */}
                  {[
                    { icon: <Type size={13} />, label: '編輯讀經計劃', action: () => { setIsEditingSchedule(true); setSettingsOpen(false); } },
                    { icon: <Download size={13} />, label: '匯出進度', action: () => { handleExportProgress(); setSettingsOpen(false); } },
                    { icon: <Upload size={13} />, label: '匯入進度', action: () => { setShowImportField(f => !f); } },
                  ].map((row, i) => (
                    <button key={i} onClick={row.action} style={{
                      width: '100%', appearance: 'none', border: 'none', cursor: 'pointer',
                      background: 'transparent', color: theme.ink, textAlign: 'left',
                      padding: '9px 12px', borderRadius: 7,
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontFamily: F.sans, fontSize: 13,
                      transition: 'background .1s ease',
                    }}>
                      <span style={{ color: theme.muted }}>{row.icon}</span>
                      {row.label}
                    </button>
                  ))}

                  {showImportField && (
                    <div style={{ padding: '4px 8px 8px' }}>
                      <input
                        type="text"
                        placeholder="在此貼上進度代碼…"
                        value={migrationInput}
                        onChange={e => setMigrationInput(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px',
                          borderRadius: 7, border: `1px solid ${theme.lineStrong}`,
                          background: theme.bg, color: theme.ink,
                          fontFamily: 'ui-monospace, monospace', fontSize: 11,
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                      <button onClick={handleImportProgress} style={{
                        width: '100%', marginTop: 6,
                        appearance: 'none', border: 'none', cursor: 'pointer',
                        padding: '8px 0', borderRadius: 7,
                        background: A.base, color: '#fff',
                        fontFamily: F.label, fontSize: 12, fontWeight: 600,
                      }}>確認匯入</button>
                    </div>
                  )}

                  <div style={{ height: 1, background: theme.line, margin: '6px 6px 8px' }} />
                  <div style={{ padding: '0 8px 8px' }}>
                    <SyncSection />
                  </div>

                  <div style={{ height: 1, background: theme.line, margin: '6px 6px 2px' }} />
                  <div style={{ padding: '6px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: F.label, fontSize: 10, color: theme.faint }}>版本</span>
                    <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10, color: theme.muted }}>{appVersion}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SCROLL CONTAINER */}
          <ScrollablePane scrollRef={mainScrollRef} theme={theme} style={{ flex: 1 }}>
            {loading ? (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14,
              }}>
                <BookOpen size={40} style={{ color: A.base, opacity: 0.25 }} />
                <p style={{
                  fontFamily: F.label, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.3em', textTransform: 'uppercase', color: theme.muted,
                }}>正在開啟聖經卷軸</p>
              </div>
            ) : error ? (
              <div style={{
                margin: 40, padding: 20, borderRadius: 12,
                background: 'rgba(225,29,72,0.07)', border: '1px solid rgba(225,29,72,0.18)',
                color: '#e11d48', display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, margin: 0 }}>{error}</p>
              </div>
            ) : bibleData ? (
              <div style={{
                maxWidth: 860, margin: '0 auto',
                padding: `48px ${Math.max(32, settings.fontSize * 1.8)}px 80px`,
              }}>
                {/* Reference header */}
                <div style={{ marginBottom: 32 }}>
                  <div style={{
                    fontFamily: F.label, fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: theme.muted, marginBottom: 8,
                  }}>
                    {settings.scheduleMode === 'daily' && navStatus.inPlan
                      ? `讀經進度 · ${selectedDate.slice(5).replace('-', '月')}日`
                      : '自由閱讀'}
                  </div>
                  <h1 style={{
                    fontFamily: vF.family, fontSize: 40, fontWeight: vF.weight,
                    letterSpacing: '-0.02em', margin: 0, color: theme.ink,
                    lineHeight: 1.1,
                  }}>{bibleData.reference}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontFamily: F.label, fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '3px 9px', borderRadius: 999,
                      background: A.tint, color: A.base,
                    }}>{settings.primaryVersion}</span>
                    {settings.secondaryVersion && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        fontFamily: F.label, fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        padding: '3px 9px', borderRadius: 999,
                        background: 'rgba(74,107,58,0.10)', color: theme.success,
                      }}>{settings.secondaryVersion}</span>
                    )}
                    <span style={{ fontFamily: F.label, fontSize: 11, color: theme.muted }}>
                      {filteredVerses.length} 節
                    </span>
                  </div>
                </div>

                {/* Verses */}
                {readingMode === 'standard' ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: filteredParallel ? '1fr 1fr' : '1fr',
                    columnGap: 32,
                    rowGap: Math.round(settings.lineHeight * 14),
                    fontFamily: vF.family,
                    fontWeight: vF.weight,
                    fontSize: settings.fontSize,
                    lineHeight: settings.lineHeight,
                    color: theme.ink,
                  }}>
                    {filteredVerses.map((v, i) => (
                      <React.Fragment key={i}>
                        <div data-verse={v.verse} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                          <span style={{
                            fontFamily: F.label,
                            fontSize: Math.round(settings.fontSize * 0.56),
                            fontWeight: 600,
                            color: A.base,
                            minWidth: 22,
                            textAlign: 'right',
                            opacity: 0.7,
                            flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums',
                          }}>{v.verse}</span>
                          <div style={{ flex: 1, textAlign: 'justify' }}>
                            <VerseText text={v.text} theme={settings.theme} accent={A} />
                          </div>
                        </div>
                        {filteredParallel && (
                          <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', opacity: 0.62 }}>
                            <span style={{
                              fontFamily: F.label,
                              fontSize: Math.round(settings.fontSize * 0.56),
                              fontWeight: 600,
                              color: theme.success,
                              minWidth: 22,
                              textAlign: 'right',
                              flexShrink: 0,
                              fontVariantNumeric: 'tabular-nums',
                            }}>{filteredParallel[i]?.verse ?? v.verse}</span>
                            <div style={{ flex: 1, fontStyle: 'italic', color: theme.inkSoft, textAlign: 'justify' }}>
                              {filteredParallel[i]
                                ? <VerseText text={filteredParallel[i].text} theme={settings.theme} accent={A} />
                                : <span style={{ opacity: 0.3 }}>無對應內容</span>}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <BookPageVerses
                    verses={filteredVerses}
                    theme={settings.theme}
                    fontSize={settings.fontSize}
                    lineHeight={settings.lineHeight}
                    accent={A}
                  />
                )}

                {/* Completion footer */}
                <div style={{
                  marginTop: 80, paddingTop: 28,
                  borderTop: `1px solid ${theme.line}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                }}>
                  {navStatus.inPlan && (
                    <button
                      onClick={markCurrentAsRead}
                      style={{
                        appearance: 'none', border: 'none', cursor: 'pointer',
                        padding: '13px 28px', borderRadius: 10,
                        background: (navStatus.currentItemId && settings.completedTasks.includes(navStatus.currentItemId))
                          ? theme.success : A.base,
                        color: '#fff',
                        display: 'flex', alignItems: 'center', gap: 10,
                        fontFamily: F.sans, fontSize: 15, fontWeight: 600,
                        letterSpacing: '0.01em',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        transition: 'background .2s ease',
                      }}
                    >
                      {navStatus.currentItemId && settings.completedTasks.includes(navStatus.currentItemId)
                        ? <><CheckCircle2 size={18} /> 已完成 · {bibleData.reference}</>
                        : <><PartyPopper size={18} /> 讀完了 — {bibleData.reference}</>}
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      onClick={() => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                      style={navBtn(false, theme, A)}
                    ><ChevronUp size={13} /> 回頂</button>

                    {navStatus.inPlan ? (
                      <>
                        {navStatus.prevItem && (
                          <button
                            onClick={() => fetchBible({ book: (navStatus.prevItem as ScheduleItem).book, chapter: (navStatus.prevItem as ScheduleItem).chapter, startVerse: (navStatus.prevItem as ScheduleItem).startVerse, endVerse: (navStatus.prevItem as ScheduleItem).endVerse, label: (navStatus.prevItem as ScheduleItem).label, scheduleItemId: (navStatus.prevItem as ScheduleItem).id })}
                            style={navBtn(false, theme, A)}
                          ><ChevronLeft size={13} /> {(navStatus.prevItem as ScheduleItem).label}</button>
                        )}
                        {navStatus.nextItem && (
                          <button
                            onClick={() => fetchBible({ book: (navStatus.nextItem as ScheduleItem).book, chapter: (navStatus.nextItem as ScheduleItem).chapter, startVerse: (navStatus.nextItem as ScheduleItem).startVerse, endVerse: (navStatus.nextItem as ScheduleItem).endVerse, label: (navStatus.nextItem as ScheduleItem).label, scheduleItemId: (navStatus.nextItem as ScheduleItem).id })}
                            style={navBtn(true, theme, A)}
                          >繼續：{(navStatus.nextItem as ScheduleItem).label} <ChevronRight size={13} /></button>
                        )}
                        {!navStatus.nextItem && nextDayWithPlan && (
                          <button onClick={goToNextDay} style={navBtn(true, theme, A)}>
                            前往下一天 <CalendarDays size={13} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => fetchBible({ book: bibleData.bookCode, chapter: Math.max(1, bibleData.chapter - 1) })}
                          style={navBtn(false, theme, A)}
                        ><ChevronLeft size={13} /> 上一章</button>
                        <button
                          onClick={() => fetchBible({ book: bibleData.bookCode, chapter: bibleData.chapter + 1 })}
                          style={navBtn(true, theme, A)}
                        >下一章 <ChevronRight size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty state */
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40,
              }}>
                <div style={{ position: 'relative' }}>
                  <BookOpen size={52} style={{ color: A.base, opacity: 0.18 }} />
                </div>
                <h3 style={{
                  fontFamily: F.serif, fontSize: 26, fontWeight: 600,
                  color: theme.ink, opacity: 0.35, margin: 0, textAlign: 'center',
                }}>靈修從此刻開始</h3>
                <p style={{
                  fontFamily: F.sans, fontSize: 14, color: theme.muted,
                  textAlign: 'center', maxWidth: 300, lineHeight: 1.65, margin: 0,
                }}>
                  點選左側日曆中的日期，<br />或在搜尋框輸入書卷章節。
                </p>
              </div>
            )}

            {/* Footer */}
            {bibleData && (
              <footer style={{
                padding: '40px 32px 48px',
                borderTop: `1px solid ${theme.line}`,
              }}>
                <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
                  <p style={{
                    fontFamily: F.label, fontSize: 10, color: theme.muted,
                    lineHeight: 1.8, marginBottom: 12,
                  }}>
                    本站聖經經文取自信望愛（FHL）聖經資料庫公開 API。各聖經譯本之著作權分屬原著作權人所有，本站僅供閱讀學習使用。{' '}
                    <a href="https://bible.fhl.net" target="_blank" rel="noopener noreferrer"
                       style={{ color: A.soft, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      bible.fhl.net
                    </a>
                  </p>
                  <p style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    color: theme.faint, margin: 0,
                  }}>{appVersion}</p>
                </div>
              </footer>
            )}
          </ScrollablePane>
        </main>
      </div>
      )}

      {/* ─── SCHEDULE EDIT DRAWER ──────────────────────────────────────── */}
      {isEditingSchedule && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
        }}>
          {/* Backdrop */}
          <div
            onClick={() => setIsEditingSchedule(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }}
          />
          {/* Drawer */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 400,
            background: theme.surface, borderLeft: `1px solid ${theme.lineStrong}`,
            boxShadow: '-12px 0 40px rgba(0,0,0,0.10)', zIndex: 1,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${theme.line}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ fontFamily: F.serif, fontSize: 20, margin: 0, color: theme.ink, fontWeight: 600 }}>
                編輯讀經計劃
              </h3>
              <button onClick={() => setIsEditingSchedule(false)} style={iconBtn(theme)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Mode tabs */}
              <div style={{ display: 'flex', gap: 2, padding: 3, background: theme.pill, borderRadius: 8 }}>
                {([['static', '靜態'], ['daily', '每日 (JSON)']] as const).map(([mode, label]) => (
                  <button key={mode} onClick={() => updateSetting('scheduleMode', mode)} style={{
                    flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px 0', borderRadius: 6,
                    background: settings.scheduleMode === mode ? theme.surface : 'transparent',
                    color: settings.scheduleMode === mode ? A.base : theme.muted,
                    fontFamily: F.label, fontSize: 11, fontWeight: 600,
                    boxShadow: settings.scheduleMode === mode ? `0 1px 0 ${theme.line}` : 'none',
                  }}>{label}</button>
                ))}
              </div>

              <textarea
                value={settings.scheduleMode === 'static' ? settings.scheduleText : settings.dailyScheduleJson}
                onChange={e => setSettings(s => ({
                  ...s,
                  [settings.scheduleMode === 'static' ? 'scheduleText' : 'dailyScheduleJson']: e.target.value,
                }))}
                style={{
                  flex: 1, minHeight: 240, padding: 14,
                  borderRadius: 8, border: `1px solid ${theme.lineStrong}`,
                  background: theme.bg, color: theme.ink,
                  fontFamily: 'ui-monospace, monospace', fontSize: 12,
                  resize: 'vertical', outline: 'none', lineHeight: 1.6,
                }}
                placeholder={settings.scheduleMode === 'static' ? '格式：馬太 1-3' : '{"2026-01-01": "太 1"}'}
              />

              {/* Export / Import */}
              <div style={{ borderTop: `1px solid ${theme.line}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontFamily: F.label, fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.muted,
                  }}>進度備份</span>
                  <span style={{ fontFamily: F.label, fontSize: 11, color: A.base, fontWeight: 600 }}>
                    已完成 {settings.completedTasks.length} 章
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={handleExportProgress} style={{
                    appearance: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 0', borderRadius: 8,
                    background: A.tint, color: A.base,
                    fontFamily: F.label, fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <Download size={13} /> 匯出進度
                  </button>
                  <button onClick={handleImportProgress} disabled={!migrationInput.trim()} style={{
                    appearance: 'none', border: 'none', cursor: migrationInput.trim() ? 'pointer' : 'default',
                    padding: '10px 0', borderRadius: 8,
                    background: theme.ink, color: theme.bg,
                    fontFamily: F.label, fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: migrationInput.trim() ? 1 : 0.4,
                  }}>
                    <Upload size={13} /> 匯入進度
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="在此貼上匯出的進度代碼…"
                  value={migrationInput}
                  onChange={e => setMigrationInput(e.target.value)}
                  style={{
                    padding: '9px 12px', borderRadius: 8,
                    border: `1px solid ${theme.lineStrong}`,
                    background: theme.bg, color: theme.ink,
                    fontFamily: 'ui-monospace, monospace', fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: `1px solid ${theme.line}` }}>
              <button
                onClick={() => { saveSettings(settings); showToast('計劃與設定已儲存'); setIsEditingSchedule(false); }}
                style={{
                  width: '100%', appearance: 'none', border: 'none', cursor: 'pointer',
                  padding: '12px 0', borderRadius: 9,
                  background: A.base, color: '#fff',
                  fontFamily: F.sans, fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: `0 4px 12px ${A.tint}`,
                }}
              ><Save size={16} /> 儲存並關閉</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── VERSION PICKER MODAL ──────────────────────────────────────── */}
      {showVersionPicker.active && (
        <div
          onClick={() => setShowVersionPicker({ ...showVersionPicker, active: false })}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 580, maxHeight: '80vh',
              borderRadius: 20, overflow: 'hidden',
              background: theme.surface, border: `1px solid ${theme.lineStrong}`,
              boxShadow: '0 40px 80px rgba(0,0,0,0.22)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ padding: '28px 32px 20px', borderBottom: `1px solid ${theme.line}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 600, margin: '0 0 4px', color: theme.ink }}>
                    聖經譯本
                  </h3>
                  <p style={{ fontFamily: F.sans, fontSize: 13, color: theme.muted, margin: 0 }}>
                    切換不同譯本以獲得更深度的理解
                  </p>
                </div>
                <button
                  onClick={() => setShowVersionPicker({ ...showVersionPicker, active: false })}
                  style={iconBtn(theme)}
                ><X size={20} /></button>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 10,
                background: theme.pill, color: theme.muted,
              }}>
                <Search size={14} style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="搜尋譯本名稱或簡稱…"
                  value={versionSearch}
                  onChange={e => setVersionSearch(e.target.value)}
                  style={{
                    appearance: 'none', border: 'none', outline: 'none',
                    background: 'transparent', color: theme.ink,
                    fontFamily: F.sans, fontSize: 14, flex: 1,
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {filteredVersions.map(ver => {
                  const isActive = (showVersionPicker.target === 'primary' ? settings.primaryVersion : settings.secondaryVersion) === ver.id;
                  return (
                    <button
                      key={ver.id}
                      onClick={() => {
                        const isPrimary = showVersionPicker.target === 'primary';
                        const updated = updateSetting(isPrimary ? 'primaryVersion' : 'secondaryVersion', ver.id);
                        setShowVersionPicker({ ...showVersionPicker, active: false });
                        if (bibleData) {
                          fetchBible({ book: bibleData.bookCode, chapter: bibleData.chapter, startVerse: bibleData.startVerse, endVerse: bibleData.endVerse, label: bibleData.reference }, updated.primaryVersion, updated.secondaryVersion);
                        }
                      }}
                      style={{
                        appearance: 'none', cursor: 'pointer', textAlign: 'left',
                        padding: '14px 16px', borderRadius: 12,
                        border: `1.5px solid ${isActive ? A.base : theme.line}`,
                        background: isActive ? A.tint : theme.bg,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all .12s ease',
                      }}
                    >
                      <div>
                        <div style={{
                          fontFamily: F.label, fontSize: 14, fontWeight: 700,
                          color: isActive ? A.base : theme.ink, marginBottom: 2,
                        }}>{ver.id}</div>
                        <div style={{ fontFamily: F.sans, fontSize: 11, color: theme.muted }}>{ver.name}</div>
                      </div>
                      {isActive && <CheckCircle2 size={18} style={{ color: A.base, flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <button
          onClick={() => setShowKeymapHelp(prev => !prev)}
          title="Keyboard shortcuts (?)"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 90,
            width: 36, height: 36, borderRadius: '50%',
            background: theme.surface, border: `1px solid ${theme.line}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: theme.muted,
            fontFamily: F.label, fontSize: 15, fontWeight: 600,
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = theme.ink; (e.currentTarget as HTMLButtonElement).style.borderColor = theme.lineStrong; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = theme.muted; (e.currentTarget as HTMLButtonElement).style.borderColor = theme.line; }}
        >?</button>
      )}

      {showKeymapHelp && (
        <div
          onClick={() => setShowKeymapHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            ref={keymapModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard Shortcuts"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.surface, border: `1px solid ${theme.line}`,
              borderRadius: 12, padding: '24px 28px', minWidth: 320,
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
              outline: 'none',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16,
            }}>
              <span style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 600, color: theme.ink }}>
                Keyboard Shortcuts
              </span>
              <span style={{ fontFamily: F.sans, fontSize: 11, color: theme.muted }}>Esc to close</span>
            </div>

            {([
              { section: 'NAVIGATION', rows: [
                { keys: ['[', ']'],      label: 'Previous / next day' },
                { keys: ['g→h', 'g→l'], label: 'Prev / next day (chord)' },
                { keys: ['t'],           label: 'Jump to today' },
                { keys: ['g→u'],         label: 'First unfinished' },
                { keys: ['N', 'n'],      label: 'Prev / next unread day' },
              ]},
              { section: 'READING', rows: [
                { keys: ['h', 'l'],     label: 'Prev / next passage' },
                { keys: ['m'],          label: 'Toggle read / unread' },
                { keys: ['r'],          label: 'Toggle reading mode' },
                { keys: ['g→1…N'],      label: 'Jump to verse N' },
                { keys: ['gg', 'G'],    label: 'Scroll to top / bottom' },
              ]},
              { section: 'INTERFACE', rows: [
                { keys: ['/'],       label: 'Toggle search' },
                { keys: ['j', 'k'],  label: 'Scroll down / up' },
                { keys: ['s'],       label: 'Toggle settings' },
                { keys: ['c'],       label: 'Cycle theme' },
                { keys: ['Esc'],     label: 'Close panels' },
                { keys: ['?'],       label: 'This help' },
              ]},
            ] as Array<{ section: string; rows: Array<{ keys: string[]; label: string }> }>).map(({ section, rows }) => (
              <div key={section} style={{ marginBottom: 14 }}>
                <div style={{
                  fontFamily: F.label, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: theme.muted, marginBottom: 6,
                }}>{section}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {rows.map(({ keys, label }) => (
                      <tr key={label}>
                        <td style={{ padding: '3px 0', width: 110 }}>
                          {keys.map((k, i) => (
                            <React.Fragment key={k}>
                              {i > 0 && <span style={{ marginRight: 3 }}> </span>}
                              <kbd style={{
                                background: theme.pill, border: `1px solid ${theme.line}`,
                                borderRadius: 3, padding: '1px 6px',
                                fontFamily: F.label, fontSize: 12, color: theme.ink,
                              }}>{k}</kbd>
                            </React.Fragment>
                          ))}
                        </td>
                        <td style={{
                          padding: '3px 0 3px 8px',
                          fontFamily: F.sans, fontSize: 12, color: theme.inkSoft,
                        }}>
                          {label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
