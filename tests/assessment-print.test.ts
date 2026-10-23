import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { generateExamPDF, generateCrossAnalysisPDF, generateSubjectSetAnalysisPDF } from '../src/components/exam/ExamResultsPDF';
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
  const pages = [], positions: Array<Array<{ text: string; y: number; fontSize: number }>> = [];
  for (let n = 1; n <= parsed.numPages; n++) {
    const page = await parsed.getPage(n);
    const content = await page.getTextContent();
    const margin = 72 / 2.54;
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      assert.ok(item.transform[4] >= margin - 1 && item.transform[4] + item.width <= page.view[2] - margin + 1
        && item.transform[5] >= margin - 1 && item.transform[5] + item.height * .75 <= page.view[3] - margin + 2,
      `${name}: text crosses the 1 cm boundary on page ${n}: ${item.str}`);
    }
    pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '));
    positions.push(content.items.flatMap(item => 'str' in item ? [{ text: item.str, y: item.transform[5], fontSize: item.height }] : []));
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
    for (const [index, page] of pages.entries()) {
      assert.equal(page.includes('PUPIL MARKS REGISTER'), index === 0, 'The register title belongs on the first page only');
      assert.equal(page.includes('Grading Scale'), index === 0, 'The scale belongs on the first page only');
      assert.ok(page.includes('Management System (c)'), 'Every page must identify the school management system');
      assert.equal((page.match(/TRINITY FAMILY/g) || []).length, index === 0 ? 2 : 1, 'The masthead appears once; the school footer appears on every page');
    }
  });
}

test('blank mode enforces empty portrait output even if other options request results', async () => {
  const data = fixture(6, 1);
  data.printOptions = { ...BLANK_ASSESSMENT_OPTIONS, showPin: true, showAgg: true, fillMarks: true, showAggregateAnalysis: true };
  const { text } = await inspect(generateExamPDF(data), 'blank-enforced');
  assert.ok(!text.includes('SECRET') && !text.includes('PRIVATE') && !text.includes('AGGREGATE ANALYSIS'));
});

test('assessment table density matches the approved 20 percent reduction', async () => {
  const { positions } = await inspect(generateExamPDF(fixture(6, 70)), 'compact-assessment');
  const rows = positions[0].filter(item => /^PUPIL \d{3}/.test(item.text));
  assert.ok(Math.abs(rows[0].fontSize - 9.04) < .01);
  assert.ok(Math.abs(rows[0].y - rows[1].y - 19.47) < .1, 'Reduce the row pitch, including padding, by 20 percent');
  const heading = positions[0].find(item => item.text === 'PRE-PLE - SIPRO - SET 4')!;
  assert.equal(heading.fontSize, 17, 'Document headings retain their approved size');
  const footer = positions[0].find(item => item.text.includes('Management System'))!;
  assert.equal(footer.fontSize, 8.5, 'The copyright footer retains its approved size');
});

test('long exam titles wrap above the metadata and table within the page margins', async () => {
  const data = fixture(6, 12);
  data.examDetails.name = 'CONTINUOUS ASSESSMENT STACK - PRIMARY SEVEN PREPARATION AND REVISION - THIRD TERM - SET FOUR';
  const { text, positions } = await inspect(generateExamPDF(data), 'long-assessment-title');
  assert.ok(text.replace(/\s/g, '').includes(data.examDetails.name.replace(/\s/g, '')));
  const firstPupil = positions[0].find(item => item.text.startsWith('PUPIL 001'))!;
  const scale = positions[0].find(item => item.text === 'Grading Scale')!;
  assert.ok(firstPupil.y < scale.y - 10);
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
  const unwrapped = text.replace(/\s/g, '');
  assert.ok(unwrapped.includes('PRIVATE_PIN') && unwrapped.includes('PRIVATE_INDEX') && unwrapped.includes('PRIVATE_LIN'), 'Wrapping must retain every identifier without truncation');
  assert.ok(text.includes('98766') && text.includes('98767'));
  assert.ok(!text.includes('Choose four major subjects'));
});

test('analysis sections keep their titles when the temporary first page is removed', async () => {
  const data = fixture(4, 2);
  data.processedResults[0].division = 'I';
  data.processedResults[1].division = 'II';
  const { pages } = await inspect(generateExamPDF({ ...data, printOptions: {
    ...BLANK_ASSESSMENT_OPTIONS, blankAssessment: false, analysisOnly: true,
    showAggregateAnalysis: true, analysisSections: { aggregate: false, divisions: true, subjectGrades: false },
  } }), 'analysis-sections');
  assert.equal(pages.length, 2);
  assert.ok(pages[0].includes('DIVISION I - PUPIL PERFORMANCE'));
  assert.ok(pages[1].includes('DIVISION II - PUPIL PERFORMANCE'));
  assert.ok(pages[0].includes('NURSERY AND PRIMARY SCHOOL'));
  assert.ok(!pages[1].includes('NURSERY AND PRIMARY SCHOOL'));
});

test('cross-exam and subject-set lists retain every pupil without repeating their masthead', async () => {
  const data = fixture(4, 70);
  const pupils = data.processedResults.map((p, i) => ({ pupilId: p.pupilInfo.pupilId, name: p.pupilInfo.name, admissionNumber: `PIN${i}` }));
  const exams = [0, 1].map(i => ({ id: `e${i}`, name: `SET ${i + 1}`, startDate: `2026-10-${15 + i}`,
    pupils, subjects: [{ code: 'ENG', name: 'English' }],
    results: Object.fromEntries(pupils.map((p, n) => [p.pupilId, { position: n + 1, totalMarks: 80, totalAggregates: 4, division: 'I', subjects: { ENG: { marks: 80, grade: 'D2' } } }])),
  }));
  const props = { schoolName: 'Trinity Family School', className: 'Primary Seven', academicYearName: '2026', exams };
  for (const [name, blob] of [
    ['cross-exam', generateCrossAnalysisPDF({ ...props, metrics: { aggregates: true, divisions: true, totalMarks: true, subjectMarks: true } })],
    ['subject-sets', generateSubjectSetAnalysisPDF({ ...props, subjectCodes: ['ENG'] })],
  ] as const) {
    const { text, pages } = await inspect(blob, name);
    for (const pupil of pupils) assert.ok(text.includes(pupil.name));
    assert.ok(pages.length > 1);
    assert.ok(pages[0].includes('NURSERY AND PRIMARY SCHOOL'));
    for (const page of pages.slice(1)) assert.ok(!page.includes('NURSERY AND PRIMARY SCHOOL'));
  }
});
