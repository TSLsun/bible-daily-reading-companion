import { BIBLE_ALIASES, BIBLE_BOOKS } from '../constants';
import { SearchResult } from '../types';

interface RawRecord {
  chineses: string;
  engs: string;
  chap: number;
  sec: number;
  bible_text: string;
}

export function resolveBookCode(chineses: string): string {
  const fullName = BIBLE_ALIASES[chineses] ?? chineses;
  return BIBLE_BOOKS[fullName] ?? chineses;
}

export function resolveBookZh(chineses: string): string {
  return BIBLE_ALIASES[chineses] ?? chineses;
}

export function parseSearchResponse(records: RawRecord[]): SearchResult[] {
  return records.map(r => ({
    bookCode: resolveBookCode(r.chineses),
    bookZh: resolveBookZh(r.chineses),
    chapter: r.chap,
    verse: r.sec,
    text: r.bible_text,
  }));
}

export async function searchBible(query: string, version: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://bible.fhl.net/json/se.php?VERSION=${version}&q=${encodeURIComponent(query)}&gb=0`
  );
  const buf = await res.arrayBuffer();
  const text = new TextDecoder('big5').decode(buf);
  const data = JSON.parse(text);
  if (data.status !== 'success' || !Array.isArray(data.record)) return [];
  return parseSearchResponse(data.record);
}
