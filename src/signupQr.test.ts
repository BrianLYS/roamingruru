import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { drawSignupQr, signupUrl } from './signupQr';

describe('signup QR', () => {
  it('decodes the actual screen pixels to a phone-reachable URL without visitor credentials', () => {
    const width = 640, height = 400, pixels = new Uint8ClampedArray(width * height * 4);
    const ctx = { canvas: { width, height }, fillStyle: '', save() {}, restore() {}, setTransform() {},
      fillRect(x:number,y:number,w:number,h:number) { const shade = this.fillStyle === '#fff' ? 255 : 0; for(let r=y;r<y+h;r++)for(let c=x;c<x+w;c++){const i=(r*width+c)*4;pixels[i]=pixels[i+1]=pixels[i+2]=shade;pixels[i+3]=255;} }
    };
    const url = signupUrl('http://127.0.0.1:4317');
    drawSignupQr(ctx as unknown as CanvasRenderingContext2D, url);
    expect(jsQR(pixels,width,height)?.data).toBe('https://roaminglulu.fraylabs.chatgpt.site/?signup=1');
    expect([...new URL(url).searchParams.keys()]).toEqual(['signup']);
    expect(signupUrl('https://roaminglulu.fraylabs.chatgpt.site')).toBe(url);
  });
});
