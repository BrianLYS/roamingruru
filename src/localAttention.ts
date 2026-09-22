import { AttentionTarget, getAttention, setAttention, type FaceBox } from './attention';
export type AttentionStatus = 'loading' | 'looking' | 'following' | 'unavailable';
export function startLocalAttention(video: HTMLVideoElement, onStatus: (status: AttentionStatus) => void) {
  let stopped = false, ready = false, inFlight = false, sequence = 0, lastVideoTime = -1;
  let timer = 0, watchdog = 0;
  let worker: Worker | null = null;
  const target = new AttentionTarget();
  function stop() {
    stopped = true; clearTimeout(timer); clearTimeout(watchdog); worker?.terminate(); worker = null; target.reset(); setAttention(null);
  }
  function failed() { if (stopped) return; stop(); onStatus('unavailable'); }
  async function sample() {
    if (stopped || !ready || inFlight) return;
    if (document.hidden) { stop(); return; }
    if (video.readyState < 2 || !video.videoWidth || video.currentTime === lastVideoTime) { if (!getAttention()) onStatus('looking'); timer = window.setTimeout(sample, 100); return; }
    inFlight = true; lastVideoTime = video.currentTime;
    watchdog = window.setTimeout(failed, 3000);
    try {
      const frame = await createImageBitmap(video, { resizeWidth: 320, resizeHeight: Math.max(1, Math.round(320 * video.videoHeight / video.videoWidth)) });
      if (stopped || !worker) { frame.close(); return; }
      try { worker.postMessage({ type: 'frame', sequence: ++sequence, frame }, [frame]); }
      catch { frame.close(); failed(); }
    } catch { failed(); }
  }
  onStatus('loading'); setAttention(null);
  try {
    worker = new Worker('/vision/attention-worker.js', { type: 'module' });
    worker.onerror = failed;
    worker.onmessage = ({ data }) => {
      if (stopped) return;
      if (data.type === 'error') { failed(); return; }
      if (data.type === 'ready') {
        if (ready) return;
        clearTimeout(watchdog); ready = true; onStatus('looking'); void sample();
      } else if (data.type === 'faces' && inFlight && data.sequence === sequence && Array.isArray(data.boxes)) {
        clearTimeout(watchdog); inFlight = false;
        const gaze = target.update(data.boxes as FaceBox[], performance.now()); setAttention(gaze);
        onStatus(gaze ? 'following' : 'looking');
        timer = window.setTimeout(sample, 125); // At most 8 Hz, one transferred frame at a time.
      }
    };
    watchdog = window.setTimeout(failed, 15000); worker.postMessage({ type: 'init' });
  } catch { failed(); }
  return stop;
}
