"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Calendar, MapPin, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { getComputedEventStatus } from '@/lib/utils/event-status-utils';
import type { Event, EventType } from '@/types';

// Event type color mapping
const EVENT_TYPE_COLORS = {
  'Academic': '#3b82f6', // Blue
  'Co-curricular': '#10b981', // Green
  'Administrative': '#f59e0b', // Yellow
  'Holiday': '#dc2626', // Deep red for regular holidays
} as const;

// Special color for Uganda public holidays
const UGANDA_HOLIDAY_COLOR = '#f59e0b'; // Gold/orange inspired by Uganda flag

interface EventsListProps {
  events: Event[];
  isCompact?: boolean;
  onEventClick: (event: Event) => void;
}

export function EventsList({ events, isCompact = false, onEventClick }: EventsListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Academic']));
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const sortedEvents = events.sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  if (isCompact) {
    // Group events by type for compact view
    const eventsByType = sortedEvents.reduce((acc, event) => {
      const type = event.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(event);
      return acc;
    }, {} as Record<EventType, Event[]>);

    return (
      <div className="space-y-4">
        {Object.entries(eventsByType).map(([type, typeEvents]) => {
          const isExpanded = expandedGroups.has(type);

          return (
            <div key={type} className="bg-white/60 border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
              <Button
                variant="ghost"
                className={`w-full justify-between p-4 h-auto hover:bg-white/80 transition-all duration-300 ${isExpanded ? 'bg-white/80 border-b border-slate-100/50' : ''}`}
                onClick={() => toggleGroupExpansion(type)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white shadow-sm border border-slate-100/50">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: type === 'Holiday' && typeEvents.some(e => (e.customFields as any)?.isUgandaPublicHoliday)
                          ? UGANDA_HOLIDAY_COLOR
                          : EVENT_TYPE_COLORS[type as EventType]
                      }}
                    />
                  </div>
                  <span className="font-semibold text-slate-800">{type} Events</span>
                  <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600 border-0 hover:bg-slate-200">
                    {typeEvents.length}
                  </Badge>
                </div>
                <div className={`p-1.5 rounded-lg bg-white shadow-sm transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </Button>

              <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-3 p-4 bg-slate-50/30">
                    {typeEvents.map((event) => (
                      <div
                        key={event.id}
                        className="group bg-white border border-slate-200/50 rounded-xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm text-slate-800 line-clamp-1 flex-1 group-hover:text-blue-600 transition-colors">{event.title}</h4>
                          <div className="flex items-center gap-1.5 ml-3 shrink-0">
                            {event.type === 'Holiday' && (
                              <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-100 font-medium">
                                🇺🇬 Holiday
                              </Badge>
                            )}
                            {event.isExamEvent && (
                              <Badge variant="destructive" className="text-xs font-medium shadow-sm">Exam</Badge>
                            )}
                            <Badge variant="outline" className={`text-xs font-medium border-slate-200 ${event.priority === 'Urgent' ? 'text-red-600 bg-red-50' :
                              event.priority === 'High' ? 'text-orange-600 bg-orange-50' : 'text-slate-600 bg-slate-50'
                              }`}>
                              {event.priority}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                          <span className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-1 rounded-md">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                            {format(new Date(event.startDate), 'MMM dd')}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1.5 truncate bg-slate-100/50 px-2 py-1 rounded-md">
                              <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="truncate max-w-[120px]">{event.location}</span>
                            </span>
                          )}
                          {!event.isAllDay && event.startTime && (
                            <span className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-1 rounded-md">
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                              {event.startTime}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Expanded view
  return (
    <div className="space-y-4">
      {sortedEvents.map((event) => {
        const isExpanded = expandedEvents.has(event.id);

        return (
          <div
            key={event.id}
            className="group bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-0.5"
          >
            <div
              className={`p-5 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}
              onClick={() => {
                onEventClick(event);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <div className="flex items-center flex-wrap gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white shadow-sm border border-slate-100 shrink-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                        style={{
                          backgroundColor: (event.customFields as any)?.isUgandaPublicHoliday
                            ? UGANDA_HOLIDAY_COLOR
                            : (event.colorCode || EVENT_TYPE_COLORS[event.type])
                        }}
                      />
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{event.title}</h4>
                    {event.type === 'Holiday' && (
                      <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-100 font-medium">
                        🇺🇬 Holiday
                      </Badge>
                    )}
                    {event.isExamEvent && (
                      <Badge variant="destructive" className="text-xs font-medium shadow-sm">Exam</Badge>
                    )}
                    <Badge variant="outline" className="text-xs font-medium bg-white text-slate-600 border-slate-200 shadow-sm">
                      {event.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium border-0 shadow-sm ${event.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                        event.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                        }`}
                    >
                      {event.priority}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm font-medium text-slate-600 mb-3">
                    <span className="flex items-center gap-1.5 bg-white border border-slate-100 shadow-sm px-2.5 py-1.5 rounded-lg">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      {format(new Date(event.startDate), 'PPP')}
                      {event.startDate !== event.endDate && ` - ${format(new Date(event.endDate), 'PPP')}`}
                    </span>
                    {!event.isAllDay && event.startTime && (
                      <span className="flex items-center gap-1.5 bg-white border border-slate-100 shadow-sm px-2.5 py-1.5 rounded-lg">
                        <Clock className="h-4 w-4 text-amber-500" />
                        {event.startTime}
                        {event.endTime && event.endTime !== event.startTime && ` - ${event.endTime}`}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1.5 bg-white border border-slate-100 shadow-sm px-2.5 py-1.5 rounded-lg">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        {event.location}
                      </span>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{event.description}</p>
                  )}

                  {(event.targetAudience?.length || event.tags?.length) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {event.targetAudience?.slice(0, 3).map((audience, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0">
                          <Users className="h-3 w-3 mr-1.5" />
                          {audience}
                        </Badge>
                      ))}
                      {event.targetAudience && event.targetAudience.length > 3 && (
                        <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 border-0 hover:bg-slate-200">
                          +{event.targetAudience.length - 3} more
                        </Badge>
                      )}
                      {event.tags?.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-white text-slate-500 border-slate-200 shadow-sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center justify-center h-full">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEventExpansion(event.id);
                    }}
                    className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/50 shadow-sm transition-all"
                  >
                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </div>
                  </Button>
                </div>
              </div>
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50">
                  <div className="space-y-4 text-sm">
                    {event.description && (
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <strong className="text-slate-700 flex items-center gap-2 mb-2">
                          Description
                        </strong>
                        <p className="text-slate-600 leading-relaxed">{event.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <strong className="text-slate-700">Status</strong>
                        <Badge variant="outline" className={`ml-2 font-medium px-2.5 py-0.5 border-0 shadow-sm ${getComputedEventStatus(event) === 'Scheduled' ? 'bg-blue-50 text-blue-700' :
                          getComputedEventStatus(event) === 'Ongoing' ? 'bg-emerald-50 text-emerald-700' :
                            getComputedEventStatus(event) === 'Completed' ? 'bg-slate-100 text-slate-700' :
                              getComputedEventStatus(event) === 'Cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                          {getComputedEventStatus(event)}
                        </Badge>
                      </div>

                      {event.requiresAttendance && (
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center gap-2">
                          <span className="text-orange-600 font-semibold flex items-center gap-2">
                            ⚠️ Attendance Required
                          </span>
                        </div>
                      )}
                    </div>

                    {event.targetAudience && event.targetAudience.length > 0 && (
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <strong className="text-slate-700 block mb-2">Target Audience</strong>
                        <div className="flex flex-wrap gap-2">
                          {event.targetAudience.map((audience, index) => (
                            <Badge key={index} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0">
                              <Users className="h-3 w-3 mr-1.5" />
                              {audience}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {event.tags && event.tags.length > 0 && (
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <strong className="text-slate-700 block mb-2">Tags</strong>
                        <div className="flex flex-wrap gap-2">
                          {event.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
} 