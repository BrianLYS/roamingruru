import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
const sourceUrls = {
  events: 'https://www.westfield.com/en/united-states/valleyfair/events',
  stores: 'https://www.westfield.com/en/united-states/valleyfair/retailers',
} as const;
// Fixed official sources only. Imported content stays unapproved; it cannot issue an offer.
export const importOfficialPage = internalAction({
  args: { source: v.union(v.literal('events'), v.literal('stores')) }, returns: v.id('sources'),
  handler: async (ctx, { source }): Promise<Id<'sources'>> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error('Dedicated roaminglulu Firecrawl access is not ready');
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrls[source], formats: ['markdown'], onlyMainContent: true }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Source import failed (${response.status})`);
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('data' in result) || !result.data || typeof result.data !== 'object' || !('markdown' in result.data) || typeof result.data.markdown !== 'string') throw new Error('Source import returned no usable content');
    return ctx.runMutation(internal.catalogue.recordSource, { url: sourceUrls[source], markdown: result.data.markdown });
  },
});
