"use client";

import { useMemo } from 'react';
import { getUgandaHolidaysForYears, UgandaHoliday } from '@/lib/utils/uganda-holidays';
import { format } from 'date-fns';
import type { Event } from '@/types';

// Convert Uganda holidays to Event format for the calendar
function convertHolidayToEvent(holiday: UgandaHoliday): Event {
  return {
    id: holiday.id,
    title: `🇺🇬 ${holiday.title}`,
    description: holiday.description,
    type: 'Holiday',
    priority: 'Medium',
    status: 'Scheduled',
    startDate: holiday.date,
    endDate: holiday.date,
    startTime: undefined,
    endTime: undefined,
    isAllDay: true,
    location: 'Uganda',
    targetAudience: ['All Citizens'],
    academicYearId: '',
    termId: '',
    classIds: [],
    subjectIds: [],
    isExamEvent: false,
    isRecurringInstance: false,
    parentEventId: undefined,
    recurrence: { frequency: 'None' },
    reminders: [],
    notificationsSent: [],
    sendReminders: false,
    colorCode: '#f59e0b', // Gold/orange color for Uganda holidays
    requiresApproval: false,
    approvedBy: undefined,
    approvedAt: undefined,
    requiresAttendance: false,
    isPublic: true,
    tags: ['Public Holiday', 'National Holiday', 'Uganda'],
    attachments: [],
    customFields: {
      isUgandaPublicHoliday: true,
      isFixed: holiday.isFixed,
      holidayType: 'National'
    },
    createdBy: 'system',
    createdByName: 'System',
    createdAt: format(new Date(), 'yyyy-MM-dd'),
    updatedAt: undefined,
  };
}

export function useUgandaHolidays(currentDate: Date = new Date()) {
  const holidayEvents = useMemo(() => {
    // Get holidays for current year and adjacent years to cover calendar view
    const currentYear = currentDate.getFullYear();
    const startYear = currentYear - 1;
    const endYear = currentYear + 1;
    
    const holidays = getUgandaHolidaysForYears(startYear, endYear);
    
    // Convert holidays to calendar events
    const events = holidays.map(convertHolidayToEvent);
    
    console.log(`🇺🇬 Loaded ${events.length} Uganda public holidays for ${startYear}-${endYear}`, events);
    
    return events;
  }, [currentDate]);

  return {
    data: holidayEvents,
    isLoading: false,
    error: null
  };
}

// Hook to get specific year holidays
export function useUgandaHolidaysForYear(year: number) {
  const holidayEvents = useMemo(() => {
    const holidays = getUgandaHolidaysForYears(year, year);
    return holidays.map(convertHolidayToEvent);
  }, [year]);

  return {
    data: holidayEvents,
    isLoading: false,
    error: null
  };
}

// Hook to check if a specific date is a holiday
export function useIsUgandaHoliday(date: string) {
  return useMemo(() => {
    const year = new Date(date).getFullYear();
    const holidays = getUgandaHolidaysForYears(year, year);
    return holidays.find(holiday => holiday.date === date) || null;
  }, [date]);
} 