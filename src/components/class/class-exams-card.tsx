'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AcademicYear, Exam, Term } from '@/types';

export interface ClassExamFilters {
  academicYearId: string;
  termId: string;
}

interface ClassExamsCardProps {
  classId: string;
  exams: Exam[];
  academicYears: AcademicYear[];
  terms: (Term & { academicYearId: string })[];
  filters: ClassExamFilters;
  onFilterChange: (field: keyof ClassExamFilters, value: string) => void;
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
}

export function ClassExamsCard({
  classId, exams, academicYears, terms, filters, onFilterChange, isLoading, error, onRetry,
}: ClassExamsCardProps) {
  const id = useId();
  const visibleExams = exams.filter(exam =>
    (!filters.academicYearId || filters.academicYearId === 'all' || exam.academicYearId === filters.academicYearId)
    && (!filters.termId || filters.termId === 'all' || exam.termId === filters.termId));
  const availableTerms = terms.filter(term =>
    !filters.academicYearId || filters.academicYearId === 'all' || term.academicYearId === filters.academicYearId);
  const showTerm = !filters.termId || filters.termId === 'all';
  const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Card className="min-w-0 rounded-2xl border-primary/15 shadow-sm" role="region" aria-labelledby={id}>
      <CardHeader className="space-y-4 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-link" aria-hidden="true" />
          <h2 id={id} className="text-lg font-semibold text-foreground">Class exams</h2>
          {!isLoading && !error && (
            <span className="ml-auto text-sm text-muted-foreground" role="status">
              {visibleExams.length} {visibleExams.length === 1 ? 'exam' : 'exams'}
            </span>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={id + '-year'} className="text-sm">Academic year</Label>
            <Select value={filters.academicYearId || 'all'} onValueChange={value => onFilterChange('academicYearId', value)} disabled={academicYears.length === 0}>
              <SelectTrigger id={id + '-year'} className="min-h-11 w-full rounded-xl text-sm">
                <SelectValue placeholder="All academic years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All academic years</SelectItem>
                {academicYears.map(year => <SelectItem key={year.id} value={year.id}>{year.name}{year.isActive ? ' (Active)' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={id + '-term'} className="text-sm">Term</Label>
            <Select value={filters.termId || 'all'} onValueChange={value => onFilterChange('termId', value)} disabled={availableTerms.length === 0}>
              <SelectTrigger id={id + '-term'} className="min-h-11 w-full rounded-xl text-sm">
                <SelectValue placeholder="All terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {availableTerms.map(term => (
                  <SelectItem key={term.academicYearId + ':' + term.id} value={term.id}>
                    {term.name}{filters.academicYearId === 'all' || !filters.academicYearId
                      ? ' — ' + (academicYears.find(year => year.id === term.academicYearId)?.name || term.academicYearId) : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {isLoading ? (
          <div className="flex min-h-36 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-link" aria-hidden="true" /> Loading exams…
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
            <p className="text-sm text-foreground">Class exams could not be loaded.</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>Try again</Button>
          </div>
        ) : visibleExams.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No exams found for the selected academic year and term.
          </p>
        ) : (
          <div className="p-1 lg:max-h-[32rem] lg:overflow-y-auto">
            <div className="flex flex-col gap-2">
              {visibleExams.map(exam => {
                const year = academicYears.find(item => item.id === exam.academicYearId);
                const term = year?.terms.find(item => item.id === exam.termId)
                  || terms.find(item => item.id === exam.termId && item.academicYearId === exam.academicYearId);
                const date = exam.startDate ? new Date(exam.startDate) : null;
                const hasDate = date && !Number.isNaN(date.getTime());
                const endDate = exam.endDate ? new Date(exam.endDate) : null;
                const hasRange = hasDate && endDate && !Number.isNaN(endDate.getTime()) && endDate > date;
                const dateLabel = hasDate
                  ? hasRange
                    ? (typeof dateFormatter.formatRange === 'function' ? dateFormatter.formatRange(date, endDate)
                      : dateFormatter.format(date) + ' – ' + dateFormatter.format(endDate))
                    : dateFormatter.format(date)
                  : 'Date not set';
                return (
                  <Link key={exam.id}
                    href={'/exams/' + encodeURIComponent(exam.id) + '/view-results?classId=' + encodeURIComponent(classId || exam.classId)}
                    className="group block min-w-0 rounded-xl border border-border bg-background px-3 py-3 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <h3 className="break-words text-base font-semibold leading-6 text-foreground group-hover:text-link">{exam.name}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-muted-foreground">
                      {hasDate ? <time dateTime={date.toISOString()}>{dateLabel}</time> : dateLabel}
                      {showTerm && <><span aria-hidden="true">·</span><span>{term?.name || 'Term not set'}</span></>}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
