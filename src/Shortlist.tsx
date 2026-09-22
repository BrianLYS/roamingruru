import { officialSource, officialStore } from './sourcePolicy';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Interest } from './discovery';
import { fetchMemory } from './memorySession';
import './shortlist.css';

type ShortlistProps = {
  interest: Interest | null;
  onReviewStyle: () => void;
  agentResult?: {items: unknown[]; receipt?: string} | null;
};

type Capabilities = {
  search: boolean;
  email: boolean;
  shortlistEmail: boolean;
};

export type ShortlistEmailOutcome = null | 'pending' | 'sent' | 'unknown' | 'rejected';

export type ShortlistItem = {
  title: string;
  url: string;
  description: string;
  kind?: string;
  checkedAt?: string;
};

const interestCopy: Record<Interest, { label: string; reason: string }> = {
  yoga: {
    label: 'yoga',
    reason: 'Ruru searched with your yoga interest in mind.',
  },
  running: {
    label: 'running',
    reason: 'Ruru searched with your running interest in mind.',
  },
  exploring: {
    label: 'exploring',
    reason: 'Ruru searched with your interest in exploring in mind.',
  },
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === 'AbortError') return '';
  return error instanceof Error && error.message ? error.message : fallback;
}

async function responseError(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return fallback;
}

export function parseShortlistCapabilities(value: unknown): Capabilities {
  if (!value || typeof value !== 'object') throw new Error('Ruru could not confirm whether shop search is connected.');
  const capabilities = (value as { capabilities?: unknown }).capabilities;
  if (!capabilities || typeof capabilities !== 'object') throw new Error('Ruru could not confirm whether shop search is connected.');
  const item = capabilities as Record<string, unknown>;
  if (
    typeof item.search !== 'boolean' ||
    typeof item.email !== 'boolean' ||
    (item.shortlistEmail !== undefined && typeof item.shortlistEmail !== 'boolean')
  ) {
    throw new Error('Ruru could not confirm whether shop search is connected.');
  }
  return { search: item.search, email: item.email, shortlistEmail: item.shortlistEmail === true };
}

function officialSourceUrl(value: unknown): string | null { return officialSource(value) ? value : null; }

export function parseShortlist(value: unknown): ShortlistItem[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) {
    throw new Error('Ruru received an unexpected shop-search response.');
  }
  const seen = new Set<string>();
  return (value as { items: unknown[] }).items.flatMap((candidate): ShortlistItem[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Record<string, unknown>;
    const url = officialSourceUrl(item.url);
    if (
      !url ||
      seen.has(url) ||
      typeof item.title !== 'string' ||
      typeof item.description !== 'string' ||
      !item.title.trim() ||
      !item.description.trim()
    ) return [];
    seen.add(url);
    return [{ title: item.title.trim().slice(0, 160), description: item.description.trim().slice(0, 280), url, ...(typeof item.kind === 'string' && ['product','event','editorial','category','store'].includes(item.kind) ? {kind:item.kind} : {}), ...(typeof item.checkedAt === 'string' ? {checkedAt:item.checkedAt} : {}) }];
  }).slice(0, 2);
}

export function parseShortlistResponse(value: unknown): { items: ShortlistItem[]; receipt: string | null } {
  const items = parseShortlist(value);
  const receipt = (value as { receipt?: unknown }).receipt;
  if (receipt === null || receipt === undefined) return { items, receipt: null };
  if (typeof receipt !== 'string' || receipt.length > 10000 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(receipt)) return { items, receipt: null };
  try {
    const encoded = receipt.split('.')[0];
    const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) return { items, receipt: null };
    const signedItems = (payload as { items: unknown[]; expiresAt?: unknown }).items;
    const expiresAt = (payload as { expiresAt?: unknown }).expiresAt;
    const exact = signedItems.length === items.length && signedItems.every((candidate, index) => {
      if (!candidate || typeof candidate !== 'object') return false;
      const signed = candidate as Record<string, unknown>;
      return signed.title === items[index].title && signed.url === items[index].url;
    });
    if (!exact || typeof expiresAt !== 'number' || expiresAt <= Date.now() || expiresAt > Date.now() + 15 * 60_000) return { items, receipt: null };
    return { items, receipt };
  } catch {
    return { items, receipt: null };
  }
}

export function parseShortlistEmailOutcome(value: unknown): ShortlistEmailOutcome {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ruru received an unexpected email status.');
  const outcome = (value as { outcome?: unknown }).outcome;
  if (outcome === null || outcome === 'pending' || outcome === 'sent' || outcome === 'unknown' || outcome === 'rejected') return outcome;
  throw new Error('Ruru received an unexpected email status.');
}

