import { test, expect, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { scriptedConversation } from './scriptedConversation';

async function send(page: Page, message: string) {
  await page.getByLabel('Type a message to Ruru').fill(message);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.story-caption h2')).toHaveText(`Done: ${message}`);
}
async function mockTools(page: Page) {
  await scriptedConversation(page);
  const requests: any[] = [];
  await page.route('**/api/lulu/conversation', async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    const message = body.message;
    const action = message.startsWith('go:') ? { type: 'go_to_store', store: message.slice(3) } : { type: message };
    await route.fulfill({ json: { mode: 'live', text: `Done: ${message}`, interest: message === 'look again' ? 'running' : null, actions: [action], discoveries: [] } });
  });
  return requests;
}
async function cameraFixture(page: Page) {
  await page.addInitScript(() => {
    const qa = { starts: 0, stops: 0, workersStopped: 0, embedding: Array(256).fill(.0625) };
    (window as any).directQa = qa;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      qa.starts++; let stopped = false;
      const track = { stop() { if (!stopped) { stopped = true; qa.stops++; } }, onended: null };
      return { getTracks: () => [track], getVideoTracks: () => [track] };
    } } });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, get() { return (this as any)._stream; }, set(value) { (this as any)._stream = value; } });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
    let videoTime = 0;
    Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', { configurable: true, get: () => (videoTime += .05) });
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    const context = HTMLCanvasElement.prototype.getContext;
    const dataUrl = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: any[]) {
      if (type === '2d' && this.width === 640 && this.height === 480) return { drawImage() {} } as any;
      return (context as any).call(this, type, ...args);
    } as any;
    HTMLCanvasElement.prototype.toDataURL = function(...args: any[]) {
      return this.width === 640 && this.height === 480 ? 'data:image/jpeg;base64,/9j/2Q==' : (dataUrl as any).call(this, ...args);
    };
    (window as any).createImageBitmap = async () => ({ width: 640, height: 480, close() {} });
    (window as any).Worker = class {
      onmessage: any; onerror: any; closed = false;
      constructor(public url: string) {}
      postMessage(message: any) {
        queueMicrotask(() => {
          if (this.closed) return;
          if (message.type === 'init') this.onmessage?.({ data: { type: 'ready' } });
          if (message.type === 'frame') this.onmessage?.({ data: this.url.includes('recognition') ? { type: 'result', sequence: message.sequence, count: 1, embedding: qa.embedding } : { type: 'faces', sequence: message.sequence, boxes: [{x:.2,y:.2,width:.4,height:.4,score:.99}] } });
        });
      }
      terminate() { if (!this.closed) { this.closed = true; qa.workersStopped++; } }
    };
  });
}

test('direct QR and face actions work without feature forms on desktop and mobile', async ({ page }) => {
  await mockTools(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await send(page, 'show_mailing_qr');
    await expect(page.getByTestId('mall-world')).toHaveAttribute('data-screen', 'qr');
    await page.getByRole('button', { name: 'Face only', exact: true }).click();
    const canvas = page.getByRole('img', { name: 'Scan to join Ruru’s mailing list', exact: true });
    await expect.poll(async () => canvas.evaluate((node: HTMLCanvasElement) => Array.from(node.getContext('2d')!.getImageData(0, 0, 640, 400).data)).then(pixels => jsQR(new Uint8ClampedArray(pixels), 640, 400)?.data)).toBe('https://roaminglulu.fraylabs.chatgpt.site/?signup=1');
    await send(page, 'show_face');
    await expect(page.getByRole('img', { name: /Ruru’s screen face:/ })).toBeVisible();
    for (const action of ['person_remembered', 'person_forgotten']) await send(page, action);
    await expect(page.locator('#lulu-remember, .style-profile, .agent-actions')).toHaveCount(0);
    await expect(page.getByText('Shop updates, if you’d like', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('agent navigation actions start real mall routes for each store', async ({ page }) => {
  test.setTimeout(120_000);
  await mockTools(page); await page.goto('/');
  const world = page.getByTestId('mall-world');
  for (const store of ['lululemon', 'apple', 'aesop']) {
    await send(page, `go:${store}`);
    await world.scrollIntoViewIfNeeded();
    await expect(world).toHaveAttribute('data-destination', store);
    await expect(world).toHaveAttribute('data-navigation-state', 'walking');
    const position = () => world.evaluate(node => `${node.getAttribute('data-lulu-x')},${node.getAttribute('data-lulu-z')}`);
    const start = await position();
    await expect.poll(position).not.toBe(start);

  }
});

test('agent camera supplies fresh senses only after Start and releases on Stop and new visitor', async ({ page }) => {
  await cameraFixture(page); const requests = await mockTools(page);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await send(page, 'start_camera');
  const camera = page.getByRole('region', { name: 'Ruru’s camera' });
  await expect(camera).toBeVisible();
  expect(requests[0].senses).toBeUndefined();
  expect(await page.evaluate(() => (window as any).directQa.starts)).toBe(0);
  await expect(page.locator('.style-profile, #lulu-remember')).toHaveCount(0);
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].senses).toEqual({ image: 'data:image/jpeg;base64,/9j/2Q==', model: 'human-mobileface-256-v1', embedding: Array(256).fill(.0625) });
  await expect(page.locator('.story-caption h2')).toHaveText('Done: The camera is on now. Continue.');
  await send(page, 'look again'); expect(requests.at(-1).senses?.embedding).toHaveLength(256);
  await page.evaluate(() => { (window as any).directQa.embedding = Array(256).fill(-.0625); });
  await send(page, 'different visitor');
  expect(requests.at(-1).history).toEqual([]);
  expect(requests.at(-1).interest).toBeNull();
  await camera.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).directQa.stops)).toBe(1);
  await send(page, 'without camera'); expect(requests.at(-1).senses).toBeUndefined();
  await camera.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect.poll(() => requests.at(-1).message).toBe('The camera is on now. Continue.');
  await page.getByRole('button', { name: 'New visitor', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).directQa.stops)).toBe(2);
  await expect(camera).toBeHidden();
  await send(page, 'new visitor'); expect(requests.at(-1).senses).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
