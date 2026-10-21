import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { generateExamPDF } from '../src/components/exam/ExamResultsPDF';
import { generateNurseryAssessmentPDF } from '../src/components/exam/NurseryAssessmentPDF';
import { BLANK_ASSESSMENT_OPTIONS } from '../src/lib/utils/assessment-print-options';

const scale = [{ minMark: 90, maxMark: 100, grade: 'D1', aggregates: 1 }, { minMark: 0, maxMark: 89, grade: 'F9', aggregates: 9 }];
function fixture(subjectCount = 6, pupilCount = 12) {
  const names = ['English', 'Mathematics', 'Science', 'Social Studies', 'Religious Education', 'Art', 'Music', 'Physical Education', 'Agriculture', 'Local Language', 'Reading', 'Writing'];
  const codes = ['ENG', 'MATH', 'SCI', 'SST', 'RE', 'ART', 'MUS', 'PE', 'AGR', 'LL', 'READ', 'WRITE'];
  return {
    examDetails: { name: 'PRE-PLE - SIPRO - SET 4', examTypeName: 'Continuous Assessment', startDate: '2026-10-15', endDate: '2026-10-16' },
    classSnap: { name: 'Primary Seven - All streams' },
    schoolSettings: { generalInfo: { name: 'TRINITY FAMILY NURSERY AND PRIMARY SCHOOL' } },
    subjectSnaps: names.slice(0, subjectCount).map((name, i) => ({ subjectId: `s${i}`, code: codes[i], name })),
    processedResults: Array.from({ length: pupilCount }, (_, i) => ({
      pupilInfo: { name: `PUPIL ${String(i + 1).padStart(3, '0')} LONG SURNAME`, pupilId: `p${i}`, admissionNumber: 'PRIVATE_PIN', indexNumber: 'PRIVATE_INDEX', learnerIdentificationNumber: 'PRIVATE_LIN' },
      results: Object.fromEntries(codes.map(code => [code, { marks: 98766, grade: 'SECRETGRADE', aggregates: 98765, comment: 'SECRETCOMMENT' }])),
      totalMarks: 98767, totalAggregates: 98768, division: 'SECRET_DIVISION', position: 98769,
    })),
    gradingScale: scale,
    printOptions: BLANK_ASSESSMENT_OPTIONS,
  };
}

async function inspect(blob: Blob, name: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const doc = await PDFDocument.load(bytes);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const parsed = await loading.promise;
  const pages = [], positions: Array<Array<{ text: string; y: number }>> = [];
  for (let n = 1; n <= parsed.numPages; n++) {
    const page = await parsed.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '));
    positions.push(content.items.flatMap(item => 'str' in item ? [{ text: item.str, y: item.transform[5] }] : []));
  }
  await loading.destroy();
  if (process.env.EXAM_PRINT_QA) {
    await mkdir('output/exam-print-qa', { recursive: true });
    await writeFile(`output/exam-print-qa/${name}.pdf`, bytes);
  }
  return { doc, pages, positions, text: pages.join('\n') };
}

for (const [subjects, pupils] of [[4, 12], [6, 12], [6, 70], [12, 12]]) {
  test(`blank assessment: ${subjects} subjects, ${pupils} pupils, portrait and no recorded values`, async () => {
    const data = fixture(subjects, pupils);
    const originalScale = JSON.stringify(data.gradingScale);
    const { doc, pages, positions, text } = await inspect(generateExamPDF(data), `blank-${subjects}-subjects-${pupils}-pupils`);
    for (const page of doc.getPages()) assert.ok(page.getWidth() < page.getHeight());
    for (const pupil of data.processedResults) assert.ok(text.includes(pupil.pupilInfo.name));
    for (const subject of data.subjectSnaps) assert.ok(text.includes(subject.code));
    for (const hidden of ['PRIVATE_PIN', 'PRIVATE_INDEX', 'PRIVATE_LIN', '98766', '98765', '98767', '98768', '98769', 'SECRET', 'Student Details', 'POS', 'Total', 'T. AGG', 'DIV', 'Best Performing', 'Needs Improvement', 'AGGREGATE ANALYSIS', 'Major Subjects (with grades)']) assert.ok(!text.includes(hidden), hidden);
    assert.ok(text.includes('Grading Scale'));
    const firstPupilY = positions[0].find(item => item.text.startsWith('PUPIL 001'))!.y;
    const scaleY = positions[0].find(item => item.text === 'Grading Scale')!.y;
    assert.ok(firstPupilY < scaleY - 10, 'The first table row must stay below the header and grading scale');
    assert.equal(text.includes('Choose four major subjects'), subjects > 4);
    if (subjects > 4) assert.ok(pages.at(-1)!.includes('Choose four major subjects'));
    assert.equal(JSON.stringify(data.gradingScale), originalScale);
    if (pupils === 70) assert.ok(pages.length > 1);
    for (const page of pages) {
      assert.ok(page.includes('NURSERY AND PRIMARY SCHOOL'), 'Continuation pages must retain their school context');
      assert.equal((page.match(/TRINITY FAMILY/g) || []).length, 1, 'Draw the masthead only once on each page');
    }
  });
}

test('blank mode enforces empty portrait output even if other options request results', async () => {
  const data = fixture(6, 1);
  data.printOptions = { ...BLANK_ASSESSMENT_OPTIONS, showPin: true, showAgg: true, fillMarks: true, showAggregateAnalysis: true };
  const { text } = await inspect(generateExamPDF(data), 'blank-enforced');
  assert.ok(!text.includes('SECRET') && !text.includes('PRIVATE') && !text.includes('AGGREGATE ANALYSIS'));
});

for (const pupils of [12, 70]) test(`nursery blank assessment: ${pupils} pupils, commentary scale but no pupil commentary`, async () => {
  const data = fixture(6, pupils);
  const { doc, text, positions } = await inspect(generateNurseryAssessmentPDF(data), `blank-nursery-${pupils}`);
  assert.ok(doc.getPage(0).getWidth() < doc.getPage(0).getHeight());
  assert.ok(text.includes('ASSESSMENT SCALE'));
  assert.ok(text.includes('Choose four major subjects'));
  assert.ok(!text.includes('SECRET') && !text.includes('PRIVATE'));
  assert.ok(positions[0].find(item => item.text.startsWith('PUPIL 001'))!.y < positions[0].find(item => item.text === 'ASSESSMENT SCALE')!.y - 10);
});

test('regular results printing keeps its chosen landscape columns and marks', async () => {
  const data = fixture(4, 1);
  const options = { ...BLANK_ASSESSMENT_OPTIONS, blankAssessment: false, orientation: 'landscape' as const, fillMarks: true, showPin: true, showIndexNumber: true, showLinNumber: true, showTotal: true, fillTotal: true };
  const { doc, text } = await inspect(generateExamPDF({ ...data, printOptions: options }), 'regular-results');
  assert.ok(doc.getPage(0).getWidth() > doc.getPage(0).getHeight());
  assert.ok(text.includes('PRIVATE_PIN') && text.includes('PRIVATE_INDEX') && text.includes('PRIVATE_LIN'));
  assert.ok(text.includes('98766') && text.includes('98767'));
  assert.ok(!text.includes('Choose four major subjects'));
});
