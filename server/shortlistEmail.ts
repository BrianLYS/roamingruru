import { officialSource } from '../src/sourcePolicy.ts';
export type ShortlistEmailSent = {
  outcome: 'sent';
  messageId: string;
  threadId: string;
};

export type ShortlistEmailUnknown = {
  outcome: 'unknown';
  reason: 'attempt_in_progress' | 'provider_uncertain' | 'ledger_failure';
};

export type ShortlistEmailRejected = {
  outcome: 'rejected';
  reason: 'invalid_request' | 'not_configured' | 'provider_rejected' | 'already_rejected';
};

export type ShortlistEmailOutcome = ShortlistEmailSent | ShortlistEmailUnknown | ShortlistEmailRejected;
export type ShortlistEmailTerminalOutcome = ShortlistEmailSent | ShortlistEmailUnknown | ShortlistEmailRejected;
export type ShortlistEmailLedgerOutcome = ShortlistEmailTerminalOutcome | { outcome: 'pending' };

export type ShortlistEmailReservation = {
  ownerHash: string;
  expiresAt: number;
  recipientDigest: string;
  operationId?: string;
};

export interface ShortlistEmailLedger {
  /** Atomically creates the send attempt for this operation, or returns the existing attempt. */
  reserve(input: ShortlistEmailReservation): Promise<
    | { kind: 'claimed'; idempotencyKey: string }
    | { kind: 'existing'; outcome: ShortlistEmailLedgerOutcome }
  >;
  /** Stores only outcome metadata. Implementations must never persist the recipient or body. */
  settle(input: { ownerHash: string; operationId?:string; outcome: ShortlistEmailTerminalOutcome }): Promise<void>;
}

export type ShortlistEmailItem = { title: string; url: string };
export type ShortlistEmailInput = ShortlistEmailReservation & {
  recipient: string;
  consent: true;
  items: ShortlistEmailItem[];
};

export type ShortlistEmailConfig = {
  apiKey?: string;
  inboxId?: string;
};

export const SHORTLIST_EMAIL_SUBJECT = 'Your shortlist from Ruru';
const maximumInputBytes = 8 * 1024;
const providerTimeoutMs = 15_000;
const maximumSessionLifetimeMs = 31 * 24 * 60 * 60 * 1000;
const documentedRejections = new Set([400, 403, 404, 409]);

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every(key => allowed.includes(key));
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)
  ) return null;
  return email;
}

export const exactOfficialSourceUrl = officialSource;

