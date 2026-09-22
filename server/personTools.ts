import type { IncomingMessage, ServerResponse } from 'node:http';
import { sessionCodec, validEmbedding, validPersonal, readRecognition } from './memory.ts';
export type Senses = { image?: string; model?: string; embedding?: number[] };
export type PersonTools = { recognize(signal?: AbortSignal): Promise<Record<string, unknown>>; remember(args: { name: string; preferences: string[]; include_face: boolean }, signal?: AbortSignal): Promise<Record<string, unknown>>; forget(signal?: AbortSignal): Promise<Record<string, unknown>> };
export function createPersonTools(req: IncomingMessage, res: ServerResponse, env: Record<string, string>, senses: Senses = {}, recognitionToken?: string, request: typeof fetch = fetch): PersonTools {
  const codec = sessionCodec(env.MEMORY_SESSION_SECRET || 'unavailable');
  let token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('lulu_memory='))?.slice(12);
  let session = codec.read(token);
  let recognizedOwner = readRecognition(recognitionToken, env.MEMORY_SESSION_SECRET || 'unavailable');
  const call = async (path: string, args: unknown, signal?: AbortSignal) => {
    if (!env.MEMORY_SESSION_SECRET || !env.CONVEX_DEPLOY_KEY || env.CONVEX_URL !== 'https://famous-tapir-87.convex.cloud') throw new Error('Memory unavailable');
    signal?.throwIfAborted();
    const response = await request(`${env.CONVEX_URL}/api/function`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Convex ${env.CONVEX_DEPLOY_KEY}` }, body: JSON.stringify({ path, format: 'convex_encoded_json', args }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Memory unavailable');
    const result = await response.json(); if (result.status !== 'success') throw new Error('Memory unavailable'); return result.value;
  };
  const own = () => !recognizedOwner || recognizedOwner === session?.ownerHash;
  const unavailable = { status: 'unconfirmed', error: 'The memory operation could not be confirmed. Do not claim success or automatically retry.' };
  return {
    async recognize(signal) {
      if (!validEmbedding(senses.model, senses.embedding)) return senses.image ? { status: 'face_unavailable', note: 'The camera is on, but no single clear face representation is available. Ask the visitor to face Ruru in good light.' } : { status: 'requires_camera' };
      try {
        const result = await call('faces:recognize', { model: senses.model, embedding: senses.embedding, now: Date.now() }, signal);
        if (result.status !== 'recognized') { recognizedOwner = null; return { status: result.status === 'uncertain' ? 'uncertain' : 'unknown' }; }
        recognizedOwner = result.ownerHash;
        const saved = await call('profiles:read', { ownerHash: recognizedOwner, now: Date.now() }, signal);
        if (!saved.face || !saved.personal) return { status: 'unknown' };
        return { status: 'recognized', person: saved.personal };
      } catch { return unavailable; }
    },
    async remember(args, signal) {
      if (!validPersonal(args.name, args.preferences)) return { status: 'invalid', error: 'Use a short name and shopping preferences.' };
      if (!own()) return { status: 'different_owner', error: 'Face recognition provides recall only. This device cannot edit another visitor’s saved profile.' };
      if (args.include_face && !args.name.trim()) return { status: 'invalid', error: 'Ask what to call the visitor first.' };
      if (args.include_face && !validEmbedding(senses.model, senses.embedding)) return senses.image ? { status: 'face_unavailable', note: 'The camera is on, but a single clear face is needed to remember it.' } : { status: 'requires_camera' };
      try {
        // Check the supplied face before enrollment even if the model omitted recognition.
        // A recognized face never transfers ownership of another visitor's record.
        if (args.include_face) {
          const match = await call('faces:recognize', {model:senses.model,embedding:senses.embedding,now:Date.now()}, signal);
          if (match.status === 'recognized' && match.ownerHash !== session?.ownerHash) return {status:'different_owner',error:'That face belongs to another saved visitor. Recognition does not grant edit access.'};
        }
        if (!session) {
          token = codec.issue(); session = codec.read(token)!;
          res.setHeader('Set-Cookie', `lulu_memory=${token}; Path=/api/lulu; Max-Age=${Math.floor((session.expiresAt-Date.now())/1000)}; HttpOnly; SameSite=Strict${env.RURU_SITE_ORIGIN ? '; Secure' : ''}`);
        }
        const saved = await call('profiles:read', { ownerHash: session.ownerHash, now: Date.now() }, signal);
        const result = await call(args.include_face ? 'faces:enroll' : 'profiles:personal', { ...session, version: saved.profileVersion, consent: true, name: args.name.trim(), preferences: args.preferences, ...(args.include_face ? { model: senses.model, embedding: senses.embedding } : {}) }, signal);
        if (result.status !== 'saved') return { status: result.status, error: 'Memory was not saved.' };
        const confirmed = await call('profiles:read', { ownerHash: session.ownerHash, now: Date.now() }, signal);
        if (confirmed.personal?.name !== args.name.trim() || JSON.stringify(confirmed.personal?.preferences) !== JSON.stringify(args.preferences) || args.include_face && !confirmed.face) return unavailable;
        return { status: 'remembered', person: confirmed.personal, faceRemembered: !!confirmed.face };
      } catch { return unavailable; }
    },
    async forget(signal) {
      if (!own()) return { status: 'different_owner', error: 'Use the device that saved this person to remove their memory.' };
      if (!session) return { status: 'forgotten' };
      try {
        const result = await call('memory:forget', session, signal);
        if (result.state !== 'empty') return unavailable;
        const saved = await call('profiles:read', { ownerHash: session.ownerHash, now: Date.now() }, signal);
        if (saved.personal || saved.face || saved.profile) return unavailable;
        return { status: 'forgotten', newsletterRetained: !!saved.newsletter };
      } catch { return unavailable; }
    },
  };
}
