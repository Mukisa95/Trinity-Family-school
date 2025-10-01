"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Calendar, MapPin, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
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
      <div className="space-y-3">
        {Object.entries(eventsByType).map(([type, typeEvents]) => {
          const isExpanded = expandedGroups.has(type);
          
          return (
            <div key={type} className="border rounded-lg">
              <Button 
                variant="ghost" 
                className="w-full justify-between p-3 h-auto rounded-b-none"
                onClick={() => toggleGroupExpansion(type)}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ 
                      backgroundColor: type === 'Holiday' && typeEvents.some(e => (e.customFields as any)?.isUgandaPublicHoliday)
                        ? UGANDA_HOLIDAY_COLOR 
                        : EVENT_TYPE_COLORS[type as EventType]
                    }}
                  />
                  <span className="font-medium">{type} Events</span>
                  <Badge variant="secondary" className="ml-2">
                    {typeEvents.length}
                  </Badge>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              {isExpanded && (
                <div className="border-t space-y-2 p-3">
                  {typeEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer bg-white"
                      onClick={() => onEventClick(event)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm truncate flex-1">{event.title}</h4>
                        <div className="flex items-center gap-1 ml-2">
                          {event.type === 'Holiday' && (
                            <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">
                              🇺🇬 Holiday
                            </Badge>
                          )}
                          {event.isExamEvent && (
                            <Badge variant="destructive" className="text-xs">Exam</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {event.priority}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.startDate), 'MMM dd')}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                        {!event.isAllDay && event.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.startTime}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Expanded view
  return (
    <div className="space-y-3">
      {sortedEvents.map((event) => {
        const isExpanded = expandedEvents.has(event.id);
        
        return (
          <div 
            key={event.id}
            className="border rounded-lg hover:shadow-md transition-shadow bg-white"
          >
            <div 
              className="p-4 cursor-pointer"
              onClick={() => onEventClick(event)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ 
                        backgroundColor: (event.customFields as any)?.isUgandaPublicHoliday 
                          ? UGANDA_HOLIDAY_COLOR 
                          : (event.colorCode || EVENT_TYPE_COLORS[event.type])
                      }}
                    />
                    <h4 className="font-semibold">{event.title}</h4>
                    {event.type === 'Holiday' && (
                      <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">
                        🇺🇬 Holiday
                      </Badge>
                    )}
                    {event.isExamEvent && (
                      <Badge variant="destructive" className="text-xs">Exam</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {event.type}
                    </Badge>
                    <Badge 
                      variant={
                        event.priority === 'Urgent' ? 'destructive' :
                        event.priority === 'High' ? 'default' : 'secondary'
                      }
                      className="text-xs"
                    >
                      {event.priority}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(event.startDate), 'PPP')}
                      {event.startDate !== event.endDate && ` - ${format(new Date(event.endDate), 'PPP')}`}
                    </span>
                    {!event.isAllDay && event.startTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {event.startTime}
                        {event.endTime && event.endTime !== event.startTime && ` - ${event.endTime}`}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {event.location}
                      </span>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{event.description}</p>
                  )}

                  {(event.targetAudience?.length || event.tags?.length) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {event.targetAudience?.slice(0, 3).map((audience, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {audience}
                        </Badge>
                      ))}
                      {event.targetAudience && event.targetAudience.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{event.targetAudience.length - 3} more
                        </Badge>
                      )}
                      {event.tags?.slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleEventExpansion(event.id);
                  }}
                  className="ml-2"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 border-t bg-gray-50">
                <div className="pt-3 space-y-2 text-sm">
                  {event.description && (
                    <div>
                      <strong>Description:</strong>
                      <p className="mt-1 text-gray-600">{event.description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <strong>Status:</strong> 
                      <Badge variant="outline" className="ml-2 text-xs">
                        {event.status}
                      </Badge>
                    </div>
                    
                    {event.requiresAttendance && (
                      <div className="text-orange-600">
                        <strong>⚠️ Attendance Required</strong>
                      </div>
                    )}
                  </div>

                  {event.targetAudience && event.targetAudience.length > 0 && (
                    <div>
                      <strong>Target Audience:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.targetAudience.map((audience, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {audience}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {event.tags && event.tags.length > 0 && (
                    <div>
                      <strong>Tags:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 