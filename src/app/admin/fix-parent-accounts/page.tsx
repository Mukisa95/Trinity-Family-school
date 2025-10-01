"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, ArrowRight, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { UsersService } from '@/lib/services/users.service';

export default function FixParentAccountsPage() {
  const [isFixing, setIsFixing] = useState(false);
  const [fixResults, setFixResults] = useState<any>(null);
  const { toast } = useToast();

  const handleFixParentAccounts = async () => {
    const confirmed = window.confirm(
      '🔧 PARENT ACCOUNT MIGRATION\n\n' +
      'This will migrate all existing parent accounts to use admission-number-based usernames for better security and consistency.\n\n' +
      'Benefits:\n' +
      '• Parents can still log in using pupil name + admission number\n' +
      '• System will work even if pupil names are changed\n' +
      '• More secure and predictable authentication\n\n' +
      'This is a safe operation that improves the system. Continue?'
    );

    if (!confirmed) return;

    setIsFixing(true);
    try {
      const results = await UsersService.fixExistingParentAccounts();
      setFixResults(results);
      
      toast({
        title: "Migration Completed",
        description: `Successfully migrated ${results.success} accounts, ${results.failed} failed.`,
      });

    } catch (error: any) {
      console.error('Error fixing parent accounts:', error);
      toast({
        variant: "destructive",
        title: "Migration Failed",
        description: error.message || 'Failed to migrate parent accounts',
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Fix Parent Account Authentication</h1>
        <p className="text-gray-600">
          Migrate existing parent accounts to use admission-number-based usernames for better security and consistency.
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>🔒 Authentication Fix:</strong> This addresses the issue where parent accounts break when pupil names are changed.
          After this migration, parent authentication will be based on stable identifiers (admission numbers) rather than changeable pupil names.
        </AlertDescription>
      </Alert>

      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Users className="w-5 h-5" />
            Migrate Parent Account Usernames
          </CardTitle>
          <CardDescription>
            Convert existing name-based parent usernames to admission-number-based format for consistency and security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">What this migration does:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
              <div>
                <h4 className="font-medium mb-1">Before (Old Format):</h4>
                <ul className="space-y-1">
                  <li>• Username: "johnsmithjr"</li>
                  <li>• Password: admission number</li>
                  <li>• ❌ Breaks when name changes</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">After (New Simple Format):</h4>
                <ul className="space-y-1">
                  <li>• Username: "MUK12" (3 letters + 2 digits)</li>
                  <li>• Password: admission number</li>
                  <li>• ✅ Short, memorable & stable</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-3 p-2 bg-yellow-100 rounded text-xs">
              <p className="font-medium text-yellow-800 mb-1">Username Format Explained:</p>
              <p className="text-yellow-700">
                <strong>MUK</strong> = First 3 letters of surname (MUKISA) + <strong>12</strong> = Last 2 digits of birth year (2012)
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">Parent Login Experience:</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Parents can use simple username: <strong>MUK12</strong></li>
              <li>• Or use pupil's full name: <strong>Mukisa Jovan</strong></li>
              <li>• System automatically finds correct account</li>
              <li>• Works even if pupil name is changed</li>
              <li>• Much easier to remember and type</li>
            </ul>
          </div>

          {fixResults && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Migration Results:
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{fixResults.success}</div>
                  <div className="text-sm text-gray-600">Successfully Migrated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{fixResults.failed}</div>
                  <div className="text-sm text-gray-600">Failed to Migrate</div>
                </div>
              </div>
              
              <div className="max-h-40 overflow-y-auto bg-white rounded p-2 border">
                <h4 className="font-medium text-sm mb-2">Detailed Results:</h4>
                {fixResults.details.map((detail: string, index: number) => (
                  <div key={index} className="text-xs font-mono mb-1 flex items-start gap-1">
                    {detail.includes('✅') ? (
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : detail.includes('❌') ? (
                      <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ArrowRight className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={detail.includes('✅') ? 'text-green-700' : detail.includes('❌') ? 'text-red-700' : 'text-gray-600'}>
                      {detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleFixParentAccounts}
            disabled={isFixing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {isFixing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Migrating Parent Accounts...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Fix All Parent Account Usernames
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-green-600" />
            After Migration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>After running the migration:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All parent accounts will use admission-number-based usernames</li>
              <li>Parents can still log in using pupil name + admission number</li>
              <li>System will automatically find correct account</li>
              <li>Authentication will work even if pupil names are changed</li>
              <li>The parent dashboard will be more reliable and consistent</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 