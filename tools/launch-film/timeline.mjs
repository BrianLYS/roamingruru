import {readFileSync,existsSync} from 'node:fs';
const path=new URL('./dialogue.json',import.meta.url);
export const dialogue=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
const fallback=[4.4,1.5,8,4.7,2.5,3.8,3.5,3.2,3.1,6.4,2.1,1.9,3.4];
export const lines=[];
export const introEnd=22;
export const opening=[
 {start:0,end:6,text:'Indoor mall visits rose 5% year over year in August 2026.',source:'Source: Placer.ai, August 2026 Mall Index'},
 {start:6,end:13,text:'How can malls turn that growing foot traffic into more sales for the businesses inside?'},
 {start:13,end:17,text:'Meet Ruru—a friendly robot resident of the mall.'},
 {start:17,end:22,text:'She gets to know shoppers and connects them with stores, offers and events they’d love.'},
];
let cursor=introEnd;
function add(id){const line=dialogue.find(l=>l.id===id);const playbackRate=1;const duration=(line?.duration??fallback[id])/playbackRate;lines.push({...line,id,start:cursor,end:cursor+duration,duration,playbackRate});cursor+=duration+.65;}
for(let i=0;i<5;i++)add(i);
export const returnStart=cursor+1;
cursor=returnStart+3.4;
for(let i=5;i<10;i++)add(i);
export const qrStart=cursor;
add(13);add(14);add(15);
export const qrActionStart=cursor;
export const walkStart=cursor+11;
cursor=walkStart;
cursor+=4.5;
add(10);add(11);
export const montageStart=cursor+1.2;
export const businessStart=montageStart+15;
export const closeStart=businessStart+10;
cursor=closeStart+1;
add(12);
export const technicalStart=Math.ceil(cursor+4);
export const technical=[
 {start:technicalStart,end:technicalStart+5,text:'Perception & memory',detail:'Camera + microphone · OpenAI · Face matching · Convex'},
 {start:technicalStart+5,end:technicalStart+10,text:'Agent tools',detail:'remember_person · find_in_mall · Firecrawl'},
 {start:technicalStart+10,end:technicalStart+15,text:'Voice & movement',detail:'ElevenLabs · Three.js pathfinding · show_mailing_qr · AgentMail'},
];
export const DURATION=technicalStart+15;
export const activeLine=t=>lines.find(l=>t>=l.start&&t<l.end+.3);
