# Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in cross-device sync of `completedTasks` via Cloudflare Worker + KV, with manual push/pull, UUID-based sync identity, and write-loop prevention via per-device ID.

**Architecture:** Users generate a `syncId` on Device 1 and enter it on Device 2+. Each device also has a private `deviceId` to prevent reconciliation write loops. A Cloudflare Worker handles GET/PUT with server-side union merge. Client sync logic lives in `src/utils/sync.ts`; UI is a `SyncSection` component whose local state is lifted into App to survive re-renders.

**Tech Stack:** React 19 + TypeScript, Cloudflare Workers + KV, `qrcode.react` for QR display, Vitest for unit tests, `wrangler` for Worker deploy.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/types.ts` | Modify | Add `syncId`, `deviceId`, `lastSyncedAt` to `AppSettings` |
| `src/App.tsx` | Modify | `deviceId` auto-init, sync state, handlers, `SyncSection`, UI wiring |
| `src/utils/sync.ts` | Create | Sync utility: `flatToKvMap`, `kvMapToFlat`, `mergeTasks`, `pullSync`, `pushSync` |
| `src/utils/sync.test.ts` | Create | Unit tests for all sync functions |
| `worker/index.ts` | Create | Cloudflare Worker — GET/PUT endpoints with server-side union |
| `worker/wrangler.toml` | Create | Worker deploy config — **must update KV IDs after create** |
| `worker/tsconfig.json` | Create | TypeScript config targeting Cloudflare Workers runtime |
| `worker/package.json` | Create | Worker-specific deps (`wrangler`, `@cloudflare/workers-types`) |

---

### Task 1: Update AppSettings type and default state

**Files:**
- Modify: `src/types.ts`
- Modify: `src/App.tsx` (useState default ~line 451, loadSettings useEffect ~line 720)

- [ ] **Step 1: Add three fields to AppSettings**

In `src/types.ts`, replace the existing `AppSettings` interface with:

```typescript
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
  syncId: string | null;
  deviceId: string;
  lastSyncedAt: string | null;
}
```

- [ ] **Step 2: Add defaults to useState in App.tsx**

Find the `useState<AppSettings>({` block (around line 451). After `fontStyle: 'serif',` add:

```typescript
    syncId: null,
    deviceId: '',
    lastSyncedAt: null,
```

- [ ] **Step 3: Auto-generate deviceId in loadSettings useEffect**

In the loadSettings `useEffect` (around line 720), find the inner `setSettings(prev => { const next = { ...prev, ...parsed }` call. Update it to generate `deviceId` if missing:

```typescript
        setSettings(prev => {
          const next = { ...prev, ...parsed };
          if (!next.deviceId) next.deviceId = crypto.randomUUID();
          localStorage.setItem('bible_settings', JSON.stringify(next));
          return next;
        });
```

Then handle first-run (no saved settings). After the `if (saved) { ... }` block, immediately before `setSettingsInitialized(true)`, add:

```typescript
    setSettings(prev => {
      if (prev.deviceId) return prev;
      const next = { ...prev, deviceId: crypto.randomUUID() };
      localStorage.setItem('bible_settings', JSON.stringify(next));
      return next;
    });
```

- [ ] **Step 4: Run lint and tests**

```bash
npm run lint && npm run test
```

Expected: 0 lint errors, all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/App.tsx
git commit -m "feat: add syncId, deviceId, lastSyncedAt to AppSettings"
```

---

### Task 2: Create sync utility — pure functions and tests

**Files:**
- Create: `src/utils/sync.ts`
- Create: `src/utils/sync.test.ts`

- [ ] **Step 1: Write failing tests for pure functions**

Create `src/utils/sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flatToKvMap, kvMapToFlat, mergeTasks, KvSyncData } from './sync';

describe('flatToKvMap', () => {
  it('converts flat array to date-keyed map', () => {
    expect(flatToKvMap(['2026-01-01:Mt1', '2026-01-01:Mt2', '2026-01-02:Mk1']))
      .toEqual({ '2026-01-01': ['Mt1', 'Mt2'], '2026-01-02': ['Mk1'] });
  });

  it('preserves extra colons in task body (verse ranges like Ps119:1-16)', () => {
    expect(flatToKvMap(['2026-04-29:Ps119:1-16']))
      .toEqual({ '2026-04-29': ['Ps119:1-16'] });
  });

  it('handles empty array', () => {
    expect(flatToKvMap([])).toEqual({});
  });

  it('skips malformed entries without a colon', () => {
    expect(flatToKvMap(['no-colon-here'])).toEqual({});
  });
});

describe('kvMapToFlat', () => {
  it('converts date-keyed map to sorted flat array', () => {
    expect(kvMapToFlat({ '2026-01-02': ['Mk1'], '2026-01-01': ['Mt1'] }))
      .toEqual(['2026-01-01:Mt1', '2026-01-02:Mk1']);
  });

  it('handles empty map', () => {
    expect(kvMapToFlat({})).toEqual([]);
  });

  it('round-trips with flatToKvMap', () => {
    const original = ['2026-01-01:Mt1', '2026-01-02:Mk1', '2026-04-29:Ps119:1-16'];
    expect(kvMapToFlat(flatToKvMap(original))).toEqual(original);
  });
});

describe('mergeTasks', () => {
  it('returns union of two arrays', () => {
    expect(mergeTasks(['2026-01-01:Mt1', '2026-01-02:Mk1'], ['2026-01-01:Mt1', '2026-01-03:Lk1']))
      .toEqual(['2026-01-01:Mt1', '2026-01-02:Mk1', '2026-01-03:Lk1']);
  });

  it('deduplicates identical entries', () => {
    expect(mergeTasks(['2026-01-01:Mt1'], ['2026-01-01:Mt1'])).toEqual(['2026-01-01:Mt1']);
  });

  it('handles first array empty', () => {
    expect(mergeTasks([], ['2026-01-01:Mt1'])).toEqual(['2026-01-01:Mt1']);
  });

  it('handles second array empty', () => {
    expect(mergeTasks(['2026-01-01:Mt1'], [])).toEqual(['2026-01-01:Mt1']);
  });

  it('handles both arrays empty', () => {
    expect(mergeTasks([], [])).toEqual([]);
  });

  it('returns sorted output', () => {
    expect(mergeTasks(['2026-01-03:Lk1'], ['2026-01-01:Mt1']))
      .toEqual(['2026-01-01:Mt1', '2026-01-03:Lk1']);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test src/utils/sync.test.ts
```

Expected: FAIL with "Cannot find module './sync'"

- [ ] **Step 3: Implement pure functions**

Create `src/utils/sync.ts`:

```typescript
export const WORKER_URL: string =
  (import.meta.env['VITE_SYNC_WORKER_URL'] as string | undefined) ?? 'http://localhost:8787';

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
```

- [ ] **Step 4: Run tests**

```bash
npm run test src/utils/sync.test.ts
```

Expected: all pure function tests pass.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/sync.ts src/utils/sync.test.ts
git commit -m "feat: add sync utility pure functions (flatToKvMap, kvMapToFlat, mergeTasks)"
```

---

### Task 3: Add async sync functions and tests

**Files:**
- Modify: `src/utils/sync.ts` (append)
- Modify: `src/utils/sync.test.ts` (append)

- [ ] **Step 1: Write failing tests for pullSync and pushSync**

Append to `src/utils/sync.test.ts` (after the `mergeTasks` describe block):

```typescript
import { pullSync, pushSync } from './sync';

describe('pullSync', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns local tasks unchanged when remote is 404', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ ok: false, status: 404 });
    const result = await pullSync('uuid-1', 'device-1', ['2026-01-01:Mt1'], 'http://test');
    expect(result.mergedTasks).toEqual(['2026-01-01:Mt1']);
  });

  it('needsReconciliation true when 404 and local has tasks', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ ok: false, status: 404 });
    const result = await pullSync('uuid-1', 'device-1', ['2026-01-01:Mt1'], 'http://test');
    expect(result.needsReconciliation).toBe(true);
  });

  it('needsReconciliation false when 404 and local is empty', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ ok: false, status: 404 });
    const result = await pullSync('uuid-1', 'device-1', [], 'http://test');
    expect(result.needsReconciliation).toBe(false);
  });

  it('merges local and remote tasks', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200,
      json: async (): Promise<KvSyncData> => ({
        version: 1, completedTasks: { '2026-01-02': ['Mk1'] },
        updatedAt: '2026-05-23T00:00:00Z', lastDeviceId: 'other-device',
      }),
    });
    const result = await pullSync('uuid-1', 'device-1', ['2026-01-01:Mt1'], 'http://test');
    expect(result.mergedTasks).toEqual(['2026-01-01:Mt1', '2026-01-02:Mk1']);
  });

  it('needsReconciliation false when lastDeviceId matches own deviceId', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200,
      json: async (): Promise<KvSyncData> => ({
        version: 1, completedTasks: {},
        updatedAt: '', lastDeviceId: 'device-1',
      }),
    });
    const result = await pullSync('uuid-1', 'device-1', ['2026-01-01:Mt1'], 'http://test');
    expect(result.needsReconciliation).toBe(false);
  });

  it('needsReconciliation true when remote lacks local tasks and different device wrote last', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200,
      json: async (): Promise<KvSyncData> => ({
        version: 1, completedTasks: {},
        updatedAt: '', lastDeviceId: 'other-device',
      }),
    });
    const result = await pullSync('uuid-1', 'device-1', ['2026-01-01:Mt1'], 'http://test');
    expect(result.needsReconciliation).toBe(true);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ ok: false, status: 500 });
    await expect(pullSync('uuid-1', 'device-1', [], 'http://test'))
      .rejects.toThrow('Sync failed: 500');
  });
});

