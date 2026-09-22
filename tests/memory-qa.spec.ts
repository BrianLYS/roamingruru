import { expect, test } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

// Legacy cookie-interest persistence, real-adapter writes, and coupled newsletter
// deletion were retired. Current consent/Forget coverage lives in
// agent-spec-qa.spec.ts; face deletion and return recognition live in
// face-memory.spec.ts.

test('Stop cancels mocked speech while waiting, playing, and listening', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { plays: 0, pauses: 0, aborts: 0 };
    Object.assign(window, { memoryQaAudio: state });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:memory-qa-audio' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    Object.defineProperty(window, 'Audio', { configurable: true, value: class {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play() { state.plays++; return Promise.resolve(); }
      pause() { state.pauses++; }
      removeAttribute() {}
      load() {}
    } });
    class MockRecognition {
      lang = ''; interimResults = false; continuous = false;
      onresult = null; onerror = null; onend: (() => void) | null = null;
      start() {}
      abort() { state.aborts++; this.onend?.(); }
      stop() { this.abort(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: MockRecognition });
  });

  let speechAttempt = 0;
  let releaseWaiting!: () => void;
  const waitingReleased = new Promise<void>(resolve => { releaseWaiting = resolve; });
  await page.route('**/api/lulu/voice', async route => {
    speechAttempt++;
    if (speechAttempt === 1) await waitingReleased;
    await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([1, 2, 3]) }).catch(() => undefined);
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Check saved choices' })).toHaveCount(0, { timeout: 15_000 });
  await page.getByLabel('Type a message to Ruru').fill('I love yoga');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  releaseWaiting();
  await expect(page.getByText('Ready when you are', { exact: true })).toBeVisible();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).memoryQaAudio.plays)).toBe(0);

  await page.getByRole('button', { name: 'Read this line aloud' }).click();
  await expect(page.getByText('Ruru is speaking', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Ready when you are', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).memoryQaAudio)).toMatchObject({ plays: 1, pauses: 1 });

  await page.getByRole('button', { name: 'Tap to talk with Ruru' }).click();
  await expect(page.getByText('Ruru is listening', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Ready when you are', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).memoryQaAudio.aborts)).toBeGreaterThan(0);
});

test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
