"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface QuickActionsProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onCreateEvent: () => void;
  className?: string;
}

export function QuickActions({ 
  currentDate, 
  onDateChange, 
  onCreateEvent, 
  className = "" 
}: QuickActionsProps) {
  // Ensure currentDate is a valid Date object
  const safeCurrentDate = currentDate instanceof Date && !isNaN(currentDate.getTime()) 
    ? currentDate 
    : new Date();

  const handlePrevMonth = () => {
    const newDate = new Date(safeCurrentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(safeCurrentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Navigation buttons */}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrevMonth}
        className="px-2"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleNextMonth}
        className="px-2"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Today button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToday}
        className="text-xs"
      >
        <CalendarDays className="h-4 w-4 mr-1" />
        Today
      </Button>

      {/* Date picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Calendar className="h-4 w-4 mr-1" />
            {format(safeCurrentDate, 'MMM yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarPicker
            mode="single"
            selected={safeCurrentDate}
            onSelect={(date) => date && onDateChange(date)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
} 