describe('pushSync', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sends PUT to correct URL with correct body shape', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200,
      json: async (): Promise<KvSyncData> => ({
        version: 1, completedTasks: { '2026-01-01': ['Mt1'] },
        updatedAt: '2026-05-23T00:00:00Z', lastDeviceId: 'device-1',
      }),
    });
    await pushSync('uuid-1', 'device-1', ['2026-01-01:Mt1'], 'http://test');

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test/sync/uuid-1');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string) as KvSyncData;
    expect(body.lastDeviceId).toBe('device-1');
    expect(body.completedTasks).toEqual({ '2026-01-01': ['Mt1'] });
  });

  it('returns merged tasks from server response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200,
      json: async (): Promise<KvSyncData> => ({
        version: 1,
        completedTasks: { '2026-01-01': ['Mt1'], '2026-01-02': ['Mk1'] },
        updatedAt: '', lastDeviceId: 'device-1',
      }),
    });
    const result = await pushSync('uuid-1', 'device-1', ['2026-01-01:Mt1'], 'http://test');
    expect(result).toContain('2026-01-01:Mt1');
    expect(result).toContain('2026-01-02:Mk1');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ ok: false, status: 503 });
    await expect(pushSync('uuid-1', 'device-1', [], 'http://test'))
      .rejects.toThrow('Sync failed: 503');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test src/utils/sync.test.ts
