'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TestTube, CheckCircle, XCircle } from 'lucide-react';

// Services
import { PupilsService } from '@/lib/services/pupils.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { getTermStatus, isTermEnded } from '@/lib/utils/academic-year-utils';
import type { Pupil, AcademicYear, PupilTermSnapshot } from '@/types';

interface TestResult {
  testName: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface SnapshotTestData {
  pupil: Pupil;
  termId: string;
  termName: string;
  termStatus: 'past' | 'current' | 'future';
  snapshotResult: PupilTermSnapshot | null;
  isVirtual: boolean;
  expectedBehavior: string;
  actualBehavior: string;
  testPass: boolean;
}

export default function DebugSnapshotSystem() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [detailedTests, setDetailedTests] = useState<SnapshotTestData[]>([]);
  const [selectedPupil, setSelectedPupil] = useState<Pupil | null>(null);

  const runComprehensiveDebug = async () => {
    setIsRunning(true);
    setTestResults([]);
    setDetailedTests([]);

    try {
      const results: TestResult[] = [];
      const detailedData: SnapshotTestData[] = [];

      // 1. Load system data
      console.log('🔍 Loading system data...');
      const pupils = await PupilsService.getAllPupils();
      const academicYears = await AcademicYearsService.getAllAcademicYears();

      results.push({
        testName: 'System Data Loading',
        status: 'pass',
        message: `Loaded ${pupils.length} pupils and ${academicYears.length} academic years`
      });

      // 2. Find current academic year
      const currentYear = academicYears.find(year => year.isActive);
      if (!currentYear) {
        results.push({
          testName: 'Current Academic Year Detection',
          status: 'fail',
          message: 'No active academic year found'
        });
        return;
      }

      results.push({
        testName: 'Current Academic Year Detection',
        status: 'pass',
        message: `Found active year: ${currentYear.name}`,
        details: {
          yearId: currentYear.id,
          yearName: currentYear.name,
          terms: currentYear.terms.map(t => ({
            id: t.id,
            name: t.name,
            startDate: t.startDate,
            endDate: t.endDate,
            status: getTermStatus(t)
          }))
        }
      });

      // 3. Analyze term statuses
      console.log('🔍 Analyzing term statuses...');
      const termAnalysis = currentYear.terms.map(term => ({
        ...term,
        status: getTermStatus(term),
        hasEnded: isTermEnded(term)
      }));

      const pastTerms = termAnalysis.filter(t => t.status === 'past');
      const currentTerms = termAnalysis.filter(t => t.status === 'current');
      const futureTerms = termAnalysis.filter(t => t.status === 'future');

      results.push({
        testName: 'Term Status Analysis',
        status: pastTerms.length > 0 ? 'pass' : 'warning',
        message: `Found ${pastTerms.length} past terms, ${currentTerms.length} current terms, ${futureTerms.length} future terms`,
        details: {
          pastTerms: pastTerms.map(t => ({ name: t.name, endDate: t.endDate })),
          currentTerms: currentTerms.map(t => ({ name: t.name, startDate: t.startDate, endDate: t.endDate })),
          futureTerms: futureTerms.map(t => ({ name: t.name, startDate: t.startDate }))
        }
      });

      // 4. Test snapshot behavior for each past term
      if (pastTerms.length > 0 && pupils.length > 0) {
        console.log('🔍 Testing snapshot behavior for past terms...');
        
        // Take first 3 pupils for testing
        const testPupils = pupils.slice(0, 3);
        
        for (const pupil of testPupils) {
          for (const term of pastTerms) {
            console.log(`🧪 Testing pupil ${pupil.firstName} ${pupil.lastName} for ${term.name}`);
            
            try {
              const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
                pupil,
                term.id,
                currentYear
              );
              
              const isVirtual = snapshot.id.startsWith('virtual-');
              const expectedBehavior = 'Should return REAL snapshot (historical data)';
              const actualBehavior = isVirtual 
                ? 'Returned VIRTUAL snapshot (live data)'
                : 'Returned REAL snapshot (historical data)';
              const testPass = !isVirtual; // For past terms, we should NOT get virtual snapshots
              
              detailedData.push({
                pupil,
                termId: term.id,
                termName: term.name,
                termStatus: term.status,
                snapshotResult: snapshot,
                isVirtual,
                expectedBehavior,
                actualBehavior,
                testPass
              });
              
            } catch (error) {
              console.error(`Error testing ${pupil.firstName} for ${term.name}:`, error);
              detailedData.push({
                pupil,
                termId: term.id,
                termName: term.name,
                termStatus: term.status,
                snapshotResult: null,
                isVirtual: false,
                expectedBehavior: 'Should return REAL snapshot',
                actualBehavior: `Error: ${error instanceof Error ? error.message : String(error)}`,
                testPass: false
              });
            }
          }
        }

        // Analyze test results
        const totalTests = detailedData.length;
        const passedTests = detailedData.filter(t => t.testPass).length;
        const failedTests = totalTests - passedTests;

        results.push({
          testName: 'Snapshot Behavior Test',
          status: failedTests === 0 ? 'pass' : 'fail',
          message: `${passedTests}/${totalTests} tests passed. ${failedTests} tests failed.`,
          details: {
            passed: passedTests,
            failed: failedTests,
            total: totalTests
          }
        });

        if (failedTests > 0) {
          results.push({
            testName: 'Root Cause Analysis',
            status: 'warning',
            message: 'Some past terms are returning virtual snapshots instead of real snapshots',
            details: {
              issue: 'Past terms should have real snapshots, but system is returning virtual (live) data',
              impact: 'Fee calculations will use current pupil data instead of historical data',
              solution: 'Check if snapshots exist in database for these terms'
            }
          });
        }
      }

      // 5. Check for incorrect snapshots
      console.log('🔍 Checking for incorrect snapshots...');
      try {
        const stats = await PupilSnapshotsService.getSnapshotStatsByTermStatus(academicYears);
        
        const hasIncorrectSnapshots = stats.currentTermsSnapshots > 0 || stats.futureTermsSnapshots > 0;
        
        results.push({
          testName: 'Incorrect Snapshots Check',
          status: hasIncorrectSnapshots ? 'fail' : 'pass',
          message: hasIncorrectSnapshots 
            ? `Found ${stats.currentTermsSnapshots + stats.futureTermsSnapshots} incorrect snapshots for current/future terms`
            : 'No incorrect snapshots found',
          details: stats
        });
      } catch (error) {
        results.push({
          testName: 'Incorrect Snapshots Check',
          status: 'fail',
          message: `Error checking snapshots: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      setTestResults(results);
      setDetailedTests(detailedData);

    } catch (error) {
      console.error('Debug test failed:', error);
      setTestResults([{
        testName: 'Debug System Test',
        status: 'fail',
        message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'fail': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-50 border-green-200';
      case 'fail': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          Debug Snapshot System
        </CardTitle>
        <CardDescription>
          Comprehensive test to identify why Term 1 fees are not using snapshots
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={runComprehensiveDebug}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <TestTube className="w-4 h-4 animate-pulse" />
                Running Debug Tests...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4" />
                Run Comprehensive Debug
              </>
            )}
          </Button>

          {testResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Test Results:</h4>
              
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.testName}</span>
                    <Badge variant={result.status === 'pass' ? 'default' : 'destructive'}>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm">{result.message}</p>
                  
                  {result.details && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-gray-600">
                        View Details
                      </summary>
                      <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-32">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {detailedTests.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Detailed Snapshot Tests:</h4>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {detailedTests.map((test, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded border text-sm ${
                      test.testPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {test.pupil.firstName} {test.pupil.lastName} - {test.termName}
                      </span>
                      <Badge variant={test.testPass ? 'default' : 'destructive'}>
                        {test.testPass ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-medium">Expected:</span>
                        <p>{test.expectedBehavior}</p>
                      </div>
                      <div>
                        <span className="font-medium">Actual:</span>
                        <p>{test.actualBehavior}</p>
                      </div>
                    </div>
                    
                    {test.snapshotResult && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-gray-600">
                          View Snapshot Data
                        </summary>
                        <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-24 text-xs">
                          {JSON.stringify({
                            id: test.snapshotResult.id,
                            classId: test.snapshotResult.classId,
                            section: test.snapshotResult.section,
                            isVirtual: test.isVirtual
                          }, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 