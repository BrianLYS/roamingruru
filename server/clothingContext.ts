import { createHmac, timingSafeEqual } from 'node:crypto';
export type ClothingContext = { garment: string; color: string; style: string };
const allowed = { garment: ['top', 'leggings', 'shorts', 'jacket', 'trousers', 'dress', 'unknown'], color: ['black', 'white', 'grey', 'blue', 'green', 'red', 'pink', 'neutral', 'other'], style: ['active', 'casual', 'smart', 'unknown'] };
const valid = (value: unknown): value is ClothingContext => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 3 && Object.entries(allowed).every(([key, values]) => values.includes((value as Record<string, string>)[key]));
export function signClothingContext(value: ClothingContext, secret?: string, now = Date.now()): string | undefined {
  if (!secret || !valid(value)) return undefined;
  const payload = Buffer.from(JSON.stringify({ ...value, expires: now + 600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(`lulu-clothing-v1:${payload}`).digest('base64url')}`;
}
export function verifyClothingContext(token: unknown, secret?: string, now = Date.now()): ClothingContext | null {
  if (!secret || typeof token !== 'string' || token.length > 1024) return null;
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token); if (!match) return null;
  const expected = createHmac('sha256', secret).update(`lulu-clothing-v1:${match[1]}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(match[2], 'base64url'))) return null;
  try {
    const { expires, ...value } = JSON.parse(Buffer.from(match[1], 'base64url').toString());
    if (!Number.isSafeInteger(expires) || expires <= now || expires > now + 600000 || !valid(value)) return null;
    return value;
  } catch { return null; }
}
