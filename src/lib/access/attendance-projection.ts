/** Replace only visible pupil rows; other classes and hidden pupils retain their records. */
export function mergeScopedAttendance(existing: any[], replacement: any[], allowedIds: Set<string>, classId: string, replaceClass: boolean) {
  const preserved = existing.filter(record => record.classId !== classId || !allowedIds.has(record.pupilId));
  const visible = existing.filter(record => record.classId === classId && allowedIds.has(record.pupilId));
  const next = replacement.filter(record => record.classId === classId && allowedIds.has(record.pupilId));
  return [...preserved, ...Array.from(new Map([...(!replaceClass ? visible : []), ...next].map(record => [record.pupilId, record])).values())];
}
