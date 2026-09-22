// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { sessionCodec } from './memory';
test('cookie signature binds a random visitor token and fixed expiry to this server secret', () => {
  const codec = sessionCodec('synthetic-secret'); const token = codec.issue();
  expect(codec.read(token)?.ownerHash).toMatch(/^[a-f0-9]{64}$/);
  expect(codec.read(token)?.ownerHash).not.toBe(codec.read(codec.issue())?.ownerHash);
  expect(codec.read(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'))).toBeNull();
  expect(sessionCodec('different-secret').read(token)).toBeNull();
  expect(codec.read('bad')).toBeNull();
  vi.useFakeTimers(); try { vi.setSystemTime(Date.now() + 31 * 86400000); expect(codec.read(token)).toBeNull(); } finally { vi.useRealTimers(); }
});

test('agent recall resolves signed ownership server-side and excludes contact data',async()=>{
 const {getConversationContext}=await import('./memory');
 const secret='synthetic-context-secret';const token=sessionCodec(secret).issue();const req={headers:{cookie:`lulu_memory=${token}`}} as import('node:http').IncomingMessage;
 const env={MEMORY_SESSION_SECRET:secret,CONVEX_DEPLOY_KEY:'synthetic',CONVEX_URL:'https://famous-tapir-87.convex.cloud'};
 const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'success',value:{personal:{name:'Test',preferences:['Evening classes']},newsletter:{emailHint:'private@example.invalid'},face:null}}),{status:200}));vi.stubGlobal('fetch',request);
 try{expect(await getConversationContext(req,env)).toEqual({memory:{name:'Test',preferences:['Evening classes']},mailingList:{subscribed:false}});const sent=JSON.parse(request.mock.calls[0][1].body);expect(sent.args.ownerHash).toBe(sessionCodec(secret).read(token)?.ownerHash);expect(await getConversationContext({headers:{}} as import('node:http').IncomingMessage,env,'forged-token')).toEqual({});expect(await getConversationContext(req,env,undefined,true)).toEqual({});expect(await getConversationContext(req,env,'forged-token',true)).toEqual({});expect(request).toHaveBeenCalledTimes(1);}finally{vi.unstubAllGlobals();}
});
