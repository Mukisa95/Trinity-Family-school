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
import { getComputedEventStatus } from '@/lib/utils/event-status-utils';
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

  const computedStatus = getComputedEventStatus(event);

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
      <ModernDialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200/60 shadow-2xl" open={isOpen} onOpenChange={onClose}>
        <div className="bg-gradient-to-br from-slate-50/90 via-white to-blue-50/30 border-b border-slate-100/50 p-6 sm:px-8">
          <ModernDialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <ModernDialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent pr-8">
                  {event.title}
                </ModernDialogTitle>
                <div className="flex items-center flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className={`${getPriorityColor(event.priority)} border-0 shadow-sm px-2.5 py-0.5 font-medium`}>
                    {event.priority} Priority
                  </Badge>
                  <Badge variant="outline" className={`${getStatusColor(computedStatus)} border-0 shadow-sm px-2.5 py-0.5 font-medium`}>
                    {computedStatus}
                  </Badge>
                  {event.isExamEvent && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-0 shadow-sm px-2.5 py-0.5 font-medium">
                      <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                      Exam Event
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </ModernDialogHeader>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-8 p-6 sm:px-8">
            {/* Description */}
            {event.description && (
              <div className="bg-slate-50/50 border border-slate-100/50 rounded-2xl p-5 shadow-sm">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  Description
                </h4>
                <p className="text-slate-600 leading-relaxed text-sm">{event.description}</p>
              </div>
            )}

            {/* Event Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type */}
              <div className="flex items-center gap-4 bg-white border border-slate-200/50 shadow-sm rounded-2xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 shadow-inner">
                  {getTypeIcon(event.type)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Event Type</p>
                  <p className="font-bold text-slate-700">{event.type}</p>
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-4 bg-white border border-slate-200/50 shadow-sm rounded-2xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {event.isAllDay ? 'Date' : 'Start Date & Time'}
                  </p>
                  <p className="font-bold text-slate-700 text-sm">
                    {event.isAllDay ? `${formatDateTime(event.startDate)} - All Day` : formatDateTime(event.startDate, event.startTime)}
                  </p>
                  {!event.isAllDay && event.endDate && (
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      Ends: {formatDateTime(event.endDate, event.endTime)}
                    </p>
                  )}
                  {event.isAllDay && event.endDate && event.endDate !== event.startDate && (
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      Ends: {formatDateTime(event.endDate)}
                    </p>
                  )}
                </div>
              </div>

              {/* Location - Only show for non-exam events */}
              {!event.isExamEvent && event.location && (
                <div className="flex items-center gap-4 bg-white border border-slate-200/50 shadow-sm rounded-2xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-600 shadow-inner">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                    <p className="font-bold text-slate-700 text-sm">{event.location}</p>
                  </div>
                </div>
              )}

              {/* Duration - Only show for non-exam events */}
              {!event.isExamEvent && !event.isAllDay && event.startTime && event.endTime && (
                <div className="flex items-center gap-4 bg-white border border-slate-200/50 shadow-sm rounded-2xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</p>
                    <p className="font-bold text-slate-700 text-sm">
                      {event.startTime} - {event.endTime}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

            {/* Target Audience */}
            {event.targetAudience.length > 0 && (
              <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-5">
                <h4 className="font-semibold text-indigo-900 flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-indigo-500" />
                  Target Audience
                </h4>
                <div className="flex flex-wrap gap-2.5">
                  {event.targetAudience.map((audience, index) => (
                    <Badge key={index} variant="secondary" className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 shadow-sm px-3 py-1">
                      {audience}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Academic Context */}
            {(event.academicYearName || event.termName) && (
              <div className="bg-slate-50/50 border border-slate-100/50 rounded-2xl p-5 shadow-sm">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Academic Context
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {event.academicYearName && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Academic Year</p>
                      <p className="font-bold text-slate-700">{event.academicYearName}</p>
                    </div>
                  )}
                  {event.termName && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Term</p>
                      <p className="font-bold text-slate-700">{event.termName}</p>
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

        <div className="bg-slate-50/80 border-t border-slate-100/50 p-4 sm:px-8">
          <ModernDialogFooter className="flex w-full justify-center sm:justify-center">
            <div className="bg-white rounded-full px-2 py-1.5 shadow-lg border border-gray-300 backdrop-blur-sm flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 action-buttons-container justify-center mx-auto">

              {/* Edit Button */}
              <button
                onClick={() => onEdit(event)}
                className="flex flex-col items-center justify-center min-w-[44px] w-11 h-11 rounded-full bg-white text-blue-600 border border-blue-400 shadow-sm hover:bg-gradient-to-br hover:from-blue-400 hover:via-indigo-500 hover:to-blue-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
                aria-label="Edit Event"
              >
                <Edit className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-semibold leading-tight">Edit</span>
              </button>

              {event.requiresAttendance && (
                <>
                  {/* Record Attendance */}
                  <button
                    onClick={() => { window.location.href = `/events/${event.id}/attendance`; }}
                    className="flex flex-col items-center justify-center min-w-[44px] w-11 h-11 rounded-full bg-white text-emerald-600 border border-emerald-400 shadow-sm hover:bg-gradient-to-br hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
                    aria-label="Record Attendance"
                  >
                    <UserCheck className="w-4 h-4 mb-0.5" />
                    <span className="text-[8px] font-semibold leading-tight">Record</span>
                  </button>

                  {/* View Attendance */}
                  <button
                    onClick={() => { window.location.href = `/events/${event.id}/view-attendance`; }}
                    className="flex flex-col items-center justify-center min-w-[44px] w-11 h-11 rounded-full bg-white text-purple-600 border border-purple-400 shadow-sm hover:bg-gradient-to-br hover:from-purple-400 hover:via-purple-500 hover:to-purple-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
                    aria-label="View Attendance"
                  >
                    <Users className="w-4 h-4 mb-0.5" />
                    <span className="text-[8px] font-semibold leading-tight">View</span>
                  </button>
                </>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(event.id)}
                  className="flex flex-col items-center justify-center min-w-[44px] w-11 h-11 rounded-full bg-white text-red-600 border border-red-400 shadow-sm hover:bg-gradient-to-br hover:from-red-400 hover:via-pink-500 hover:to-red-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
                  aria-label="Delete Event"
                >
                  <Trash2 className="w-4 h-4 mb-0.5" />
                  <span className="text-[8px] font-semibold leading-tight">Delete</span>
                </button>
              )}

              <div className="w-px h-8 bg-gray-200 mx-1 shrink-0"></div>

              <button
                onClick={onClose}
                className="flex flex-col items-center justify-center min-w-[44px] w-11 h-11 rounded-full bg-white text-gray-600 border border-gray-400 shadow-sm hover:bg-gradient-to-br hover:from-gray-400 hover:via-gray-500 hover:to-gray-600 hover:text-white hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
                aria-label="Close"
              >
                <AlertCircle className="w-4 h-4 mb-0.5" />
                <span className="text-[8px] font-semibold leading-tight">Close</span>
              </button>
            </div>
          </ModernDialogFooter>
        </div>
      </ModernDialogContent>
    </ModernDialog>
  );
} 