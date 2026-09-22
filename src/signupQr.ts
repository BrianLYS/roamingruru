import QRCode from 'qrcode';
const hostedOrigin = 'https://roaminglulu.fraylabs.chatgpt.site';
export function signupUrl(origin: string) {
  const url = new URL(origin);
  // A phone cannot reach the laptop's loopback address. Local rehearsal links to
  // the existing hosted product; hosted use stays on the same allocated origin.
  const base = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? hostedOrigin : url.origin;
  return `${base}/?signup=1`;
}
let cached: { url: string; matrix: ReturnType<typeof QRCode.create>['modules'] } | undefined;
export function drawSignupQr(ctx: CanvasRenderingContext2D, url: string) {
  if (cached?.url !== url) cached = { url, matrix: QRCode.create(url, { errorCorrectionLevel: 'M' }).modules };
  const { size, data } = cached.matrix;
  const quiet = 4, cells = size + quiet * 2;
  const scale = Math.floor(Math.min(ctx.canvas.width, ctx.canvas.height) / cells);
  const x = Math.floor((ctx.canvas.width - cells * scale) / 2), y = Math.floor((ctx.canvas.height - cells * scale) / 2);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#000';
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (data[row * size + col]) ctx.fillRect(x + (col + quiet) * scale, y + (row + quiet) * scale, scale, scale);
  ctx.restore();
}
