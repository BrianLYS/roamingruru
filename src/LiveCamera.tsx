import { useEffect, useRef, useState } from 'react';
import { startLocalAttention, type AttentionStatus } from './localAttention';
import Ruru from './Ruru';
import FaceMemory from './FaceMemory';
export default function LiveCamera({ onFrame, onStop }: { onFrame: (frame: string) => void; onStop?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const stopAttention = useRef<(() => void) | null>(null);
  const [attention, setAttention] = useState<AttentionStatus>('loading');
  const previousAttention = useRef<AttentionStatus>('loading');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const callbacks = useRef({ onFrame, onStop }); callbacks.current = { onFrame, onStop };
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  function stop() {
    generation.current++; previousAttention.current = 'loading'; window.dispatchEvent(new Event('lulu-camera-stopped'));
    stopAttention.current?.(); stopAttention.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false); setPending(false); setReady(false); callbacks.current.onStop?.();
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    const details = host.current?.closest('details');
    const collapsed = () => { if (details && !details.open) stop(); };
    details?.addEventListener('toggle', collapsed);
    window.addEventListener('lulu-forgetting', stop); window.addEventListener('lulu-forgotten', stop); window.addEventListener('lulu-new-conversation', stop); document.addEventListener('visibilitychange', hidden);
    return () => { generation.current++; window.dispatchEvent(new Event('lulu-camera-stopped')); stopAttention.current?.(); stream.current?.getTracks().forEach(track => track.stop()); if (video.current) video.current.srcObject = null; details?.removeEventListener('toggle', collapsed); window.removeEventListener('lulu-forgetting', stop); window.removeEventListener('lulu-forgotten', stop); window.removeEventListener('lulu-new-conversation', stop); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  async function start() {
    stop(); setPending(true); setError(''); const current = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable. You can describe your outfit below.');
      const source = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } } });
      if (current !== generation.current) { source.getTracks().forEach(track => track.stop()); return; }
      stream.current = source; setActive(true); setPending(false);
      if (video.current) { video.current.srcObject = source; await video.current.play(); }
      if (current !== generation.current) return;
      window.dispatchEvent(new Event('lulu-camera-started'));
      if (video.current) stopAttention.current = startLocalAttention(video.current, status => {
        if (current !== generation.current) return;
        if (previousAttention.current === 'following' && status === 'looking') window.dispatchEvent(new Event('lulu-visitor-changed'));
        previousAttention.current = status; setAttention(status);
      });
      source.getVideoTracks().forEach(track => { track.onended = () => { if (current === generation.current) stop(); }; });
    } catch (cause) {
      if (current !== generation.current) return;
      stop(); setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Camera permission was declined. You can describe your outfit below.' : 'The camera could not start. You can describe your outfit below.');
    }
  }
  function sample() {
    const player = video.current; if (!player || !ready || !stream.current) return;
    const ratio = Math.min(1, 1024 / Math.max(player.videoWidth, player.videoHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(player.videoWidth * ratio); canvas.height = Math.round(player.videoHeight * ratio);
    const ctx = canvas.getContext('2d'); if (!ctx) { setError('This browser cannot capture a frame. Describe your outfit below.'); return; }
    try { ctx.drawImage(player, 0, 0, canvas.width, canvas.height); callbacks.current.onFrame(canvas.toDataURL('image/jpeg', .8)); }
    catch { setError('This view could not be captured. Try again or describe your outfit below.'); }
  }
  return <div className="live-camera" ref={host}>
    <p className="style-help">Start the camera to let Ruru follow your position with her eyes. Video stays in this browser. Face recognition and sharing a clothing frame are separate choices below.</p>
    <video ref={video} autoPlay muted playsInline aria-label="Live camera preview" hidden={!active} onLoadedData={() => setReady(true)} style={{ width: '100%', maxHeight: 260, borderRadius: 10, objectFit: 'contain', background: '#15271f', transform: 'scaleX(-1)' }}/>
    {active && <div className="camera-attention" data-attention-status={attention}><div aria-label="Ruru’s gaze preview"><Ruru expression="curious"/></div><p role="status">{attention === 'loading' ? 'Waking up Ruru’s eyes…' : attention === 'following' ? reduced ? 'A face is in view. Reduced motion keeps Ruru’s eyes still.' : 'Ruru is following your position.' : attention === 'looking' ? 'Come into view so Ruru can look your way.' : 'Eye following is unavailable in this browser. Camera capture and conversation still work.'}</p></div>}
    <div className="style-action-row">{!active && <button type="button" className="text-button" onClick={() => void start()} disabled={pending}>{pending ? 'Starting camera…' : 'Start camera'}</button>}{active && <button type="button" className="text-button" onClick={sample} disabled={!ready}>Use this view</button>}{(active || pending) && <button type="button" className="text-button" onClick={stop}>Stop camera</button>}</div>
    <FaceMemory video={video} active={active && ready} attention={attention}/>
    {error && <p role="status">{error}</p>}
  </div>;
}
