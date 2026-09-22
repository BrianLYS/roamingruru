import {convexTest} from 'convex-test';
import {expect,test,vi} from 'vitest';
import schema from './schema';
import {internal} from './_generated/api';
import {FACE_MODEL,faceMatch} from './faces';
const modules=import.meta.glob('./**/*.ts');
const vector=(axis:number)=>Array.from({length:256},(_,i)=>i===axis?1:0);
test('consented face recall crosses sessions without granting ownership; forget preserves subscription and blocks stale enrollment',async()=>{
 const t=convexTest(schema,modules);const ownerHash='f'.repeat(64);const session={ownerHash,expiresAt:Date.now()+100000};const data={...session,version:0,consent:true as const,model:FACE_MODEL,embedding:vector(0),name:'Test visitor',preferences:['Quiet evening classes','Blue jackets']};
 await expect(t.mutation(internal.faces.enroll,{...data,consent:false as never})).rejects.toThrow();
 expect(await t.mutation(internal.faces.enroll,data)).toEqual({status:'saved'});
 const recall=await t.query(internal.faces.recognize,{model:FACE_MODEL,embedding:vector(0),now:Date.now()});expect(recall).toMatchObject({status:'recognized',name:'Test visitor',preferences:data.preferences});expect(recall).not.toHaveProperty('email');
 expect((await t.query(internal.profiles.read,{ownerHash:'e'.repeat(64),now:Date.now()})).personal).toBeNull();
 expect(await t.query(internal.faces.recognize,{model:FACE_MODEL,embedding:vector(1),now:Date.now()})).toEqual({status:'unknown'});
 await t.mutation(internal.profiles.register,{...session,version:0,consent:true,emailCiphertext:'synthetic',emailDigest:'synthetic',emailHint:'t•••@example.invalid',keyVersion:1});
 expect(await t.mutation(internal.memory.forget,session)).toMatchObject({version:1,newsletterRetained:true});
 expect(await t.mutation(internal.faces.enroll,data)).toEqual({status:'stale'});
 expect(await t.query(internal.faces.recognize,{model:FACE_MODEL,embedding:vector(0),now:Date.now()})).toEqual({status:'unknown'});
 const saved=await t.query(internal.profiles.read,{ownerHash,now:Date.now()});expect(saved.personal).toBeNull();expect(saved.face).toBeNull();expect(saved.newsletter?.status).toBe('active');
 await t.mutation(internal.profiles.unsubscribe,{...session,version:0});expect((await t.query(internal.profiles.read,{ownerHash,now:Date.now()})).newsletter).toBeNull();
 await t.mutation(internal.faces.enroll,{...data,version:1});await t.mutation(internal.profiles.unsubscribe,{...session,version:1});expect((await t.query(internal.profiles.read,{ownerHash,now:Date.now()})).face?.enrolled).toBe(true);
});
test('ambiguous vectors do not disclose identities; invalid vectors fail; expiry removes face and memory',async()=>{
 expect(faceMatch(vector(0),[{embedding:vector(0)},{embedding:vector(0)}])).toEqual({status:'uncertain'});
 vi.useFakeTimers();try{const t=convexTest(schema,modules);const data={ownerHash:'a'.repeat(64),expiresAt:Date.now()+1000,version:0,consent:true as const,model:FACE_MODEL,embedding:vector(0),name:'QA',preferences:[]};
 await expect(t.mutation(internal.faces.enroll,{...data,embedding:[1]})).rejects.toThrow();await t.mutation(internal.faces.enroll,data);vi.setSystemTime(data.expiresAt+1);expect(await t.query(internal.faces.recognize,{model:FACE_MODEL,embedding:vector(0),now:Date.now()})).toEqual({status:'unknown'});await t.finishAllScheduledFunctions(vi.runAllTimers);expect(await t.run(ctx=>ctx.db.query('faceReferences').collect())).toEqual([]);expect(await t.run(ctx=>ctx.db.query('personalMemories').collect())).toEqual([]);
 }finally{vi.useRealTimers();}
});
