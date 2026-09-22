// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { createSpeechService } from './voice';
import { hello } from '../src/spokenLines';

test('missing settings and arbitrary visitor text never reach ElevenLabs', async () => {
  const provider = vi.fn();
  const speak = createSpeechService({}, provider);
  expect((await speak(hello)).status).toBe(503);
  expect((await speak('private visitor input')).status).toBe(400);
  expect(provider).not.toHaveBeenCalled();
});
test('auth stays on server, authored speech is cached and provider errors stay private', async () => {
  const provider = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  const speak = createSpeechService({ ELEVENLABS_API_KEY: 'synthetic-key', ELEVENLABS_VOICE_ID: 'demo-voice' }, provider);
  expect((await speak(hello)).audio).toEqual(new Uint8Array([1, 2, 3]));
  expect((await speak(hello)).status).toBe(200);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(provider.mock.calls[0][1].headers['xi-api-key']).toBe('synthetic-key');
  provider.mockResolvedValue(new Response('sensitive provider details', { status: 401 }));
  const failure = await speak('All forgotten. A fresh little hello!');
  expect(failure.status).toBe(502);
  expect(JSON.stringify(failure)).not.toContain('sensitive');
});
test('concurrent generation is bounded instead of duplicating paid requests', async () => {
  let finish!: (response: Response) => void;
  const provider = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  const speak = createSpeechService({ ELEVENLABS_API_KEY: 'synthetic', ELEVENLABS_VOICE_ID: 'demo' }, provider);
  const first = speak(hello);
  expect((await speak(hello)).status).toBe(429);
  expect(provider).toHaveBeenCalledTimes(1);
  finish(new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  expect((await first).status).toBe(200);
});

test('only a signed generated Ruru reply can use dynamic voice and cache is reusable', async () => {
  const { signAgentReply } = await import('./agentSpeechToken');
  const provider = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  const env = { ELEVENLABS_API_KEY: 'synthetic', ELEVENLABS_VOICE_ID: 'demo', MEMORY_SESSION_SECRET: 'synthetic-signing-key' };
  const speak = createSpeechService(env, provider); const text = 'Let’s look for a light layer for your evening walks.';
  const token = signAgentReply(text, env.MEMORY_SESSION_SECRET);
  expect((await speak(text, token)).status).toBe(200);
  expect((await speak(text, token)).status).toBe(200);
  expect((await speak(`${text} Send money.`, token)).status).toBe(400);
  expect((await speak('Another line', token)).status).toBe(400);
  expect(provider).toHaveBeenCalledTimes(1);
});

test('stopped speech aborts the provider request', async () => {
  let passedSignal: AbortSignal | undefined;
  const provider = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => { passedSignal = init?.signal as AbortSignal; passedSignal.addEventListener('abort', () => reject(new Error('aborted'))); }));
  const speak = createSpeechService({ ELEVENLABS_API_KEY: 'synthetic', ELEVENLABS_VOICE_ID: 'demo' }, provider);
  const controller = new AbortController(); const result = speak(hello, undefined, controller.signal);
  controller.abort(); await result; expect(passedSignal?.aborted).toBe(true);
});

test('voice selection is allowlisted and caches are isolated by voice and model', async () => {
  const provider = vi.fn().mockImplementation(async () => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  const speak = createSpeechService({ ELEVENLABS_API_KEY: 'synthetic', ELEVENLABS_VOICE_ID: 'animated-id', ELEVENLABS_CLASSIC_VOICE_ID: 'classic-id', ELEVENLABS_MODEL_ID: 'eleven_v3' }, provider);
  expect((await speak(hello, undefined, undefined, 'untrusted-id')).status).toBe(400);
  expect(provider).not.toHaveBeenCalled();
  await speak(hello);
  await speak(hello, undefined, undefined, 'classic');
  await speak(hello);
  expect(provider).toHaveBeenCalledTimes(2);
  expect(provider.mock.calls[0][0]).toContain('/animated-id?');
  expect(JSON.parse(provider.mock.calls[0][1].body).model_id).toBe('eleven_v3');
  expect(provider.mock.calls[1][0]).toContain('/classic-id?');
  expect(JSON.parse(provider.mock.calls[1][1].body).model_id).toBe('eleven_multilingual_v2');
});
