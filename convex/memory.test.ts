import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import schema from './schema';
import { internal } from './_generated/api';
const modules = import.meta.glob('./**/*.ts');
const ownerHash = 'a'.repeat(64);
test('consent, isolation, idempotency, update, deletion and stale writes', async () => {
  const t = convexTest(schema, modules); const expiresAt = Date.now() + 86400000;
  expect(await t.query(internal.memory.read, { ownerHash })).toEqual({ state: 'empty' });
  expect(await t.run(ctx => ctx.db.query('visitorSessions').collect())).toHaveLength(0);
  await t.mutation(internal.memory.consent, { ownerHash, expiresAt, interest: 'yoga' });
  await t.mutation(internal.memory.consent, { ownerHash, expiresAt, interest: 'yoga' });
  expect(await t.run(ctx => ctx.db.query('visitorMemories').collect())).toHaveLength(1);
  expect(await t.query(internal.memory.read, { ownerHash: 'b'.repeat(64) })).toEqual({ state: 'empty' });
  expect(await t.mutation(internal.memory.save, { ownerHash, interest: 'running' })).toEqual({ state: 'remembered', interest: 'running' });
  await t.mutation(internal.memory.forget, { ownerHash, expiresAt });
  await t.mutation(internal.memory.forget, { ownerHash, expiresAt });
  expect(await t.run(ctx => ctx.db.query('visitorMemories').collect())).toHaveLength(0);
  expect(await t.mutation(internal.memory.consent, { ownerHash, expiresAt, interest: 'yoga' })).toEqual({ state: 'changed' });
  expect(await t.mutation(internal.memory.save, { ownerHash, interest: 'yoga' })).toEqual({ state: 'changed' });
});
test('forgetting an issued but uncommitted session prevents a delayed consent', async () => {
  const t = convexTest(schema, modules); const expiresAt = Date.now() + 10000;
  await t.mutation(internal.memory.forget, { ownerHash, expiresAt });
  expect(await t.mutation(internal.memory.consent, { ownerHash, expiresAt, interest: 'yoga' })).toEqual({ state: 'changed' });
  expect(await t.run(ctx => ctx.db.query('visitorMemories').collect())).toHaveLength(0);
});
test('expired sessions are unreadable, unwriteable and cleaned including preferences', async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules); const expiresAt = Date.now() + 1000;
    await t.mutation(internal.memory.consent, { ownerHash, expiresAt, interest: 'yoga' });
    vi.setSystemTime(expiresAt + 1);
    expect(await t.query(internal.memory.read, { ownerHash, now: Date.now() })).toEqual({ state: 'revoked' });
    expect(await t.mutation(internal.memory.save, { ownerHash, interest: 'running' })).toEqual({ state: 'revoked' });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query('visitorMemories').collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query('visitorSessions').collect())).toHaveLength(0);
  } finally { vi.useRealTimers(); }
});
