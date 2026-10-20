import type { PupilAttendanceEntry } from '@/types/attendance';

export function matchesAttendanceClass(entry: PupilAttendanceEntry, classId: string, code?: string, legacyName?: string) {
  if (entry.classId) return entry.classId === classId;
  return [classId, code, legacyName].filter(Boolean).includes(entry.className);
}

export function mergePupilAttendance(existing: PupilAttendanceEntry[], incoming: PupilAttendanceEntry[]) {
  const replaced = new Set(incoming.map(entry => entry.pupilId));
  return [...existing.filter(entry => !replaced.has(entry.pupilId)), ...incoming];
}
