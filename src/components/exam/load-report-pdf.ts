// Keep report engines out of the pupil-detail route's initial JavaScript.
// Type-only signatures preserve the existing inputs and returned PDF blobs.
export async function generateModernBatchReportPDF(
  ...args: Parameters<typeof import('./ModernBatchReportPDF').generateModernBatchReportPDF>
) {
  const module = await import('./ModernBatchReportPDF');
  return module.generateModernBatchReportPDF(...args);
}

export async function generateTransBatchReportPDF(
  ...args: Parameters<typeof import('./ModernBatchReportPDF').generateTransBatchReportPDF>
) {
  const module = await import('./ModernBatchReportPDF');
  return module.generateTransBatchReportPDF(...args);
}

export async function generateFullReport2PDF(
  ...args: Parameters<typeof import('./FullReport2PDF').generateFullReport2PDF>
) {
  const module = await import('./FullReport2PDF');
  return module.generateFullReport2PDF(...args);
}

export async function generatePrimaryMiniReportPDF(
  ...args: Parameters<typeof import('./PrimaryMiniReportPDF').generatePrimaryMiniReportPDF>
) {
  const module = await import('./PrimaryMiniReportPDF');
  return module.generatePrimaryMiniReportPDF(...args);
}
