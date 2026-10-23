/** Human-readable, Windows-safe names for downloaded school documents. */
const RESERVED_WINDOWS_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

export function documentFileNamePart(value: string | null | undefined, fallback = ''): string {
  const cleaned = (value || '')
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!cleaned) return fallback;
  return RESERVED_WINDOWS_NAMES.has(cleaned.toUpperCase()) ? `Document ${cleaned}` : cleaned;
}

export function createPdfFileName(...parts: Array<string | null | undefined>): string {
  const name = parts
    .map(part => documentFileNamePart(part))
    .filter(Boolean)
    .join(' - ')
    .slice(0, 180)
    .trim();
  return `${name || 'Document'}.pdf`;
}

/** An individual report always starts with the pupil so files sort by pupil name. */
export function individualExamReportFileName(
  pupilName: string | null | undefined,
  examName: string | null | undefined,
  reportLabel = 'Report',
): string {
  return createPdfFileName(pupilName || 'Pupil', reportLabel, examName || 'Exam');
}

/** Results and registers always start with their document type, then the exam. */
export function examResultsFileName(
  examName: string | null | undefined,
  className?: string | null,
  documentLabel = 'Results',
): string {
  return createPdfFileName(documentLabel, examName || 'Exam', className);
}

export function examBatchFileName(
  examName: string | null | undefined,
  documentLabel: string,
  className?: string | null,
): string {
  return createPdfFileName(documentLabel, examName || 'Exam', className);
}
