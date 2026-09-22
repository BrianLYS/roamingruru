import { scriptedConversation } from './scriptedConversation';
import { expect, test } from '@playwright/test';
test('mall renders, Ruru roams, pause stops travel, selected visitor is greeted', async ({ page }) => {
  test.setTimeout(45000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1512, height: 1080 });
  await page.goto('/');
  const world = page.getByTestId('mall-world');
  await expect(world).toHaveAttribute('data-rendered', 'true');
  await expect(world).toHaveAttribute('data-camera-mode', 'conversation');
  await page.getByRole('button', { name: 'Mall', exact: true }).click();
  const start = await world.getAttribute('data-lulu-x');
  await expect.poll(() => world.getAttribute('data-lulu-x')).not.toBe(start);
  await page.getByRole('button', { name: 'Pause roaming', exact: true }).click();
  await page.waitForTimeout(150);
  const stopped = await world.getAttribute('data-lulu-x');
  await page.waitForTimeout(500);
  expect(await world.getAttribute('data-lulu-x')).toBe(stopped);
  if (!await page.locator('.visitor-picker').getAttribute('open').then(value => value !== null)) await page.locator('.visitor-picker > summary').click();
  await page.getByRole('button', { name: 'Meet Maya', exact: true }).click();
  await expect(world).toHaveAttribute('data-visitor', 'maya');
  await expect(world).toHaveAttribute('data-phase', 'greeting', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /Hey Maya/ })).toBeVisible();
  await page.getByRole('button', { name: 'Pause roaming', exact: true }).click();
  await page.screenshot({ path: '.local/mall-desktop.png', fullPage: true });
  if (!await page.locator('.visitor-picker').getAttribute('open').then(value => value !== null)) await page.locator('.visitor-picker > summary').click();
  await page.getByRole('button', { name: 'Meet Maya', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Hey Maya/ })).toBeVisible();
  await page.getByRole('button', { name: 'Let Ruru roam freely' }).click();
  await expect(page.getByRole('button', { name: 'Meet Maya' })).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});
test('screen-only view shows six expressions and returning to mall preserves the scene', async ({ page }) => {
  await page.goto('/');
  const world = page.getByTestId('mall-world');
  await expect(world).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Face only', exact: true }).click();
  await page.getByText('A closer look at her expressions', { exact: true }).click();
  await page.getByRole('button', { name: 'Preview Delighted expression' }).click();
  await expect(page.locator('.face-stage .screen-face')).toHaveAttribute('data-expression', 'happy');
  await page.waitForTimeout(700);
  await page.screenshot({ path: '.local/lulu-delighted.png', fullPage: true });
  await page.getByRole('button', { name: 'Preview Oh! expression' }).click();
  await expect(page.locator('.face-stage .screen-face')).toHaveAttribute('data-expression', 'surprised');
  await page.waitForTimeout(700);
  await page.screenshot({ path: '.local/lulu-surprised.png', fullPage: true });
  await expect(page.getByRole('button', { name: /^Preview .* expression$/ })).toHaveCount(6);
  await page.getByRole('button', { name: 'Mall', exact: true }).click();
  await expect(world).toBeVisible();
  await expect(world).toHaveAttribute('data-rendered', 'true');
  await expect(page.locator('.mall-canvas canvas')).toHaveCount(1);
});

test('missing WebGL leaves the expressive face and typed interaction usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind.startsWith('webgl')) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('The 3D mall needs WebGL');
  await page.getByRole('button', { name: 'Face only', exact: true }).click();
  await expect(page.locator('.face-stage canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Mute Ruru', exact: true }).click();
  await page.getByLabel('Type a message to Ruru').fill('I love yoga');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Yoga, nice/ })).toBeVisible();
});

 test('encounter invitation follows Ruru and shows the visitor turn on mobile', async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const world = page.getByTestId('mall-world');
  await expect(world).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Watch an encounter', exact: true }).click();
  await expect(world).toHaveAttribute('data-camera-mode', 'story');
  await expect(world).toHaveAttribute('data-phase', 'greeting', { timeout: 15000 });
  await expect(page.locator('.story-caption')).toContainText('Maya', { timeout: 7000 });
  await expect(page.locator('.story-caption')).toContainText('Good! I could use a new top', { timeout: 7000 });
  await page.getByRole('button', { name: 'Pause roaming', exact: true }).click();
  await page.screenshot({ path: '.local/taste-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.story-caption')).toContainText('Good! I could use a new top for the next one.');
  await page.getByRole('button', { name: 'Resume roaming', exact: true }).click();
  await expect(page.locator('.story-caption')).toContainText('Good! I could use a new top for the next one.');
  await expect(page.locator('.story-caption')).toContainText('Worth a look for your next class.', { timeout: 10000 });
  // Fictional mall encounters remain separate from real visitor agent tools.
  await expect(page.locator('.agent-actions')).toHaveCount(0);
 });

// Keep provider-independent regressions isolated when local credentials are present.
test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
