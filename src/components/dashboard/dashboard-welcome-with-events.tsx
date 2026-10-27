"use client";

import { useMemo } from 'react';
import type { SchoolSettings } from '@/types';
import { useEvents, useExamsAsEvents } from '@/lib/hooks/use-events-fixed';
import { useUgandaHolidays } from '@/lib/hooks/use-uganda-holidays';
import { DashboardWelcomeHeader } from './dashboard-welcome-header';
import { isEventRelevantToClasses } from '@/lib/dashboard/staff-context';

type Props = {
  schoolSettings?: { generalInfo?: SchoolSettings['generalInfo'] } | null;
  enabled: boolean;
  classIds?: string[];
};

function WelcomeWithCalendar({ schoolSettings, classIds }: Pick<Props, 'schoolSettings' | 'classIds'>) {
  // Use the same authorised, revision-backed owners as the dashboard calendar.
  const events = useEvents();
  const exams = useExamsAsEvents();
  const holidays = useUgandaHolidays(new Date());
  const allEvents = useMemo(() => [
    ...(events.data || []), ...(exams.data || []), ...(holidays.data || []),
  ].filter(event => isEventRelevantToClasses(event, classIds)), [events.data, exams.data, holidays.data, classIds]);
  return <DashboardWelcomeHeader schoolSettings={schoolSettings} events={allEvents} />;
}

export function DashboardWelcomeWithEvents({ schoolSettings, enabled, classIds }: Props) {
  // Do not mount calendar data hooks for an account without dashboard calendar access.
  return enabled ? <WelcomeWithCalendar schoolSettings={schoolSettings} classIds={classIds} />
    : <DashboardWelcomeHeader schoolSettings={schoolSettings} />;
}