```

Expected: FAIL — `pullSync` and `pushSync` not exported from `./sync`

- [ ] **Step 3: Implement pullSync and pushSync**

Append to `src/utils/sync.ts`:

```typescript
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
```

- [ ] **Step 4: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Run lint and build**

```bash
npm run lint && npm run build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/utils/sync.ts src/utils/sync.test.ts
git commit -m "feat: add pullSync and pushSync with full test coverage"
```

---

### Task 4: Create Cloudflare Worker

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/index.ts`

The worker is a separate deployable and does NOT affect the Vite SPA build.

- [ ] **Step 1: Create worker/package.json**

```json
{
  "name": "bible-sync-worker",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250522.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create worker/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  },
  "include": ["index.ts"]
}
```

- [ ] **Step 3: Create worker/wrangler.toml**

```toml
name = "bible-sync-worker"
main = "index.ts"
compatibility_date = "2024-09-23"

[[kv_namespaces]]
binding = "SYNC_KV"
id = "REPLACE_WITH_KV_NAMESPACE_ID"
preview_id = "REPLACE_WITH_KV_PREVIEW_NAMESPACE_ID"
```

- [ ] **Step 4: Create worker/index.ts**

```typescript
export interface Env {
  SYNC_KV: KVNamespace;
}

interface KvSyncData {
  version: number;
  completedTasks: Record<string, string[]>;
  updatedAt: string;
  lastDeviceId: string;
}

function unionKvMaps(
  a: Record<string, string[]>,
  b: Record<string, string[]>
): Record<string, string[]> {
  const result: Record<string, string[]> = { ...a };
  for (const [date, items] of Object.entries(b)) {
    const existing = new Set(result[date] ?? []);
    for (const item of items) existing.add(item);
    result[date] = [...existing].sort();
  }
  return result;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/sync\/(.+)$/);
    if (!match || !UUID_RE.test(match[1])) {
      return json({ error: 'not found' }, 404);
    }

    const uuid = match[1];

    if (request.method === 'GET') {
      const data = await env.SYNC_KV.get<KvSyncData>(uuid, 'json');
      if (!data) return json({ error: 'not found' }, 404);
      return json(data);
    }

    if (request.method === 'PUT') {
      let incoming: KvSyncData;
      try {
        incoming = await request.json<KvSyncData>();
      } catch {
        return json({ error: 'invalid body' }, 400);
      }

      const existing = await env.SYNC_KV.get<KvSyncData>(uuid, 'json');
      const merged: KvSyncData = {
        version: 1,
        completedTasks: existing
          ? unionKvMaps(existing.completedTasks, incoming.completedTasks)
          : incoming.completedTasks,
        updatedAt: new Date().toISOString(),
        lastDeviceId: incoming.lastDeviceId,
      };

      await env.SYNC_KV.put(uuid, JSON.stringify(merged));
      return json(merged);
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
```

