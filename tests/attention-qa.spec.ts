import { scriptedConversation } from './scriptedConversation';
import { expect, test, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number; score: number };

async function installCameraAndWorker(page: Page, mode: 'manual' | 'error' = 'manual') {
  await page.addInitScript(({ workerMode }) => {
    const state = {
      workerMode,
      hidden: false,
      trackStops: 0,
      workerTerminates: 0,
      bitmapCaptures: 0,
      bitmapCloses: 0,
      frameSequences: [] as number[],
      workers: [] as any[],
      speechStarts: 0,
      speechAborts: 0,
      constraints: null as MediaStreamConstraints | null,
    };
    (window as any).attentionQa = state;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => state.hidden });

    const tracks: any[] = [];
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async (constraints: MediaStreamConstraints) => {
        state.constraints = constraints;
        const track = { stop: () => { state.trackStops++; }, onended: null as null | (() => void) };
        tracks.push(track);
        return { getTracks: () => [track], getVideoTracks: () => [track] };
      } },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get() { return (this as any).__attentionStream ?? null; },
      set(value) { (this as any).__attentionStream = value; },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
    let videoTime = 0;
    Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', { configurable: true, get: () => { videoTime += .05; return videoTime; } });
    HTMLMediaElement.prototype.play = () => Promise.resolve();

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: any[]) {
      if (type === '2d' && this.width === 640 && this.height === 480) return { drawImage() {} } as any;
      return (originalGetContext as any).call(this, type, ...args);
    } as any;
    HTMLCanvasElement.prototype.toDataURL = function(...args: any[]) {
      if (this.width === 640 && this.height === 480) return 'data:image/jpeg;base64,/9j/2Q==';
      return (originalToDataUrl as any).call(this, ...args);
    };
    (window as any).createImageBitmap = async () => {
      state.bitmapCaptures++;
      return { width: 320, height: 240, close: () => { state.bitmapCloses++; } };
    };

    class MockWorker {
      onmessage: null | ((event: MessageEvent) => void) = null;
      onerror: null | (() => void) = null;
      terminated = false;
      constructor(public url: string, public options: WorkerOptions) { state.workers.push(this); }
      postMessage(message: any) {
        if (this.terminated) return;
        if (message.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: workerMode === 'error' ? 'error' : 'ready' } } as MessageEvent));
        if (message.type === 'frame') state.frameSequences.push(message.sequence);
      }
      terminate() { if (!this.terminated) { this.terminated = true; state.workerTerminates++; } }
    }
    (window as any).Worker = MockWorker;
    (window as any).attentionQa.emitFaces = (sequence: number, boxes: Box[]) => {
      const worker = state.workers[state.workers.length - 1];
      worker?.onmessage?.({ data: { type: 'faces', sequence, boxes } });
    };
    (window as any).attentionQa.setHidden = (hidden: boolean) => { state.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); };

    class Recognition {
      lang = ''; interimResults = false; continuous = false;
      onresult: null | ((event: any) => void) = null;
      onerror: null | ((event: any) => void) = null;
      onend: null | (() => void) = null;
      start() { state.speechStarts++; }
      abort() { state.speechAborts++; queueMicrotask(() => this.onend?.()); }
    }
    (window as any).SpeechRecognition = Recognition;
    (window as any).webkitSpeechRecognition = Recognition;
  }, { workerMode: mode });
}

async function mockMemory(page: Page, vision = false) {
  await page.route('**/api/lulu/memory**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path.endsWith('/profile')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        profile: null, personal: null, face: null, profileVersion: 0, newsletterVersion: 0, newsletter: null,
        capabilities: { vision, search: false, email: false, shortlistEmail: false },
      }) });
    }
    if (route.request().method() === 'POST' && path.endsWith('/forget')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'empty', version: 1, newsletterRetained: false }) });
    }
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Persistence is disabled in attention QA.' }) });
  });
}

async function mockControlOffers(page: Page) {
  await page.route('**/api/lulu/conversation', async route => {
    const { message } = route.request().postDataJSON() as { message: string };
    const type = message.includes('remember') ? 'remember' : 'clothing';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mode: 'live', text: 'Here is the optional control.', interest: null, actions: [{ type, preferences: [] }], discoveries: [] }),
    });
  });
}

async function offerControl(page: Page, type: 'remember' | 'clothing') {
  await page.getByLabel('Type a message to Ruru').fill(type === 'remember' ? 'Let me review what you remember' : 'Let me share a clothing view');
  await page.getByRole('button', { name: 'Send message' }).click();
  const invitation = page.getByRole('region', { name: 'Ruru’s invitation' });
  await expect(invitation).toBeVisible();
  await expect(invitation.locator(type === 'remember' ? 'section#lulu-remember' : 'section.style-profile')).toBeVisible();
  return invitation;
}

