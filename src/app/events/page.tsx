"use client";

import React from 'react';
import { CalendarWrapper } from '@/components/events/calendar/calendar-wrapper';

export default function EventsPage() {
  return (
    <CalendarWrapper 
      className="w-full"
      showFilters={true}
      showLegend={true}
      height="auto"
    />
  );
} 