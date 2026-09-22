import { scriptedConversation } from './scriptedConversation';
import { expect, test } from '@playwright/test';

test('speech failure keeps the reply readable without browser voice fallback', async ({ page }) => {
  await page.addInitScript(() => { window.speechSynthesis.speak = () => { throw Error('Browser voice must not run'); }; });
  await page.route('**/api/lulu/voice', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Ruru’s new voice isn’t connected yet. You can still read her reply.' }) }));
  await page.goto('/');
  await page.getByLabel('Type a message to Ruru').fill('I love yoga');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.notice')).toContainText('isn’t connected yet');
  await expect(page.getByRole('heading', { name: /Yoga, nice/ })).toBeVisible();
});

test('provider audio drives the speaking face and mute stops playback', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).stoppedAudio = 0;
    (window as any).Audio = class {
      onended = null; onerror = null;
      play() { return Promise.resolve(); }
      pause() { (window as any).stoppedAudio++; }
      removeAttribute() {} load() {}
    };
    window.speechSynthesis.speak = () => { throw Error('Browser voice must not run'); };
  });
  await page.route('**/api/lulu/voice', route => route.fulfill({ contentType: 'audio/mpeg', body: Buffer.from([1, 2, 3]) }));
  await page.goto('/');
  await page.getByLabel('Type a message to Ruru').fill('I love yoga');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.face-monitor .screen-face')).toHaveAttribute('data-expression', 'speaking');
  await page.getByRole('button', { name: 'Mute Ruru', exact: true }).click();
  expect(await page.evaluate(() => (window as any).stoppedAudio)).toBe(1);
  await expect(page.locator('.face-monitor .screen-face')).not.toHaveAttribute('data-expression', 'speaking');
});

// Keep provider-independent regressions isolated when local credentials are present.
test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
