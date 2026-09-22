import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
export const interest = v.union(v.literal('yoga'), v.literal('running'), v.literal('exploring'));
const result = v.union(v.object({ state: v.literal('empty') }), v.object({ state: v.literal('revoked') }), v.object({ state: v.literal('changed') }), v.object({ state: v.literal('remembered'), interest }));
const lifetime = 30 * 86400000;
function validate(ownerHash: string, expiresAt?: number) {
  if (!/^[a-f0-9]{64}$/.test(ownerHash)) throw new Error('Invalid session');
  if (expiresAt !== undefined && (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + lifetime + 1000)) throw new Error('Expired session');
}
export const read = internalQuery({ args: { ownerHash: v.string(), now: v.optional(v.number()) }, returns: result, handler: async (ctx, { ownerHash, now = 0 }) => {
  validate(ownerHash);
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (!session) return { state: 'empty' } as const;
  if (session.revoked || session.expiresAt <= now) return { state: 'revoked' } as const;
  const memory = await ctx.db.query('visitorMemories').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  return memory ? { state: 'remembered', interest: memory.interest } as const : { state: 'empty' } as const;
}});
export const consent = internalMutation({ args: { ownerHash: v.string(), expiresAt: v.number(), interest, version: v.optional(v.number()) }, returns: result, handler: async (ctx, args) => {
  validate(args.ownerHash, args.expiresAt);
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (session && (session.revoked || session.expiresAt <= Date.now())) return { state: 'revoked' } as const;
  if ((session?.profileVersion ?? 0) !== (args.version ?? 0)) return { state: 'changed' } as const;
  if (!session) {
    await ctx.db.insert('visitorSessions', { ownerHash: args.ownerHash, expiresAt: args.expiresAt, revoked: false });
    await ctx.scheduler.runAt(args.expiresAt, internal.memory.expire, { ownerHash: args.ownerHash });
  }
  const memory = await ctx.db.query('visitorMemories').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (memory) await ctx.db.patch(memory._id, { interest: args.interest, updatedAt: Date.now() });
  else await ctx.db.insert('visitorMemories', { ownerHash: args.ownerHash, interest: args.interest, consentedAt: Date.now(), updatedAt: Date.now() });
  const profile = await ctx.db.query('styleProfiles').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (profile) await ctx.db.patch(profile._id, { profile: { ...profile.profile, interest: args.interest } });
  return { state: 'remembered', interest: args.interest } as const;
}});
export const save = internalMutation({ args: { ownerHash: v.string(), interest, version: v.optional(v.number()) }, returns: result, handler: async (ctx, args) => {
  validate(args.ownerHash);
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (!session || session.revoked || session.expiresAt <= Date.now()) return { state: 'revoked' } as const;
  if ((session.profileVersion ?? 0) !== (args.version ?? 0)) return { state: 'changed' } as const;
  const memory = await ctx.db.query('visitorMemories').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (!memory) return { state: 'empty' } as const;
  await ctx.db.patch(memory._id, { interest: args.interest, updatedAt: Date.now() });
  const profile = await ctx.db.query('styleProfiles').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (profile) await ctx.db.patch(profile._id, { profile: { ...profile.profile, interest: args.interest } });
  return { state: 'remembered', interest: args.interest } as const;
}});
export const forget = internalMutation({ args: { ownerHash: v.string(), expiresAt: v.number() }, handler: async (ctx, args) => {
 validate(args.ownerHash,args.expiresAt);
 for(const table of ['visitorMemories','styleProfiles','personalMemories','faceReferences'] as const){const rows=await ctx.db.query(table).withIndex('by_ownerHash',q=>q.eq('ownerHash',args.ownerHash)).collect(); for(const row of rows)await ctx.db.delete(row._id);}
 const session=await ctx.db.query('visitorSessions').withIndex('by_ownerHash',q=>q.eq('ownerHash',args.ownerHash)).unique();
 const version=(session?.profileVersion??0)+1;
 if(session)await ctx.db.patch(session._id,{profileVersion:version}); else {await ctx.db.insert('visitorSessions',{ownerHash:args.ownerHash,expiresAt:args.expiresAt,revoked:false,profileVersion:version});await ctx.scheduler.runAt(args.expiresAt,internal.memory.expire,{ownerHash:args.ownerHash});}
 const mailing=await ctx.db.query('mailingRequests').withIndex('by_ownerHash',q=>q.eq('ownerHash',args.ownerHash)).unique();
 return {state:'empty',version,newsletterRetained:!!mailing};
}});
export const expire = internalMutation({ args: { ownerHash: v.string() }, returns: v.null(), handler: async (ctx, { ownerHash }) => {
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (!session || session.expiresAt > Date.now()) return null;
  const memory = await ctx.db.query('visitorMemories').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (memory) await ctx.db.delete(memory._id);
  const profile = await ctx.db.query('styleProfiles').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  const mailing = await ctx.db.query('mailingRequests').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (profile) await ctx.db.delete(profile._id); if (mailing) await ctx.db.delete(mailing._id);
  for(const table of ['shortlistMail','personalMemories','faceReferences'] as const){const rows=await ctx.db.query(table).withIndex('by_ownerHash',q=>q.eq('ownerHash',ownerHash)).collect();for(const row of rows)await ctx.db.delete(row._id);}
  await ctx.db.delete(session._id); return null;
}});
// The legacy read shape stays small; the UI needs the state and revision from one snapshot.
export const inspect = internalQuery({ args: { ownerHash: v.string(), now: v.optional(v.number()) }, returns: v.object({ state: v.union(v.literal('empty'), v.literal('remembered'), v.literal('revoked')), interest: v.optional(interest), version: v.number() }), handler: async (ctx, { ownerHash, now = 0 }) => {
  validate(ownerHash);
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (!session) return { state: 'empty', version: 0 } as const;
  const version = session.profileVersion ?? 0;
  if (session.revoked || session.expiresAt <= now) return { state: 'revoked', version } as const;
  const memory = await ctx.db.query('visitorMemories').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  return memory ? { state: 'remembered', interest: memory.interest, version } as const : { state: 'empty', version } as const;
}});
