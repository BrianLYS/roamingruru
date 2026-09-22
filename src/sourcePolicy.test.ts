import { expect, test } from 'vitest';
import { officialSource, officialProductSource, officialSearchQuery, sourceKind } from './sourcePolicy';
test('accepts only official US products/categories and this mall stores/events', () => {
  expect(sourceKind('https://shop.lululemon.com/p/womens-leggings/Align/_/prod1?color=1')).toBe('product');
  expect(sourceKind('https://shop.lululemon.com/c/women')).toBe('category');
  expect(sourceKind('https://www.westfield.com/en/united-states/valleyfair/retailers/lululemon/75610')).toBe('store');
  expect(sourceKind('https://www.westfield.com/en/united-states/valleyfair/events')).toBe('event');
  expect(officialProductSource('https://www.westfield.com/en/united-states/valleyfair/events')).toBe(false);
  for (const url of [
    'https://www.lululemon.com.hk/en-sg/p/example',
    'https://www.westfield.com/en/united-states/centurycity/events',
    'https://www.westfield.com/en/united-states/valleyfair-extra/events',
    'https://www.westfield.com/en/united-states/valleyfair/services',
    'https://www.westfield.com/en/united-states/valleyfair/events/../../../centurycity/events',
    'https://www.westfield.com/en/united-states/valleyfair/events/%2e%2e/retailers',
    'https://shop.lululemon.com.evil.example/p/x',
    'https://user@shop.lululemon.com/p/x',
    'https://shop.lululemon.com:444/p/x',
    'https://shop.lululemon.com/p/x#private',
    'https://shop.lululemon.com/p/x\\elsewhere',
    'https://shop.lululemon.com/p/x\n',
    'http://shop.lululemon.com/p/x',
    'https://shop.lululemon.com/account',
  ]) expect(officialSource(url), url).toBe(false);
});
test('separates product queries from local store and event queries', () => {
  expect(officialSearchQuery('leggings', 'product')).toBe('site:shop.lululemon.com leggings shop');
  expect(officialSearchQuery('yoga', 'event')).toBe('site:www.westfield.com/en/united-states/valleyfair/events yoga');
  expect(officialSearchQuery('lululemon', 'store')).toBe('site:www.westfield.com/en/united-states/valleyfair/retailers lululemon');
  expect(officialSearchQuery('activewear', 'any')).not.toContain('Singapore');
});
