import { useEffect, useRef, useState } from 'react';
import { createMall, type MallInput, type MallEvent } from './world';
import type { VisitorId } from './visitors';
export default function MallScene({ input, onEvent, onSelect, onExplore }: { input: MallInput; onEvent: (event: MallEvent) => void; onSelect: (id: VisitorId) => void; onExplore: () => void }) {
  const host = useRef<HTMLDivElement>(null); const current = useRef(input); current.current = input;
  const callbacks = useRef({ onEvent, onSelect, onExplore }); callbacks.current = { onEvent, onSelect, onExplore };
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    try { return createMall(host.current, current, event => callbacks.current.onEvent(event), id => callbacks.current.onSelect(id), () => setError(true), () => callbacks.current.onExplore()); }
    catch { setError(true); }
  }, []);
  return <><div className="mall-canvas" ref={host} data-testid="mall-world"/>{error && <div className="webgl-fallback" role="alert"><strong>The 3D mall needs WebGL.</strong><p>Try a browser with graphics acceleration. Ruru’s face and conversation still work in the Face only view.</p></div>}</>;
}
