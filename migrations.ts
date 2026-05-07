import { BIBLE_BOOKS, BIBLE_ALIASES } from './constants';

const HAS_YEAR_PREFIX = /^\d{4}-\d{2}-\d{2}:/;
const HAS_DATE_PREFIX = /^\d{2}-\d{2}:/;

export function migrateScheduleJson(json: string, year: number): string {
  try {
    const scheduleObj = JSON.parse(json);
    const keys = Object.keys(scheduleObj);
    if (keys.length === 0) return json;
    const isOldFormat = keys.every(k => /^\d{2}-\d{2}$/.test(k));
    if (!isOldFormat) return json;
    const upgraded: Record<string, string> = {};
    for (const [k, v] of Object.entries(scheduleObj)) {
      upgraded[`${year}-${k}`] = v as string;
    }
    return JSON.stringify(upgraded, null, 2);
  } catch {
    return json;
  }
}

function parseBareIds(text: string): string[] {
  const ids: string[] = [];
  const lines = text.split('\n').filter(Boolean);
  for (const line of lines) {
    for (const seg of line.split('、')) {
      const s = seg.trim();
      let bookEn: string | null = null;
      let matchedLen = 0;
      outer: {
        for (const [zh, en] of Object.entries(BIBLE_BOOKS)) {
          if (s.toLowerCase().startsWith(zh.toLowerCase())) {
            bookEn = en; matchedLen = zh.length; break outer;
          }
        }
        for (const [alias, full] of Object.entries(BIBLE_ALIASES)) {
          if (s.toLowerCase().startsWith(alias.toLowerCase())) {
            bookEn = BIBLE_BOOKS[full]; matchedLen = alias.length; break outer;
          }
        }
      }
      if (!bookEn) continue;
      const rest = s.slice(matchedLen).trim();
      if (rest.includes(':')) {
        const [chStr, verStr] = rest.split(':');
        const ch = parseInt(chStr);
        const vNums = verStr.match(/\d+/g);
        if (vNums && vNums.length >= 2) ids.push(`${bookEn}${ch}:${vNums[0]}-${vNums[1]}`);
        else if (vNums) ids.push(`${bookEn}${ch}:${vNums[0]}`);
      } else {
        const numericPart = rest.split(/[^\d-]/)[0];
        const nums = numericPart.match(/\d+/g);
        if (!nums) continue;
        if (numericPart.includes('-') && nums.length >= 2) {
          for (let i = parseInt(nums[0]); i <= parseInt(nums[1]); i++) ids.push(`${bookEn}${i}`);
        } else {
          for (const n of nums) ids.push(`${bookEn}${parseInt(n)}`);
        }
      }
    }
  }
  return ids;
}

export function migrateCompletedTasks(
  tasks: string[],
  schedule: Record<string, string>
): string[] {
  const needsMigration = tasks.some(id => !HAS_YEAR_PREFIX.test(id));
  if (!needsMigration) return tasks;

  const bareToFull = new Map<string, string>();
  const dateToFull = new Map<string, string>();
  for (const [dateKey, text] of Object.entries(schedule)) {
    const mmDdKey = dateKey.length === 10 ? dateKey.slice(5) : dateKey;
    for (const bareId of parseBareIds(text)) {
      const fullId = `${dateKey}:${bareId}`;
      if (!bareToFull.has(bareId)) bareToFull.set(bareId, fullId);
      dateToFull.set(`${mmDdKey}:${bareId}`, fullId);
    }
  }

  return tasks.map(id => {
    if (HAS_YEAR_PREFIX.test(id)) return id;
    if (HAS_DATE_PREFIX.test(id)) return dateToFull.get(id) ?? id;
    return bareToFull.get(id) ?? id;
  });
}
