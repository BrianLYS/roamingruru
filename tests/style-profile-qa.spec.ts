import { expect, test } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

// The former real-session profile and pending-signup cases represented the old
// fixed form. Current personal-memory, active mailing-list, independent Forget,
// and unsubscribe behavior is covered by agent-spec-qa.spec.ts. This file keeps
// the distinct local-camera and clothing-consent regression.

test('mocked camera sends only a chosen clothing frame and ignores cancelled analysis', async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const state = { constraints: null as MediaStreamConstraints | null, stops: 0 };
    (window as any).styleQaCamera = state;
    const track = { stop() { state.stops++; }, onended: null as null | (() => void) };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async (constraints: MediaStreamConstraints) => { state.constraints = constraints; return stream; } },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get() { return (this as any).__stream ?? null; },
      set(value) { (this as any).__stream = value; },
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
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
  });

  const snapshot = {
    profile: null,
    personal: null,
    face: null,
    profileVersion: 0,
    newsletterVersion: 0,
    newsletter: null,
    capabilities: { vision: true, search: true, email: false, shortlistEmail: false },
  };
  await page.route('**/api/lulu/memory/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path.endsWith('/profile')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) });
    }
    return route.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ error: 'Unexpected memory write blocked by clothing QA.' }) });
  });

  let analysisCalls = 0;
  let firstAnalysisBody: Record<string, unknown> | null = null;
  let suggestionBody: Record<string, unknown> | null = null;
  let releaseStale!: () => void;
  const staleReleased = new Promise<void>(resolve => { releaseStale = resolve; });
  await page.route('**/api/lulu/outfit/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (path.endsWith('/analyse')) {
      analysisCalls++;
      if (analysisCalls === 1) firstAnalysisBody = body;
      if (analysisCalls === 2) await staleReleased;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analysisCalls === 1
        ? { garment: 'leggings', color: 'blue', style: 'active' }
        : { garment: 'dress', color: 'red', style: 'smart' }) }).catch(() => undefined);
      return;
    }
    suggestionBody = body;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      items: [{ title: 'Official synthetic result', url: 'https://shop.lululemon.com/c/women', description: 'Synthetic QA result.' }],
      checkedAt: '2026-09-22T12:00:00.000Z',
    }) });
  });
  await page.route('**/api/lulu/conversation', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ mode: 'live', text: 'You can choose a clothing view to share.', interest: null, actions: [{ type: 'clothing', preferences: [] }], discoveries: [] }),
  }));

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Check saved choices' })).toHaveCount(0, { timeout: 15_000 });
  await page.getByLabel('Type a message to Ruru').fill('Can I share a clothing view?');
  await page.getByRole('button', { name: 'Send message' }).click();
  const invitation = page.getByRole('region', { name: 'Ruru’s invitation' });
  const style = invitation.locator('section.style-profile');
  await expect(style).toBeVisible();
  await expect(style.locator('.style-profile__status')).not.toContainText('Checking this browser', { timeout: 15_000 });
  await style.getByRole('button', { name: 'Start camera' }).click();
  await expect(style.getByLabel('Live camera preview')).toBeVisible();
  await style.getByLabel('Live camera preview').dispatchEvent('loadeddata');
  await style.getByRole('button', { name: 'Use this view' }).click();
  await expect(style.getByAltText('Selected camera frame')).toBeVisible();
  expect(analysisCalls).toBe(0);
  expect(await page.evaluate(() => (window as any).styleQaCamera.constraints)).toMatchObject({ audio: false });

  const photoConsent = style.getByRole('checkbox', { name: /Use this photo to describe my clothes/ });
  await photoConsent.check();
  await style.getByRole('button', { name: 'Analyse selected frame' }).click();
  await expect(style.getByText(/Description added below/)).toBeVisible();
  await expect(style.getByLabel('Garment')).toHaveValue('leggings');
  await expect(style.getByLabel('Colour')).toHaveValue('blue');
  await expect(style.getByRole('combobox', { name: 'Style', exact: true })).toHaveValue('active');
  expect(firstAnalysisBody && Object.keys(firstAnalysisBody).sort()).toEqual(['consent', 'image']);

  await style.getByPlaceholder('A name or nickname').fill('Local QA Name');
  await style.getByLabel('What are you into?').selectOption('yoga');
  await style.getByRole('button', { name: 'Find outfit ideas' }).click();
  await expect(style.getByRole('link', { name: 'Official synthetic result' })).toBeVisible();
  expect(suggestionBody).toEqual({ garment: 'leggings', color: 'blue', style: 'active', interest: 'yoga' });
  expect(JSON.stringify(suggestionBody)).not.toContain('Local QA Name');
  expect(JSON.stringify(suggestionBody)).not.toContain(String(firstAnalysisBody?.image));

  await style.getByRole('button', { name: 'Stop camera' }).click();
  await expect(style.getByAltText('Selected camera frame')).toHaveCount(0);
  await style.getByRole('button', { name: 'Start camera' }).click();
  await style.getByLabel('Live camera preview').dispatchEvent('loadeddata');
  await style.getByRole('button', { name: 'Use this view' }).click();
  await photoConsent.check();
  await style.getByRole('button', { name: 'Analyse selected frame' }).click();
  await expect(style.getByText(/Describing the clothes/)).toBeVisible();
  await photoConsent.uncheck();
  releaseStale();
  await page.waitForTimeout(100);
  await expect(style.getByLabel('Garment')).toHaveValue('leggings');
  await expect(style.getByLabel('Colour')).toHaveValue('blue');
  await expect(style.getByRole('combobox', { name: 'Style', exact: true })).toHaveValue('active');

  await style.getByRole('button', { name: 'Stop camera' }).click();
  await style.getByRole('button', { name: 'Start camera' }).click();
  await style.getByLabel('Live camera preview').dispatchEvent('loadeddata');
  await style.getByRole('button', { name: 'Use this view' }).click();
  await page.getByRole('button', { name: 'New visitor' }).click();
  await expect(style.getByAltText('Selected camera frame')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).styleQaCamera.stops)).toBeGreaterThanOrEqual(3);
  expect((await context.cookies()).filter(cookie => cookie.name === 'lulu_memory')).toEqual([]);
});

test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
