
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, CheckCircle2, AlertCircle, BookOpen,
  Sun, Moon, Coffee, X, PartyPopper, ChevronUp,
  ChevronRight, ChevronLeft, ChevronDown, Settings,
  Save, Download, Upload, Target, BookMarked,
  CalendarDays, List, Type,
} from 'lucide-react';
import {
  BIBLE_BOOKS, FALLBACK_VERSIONS, DEFAULT_DAILY_SCHEDULE
} from './constants';
import {
  AppSettings, BibleData, BibleVerse, ScheduleItem, VersionInfo, Theme
} from './types';
import { findBookCode } from './utils/bible-lookup';
import { parseScheduleLine, getDayPlan, buildVerseId } from './utils/schedule-parser';
import { migrateScheduleJson, migrateCompletedTasks } from './utils/migrations';

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
    bg: '#1a1814', surface: '#23201a', panel: '#2d2a22',
    ink: '#e8e0cc', inkSoft: '#b5ab93', muted: '#857d68',
    faint: '#4d4536',
    line: 'rgba(232,224,204,0.10)', lineStrong: 'rgba(232,224,204,0.20)',
    pill: 'rgba(232,224,204,0.06)', success: '#8aa872',
  },
} as const;

const A = { base: '#1e3a5f', soft: '#3a5d8a', tint: 'rgba(30,58,95,0.10)' };

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

function navBtn(accent: boolean, t: TK): React.CSSProperties {
  return {
    appearance: 'none', cursor: 'pointer',
    padding: '10px 18px', borderRadius: 8,
    border: accent ? 'none' : `1px solid ${t.line}`,
    background: accent ? A.tint : 'transparent',
    color: accent ? A.base : t.inkSoft,
    fontFamily: F.sans, fontSize: 13, fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    letterSpacing: '0.01em',
    transition: 'all .12s ease',
  };
}

// ─── VERSE TEXT ──────────────────────────────────────────────────────────────

