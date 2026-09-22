import { requestOrigin } from './requestOrigin.ts';
import type { Plugin, Connect } from 'vite';
import { loadEnv } from 'vite';
import { verifyAgentReply } from './agentSpeechToken.ts';
import { spokenLines } from '../src/spokenLines.ts';

export function createSpeechService(env: Record<string, string>, request: typeof fetch = fetch) {
  const cache = new Map<string, Uint8Array>();
  let busy = false;
  const attempts: number[] = [];
  return async (text: unknown, token?: unknown, signal?: AbortSignal, voice: unknown = 'animated'): Promise<{ status: number; audio?: Uint8Array; error?: string }> => {
    if (voice !== 'animated' && voice !== 'classic') return { status: 400, error: 'Choose an available Ruru voice.' };
    const voiceId = voice === 'classic' ? env.ELEVENLABS_CLASSIC_VOICE_ID : env.ELEVENLABS_VOICE_ID;
    const model = voice === 'classic' ? 'eleven_multilingual_v2' : (env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2');
    const cacheKey = JSON.stringify([voiceId, model, text]);
    if (typeof text !== 'string' || (!spokenLines.has(text) && !verifyAgentReply(text, token, env.MEMORY_SESSION_SECRET ?? ''))) return { status: 400, error: 'Ask Ruru for a reply before playing it.' };
    if (signal?.aborted) return { status: 499, error: 'Speech stopped.' };
    if (!env.ELEVENLABS_API_KEY || !voiceId) return { status: 503, error: 'Ruru’s new voice isn’t connected yet. You can still read her reply.' };
    const saved = cache.get(cacheKey); if (saved) return { status: 200, audio: saved };
    const now = Date.now(); while (attempts.length && attempts[0] < now - 60000) attempts.shift();
    if (busy || attempts.length >= 8) return { status: 429, error: 'Give Ruru a moment, then try hearing the line again.' };
    busy = true; attempts.push(now);
    try {
      const response = await request(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: model, voice_settings: model === 'eleven_v3' ? { stability: .5 } : { stability: .5, similarity_boost: .75, style: .15, use_speaker_boost: true, speed: .95 } }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
      });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) return { status: 502, error: 'Ruru’s voice is unavailable right now. Her reply is still here to read.' };
      const audio = new Uint8Array(await response.arrayBuffer());
      if (!audio.length || audio.length > 5000000) return { status: 502, error: 'Ruru couldn’t finish that audio. Please try again.' };
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, audio); return { status: 200, audio };
    } catch { return { status: 502, error: 'Ruru’s voice took too long. Please try hearing the line again.' }; }
    finally { busy = false; }
  };
}

// Local rehearsal and authenticated Sites adapter share the same bounded speech service.
export function elevenLabsVoice(runtimeEnv?: Record<string, string>): Plugin {
  let env: Record<string, string> = runtimeEnv ?? {};
  const attach = (middlewares: Connect.Server) => {
    const speak = createSpeechService(env);
    middlewares.use('/api/lulu/voice', async (req, res) => {
      const fail = (status: number, error: string) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error })); };
      const origin = requestOrigin(req, env);
      if (!origin || req.headers.origin !== origin) { fail(403, 'Use Ruru from this site.'); return; }
      if (req.method !== 'POST') { fail(405, 'Use POST.'); return; }
      if (!req.headers['content-type']?.startsWith('application/json')) { fail(415, 'Expected JSON.'); return; }
      let body = '';
      const controller = new AbortController();
      const cancel = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', cancel);
      try {
        for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > 4096) { fail(413, 'Message too large.'); return; } }
        const input = JSON.parse(body);
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['text', 'token', 'voice'].includes(key))) { fail(400, 'Invalid speech request.'); return; }
        const result = await speak(input.text, input.token, controller.signal, input.voice);
        if (res.destroyed) return;
        res.setHeader('Cache-Control', 'no-store');
        if (result.audio) { res.statusCode = 200; res.setHeader('Content-Type', 'audio/mpeg'); res.end(result.audio); }
        else fail(result.status, result.error!);
      } catch { if (!res.destroyed) fail(400, 'Invalid request.'); }
      finally { res.off('close', cancel); }
    });
  };
  return { name: 'local-elevenlabs-voice', configResolved(config) { env = runtimeEnv ?? { ...loadEnv(config.mode, config.root, ''), ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) }; }, configureServer(server) { attach(server.middlewares); }, configurePreviewServer(server) { attach(server.middlewares); } };
}
