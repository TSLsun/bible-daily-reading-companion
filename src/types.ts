
export type Theme = 'light' | 'sepia' | 'dark';
export type ScheduleMode = 'static' | 'daily';

export interface BibleVerse {
  verse: number;
  text: string;
}

export interface BibleData {
  reference: string;
  bookCode: string;
  chapter: number;
  verses: BibleVerse[];
  startVerse?: number;
  endVerse?: number;
}

export interface AppSettings {
  scheduleText: string;
  dailyScheduleJson: string;
  scheduleMode: ScheduleMode;
  completedTasks: string[];
  fontSize: number;
  lineHeight: number;
  theme: Theme;
  accent: string;
  primaryVersion: string;
  secondaryVersion: string | null;
  scheduleHash: string;
  fontStyle: string;
}

export interface ScheduleItem {
  label: string;
  book: string;
  chapter: number;
  id: string;
  startVerse?: number;
  endVerse?: number;
}

export interface VersionInfo {
  id: string;
  name: string;
  lang: string;
}

export interface SearchResult {
  bookCode: string;   // API book code, e.g. 'Joh', 'Mt', '約一'
  bookZh: string;     // Full Chinese book name, e.g. '約翰福音'
  chapter: number;
  verse: number;
  text: string;
}
