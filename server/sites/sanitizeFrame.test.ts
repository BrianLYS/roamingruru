import { expect, test } from 'vitest';
import jpeg from 'jpeg-js';
import { sanitizeFrame } from './sanitizeFrame.ts';

function jpegData(width: number, height: number) {
  const data = Buffer.alloc(width * height * 4, 255);
  return Buffer.from(jpeg.encode({ width, height, data }, 70).data);
}

test('worker sanitizer decodes and re-encodes without JPEG metadata', async () => {
  const source = jpegData(2, 2);
  const marker = Buffer.from('synthetic-private-metadata');
  const comment = Buffer.concat([Buffer.from([0xff, 0xfe, 0, marker.length + 2]), marker]);
  const withMetadata = Buffer.concat([source.subarray(0, 2), comment, source.subarray(2)]);
  const output = await sanitizeFrame(`data:image/jpeg;base64,${withMetadata.toString('base64')}`);
  const bytes = Buffer.from(output.split(',')[1], 'base64');
  expect(bytes.includes(marker)).toBe(false);
  expect(jpeg.decode(bytes, { useTArray: true })).toMatchObject({ width: 2, height: 2 });
});

test('worker sanitizer rejects oversized pixel counts and non-normalized uploads', async () => {
  const oversized = jpegData(1500, 1500);
  await expect(sanitizeFrame(`data:image/jpeg;base64,${oversized.toString('base64')}`)).rejects.toThrow();
  await expect(sanitizeFrame('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).rejects.toThrow();
});
