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
import { Calendar as CalendarIcon, Plus, List, Grid3X3, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, useExamsAsEvents, useAcademicYearsForEvents, useCurrentTerm } from '@/lib/hooks/use-events-fixed';
import { useUgandaHolidays } from '@/lib/hooks/use-uganda-holidays';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/lib/contexts/auth-context';
import type { 
  Event, 
  EventType, 
  CalendarViewType, 
  EventFilters,
  CreateEventData
} from '@/types';
import { EventForm } from '../forms/event-form';
import { EventDetailsModal } from '../ui/event-details-modal';
import { EventFilters as EventFiltersComponent } from '../ui/event-filters';
import { ColorLegend } from '../ui/color-legend';
import { EventsList } from '../ui/events-list';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

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
  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useEvents(filters);
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();
  const examsAsEvents = useExamsAsEvents();
  const ugandaHolidays = useUgandaHolidays(currentDate);
  const { data: academicYears = [], isLoading: isLoadingAcademicYears } = useAcademicYearsForEvents();
  const currentTerm = useCurrentTerm(academicYears);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please log in to view the calendar.</p>
      </div>
    );
  }

  // Set default academic year and term
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYearId) {
      const activeYear = academicYears.find((year: any) => year.isActive) || academicYears[0];
      if (activeYear) {
        setSelectedAcademicYearId(activeYear.id);
        if (currentTerm && currentTerm.year.id === activeYear.id) {
          setSelectedTermId(currentTerm.term.id);
        } else if (activeYear.terms.length > 0) {
          setSelectedTermId(activeYear.terms[0].id);
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

  // Get available terms for selected academic year
  const availableTerms = useMemo(() => {
    const selectedYear = academicYears.find((year: any) => year.id === selectedAcademicYearId);
    return selectedYear ? selectedYear.terms : [];
  }, [academicYears, selectedAcademicYearId]);

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
      filteredEvents = filteredEvents.filter(event => filters.statuses!.includes(event.status));
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

  // Event handlers
  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = allEvents.find(e => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
      setIsEventDetailsOpen(true);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    console.log('handleDeleteEvent called with eventId:', eventId);
    const event = allEvents.find(e => e.id === eventId);
    console.log('Found event:', event);
    if (event) {
      setEventToDelete(event);
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
    const endDate = format(selectInfo.end || selectInfo.start, 'yyyy-MM-dd');
    const startTime = selectInfo.allDay ? undefined : format(selectInfo.start, 'HH:mm');
    const endTime = selectInfo.allDay || !selectInfo.end ? undefined : format(selectInfo.end, 'HH:mm');

    setSelectedEvent({
      id: '',
      title: '',
      type: 'Academic',
      priority: 'Medium',
      status: 'Draft',
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay: selectInfo.allDay,
      targetAudience: [],
      recurrence: { frequency: 'None' },
      isExamEvent: false,
      isRecurringInstance: false,
      reminders: [],
      notificationsSent: [],
      sendReminders: true,
      colorCode: EVENT_TYPE_COLORS['Academic'],
      requiresApproval: false,
      requiresAttendance: false,
      isPublic: true,
      createdBy: user?.id || '',
      createdAt: new Date().toISOString(),
    } as Event);
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
      };
      
      updateEventMutation.mutate({
        eventId: event.id,
        data: updatedEvent
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

  const getFullCalendarView = (view: CalendarViewType) => {
    switch (view) {
      case 'month': return 'dayGridMonth';
      case 'week': return 'timeGridWeek';
      case 'day': return 'timeGridDay';
      case 'agenda': return 'listWeek';
      default: return 'dayGridMonth';
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 ${className}`}>
      {/* Modern Loading State */}
      {eventsLoading && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-slate-700">Loading your events</p>
              <p className="text-sm text-slate-500">Please wait while we fetch your calendar data...</p>
            </div>
          </div>
        </div>
      )}

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
      {!eventsLoading && !eventsError && (
        <div className="animate-in fade-in duration-500">
          {/* Modern Header - Mobile Optimized */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 p-4 sm:p-6 mb-6 sm:mb-8 mx-4 sm:mx-6 lg:mx-8">
            <div className="flex flex-col gap-4 sm:gap-6">
              
              {/* Top Row - Title and View Options */}
              <div className="flex items-center justify-between gap-3">
                {/* Title Section - Compact */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent truncate">
                      Events & Calendar
                    </h1>
                    {/* Mobile Stats - Compact */}
                    <div className="flex items-center gap-2 mt-1 sm:hidden">
                      <div className="flex items-center gap-1 text-xs text-blue-700">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span>{allEvents.length}</span>
                      </div>
                      {ugandaHolidays.data && ugandaHolidays.data.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-amber-700">
                          <span>🇺🇬</span>
                          <span>{ugandaHolidays.data.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* View Options - Compact */}
                <div className="flex bg-white/80 backdrop-blur-sm rounded-xl p-0.5 sm:p-1 shadow-sm border border-white/20 relative overflow-hidden">
                  {/* Animated Background Indicator */}
                  <div
                    className="absolute inset-y-0.5 sm:inset-y-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg transition-all duration-300 ease-out"
                    style={{
                      transform: `translateX(${
                        currentView === 'month' ? '0%' : 
                        currentView === 'week' ? '100%' :
                        currentView === 'day' ? '200%' :
                        currentView === 'agenda' ? '300%' :
                        currentView === 'term' ? '400%' : '0%'
                      })`,
                      width: '20%'
                    }}
                  />
                  
                  {(['month', 'week', 'day', 'agenda'] as CalendarViewType[]).map((view, index) => (
                    <div
                      key={view}
                      className="relative z-10 flex-1"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewChange(view)}
                        disabled={isViewTransitioning}
                        className={cn(
                          "w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm capitalize transition-all duration-200 rounded-lg relative min-h-[28px] sm:min-h-[32px] hover:scale-[1.02] active:scale-[0.98]",
                          currentView === view 
                            ? "text-white font-semibold" 
                            : "text-slate-600 hover:text-slate-800 hover:bg-white/30"
                        )}
                      >
                        <span className={cn(
                          "transition-opacity duration-200",
                          isViewTransitioning && currentView === view ? "opacity-70" : "opacity-100"
                        )}>
                          {view}
                        </span>
                        {isViewTransitioning && currentView === view && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </Button>
                    </div>
                  ))}
                  
                  <div className="relative z-10 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentView('term')}
                      className={cn(
                        "w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm capitalize transition-all duration-200 rounded-lg min-h-[28px] sm:min-h-[32px] hover:scale-[1.02] active:scale-[0.98]",
                        currentView === 'term' 
                          ? "text-white font-semibold" 
                          : "text-slate-600 hover:text-slate-800 hover:bg-white/30"
                      )}
                    >
                      term
                    </Button>
                  </div>
                </div>

                {/* Primary Action - Always Visible */}
                <Button 
                  onClick={handleCreateEvent}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3 sm:px-4 lg:px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex-shrink-0"
                >
                  <Plus className="h-4 w-4 sm:mr-1 lg:mr-2" />
                  <span className="hidden sm:inline lg:hidden">New</span>
                  <span className="hidden lg:inline">New Event</span>
                </Button>
              </div>

              {/* Desktop Stats */}
              <div className="hidden sm:flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-blue-700">
                    {allEvents.length} event{allEvents.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {ugandaHolidays.data && ugandaHolidays.data.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                    <span className="text-sm">🇺🇬</span>
                    <span className="text-sm font-medium text-amber-700">
                      {ugandaHolidays.data.length} holiday{ugandaHolidays.data.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Compact Controls Section */}
              <div className="flex justify-between items-center gap-2">
                {/* Left Group - Filter and Compact View Toggle */}
                  <div className="flex gap-2">
                    {/* Mobile Filter Toggle */}
                    {showFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                        className={cn(
                        "flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border-white/20 hover:bg-white/90 transition-all duration-200 xl:hidden px-2 py-1.5 min-h-[32px]",
                          isMobileFiltersOpen && "bg-blue-50 border-blue-200 text-blue-700"
                        )}
                      >
                      <Filter className="h-3.5 w-3.5" />
                        {isMobileFiltersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      <span className="text-xs">Filters</span>
                      </Button>
                    )}

                    {/* Compact View Toggle */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCompactView(!isCompactView)}
                    className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border-white/20 hover:bg-white/90 transition-all duration-200 px-2 py-1.5 min-h-[32px]"
                    >
                    {isCompactView ? <Grid3X3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                    <span className="text-xs">{isCompactView ? 'Expanded' : 'Compact'}</span>
                    </Button>
                  </div>

                {/* Right Group - Quick Stats */}
                <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-md">
                      <span className="font-medium capitalize">{currentView}</span> view
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Filters - Compact */}
          {showFilters && isMobileFiltersOpen && (
            <div className={cn(
              "xl:hidden px-4 sm:px-6 lg:px-8 overflow-hidden transition-all duration-300 ease-out",
              isMobileFiltersOpen ? "opacity-100 max-h-80" : "opacity-0 max-h-0"
            )}>
              <div className="space-y-3 pb-4">
                <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-lg border border-white/20 overflow-hidden">
                  <EventFiltersComponent
                    filters={filters}
                    onFiltersChange={handleFilterChange}
                  />
                </div>
                
                {showLegend && (
                  <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-lg border border-white/20 overflow-hidden">
                    <ColorLegend colors={EVENT_TYPE_COLORS} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Desktop Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 px-4 sm:px-6 lg:px-8">
            {/* Desktop Filters Sidebar - Compact */}
            {showFilters && (
              <div className="hidden xl:block xl:col-span-1 space-y-3">
                <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-lg border border-white/20 overflow-hidden">
                  <EventFiltersComponent
                    filters={filters}
                    onFiltersChange={handleFilterChange}
                  />
                </div>
                
                {showLegend && (
                  <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-lg border border-white/20 overflow-hidden">
                    <ColorLegend colors={EVENT_TYPE_COLORS} />
                  </div>
                )}
              </div>
            )}

            {/* Main Calendar */}
            <div className={showFilters ? "xl:col-span-4" : "col-span-1"}>
              <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden animate-in fade-in duration-500">
                <div className={cn(
                  "p-6 transition-all duration-250 ease-out",
                  isViewTransitioning ? "opacity-80 scale-[0.99]" : "opacity-100 scale-100"
                )}>
                  <div className="transition-opacity duration-200"
                    style={{
                      opacity: isViewTransitioning ? 0.8 : 1
                    }}>
                    {currentView === 'term' ? (
                    // Term View Content
                    <div className="space-y-6">
                      {!isLoadingAcademicYears && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h3 className="font-semibold mb-3">Academic Term View</h3>
                          <div className="flex flex-wrap gap-4">
                            <div className="min-w-[200px]">
                              <label className="text-sm font-medium mb-1 block">Academic Year</label>
                              <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Academic Year" />
                                </SelectTrigger>
                                <SelectContent>
                                  {academicYears.map((year: any) => (
                                    <SelectItem key={year.id} value={year.id}>
                                      {year.name || `Academic Year ${year.id}`} 
                                      {year.isActive && ' (Active)'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="min-w-[200px]">
                              <label className="text-sm font-medium mb-1 block">Term</label>
                              <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Term" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTerms.map((term: any) => (
                                    <SelectItem key={term.id} value={term.id}>
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
                            <div className="p-8 text-center text-muted-foreground">
                              <p>Please select an academic year and term to view events.</p>
                            </div>
                          );
                        }

                        // Debug: Log the term data to see what we're getting
                        console.log('Selected term data:', selectedTerm);
                        console.log('Term startDate:', selectedTerm.startDate, 'Type:', typeof selectedTerm.startDate);
                        console.log('Term endDate:', selectedTerm.endDate, 'Type:', typeof selectedTerm.endDate);

                        const termStart = new Date(selectedTerm.startDate);
                        const termEnd = new Date(selectedTerm.endDate);
                        const today = new Date();
                        
                        // Validate dates before using them
                        const isValidStartDate = !isNaN(termStart.getTime());
                        const isValidEndDate = !isNaN(termEnd.getTime());
                        
                        if (!isValidStartDate || !isValidEndDate) {
                          console.error('Invalid term dates detected:', {
                            startDate: selectedTerm.startDate,
                            endDate: selectedTerm.endDate,
                            termStart,
                            termEnd,
                            isValidStartDate,
                            isValidEndDate
                          });
                          return (
                            <div className="p-8 text-center text-red-600">
                              <p>Invalid term dates. Please check the term configuration.</p>
                              <p className="text-sm mt-2">Start: {selectedTerm.startDate || 'undefined'}</p>
                              <p className="text-sm">End: {selectedTerm.endDate || 'undefined'}</p>
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
                          <>
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h2 className="text-2xl font-bold text-blue-900">{selectedTerm.name}</h2>
                                  <p className="text-blue-700">{selectedYear.name || selectedYear.id} Academic Year</p>
                                </div>
                                <Badge variant={isCurrentTerm ? "default" : "secondary"} className="text-sm">
                                  {isCurrentTerm ? "Current Term" : today > termEnd ? "Past Term" : "Upcoming Term"}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                  <p className="text-sm text-blue-600">Start Date</p>
                                  <p className="font-semibold">{format(termStart, 'PPP')}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-blue-600">End Date</p>
                                  <p className="font-semibold">{format(termEnd, 'PPP')}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-blue-600">Duration</p>
                                  <p className="font-semibold">{Math.ceil((termEnd.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24))} days</p>
                                </div>
                              </div>

                              {isCurrentTerm && (
                                <div>
                                  <div className="flex justify-between text-sm text-blue-700 mb-2">
                                    <span>Term Progress</span>
                                    <span>{Math.round(termProgress)}%</span>
                                  </div>
                                  <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                      style={{ width: `${termProgress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div>
                              <h3 className="text-lg font-semibold mb-4">
                                Events in {selectedTerm.name} ({termFilteredEvents.length})
                              </h3>
                              
                              {termFilteredEvents.length === 0 ? (
                                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                                  <p className="text-muted-foreground">No events scheduled for this term.</p>
                                  <Button onClick={handleCreateEvent} className="mt-4">
                                    Schedule First Event
                                  </Button>
                                </div>
                              ) : (
                                <EventsList 
                                  events={termFilteredEvents as Event[]}
                                  isCompact={isCompactView}
                                  onEventClick={(event: Event) => {
                                    setSelectedEvent(event);
                                    setIsEventDetailsOpen(true);
                                  }}
                                />
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    // Regular FullCalendar View
                    <div className="fullcalendar-container">
                      <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
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
              if (selectedEvent?.id) {
                updateEventMutation.mutate({
                  eventId: selectedEvent.id,
                  data: eventData
                });
              } else {
                const createData: CreateEventData = {
                  title: eventData.title || '',
                  description: eventData.description || '',
                  type: eventData.type || 'Academic',
                  priority: eventData.priority || 'Medium',
                  status: eventData.status || 'Draft',
                  startDate: eventData.startDate || '',
                  endDate: eventData.endDate || '',
                  startTime: eventData.startTime,
                  endTime: eventData.endTime,
                  isAllDay: eventData.isAllDay || false,
                  location: eventData.location,
                  targetAudience: eventData.targetAudience || [],
                  academicYearId: eventData.academicYearId || activeAcademicYear?.id || '',
                  termId: eventData.termId,
                  classIds: eventData.classIds || [],
                  subjectIds: eventData.subjectIds || [],
                  isExamEvent: eventData.isExamEvent || false,
                  isRecurringInstance: eventData.isRecurringInstance || false,
                  recurrence: eventData.recurrence || { frequency: 'None' },
                  reminders: eventData.reminders || [],
                  sendReminders: eventData.sendReminders || true,
                  colorCode: eventData.colorCode || EVENT_TYPE_COLORS['Academic'],
                  requiresApproval: eventData.requiresApproval || false,
                  requiresAttendance: eventData.requiresAttendance || false,
                  isPublic: eventData.isPublic !== false,
                  tags: eventData.tags || [],
                  createdBy: user?.id || '',
                };
                createEventMutation.mutate(createData);
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
            .fullcalendar-container .fc {
              font-family: inherit;
              --fc-border-color: #e2e8f0;
              --fc-today-bg-color: rgba(59, 130, 246, 0.05);
            }
            
            .fullcalendar-container .fc-theme-standard td,
            .fullcalendar-container .fc-theme-standard th {
              border: 1px solid #e2e8f0;
            }
            
            .fullcalendar-container .fc-button-primary {
              background: linear-gradient(135deg, #3b82f6, #6366f1);
              border: none;
              border-radius: 8px;
              font-weight: 500;
              transition: all 0.2s ease;
            }
            
            .fullcalendar-container .fc-button-primary:hover {
              background: linear-gradient(135deg, #2563eb, #4f46e5);
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            
            .fullcalendar-container .fc-event {
              border-radius: 6px;
              border: none;
              padding: 3px 6px;
              font-size: 0.875rem;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              backdrop-filter: blur(4px);
            }
            
            .fullcalendar-container .fc-event:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              z-index: 10;
            }
            
            .fullcalendar-container .fc-day-today {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.03), rgba(99, 102, 241, 0.03)) !important;
            }
            
            .fullcalendar-container .fc-highlight {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1)) !important;
            }
            
            .fullcalendar-container .fc-daygrid-event {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin: 1px 2px;
            }
            
            .fullcalendar-container .fc-timegrid-event {
              border-radius: 6px;
              padding: 2px 4px;
            }
            
            .fullcalendar-container .fc-list-event:hover {
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05));
            }
            
            /* Uganda Holiday Styles */
            .fullcalendar-container .fc-event[title*="🇺🇬"] {
              background: linear-gradient(135deg, #f59e0b, #f97316) !important;
              border-color: #d97706 !important;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
            }
            
            .fullcalendar-container .fc-event[title*="🇺🇬"]:hover {
              background: linear-gradient(135deg, #d97706, #ea580c) !important;
              box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5);
            }
            
            /* Regular Holiday Styles */
            .fullcalendar-container .fc-event[data-event-type="Holiday"]:not([title*="🇺🇬"]) {
              background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
              border-color: #b91c1c !important;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
            }
            
            .fullcalendar-container .fc-event[data-event-type="Holiday"]:not([title*="🇺🇬"]):hover {
              background: linear-gradient(135deg, #b91c1c, #991b1b) !important;
              box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
              .fullcalendar-container .fc-toolbar {
                flex-direction: column;
                gap: 12px;
              }
              
              .fullcalendar-container .fc-toolbar-chunk {
                display: flex;
                justify-content: center;
              }
              
              .fullcalendar-container .fc-button {
                padding: 6px 12px;
                font-size: 0.875rem;
              }
              
              .fullcalendar-container .fc-event {
                font-size: 0.75rem;
                padding: 2px 4px;
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
              animation: fadeIn 0.3s ease-out;
            }
            
            .fade-in {
              animation: fadeIn 0.2s ease-out;
            }
            
            .slide-in {
              animation: slideIn 0.25s ease-out;
            }
            
            /* Smooth View Transitions */
            .calendar-view-month,
            .calendar-view-week, 
            .calendar-view-day,
            .calendar-view-agenda {
              transition: opacity 0.2s ease-out, transform 0.2s ease-out;
            }
          `}</style>
        </div>
      )}
    </div>
  );
} 