import jpeg from 'jpeg-js';
/** Worker-safe decoding strips metadata without native binaries. The UI submits JPEG frames at most 1024px across. */
export async function sanitizeFrame(value: unknown) {
  if (typeof value !== 'string' || value.length > 4200000) throw new Error('Image too large.');
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error('Expected JPEG or PNG.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 12 || bytes.length > 3 * 1024 * 1024) throw new Error('Image too large.');
  if (match[1] !== 'jpeg' || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Use the reviewed, resized JPEG from Ruru.');
  const decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 2, maxMemoryUsageInMB: 32 });
  const scale=Math.min(1,1024/Math.max(decoded.width,decoded.height));
  const width=Math.max(1,Math.floor(decoded.width*scale)),height=Math.max(1,Math.floor(decoded.height*scale));
  const data=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=(Math.floor(y/scale)*decoded.width+Math.floor(x/scale))*4,target=(y*width+x)*4;
    for(let c=0;c<3;c++)data[target+c]=decoded.data[source+c];data[target+3]=255;
  }
  return `data:image/jpeg;base64,${jpeg.encode({width,height,data},80).data.toString('base64')}`;
}
