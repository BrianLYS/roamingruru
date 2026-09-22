export const FACE_MODEL = 'human-mobileface-256-v1';
export type FaceSample = { count: number; embedding: number[] | null };
/** One inference at a time; stopping terminates inference and clears all local frames. */
export class FaceReader {
  private worker: Worker;
  private closed = false;
  private sequence = 0;
  private ready: Promise<void>;
  private rejectPending: ((reason: Error) => void) | undefined;
  constructor() {
    this.worker = new Worker('/vision/recognition/recognition-worker.js', { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { this.close(); reject(new Error('Face recognition could not load.')); }, 30000);
      this.rejectPending = (reason) => { clearTimeout(timer); reject(reason); };
      this.worker.onmessage = ({ data }) => { clearTimeout(timer); this.rejectPending = undefined; data.type === 'ready' ? resolve() : reject(new Error('Face recognition is unavailable in this browser.')); };
      this.worker.onerror = () => { clearTimeout(timer); reject(new Error('Face recognition is unavailable in this browser.')); };
      this.worker.postMessage({ type: 'init' });
    });
    // Loading can be cancelled before the first read starts.
    void this.ready.catch(() => undefined);
  }
  async read(source: HTMLVideoElement | HTMLCanvasElement): Promise<FaceSample> {
    await this.ready;
    if (this.closed) throw new Error('Camera stopped.');
    const frame = await createImageBitmap(source);
    if (this.closed) { frame.close(); throw new Error('Camera stopped.'); }
    return new Promise((resolve, reject) => {
      const sequence = ++this.sequence;
      const timer = window.setTimeout(() => { this.close(); reject(new Error('Face recognition took too long. Please try again.')); }, 20000);
      this.rejectPending = (reason) => { clearTimeout(timer); reject(reason); };
      this.worker.onmessage = ({ data }) => {
        clearTimeout(timer); this.rejectPending = undefined;
        if (data.type !== 'result' || data.sequence !== sequence) { reject(new Error('Face recognition is unavailable.')); return; }
        resolve({ count: data.count, embedding: data.embedding });
      };
      this.worker.postMessage({ type: 'frame', sequence, frame }, [frame]);
    });
  }
  close() { this.closed = true; this.worker.terminate(); this.rejectPending?.(new Error('Camera stopped.')); this.rejectPending = undefined; }
}