const VerseText: React.FC<{ text: string; theme: Theme }> = ({ text, theme }) => {
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
              color: A.base, letterSpacing: '-0.01em',
            }}>{renderContent(content)}</h2>
          );
        }
        if (/^<h3/i.test(part)) {
          const content = part.replace(/<\/?h3>/gi, '').trim();
          return (
            <h3 key={i} style={{
              display: 'block', fontSize: '1.1em', fontWeight: 600,
              marginBottom: '0.4em', marginTop: '0.2em', color: A.soft,
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

const BookPageVerses: React.FC<{
  verses: BibleVerse[];
  theme: Theme;
  fontSize: number;
  lineHeight: number;
}> = ({ verses, theme, fontSize, lineHeight }) => {
  const t: TK = T[theme];
  const baseSize = fontSize + 1;
  const sup: React.CSSProperties = {
    fontFamily: F.label, fontSize: 10, fontWeight: 600,
    color: A.base, marginRight: 3, marginLeft: 2,
    verticalAlign: 'super', letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
  };

  if (!verses.length) return null;

  const firstChar = verses[0].text[0] ?? '';
  const firstRest = verses[0].text.slice(1);

  return (
    <div style={{
      fontFamily: F.serif, fontSize: baseSize,
      lineHeight: lineHeight + 0.05, color: t.ink,
      textAlign: 'justify', hyphens: 'auto',
    }}>
      {/* Opening paragraph with drop cap */}
      <p style={{ margin: '0 0 1.2em' }}>
        <span style={{
          float: 'left', fontFamily: F.serif,
          fontSize: baseSize * 4, lineHeight: 0.88,
          color: A.base, fontWeight: 600,
          marginRight: 12, marginTop: 6, letterSpacing: '-0.02em',
        }}>{firstChar}</span>
        <sup style={sup}>1</sup>
        <VerseText text={firstRest} theme={theme} />{' '}
        {verses.slice(1, 3).map(v => (
          <React.Fragment key={v.verse}>
            <sup style={sup}>{v.verse}</sup>
            <VerseText text={v.text} theme={theme} />{' '}
          </React.Fragment>
        ))}
      </p>

      {/* Remaining verses as continuous text */}
      {verses.length > 3 && (
        <p style={{ margin: '0 0 1.2em', clear: 'both' }}>
          {verses.slice(3).map((v, i) => (
            <React.Fragment key={v.verse}>
              {i > 0 && ' '}
              <sup style={sup}>{v.verse}</sup>
              <VerseText text={v.text} theme={theme} />
            </React.Fragment>
          ))}
        </p>
      )}

      {/* End ornament */}
      <div style={{
        marginTop: 32, textAlign: 'center',
        color: t.faint, fontSize: 20, clear: 'both',
      }}>❦</div>
    </div>
  );
};

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
    primaryVersion: 'unv',
    secondaryVersion: null,
    scheduleHash: "",
  });

  const [input, setInput] = useState('');
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
  const [readingMode, setReadingMode] = useState<'standard' | 'book'>('standard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(true);
  const [currentScheduleItemId, setCurrentScheduleItemId] = useState<string | null>(null);
  const [showImportField, setShowImportField] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileSheet, setMobileSheet] = useState<'plan' | 'menu' | 'search' | null>(null);

  // Refs
  const settingsRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

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
          localStorage.setItem('bible_settings', JSON.stringify(next));
          return next;
        });
      } catch {
        console.error('Failed to load settings');
      }
    }
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
    let search = refInfo;
    if (!search) {
      const parsed = findBookCode(input);
      const numbers = input.match(/\d+/g);
      if (parsed && numbers) {
        search = { book: parsed.en, chapter: parseInt(numbers[0]) };
        if (input.includes(':') && numbers.length >= 2) {
          search.startVerse = parseInt(numbers[1]);
          if (numbers.length >= 3) search.endVerse = parseInt(numbers[2]);
        }
      } else if (bibleData) {
        search = { book: bibleData.bookCode, chapter: bibleData.chapter };
      }
    }
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
        return data.record.map((r: any) => ({ verse: r.sec, text: r.bible_text }));
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
      setInput(reference);
      setCurrentScheduleItemId(refInfo?.scheduleItemId ?? null);
    } catch (err: any) {
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
    if (!settings.completedTasks.includes(id)) {
      toggleTask(id);
      showToast(`已完成：${bibleData.reference}！`);
    }
  };

  const handleExportProgress = () => {
    navigator.clipboard.writeText(JSON.stringify(settings.completedTasks)).then(() => {
      showToast('進度代碼已複製到剪貼簿');
    });
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

  // ── Derived ────────────────────────────────────────────────────────────────

  const theme = T[settings.theme];
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0-dev';

  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

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
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.line}`,
          }}>
            <button
              onClick={() => setMobileSheet(s => s === 'plan' ? null : 'plan')}
              style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="計劃"
            ><CalendarDays size={19} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.muted }}>
                {selectedDate.slice(5).replace('-', '月')}日
              </div>
              <div style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 600, color: theme.ink, marginTop: 2, letterSpacing: '-0.01em' }}>
                2026 每日讀經
              </div>
            </div>
            <button
              onClick={() => setMobileSheet(s => s === 'menu' ? null : 'menu')}
              style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="設定"
            ><Settings size={19} /></button>
          </div>

          {/* Mobile reading area */}
          <div ref={mainScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 130px' }}>
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
                    {settings.scheduleMode === 'daily' && navStatus.inPlan ? `今日讀經 · ${selectedDate.slice(5).replace('-', '月')}日` : '自由閱讀'}
                  </div>
                  <h1 style={{ fontFamily: F.serif, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: theme.ink, lineHeight: 1.15 }}>
                    {bibleData.reference}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => setShowVersionPicker({ active: true, target: 'primary' })}
                        style={{ display: 'inline-flex', alignItems: 'center', fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: A.tint, color: A.base, appearance: 'none', border: 'none', cursor: 'pointer' }}
                      >{settings.primaryVersion}</button>
                      <span style={{ fontFamily: F.label, fontSize: 11, color: theme.muted }}>{filteredVerses.length} 節</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: 2, borderRadius: 8, background: theme.pill }}>
                      <button onClick={() => setReadingMode('standard')} title="標準閱讀" style={modeBtn(readingMode === 'standard', theme)}><List size={13} /></button>
                      <button onClick={() => { setReadingMode('book'); if (settings.secondaryVersion) updateSetting('secondaryVersion', null); }} title="書頁模式" style={modeBtn(readingMode === 'book', theme)}><BookOpen size={13} /></button>
                    </div>
                  </div>
                </div>

                {/* Verses */}
                {readingMode === 'standard' ? (
                  <div style={{ display: 'grid', rowGap: Math.max(10, Math.round(settings.lineHeight * 14) - 4), fontFamily: F.serif, fontSize: Math.max(15, settings.fontSize - 2), lineHeight: settings.lineHeight, color: theme.ink }}>
                    {filteredVerses.map((v, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                        <span style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, color: A.base, minWidth: 18, textAlign: 'right', opacity: 0.7, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{v.verse}</span>
                        <div style={{ flex: 1, textAlign: 'justify' }}><VerseText text={v.text} theme={settings.theme} /></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <BookPageVerses verses={filteredVerses} theme={settings.theme} fontSize={Math.max(15, settings.fontSize - 2)} lineHeight={settings.lineHeight} />
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
          </div>

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
              { label: '今日', icon: <Target size={19} strokeWidth={1.8} />, sheet: null as null },
              { label: '計劃', icon: <CalendarDays size={19} strokeWidth={1.8} />, sheet: 'plan' as const },
              { label: '搜尋', icon: <Search size={19} strokeWidth={1.8} />, sheet: 'search' as const },
              { label: '設定', icon: <Settings size={19} strokeWidth={1.8} />, sheet: 'menu' as const },
            ] as const).map(tab => {
              const active = mobileSheet === tab.sheet;
              return (
                <button key={tab.label} onClick={() => setMobileSheet(s => s === tab.sheet ? null : tab.sheet)} style={{
                  flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
                  background: active ? A.base : 'transparent',
                  color: active ? '#fff' : theme.inkSoft,
                  padding: '8px 4px', borderRadius: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  fontFamily: F.label, fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                  transition: 'all .12s ease',
                }}>
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
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
                  <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, color: theme.ink }}>本月日曆 · 今日計劃</span>
                  <button onClick={() => setMobileSheet(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
                  {/* Mobile calendar */}
                  <div>
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
                        if (!d) return <div key={`me${idx}`} style={{ aspectRatio: '1' }} />;
                        const isSel = d.dateKey === selectedDate;
                        const isToday = d.dateKey === todayStr;
                        return (
                          <button key={d.dateKey} onClick={() => { handleDayClick(d.dateKey); setMobileSheet(null); }} style={{
                            appearance: 'none', border: 'none', cursor: 'pointer',
                            aspectRatio: '1', borderRadius: 8,
                            background: isSel ? A.base : 'transparent',
                            color: isSel ? '#fff' : !d.hasPlan ? theme.faint : theme.ink,
                            fontFamily: F.label, fontSize: 12, fontWeight: 500, position: 'relative',
                            boxShadow: isToday && !isSel ? `inset 0 0 0 1.5px ${A.base}` : 'none',
                            opacity: !d.hasPlan && !isSel ? 0.28 : 1,
                          }}>
                            {d.day}
                            {d.hasPlan && (
                              <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.7)' : d.isFullyCompleted ? theme.success : d.progress > 0 ? A.soft : theme.faint }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ height: 1, background: theme.line, margin: '16px 0' }} />
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

          {/* Bottom sheet (search) */}
          {mobileSheet === 'search' && (
            <>
              <div onClick={() => setMobileSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -16px 40px rgba(0,0,0,0.15)', zIndex: 41, padding: '10px 0 32px' }}>
                <div style={{ padding: '0 0 8px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 999, background: theme.faint }} />
                </div>
                <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 600, color: theme.ink }}>搜尋章節</span>
                  <button onClick={() => setMobileSheet(null)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.inkSoft, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                </div>
                <div style={{ padding: '0 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: theme.pill }}>
                    <Search size={16} style={{ color: theme.muted, flexShrink: 0 }} />
                    <input
                      autoFocus
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { fetchBible(); setMobileSheet(null); } }}
                      placeholder="如：詩 23、太 5"
                      style={{ appearance: 'none', border: 'none', outline: 'none', background: 'transparent', color: theme.ink, fontFamily: F.sans, fontSize: 15, flex: 1, minWidth: 0 }}
                    />
                  </div>
                  <button onClick={() => { fetchBible(); setMobileSheet(null); }} style={{ width: '100%', marginTop: 12, appearance: 'none', border: 'none', cursor: 'pointer', padding: '13px', borderRadius: 12, background: A.base, color: '#fff', fontFamily: F.sans, fontSize: 15, fontWeight: 600 }}>
                    開啟
                  </button>
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
                    <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>外觀</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([['light', <Sun size={13} />, '亮'], ['sepia', <Coffee size={13} />, '紙感'], ['dark', <Moon size={13} />, '深夜']] as const).map(([th, icon, label]) => (
                        <button key={th} onClick={() => updateSetting('theme', th as Theme)} style={{ flex: 1, appearance: 'none', cursor: 'pointer', padding: '10px 0', borderRadius: 10, border: `1.5px solid ${settings.theme === th ? A.base : theme.line}`, background: settings.theme === th ? A.tint : 'transparent', color: settings.theme === th ? A.base : theme.muted, fontFamily: F.label, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>{icon}{label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>字體大小&nbsp;<span style={{ color: theme.ink }}>{settings.fontSize}px</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: F.serif, fontSize: 13, color: theme.muted }}>A</span>
                      <input type="range" min="13" max="28" step="1" value={settings.fontSize} onChange={e => updateSetting('fontSize', parseInt(e.target.value))} style={{ flex: 1, accentColor: A.base, cursor: 'pointer' }} />
                      <span style={{ fontFamily: F.serif, fontSize: 20, color: theme.muted }}>A</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, marginBottom: 10 }}>行間距</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
                      {[1.4, 1.55, 1.75, 1.9, 2.1].map(lh => (
                        <button key={lh} onClick={() => updateSetting('lineHeight', lh)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', padding: '9px 0', borderRadius: 8, background: settings.lineHeight === lh ? A.base : theme.pill, color: settings.lineHeight === lh ? '#fff' : theme.muted, fontFamily: F.label, fontSize: 10, fontWeight: 600 }}>{lh}</button>
                      ))}
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
                      <input type="text" placeholder="在此貼上進度代碼…" value={migrationInput} onChange={e => setMigrationInput(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.lineStrong}`, background: theme.bg, color: theme.ink, fontFamily: 'ui-monospace, monospace', fontSize: 11, outline: 'none', boxSizing: 'border-box' as const }} />
                      <button onClick={handleImportProgress} style={{ width: '100%', marginTop: 8, appearance: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', borderRadius: 10, background: A.base, color: '#fff', fontFamily: F.label, fontSize: 13, fontWeight: 600 }}>確認匯入</button>
                    </div>
                  )}
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
            <button
              onClick={() => setRailOpen(r => !r)}
              style={{ ...iconBtn(theme), color: theme.muted }}
              title={railOpen ? '收合' : '展開'}
            >
              {railOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Collapsed icon stack */}
          {!railOpen && (
            <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { icon: <CalendarDays size={17} />, title: '日曆', action: () => setRailOpen(true) },
                { icon: <List size={17} />, title: '今日計劃', action: () => setRailOpen(true) },
                { icon: <Target size={17} />, title: '回到今天', action: goToTodayInPlan },
                { icon: <BookMarked size={17} />, title: '跳到第一個未讀', action: goToFirstUnfinished },
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
                        {d.hasPlan && (
                          <span style={{
                            position: 'absolute', bottom: 2,
                            width: 3, height: 3, borderRadius: '50%',
                            background: isSel ? 'rgba(255,255,255,0.7)' :
                              d.isFullyCompleted ? theme.success :
                              d.progress > 0 ? A.soft : theme.faint,
                          }} />
                        )}
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
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 8,
              background: theme.pill,
              flex: '0 0 auto', width: 260,
            }}>
              <Search size={13} style={{ color: theme.muted, flexShrink: 0 }} />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchBible()}
                placeholder="搜尋…  如：詩 23"
                style={{
                  appearance: 'none', border: 'none', outline: 'none',
                  background: 'transparent', color: theme.ink,
                  fontFamily: F.sans, fontSize: 13, flex: 1, minWidth: 0,
                }}
              />
              <span style={{
                fontFamily: F.label, fontSize: 9, fontWeight: 600,
                padding: '2px 5px', borderRadius: 3,
                border: `1px solid ${theme.line}`, color: theme.faint,
                flexShrink: 0,
              }}>⌘K</span>
            </div>

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
                onClick={() => { setReadingMode('book'); if (settings.secondaryVersion) updateSetting('secondaryVersion', null); }}
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
              <button
                onClick={() => settings.secondaryVersion
                  ? updateSetting('secondaryVersion', null)
                  : setShowVersionPicker({ active: true, target: 'secondary' })
                }
                disabled={readingMode === 'book'}
                title={readingMode === 'book' ? '書頁模式下不支援對照' : ''}
                style={{
                  appearance: 'none', border: 'none',
                  cursor: readingMode === 'book' ? 'not-allowed' : 'pointer',
                  padding: '5px 10px', borderRadius: 6,
                  background: settings.secondaryVersion ? A.base : 'transparent',
                  color: settings.secondaryVersion ? '#fff' : theme.muted,
                  opacity: readingMode === 'book' ? 0.35 : 1,
                  fontFamily: F.label, fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all .12s ease',
                }}
              >
                {settings.secondaryVersion || '+ 對照'}
              </button>
            </div>

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
                  {/* Theme */}
                  <div style={{ padding: '6px 8px 10px' }}>
                    <div style={{
                      fontFamily: F.label, fontSize: 9, fontWeight: 600,
                      letterSpacing: '0.16em', textTransform: 'uppercase',
                      color: theme.muted, marginBottom: 8,
                    }}>外觀</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([['light', <Sun size={11} />, '亮'], ['sepia', <Coffee size={11} />, '紙'], ['dark', <Moon size={11} />, '暗']] as const).map(([th, icon, label]) => (
                        <button key={th} onClick={() => updateSetting('theme', th as Theme)} style={{
                          flex: 1, appearance: 'none', cursor: 'pointer',
                          padding: '6px 0', borderRadius: 6,
                          border: `1.5px solid ${settings.theme === th ? A.base : theme.line}`,
                          background: settings.theme === th ? A.tint : 'transparent',
                          color: settings.theme === th ? A.base : theme.muted,
                          fontFamily: F.label, fontSize: 11, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'all .12s ease',
                        }}>
                          {icon}{label}
                        </button>
                      ))}
                    </div>
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
                      <span style={{ fontFamily: F.serif, fontSize: 13, color: theme.muted }}>A</span>
                      <input
                        type="range" min="13" max="28" step="1"
                        value={settings.fontSize}
                        onChange={e => updateSetting('fontSize', parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: A.base, cursor: 'pointer' }}
                      />
                      <span style={{ fontFamily: F.serif, fontSize: 20, color: theme.muted }}>A</span>
                    </div>
                  </div>

                  {/* Line height */}
                  <div style={{ padding: '0 8px 8px' }}>
                    <div style={{
                      fontFamily: F.label, fontSize: 9, fontWeight: 600,
                      letterSpacing: '0.16em', textTransform: 'uppercase',
                      color: theme.muted, marginBottom: 8,
                    }}>行間距</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3 }}>
                      {[1.4, 1.55, 1.75, 1.9, 2.1].map(lh => (
                        <button key={lh} onClick={() => updateSetting('lineHeight', lh)} style={{
                          appearance: 'none', border: 'none', cursor: 'pointer',
                          padding: '6px 0', borderRadius: 6,
                          background: settings.lineHeight === lh ? A.base : theme.pill,
                          color: settings.lineHeight === lh ? '#fff' : theme.muted,
                          fontFamily: F.label, fontSize: 10, fontWeight: 600,
                          transition: 'all .12s ease',
                        }}>{lh}</button>
                      ))}
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
                </div>
              )}
            </div>
          </div>

          {/* SCROLL CONTAINER */}
          <div ref={mainScrollRef} style={{ flex: 1, overflowY: 'auto' }}>
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
                      ? `今日讀經 · ${selectedDate.slice(5).replace('-', '月')}日`
                      : '自由閱讀'}
                  </div>
                  <h1 style={{
                    fontFamily: F.serif, fontSize: 40, fontWeight: 600,
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
                    fontFamily: F.serif,
                    fontSize: settings.fontSize,
                    lineHeight: settings.lineHeight,
                    color: theme.ink,
                  }}>
                    {filteredVerses.map((v, i) => (
                      <React.Fragment key={i}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
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
                            <VerseText text={v.text} theme={settings.theme} />
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
                                ? <VerseText text={filteredParallel[i].text} theme={settings.theme} />
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
                      style={navBtn(false, theme)}
                    ><ChevronUp size={13} /> 回頂</button>

                    {navStatus.inPlan ? (
                      <>
                        {navStatus.prevItem && (
                          <button
                            onClick={() => fetchBible({ book: (navStatus.prevItem as ScheduleItem).book, chapter: (navStatus.prevItem as ScheduleItem).chapter, startVerse: (navStatus.prevItem as ScheduleItem).startVerse, endVerse: (navStatus.prevItem as ScheduleItem).endVerse, label: (navStatus.prevItem as ScheduleItem).label, scheduleItemId: (navStatus.prevItem as ScheduleItem).id })}
                            style={navBtn(false, theme)}
                          ><ChevronLeft size={13} /> {(navStatus.prevItem as ScheduleItem).label}</button>
                        )}
                        {navStatus.nextItem && (
                          <button
                            onClick={() => fetchBible({ book: (navStatus.nextItem as ScheduleItem).book, chapter: (navStatus.nextItem as ScheduleItem).chapter, startVerse: (navStatus.nextItem as ScheduleItem).startVerse, endVerse: (navStatus.nextItem as ScheduleItem).endVerse, label: (navStatus.nextItem as ScheduleItem).label, scheduleItemId: (navStatus.nextItem as ScheduleItem).id })}
                            style={navBtn(true, theme)}
                          >繼續：{(navStatus.nextItem as ScheduleItem).label} <ChevronRight size={13} /></button>
                        )}
                        {!navStatus.nextItem && nextDayWithPlan && (
                          <button onClick={goToNextDay} style={navBtn(true, theme)}>
                            前往下一天 <CalendarDays size={13} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => fetchBible({ book: bibleData.bookCode, chapter: Math.max(1, bibleData.chapter - 1) })}
                          style={navBtn(false, theme)}
                        ><ChevronLeft size={13} /> 上一章</button>
                        <button
                          onClick={() => fetchBible({ book: bibleData.bookCode, chapter: bibleData.chapter + 1 })}
                          style={navBtn(true, theme)}
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
          </div>
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
    </div>
  );
};

export default App;
