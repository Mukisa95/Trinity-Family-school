import type { Class, Event } from '@/types';

type ClassLabel = Pick<Class, 'id' | 'code' | 'name'>;

/** Resolve only the classes recorded on this exam, using compact current labels. */
export function getExamEventClassNames(event: Event, classes: ClassLabel[] = []): string[] {
  if (!event.isExamEvent) return [];
  const details: ClassLabel[] = event.customFields?.classDetails || [];
  const schedules: { classId: string; className: string }[] = event.customFields?.classExamDetails || [];
  const classIds = event.classIds?.length ? event.classIds
    : event.examIntegration?.classIds?.length ? event.examIntegration.classIds
    : schedules.length ? schedules.map(item => item.classId).filter(Boolean)
    : details.map(item => item.id).filter(Boolean);
  const labels = classIds.length ? [...new Set(classIds)].map(id => {
    const current = classes.find(item => item.id === id);
    const recorded = details.find(item => item.id === id);
    return current?.code || current?.name || recorded?.code || recorded?.name
      || event.classNames?.[classIds.indexOf(id)] || schedules.find(item => item.classId === id)?.className || id;
  }) : event.classNames || [];
  return [...new Set(labels.map(label => label.trim()).filter(Boolean))];
}

export function getExamEventClassesText(event: Event, classes: ClassLabel[] = []): string {
  if (!event.isExamEvent) return '';
  const labels = getExamEventClassNames(event, classes);
  return labels.length ? `Classes: ${labels.join(', ')}` : 'Classes not specified';
}
