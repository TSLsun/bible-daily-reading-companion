
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
}

export interface AppSettings {
  scheduleText: string;
  dailyScheduleJson: string;
  scheduleMode: ScheduleMode;
  completedTasks: string[];
  fontSize: number;
  theme: Theme;
  primaryVersion: string;
  secondaryVersion: string | null;
  scheduleHash: string;
}

export interface ScheduleItem {
  label: string;
  book: string;
  chapter: number;
  id: string;
}

export interface VersionInfo {
  id: string;
  name: string;
  lang: string;
}
