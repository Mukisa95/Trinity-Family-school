"use client";

import React, { useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Loader2, ChevronRight, BookOpen } from 'lucide-react';
import { useEvents, useAcademicYearsForEvents, useCurrentTerm, useExamsAsEvents } from '@/lib/hooks/use-events-fixed';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useUgandaHolidays } from '@/lib/hooks/use-uganda-holidays';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import type { Event } from '@/types';

function getEventRelativeStatus(event: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(event.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = event.endDate ? new Date(event.endDate) : startDate;
    endDate.setHours(23, 59, 59, 999);

    const now = new Date();

    // Check if ongoing
    if (now >= startDate && now <= endDate) {
        return { text: 'Ongoing', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    }

    if (now < startDate) {
        const diff = differenceInDays(startDate, today);
        if (diff === 0) return { text: 'Today', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
        if (diff === 1) return { text: 'Tomorrow', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
        return { text: `In ${diff} days`, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
    }

    if (now > endDate) {
        const diff = differenceInDays(today, endDate);
        if (diff === 0) return { text: 'Ended today', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' };
        if (diff === 1) return { text: 'Ended yesterday', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' };
        return { text: `Ended ${diff} days ago`, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' };
    }

    return { text: 'Unknown', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' };
}

export function TermScheduleCard() {
    const router = useRouter();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const eventRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const { data: activeAcademicYear } = useActiveAcademicYear();
    const { data: academicYears = [], isLoading: isLoadingAcademicYears } = useAcademicYearsForEvents();
    const currentTerm = useCurrentTerm(academicYears);

    const filters = useMemo(() => ({
        academicYearIds: activeAcademicYear ? [activeAcademicYear.id] : [],
    }), [activeAcademicYear?.id]);

    const { data: events = [], isLoading: eventsLoading } = useEvents(filters);
    const examsAsEvents = useExamsAsEvents();
    const ugandaHolidays = useUgandaHolidays(new Date());

    const allEvents = useMemo(() => {
        const regularEvents = events || [];
        const examEvents = examsAsEvents.data || [];
        const holidayEvents = ugandaHolidays.data || [];

        return [...regularEvents, ...examEvents, ...holidayEvents];
    }, [events, examsAsEvents.data, ugandaHolidays.data]);

    const termFilteredEvents = useMemo(() => {
        if (!currentTerm || !currentTerm.term) return [];

        const termStart = new Date(currentTerm.term.startDate);
        const termEnd = new Date(currentTerm.term.endDate);

        const isValidStartDate = !isNaN(termStart.getTime());
        const isValidEndDate = !isNaN(termEnd.getTime());

        if (!isValidStartDate || !isValidEndDate) return [];

        return allEvents.filter((event: any) => {
            const eventStart = new Date(event.startDate);
            return eventStart >= termStart && eventStart <= termEnd;
        }).sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [allEvents, currentTerm]);

    const isLoading = eventsLoading || isLoadingAcademicYears;

    useEffect(() => {
        if (!isLoading && termFilteredEvents.length > 0) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const upcomingOrOngoingEvent = termFilteredEvents.find((event: any) => {
                const endDate = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
                endDate.setHours(23, 59, 59, 999);
                return endDate >= now;
            });

            if (upcomingOrOngoingEvent && eventRefs.current[upcomingOrOngoingEvent.id]) {
                setTimeout(() => {
                    const container = scrollContainerRef.current;
                    const element = eventRefs.current[upcomingOrOngoingEvent.id];

                    if (container && element) {
                        const containerRect = container.getBoundingClientRect();
                        const elementRect = element.getBoundingClientRect();

                        container.scrollTo({
                            top: container.scrollTop + elementRect.top - containerRect.top - 10,
                            behavior: 'smooth'
                        });
                    }
                }, 300); // Slight delay to ensure render is complete
            }
        }
    }, [isLoading, termFilteredEvents]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="h-full"
        >
            <Card className="h-full rounded-xl transition-all duration-300 relative group overflow-visible flex flex-col" style={{
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 -3px 0 rgba(0, 0, 0, 0.1)',
                transform: 'translateZ(0)',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(249, 250, 251, 1) 100%)',
            }}>
                {/* 3D Depth Effect - Top highlight */}
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl z-10" />
                {/* 3D Depth Effect - Bottom shadow */}
                <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-xl" />

                {/* Decorative gradient accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-t-xl opacity-60" />

                <CardHeader className="pb-2 pt-3 relative z-20 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap">
                                This Term
                            </CardTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/events')}
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 p-1 h-auto"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="relative z-20 px-2 pb-2 pt-0 flex-1 min-h-0">
                    {isLoading ? (
                        <div className="h-[290px] flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                        </div>
                    ) : termFilteredEvents.length === 0 ? (
                        <div className="h-[290px] flex flex-col items-center justify-center text-center px-4 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200 mx-2 mt-2">
                            <CalendarIcon className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-sm font-medium text-slate-600">No scheduled events</p>
                            <p className="text-xs text-slate-500 mt-1">There are no events in the current term.</p>
                        </div>
                    ) : (
                        <div ref={scrollContainerRef} className="h-[290px] overflow-y-auto px-1 custom-scrollbar space-y-1.5 pb-2 mt-2">
                            {termFilteredEvents.map((event: any) => {
                                const status = getEventRelativeStatus(event);
                                return (
                                    <div
                                        key={event.id}
                                        ref={(el) => { eventRefs.current[event.id] = el; }}
                                        onClick={() => router.push('/events')}
                                        className={`px-2.5 py-1.5 rounded-lg border ${status.border} ${status.bg} hover:shadow-sm transition-all cursor-pointer flex justify-between items-center group`}
                                    >
                                        <div className="flex flex-col overflow-hidden flex-1 mr-2">
                                            <h4 className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors leading-tight">{event.title}</h4>
                                            <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                                                <CalendarIcon className="w-[10px] h-[10px]" />
                                                {format(new Date(event.startDate), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                        <div className="shrink-0 flex items-center">
                                            <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-white/60 shadow-sm ${status.color}`}>
                                                {status.text}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.2);
        }
      `}</style>
        </motion.div>
    );
}
