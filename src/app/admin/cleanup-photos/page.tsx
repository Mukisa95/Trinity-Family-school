"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

interface CleanupResult {
  total: number;
  deleted: number;
  kept: number;
  errors: number;
}

export default function CleanupPhotosPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCleanup = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/cleanup-photos', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Cleanup failed');
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Photo Database Cleanup</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Clean up database records for deleted local photos
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Local Photo Records Cleanup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will permanently delete database records for photos that were stored locally 
              (URLs starting with /uploads/photos/). Cloudinary and Firebase Storage photos will be kept.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-semibold">What this cleanup does:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>🗑️ Deletes database records for local photos (/uploads/photos/*)</li>
              <li>☁️ Keeps Cloudinary photos (cloudinary.com URLs)</li>
              <li>🔥 Keeps Firebase Storage photos (firebasestorage.googleapis.com URLs)</li>
              <li>📊 Provides detailed cleanup statistics</li>
            </ul>
          </div>

          <Button 
            onClick={runCleanup}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Cleanup...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Run Photo Database Cleanup
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <strong>✅ Cleanup completed successfully!</strong>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div>📊 Total processed: <strong>{result.total}</strong></div>
                    <div>🗑️ Deleted: <strong>{result.deleted}</strong></div>
                    <div>☁️ Kept: <strong>{result.kept}</strong></div>
                    <div>❌ Errors: <strong>{result.errors}</strong></div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why run this cleanup?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>
              When you deleted the local photo files, the database records still exist and point 
              to those deleted files, causing 404 errors when trying to display them.
            </p>
            <p>
              This cleanup removes those orphaned database records so your photo gallery 
              only shows photos that actually exist (Cloudinary and Firebase Storage photos).
            </p>
            <p>
              <strong>Safe operation:</strong> This only deletes database records, not actual photo files. 
              Your Cloudinary photos remain untouched.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 