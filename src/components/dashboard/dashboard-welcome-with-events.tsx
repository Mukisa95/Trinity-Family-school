"use client";

import { useMemo } from 'react';
import type { SchoolSettings } from '@/types';
import { useEvents, useExamsAsEvents } from '@/lib/hooks/use-events-fixed';
import { useUgandaHolidays } from '@/lib/hooks/use-uganda-holidays';
import { DashboardWelcomeHeader } from './dashboard-welcome-header';

type Props = {
  schoolSettings?: { generalInfo?: SchoolSettings['generalInfo'] } | null;
  enabled: boolean;
};

function WelcomeWithCalendar({ schoolSettings }: Pick<Props, 'schoolSettings'>) {
  // Use the same authorised, revision-backed owners as the dashboard calendar.
  const events = useEvents();
  const exams = useExamsAsEvents();
  const holidays = useUgandaHolidays(new Date());
  const allEvents = useMemo(() => [
    ...(events.data || []), ...(exams.data || []), ...(holidays.data || []),
  ], [events.data, exams.data, holidays.data]);
  return <DashboardWelcomeHeader schoolSettings={schoolSettings} events={allEvents} />;
}

export function DashboardWelcomeWithEvents({ schoolSettings, enabled }: Props) {
  // Do not mount calendar data hooks for an account without dashboard calendar access.
  return enabled ? <WelcomeWithCalendar schoolSettings={schoolSettings} />
    : <DashboardWelcomeHeader schoolSettings={schoolSettings} />;
}
