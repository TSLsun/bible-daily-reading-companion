import { ScheduleItem } from '../types';
import { findBookCode } from './bible-lookup';

export function buildVerseId(bookCode: string, chapter: number, startVerse?: number, endVerse?: number): string {
  return `${bookCode}${chapter}${startVerse ? ':' + startVerse + (endVerse && endVerse !== startVerse ? '-' + endVerse : '') : ''}`;
}

export function parseScheduleLine(line: string): ScheduleItem[] {
  const segments = line.split('、');
  if (segments.length > 1) {
    return segments.flatMap(seg => parseScheduleLine(seg.trim()));
  }

  const items: ScheduleItem[] = [];
  const bookInfo = findBookCode(line);
  if (!bookInfo) return items;
  const remaining = line.slice(bookInfo.matchedLen).trim();

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
    const label = startVerse
      ? `${bookInfo.zh} ${chapter}:${startVerse}${endVerse && endVerse !== startVerse ? '-' + endVerse : ''}`
      : `${bookInfo.zh} ${chapter}`;
    const id = buildVerseId(bookInfo.en, chapter, startVerse, endVerse);
    items.push({ label, book: bookInfo.en, chapter, id, startVerse, endVerse });
  } else {
    const numericPart = remaining.split(/[^\d-]/)[0];
    const numbers = numericPart.match(/\d+/g);
    if (numbers) {
      if (numericPart.includes('-') && numbers.length >= 2) {
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
}

export function getDayPlan(dateKey: string, scheduleJson: string): ScheduleItem[] {
  try {
    const json = JSON.parse(scheduleJson);
    const sourceText: string = json[dateKey] || '';
    const items = sourceText.split('\n').filter(l => l.trim()).flatMap(parseScheduleLine);
    return items.map(item => ({ ...item, id: `${dateKey}:${item.id}` }));
  } catch {
    return [];
  }
}
