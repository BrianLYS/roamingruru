import { useEffect, useRef, useState, type RefObject } from 'react';
import { FACE_MODEL, FaceReader } from './faceRecognition';
import type { AttentionStatus } from './localAttention';
import { fetchMemory } from './memorySession';

type Recognition = { status: 'recognized' | 'uncertain' | 'unknown'; name?: string; preferences?: string[]; recognitionToken?: string };
export default function FaceMemory({ video, active, attention }: { video: RefObject<HTMLVideoElement | null>; active: boolean; attention: AttentionStatus }) {
  const attentionState = useRef(attention); attentionState.current = attention;
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const reader = useRef<FaceReader | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const recognizing = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const recognized = useRef<{ embedding: number[]; at: number; name: string } | null>(null);
  const enrollment = useRef<HTMLDetailsElement>(null);
  const pendingOffer = useRef(false);
  const lastProbe = useRef<number[] | null>(null);
  function visitorDeparted(notify = true) {
    if (!lastProbe.current) return;
    lastProbe.current = null;
    if (notify) window.dispatchEvent(new Event('lulu-visitor-changed'));
  }
  function clearMatch() { recognized.current = null; window.dispatchEvent(new Event('lulu-recognition-cleared')); }
  function clear() {
    generation.current++; reader.current?.close(); reader.current = null;
    abort.current?.abort(); abort.current = null; inFlight.current = false;
    lastProbe.current = null; clearMatch(); setEnabled(false); setConsent(false); setBusy(false); setStatus('');
  }
  useEffect(() => {
    if (!active) clear();
    else if (pendingOffer.current && enrollment.current) { enrollment.current.open = true; pendingOffer.current = false; }
    return () => { generation.current++; reader.current?.close(); reader.current = null; abort.current?.abort(); inFlight.current = false; };
  }, [active]);
  useEffect(() => {
    const forgotten = () => { clear(); pendingOffer.current = false; setEnrolled(false); setName(''); };
    const offered = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail === 'face' || detail?.type === 'face') {
        if (enrollment.current) enrollment.current.open = true;
        else pendingOffer.current = true;
      }
    };
    window.addEventListener('lulu-forgetting', forgotten); window.addEventListener('lulu-control-offered', offered);
    return () => { window.removeEventListener('lulu-forgetting', forgotten); window.removeEventListener('lulu-control-offered', offered); };
  }, []);
  useEffect(() => {
    if (enabled && attention === 'looking' && (lastProbe.current || recognized.current || recognizing.current)) { visitorDeparted(false); generation.current++; abort.current?.abort(); reader.current?.close(); reader.current = null; inFlight.current = false; recognizing.current = false; clearMatch(); setStatus('Come back into view so Ruru can recognize you.'); }
  }, [attention, enabled]);
  async function sample() {
    if (!video.current || !active || video.current.readyState < 2) throw new Error('Wait for the camera preview.');
    reader.current ??= new FaceReader();
    const face = await reader.current.read(video.current).catch(error => { reader.current?.close(); reader.current = null; throw error; });
    if (face.count !== 1 || !face.embedding) { visitorDeparted(face.count > 1 || attentionState.current === 'unavailable'); throw new Error(face.count > 1 ? 'Please keep just your own face in view.' : 'Look toward Ruru in good light, with your face fully in view.'); }
    return face.embedding;
  }
  async function recognize() {
    if (inFlight.current) return;
    inFlight.current = true; recognizing.current = true; const current = generation.current;
    const controller = new AbortController(); abort.current = controller;
    try {
      if (!recognized.current) setStatus('Looking to see if we have met…');
      const embedding = await sample();
      if (current !== generation.current) return;
      const probe = lastProbe.current;
      if (probe && embedding.reduce((sum, value, index) => sum + value * probe[index], 0) < .85) window.dispatchEvent(new Event('lulu-visitor-changed'));
      lastProbe.current = embedding;
      const previous = recognized.current;
      const sameFace = !!previous && embedding.reduce((sum, value, index) => sum + value * previous.embedding[index], 0) >= .85;
      if (sameFace && Date.now() - previous.at < 40000) return;
      // A token refresh for the continuously visible face must not reset the conversation.
      if (previous && !sameFace) clearMatch();
      const response = await fetch('/api/lulu/memory/face/recognize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), body: JSON.stringify({ consent: true, model: FACE_MODEL, embedding }) });
      if (!response.ok) throw new Error(response.status === 429 ? 'Let’s pause for a moment before looking again.' : 'Recognition is unavailable right now. You can still talk with Ruru.');
      const result = await response.json() as Recognition;
      if (current !== generation.current) return;
      if (result.status === 'recognized' && result.name) {
        if (sameFace && previous.name !== result.name) clearMatch();
        recognized.current = { embedding, at: Date.now(), name: result.name };
        setStatus(`Welcome back, ${result.name}.${result.preferences?.length ? ` I remember: ${result.preferences.join(', ')}.` : ''}`);
        window.dispatchEvent(new CustomEvent('lulu-recognized', { detail: result }));
      } else {
        clearMatch();
        setStatus(result.status === 'uncertain' ? 'You look familiar, but I’m not sure. Please introduce yourself so I don’t get it wrong.' : 'I don’t recognize you yet. You can introduce yourself below.');
      }
    } catch (error) { if (current === generation.current && !controller.signal.aborted) { clearMatch(); setStatus(error instanceof Error ? error.message : 'Recognition is unavailable.'); } }
    finally { if (current === generation.current) { inFlight.current = false; recognizing.current = false; abort.current = null; } }
  }
  useEffect(() => {
    if (!enabled || !active) return;
    void recognize();
    const timer = window.setInterval(() => void recognize(), 5000);
    return () => window.clearInterval(timer);
  }, [enabled, active]);
  async function enroll() {
    if (!consent || !name.trim() || inFlight.current) return;
    inFlight.current = true; setBusy(true); const current = generation.current;
    const controller = new AbortController(); abort.current = controller;
    try {
      setStatus('Hold still for a moment while Ruru remembers your face…');
      const embedding = await sample();
      if (current !== generation.current) return;
      const session = await fetchMemory('/api/lulu/memory/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), body: JSON.stringify({ consent: true, purpose: 'profile' }) });
      if (!session.ok) throw new Error('Your memory session could not start.');
      const profileResponse = await fetchMemory('/api/lulu/memory/profile', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
      if (!profileResponse.ok) throw new Error('Your memory preferences could not be loaded.');
      const profile = await profileResponse.json();
      if (current !== generation.current) return;
      const response = await fetchMemory('/api/lulu/memory/face/enroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
        body: JSON.stringify({ consent: true, version: profile.profileVersion, model: FACE_MODEL, embedding, name: name.trim(), preferences: profile.personal?.preferences ?? [] }) });
      if (!response.ok) throw new Error('Your face was not saved. Please try again.');
      if (current !== generation.current) return;
      setEnrolled(true); setConsent(false); setStatus(`I’ll remember you, ${name.trim()}. You can remove this with Forget me.`);
      window.dispatchEvent(new Event('lulu-profile-changed'));
    } catch (error) { if (current === generation.current && !controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'Your face was not saved.'); }
    finally { if (current === generation.current) { setBusy(false); inFlight.current = false; abort.current = null; } }
  }
  if (!active) return null;
  return <div className="face-memory">
    <label className="style-consent"><input type="checkbox" checked={enabled} onChange={event => { if (event.target.checked) setEnabled(true); else clear(); }}/> Check whether Ruru remembers me</label>
    <p className="style-help">With this choice, a face signature is compared with consenting visitors. Video stays in your browser. Recognition never gives access to an account or email.</p>
    <details ref={enrollment}><summary>{enrolled ? 'Update how Ruru remembers me' : 'Let Ruru remember my face'}</summary>
      <label>What should Ruru call you?<input aria-label="Name for face memory" maxLength={40} value={name} disabled={busy} onChange={event => { setName(event.target.value); setConsent(false); }}/></label>
      <label className="style-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)}/> Remember my face and name so Ruru can recognize me next time.</label>
      <p className="style-help">Only a face signature is saved, not a photo. This does not sign you up for emails. Forget me removes it.</p>
      <button className="text-button" type="button" disabled={!consent || !name.trim() || busy} onClick={() => void enroll()}>{busy ? 'Remembering…' : 'Remember my face'}</button>
    </details>
    {status && <p role="status" data-face-memory-status>{status}</p>}
  </div>;
}
