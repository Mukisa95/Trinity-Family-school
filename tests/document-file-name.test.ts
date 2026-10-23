import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPdfFileName,
  documentFileNamePart,
  examBatchFileName,
  examResultsFileName,
  individualExamReportFileName,
} from '../src/lib/printing/document-file-name';

test('individual exam reports put the pupil, report type and exam in the download name', () => {
  assert.equal(
    individualExamReportFileName('KAHANGUZI MARIA', 'MID TERM / 2026'),
    'KAHANGUZI MARIA - Report - MID TERM 2026.pdf',
  );
  assert.equal(
    individualExamReportFileName('KAHANGUZI MARIA', 'MID TERM', 'Bespoke Report'),
    'KAHANGUZI MARIA - Bespoke Report - MID TERM.pdf',
  );
});

test('results, registers and batch documents put the document type before the exam', () => {
  assert.equal(examResultsFileName('MID TERM', 'P.7'), 'Results - MID TERM - P.7.pdf');
  assert.equal(examResultsFileName('MID TERM', 'P.7', 'Blank Results Register'), 'Blank Results Register - MID TERM - P.7.pdf');
  assert.equal(examBatchFileName('MID TERM', 'Bespoke Reports'), 'Bespoke Reports - MID TERM.pdf');
});

test('file names stay safe and readable on Windows', () => {
  assert.equal(documentFileNamePart('  CON  '), 'Document CON');
  assert.equal(createPdfFileName('A:B', 'Report?', 'Exam.pdf'), 'A B - Report - Exam.pdf');
});
