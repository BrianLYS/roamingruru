import { officialSource } from '../src/sourcePolicy.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';
type Item = { title: string; url: string };
export function signShortlist(items: Item[], secret: string, now = Date.now()) {
  if (!secret || !items.length || items.some(item => !item || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 160 || !officialSource(item.url))) return null;
  const data = Buffer.from(JSON.stringify({ items: items.slice(0, 2).map(({ title, url }) => ({ title, url })), expiresAt: now + 15 * 60000 })).toString('base64url');
  return `${data}.${createHmac('sha256', secret).update(`shortlist-v1:${data}`).digest('hex')}`;
}
export function readShortlist(value: unknown, secret: string, now = Date.now()): Item[] | null {
  if (!secret || typeof value !== 'string' || value.length > 10000) return null;
  const [data, signature, extra] = value.split('.');
  if (extra || !data || !/^[a-f0-9]{64}$/.test(signature ?? '')) return null;
  const mac = createHmac('sha256', secret).update(`shortlist-v1:${data}`).digest();
  if (!timingSafeEqual(mac, Buffer.from(signature, 'hex'))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now || parsed.expiresAt > now + 15 * 60000 || !Array.isArray(parsed.items) || !parsed.items.length || parsed.items.length > 2) return null;
    if (parsed.items.some((item: unknown) => !item || typeof item !== 'object' || !('title' in item) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 160 || !('url' in item) || !officialSource(item.url))) return null;
    return parsed.items;
  } catch { return null; }
}