- [ ] **Step 5: Install worker dependencies**

```bash
cd worker && npm install && cd ..
```

- [ ] **Step 6: Create KV namespaces (manual — requires Cloudflare account)**

```bash
cd worker
npx wrangler kv namespace create SYNC_KV
npx wrangler kv namespace create SYNC_KV --preview
cd ..
```

Each command prints an `id`. Open `worker/wrangler.toml` and replace both `REPLACE_WITH_*` placeholders with the IDs from the output.

- [ ] **Step 7: Test worker locally**

```bash
cd worker && npm run dev
```

In a separate terminal:

```bash
# Push data
curl -X PUT http://localhost:8787/sync/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"version":1,"completedTasks":{"2026-01-01":["Mt1"]},"updatedAt":"2026-05-23T00:00:00Z","lastDeviceId":"test-device"}'

# Pull it back
curl http://localhost:8787/sync/550e8400-e29b-41d4-a716-446655440000
```

Expected: GET returns the same data that was PUT.

Stop the dev server (`Ctrl+C`) after verifying.

- [ ] **Step 8: Set VITE_SYNC_WORKER_URL for local SPA development**

Create `.env.local` in the project root (already gitignored by Vite):

```
VITE_SYNC_WORKER_URL=http://localhost:8787
```

For production, add `VITE_SYNC_WORKER_URL` as a GitHub Actions repository variable (similar to how `VITE_COMMIT_SHA` is set in `deploy.yml`).

- [ ] **Step 9: Commit**

```bash
git add worker/ .env.local
git commit -m "feat: add Cloudflare Worker KV backend for device sync"
```

---

### Task 5: App.tsx — install qrcode.react, sync state, handlers, SyncSection

