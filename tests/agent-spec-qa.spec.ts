import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4317';
type Json = Record<string, any>;

const discoveries = [
  {
    title: 'Align High-Rise Pant 25"',
    url: 'https://shop.lululemon.com/p/align-high-rise-pant-25/LW5CTCS.html',
    description: 'Official US product page. Check the source for current price and availability.',
    kind: 'product',
    checkedAt: '2026-09-22T06:30:00.000Z',
  },
  {
    title: 'Valley Fair events',
    url: 'https://www.westfield.com/en/united-states/valleyfair/events',
    description: 'Official Valley Fair event listing. Open the source to confirm current dates and registration.',
    kind: 'event',
    checkedAt: '2026-09-22T06:30:00.000Z',
  },
];

function receipt(items = discoveries) {
  const payload = Buffer.from(JSON.stringify({
    items: items.map(({ title, url }) => ({ title, url })),
    expiresAt: Date.now() + 10 * 60_000,
  })).toString('base64url');
  return `${payload}.${'a'.repeat(64)}`;
}

function profile(overrides: Json = {}) {
  return {
    profile: null,
    personal: null,
    face: null,
    profileVersion: 0,
    newsletterVersion: 0,
    newsletter: null,
    capabilities: { vision: false, search: true, email: false, shortlistEmail: true },
    ...overrides,
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function isolate(page: Page) {
  await page.addInitScript(() => {
    const state = { plays: 0, pauses: 0, sources: [] as string[] };
    const camera = { requests: 0, stops: 0 };
    Object.assign(window, { agentSpecQaAudio: state, agentSpecQaCamera: camera });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:agent-spec-qa-audio' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    Object.defineProperty(window, 'Audio', { configurable: true, value: class {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public src: string) { state.sources.push(src); }
      play() { state.plays += 1; return Promise.resolve(); }
      pause() { state.pauses += 1; }
      removeAttribute() {}
      load() {}
    } });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => {
        camera.requests += 1;
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const stream = canvas.captureStream(1);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { camera.stops += 1; stop(); };
        }
        return stream;
      } },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  });
  const external: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== origin && !['data:', 'blob:'].includes(url.protocol)) external.push(request.url());
  });
  return external;
}

async function send(page: Page, text: string) {
  await page.getByLabel('Type a message to Ruru').fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}

async function ready(page: Page) {
  await expect(page.getByText('AI conversation · messages go to OpenAI.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Check saved choices' })).toHaveCount(0, { timeout: 15_000 });
}

