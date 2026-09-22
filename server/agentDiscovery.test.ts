// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createAgentDiscovery, officialSource } from './agentDiscovery';
it('restricts source host/path and rejects personal/contact query shapes before a request', async () => {
  for (const value of ['https://www.lululemon.com.hk.evil/en-sg/p/x', 'https://www.lululemon.com.hk@evil/en-sg/p/x', 'https://www.lululemon.com.hk/en-hk/p/x', 'http://www.lululemon.com.hk/en-sg/p/x']) expect(officialSource(value)).toBe(false);
  const request = vi.fn(); const search = createAgentDiscovery({ FIRECRAWL_API_KEY: 'synthetic' }, request);
  for (const query of ['visitor@example.com', 'site:evil.example clothing', 'call 1234567890', 'https://private.example']) expect(await search(query, 'any')).toHaveProperty('error');
  expect(request).not.toHaveBeenCalled();
});
it('excludes former Singapore editorial pages from US products and caches repeat queries', async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { web: [
    { title: 'Yoga article', url: 'https://www.lululemon.com.hk/en-sg/content/yoga' },
    { title: 'Leggings', url: 'https://shop.lululemon.com/p/leggings' },
    { title: 'Duplicate', url: 'https://shop.lululemon.com/p/leggings' },
  ] } }))) as unknown as typeof fetch;
  const search = createAgentDiscovery({ FIRECRAWL_API_KEY: 'synthetic' }, request);
  expect((await search('yoga leggings', 'product')).items.map(item => item.kind)).toEqual(['product']);
  await search('yoga leggings', 'product'); expect(request).toHaveBeenCalledTimes(1);
});
it('restricts event/store searches to Valley Fair and keeps product links out of local results', async () => {
  const payloads: any[] = [];
  const request = vi.fn(async (_url, options) => {
    payloads.push(JSON.parse(options!.body as string));
    return new Response(JSON.stringify({ success: true, data: { web: [
      { title: 'Valley Fair event', url: 'https://www.westfield.com/en/united-states/valleyfair/events/yoga/1' },
      { title: 'Other mall', url: 'https://www.westfield.com/en/united-states/centurycity/events/yoga/1' },
      { title: 'Valley Fair lululemon', url: 'https://www.westfield.com/en/united-states/valleyfair/retailers/lululemon/75610' },
      { title: 'US leggings', url: 'https://shop.lululemon.com/p/leggings' },
    ] } }));
  }) as unknown as typeof fetch;
  const search = createAgentDiscovery({ FIRECRAWL_API_KEY: 'synthetic' }, request);
  expect((await search('yoga', 'event')).items.map(item => item.kind)).toEqual(['event']);
  expect((await search('lululemon', 'store')).items.map(item => item.kind)).toEqual(['store']);
  expect(payloads[0].query).toBe('site:www.westfield.com/en/united-states/valleyfair/events yoga');
  expect(payloads[1].query).toBe('site:www.westfield.com/en/united-states/valleyfair/retailers lululemon');
});
