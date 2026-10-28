import { RoomDurableObject } from './roomDo.ts';
import { cleanCode, isValidCode } from '../../src/mp/codes.ts';

export { RoomDurableObject };

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({ ok: true, service: 'heddas-verden-mp', v: 1 }, { headers: CORS });
    }

    // GET /room/:code → WebSocket upgrade to that room's Durable Object
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (m) {
      const code = cleanCode(m[1]!);
      if (!isValidCode(code)) {
        return Response.json({ error: 'Ugyldig romkode.' }, { status: 400, headers: CORS });
      }
      const id = env.ROOMS.idFromName(`room:${code}`);
      const stub = env.ROOMS.get(id);
      const headers = new Headers(request.headers);
      headers.set('X-Room-Code', code);
      return stub.fetch(new Request('https://room/ws', { headers }));
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  },
};
