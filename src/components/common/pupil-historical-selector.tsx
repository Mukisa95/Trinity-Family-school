import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Users, AlertCircle, Clock, Database } from 'lucide-react';
import { PupilsService } from '@/lib/services/pupils.service';
import { ClassesService } from '@/lib/services/classes.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { getTermStatus } from '@/lib/utils/academic-year-utils';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import type { Pupil, AcademicYear, Term, Class, PupilTermSnapshot } from '@/types';

interface PupilWithSnapshot extends Pupil {
  snapshotData?: PupilTermSnapshot;
  isHistorical: boolean;
  dataSource: 'live' | 'snapshot';
}

interface PupilHistoricalSelectorProps {
  onPupilsChange: (pupils: PupilWithSnapshot[]) => void;
  selectedAcademicYearId?: string;
  selectedTermId?: string;
  classFilter?: string;
  sectionFilter?: string;
  title?: string;
  description?: string;
  maxHeight?: string;
}

export function PupilHistoricalSelector({
  onPupilsChange,
  selectedAcademicYearId,
  selectedTermId,
  classFilter,
  sectionFilter,
  title = "Select Pupils with Historical Accuracy",
  description = "Automatically uses historical snapshots for past terms and live data for current/future terms",
  maxHeight = "400px"
}: PupilHistoricalSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalClassFilter, setInternalClassFilter] = useState(classFilter || '');
  const [internalSectionFilter, setInternalSectionFilter] = useState(sectionFilter || '');
  const [loading, setLoading] = useState(false);

  // Data queries
  const { data: pupils = [] } = useQuery({
    queryKey: ['pupils'],
    queryFn: () => PupilsService.getAllPupils()
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassesService.getAll()
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => AcademicYearsService.getAllAcademicYears()
  });

  // Get current academic year and term info
  const selectedAcademicYear = academicYears.find(year => year.id === selectedAcademicYearId);
  const selectedTerm = selectedAcademicYear?.terms.find(term => term.id === selectedTermId);
  const termStatus = selectedTerm ? getTermStatus(selectedTerm) : null;

  // Enhanced pupils with snapshot data
  const [enhancedPupils, setEnhancedPupils] = useState<PupilWithSnapshot[]>([]);

  // Load pupils with historical snapshots when selection changes
  useEffect(() => {
    const loadPupilsWithSnapshots = async () => {
      if (!pupils.length || !selectedAcademicYear || !selectedTerm) {
        setEnhancedPupils([]);
        return;
      }

      setLoading(true);
      try {
        const pupilsWithSnapshots: PupilWithSnapshot[] = [];

        for (const pupil of pupils) {
          // Get snapshot for this pupil and term
          const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
            pupil,
            selectedTerm.id,
            selectedAcademicYear
          );

          // Create virtual pupil with historical data
          const historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);

          const enhancedPupil: PupilWithSnapshot = {
            ...historicalPupil,
            snapshotData: snapshot,
            isHistorical: termStatus === 'past',
            dataSource: snapshot.id.startsWith('virtual-') ? 'live' : 'snapshot'
          };

          pupilsWithSnapshots.push(enhancedPupil);
        }

        setEnhancedPupils(pupilsWithSnapshots);
      } catch (error) {
        console.error('Error loading pupils with snapshots:', error);
        setEnhancedPupils([]);
      } finally {
        setLoading(false);
      }
    };

    loadPupilsWithSnapshots();
  }, [pupils, selectedAcademicYear, selectedTerm, termStatus]);

  // Filter enhanced pupils
  const filteredPupils = useMemo(() => {
    return enhancedPupils.filter(pupil => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const fullName = formatPupilDisplayName(pupil).toLowerCase();
        const admissionNumber = pupil.admissionNumber.toLowerCase();
        if (!fullName.includes(searchLower) && !admissionNumber.includes(searchLower)) {
          return false;
        }
      }

      // Class filter
      if (internalClassFilter && pupil.classId !== internalClassFilter) {
        return false;
      }

      // Section filter
      if (internalSectionFilter && pupil.section !== internalSectionFilter) {
        return false;
      }

      return true;
    });
  }, [enhancedPupils, searchTerm, internalClassFilter, internalSectionFilter]);

  // Update parent component when filtered pupils change
  useEffect(() => {
    onPupilsChange(filteredPupils);
  }, [filteredPupils, onPupilsChange]);

  const getDataSourceIcon = (pupil: PupilWithSnapshot) => {
    if (pupil.dataSource === 'snapshot') {
      return <Camera className="h-4 w-4 text-blue-600" />;
    }
    return <Database className="h-4 w-4 text-green-600" />;
  };

  const getDataSourceBadge = (pupil: PupilWithSnapshot) => {
    if (pupil.dataSource === 'snapshot') {
      return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Historical</Badge>;
    }
    return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Live</Badge>;
  };

  if (!selectedAcademicYear || !selectedTerm) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-gray-500">
            <AlertCircle className="h-4 w-4" />
            <span>Please select an academic year and term first</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
          {termStatus && (
            <Badge variant={termStatus === 'past' ? 'default' : termStatus === 'current' ? 'secondary' : 'outline'}>
              {termStatus} term
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {description}
          {termStatus === 'past' && (
            <div className="flex items-center gap-1 mt-1 text-blue-600">
              <Camera className="h-3 w-3" />
              <span className="text-xs">Using historical snapshots for accurate data</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Search by name or admission number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <Select value={internalClassFilter || "all_filter"} onValueChange={(value) => setInternalClassFilter(value === "all_filter" ? '' : value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_filter">All Classes</SelectItem>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} ({cls.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={internalSectionFilter || "all_filter"} onValueChange={(value) => setInternalSectionFilter(value === "all_filter" ? '' : value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_filter">All Sections</SelectItem>
              <SelectItem value="Day">Day</SelectItem>
              <SelectItem value="Boarding">Boarding</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{filteredPupils.length} pupils</span>
          </div>
          {termStatus === 'past' && (
            <div className="flex items-center gap-1">
              <Camera className="h-4 w-4" />
              <span>{filteredPupils.filter(p => p.dataSource === 'snapshot').length} from snapshots</span>
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 animate-spin" />
              <span>Loading historical data...</span>
            </div>
          )}
        </div>

        {/* Pupils List */}
        <div 
          className="border rounded-lg overflow-y-auto"
          style={{ maxHeight }}
        >
          {filteredPupils.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {loading ? 'Loading pupils...' : 'No pupils found matching the filters'}
            </div>
          ) : (
            <div className="space-y-0">
              {filteredPupils.map((pupil) => {
                const pupilClass = classes.find(c => c.id === pupil.classId);
                
                return (
                  <div key={pupil.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                    <div className="flex items-center gap-3">
                      {getDataSourceIcon(pupil)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatPupilDisplayName(pupil)}</span>
                          {getDataSourceBadge(pupil)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {pupil.admissionNumber} • {pupilClass?.name || 'Unknown Class'} • {pupil.section}
                        </div>
                        {pupil.isHistorical && pupil.snapshotData && (
                          <div className="text-xs text-blue-600">
                            Snapshot from {new Date(pupil.snapshotData.snapshotDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear Filters */}
        {(searchTerm || internalClassFilter || internalSectionFilter) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setInternalClassFilter('');
              setInternalSectionFilter('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
} 