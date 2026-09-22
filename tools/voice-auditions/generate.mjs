import {mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
process.loadEnvFile('.env.local');
const dir='.local/voice-auditions';mkdirSync(dir,{recursive:true});mkdirSync('public/media/voice-auditions',{recursive:true});
const pairs=[['a','Jessica','cgSgspJ2msm6clMCkdW9','Will','bIHbv24MWmeRgasZH58o'],['b','Laura','FGY2WhTYpPnrIDTdsKH5','Liam','TX3LPaxmHKxFdv7VOQHJ'],['c','Sarah','EXAVITQu4vr4xnSDxMaL','Charlie','IKne3meq5aSn9XLyUdCD']];
const lines=['Hey Brian! You don’t look as wet today.','Your umbrella was so helpful. Thanks so much!'];
for(const [pair,lulu,luluId,brian,brianId] of pairs){
 for(let i=0;i<2;i++){
  const file=`${dir}/${pair}-${i}.mp3`,receipt=`${file}.json`;
  const body={text:lines[i],model_id:'eleven_multilingual_v2',voice_settings:{stability:.35,similarity_boost:.75,style:i===0?.4:.25,use_speaker_boost:true,speed:1.04}};
  const fingerprint=createHash('sha256').update(JSON.stringify(body)+(i?brianId:luluId)).digest('hex');
  if(existsSync(receipt)){const prior=JSON.parse(readFileSync(receipt));if(prior.status!=='generated'||prior.fingerprint!==fingerprint||!existsSync(file))throw Error('Inspect existing receipt '+receipt);continue;}
  const record={status:'requesting',fingerprint,voice:i?brian:lulu,voiceId:i?brianId:luluId,body,startedAt:new Date().toISOString()};
  const save=()=>writeFileSync(receipt,JSON.stringify(record,null,2),{mode:0o600});save();
  try{const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${record.voiceId}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});record.http=r.status;record.requestId=r.headers.get('request-id');record.characterCost=r.headers.get('character-cost');if(!r.ok){record.status='failed';save();throw Error('Provider HTTP '+r.status);}const audio=Buffer.from(await r.arrayBuffer());writeFileSync(file,audio);record.status='generated';record.bytes=audio.length;record.sha256=createHash('sha256').update(audio).digest('hex');save();console.log(pair,record.voice,'generated');}catch(e){if(record.status==='requesting'){record.status='uncertain';save();}throw e;}
 }
 const result=spawnSync('ffmpeg',['-y','-v','error','-i',`${dir}/${pair}-0.mp3`,'-f','lavfi','-t','0.45','-i','anullsrc=r=44100:cl=mono','-i',`${dir}/${pair}-1.mp3`,'-filter_complex','[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]','-map','[out]','-c:a','libmp3lame','-b:a','128k',`public/media/voice-auditions/${pair}.mp3`],{encoding:'utf8'});if(result.status)throw Error(result.stderr);
}
console.log('Three pairings complete; existing film unchanged.');
