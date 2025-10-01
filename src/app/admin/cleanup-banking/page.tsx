"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Trash2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { BankingService } from '@/lib/services/banking.service';

export default function CleanupBankingPage() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionResult, setDeletionResult] = useState<any>(null);
  const { toast } = useToast();

  const handleDeleteAllTestData = async () => {
    const confirmed = window.confirm(
      '🚨 WARNING: This will permanently delete ALL transactions and reset ALL account balances to zero.\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you absolutely sure you want to proceed?'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'FINAL CONFIRMATION:\n\n' +
      'You are about to delete ALL banking test data.\n\n' +
      'Type "DELETE" in the next dialog to confirm.'
    );

    if (!doubleConfirm) return;

    const typedConfirmation = window.prompt(
      'Type exactly "DELETE" (all caps) to confirm deletion:'
    );

    if (typedConfirmation !== 'DELETE') {
      toast({
        variant: "destructive",
        title: "Deletion Cancelled",
        description: "Confirmation text did not match. No data was deleted.",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const result = await BankingService.deleteAllTestData();
      setDeletionResult(result);
      
      toast({
        title: "Cleanup Completed Successfully",
        description: result.message,
      });

    } catch (error: any) {
      console.error('Error deleting test data:', error);
      toast({
        variant: "destructive",
        title: "Cleanup Failed",
        description: error.message || 'Failed to delete test data',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Banking Data Cleanup</h1>
        <p className="text-gray-600">
          Admin tool to clean up test banking data and reset the system for production use.
        </p>
      </div>

      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>⚠️ DANGER ZONE:</strong> These actions are permanent and cannot be undone. 
          Use only for cleaning up test data before going to production.
        </AlertDescription>
      </Alert>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            Delete All Test Banking Data
          </CardTitle>
          <CardDescription>
            This will permanently delete all transactions and reset all account balances to zero. 
            Use this to clean up test data before starting fresh with real transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">What this action will do:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Delete ALL transaction records from the database</li>
              <li>• Reset ALL account balances to zero (UGX 0)</li>
              <li>• Keep account records and loan records intact</li>
              <li>• Clear transaction history completely</li>
            </ul>
          </div>

          {deletionResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">✅ Cleanup Completed:</h3>
              <div className="text-sm text-green-700 space-y-1">
                <p>• Deleted {deletionResult.deletedTransactions} transactions</p>
                <p>• Reset {deletionResult.resetAccounts} account balances</p>
                <p className="font-medium mt-2">{deletionResult.message}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleDeleteAllTestData}
            disabled={isDeleting}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            size="lg"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting All Test Data...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Test Banking Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            After Cleanup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>After running the cleanup:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All pupil bank accounts will show UGX 0 balance</li>
              <li>Transaction history will be empty</li>
              <li>Loans will remain unchanged</li>
              <li>You can start fresh with real transactions</li>
              <li>The banking system will be ready for production use</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 