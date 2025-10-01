"use client";

import React from 'react';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { SchoolSettingsService } from '@/lib/services/school-settings.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function TestFirebasePage() {
  const [testResult, setTestResult] = React.useState<string>('');
  const [isManualTesting, setIsManualTesting] = React.useState(false);

  // Test using React Query hook
  const { data: settings, isLoading, error } = useSchoolSettings();

  const runManualTest = async () => {
    setIsManualTesting(true);
    setTestResult('Testing Firebase connection...');
    
    try {
      const result = await SchoolSettingsService.getSchoolSettings();
      if (result) {
        setTestResult(`✅ SUCCESS: Retrieved school settings - ${result.generalInfo.name}`);
      } else {
        setTestResult('⚠️ WARNING: No settings found in Firebase (returning null)');
      }
    } catch (error: any) {
      setTestResult(`❌ ERROR: ${error.message}`);
    } finally {
      setIsManualTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Firebase Connection Test</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>React Query Hook Test</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : error ? (
              <div className="text-red-600">
                ❌ Error: {error.message}
              </div>
            ) : settings ? (
              <div className="text-green-600">
                ✅ Success: {settings.generalInfo.name}
              </div>
            ) : (
              <div className="text-yellow-600">
                ⚠️ No data (using fallback)
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Service Test</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runManualTest} 
              disabled={isManualTesting}
              className="mb-4"
            >
              {isManualTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                'Run Manual Test'
              )}
            </Button>
            {testResult && (
              <div className="p-3 bg-gray-100 rounded">
                {testResult}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-gray-100 p-3 rounded overflow-auto">
              {JSON.stringify({
                hookLoading: isLoading,
                hookError: error?.message || null,
                hasSettings: !!settings,
                settingsName: settings?.generalInfo?.name || 'N/A',
                timestamp: new Date().toISOString()
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 