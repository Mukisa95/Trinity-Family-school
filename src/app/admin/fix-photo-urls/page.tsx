"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { fixPhotoUrls } from '@/scripts/fix-photo-urls';

interface MigrationResult {
  total: number;
  fixed: number;
  errors: number;
}

export default function FixPhotoUrlsPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const runMigration = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setLogs([]);

    try {
      // Capture console.log output
      const originalLog = console.log;
      console.log = (...args) => {
        setLogs(prev => [...prev, args.join(' ')]);
        originalLog(...args);
      };

      const migrationResult = await fixPhotoUrls();
      setResult(migrationResult);

      // Restore original console.log
      console.log = originalLog;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Fix Photo URLs Migration
            </CardTitle>
            <CardDescription>
              This tool fixes malformed photo URLs in the database by regenerating proper Firebase Storage download URLs.
              Use this if you're seeing CORS errors when loading images.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Warning */}
            <Alert>
              <AlertDescription>
                <strong>Important:</strong> This migration will update photo URLs in the database. 
                Make sure Firebase Storage rules are properly configured before running this.
              </AlertDescription>
            </Alert>

            {/* Action Button */}
            <div className="flex justify-center">
              <Button 
                onClick={runMigration} 
                disabled={isRunning}
                size="lg"
                className="min-w-[200px]"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Migration...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Start Migration
                  </>
                )}
              </Button>
            </div>

            {/* Results */}
            {result && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    Migration Completed Successfully
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{result.total}</div>
                      <div className="text-sm text-gray-600">Total Photos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{result.fixed}</div>
                      <div className="text-sm text-gray-600">Fixed URLs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{result.errors}</div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {error && (
              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <XCircle className="h-5 w-5" />
                    Migration Failed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Migration Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm font-mono">
                      {logs.map((log, index) => (
                        <div key={index} className="mb-1">
                          {log}
                        </div>
                      ))}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>What this migration does:</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Scans all photos in the database</li>
                  <li>Identifies photos with malformed URLs (containing `?name=` pattern)</li>
                  <li>Regenerates proper Firebase Storage download URLs</li>
                  <li>Updates the database with correct URLs</li>
                  <li>Handles missing URLs by reconstructing them from file paths</li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 