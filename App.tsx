
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  BookOpen, Search, History, Check, Calendar as CalendarIcon, CheckCircle2, 
  AlertCircle, RefreshCw, Type, Sun, Moon, Coffee, X, Info, 
  PartyPopper, ChevronUp, ChevronRight, ChevronLeft, Settings, 
  FileText, Save, Target, ChevronDown, ChevronRight as ChevronRightIcon,
  Download, Upload, Share2, Trash2
} from 'lucide-react';
import { 
  BIBLE_BOOKS, BIBLE_ALIASES, FALLBACK_VERSIONS, DEFAULT_DAILY_SCHEDULE 
} from './constants';
import { 
  AppSettings, BibleData, BibleVerse, ScheduleItem, VersionInfo, Theme 
} from './types';

const LoadingView: React.FC<{ theme: Theme }> = ({ theme }) => {
  const containerBg = {
    light: "bg-indigo-50 border-indigo-100",
    sepia: "bg-[#f4ecd8] border-[#eaddc0]",
    dark: "bg-white/5 border-white/5"
  };

  const iconColor = {
    light: "text-indigo-600",
    sepia: "text-[#5b4636]",
    dark: "text-indigo-400"
  };

  const textClasses = {
    light: "text-indigo-600/60",
    sepia: "text-[#5b4636]/60",
    dark: "text-white/30"
  };

  return (
    <div className="flex flex-col items-center justify-center h-[75vh] animate-in fade-in duration-500">
      <div className="relative mb-12">
        <div className={`p-10 rounded-[3rem] border-2 shadow-2xl relative z-10 animate-pulse transition-all duration-500 ${containerBg[theme]}`}>
          <BookOpen className={`transition-colors duration-500 ${iconColor[theme]}`} size={64} />
        </div>
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-400/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
      </div>
      <p className={`text-xs font-black uppercase tracking-[0.3em] animate-pulse transition-colors duration-500 ${textClasses[theme]}`}>
        正在開啟聖經卷軸
      </p>
    </div>
  );
};

const EmptyState: React.FC<{ theme: Theme }> = ({ theme }) => {
  const containerBg = {
    light: "bg-indigo-50 border-indigo-100",
    sepia: "bg-[#f4ecd8] border-[#eaddc0]",
    dark: "bg-white/5 border-white/5"
  };

  const iconColor = {
    light: "text-indigo-600/40",
    sepia: "text-[#5b4636]/40",
    dark: "text-white/20"
  };

  return (
    <div className="flex flex-col items-center justify-center h-[75vh] text-center p-10 animate-in fade-in zoom-in-95 duration-700">
      <div className="relative mb-12">
        <div className={`p-10 rounded-[3rem] border-2 transition-all duration-500 ${containerBg[theme]}`}>
          <BookOpen 
            size={84} 
            strokeWidth={1.5}
            className={`transition-colors duration-500 ${iconColor[theme]}`} 
          />
        </div>
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-400/10 rounded-full blur-xl"></div>
        <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl"></div>
      </div>
      <h3 className={`text-4xl font-black tracking-tight mb-5 transition-colors duration-500 opacity-50 ${
        theme === 'dark' ? 'text-white/60' : 'text-slate-800/80'
      }`}>
        靈修從此刻開始
      </h3>
      <p className={`max-w-sm text-base font-medium leading-relaxed transition-colors duration-500 ${
        theme === 'dark' ? 'text-white/30' : 'text-slate-400'
      }`}>
        選擇左側日曆中的日期或搜尋書卷，<br />
        開啟您與真理的對話空間。
      </p>
    </div>
  );
};

