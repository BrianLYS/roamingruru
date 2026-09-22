import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';

import { terminal, ledgerOutcome } from './shortlistMailFields';
function valid(ownerHash: string) { if (!/^[a-f0-9]{64}$/.test(ownerHash)) throw new Error('Invalid owner'); }
export const reserve = internalMutation({
  args: { ownerHash: v.string(), expiresAt: v.number(), recipientDigest: v.string(), operationId:v.optional(v.string()) },
  returns: v.union(v.object({ kind: v.literal('claimed'), idempotencyKey: v.string() }), v.object({ kind: v.literal('existing'), outcome: ledgerOutcome })),
  handler: async (ctx, args) => {
    valid(args.ownerHash);
    if(args.operationId!==undefined&&!/^[a-zA-Z0-9_-]{16,80}$/.test(args.operationId))throw new Error('Invalid operation');
    if (!/^[a-f0-9]{64}$/.test(args.recipientDigest)) throw new Error('Invalid digest');
    const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
    if (args.expiresAt <= Date.now() || args.expiresAt > Date.now() + 30 * 86400000 + 1000 || (session && (session.revoked || session.expiresAt !== args.expiresAt))) return { kind: 'existing', outcome: { outcome: 'rejected', reason: 'already_rejected' } } as const;
    const prior = await ctx.db.query('shortlistMail').withIndex('by_ownerHash_and_operationId', q => q.eq('ownerHash', args.ownerHash).eq('operationId',args.operationId)).unique();
    if (prior) return { kind: 'existing', outcome: prior.result } as const;
    const recent=await ctx.db.query('shortlistMail').withIndex('by_ownerHash',q=>q.eq('ownerHash',args.ownerHash)).order('desc').take(5);
    if(recent.length===5&&recent[4]._creationTime>Date.now()-600000)return {kind:'existing',outcome:{outcome:'rejected',reason:'already_rejected'}} as const;
    if (!session) {
      await ctx.db.insert('visitorSessions', { ownerHash: args.ownerHash, expiresAt: args.expiresAt, revoked: false });
      await ctx.scheduler.runAt(args.expiresAt, internal.memory.expire, { ownerHash: args.ownerHash });
    }
    const idempotencyKey = `lulu-shortlist-${args.ownerHash}${args.operationId ? `-${args.operationId}` : ""}`;
    await ctx.db.insert('shortlistMail', { ...args, idempotencyKey, result: { outcome: 'pending' } });
    return { kind: 'claimed', idempotencyKey } as const;
  },
});
export const settle = internalMutation({ args: { ownerHash: v.string(), operationId:v.optional(v.string()), outcome: terminal }, returns: v.null(), handler: async (ctx, args) => {
  valid(args.ownerHash);
    if(args.operationId!==undefined&&!/^[a-zA-Z0-9_-]{16,80}$/.test(args.operationId))throw new Error('Invalid operation');
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (!session || session.revoked || session.expiresAt <= Date.now()) throw new Error('Permission ended');
  const prior = await ctx.db.query('shortlistMail').withIndex('by_ownerHash_and_operationId', q => q.eq('ownerHash', args.ownerHash).eq('operationId',args.operationId)).unique();
  if (!prior) throw new Error('No reserved attempt');
  if (prior.result.outcome === 'pending') await ctx.db.patch(prior._id, { result: args.outcome });
  return null;
}});
export const status = internalQuery({ args: { ownerHash: v.string(), operationId:v.optional(v.string()), now: v.number() }, returns: v.union(ledgerOutcome, v.null()), handler: async (ctx, { ownerHash, operationId, now }) => {
  valid(ownerHash);
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (!session || session.revoked || session.expiresAt <= now) return null;
  return (await ctx.db.query('shortlistMail').withIndex('by_ownerHash_and_operationId', q => q.eq('ownerHash', ownerHash).eq('operationId',operationId)).unique())?.result ?? null;
}});
