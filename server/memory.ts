import { requestOrigin } from './requestOrigin.ts';
import { createCipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { loadEnv, type Plugin, type Connect } from 'vite';
import { createShortlistEmailService } from './shortlistEmail.ts';
import { signAgentReply } from './agentSpeechToken.ts';
import { readShortlist } from './shortlistReceipt.ts';
const lifetime = 30 * 86400000;
const name = 'lulu_memory';
export function sessionCodec(secret: string) {
  const mac = (text: string) => createHmac('sha256', secret).update(text).digest('hex');
  return {
    issue() { const value = `${randomBytes(32).toString('hex')}.${Date.now() + lifetime}`; return `${value}.${mac(value)}`; },
    read(token: string | undefined) {
      if (!token || !/^[a-f0-9]{64}\.\d{13}\.[a-f0-9]{64}$/.test(token)) return null;
      const [nonce, expiry, signature] = token.split('.'); const expiresAt = Number(expiry);
      if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(mac(`${nonce}.${expiry}`), 'hex')) || expiresAt <= Date.now() || expiresAt > Date.now() + lifetime + 1000) return null;
      return { ownerHash: mac(`lulu-memory-owner:${nonce}.${expiry}`), expiresAt };
    },
  };
}
export function validPersonal(name:unknown,preferences:unknown):boolean {return typeof name==='string'&&name.length<=40&&!/@|\b(?:\+?\d[ ().-]*){7,}\b/u.test(name)&&!/[\p{Cc}\p{Cf}]/u.test(name)&&Array.isArray(preferences)&&preferences.length<=8&&preferences.every(p=>typeof p==='string'&&p.trim().length>0&&p.length<=160&&!/@|\b(?:\+?\d[ ().-]*){7,}\b/u.test(p)&&!/[\p{Cc}\p{Cf}]/u.test(p));}
export function validEmbedding(model:unknown,embedding:unknown):boolean {return model==='human-mobileface-256-v1'&&Array.isArray(embedding)&&embedding.length===256&&embedding.every(x=>typeof x==='number'&&Number.isFinite(x))&&Math.abs(Math.sqrt(embedding.reduce((n,x)=>n+x*x,0))-1)<.02;}
const interests = ['yoga', 'running', 'exploring'];
export function validateProfile(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  const fields = { interest: interests, garment: ['top', 'leggings', 'shorts', 'jacket', 'trousers', 'dress', 'unknown'], color: ['black', 'white', 'grey', 'blue', 'green', 'red', 'pink', 'neutral', 'other'], style: ['active', 'casual', 'smart', 'unknown'] };
  return Object.keys(profile).length === 5 && validPersonal(profile.name, []) && Object.entries(fields).every(([key, options]) => typeof profile[key] === 'string' && options.includes(profile[key] as string));
}
export function protectEmail(value: unknown, secret: string) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)) return null;
  const key = createHmac('sha256', secret).update('lulu-mailing-contact-encryption-v1').digest();
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  return { emailDigest: createHmac('sha256', secret).update(`lulu-mailing-dedupe-v1:${email}`).digest('hex'), keyVersion: 1, emailCiphertext: `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`, emailHint: `${email[0]}•••@${email.split('@')[1]}` };
}
export function visitorMemory(runtimeEnv?: Record<string, string>): Plugin {
  let env: Record<string, string> = runtimeEnv ?? {};
  const faceLimits=new Map<string,number[]>();
  const attach = (middlewares: Connect.Server) => {
    middlewares.use('/api/lulu/memory', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
      const send = (status: number, value: unknown) => { res.statusCode = status; res.end(JSON.stringify(value)); };
      const origin = requestOrigin(req, env);
      if (!origin || (req.headers.origin && req.headers.origin !== origin) || (req.method !== 'GET' && req.headers.origin !== origin)) { send(403, { error: 'Use Ruru from this site.' }); return; }
      const path = (req.url ?? '/').split('?')[0];
      const operationId=new URL(req.url??'/', 'http://localhost').searchParams.get('operationId')??undefined;
      if (!((req.method === 'GET' && ['/', '/profile', '/shortlist-email'].includes(path)) || (req.method === 'POST' && ['/session', '/consent', '/save', '/forget', '/profile', '/newsletter', '/unsubscribe', '/clear-interest', '/shortlist-email','/personal','/face/enroll','/face/recognize'].includes(path)))) { send(405, { error: 'Unsupported memory operation.' }); return; }
      if (!env.MEMORY_SESSION_SECRET || !env.CONVEX_DEPLOY_KEY || env.CONVEX_URL !== 'https://famous-tapir-87.convex.cloud') { send(503, { error: 'Memory is unavailable. You can still talk with Ruru.' }); return; }
      const codec = sessionCodec(env.MEMORY_SESSION_SECRET);
      const token = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
      const session = codec.read(token);
      const cookie = (value: string, maxAge: number) => res.setHeader('Set-Cookie', [`${name}=; Path=/api/lulu/memory; Max-Age=0; HttpOnly; SameSite=Strict${env.RURU_SITE_ORIGIN ? "; Secure" : ""}`,`${name}=${value}; Path=/api/lulu; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${env.RURU_SITE_ORIGIN ? "; Secure" : ""}`]);
      if(session)cookie(token!,Math.floor((session.expiresAt-Date.now())/1000));
      const capabilities = { vision: !!(env.OPENAI_API_KEY && env.OPENAI_MODEL), search: !!env.FIRECRAWL_API_KEY, email: true, shortlistEmail: !!(env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID) };
      const emptyProfile = { personal:null, face:null, profile: null, profileVersion: 0, newsletterVersion: 0, newsletter: null };
      const call = async (operation: string, args: unknown) => {
        const response = await fetch(`${env.CONVEX_URL}/api/function`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Convex ${env.CONVEX_DEPLOY_KEY}` }, body: JSON.stringify({ path: operation, format: 'convex_encoded_json', args }), signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Unavailable');
        const result = await response.json(); if (result.status !== 'success') throw new Error('Unavailable'); return result.value;
      };
      const snapshot = () => session ? call('profiles:read', { ownerHash: session.ownerHash, now: Date.now() }) : Promise.resolve(emptyProfile);
      try {
        if (req.method === 'GET') {
          if (path === '/shortlist-email') { const result = session ? await call('shortlistMail:status', { ownerHash: session.ownerHash, now: Date.now(), ...(operationId?{operationId}:{}) }) : null; send(200, { outcome: result?.outcome ?? null }); return; }
          if (path === '/profile') { send(200, { ...await snapshot(), capabilities }); return; }
          if (!session) { if (token) cookie('', 0); send(200, { state: 'empty', version: 0 }); return; }
          const result = await call('memory:inspect', { ownerHash: session.ownerHash, now: Date.now() });
          if (result.state === 'revoked') cookie('', 0);
          send(200, result); return;
        }
        if (!req.headers['content-type']?.startsWith('application/json')) { send(415, { error: 'Expected JSON.' }); return; }
        let body = ''; for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > (['/shortlist-email','/face/enroll','/face/recognize'].includes(path) ? 18000 : 4096)) { send(413, { error: 'Request too large.' }); return; } }
        let data: Record<string, unknown>; try { data = JSON.parse(body); if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error(); } catch { send(400, { error: 'Invalid request.' }); return; }
        const keys: Record<string, string[]> = { '/session': ['consent', 'interest', 'purpose'], '/consent': ['consent', 'interest', 'version'], '/save': ['interest', 'version'], '/forget': [], '/personal':['consent','version','name','preferences'], '/face/enroll':['consent','version','model','embedding','name','preferences'], '/face/recognize':['consent','model','embedding'], '/profile': ['consent', 'version', 'profile'], '/newsletter': ['consent', 'version', 'email'], '/unsubscribe': ['version'], '/clear-interest': ['version'], '/shortlist-email': ['consent', 'email', 'receipt','operationId'] };
        if (Object.keys(data).some(key => !keys[path].includes(key))) { send(400, { error: 'Unexpected request fields.' }); return; }
        const validInterest = typeof data.interest === 'string' && interests.includes(data.interest);
        const version = data.version ?? 0;
        if (['/profile', '/newsletter', '/unsubscribe', '/clear-interest','/personal','/face/enroll'].includes(path) && data.version === undefined) { send(400, { error: 'Review the current saved state first.' }); return; }
        if (!Number.isSafeInteger(version) || (version as number) < 0) { send(400, { error: 'Invalid revision.' }); return; }
        if (path === '/session') {
          if (data.consent !== true || !(validInterest && data.purpose === undefined || typeof data.purpose === 'string' && ['profile', 'newsletter', 'shortlist'].includes(data.purpose) && data.interest === undefined)) { send(400, { error: 'Choose explicit permission first.' }); return; }
          const next = session ? token! : codec.issue(); const decoded = codec.read(next)!;
          cookie(next, Math.floor((decoded.expiresAt - Date.now()) / 1000)); send(200, { state: 'ready' }); return;
        }
        if ((['/consent', '/profile', '/newsletter'].includes(path) && data.consent !== true) || (['/consent', '/save'].includes(path) && !validInterest) || (path === '/profile' && !validateProfile(data.profile))) { send(400, { error: 'Review your details and explicit permission.' }); return; }
        if (path === '/profile') { const p = data.profile as Record<string, string>; data.profile = { ...p, name: p.name.normalize('NFKC').trim() }; if (!validateProfile(data.profile)) { send(400, { error: 'Use a shorter preferred name.' }); return; } }
        if(['/personal','/face/enroll'].includes(path)&& (data.consent!==true||!validPersonal(data.name,data.preferences))) {send(400,{error:'Review your name, preferences and permission.'});return;}
        if(['/face/enroll','/face/recognize'].includes(path)&&(data.consent!==true||!validEmbedding(data.model,data.embedding))){send(400,{error:'Choose face recognition permission and a valid camera view.'});return;}
        if(path==='/face/recognize'){
          const bucket=req.socket.remoteAddress??'local';const now=Date.now();const recent=(faceLimits.get(bucket)??[]).filter(t=>now-t<60000);if(recent.length>=30){send(429,{error:'Please wait before trying recognition again.'});return;}faceLimits.set(bucket,[...recent,now]);
          const result=await call('faces:recognize',{model:data.model,embedding:data.embedding,now});
          const {ownerHash,...publicResult}=result;
          const greeting=ownerHash ? `Hey ${result.name}, good to see you again.` : undefined;
          send(200,{...publicResult,...(ownerHash?{recognitionToken:signRecognition(ownerHash,env.MEMORY_SESSION_SECRET),greeting,voiceToken:signAgentReply(greeting!,env.MEMORY_SESSION_SECRET)}:{})});return;
        }
        const email = path === '/newsletter' ? protectEmail(data.email, env.MEMORY_SESSION_SECRET) : null;
        if (path === '/newsletter' && !email) { send(400, { error: 'Enter a valid email address.' }); return; }
        if (!session) { if (path === '/forget') { cookie('', 0); send(200, { state: 'empty' }); } else send(409, { error: 'Please choose permission again.' }); return; }
        if (path === '/shortlist-email') {
          if (!capabilities.shortlistEmail) { send(503, { error: 'Shortlist email is not connected yet.' }); return; }
          if(typeof data.operationId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(data.operationId)){send(400,{error:'Start a new email request.'});return;}
          const items = readShortlist(data.receipt, env.MEMORY_SESSION_SECRET);
          const recipient = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
          const contact = protectEmail(recipient, env.MEMORY_SESSION_SECRET);
          if (data.consent !== true || !items || !contact) { send(400, { error: 'Review your email and refresh your shortlist before sending.' }); return; }
          const service = createShortlistEmailService({ apiKey: env.AGENTMAIL_API_KEY, inboxId: env.AGENTMAIL_INBOX_ID }, {
            reserve: args => call('shortlistMail:reserve', args),
            settle: async args => { await call('shortlistMail:settle', args); },
          });
          const result = await service({ ...session, recipient, recipientDigest: contact.emailDigest, consent: true, items, operationId:data.operationId });
          send(200, { outcome: result.outcome }); return;
        }
        if (path === '/forget') { const result=await call('memory:forget', session); cookie(token!,Math.floor((session.expiresAt-Date.now())/1000));send(200,result);return; }
        let result;
        if (path === '/personal') result=await call('profiles:personal',{...session,version,consent:true,name:data.name,preferences:data.preferences});
        else if(path === '/face/enroll') result=await call('faces:enroll',{...session,version,consent:true,model:data.model,embedding:data.embedding,name:data.name,preferences:data.preferences});
        else if (path === '/profile') result = await call('profiles:save', { ...session, version, consent: true, profile: data.profile });
        else if (path === '/newsletter') result = await call('profiles:register', { ...session, version, consent: true, ...email });
        else if (path === '/unsubscribe') result = await call('profiles:unsubscribe', { ...session, version });
        else if (path === '/clear-interest') result = await call('profiles:clear', { ...session, version });
        else result = await call(`memory:${path.slice(1)}`, { ownerHash: session.ownerHash, interest: data.interest, version, ...(path === '/consent' ? { expiresAt: session.expiresAt } : {}) });
        if (result.state === 'revoked' || result.status === 'revoked') { cookie('', 0); send(409, { error: 'That permission has ended. Please choose again.' }); return; }
        if (result.state === 'changed' || result.status === 'stale') { const current = await snapshot(); send(409, { error: 'Your saved choices changed. Refresh and review before trying again.', version: current.profileVersion }); return; }
        if (path === '/clear-interest') { send(200, { state: 'empty', version: (version as number) + 1 }); return; }
        if (['/consent', '/save'].includes(path)) send(200, { ...result, version }); else send(200, result);
      } catch { send(503, { error: 'Saved details could not be confirmed. Please retry; your conversation still works.' }); }
    });
  };
  return { name: 'local-visitor-memory', configResolved(config) { env = runtimeEnv ?? { ...loadEnv(config.mode, config.root, ''), ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) }; }, configureServer(server) { attach(server.middlewares); }, configurePreviewServer(server) { attach(server.middlewares); } };
}

function signRecognition(ownerHash:string,secret:string){const text=`${ownerHash}.${Date.now()+60000}`;return `${text}.${createHmac('sha256',secret).update(`face-recall:${text}`).digest('hex')}`;}
export function readRecognition(token:unknown,secret:string){if(typeof token!=='string'||!/^[a-f0-9]{64}\.\d{13}\.[a-f0-9]{64}$/.test(token))return null;const[owner,expiry,sig]=token.split('.');if(Number(expiry)<=Date.now()||Number(expiry)>Date.now()+60000)return null;const expected=createHmac('sha256',secret).update(`face-recall:${owner}.${expiry}`).digest('hex');return timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(expected,'hex'))?owner:null;}
export async function getConversationContext(req:IncomingMessage,env:Record<string,string>,recognitionToken?:unknown,recognitionMode=false):Promise<{memory?:{name:string,preferences:string[]},recognition?:{status:'known',name:string},mailingList?:{subscribed:boolean}}>{
 if(!env.MEMORY_SESSION_SECRET||!env.CONVEX_DEPLOY_KEY||env.CONVEX_URL!=='https://famous-tapir-87.convex.cloud')return {};
 const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
 const recognizedOwner=readRecognition(recognitionToken,env.MEMORY_SESSION_SECRET);if(recognitionMode&&!recognizedOwner)return {};const ownerHash=recognizedOwner??sessionCodec(env.MEMORY_SESSION_SECRET).read(token)?.ownerHash;if(!ownerHash)return {};
 try{const response=await fetch(`${env.CONVEX_URL}/api/function`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Convex ${env.CONVEX_DEPLOY_KEY}`},body:JSON.stringify({path:'profiles:read',format:'convex_encoded_json',args:{ownerHash,now:Date.now()}}),signal:AbortSignal.timeout(5000)});if(!response.ok)return {};const data=await response.json();const saved=data.status==='success'?data.value:null;if(!saved)return {};if(recognizedOwner&&!saved.face)return {};const memory=saved.personal??(saved.profile?{name:saved.profile.name,preferences:[saved.profile.interest]}:null);const mailingList=!recognizedOwner&&!recognitionMode?{mailingList:{subscribed:saved.newsletter?.status==='active'}}:{};return {...mailingList,...(memory?{memory,...(recognizedOwner?{recognition:{status:'known' as const,name:memory.name}}:{})}:{})};}catch{return {};}
}
