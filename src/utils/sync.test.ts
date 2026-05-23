import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flatToKvMap, kvMapToFlat, mergeTasks, KvSyncData, pullSync, pushSync } from './sync';

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