const VerseText: React.FC<{ text: string; theme: Theme }> = ({ text, theme }) => {
  if (text.trim() === 'a') {
    return <span className="opacity-30 italic font-sans text-[0.8em] tracking-tight">[併入上節]</span>;
  }
  const renderInner = (innerContent: string) => {
    return innerContent.split(/(<br\s*\/?>)/gi).map((sub, j) => 
      /^<br/i.test(sub) ? <br key={j} /> : sub
    );
  };
  const parts = text.split(/(<h2[\s\S]*?<\/h2>|<u[\s\S]*?<\/u>|<br\s*\/?>)/gi);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^<h2/i.test(part)) {
          const content = part.replace(/<\/?h2>/gi, '').trim();
          return (
            <h2 key={i} className={`block text-xl md:text-2xl font-black mb-4 mt-2 tracking-tight transition-colors duration-500 ${
              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
            }`}>
              {renderInner(content)}
            </h2>
          );
        }
        if (/^<u/i.test(part)) {
          const content = part.replace(/<\/?u>/gi, '').trim();
          return (
            <u key={i} className="decoration-slate-400/50 underline-offset-4">
              {renderInner(content)}
            </u>
          );
        }
        if (/^<br/i.test(part)) {
          return <br key={i} />;
        }
        const prevPart = i > 0 ? parts[i-1] : null;
        const displayPart = (prevPart && /^<h2/i.test(prevPart)) ? part.replace(/^\s+/, '') : part;
        return <span key={i}>{displayPart}</span>;
      })}
    </>
  );
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    scheduleText: "馬太福音 1-3\n詩篇 1",
    dailyScheduleJson: JSON.stringify(DEFAULT_DAILY_SCHEDULE, null, 2),
    scheduleMode: 'daily',
    completedTasks: [],
    fontSize: 18,
    theme: 'light',
    primaryVersion: 'unv',
    secondaryVersion: null,
    scheduleHash: ""
  });

  const [input, setInput] = useState('');
  const [migrationInput, setMigrationInput] = useState('');
  const [availableVersions] = useState<VersionInfo[]>(FALLBACK_VERSIONS);
  const [showVersionPicker, setShowVersionPicker] = useState<{ active: boolean, target: 'primary' | 'secondary' }>({ active: false, target: 'primary' });
  const [versionSearch, setVersionSearch] = useState('');
  const [bibleData, setBibleData] = useState<BibleData | null>(null);
  const [parallelData, setParallelData] = useState<BibleVerse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(true);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  
  const PLAN_YEAR = 2026;
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    const today = new Date();
    if (today.getFullYear() !== PLAN_YEAR) return new Date(PLAN_YEAR, 0, 1);
    return today;
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    let mm, dd;
    if (today.getFullYear() === PLAN_YEAR) {
      mm = String(today.getMonth() + 1).padStart(2, '0');
      dd = String(today.getDate()).padStart(2, '0');
    } else {
      mm = "01";
      dd = "01";
    }
    return `${mm}-${dd}`;
  });

  useEffect(() => {
    if (!loading && bibleData) {
      const timer = setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, bibleData?.reference]);

  useEffect(() => {
    const saved = localStorage.getItem('bible_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validIds = FALLBACK_VERSIONS.map(v => v.id);
        if (parsed.primaryVersion && !validIds.includes(parsed.primaryVersion)) {
           parsed.primaryVersion = 'unv';
        }
        if (parsed.secondaryVersion && !validIds.includes(parsed.secondaryVersion)) {
           parsed.secondaryVersion = null;
        }
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    if (isMonthPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMonthPickerOpen]);

  const saveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('bible_settings', JSON.stringify(newSettings));
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    saveSettings(updated);
    return updated; 
  };

  const findBookCode = (text: string) => {
    const lowerText = text.toLowerCase().trim();
    for (const [zh, en] of Object.entries(BIBLE_BOOKS)) {
      if (lowerText.startsWith(zh.toLowerCase())) return { en, zh };
    }
    for (const [alias, full] of Object.entries(BIBLE_ALIASES)) {
      if (lowerText.startsWith(alias.toLowerCase())) {
        return { en: BIBLE_BOOKS[full], zh: full };
      }
    }
    return null;
  };

  const parseScheduleLine = (line: string): ScheduleItem[] => {
    const items: ScheduleItem[] = [];
    const bookInfo = findBookCode(line);
    if (!bookInfo) return items;
    const remaining = line.replace(bookInfo.zh, "").replace(Object.keys(BIBLE_ALIASES).find(a => line.startsWith(a)) || "", "").trim();
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
      const label = startVerse ? `${bookInfo.zh} ${chapter}:${startVerse}${endVerse && endVerse !== startVerse ? '-' + endVerse : ''}` : `${bookInfo.zh} ${chapter}`;
      const id = `${bookInfo.en}${chapter}${startVerse ? ':' + startVerse + (endVerse ? '-' + endVerse : '') : ''}`;
      items.push({ label, book: bookInfo.en, chapter, id, startVerse, endVerse });
    } else {
      const numbers = remaining.match(/\d+/g);
      if (numbers) {
        if (remaining.includes('-') && numbers.length >= 2) {
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
  };

  const getDayPlan = useCallback((dateKey: string): ScheduleItem[] => {
    try {
      const json = JSON.parse(settings.dailyScheduleJson);
      const sourceText = json[dateKey] || "";
      return sourceText.split('\n').filter((l: string) => l.trim()).flatMap(parseScheduleLine);
    } catch (e) {
      return [];
    }
  }, [settings.dailyScheduleJson]);

  const parsedSchedule = useMemo(() => {
    if (settings.scheduleMode === 'static') {
      return settings.scheduleText.split('\n').filter(l => l.trim()).flatMap(parseScheduleLine);
    }
    return getDayPlan(selectedDate);
  }, [settings.scheduleMode, settings.scheduleText, selectedDate, getDayPlan]);

  const navStatus = useMemo(() => {
    if (!bibleData) return { inPlan: false, nextItem: null, prevItem: null };
    const currentBaseId = `${bibleData.bookCode}${bibleData.chapter}`;
    const currentFullId = `${currentBaseId}${bibleData.startVerse ? ':' + bibleData.startVerse + (bibleData.endVerse ? '-' + bibleData.endVerse : '') : ''}`;
    let currentIndex = parsedSchedule.findIndex((item: ScheduleItem) => item.id === currentFullId);
    if (currentIndex === -1) {
        currentIndex = parsedSchedule.findIndex((item: ScheduleItem) => item.id === currentBaseId);
    }
    return {
      inPlan: currentIndex !== -1,
      nextItem: currentIndex !== -1 && currentIndex < parsedSchedule.length - 1 ? parsedSchedule[currentIndex + 1] : null,
      prevItem: currentIndex > 0 ? parsedSchedule[currentIndex - 1] : null
    };
  }, [bibleData, parsedSchedule]);

  const fetchBible = async (
    refInfo: { book: string, chapter: number, startVerse?: number, endVerse?: number, label?: string } | null = null, 
    customPrimary?: string, 
    customSecondary?: string | null
  ) => {
    let search = refInfo;
    if (!search) {
      if (bibleData) {
        search = { book: bibleData.bookCode, chapter: bibleData.chapter };
      } else {
        const parsed = findBookCode(input);
        const numbers = input.match(/\d+/g);
        if (parsed && numbers) {
          search = { book: parsed.en, chapter: parseInt(numbers[0]) };
          if (input.includes(':') && numbers.length >= 2) {
             search.startVerse = parseInt(numbers[1]);
             if (numbers.length >= 3) search.endVerse = parseInt(numbers[2]);
          }
        }
      }
    }
    if (!search || !search.book || !search.chapter) return;
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
        const decoder = new TextDecoder("big5");
        const text = decoder.decode(buffer);
        const data = JSON.parse(text);
        if (data.status !== 'success') { throw new Error(`API Error for ${ver}: ${data.status}`); }
        return data.record.map((r: any) => ({ verse: r.sec, text: r.bible_text }));
      };
      const [data1, data2] = await Promise.all([
        fetchVersion(pVer),
        sVer ? fetchVersion(sVer) : Promise.resolve(null)
      ]);
      const reference = search.label || (search.startVerse 
        ? `${bookZh} ${search.chapter}:${search.startVerse}${search.endVerse && search.endVerse !== search.startVerse ? '-' + search.endVerse : ''}` 
        : `${bookZh} ${search.chapter}`);
      setBibleData({
        reference,
        bookCode: search.book,
        chapter: search.chapter,
        startVerse: search.startVerse,
        endVerse: search.endVerse,
        verses: data1
      });
      setParallelData(data2);
      setInput(reference);
    } catch (err: any) { 
      console.error(err);
      setError("讀取失敗，請檢查網路或稍後再試。"); 
    } finally { 
      setLoading(false); 
    }
  };

  const toggleTask = (id: string) => {
    const isCompleted = settings.completedTasks.includes(id);
    const newTasks = isCompleted ? settings.completedTasks.filter(t => t !== id) : [...settings.completedTasks, id];
    updateSetting('completedTasks', newTasks);
  };

  const markCurrentAsRead = () => {
    if (!bibleData) return;
    const currentId = `${bibleData.bookCode}${bibleData.chapter}${bibleData.startVerse ? ':' + bibleData.startVerse + (bibleData.endVerse ? '-' + bibleData.endVerse : '') : ''}`;
    if (!settings.completedTasks.includes(currentId)) {
      toggleTask(currentId);
      showToast(`已完成：${bibleData.reference}！`);
    }
  };

  const handleExportProgress = () => {
    const data = JSON.stringify(settings.completedTasks);
    navigator.clipboard.writeText(data).then(() => {
      showToast("進度代碼已複製到剪貼簿");
    });
  };

  const handleImportProgress = () => {
    if (!migrationInput.trim()) return;
    try {
      const parsed = JSON.parse(migrationInput);
      if (Array.isArray(parsed)) {
        // Merge with unique values
        const merged = Array.from(new Set([...settings.completedTasks, ...parsed]));
        updateSetting('completedTasks', merged);
        showToast(`匯入成功！已新增 ${merged.length - settings.completedTasks.length} 條紀錄。`);
        setMigrationInput('');
      } else {
        showToast("格式錯誤，請確認貼上的內容是否正確。", "error");
      }
    } catch (e) {
      showToast("解析失敗，請確認代碼完整性。", "error");
    }
  };

  const showToast = (message: string, type: string = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const calendarDays = useMemo(() => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDay = firstDayOfMonth.getDay();
    const days = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const dateKey = `${mm}-${dd}`;
      const plan = getDayPlan(dateKey);
      const hasPlan = plan.length > 0;
      const completedCount = plan.filter((p: ScheduleItem) => settings.completedTasks.includes(p.id)).length;
      const isFullyCompleted = hasPlan && completedCount === plan.length;
      const progress = hasPlan ? (completedCount / plan.length) : 0;
      days.push({ day: i, dateKey, hasPlan, isFullyCompleted, progress });
    }
    return days;
  }, [currentViewDate, getDayPlan, settings.completedTasks]);

  const themes: Record<Theme, string> = {
    light: "bg-white text-slate-900 border-slate-200 shadow-sm",
    sepia: "bg-[#fcf5e5] text-[#5b4636] border-[#eaddc0] shadow-sm",
    dark: "bg-[#1e1e1e] text-[#d1d1d1] border-[#333] shadow-none"
  };

  const bodyBg: Record<Theme, string> = {
    light: "bg-slate-50",
    sepia: "bg-[#f4ecd8]",
    dark: "bg-[#121212]"
  };

  const filteredVersions = useMemo(() => {
    const s = versionSearch.toLowerCase().trim();
    return s ? availableVersions.filter(v => v.id.toLowerCase().includes(s) || v.name.toLowerCase().includes(s)) : availableVersions;
  }, [availableVersions, versionSearch]);

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    const plan = getDayPlan(dateKey);
    if (plan.length > 0) {
      const firstUncompleted = plan.find((item: ScheduleItem) => !settings.completedTasks.includes(item.id));
      const targetItem = firstUncompleted || plan[0];
      fetchBible({ book: targetItem.book, chapter: targetItem.chapter, startVerse: targetItem.startVerse, endVerse: targetItem.endVerse, label: targetItem.label });
    }
  };

  const goToTodayInPlan = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateKey = `${mm}-${dd}`;
    setCurrentViewDate(new Date(PLAN_YEAR, today.getMonth(), today.getDate()));
    handleDayClick(dateKey);
  };

  const handleMonthSelect = (m: number) => {
    setCurrentViewDate(new Date(currentViewDate.getFullYear(), m, 1));
    setIsMonthPickerOpen(false);
  };

  const handleYearSelect = (y: number) => {
    setCurrentViewDate(new Date(y, currentViewDate.getMonth(), 1));
  };

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

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 font-sans ${bodyBg[settings.theme]}`}>
      {toast.show && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success' ? <PartyPopper size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      <nav className={`sticky top-0 z-40 border-b backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 transition-colors duration-500 ${themes[settings.theme]}`}>
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={24} />
          <h1 className="text-lg font-bold text-indigo-600 hidden sm:block tracking-tight">2026 每日讀經</h1>
        </div>
        <div className="flex items-center gap-2 flex-1 max-md:max-w-none max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              className={`w-full pl-4 pr-10 py-2 rounded-xl border-2 outline-none focus:border-indigo-500 transition-all ${settings.theme === 'dark' ? 'bg-black/20 border-white/10 text-white' : 'bg-slate-100 border-transparent'}`}
              placeholder="搜尋書卷... (如: 詩 23)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchBible()}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30" size={18} />
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center bg-black/5 p-1 rounded-xl">
            <button onClick={() => setShowVersionPicker({ active: true, target: 'primary' })} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${settings.theme === 'dark' ? 'hover:bg-white/10 text-white' : 'bg-white shadow-sm'}`}>{settings.primaryVersion}</button>
            <button onClick={() => settings.secondaryVersion ? updateSetting('secondaryVersion', null) : setShowVersionPicker({ active: true, target: 'secondary' })} className={`ml-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${settings.secondaryVersion ? 'bg-indigo-600 text-white' : 'opacity-40 hover:opacity-100'}`}>{settings.secondaryVersion || "+ 譯本對照"}</button>
          </div>
          <button onClick={() => updateSetting('theme', settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'sepia' : 'dark')} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            {settings.theme === 'light' ? <Sun size={20}/> : settings.theme === 'sepia' ? <Coffee size={20}/> : <Moon size={20}/>}
          </button>
        </div>
      </nav>

      <div className="flex-1 w-full max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <section className={`p-5 rounded-3xl border-2 overflow-visible transition-all duration-500 ${themes[settings.theme]}`}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setIsScheduleExpanded(!isScheduleExpanded)} className="font-black text-sm uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity">
                <ChevronDown size={18} className={`text-indigo-600 transition-transform duration-300 ${isScheduleExpanded ? '' : '-rotate-90'}`} />
                {settings.scheduleMode === 'daily' ? '每日計劃' : '讀經清單'}
              </button>
              <div className="flex gap-1">
                <button onClick={goToTodayInPlan} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="回到今天 (2026)"><Target size={16} /></button>
                <button onClick={() => setIsEditingSchedule(!isEditingSchedule)} className={`p-1.5 rounded-lg transition-colors ${isEditingSchedule ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-black/5'}`} title="編輯計劃"><Settings size={16}/></button>
              </div>
            </div>
            {isScheduleExpanded && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {settings.scheduleMode === 'daily' && !isEditingSchedule && (
                  <div className="mb-6">
                    <div className="relative flex items-center justify-between mb-4 px-1">
                      <button onClick={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1))} className="p-1 hover:bg-black/5 rounded-full transition-colors"><ChevronLeft size={16}/></button>
                      <button onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)} className="flex items-center gap-1.5 font-bold text-sm tracking-tight px-3 py-1.5 hover:bg-black/5 rounded-xl transition-all active:scale-95">
                        {currentViewDate.getFullYear()}年 {currentViewDate.getMonth() + 1}月
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <button onClick={() => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1))} className="p-1 hover:bg-black/5 rounded-full transition-colors"><ChevronRight size={16}/></button>
                      {isMonthPickerOpen && (
                        <div ref={monthPickerRef} className={`absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2 w-64 p-4 rounded-2xl shadow-2xl border-2 animate-in fade-in zoom-in-95 duration-200 ${themes[settings.theme]}`}>
                          <div className="flex items-center justify-between mb-4 border-b pb-2">
                            <button onClick={() => handleYearSelect(currentViewDate.getFullYear() - 1)} className="p-1 hover:bg-black/5 rounded-lg"><ChevronLeft size={14}/></button>
                            <span className="font-black text-sm">{currentViewDate.getFullYear()}</span>
                            <button onClick={() => handleYearSelect(currentViewDate.getFullYear() + 1)} className="p-1 hover:bg-black/5 rounded-lg"><ChevronRight size={14}/></button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[0,1,2,3,4,5,6,7,8,9,10,11].map(m => (
                              <button key={m} onClick={() => handleMonthSelect(m)} className={`py-2 rounded-xl text-xs font-bold transition-all ${currentViewDate.getMonth() === m ? 'bg-indigo-600 text-white' : 'hover:bg-black/5'}`}>{m + 1}月</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[10px] uppercase font-black opacity-30 text-center mb-2">
                      {['日','一','二','三','四','五','六'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {calendarDays.map((d, idx) => {
                        if (!d) return <div key={`empty-${idx}`} className="aspect-square"></div>;
                        const isSelected = d.dateKey === selectedDate;
                        const today = new Date();
                        const isActuallyToday = today.getFullYear() === PLAN_YEAR && d.dateKey === `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                        return (
                          <button key={d.dateKey} onClick={() => handleDayClick(d.dateKey)} className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all group ${isSelected ? 'bg-indigo-600 text-white shadow-md z-10' : 'hover:bg-black/5'} ${isActuallyToday && !isSelected ? 'ring-2 ring-indigo-500/30' : ''} ${!d.hasPlan && !isSelected ? 'opacity-20' : ''}`}>
                            {d.day}
                            {d.hasPlan && <div className={`absolute bottom-1.5 h-1 w-1 rounded-full transition-colors ${isSelected ? 'bg-white' : d.isFullyCompleted ? 'bg-green-500' : d.progress > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isEditingSchedule ? (
                  <div className="space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex gap-2 p-1 bg-black/5 rounded-xl">
                       <button onClick={() => updateSetting('scheduleMode', 'static')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${settings.scheduleMode === 'static' ? 'bg-white shadow-sm text-indigo-600' : 'opacity-40 hover:opacity-100'}`}>靜態</button>
                       <button onClick={() => updateSetting('scheduleMode', 'daily')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${settings.scheduleMode === 'daily' ? 'bg-white shadow-sm text-indigo-600' : 'opacity-40 hover:opacity-100'}`}>每日 (JSON)</button>
                    </div>
                    {settings.scheduleMode === 'static' ? (
                      <textarea className="w-full h-40 text-sm p-3 rounded-xl border-2 bg-black/5 outline-none focus:border-indigo-500 font-mono resize-none" value={settings.scheduleText} onChange={(e) => setSettings({...settings, scheduleText: e.target.value})} placeholder="格式：馬太 1-3" />
                    ) : (
                      <textarea className="w-full h-40 text-[10px] p-3 rounded-xl border-2 bg-black/5 outline-none focus:border-indigo-500 font-mono resize-none" value={settings.dailyScheduleJson} onChange={(e) => setSettings({...settings, dailyScheduleJson: e.target.value})} placeholder='{"01-01": "太 1"}' />
                    )}
                    
                    {/* Progress Migration Section */}
                    <div className="pt-4 border-t border-black/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase opacity-50">進度遷移與備份</span>
                        <span className="text-[10px] font-bold text-indigo-600">已完成 {settings.completedTasks.length} 章</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleExportProgress} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 text-[10px] font-black hover:bg-indigo-100 transition-colors">
                          <Download size={14} /> 匯出進度
                        </button>
                        <button onClick={handleImportProgress} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-white text-[10px] font-black hover:bg-black transition-colors">
                          <Upload size={14} /> 匯入進度
                        </button>
                      </div>
                      <input 
                        type="text" 
                        className="w-full text-[9px] p-3 rounded-xl border-2 bg-black/5 outline-none focus:border-indigo-500 font-mono"
                        placeholder="在此貼上匯出的進度代碼..."
                        value={migrationInput}
                        onChange={(e) => setMigrationInput(e.target.value)}
                      />
                    </div>

                    <button onClick={() => { setIsEditingSchedule(false); saveSettings(settings); showToast("計劃與進度已儲存"); }} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"><Save size={18}/> 儲存並關閉</button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    <div className="mb-2 px-1">
                      <span className="text-[10px] font-black uppercase text-indigo-600/50">{settings.scheduleMode === 'daily' ? `${selectedDate} 的章節` : '所有章節'}</span>
                    </div>
                    {parsedSchedule.length > 0 ? parsedSchedule.map((item: ScheduleItem) => (
                      <button key={item.id} className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${settings.completedTasks.includes(item.id) ? 'bg-green-500/10 border-green-500/20' : 'bg-black/5 border-transparent hover:border-indigo-300'}`} onClick={() => fetchBible({ book: item.book, chapter: item.chapter, startVerse: item.startVerse, endVerse: item.endVerse, label: item.label })}>
                        <span className={`text-sm font-bold truncate ${settings.completedTasks.includes(item.id) ? 'line-through opacity-30 italic' : ''}`}>{item.label}</span>
                        <div onClick={(e) => { e.stopPropagation(); toggleTask(item.id); }} className={`p-1 ${settings.completedTasks.includes(item.id) ? 'text-green-500' : 'text-slate-300 hover:text-indigo-400'} transition-colors cursor-pointer`}>
                          <CheckCircle2 size={18} fill={settings.completedTasks.includes(item.id) ? "currentColor" : "none"} />
                        </div>
                      </button>
                    )) : (
                      <div className="text-center py-10 opacity-30 border-2 border-dashed rounded-2xl flex flex-col items-center">
                        <FileText size={32} className="mb-2" />
                        <p className="text-[10px] font-bold uppercase">本日無指定內容</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </aside>

        <main className="lg:col-span-3">
          {loading ? (
            <LoadingView theme={settings.theme} />
          ) : error ? (
            <div className="bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 p-8 rounded-[2.5rem] flex gap-4 animate-in shake duration-500">
              <AlertCircle size={24}/><p className="font-bold">{error}</p>
            </div>
          ) : bibleData ? (
            <div className={`rounded-[2.5rem] border-2 overflow-hidden shadow-2xl shadow-indigo-100/10 transition-colors duration-500 animate-in fade-in duration-700 ${themes[settings.theme]}`}>
              <div className="px-8 md:px-12 py-10 border-b flex items-center justify-between bg-black/[0.01]">
                <div>
                  <h2 className="text-4xl font-black tracking-tight">{bibleData.reference}</h2>
                  <div className="flex gap-2 mt-4">
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-600 text-white uppercase tracking-wider">{settings.primaryVersion}</span>
                    {settings.secondaryVersion && <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white uppercase tracking-wider">{settings.secondaryVersion}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-black/5 p-1 rounded-2xl">
                   <button onClick={() => updateSetting('fontSize', Math.max(12, settings.fontSize - 2))} className="p-3 hover:bg-white rounded-xl transition-all"><Type size={16}/></button>
                   <button onClick={() => updateSetting('fontSize', Math.min(36, settings.fontSize + 2))} className="p-3 hover:bg-white rounded-xl transition-all"><Type size={24}/></button>
                </div>
              </div>
              <div className="p-8 md:p-20 pb-32">
                <div className={`grid gap-x-12 gap-y-16 ${parallelData ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`} style={{ fontSize: `${settings.fontSize}px` }}>
                  {filteredVerses.map((v, i) => (
                    <React.Fragment key={i}>
                      <div className="flex gap-6 md:gap-10 items-start group relative">
                        <span className="text-[0.6em] font-black text-indigo-500/20 w-8 text-right mt-3 shrink-0 group-hover:text-indigo-500 transition-colors">{v.verse}</span>
                        <div className={`leading-relaxed font-serif whitespace-pre-wrap flex-1 text-justify ${
                          settings.theme === 'dark' ? 'text-[#d1d1d1]' : settings.theme === 'sepia' ? 'text-[#5b4636]' : 'text-slate-900'
                        }`}>
                          <VerseText text={v.text} theme={settings.theme} />
                        </div>
                      </div>
                      {parallelData && (
                        <div className={`flex gap-6 md:gap-10 items-start p-6 md:p-10 rounded-3xl transition-colors duration-500 ${
                          settings.theme === 'dark' ? 'bg-white/[0.03]' : settings.theme === 'sepia' ? 'bg-[#5b4636]/[0.02]' : 'bg-indigo-500/[0.02]'
                        }`}>
                          <span className="text-[0.6em] font-black text-emerald-500/20 w-8 text-right mt-3 shrink-0">{filteredParallel && filteredParallel[i] ? filteredParallel[i].verse : v.verse}</span>
                          <div className={`leading-relaxed font-serif italic whitespace-pre-wrap flex-1 text-justify ${
                            settings.theme === 'dark' ? 'text-white/40' : settings.theme === 'sepia' ? 'text-[#5b4636]/60' : 'text-slate-500'
                          }`}>
                            {filteredParallel && filteredParallel[i] ? <VerseText text={filteredParallel[i].text} theme={settings.theme} /> : <span className="opacity-20 italic">無此節對應內容</span>}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="mt-40 border-t pt-24 text-center space-y-12">
                  <button onClick={markCurrentAsRead} className={`px-16 py-8 rounded-[3rem] font-black text-2xl transition-all shadow-2xl flex items-center gap-4 mx-auto hover:scale-105 active:scale-95 ${settings.completedTasks.includes(`${bibleData.bookCode}${bibleData.chapter}${bibleData.startVerse ? ':' + bibleData.startVerse + (bibleData.endVerse ? '-' + bibleData.endVerse : '') : ''}`) ? 'bg-green-600 text-white shadow-green-100' : 'bg-indigo-600 text-white shadow-indigo-100'}`}>
                    {settings.completedTasks.includes(`${bibleData.bookCode}${bibleData.chapter}${bibleData.startVerse ? ':' + bibleData.startVerse + (bibleData.endVerse ? '-' + bibleData.endVerse : '') : ''}`) ? <CheckCircle2 size={36}/> : <PartyPopper size={36}/>}
                    {settings.completedTasks.includes(`${bibleData.bookCode}${bibleData.chapter}${bibleData.startVerse ? ':' + bibleData.startVerse + (bibleData.endVerse ? '-' + bibleData.endVerse : '') : ''}`) ? "今日已讀" : "讀完了！"}
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-6">
                    <button onClick={handleScrollToTop} className="px-8 py-4 rounded-2xl bg-black/5 font-bold flex items-center gap-2 hover:bg-black/10 transition-colors uppercase text-xs tracking-widest"><ChevronUp size={18}/> 回到頂部</button>
                    {navStatus.inPlan ? (
                      navStatus.nextItem && (
                        <button onClick={() => fetchBible({ book: navStatus.nextItem!.book, chapter: navStatus.nextItem!.chapter, startVerse: navStatus.nextItem!.startVerse, endVerse: navStatus.nextItem!.endVerse, label: navStatus.nextItem!.label })} className="px-10 py-4 rounded-2xl bg-indigo-600 text-white font-bold flex items-center gap-3 shadow-xl hover:bg-indigo-700 hover:translate-x-1 transition-all">繼續讀經 <ChevronRightIcon size={20}/></button>
                      )
                    ) : (
                      <div className="flex gap-4">
                        <button onClick={() => fetchBible({ book: bibleData.bookCode, chapter: Math.max(1, bibleData.chapter - 1) })} className="px-8 py-4 rounded-2xl bg-slate-100 font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors"><ChevronLeft size={18}/> 上一章</button>
                        <button onClick={() => fetchBible({ book: bibleData.bookCode, chapter: bibleData.chapter + 1 })} className="px-8 py-4 rounded-2xl bg-slate-800 text-white font-bold flex items-center gap-2 hover:bg-black transition-colors">下一章 <ChevronRight size={18}/></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState theme={settings.theme} />
          )}
        </main>
      </div>

      <footer className={`mt-24 py-20 border-t transition-colors duration-500 ${
        settings.theme === 'dark' ? 'border-white/5 text-white/30' : 
        settings.theme === 'sepia' ? 'border-[#5b4636]/10 text-[#5b4636]/50' : 
        'border-slate-200/40 text-slate-400/80'
      }`}>
        <div className="max-w-3xl mx-auto px-6 text-center space-y-8">
          <div className="space-y-2">
            <h4 className={`text-xs font-black uppercase tracking-widest ${
              settings.theme === 'dark' ? 'text-white/40' : 
              settings.theme === 'sepia' ? 'text-[#5b4636]/60' : 
              'text-slate-500'
            }`}>資料來源與版權聲明</h4>
            <div className={`h-1 w-8 mx-auto rounded-full ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`} />
          </div>
          <div className="text-[11px] space-y-4 leading-loose font-medium opacity-60">
            <p>本站聖經經文與研經資料，取自<br className="sm:hidden" />信望愛（FHL）聖經資料庫所提供之公開 API<br />資料來源：<a href="https://bible.fhl.net" target="_blank" rel="noopener noreferrer" className="hover:underline hover:opacity-100 transition-opacity decoration-indigo-300 underline-offset-2 font-bold">https://bible.fhl.net</a></p>
            <p>各聖經譯本之著作權分屬原著作權人所有，本站僅透過 API 即時呈現相關內容，僅供閱讀與學習使用。</p>
            <p>信望愛長期致力於聖經資料的整理、維護與開放，並鼓勵基督徒開發者善用其 API 服事更多人。<br />若您對完整資料或研經工具有興趣，請造訪 <a href="https://bible.fhl.net" target="_blank" rel="noopener noreferrer" className="hover:underline hover:opacity-100 transition-opacity decoration-indigo-300 underline-offset-2 font-bold">信望愛官方網站</a>。</p>
          </div>
          <div className={`pt-8 border-t border-transparent text-[10px] italic opacity-40 ${
            settings.theme === 'dark' ? 'text-white/20' : 
            settings.theme === 'sepia' ? 'text-[#5b4636]/30' : 
            'text-slate-400'
          }`}>本站為獨立開發之工具，與信望愛網站無隸屬或代表關係。</div>
        </div>
      </footer>

      {showVersionPicker.active && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-[3.5rem] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border-2 animate-in zoom-in-95 duration-300 transition-colors duration-500 ${themes[settings.theme]}`}>
            <div className="p-12 border-b bg-black/[0.01]">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-4xl font-black tracking-tight">聖經譯本</h3>
                  <p className="text-slate-400 text-sm mt-1 font-medium">切換不同譯本以獲得更深度的理解</p>
                </div>
                <button onClick={() => setShowVersionPicker({ ...showVersionPicker, active: false })} className="p-3 hover:bg-black/5 rounded-full transition-colors"><X size={32}/></button>
              </div>
              <div className="relative">
                <input type="text" placeholder="搜尋譯本名稱或簡稱..." className={`w-full px-8 py-5 rounded-[1.8rem] border-2 outline-none focus:border-indigo-500 transition-all font-bold ${settings.theme === 'dark' ? 'bg-black/20 border-white/10 text-white' : 'bg-slate-100 border-transparent'}`} value={versionSearch} onChange={(e) => setVersionSearch(e.target.value)} />
                <Search className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20" size={24} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-12 pt-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredVersions.map(ver => {
                  const isActive = (showVersionPicker.target === 'primary' ? settings.primaryVersion : settings.secondaryVersion) === ver.id;
                  return (
                    <button key={`${ver.id}`} onClick={() => {
                      const isPrimary = showVersionPicker.target === 'primary';
                      const updated = updateSetting(isPrimary ? 'primaryVersion' : 'secondaryVersion', ver.id);
                      setShowVersionPicker({ ...showVersionPicker, active: false });
                      if (bibleData) {
                        fetchBible({ book: bibleData.bookCode, chapter: bibleData.chapter, startVerse: bibleData.startVerse, endVerse: bibleData.endVerse, label: bibleData.reference }, updated.primaryVersion, updated.secondaryVersion);
                      }
                    }} className={`text-left p-6 rounded-[2rem] border-2 transition-all flex justify-between items-center group ${isActive ? 'border-indigo-600 bg-indigo-600/10' : 'bg-black/5 border-transparent hover:border-indigo-300 hover:bg-white'}`}>
                      <div className="min-w-0 pr-4">
                        <div className="font-black text-indigo-600 text-lg flex items-center gap-2">{ver.id} <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">{ver.lang}</span></div>
                        <div className="text-xs opacity-50 truncate mt-1 font-bold">{ver.name}</div>
                      </div>
                      {isActive && <CheckCircle2 size={24} className="text-indigo-600" />}
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
