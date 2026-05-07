import { BIBLE_BOOKS, BIBLE_ALIASES } from '../constants';

export function findBookCode(text: string): { en: string; zh: string; matchedLen: number } | null {
  const lowerText = text.toLowerCase().trim();
  for (const [zh, en] of Object.entries(BIBLE_BOOKS)) {
    if (lowerText.startsWith(zh.toLowerCase())) return { en, zh, matchedLen: zh.length };
  }
  for (const [alias, full] of Object.entries(BIBLE_ALIASES)) {
    if (lowerText.startsWith(alias.toLowerCase())) {
      return { en: BIBLE_BOOKS[full], zh: full, matchedLen: alias.length };
    }
  }
  return null;
}