async function openStyle(page: Page) {
  const invitation = await offerControl(page, 'clothing');
  const style = invitation.locator('section.style-profile');
  await expect(style.locator('.style-profile__status')).not.toContainText('Checking this browser', { timeout: 15_000 });
  return style;
}

async function startCamera(page: Page) {
  await page.getByRole('button', { name: 'Start camera' }).click();
  const video = page.getByLabel('Live camera preview');
  await expect(video).toBeVisible();
  await video.dispatchEvent('loadeddata');
  await expect(page.locator('.camera-attention')).toHaveAttribute('data-attention-status', /looking|unavailable/, { timeout: 5_000 });
}

async function counts(page: Page) {
  return page.evaluate(() => {
    const state = (window as any).attentionQa;
    return { tracks: state.trackStops, workers: state.workerTerminates, frames: state.frameSequences.length };
  });
}

test('camera attention stops across every visible lifecycle exit', async ({ page }) => {
  test.setTimeout(60_000);
  await installCameraAndWorker(page);
  await mockMemory(page);
  await mockControlOffers(page);
  await page.goto('/');
  await openStyle(page);

  await startCamera(page);
  expect(await page.evaluate(() => (window as any).attentionQa.constraints)).toMatchObject({ audio: false });
  await page.getByRole('button', { name: 'Stop camera' }).click();
  await expect.poll(async () => counts(page)).toMatchObject({ tracks: 1, workers: 1 });

  await startCamera(page);
  await page.getByRole('region', { name: 'Ruru’s invitation' }).getByRole('button', { name: 'Close' }).click();
  await expect.poll(async () => counts(page)).toMatchObject({ tracks: 2, workers: 2 });

  await openStyle(page);
  await startCamera(page);
  await page.getByRole('button', { name: 'New visitor' }).click();
  await expect.poll(async () => counts(page)).toMatchObject({ tracks: 3, workers: 3 });

  await openStyle(page);
  await startCamera(page);
  await page.evaluate(() => (window as any).attentionQa.setHidden(true));
  await expect.poll(async () => counts(page)).toMatchObject({ tracks: 4, workers: 4 });
  await page.evaluate(() => (window as any).attentionQa.setHidden(false));

  await startCamera(page);
  const remembered = (await offerControl(page, 'remember')).locator('section#lulu-remember');
  await expect.poll(async () => counts(page)).toMatchObject({ tracks: 5, workers: 5 });
  await remembered.getByRole('button', { name: 'Forget me', exact: true }).click();
  await expect(page.getByLabel('Live camera preview')).toBeHidden();
  await expect(page.locator('.camera-attention')).toHaveCount(0);
  await page.getByRole('button', { name: 'Face only' }).click();
  await expect.poll(async () => Math.abs(Number(await page.locator('.face-stage canvas').getAttribute('data-gaze-x')))).toBeLessThan(.08);
});

