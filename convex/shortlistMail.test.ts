/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import schema from './schema';
import { internal } from './_generated/api';
const modules = import.meta.glob('./**/*.ts');
test('one atomic attempt per operation, new intents repeat, no repeated send after uncertainty, isolation and forget', async () => {
  const t = convexTest(schema, modules);
  const args = { ownerHash: 'a'.repeat(64), recipientDigest: 'b'.repeat(64), expiresAt: Date.now() + 100000 };
  const results = await Promise.all([t.mutation(internal.shortlistMail.reserve, args), t.mutation(internal.shortlistMail.reserve, args)]);
  expect(results.filter(r => r.kind === 'claimed')).toHaveLength(1);
  expect(await t.query(internal.shortlistMail.status, { ownerHash: 'c'.repeat(64), now: Date.now() })).toBeNull();
  await t.mutation(internal.shortlistMail.settle, { ownerHash: args.ownerHash, outcome: { outcome: 'unknown', reason: 'provider_uncertain' } });
  expect(await t.mutation(internal.shortlistMail.reserve, { ...args, recipientDigest: 'c'.repeat(64) })).toMatchObject({ kind: 'existing', outcome: { outcome: 'unknown' } });
  await t.mutation(internal.memory.forget, { ownerHash: args.ownerHash, expiresAt: args.expiresAt });
  expect(await t.query(internal.shortlistMail.status, { ownerHash: args.ownerHash, now: Date.now() })).toMatchObject({outcome:'unknown'});
  expect(await t.mutation(internal.shortlistMail.reserve, args)).toMatchObject({ kind: 'existing', outcome: { outcome: 'unknown' } });
  expect(await t.run(ctx => ctx.db.query('shortlistMail').collect())).toHaveLength(1);
  const next={...args,operationId:'new-intent-00000001'};expect(await t.mutation(internal.shortlistMail.reserve,next)).toMatchObject({kind:'claimed'});
  expect(await t.mutation(internal.shortlistMail.reserve,next)).toMatchObject({kind:'existing',outcome:{outcome:'pending'}});
});
test('fixed session expiry clears send metadata without saving email or preference', async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    const args = { ownerHash: 'd'.repeat(64), recipientDigest: 'e'.repeat(64), expiresAt: Date.now() + 1000 };
    await t.mutation(internal.shortlistMail.reserve, args);
    await t.mutation(internal.shortlistMail.settle, { ownerHash: args.ownerHash, outcome: { outcome: 'sent', messageId: 'synthetic', threadId: 'synthetic' } });
    expect(await t.run(ctx => ctx.db.query('visitorMemories').collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query('mailingRequests').collect())).toEqual([]);
    vi.setSystemTime(args.expiresAt + 1); await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query('shortlistMail').collect())).toEqual([]);
  } finally { vi.useRealTimers(); }
});
