export const WORKER_URL: string =
  import.meta.env.VITE_SYNC_WORKER_URL ?? 'http://localhost:8787';

export interface KvSyncData {
  version: number;
  completedTasks: Record<string, string[]>;
  updatedAt: string;
  lastDeviceId: string;
}

export function flatToKvMap(tasks: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const task of tasks) {
    const colonIdx = task.indexOf(':');
    if (colonIdx === -1) continue;
    const date = task.slice(0, colonIdx);
    const rest = task.slice(colonIdx + 1);
    (map[date] ??= []).push(rest);
  }
  return map;
}

export function kvMapToFlat(map: Record<string, string[]>): string[] {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, items]) => items.map(item => `${date}:${item}`));
}

export function mergeTasks(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}
