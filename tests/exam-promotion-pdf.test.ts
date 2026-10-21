import { test, before, after } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
// Serve image cards over HTTP: the PDF renderer interprets Windows drive paths as URLs.
let bespokeGenerator: typeof import('../src/components/exam/FullReport2PDF').generateFullReport2PDF;
const assets = createServer(async (req, res) => {
  try {
    const file = path.basename(decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname));
    const bytes = await readFile(path.join(process.cwd(), 'public/Full Upp', file));
    res.setHeader('Content-Type', 'image/png'); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
const previousAssetBase = process.env.FULL_REPORT_2_ASSET_BASE_URL;
before(async () => {
  await new Promise<void>(resolve => assets.listen(0, '127.0.0.1', resolve));
  const address = assets.address() as { port: number };
  process.env.FULL_REPORT_2_ASSET_BASE_URL = 'http://127.0.0.1:' + address.port;
  bespokeGenerator = (await import('../src/components/exam/FullReport2PDF')).generateFullReport2PDF;
});
after(async () => {
  if (previousAssetBase === undefined) delete process.env.FULL_REPORT_2_ASSET_BASE_URL;
  else process.env.FULL_REPORT_2_ASSET_BASE_URL = previousAssetBase;
  await new Promise<void>(resolve => assets.close(() => resolve()));
});
const generateFullReport2PDF: typeof import('../src/components/exam/FullReport2PDF').generateFullReport2PDF = (...args) => bespokeGenerator(...args);
import { generateTransBatchReportPDF } from '../src/components/exam/ModernBatchReportPDF';
import { DEFAULT_PROMOTION_RANKING } from '../src/lib/utils/promotion-ranking';

const subjectSnaps = ['English', 'Mathematics', 'Science', 'Social Studies'].map((name, i) => ({ subjectId: `s${i}`, code: ['ENG', 'MATH', 'SCI', 'SST'][i], name, fullMarks: 100 }));
const result = { pupilInfo: { pupilId: 'fixture', name: 'EXAMPLE ALICE', admissionNumber: 'SYNTHETIC001', age: 12, dateOfBirth: '2014-01-01' }, results: Object.fromEntries(subjectSnaps.map(s => [s.code, { marks: 65, grade: 'C3', aggregates: 3 }])), totalMarks: 260, totalAggregates: 28, division: 'III', position: 1 };
const field = { show: true, fill: true };
const reportConfig = { pupilAge: field, className: field, pin: field, year: field, term: field, promoted: field, schoolPayCode: field, createdOn: field, nextTermBegins: field, nextTermEnds: field };
function props(term: string, enabled: boolean, progress = false) {
  return {
    examDetails: { name: 'END OF TERM', examTypeName: 'End of Term', startDate: '2026-10-15', endDate: '2026-10-16', academicYearName: '2026', termName: term },
    classSnap: { name: 'PRIMARY SEVEN', code: 'P.7' }, subjectSnaps,
    processedResults: [{ ...result, ...(progress ? { comparisonDataArray: [{ exam: { name: 'MID TERM', examTypeName: 'Mid Term', startDate: '2026-09-01', endDate: '2026-09-02' }, results: result.results, totalMarks: 240, totalAggregates: 30, division: 'III', subjectSnaps, subjects: subjectSnaps }] } : {}) }],
    schoolSettings: { generalInfo: { name: 'TRINITY FAMILY SCHOOL', motto: 'Guiding growth, inspiring greatness', phoneNumber: '0000000000' } },
    majorSubjects: subjectSnaps.map(s => s.code), gradingScale: [{ minMark: 90, maxMark: 100, grade: 'D1', aggregates: 1 }, { minMark: 0, maxMark: 89, grade: 'F9', aggregates: 9 }],
    promotionRankingConfig: { ...structuredClone(DEFAULT_PROMOTION_RANKING), enabled }, reportConfig,
    isProgressReport: progress, ...(progress ? { comparisonExams: [{ name: 'MID TERM', examTypeName: 'Mid Term', startDate: '2026-09-01', endDate: '2026-09-02' }] } : {}), nextTermInfo: { startDate: '2027-02-01', endDate: '2027-04-30' }, classTeacherInfo: { name: 'Sarah Teacher' },
  };
}

async function inspect(blob: Blob, name: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (process.env.EXAM_PRINT_QA) { await mkdir('output/exam-promotion-qa', { recursive: true }); await writeFile(`output/exam-promotion-qa/${name}.pdf`, bytes); }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes, useSystemFonts: true }); const doc = await task.promise;
  const page = await doc.getPage(1); await page.getOperatorList();
  const content = await page.getTextContent();
  const text = content.items.flatMap(item => 'str' in item ? [{ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, size: item.height, font: (page as any).commonObjs.get(item.fontName).name as string }] : []);
  const count = doc.numPages, width = page.getViewport({ scale: 1 }).width;
  await task.destroy(); return { text, count, width };
}

for (const [template, generate] of [['full', generateTransBatchReportPDF], ['bespoke', generateFullReport2PDF]] as const) {
  for (const progress of [false, true]) test(`${template} ${progress ? 'progress' : 'grading'}: ranking fits below Division without moving report elements`, async () => {
    const enabled = await inspect(await generate(props('TERM 3', true, progress)), `${template}-${progress ? 'progress' : 'grading'}-on`);
    const disabled = await inspect(await generate(props('TERM 3', false, progress)), `${template}-${progress ? 'progress' : 'grading'}-off`);
    const label = enabled.text.find(item => item.text === 'PROMOTED ON PROBATION');
    assert.ok(label); assert.ok(label.font.includes('Bold'));
    assert.equal(label.size, template === 'bespoke' ? 21 : 19.5, 'Ranking must be three times its previous font size');
    assert.ok(label.x + label.width <= enabled.width - 20 && label.x + label.width > enabled.width * .8, 'Ranking must fit against the right edge below Division');
    const division = enabled.text.find(item => item.text === 'III' && item.x > enabled.width * 0.55);
    assert.ok(division && label.y < division.y, 'Ranking must be below the Division value');
    assert.equal(disabled.text.some(item => item.text.includes('PROMOTED')), false);
    assert.equal(enabled.count, disabled.count);
    if (progress) assert.ok(enabled.text.some(item => /progress assessment/i.test(item.text)), 'Progress comparison section must be rendered');
    for (const anchor of ['EXAMPLE ALICE', 'English', 'Mathematics', 'III', progress ? 'PROGRESS ASSESSMENT' : 'GRADING SCALE USED', progress ? 'Progress Assessment' : 'Grading Scale Used']) {
      const before = disabled.text.filter(item => item.text === anchor).map(({ x, y }) => [x, y]);
      const after = enabled.text.filter(item => item.text === anchor).map(({ x, y }) => [x, y]);
      assert.deepEqual(after, before, `${anchor} moved when promotion ranking was enabled`);
    }
  });
  test(`${template}: another term cannot print a ranking even if a caller enables it`, async () => {
    const pdf = await inspect(await generate(props('TERM 2', true)), `${template}-term-2`);
    assert.equal(pdf.text.some(item => /PROMOTED|ADVISED TO REPEAT/.test(item.text)), false);
  });
}
