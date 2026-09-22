import sharp from 'sharp';
export async function sanitizeFrame(value: unknown) {
  if (typeof value !== 'string' || value.length > 4200000) throw new Error('Use a JPEG or PNG under 3 MB.');
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error('Use a JPEG or PNG image.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 3 * 1024 * 1024 || bytes.length < 12) throw new Error('Use an image under 3 MB.');
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (match[1] === 'jpeg' ? !jpeg : !png) throw new Error('Image type does not match its contents.');
  // Decode with a pixel bound, re-encode, and strip EXIF/metadata. Never persist or cache frames.
  const sanitized = await sharp(bytes, { limitInputPixels: 12000000, failOn: 'error' }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${sanitized.toString('base64')}`;
}
