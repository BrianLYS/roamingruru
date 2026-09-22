import { expect, test, vi } from 'vitest';
import { AttentionTarget, easeGaze, getAttention, setAttention } from './attention';
const face = (x: number, width = .2) => ({ x, y: .2, width, height: width, score: .9 });
test('geometric attention keeps its target through distractors and short dropouts, then forgets it', () => {
  const target = new AttentionTarget();
  expect(target.update([face(.1)], 1000)?.x).toBeCloseTo(.6);
  expect(target.update([face(.6, .3), face(.12)], 1125)?.x).toBeCloseTo(.56);
  expect(target.update([face(.6, .3)], 1300)?.x).toBeCloseTo(.56);
  expect(target.update([], 1800)).toBeNull();
  expect(target.update([face(.6, .3)], 2000)?.x).toBeCloseTo(-.5);
  target.reset(); expect(target.update([], 2001)).toBeNull();
});
test('attention ignores invalid/low-confidence detections and clamps smooth gaze', () => {
  const target = new AttentionTarget();
  expect(target.update([{ ...face(.1), score: .2 }, { ...face(NaN) }], 1000)).toBeNull();
  const gaze = { x: 0, y: 0 }; easeGaze(gaze, { x: 1, y: -1 }, .05);
  expect(gaze.x).toBeGreaterThan(0); expect(gaze.x).toBeLessThan(1); expect(gaze.y).toBe(-gaze.x);
});
test('shared attention expires without further detections and can be cleared immediately', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  try {
    setAttention({ x: .5, y: 0 }); expect(getAttention()?.x).toBe(.5);
    clock.mockReturnValue(1901); expect(getAttention()).toBeNull();
    setAttention({ x: .5, y: 0 }); setAttention(null); expect(getAttention()).toBeNull();
  } finally { clock.mockRestore(); setAttention(null); }
});
