import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
const modules = import.meta.glob('./**/*.ts');
describe('discovery catalogue', () => {
  test('only reviewed, unexpired discoveries are visible; source imports do not approve offers', async () => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      const common = { shop: 'Synthetic shop', title: 'Synthetic event', description: 'Test only', kind: 'event' as const, sourceUrl: 'https://example.com', checkedAt: 100, terms: 'Test only' };
      await ctx.db.insert('discoveries', { ...common, status: 'approved', validUntil: 500 });
      await ctx.db.insert('discoveries', { ...common, status: 'draft', validUntil: 500 });
      await ctx.db.insert('discoveries', { ...common, status: 'withdrawn', validUntil: 500 });
      await ctx.db.insert('discoveries', { ...common, status: 'approved', validUntil: 199 });
    });
    const first = await t.mutation(internal.catalogue.recordSource, { url: 'https://example.com', markdown: 'Unreviewed promise of a discount' });
    const retry = await t.mutation(internal.catalogue.recordSource, { url: 'https://example.com', markdown: 'Updated source' });
    expect(retry).toEqual(first);
    expect(await t.query(api.catalogue.list, { now: 200 })).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.get(first))).toMatchObject({ status: 'needs_review', markdown: 'Updated source' });
  });
  test('rejects invalid time and bounds public catalogue results', async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.catalogue.list, { now: -1 })).rejects.toThrow('Invalid timestamp');
    await t.run(async ctx => {
      for (let i = 0; i < 25; i++) await ctx.db.insert('discoveries', { shop: 'Synthetic', title: String(i), description: 'test', kind: 'shop', sourceUrl: 'https://example.com', checkedAt: 100, validUntil: 300, status: 'approved', terms: 'none' });
    });
    expect(await t.query(api.catalogue.list, { now: 200 })).toHaveLength(20);
  });
});
