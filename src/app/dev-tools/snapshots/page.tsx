'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Camera, RefreshCw, Database } from 'lucide-react';

// Services
import { PupilsService } from '@/lib/services/pupils.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';

// Debug component
import DebugSnapshotSystem from './debug-snapshot-system';

interface SnapshotCoverage {
  totalExpectedSnapshots: number;
  existingSnapshots: number;
  missingSnapshots: number;
  missingSnapshotDetails: Array<{
    pupilId: string;
    pupilName: string;
    termId: string;
    termName: string;
    academicYear: string;
  }>;
}

interface BulkCreateResult {
  created: number;
  skipped: number;
  errors: Array<{pupilId: string; termId: string; error: string}>;
}

interface CleanupResult {
  deleted: number;
  errors: Array<{snapshotId: string; termId: string; error: string}>;
}

interface SnapshotStats {
  pastTermsSnapshots: number;
  currentTermsSnapshots: number;
  futureTermsSnapshots: number;
  totalSnapshots: number;
}

export default function SnapshotsDevPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [coverage, setCoverage] = useState<SnapshotCoverage | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkCreateResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [snapshotStats, setSnapshotStats] = useState<SnapshotStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [forceCreateResult, setForceCreateResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isForceCreating, setIsForceCreating] = useState(false);

  // Fetch pupils and academic years
  const { data: pupils = [], isLoading: isLoadingPupils } = useQuery({
    queryKey: ['pupils'],
    queryFn: () => PupilsService.getAllPupils(),
  });

  const { data: academicYears = [], isLoading: isLoadingAcademicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => AcademicYearsService.getAllAcademicYears(),
  });

  const handleCheckCoverage = async () => {
    if (!pupils.length || !academicYears.length) return;
    
    setIsChecking(true);
    try {
      const result = await PupilSnapshotsService.checkSnapshotCoverage(pupils, academicYears);
      setCoverage(result);
    } catch (error) {
      console.error('Error checking coverage:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCreateMissingSnapshots = async () => {
    if (!pupils.length || !academicYears.length) return;
    
    setIsCreating(true);
    setProgress(0);
    setBulkResult(null);
    
    try {
      // Simulate progress updates (in real implementation, you'd need to modify the service to emit progress)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await PupilSnapshotsService.createAllMissingSnapshots(pupils, academicYears);
      setBulkResult(result);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // Refresh coverage and stats after creation
      setTimeout(() => {
        handleCheckCoverage();
        handleAnalyzeSnapshots();
      }, 1000);
      
    } catch (error) {
      console.error('Error creating snapshots:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCleanupSnapshots = async () => {
    if (!academicYears.length) return;
    
    setIsCleaning(true);
    setCleanupResult(null);
    
    try {
      const result = await PupilSnapshotsService.deleteSnapshotsForCurrentAndUpcomingTerms(academicYears);
      setCleanupResult(result);
      
      // Refresh coverage and stats after cleanup
      setTimeout(() => {
        handleCheckCoverage();
        handleAnalyzeSnapshots();
      }, 1000);
      
    } catch (error) {
      console.error('Error cleaning up snapshots:', error);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleAnalyzeSnapshots = async () => {
    if (!academicYears.length) return;
    
    setIsAnalyzing(true);
    try {
      const stats = await PupilSnapshotsService.getSnapshotStatsByTermStatus(academicYears);
      setSnapshotStats(stats);
    } catch (error) {
      console.error('Error analyzing snapshots:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleValidateSnapshots = async () => {
    if (!pupils.length || !academicYears.length) return;
    
    setIsValidating(true);
    setValidationResult(null);
    
    try {
      const result = await PupilSnapshotsService.validateSnapshotCompleteness(pupils, academicYears);
      setValidationResult(result);
    } catch (error) {
      console.error('Error validating snapshots:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleForceCreateMissing = async () => {
    if (!pupils.length || !academicYears.length) return;
    
    setIsForceCreating(true);
    setForceCreateResult(null);
    
    try {
      const result = await PupilSnapshotsService.forceCreateAllMissingEndedTermSnapshots(pupils, academicYears);
      setForceCreateResult(result);
      
      // Refresh all data after force creation
      setTimeout(() => {
        handleCheckCoverage();
        handleAnalyzeSnapshots();
        handleValidateSnapshots();
      }, 1000);
      
    } catch (error) {
      console.error('Error force creating snapshots:', error);
    } finally {
      setIsForceCreating(false);
    }
  };

  const coveragePercentage = coverage 
    ? coverage.totalExpectedSnapshots > 0 
      ? Math.round((coverage.existingSnapshots / coverage.totalExpectedSnapshots) * 100)
      : 100
    : 0;

  if (isLoadingPupils || isLoadingAcademicYears) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Camera className="w-8 h-8" />
          Pupil Snapshots Developer Tools
        </h1>
        <p className="text-gray-600 mt-2">
          Manage historical pupil snapshots for accurate fee calculations across terms.
        </p>
      </div>

      {/* Debug Component */}
      <DebugSnapshotSystem />

      {/* System Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{pupils.length}</div>
            <div className="text-sm text-gray-600">Total Pupils</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{academicYears.length}</div>
            <div className="text-sm text-gray-600">Academic Years</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {academicYears.reduce((total, year) => total + year.terms.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Terms</div>
          </div>
        </CardContent>
      </Card>

      {/* Snapshot Analysis */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Snapshot Analysis by Term Status
          </CardTitle>
          <CardDescription>
            Analyze current snapshot distribution. Snapshots should only exist for ENDED terms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button 
              onClick={handleAnalyzeSnapshots} 
              disabled={isAnalyzing}
              className="flex items-center gap-2"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Analyze Snapshots'}
            </Button>
          </div>

          {snapshotStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{snapshotStats.pastTermsSnapshots}</div>
                  <div className="text-sm text-green-800">Past Terms (✓ Correct)</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{snapshotStats.currentTermsSnapshots}</div>
                  <div className="text-sm text-red-800">Current Terms (❌ Wrong)</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{snapshotStats.futureTermsSnapshots}</div>
                  <div className="text-sm text-red-800">Future Terms (❌ Wrong)</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{snapshotStats.totalSnapshots}</div>
                  <div className="text-sm text-blue-800">Total Snapshots</div>
                </div>
              </div>

              {(snapshotStats.currentTermsSnapshots > 0 || snapshotStats.futureTermsSnapshots > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-red-800">Incorrect Snapshots Detected!</span>
                  </div>
                  <p className="text-sm text-red-800">
                    Found {snapshotStats.currentTermsSnapshots + snapshotStats.futureTermsSnapshots} snapshots for current/future terms.
                    These should be deleted as they violate the snapshot system rules.
                  </p>
                </div>
              )}

              {snapshotStats.currentTermsSnapshots === 0 && snapshotStats.futureTermsSnapshots === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Snapshot System is Clean!</span>
                  </div>
                  <p className="text-sm text-green-800 mt-1">
                    No snapshots found for current/future terms. The system is working correctly.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Delete Incorrect Snapshots
          </CardTitle>
          <CardDescription>
            Remove snapshots for current and upcoming terms. These snapshots are incorrect and cause stale data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {snapshotStats && (snapshotStats.currentTermsSnapshots > 0 || snapshotStats.futureTermsSnapshots > 0) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">Action Required</span>
                </div>
                <p className="text-sm text-red-800">
                  {snapshotStats.currentTermsSnapshots + snapshotStats.futureTermsSnapshots} incorrect snapshots need to be deleted.
                  This will fix the stale data issue you're experiencing.
                </p>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button 
                onClick={handleCleanupSnapshots} 
                                 disabled={isCleaning || !snapshotStats || (snapshotStats && snapshotStats.currentTermsSnapshots === 0 && snapshotStats.futureTermsSnapshots === 0)}
                variant="destructive"
                className="flex items-center gap-2"
              >
                {isCleaning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {isCleaning ? 'Deleting...' : 'Delete Incorrect Snapshots'}
              </Button>
            </div>

            {cleanupResult && (
              <div className="space-y-3 mt-4">
                <h4 className="font-medium">Cleanup Results:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-lg font-bold text-green-600">{cleanupResult.deleted}</div>
                    <div className="text-sm text-green-800">Snapshots Deleted</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-lg font-bold text-red-600">{cleanupResult.errors.length}</div>
                    <div className="text-sm text-red-800">Errors</div>
                  </div>
                </div>

                {cleanupResult.errors.length > 0 && (
                  <div className="mt-3">
                    <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto bg-red-50 p-3 rounded text-sm">
                      {cleanupResult.errors.map((error, index) => (
                        <div key={index} className="text-red-800">
                          Snapshot {error.snapshotId}, Term {error.termId}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cleanupResult.deleted > 0 && cleanupResult.errors.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-800">Cleanup Successful!</span>
                    </div>
                    <p className="text-sm text-green-800 mt-1">
                      All incorrect snapshots have been deleted. The stale data issue should now be resolved.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* NEW: Critical Validation & Force Creation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <CheckCircle className="w-5 h-5" />
              Validate Snapshot Completeness
            </CardTitle>
            <CardDescription>
              Check if ALL pupils have snapshots for ALL ended terms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleValidateSnapshots}
              disabled={isValidating}
              className="w-full mb-4"
            >
              {isValidating ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              {isValidating ? 'Validating...' : 'Validate All Snapshots'}
            </Button>
            
            {validationResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-lg font-bold text-blue-600">
                      {validationResult.totalExistingSnapshots} / {validationResult.totalExpectedSnapshots}
                    </div>
                    <div className="text-sm text-blue-700">Existing / Expected</div>
                  </div>
                                     <div className={`p-3 rounded ${
                     validationResult?.validationPassed ? 'bg-green-50' : 'bg-red-50'
                   }`}>
                     <div className={`text-lg font-bold ${
                       validationResult?.validationPassed ? 'text-green-600' : 'text-red-600'
                     }`}>
                       {validationResult?.validationPassed ? '✅ PASS' : '❌ FAIL'}
                     </div>
                     <div className={`text-sm ${
                       validationResult?.validationPassed ? 'text-green-700' : 'text-red-700'
                     }`}>
                       {validationResult?.missingSnapshots || 0} missing
                     </div>
                   </div>
                </div>
                
                {!validationResult.validationPassed && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-red-800">Missing Snapshots!</span>
                    </div>
                    <p className="text-sm text-red-800">
                      {validationResult.missingSnapshots} snapshots are missing for ended terms.
                      Use "Force Create All Missing" to fix this.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Force Create All Missing
            </CardTitle>
            <CardDescription>
              Nuclear option: Create ALL missing snapshots for ended terms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleForceCreateMissing}
              disabled={isForceCreating}
              variant="destructive"
              className="w-full mb-4"
            >
              {isForceCreating ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <AlertCircle className="w-4 h-4 mr-2" />
              )}
              {isForceCreating ? 'Force Creating...' : 'Force Create All Missing Snapshots'}
            </Button>
            
            {forceCreateResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-lg font-bold text-green-600">
                      {forceCreateResult.snapshotsCreated}
                    </div>
                    <div className="text-sm text-green-700">Created</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded">
                    <div className="text-lg font-bold text-orange-600">
                      {forceCreateResult.errorsRecovered}
                    </div>
                    <div className="text-sm text-orange-700">Potentially Inaccurate</div>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Force Creation Complete</span>
                  </div>
                  <p className="text-sm text-green-800 mt-1">
                    Created {forceCreateResult.snapshotsCreated} snapshots for {forceCreateResult.termsProcessed} ended terms.
                    {forceCreateResult.errorsRecovered > 0 && ` ${forceCreateResult.errorsRecovered} may be inaccurate due to missing historical data.`}
                    {forceCreateResult.errors.length > 0 && ` ${forceCreateResult.errors.length} errors occurred.`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Snapshot Coverage */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Snapshot Coverage Analysis
          </CardTitle>
          <CardDescription>
            Check how many historical snapshots exist vs. how many should exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button 
              onClick={handleCheckCoverage} 
              disabled={isChecking}
              className="flex items-center gap-2"
            >
              {isChecking ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {isChecking ? 'Checking...' : 'Check Coverage'}
            </Button>
          </div>

          {coverage && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{coverage.totalExpectedSnapshots}</div>
                  <div className="text-sm text-blue-800">Expected Snapshots</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{coverage.existingSnapshots}</div>
                  <div className="text-sm text-green-800">Existing Snapshots</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{coverage.missingSnapshots}</div>
                  <div className="text-sm text-red-800">Missing Snapshots</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Coverage Progress</span>
                  <span className="text-sm text-gray-600">{coveragePercentage}%</span>
                </div>
                <Progress value={coveragePercentage} className="h-2" />
              </div>

              {coverage.missingSnapshots > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Missing Snapshots Sample (first 10):</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded">
                    {coverage.missingSnapshotDetails.slice(0, 10).map((missing, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">{missing.pupilName}</span> - {missing.termName} ({missing.academicYear})
                      </div>
                    ))}
                    {coverage.missingSnapshotDetails.length > 10 && (
                      <div className="text-sm text-gray-600 italic">
                        ... and {coverage.missingSnapshotDetails.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Create Snapshots */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Bulk Create Missing Snapshots
          </CardTitle>
          <CardDescription>
            Create all missing historical snapshots. This is safe to run multiple times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coverage && coverage.missingSnapshots > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Action Required</span>
                </div>
                <p className="text-sm text-yellow-800">
                  {coverage.missingSnapshots} snapshots are missing. Creating them will ensure accurate historical fee calculations.
                </p>
              </div>
            )}

            {coverage && coverage.missingSnapshots === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">All snapshots exist!</span>
                </div>
                <p className="text-sm text-green-800 mt-1">
                  No missing snapshots found. Your historical data is complete.
                </p>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button 
                onClick={handleCreateMissingSnapshots} 
                disabled={isCreating || (coverage && coverage.missingSnapshots === 0)}
                className="flex items-center gap-2"
                variant={coverage && coverage.missingSnapshots > 0 ? "default" : "outline"}
              >
                {isCreating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                {isCreating ? 'Creating...' : 'Create Missing Snapshots'}
              </Button>
            </div>

            {isCreating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Creating snapshots...</span>
                  <span className="text-sm text-gray-600">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {bulkResult && (
              <div className="space-y-3 mt-4">
                <h4 className="font-medium">Creation Results:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-lg font-bold text-green-600">{bulkResult.created}</div>
                    <div className="text-sm text-green-800">Created</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-lg font-bold text-blue-600">{bulkResult.skipped}</div>
                    <div className="text-sm text-blue-800">Skipped</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-lg font-bold text-red-600">{bulkResult.errors.length}</div>
                    <div className="text-sm text-red-800">Errors</div>
                  </div>
                </div>

                {bulkResult.errors.length > 0 && (
                  <div className="mt-3">
                    <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto bg-red-50 p-3 rounded text-sm">
                      {bulkResult.errors.map((error, index) => (
                        <div key={index} className="text-red-800">
                          Pupil {error.pupilId}, Term {error.termId}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">How to test the snapshot feature:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>First, run "Check Coverage" to see current snapshot status</li>
              <li>If missing snapshots are found, click "Create Missing Snapshots"</li>
              <li>Go to any pupil's fees page and switch between different terms/years</li>
              <li>Look for the 📸 icon next to class/section when historical data differs from current</li>
              <li>Check console logs for detailed snapshot creation and retrieval information</li>
            </ol>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">What the snapshots do:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Preserve historical class and section assignments per term</li>
              <li>Ensure fee calculations use correct historical data</li>
              <li>Prevent billing errors when pupils change classes/sections</li>
              <li>Show accurate pupil information for any historical term</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 