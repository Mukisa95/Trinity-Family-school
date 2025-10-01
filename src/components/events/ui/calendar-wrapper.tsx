'use client';

import { useState, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicYearsForEvents, useCurrentTerm } from '@/lib/hooks/use-events-fixed';
import { format } from 'date-fns';
import type { AcademicYear, Term } from '@/types';

interface CalendarWrapperProps {
  events: any[];
  examEvents: any[];
  onEventCreate: (eventData: any) => void;
  onEventClick: (event: any) => void;
  filters: any;
  onFiltersChange: (filters: any) => void;
}

export function CalendarWrapper({ 
  events, 
  examEvents, 
  onEventCreate, 
  onEventClick, 
  filters, 
  onFiltersChange 
}: CalendarWrapperProps) {
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day' | 'agenda' | 'term'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');

  // Fetch academic years for term view
  const { data: academicYears = [], isLoading: isLoadingAcademicYears } = useAcademicYearsForEvents();
  const currentTerm = useCurrentTerm(academicYears);

  // Set default academic year and term
  useEffect(() => {
    if (academicYears.length > 0 && !selectedAcademicYearId) {
      const activeYear = academicYears.find(year => year.isActive) || academicYears[0];
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

  // Get available terms for selected academic year
  const availableTerms = useMemo(() => {
    const selectedYear = academicYears.find(year => year.id === selectedAcademicYearId);
    return selectedYear ? selectedYear.terms : [];
  }, [academicYears, selectedAcademicYearId]);

  // Filter events by term when in term view
  const termFilteredEvents = useMemo(() => {
    if (currentView !== 'term' || !selectedTermId) {
      return [...events, ...examEvents];
    }

    const selectedTerm = availableTerms.find(term => term.id === selectedTermId);
    if (!selectedTerm) return [...events, ...examEvents];

    const termStart = new Date(selectedTerm.startDate);
    const termEnd = new Date(selectedTerm.endDate);

    const filteredEvents = [...events, ...examEvents].filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= termStart && eventStart <= termEnd;
    });

    return filteredEvents;
  }, [events, examEvents, currentView, selectedTermId, availableTerms]);

  // Combine events for FullCalendar
  const combinedEvents = useMemo(() => {
    return [...events, ...examEvents];
  }, [events, examEvents]);

  // Helper function to get FullCalendar view name
  const getFullCalendarView = (view: string) => {
    switch (view) {
      case 'month': return 'dayGridMonth';
      case 'week': return 'timeGridWeek';
      case 'day': return 'timeGridDay';
      case 'agenda': return 'listWeek';
      default: return 'dayGridMonth';
    }
  };

  // Handle date selection for event creation
  const handleDateSelect = (selectInfo: any) => {
    const selectedDate = selectInfo.date;
    onEventCreate({
      date: selectedDate,
      allDay: selectInfo.allDay,
      academicYearId: selectedAcademicYearId,
      termId: selectedTermId
    });
  };

  // Handle event click
  const handleEventClick = (clickInfo: any) => {
    onEventClick(clickInfo.event);
  };

  const handleViewChange = (view: 'month' | 'week' | 'day' | 'agenda' | 'term') => {
    setCurrentView(view);
    if (view === 'term' && !selectedTermId && availableTerms.length > 0) {
      setSelectedTermId(availableTerms[0].id);
    }
  };

  // Effect to update FullCalendar view when currentView changes
  useEffect(() => {
    // This effect ensures the view is properly updated when currentView changes
    // The key prop on FullCalendar will handle the re-rendering
  }, [currentView]);

  // Render term view
  const renderTermView = () => {
    const selectedTerm = availableTerms.find(term => term.id === selectedTermId);
    const selectedYear = academicYears.find(year => year.id === selectedAcademicYearId);
    
    if (!selectedTerm || !selectedYear) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <p>Please select an academic year and term to view events.</p>
        </div>
      );
    }

    const termStart = new Date(selectedTerm.startDate);
    const termEnd = new Date(selectedTerm.endDate);
    const today = new Date();
    
    const isCurrentTerm = today >= termStart && today <= termEnd;
    const termProgress = isCurrentTerm ? 
      Math.min(100, Math.max(0, ((today.getTime() - termStart.getTime()) / (termEnd.getTime() - termStart.getTime())) * 100)) : 
      today > termEnd ? 100 : 0;

    return (
      <div className="space-y-6">
        {/* Term Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">{selectedTerm.name}</h2>
              <p className="text-blue-700">{selectedYear.name} Academic Year</p>
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

        {/* Term Events */}
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Events in {selectedTerm.name} ({termFilteredEvents.length})
          </h3>
          
          {termFilteredEvents.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <p className="text-muted-foreground">No events scheduled for this term.</p>
              <Button 
                onClick={() => onEventCreate({ 
                  date: termStart, 
                  academicYearId: selectedAcademicYearId, 
                  termId: selectedTermId 
                })} 
                className="mt-4"
              >
                Schedule First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {termFilteredEvents
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .map((event, index) => (
                  <div 
                    key={event.id || index}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onEventClick(event)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: event.backgroundColor || '#3b82f6' }}
                          />
                          <h4 className="font-semibold">{event.title}</h4>
                          {event.isExamEvent && (
                            <Badge variant="destructive" className="text-xs">Exam</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {format(new Date(event.start), 'PPP')}
                          {event.start !== event.end && ` - ${format(new Date(event.end), 'PPP')}`}
                        </p>
                        {event.description && (
                          <p className="text-sm text-gray-600">{event.description}</p>
                        )}
                        {event.location && (
                          <p className="text-xs text-muted-foreground mt-1">📍 {event.location}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Enhanced Header with Term Selection */}
      <div className="flex-shrink-0 space-y-4 p-4 border-b">
        {/* View Toggle Buttons */}
        <div className="flex flex-wrap gap-2">
          {['month', 'week', 'day', 'agenda', 'term'].map((view) => (
            <div key={view}>
              <Button
                variant={currentView === view ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewChange(view as any)}
                className="capitalize transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                {view}
              </Button>
            </div>
          ))}
        </div>

        {/* Academic Year and Term Selection for Term View */}
        {currentView === 'term' && !isLoadingAcademicYears && (
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Academic Year</label>
              <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name} {year.isActive && '(Active)'}
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
                  {availableTerms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Event Count Display */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total Events: {currentView === 'term' ? termFilteredEvents.length : combinedEvents.length}</span>
          <span>Regular: {currentView === 'term' ? termFilteredEvents.filter(e => !e.isExamEvent).length : events.length}</span>
          <span>Exams: {currentView === 'term' ? termFilteredEvents.filter(e => e.isExamEvent).length : examEvents.length}</span>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 min-h-0 transition-opacity duration-200">
        <div className="h-full animate-in fade-in duration-300">
          {currentView === 'term' ? (
            renderTermView()
          ) : (
            <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={getFullCalendarView(currentView)}
            headerToolbar={{
              start: 'prev,next today',
              center: 'title',
              end: ''
            }}
            events={combinedEvents}
            dateClick={handleDateSelect}
            eventClick={handleEventClick}
            height="100%"
            eventDisplay="block"
            dayMaxEvents={3}
            moreLinkClick="popover"
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              omitZeroMinute: false,
              meridiem: 'short'
            }}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            nowIndicator={true}
            selectMirror={true}
            dayHeaders={true}
            weekends={true}
            droppable={false}
            editable={false}
          />
        )}
        </div>
      </div>
    </div>
  );
}

// Simple CSS for smooth animations
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-in {
    animation: fadeIn 0.3s ease-out;
  }
  
  .fade-in {
    animation: fadeIn 0.2s ease-out;
  }
`; 