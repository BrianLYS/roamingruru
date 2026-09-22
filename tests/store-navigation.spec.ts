import { expect, test } from '@playwright/test';

test('store command drives Ruru from her conversation position, arrives, holds and cancels', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/__navigation_harness', route => route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="mall" style="width:100vw;height:100vh"></div></body></html>'}));
  await page.goto('/__navigation_harness');
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves the module directly for this isolated renderer check.
    const { createMall } = await import('/src/mall/world.ts');
    const input = {current:{expression:'happy',paused:true,selected:null,cameraReset:0,visible:true,cameraMode:'conversation'}};
    (window as any).navigationInput = input;
    (window as any).cleanup = createMall(document.querySelector('#mall'),input,()=>{},()=>{},()=>{},()=>{});
  });
  const mall = page.locator('#mall');
  await expect(mall).toHaveAttribute('data-lulu-z','6.500');
  await page.evaluate(()=>{const input=(window as any).navigationInput; input.current={...input.current,paused:false,cameraMode:'story',destination:{store:'apple',requestId:1}};});
  await expect(mall).toHaveAttribute('data-navigation-state','walking');
  const firstZ = Number(await mall.getAttribute('data-lulu-z'));
  expect(firstZ).toBeGreaterThan(6);
  await expect.poll(async()=>Number(await mall.getAttribute('data-lulu-z')),{timeout:10_000}).toBeLessThan(4);
  await expect(mall).toHaveAttribute('data-navigation-state','arrived',{timeout:30_000});
  expect(Number(await mall.getAttribute('data-lulu-x'))).toBeCloseTo(-7,1);
  expect(Number(await mall.getAttribute('data-lulu-z'))).toBeCloseTo(-4.2,1);
  const arrivedX = await mall.getAttribute('data-lulu-x');
  await page.waitForTimeout(500);
  expect(await mall.getAttribute('data-lulu-x')).toBe(arrivedX);
  await page.evaluate(()=>{const input=(window as any).navigationInput; input.current.destination={store:'aesop',requestId:2};});
  await expect(mall).toHaveAttribute('data-destination','aesop');
  await expect(mall).toHaveAttribute('data-navigation-state','walking');
  // Cross-mall journey must bend around the freestanding sign.
  await expect.poll(async()=>Number(await mall.getAttribute('data-lulu-z')),{timeout:30_000}).toBeGreaterThan(-3);
  await expect(mall).toHaveAttribute('data-navigation-state','arrived',{timeout:30_000});
  expect(Number(await mall.getAttribute('data-lulu-x'))).toBeCloseTo(7,1);
  await page.evaluate(()=>{delete (window as any).navigationInput.current.destination;});
  await expect(mall).toHaveAttribute('data-destination','');
  await expect(mall).toHaveAttribute('data-navigation-state','');
  await expect.poll(async()=>Number(await mall.getAttribute('data-lulu-z')),{timeout:8_000}).toBeGreaterThan(-3.5);
  await page.evaluate(()=>(window as any).cleanup());
});