function emailOutcomeCopy(outcome: Exclude<ShortlistEmailOutcome, null>) {
  if (outcome === 'sent') return 'Accepted for sending. Check your inbox. These links were submitted once.';
  if (outcome === 'pending' || outcome === 'unknown') return 'Sending couldn’t be confirmed. Check your inbox before doing anything else. This request will not be resent.';
  return 'This email request wasn’t accepted. You can start a new request after reviewing the address.';
}

export function Shortlist({ interest, onReviewStyle, agentResult }: ShortlistProps) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState('');
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [emailOutcome, setEmailOutcome] = useState<ShortlistEmailOutcome>(null);
  const [emailStatusChecked, setEmailStatusChecked] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const operationId = useRef(crypto.randomUUID());
  const generation = useRef(0);
  const capabilityRequest = useRef<AbortController | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const emailRequest = useRef<AbortController | null>(null);

  function clearEmail() {
    emailRequest.current?.abort();
    emailRequest.current = null;
    operationId.current = crypto.randomUUID();
    setReceipt(null);
    setEmail('');
    setEmailConsent(false);
    setEmailOutcome(null);
    setEmailStatusChecked(false);
    setEmailMessage('');
    setCheckingEmail(false);
    setSendingEmail(false);
  }

  function resetSearch() {
    searchRequest.current?.abort();
    searchRequest.current = null;
    clearEmail();
    setSearching(false);
    setItems([]);
    setSearchMessage('');
  }

  useEffect(() => {
    const current = ++generation.current;
    capabilityRequest.current?.abort();
    resetSearch();
    setCapabilities(null);
    setCapabilityError('');
    setLoadingCapabilities(true);

    const controller = new AbortController();
    capabilityRequest.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    void fetch('/api/lulu/memory/profile', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(await responseError(response, 'Ruru could not check shop-search availability.'));
        return parseShortlistCapabilities(await response.json());
      })
      .then(result => {
        if (current !== generation.current || controller.signal.aborted) return;
        setCapabilities(result);
      })
      .catch(error => {
        if (current !== generation.current || (controller.signal.aborted && !timedOut)) return;
        setCapabilityError(timedOut ? 'Checking shop-search availability took too long. Please try again.' : errorMessage(error, 'Ruru could not check shop-search availability.'));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (capabilityRequest.current === controller) capabilityRequest.current = null;
        if (current === generation.current) setLoadingCapabilities(false);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [interest, capabilityAttempt]);

  useEffect(() => {
    if (!agentResult) return;
    try { const result = parseShortlistResponse(agentResult); clearEmail(); setItems(result.items); setReceipt(result.receipt); setSearchMessage('Official pages Ruru found during your conversation. Check each source for current details.'); } catch { setSearchMessage('Those sources could not be displayed. Ask Ruru to search again.'); }
  }, [agentResult, interest, capabilityAttempt]);

  useEffect(() => {
    const clear = () => resetSearch();
    window.addEventListener('lulu-new-conversation', clear);
    window.addEventListener('lulu-forgetting', clear);
    window.addEventListener('lulu-forgotten', clear);
    window.addEventListener('lulu-interest-cleared', clear);
    return () => {
      window.removeEventListener('lulu-new-conversation', clear);
      window.removeEventListener('lulu-forgetting', clear);
      window.removeEventListener('lulu-forgotten', clear);
      window.removeEventListener('lulu-interest-cleared', clear);
      capabilityRequest.current?.abort();
      searchRequest.current?.abort();
      emailRequest.current?.abort();
      generation.current += 1;
    };
  }, []);

  async function findIdeas() {
    if (!interest || !capabilities?.search || searching || searchRequest.current) return;
    const current = generation.current;
    const searchedInterest = interest;
    const controller = new AbortController();
    searchRequest.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
    setSearching(true);
    setItems([]);
    clearEmail();
    setSearchMessage('Ruru is checking the official US shop…');
    try {
      const response = await fetch('/api/lulu/outfit/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garment: 'unknown', color: 'neutral', style: 'unknown', interest: searchedInterest }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await responseError(response, 'Ruru could not finish that shop search.'));
      const result = parseShortlistResponse(await response.json());
      if (current !== generation.current || controller.signal.aborted || interest !== searchedInterest) return;
      setItems(result.items);
      setReceipt(result.receipt);
      setSearchMessage(result.items.length
        ? 'Two ideas at most, from official US shop pages. Check the shop page for current details.'
        : 'No matching official shop pages were returned. You can review your style or browse the official shop.');
    } catch (error) {
      if (current !== generation.current || (controller.signal.aborted && !timedOut)) return;
      setSearchMessage(timedOut ? 'The shop search took too long. Please try again.' : errorMessage(error, 'Ruru could not finish that shop search.'));
    } finally {
      window.clearTimeout(timeout);
      if (searchRequest.current === controller) searchRequest.current = null;
      if (current === generation.current && interest === searchedInterest) setSearching(false);
    }
  }

  async function refreshEmailStatus() {
    if (!capabilities?.shortlistEmail || !receipt || !items.length || emailRequest.current) return;
    const current = generation.current;
    const expectedReceipt = receipt;
    const controller = new AbortController();
    emailRequest.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    setCheckingEmail(true);
    setEmailMessage('Checking this request’s email status…');
    try {
      const response = await fetchMemory(`/api/lulu/memory/shortlist-email?operationId=${operationId.current}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response, 'Email status is unavailable. Please try again.'));
      const outcome = parseShortlistEmailOutcome(await response.json());
      if (current !== generation.current || receipt !== expectedReceipt || (controller.signal.aborted && !timedOut)) return;
      setEmailOutcome(outcome);
      setEmailStatusChecked(true);
      setEmailMessage(outcome ? emailOutcomeCopy(outcome) : '');
    } catch (error) {
      if (current !== generation.current || (controller.signal.aborted && !timedOut)) return;
      setEmailStatusChecked(false);
      setEmailMessage(timedOut ? 'Checking email status took too long. Please try again.' : errorMessage(error, 'Email status is unavailable. Please try again.'));
    } finally {
      window.clearTimeout(timeout);
      if (emailRequest.current === controller) emailRequest.current = null;
      if (current === generation.current && receipt === expectedReceipt) setCheckingEmail(false);
    }
  }

  useEffect(() => {
    if (!capabilities?.shortlistEmail || !receipt || !items.length) return;
    void refreshEmailStatus();
  }, [capabilities?.shortlistEmail, receipt, items.length]);

  async function sendShortlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !capabilities?.shortlistEmail ||
      !receipt ||
      !items.length ||
      !emailStatusChecked ||
      emailOutcome !== null ||
      !email.trim() ||
      !emailConsent ||
      sendingEmail ||
      emailRequest.current
    ) return;
    const current = generation.current;
    const expectedReceipt = receipt;
    const recipient = email.trim();
    const controller = new AbortController();
    emailRequest.current = controller;
    let timedOut = false;
    let attemptBegan = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
    setSendingEmail(true);
    setEmailMessage('Preparing your one-off email…');
    try {
      const session = await fetchMemory('/api/lulu/memory/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, purpose: 'shortlist' }),
        signal: controller.signal,
      });
      if (current !== generation.current || receipt !== expectedReceipt || (controller.signal.aborted && !timedOut)) return;
      if (timedOut) throw new DOMException('Timed out', 'TimeoutError');
      if (!session.ok) throw new Error(await responseError(session, 'A private browser session could not be started. Please retry.'));

      attemptBegan = true;
      setEmailMessage('Sending this shortlist once…');
      const response = await fetchMemory('/api/lulu/memory/shortlist-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, email: recipient, receipt: expectedReceipt, operationId: operationId.current }),
        signal: controller.signal,
      });
      if (current !== generation.current || receipt !== expectedReceipt || (controller.signal.aborted && !timedOut)) return;
      if (response.status === 503) {
        attemptBegan = false;
        setEmailMessage(await responseError(response, 'Email delivery is unavailable. Please try again.'));
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      let outcome: ShortlistEmailOutcome;
      try { outcome = parseShortlistEmailOutcome(body); }
      catch { outcome = 'unknown'; }
      if (outcome === null) outcome = 'unknown';
      setEmail('');
      setEmailConsent(false);
      setEmailOutcome(outcome);
      setEmailStatusChecked(true);
      setEmailMessage(emailOutcomeCopy(outcome));
    } catch (error) {
      if (current !== generation.current || (controller.signal.aborted && !timedOut)) return;
      if (attemptBegan) {
        setEmail('');
        setEmailConsent(false);
        setEmailOutcome('unknown');
        setEmailStatusChecked(true);
        setEmailMessage(emailOutcomeCopy('unknown'));
      } else {
        setEmailMessage(timedOut ? 'Starting the private email request took too long. Please try again.' : errorMessage(error, 'Email delivery is unavailable. Please try again.'));
      }
    } finally {
      window.clearTimeout(timeout);
      if (emailRequest.current === controller) emailRequest.current = null;
      if (current === generation.current && receipt === expectedReceipt) setSendingEmail(false);
    }
  }

  if (!interest && !items.length) return null;
  const copy = interest ? interestCopy[interest] : { label: 'you', reason: 'Found during your conversation with Ruru.' };

  return (
    <section className="shortlist" aria-labelledby="shortlist-heading">
      <div className="shortlist__heading">
        <div>
          <span className="shortlist__eyebrow">Picked from our chat</span>
          <h3 id="shortlist-heading">A little shortlist for {copy.label}</h3>
        </div>
        <span className="shortlist__count">Up to 2</span>
      </div>
      <p className="shortlist__intro">Official lululemon US and Valley Fair pages, with current details at the source.</p>

      {loadingCapabilities && <p className="shortlist__status" role="status">Checking whether live shop search is connected…</p>}
      {capabilityError && <p className="shortlist__status shortlist__status--error" role="alert">{capabilityError} <button type="button" className="shortlist__text-button" onClick={() => setCapabilityAttempt(value => value + 1)}>Try again</button></p>}
      {!loadingCapabilities && capabilities && !capabilities.search && (
        <p className="shortlist__status">Live shop search is not connected yet. <a href={officialStore} target="_blank" rel="noreferrer">Browse the official US shop</a>.</p>
      )}
      {capabilities?.search && interest && !agentResult && (
        <div className="shortlist__actions">
          <button type="button" className="shortlist__primary" onClick={() => void findIdeas()} disabled={searching}>
            {searching ? 'Looking…' : items.length ? 'Refresh my ideas' : 'Find two ideas'}
          </button>
          <button type="button" className="shortlist__secondary" onClick={onReviewStyle}>Review my style</button>
        </div>
      )}

      {searchMessage && <p className="shortlist__status" role="status">{searchMessage}</p>}
      {items.length > 0 && (
        <ol className="shortlist__items">
          {items.map(item => (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
              <p>{item.description}</p>
              <small>{item.kind ? `${item.kind.charAt(0).toUpperCase()}${item.kind.slice(1)} page · ` : ''}{copy.reason}</small>
            </li>
          ))}
        </ol>
      )}
      {items.length > 0 && (
        capabilities?.shortlistEmail && receipt ? (
          <details className="shortlist__email">
            <summary>Email me these</summary>
            {checkingEmail && <p className="shortlist__status" role="status">Checking this request’s email status…</p>}
            {!checkingEmail && emailStatusChecked && emailOutcome === null && (
              <form onSubmit={sendShortlist}>
                <p>Send these exact links once. Your address is used for this email only.</p>
                <label className="shortlist__email-field">
                  <span>Email address</span>
                  <input type="email" disabled={sendingEmail} required maxLength={254} autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setEmailConsent(false); setEmailMessage(''); }} />
                </label>
                <label className="shortlist__consent">
                  <input type="checkbox" disabled={sendingEmail} checked={emailConsent} onChange={event => setEmailConsent(event.target.checked)} />
                  <span>Send this shortlist once. This does not subscribe me to updates.</span>
                </label>
                <button type="submit" className="shortlist__primary" disabled={sendingEmail || !email.trim() || !emailConsent}>{sendingEmail ? 'Sending once…' : 'Send my shortlist'}</button>
                {emailMessage && <p className="shortlist__status" role="status">{emailMessage}</p>}
              </form>
            )}
            {!checkingEmail && (!emailStatusChecked || emailOutcome !== null) && emailMessage && <p className="shortlist__status" role="status">{emailMessage}</p>}
            {!checkingEmail && !emailStatusChecked && <button type="button" className="shortlist__text-button" onClick={() => void refreshEmailStatus()}>Refresh email status</button>}
            {!checkingEmail && (emailOutcome === 'sent' || emailOutcome === 'rejected') && <button type="button" className="shortlist__text-button" onClick={() => { operationId.current = crypto.randomUUID(); setEmailOutcome(null); setEmailConsent(false); setEmailMessage(''); }}>Start another email request</button>}
            {!checkingEmail && (emailOutcome === 'pending' || emailOutcome === 'unknown') && <button type="button" className="shortlist__text-button" onClick={() => void refreshEmailStatus()}>Refresh sending status</button>}
          </details>
        ) : <p className="shortlist__email-unavailable">Email delivery isn’t connected yet.</p>
      )}
      {!capabilities?.search && !loadingCapabilities && (
        <button type="button" className="shortlist__secondary" onClick={onReviewStyle}>Review my style</button>
      )}
    </section>
  );
}

export default Shortlist;