test('desktop agent response speaks, shows sourced cards, and keeps memory and newsletter consent independent', async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 1360, height: 900 });
  const external = await isolate(page);
  const unexpected: string[] = [];
  const conversationBodies: Json[] = [];
  const voiceBodies: Json[] = [];
  const writes: { path: string; body: Json }[] = [];
  let saved = profile();
  let releaseStale!: () => void;
  const staleGate = new Promise<void>(resolve => { releaseStale = resolve; });

  await page.route('**/api/lulu/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === '/api/lulu/conversation/status' && method === 'GET') return json(route, { mode: 'live' });
    if (path === '/api/lulu/conversation' && method === 'POST') {
      const body = request.postDataJSON() as Json;
      conversationBodies.push(body);
      if (body.message === 'Hold this reply while I stop it') {
        await staleGate;
        return json(route, {
          mode: 'live', text: 'STALE CONTEXT MUST NOT APPEAR', interest: 'running', voiceToken: 'stale-token',
          actions: [{ type: 'mailing_list', preferences: [] }],
          discoveries: [{ ...discoveries[0], title: 'STALE DISCOVERY MUST NOT APPEAR' }],
        }).catch(() => undefined);
      }
      const mailing = body.message === 'Show me how to get shop updates';
      const first = conversationBodies.length === 1;
      return json(route, {
        mode: 'live',
        text: mailing ? 'Scan my face to open the optional shop updates form.' : 'I found an official yoga layer and a community page. Want me to remember that you prefer quiet evening classes?',
        interest: first ? 'yoga' : null,
        ...(first ? { voiceToken: 'signed-agent-reply-token' } : {}),
        actions: mailing ? [{ type: 'mailing_list', preferences: [] }] : [{ type: 'remember', preferences: ['Quiet evening yoga classes'] }],
        discoveries: first ? discoveries : [],
        ...(first ? { receipt: receipt() } : {}),
      });
    }
    if (path === '/api/lulu/voice' && method === 'POST') {
      voiceBodies.push(request.postDataJSON() as Json);
      return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([73, 68, 51, 3, 0, 0]) });
    }
    if (path === '/api/lulu/memory/profile' && method === 'GET') return json(route, saved);
    if (path === '/api/lulu/memory/shortlist-email' && method === 'GET') return json(route, { outcome: null });
    if (path === '/api/lulu/memory/session' && method === 'POST') {
      const body = request.postDataJSON() as Json; writes.push({ path, body }); return json(route, { state: 'ready' });
    }
    if (path === '/api/lulu/memory/personal' && method === 'POST') {
      const body = request.postDataJSON() as Json; writes.push({ path, body });
      saved = profile({ ...saved, personal: { name: body.name, preferences: body.preferences }, profileVersion: saved.profileVersion + 1 });
      return json(route, { status: 'saved' });
    }
    if (path === '/api/lulu/memory/newsletter' && method === 'POST') {
      const body = request.postDataJSON() as Json; writes.push({ path, body });
      saved = profile({ ...saved, newsletter: { status: 'active', emailHint: 'v•••@example.invalid' }, newsletterVersion: saved.newsletterVersion + 1 });
      return json(route, { status: 'saved' });
    }
    if (path === '/api/lulu/memory/unsubscribe' && method === 'POST') {
      const body = request.postDataJSON() as Json; writes.push({ path, body });
      saved = profile({ ...saved, newsletter: null, newsletterVersion: saved.newsletterVersion + 1 });
      return json(route, { status: 'unsubscribed' });
    }
    if (path === '/api/lulu/memory/forget' && method === 'POST') {
      const body = request.postDataJSON() as Json; writes.push({ path, body });
      saved = profile({ ...saved, personal: null, face: null, profile: null, profileVersion: saved.profileVersion + 1 });
      return json(route, { state: 'empty', version: saved.profileVersion, newsletterRetained: true });
    }
    unexpected.push(`${method} ${path}`);
    return json(route, { error: 'Unmocked API blocked by agent-spec QA.' }, 599);
  });

  await page.goto('/');
  await ready(page);
  await expect(page.getByText('What Ruru remembers', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Shop updates, if you’d like', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Camera & clothing', { exact: true })).toHaveCount(0);
  await expect(page.locator('.agent-actions')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Ruru’s invitation' })).toHaveCount(0);
  await send(page, 'Surprise me with something calm after work');

  await expect(page.getByRole('heading', { name: /official yoga layer/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).agentSpecQaAudio.plays)).toBe(1);
  await expect(page.getByText('Ruru is speaking', { exact: true })).toBeVisible();
  expect(voiceBodies).toEqual([{ text: 'I found an official yoga layer and a community page. Want me to remember that you prefer quiet evening classes?', token: 'signed-agent-reply-token' }]);
  expect(conversationBodies[0]).toEqual({ message: 'Surprise me with something calm after work', history: [], interest: null, recognitionMode: false });

  await expect(page.getByRole('link', { name: 'Align High-Rise Pant 25"' })).toHaveAttribute('href', discoveries[0].url);
  await expect(page.getByRole('link', { name: 'Valley Fair events' })).toHaveAttribute('href', discoveries[1].url);
  await expect(page.locator('.shortlist__items > li')).toHaveCount(2);
  await expect(page.locator('.shortlist')).toContainText('Official lululemon US and Valley Fair pages');
  await expect(page.locator('.shortlist')).toContainText('Product page');
  await expect(page.locator('.shortlist')).toContainText('Event page');
  const invitation = page.getByRole('region', { name: 'Ruru’s invitation' });
  await expect(invitation).toBeVisible();
  await expect(page.locator('.agent-actions')).toHaveCount(0);
  const memory = invitation.locator('#lulu-remember');
  await expect(memory).toHaveJSProperty('tagName', 'SECTION');
  await expect(memory.locator('summary')).toHaveCount(0);
  await expect(memory.getByLabel('Things I’d like Ruru to remember')).toHaveValue('Quiet evening yoga classes');
  await expect(memory.getByRole('checkbox', { name: /Remember these details/ })).not.toBeChecked();
  expect(writes).toEqual([]);
  await memory.getByRole('checkbox', { name: /Remember these details/ }).check();
  await memory.getByRole('button', { name: 'Remember this' }).click();
  await expect(page.getByText('Remembered. You can change or forget this whenever you like.')).toBeVisible();
  expect(writes.slice(0, 2)).toEqual([
    { path: '/api/lulu/memory/session', body: { consent: true, purpose: 'profile' } },
    { path: '/api/lulu/memory/personal', body: { consent: true, version: 0, name: '', preferences: ['Quiet evening yoga classes'] } },
  ]);

  await send(page, 'Show me how to get shop updates');
  await expect(invitation).toHaveCount(0);
  await expect(page.locator('.qr-invitation')).toBeVisible();
  await expect(page.locator('.qr-invitation').getByRole('link')).toHaveAttribute('href', '/?signup=1');
  await expect(page.locator('#lulu-mailing-list')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?signup=1');
  const newsletter = page.locator('#lulu-mailing-list');
  await expect(newsletter).toHaveAttribute('open', '');
  await newsletter.getByLabel('Email address').fill('visitor@example.invalid');
  await expect(newsletter.getByRole('checkbox', { name: /Yes, send me Ruru’s updates/ })).not.toBeChecked();
  expect(writes).toHaveLength(2);
  await newsletter.getByRole('checkbox', { name: /Yes, send me Ruru’s updates/ }).check();
  await newsletter.getByRole('button', { name: 'Join Ruru’s list' }).click();
  await expect(newsletter.getByText('You’re on Ruru’s list')).toBeVisible();
  expect(writes.slice(2, 4)).toEqual([
    { path: '/api/lulu/memory/session', body: { consent: true, purpose: 'newsletter' } },
    { path: '/api/lulu/memory/newsletter', body: { consent: true, version: 0, email: 'visitor@example.invalid' } },
  ]);

  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto('/');
  await ready(page);
  await send(page, 'Review what you remember');
  const review = page.getByRole('region', { name: 'Ruru’s invitation' }).locator('#lulu-remember');
  await expect(review).toBeVisible();
  await page.evaluate(() => localStorage.setItem('roaminglulu-interest', 'legacy-yoga'));
  await review.getByRole('button', { name: 'Forget me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All forgotten. A fresh little hello!' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ruru’s invitation' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('roaminglulu-interest'))).toBeNull();
  expect(writes.at(-1)).toEqual({ path: '/api/lulu/memory/forget', body: {} });
  expect(writes.some(write => write.path.endsWith('/unsubscribe'))).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?signup=1');
  const retainedNewsletter = page.locator('#lulu-mailing-list');
  await expect(retainedNewsletter.getByText('You’re on Ruru’s list')).toBeVisible();
  await retainedNewsletter.getByRole('button', { name: 'Unsubscribe' }).click();
  await expect(page.locator('.memory-choices').getByRole('status')).toContainText('Unsubscribed.');
  expect(writes.at(-1)).toEqual({ path: '/api/lulu/memory/unsubscribe', body: { version: 1 } });

  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto('/');
  await ready(page);

  await send(page, 'Hold this reply while I stop it');
  await expect(page.getByText('One moment…', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  releaseStale();
  await page.waitForTimeout(200);
  await expect(page.locator('body')).not.toContainText('STALE CONTEXT MUST NOT APPEAR');
  await expect(page.locator('body')).not.toContainText('STALE DISCOVERY MUST NOT APPEAR');
  expect(voiceBodies).toHaveLength(1);

  await page.screenshot({ path: '/tmp/roaminglulu-agent-spec-desktop.png', fullPage: true });
  expect(unexpected).toEqual([]);
  expect(external).toEqual([]);
});

test('camera and changed-face boundaries clear prior agent context while capability retry keeps sourced cards', async ({ page }) => {
  test.setTimeout(60_000);
  const external = await isolate(page);
  const unexpected: string[] = [];
  const conversationBodies: Json[] = [];
  let capabilitiesReady = false;

  await page.route('**/api/lulu/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === '/api/lulu/conversation/status' && method === 'GET') return json(route, { mode: 'live' });
    if (path === '/api/lulu/memory/profile' && method === 'GET') {
      const value = profile();
      if (!capabilitiesReady) delete value.capabilities;
      return json(route, value);
    }
    if (path === '/api/lulu/memory/shortlist-email' && method === 'GET') return json(route, { outcome: null });
    if (path === '/api/lulu/conversation' && method === 'POST') {
      const body = request.postDataJSON() as Json; conversationBodies.push(body);
      const first = conversationBodies.length === 1;
      return json(route, {
        mode: 'live',
        text: first ? 'The first visitor likes yoga.' : `Reply ${conversationBodies.length}`,
        interest: first ? 'yoga' : conversationBodies.length === 2 ? 'exploring' : conversationBodies.length === 3 ? 'running' : null,
        actions: first || body.message === 'Open camera again' ? [{ type: 'clothing', preferences: [] }] : [],
        discoveries: first ? discoveries : [],
        ...(first ? { receipt: receipt() } : {}),
      });
    }
    unexpected.push(`${method} ${path}`);
    return json(route, { error: 'Unmocked API blocked by agent-spec QA.' }, 599);
  });

  await page.goto('/');
  await ready(page);
  await expect(page.getByText('What Ruru remembers', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Shop updates, if you’d like', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Camera & clothing', { exact: true })).toHaveCount(0);
  await send(page, 'First visitor context');
  await expect(page.getByRole('link', { name: 'Align High-Rise Pant 25"' })).toBeVisible();
  const invitation = page.getByRole('region', { name: 'Ruru’s invitation' });
  await expect(invitation.locator('.style-profile')).toBeVisible();
  await expect(invitation.locator('.style-profile > summary')).toHaveCount(0);
  capabilitiesReady = true;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Align High-Rise Pant 25"' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Valley Fair events' })).toBeVisible();

  expect(await page.evaluate(() => (window as any).agentSpecQaCamera.requests)).toBe(0);
  await invitation.getByRole('button', { name: 'Start camera' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).agentSpecQaCamera.requests)).toBe(1);
  await expect(page.getByText('This conversation', { exact: true })).toHaveCount(0);
  await expect(page.locator('.shortlist')).toHaveCount(0);
  await expect(page.locator('.agent-actions')).toHaveCount(0);
  await send(page, 'Camera visitor context');
  expect(conversationBodies[1]).toEqual({ message: 'Camera visitor context', history: [], interest: null, recognitionMode: true });
  await expect(page.getByText('Reply 2', { exact: true })).toBeVisible();
  await expect(invitation).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).agentSpecQaCamera.stops)).toBe(1);

  await send(page, 'Open camera again');
  await expect(invitation.locator('.style-profile')).toBeVisible();
  await invitation.getByRole('button', { name: 'Start camera' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).agentSpecQaCamera.requests)).toBe(2);
  await invitation.getByRole('button', { name: 'Close' }).click();
  await expect(invitation).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).agentSpecQaCamera.stops)).toBe(2);

  await page.evaluate(() => {
    window.dispatchEvent(new Event('lulu-camera-started'));
    window.dispatchEvent(new CustomEvent('lulu-clothing-reviewed', { detail: { clothingToken: 'prior-visitor-clothing-token' } }));
  });

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('lulu-recognized', { detail: { status: 'recognized', name: 'A', recognitionToken: 'recognition-token-a' } })));
  await send(page, 'Recognized visitor A');
  expect(conversationBodies[3]).toMatchObject({
    message: 'Recognized visitor A',
    interest: null,
    recognitionMode: true,
    recognitionToken: 'recognition-token-a',
  });
  expect(conversationBodies[3].history).toHaveLength(0);
  expect(conversationBodies[3].clothingToken).toBe('prior-visitor-clothing-token');

  await page.evaluate(() => {
    window.dispatchEvent(new Event('lulu-visitor-changed'));
    window.dispatchEvent(new Event('lulu-recognition-cleared'));
    window.dispatchEvent(new CustomEvent('lulu-recognized', { detail: { status: 'recognized', name: 'B', recognitionToken: 'recognition-token-b' } }));
  });
  await expect(page.getByText('This conversation', { exact: true })).toHaveCount(0);
  await send(page, 'Recognized visitor B');
  expect(conversationBodies[4]).toEqual({ message: 'Recognized visitor B', history: [], interest: null, recognitionMode: true, recognitionToken: 'recognition-token-b' });
  expect(JSON.stringify(conversationBodies[4])).not.toContain('prior-visitor-clothing-token');
  expect(unexpected).toEqual([]);
  expect(external).toEqual([]);
});

