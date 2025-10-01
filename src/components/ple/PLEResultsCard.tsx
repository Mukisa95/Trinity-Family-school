"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Calendar, Trophy, TrendingUp, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { PLERecord, PLEPupilResult } from '@/lib/services/ple-results.service';

interface PLEResultsCardProps {
  pleRecord: PLERecord;
  pupilResult: PLEPupilResult;
  className?: string;
}

const PLE_SUBJECTS = [
  { id: 'english', name: 'English', code: 'ENG' },
  { id: 'mathematics', name: 'Mathematics', code: 'MATH' },
  { id: 'science', name: 'Science', code: 'SCI' },
  { id: 'social_studies', name: 'Social Studies', code: 'SST' },
];

const getDivisionColor = (division: string) => {
  switch (division) {
    case 'I': return 'bg-green-100 text-green-800 border-green-200';
    case 'II': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'III': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'IV': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getAggregateColor = (aggregate: string) => {
  if (aggregate.startsWith('D')) return 'bg-green-100 text-green-800';
  if (aggregate.startsWith('C')) return 'bg-blue-100 text-blue-800';
  if (aggregate.startsWith('P')) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

export default function PLEResultsCard({ pleRecord, pupilResult, className = '' }: PLEResultsCardProps) {
  const router = useRouter();

  const handleViewDetails = () => {
    router.push(`/exams/ple-results/pupil/${pupilResult.pupilId}/${pleRecord.id}`);
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            PLE Results {pleRecord.year}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {pleRecord.year}
            </Badge>
            {pupilResult.division && (
              <Badge className={`${getDivisionColor(pupilResult.division)} font-bold`}>
                Division {pupilResult.division}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Check */}
        {pupilResult.status === 'missed' ? (
          <div className="text-center py-4">
            <Badge variant="destructive" className="text-sm px-3 py-1">
              Missed Examination
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              This pupil did not participate in the {pleRecord.year} PLE examination.
            </p>
          </div>
        ) : (
          <>
            {/* Performance Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Aggregate
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {pupilResult.totalAggregate || 'N/A'}
                </p>
              </div>
              
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Division
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {pupilResult.division || 'N/A'}
                </p>
              </div>
            </div>

            {/* Subject Performance */}
            <div>
              <h4 className="text-sm font-medium mb-3">Subject Performance</h4>
              <div className="grid grid-cols-2 gap-2">
                {PLE_SUBJECTS.map(subject => (
                  <div key={subject.id} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                    <span className="text-xs font-medium">{subject.code}</span>
                    {pupilResult.subjects[subject.id] ? (
                      <Badge 
                        variant="outline" 
                        className={`${getAggregateColor(pupilResult.subjects[subject.id])} text-xs font-mono`}
                      >
                        {pupilResult.subjects[subject.id]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        --
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <Button 
                onClick={handleViewDetails}
                variant="outline" 
                size="sm" 
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Detailed Performance
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 