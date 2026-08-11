function normalisePupilStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

export function shouldDeletePhotoForStatusTransition(
  previousStatus: unknown,
  nextStatus: unknown,
): boolean {
  const previous = normalisePupilStatus(previousStatus);
  const next = normalisePupilStatus(nextStatus);
  return previous === 'active' && (next === 'inactive' || next === 'graduated');
}
