"use client";

import React from 'react';
import { CalendarWrapper } from '@/components/events/calendar/calendar-wrapper';

export default function EventsPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <CalendarWrapper 
        className="w-full"
        showFilters={true}
        showLegend={true}
        height="auto"
      />
    </div>
  );
} 