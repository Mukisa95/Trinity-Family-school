import type { AcademicYear, Term } from '@/types';

export function getCurrentTerm(academicYear: AcademicYear): Term | null {
  const now = new Date();
  
  for (const term of academicYear.terms) {
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);
    
    if (now >= termStart && now <= termEnd) {
      return term;
    }
  }
  
  return null;
}

export function getTermByDate(academicYear: AcademicYear, date: Date): Term | null {
  for (const term of academicYear.terms) {
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);
    
    if (date >= termStart && date <= termEnd) {
      return term;
    }
  }
  
  return null;
}

export function getTermNumber(academicYear: AcademicYear, termId: string): number {
  const termIndex = academicYear.terms.findIndex(term => term.id === termId);
  return termIndex >= 0 ? termIndex + 1 : 1;
}

export function isTermActive(term: Term): boolean {
  const now = new Date();
  const termStart = new Date(term.startDate);
  const termEnd = new Date(term.endDate);
  
  return now >= termStart && now <= termEnd;
}

/**
 * Check if a term has ended (past term)
 * Only ended terms should have snapshots
 */
export function isTermEnded(term: Term): boolean {
  const now = new Date();
  const termEnd = new Date(term.endDate);
  
  return now > termEnd;
}

/**
 * Check if a term is upcoming (future term)
 * Upcoming terms should never have snapshots
 */
export function isTermUpcoming(term: Term): boolean {
  const now = new Date();
  const termStart = new Date(term.startDate);
  
  return now < termStart;
}

/**
 * Classify a term's status relative to current date
 */
export function getTermStatus(term: Term): 'past' | 'current' | 'future' {
  const now = new Date();
  const termStart = new Date(term.startDate);
  const termEnd = new Date(term.endDate);
  
  if (now > termEnd) {
    return 'past';
  } else if (now >= termStart && now <= termEnd) {
    return 'current';
  } else {
    return 'future';
  }
}

/**
 * Get all terms that have ended and should have snapshots
 */
export function getEndedTerms(academicYears: AcademicYear[]): Array<{term: Term, academicYear: AcademicYear}> {
  const endedTerms: Array<{term: Term, academicYear: AcademicYear}> = [];
  
  for (const academicYear of academicYears) {
    for (const term of academicYear.terms) {
      if (isTermEnded(term)) {
        endedTerms.push({ term, academicYear });
      }
    }
  }
  
  return endedTerms;
}

/**
 * Get all terms that are current or upcoming and should NOT have snapshots
 */
export function getCurrentAndUpcomingTerms(academicYears: AcademicYear[]): Array<{term: Term, academicYear: AcademicYear}> {
  const currentAndUpcomingTerms: Array<{term: Term, academicYear: AcademicYear}> = [];
  
  for (const academicYear of academicYears) {
    for (const term of academicYear.terms) {
      const status = getTermStatus(term);
      if (status === 'current' || status === 'future') {
        currentAndUpcomingTerms.push({ term, academicYear });
      }
    }
  }
  
  return currentAndUpcomingTerms;
}

export function getTermLabel(academicYear: AcademicYear, termId: string): string {
  const term = academicYear.terms.find(t => t.id === termId);
  if (!term) return 'Unknown Term';
  
  const termNumber = getTermNumber(academicYear, termId);
  return `Term ${termNumber}`;
}

/**
 * Calculate next term dates based on exam's academic year and term
 * This ensures historical accuracy - if exam was done in Term 2 2025,
 * it will always show Term 3 2025 as next term, even years later
 */
export function getNextTermDates(
  examAcademicYearId: string,
  examTermId: string,
  allAcademicYears: AcademicYear[]
): { nextTermBegins: string; nextTermEnds: string } | null {
  // Find the academic year when the exam was conducted
  const examAcademicYear = allAcademicYears.find(year => year.id === examAcademicYearId);
  if (!examAcademicYear) {
    return null;
  }
  
  // Find current term index in that academic year
  const currentTermIndex = examAcademicYear.terms.findIndex(term => term.id === examTermId);
  if (currentTermIndex === -1) {
    return null;
  }
  
  // Check if there's a next term in the same academic year
  if (currentTermIndex < examAcademicYear.terms.length - 1) {
    const nextTerm = examAcademicYear.terms[currentTermIndex + 1];
    return {
      nextTermBegins: new Date(nextTerm.startDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      nextTermEnds: new Date(nextTerm.endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };
  }
  
  // If it's the last term, look for the first term of next academic year
  const nextAcademicYearNumber = parseInt(examAcademicYear.name) + 1;
  const nextAcademicYear = allAcademicYears.find(
    year => year.name === nextAcademicYearNumber.toString()
  );
  
  if (nextAcademicYear && nextAcademicYear.terms.length > 0) {
    const firstTermOfNextYear = nextAcademicYear.terms[0];
    return {
      nextTermBegins: new Date(firstTermOfNextYear.startDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      nextTermEnds: new Date(firstTermOfNextYear.endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };
  }
  
  // Fallback: return null if no next term can be determined
  return null;
}

export function groupRecordsByTerm<T extends { createdAt: string; termId?: string }>(
  records: T[], 
  academicYear: AcademicYear
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  
  // Initialize groups for each term
  academicYear.terms.forEach(term => {
    grouped[term.id] = [];
  });
  
  records.forEach(record => {
    let termId = record.termId;
    
    // If no termId is stored, determine it from the creation date
    if (!termId) {
      const recordDate = new Date(record.createdAt);
      const term = getTermByDate(academicYear, recordDate);
      termId = term?.id;
    }
    
    if (termId && grouped[termId]) {
      grouped[termId].push(record);
    } else {
      // If we can't determine the term, put it in the first term as fallback
      const firstTermId = academicYear.terms[0]?.id;
      if (firstTermId && grouped[firstTermId]) {
        grouped[firstTermId].push(record);
      }
    }
  });
  
  return grouped;
} 