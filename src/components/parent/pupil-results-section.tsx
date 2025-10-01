"use client";

import { useState, useMemo, useEffect } from 'react';
import { Trophy, Calendar, TrendingUp, Award, GraduationCap, BookOpen, BarChart3, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useReleasedExamResultsForPupil } from '@/lib/hooks/use-results-release';
import { useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { usePupil } from '@/lib/hooks/use-pupils';
import { formatDateForDisplay } from '@/lib/utils/date-utils';

interface PupilResultsSectionProps {
  pupilId: string;
  pupilName: string;
  className?: string;
}

interface GroupedResults {
  [year: string]: {
    [term: string]: any[];
  };
}

interface ResultsAnalytics {
  totalExams: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  improvementTrend: 'improving' | 'declining' | 'stable';
  strongSubjects: string[];
  needsImprovement: string[];
}

export function PupilResultsSection({ pupilId, pupilName, className = '' }: PupilResultsSectionProps) {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  const { data: results = [], isLoading, error } = useReleasedExamResultsForPupil(pupilId);
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: subjects = [] } = useSubjects();
  const { data: pupil } = usePupil(pupilId);
  const isMobile = useIsMobile();

  // Utility function to get subject code for mobile display
  const getSubjectDisplayName = (subjectName: string) => {
    if (!isMobile) return subjectName;
    
    // Try to find the subject in the subjects list to get its code
    const subject = subjects.find(s => 
      s.name.toLowerCase() === subjectName.toLowerCase() ||
      s.name.toLowerCase().includes(subjectName.toLowerCase()) ||
      subjectName.toLowerCase().includes(s.name.toLowerCase())
    );
    
    if (subject && subject.code) {
      return subject.code;
    }
    
    // Fallback: create abbreviation from subject name
    const commonSubjects: {[key: string]: string} = {
      'MATHEMATICS': 'MATH',
      'MATHS': 'MATH',
      'ENGLISH': 'ENG',
      'ENGLISH LANGUAGE': 'ENG',
      'SCIENCE': 'SCI',
      'GENERAL SCIENCE': 'SCI',
      'SOCIAL STUDIES': 'SST',
      'SOCIAL STUDY': 'SST',
      'RELIGIOUS EDUCATION': 'RE',
      'CHRISTIAN RELIGIOUS EDUCATION': 'CRE',
      'PHYSICAL EDUCATION': 'PE',
      'COMPUTER STUDIES': 'CS',
      'INFORMATION TECHNOLOGY': 'IT',
      'BIOLOGY': 'BIO',
      'CHEMISTRY': 'CHEM',
      'PHYSICS': 'PHY',
      'HISTORY': 'HIST',
      'GEOGRAPHY': 'GEO',
      'AGRICULTURE': 'AGRIC',
      'BUSINESS STUDIES': 'BS',
      'KISWAHILI': 'KIS',
      'SWAHILI': 'SWA',
      'FRENCH': 'FRE',
    };

    const normalizedName = subjectName.toUpperCase();
    
    // Check for exact matches first
    for (const [subject, abbr] of Object.entries(commonSubjects)) {
      if (normalizedName === subject || normalizedName.includes(subject)) {
        return abbr;
      }
    }

    // Create abbreviation from first letters
    const words = subjectName.split(' ');
    if (words.length === 1) {
      return words[0].substring(0, Math.min(4, words[0].length)).toUpperCase();
    } else {
      return words.slice(0, 3).map(word => word.charAt(0)).join('').toUpperCase();
    }
  };

  // Group results by academic year and term
  const groupedResults = useMemo(() => {
    const grouped: GroupedResults = {};
    
    results.forEach(result => {
      const year = result.academicYear || 'Unknown Year';
      const term = result.term || 'Unknown Term';
      
      if (!grouped[year]) {
        grouped[year] = {};
      }
      if (!grouped[year][term]) {
        grouped[year][term] = [];
      }
      
      grouped[year][term].push(result);
    });
    
    return grouped;
  }, [results]);

  // Get available years and terms (only those with results)
  const availableYears = useMemo(() => {
    const years = Object.keys(groupedResults).sort((a, b) => b.localeCompare(a));
    return ['all', ...years];
  }, [groupedResults]);

  const availableTerms = useMemo(() => {
    if (selectedYear === 'all' || !selectedYear) {
      const allTerms = new Set<string>();
      Object.values(groupedResults).forEach(yearData => {
        Object.keys(yearData).forEach(term => allTerms.add(term));
      });
      return ['all', ...Array.from(allTerms).sort()];
    }
    
    if (!groupedResults[selectedYear]) return ['all'];
    return ['all', ...Object.keys(groupedResults[selectedYear]).sort()];
  }, [groupedResults, selectedYear]);

  // Set default year and term when data loads
  useEffect(() => {
    if (results.length > 0 && !selectedYear && !selectedTerm) {
      // Try to set current academic year and term 1 as default
      if (activeAcademicYear && availableYears.includes(activeAcademicYear.id)) {
        setSelectedYear(activeAcademicYear.id);
        // Check if Term 1 exists for this year
        if (groupedResults[activeAcademicYear.id] && groupedResults[activeAcademicYear.id]['Term 1']) {
          setSelectedTerm('Term 1');
        } else {
          // Default to the first available term
          const firstTerm = Object.keys(groupedResults[activeAcademicYear.id] || {})[0];
          setSelectedTerm(firstTerm || 'all');
        }
      } else {
        // Fallback to most recent year and first term
        const mostRecentYear = availableYears.find(year => year !== 'all');
        if (mostRecentYear) {
          setSelectedYear(mostRecentYear);
          const firstTerm = Object.keys(groupedResults[mostRecentYear] || {})[0];
          setSelectedTerm(firstTerm || 'all');
        }
      }
    }
  }, [results, activeAcademicYear, availableYears, groupedResults, selectedYear, selectedTerm]);

  // Filter results based on selected year and term
  const filteredResults = useMemo(() => {
    if ((selectedYear === 'all' || !selectedYear) && (selectedTerm === 'all' || !selectedTerm)) {
      return results;
    }
    
    return results.filter(result => {
      const yearMatch = selectedYear === 'all' || !selectedYear || result.academicYear === selectedYear;
      const termMatch = selectedTerm === 'all' || !selectedTerm || result.term === selectedTerm;
      return yearMatch && termMatch;
    });
  }, [results, selectedYear, selectedTerm]);

  // Calculate analytics
  const analytics = useMemo(() => {
    if (filteredResults.length === 0) {
      return {
        totalExams: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        improvementTrend: 'stable' as const,
        strongSubjects: [],
        needsImprovement: []
      };
    }

    const scores = filteredResults.map(r => r.totalScore || 0);
    const totalExams = filteredResults.length;
    const averageScore = scores.reduce((a, b) => a + b, 0) / totalExams;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    // Group by subject for subject analysis
    const subjectScores: { [subject: string]: number[] } = {};
    filteredResults.forEach(result => {
      result.subjectResults?.forEach((subjectResult: any) => {
        const subject = subjectResult.subject;
        if (!subjectScores[subject]) {
          subjectScores[subject] = [];
        }
        const percentage = (subjectResult.score / subjectResult.totalMarks) * 100;
        subjectScores[subject].push(percentage);
      });
    });

    // Calculate subject averages
    const subjectAverages = Object.entries(subjectScores).map(([subject, scores]) => ({
      subject,
      average: scores.reduce((a, b) => a + b, 0) / scores.length
    }));

    const strongSubjects = subjectAverages
      .filter(s => s.average >= 75)
      .sort((a, b) => b.average - a.average)
      .slice(0, 3)
      .map(s => s.subject);

    const needsImprovement = subjectAverages
      .filter(s => s.average < 60)
      .sort((a, b) => a.average - b.average)
      .slice(0, 3)
      .map(s => s.subject);

    return {
      totalExams,
      averageScore,
      highestScore,
      lowestScore,
      improvementTrend: 'stable' as const,
      strongSubjects,
      needsImprovement
    };
  }, [filteredResults]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 70) return 'secondary';
    if (score >= 60) return 'outline';
    return 'destructive';
  };

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <Trophy className="h-4 w-4" />
        <AlertDescription>
          Failed to load exam results. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Trophy className="h-4 w-4 animate-pulse" />
          <span>Loading exam results...</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Released Results</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          {pupilName}'s exam results will appear here once they are released by the administration.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Avatar */}
      <div className="flex items-center justify-between gap-2 text-sm min-h-[28px] overflow-hidden">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-10 w-10">
            {pupil?.photo && pupil.photo.trim() !== '' ? (
              <AvatarImage 
                src={pupil.photo} 
                alt={`${pupil.firstName} ${pupil.lastName}`}
                onError={(e) => {
                  console.log('Avatar image failed to load:', pupil.photo);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
              {pupil?.firstName?.charAt(0)}{pupil?.lastName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
            <span className="hidden sm:inline">Exam Results Performance for </span>
            <span className="sm:hidden">Results for </span>
            {pupilName}
          </h2>
        </div>
        
        {/* Compact Inline Filters and Count */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="hidden sm:inline text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {filteredResults.length} exam{filteredResults.length !== 1 ? 's' : ''}
          </span>
          <span className="sm:hidden text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {filteredResults.length}
          </span>
          
          <Select value={selectedYear || 'all'} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-20 sm:w-24 h-6 sm:h-7 text-xs border-gray-300 [&>svg]:hidden">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={`year-${year}`} value={year} className="text-xs">
                  {year === 'all' ? 'All' : year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedTerm || 'all'} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-20 sm:w-24 h-6 sm:h-7 text-xs border-gray-300 [&>svg]:hidden">
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              {availableTerms.map(term => (
                <SelectItem key={`term-${term}`} value={term} className="text-xs">
                  {term === 'all' ? 'All' : term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Hide view toggle on mobile screens */}
          {!isMobile && (
            <div className="flex border border-gray-300 rounded overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="px-1.5 py-0.5 h-6 text-xs rounded-none"
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="px-1.5 py-0.5 h-6 text-xs rounded-none"
              >
                List
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Summary - Hidden */}
      {/* Compact Analytics Summary cards are hidden per user request */}

      {/* Compact Subject Performance Insights - Side by Side Layout */}
      {(analytics.strongSubjects.length > 0 || analytics.needsImprovement.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {/* Strong Subjects Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-green-700 text-sm">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Strong Subjects</span>
                <span className="sm:hidden">Strong</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {analytics.strongSubjects.length > 0 ? (
                  analytics.strongSubjects.map((subject) => (
                    <Badge key={subject} variant="secondary" className="text-xs px-2 py-0.5">
                      {getSubjectDisplayName(subject)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 italic">None yet</span>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Needs Improvement Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-orange-700 text-sm">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Needs Improvement</span>
                <span className="sm:hidden">Improve</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {analytics.needsImprovement.length > 0 ? (
                  analytics.needsImprovement.map((subject) => (
                    <Badge key={subject} variant="outline" className="text-xs px-2 py-0.5">
                      {getSubjectDisplayName(subject)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 italic">All good!</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compact Results Display */}
      {filteredResults.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">No Results Found</h3>
            <p className="text-gray-500 text-sm">
              No exam results found for the selected filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'
            : 'space-y-3'
        }>
          {filteredResults.map((result: any) => (
            <Card key={result.id} className="hover:shadow-md transition-shadow border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">{result.examName}</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {result.className} • {formatDateForDisplay(result.examDate)}
                    </p>
                  </div>
                  <Badge variant={getScoreBadgeVariant(result.totalScore || 0) as any} className="text-xs px-2 py-0.5 ml-2">
                    {result.totalScore || 0}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {/* Compact Score Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Score</span>
                      <span className={getScoreColor(result.totalScore || 0)}>
                        {result.totalScore || 0}%
                      </span>
                    </div>
                    <Progress 
                      value={result.totalScore || 0} 
                      className="h-1.5"
                    />
                  </div>

                  {/* Compact Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Grade:</span>
                      <span className="ml-1 font-medium">{result.grade}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Div:</span>
                      <span className="ml-1 font-medium">{result.division}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Marks:</span>
                      <span className="ml-1 font-medium">{result.totalMarks}/{result.maxPossibleMarks}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Agg:</span>
                      <span className="ml-1 font-medium">{result.totalAggregates}</span>
                    </div>
                  </div>

                  {/* Compact Expandable Subject Details */}
                  {result.subjectResults && result.subjectResults.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedExam(
                          expandedExam === result.id ? null : result.id
                        )}
                        className="w-full justify-between p-1 h-6 text-xs"
                      >
                        <span>Subjects ({result.subjectResults.length})</span>
                        {expandedExam === result.id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                      
                      {expandedExam === result.id && (
                        <div className="mt-1 space-y-1 border-t pt-1">
                          {result.subjectResults.map((subjectResult: any, index: number) => (
                            <div key={`${result.id}-subject-${index}`} className="flex justify-between items-center text-xs">
                              <span className="text-gray-600 font-medium truncate flex-1 mr-2">
                                {subjectResult.subjectCode}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="font-medium">
                                  {subjectResult.score}/{subjectResult.totalMarks}
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs px-1 py-0"
                                >
                                  {subjectResult.grade}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 