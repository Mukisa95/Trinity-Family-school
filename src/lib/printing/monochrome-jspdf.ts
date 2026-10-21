import type { jsPDF } from 'jspdf';
import { grayChannel, monochromeColor } from './monochrome';

/** Opt in once, before drawing. Also catches colours selected by autoTable callbacks. */
export function applyMonochromePDF<T extends jsPDF>(doc: T): T {
  for (const method of ['setTextColor', 'setDrawColor', 'setFillColor'] as const) {
    const original = doc[method].bind(doc) as (...args: any[]) => jsPDF;
    Object.assign(doc, { [method]: (...args: any[]) => {
      if (args.length === 1) return original(typeof args[0] === 'string' ? monochromeColor(args[0]) : args[0]);
      let channels = args.slice(0, 3).map(Number);
      if (args.length === 4) channels = channels.map(channel => 255 * (1 - channel) * (1 - Number(args[3])));
      else if (args.every(arg => typeof arg === 'string') && channels.every(channel => channel <= 1)) channels = channels.map(channel => channel * 255);
      return original(grayChannel(...channels as [number, number, number]));
    } });
  }
  doc.setTextColor('#000000'); doc.setDrawColor('#000000'); doc.setFillColor('#ffffff');
  return doc;
}
