// Profile, email and conversation permission share one browser cookie. Serialize
// first-session issuance so simultaneous choices cannot create competing owners.
let issuance: Promise<unknown> = Promise.resolve();
export function fetchMemory(path: string, init?: RequestInit) {
  if (path !== '/api/lulu/memory/session') return fetch(path, init);
  const next = issuance.then(() => fetch(path, init), () => fetch(path, init));
  issuance = next.catch(() => undefined);
  return next;
}
