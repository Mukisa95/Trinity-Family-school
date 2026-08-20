"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { DatePicker } from '@/components/common/date-picker';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from '@/components/ui/modern-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  Bell,
  Repeat,
  AlertCircle,
  Save,
  X,
  GraduationCap,
  Plus,
  BookOpen,
  Calculator,
  FileText
} from 'lucide-react';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useAuth } from '@/lib/contexts/auth-context';
import type {
  Event,
  CreateEventData,
  UpdateEventData,
  EventType,
  EventStatus,
  EventPriority,
  RecurrenceFrequency,
  NotificationTiming,
  EventReminder
} from '@/types';
import { useCreateExamFromEvent, useAcademicYearsForEvents } from '@/lib/hooks/use-events-fixed';
import { getComputedEventStatus } from '@/lib/utils/event-status-utils';
import { Switch } from '@/components/ui/switch';
import { FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

const EVENT_TYPES: EventType[] = ['Academic', 'Co-curricular', 'Administrative', 'Holiday'];
const EVENT_STATUSES: EventStatus[] = ['Draft', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
const EVENT_PRIORITIES: EventPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = ['None', 'Daily', 'Weekly', 'Monthly', 'Custom'];

const EVENT_TYPE_COLORS = {
  'Academic': '#3b82f6',
  'Co-curricular': '#10b981',
  'Administrative': '#f59e0b',
  'Holiday': '#ef4444',
} as const;

// Import exam types from constants to match Exams component exactly
import { EXAM_TYPES } from '@/lib/constants';

type ExamNature = 'Set based' | 'Subject based';
const EXAM_NATURES: ExamNature[] = ['Set based', 'Subject based'];

interface EventFormProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: CreateEventData | UpdateEventData | CreateEventData[]) => void;
}

