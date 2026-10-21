import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { monochromeColor, monochromeStyle } from '../src/lib/printing/monochrome';
import { applyMonochromePDF } from '../src/lib/printing/monochrome-jspdf';

test('monochrome styles preserve layout, contrast, alpha, nested overrides and original inputs', () => {
  const source = [{ width: 42, border: '1 solid #f00', color: '#ffffff', backgroundColor: '#1e40af' }, [{ color: 'rgba(200, 20, 40, 0.4)', marginTop: 7 }]];
  const original = structuredClone(source), result = monochromeStyle(source);
  assert.equal((result[0] as any).width, 42);
  assert.equal((result[0] as any).border, '1 solid #4c4c4c');
  assert.equal((result[0] as any).color, '#ffffff');
  assert.equal((result[1] as any)[0].marginTop, 7);
  assert.match((result[1] as any)[0].color, /^rgba\((\d+), \1, \1, 0.4\)$/);
  assert.equal(monochromeColor('#ff000080'), '#4c4c4c80');
  assert.deepEqual(source, original);
});

test('PDF colour overrides cover table callbacks and all RGB/CMYK setter paths without changing text', () => {
  const doc = applyMonochromePDF(new jsPDF());
  doc.setTextColor(220, 38, 38); doc.text('Unpaid UGX 75,000', 12, 12);
  doc.setFillColor('0.2', '0.7', '0.1'); doc.rect(12, 15, 10, 5, 'F');
  doc.setDrawColor(0, 1, 0, 0); doc.line(12, 20, 22, 20);
  autoTable(doc, { startY: 30, head: [['Pupil', 'Balance']], body: [['Example Alice', '75,000']], headStyles: { fillColor: [30, 64, 175] }, didParseCell: cell => { if (cell.section === 'body') cell.cell.styles.textColor = [5, 150, 105]; } });
  const commands = String(doc.internal.pages);
  assert.ok(commands.includes('Example Alice') && commands.includes('75,000'));
  assert.equal(/(?:^|\n)[\d.]+ [\d.]+ [\d.]+ (?:rg|RG)\b/.test(commands), false, 'RGB colour commands must be replaced with grayscale');
  assert.equal(/(?:^|\n)[\d.]+ [\d.]+ [\d.]+ [\d.]+ (?:k|K)\b/.test(commands), false, 'CMYK colour commands must be replaced with grayscale');
});
