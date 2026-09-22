// @vitest-environment node
import { expect, test } from 'vitest';
import { readShortlist, signShortlist } from './shortlistReceipt';
test('email shortlist is bound to exact server results and expires', () => {
  const items = [{ title: 'Synthetic official item', url: 'https://shop.lululemon.com/p/example' }];
  const signed = signShortlist(items, 'synthetic-secret', 1000)!;
  expect(readShortlist(signed, 'synthetic-secret', 1001)).toEqual(items);
  expect(readShortlist(signed, 'another-secret', 1001)).toBeNull();
  const [data, signature] = signed.split('.');
  const modified = JSON.parse(Buffer.from(data, 'base64url').toString()); modified.items[0].title = 'unapproved';
  expect(readShortlist(`${Buffer.from(JSON.stringify(modified)).toString('base64url')}.${signature}`, 'synthetic-secret', 1001)).toBeNull();
  expect(readShortlist(signed, 'synthetic-secret', 901000)).toBeNull();
});
test('receipts allow Valley Fair links but never sign retired regional or other-mall sources', () => {
  const local = [{ title: 'Valley Fair stores', url: 'https://www.westfield.com/en/united-states/valleyfair/retailers' }];
  expect(readShortlist(signShortlist(local, 'secret', 1000), 'secret', 1001)).toEqual(local);
  expect(signShortlist([{ title: 'Old region', url: 'https://www.lululemon.com.hk/en-sg/p/item' }], 'secret')).toBeNull();
  expect(signShortlist([{ title: 'Wrong mall', url: 'https://www.westfield.com/en/united-states/centurycity/events' }], 'secret')).toBeNull();
});
