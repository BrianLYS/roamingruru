import { test, expect } from '@playwright/test';

test('face recognition is optional, enrollment is separate, and departure clears recall', async ({ page }) => {
  test.setTimeout(60000);
  let enroll: any = null, recognizeCalls = 0, known = true;
  await page.route('**/api/lulu/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: any = {};
    if(path.endsWith('/conversation/status')) data={mode:'live'};
    if(path.endsWith('/conversation')) data={mode:'live',text:'You can choose whether I remember your face.',interest:null,actions:[{type:'face',preferences:[]}],discoveries:[]};
    if(path.endsWith('/profile')) data={profile:null,personal:null,profileVersion:0,newsletterVersion:0,newsletter:null,capabilities:{}};
    if(path.endsWith('/face/enroll')) { enroll=route.request().postDataJSON();data={status:'saved'}; }
    if(path.endsWith('/face/recognize')) { recognizeCalls++;data=known?{status:'recognized',name:'Synthetic visitor',preferences:['quiet yoga'],recognitionToken:'synthetic-token'}:{status:'unknown'}; }
    await route.fulfill({json:data});
  });
  await page.addInitScript(() => {
    const state={face:true,events:[] as string[],workers:0,offset:0,identity:0};
    const realNow=Date.now; Date.now=()=>realNow()+state.offset;(window as any).faceQa=state;
    window.addEventListener('lulu-visitor-changed',()=>state.events.push('visitor-changed'));
    window.addEventListener('lulu-recognized',()=>state.events.push('recognized'));
    window.addEventListener('lulu-recognition-cleared',()=>state.events.push('cleared'));
    class FakeWorker {
      onmessage:any;onerror:any;recognition:boolean;
      constructor(url:string){this.recognition=url.includes('recognition');state.workers++;}
      postMessage(data:any){setTimeout(()=>this.onmessage?.({data:data.type==='init'?{type:'ready'}:this.recognition?{type:'result',sequence:data.sequence,count:state.face?1:0,embedding:state.face?Array.from({length:256},(_,i)=>i===state.identity?1:0):null}:{type:'faces',sequence:data.sequence,boxes:state.face?[{x:.3,y:.2,width:.3,height:.4,score:.99}]:[]}}),1);}
      terminate(){}
    }
    (window as any).Worker=FakeWorker;
    (window as any).createImageBitmap=async()=>({close(){}});
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}],getVideoTracks:()=>[]})}});
    Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{set(){}});
    HTMLMediaElement.prototype.play=async function(){this.dispatchEvent(new Event('loadeddata'));};
    Object.defineProperty(HTMLMediaElement.prototype,'readyState',{get:()=>4});
    Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{get:()=>performance.now()/1000});
    Object.defineProperty(HTMLVideoElement.prototype,'videoWidth',{get:()=>640});
    Object.defineProperty(HTMLVideoElement.prototype,'videoHeight',{get:()=>480});
  });
  await page.goto('/');
  await page.getByLabel('Type a message to Ruru').fill('Can you remember my face?');
  await page.getByRole('button',{name:'Send message'}).click();
  const invitation=page.getByRole('region',{name:'Ruru’s invitation'});
  await expect(invitation.locator('section.style-profile')).toBeVisible();
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect(page.getByLabel('Check whether Ruru remembers me')).toBeVisible();
  expect(recognizeCalls).toBe(0);
  await expect(page.locator('.camera-attention')).toHaveAttribute('data-attention-status','following');
  const beforeDeparture=await page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='visitor-changed').length);
  await page.evaluate(()=>{(window as any).faceQa.face=false;});
  await expect.poll(()=>page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='visitor-changed').length)).toBe(beforeDeparture+1);
  await page.evaluate(()=>{(window as any).faceQa.face=true;});
  await expect(page.locator('.camera-attention')).toHaveAttribute('data-attention-status','following');
  await expect(page.getByLabel('Name for face memory')).toBeVisible();
  await page.getByLabel('Name for face memory').fill('Synthetic visitor');
  await expect(page.getByRole('button',{name:'Remember my face',exact:true})).toBeDisabled();
  await page.getByLabel('Remember my face and name so Ruru can recognize me next time.').check();
  await page.getByRole('button',{name:'Remember my face',exact:true}).click();
  await expect(page.locator('[data-face-memory-status]')).toContainText('I’ll remember you');
  expect(enroll).toMatchObject({consent:true,name:'Synthetic visitor',model:'human-mobileface-256-v1',version:0});
  expect(enroll.embedding).toHaveLength(256);
  await page.getByLabel('Check whether Ruru remembers me').check();
  await expect(page.locator('[data-face-memory-status]')).toContainText('Welcome back');
  const clearCount = await page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='cleared').length);
  for(let refresh=0;refresh<2;refresh++){
    await page.evaluate(()=>{(window as any).faceQa.offset+=41000;});
    await expect.poll(()=>recognizeCalls,{timeout:8000}).toBe(refresh+2);
    await expect.poll(()=>page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='recognized').length)).toBe(refresh+2);
    expect(await page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='cleared').length)).toBe(clearCount);
  }
  await page.evaluate(()=>{(window as any).faceQa.face=false;});
  await expect.poll(()=>page.evaluate(()=>(window as any).faceQa.events.at(-1))).toBe('cleared');
  known=false;
  await page.evaluate(()=>{const state=(window as any).faceQa;state.face=true;state.identity=1;});
  await expect(page.locator('[data-face-memory-status]')).toContainText('I don’t recognize you yet', {timeout:8000});
  const boundaries=await page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='visitor-changed').length);
  await page.evaluate(()=>{(window as any).faceQa.identity=2;});
  await expect.poll(()=>page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='visitor-changed').length),{timeout:8000}).toBe(boundaries+1);
  const calls=recognizeCalls;
  await expect.poll(()=>recognizeCalls,{timeout:8000}).toBeGreaterThan(calls);
  expect(await page.evaluate(()=>(window as any).faceQa.events.filter((event:string)=>event==='visitor-changed').length)).toBe(boundaries+1);
  await page.getByRole('button',{name:'Stop camera',exact:true}).click();
  await expect(page.getByLabel('Check whether Ruru remembers me')).toHaveCount(0);
});
