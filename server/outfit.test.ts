// @vitest-environment node
import { expect, test, vi } from 'vitest';
import sharp from 'sharp';
import { createOutfitService, officialProductUrl, sanitizeFrame } from './outfit';
import { protectEmail, validateProfile } from './memory';
const choices = { garment: 'top', color: 'blue', style: 'active', interest: 'yoga' };
test('images are decoded with bounds, resized and stripped of metadata', async () => {
  const image = await sharp({ create: { width: 1500, height: 100, channels: 3, background: '#123456' } }).withMetadata().png().toBuffer();
  const output = await sanitizeFrame(`data:image/png;base64,${image.toString('base64')}`);
  const metadata = await sharp(Buffer.from(output.split(',')[1], 'base64')).metadata();
  expect(metadata.width).toBe(1024); expect(metadata.format).toBe('jpeg'); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
  await expect(sanitizeFrame(`data:image/jpeg;base64,${image.toString('base64')}`)).rejects.toThrow();
  await expect(sanitizeFrame('data:image/png;base64,not-an-image')).rejects.toThrow();
  const large = await sharp({ create: { width: 4000, height: 4000, channels: 3, background: 'white' } }).png().toBuffer();
  await expect(sanitizeFrame(`data:image/png;base64,${large.toString('base64')}`)).rejects.toThrow();
});
test('missing providers make no calls; search sends only clothing categories and filters public results', async () => {
  const mock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { web: [
    { title: 'Official example', url: 'https://shop.lululemon.com/p/example', description: 'Synthetic result' },
    { title: 'Untrusted', url: 'https://other.invalid/product' },
  ] } }), { status: 200 }));
  const missing = createOutfitService({}, mock);
  expect((await missing('/analyse', { consent: true, image: 'bad' })).status).toBe(503);
  expect((await missing('/suggest', choices)).status).toBe(503); expect(mock).not.toHaveBeenCalled();
  const service = createOutfitService({ FIRECRAWL_API_KEY: 'synthetic-test-only' }, mock);
  expect((await service('/suggest', { ...choices, email: 'qa@example.invalid' })).status).toBe(400);
  const result = await service('/suggest', choices);
  expect(result).toMatchObject({ status: 200, items: [{ title: 'Official example' }] });
  const body = JSON.parse(String((mock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
  expect(body.query).toBe('site:shop.lululemon.com top blue active yoga shop');
  await service('/suggest', choices); expect(mock).toHaveBeenCalledTimes(1);
  expect(officialProductUrl('https://www.lululemon.com.hk.evil.invalid/en-sg/x')).toBe(false);
  expect(officialProductUrl('https://user@www.lululemon.com.hk/en-sg/x')).toBe(false);
});
test('contact storage encrypts normalized address with randomized ciphertext and a stable keyed digest', () => {
  const a = protectEmail(' QA@example.invalid ', 'synthetic-key'); const b = protectEmail('qa@example.invalid', 'synthetic-key');
  expect(a).toBeTruthy(); expect(b).toBeTruthy();
  expect(a!.emailCiphertext).not.toBe(b!.emailCiphertext); expect(a!.emailDigest).toBe(b!.emailDigest);
  expect(JSON.stringify(a)).not.toContain('qa@example.invalid'); expect(a!.keyVersion).toBe(1);
  expect(protectEmail('not an email', 'synthetic-key')).toBeNull();
  expect(validateProfile({ name: 'QA', ...choices })).toBe(true);
  expect(validateProfile({ name: 'visitor@example.com', ...choices })).toBe(false);
  expect(validateProfile({ name: 'QA', ...choices, image: 'anything' })).toBe(false);
});
test('vision sends a sanitized frame without storing it and accepts only clothing categories', async () => {
  const frame = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'blue' } }).png().toBuffer();
  const mock = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify({ id: 'synthetic-response', object: 'response', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ garment: 'top', color: 'blue', style: 'active' }), annotations: [] }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const service = createOutfitService({ OPENAI_API_KEY: 'synthetic-test-only', OPENAI_MODEL: 'synthetic-model' }, mock as typeof fetch);
  const input = { consent: true, image: `data:image/png;base64,${frame.toString('base64')}` };
  expect((await service('/analyse', { ...input, name: 'Disallowed' })).status).toBe(400);
  expect(mock).not.toHaveBeenCalled();
  expect(await service('/analyse', input)).toEqual({ status: 200, garment: 'top', color: 'blue', style: 'active' });
  const sent = JSON.parse(String(mock.mock.calls[0][1]?.body));
  expect(sent.store).toBe(false); expect(sent.input[0].content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.text.format.schema.additionalProperties).toBe(false);
  await service('/analyse', input); expect(mock).toHaveBeenCalledTimes(2);
});
