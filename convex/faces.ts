import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { sessionFor, validPersonal } from './profiles';
export const FACE_MODEL='human-mobileface-256-v1';
export function validEmbedding(model:string,embedding:number[]) { const norm=Math.sqrt(embedding.reduce((s,x)=>s+x*x,0));return model===FACE_MODEL&&embedding.length===256&&embedding.every(Number.isFinite)&&Math.abs(norm-1)<.02; }
export function faceMatch(probe:number[],candidates:{embedding:number[]}[]) {const scores=candidates.map((c,index)=>({index,score:c.embedding.reduce((s,x,i)=>s+x*probe[i],0)})).sort((a,b)=>b.score-a.score);const best=scores[0];if(!best||best.score<.65)return {status:'unknown' as const};if(best.score<.82||(scores[1]&&best.score-scores[1].score<.08))return {status:'uncertain' as const};return {status:'recognized' as const,index:best.index};}
export const enroll=internalMutation({args:{ownerHash:v.string(),expiresAt:v.number(),version:v.number(),consent:v.literal(true),model:v.string(),embedding:v.array(v.number()),name:v.string(),preferences:v.array(v.string())},handler:async(ctx,args)=>{
 if(!validEmbedding(args.model,args.embedding)||!validPersonal(args.name,args.preferences)||!args.name.trim())throw new Error('Invalid face enrollment');
 const session=await sessionFor(ctx,args.ownerHash,args.expiresAt);if(!session)return {status:'revoked'};if(args.version!==(session.profileVersion??0))return {status:'stale'};
 const prior=await ctx.db.query('faceReferences').withIndex('by_ownerHash',q=>q.eq('ownerHash',args.ownerHash)).unique();const data={model:args.model,embedding:args.embedding,consentedAt:Date.now(),expiresAt:args.expiresAt};if(prior)await ctx.db.patch(prior._id,data);else await ctx.db.insert('faceReferences',{ownerHash:args.ownerHash,...data});
 const personal=await ctx.db.query('personalMemories').withIndex('by_ownerHash',q=>q.eq('ownerHash',args.ownerHash)).unique();const memory={name:args.name,preferences:args.preferences,consentedAt:Date.now()};if(personal)await ctx.db.patch(personal._id,memory);else await ctx.db.insert('personalMemories',{ownerHash:args.ownerHash,...memory});return {status:'saved'};
}});
export const recognize=internalQuery({args:{model:v.string(),embedding:v.array(v.number()),now:v.number()},handler:async(ctx,args)=>{
 if(!validEmbedding(args.model,args.embedding))throw new Error('Invalid face representation');
 const candidates=(await ctx.db.query('faceReferences').withIndex('by_model',q=>q.eq('model',args.model)).take(500)).filter(x=>x.expiresAt>args.now);
 const match=faceMatch(args.embedding,candidates);if(match.status!=='recognized')return match;
 const face=candidates[match.index];const session=await ctx.db.query('visitorSessions').withIndex('by_ownerHash',q=>q.eq('ownerHash',face.ownerHash)).unique();
 const memory=await ctx.db.query('personalMemories').withIndex('by_ownerHash',q=>q.eq('ownerHash',face.ownerHash)).unique();if(!session||session.revoked||session.expiresAt<=args.now||!memory)return {status:'unknown'};
 return {status:'recognized',ownerHash:face.ownerHash,name:memory.name,preferences:memory.preferences};
}});
