import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FACE_MODEL, FaceReader } from './faceRecognition';
import { startLocalAttention } from './localAttention';
export type CameraSenses = { image?: string; model?: string; embedding?: number[] };
export type AgentCameraHandle = { capture: () => Promise<CameraSenses | undefined>; stop: () => void };

// A single visitor-enabled camera supplies fresh tool inputs for each conversation turn.
// Neither video nor face vectors are placed in chat history or sent to the language model.
const AgentCamera = forwardRef<AgentCameraHandle, { open: boolean; onStarted: () => void; onStopped: () => void; onClose: () => void; onVisitorChanged: (duringCapture: boolean) => void }>(function AgentCamera({ open, onStarted, onStopped, onClose, onVisitorChanged }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const reader = useRef<FaceReader | null>(null);
  const attention = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const capturing = useRef(false);
  const callbacks = useRef({ onStarted, onStopped, onVisitorChanged }); callbacks.current = { onStarted, onStopped, onVisitorChanged };
  const previousFace = useRef<number[] | null>(null);
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  function release(notify = true) {
    generation.current++; previousFace.current = null;
    const source = stream.current; stream.current = null;
    source?.getTracks().forEach(track => track.stop());
    reader.current?.close(); reader.current = null;
    attention.current?.(); attention.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false); setPending(false);
    if (source && notify) callbacks.current.onStopped();
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) release(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); release(false); };
  }, []);
  async function start() {
    release(); const current = generation.current; setPending(true); setError('');
    try {
      const source = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      if (current !== generation.current) { source.getTracks().forEach(track => track.stop()); return; }
      stream.current = source; setActive(true);
      if (!video.current) throw new Error('Camera preview unavailable.');
      video.current.srcObject = source; await video.current.play();
      if (video.current.readyState < 2) await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => { cleanup(); reject(new Error('Camera did not become ready.')); }, 8000);
        const ready = () => { cleanup(); resolve(); };
        const cleanup = () => { clearTimeout(timer); video.current?.removeEventListener('loadeddata', ready); };
        video.current!.addEventListener('loadeddata', ready, { once: true });
      });
      if (current !== generation.current) return;
      setPending(false);
      reader.current = new FaceReader();
      attention.current = startLocalAttention(video.current!, status => { if (status === 'looking' && previousFace.current) { previousFace.current = null; callbacks.current.onVisitorChanged(capturing.current); } });
      source.getTracks().forEach(track => { track.onended = () => { if (current === generation.current) release(); }; });
      callbacks.current.onStarted();
    } catch { if (current === generation.current) { release(); setError('Camera unavailable. You can keep talking or typing.'); } }
  }
  async function capture(): Promise<CameraSenses | undefined> {
    const player = video.current;
    if (!stream.current || !player || player.readyState < 2 || capturing.current) return;
    capturing.current = true; const current = generation.current;
    try {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 640 / Math.max(player.videoWidth, player.videoHeight));
      canvas.width = Math.round(player.videoWidth * ratio); canvas.height = Math.round(player.videoHeight * ratio);
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.drawImage(player, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', .65);
      let embedding: number[] | null = null;
      try { reader.current ??= new FaceReader(); const sample = await reader.current.read(canvas); if (sample.count === 1) embedding = sample.embedding; }
      catch { reader.current?.close(); reader.current = null; }
      if (current !== generation.current) return;
      if (previousFace.current && (!embedding || embedding.reduce((sum, value, index) => sum + value * previousFace.current![index], 0) < .85)) callbacks.current.onVisitorChanged(true);
      previousFace.current = embedding;
      return { ...(image.length < 400000 ? { image } : {}), ...(embedding ? { model: FACE_MODEL, embedding } : {}) };
    } finally { capturing.current = false; }
  }
  useImperativeHandle(ref, () => ({ capture, stop: () => release() }));
  return <div className="agent-camera" hidden={!open && !active} role="region" aria-label="Ruru’s camera">
    <video ref={video} autoPlay muted playsInline hidden={!active} aria-label="Live camera preview"/>
    {!active && <p>Let Ruru see your clothes and recognize or remember your face during this demo.</p>}
    <div>{!active ? <button className="text-button" disabled={pending} onClick={() => void start()}>{pending ? 'Starting camera…' : 'Start camera'}</button> : <button className="text-button" onClick={() => release()}>Stop camera</button>}
    <button className="text-button" onClick={() => { release(); onClose(); }}>Close</button></div>
    {error && <p role="status">{error}</p>}
  </div>;
});
export default AgentCamera;
