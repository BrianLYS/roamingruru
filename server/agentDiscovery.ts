import { officialSource, officialSearchQuery, sourceKind } from '../src/sourcePolicy.ts';
export { officialSource } from '../src/sourcePolicy.ts';
export type Discovery = { title: string; url: string; description: string; kind: 'product' | 'event' | 'editorial' | 'category' | 'store'; checkedAt: string };
export function createAgentDiscovery(env: Record<string, string>, request: typeof fetch) {
  const cache = new Map<string, { expires: number; items: Discovery[] }>();
  return async (query: string, kind: 'product' | 'event' | 'store' | 'any', signal?: AbortSignal): Promise<{ items: Discovery[]; error?: string }> => {
    if (!env.FIRECRAWL_API_KEY) return { items: [], error: 'Official search is not connected.' };
    // Search receives product/activity language only, never visitor context or contact fields.
    if (!query.trim() || query.length > 180 || /[@\n\r]|https?:|site:|\b\d{6,}\b/i.test(query)) return { items: [], error: 'Use a short product, activity or event query without personal details.' };
    const safeQuery = query.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
    const key = `${kind}:${safeQuery.toLowerCase()}`;
    const hit = cache.get(key); if (hit && hit.expires > Date.now()) return { items: hit.items };
    try {
      const response = await request('https://api.firecrawl.dev/v2/search', { method: 'POST', headers: { Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: officialSearchQuery(safeQuery, kind), limit: 5, sources: ['web'] }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Search unavailable');
      const body = await response.text(); if (body.length > 100000) throw new Error('Search too large');
      const data = JSON.parse(body); if (data.success !== true || !Array.isArray(data.data?.web)) throw new Error('Invalid search');
      const checkedAt = new Date().toISOString(); const seen = new Set<string>(); const items: Discovery[] = [];
      for (const value of data.data.web) {
        if (!officialSource(value.url) || typeof value.title !== 'string' || !value.title.trim() || seen.has(value.url)) continue;
        const pageKind = sourceKind(value.url)!;
        if (kind === 'product' && !['product', 'category'].includes(pageKind) || kind === 'event' && pageKind !== 'event' || kind === 'store' && pageKind !== 'store') continue;
        seen.add(value.url);
        items.push({ title: value.title.slice(0, 160), url: value.url, description: typeof value.description === 'string' ? value.description.slice(0, 280) : '', kind: pageKind, checkedAt });
      }
      // A search result is not stock or event verification. Keep page types visible.
      items.sort((a, b) => Number(b.kind === kind) - Number(a.kind === kind));
      const result = items.slice(0, 3); if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 300000, items: result }); return { items: result };
    } catch { if (signal?.aborted) throw signal.reason; return { items: [], error: 'Official search is unavailable. Do not invent a result.' }; }
  };
}
