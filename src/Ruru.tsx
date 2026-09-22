import { useEffect, useRef } from 'react';
import { drawFace, initialPose, movePose, type Expression } from './face';
import { easeGaze, getAttention } from './attention';
export default function Ruru({ expression, large = false, qrUrl }: { expression: Expression; large?: boolean; qrUrl?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef(expression); current.current = expression;
  const qr = useRef(qrUrl); qr.current = qrUrl;
  const gaze = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    let frame = 0, last = 0, visible = true; const pose = initialPose(); const smooth = { x: 0, y: 0 };
    const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
    visibility.observe(ref.current!);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) { last = 0; return; }
      if (last && now - last < 1000 / 30) return;
      const dt = last ? Math.min((now - last) / 1000, .1) : .016; last = now;
      const target = reduced ? { x: 0, y: 0 } : getAttention() ?? gaze.current;
      easeGaze(smooth, target, dt);
      if (ref.current) { ref.current.dataset.gazeX = smooth.x.toFixed(3); ref.current.dataset.gazeY = smooth.y.toFixed(3); }
      movePose(pose, current.current, dt); drawFace(ctx!, pose, current.current, now / 1000, smooth, reduced, qr.current);
    }
    frame = requestAnimationFrame(draw); return () => { cancelAnimationFrame(frame); visibility.disconnect(); };
  }, []);
  return <div className={`screen-face ${large ? 'large' : ''}`} data-expression={expression} data-screen={qrUrl ? 'qr' : 'face'}>
    <canvas ref={ref} width={640} height={400} role="img" aria-label={qrUrl ? "Scan to join Ruru’s mailing list" : `Ruru’s screen face: ${expression}`} onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); gaze.current = { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: (event.clientY - rect.top) / rect.height * 2 - 1 }; }} onPointerLeave={() => { gaze.current = { x: 0, y: 0 }; }}/>
    <span className="screen-indicator"/>
  </div>;
}
