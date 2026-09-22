import { query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import schema from './schema';
export const list = query({
  args: { now: v.number() },
  returns: v.array(schema.doc('discoveries')),
  handler: async (ctx, { now }) => {
    if (!Number.isFinite(now) || now < 0 || now > 8640000000000000) throw new Error('Invalid timestamp');
    return ctx.db.query('discoveries').withIndex('by_status_and_validUntil', q => q.eq('status', 'approved').gt('validUntil', now)).take(20);
  },
});
export const recordSource = internalMutation({
  args: { url: v.string(), markdown: v.string() }, returns: v.id('sources'),
  handler: async (ctx, { url, markdown }) => {
    const data = { url, markdown: markdown.slice(0, 40000), fetchedAt: Date.now(), status: 'needs_review' as const };
    const existing = await ctx.db.query('sources').withIndex('by_url', q => q.eq('url', url)).unique();
    if (existing) { await ctx.db.patch(existing._id, data); return existing._id; }
    return ctx.db.insert('sources', data);
  },
});
