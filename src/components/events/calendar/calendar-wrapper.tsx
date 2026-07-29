"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Plus, List, Grid3X3, Filter, ChevronDown, ChevronUp, Search, Clock, BookOpen, CalendarDays, CalendarRange } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useExamsAsEvents, useAcademicYearsForEvents, useCurrentTerm } from '@/lib/hooks/use-events-fixed';
import { useUgandaHolidays } from '@/lib/hooks/use-uganda-holidays';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { detectCurrentAcademicYear, getCurrentTerm } from '@/lib/utils/academic-year-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/contexts/auth-context';
import type {
  Event,
  EventType,
  CalendarViewType,
  EventFilters,
  CreateEventData,
  UpdateEventData
} from '@/types';
import { EventForm } from '../forms/event-form';
import { EventDetailsModal } from '../ui/event-details-modal';
import { EventFilters as EventFiltersComponent } from '../ui/event-filters';
import { ColorLegend } from '../ui/color-legend';
import { EventsList } from '../ui/events-list';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { getComputedEventStatus } from '@/lib/utils/event-status-utils';
import { cn } from '@/lib/utils';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from '@/components/common/glass-page-top-bar';

// Event type color mapping
const EVENT_TYPE_COLORS = {
  'Academic': '#3b82f6',
  'Co-curricular': '#10b981',
  'Administrative': '#f59e0b',
  'Holiday': '#dc2626',
} as const;

const UGANDA_HOLIDAY_COLOR = '#f59e0b';

interface CalendarWrapperProps {
  className?: string;
  defaultView?: CalendarViewType;
  showFilters?: boolean;
  showLegend?: boolean;
  height?: string | number;
}

