import type { Page, Route } from '@playwright/test';
import { replyTo } from '../src/discovery';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

// Provider-independent regressions use this complete Ruru API boundary even when
// local credentials are present. Tests can register a narrower route afterwards.
export async function scriptedConversation(page: Page) {
  await page.route('**/api/lulu/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === '/api/lulu/conversation/status' && method === 'GET') return json(route, { mode: 'scripted' });
    if (path === '/api/lulu/conversation' && method === 'POST') {
      const { message } = request.postDataJSON() as { message: string };
      const result = replyTo(message);
      return json(route, { mode: 'scripted', text: result.text, interest: result.interest ?? null, actions: [], discoveries: [] });
    }
    if (path === '/api/lulu/voice' && method === 'POST') return json(route, { error: 'Synthetic QA: audio unavailable.' }, 503);
    if (path === '/api/lulu/memory/profile' && method === 'GET') {
      return json(route, {
        profile: null,
        personal: null,
        face: null,
        profileVersion: 0,
        newsletterVersion: 0,
        newsletter: null,
        capabilities: { vision: false, search: false, email: false, shortlistEmail: false },
      });
    }
    if (path === '/api/lulu/memory/shortlist-email' && method === 'GET') return json(route, { outcome: null });
    return json(route, { error: `Unmocked Ruru API blocked by scripted QA: ${method} ${path}` }, 599);
  });
}
