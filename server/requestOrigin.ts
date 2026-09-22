import type { IncomingMessage } from 'node:http';
/** Local rehearsal or one configured HTTPS Site; never trust arbitrary forwarded hosts. */
export function requestOrigin(req: IncomingMessage, env: Record<string, string>): string | null {
  const host = req.headers.host;
  if (!host) return null;
  if (env.RURU_SITE_ORIGIN) {
    try {
      const site = new URL(env.RURU_SITE_ORIGIN);
      return site.protocol === 'https:' && site.host === host && site.origin === env.RURU_SITE_ORIGIN ? site.origin : null;
    } catch { return null; }
  }
  return /^(127\.0\.0\.1|localhost):\d+$/.test(host) ? `http://${host}` : null;
}
