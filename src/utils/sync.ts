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

export async function pullSync(
  syncId: string,
  deviceId: string,
  localTasks: string[],
  workerUrl: string = WORKER_URL
): Promise<{ mergedTasks: string[]; needsReconciliation: boolean }> {
  const res = await fetch(`${workerUrl}/sync/${syncId}`);

  if (res.status === 404) {
    return {
      mergedTasks: localTasks,
      needsReconciliation: localTasks.length > 0,
    };
  }

  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

  const remote = await res.json() as KvSyncData;
  const remoteTasks = kvMapToFlat(remote.completedTasks);
  const mergedTasks = mergeTasks(localTasks, remoteTasks);

  const needsReconciliation =
    mergedTasks.length > remoteTasks.length &&
    remote.lastDeviceId !== deviceId;

  return { mergedTasks, needsReconciliation };
}

export async function pushSync(
  syncId: string,
  deviceId: string,
  localTasks: string[],
  workerUrl: string = WORKER_URL
): Promise<string[]> {
  const body: KvSyncData = {
    version: 1,
    completedTasks: flatToKvMap(localTasks),
    updatedAt: new Date().toISOString(),
    lastDeviceId: deviceId,
  };

  const res = await fetch(`${workerUrl}/sync/${syncId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

  const merged = await res.json() as KvSyncData;
  return kvMapToFlat(merged.completedTasks);
}
