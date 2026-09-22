import { useEffect, useRef, useState } from 'react';
import type { Interest } from './discovery';
import { fetchMemory } from './memorySession';
type Snapshot = { state: 'empty' | 'revoked' | 'remembered'; interest?: Interest; version?: number };
export function useVisitorMemory(onReturn: (interest: Interest) => void, onForget: () => void, onClear: () => void) {
  const [saved, setSaved] = useState<Interest | null>(null);
  const [busy, setBusy] = useState(true);
  const [intent, setIntent] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const permission = useRef(false);
  const version = useRef(0);
  const touched = useRef(false);
  const lastAction = useRef<() => Promise<void>>(async () => {});
  async function request(path = '', data?: unknown): Promise<Snapshot> {
    const response = await fetchMemory(`/api/lulu/memory${path}`, { ...(data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), signal: AbortSignal.timeout(12000) });
    const value = await response.json(); if (typeof value.version === 'number') version.current = value.version; if (!response.ok) throw new Error(value.error || 'Memory is unavailable. Please retry.'); return value;
  }
  function run(action: () => Promise<Snapshot>, returned = false, forgotten = false, choice: boolean | null = null, cleared = false) {
    if (forgotten) window.dispatchEvent(new Event('lulu-forgetting'));
    const current = ++generation.current; setBusy(true); setError(''); setIntent(choice);
    const work = async () => {
      try {
        const value = await action();
        if (current !== generation.current) return;
        const next = value.state === 'remembered' ? value.interest! : null;
        permission.current = !!next; setSaved(next);
        if (returned && next && !touched.current) onReturn(next);
        if (forgotten) onForget();
        if (cleared) onClear();
      } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Memory is unavailable. Please retry.'); }
      finally { if (forgotten) window.dispatchEvent(new Event('lulu-forget-settled')); if (current === generation.current) { setBusy(false); setIntent(null); } }
    };
    lastAction.current = async () => { await run(action, returned, forgotten, choice, cleared); };
    const promise = queue.current.then(work, work); queue.current = promise; return promise;
  }
  useEffect(() => {
    try { localStorage.removeItem('roaminglulu-interest'); } catch { /* Legacy preferences are not migrated. */ }
    void run(() => request(), true);
    return () => { generation.current++; };
  }, []);
  return {
    saved, busy, error, checked: intent ?? saved !== null,
    touch() { touched.current = true; },
    consent(interest: Interest) { touched.current = true; return run(async () => { await request('/session', { consent: true, interest }); return request('/consent', { consent: true, interest, version: version.current }); }, false, false, true); },
    save(interest: Interest) { touched.current = true; if (permission.current) void run(() => request('/save', { interest, version: version.current })); },
    async forget() { touched.current = true; permission.current = false; await run(() => request('/forget', {}), false, true, false); },
    refresh() { return run(() => request()); },
    clear() { touched.current = true; permission.current = false; return run(() => request('/clear-interest', { version: version.current }), false, false, false, true); },
    retry() { void lastAction.current(); },
  };
}
