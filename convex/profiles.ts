import { v } from 'convex/values';
import { internalMutation, internalQuery, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { profile } from './profileFields';
const outcome = v.object({ status: v.union(v.literal('saved'), v.literal('stale'), v.literal('revoked')) });
export async function sessionFor(ctx: MutationCtx, ownerHash: string, expiresAt: number) {
  if (!/^[a-f0-9]{64}$/.test(ownerHash) || !Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 30 * 86400000 + 1000) throw new Error('Invalid session');
  const existing = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (existing) return existing.revoked || existing.expiresAt <= Date.now() ? null : existing;
  const id = await ctx.db.insert('visitorSessions', { ownerHash, expiresAt, revoked: false });
  await ctx.scheduler.runAt(expiresAt, internal.memory.expire, { ownerHash });
  return (await ctx.db.get(id))!;
}
export const read = internalQuery({ args: { ownerHash: v.string(), now: v.optional(v.number()) }, returns: v.object({ personal: v.union(v.null(), v.object({name:v.string(),preferences:v.array(v.string())})), face: v.union(v.null(),v.object({enrolled:v.literal(true),model:v.string()})), profile: v.union(v.null(), profile), profileVersion: v.number(), newsletterVersion: v.number(), newsletter: v.union(v.null(), v.object({ status: v.union(v.literal('pending'), v.literal('active')), emailHint: v.string() })) }), handler: async (ctx, { ownerHash, now = 0 }) => {
  const session = await ctx.db.query('visitorSessions').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  if (!session || session.revoked || session.expiresAt <= now) return { personal:null,face:null,profile: null, profileVersion: 0, newsletterVersion: 0, newsletter: null };
  const saved = await ctx.db.query('styleProfiles').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  const newsletter = await ctx.db.query('mailingRequests').withIndex('by_ownerHash', q => q.eq('ownerHash', ownerHash)).unique();
  const personal = await ctx.db.query('personalMemories').withIndex('by_ownerHash',q=>q.eq('ownerHash',ownerHash)).unique();
  const face = await ctx.db.query('faceReferences').withIndex('by_ownerHash',q=>q.eq('ownerHash',ownerHash)).unique();
  return { personal: personal ? {name:personal.name,preferences:personal.preferences}:null, face: face ? {enrolled:true as const,model:face.model}:null, profile: saved?.profile ?? null, profileVersion: session.profileVersion ?? 0, newsletterVersion: session.newsletterVersion ?? 0, newsletter: newsletter ? { status: newsletter.status, emailHint: newsletter.emailHint } : null };
}});
export const save = internalMutation({ args: { ownerHash: v.string(), expiresAt: v.number(), version: v.number(), consent: v.literal(true), profile }, returns: outcome, handler: async (ctx, args) => {
  if (!validPersonal(args.profile.name, [])) throw new Error('Invalid preferred name');
  const session = await sessionFor(ctx, args.ownerHash, args.expiresAt);
  if (!session) return { status: 'revoked' } as const;
  if (args.version !== (session.profileVersion ?? 0)) return { status: 'stale' } as const;
  const saved = await ctx.db.query('styleProfiles').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  const data = { profile: args.profile, consentedAt: Date.now() };
  if (saved) await ctx.db.patch(saved._id, data); else await ctx.db.insert('styleProfiles', { ownerHash: args.ownerHash, ...data });
  const memory = await ctx.db.query('visitorMemories').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (memory) await ctx.db.patch(memory._id, { interest: args.profile.interest, updatedAt: Date.now() });
  else await ctx.db.insert('visitorMemories', { ownerHash: args.ownerHash, interest: args.profile.interest, consentedAt: Date.now(), updatedAt: Date.now() });
  return { status: 'saved' } as const;
}});
export const clear = internalMutation({ args: { ownerHash: v.string(), expiresAt: v.number(), version: v.number() }, returns: outcome, handler: async (ctx, args) => {
  const session = await sessionFor(ctx, args.ownerHash, args.expiresAt);
  if (!session) return { status: 'revoked' } as const;
  if (args.version !== (session.profileVersion ?? 0)) return { status: 'stale' } as const;
  const saved = await ctx.db.query('styleProfiles').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  const memory = await ctx.db.query('visitorMemories').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (saved) await ctx.db.delete(saved._id); if (memory) await ctx.db.delete(memory._id);
  await ctx.db.patch(session._id, { profileVersion: args.version + 1 });
  return { status: 'saved' } as const;
}});
export const register = internalMutation({ args: { ownerHash: v.string(), expiresAt: v.number(), version: v.number(), consent: v.literal(true), emailCiphertext: v.string(), emailDigest: v.string(), keyVersion: v.literal(1), emailHint: v.string() }, returns: outcome, handler: async (ctx, args) => {
  if (args.emailCiphertext.length > 2048 || args.emailHint.length > 260) throw new Error('Invalid request');
  const session = await sessionFor(ctx, args.ownerHash, args.expiresAt);
  if (!session) return { status: 'revoked' } as const;
  if (args.version !== (session.newsletterVersion ?? 0)) return { status: 'stale' } as const;
  const saved = await ctx.db.query('mailingRequests').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  const data = { emailCiphertext: args.emailCiphertext, emailDigest: args.emailDigest, keyVersion: args.keyVersion, emailHint: args.emailHint, status: 'active' as const, consentedAt: Date.now() };
  if (saved) await ctx.db.patch(saved._id, data); else await ctx.db.insert('mailingRequests', { ownerHash: args.ownerHash, ...data });
  return { status: 'saved' } as const;
}});
export const unsubscribe = internalMutation({ args: { ownerHash: v.string(), expiresAt: v.number(), version: v.number() }, returns: outcome, handler: async (ctx, args) => {
  const session = await sessionFor(ctx, args.ownerHash, args.expiresAt);
  if (!session) return { status: 'revoked' } as const;
  if (args.version !== (session.newsletterVersion ?? 0)) return { status: 'stale' } as const;
  const saved = await ctx.db.query('mailingRequests').withIndex('by_ownerHash', q => q.eq('ownerHash', args.ownerHash)).unique();
  if (saved) await ctx.db.delete(saved._id);
  await ctx.db.patch(session._id, { newsletterVersion: args.version + 1 });
  return { status: 'saved' } as const;
}});

export function validPersonal(name:string,preferences:string[]) { return name.length<=40 && !/@|\b(?:\+?\d[ ().-]*){7,}\b/u.test(name) && !/[\p{Cc}\p{Cf}]/u.test(name) && preferences.length<=8 && preferences.every(p=>p.trim().length>0 && p.length<=160 && !/@|\b(?:\+?\d[ ().-]*){7,}\b/u.test(p) && !/[\p{Cc}\p{Cf}]/u.test(p)); }
export const personal = internalMutation({args:{ownerHash:v.string(),expiresAt:v.number(),version:v.number(),consent:v.literal(true),name:v.string(),preferences:v.array(v.string())},handler:async(ctx,args)=>{
 if(!validPersonal(args.name,args.preferences)) throw new Error('Invalid personal memory');
 const session=await sessionFor(ctx,args.ownerHash,args.expiresAt); if(!session)return {status:'revoked'}; if(args.version!==(session.profileVersion??0))return {status:'stale'};
 const prior=await ctx.db.query('personalMemories').withIndex('by_ownerHash',q=>q.eq('ownerHash',args.ownerHash)).unique();
 const data={name:args.name,preferences:args.preferences,consentedAt:Date.now()}; if(prior)await ctx.db.patch(prior._id,data); else await ctx.db.insert('personalMemories',{ownerHash:args.ownerHash,...data}); return {status:'saved'};
}});