test('mobile shortlist retry reuses one operation and a repeated request gets a new operation', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const external = await isolate(page);
  const unexpected: string[] = [];
  const statusOperations: string[] = [];
  const emailAttempts: Json[] = [];
  const sessionPurposes: Json[] = [];

  await page.route('**/api/lulu/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === '/api/lulu/conversation/status' && method === 'GET') return json(route, { mode: 'live' });
    if (path === '/api/lulu/conversation' && method === 'POST') return json(route, {
      mode: 'live', text: 'Here are two official sources for your run.', interest: 'running',
      actions: [], discoveries, receipt: receipt(), voiceToken: 'mobile-agent-token',
    });
    if (path === '/api/lulu/voice' && method === 'POST') return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([73, 68, 51]) });
    if (path === '/api/lulu/memory/profile' && method === 'GET') return json(route, profile());
    if (path === '/api/lulu/memory/shortlist-email' && method === 'GET') {
      statusOperations.push(url.searchParams.get('operationId') ?? '');
      return json(route, { outcome: null });
    }
    if (path === '/api/lulu/memory/session' && method === 'POST') {
      sessionPurposes.push(request.postDataJSON() as Json); return json(route, { state: 'ready' });
    }
    if (path === '/api/lulu/memory/shortlist-email' && method === 'POST') {
      const body = request.postDataJSON() as Json; emailAttempts.push(body);
      if (emailAttempts.length === 1) return json(route, { error: 'Synthetic provider unavailable; retry safely.' }, 503);
      return json(route, { outcome: 'sent' });
    }
    unexpected.push(`${method} ${path}`);
    return json(route, { error: 'Unmocked API blocked by agent-spec QA.' }, 599);
  });

  await page.goto('/');
  await ready(page);
  await expect(page.getByText('What Ruru remembers', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Shop updates, if you’d like', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Camera & clothing', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Ruru’s invitation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mute Ruru', exact: true }).click();
  await send(page, 'Find something useful for a humid evening run');
  await expect(page.getByRole('link', { name: 'Align High-Rise Pant 25"' })).toBeVisible();
  const emailPanel = page.locator('details.shortlist__email');
  await emailPanel.locator(':scope > summary').click();
  await expect(emailPanel.getByRole('button', { name: 'Send my shortlist' })).toBeVisible({ timeout: 15_000 });

  const address = emailPanel.getByLabel('Email address');
  const consent = emailPanel.getByRole('checkbox', { name: /Send this shortlist once/ });
  await address.fill('first@example.invalid');
  await consent.check();
  await emailPanel.getByRole('button', { name: 'Send my shortlist' }).click();
  await expect(emailPanel).toContainText('Synthetic provider unavailable; retry safely.');
  await expect(address).toHaveValue('first@example.invalid');
  await expect(consent).toBeChecked();
  await emailPanel.getByRole('button', { name: 'Send my shortlist' }).click();
  await expect(emailPanel).toContainText('Accepted for sending. Check your inbox.');
  expect(emailAttempts).toHaveLength(2);
  expect(emailAttempts[0].operationId).toBe(emailAttempts[1].operationId);
  expect(emailAttempts[0].receipt).toBe(emailAttempts[1].receipt);

  await emailPanel.getByRole('button', { name: 'Start another email request' }).click();
  await address.fill('second@example.invalid');
  await consent.check();
  await emailPanel.getByRole('button', { name: 'Send my shortlist' }).click();
  await expect(emailPanel).toContainText('Accepted for sending. Check your inbox.');
  expect(emailAttempts).toHaveLength(3);
  expect(emailAttempts[2].operationId).not.toBe(emailAttempts[1].operationId);
  expect(emailAttempts[2]).toMatchObject({ consent: true, email: 'second@example.invalid', receipt: emailAttempts[1].receipt });
  expect(sessionPurposes).toEqual([
    { consent: true, purpose: 'shortlist' },
    { consent: true, purpose: 'shortlist' },
    { consent: true, purpose: 'shortlist' },
  ]);
  expect(statusOperations).toHaveLength(1);
  expect(statusOperations[0]).toBe(emailAttempts[0].operationId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/roaminglulu-agent-spec-mobile.png', fullPage: true });
  expect(unexpected).toEqual([]);
  expect(external).toEqual([]);
});
