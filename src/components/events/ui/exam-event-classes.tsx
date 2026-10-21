'use client';

import type { Event } from '@/types';
import { useClasses } from '@/lib/hooks/use-classes';
import { getExamEventClassesText } from '@/lib/utils/exam-event-classes';

export function ExamEventClasses({ event, className = '' }: { event: Event; className?: string }) {
  const { data: classes = [] } = useClasses();
  if (!event.isExamEvent) return null;
  return <p data-exam-classes className={`mt-1 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground ${className}`}>{getExamEventClassesText(event, classes)}</p>;
}