**Files:**
- Modify: `src/App.tsx`

Local state for the SyncSection UI (`showQr`, `showIdInput`, `syncIdInput`) is lifted into App so it survives App re-renders. SyncSection itself has no local state.

- [ ] **Step 1: Install qrcode.react**

```bash
npm install qrcode.react
```

- [ ] **Step 2: Add imports to App.tsx**

At the top of `src/App.tsx`, after existing imports, add:

```typescript
import { QRCodeSVG } from 'qrcode.react';
import { pullSync, pushSync, WORKER_URL } from './utils/sync';
```

- [ ] **Step 3: Add sync state variables**

After the `settingsInitialized` state declaration in App.tsx, add:

```typescript
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [syncError, setSyncError] = useState('');
  const [syncShowQr, setSyncShowQr] = useState(false);
  const [syncShowIdInput, setSyncShowIdInput] = useState(false);
  const [syncIdInput, setSyncIdInput] = useState('');
```

- [ ] **Step 4: Add sync handlers**

After the `cycleTheme` function (or near other event handlers), add:

```typescript
  const handleEnableSync = useCallback(() => {
    updateSetting('syncId', crypto.randomUUID());
    showToast('同步已啟用');
  }, []);

  const handleDisableSync = useCallback(() => {
    updateSetting('syncId', null);
    setSyncStatus('idle');
    setSyncError('');
    setSyncShowQr(false);
    showToast('同步已停用');
  }, []);

  const handlePull = useCallback(async (syncId: string) => {
    setSyncStatus('syncing');
    setSyncError('');
    try {
      const { mergedTasks, needsReconciliation } = await pullSync(
        syncId, settings.deviceId, settings.completedTasks, WORKER_URL
      );
      const now = new Date().toISOString();
      setSettings(prev => {
        const next = { ...prev, completedTasks: mergedTasks, lastSyncedAt: now };
        localStorage.setItem('bible_settings', JSON.stringify(next));
        return next;
      });
      if (needsReconciliation) {
        await pushSync(syncId, settings.deviceId, mergedTasks, WORKER_URL);
      }
      setSyncStatus('idle');
      showToast('拉取完成');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : '同步失敗');
    }
  }, [settings.deviceId, settings.completedTasks]);

  const handlePush = useCallback(async () => {
    if (!settings.syncId) return;
    setSyncStatus('syncing');
    setSyncError('');
    try {
      const mergedTasks = await pushSync(
        settings.syncId, settings.deviceId, settings.completedTasks, WORKER_URL
      );
      const now = new Date().toISOString();
      setSettings(prev => {
        const next = { ...prev, completedTasks: mergedTasks, lastSyncedAt: now };
        localStorage.setItem('bible_settings', JSON.stringify(next));
        return next;
      });
      setSyncStatus('idle');
      showToast('推送完成');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : '同步失敗');
    }
  }, [settings.syncId, settings.deviceId, settings.completedTasks]);

  const handleImportSyncId = useCallback((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    updateSetting('syncId', trimmed);
    setSyncShowIdInput(false);
    setSyncIdInput('');
    handlePull(trimmed);
  }, [handlePull]);
```

- [ ] **Step 5: Add SyncSection component**

Before the `return (` statement in the App component, add:

```typescript
  const SyncSection: React.FC = () => {
    const labelStyle: React.CSSProperties = {
      fontFamily: F.label, fontSize: 9, fontWeight: 600,
      letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.muted,
    };
    const btnPrimary: React.CSSProperties = {
      flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
      padding: '7px 0', borderRadius: 8, background: A.base, color: '#fff',
      fontFamily: F.label, fontSize: 11, fontWeight: 600,
    };
    const btnOutline: React.CSSProperties = {
      flex: 1, appearance: 'none', border: `1px solid ${theme.lineStrong}`,
      cursor: 'pointer', padding: '7px 0', borderRadius: 8,
      background: 'transparent', color: theme.ink, fontFamily: F.label, fontSize: 11,
    };

    if (!settings.syncId) {
      return (
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>裝置同步</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleEnableSync} style={btnPrimary}>啟用同步</button>
            <button
              onClick={() => setSyncShowIdInput(s => !s)}
              style={btnOutline}
            >輸入現有 ID</button>
          </div>
          {syncShowIdInput && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="貼上同步 ID…"
                value={syncIdInput}
                onChange={e => setSyncIdInput(e.target.value)}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8,
                  border: `1px solid ${theme.lineStrong}`, background: theme.bg,
                  color: theme.ink, fontFamily: 'ui-monospace, monospace',
                  fontSize: 11, outline: 'none',
                }}
              />
              <button
                onClick={() => handleImportSyncId(syncIdInput)}
                disabled={!syncIdInput.trim()}
                style={{
                  ...btnPrimary, flex: 'none', padding: '7px 14px',
                  opacity: syncIdInput.trim() ? 1 : 0.4,
                  cursor: syncIdInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >確認</button>
            </div>
          )}
        </div>
      );
    }

    const lastSync = settings.lastSyncedAt
      ? new Date(settings.lastSyncedAt).toLocaleString('zh-TW', {
          month: 'numeric', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '從未';
    const isSyncing = syncStatus === 'syncing';

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={labelStyle}>裝置同步</span>
          <span style={{ fontFamily: F.label, fontSize: 10, color: A.base, fontWeight: 600 }}>● 已啟用</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10, color: theme.ink,
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {settings.syncId}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(settings.syncId!).then(() => showToast('已複製'))}
            style={{ appearance: 'none', border: `1px solid ${theme.lineStrong}`, cursor: 'pointer', padding: '3px 8px', borderRadius: 6, background: 'transparent', color: theme.muted, fontFamily: F.label, fontSize: 10 }}
          >複製</button>
          <button
            onClick={() => setSyncShowQr(s => !s)}
            style={{ appearance: 'none', border: `1px solid ${theme.lineStrong}`, cursor: 'pointer', padding: '3px 8px', borderRadius: 6, background: syncShowQr ? theme.pill : 'transparent', color: theme.muted, fontFamily: F.label, fontSize: 10 }}
          >QR</button>
        </div>
        {syncShowQr && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
            <QRCodeSVG value={settings.syncId!} size={120} bgColor={theme.surface} fgColor={theme.ink} />
          </div>
        )}
        <div style={{ fontFamily: F.label, fontSize: 10, color: theme.faint, marginBottom: 8 }}>
          上次同步：{lastSync}
        </div>
        {syncStatus === 'error' && (
          <div style={{ fontFamily: F.label, fontSize: 10, color: '#c0392b', marginBottom: 6 }}>
            ⚠ {syncError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handlePush}
            disabled={isSyncing}
            style={{ ...btnPrimary, opacity: isSyncing ? 0.6 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
          >{isSyncing ? '同步中…' : '↑ 推送'}</button>
          <button
            onClick={() => handlePull(settings.syncId!)}
            disabled={isSyncing}
            style={{ ...btnOutline, opacity: isSyncing ? 0.6 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
          >↓ 拉取</button>
          <button
            onClick={handleDisableSync}
            style={{ appearance: 'none', border: `1px solid ${theme.lineStrong}`, cursor: 'pointer', padding: '7px 10px', borderRadius: 8, background: 'transparent', color: theme.muted, fontFamily: F.label, fontSize: 11 }}
          >停用</button>
        </div>
      </div>
    );
  };
```

- [ ] **Step 6: Run lint, test, build**

