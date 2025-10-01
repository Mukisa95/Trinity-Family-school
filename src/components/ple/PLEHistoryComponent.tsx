"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Calendar, Users, Trophy, TrendingUp, Eye, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useClassPLEHistory } from '@/lib/hooks/use-ple-results';

interface PLEHistoryComponentProps {
  classId: string;
  className?: string;
}

const getDivisionColor = (division: string) => {
  switch (division) {
    case 'I': return 'bg-green-100 text-green-800';
    case 'II': return 'bg-blue-100 text-blue-800';
    case 'III': return 'bg-yellow-100 text-yellow-800';
    case 'IV': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function PLEHistoryComponent({ classId, className = '' }: PLEHistoryComponentProps) {
  const router = useRouter();
  const { data: pleHistory = [], isLoading } = useClassPLEHistory(classId);
  
  const [selectedYear, setSelectedYear] = React.useState<string>('');

  // Set default to most recent year when data loads
  React.useEffect(() => {
    if (pleHistory.length > 0 && !selectedYear) {
      setSelectedYear(pleHistory[0].pleRecord.year.toString());
    }
  }, [pleHistory, selectedYear]);

  const selectedRecord = React.useMemo(() => {
    if (!selectedYear) return null;
    return pleHistory.find(record => record.pleRecord.year.toString() === selectedYear);
  }, [pleHistory, selectedYear]);

  const handleViewResults = () => {
    if (selectedRecord) {
      router.push(`/exams/ple-results/${selectedRecord.pleRecord.id}/view-results`);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            PLE Results History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading PLE history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pleHistory.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            PLE Results History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              No PLE history found for this class.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            PLE Results History
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {pleHistory.length} year{pleHistory.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Year Selection */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Select Year:</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {pleHistory.map(record => (
                <SelectItem key={record.pleRecord.year} value={record.pleRecord.year.toString()}>
                  {record.pleRecord.year}
                  {record === pleHistory[0] && ' (Latest)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Year Results */}
        {selectedRecord && (
          <div className="space-y-4">
            {/* Summary Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Candidates
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {selectedRecord.classStatistics.totalCandidates}
                </p>
              </div>
              
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Div I
                  </span>
                </div>
                <p className="text-lg font-bold text-green-600">
                  {selectedRecord.classStatistics.divisionI}
                </p>
              </div>
              
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg Agg
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {selectedRecord.classStatistics.averageAggregate}
                </p>
              </div>
              
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <GraduationCap className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pass Rate
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {selectedRecord.classStatistics.totalCandidates > 0 
                    ? Math.round(((selectedRecord.classStatistics.divisionI + selectedRecord.classStatistics.divisionII + selectedRecord.classStatistics.divisionIII + selectedRecord.classStatistics.divisionIV) / selectedRecord.classStatistics.totalCandidates) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            {/* Division Breakdown */}
            <div>
              <h4 className="text-sm font-medium mb-3">Division Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <span className="text-xs font-medium">Division I</span>
                  <Badge className={getDivisionColor('I')}>
                    {selectedRecord.classStatistics.divisionI}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <span className="text-xs font-medium">Division II</span>
                  <Badge className={getDivisionColor('II')}>
                    {selectedRecord.classStatistics.divisionII}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <span className="text-xs font-medium">Division III</span>
                  <Badge className={getDivisionColor('III')}>
                    {selectedRecord.classStatistics.divisionIII}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <span className="text-xs font-medium">Division IV</span>
                  <Badge className={getDivisionColor('IV')}>
                    {selectedRecord.classStatistics.divisionIV}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <Button 
                onClick={handleViewResults}
                variant="outline" 
                size="sm" 
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Detailed Results for {selectedRecord.pleRecord.year}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 