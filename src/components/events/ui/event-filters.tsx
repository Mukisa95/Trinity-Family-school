"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import {
  Filter,
  X,
  Calendar,
  Tag,
  Users,
  BookOpen,
  GraduationCap,
  Building,
  Clock,
  LayoutGrid,
  List
} from 'lucide-react';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { DatePicker } from '@/components/common/date-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type {
  EventFilters,
  EventType,
  EventStatus,
  EventPriority
} from '@/types';

const EVENT_TYPES: EventType[] = ['Academic', 'Co-curricular', 'Administrative', 'Holiday'];
const EVENT_STATUSES: EventStatus[] = ['Scheduled', 'Ongoing', 'Completed'];
const EVENT_PRIORITIES: EventPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

interface EventFiltersProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  className?: string;
  isCompactView?: boolean;
  onToggleCompactView?: () => void;
}

export function EventFilters({
  filters,
  onFiltersChange,
  className = "",
  isCompactView,
  onToggleCompactView
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

  // Compute available terms from the selected academic year filter
  const availableTerms = React.useMemo(() => {
    const selectedYearId = filters.academicYearIds?.[0];
    if (!selectedYearId) return [];
    const selectedYear = academicYears.find(year => year.id === selectedYearId);
    return selectedYear?.terms || [];
  }, [filters.academicYearIds, academicYears]);

  // 🚀 DYNAMIC YEAR LABELS
  const currentAcademicYearId = React.useMemo(() => {
    if (academicYears.length === 0) return null;
    const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
    return effectiveTerm?.academicYear?.id || null;
  }, [academicYears]);

  return (
    <Card className={`border-0 bg-transparent shadow-none ${className}`}>
      <CardHeader className="pb-3 px-3 sm:px-4 border-b border-slate-100/50 mb-3 bg-white/40 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            <div className="w-6 h-6 rounded-lg bg-blue-100/50 flex items-center justify-center">
              <Filter className="h-3 w-3 text-blue-600" />
            </div>
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-blue-100 hover:bg-blue-200 text-blue-700 border-0">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {onToggleCompactView && isCompactView !== undefined && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCompactView}
                className="h-6 px-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1"
                title={`Switch to ${isCompactView ? 'Expanded' : 'Compact'} Layout`}
              >
                {isCompactView ? <LayoutGrid className="h-3 w-3" /> : <List className="h-3 w-3" />}
                <span className="sr-only">Toggle Layout</span>
              </Button>
            )}

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 h-6 rounded-md transition-colors text-[10px]"
              >
                <X className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline font-semibold">Clear</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-3 sm:px-4 pb-4">
        {/* Event Types - Multi-Select Dropdown */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            Event Types
          </Label>

          <div className="relative">
            <Select
              value={filters.types?.length === 1 ? filters.types[0] : filters.types?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('types', undefined);
                } else if (value === 'multiple') {
                  return;
                } else {
                  toggleArrayFilter('types', value as EventType, filters.types);
                }
              }}
            >
              <SelectTrigger className="w-full bg-white/60 border-slate-200/60 focus:bg-white rounded-lg h-8 text-xs shadow-sm transition-all [&>svg]:hidden px-2 justify-center">
                <SelectValue>
                  {!filters.types?.length ? (
                    <span className="text-slate-400">All Event Types</span>
                  ) : filters.types.length === 1 ? (
                    <div className="flex items-center gap-2 font-medium">
                      {filters.types[0] === 'Academic' && <BookOpen className="h-4 w-4 text-blue-500" />}
                      {filters.types[0] === 'Co-curricular' && <Users className="h-4 w-4 text-indigo-500" />}
                      {filters.types[0] === 'Administrative' && <Building className="h-4 w-4 text-slate-500" />}
                      {filters.types[0] === 'Holiday' && <Calendar className="h-4 w-4 text-amber-500" />}
                      {filters.types[0]}
                    </div>
                  ) : (
                    <span className="text-slate-600 font-medium">{filters.types.length} types selected</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-lg border-slate-200/60 shadow-xl">
                <SelectItem value="all" className="font-medium rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {!filters.types?.length && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                    All Event Types
                  </div>
                </SelectItem>
                <div className="h-px bg-slate-100 my-1" />
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.types?.includes(type) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      {type === 'Academic' && <BookOpen className="h-4 w-4 text-blue-500" />}
                      {type === 'Co-curricular' && <Users className="h-4 w-4 text-indigo-500" />}
                      {type === 'Administrative' && <Building className="h-4 w-4 text-slate-500" />}
                      {type === 'Holiday' && <Calendar className="h-4 w-4 text-amber-500" />}
                      {type}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filters.types?.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {filters.types.map((type) => (
                <Badge
                  key={type}
                  variant="secondary"
                  className="text-xs px-2.5 py-1 cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-all shadow-sm rounded-lg flex items-center gap-1 group"
                  onClick={() => toggleArrayFilter('types', type, filters.types)}
                >
                  {type}
                  <X className="h-3 w-3 text-slate-400 group-hover:text-red-500 transition-colors" />
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

        {/* Event Status - Multi-Select Dropdown */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Status
          </Label>

          <div className="relative">
            <Select
              value={filters.statuses?.length === 1 ? filters.statuses[0] : filters.statuses?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') {
                  updateFilter('statuses', undefined);
                } else if (value === 'multiple') {
                  return;
                } else {
                  toggleArrayFilter('statuses', value as EventStatus, filters.statuses);
                }
              }}
            >
              <SelectTrigger className="w-full bg-white/60 border-slate-200/60 focus:bg-white rounded-lg h-8 text-xs shadow-sm transition-all">
                <SelectValue>
                  {!filters.statuses?.length ? (
                    <span className="text-slate-400">All Statuses</span>
                  ) : filters.statuses.length === 1 ? (
                    <div className="flex items-center gap-2 font-medium">
                      <div className={`w-2.5 h-2.5 rounded-full ${filters.statuses[0] === 'Scheduled' ? 'bg-blue-500' :
                        filters.statuses[0] === 'Ongoing' ? 'bg-emerald-500' :
                          filters.statuses[0] === 'Completed' ? 'bg-slate-400' : 'bg-slate-300'
                        }`} />
                      {filters.statuses[0]}
                    </div>
                  ) : (
                    <span className="text-slate-600 font-medium">{filters.statuses.length} statuses selected</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-lg border-slate-200/60 shadow-xl">
                <SelectItem value="all" className="font-medium rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {!filters.statuses?.length && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                    All Statuses
                  </div>
                </SelectItem>
                <div className="h-px bg-slate-100 my-1" />
                {EVENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status} className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.statuses?.includes(status) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      <div className={`w-2 h-2 rounded-full ${status === 'Scheduled' ? 'bg-blue-500' :
                        status === 'Ongoing' ? 'bg-emerald-500' :
                          status === 'Completed' ? 'bg-slate-400' : 'bg-slate-300'
                        }`} />
                      {status}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filters.statuses?.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {filters.statuses.map((status) => (
                <Badge
                  key={status}
                  variant="secondary"
                  className="text-xs px-2.5 py-1 cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-all shadow-sm rounded-lg flex items-center gap-1.5 group"
                  onClick={() => toggleArrayFilter('statuses', status, filters.statuses)}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${status === 'Scheduled' ? 'bg-blue-500' :
                    status === 'Ongoing' ? 'bg-emerald-500' :
                      status === 'Completed' ? 'bg-slate-400' : 'bg-slate-300'
                    }`} />
                  {status}
                  <X className="h-3 w-3 text-slate-400 group-hover:text-red-500 transition-colors ml-0.5" />
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* Priority Filter Hidden for Compactness
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700">Priority</Label>
          <div className="grid grid-cols-2 gap-3">
            {EVENT_PRIORITIES.map((priority) => (
              <div key={priority} className="flex items-center space-x-2.5 group cursor-pointer" onClick={() => toggleArrayFilter('priorities', priority, filters.priorities)}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.priorities?.includes(priority) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                  {filters.priorities?.includes(priority) && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                </div>
                <Label
                  className="text-xs font-medium text-slate-600 group-hover:text-slate-900 leading-none cursor-pointer"
                >
                  {priority}
                </Label>
              </div>
            ))}
          </div>
        </div>
        */}

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

        {/* Academic Context */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Academic Context
          </Label>

          {/* Consolidated Academic Year and Term Selector */}
          <Select
            value={
              filters.termIds?.length ? `term|${filters.termIds[0]}` :
                filters.academicYearIds?.length ? `year|${filters.academicYearIds[0]}` :
                  "all"
            }
            onValueChange={(value) => {
              if (value === "all") {
                updateFilter('academicYearIds', undefined);
                updateFilter('termIds', undefined);
              } else if (value.startsWith('year|')) {
                updateFilter('academicYearIds', [value.split('|')[1]]);
                updateFilter('termIds', undefined);
              } else if (value.startsWith('term|')) {
                const termId = value.split('|')[1];
                const year = academicYears.find((y: any) => y.terms.some((t: any) => t.id === termId));
                if (year) {
                  updateFilter('academicYearIds', [year.id]);
                }
                updateFilter('termIds', [termId]);
              }
            }}
          >
            <SelectTrigger className="w-full bg-white border-slate-200/60 rounded-lg h-8 text-xs shadow-sm [&>svg]:hidden px-2 justify-center">
              <SelectValue placeholder="All Academic Years" />
            </SelectTrigger>
            <SelectContent className="rounded-lg max-h-80">
              <SelectItem value="all" className="rounded-lg font-medium text-blue-700">All Academic Contexts</SelectItem>

              {academicYears.map((year: any) => {
                const isCurrent = year.id === currentAcademicYearId;
                const today = new Date();
                const yearEnd = new Date(year.endDate);
                const hasEnded = today > yearEnd;

                let label = '';
                if (isCurrent) label = ' (Current)';
                else if (year.isLocked) label = ' (Locked)';
                else if (!hasEnded) label = ' (Upcoming)';

                return (
                  <SelectGroup key={year.id} className="mt-2">
                    <SelectLabel className="text-xs font-bold text-slate-500 bg-slate-50/80 px-2 py-1 uppercase tracking-wider rounded">
                      {year.name} {label}
                    </SelectLabel>
                    <SelectItem value={`year|${year.id}`} className="rounded-lg pl-6 font-medium text-slate-700">
                      Entire {year.name}
                    </SelectItem>
                    {year.terms.map((term: any) => (
                      <SelectItem key={term.id} value={`term|${term.id}`} className="rounded-lg pl-8 text-slate-600">
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

        {/* Classes & Subjects */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="h-3 w-3 text-slate-400" />
              Class
            </Label>
            <Select
              value={filters.classIds?.length === 1 ? filters.classIds[0] : filters.classIds?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') updateFilter('classIds', undefined);
                else if (value !== 'multiple') toggleArrayFilter('classIds', value, filters.classIds);
              }}
            >
              <SelectTrigger className="w-full bg-white/60 border-slate-200/60 focus:bg-white rounded-lg h-8 text-xs shadow-sm transition-all [&>svg]:hidden px-2 justify-center">
                <SelectValue>
                  {!filters.classIds?.length ? <span className="text-slate-400 text-[11px]">All</span> :
                    filters.classIds.length === 1 ? (() => {
                      const cls = classes.find(c => c.id === filters.classIds![0]);
                      return cls ? <span className="font-semibold text-slate-700 text-[11px] truncate">{cls.code || cls.name}</span> : 'Selected';
                    })() : <span className="text-slate-600 font-semibold text-[11px]">{filters.classIds.length}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64 rounded-lg">
                <SelectItem value="all" className="rounded-lg font-medium">All Classes</SelectItem>
                <div className="h-px bg-slate-100 my-1" />
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id} className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.classIds?.includes(cls.id) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      <span className="truncate">{cls.code || cls.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
              <BookOpen className="h-3 w-3 text-slate-400" />
              Subj
            </Label>
            <Select
              value={filters.subjectIds?.length === 1 ? filters.subjectIds[0] : filters.subjectIds?.length ? 'multiple' : 'all'}
              onValueChange={(value) => {
                if (value === 'all') updateFilter('subjectIds', undefined);
                else if (value !== 'multiple') toggleArrayFilter('subjectIds', value, filters.subjectIds);
              }}
            >
              <SelectTrigger className="w-full bg-white/60 border-slate-200/60 focus:bg-white rounded-lg h-8 text-xs shadow-sm transition-all [&>svg]:hidden px-2 justify-center">
                <SelectValue>
                  {!filters.subjectIds?.length ? <span className="text-slate-400 text-[11px]">All</span> :
                    filters.subjectIds.length === 1 ? (() => {
                      const sub = subjects.find(s => s.id === filters.subjectIds![0]);
                      return sub ? <span className="font-semibold text-slate-700 text-[11px] truncate">{sub.code || sub.name}</span> : 'Selected';
                    })() : <span className="text-slate-600 font-semibold text-[11px]">{filters.subjectIds.length}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64 rounded-lg">
                <SelectItem value="all" className="rounded-lg font-medium">All Subjects</SelectItem>
                <div className="h-px bg-slate-100 my-1" />
                {subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id} className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        {filters.subjectIds?.includes(sub.id) && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                      <span className="truncate">{sub.code || sub.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

        {/* Special Filters */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">Special</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2 group cursor-pointer" onClick={() => updateFilter('isExamEvent', filters.isExamEvent ? undefined : true)}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.isExamEvent ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                {filters.isExamEvent && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
              </div>
              <Label className="text-[10px] font-medium text-slate-600 group-hover:text-slate-900 cursor-pointer flex items-center gap-1.5 uppercase tracking-wider">
                <GraduationCap className="h-3 w-3 text-indigo-500" />
                EXAMS
              </Label>
            </div>

            <div className="flex items-center space-x-2 group cursor-pointer" onClick={() => {
              const currentTypes = filters.types || [];
              const includesHoliday = currentTypes.includes('Holiday');
              if (includesHoliday) {
                const newTypes = currentTypes.filter(type => type !== 'Holiday');
                updateFilter('types', newTypes.length > 0 ? newTypes : undefined);
              } else {
                updateFilter('types', [...currentTypes, 'Holiday']);
              }
            }}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filters.types?.includes('Holiday') || !filters.types?.length ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300 group-hover:border-amber-400'}`}>
                {(filters.types?.includes('Holiday') || !filters.types?.length) && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
              </div>
              <Label className="text-[10px] font-medium text-slate-600 group-hover:text-amber-700 cursor-pointer flex items-center gap-1.5 uppercase tracking-wider">
                HOLIDAYS
              </Label>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

        {/* Date Range */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">From</Label>
              <DatePicker
                date={filters.dateRange?.startDate ? new Date(filters.dateRange.startDate) : undefined}
                setDate={(d) => updateFilter('dateRange', {
                  ...filters.dateRange,
                  startDate: d ? format(d, 'yyyy-MM-dd') : '',
                  endDate: filters.dateRange?.endDate || (d ? format(d, 'yyyy-MM-dd') : '')
                })}
                placeholder="From date"
                isCompact={true}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">To</Label>
              <DatePicker
                date={filters.dateRange?.endDate ? new Date(filters.dateRange.endDate) : undefined}
                setDate={(d) => updateFilter('dateRange', {
                  startDate: filters.dateRange?.startDate || (d ? format(d, 'yyyy-MM-dd') : ''),
                  endDate: d ? format(d, 'yyyy-MM-dd') : ''
                })}
                placeholder="To date"
                isCompact={true}
              />
            </div>
          </div>
          {filters.dateRange && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter('dateRange', undefined)}
              className="w-full mt-2 h-7 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors bg-white/50 text-xs"
            >
              Clear Date Range
            </Button>
          )}
        </div>
      </CardContent>
    </Card >
  );
} 