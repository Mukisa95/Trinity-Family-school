import { grayChannel } from './monochrome';

/** Convert images locally, preserving dimensions and alpha; never alter the saved photo. */
export async function monochromeImage(source: string | Blob): Promise<string> {
  if (typeof document === 'undefined') throw new Error('Monochrome document images must be prepared in the browser.');
  const blob = typeof source === 'string' ? await (async () => {
    const response = await fetch(source);
    if (!response.ok) throw new Error('Could not load an image for the black and white document.');
    return response.blob();
  })() : source;
  // SVG logos need the browser image decoder on engines that cannot bitmap an SVG.
  const decoded = typeof createImageBitmap === 'function'
    ? createImageBitmap(blob) : Promise.reject(new Error('Bitmap decoding is unavailable.'));
  const bitmap = await decoded.catch(async () => {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally { URL.revokeObjectURL(url); }
  });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare a black and white document image.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = grayChannel(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = gray;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  } finally { if ('close' in bitmap) bitmap.close(); }
}
