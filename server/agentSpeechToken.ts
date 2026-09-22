import { createHmac, timingSafeEqual } from 'node:crypto';
const lifetime = 10 * 60 * 1000;
export function signAgentReply(text: string, secret?: string, now = Date.now()): string | undefined {
  if (!secret || !text.trim() || text.length > 600) return undefined;
  const expiry = String(now + lifetime);
  return `${expiry}.${createHmac('sha256', secret).update(`lulu-agent-speech-v1:${expiry}:${text}`).digest('base64url')}`;
}
export function verifyAgentReply(text: string, token: unknown, secret?: string, now = Date.now()): boolean {
  if (!secret || typeof token !== 'string' || !text.trim() || text.length > 600) return false;
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Number(match[1]) <= now || Number(match[1]) > now + lifetime) return false;
  const expected = createHmac('sha256', secret).update(`lulu-agent-speech-v1:${match[1]}:${text}`).digest();
  return timingSafeEqual(expected, Buffer.from(match[2], 'base64url'));
}
