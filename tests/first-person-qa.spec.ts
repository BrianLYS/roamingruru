import { expect, test, type Page } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

type WorldState = {
  mode: string | undefined;
  phase: string | undefined;
  visitor: string | undefined;
  robotVisible: string | undefined;
  luluX: number;
  luluZ: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  forwardX: number;
  forwardZ: number;
  heading: number;
};

async function prepare(page: Page) {
  await page.addInitScript(() => {
    (window as any).firstPersonQaMediaCalls = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { (window as any).firstPersonQaMediaCalls++; throw new Error('Media is disabled in first-person QA.'); } },
    });
  });
  let voiceCalls = 0;
  await page.route('**/api/lulu/voice', route => {
    voiceCalls++;
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic first-person QA voice response.' }) });
  });
  await page.goto('/');
  const world = page.getByTestId('mall-world');
  await expect(world).toHaveAttribute('data-rendered', 'true');
  return { world, voiceCalls: () => voiceCalls };
}

async function worldState(page: Page): Promise<WorldState> {
  return page.getByTestId('mall-world').evaluate(element => {
    const data = (element as HTMLElement).dataset;
    return {
      mode: data.cameraMode,
      phase: data.phase,
      visitor: data.visitor,
      robotVisible: data.robotVisible,
      luluX: Number(data.luluX), luluZ: Number(data.luluZ),
      cameraX: Number(data.cameraX), cameraY: Number(data.cameraY), cameraZ: Number(data.cameraZ),
      forwardX: Number(data.cameraForwardX), forwardZ: Number(data.cameraForwardZ), heading: Number(data.luluHeading),
    };
  });
}

function expectFirstPersonGeometry(state: WorldState) {
  expect(state.mode).toBe('firstPerson');
  expect(state.robotVisible).toBe('false');
  expect(state.cameraY).toBeCloseTo(1.78, 2);
  expect(state.forwardX).toBeCloseTo(Math.sin(state.heading), 2);
  expect(state.forwardZ).toBeCloseTo(Math.cos(state.heading), 2);
  expect(state.cameraX - state.luluX).toBeCloseTo(state.forwardX * .28, 2);
  expect(state.cameraZ - state.luluZ).toBeCloseTo(state.forwardZ * .28, 2);
}

async function openVisitors(page: Page) {
  const picker = page.locator('details.visitor-picker');
  if (!(await picker.evaluate(element => (element as HTMLDetailsElement).open))) await picker.locator(':scope > summary').click();
}

test('desktop first-person view follows Ruru through selection, pause, wander, and explicit return', async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const { world, voiceCalls } = await prepare(page);

  await page.getByRole('button', { name: 'Ruru’s view', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'firstPerson');
  await expect(page.getByRole('button', { name: 'Ruru’s view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expectFirstPersonGeometry(await worldState(page));

  await page.getByRole('button', { name: 'Pause roaming', exact: true }).click();
  await page.waitForTimeout(180);
  const paused = await worldState(page);
  await page.waitForTimeout(500);
  const stillPaused = await worldState(page);
  expect(stillPaused.luluX).toBe(paused.luluX);
  expect(stillPaused.luluZ).toBe(paused.luluZ);
  expect(stillPaused.cameraX).toBe(paused.cameraX);
  expect(stillPaused.cameraZ).toBe(paused.cameraZ);
  expectFirstPersonGeometry(stillPaused);

  await openVisitors(page);
  await page.getByRole('button', { name: 'Meet Maya', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'firstPerson');
  await expect(world).toHaveAttribute('data-visitor', 'maya');
  await expect(world).toHaveAttribute('data-phase', 'greeting', { timeout: 20_000 });
  expectFirstPersonGeometry(await worldState(page));
  await page.locator('.world-stage').screenshot({ path: '/tmp/roaminglulu-first-person-qa-desktop.png' });

  await openVisitors(page);
  await page.getByRole('button', { name: 'Let Ruru roam freely' }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'firstPerson');
  await expect(world).toHaveAttribute('data-visitor', '');

  await page.getByRole('button', { name: 'Face only', exact: true }).click();
  await expect(page.locator('.face-stage canvas')).toBeVisible();
  await expect(world).toHaveAttribute('data-camera-mode', 'firstPerson');
  await page.getByRole('button', { name: 'Mall', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'story');
  await expect(world).toHaveAttribute('data-robot-visible', 'true');
  await page.getByRole('button', { name: 'Ruru’s view', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'firstPerson');
  expectFirstPersonGeometry(await worldState(page));

  expect(voiceCalls()).toBe(0);
  expect(await page.evaluate(() => (window as any).firstPersonQaMediaCalls)).toBe(0);
  expect((await context.cookies()).filter(cookie => cookie.name === 'lulu_memory')).toEqual([]);
});

test('mobile first-person visitor view fits and restores across Face only', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { world, voiceCalls } = await prepare(page);

  await page.getByRole('button', { name: 'Ruru’s view', exact: true }).click();
  await openVisitors(page);
  await page.getByRole('button', { name: 'Meet Sam', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'firstPerson');
  await expect(world).toHaveAttribute('data-visitor', 'sam');
  await expect(world).toHaveAttribute('data-phase', 'greeting', { timeout: 20_000 });
  expectFirstPersonGeometry(await worldState(page));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.world-stage').screenshot({ path: '/tmp/roaminglulu-first-person-qa-mobile.png' });

  await page.getByRole('button', { name: 'Face only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Face only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ruru’s view', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'firstPerson');
  await expect(world).toHaveAttribute('data-visitor', 'sam');
  expectFirstPersonGeometry(await worldState(page));

  expect(voiceCalls()).toBe(0);
  expect(await page.evaluate(() => (window as any).firstPersonQaMediaCalls)).toBe(0);
});

test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
