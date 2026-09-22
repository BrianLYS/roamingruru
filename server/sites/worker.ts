import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { elevenLabsVoice } from '../voice.ts';
import { visitorMemory } from '../memory.ts';
import { outfitDiscovery } from '../outfit.ts';
import { luluConversation } from '../conversation.ts';

type Env = Record<string, string> & { ASSETS: { fetch(request: Request): Promise<Response> } };
type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
const runtimes = new WeakMap<object, { routes: Map<string, Handler>; attempts: number[]; active: number }>();
function runtime(env: Env) {
  let saved = runtimes.get(env);
  if (saved) return saved;
  const routes = new Map<string, Handler>();
  const middlewares = { use(path: string, handler: Handler) { routes.set(path, handler); } };
  for (const plugin of [elevenLabsVoice(env), visitorMemory(env), outfitDiscovery(env), luluConversation(env)]) {
    (plugin.configureServer as Function)({ middlewares });
  }
  saved = { routes, attempts: [], active: 0 }; runtimes.set(env, saved); return saved;
}
const json = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    // Public demo: ownership stays in signed HttpOnly visitor cookies, not Sites login.
    // Exact-origin checks and bounded provider limits apply to every visitor.
    if (url.origin !== env.RURU_SITE_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site' ||
      (request.headers.has('origin') && request.headers.get('origin') !== url.origin) ||
      (request.method !== 'GET' && request.headers.get('origin') !== url.origin)) return json(403, 'Use Ruru from this site.');
    const state = runtime(env);
    const match = [...state.routes].find(([base]) => url.pathname === base || url.pathname.startsWith(base + '/'));
    if (!match) return json(404, 'Unknown Ruru route.');
    if (!['GET','POST'].includes(request.method)) return json(405, 'Unsupported method.');
    const now = Date.now(); while (state.attempts.length && state.attempts[0] < now - 60000) state.attempts.shift();
    if (state.active >= 4 || (request.method === 'POST' && state.attempts.length >= 40)) return json(429, 'Give Ruru a moment, then try again.');
    if (request.method === 'POST') state.attempts.push(now);
    const max = url.pathname === '/api/lulu/outfit/analyse' ? 4300000 : url.pathname === '/api/lulu/conversation' ? 570000 : 18000;
    if (Number(request.headers.get('content-length')) > max) return json(413, 'Request too large.');
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = request.body?.getReader();
    const stopReading = () => { void reader?.cancel().catch(() => {}); };
    request.signal.addEventListener('abort', stopReading, { once: true });
    try {
      if (request.signal.aborted) return json(499, 'Request stopped.');
      if (reader) { while (true) { const chunk = await reader.read();
        if (request.signal.aborted) return json(499, 'Request stopped.');
        if (chunk.done) break; size += chunk.value.length;
        if (size > max) { await reader.cancel(); return json(413, 'Request too large.'); } chunks.push(chunk.value);
      } }
    } catch { return json(request.signal.aborted ? 499 : 400, 'Unable to read request.'); }
    finally { request.signal.removeEventListener('abort', stopReading); }
    if (request.signal.aborted) return json(499, 'Request stopped.');
    const req = Readable.from(chunks.map(chunk => Buffer.from(chunk))) as IncomingMessage;
    req.method = request.method; req.url = url.pathname.slice(match[0].length) + url.search || '/';
    req.headers = Object.fromEntries(request.headers); req.headers.host = url.host;
    req.socket = { remoteAddress: request.headers.get('cf-connecting-ip') ?? 'public-demo' } as IncomingMessage['socket'];
    const headers = new Headers();
    let ended = false; let destroyed = false; let response: Response | undefined;
    const events = new EventEmitter();
    const res = Object.assign(events, {
      statusCode: 200,
      setHeader(key: string, value: string | string[]) { headers.delete(key); for (const part of Array.isArray(value) ? value : [value]) headers.append(key, part); },
      get writableEnded() { return ended; }, get destroyed() { return destroyed; },
      end(body?: string | Uint8Array) { ended = true; response = new Response(body as BodyInit | undefined, { status: res.statusCode, headers }); },
    });
    // Object.assign materializes getters; define the lifecycle accessors explicitly.
    Object.defineProperties(res, { writableEnded: { get: () => ended }, destroyed: { get: () => destroyed } });
    const cancel = () => { destroyed = true; events.emit('close'); };
    request.signal.addEventListener('abort', cancel, { once: true });
    state.active++;
    if (request.signal.aborted) cancel();
    try { await match[1](req, res as unknown as ServerResponse); return response ?? json(request.signal.aborted ? 499 : 500, 'Ruru could not finish that request.'); }
    catch { return json(500, 'Ruru is unavailable for a moment. Please try again.'); }
    finally { state.active--; request.signal.removeEventListener('abort', cancel); req.destroy(); }
  },
};
