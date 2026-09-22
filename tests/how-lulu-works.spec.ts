import { expect, test } from '@playwright/test';
import { scriptedConversation } from './scriptedConversation';
import { DURATION, opening, lines, technical } from '../tools/launch-film/timeline.mjs';

const sourceUrl = 'https://www.placer.ai/anchor/articles/placer-ai-august-2026-mall-index-open-air-leads-as-indoor-malls-see-their-best-yoy-growth-of-2026';
const toolNames = ['look_at_person', 'recognize_person', 'remember_person', 'find_in_mall', 'go_to_store', 'show_mailing_qr', 'show_face', 'forget_person'];
for (const width of [1440, 390]) {
  test(`explainer works with keyboard at ${width}px without tool or camera side effects`, async ({ page }) => {
    await scriptedConversation(page);
    await page.addInitScript(() => {
      (window as any).explainerCameraCalls = 0;
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { (window as any).explainerCameraCalls++; throw new Error('Unexpected explainer camera request'); } } });
    });
    const writes: string[] = [];
    page.on('request', request => { if (request.url().includes('/api/lulu/') && request.method() !== 'GET') writes.push(request.url()); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const section = page.getByRole('region', { name: 'How Ruru works', exact: true });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    expect(await page.evaluate(() => {
      const demo = document.querySelector('#demo')!;
      const how = document.querySelector('#how-lulu-works')!;
      const film = document.querySelector('#launch-film')!;
      return Boolean(demo.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(how.compareDocumentPosition(film) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    await expect(section.getByRole('button', { name: 'Screen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const [label, title] of [['Camera', 'She notices who’s in front of her.'], ['Base', 'She can show you the way.'], ['Screen', 'A face you can talk to.']]) {
      const button = section.getByRole('button', { name: label, exact: true });
      await button.focus(); await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(section.getByRole('heading', { name: title, exact: true })).toBeVisible();
      expect(await section.locator('.lulu-part-button[aria-pressed="true"]').count()).toBe(1);
      if (label === 'Base') await expect(section.getByText('Base · Simulation', { exact: true })).toBeVisible();
    }
    const disclosure = section.locator('.lulu-under-hood > summary');
    await disclosure.focus(); await page.keyboard.press('Space');
    await expect(section.locator('.lulu-under-hood')).toHaveAttribute('open', '');
    await expect(section.locator('.lulu-tool')).toHaveCount(8);
    for (const name of toolNames) {
      const tool = section.locator('.lulu-tool').filter({ has: page.locator('code', { hasText: name }) });
      const summary = tool.locator('summary'); await summary.focus(); await page.keyboard.press('Enter');
      await expect(tool.locator('p')).toBeVisible();
    }
    await expect(section.getByLabel('Ruru’s integrations').locator('strong')).toHaveCount(6);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => (window as any).explainerCameraCalls)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.local/how-lulu-qa/explainer-${width}.png`, fullPage: true });
  });
}

for (const width of [1440, 390]) test(`film shows exact sourced statement and plays current film cut at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await scriptedConversation(page); await page.goto('/#launch-film');
  const study = page.locator('.film-study');
  await expect(study).toContainText('Indoor mall visits rose 5% year over year in August 2026.');
  const link = study.getByRole('link', { name: /Placer.ai, August 2026 Mall Index/ });
  await expect(link).toHaveAttribute('href', sourceUrl);
  await expect(link).toHaveAttribute('target', '_blank');
  const video = page.getByLabel('RoamingRuru launch film', { exact: true });
  await video.scrollIntoViewIfNeeded();
  await video.evaluate((v: HTMLVideoElement) => { v.muted = true; v.load(); });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.duration)).toBeCloseTo(DURATION + 24, 1); // Approved intro (3s), recorded Talk interaction (16s) and unsubmitted signup form (5s).
  await video.evaluate(async (v: HTMLVideoElement) => { await v.play(); });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(.3);
  await video.evaluate((v: HTMLVideoElement) => { v.pause(); v.currentTime = 3; v.textTracks[0].mode = 'hidden'; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0].cues?.length)).toBe(opening.length + lines.length + technical.length);
  expect(await video.evaluate((v: HTMLVideoElement) => {
    const cue = v.textTracks[0].cues![0] as VTTCue;
    return { text: cue.text, start: cue.startTime, end: cue.endTime, error: v.error };
  })).toEqual({ text: 'Indoor mall visits rose 5% year over year in August 2026.\nSource: Placer.ai, August 2026 Mall Index', start: 0, end: 6, error: null });
  expect(await video.evaluate((v: HTMLVideoElement) => v.textTracks[0].cues![4].startTime)).toBe(22);
});
