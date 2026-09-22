/** Shared browser/server policy for this Valley Fair demo; no arbitrary external links. */
export const valleyFairBase = 'https://www.westfield.com/en/united-states/valleyfair';
export const officialSources = { stores: `${valleyFairBase}/retailers`, events: `${valleyFairBase}/events` };
export const officialStore = 'https://shop.lululemon.com/';
export type SourceKind = 'product' | 'category' | 'store' | 'event';
export function sourceKind(value: unknown): SourceKind | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\s\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.toString() !== value || /%2f|%5c|%2e/i.test(url.pathname)) return null;
    if (url.hostname === 'shop.lululemon.com') {
      if (url.pathname.startsWith('/p/')) return 'product';
      if (url.pathname.startsWith('/c/')) return 'category';
      return null;
    }
    if (url.hostname !== 'www.westfield.com') return null;
    const path = url.pathname;
    if (/^\/en\/united-states\/valleyfair\/retailers(?:\/|$)/.test(path)) return 'store';
    if (/^\/en\/united-states\/valleyfair\/events(?:\/|$)/.test(path)) return 'event';
    return null;
  } catch { return null; }
}
export function officialSource(value: unknown): value is string { return sourceKind(value) !== null; }
export function officialProductSource(value: unknown): value is string { const kind = sourceKind(value); return kind === 'product' || kind === 'category'; }
export function officialSearchQuery(query: string, kind: 'product' | 'event' | 'store' | 'any'): string {
  if (kind === 'event') return `site:www.westfield.com/en/united-states/valleyfair/events ${query}`;
  if (kind === 'store') return `site:www.westfield.com/en/united-states/valleyfair/retailers ${query}`;
  if (kind === 'product') return `site:shop.lululemon.com ${query} shop`;
  return `(site:shop.lululemon.com OR site:www.westfield.com/en/united-states/valleyfair/retailers OR site:www.westfield.com/en/united-states/valleyfair/events) ${query}`;
}