```bash
npm run lint && npm run test && npm run build
```

Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx package.json package-lock.json
git commit -m "feat: add SyncSection component and sync handlers to App"
```

---

### Task 6: Wire SyncSection into settings UI

**Files:**
- Modify: `src/App.tsx`

`SyncSection` must appear in two places: the desktop settings popup (`settingsOpen`) and the mobile settings sheet (`mobileSheet === 'menu'`). Both contain a block ending with `{appVersion}`. Search for `appVersion` in App.tsx to locate each insertion point.

- [ ] **Step 1: Locate both version info blocks**

In `src/App.tsx`, search for all occurrences of `appVersion` (the variable, not in comments). There will be two occurrences inside JSX — one in the desktop popup, one in the mobile sheet. Each is preceded by a `版本資訊` label and a horizontal divider.

The pattern to look for at each location:

```tsx
<div style={{ height: 1, background: theme.line, ... }} />
<div style={{ display: 'flex', justifyContent: 'space-between', ... }}>
  <span ...>版本資訊</span>
  <span ...>{appVersion}</span>
</div>
```

- [ ] **Step 2: Insert SyncSection in desktop settings popup**

Find the FIRST occurrence of `{appVersion}` (inside the `settingsOpen` popup). Insert a sync section block immediately BEFORE the divider that precedes the version info:

```tsx
                  {/* Sync */}
                  <div style={{ height: 1, background: theme.line, margin: '0 6px 6px' }} />
                  <div style={{ padding: '4px 8px 10px' }}>
                    <SyncSection />
                  </div>
```

Place this block so it appears just before the existing version info divider.

- [ ] **Step 3: Insert SyncSection in mobile settings sheet**

Find the SECOND occurrence of `{appVersion}` (inside the `mobileSheet === 'menu'` section). Insert the same block before the version info divider at that location:

```tsx
                {/* Sync */}
                <div style={{ height: 1, background: theme.line, margin: '14px 0 10px' }} />
                <div style={{ padding: '0 4px 10px' }}>
                  <SyncSection />
                </div>
```

- [ ] **Step 4: Run dev server and manually verify all four UI states**

```bash
npm run dev
```

Open `http://localhost:5173` and verify each state:

**State 1 — Disabled:** Open settings panel. Sync section shows "裝置同步" label with "啟用同步" and "輸入現有 ID" buttons.

**State 2 — Enable flow:** Click "啟用同步". Section switches to enabled view: UUID displayed, copy/QR buttons, push/pull/停用 buttons, "上次同步：從未".

**State 3 — QR display:** Click "QR". A QR code appears displaying the UUID string.

**State 4 — Enter existing ID:** Click "停用", then "輸入現有 ID". An input field appears. Paste any UUID-formatted string and click "確認". The app shows "syncing" briefly (it attempts to pull from the local worker — will error because worker isn't running).

**State 5 — Error state:** With the worker not running, trigger a push. The error state shows "⚠ 同步失敗：…".

**State 6 — Mobile:** On narrow viewport or mobile device, open the mobile settings sheet. Same sync section appears.

- [ ] **Step 5: End-to-end test with local worker running**

In one terminal start the worker:
```bash
cd worker && npm run dev
```

In another terminal start the SPA:
```bash
npm run dev
```

Open two browser windows at `http://localhost:5173`.

Window A: Enable sync → copy UUID → Push (should succeed, toast "推送完成").
Window B: Enter existing ID (paste UUID from A) → confirm. Pull triggers automatically → reading progress from A appears in B.
Window B: Mark a reading as complete → Push → Window A Pull → progress from B appears in A.

- [ ] **Step 6: Run lint, test, build**

```bash
npm run lint && npm run test && npm run build
```

Expected: 0 errors, all tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire SyncSection into desktop and mobile settings UI"
```

---

## Production Deploy Checklist

Before the feature works in production:

1. **Deploy worker:** `cd worker && npm run deploy` (requires `wrangler.toml` KV IDs set)
2. **Set env var in GitHub Actions:** Add `VITE_SYNC_WORKER_URL=https://bible-sync-worker.YOUR_ACCOUNT.workers.dev` as a repository variable in GitHub Settings → Actions → Variables
3. **Update `deploy.yml`:** Pass the variable into the Vite build step (similar to how `VITE_COMMIT_SHA` is injected)
