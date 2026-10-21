import type { Event, Exam } from '@/types';

export type ClassExamSchedule = {
  examId: string;
  classId: string;
  className: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location: string;
};

const unique = <T,>(values: T[]) => [...new Set(values)];

/** Combine explicitly related class exams without changing their source records. */
export function groupExamCalendarEvents(events: Event[], exams: Exam[]): Event[] {
  const definitions = new Map(exams.map(exam => [exam.id, exam]));
  const groups = new Map<string, Event[]>();
  for (const event of events) {
    const exam = definitions.get(event.customFields?.originalExamId);
    // Different CAT sets remain separate events even when they share a batch.
    const set = exam?.examTypeId === 'et_cat'
      ? exam.name.match(/SET\s+(\d+)$/i)?.[1] || exam.name : '';
    const key = exam?.batchId
      ? `batch:${JSON.stringify([exam.batchId, exam.academicYearId || '', exam.termId || '', set])}`
      : `exam:${event.id}`;
    const group = groups.get(key) || [];
    group.push(event);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, members]) => {
    if (members.length === 1) return members[0];
    const classLabel = (event: Event) => String(event.customFields?.classDetails?.[0]?.code || event.classNames?.[0] || event.targetAudience?.[0] || event.classIds?.[0] || event.id);
    const ordered = [...members].sort((a, b) => classLabel(a).localeCompare(classLabel(b), undefined, { numeric: true }) || a.id.localeCompare(b.id));
    const first = ordered[0];
    const exam = definitions.get(first.customFields?.originalExamId)!;
    const classExamDetails: ClassExamSchedule[] = ordered.flatMap(member =>
      (member.classIds?.length ? member.classIds : ['']).map((classId, index) => {
        const detail = member.customFields?.classDetails?.find((item: { id: string }) => item.id === classId);
        return {
          examId: member.customFields?.originalExamId,
          classId,
          className: member.classNames?.[index] || detail?.name || member.targetAudience?.[index] || classId || 'Unknown Class',
          startDate: member.startDate,
          endDate: member.endDate || member.startDate,
          startTime: member.startTime,
          endTime: member.endTime,
          isAllDay: member.isAllDay,
          location: member.location || '',
        };
      }));
    const classIds = unique(classExamDetails.map(detail => detail.classId).filter(Boolean));
    const classNames = classIds.map(id => classExamDetails.find(detail => detail.classId === id)!.className);
    const subjectDetails = [...new Map(ordered.flatMap(member => member.customFields?.subjectDetails || [])
      .map((detail: { id: string; name: string }) => [detail.id, detail])).values()];
    const subjectNames: string[] = unique(ordered.flatMap(member => member.subjectNames ||
      (member.customFields?.subjectDetails || []).map((detail: { name: string }) => detail.name)));
    const sameTime = ordered.every(member => member.startTime === first.startTime && member.endTime === first.endTime && member.isAllDay === first.isAllDay);
    const locations = unique(ordered.map(member => member.location || ''));
    return {
      ...first,
      id: `exam-batch-${encodeURIComponent(key.slice(6))}`,
      title: exam.examTypeId === 'et_cat' ? first.title : exam.baseName || first.title,
      status: ordered.every(member => member.status === 'Cancelled') ? 'Cancelled'
        : ordered.every(member => member.status === 'Draft') ? 'Draft' : 'Scheduled',
      startDate: ordered.map(member => member.startDate).sort()[0],
      endDate: ordered.map(member => member.endDate || member.startDate).sort().at(-1)!,
      startTime: sameTime ? first.startTime : undefined,
      endTime: sameTime ? first.endTime : undefined,
      isAllDay: sameTime ? first.isAllDay : true,
      location: locations.length === 1 ? locations[0] : '',
      classIds, classNames,
      subjectIds: unique(ordered.flatMap(member => member.subjectIds || [])),
      subjectNames,
      targetAudience: classNames,
      tags: unique(ordered.flatMap(member => member.tags || [])),
      description: [
        `${classNames.length} classes taking part in this examination.`,
        `Classes: ${classNames.join(', ')}`,
        ...(subjectNames.length ? [`Subjects: ${subjectNames.join(', ')}`] : []),
        ...(first.customFields?.academicYearName ? [`Academic year: ${first.customFields.academicYearName}`] : []),
        ...(first.customFields?.termName ? [`Term: ${first.customFields.termName}`] : []),
        ...unique(ordered.map(member => member.customFields?.instructions as string).filter(Boolean)),
      ].join('\n'),
      customFields: {
        ...first.customFields,
        originalExamId: undefined,
        originalExamIds: ordered.map(member => member.customFields?.originalExamId),
        batchId: exam.batchId,
        classExamDetails,
        classDetails: ordered.flatMap(member => member.customFields?.classDetails || []),
        subjectDetails,
        classTimesVary: !sameTime,
      },
    };
  });
}
