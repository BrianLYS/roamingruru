import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { scriptedConversation } from './scriptedConversation';

test('presentation works offline, supports keyboard navigation and fits mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('public/intro.html')).href);
  await expect(page.getByRole('heading', { name: /Every mall/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Just having/ })).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.getByRole('link', { name: 'Open the local demo' })).toHaveAttribute('href', 'http://127.0.0.1:4317/#demo');
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeDisabled();
  await page.keyboard.press('Home');
  await page.screenshot({ path: '.local/presentation-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: `${i + 1} of 4:`, exact: false }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.keyboard.press('Home');
  await page.screenshot({ path: '.local/presentation-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`header presentation link opens the deck and returns to Ruru at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByTitle('RoamingRuru presentation')).toHaveCount(0);
    await expect(page.locator('main > section').first()).toHaveAttribute('id', 'demo');
    const link = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Presentation' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/intro.html');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/presentation-header-${viewport.width}.png` });
    await link.click();
    await expect(page.getByRole('heading', { name: /Every mall/ })).toBeVisible();
    await page.getByRole('button', { name: '4 of 4: The demo', exact: true }).click();
    await page.getByRole('link', { name: 'Talk with Ruru', exact: false }).click();
    await expect(page).toHaveURL(/\/#demo$/);
    await expect(page.getByTestId('mall-world')).toHaveAttribute('data-camera-mode', 'conversation');
    await expect(page.getByRole('heading', { name: 'Talk with Ruru', exact: true })).toBeVisible();
  });
}

test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
