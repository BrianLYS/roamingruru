// @vitest-environment node
import {expect,it,vi} from 'vitest';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {createPersonTools} from './personTools';
import {sessionCodec} from './memory';
const env={MEMORY_SESSION_SECRET:'synthetic',CONVEX_DEPLOY_KEY:'synthetic',CONVEX_URL:'https://famous-tapir-87.convex.cloud'};
const face={model:'human-mobileface-256-v1',embedding:[1,...Array(255).fill(0)]};
function fixture(cookie?:string){const req={headers:{cookie:cookie?`lulu_memory=${cookie}`:undefined}} as IncomingMessage;const res={setHeader:vi.fn()} as unknown as ServerResponse;return {req,res};}
it('issues a scoped session, writes actual personal memory and verifies readback',async()=>{
 let saved:any=null;const calls:any[]=[];const {req,res}=fixture();
 const request=vi.fn(async(_url,init)=>{const x=JSON.parse(init!.body as string);calls.push(x);if(x.path==='profiles:personal')saved={name:x.args.name,preferences:x.args.preferences};return Response.json({status:'success',value:x.path==='profiles:personal'?{status:'saved'}:{personal:saved,profileVersion:0,face:null}});}) as unknown as typeof fetch;
 const result=await createPersonTools(req,res,env,{},undefined,request).remember({name:'Brian',preferences:['running'],include_face:false});
 expect(result).toMatchObject({status:'remembered',person:{name:'Brian'}});expect(calls.map(x=>x.path)).toEqual(['profiles:read','profiles:personal','profiles:read']);
 expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie',expect.stringContaining('Path=/api/lulu;'));expect(calls[1].args.ownerHash).toMatch(/^[a-f0-9]{64}$/);expect(calls[1].args.consent).toBe(true);
});
it('uses dedicated face matching for recall without granting foreign owner writes',async()=>{
 const {req,res}=fixture(sessionCodec(env.MEMORY_SESSION_SECRET).issue());const calls:string[]=[];
 const request=vi.fn(async(_url,init)=>{const x=JSON.parse(init!.body as string);calls.push(x.path);return Response.json({status:'success',value:x.path==='faces:recognize'?{status:'recognized',ownerHash:'f'.repeat(64)}:{face:{enrolled:true},personal:{name:'Sam',preferences:['yoga']}}});}) as unknown as typeof fetch;
 const tools=createPersonTools(req,res,env,face,undefined,request);
 expect(await tools.recognize()).toMatchObject({status:'recognized',person:{name:'Sam'}});expect(await tools.remember({name:'Sam',preferences:[],include_face:true})).toMatchObject({status:'different_owner'});expect(await tools.forget()).toMatchObject({status:'different_owner'});expect(calls).toEqual(['faces:recognize','profiles:read']);
});
it('enrolls the bounded local face and deletes memory independently from mailing',async()=>{
 const {req,res}=fixture(sessionCodec(env.MEMORY_SESSION_SECRET).issue());let saved:any=null;let enrolled=false;const paths:string[]=[];
 const request=vi.fn(async(_url,init)=>{const x=JSON.parse(init!.body as string);paths.push(x.path);let value:any;if(x.path==='faces:enroll'){saved={name:x.args.name,preferences:x.args.preferences};enrolled=true;value={status:'saved'};}else if(x.path==='memory:forget'){saved=null;enrolled=false;value={state:'empty'};}else value={personal:saved,face:enrolled?{enrolled:true}:null,profileVersion:0,newsletter:{status:'active'}};return Response.json({status:'success',value});}) as unknown as typeof fetch;
 const tools=createPersonTools(req,res,env,face,undefined,request);expect(await tools.remember({name:'Brian',preferences:[],include_face:true})).toMatchObject({status:'remembered',faceRemembered:true});expect(await tools.forget()).toEqual({status:'forgotten',newsletterRetained:true});expect(paths).toContain('faces:enroll');expect(paths).toContain('memory:forget');expect(paths).not.toContain('profiles:unsubscribe');
});
it('does not retry uncertain writes and checks cancellation before any mutation',async()=>{
 const {req,res}=fixture();let calls=0;const request=vi.fn(async()=>{if(++calls===1)return Response.json({status:'success',value:{profileVersion:0}});throw Error('network');}) as unknown as typeof fetch;
 expect(await createPersonTools(req,res,env,{},undefined,request).remember({name:'Brian',preferences:[],include_face:false})).toMatchObject({status:'unconfirmed'});expect(request).toHaveBeenCalledTimes(2);
 const abort=new AbortController();abort.abort();const cancelled=vi.fn();expect(await createPersonTools(req,res,env,{},undefined,cancelled).remember({name:'Brian',preferences:[],include_face:false},abort.signal)).toMatchObject({status:'unconfirmed'});expect(cancelled).not.toHaveBeenCalled();
});
it('checks face ownership before enrollment even when the agent skips recognize_person',async()=>{
 const {req,res}=fixture(sessionCodec(env.MEMORY_SESSION_SECRET).issue());const request=vi.fn(async()=>Response.json({status:'success',value:{status:'recognized',ownerHash:'f'.repeat(64)}})) as unknown as typeof fetch;
 expect(await createPersonTools(req,res,env,face,undefined,request).remember({name:'Sam',preferences:[],include_face:true})).toMatchObject({status:'different_owner'});expect(request).toHaveBeenCalledTimes(1);
 expect(JSON.parse((request as any).mock.calls[0][1].body).path).toBe('faces:recognize');
});

it('distinguishes an enabled camera without a clear face from a missing camera',async()=>{
 const {req,res}=fixture();const request=vi.fn();const tools=createPersonTools(req,res,env,{image:'data:image/jpeg;base64,synthetic'},undefined,request);
 expect(await tools.recognize()).toMatchObject({status:'face_unavailable'});
 expect(await tools.remember({name:'Brian',preferences:[],include_face:true})).toMatchObject({status:'face_unavailable'});
 expect(request).not.toHaveBeenCalled();
});
