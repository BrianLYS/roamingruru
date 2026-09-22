import { test, expect } from '@playwright/test';
import jsQR from 'jsqr';
import { scriptedConversation } from './scriptedConversation';

test('mailing offer displays a decodable QR on Ruru and returns to her face', async ({page}) => {
  await scriptedConversation(page);
  await page.route('**/api/lulu/conversation', r=>r.fulfill({json:{mode:'live',text:'Want occasional updates? Scan my screen to join.',interest:null,actions:[{type:'mailing_list'}],discoveries:[]}}));
  await page.goto('/');
  await page.getByLabel('Type a message to Ruru').fill('Can I get updates?');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByTestId('mall-world')).toHaveAttribute('data-screen','qr');
  await page.getByRole('button',{name:'Face only',exact:true}).click();
  const canvas=page.getByRole('img',{name:'Scan to join Ruru’s mailing list',exact:true});
  await expect(canvas).toBeVisible();
  await expect.poll(async()=>{
    const pixels=await canvas.evaluate((node:HTMLCanvasElement)=>Array.from(node.getContext('2d')!.getImageData(0,0,node.width,node.height).data));
    return jsQR(new Uint8ClampedArray(pixels),640,400)?.data;
  }).toBe('https://roaminglulu.fraylabs.chatgpt.site/?signup=1');
  await page.getByRole('button',{name:'Back to Ruru’s face',exact:true}).click();
  await expect(page.getByRole('img',{name:/Ruru’s screen face:/})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open signup form'})).toHaveCount(0);
});

test('phone signup requires consent, persists, unsubscribes and never requests face or email sending', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const writes:{path:string;body:any}[]=[];let newsletter:unknown=null;let version=0;let fail=true;
  await page.route('**/api/lulu/**',async r=>{
    const req=r.request(),path=new URL(req.url()).pathname;
    if(req.method()==='GET'&&path.endsWith('/profile'))return r.fulfill({json:{profileVersion:0,newsletterVersion:version,personal:null,face:null,newsletter}});
    const body=req.postDataJSON();writes.push({path,body});
    if(path.endsWith('/session'))return r.fulfill({json:{state:'empty'}});
    if(path.endsWith('/newsletter')){
      if(fail){fail=false;return r.fulfill({status:503,json:{error:'Please try again.'}});}
      newsletter={status:'active',emailHint:'s•••@example.test'};version++;return r.fulfill({json:{status:'saved'}});
    }
    if(path.endsWith('/unsubscribe')){newsletter=null;version++;return r.fulfill({json:{status:'saved'}});}
    return r.fulfill({status:599,json:{error:'Unexpected operation'}});
  });
  await page.goto('/?signup=1');
  await expect(page.getByRole('heading',{name:'Join Ruru’s list'})).toBeVisible();
  await expect(page.getByText('What Ruru remembers',{exact:true})).toHaveCount(0);
  await page.getByLabel('Email address',{exact:true}).fill('synthetic@example.test');
  const join=page.getByRole('button',{name:'Join Ruru’s list',exact:true});
  await expect(join).toBeDisabled();expect(writes).toEqual([]);
  await page.getByRole('checkbox').check();await join.click();
  await expect(page.getByRole('status')).toHaveText('Please try again.');
  await join.click();await expect(page.getByRole('button',{name:'Unsubscribe',exact:true})).toBeVisible();
  expect(writes.filter(w=>w.path.endsWith('/newsletter')).at(-1)?.body).toEqual({consent:true,version:0,email:'synthetic@example.test'});
  await page.reload();await expect(page.getByRole('button',{name:'Unsubscribe',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Unsubscribe',exact:true}).click();
  await expect(page.getByLabel('Email address',{exact:true})).toBeVisible();
  expect(writes.every(w=>['session','newsletter','unsubscribe'].includes(w.path.split('/').at(-1)!))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.local/qr-signup-mobile.png',fullPage:true});
});