test('sequence checks and target continuity drive shared gaze without implicit upload', async ({ page }) => {
  await installCameraAndWorker(page);
  await mockMemory(page, true);
  await mockControlOffers(page);
  let analysisCalls = 0;
  await page.route('**/api/lulu/outfit/analyse', route => {
    analysisCalls++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ garment: 'top', color: 'green', style: 'casual' }) });
  });
  await page.goto('/');
  await openStyle(page);
  await startCamera(page);
  await page.locator('.camera-attention canvas').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await counts(page)).frames).toBeGreaterThan(0);
  const first = await page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1));
  const staleIgnored = await page.evaluate(sequence => {
    (window as any).attentionQa.emitFaces(sequence + 99, [{ x: .12, y: .2, width: .3, height: .4, score: .98 }]);
    const ignored = document.querySelector('.camera-attention')?.getAttribute('data-attention-status') === 'looking';
    (window as any).attentionQa.emitFaces(sequence, [
      { x: .12, y: .2, width: .3, height: .4, score: .98 },
      { x: .72, y: .22, width: .15, height: .2, score: .99 },
    ]);
    return ignored;
  }, first);
  expect(staleIgnored).toBe(true);
  await expect(page.locator('.camera-attention')).toHaveAttribute('data-attention-status', 'following');
  await expect.poll(async () => page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1))).not.toBe(first);
  const continuitySequence = await page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1));
  await page.evaluate(sequence => (window as any).attentionQa.emitFaces(sequence, [
    { x: .16, y: .2, width: .24, height: .35, score: .95 },
    { x: .62, y: .16, width: .34, height: .45, score: .99 },
  ]), continuitySequence);
  await expect.poll(async () => Number(await page.locator('.camera-attention canvas').getAttribute('data-gaze-x'))).toBeGreaterThan(.15);

  await page.getByRole('button', { name: 'Face only' }).click();
  await page.locator('.face-stage').scrollIntoViewIfNeeded();
  await expect.poll(async () => page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1))).not.toBe(continuitySequence);
  const faceSequence = await page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1));
  await page.evaluate(sequence => (window as any).attentionQa.emitFaces(sequence, [{ x: .12, y: .2, width: .3, height: .4, score: .98 }]), faceSequence);
  await expect.poll(async () => Number(await page.locator('.face-stage canvas').getAttribute('data-gaze-x'))).toBeGreaterThan(.15);
  await page.getByRole('button', { name: 'Mall', exact: true }).click();
  await page.getByTestId('mall-world').scrollIntoViewIfNeeded();
  await expect.poll(async () => page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1))).not.toBe(faceSequence);
  const mallSequence = await page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1));
  await page.evaluate(sequence => (window as any).attentionQa.emitFaces(sequence, [{ x: .12, y: .2, width: .3, height: .4, score: .98 }]), mallSequence);
  await expect.poll(async () => Number(await page.getByTestId('mall-world').getAttribute('data-gaze-x'))).toBeGreaterThan(.15);

  await expect.poll(async () => page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1))).not.toBe(mallSequence);
  const freshDetection = await page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1));
  await page.evaluate(sequence => (window as any).attentionQa.emitFaces(sequence, [{ x: .12, y: .2, width: .3, height: .4, score: .98 }]), freshDetection);
  await expect.poll(async () => page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1))).not.toBe(freshDetection);
  const briefDropout = await page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1));
  await page.evaluate(sequence => (window as any).attentionQa.emitFaces(sequence, []), briefDropout);
  await expect(page.locator('.camera-attention')).toHaveAttribute('data-attention-status', 'following');
  await page.waitForTimeout(650);
  await expect.poll(async () => page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1))).not.toBe(briefDropout);
  const expired = await page.evaluate(() => (window as any).attentionQa.frameSequences.at(-1));
  await page.evaluate(sequence => (window as any).attentionQa.emitFaces(sequence, []), expired);
  await expect(page.locator('.camera-attention')).toHaveAttribute('data-attention-status', 'looking');
  await page.getByRole('button', { name: 'Face only' }).click();
  await page.locator('.face-stage').scrollIntoViewIfNeeded();
  await expect.poll(async () => Math.abs(Number(await page.locator('.face-stage canvas').getAttribute('data-gaze-x')))).toBeLessThan(.08);
  expect(analysisCalls).toBe(0);

  await page.getByRole('button', { name: 'Use this view' }).click();
  await expect(page.getByAltText('Selected camera frame')).toBeVisible();
  expect(analysisCalls).toBe(0);
  await page.getByRole('checkbox', { name: /Use this photo to describe my clothes/ }).check();
  expect(analysisCalls).toBe(0);
  await page.getByRole('button', { name: 'Analyse selected frame' }).click();
  await expect(page.getByText(/Description added below/)).toBeVisible();
  expect(analysisCalls).toBe(1);

  await page.screenshot({ path: '/tmp/roaminglulu-attention-desktop.png', fullPage: true });
});

test('no-face expiry and worker failure leave camera and conversation responsive on mobile', async ({ page }) => {
  await installCameraAndWorker(page, 'error');
  await mockMemory(page);
  await mockControlOffers(page);
  await page.route('**/api/lulu/voice', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic attention QA voice response.' }) }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await openStyle(page);
  await startCamera(page);
  await expect(page.locator('.camera-attention')).toHaveAttribute('data-attention-status', 'unavailable');
  await expect(page.getByText(/Camera capture and conversation still work/)).toBeVisible();

  await page.getByRole('button', { name: 'Use this view' }).click();
  await expect(page.getByAltText('Selected camera frame')).toBeVisible();
  await page.getByLabel('Type a message to Ruru').fill('hello');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await page.getByRole('button', { name: 'Tap to talk with Ruru' }).click();
  await expect(page.getByText('Ruru is listening')).toBeVisible();
  await page.getByRole('button', { name: /Listening… tap to stop/ }).click();
  await expect(page.getByText('Ready when you are')).toBeVisible();
  expect(await page.evaluate(() => ({ starts: (window as any).attentionQa.speechStarts, aborts: (window as any).attentionQa.speechAborts }))).toEqual({ starts: 1, aborts: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/roaminglulu-attention-mobile.png', fullPage: true });
});

// Keep provider-independent regressions isolated when local credentials are present.
test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
