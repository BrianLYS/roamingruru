import { test, expect } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

for (const width of [1440, 390]) test(`header anchors and final inline presentation at ${width}px`, async ({ page }) => {
  test.setTimeout(60_000);
  await scriptedConversation(page);
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  await page.evaluate(() => { (window as any).samePageMarker = 'preserve-me'; });
  const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(nav.getByRole('link')).toHaveCount(4);
  for (const [name, hash] of [['Talk with Ruru', '#demo'], ['How it works', '#how-lulu-works'], ['Film', '#launch-film'], ['Presentation', '#presentation']]) {
    const link = nav.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', hash); await link.click();
    await expect.poll(() => new URL(page.url()).hash).toBe(hash);
    expect(await page.evaluate(() => (window as any).samePageMarker)).toBe('preserve-me');
    expect(new URL(page.url()).pathname).toBe('/');
  }
  const lastSection = await page.locator('main > section').last().getAttribute('id');
  expect(lastSection).toBe('presentation');
  const frameElement = page.locator('iframe[title="RoamingRuru presentation"]');
  await expect(frameElement).toHaveAttribute('srcdoc', /RoamingRuru/);
  const frame = page.frameLocator('iframe[title="RoamingRuru presentation"]');
  await expect(frame.locator('.progress')).toHaveText('01 / 04');
  await expect(frame.getByRole('button', { name: 'Previous slide', exact: true })).toBeDisabled();
  await frame.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expect(frame.locator('.progress')).toHaveText('02 / 04');
  await page.keyboard.press('ArrowRight'); await expect(frame.locator('.progress')).toHaveText('03 / 04');
  await page.keyboard.press('End'); await expect(frame.locator('.progress')).toHaveText('04 / 04');
  await expect(frame.getByRole('button', { name: 'Next slide', exact: true })).toBeDisabled();
  await page.keyboard.press('Home'); await expect(frame.locator('.progress')).toHaveText('01 / 04');
  await frame.getByRole('button', { name: 'Present fullscreen', exact: true }).click();
  await expect.poll(() => frame.locator('html').evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await frame.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect.poll(() => frame.locator('html').evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  expect(await frame.locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await frame.getByRole('button', { name: '4 of 4: The demo', exact: true }).click();
  const returnLink = frame.getByRole('link', { name: 'Talk with Ruru →', exact: true });
  await expect(returnLink).toHaveAttribute('target', '_top');
  await returnLink.click();
  await expect.poll(() => new URL(page.url()).hash).toBe('#demo');
  expect(await page.evaluate(() => (window as any).samePageMarker)).toBe('preserve-me');
  await nav.scrollIntoViewIfNeeded(); await page.screenshot({ path: `.local/inline-presentation-header-${width}.png` });
});

test('legacy presentation URL redirects to the embedded section', async ({ page }) => {
  await scriptedConversation(page); await page.goto('/intro.html');
  await expect(page).toHaveURL(/\/#presentation$/);
  await expect(page.locator('iframe[title="RoamingRuru presentation"]')).toBeVisible();
});
