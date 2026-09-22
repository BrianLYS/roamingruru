import { describe, expect, test } from 'vitest';
import { parseShortlist, parseShortlistCapabilities, parseShortlistEmailOutcome, parseShortlistResponse } from './Shortlist';

describe('shortlist response boundaries', () => {
  test('accepts explicit boolean capabilities and rejects ambiguous responses', () => {
    expect(parseShortlistCapabilities({ capabilities: { search: true, email: false, shortlistEmail: true, vision: true } })).toEqual({ search: true, email: false, shortlistEmail: true });
    expect(parseShortlistCapabilities({ capabilities: { search: true, email: false } })).toEqual({ search: true, email: false, shortlistEmail: false });
    expect(() => parseShortlistCapabilities({ capabilities: { search: 'yes', email: false } })).toThrow(/confirm/);
  });

  test('keeps at most two unique official US results with real snippets', () => {
    const valid = (slug: string) => ({ title: `Idea ${slug}`, url: `https://shop.lululemon.com/p/${slug}`, description: `Official description ${slug}` });
    expect(parseShortlist({ items: [
      valid('one'),
      valid('one'),
      { ...valid('lookalike'), url: 'https://www.lululemon.com.hk.evil.invalid/en-sg/lookalike' },
      { ...valid('regional'), url: 'https://www.lululemon.com.hk/en-hk/regional' },
      { ...valid('empty'), description: '' },
      valid('two'),
      valid('three'),
    ] })).toEqual([valid('one'), valid('two')]);
  });

  test('keeps only a bounded signed receipt and strict email outcomes', () => {
    const item = { title: 'Idea one', url: 'https://shop.lululemon.com/p/one', description: 'Official description one' };
    const payload = btoa(JSON.stringify({ items: [{ title: item.title, url: item.url }], expiresAt: Date.now() + 60_000 })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const receipt = `${payload}.${'a'.repeat(64)}`;
    expect(parseShortlistResponse({ items: [item], receipt })).toEqual({ items: [item], receipt });
    expect(parseShortlistResponse({ items: [item], receipt: null })).toEqual({ items: [item], receipt: null });
    expect(parseShortlistResponse({ items: [item], receipt: 'unsigned' }).receipt).toBeNull();
    expect(parseShortlistResponse({ items: [{ ...item, title: 'A different result' }], receipt }).receipt).toBeNull();
    for (const outcome of [null, 'pending', 'sent', 'unknown', 'rejected'] as const) {
      expect(parseShortlistEmailOutcome({ outcome })).toBe(outcome);
    }
    expect(() => parseShortlistEmailOutcome({ outcome: 'delivered' })).toThrow(/status/);
  });
});
test('renders Valley Fair store/event sources and rejects another mall', () => {
  const event = { title: 'Valley Fair events', url: 'https://www.westfield.com/en/united-states/valleyfair/events', description: 'Check current dates at the source.', kind: 'event' };
  const store = { title: 'lululemon at Valley Fair', url: 'https://www.westfield.com/en/united-states/valleyfair/retailers/lululemon/75610', description: 'Official local retailer page.', kind: 'store' };
  expect(parseShortlist({ items: [{ ...event, url: 'https://www.westfield.com/en/united-states/centurycity/events' }, event, store] })).toEqual([event, store]);
});
