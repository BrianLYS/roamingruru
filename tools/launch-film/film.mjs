import QRCode from 'qrcode';
import {robot,icon} from './illustrations.mjs';
import {DURATION,lines,opening,introEnd,activeLine,returnStart,qrStart,qrActionStart,walkStart,montageStart,businessStart,technicalStart,technical,closeStart} from './timeline.mjs';
export {DURATION};export const W=1440,H=810,FPS=30;
const C={paper:'#f5f0e5',ink:'#183f39',sage:'#a6bba0',coral:'#d87b62',gold:'#e4b956',blue:'#517e94'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const clamp=x=>Math.max(0,Math.min(1,x));const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const g=(x,y,s,a,extra='')=>`<g transform="translate(${x} ${y}) scale(${s})" ${extra}>${a}</g>`;
const text=(s,x,y,size=44,color=C.ink,anchor='middle',extra='')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}" ${extra}>${esc(s)}</text>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const heading=(s,y=108,size=52)=>text(s,720,y,size,C.ink,'middle','font-weight="600" letter-spacing="-1.3"');
function wrap(s,max=68){const result=[];let line='';for(const word of s.split(' ')){if((line+' '+word).length>max){result.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)result.push(line);return result;}
function umbrella(x,y,s=1,open=false){return g(x,y,s,open?`<path d="M-70 0Q-50-85 0-80Q50-85 70 0Q48-18 25 0Q0-18-25 0Q-48-18-70 0Z" fill="${C.gold}" stroke="${C.ink}" stroke-width="3"/><path d="M0-80V55q0 20-17 15" fill="none" stroke="${C.ink}" stroke-width="5"/>`:`<path d="M0-63L-11 26Q0 35 11 26Z" fill="${C.gold}" stroke="${C.ink}" stroke-width="2"/><path d="M0 30V55q0 14-13 9" fill="none" stroke="${C.ink}" stroke-width="5"/>`);}
function person({x=420,y=550,s=1,t=0,wet=false,walking=false,carrying=false,shirt=C.blue,smile=true,flip=false,speaking=false,hair='short',skin='#cf9a75',dress=false}={}){
 const stride=walking?Math.sin(t*7)*12:0,bob=walking?Math.abs(Math.sin(t*7))*3:Math.sin(t*1.5)*.8;
 const backHair=hair==='bob'?`<path d="M-38-116Q-43-165 0-166Q43-165 38-116L44-65Q0-48-44-65Z" fill="#49352d"/>`:hair==='ponytail'?`<path d="M24-143Q75-172 65-105Q63-78 82-64Q38-65 42-113Z" fill="#352b29"/>`:'';
 const frontHair=hair==='bob'?`<path d="M-36-115Q-42-163 0-163Q43-162 36-112L22-139Q-5-124-36-115Z" fill="#49352d"/>`:hair==='ponytail'?`<path d="M-35-117Q-39-162 0-162Q40-162 35-113L18-136Q-7-132-35-117Z" fill="#352b29"/>`:`<path d="M-35-117Q-42-171 10-160Q43-155 35-113L20-137Q-5-121-35-117Z" fill="#273e36"/>`;
 const art=`<ellipse cx="0" cy="138" rx="62" ry="12" fill="#183f3918"/><g transform="translate(0 ${bob})">${backHair}<path d="M-21 45L${-25+stride} 127M21 45L${25-stride} 127" stroke="#294e47" stroke-width="25" stroke-linecap="round"/><path d="M${-25+stride} 129h-19M${25-stride} 129h20" stroke="#193a34" stroke-width="12" stroke-linecap="round"/><path d="${dress?'M-30-62Q0-77 30-62L24-6L53 75Q0 90-53 75L-24-6Z':'M-37-62Q0-83 37-62L32 56Q0 67-32 56Z'}" fill="${shirt}"/><path d="M-36-54L-53 10M36-54L51 10" fill="none" stroke="${shirt}" stroke-width="22" stroke-linecap="round"/>${circle(-53,17,10,skin)}${circle(51,17,10,skin)}<path d="M0-59V48M-25 17l16-3M10 14l16 3" stroke="#d4e1db" fill="none" stroke-width="2.5"/><path d="M-11-86v18q10 10 22 0v-18" fill="${skin}"/>${circle(0,-116,36,skin)}${frontHair}<path d="M-16-112h2M13-112h2" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/><path d="M-9-96q10 ${smile?10:1} 20-1" stroke="${C.ink}" fill="none" stroke-width="2.5" stroke-linecap="round"/>${speaking?`<ellipse cx="2" cy="-92" rx="7" ry="${3+Math.abs(Math.sin(t*10))*4}" fill="#754b3c"/>`:""}${wet?`<path d="M-25-55l-4 22M19-56l7 25M-16-14l-3 27M23 20v20" stroke="#385e75" stroke-width="8" opacity=".6" stroke-linecap="round"/>${[[-29,-102],[32,-90],[-46,7]].map(([a,b])=>`<path d="M${a} ${b}q-6 10 0 13q6-3 0-13" fill="#79b3c4"/>`).join('')}`:''}${carrying?umbrella(62,43,.85):''}</g>`;
 return g(x,y,s,`<g transform="scale(${flip?-1:1} 1)">${art}</g>`);
}
function storefront(x,label,color=C.ink){return `<g transform="translate(${x} 183)"><rect width="340" height="303" rx="6" fill="#e3dac8"/><rect x="14" y="60" width="312" height="235" fill="#c5d8cd"/><rect x="24" y="70" width="139" height="214" fill="#d8e4d8"/><rect x="177" y="70" width="138" height="214" fill="#cbdace"/><path d="M31 214h124M185 214h120" stroke="#77948a" stroke-width="6"/><rect x="0" y="0" width="340" height="57" fill="${color}"/>${text(label,170,38,26,'#fff9e9')}${label==='lululemon'?`<path d="M54 114l-17 30 18 13 13-18v67h65v-67l13 18 18-13-17-30-28-16h-35Z" fill="#b78071"/><path d="M210 115h75v77h-75Z" fill="#eddda7"/>${circle(248,142,18,C.coral)}`:Array.from({length:4},(_,i)=>`<rect x="${33+i*76}" y="151" width="44" height="56" rx="4" fill="${i%2?'#e5b45a':'#7c9e96'}"/>`).join('')}<path d="M6 299h328" stroke="#fff9e9" stroke-width="8"/></g>`;}
function mall(t,{rain=false,event=false}={}){
 let a=`<rect width="1440" height="810" fill="${C.paper}"/><path d="M0 0h1440v145Q720 80 0 145Z" fill="#e2e8d7"/><path d="M0 100Q720 13 1440 100" fill="none" stroke="#fffaf0" stroke-width="22"/><path d="M0 147Q720 83 1440 147" fill="none" stroke="#c7d2bb" stroke-width="3"/><rect y="486" width="1440" height="324" fill="#e9e1ce"/>`;
 for(let i=0;i<11;i++)a+=`<path d="M${720+(i-5)*100} 486L${720+(i-5)*235} 810" stroke="#d0c7b3" opacity=".6"/>`;
 for(const yy of [523,578,656,768])a+=`<path d="M0 ${yy}H1440" stroke="#d0c7b3" opacity=".6"/>`;
 a+=storefront(990,'lululemon')+storefront(598,'7-Eleven','#487966');
 a+=`<rect x="62" y="166" width="420" height="321" rx="90" fill="#c9dfe1"/><path d="M272 168v317M63 270h416" stroke="#fff7e6" stroke-width="10"/>`;
 if(rain){for(let i=0;i<42;i++){let x=80+(i*79)%370,y=185+((i*43+t*115)%270);a+=`<path d="M${x} ${y}l-7 21" stroke="#769ca7" stroke-width="2" opacity=".55"/>`;}}
 else a+=circle(372,224,32,'#e9c567')+`<path d="M77 414Q170 358 257 414T471 414v70H77Z" fill="#bed0b4"/>`;
 a+=`<path d="M20 146v350M536 126v370M958 132v364M1398 145v351" stroke="#fdf8ed" stroke-width="24"/><ellipse cx="541" cy="503" rx="39" ry="10" fill="#294e4715"/><path d="M516 454h50l-8 48h-34Z" fill="${C.coral}"/><path d="M541 457v-77M541 423q-50-2-35-50q44 10 35 50M541 412q44-1 33-43q-35 5-33 43" fill="#769473" stroke="#557a61" stroke-width="3"/>`;
 if(event)a+=`<path d="M996 178q150 75 330 0" fill="none" stroke="#426e5e" stroke-width="2"/>${Array.from({length:8},(_,i)=>`<path d="M${1005+i*43} ${182+Math.sin(i/7*Math.PI)*42}l17 26 17-20Z" fill="${i%2?C.gold:C.coral}"/>`).join('')}`;
 return a;
}
function subtitle(line,t){if(!line?.text)return '';const rows=wrap(line.text);const h=rows.length*40+56;const y=778-h;return `<g opacity="${ease((t-line.start)/.15)}"><rect x="160" y="${y}" width="1120" height="${h}" rx="24" fill="#173e35" opacity=".96"/>${text(line.speaker,192,y+29,17,'#e8c775','start','font-weight="700" letter-spacing="1.3"')}${rows.map((s,i)=>text(s,720,y+67+i*40,32,'#fff9eb')).join('')}</g>`;}
function lulu(t,{x=955,y=457,s=.79,expression='happy',gaze=-8,tilt=null,screen='',screenOpacity=1}={}){return robot({x,y,scale:s,t,expression,gazeX:gaze,tiltAngle:tilt,screenArt:screen,screenOpacity});}
function closeConversation(t,wet){const line=activeLine(t);let a=mall(t,{rain:wet,event:!wet});a+=`<rect width="1440" height="590" fill="${C.paper}" opacity=".12"/>`;
 a+=person({x:421,y:440,s:1.2,t,wet,carrying:!wet,speaking:line?.speaker==='Brian'});
 const first=lines[0]?.start??8;const arrival=wet?ease((t-first)/2):ease((t-returnStart-1.2)/2);
 const isRuru=line?.speaker==='Ruru';const glance=wet&&line?.id===2?8:-7;
 a+=lulu(t,{x:1160-205*arrival,y:437,s:.79,expression:isRuru?'speaking':line?'listening':'happy',gaze:glance,tilt:isRuru?Math.sin(t*1.5)*3:-3,screen:line?.id===2&&t-line.start>2.5?`${umbrella(0,-68,.72,true)}<path d="M27-5h-54m10-11-11 11 11 11" stroke="#e4eacb" fill="none" stroke-width="4"/>`:''});

 return a+subtitle(line,t);
}
const mailingQr=QRCode.create('https://roaminglulu.fraylabs.chatgpt.site/?signup=1',{errorCorrectionLevel:'M'}).modules;
function qrArt(x,y,size){const cells=mailingQr.size,unit=size/(cells+8);let a=`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="4" fill="#fffdf6"/>`;for(let row=0;row<cells;row++)for(let col=0;col<cells;col++)if(mailingQr.data[row*cells+col])a+=`<rect x="${x+(col+4)*unit}" y="${y+(row+4)*unit}" width="${unit+.05}" height="${unit+.05}" fill="#173e35"/>`;return a;}
function qrEncounter(t){const line=activeLine(t),action=t-qrActionStart,entry=ease((t-qrStart)/1.1),exit=ease((action-10)/1),qrFade=ease((t-(lines.find(l=>l.id===15)?.start??qrActionStart)-.35)/.9)*(1-ease((action-8.6)/1.1));let a=mall(t,{event:true});a+=person({x:421-116*entry+115*exit,y:440-10*entry+22*exit,s:1.2-.15*entry+.15*exit,t,carrying:action<0,speaking:line?.speaker==='Brian'});a+=lulu(t,{x:955+135*entry-390*exit,y:437-12*entry+35*exit,s:.79+.24*entry-.34*exit,expression:line?.speaker==='Ruru'?'speaking':'happy',gaze:-5,tilt:0,screen:qrFade>0?qrArt(-76,-151,152):'',screenOpacity:qrFade});
 if(action>=0){
  const joined=action>=7.4,scanning=action<3.3;
  const zoom=ease((action-.65)/1.1)*(1-ease((action-8.4)/1.2)),scale=.15+.85*zoom;
  a+=`<g transform="translate(${393+298*zoom} ${412-22*zoom}) scale(${scale}) translate(-691 -390)" opacity="${ease((action-.65)/.35)*(1-ease((action-9.3)/.5))}">`;
  a+=`<rect x="544" y="190" width="294" height="405" rx="35" fill="#173e35"/><rect x="554" y="201" width="274" height="383" rx="27" fill="#fffdf6"/><rect x="648" y="210" width="85" height="10" rx="5" fill="#173e35"/>`;
  if(scanning){a+=qrArt(592,276,196)+`<path d="M578 268h20m-20 0v20M804 268h-20m20 0v20M578 481h20m-20 0v-20M804 481h-20m20 0v-20" fill="none" stroke="#769473" stroke-width="4"/><path d="M589 ${286+(clamp((action-1.4)/1.9))*175}h204" stroke="#d87b62" stroke-width="3"/>`;}
  else if(joined){a+=circle(691,379,62,'#e1e8cc')+`<path d="M660 380l22 22 42-49" stroke="#42654b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;}
  else{const email='brian@example.com'.slice(0,Math.min(17,Math.floor((action-3.3)*8)));a+=text('Ruru',691,280,30,C.ink,'middle','font-weight="600"')+text('Email',578,345,19,C.ink,'start')+`<rect x="572" y="360" width="238" height="52" rx="9" fill="#f5f3e8" stroke="#a1b194"/>`+text(email,583,393,21,C.ink,'start')+`<rect x="572" y="440" width="238" height="52" rx="10" fill="#42654b"/>`+text('Join',691,473,22,'#fffdf6');if(action>6.6)a+=`<circle cx="726" cy="471" r="${12+ease((action-6.6)/.8)*10}" fill="#fffdf6" opacity=".65"/>`;}
  a+=`</g>`;
  // Brian holds his phone; the central inset shows its screen in detail.
  a+=`<g transform="translate(0 ${(1-ease(action/.65))*60})" opacity="${ease(action/.4)*(1-ease((action-9.8)/.7))}"><path d="M353 440l30-28" stroke="#517e94" stroke-width="23" stroke-linecap="round"/><rect x="372" y="374" width="43" height="76" rx="9" fill="#173e35"/><rect x="378" y="383" width="31" height="56" rx="4" fill="#f5f3e8"/></g>`;
 }
 return a+subtitle(line,t);
}
function scene(t){
 if(t<introEnd){
  const beat=opening.find(l=>t>=l.start&&t<l.end)??opening.at(-1);
  const local=t-beat.start;let a=mall(t);
  // Shoppers pass the storefronts before Ruru enters: the business question comes first.
  for(let i=0;i<5;i++)a+=person({x:210+((i*230+t*35)%1150),y:470+(i%2)*65,s:.63+(i%2)*.09,t:t+i,walking:true,shirt:[C.coral,C.sage,C.blue][i%3],hair:i%2?'bob':i===2?'ponytail':'short',dress:i===1,skin:['#cf9a75','#995f45','#e7b991'][i%3]});
  if(t<13){
   a+=`<rect width="1440" height="810" fill="${C.paper}" opacity=".37"/><rect x="130" y="50" width="1180" height="255" rx="28" fill="${C.paper}" opacity=".97"/>`;
   const rows=t<6?['Indoor mall visits rose 5%','year over year in August 2026.']:['How can malls turn that growing foot traffic','into more sales for the businesses inside?'];
   a+=`<g opacity="${ease(local/.4)}">${rows.map((s,i)=>heading(s,134+i*65,t<6?51:43)).join('')}${t<6?text('Source: Placer.ai, August 2026 Mall Index',720,264,25):''}</g>`;
  }else{
   const q=t-13,p=ease(q/3);a+=lulu(t,{x:230+590*p,y:582-48*Math.sin(p*Math.PI),s:.59+.14*p,gaze:q<2?12:0,expression:q<2?'curious':'happy'});
   a+=`<rect x="110" y="36" width="1220" height="206" rx="28" fill="${C.paper}" opacity=".97"/>`;
   const rows=t<17?['Meet Ruru—a friendly robot','resident of the mall.']:['She gets to know shoppers and connects them','with stores, offers and events they’d love.'];
   a+=`<g opacity="${ease(local/.35)}">${rows.map((s,i)=>heading(s,116+i*62,t<17?49:43)).join('')}</g>`;
  }
  return a;
 }
 if(t<returnStart)return closeConversation(t,true);
 if(t<returnStart+3.4){const q=t-returnStart;return mall(t)+person({x:155+ease(q/3)*260,y:445,s:1.2,t,walking:true,carrying:true})+lulu(t,{x:1130-ease(q/3)*160,y:440,expression:q>1.5?'happy':'curious'})+`<rect x="470" y="48" width="500" height="93" rx="22" fill="${C.paper}"/>`+heading('A few days later.',108,42);}
 if(t<qrStart)return closeConversation(t,false);
 if(t<walkStart)return qrEncounter(t);
 if(t<montageStart){let q=t-walkStart,p=ease(q/4.5);let a=mall(t,{event:true});a+=person({x:1168,y:425,s:.61,t,shirt:C.coral,hair:'bob',dress:true,skin:'#995f45'});a+=person({x:420+p*555,y:452-p*21,s:1.2-p*.38,t,walking:q<4.5,carrying:true});a+=lulu(t,{x:700+p*410,y:460-p*21,s:.69-p*.19,expression:activeLine(t)?.speaker==='Ruru'?'speaking':'happy',tilt:q>7?Math.sin(q*2)*7:0});return a+subtitle(activeLine(t),t);}
 if(t<businessStart){const q=t-montageStart;let a=mall(t,{event:true});let card='';
 if(q<4){a+=person({x:730,y:475,s:.8,t,shirt:C.coral,hair:'bob',dress:true,skin:'#995f45'});a+=lulu(t,{x:350+q*120,y:470+Math.sin(q/4*Math.PI)*70,s:.63,gaze:9,expression:'curious'});card='She finds her way around.';}
 else if(q<8){a+=person({x:435,y:458,s:1.1,t,shirt:C.coral,hair:'bob',dress:true,skin:'#995f45'});a+=lulu(t,{x:950,y:450,s:.78,gaze:-9,expression:'curious',tilt:6});card='She notices what you’re wearing.';}
 else if(q<12){a+=person({x:430,y:450,s:1.13,t,carrying:true});a+=lulu(t,{x:950,y:450,s:.78,expression:'happy',tilt:-5});card='She remembers you—and what you like.';}
 else{a+=person({x:404,y:446,s:1.04,t,carrying:true});a+=person({x:1150,y:457,s:.9,t,shirt:C.coral,hair:'bob',dress:true,skin:'#995f45'});a+=lulu(t,{x:784,y:449,s:.77,expression:'happy'});card='Ruru builds relationships.';}
 return a+`<rect x="164" y="39" width="1112" height="104" rx="25" fill="${C.paper}"/>`+heading(card,105,43);}
 if(t<closeStart){const q=t-businessStart;let a=mall(t,{event:true});a+=person({x:1120,y:421,s:.7,t,carrying:true});a+=person({x:1230,y:418,s:.68,t,shirt:C.coral,hair:'bob',dress:true,skin:'#995f45'});a+=person({x:367,y:455,s:1.05,t,shirt:C.sage,hair:'ponytail',skin:'#e7b991'});a+=lulu(t,{x:700,y:466,s:.75,expression:'happy'});
 a+=`<rect x="145" y="29" width="1150" height="145" rx="28" fill="${C.paper}"/>`;
 if(q<4.8)a+=heading('A friendly face for shoppers.',88,42)+heading('More opportunities for stores.',142,42);
 else a+=heading('Products. Events. Discounts. Memberships.',88,38)+heading('Introduced through a conversation.',142,36);
 return a;}
 if(t>=technicalStart){
  const q=t-technicalStart,step=Math.min(2,Math.floor(q/5)),phase=q%5;
  let a=`<rect width="1440" height="810" fill="${C.paper}"/>`+heading('Behind the scenes',94,49);
  const nodes=['Camera + microphone','OpenAI agent','Tools','Ruru responds'];
  for(let i=0;i<4;i++){const x=70+i*335,active=step===0?i<2:step===1?i===2:i===3;
   a+=`<rect x="${x}" y="139" width="295" height="80" rx="18" fill="${active?C.ink:'#e1e6d7'}"/>`+text(nodes[i],x+147.5,188,i===0?25:29,active?C.paper:C.ink);
   if(i<3)a+=`<path d="M${x+302} 179h25l-7-7m7 7l-7 7" fill="none" stroke="${C.ink}" stroke-width="3"/>`;
  }
  a+=`<rect x="70" y="256" width="810" height="435" rx="28" fill="#ffffff" stroke="#d5ddcd"/>`;
  a+=text(technical[step].text,110,321,36,C.ink,'start','font-weight="600"');
  if(step===0){
   a+=person({x:1112,y:499,s:.8,t,carrying:true});
   a+=`<path d="M1046 358h-20v28M1178 358h20v28M1026 471v28h20M1198 471v28h-20" fill="none" stroke="${C.sage}" stroke-width="5"/>`;
   for(const [j,label] of ['Camera frames → OpenAI','Face matching → Brian','Convex → name + running preference'].entries())a+=text(label,110,395+j*68,29,C.ink,'start');
   a+=text('Visitor memory + mailing list',110,631,25,'#57705b','start');
  }else if(step===1){
   a+=lulu(t,{x:1120,y:465,s:.65,expression:'curious',gaze:-6});
   a+=text('remember_person',110,396,31,C.ink,'start','style="font-family:monospace"');
   a+=text('find_in_mall',110,461,31,C.ink,'start','style="font-family:monospace"');
   a+=text('Firecrawl → official store information',110,526,28,C.ink,'start');
   a+=`<rect x="104" y="565" width="734" height="82" rx="14" fill="#edf0df"/>`+text('Running preference → relevant event',130,616,29,C.ink,'start');
  }else{
   a+=`<path d="M960 612h340v-77" fill="none" stroke="${C.sage}" stroke-width="5" stroke-dasharray="12 9"/>`;
   a+=lulu(t,{x:1030+ease(phase/4)*210,y:453,s:.59,expression:'speaking',gaze:-3});
   a+=text('ElevenLabs → speech',110,390,30,C.ink,'start');
   a+=text('go_to_store → Three.js pathfinding',110,454,28,C.ink,'start');
   a+=text('show_mailing_qr → signup',110,518,29,C.ink,'start');
   a+=text('AgentMail → email delivery',110,582,29,C.ink,'start');
   a+=text('Simulated robot movement',110,646,24,'#57705b','start');
  }
  a+=text('Brian appears → recognized → remembered → guided',720,751,28,C.ink);
  return a;
 }
 const q=t-closeStart;let a=`<rect width="1440" height="810" fill="${C.ink}"/>${circle(1048,394,288,'#2b5548')}<circle cx="1048" cy="394" r="301" fill="none" stroke="#7f9e7d" opacity=".35"/>`;
 a+=lulu(t,{x:1053,y:421,s:.96+ease(q/4)*.035,expression:activeLine(t)?'speaking':'happy',gaze:0,tilt:-3+ease(q/3)*6});a+=text('Every mall',121,310,76,C.paper,'start','font-weight="600" letter-spacing="-2"')+text('needs a Ruru.',121,401,76,'#d5dfba','start','style="font-family:Georgia" font-style="italic"');return a+subtitle(activeLine(t),t);
}
export function frame(t){let a=scene(t);for(const cut of [6,13,17,introEnd,returnStart,qrStart,montageStart,businessStart,technicalStart,technicalStart+5,technicalStart+10,closeStart]){const d=t-cut;if(d>=0&&d<.3)a+=`<rect width="1440" height="810" fill="${C.paper}" opacity="${1-ease(d/.3)}"/>`;}
return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="810" viewBox="0 0 1440 810">${a}</svg>`;}
export const keyTimes=()=>[3,9,15,19,21.5,...lines.map(l=>l.start+Math.min(1,l.duration/2)),returnStart+2,qrActionStart+.3,qrActionStart+1,qrActionStart+2,qrActionStart+5,qrActionStart+8,qrActionStart+10,walkStart+3,montageStart+2,montageStart+6,montageStart+10,montageStart+13,businessStart+2,businessStart+7,technicalStart+2,technicalStart+7,technicalStart+12,DURATION-2];
