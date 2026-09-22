import { expect, test, vi } from 'vitest';
import { fetchMemory } from './memorySession';
test('initial permission requests cannot issue competing browser cookies and errors do not block later choices', async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { release = resolve; });
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => pending).mockResolvedValue(new Response('{}'));
  try {
    const first = fetchMemory('/api/lulu/memory/session');
    const second = fetchMemory('/api/lulu/memory/session');
    await Promise.resolve(); expect(mock).toHaveBeenCalledTimes(1);
    release(new Response('{}')); await first; await second;
    expect(mock).toHaveBeenCalledTimes(2);
    mock.mockRejectedValueOnce(new Error('synthetic network failure'));
    await expect(fetchMemory('/api/lulu/memory/session')).rejects.toThrow();
    await expect(fetchMemory('/api/lulu/memory/session')).resolves.toBeInstanceOf(Response);
  } finally { mock.mockRestore(); }
});
