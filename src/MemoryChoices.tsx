import { useEffect, useRef, useState } from 'react';
import { fetchMemory } from './memorySession';

type Snapshot = { profileVersion: number; newsletterVersion: number; personal?: { name: string; preferences: string[] } | null; face?: { enrolled: boolean } | null; newsletter: { status: string; emailHint: string } | null };
export default function MemoryChoices({ onForgotten, newsletterOnly = false, personalOnly = false, onShowQr }: { onForgotten: () => void; newsletterOnly?: boolean; personalOnly?: boolean; onShowQr?: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [name, setName] = useState(''); const [preferences, setPreferences] = useState('');
  const [remember, setRemember] = useState(false); const [email, setEmail] = useState(''); const [subscribe, setSubscribe] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const generation = useRef(0); const request = useRef<AbortController | null>(null);
  const reload = async (signal?: AbortSignal) => {
    const response = await fetchMemory('/api/lulu/memory/profile', { signal });
    if (!response.ok) throw new Error('Saved choices could not be checked. Try again.');
    const value = await response.json();
    if (!Number.isSafeInteger(value.profileVersion) || !Number.isSafeInteger(value.newsletterVersion)) throw new Error('Saved choices could not be checked.');
    if (!signal?.aborted) setSnapshot(value); return value as Snapshot;
  };
  useEffect(() => {
    const controller = new AbortController(); void reload(controller.signal).catch(() => {});
    const changed = () => { void reload(controller.signal).catch(() => {}); };
    window.addEventListener('lulu-profile-changed', changed);
    const offer = (event: Event) => {
      const value = (event as CustomEvent).detail;
      if (value?.type === 'remember') { setName(typeof value.name === 'string' ? value.name.slice(0, 40) : ''); setPreferences(Array.isArray(value.preferences) ? value.preferences.filter((x: unknown) => typeof x === 'string').slice(0, 8).join('\n') : ''); setRemember(false); }
    };
    window.addEventListener('lulu-control-offered', offer);
    return () => { controller.abort(); request.current?.abort(); generation.current++; window.removeEventListener('lulu-profile-changed', changed); window.removeEventListener('lulu-control-offered', offer); };
  }, []);
  async function act(kind: 'personal' | 'newsletter' | 'forget' | 'unsubscribe') {
    if (busy || (!snapshot && kind !== 'forget')) return;
    const current = ++generation.current; request.current?.abort();
    const controller = new AbortController(); request.current = controller; const timeout = setTimeout(() => controller.abort(), 20000);
    setBusy(true); setMessage('');
    if (kind === 'forget') window.dispatchEvent(new Event('lulu-forgetting'));
    try {
      const post = async (path: string, body: unknown) => {
        const response = await fetchMemory(`/api/lulu/memory/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Your choice could not be confirmed. Refresh and try again.'); return result;
      };
      if (kind === 'personal' || kind === 'newsletter') await post('session', { consent: true, purpose: kind === 'personal' ? 'profile' : 'newsletter' });
      const body = kind === 'personal' ? { consent: true, version: snapshot!.profileVersion, name: name.trim(), preferences: preferences.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8) }
        : kind === 'newsletter' ? { consent: true, version: snapshot!.newsletterVersion, email: email.trim() }
        : kind === 'unsubscribe' ? { version: snapshot!.newsletterVersion } : {};
      await post(kind, body);
      if (current !== generation.current) return;
      if (kind === 'forget') { setName(''); setPreferences(''); setRemember(false); onForgotten(); window.dispatchEvent(new Event('lulu-forgotten')); }
      if (kind === 'newsletter') { setEmail(''); setSubscribe(false); }
      setMessage(kind === 'personal' ? 'Remembered. You can change or forget this whenever you like.' : kind === 'newsletter' ? 'You’re on Ruru’s list. You can unsubscribe whenever you like.' : kind === 'unsubscribe' ? 'Unsubscribed. Your other remembered choices stay as they are.' : 'Your face and personal memory are forgotten. Mailing-list choices stay separate.');
      window.dispatchEvent(new Event('lulu-profile-changed'));
      await reload(controller.signal);
    } catch (error) { if (current === generation.current) { setMessage(error instanceof Error ? error.message : 'Your choice could not be confirmed.'); void reload().catch(() => {}); } }
    finally { clearTimeout(timeout); if (current === generation.current) setBusy(false); if (kind === 'forget') window.dispatchEvent(new Event('lulu-forget-settled')); }
  }
  const PersonalContainer = personalOnly ? 'section' : 'details';
  return <div className="memory-choices">
    {!newsletterOnly && <PersonalContainer id="lulu-remember">{!personalOnly && <summary>What Ruru remembers</summary>}
      {snapshot?.personal && <p>Remembered: {[snapshot.personal.name, ...snapshot.personal.preferences].filter(Boolean).join(' · ')}</p>}
      {snapshot?.face?.enrolled && <p>Your face is enrolled for return visits.</p>}
      <form onSubmit={e => { e.preventDefault(); if (remember) void act('personal'); }}>
        <label>Call me<input value={name} maxLength={40} disabled={busy} onChange={e => { setName(e.target.value); setRemember(false); }} autoComplete="nickname"/></label>
        <label>Things I’d like Ruru to remember<textarea value={preferences} maxLength={1200} disabled={busy} onChange={e => { setPreferences(e.target.value); setRemember(false); }} placeholder="One preference per line" rows={3}/></label>
        <label className="choice-consent"><input type="checkbox" checked={remember} disabled={busy} onChange={e => setRemember(e.target.checked)}/>Remember these details for my next visit, for up to 30 days.</label>
        <button className="text-button" disabled={busy || !remember || !snapshot || (!name.trim() && !preferences.trim())}>Remember this</button>
      </form>
      <button className="text-button" disabled={busy} onClick={() => void act('forget')}>Forget me</button>
      <p className="voice-note">Removes your enrolled face and personal memory. Your mailing-list choice is separate.</p>
    </PersonalContainer>}
    {!personalOnly && <details id="lulu-mailing-list" open={newsletterOnly || undefined}><summary>Shop updates, if you’d like</summary>
      {onShowQr && <button type="button" className="text-button" onClick={onShowQr}>Show signup QR on Ruru’s face</button>}
      {snapshot?.newsletter ? <><p>{snapshot.newsletter.status === 'active' ? 'You’re on Ruru’s list' : 'Signup saved'} · {snapshot.newsletter.emailHint}</p><button className="text-button" disabled={busy} onClick={() => void act('unsubscribe')}>Unsubscribe</button></> : <form onSubmit={e => { e.preventDefault(); if (subscribe) void act('newsletter'); }}>
        <p>Occasional updates about products, stores and events. Join only if you’d like to hear more.</p>
        <label>Email address<input type="email" required value={email} maxLength={254} disabled={busy} onChange={e => { setEmail(e.target.value); setSubscribe(false); }} autoComplete="email"/></label>
        <label className="choice-consent"><input type="checkbox" checked={subscribe} disabled={busy} onChange={e => setSubscribe(e.target.checked)}/>Yes, send me Ruru’s updates. I can unsubscribe here anytime.</label>
        <button className="text-button" disabled={busy || !subscribe || !email.trim() || !snapshot}>Join Ruru’s list</button>
      </form>}
      <p className="voice-note">Your address stays out of the conversation. Joining does not enroll your face or save your interests.</p>
    </details>}
    {message && <p role="status" className="notice">{message}</p>}
    {!snapshot && <button className="text-button" onClick={() => void reload().catch(e => setMessage(e.message))}>Check saved choices</button>}
  </div>;
}
