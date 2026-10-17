import { createBlankPage, makeStudioId, normalizePdfCutout, type CustomPhotoPage, type PdfArtwork, type StudioPdfSource } from './custom-photo-types';

export const MAX_PDF_IMPORT_PAGES = 20;

export function parsePdfPageRange(value: string, count: number): number[] {
  const pages = new Set<number>();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Enter page numbers such as 1-3, 5.');
    const from = Number(match[1]), to = Number(match[2] || match[1]);
    if (from < 1 || to < from || to > count) throw new Error(`Choose pages between 1 and ${count}, in ascending ranges.`);
    if (to - from >= MAX_PDF_IMPORT_PAGES) throw new Error(`Import up to ${MAX_PDF_IMPORT_PAGES} pages at a time.`);
    for (let page = from; page <= to; page++) pages.add(page);
    if (pages.size > MAX_PDF_IMPORT_PAGES) throw new Error(`Import up to ${MAX_PDF_IMPORT_PAGES} pages at a time.`);
  }
  return [...pages].sort((a, b) => a - b);
}

export async function openStudioPdf(file: File) {
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a PDF smaller than 25 MB.');
  if (file.size === 0) throw new Error('This PDF is empty.');
  const pdfjs = await import('pdfjs-dist');
  // PDF.js ships a nonempty relative default which is not a Next.js asset URL.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  // The source is artwork, not an interactive form editor. Requesting a password
  // here would leave the import pending; users can supply an unlocked copy.
  let needsPassword = false;
  task.onPassword = () => { needsPassword = true; void task.destroy(); };
  try {
    const document = await task.promise;
    return { numPages: document.numPages, getPage: (number: number) => document.getPage(number), destroy: () => task.destroy() };
  }
  catch (error) {
    await task.destroy();
    if (needsPassword || (error instanceof Error && /password/i.test(error.message))) throw new Error('This PDF is password protected. Import an unlocked copy.');
    throw new Error('This file could not be opened as a PDF. Try exporting it again.');
  }
}

export type StudioPdfDocument = Awaited<ReturnType<typeof openStudioPdf>>;

export async function importStudioPdfPages(doc: StudioPdfDocument, file: File, numbers: number[], onProgress: (value: string) => void) {
  const sourceId = makeStudioId('pdf');
  const pages: CustomPhotoPage[] = [];
  for (const number of numbers) {
    onProgress(`Importing page ${pages.length + 1} of ${numbers.length}…`);
    const page = await doc.getPage(number);
    const original = page.getViewport({ scale: 1 });
    if (!Number.isFinite(original.width + original.height) || original.width < 1 || original.height < 1) throw new Error(`Page ${number} has an invalid size.`);
    if (Math.max(original.width, original.height) * 25.4 / 72 > 1000) throw new Error(`Page ${number} is larger than the studio's 1 metre page limit.`);
    const scale = Math.min(3, 2600 / Math.max(original.width, original.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('The browser could not prepare the PDF artwork.');
    try {
      await page.render({ canvasContext: context, canvas, viewport, background: 'rgba(0,0,0,0)' }).promise;
      pages.push({ ...createBlankPage(pages.length), name: `${file.name} · ${number}`, layers: [], pdfArtwork: {
        sourceId, fileName: file.name, pageNumber: number, image: canvas.toDataURL('image/png'),
        widthMm: original.width * 25.4 / 72, heightMm: original.height * 25.4 / 72, cutouts: [],
      } });
    } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The original PDF could not be retained.'));
    reader.readAsDataURL(file);
  });
  const source: StudioPdfSource = { id: sourceId, name: file.name, dataUrl };
  return { pages, source };
}

/** Same subtractive geometry as the SVG preview, including overlapping openings. */
export function paintPdfCutouts(context: CanvasRenderingContext2D, artwork: PdfArtwork, width: number, height: number) {
  context.save();
  context.globalCompositeOperation = 'destination-out';
  for (const value of artwork.cutouts) {
    const cutout = normalizePdfCutout(value);
    context.beginPath();
    if (cutout.shape === 'oval') context.ellipse((cutout.x + cutout.width / 2) * width, (cutout.y + cutout.height / 2) * height, cutout.width * width / 2, cutout.height * height / 2, 0, 0, Math.PI * 2);
    else context.rect(cutout.x * width, cutout.y * height, cutout.width * width, cutout.height * height);
    context.fill();
  }
  context.restore();
}
