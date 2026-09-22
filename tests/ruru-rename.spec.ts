import { test, expect, type Page } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

const oldName = /\blulu\b|roaminglulu/i;
async function audit(page: Page) {
  expect(await page.locator('body').innerText()).not.toMatch(oldName);
  const labels = await page.locator('[aria-label], [alt], [title]').evaluateAll(nodes => nodes.map(node => ['aria-label', 'alt', 'title'].map(name => node.getAttribute(name) ?? '').join(' ')).join('\n'));
  expect(labels).not.toMatch(oldName);
  expect(await page.title()).not.toMatch(oldName);
}
for (const width of [1440, 390]) test(`Ruru brand, conversation, canvas, signup and deck at ${width}px`, async ({ page }) => {
  test.setTimeout(60_000);
  await scriptedConversation(page);
  await page.addInitScript(() => {
    (window as any).renderedLabels = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text: string, ...args: any[]) {
      const labels = (window as any).renderedLabels as string[];
      if (!labels.includes(text)) labels.push(text);
      return (fillText as any).call(this, text, ...args);
    };
  });
  const paths: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/')) paths.push(new URL(r.url()).pathname); });
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  await expect(page.locator('.wordmark')).toContainText(/roamingruru/i);
  await expect(page.getByRole('heading', { name: 'Talk with Ruru', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How Ruru works', exact: true })).toBeAttached();
  await expect(page.getByTestId('mall-world')).toHaveAttribute('data-rendered', 'true');
  const labels: string[] = await page.evaluate(() => (window as any).renderedLabels);
  expect(labels.join('\n')).not.toMatch(oldName);
  expect(labels).toContain('ruru'); expect(labels).toContain('lululemon');
  await page.locator('.lulu-under-hood > summary').click();
  await page.locator('.lulu-tool summary').first().click();
  await audit(page);
  await page.getByLabel('Type a message to Ruru').fill('hello');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => paths.includes('/api/lulu/conversation')).toBe(true);
  await expect(page.locator('.story-caption h2')).toContainText('Ruru');
  await page.getByRole('button', { name: 'Face only', exact: true }).click();
  await expect(page.getByRole('img', { name: /Ruru’s screen face:/ })).toBeVisible();
  await audit(page);
  expect(paths.every(path => path.startsWith('/api/lulu/'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/?signup=1');
  await expect(page.getByRole('heading', { name: 'Join Ruru’s list', exact: true })).toBeVisible();
  await expect(page.locator('.wordmark')).toContainText(/roamingruru/i);
  await audit(page);
  await page.goto('/intro.html');
  for (let i = 0; i < 4; i++) {
    await audit(page);
    if (i === 2) await expect(page.locator('.slide:not([hidden])')).toContainText('lululemon');
    if (i < 3) await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  }
  await expect(page.getByRole('link', { name: 'Talk with Ruru →', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('film captions rename the character while preserving retailer and existing asset URL', async ({ request }) => {
  const response = await request.get('/media/roaminglulu-launch.vtt');
  expect(response.ok()).toBe(true);
  const captions = await response.text();
  expect(captions).not.toMatch(/\blulu\b|roaminglulu|rurulemon/i);
  expect(captions).toContain('Good looking out, Ruru!');
  expect(captions).toContain('Lululemon’s having an event today.');
  expect(captions).toContain('Ruru: Hello!');
});
