"use client";

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronRight, Loader2, CalendarDays } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEvents, useExamsAsEvents } from '@/lib/hooks/use-events-fixed';
import { useUgandaHolidays } from '@/lib/hooks/use-uganda-holidays';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

const EVENT_TYPE_COLORS = {
    'Academic': '#3b82f6',
    'Co-curricular': '#10b981',
    'Administrative': '#f59e0b',
    'Holiday': '#dc2626',
} as const;

const UGANDA_HOLIDAY_COLOR = '#f59e0b';

export function MonthCalendarCard() {
    const router = useRouter();
    const [popoverState, setPopoverState] = React.useState<{ isOpen: boolean; date: Date | null; events: any[]; anchorEl: HTMLElement | null }>({
        isOpen: false,
        date: null,
        events: [],
        anchorEl: null,
    });
    const { data: activeAcademicYear } = useActiveAcademicYear();
    const filters = useMemo(() => ({
        academicYearIds: activeAcademicYear ? [activeAcademicYear.id] : [],
    }), [activeAcademicYear?.id]);

    const { data: events = [], isLoading: eventsLoading } = useEvents(filters);
    const examsAsEvents = useExamsAsEvents();
    const ugandaHolidays = useUgandaHolidays(new Date());

    const allEvents = useMemo(() => {
        return [...(events || []), ...(examsAsEvents.data || []), ...(ugandaHolidays.data || [])];
    }, [events, examsAsEvents.data, ugandaHolidays.data]);

    const calendarEvents = useMemo(() => {
        return allEvents.map((event: any) => {
            const startDateTime = event.isAllDay
                ? event.startDate
                : `${event.startDate}T${event.startTime || '00:00'}`;
            const endDateTime = event.isAllDay
                ? event.endDate
                : `${event.endDate}T${event.endTime || '23:59'}`;

            const bgColor = (event.customFields as any)?.isUgandaPublicHoliday
                ? UGANDA_HOLIDAY_COLOR
                : (event.colorCode || EVENT_TYPE_COLORS[event.type as keyof typeof EVENT_TYPE_COLORS] || '#3b82f6');

            return {
                id: event.id,
                title: event.title,
                start: startDateTime,
                end: endDateTime,
                allDay: event.isAllDay,
                display: 'list-item', // This forces FullCalendar to display it as a dot instead of a bar
                backgroundColor: bgColor,
                borderColor: bgColor,
                textColor: '#ffffff',
                extendedProps: { ...event }
            };
        });
    }, [allEvents]);

    const handleDayInteraction = (date: Date, jsEvent: MouseEvent) => {
        // Find all events for this specific day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayEvents = allEvents.filter((event: any) => {
            const eventStart = new Date(event.startDate);
            eventStart.setHours(0, 0, 0, 0);
            const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
            eventEnd.setHours(23, 59, 59, 999);

            return dayStart >= eventStart && dayStart <= eventEnd;
        });

        if (dayEvents.length > 0) {
            setPopoverState({
                isOpen: true,
                date: date,
                events: dayEvents,
                anchorEl: jsEvent.target as HTMLElement,
            });
        }
    };

    const handleDateClick = (arg: any) => {
        handleDayInteraction(arg.date, arg.jsEvent);
    };

    const handleEventClick = (arg: any) => {
        // Prevent event click from navigating, trigger the day popover instead
        arg.jsEvent.preventDefault();
        arg.jsEvent.stopPropagation();
        handleDayInteraction(arg.event.start || new Date(), arg.jsEvent);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="h-full"
        >
            <Card className="h-full cursor-pointer rounded-xl transition-all duration-300 relative group overflow-visible flex flex-col" style={{
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
                transform: 'translateZ(0)',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(239, 246, 255, 0.5) 100%)',
            }}>
                {/* 3D Depth Effect - Top highlight */}
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl z-10" />
                {/* 3D Depth Effect - Bottom shadow */}
                <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

                {/* Decorative gradient accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 rounded-t-xl opacity-60" />

                <CardContent className="px-2 pb-2 pt-3 flex-1 relative z-20">
                    {eventsLoading ? (
                        <div className="h-[290px] flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        </div>
                    ) : (
                        <div className="h-[290px] w-full mini-calendar-wrapper">
                            <FullCalendar
                                plugins={[dayGridPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                events={calendarEvents}
                                height="100%"
                                customButtons={{
                                    fullView: {
                                        text: 'Full View →',
                                        click: () => router.push('/events'),
                                    }
                                }}
                                headerToolbar={{
                                    left: 'title',
                                    right: 'prev,next fullView'
                                }}
                                dayMaxEvents={1}
                                businessHours={false}
                                weekends={true}
                                fixedWeekCount={false}
                                dateClick={handleDateClick}
                                eventClick={handleDateClick}
                                titleFormat={{ month: 'long', year: 'numeric' }}
                                dayCellClassNames={(arg) => {
                                    const classes = [];
                                    if (arg.date.getDay() === 0) classes.push('fc-day-sunday-red'); // Sunday

                                    const dateString = format(arg.date, 'yyyy-MM-dd');
                                    const isHoliday = ugandaHolidays.data?.some((h: any) => h.startDate === dateString);
                                    if (isHoliday) classes.push('fc-day-public-holiday-red'); // Public Holiday

                                    return classes;
                                }}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Hidden Popover setup managed manually via fixed positioning or anchor matching */}
            <Popover open={popoverState.isOpen} onOpenChange={(open) => !open && setPopoverState(prev => ({ ...prev, isOpen: false }))}>
                <PopoverTrigger asChild>
                    {/* Invisible trigger anchored to the calendar */}
                    <div
                        style={{
                            position: 'fixed',
                            top: popoverState.anchorEl?.getBoundingClientRect().top || 0,
                            left: popoverState.anchorEl?.getBoundingClientRect().left || 0,
                            width: popoverState.anchorEl?.getBoundingClientRect().width || 1,
                            height: popoverState.anchorEl?.getBoundingClientRect().height || 1,
                            pointerEvents: 'none',
                        }}
                    />
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 rounded-xl shadow-xl border-slate-200 overflow-hidden z-50">
                    <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex justify-between items-center">
                        <span className="font-semibold text-sm text-slate-800">
                            {popoverState.date ? format(popoverState.date, 'EEEE, MMM d') : ''}
                        </span>
                        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-sm border border-slate-200">
                            {popoverState.events.length} Event{popoverState.events.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                        {popoverState.events.map((event: any, i) => {
                            const isUgandaHoliday = (event.customFields as any)?.isUgandaPublicHoliday;
                            const colorCode = isUgandaHoliday ? UGANDA_HOLIDAY_COLOR : (event.colorCode || EVENT_TYPE_COLORS[event.type as keyof typeof EVENT_TYPE_COLORS] || '#3b82f6');
                            return (
                                <div key={`${event.id}-${i}`} className="flex items-start gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => router.push('/events')}>
                                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: colorCode }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-700 truncate">{event.title}</p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {event.isAllDay ? 'All Day' : `${event.startTime || ''} ${event.endTime ? `- ${event.endTime}` : ''}`.trim()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-2 border-t border-slate-100 bg-slate-50">
                        <Button variant="ghost" className="w-full text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50" onClick={() => router.push('/events')}>
                            View in Calendar →
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            <style jsx global>{`
                .mini-calendar-wrapper .fc {
                    font-family: inherit;
                    font-size: 0.75rem;
                    background: transparent;
                }
                .mini-calendar-wrapper .fc-toolbar-title {
                    font-size: 1.125rem !important; /* Slightly larger to match image */
                    font-weight: 600;
                    color: #0f172a;
                }
                .mini-calendar-wrapper .fc-button {
                    background-color: transparent !important;
                    border: none !important;
                    color: #64748b !important;
                    padding: 0.2rem !important;
                    box-shadow: none !important;
                }
                .mini-calendar-wrapper .fc-button:hover {
                    color: #0f172a !important;
                    background-color: #f1f5f9 !important;
                    border-radius: 50%; /* Round hover for arrows */
                }
                .mini-calendar-wrapper .fc-button:focus {
                    box-shadow: none !important;
                }
                .mini-calendar-wrapper .fc-scrollgrid {
                    border: none !important;
                }
                .mini-calendar-wrapper .fc-theme-standard td, 
                .mini-calendar-wrapper .fc-theme-standard th {
                    border: none !important; 
                }
                .mini-calendar-wrapper .fc-col-header-cell {
                    padding-bottom: 0.25rem; /* Tighter padding */
                    padding-top: 0.5rem;
                }
                .mini-calendar-wrapper .fc-col-header-cell-cushion {
                    font-weight: 500;
                    color: #64748b; 
                    text-transform: uppercase;
                    font-size: 0.7rem;
                }
                .mini-calendar-wrapper .fc-daygrid-day-top {
                    justify-content: center; 
                    margin-top: 2px;
                }
                .mini-calendar-wrapper .fc-daygrid-day-number {
                    padding: 0 !important;
                    color: #0f172a;
                    font-weight: 500;
                    font-size: 0.825rem;
                    width: 24px; /* Slightly smaller explicitly rounded number background */
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                .mini-calendar-wrapper .fc-day-today .fc-daygrid-day-number {
                    background-color: #3b82f6; /* Solid blue circle for today */
                    color: white !important;
                }
                .mini-calendar-wrapper .fc-day-sunday-red .fc-daygrid-day-number,
                .mini-calendar-wrapper .fc-day-public-holiday-red .fc-daygrid-day-number {
                    color: #ef4444 !important; /* Red text for Sundays and Holidays */
                }
                .mini-calendar-wrapper .fc-daygrid-event {
                    border-radius: 4px;
                    padding: 0;
                    margin: 0 !important;
                    background: transparent !important;
                    border: none !important;
                }
                .mini-calendar-wrapper .fc-daygrid-event-dot {
                    border: 3px solid var(--fc-event-border-color); /* Slightly bigger dot */
                    border-radius: 50%;
                    margin: 0 !important;
                }
                .mini-calendar-wrapper .fc-event-title,
                .mini-calendar-wrapper .fc-event-time,
                .mini-calendar-wrapper .fc-daygrid-more-link {
                    display: none !important; /* Hide text completely */
                }
                .mini-calendar-wrapper .fc-daygrid-day-events {
                    display: flex !important;
                    flex-direction: row !important;
                    flex-wrap: wrap !important;
                    justify-content: center !important;
                    gap: 3px !important;
                    padding: 0 !important;
                    margin-top: -2px !important; /* Pull up to sit right under the number */
                    min-height: 8px !important;
                    position: absolute !important;
                    bottom: 4px !important; /* Stick to bottom of day cell */
                    left: 0 !important;
                    right: 0 !important;
                }
                .mini-calendar-wrapper .fc-daygrid-day-frame {
                    cursor: pointer;
                    position: relative;
                    min-height: 45px !important; /* Explicit minimum height for day cells */
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding-top: 4px;
                }
                .mini-calendar-wrapper .fc-daygrid-event-harness {
                    display: block;
                    margin-top: 0 !important;
                    width: 4px;
                    height: 4px;
                }
                .mini-calendar-wrapper .fc-day-other .fc-daygrid-day-number {
                    opacity: 0.3; /* Fade out other month dates */
                }
                .mini-calendar-wrapper .fc-daygrid-day-frame:hover {
                    background-color: rgba(0,0,0,0.02);
                    border-radius: 8px;
                }
                .mini-calendar-wrapper .fc-day-today {
                    background-color: transparent !important; /* Remove the yellow/blue background */
                }
            `}</style>
        </motion.div>
    );
}
