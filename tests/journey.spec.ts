import { expect, test } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';

// The fixed-interest checkbox, fictional pass, and coupled global-Forget journey
// were superseded by agent-spec-qa.spec.ts and face-memory.spec.ts.

test('mobile layout fits and unavailable microphone keeps typing usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to talk with Ruru' }).click();
  await expect(page.locator('.notice')).toContainText('Voice input isn’t available');
  await expect(page.getByLabel('Type a message to Ruru')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('voice transcript uses the conversation path and microphone denial leaves typing available', async ({ page }) => {
  await page.addInitScript(() => {
    class MockRecognition {
      lang = ''; interimResults = false; continuous = false;
      onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: 'I love running' }]] }); this.onend?.(); }, 10); }
      abort() { this.onend?.(); }
      stop() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: MockRecognition, configurable: true });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mute Ruru', exact: true }).click();
  await page.getByRole('button', { name: 'Tap to talk with Ruru' }).click();
  await expect(page.getByRole('heading', { name: /Valley Fair’s events page/ })).toBeVisible();
  await page.evaluate(() => {
    class DeniedRecognition {
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() { this.onerror?.({ error: 'not-allowed' }); this.onend?.(); }
      abort() {}
      stop() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: DeniedRecognition, configurable: true });
  });
  await page.getByRole('button', { name: 'Tap to talk with Ruru' }).click();
  await expect(page.locator('.notice')).toContainText('Microphone access was declined');
  await expect(page.getByLabel('Type a message to Ruru')).toBeEnabled();
});

test.beforeEach(async ({ page }) => { await scriptedConversation(page); });
