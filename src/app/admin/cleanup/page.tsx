'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DataMigration } from '@/lib/utils/data-migration';
import { AcademicYearsService } from '@/lib/services/academic-years.service';

export default function AdminCleanupPage() {
  const { toast } = useToast();
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [isMigrating, setIsMigrating] = React.useState(false);
  const [isDiagnosing, setIsDiagnosing] = React.useState(false);
  const [diagnosticData, setDiagnosticData] = React.useState<any[]>([]);
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const handleDiagnostic = async () => {
    setIsDiagnosing(true);
    try {
      const academicYears = await AcademicYearsService.getAllAcademicYears();
      setDiagnosticData(academicYears);
      console.log('Academic Years in Database:', academicYears);
      toast({
        title: "Diagnostic Complete",
        description: `Found ${academicYears.length} academic years in database. Check console for details.`,
      });
    } catch (error) {
      console.error('Error during diagnostic:', error);
      toast({
        title: "Diagnostic Error",
        description: "Failed to fetch academic years. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleRegenerateWithUgandaPattern = async () => {
    setIsRegenerating(true);
    try {
      // First, remove all existing academic years
      const academicYears = await AcademicYearsService.getAllAcademicYears();
      console.log(`Removing ${academicYears.length} existing academic years...`);
      
      for (const year of academicYears) {
        await AcademicYearsService.deleteAcademicYear(year.id);
      }
      
      // Then run migration with new Uganda pattern
      await DataMigration.migrateAcademicYears();
      
      toast({
        title: "Success",
        description: "Academic years regenerated with Uganda calendar pattern.",
      });
      
      // Refresh diagnostic data
      await handleDiagnostic();
    } catch (error) {
      console.error('Error regenerating academic years:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate academic years. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      await DataMigration.migrateAcademicYears();
      toast({
        title: "Migration Complete",
        description: "Academic years migration completed successfully.",
      });
      // Refresh diagnostic data
      await handleDiagnostic();
    } catch (error) {
      console.error('Error during migration:', error);
      toast({
        title: "Migration Error",
        description: "Failed to migrate academic years. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    setIsRemoving(true);
    try {
      await DataMigration.removeDuplicateAcademicYears();
      toast({
        title: "Success",
        description: "Duplicate academic years have been removed successfully.",
      });
      // Refresh diagnostic data
      await handleDiagnostic();
    } catch (error) {
      console.error('Error removing duplicates:', error);
      toast({
        title: "Error",
        description: "Failed to remove duplicate academic years. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Group academic years by name to show duplicates
  const groupedYears = React.useMemo(() => {
    const groups = new Map<string, any[]>();
    diagnosticData.forEach(year => {
      if (!groups.has(year.name)) {
        groups.set(year.name, []);
      }
      groups.get(year.name)!.push(year);
    });
    return Array.from(groups.entries()).map(([name, years]) => ({
      name,
      years,
      isDuplicate: years.length > 1
    }));
  }, [diagnosticData]);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-8">Admin Cleanup Tools</h1>
        
        {/* Diagnostic Card */}
        <Card>
          <CardHeader>
            <CardTitle>Database Diagnostic</CardTitle>
            <CardDescription>
              Check what academic years are currently in your database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleDiagnostic}
              disabled={isDiagnosing}
              variant="outline"
            >
              {isDiagnosing ? 'Checking Database...' : 'Check Database'}
            </Button>
            
            {diagnosticData.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Found {diagnosticData.length} academic years:</h3>
                <div className="max-h-60 overflow-y-auto border rounded p-4 bg-muted/50">
                  {groupedYears.map(({ name, years, isDuplicate }) => (
                    <div key={name} className={`mb-2 p-2 rounded ${isDuplicate ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'}`}>
                      <div className="font-medium">
                        {name} {isDuplicate && <span className="text-red-600">({years.length} duplicates)</span>}
                      </div>
                      {isDuplicate && (
                        <div className="text-sm text-muted-foreground mt-1">
                          IDs: {years.map(y => y.id).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Migration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Run Academic Years Migration</CardTitle>
            <CardDescription>
              Create academic years if they don't exist. This will not create duplicates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleMigration}
              disabled={isMigrating}
              variant="default"
            >
              {isMigrating ? 'Running Migration...' : 'Run Migration'}
            </Button>
          </CardContent>
        </Card>

        {/* Regenerate with Uganda Pattern Card */}
        <Card>
          <CardHeader>
            <CardTitle>Regenerate with Uganda Calendar Pattern</CardTitle>
            <CardDescription>
              Remove all existing academic years and regenerate them following Uganda's national education calendar pattern. 
              Terms will start on Mondays, end on Fridays, with proper 23-day recesses between terms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleRegenerateWithUgandaPattern}
              disabled={isRegenerating}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRegenerating ? 'Regenerating...' : 'Regenerate with Uganda Pattern'}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              ⚠️ This will delete all existing academic years and recreate them. Make sure you have a backup.
            </p>
          </CardContent>
        </Card>
        
        {/* Cleanup Card */}
        <Card>
          <CardHeader>
            <CardTitle>Remove Duplicate Academic Years</CardTitle>
            <CardDescription>
              This tool will scan your database for duplicate academic years (same name) 
              and remove all duplicates, keeping only the oldest entry for each year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleRemoveDuplicates}
              disabled={isRemoving}
              variant="destructive"
            >
              {isRemoving ? 'Removing Duplicates...' : 'Remove Duplicate Academic Years'}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              ⚠️ This action cannot be undone. Make sure you have a backup of your data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 