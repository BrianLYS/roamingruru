export type FaceBox = { x: number; y: number; width: number; height: number; score: number };
export type Gaze = { x: number; y: number };
const clamp = (n: number) => Math.max(-1, Math.min(1, n));
// Geometric continuity within this camera session only. No identity or embeddings.
export class AttentionTarget {
  private previous: FaceBox | null = null;
  private seenAt = 0;
  reset() { this.previous = null; this.seenAt = 0; }
  update(boxes: FaceBox[], now: number): Gaze | null {
    const valid = boxes.filter(b => b && typeof b === 'object' && [b.x, b.y, b.width, b.height, b.score].every(Number.isFinite) && b.score >= .65 && b.width > .03 && b.height > .03 && b.width <= 1 && b.height <= 1 && b.x >= -.1 && b.y >= -.1 && b.x + b.width <= 1.1 && b.y + b.height <= 1.1);
    const center = (b: FaceBox) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    let next: FaceBox | undefined;
    if (this.previous && now - this.seenAt <= 600) {
      const old = center(this.previous); const area = this.previous.width * this.previous.height;
      next = valid.filter(b => { const c = center(b); const ratio = b.width * b.height / area; return Math.hypot(c.x - old.x, c.y - old.y) < .25 && ratio > .3 && ratio < 3; })
        .sort((a, b) => Math.hypot(center(a).x - old.x, center(a).y - old.y) - Math.hypot(center(b).x - old.x, center(b).y - old.y))[0];
      if (!next) return this.gaze(); // Brief dropout; don't switch immediately to a bystander.
    } else {
      next = valid.sort((a, b) => b.width * b.height - a.width * a.height || Math.abs(center(a).x - .5) - Math.abs(center(b).x - .5) || a.x - b.x)[0];
    }
    if (!next) { this.reset(); return null; }
    this.previous = next; this.seenAt = now; return this.gaze();
  }
  private gaze(): Gaze | null {
    if (!this.previous) return null;
    return { x: clamp(1 - 2 * (this.previous.x + this.previous.width / 2)), y: clamp(2 * (this.previous.y + this.previous.height / 2) - 1) };
  }
}
let live: { gaze: Gaze; at: number } | null = null;
export function setAttention(gaze: Gaze | null) { live = gaze ? { gaze, at: performance.now() } : null; }
export function getAttention(): Gaze | null { return live && performance.now() - live.at < 900 ? live.gaze : null; }
export function easeGaze(current: Gaze, target: Gaze, dt: number) {
  const amount = 1 - Math.exp(-8 * Math.max(0, Math.min(.1, dt)));
  current.x += (target.x - current.x) * amount; current.y += (target.y - current.y) * amount;
}
