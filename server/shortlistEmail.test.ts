// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
import {
  createShortlistEmailService,
  exactOfficialSourceUrl,
  renderShortlistEmail,
  type ShortlistEmailLedger,
  type ShortlistEmailTerminalOutcome,
} from './shortlistEmail';

const ownerHash = 'a'.repeat(64);
const recipientDigest = 'b'.repeat(64);
const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
const first = {
  title: 'Align <Top> & more',
  url: 'https://shop.lululemon.com/p/women-tops/align-top/prod123.html',
};
const second = {
  title: 'Running shorts',
  url: 'https://shop.lululemon.com/p/shorts/example.html?colour=1',
};
const input = { ownerHash, expiresAt, recipient: ' Visitor@Example.com ', recipientDigest, consent: true, items: [first, second] };
const config = { apiKey: 'synthetic-key', inboxId: 'lulu@example.test' };

function fakeLedger(): ShortlistEmailLedger & { reserve: ReturnType<typeof vi.fn>; settle: ReturnType<typeof vi.fn> } {
  let saved: ShortlistEmailTerminalOutcome | { outcome: 'pending' } | null = null;
  return {
    reserve: vi.fn(async () => saved
      ? { kind: 'existing' as const, outcome: saved }
      : (saved = { outcome: 'pending' }, { kind: 'claimed' as const, idempotencyKey: 'roaminglulu-shortlist-test-1' })),
    settle: vi.fn(async ({ outcome }: { ownerHash: string; outcome: ShortlistEmailTerminalOutcome }) => { saved = outcome; }),
  };
}

describe('shortlist email service', () => {
  test('requires configuration and explicit bounded consent before ledger or provider work', async () => {
    const ledger = fakeLedger();
    const provider = vi.fn();
    expect(await createShortlistEmailService({}, ledger, provider)({ ...input, consent: false })).toEqual({ outcome: 'rejected', reason: 'not_configured' });
    const service = createShortlistEmailService(config, ledger, provider);
    for (const invalid of [
      { ...input, consent: false },
      { ...input, recipient: ['one@example.com', 'two@example.com'] },
      { ...input, items: [] },
      { ...input, items: [first, second, first] },
      { ...input, items: [{ ...first, url: 'https://www.lululemon.com.hk.evil.invalid/en-sg/item' }] },
      { ...input, items: [{ ...first, url: `${first.url}#fragment` }] },
      { ...input, extra: true },
    ]) expect(await service(invalid)).toEqual({ outcome: 'rejected', reason: 'invalid_request' });
    expect(ledger.reserve).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  test('claims before one provider call and sends fixed plain text plus escaped HTML to one recipient', async () => {
    const events: string[] = [];
    const ledger = fakeLedger();
    ledger.reserve.mockImplementationOnce(async () => { events.push('reserve'); return { kind: 'claimed', idempotencyKey: 'roaminglulu-shortlist-test-1' }; });
    ledger.settle.mockImplementationOnce(async () => { events.push('settle'); });
    const provider = vi.fn(async (_url: unknown, options?: RequestInit) => {
      events.push('provider');
      return new Response(JSON.stringify({ message_id: 'message_1', thread_id: 'thread_1' }), { headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    const result = await createShortlistEmailService(config, ledger, provider)(input);

    expect(result).toEqual({ outcome: 'sent', messageId: 'message_1', threadId: 'thread_1' });
    expect(events).toEqual(['reserve', 'provider', 'settle']);
    expect(ledger.reserve).toHaveBeenCalledWith({ ownerHash, expiresAt, recipientDigest });
    const [url, options] = (provider as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.agentmail.to/v0/inboxes/lulu%40example.test/messages/send');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer synthetic-key', 'Idempotency-Key': 'roaminglulu-shortlist-test-1' });
    const body = JSON.parse(String(options.body));
    expect(body.to).toEqual(['visitor@example.com']);
    expect(body.subject).toBe('Your shortlist from Ruru');
    expect(body.text).toContain(`${first.title}\n${first.url}`);
    expect(body.html).toContain('Align &lt;Top&gt; &amp; more');
    expect(body.html).not.toContain('Align <Top>');
    expect(body.track_opens).toBe(false);
  });

  test('a durable duplicate returns the recorded outcome without another provider call', async () => {
    const ledger = fakeLedger();
    const provider = vi.fn(async () => new Response(JSON.stringify({ message_id: 'message_1', thread_id: 'thread_1' }))) as unknown as typeof fetch;
    const service = createShortlistEmailService(config, ledger, provider);
    expect((await service(input)).outcome).toBe('sent');
    expect(await service(input)).toEqual({ outcome: 'sent', messageId: 'message_1', threadId: 'thread_1' });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(ledger.reserve).toHaveBeenCalledTimes(2);
  });

  test('timeout becomes durable unknown and is never retried', async () => {
    const ledger = fakeLedger();
    const provider = vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }) as unknown as typeof fetch;
    const service = createShortlistEmailService(config, ledger, provider);
    expect(await service(input)).toEqual({ outcome: 'unknown', reason: 'provider_uncertain' });
    expect(await service(input)).toEqual({ outcome: 'unknown', reason: 'provider_uncertain' });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(ledger.settle).toHaveBeenCalledWith({ ownerHash, outcome: { outcome: 'unknown', reason: 'provider_uncertain' } });
  });

  test('bounds streamed provider responses even without Content-Length', async () => {
    const ledger = fakeLedger();
    const provider = vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(4097));
        controller.close();
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    const service = createShortlistEmailService(config, ledger, provider);

    await expect(service(input)).resolves.toEqual({ outcome: 'unknown', reason: 'provider_uncertain' });
    expect(ledger.settle).toHaveBeenCalledWith({ ownerHash, outcome: { outcome: 'unknown', reason: 'provider_uncertain' } });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  test('an in-flight duplicate is unknown, while a documented provider rejection is final', async () => {
    const pending: ShortlistEmailLedger = {
      reserve: vi.fn(async () => ({ kind: 'existing', outcome: { outcome: 'pending' } })),
      settle: vi.fn(),
    };
    const provider = vi.fn();
    expect(await createShortlistEmailService(config, pending, provider)(input)).toEqual({ outcome: 'unknown', reason: 'attempt_in_progress' });
    expect(provider).not.toHaveBeenCalled();

    const rejectedLedger = fakeLedger();
    const rejectedProvider = vi.fn(async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    expect(await createShortlistEmailService(config, rejectedLedger, rejectedProvider)(input)).toEqual({ outcome: 'rejected', reason: 'provider_rejected' });
    expect(rejectedProvider).toHaveBeenCalledTimes(1);
  });

  test('only exact official US URLs are accepted and rendered content is deterministic', () => {
    expect(exactOfficialSourceUrl(first.url)).toBe(true);
    expect(exactOfficialSourceUrl('https://www.lululemon.com.hk/en-hk/item')).toBe(false);
    expect(exactOfficialSourceUrl('https://user@www.lululemon.com.hk/en-sg/item')).toBe(false);
    expect(renderShortlistEmail([first])).toEqual(renderShortlistEmail([first]));
  });
});
