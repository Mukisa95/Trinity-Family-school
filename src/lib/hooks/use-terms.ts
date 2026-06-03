import { useMemo } from 'react';
import { useAcademicYears } from './use-academic-years';
import { useActiveAcademicYear } from './use-academic-years';
import type { Term } from '@/types';

interface TermWithYear extends Term {
  academicYearId: string;
  academicYearName: string;
}

export function useTerms() {
  const { data: academicYears = [] } = useAcademicYears();
  
  const terms = useMemo(() => {
    const allTerms: TermWithYear[] = [];
    academicYears.forEach(year => {
      if (year.terms) {
        year.terms.forEach(term => {
          allTerms.push({
            ...term,
            academicYearId: year.id,
            academicYearName: year.name
          });
        });
      }
    });
    return allTerms;
  }, [academicYears]);

  return {
    data: terms,
    isLoading: false,
    error: null
  };
}

export function useTermsByAcademicYear(academicYearId: string) {
  const { data: terms = [] } = useTerms();
  
  const filteredTerms = useMemo(() => {
    return terms.filter(term => term.academicYearId === academicYearId);
  }, [terms, academicYearId]);

  return {
    data: filteredTerms,
    isLoading: false,
    error: null
  };
}
