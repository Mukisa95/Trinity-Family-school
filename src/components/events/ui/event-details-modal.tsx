"use client";

import React from 'react';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Tag, 
  AlertCircle,
  Edit,
  Trash2,
  BookOpen,
  GraduationCap,
  Building,
  Bell,
  UserCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Event } from '@/types';

interface EventDetailsModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: Event) => void;
  onDelete?: (eventId: string) => void;
}

export function EventDetailsModal({ 
  event, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete 
}: EventDetailsModalProps) {
  if (!event) return null;

  const formatDateTime = (date: string, time?: string) => {
    if (!date) return 'Not set';
    
    try {
      const dateObj = parseISO(date);
      if (isNaN(dateObj.getTime())) return 'Invalid date';
      
      // For all-day events, don't show time
      if (event.isAllDay) {
        return format(dateObj, 'MMM d, yyyy');
      }
      
      if (time) {
        return `${format(dateObj, 'MMM d, yyyy')} at ${time}`;
      }
      return format(dateObj, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error parsing date:', date, error);
      return 'Invalid date';
    }
  };

  const safeFormatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    
    try {
      const dateObj = parseISO(dateString);
      if (isNaN(dateObj.getTime())) return 'Invalid date';
      return format(dateObj, 'PPP');
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid date';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Ongoing': return 'bg-green-100 text-green-800 border-green-200';
      case 'Completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'Draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Academic': return <BookOpen className="h-4 w-4" />;
      case 'Co-curricular': return <Users className="h-4 w-4" />;
      case 'Administrative': return <Building className="h-4 w-4" />;
      case 'Holiday': return <Calendar className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent className="max-w-2xl max-h-[90vh]" open={isOpen} onOpenChange={onClose}>
        <ModernDialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <ModernDialogTitle className="text-xl font-bold text-gray-900 pr-8">
                {event.title}
              </ModernDialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${getPriorityColor(event.priority)} border`}>
                  {event.priority} Priority
                </Badge>
                <Badge className={`${getStatusColor(event.status)} border`}>
                  {event.status}
                </Badge>
                {event.isExamEvent && (
                  <Badge className="bg-purple-100 text-purple-800 border border-purple-200">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    Exam Event
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </ModernDialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Description */}
            {event.description && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                <p className="text-gray-700 leading-relaxed">{event.description}</p>
              </div>
            )}

            {/* Event Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                  {getTypeIcon(event.type)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Event Type</p>
                  <p className="font-medium text-gray-900">{event.type}</p>
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {event.isAllDay ? 'Date' : 'Start Date & Time'}
                  </p>
                  <p className="font-medium text-gray-900">
                    {event.isAllDay ? `${formatDateTime(event.startDate)} - All Day` : formatDateTime(event.startDate, event.startTime)}
                  </p>
                  {!event.isAllDay && event.endDate && (
                    <p className="text-sm text-gray-500">
                      Ends: {formatDateTime(event.endDate, event.endTime)}
                    </p>
                  )}
                  {event.isAllDay && event.endDate && event.endDate !== event.startDate && (
                    <p className="text-sm text-gray-500">
                      Ends: {formatDateTime(event.endDate)}
                    </p>
                  )}
                </div>
              </div>

              {/* Location - Only show for non-exam events */}
              {!event.isExamEvent && event.location && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100">
                    <MapPin className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-900">{event.location}</p>
                  </div>
                </div>
              )}

              {/* Duration - Only show for non-exam events */}
              {!event.isExamEvent && !event.isAllDay && event.startTime && event.endTime && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                    <Clock className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-medium text-gray-900">
                      {event.startTime} - {event.endTime}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Target Audience */}
            {event.targetAudience.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Target Audience
                </h4>
                <div className="flex flex-wrap gap-2">
                  {event.targetAudience.map((audience, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {audience}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Academic Context */}
            {(event.academicYearName || event.termName) && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Academic Context</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.academicYearName && (
                    <div>
                      <p className="text-sm text-gray-500">Academic Year</p>
                      <p className="font-medium text-gray-900">{event.academicYearName}</p>
                    </div>
                  )}
                  {event.termName && (
                    <div>
                      <p className="text-sm text-gray-500">Term</p>
                      <p className="font-medium text-gray-900">{event.termName}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Exam Details */}
            {event.isExamEvent && (event.examIntegration || (event.customFields && Object.keys(event.customFields).length > 0)) && (
              <div>
                <Separator className="my-4" />
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-purple-600" />
                  📚 Exam Details
                </h4>
                
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Exam Type */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                        <BookOpen className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Exam Type</p>
                        <p className="font-medium text-gray-900">
                          {event.customFields?.examType || event.examIntegration?.examType || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {/* Exam Nature */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Exam Nature</p>
                        <p className="font-medium text-gray-900">
                          {event.customFields?.examNature || event.examIntegration?.examNature || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {/* Maximum Marks */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                        <span className="text-green-600 font-bold text-sm">💯</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Maximum Marks</p>
                        <p className="font-medium text-gray-900">
                          {event.customFields?.maxMarks || event.examIntegration?.maxMarks || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {/* Passing Marks */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100">
                        <span className="text-orange-600 font-bold text-sm">✅</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Passing Marks</p>
                        <p className="font-medium text-gray-900">
                          {event.customFields?.passingMarks || event.examIntegration?.passingMarks || 'Not specified'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Classes Involved */}
                  {(event.customFields?.classDetails?.length || event.examIntegration?.classIds?.length) && (
                    <div className="mt-4">
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Classes Involved ({event.customFields?.classDetails?.length || event.examIntegration?.classIds?.length || 0})
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {event.customFields?.classDetails?.map((cls: any, index: number) => (
                          <Badge key={index} variant="outline" className="bg-white border-purple-300 text-purple-700">
                            {cls.name || cls.className || 'Unknown Class'}
                          </Badge>
                        )) || event.examIntegration?.classIds?.map((classId: string, index: number) => {
                          // Try to get class name from customFields or use classId as fallback
                          const className = event.customFields?.classDetails?.find((c: any) => c.id === classId)?.name || 
                                           event.customFields?.classDetails?.find((c: any) => c.id === classId)?.className || 
                                           classId;
                          return (
                            <Badge key={index} variant="outline" className="bg-white border-purple-300 text-purple-700">
                              {className}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Subjects */}
                  {event.customFields?.subjectDetails && event.customFields.subjectDetails.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Subjects ({event.customFields.subjectDetails.length})
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {event.customFields.subjectDetails.map((subject: any, index: number) => (
                          <Badge key={index} variant="outline" className="bg-white border-blue-300 text-blue-700">
                            {subject.name || subject.subjectName || subject.title || subject.id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  {event.customFields?.instructions && (
                    <div className="mt-4">
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Instructions
                      </h5>
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {event.customFields.instructions}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Exam Statistics */}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {event.customFields?.classDetails?.length || event.examIntegration?.examIds?.length || 0}
                      </p>
                      <p className="text-sm text-gray-500">Exam Instances</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {event.customFields?.classDetails?.length || event.examIntegration?.classIds?.length || 0}
                      </p>
                      <p className="text-sm text-gray-500">Classes</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message for exam events without details */}
            {event.isExamEvent && !event.examIntegration && (!event.customFields || Object.keys(event.customFields).length === 0) && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  📝 Exam Event (Legacy)
                </h4>
                <p className="text-yellow-700 text-sm">
                  This exam event was created before the enhanced exam details feature. 
                  The comprehensive exam information is not available for this event.
                </p>
                <p className="text-yellow-600 text-xs mt-2">
                  💡 Create a new exam event to see all exam details including classes, subjects, marks, and instructions.
                </p>
              </div>
            )}

            {/* Classes and Subjects */}
            {(event.classNames?.length || event.subjectNames?.length) && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Classes & Subjects</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.classNames?.length && (
                    <div>
                      <p className="text-sm text-gray-500">Classes</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.classNames.map((className, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {className}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {event.subjectNames?.length && (
                    <div>
                      <p className="text-sm text-gray-500">Subjects</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.subjectNames.map((subjectName, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {subjectName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Exam Details */}
            {event.isExamEvent && event.examIntegration && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Exam Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Max Marks</p>
                    <p className="font-medium">{event.examIntegration.maxMarks}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Passing Marks</p>
                    <p className="font-medium">{event.examIntegration.passingMarks}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reminders */}
            {event.sendReminders && event.reminders.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Reminders
                </h4>
                <div className="space-y-2">
                  {event.reminders.filter(r => r.enabled).map((reminder, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">
                        {reminder.timing.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <div className="flex gap-1">
                        {reminder.channels.map((channel, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {channel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance */}
            {event.requiresAttendance && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Attendance Required
                </h4>
                <p className="text-sm text-gray-600">
                  Attendance tracking is enabled for this event.
                </p>
              </div>
            )}

            {/* Tags */}
            {event.tags?.length && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-gray-500 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <p>Created by: {event.createdByName || event.createdBy}</p>
                <p>Created: {safeFormatDate(event.createdAt)}</p>
                {event.updatedAt && (
                  <>
                    <p>Updated by: {event.updatedByName || event.updatedBy}</p>
                    <p>Updated: {safeFormatDate(event.updatedAt)}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <ModernDialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onEdit(event)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            {event.requiresAttendance && (
              <>
                <Button
                  variant="default"
                  onClick={() => {
                    // Navigate to attendance recording page
                    window.location.href = `/events/${event.id}/attendance`;
                  }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <UserCheck className="h-4 w-4" />
                  Record Attendance
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Navigate to view attendance page
                    window.location.href = `/events/${event.id}/view-attendance`;
                  }}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Users className="h-4 w-4" />
                  View Attendance
                </Button>
              </>
            )}
            {onDelete && (
              <Button
                variant="outline"
                onClick={() => {
                  console.log('Delete button clicked for event:', event.id, event.title);
                  onDelete(event.id);
                }}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
          <Button onClick={onClose}>Close</Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
} 