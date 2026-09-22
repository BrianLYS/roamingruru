// @vitest-environment node
import { expect, it } from 'vitest';
import { signClothingContext, verifyClothingContext } from './clothingContext';
it('accepts only untampered, recent server clothing with no extra identity fields', () => {
  const clothing = { garment: 'top', color: 'blue', style: 'casual' };
  const token = signClothingContext(clothing, 'secret', 1700000000000)!;
  expect(verifyClothingContext(token, 'secret', 1700000000001)).toEqual(clothing);
  expect(verifyClothingContext(token, 'other', 1700000000001)).toBeNull();
  expect(verifyClothingContext(token, 'secret', 1700000600000)).toBeNull();
  expect(verifyClothingContext(`x${token}`, 'secret', 1700000000001)).toBeNull();
  expect(signClothingContext({ ...clothing, name: 'private' } as any, 'secret')).toBeUndefined();
});