function parseInput(value: unknown): ShortlistEmailInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!exactKeys(input, ['ownerHash', 'expiresAt', 'recipient', 'recipientDigest', 'consent', 'items', ...(input.operationId!==undefined?['operationId']:[])])) return null;
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maximumInputBytes) return null;
  } catch {
    return null;
  }
  if(input.operationId!==undefined&&(typeof input.operationId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(input.operationId)))return null;
  const recipient = normalizeEmail(input.recipient);
  const now = Date.now();
  if (
    typeof input.ownerHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.ownerHash) ||
    typeof input.recipientDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.recipientDigest) ||
    !Number.isSafeInteger(input.expiresAt) ||
    (input.expiresAt as number) <= now ||
    (input.expiresAt as number) > now + maximumSessionLifetimeMs ||
    input.consent !== true ||
    !recipient ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 2
  ) return null;

  const seen = new Set<string>();
  const items: ShortlistEmailItem[] = [];
  for (const candidate of input.items) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
    const item = candidate as Record<string, unknown>;
    if (
      !exactKeys(item, ['title', 'url']) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.length > 160 ||
      /[\p{Cc}\p{Cf}]/u.test(item.title) ||
      !exactOfficialSourceUrl(item.url) ||
      seen.has(item.url)
    ) return null;
    seen.add(item.url);
    items.push({ title: item.title.normalize('NFKC').trim(), url: item.url });
  }

  return {
    ...(input.operationId!==undefined?{operationId:input.operationId as string}:{}),
    ownerHash: input.ownerHash as string,
    expiresAt: input.expiresAt as number,
    recipient,
    recipientDigest: input.recipientDigest as string,
    consent: true,
    items,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderShortlistEmail(items: readonly ShortlistEmailItem[]) {
  const introduction = 'Here are the official lululemon US and Westfield Valley Fair pages you asked Ruru to email.';
  const guidance = 'Check each shop page for current product details, price and availability.';
  const disclosure = 'RoamingRuru is an independent prototype featuring lululemon. This email does not subscribe you to updates.';
  const textItems = items.map((item, index) => `${index + 1}. ${item.title}\n${item.url}`).join('\n\n');
  const htmlItems = items.map(item => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></li>`).join('');
  return {
    subject: SHORTLIST_EMAIL_SUBJECT,
    text: `${introduction}\n\n${textItems}\n\n${guidance}\n\n${disclosure}`,
    html: `<p>${introduction}</p><ol>${htmlItems}</ol><p>${guidance}</p><p>${disclosure}</p>`,
  };
}

function existingOutcome(outcome: ShortlistEmailLedgerOutcome): ShortlistEmailOutcome {
  if (outcome.outcome === 'pending') return { outcome: 'unknown', reason: 'attempt_in_progress' };
  if (outcome.outcome === 'rejected') return { ...outcome, reason: 'already_rejected' };
  return outcome;
}

function validIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._~-]{1,256}$/.test(value);
}

async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > maximumBytes) throw new Error('Invalid response size');
  }
  if (!response.body) throw new Error('Missing response body');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('Oversized response');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

async function settle(
  ledger: ShortlistEmailLedger,
  ownerHash: string,
  outcome: ShortlistEmailTerminalOutcome,
  operationId?:string,
): Promise<ShortlistEmailOutcome> {
  try {
    await ledger.settle({ ownerHash, outcome, ...(operationId?{operationId}:{}) });
    return outcome;
  } catch {
    return { outcome: 'unknown', reason: 'ledger_failure' };
  }
}

export function createShortlistEmailService(
  config: ShortlistEmailConfig,
  ledger: ShortlistEmailLedger,
  request: typeof fetch = fetch,
) {
  return async (value: unknown): Promise<ShortlistEmailOutcome> => {
    if (!config.apiKey?.trim() || !config.inboxId?.trim()) {
      return { outcome: 'rejected', reason: 'not_configured' };
    }
    const input = parseInput(value);
    if (!input) return { outcome: 'rejected', reason: 'invalid_request' };

    let reservation: Awaited<ReturnType<ShortlistEmailLedger['reserve']>>;
    try {
      reservation = await ledger.reserve({
        ownerHash: input.ownerHash,
        expiresAt: input.expiresAt,
        recipientDigest: input.recipientDigest,
        ...(input.operationId?{operationId:input.operationId}:{}),
      });
    } catch {
      return { outcome: 'unknown', reason: 'ledger_failure' };
    }
    if (reservation.kind === 'existing') return existingOutcome(reservation.outcome);
    if (!validIdempotencyKey(reservation.idempotencyKey)) {
      return settle(ledger, input.ownerHash, { outcome: 'unknown', reason: 'ledger_failure' }, input.operationId);
    }

    const message = renderShortlistEmail(input.items);
    let response: Response;
    try {
      response = await request(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId.trim())}/messages/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey.trim()}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': reservation.idempotencyKey,
          },
          body: JSON.stringify({
            to: [input.recipient],
            subject: message.subject,
            text: message.text,
            html: message.html,
            track_opens: false,
          }),
          signal: AbortSignal.timeout(providerTimeoutMs),
        },
      );
    } catch {
      return settle(ledger, input.ownerHash, { outcome: 'unknown', reason: 'provider_uncertain' }, input.operationId);
    }

    if (!response.ok) {
      const outcome: ShortlistEmailTerminalOutcome = documentedRejections.has(response.status)
        ? { outcome: 'rejected', reason: 'provider_rejected' }
        : { outcome: 'unknown', reason: 'provider_uncertain' };
      return settle(ledger, input.ownerHash, outcome, input.operationId);
    }

    try {
      const body = await readBoundedJson(response, 4096);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid response');
      const result = body as Record<string, unknown>;
      if (
        !exactKeys(result, ['message_id', 'thread_id']) ||
        typeof result.message_id !== 'string' ||
        !result.message_id ||
        result.message_id.length > 256 ||
        typeof result.thread_id !== 'string' ||
        !result.thread_id ||
        result.thread_id.length > 256
      ) throw new Error('Invalid response');
      return settle(ledger, input.ownerHash, {
        outcome: 'sent',
        messageId: result.message_id,
        threadId: result.thread_id,
      }, input.operationId);
    } catch {
      return settle(ledger, input.ownerHash, { outcome: 'unknown', reason: 'provider_uncertain' }, input.operationId);
    }
  };
}
