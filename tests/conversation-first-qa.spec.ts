import { expect, test, type Page } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

async function expectConversationGeometry(page: Page, portrait: boolean) {
  const world = page.getByTestId('mall-world');
  await expect(world).toHaveAttribute('data-rendered', 'true');
  await expect(world).toHaveAttribute('data-camera-mode', 'conversation');
  await expect(world).toHaveAttribute('data-robot-visible', 'true');
  const state = await world.evaluate(element => ({ ...((element as HTMLElement).dataset) }));
  expect(Number(state.luluX)).toBeCloseTo(0, 2);
  expect(Number(state.luluZ)).toBeCloseTo(6.5, 2);
  expect(Number(state.cameraX)).toBeCloseTo(0, 2);
  expect(Number(state.cameraY)).toBeCloseTo(2.45, 2);
  expect(Number(state.cameraZ) - Number(state.luluZ)).toBeCloseTo(portrait ? 10 : 7.7, 1);
}

test.beforeEach(async ({ page }) => {
  await scriptedConversation(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)', media: query,
        onchange: null, addListener() {}, removeListener() {}, addEventListener() {},
        removeEventListener() {}, dispatchEvent: () => false,
      }),
    });
    class ListeningRecognition {
      lang = ''; interimResults = false; continuous = false;
      onresult = null; onerror = null; onend: (() => void) | null = null;
      start() {}
      abort() { this.onend?.(); }
      stop() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: ListeningRecognition, configurable: true });
  });
});

test('desktop opens face-to-face, supports dialogue and restores the mall pose', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');

  const hero = page.locator('.introduction');
  const talk = page.locator('.encounter-section');
  expect((await hero.boundingBox())!.y).toBeLessThan((await talk.boundingBox())!.y);
  await expectConversationGeometry(page, false);

  await page.getByRole('button', { name: 'Meet Ruru', exact: true }).click();
  await expect.poll(async () => (await talk.boundingBox())!.y).toBeLessThan(40);

  await page.getByRole('button', { name: 'Mute Ruru', exact: true }).click();
  await page.getByLabel('Type a message to Ruru').fill('I love yoga');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.dialogue-hud').getByRole('heading', { name: /Yoga, nice/ })).toBeVisible();

  await page.getByRole('button', { name: 'Tap to talk with Ruru' }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0);

  const world = page.getByTestId('mall-world');
  await page.getByRole('button', { name: 'Mall', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'story');
  const tourPose = await world.evaluate(element => ({ x: Number((element as HTMLElement).dataset.luluX), z: Number((element as HTMLElement).dataset.luluZ) }));
  await page.getByRole('button', { name: 'With Ruru', exact: true }).click();
  await expectConversationGeometry(page, false);
  await page.getByRole('button', { name: 'Mall', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'story');
  const restored = await world.evaluate(element => ({ x: Number((element as HTMLElement).dataset.luluX), z: Number((element as HTMLElement).dataset.luluZ) }));
  expect(restored.x).toBeCloseTo(tourPose.x, 1);
  expect(restored.z).toBeCloseTo(tourPose.z, 1);
  await page.getByRole('button', { name: 'With Ruru', exact: true }).click();
  await expectConversationGeometry(page, false);
  await page.screenshot({ path: '/tmp/roaminglulu-conversation-desktop.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('portrait keeps Ruru and the dialogue HUD usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expectConversationGeometry(page, true);
  const stage = page.locator('.encounter-stage');
  const hud = page.locator('.dialogue-hud');
  const [stageBox, hudBox] = await Promise.all([stage.boundingBox(), hud.boundingBox()]);
  expect(hudBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
  expect(hudBox!.x + hudBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await stage.screenshot({ path: '/tmp/roaminglulu-conversation-mobile.png' });
});
