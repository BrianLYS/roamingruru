import { expect, test } from 'vitest';
import { replyTo } from './discovery';
test('a general greeting or arbitrary message is not consent to infer a remembered interest', () => {
  expect(replyTo('hello').interest).toBeUndefined();
  expect(replyTo('What time is it?').interest).toBeUndefined();
  expect(replyTo('I enjoy exploring').interest).toBe('exploring');
  expect(replyTo('I love yoga').interest).toBe('yoga');
});