export function CalendarWrapper({
  className = "",
  defaultView = 'month',
  showFilters = true,
  showLegend = true,
  height = 'auto'
}: CalendarWrapperProps) {
  const { user } = useAuth();
  const { data: activeAcademicYear } = useActiveAcademicYear();

  // State management
  const [currentView, setCurrentView] = useState<CalendarViewType | 'term'>(defaultView);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [isEventDetailsOpen, setIsEventDetailsOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isCompactView, setIsCompactView] = useState(false);
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<EventFilters>({
    academicYearIds: activeAcademicYear ? [activeAcademicYear.id] : [],
  });
  const calendarRef = useRef<FullCalendar>(null);

  // Hooks
  const { data: events = [], error: eventsError } = useEvents(filters);
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();
  // Older exams without canonical event documents come from the same
  // revision-scoped persistent projection used by the dashboard.
  const examsAsEvents = useExamsAsEvents();
  const ugandaHolidays = useUgandaHolidays(currentDate);
  const { data: academicYears = [], isLoading: isLoadingAcademicYears } = useAcademicYearsForEvents();
  const currentTerm = useCurrentTerm(academicYears);

  // Get available terms for selected academic year
  const availableTerms = useMemo(() => {
    const selectedYear = academicYears.find((year: any) => year.id === selectedAcademicYearId);
    return selectedYear ? selectedYear.terms : [];
  }, [academicYears, selectedAcademicYearId]);

  // Helper function to get FullCalendar view name (must be before useEffect that uses it)
  const getFullCalendarView = (view: CalendarViewType) => {
    switch (view) {
      case 'month': return 'dayGridMonth';
      case 'week': return 'timeGridWeek';
      case 'day': return 'timeGridDay';
      case 'agenda': return 'listWeek';
      default: return 'dayGridMonth';
    }
  };

  // Set default academic year and term
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYearId) {
      const activeYear = detectCurrentAcademicYear(academicYears) || academicYears[0];
      if (activeYear) {
        setSelectedAcademicYearId(activeYear.id);
        if (currentTerm && currentTerm.year.id === activeYear.id) {
          setSelectedTermId(currentTerm.term.id);
        } else if (activeYear.terms.length > 0) {
          setSelectedTermId(getCurrentTerm(activeYear)?.id || activeYear.terms[0].id);
        }
      }
    }
  }, [academicYears, currentTerm, selectedAcademicYearId]);

  // Effect to change FullCalendar view when currentView state changes
  useEffect(() => {
    if (calendarRef.current && currentView !== 'term') {
      const calendarApi = calendarRef.current.getApi();
      const fullCalendarView = getFullCalendarView(currentView as CalendarViewType);
      calendarApi.changeView(fullCalendarView);
    }
  }, [currentView]);

  // Combine and filter events
  const allEvents = useMemo(() => {
    const regularEvents = events || [];
    const examEvents = examsAsEvents.data || [];
    const holidayEvents = ugandaHolidays.data || [];

    // The useExamsAsEvents hook now automatically filters out exams that are already 
    // represented as regular events, so we don't need additional filtering here
    const filterableEvents = [...regularEvents, ...examEvents];
    let filteredEvents = filterableEvents;

    // Apply client-side filters
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredEvents = filteredEvents.filter(event =>
        event.title.toLowerCase().includes(searchTerm) ||
        (event.description || '').toLowerCase().includes(searchTerm) ||
        (event.location || '').toLowerCase().includes(searchTerm)
      );

      const filteredHolidays = holidayEvents.filter(event =>
        event.title.toLowerCase().includes(searchTerm) ||
        (event.description || '').toLowerCase().includes(searchTerm) ||
        (event.location || '').toLowerCase().includes(searchTerm)
      );

      return [...filteredEvents, ...filteredHolidays];
    }

    if (filters.types?.length) {
      filteredEvents = filteredEvents.filter(event => filters.types!.includes(event.type));
      const shouldIncludeHolidays = filters.types.includes('Holiday');
      const finalHolidays = shouldIncludeHolidays ? holidayEvents : [];
      return [...filteredEvents, ...finalHolidays];
    }

    if (filters.statuses?.length) {
      filteredEvents = filteredEvents.filter(event => filters.statuses!.includes(getComputedEventStatus(event as unknown as Partial<Event>)));
    }

    if (filters.priorities?.length) {
      filteredEvents = filteredEvents.filter(event => filters.priorities!.includes(event.priority));
    }

    if (filters.academicYearIds?.length) {
      filteredEvents = filteredEvents.filter(event =>
        event.academicYearId && filters.academicYearIds!.includes(event.academicYearId)
      );
    }

    if (filters.termIds?.length) {
      filteredEvents = filteredEvents.filter(event =>
        event.termId && filters.termIds!.includes(event.termId)
      );
    }

    if (filters.classIds?.length) {
      filteredEvents = filteredEvents.filter(event =>
        event.classIds?.some((classId: any) => filters.classIds!.includes(classId))
      );
    }

    if (filters.subjectIds?.length) {
      filteredEvents = filteredEvents.filter(event =>
        event.subjectIds?.some((subjectId: any) => filters.subjectIds!.includes(subjectId))
      );
    }

    if (filters.isExamEvent !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.isExamEvent === filters.isExamEvent);
    }

    return [...filteredEvents, ...holidayEvents];
  }, [events, examsAsEvents.data, ugandaHolidays.data, filters]);

  // Transform events for FullCalendar
  const calendarEvents = useMemo(() => {
    return allEvents.map(event => {
      const startDateTime = event.isAllDay
        ? event.startDate
        : `${event.startDate}T${event.startTime || '00:00'}`;
      const endDateTime = event.isAllDay
        ? event.endDate
        : `${event.endDate}T${event.endTime || '23:59'}`;

      return {
        id: event.id,
        title: event.title,
        start: startDateTime,
        end: endDateTime,
        allDay: event.isAllDay,
        backgroundColor: (event.customFields as any)?.isUgandaPublicHoliday
          ? UGANDA_HOLIDAY_COLOR
          : (event.colorCode || EVENT_TYPE_COLORS[event.type]),
        borderColor: (event.customFields as any)?.isUgandaPublicHoliday
          ? UGANDA_HOLIDAY_COLOR
          : (event.colorCode || EVENT_TYPE_COLORS[event.type]),
        textColor: '#ffffff',
        className: `calendar-event event-type-${event.type.toLowerCase()}`,
        extendedProps: {
          ...event,
          isUgandaHoliday: event.type === 'Holiday' && (event.customFields as any)?.isUgandaPublicHoliday,
        }
      };
    });
  }, [allEvents]);

  // Early return AFTER all hooks (React rules: hooks must not be called conditionally)
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please log in to view the calendar.</p>
      </div>
    );
  }

  // Event handlers
  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = allEvents.find(e => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event as unknown as Event);
      setIsEventDetailsOpen(true);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    console.log('handleDeleteEvent called with eventId:', eventId);
    const event = allEvents.find(e => e.id === eventId);
    console.log('Found event:', event);
    if (event) {
      setEventToDelete(event as unknown as Event);
    } else {
      console.error('Event not found in allEvents array:', eventId);
      console.log('Available events:', allEvents.map(e => ({ id: e.id, title: e.title })));
    }
  };

  const confirmDeleteEvent = async () => {
    if (eventToDelete) {
      console.log('confirmDeleteEvent called for event:', eventToDelete.id, eventToDelete.title);
      try {
        await deleteEventMutation.mutateAsync(eventToDelete.id);
        setEventToDelete(null);
        setIsEventDetailsOpen(false);
        setSelectedEvent(null);
      } catch (error) {
        console.error('Failed to delete event:', error);
      }
    }
  };

  const cancelDeleteEvent = () => {
    setEventToDelete(null);
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    // Validate dates before formatting
    const isValidStart = !isNaN(selectInfo.start.getTime());
    const isValidEnd = selectInfo.end ? !isNaN(selectInfo.end.getTime()) : true;

    if (!isValidStart || !isValidEnd) {
      console.error('Invalid date values in handleDateSelect');
      return;
    }

    const startDate = format(selectInfo.start, 'yyyy-MM-dd');
    // For all-day selection in month view, FullCalendar sets end to day+1 — normalise to same day as start
    const rawEnd = selectInfo.end || selectInfo.start;
    const endDate = selectInfo.allDay
      ? startDate  // single day click → same start and end date
      : format(rawEnd, 'yyyy-MM-dd');
    const startTime = selectInfo.allDay ? undefined : format(selectInfo.start, 'HH:mm');
    const endTime = selectInfo.allDay || !selectInfo.end ? undefined : format(rawEnd, 'HH:mm');

    // When clicking a date cell, always default to All Day event so the
    // EventForm opens with the multi-date picker pre-selected on that date.
    const isAllDay = selectInfo.allDay ?? true;

    setSelectedEvent({
      id: '',
      title: '',
      type: 'Academic',
      priority: 'Medium',
      status: 'Scheduled',
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
      targetAudience: [],
      recurrence: { frequency: 'None' },
      isExamEvent: false,
      isRecurringInstance: false,
      reminders: [],
      notificationsSent: [],
      sendReminders: true,
      colorCode: EVENT_TYPE_COLORS['Academic'],
      requiresApproval: false,
      isPublic: true,
      createdBy: user?.id || '',
      createdAt: new Date().toISOString(),
    } as unknown as Event);
    setIsEventFormOpen(true);
    selectInfo.view.calendar.unselect();
  };

  const handleEventDrop = (dropInfo: EventDropArg) => {
    const event = allEvents.find(e => e.id === dropInfo.event.id);
    if (event && dropInfo.event.start) {
      // Validate dates before formatting
      const isValidStart = !isNaN(dropInfo.event.start.getTime());
      const isValidEnd = dropInfo.event.end ? !isNaN(dropInfo.event.end.getTime()) : true;

      if (!isValidStart || !isValidEnd) {
        console.error('Invalid date values in handleEventDrop');
        return;
      }

      const updatedEvent = {
        ...event,
        startDate: format(dropInfo.event.start, 'yyyy-MM-dd'),
        endDate: format(dropInfo.event.end || dropInfo.event.start, 'yyyy-MM-dd'),
        startTime: !dropInfo.event.allDay ? format(dropInfo.event.start, 'HH:mm') : undefined,
        endTime: !dropInfo.event.allDay && dropInfo.event.end ? format(dropInfo.event.end, 'HH:mm') : undefined,
        reminders: event.reminders as unknown as any,
      };

      updateEventMutation.mutate({
        eventId: event.id,
        data: updatedEvent as any
      });
    }
  };

  const handleViewChange = (view: CalendarViewType) => {
    // Immediate view change with smooth transition
    setIsViewTransitioning(true);
    setCurrentView(view);

    // Single timeout for clean transition end
    setTimeout(() => {
      setIsViewTransitioning(false);
    }, 250);
  };

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setIsEventFormOpen(true);
  };

  const handleFilterChange = (newFilters: EventFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className={`min-h-screen ${className}`}>
      {/* Modern Error State */}
      {eventsError && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Unable to Load Events</h3>
            <p className="text-slate-600 mb-6">
              {eventsError instanceof Error ? eventsError.message : 'Something went wrong while loading your calendar'}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!eventsError && (
        <div className="animate-in fade-in duration-500">
          <GlassPageTopBar
            title="Events & Calendar"
            subtitle="View and manage school events, exams, and holidays"
            backHref="/dashboard"
            backLabel="Dashboard"
            meta={
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50/80 border border-blue-200/60 text-[10px] font-semibold text-blue-700">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  {allEvents.length} event{allEvents.length !== 1 ? 's' : ''}
                </div>
                {ugandaHolidays.data && ugandaHolidays.data.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50/80 border border-amber-200/60 text-[10px] font-semibold text-amber-700">
                    <span>🇺🇬</span>
                    {ugandaHolidays.data.length} holiday{ugandaHolidays.data.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            }
            actionsLeading={
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={filters.searchTerm || ''}
                  onChange={(e) => handleFilterChange({ searchTerm: e.target.value || undefined })}
                  className="pl-8 pr-3 h-[30px] w-36 sm:w-48 focus:w-56 transition-all duration-200 rounded-full border border-blue-200/60 bg-white/90 text-[11px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 placeholder:text-gray-400"
                />
              </div>
            }
            actions={
              <GlassActionDock>
                <GlassActionButton
                  label="Month"
                  icon={<CalendarDays className="h-4 w-4" />}
                  tone={currentView === 'month' ? 'blue' : 'slate'}
                  onClick={() => handleViewChange('month')}
                />
                <GlassActionButton
                  label="Week"
                  icon={<CalendarRange className="h-4 w-4" />}
                  tone={currentView === 'week' ? 'blue' : 'slate'}
                  onClick={() => handleViewChange('week')}
                />
                <GlassActionButton
                  label="Day"
                  icon={<Clock className="h-4 w-4" />}
                  tone={currentView === 'day' ? 'blue' : 'slate'}
                  onClick={() => handleViewChange('day')}
                />
                <GlassActionButton
                  label="Agenda"
                  icon={<List className="h-4 w-4" />}
                  tone={currentView === 'agenda' ? 'blue' : 'slate'}
                  onClick={() => handleViewChange('agenda')}
                />
                <GlassActionButton
                  label="Term"
                  icon={<BookOpen className="h-4 w-4" />}
                  tone={currentView === 'term' ? 'blue' : 'slate'}
                  onClick={() => setCurrentView('term')}
                />
                {showFilters && (
                  <GlassActionButton
                    label="Filters"
                    icon={<Filter className="h-4 w-4" />}
                    tone={isMobileFiltersOpen ? 'emerald' : 'slate'}
                    onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                  />
                )}
                <GlassActionButton
                  label="New Event"
                  icon={<Plus className="h-4 w-4" />}
                  tone="emerald"
                  onClick={handleCreateEvent}
                />
              </GlassActionDock>
            }
          />

          {/* Wrapper for body layout spacing */}
          <div className="px-4 sm:px-6 lg:px-8 pb-12">

          {/* Mobile Filters - Desktop Inspired */}
          <AnimatePresence>
            {showFilters && isMobileFiltersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="xl:hidden px-4 sm:px-6 lg:px-8 overflow-hidden"
              >
                <div className="space-y-4 pb-6">
                  <div className="bg-white backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <EventFiltersComponent
                      filters={filters}
                      onFiltersChange={handleFilterChange}
                      isCompactView={isCompactView}
                      onToggleCompactView={() => setIsCompactView(!isCompactView)}
                    />
                  </div>

                  {showLegend && (
                    <div className="bg-white backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                      <ColorLegend colors={EVENT_TYPE_COLORS} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 px-4 sm:px-6 lg:px-8 pb-12">
            {/* Desktop Filters Sidebar */}
            {showFilters && (
              <div className="hidden xl:block xl:col-span-1 space-y-6 animate-in slide-in-from-left-4 duration-500">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden p-1">
                  <EventFiltersComponent
                    filters={filters}
                    onFiltersChange={handleFilterChange}
                    isCompactView={isCompactView}
                    onToggleCompactView={() => setIsCompactView(!isCompactView)}
                  />
                </div>

                {showLegend && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden p-1">
                    <ColorLegend colors={EVENT_TYPE_COLORS} />
                  </div>
                )}
              </div>
            )}

            {/* Main Calendar */}
            <div className={cn(
              "transition-all duration-300",
              showFilters ? "xl:col-span-4" : "col-span-1 xl:col-span-5"
            )}>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                {/* Subtle header flair within the calendar body */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />

                <div className={cn(
                  "p-2 ssm:p-4 md:p-8 transition-all duration-300 ease-spring",
                  isViewTransitioning ? "opacity-60 scale-[0.98] blur-sm" : "opacity-100 scale-100 blur-0"
                )}>
                  <div className="transition-opacity duration-200"
                    style={{
                      opacity: isViewTransitioning ? 0.8 : 1
                    }}>
                    {currentView === 'term' ? (
                      // Term View Content
                      <div className="space-y-6">
                        {!isLoadingAcademicYears && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-2xl p-4 sm:p-5 mb-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Academic Timeline</h3>
                                <p className="text-xs text-slate-500 font-medium">Select a period to view events</p>
                              </div>
                            </div>

                            {/* Consolidated Divided Pill Selectors */}
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full p-1 shadow-inner relative z-20 w-full sm:w-auto mt-2 sm:mt-0">
                              <div className="flex-1 sm:w-[180px]">
                                <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                                  <SelectTrigger className="w-full h-[42px] border-0 bg-transparent hover:bg-white rounded-full transition-colors shadow-none focus:ring-0 text-sm font-semibold pl-4">
                                    <SelectValue placeholder="Year" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl min-w-[200px] z-[100]">
                                    {academicYears.map((year: any) => (
                                      <SelectItem key={year.id} value={year.id} className="rounded-lg font-medium cursor-pointer">
                                        {year.name || `Year ${year.id}`} {year.isActive && ' (Active)'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="w-px h-6 bg-slate-300 mx-1 shrink-0"></div>

                              <div className="flex-1 sm:w-[160px]">
                                <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                                  <SelectTrigger className="w-full h-[42px] border-0 bg-transparent hover:bg-white rounded-full transition-colors shadow-none focus:ring-0 text-sm font-semibold pl-4 pr-3">
                                    <SelectValue placeholder="Term" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl min-w-[160px] z-[100]">
                                    {availableTerms.map((term: any) => (
                                      <SelectItem key={term.id} value={term.id} className="rounded-lg font-medium cursor-pointer">
                                        {term.name || `Term ${term.id}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Term Events Display */}
                        {(() => {
                          const selectedTerm = availableTerms.find((term: any) => term.id === selectedTermId);
                          const selectedYear = academicYears.find((year: any) => year.id === selectedAcademicYearId);

                          if (!selectedTerm || !selectedYear) {
                            return (
                              <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
                                <p className="text-slate-500 font-medium">Please select an academic year and term to view events.</p>
                              </div>
                            );
                          }

                          const termStart = new Date(selectedTerm.startDate);
                          const termEnd = new Date(selectedTerm.endDate);
                          const today = new Date();

                          // Validate dates before using them
                          const isValidStartDate = !isNaN(termStart.getTime());
                          const isValidEndDate = !isNaN(termEnd.getTime());

                          if (!isValidStartDate || !isValidEndDate) {
                            return (
                              <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl border border-red-100">
                                <p className="font-semibold">Invalid term dates. Please check the term configuration.</p>
                                <div className="text-sm mt-3 opacity-80">
                                  <p>Start: {selectedTerm.startDate || 'undefined'}</p>
                                  <p>End: {selectedTerm.endDate || 'undefined'}</p>
                                </div>
                              </div>
                            );
                          }

                          const isCurrentTerm = today >= termStart && today <= termEnd;
                          const termProgress = isCurrentTerm ?
                            Math.min(100, Math.max(0, ((today.getTime() - termStart.getTime()) / (termEnd.getTime() - termStart.getTime())) * 100)) :
                            today > termEnd ? 100 : 0;

                          const termFilteredEvents = allEvents.filter(event => {
                            const eventStart = new Date(event.startDate);
                            return eventStart >= termStart && eventStart <= termEnd;
                          });

                          return (
                            <div className="space-y-8 animate-in slide-in duration-500">
                              {/* Term Stats Dashboard */}
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Main Info Card */}
                                <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <CalendarIcon className="w-48 h-48 -mr-12 -mt-12" />
                                  </div>
                                  <div className="relative z-10 h-full flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center gap-3 mb-2">
                                        <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md">
                                          {isCurrentTerm ? "Current Term" : today > termEnd ? "Past Term" : "Upcoming Term"}
                                        </Badge>
                                        <Badge variant="outline" className="border-white/30 text-white/90">
                                          {selectedYear.name || selectedYear.id}
                                        </Badge>
                                      </div>
                                      <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">{selectedTerm.name}</h2>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8">
                                      <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                                        <p className="text-blue-100 text-sm font-medium mb-1">Start Date</p>
                                        <p className="font-bold">{format(termStart, 'MMM d, yyyy')}</p>
                                      </div>
                                      <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                                        <p className="text-blue-100 text-sm font-medium mb-1">End Date</p>
                                        <p className="font-bold">{format(termEnd, 'MMM d, yyyy')}</p>
                                      </div>
                                      <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10 sm:col-span-1 col-span-2">
                                        <p className="text-blue-100 text-sm font-medium mb-1">Duration</p>
                                        <p className="font-bold">{Math.ceil((termEnd.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24))} days</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Progress/Stats Card */}
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-center">
                                  {isCurrentTerm ? (
                                    <div className="space-y-6">
                                      <div>
                                        <div className="flex justify-between items-end mb-3">
                                          <h4 className="text-slate-500 font-medium">Term Progress</h4>
                                          <span className="text-2xl font-black text-blue-600">{Math.round(termProgress)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                          <div
                                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out relative"
                                            style={{ width: `${termProgress}%` }}
                                          >
                                            <div className="absolute inset-0 bg-white/20 w-full" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="pt-6 border-t border-slate-100">
                                        <p className="text-slate-500 font-medium mb-1">Events This Term</p>
                                        <p className="text-3xl font-black text-slate-800">{termFilteredEvents.length}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-center space-y-4">
                                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-500">
                                        <CalendarIcon size={32} />
                                      </div>
                                      <div>
                                        <p className="text-slate-500 font-medium mb-1">Total Events</p>
                                        <p className="text-4xl font-black text-slate-800">{termFilteredEvents.length}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-6">
                                  <h3 className="text-xl font-bold text-slate-800">
                                    Term Schedule
                                  </h3>
                                </div>

                                {termFilteredEvents.length === 0 ? (
                                  <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center bg-slate-50/50 mt-4">
                                    <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-slate-300">
                                      <CalendarIcon size={40} />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-700 mb-2">No scheduled events</h4>
                                    <p className="text-slate-500 mb-6 max-w-sm mx-auto">There are currently no events scheduled for this academic term.</p>
                                    <Button
                                      onClick={handleCreateEvent}
                                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Schedule First Event
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                                    <EventsList
                                      events={termFilteredEvents as Event[]}
                                      isCompact={isCompactView}
                                      onEventClick={(event: Event) => {
                                        setSelectedEvent(event);
                                        setIsEventDetailsOpen(true);
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      // Regular FullCalendar View
                      <div className="fullcalendar-container">
                        <FullCalendar
                          ref={calendarRef}
                          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                          timeZone="local"
                          headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: ''
                          }}
                          initialView={getFullCalendarView(currentView as CalendarViewType)}
                          initialDate={currentDate}
                          height={height}
                          events={calendarEvents}
                          editable={true}
                          selectable={true}
                          selectMirror={true}
                          dayMaxEvents={isCompactView ? 2 : true}
                          dayMaxEventRows={isCompactView ? 2 : undefined}
                          moreLinkClick={isCompactView ? "popover" : "day"}
                          weekends={true}
                          eventClick={handleEventClick}
                          select={handleDateSelect}
                          selectLongPressDelay={50}
                          eventLongPressDelay={50}
                          eventDrop={handleEventDrop}
                          eventDisplay="block"
                          displayEventTime={true}
                          allDaySlot={true}
                          slotMinTime="06:00:00"
                          slotMaxTime="22:00:00"
                          expandRows={true}
                          stickyHeaderDates={true}
                          nowIndicator={true}
                          businessHours={{
                            daysOfWeek: [1, 2, 3, 4, 5],
                            startTime: '07:00',
                            endTime: '17:00',
                          }}
                          eventClassNames="calendar-event"
                          dayCellClassNames="calendar-day"
                          slotLabelClassNames="calendar-time-label"
                          viewClassNames={`calendar-view-${currentView}`}
                          datesSet={(dateInfo) => {
                            setCurrentDate(dateInfo.start);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Form Modal */}
          <EventForm
            event={selectedEvent}
            isOpen={isEventFormOpen}
            onClose={() => {
              setIsEventFormOpen(false);
              setSelectedEvent(null);
            }}
            onSave={(eventData) => {
              if (selectedEvent?.id && !Array.isArray(eventData)) {
                updateEventMutation.mutate({
                  eventId: selectedEvent.id,
                  data: eventData as UpdateEventData
                });
              } else {
                const eventsToCreate = Array.isArray(eventData) ? eventData : [eventData];

                eventsToCreate.forEach((singleEventData) => {
                  const createData: CreateEventData = {
                    title: singleEventData.title || '',
                    description: singleEventData.description || '',
                    type: singleEventData.type || 'Academic',
                    priority: singleEventData.priority || 'Medium',
                    status: singleEventData.status || 'Draft',
                    startDate: singleEventData.startDate || '',
                    endDate: singleEventData.endDate || '',
                    startTime: singleEventData.startTime,
                    endTime: singleEventData.endTime,
                    isAllDay: singleEventData.isAllDay || false,
                    location: singleEventData.location,
                    targetAudience: singleEventData.targetAudience || [],
                    academicYearId: singleEventData.academicYearId || activeAcademicYear?.id || '',
                    termId: singleEventData.termId,
                    classIds: singleEventData.classIds || [],
                    subjectIds: singleEventData.subjectIds || [],
                    isExamEvent: singleEventData.isExamEvent || false,
                    isRecurringInstance: singleEventData.isRecurringInstance || false,
                    recurrence: singleEventData.recurrence || { frequency: 'None' },
                    reminders: singleEventData.reminders || [],
                    sendReminders: singleEventData.sendReminders || true,
                    colorCode: singleEventData.colorCode || EVENT_TYPE_COLORS['Academic'],
                    requiresApproval: singleEventData.requiresApproval || false,
                    requiresAttendance: singleEventData.requiresAttendance || false,
                    isPublic: singleEventData.isPublic !== false,
                    tags: singleEventData.tags || [],
                    createdBy: user?.id || '',
                  };
                  createEventMutation.mutate(createData);
                });
              }
              setIsEventFormOpen(false);
              setSelectedEvent(null);
            }}
          />

          {/* Event Details Modal */}
          <EventDetailsModal
            event={selectedEvent}
            isOpen={isEventDetailsOpen}
            onClose={() => {
              setIsEventDetailsOpen(false);
              setSelectedEvent(null);
            }}
            onEdit={(event) => {
              setSelectedEvent(event);
              setIsEventDetailsOpen(false);
              setIsEventFormOpen(true);
            }}
            onDelete={handleDeleteEvent}
          />

          {/* Delete Confirmation Dialog */}
          {eventToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">Delete Event</h3>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete "{eventToDelete.title}"? This action cannot be undone.
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={cancelDeleteEvent}
                    disabled={deleteEventMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDeleteEvent}
                    disabled={deleteEventMutation.isPending}
                  >
                    {deleteEventMutation.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Modern Custom CSS */}
          <style jsx global>{`
            .hide-scrollbar {
              -ms-overflow-style: none; /* IE and Edge */
              scrollbar-width: none; /* Firefox */
            }
            .hide-scrollbar::-webkit-scrollbar {
              display: none; /* Chrome, Safari and Opera */
            }

            .fullcalendar-container .fc {
              font-family: inherit;
              --fc-border-color: rgba(226, 232, 240, 0.6);
              --fc-today-bg-color: rgba(59, 130, 246, 0.04);
              --fc-page-bg-color: transparent;
            }
            
            /* Clean up borders for a lighter look */
            .fullcalendar-container .fc-theme-standard th {
              border: none;
              padding: 12px 0 8px 0;
              font-weight: 600;
              color: #475569;
              text-transform: uppercase;
              font-size: 0.70rem;
              letter-spacing: 0.05em;
              text-align: right;
              padding-right: 8px;
            }
            
            .fullcalendar-container .fc-theme-standard td,
            .fullcalendar-container .fc-theme-standard th {
              border: 1px solid rgba(226, 232, 240, 0.4);
            }

            .fullcalendar-container .fc-scrollgrid {
              border: 1px solid rgba(226, 232, 240, 0.4) !important;
            }

            .fullcalendar-container .fc-daygrid-day-number {
              font-size: 0.8rem;
              color: #64748b;
              padding: 4px 8px;
            }
            
            /* Modernized Title & Standardized Buttons */
            .fullcalendar-container .fc-toolbar-title {
              font-size: 1.5rem !important;
              font-weight: 700 !important;
              letter-spacing: -0.025em;
              color: hsl(var(--foreground));
            }

            .fullcalendar-container .fc-button-primary {
              /* Default (inactive): white center + colorful outer ring */
              background: white !important;
              color: #4f46e5 !important;
              border: none !important;
              outline: 3px solid #60a5fa !important;
              outline-offset: 0px !important;
              border-radius: 50% !important;
              font-weight: 700 !important;
              padding: 0 !important;
              text-transform: capitalize !important;
              transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
              box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.25), 0 6px 16px rgba(59, 130, 246, 0.35) !important;
              display: inline-flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              width: 44px !important;
              height: 44px !important;
              flex: 0 0 auto !important;
            }
            
            @media (min-width: 640px) {
              .fullcalendar-container .fc-button-primary {
                width: 44px !important;
                height: 44px !important;
              }
            }
            
            @media (min-width: 768px) {
              .fullcalendar-container .fc-button-primary {
                width: 46px !important;
                height: 46px !important;
              }
            }

            .fullcalendar-container .fc-button-primary .fc-icon {
              font-size: 1.1rem !important;
              font-weight: 900 !important;
            }

            /* Prev button = LEFT half of a split pill (semicircle on left, slightly rounded on right) */
            .fullcalendar-container .fc-button-primary.fc-prev-button {
              border-radius: 999px 8px 8px 999px !important;
              width: 44px !important;
              height: 44px !important;
              outline-color: #86efac !important;
              box-shadow: 0 0 0 4px rgba(134, 239, 172, 0.4), 0 6px 18px rgba(34, 197, 94, 0.45) !important;
              color: #15803d !important;
              margin-right: 2px !important;
            }
            @media (min-width: 768px) {
              .fullcalendar-container .fc-button-primary.fc-prev-button {
                width: 46px !important;
                height: 46px !important;
              }
            }

            /* Next button = RIGHT half of a split pill (slightly rounded on left, semicircle on right) */
            .fullcalendar-container .fc-button-primary.fc-next-button {
              border-radius: 8px 999px 999px 8px !important;
              width: 44px !important;
              height: 44px !important;
              outline-color: #86efac !important;
              box-shadow: 0 0 0 4px rgba(134, 239, 172, 0.4), 0 6px 18px rgba(34, 197, 94, 0.45) !important;
              color: #15803d !important;
              margin-left: 2px !important;
            }
            @media (min-width: 768px) {
              .fullcalendar-container .fc-button-primary.fc-next-button {
                width: 46px !important;
                height: 46px !important;
              }
            }

            /* Hover state for prev/next: fills green */
            .fullcalendar-container .fc-prev-button:hover:not(:disabled),
            .fullcalendar-container .fc-next-button:hover:not(:disabled) {
              background: linear-gradient(135deg, #16a34a, #4ade80, #16a34a) !important;
              color: white !important;
              outline-color: white !important;
              box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.45), 0 10px 24px rgba(34, 197, 94, 0.55) !important;
              transform: scale(1.05) !important;
            }
            
            .fullcalendar-container .fc-button-primary.fc-today-button {
              font-size: 10px !important;
              letter-spacing: -0.03em !important;
              border-radius: 50% !important;
            }
            
            .fullcalendar-container .fc-button-primary:hover:not(:disabled) {
              transform: scale(1.08) !important;
              box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.35), 0 10px 24px rgba(59, 130, 246, 0.50) !important;
            }
            
            .fullcalendar-container .fc-button-primary:active {
              transform: scale(0.93) !important;
            }

            /* Active (clicked): colorful gradient center + white inner ring */
            .fullcalendar-container .fc-button-active,
            .fullcalendar-container .fc-button-primary:not(:disabled):focus {
              background: linear-gradient(135deg, #3b82f6, #6366f1, #2563eb) !important;
              color: white !important;
              outline: 3px solid white !important;
              outline-offset: 0px !important;
              box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.45), 0 8px 20px rgba(99, 102, 241, 0.50) !important;
            }

            /* Toolbar container - transparent so ring shadows show */
            .fullcalendar-container .fc-toolbar-chunk:first-child {
              background-color: transparent;
              border-radius: 9999px;
              padding: 0.5rem;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }

            .fullcalendar-container .fc-button-group {
              display: flex !important;
              gap: 0.5rem !important;
            }

            .fullcalendar-container .fc-button-group > .fc-button {
              margin: 0 !important;
              border-radius: 50% !important;
            }

            /* Event Chips - Base Configuration */
            .fullcalendar-container .fc-event {
              border-radius: 2px;
              border: none;
              font-size: clamp(0.5rem, 0.4rem + 0.4vw, 0.65rem);
              font-weight: 500;
              line-height: 1.2;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            /* Standardized Block Events */
            .fullcalendar-container .fc-daygrid-event,
            .fullcalendar-container .fc-timegrid-event {
              padding: clamp(1px, 0.4vw, 2px) clamp(4px, 0.6vw, 6px);
              box-shadow: none !important;
              color: #ffffff !important;
            }
            
            .fullcalendar-container .fc-daygrid-event .fc-event-title,
            .fullcalendar-container .fc-daygrid-event .fc-event-time {
              color: #ffffff !important;
              font-weight: 600;
            }

            .fullcalendar-container .fc-event:hover {
              transform: scale(1.02);
              z-index: 20 !important;
            }
            
            .fullcalendar-container .fc-day-today {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05)) !important;
            }
            
            .fullcalendar-container .fc-highlight {
              background: rgba(59, 130, 246, 0.1) !important;
            }
            
            .fullcalendar-container .fc-daygrid-event {
              white-space: normal; /* Allow text to wrap */
              word-break: break-word; /* Ensure long words break */
              margin: 1px 2px;
            }
            
            .fullcalendar-container .fc-timegrid-event {
              border-radius: 8px;
              padding: 4px;
            }
            
            .fullcalendar-container .fc-list-event:hover td {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.03), rgba(99, 102, 241, 0.03));
            }
            
            /* Uganda Holiday Styles */
            .fullcalendar-container .fc-event[title*="🇺🇬"] {
              background: linear-gradient(135deg, #f59e0b, #f97316) !important;
              border-color: transparent !important;
              box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
            }
            
            .fullcalendar-container .fc-event[title*="🇺🇬"]:hover {
              background: linear-gradient(135deg, #d97706, #ea580c) !important;
              box-shadow: 0 6px 16px rgba(245, 158, 11, 0.5);
            }
            
            /* Regular Holiday Styles */
            .fullcalendar-container .fc-event[data-event-type="Holiday"]:not([title*="🇺🇬"]) {
              background: linear-gradient(135deg, #ef4444, #dc2626) !important;
              border-color: transparent !important;
              box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
            }
            
            .fullcalendar-container .fc-event[data-event-type="Holiday"]:not([title*="🇺🇬"]):hover {
              background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
              box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
              .fullcalendar-container .fc-toolbar {
                flex-direction: column;
                gap: 8px;
                margin-bottom: 12px !important;
              }
              
              .fullcalendar-container .fc-toolbar-chunk {
                display: flex;
                justify-content: center;
                width: 100%;
                flex-wrap: wrap; /* allow wrapping if buttons are too wide */
              }

              .fullcalendar-container .fc-toolbar-title {
                font-size: 1.1rem !important;
                text-align: center;
              }

              .fullcalendar-container .fc-toolbar-chunk:last-child {
                justify-content: space-between;
              }
              
              .fullcalendar-container .fc-button {
                padding: 6px 10px !important;
                font-size: 0.75rem !important;
                border-radius: 6px !important;
              }
              
              .fullcalendar-container .fc-event {
                padding: 1px 2px;
                line-height: 1.1;
              }

              .fullcalendar-container .fc-theme-standard th {
                padding: 8px 4px;
                font-size: 0.65rem;
              }
            }
            
            /* Smooth Animation Classes */
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes slideIn {
              from { opacity: 0; transform: translateX(12px); }
              to { opacity: 1; transform: translateX(0); }
            }
            
            .animate-in {
              animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            
            .fade-in {
              animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            
            .slide-in {
              animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            
            /* Smooth View Transitions */
            .calendar-view-month,
            .calendar-view-week, 
            .calendar-view-day,
            .calendar-view-agenda {
              transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            
            /* Custom Scrollbar for TimeGrid */
            .fc-scroller::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            .fc-scroller::-webkit-scrollbar-track {
              background: rgba(0,0,0,0.02);
            }
            .fc-scroller::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.4);
              border-radius: 4px;
            }
            .fc-scroller::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.6);
            }
          `}</style>
        </div>
        </div>
      )}
    </div>
  );
}