export function EventForm({ event, isOpen, onClose, onSave }: EventFormProps) {
  const { user } = useAuth();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const { data: academicYears = [] } = useAcademicYearsForEvents();

  // Add create exam mutation
  const createExamMutation = useCreateExamFromEvent();

  // Enhanced form state for exam mode
  const [formData, setFormData] = useState<Partial<Event>>({
    title: '',
    description: '',
    type: 'Academic',
    priority: 'Medium',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    isAllDay: false,
    location: '',
    targetAudience: [],
    academicYearId: activeAcademicYear?.id,
    termId: '',
    classIds: [],
    subjectIds: [],
    isExamEvent: false,
    recurrence: { frequency: 'None' },
    reminders: [],
    sendReminders: true,
    colorCode: EVENT_TYPE_COLORS['Academic'],
    requiresApproval: false,
    requiresAttendance: false,
    isPublic: true,
    tags: [],
  });

  // Add exam-specific state
  const [isExamMode, setIsExamMode] = useState(false);
  const [examData, setExamData] = useState({
    examTypeId: 'et_mid',
    examNature: 'Set based' as ExamNature,
    maxMarks: 100,
    passingMarks: 40,
    instructions: '',
    selectedClassIds: [] as string[],
    perClassSelectedSubjects: {} as Record<string, string[]>,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newTag, setNewTag] = useState('');
  const [newAudience, setNewAudience] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const validationFields = useMemo(() => [
    createFieldValidation('title', formData.title, 'Event title', true, { message: 'Enter the event title.' }),
    createFieldValidation('dates', selectedDates, 'Event dates', formData.isAllDay === true, {
      active: formData.isAllDay === true,
      message: 'Choose at least one event date.',
    }),
    createFieldValidation('startDate', formData.startDate, 'Start date', !formData.isAllDay, {
      active: !formData.isAllDay,
      message: 'Choose the event start date.',
    }),
    createFieldValidation('endDate', formData.endDate, 'End date', !formData.isAllDay, {
      active: !formData.isAllDay,
      message: 'Choose the event end date.',
      validate: (value) => value && formData.startDate && String(value) < formData.startDate ? 'Choose an end date on or after the start date.' : undefined,
    }),
    createFieldValidation('startTime', formData.startTime, 'Start time', !formData.isAllDay && !isExamMode, {
      active: !formData.isAllDay && !isExamMode,
      message: 'Choose the event start time.',
    }),
    createFieldValidation('endTime', formData.endTime, 'End time', !formData.isAllDay && !isExamMode, {
      active: !formData.isAllDay && !isExamMode,
      message: 'Choose the event end time.',
      validate: (value) => formData.startDate === formData.endDate && value && formData.startTime && String(value) <= formData.startTime ? 'Choose an end time after the start time.' : undefined,
    }),
    createFieldValidation('targetAudience', formData.targetAudience, 'Target audience', !isExamMode, {
      active: !isExamMode,
      message: 'Choose at least one target audience.',
    }),
    createFieldValidation('examClasses', examData.selectedClassIds, 'Exam classes', isExamMode, {
      active: isExamMode,
      message: 'Choose at least one class for the exam.',
    }),
    createFieldValidation('examSubjects', Object.values(examData.perClassSelectedSubjects).flat(), 'Exam subjects', isExamMode && examData.examNature === 'Subject based', {
      active: isExamMode && examData.examNature === 'Subject based',
      message: 'Choose subjects for the subject-based exam.',
    }),
    createFieldValidation('examMarks', examData.maxMarks, 'Marks configuration', false, {
      active: isExamMode,
      focusTargetId: 'maxMarks',
      validate: () => examData.maxMarks > 0 && examData.passingMarks >= 0 && examData.passingMarks <= examData.maxMarks ? undefined : 'Enter a passing mark between zero and the maximum marks.',
    }),
  ], [examData.examNature, examData.maxMarks, examData.passingMarks, examData.perClassSelectedSubjects, examData.selectedClassIds, formData.endDate, formData.endTime, formData.isAllDay, formData.startDate, formData.startTime, formData.targetAudience, formData.title, isExamMode, selectedDates]);
  const formValidation = useFormValidation(validationFields);
  const fieldError = (fieldId: string) => formValidation.getFieldError(fieldId)?.message || errors[fieldId];

  // Reset form when event changes
  useEffect(() => {
    if (event) {
      setFormData({
        ...event,
        classIds: event.classIds || [],
        subjectIds: event.subjectIds || [],
        tags: event.tags || [],
        targetAudience: event.targetAudience || [],
        reminders: event.reminders || [],
      });
      // Pre-populate selectedDates for all-day events (e.g. when editing or opening from calendar click)
      if (event.isAllDay && event.startDate) {
        try {
          const [y, m, d] = event.startDate.split('-').map(Number);
          setSelectedDates([new Date(y, m - 1, d)]);
        } catch {
          setSelectedDates([]);
        }
      } else {
        setSelectedDates([]);
      }
    } else {
      setFormData({
        title: '',
        description: '',
        type: 'Academic',
        priority: 'Medium',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        isAllDay: false,
        location: '',
        targetAudience: [],
        academicYearId: activeAcademicYear?.id,
        termId: '',
        classIds: [],
        subjectIds: [],
        isExamEvent: false,
        recurrence: { frequency: 'None' },
        reminders: [],
        sendReminders: true,
        colorCode: EVENT_TYPE_COLORS['Academic'],
        requiresApproval: false,
        requiresAttendance: false,
        isPublic: true,
        tags: [],
      });
      setSelectedDates([]);
    }
    setErrors({});
    formValidation.resetValidation();
  }, [event, activeAcademicYear]);

  // Update exam mode when isExamEvent changes
  useEffect(() => {
    setIsExamMode(formData.isExamEvent || false);
    if (formData.isExamEvent) {
      // Auto-set appropriate values for exam events
      updateFormData('type', 'Academic');
      updateFormData('priority', 'High');
      updateFormData('requiresAttendance', true);
    }
  }, [formData.isExamEvent]);

  // Get available subjects for selected classes
  const availableSubjects = useMemo(() => {
    if (examData.examNature !== 'Subject based' || examData.selectedClassIds.length === 0) {
      return [];
    }
    const allSubjectIds = new Set<string>();
    examData.selectedClassIds.forEach(classId => {
      const cls = classes.find(c => c.id === classId);
      if (cls && cls.subjectAssignments) {
        cls.subjectAssignments.forEach(sa => {
          const subject = subjects.find(s => s.id === sa.subjectId);
          if (subject) {
            allSubjectIds.add(subject.id);
          }
        });
      }
    });
    return subjects.filter(sub => allSubjectIds.has(sub.id));
  }, [examData.selectedClassIds, examData.examNature, classes, subjects]);

  // ─── Auto-detect term from event start date ───────────────────────────────
  const detectedTermInfo = useMemo(() => {
    if (!formData.startDate || academicYears.length === 0) return null;
    const eventDate = new Date(formData.startDate + 'T12:00:00'); // midday to avoid TZ edge cases
    for (const year of academicYears) {
      if (!year.terms) continue;
      for (const term of year.terms) {
        if (!term.startDate || !term.endDate) continue;
        const termStart = new Date(term.startDate);
        const termEnd = new Date(term.endDate);
        if (eventDate >= termStart && eventDate <= termEnd) {
          return { yearId: year.id, yearName: year.name, termId: term.id, termName: term.name };
        }
      }
    }
    return null;
  }, [formData.startDate, academicYears]);

  // Sync academicYearId + termId whenever detected term changes
  useEffect(() => {
    if (detectedTermInfo) {
      setFormData(prev => ({
        ...prev,
        academicYearId: detectedTermInfo.yearId,
        termId: detectedTermInfo.termId,
      }));
    }
  }, [detectedTermInfo]);

  // (kept for exam mode which still needs the list)
  const availableTerms = academicYears
    .find((year: any) => year.id === formData.academicYearId)?.terms || [];

  const updateFormData = (key: keyof Event, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Clear error when field is updated
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
    formValidation.handleFieldChange(String(key));
  };

  const toggleArrayItem = (key: 'classIds' | 'subjectIds' | 'targetAudience' | 'tags', value: string) => {
    const currentArray = formData[key] as string[] || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFormData(key, newArray);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      updateFormData('tags', [...(formData.tags || []), newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    updateFormData('tags', formData.tags?.filter(t => t !== tag) || []);
  };

  const addAudience = () => {
    if (newAudience.trim() && !formData.targetAudience?.includes(newAudience.trim())) {
      updateFormData('targetAudience', [...(formData.targetAudience || []), newAudience.trim()]);
      setNewAudience('');
    }
  };

  const removeAudience = (audience: string) => {
    updateFormData('targetAudience', formData.targetAudience?.filter(a => a !== audience) || []);
  };

  const validateForm = (): boolean => {
    const result = formValidation.validateAll();
    const newErrors = Object.fromEntries(result.errors.map((fieldError) => [fieldError.id, fieldError.message]));
    setErrors(newErrors);
    return result.isValid;
  };


  // Helper: format a Date to YYYY-MM-DD using LOCAL timezone (not UTC).
  // Using toISOString() would shift the date back for UTC+ timezones.
  const toLocalDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called, isExamMode:', isExamMode, 'event:', event);
    if (!validateForm()) {
      console.log('Validation failed, returning early');
      return;
    }

    if (isExamMode && !event) {
      // Create exam from event
      try {
        const examPayload = {
          title: formData.title || '',
          description: formData.description,
          startDate: formData.startDate || '',
          endDate: formData.endDate || '',
          startTime: formData.startTime,
          endTime: formData.endTime,
          location: formData.location,
          academicYearId: formData.academicYearId || '',
          termId: formData.termId || '',
          examTypeId: examData.examTypeId,
          examNature: examData.examNature,
          selectedClassIds: examData.selectedClassIds,
          perClassSelectedSubjects: examData.perClassSelectedSubjects,
          maxMarks: examData.maxMarks,
          passingMarks: examData.passingMarks,
          instructions: examData.instructions,
        };

        console.log('Creating exam with payload:', examPayload);
        await createExamMutation.mutateAsync(examPayload);
        onClose();
        return;
      } catch (error) {
        console.error('Failed to create exam:', error);
        // Show error to user
        setErrors({
          submit: error instanceof Error ? error.message : 'Failed to create exam. Please try again.'
        });
        formValidation.setSubmissionError(error instanceof Error ? error.message : 'Failed to create exam. Please try again.');
        return;
      }
    }

    // Multiple Dates Logic
    if (formData.isAllDay && selectedDates.length > 0 && !isExamMode) {
      const baseEventData = {
        ...formData,
        createdBy: event ? formData.createdBy : user?.id || '',
        updatedBy: event ? user?.id : undefined,
        isRecurringInstance: false,
      };

      // Remove undefined fields
      Object.keys(baseEventData).forEach(key => {
        if (baseEventData[key as keyof typeof baseEventData] === undefined) {
          delete baseEventData[key as keyof typeof baseEventData];
        }
      });

      if (selectedDates.length === 1) {
        const singleDate = selectedDates[0];
        const dateString = toLocalDateString(singleDate);
        const withDate = { ...baseEventData, startDate: dateString, endDate: dateString };
        const eventData = {
          ...withDate,
          // Auto-compute status from final date
          status: getComputedEventStatus(withDate),
        } as CreateEventData | UpdateEventData;
        onSave(eventData);
      } else {
        const eventsToCreate = selectedDates.map(date => {
          const dateString = toLocalDateString(date);
          const withDate = { ...baseEventData, startDate: dateString, endDate: dateString };
          return {
            ...withDate,
            status: getComputedEventStatus(withDate),
          } as CreateEventData;
        });
        onSave(eventsToCreate);
      }
      return;
    }

    // Regular event creation/update
    const eventData = {
      ...formData,
      // Auto-compute status from dates — works for new and existing events
      status: getComputedEventStatus(formData),
      createdBy: event ? formData.createdBy : user?.id || '',
      updatedBy: event ? user?.id : undefined,
      isRecurringInstance: false,
    } as CreateEventData | UpdateEventData;

    // Remove undefined fields for cleaner data
    Object.keys(eventData).forEach(key => {
      if (eventData[key as keyof typeof eventData] === undefined) {
        delete eventData[key as keyof typeof eventData];
      }
    });

    onSave(eventData);
  };

  const handleTypeChange = (type: EventType) => {
    updateFormData('type', type);
    updateFormData('colorCode', EVENT_TYPE_COLORS[type]);
  };

  const addReminder = (timing: NotificationTiming) => {
    const exists = formData.reminders?.some(r => r.timing === timing);
    if (!exists) {
      const newReminder: EventReminder = {
        timing,
        enabled: true,
        channels: ['in_app', 'email'],
      };
      updateFormData('reminders', [...(formData.reminders || []), newReminder]);
    }
  };

  const updateReminder = (index: number, updates: Partial<EventReminder>) => {
    const newReminders = [...(formData.reminders || [])];
    newReminders[index] = { ...newReminders[index], ...updates };
    updateFormData('reminders', newReminders);
  };

  const removeReminder = (index: number) => {
    const newReminders = formData.reminders?.filter((_, i) => i !== index) || [];
    updateFormData('reminders', newReminders);
  };

  const updateExamData = (key: keyof typeof examData, value: any) => {
    setExamData(prev => ({ ...prev, [key]: value }));
    const fieldId = key === 'selectedClassIds' ? 'examClasses' : key === 'perClassSelectedSubjects' ? 'examSubjects' : key === 'maxMarks' || key === 'passingMarks' ? 'examMarks' : String(key);
    formValidation.handleFieldChange(fieldId);
  };

  const handleClassSelection = (classId: string, checked: boolean) => {
    const newClassIds = checked
      ? [...examData.selectedClassIds, classId]
      : examData.selectedClassIds.filter(id => id !== classId);

    updateExamData('selectedClassIds', newClassIds);

    // Remove subjects for unselected classes
    if (!checked) {
      const newSubjects = { ...examData.perClassSelectedSubjects };
      delete newSubjects[classId];
      updateExamData('perClassSelectedSubjects', newSubjects);
    }
  };

  const handleSubjectSelection = (classId: string, subjectId: string, checked: boolean) => {
    const currentSubjects = examData.perClassSelectedSubjects[classId] || [];
    const newSubjects = checked
      ? [...currentSubjects, subjectId]
      : currentSubjects.filter(id => id !== subjectId);

    updateExamData('perClassSelectedSubjects', {
      ...examData.perClassSelectedSubjects,
      [classId]: newSubjects
    });
  };

  // Render exam-specific fields
  const renderExamFields = () => {
    if (!isExamMode) return null;

    return (
      <>
        <Separator />

        {/* Exam Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Exam Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="examType">Exam Type *</Label>
              <Select
                value={examData.examTypeId}
                onValueChange={(value) => updateExamData('examTypeId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="examNature">Exam Nature *</Label>
              <Select
                value={examData.examNature}
                onValueChange={(value: ExamNature) => updateExamData('examNature', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam nature" />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_NATURES.map((nature) => (
                    <SelectItem key={nature} value={nature}>
                      {nature}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maxMarks" className={fieldError('examMarks') ? 'text-destructive' : undefined}>Maximum Marks *</Label>
              <Input
                id="maxMarks"
                type="number"
                value={examData.maxMarks}
                onChange={(e) => updateExamData('maxMarks', parseInt(e.target.value) || 0)}
                placeholder="100"
                min="1"
                {...formValidation.getFieldProps('examMarks')}
              />
            </div>
            {fieldError('examMarks') && <p id="examMarks-error" role="alert" className="text-sm text-red-600 md:col-span-2">{fieldError('examMarks')}</p>}

            <div>
              <Label htmlFor="passingMarks">Passing Marks *</Label>
              <Input
                id="passingMarks"
                type="number"
                value={examData.passingMarks}
                onChange={(e) => updateExamData('passingMarks', parseInt(e.target.value) || 0)}
                placeholder="40"
                min="0"
                max={examData.maxMarks}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="examInstructions">Exam Instructions</Label>
            <Textarea
              id="examInstructions"
              value={examData.instructions}
              onChange={(e) => updateExamData('instructions', e.target.value)}
              placeholder="Special instructions for this exam..."
              rows={2}
            />
          </div>
        </div>

        <Separator />

        {/* Target Classes for Exam */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Target Classes *
          </h3>

          <div id="examClasses" tabIndex={-1} aria-invalid={Boolean(fieldError('examClasses'))} aria-describedby={fieldError('examClasses') ? 'examClasses-error' : undefined} className="grid grid-cols-2 md:grid-cols-3 gap-3 rounded-md aria-invalid:border aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:p-2">
            {classes.map((cls) => (
              <div key={cls.id} className="flex items-center space-x-2 p-2 border rounded">
                <Checkbox
                  id={`exam - class- ${cls.id} `}
                  checked={examData.selectedClassIds.includes(cls.id)}
                  onCheckedChange={(checked) => handleClassSelection(cls.id, checked as boolean)}
                />
                <label htmlFor={`exam - class- ${cls.id} `} className="text-sm cursor-pointer">
                  {cls.name} ({cls.code})
                </label>
              </div>
            ))}
          </div>

          {fieldError('examClasses') && (
            <p id="examClasses-error" role="alert" className="text-sm text-red-500">{fieldError('examClasses')}</p>
          )}
        </div>

        {/* Subject Selection for Subject-based Exams */}
        {examData.examNature === 'Subject based' && examData.selectedClassIds.length > 0 && (
          <>
            <Separator />
            <div id="examSubjects" tabIndex={-1} aria-invalid={Boolean(fieldError('examSubjects'))} aria-describedby={fieldError('examSubjects') ? 'examSubjects-error' : undefined} className="space-y-4 rounded-md aria-invalid:border aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:p-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Subject Selection *
              </h3>

              {examData.selectedClassIds.map((classId) => {
                const cls = classes.find(c => c.id === classId);
                const classSubjects = cls?.subjectAssignments?.map(sa =>
                  subjects.find(s => s.id === sa.subjectId)
                ).filter(Boolean) || [];

                return (
                  <div key={classId} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">{cls?.name} ({cls?.code})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {classSubjects.map((subject) => (
                        <div key={subject?.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`subject - ${classId} -${subject?.id} `}
                            checked={examData.perClassSelectedSubjects[classId]?.includes(subject?.id || '') || false}
                            onCheckedChange={(checked) =>
                              handleSubjectSelection(classId, subject?.id || '', checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`subject - ${classId} -${subject?.id} `}
                            className="text-sm cursor-pointer"
                          >
                            {subject?.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {fieldError('examSubjects') && (
                <p id="examSubjects-error" role="alert" className="text-sm text-red-500">{fieldError('examSubjects')}</p>
              )}
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <ModernDialog open={isOpen} onOpenChange={onClose}>
      <ModernDialogContent className="max-w-5xl max-h-[95vh]" open={isOpen} onOpenChange={onClose}>
        <ModernDialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <ModernDialogTitle className="text-xl font-semibold">
              {event ? 'Edit Event' : isExamMode ? '🎓 Schedule New Exam' : '📅 Create New Event'}
            </ModernDialogTitle>
            {!event && (
              <div className="flex items-center gap-2 bg-slate-100 rounded-full p-1">
                <div className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!isExamMode
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}>
                  Event
                </div>
                <Switch
                  checked={isExamMode}
                  onCheckedChange={(checked) => {
                    setIsExamMode(checked);
                    updateFormData('isExamEvent', checked);
                    if (checked) {
                      setTimeout(() => {
                        const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
                        if (viewport) {
                          viewport.scrollTo({
                            top: viewport.scrollTop + 400,
                            behavior: 'smooth'
                          });
                        }
                      }, 150);
                    }
                  }}
                  className="mx-1"
                />
                <div className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${isExamMode
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}>
                  Exam
                </div>
              </div>
            )}
          </div>
        </ModernDialogHeader>

        <ScrollArea className="h-[75vh] pr-4">
          <div className="space-y-5 py-4">
            <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
            {/* Mode Alert */}
            {isExamMode && (
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <GraduationCap className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Exam Scheduling Mode Active</p>
                  <p className="text-xs text-red-600">Creates both exam record and calendar event</p>
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="bg-white border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 text-slate-800 border-b border-slate-100 pb-4">
                <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100/50">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                  <Label htmlFor="title" className={`text-sm font-medium ${fieldError('title') ? 'text-destructive' : ''}`}>
                    {isExamMode ? 'Exam Name' : 'Event Title'} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => updateFormData('title', e.target.value)}
                    {...formValidation.getFieldProps('title')}
                    placeholder={isExamMode ? "e.g., Mathematics End Term Exam" : "e.g., Annual Science Fair"}
                    className={`mt-1 ${fieldError('title') ? 'border-red-500 focus:border-red-500' : 'border-slate-300 focus:border-blue-500'}`}
                  />
                  {fieldError('title') && (
                    <p id="title-error" role="alert" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {fieldError('title')}
                    </p>
                  )}
                </div>

                {!isExamMode && (
                  <div>
                    <Label htmlFor="type" className="text-sm font-medium">Event Type <span className="text-red-500">*</span></Label>
                    <Select value={formData.type} onValueChange={handleTypeChange}>
                      <SelectTrigger className="mt-1 border-slate-300 focus:border-blue-500">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: EVENT_TYPE_COLORS[type] }}
                              />
                              {type}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="priority" className="text-sm font-medium">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: EventPriority) => updateFormData('priority', value)}>
                    <SelectTrigger className="mt-1 border-slate-300 focus:border-blue-500">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${priority === 'Urgent' ? 'bg-red-500' :
                              priority === 'High' ? 'bg-orange-500' :
                                priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                              }`} />
                            {priority}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2 mt-4">
                  <Label htmlFor="location" className="text-sm font-medium">Location</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="location"
                      value={formData.location || ''}
                      onChange={(e) => updateFormData('location', e.target.value)}
                      placeholder="e.g., Main Hall, Room 201"
                      className="pl-9 border-slate-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="colorCode" className="text-sm font-medium">Color</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="color"
                      value={formData.colorCode || EVENT_TYPE_COLORS['Academic']}
                      onChange={(e) => updateFormData('colorCode', e.target.value)}
                      className="w-12 h-9 p-1 border-slate-300"
                    />
                    <Input
                      value={formData.colorCode || EVENT_TYPE_COLORS['Academic']}
                      onChange={(e) => updateFormData('colorCode', e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1 border-slate-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <Label htmlFor="description" className="text-sm font-medium">
                    {isExamMode ? 'Exam Description' : 'Description'}
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    placeholder={isExamMode ? "Describe exam requirements, format, and instructions..." : "Provide event details, agenda, or requirements..."}
                    rows={4}
                    className="mt-1.5 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 resize-y min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="bg-white border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 text-slate-800 border-b border-slate-100 pb-4">
                <div className="p-2 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-100/50">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Date & Time</h3>
                <div className="ml-auto flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-100/80 transition-colors"
                  onClick={() => updateFormData('isAllDay', !formData.isAllDay)}>
                  <Checkbox
                    id="allDay"
                    checked={formData.isAllDay}
                    onCheckedChange={(checked) => updateFormData('isAllDay', checked)}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <Label htmlFor="allDay" className="text-sm font-medium cursor-pointer text-slate-700">
                    All Day Event
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {formData.isAllDay && !isExamMode ? (
                  <div className="lg:col-span-2 space-y-4">
                    <Label className="text-sm font-medium text-slate-700">Select Event Dates <span className="text-red-500">*</span></Label>
                    <div id="dates" tabIndex={-1} aria-invalid={Boolean(fieldError('dates'))} aria-describedby={fieldError('dates') ? 'dates-error' : undefined} className="bg-gradient-to-br from-slate-50 to-white ring-1 ring-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-8 aria-invalid:ring-red-600 aria-invalid:bg-red-50/70">
                      <div className="flex-1 bg-white p-4 rounded-xl shadow-sm ring-1 ring-slate-200/60 self-start max-w-sm mx-auto w-full flex items-center justify-center min-h-[360px]">
                        <CalendarComponent
                          mode="multiple"
                          selected={selectedDates}
                          onSelect={(dates: Date[] | undefined) => { if (dates) { setSelectedDates(dates); formValidation.handleFieldChange('dates'); } }}
                          className="mx-auto"
                        />
                      </div>
                      <div className="flex-1 space-y-3">
                        <Label className="text-sm text-slate-500 font-medium tracking-wide uppercase">
                          Selected Dates ({selectedDates.length})
                        </Label>
                        <ScrollArea className="h-[280px] w-full rounded-md border bg-white p-4 shadow-inner">
                          {selectedDates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                              <Calendar className="h-8 w-8 opacity-50" />
                              <p className="text-sm">No dates selected</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {selectedDates.sort((a, b) => a.getTime() - b.getTime()).map((date, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-blue-50/50 hover:bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg transition-colors group">
                                  <span className="text-sm font-medium text-slate-700">
                                    {date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 hover:text-red-500 rounded-full"
                                    onClick={() => setSelectedDates(selectedDates.filter(d => d.getTime() !== date.getTime()))}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </div>
                    {fieldError('dates') && (
                      <p id="dates-error" role="alert" className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {fieldError('dates')}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className={`text-sm font-medium ${fieldError('startDate') ? 'text-destructive' : ''}`}>
                        Start Date <span className="text-red-500">*</span>
                      </Label>
                      <DatePicker
                        date={formData.startDate ? new Date(formData.startDate) : undefined}
                        setDate={(d) => updateFormData('startDate', d ? format(d, 'yyyy-MM-dd') : '')}
                        triggerProps={formValidation.getFieldProps('startDate')}
                        placeholder="Pick start date"
                      />
                      {fieldError('startDate') && (
                        <p id="startDate-error" role="alert" className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {fieldError('startDate')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endDate" className={`text-sm font-medium ${fieldError('endDate') ? 'text-destructive' : ''}`}>
                        End Date <span className="text-red-500">*</span>
                      </Label>
                      <DatePicker
                        date={formData.endDate ? new Date(formData.endDate) : undefined}
                        setDate={(d) => updateFormData('endDate', d ? format(d, 'yyyy-MM-dd') : '')}
                        triggerProps={formValidation.getFieldProps('endDate')}
                        placeholder="Pick end date"
                      />
                      {fieldError('endDate') && (
                        <p id="endDate-error" role="alert" className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {fieldError('endDate')}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {!formData.isAllDay && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="startTime" className={`text-sm font-medium ${fieldError('startTime') ? 'text-destructive' : ''}`}>
                        Start Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.startTime || ''}
                        onChange={(e) => updateFormData('startTime', e.target.value)}
                        {...formValidation.getFieldProps('startTime')}
                        className={`border-slate-300 focus:border-blue-500 ${fieldError('startTime') ? 'border-red-500 focus:border-red-500' : ''}`}
                      />
                      {fieldError('startTime') && (
                        <p id="startTime-error" role="alert" className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {fieldError('startTime')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endTime" className={`text-sm font-medium ${fieldError('endTime') ? 'text-destructive' : ''}`}>
                        End Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.endTime || ''}
                        onChange={(e) => updateFormData('endTime', e.target.value)}
                        {...formValidation.getFieldProps('endTime')}
                        className={`border-slate-300 focus:border-blue-500 ${fieldError('endTime') ? 'border-red-500 focus:border-red-500' : ''}`}
                      />
                      {fieldError('endTime') && (
                        <p id="endTime-error" role="alert" className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {fieldError('endTime')}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Academic Context — auto-detected from event date */}
            <div className="bg-white border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-3 text-slate-800 border-b border-slate-100 pb-4">
                <div className="p-2 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-100/50">
                  <BookOpen className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">Academic Context</h3>
                <span className="ml-auto text-xs text-slate-400 italic">Auto-detected from event date</span>
              </div>

              {detectedTermInfo ? (
                <div className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-sm font-semibold text-emerald-800">{detectedTermInfo.yearName}</span>
                  </div>
                  <span className="text-slate-400">·</span>
                  <span className="text-sm font-medium text-emerald-700">{detectedTermInfo.termName}</span>
                </div>
              ) : formData.startDate ? (
                <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700">No active school term found for the selected date. The event will be saved without a term assignment.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-500">Select an event date above — the academic term will be detected automatically.</p>
                </div>
              )}
            </div>

            {/* Render exam-specific fields */}
            {renderExamFields()}

            {/* Settings */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                {isExamMode ? 'Exam Settings' : 'Event Settings'}
              </h3>

              <div className="space-y-3">
                {!isExamMode && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isExamEvent"
                      checked={formData.isExamEvent}
                      onCheckedChange={(checked) => updateFormData('isExamEvent', checked)}
                    />
                    <Label htmlFor="isExamEvent" className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      This is an exam event
                    </Label>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresApproval"
                    checked={formData.requiresApproval}
                    onCheckedChange={(checked) => updateFormData('requiresApproval', checked)}
                  />
                  <Label htmlFor="requiresApproval">Requires approval</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresAttendance"
                    checked={formData.requiresAttendance}
                    onCheckedChange={(checked) => {
                      updateFormData('requiresAttendance', checked);
                      // Reset audience when toggling attendance
                      if (checked) {
                        updateFormData('targetAudience', []);
                      }
                    }}
                  />
                  <Label htmlFor="requiresAttendance">Track attendance</Label>
                </div>

                {!isExamMode && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isPublic"
                      checked={formData.isPublic}
                      onCheckedChange={(checked) => updateFormData('isPublic', checked)}
                    />
                    <Label htmlFor="isPublic">Public event (visible to all)</Label>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendReminders"
                    checked={formData.sendReminders}
                    onCheckedChange={(checked) => updateFormData('sendReminders', checked)}
                  />
                  <Label htmlFor="sendReminders" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Send reminders
                  </Label>
                </div>
              </div>
            </div>

            {/* Target Audience */}
            {!isExamMode && (
              <>
                <Separator />
                <div id="targetAudience" tabIndex={-1} aria-invalid={Boolean(fieldError('targetAudience'))} aria-describedby={fieldError('targetAudience') ? 'targetAudience-error' : undefined} className="space-y-4 rounded-md aria-invalid:border aria-invalid:border-red-600 aria-invalid:bg-red-50/70 aria-invalid:p-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Target Audience *
                    {formData.requiresAttendance && (
                      <span className="text-sm font-normal text-blue-600">(Attendance Tracking Enabled)</span>
                    )}
                  </h3>

                  <div className="space-y-4">
                    {/* Attendance-specific restrictions */}
                    {formData.requiresAttendance ? (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                          <p className="text-sm text-blue-800 mb-2">
                            <strong>Attendance Mode:</strong> Select one audience type for attendance tracking.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Select Audience Type:</Label>
                          <div className="grid grid-cols-1 gap-2">
                            {['All Teachers', 'All Pupils', 'All Parents'].map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`attendance - ${option} `}
                                  checked={formData.targetAudience?.includes(option) || false}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      // Only allow one audience type for attendance events
                                      updateFormData('targetAudience', [option]);
                                    } else {
                                      updateFormData('targetAudience', []);
                                    }
                                  }}
                                />
                                <Label htmlFor={`attendance - ${option} `} className="cursor-pointer">
                                  {option}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {formData.targetAudience && formData.targetAudience.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {formData.targetAudience.map((audience, index) => (
                              <Badge key={index} variant="default" className="bg-blue-100 text-blue-800">
                                {audience}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add target audience..."
                            value={newAudience}
                            onChange={(e) => setNewAudience(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addAudience()}
                          />
                          <Button type="button" onClick={addAudience} size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {formData.targetAudience && formData.targetAudience.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {formData.targetAudience.map((audience, index) => (
                              <Badge key={index} variant="outline" className="gap-1">
                                {audience}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => removeAudience(audience)}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Quick audience options for non-attendance events */}
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Quick Options:</Label>
                          <div className="flex flex-wrap gap-2">
                            {['All Staff', 'All Parents', 'All Pupils'].map((option) => (
                              <Button
                                key={option}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (!formData.targetAudience?.includes(option)) {
                                    updateFormData('targetAudience', [...(formData.targetAudience || []), option]);
                                  }
                                }}
                                className="text-xs"
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {fieldError('targetAudience') && (
                      <p id="targetAudience-error" role="alert" className="text-sm text-red-500">{fieldError('targetAudience')}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Classes & Subjects */}
            {!isExamMode && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Classes & Subjects</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Classes */}
                    <div>
                      <Label className="text-sm font-medium">Classes</Label>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                        {classes.map((cls) => (
                          <div key={cls.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`class-${cls.id} `}
                              checked={formData.classIds?.includes(cls.id) || false}
                              onCheckedChange={() => toggleArrayItem('classIds', cls.id)}
                            />
                            <label htmlFor={`class-${cls.id} `} className="text-sm cursor-pointer">
                              {cls.name} ({cls.code})
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subjects */}
                    <div>
                      <Label className="text-sm font-medium">Subjects</Label>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                        {subjects.map((subject) => (
                          <div key={subject.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`subject - ${subject.id} `}
                              checked={formData.subjectIds?.includes(subject.id) || false}
                              onCheckedChange={() => toggleArrayItem('subjectIds', subject.id)}
                            />
                            <label htmlFor={`subject - ${subject.id} `} className="text-sm cursor-pointer">
                              {subject.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Tags */}
            {!isExamMode && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Tags
                  </h3>

                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button type="button" onClick={addTag} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {formData.tags && formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="gap-1">
                            {tag}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => removeTag(tag)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Error Display */}
        {errors.submit && (
          <div className="px-6 py-3 bg-red-50 border-l-4 border-red-400">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{errors.submit}</p>
              </div>
            </div>
          </div>
        )}

        <ModernDialogFooter className="flex flex-col sm:flex-row justify-between items-center p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl gap-4 sm:gap-0 mt-auto">
          <div className="flex items-center text-xs font-medium text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm ring-1 ring-slate-200/50">
            {isExamMode ? (
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-slate-400" />
                Exam will be created in both calendar and exams module
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                Event will be added to the calendar
              </span>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="border-slate-300 hover:bg-slate-100 flex-1 sm:flex-none h-11 px-6 rounded-xl font-medium">
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log('Button clicked!');
                handleSubmit();
              }}
              disabled={createExamMutation.isPending}
              className={`flex-1 sm:flex-none h-11 px-8 rounded-xl font-medium shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] ${isExamMode
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                } text-white`}
            >
              <Save className="h-4 w-4 mr-2" />
              {createExamMutation.isPending ? 'Creating...' : (event ? 'Update Event' : isExamMode ? 'Schedule Exam' : 'Create Event')}
            </Button>
          </div>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
}
