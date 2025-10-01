"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Filter, 
  X, 
  Search, 
  Calendar, 
  Tag, 
  Users, 
  BookOpen,
  GraduationCap,
  Building,
  Clock
} from 'lucide-react';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import type { 
  EventFilters, 
  EventType, 
  EventStatus, 
  EventPriority 
} from '@/types';

const EVENT_TYPES: EventType[] = ['Academic', 'Co-curricular', 'Administrative', 'Holiday'];
const EVENT_STATUSES: EventStatus[] = ['Draft', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
const EVENT_PRIORITIES: EventPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

interface EventFiltersProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  className?: string;
}

export function EventFilters({ 
  filters, 
  onFiltersChange, 
  className = "" 
}: EventFiltersProps) {
  const { data: academicYears = [] } = useAcademicYears();
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();

  const updateFilter = (key: keyof EventFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleArrayFilter = (
    key: keyof EventFilters,
    value: string,
    currentArray: string[] = []
  ) => {
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    
    updateFilter(key, newArray.length > 0 ? newArray : undefined);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.types?.length) count++;
    if (filters.statuses?.length) count++;
    if (filters.priorities?.length) count++;
    if (filters.academicYearIds?.length) count++;
    if (filters.termIds?.length) count++;
    if (filters.classIds?.length) count++;
    if (filters.subjectIds?.length) count++;
    if (filters.isExamEvent !== undefined) count++;
    if (filters.dateRange) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  // Get terms for selected academic years
  const availableTerms = React.useMemo(() => {
    if (!filters.academicYearIds?.length) return [];
    return academicYears
      .filter(year => filters.academicYearIds?.includes(year.id))
      .flatMap(year => year.terms?.map(term => ({ ...term, yearName: year.name })) || []);
  }, [academicYears, filters.academicYearIds]);

  return (
    <Card className={`shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 ${className}`}>
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-gray-500 hover:text-gray-700 px-2 sm:px-3"
            >
              <X className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Search */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Events
          </Label>
          <Input
            placeholder="Search by title, description, or location..."
            value={filters.searchTerm || ''}
            onChange={(e) => updateFilter('searchTerm', e.target.value || undefined)}
            className="w-full"
          />
        </div>

        {/* Event Types - Multi-Select Dropdown */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Event Types
          </Label>
          
          <div className="relative">
            <Select
              value={filters.types?.length === 1 ? filters.types[0] : filters.types?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('types', undefined);
                } else if (value === 'multiple') {
                  // Keep current selection - handled by badges
                  return;
                } else {
                  toggleArrayFilter('types', value as EventType, filters.types);
                }
              }}
            >
              <SelectTrigger className="w-full h-10 sm:h-9">
                <SelectValue>
                  {!filters.types?.length ? (
                    <span className="text-muted-foreground">All Event Types</span>
                  ) : filters.types.length === 1 ? (
                    <div className="flex items-center gap-2">
                      {filters.types[0] === 'Academic' && <BookOpen className="h-4 w-4" />}
                      {filters.types[0] === 'Co-curricular' && <Users className="h-4 w-4" />}
                      {filters.types[0] === 'Administrative' && <Building className="h-4 w-4" />}
                      {filters.types[0] === 'Holiday' && <Calendar className="h-4 w-4" />}
                      {filters.types[0]}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{filters.types.length} types selected</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {!filters.types?.length && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                    All Event Types
                  </div>
                </SelectItem>
                <div className="h-px bg-border my-1" />
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.types?.includes(type) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      {type === 'Academic' && <BookOpen className="h-4 w-4" />}
                      {type === 'Co-curricular' && <Users className="h-4 w-4" />}
                      {type === 'Administrative' && <Building className="h-4 w-4" />}
                      {type === 'Holiday' && <Calendar className="h-4 w-4" />}
                      {type}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Show selected types as badges */}
          {filters.types?.length ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {filters.types.map((type) => (
                <Badge
                  key={type}
                  variant="secondary"
                  className="text-xs px-2.5 py-1.5 sm:px-2 sm:py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-105 min-h-[32px] sm:min-h-auto flex items-center"
                  onClick={() => toggleArrayFilter('types', type, filters.types)}
                >
                  {type}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* Event Status - Multi-Select Dropdown */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Status
          </Label>
          
          <div className="relative">
            <Select
              value={filters.statuses?.length === 1 ? filters.statuses[0] : filters.statuses?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('statuses', undefined);
                } else if (value === 'multiple') {
                  // Keep current selection - handled by badges
                  return;
                } else {
                  toggleArrayFilter('statuses', value as EventStatus, filters.statuses);
                }
              }}
            >
              <SelectTrigger className="w-full h-10 sm:h-9">
                <SelectValue>
                  {!filters.statuses?.length ? (
                    <span className="text-muted-foreground">All Statuses</span>
                  ) : filters.statuses.length === 1 ? (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        filters.statuses[0] === 'Draft' ? 'bg-yellow-500' :
                        filters.statuses[0] === 'Scheduled' ? 'bg-blue-500' :
                        filters.statuses[0] === 'Ongoing' ? 'bg-green-500' :
                        filters.statuses[0] === 'Completed' ? 'bg-gray-500' :
                        filters.statuses[0] === 'Cancelled' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      {filters.statuses[0]}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{filters.statuses.length} statuses selected</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {!filters.statuses?.length && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                    All Statuses
                  </div>
                </SelectItem>
                <div className="h-px bg-border my-1" />
                {EVENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.statuses?.includes(status) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        status === 'Draft' ? 'bg-yellow-500' :
                        status === 'Scheduled' ? 'bg-blue-500' :
                        status === 'Ongoing' ? 'bg-green-500' :
                        status === 'Completed' ? 'bg-gray-500' :
                        status === 'Cancelled' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      {status}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Show selected statuses as badges */}
          {filters.statuses?.length ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {filters.statuses.map((status) => (
                <Badge
                  key={status}
                  variant="secondary"
                  className="text-xs px-2.5 py-1.5 sm:px-2 sm:py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-105 min-h-[32px] sm:min-h-auto flex items-center"
                  onClick={() => toggleArrayFilter('statuses', status, filters.statuses)}
                >
                  <div className={`w-2 h-2 rounded-full mr-1 ${
                    status === 'Draft' ? 'bg-yellow-500' :
                    status === 'Scheduled' ? 'bg-blue-500' :
                    status === 'Ongoing' ? 'bg-green-500' :
                    status === 'Completed' ? 'bg-gray-500' :
                    status === 'Cancelled' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                  {status}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* Priority */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Priority</Label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_PRIORITIES.map((priority) => (
              <div key={priority} className="flex items-center space-x-2">
                <Checkbox
                  id={`priority-${priority}`}
                  checked={filters.priorities?.includes(priority) || false}
                  onCheckedChange={() => toggleArrayFilter('priorities', priority, filters.priorities)}
                />
                <label
                  htmlFor={`priority-${priority}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {priority}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Academic Context - Compact Tiles */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Academic Context
          </Label>
          
          <div className="grid grid-cols-1 gap-3">
            {/* Academic Year Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">Academic Year</Label>
              <Select
                value={filters.academicYearIds?.[0] || "all"}
                onValueChange={(value) => {
                  if (value && value !== "all") {
                    updateFilter('academicYearIds', [value]);
                    // Clear term selection when academic year changes
                    updateFilter('termIds', undefined);
                  } else {
                    updateFilter('academicYearIds', undefined);
                    updateFilter('termIds', undefined);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All academic years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Academic Years</SelectItem>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name} {year.isActive ? '(Current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Term Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">Term</Label>
              <Select
                value={filters.termIds?.[0] || "all"}
                onValueChange={(value) => {
                  if (value && value !== "all") {
                    updateFilter('termIds', [value]);
                  } else {
                    updateFilter('termIds', undefined);
                  }
                }}
                disabled={availableTerms.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={availableTerms.length > 0 ? "All terms" : "Select academic year first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {availableTerms.map((term, index) => (
                    <SelectItem key={`${term.id}-${index}`} value={term.id}>
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Classes - Multi-Select Dropdown */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Classes
          </Label>
          
          <div className="relative">
            <Select
              value={filters.classIds?.length === 1 ? filters.classIds[0] : filters.classIds?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('classIds', undefined);
                } else if (value === 'multiple') {
                  // Keep current selection - handled by badges
                  return;
                } else {
                  toggleArrayFilter('classIds', value, filters.classIds);
                }
              }}
            >
              <SelectTrigger className="w-full h-10 sm:h-9">
                <SelectValue>
                  {!filters.classIds?.length ? (
                    <span className="text-muted-foreground">All Classes</span>
                  ) : filters.classIds.length === 1 ? (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {(() => {
                        const selectedClass = classes.find(cls => cls.id === filters.classIds![0]);
                        return selectedClass ? `${selectedClass.name} (${selectedClass.code})` : 'Unknown Class';
                      })()}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{filters.classIds.length} classes selected</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all" className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {!filters.classIds?.length && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                    All Classes
                  </div>
                </SelectItem>
                <div className="h-px bg-border my-1" />
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.classIds?.includes(cls.id) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      <Users className="h-4 w-4" />
                      <span className="truncate">
                        {cls.name} <span className="text-muted-foreground">({cls.code})</span>
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Show selected classes as badges */}
          {filters.classIds?.length ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {filters.classIds.map((classId) => {
                const cls = classes.find(c => c.id === classId);
                return cls ? (
                  <Badge
                    key={classId}
                    variant="secondary"
                    className="text-xs px-2.5 py-1.5 sm:px-2 sm:py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-105 min-h-[32px] sm:min-h-auto flex items-center"
                    onClick={() => toggleArrayFilter('classIds', classId, filters.classIds)}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    {cls.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ) : null;
              })}
            </div>
          ) : null}
        </div>

        {/* Subjects - Multi-Select Dropdown */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Subjects
          </Label>
          
          <div className="relative">
            <Select
              value={filters.subjectIds?.length === 1 ? filters.subjectIds[0] : filters.subjectIds?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('subjectIds', undefined);
                } else if (value === 'multiple') {
                  // Keep current selection - handled by badges
                  return;
                } else {
                  toggleArrayFilter('subjectIds', value, filters.subjectIds);
                }
              }}
            >
              <SelectTrigger className="w-full h-10 sm:h-9">
                <SelectValue>
                  {!filters.subjectIds?.length ? (
                    <span className="text-muted-foreground">All Subjects</span>
                  ) : filters.subjectIds.length === 1 ? (
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {(() => {
                        const selectedSubject = subjects.find(subj => subj.id === filters.subjectIds![0]);
                        return selectedSubject ? selectedSubject.name : 'Unknown Subject';
                      })()}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{filters.subjectIds.length} subjects selected</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all" className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {!filters.subjectIds?.length && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                    All Subjects
                  </div>
                </SelectItem>
                <div className="h-px bg-border my-1" />
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.subjectIds?.includes(subject.id) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      <BookOpen className="h-4 w-4" />
                      <span className="truncate">{subject.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Show selected subjects as badges */}
          {filters.subjectIds?.length ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-1">
              {filters.subjectIds.map((subjectId) => {
                const subject = subjects.find(s => s.id === subjectId);
                return subject ? (
                  <Badge
                    key={subjectId}
                    variant="secondary"
                    className="text-xs px-2.5 py-1.5 sm:px-2 sm:py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-105 min-h-[32px] sm:min-h-auto flex items-center"
                    onClick={() => toggleArrayFilter('subjectIds', subjectId, filters.subjectIds)}
                  >
                    <BookOpen className="h-3 w-3 mr-1" />
                    {subject.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ) : null;
              })}
            </div>
          ) : null}
        </div>

        {/* Special Filters */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Special Filters</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="exam-events"
                checked={filters.isExamEvent === true}
                onCheckedChange={(checked) => 
                  updateFilter('isExamEvent', checked ? true : undefined)
                }
              />
              <label
                htmlFor="exam-events"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                Exam Events Only
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-holidays"
                checked={!filters.types?.length || filters.types.includes('Holiday')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    // Add Holiday to types filter or clear types filter
                    const currentTypes = filters.types || [];
                    if (!currentTypes.includes('Holiday')) {
                      updateFilter('types', [...currentTypes, 'Holiday']);
                    }
                  } else {
                    // Remove Holiday from types filter
                    const currentTypes = filters.types || [];
                    const newTypes = currentTypes.filter(type => type !== 'Holiday');
                    updateFilter('types', newTypes.length > 0 ? newTypes : undefined);
                  }
                }}
              />
              <label
                htmlFor="show-holidays"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
              >
                🇺🇬 Uganda Public Holidays
              </label>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Date Range</Label>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Label className="text-xs text-gray-500">From</Label>
              <Input
                type="date"
                value={filters.dateRange?.startDate || ''}
                onChange={(e) => updateFilter('dateRange', {
                  ...filters.dateRange,
                  startDate: e.target.value,
                  endDate: filters.dateRange?.endDate || e.target.value
                })}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">To</Label>
              <Input
                type="date"
                value={filters.dateRange?.endDate || ''}
                onChange={(e) => updateFilter('dateRange', {
                  startDate: filters.dateRange?.startDate || e.target.value,
                  endDate: e.target.value
                })}
              />
            </div>
          </div>
          {filters.dateRange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('dateRange', undefined)}
              className="text-gray-500 hover:text-gray-700 w-full"
            >
              Clear Date Range
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 