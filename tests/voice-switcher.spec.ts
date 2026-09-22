import { test, expect, type Page } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

async function setup(page: Page) {
  await scriptedConversation(page);
  await page.addInitScript(() => {
    const state = { plays: 0, pauses: 0, voiceAborts: 0, conversationAborts: 0 };
    (window as any).voiceSwitcherQa = state;
    const realFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = String(input);
      if (url === '/api/lulu/voice') init?.signal?.addEventListener('abort', () => state.voiceAborts++);
      if (url === '/api/lulu/conversation') init?.signal?.addEventListener('abort', () => state.conversationAborts++);
      return realFetch(input, init);
    };
    (window as any).Audio = class {
      onended: any; onerror: any;
      constructor(public src: string) {}
      play() { state.plays++; return Promise.resolve(); }
      pause() { state.pauses++; }
      removeAttribute() { this.src = ''; }
      load() {}
    };
  });
}

test('default animated voice, previous voice replay and switching stop playback without changing text', async ({ page }) => {
  await setup(page);
  const payloads: any[] = [];
  await page.route('**/api/lulu/voice', route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'audio/mpeg', body: Buffer.from('synthetic audio; playback mocked') });
  });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByText('Voice & options', { exact: true }).click();
  const select = page.getByLabel('Ruru voice', { exact: true });
  await expect(select).toHaveValue('animated');
  const caption = await page.locator('.story-caption h2').innerText();
  const input = page.getByLabel('Type a message to Ruru'); await input.fill('Keep this draft');
  expect(payloads).toEqual([]);
  await page.getByRole('button', { name: 'Read this line aloud', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).voiceSwitcherQa.plays)).toBe(1);
  expect(payloads[0]).toEqual({ text: caption, voice: 'animated' });
  await select.selectOption('classic');
  await expect.poll(() => page.evaluate(() => (window as any).voiceSwitcherQa.pauses)).toBe(1);
  await expect(input).toHaveValue('Keep this draft');
  await expect(page.locator('.story-caption h2')).toHaveText(caption);
  expect(payloads).toHaveLength(1);
  await page.getByRole('button', { name: 'Read this line aloud', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).voiceSwitcherQa.plays)).toBe(2);
  expect(payloads[1]).toEqual({ text: caption, voice: 'classic' });
  await select.selectOption('animated');
  await expect.poll(() => page.evaluate(() => (window as any).voiceSwitcherQa.pauses)).toBe(2);
  expect(payloads).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await select.scrollIntoViewIfNeeded(); await page.screenshot({ path: '.local/voice-switcher-mobile.png' });
});

test('switch aborts pending speech and conversation without auto-generating or replacing the visible reply', async ({ page }) => {
  await setup(page);
  let speechRequests = 0, conversationRequests = 0;
  await page.route('**/api/lulu/voice', () => { speechRequests++; });
  await page.route('**/api/lulu/conversation', () => { conversationRequests++; });
  await page.goto('/');
  await page.getByText('Voice & options', { exact: true }).click();
  const select = page.getByLabel('Ruru voice', { exact: true });
  const caption = await page.locator('.story-caption h2').innerText();
  await page.getByRole('button', { name: 'Read this line aloud', exact: true }).click();
  await expect.poll(() => speechRequests).toBe(1);
  await select.selectOption('classic');
  await expect.poll(() => page.evaluate(() => (window as any).voiceSwitcherQa.voiceAborts)).toBe(1);
  await expect(page.locator('.story-caption h2')).toHaveText(caption);
  expect(speechRequests).toBe(1);
  await page.getByLabel('Type a message to Ruru').fill('A pending conversation');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => conversationRequests).toBe(1);
  await select.selectOption('animated');
  await expect.poll(() => page.evaluate(() => (window as any).voiceSwitcherQa.conversationAborts)).toBe(1);
  await expect(page.locator('.story-caption h2')).toHaveText(caption);
  expect(speechRequests).toBe(1); expect(conversationRequests).toBe(1);
  expect(await page.evaluate(() => (window as any).voiceSwitcherQa.plays)).toBe(0);
});
