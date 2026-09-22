import { drawSignupQr } from './signupQr';
export type Expression = 'curious' | 'happy' | 'listening' | 'speaking' | 'thinking' | 'surprised';
export const expressions: { id: Expression; label: string; description: string }[] = [
  { id: 'curious', label: 'Curious', description: 'A little head tilt, wandering gaze' },
  { id: 'happy', label: 'Delighted', description: 'Smiling eyes and a beaming grin' },
  { id: 'listening', label: 'Listening', description: 'Wide eyes, fully paying attention' },
  { id: 'speaking', label: 'Talking', description: 'Animated mouth and lively eyes' },
  { id: 'thinking', label: 'Thinking', description: 'A quiet glance while she thinks' },
  { id: 'surprised', label: 'Oh!', description: 'Big round eyes and a little gasp' },
];
export type FacePose = { eyeHeight: number; eyeWidth: number; smile: number; openness: number; tilt: number; gazeX: number; gazeY: number; happy: number; brow: number };
const poses: Record<Expression, FacePose> = {
  curious: { eyeHeight: 45, eyeWidth: 29, smile: 19, openness: 0, tilt: -.055, gazeX: 0, gazeY: 0, happy: 0, brow: -10 },
  happy: { eyeHeight: 30, eyeWidth: 33, smile: 35, openness: 19, tilt: .025, gazeX: 0, gazeY: 0, happy: 1, brow: -19 },
  listening: { eyeHeight: 51, eyeWidth: 32, smile: 10, openness: 0, tilt: .035, gazeX: 0, gazeY: -4, happy: 0, brow: -17 },
  speaking: { eyeHeight: 43, eyeWidth: 29, smile: 23, openness: 17, tilt: 0, gazeX: 0, gazeY: 0, happy: 0, brow: -9 },
  thinking: { eyeHeight: 28, eyeWidth: 29, smile: 0, openness: 0, tilt: -.075, gazeX: 18, gazeY: -12, happy: 0, brow: -6 },
  surprised: { eyeHeight: 58, eyeWidth: 39, smile: 0, openness: 28, tilt: 0, gazeX: 0, gazeY: -3, happy: 0, brow: -25 },
};
export function initialPose(): FacePose { return { ...poses.curious }; }
export function movePose(pose: FacePose, expression: Expression, dt: number) {
  const amount = 1 - Math.exp(-Math.min(dt, .1) * 9);
  for (const key of Object.keys(pose) as (keyof FacePose)[]) pose[key] += (poses[expression][key] - pose[key]) * amount;
}
export function drawFace(ctx: CanvasRenderingContext2D, pose: FacePose, expression: Expression, time: number, gaze = { x: 0, y: 0 }, reduced = false, qrUrl?: string) {
  if (qrUrl) { drawSignupQr(ctx, qrUrl); return; }
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h); ctx.save(); ctx.scale(w / 640, h / 400);
  const background = ctx.createRadialGradient(320, 175, 10, 320, 200, 390);
  background.addColorStop(0, '#24352f'); background.addColorStop(1, '#101b19');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 640, 400);
  // Quiet glass grain: fixed scan lines, no flicker.
  ctx.fillStyle = '#d0ffe903'; for (let y = 0; y < 400; y += 4) ctx.fillRect(0, y, 640, 1);
  ctx.translate(320, 197); ctx.rotate(pose.tilt + (reduced ? 0 : Math.sin(time * 1.1) * .012));
  // Uneven spacing and an occasional double blink, without frame-to-frame randomness.
  const cycle = time % 13.7;
  const blinkDistance = Math.min(...[3.8, 9.9, 10.24].map(at => Math.abs(cycle - at)));
  const blink = reduced || blinkDistance > .115 ? 1 : Math.max(.07, blinkDistance / .115);
  const lookX = pose.gazeX + gaze.x * 26 + (reduced ? 0 : Math.sin(time * .63) * 4);
  const lookY = pose.gazeY + gaze.y * 14;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * 111 + lookX, -24 + lookY);
    ctx.fillStyle = '#e8f4d2'; ctx.strokeStyle = '#e8f4d2'; ctx.shadowColor = '#c8e0a4'; ctx.shadowBlur = 11;
    if (pose.happy > .55) {
      ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-29, 4); ctx.quadraticCurveTo(0, -32 * pose.happy, 29, 4); ctx.stroke();
    } else {
      const height = Math.max(3, pose.eyeHeight * blink * (expression === 'curious' && side === -1 ? .86 : 1));
      ctx.beginPath(); ctx.ellipse(0, 0, pose.eyeWidth, height, 0, 0, Math.PI * 2); ctx.fill();
      if (height > 10) { ctx.shadowBlur = 0; ctx.fillStyle = '#ffffffc9'; ctx.beginPath(); ctx.ellipse(-7, -height * .44, 7, 10, -.2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.shadowBlur = 0; ctx.strokeStyle = '#bdddb899'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-21, -64 + pose.brow + (side === -1 ? -pose.tilt * 60 : 0)); ctx.quadraticCurveTo(0, -71 + pose.brow, 20, -64 + pose.brow); ctx.stroke(); ctx.restore();
    const blush = ctx.createRadialGradient(side * 148, 42, 2, side * 148, 42, 30);
    blush.addColorStop(0, pose.happy > .5 ? '#ffad9b70' : '#efa39040'); blush.addColorStop(1, '#efa39000');
    ctx.fillStyle = blush; ctx.fillRect(side * 148 - 30, 12, 60, 60);
  }
  ctx.save(); ctx.translate(lookX * .3, 52 + lookY * .2);
  ctx.strokeStyle = '#f4c0a4'; ctx.fillStyle = '#f4c0a4'; ctx.shadowColor = '#ffb68d'; ctx.shadowBlur = 7; ctx.lineWidth = 8;
  const talk = expression === 'speaking' && !reduced ? Math.abs(Math.sin(time * 12)) * 21 + Math.abs(Math.sin(time * 7)) * 8 : 0;
  if (expression === 'surprised') { ctx.beginPath(); ctx.ellipse(0, 10, 18, Math.max(4, pose.openness), 0, 0, Math.PI * 2); ctx.stroke(); }
  else if (pose.openness + talk > 8) {
    ctx.beginPath(); ctx.moveTo(-29, 0); ctx.quadraticCurveTo(0, 14, 29, 0); ctx.quadraticCurveTo(24, pose.openness + talk + 18, 0, pose.openness + talk + 18); ctx.quadraticCurveTo(-24, pose.openness + talk + 18, -29, 0); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#23342d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-17, 12); ctx.quadraticCurveTo(0, 17, 17, 12); ctx.stroke();
  } else { ctx.beginPath(); ctx.moveTo(-25, 6); ctx.quadraticCurveTo(0, 6 + pose.smile, 25, 6); ctx.stroke(); }
  ctx.restore(); ctx.restore();
}
