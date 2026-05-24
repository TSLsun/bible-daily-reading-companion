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

      if (
        !incoming.completedTasks ||
        typeof incoming.completedTasks !== 'object' ||
        Array.isArray(incoming.completedTasks)
      ) {
        return json({ error: 'invalid completedTasks' }, 400);
      }
      if (typeof incoming.lastDeviceId !== 'string' || !incoming.lastDeviceId) {
        return json({ error: 'invalid lastDeviceId' }, 400);
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
