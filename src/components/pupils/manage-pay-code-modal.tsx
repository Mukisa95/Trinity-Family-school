"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tag, CheckCircle, Info } from 'lucide-react';

interface ManagePayCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payCode: string | null) => Promise<void>;
  currentPayCode?: string | null;
  pupilName: string;
}

export function ManagePayCodeModal({
  isOpen,
  onClose,
  onSave,
  currentPayCode,
  pupilName,
}: ManagePayCodeModalProps) {
  const [payCode, setPayCode] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync value when modal opens
  useEffect(() => {
    if (isOpen) {
      setPayCode(currentPayCode || '');
      setError(null);
    }
  }, [isOpen, currentPayCode]);

  const handleSave = async () => {
    const trimmed = payCode.trim();

    if (!trimmed) {
      // Removing the pay code — confirm intent
      if (currentPayCode) {
        if (!window.confirm('Are you sure you want to remove this pay code?')) return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed || null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pay code. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setPayCode(currentPayCode || '');
    setError(null);
    onClose();
  };

  const isChanged = payCode.trim() !== (currentPayCode || '');

  return (
    <ModernDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModernDialogContent size="sm" open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          SchoolPay Payment Code — {pupilName}
          </ModernDialogTitle>
        </ModernDialogHeader>

        <div className="space-y-5 py-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60">
            <Info className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0 dark:text-emerald-400" />
            <p className="text-xs text-emerald-800 leading-relaxed dark:text-emerald-200">
          The SchoolPay payment code is provided by SchoolPay for the student.
          It is used to identify this student when SchoolPay sends payment notifications to our system.
            </p>
          </div>

          {/* Current pay code display */}
          {currentPayCode ? (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-slate-900">
              <div>
                <p className="text-xs text-gray-500 mb-1 dark:text-slate-400">Current Pay Code</p>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-sm px-3 py-1 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60">
                    {currentPayCode}
                  </Badge>
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 border rounded-lg border-dashed bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60">
              <Info className="h-4 w-4 text-amber-600 flex-shrink-0 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
          No payment code assigned yet. Enter the code provided by SchoolPay below.
              </p>
            </div>
          )}

          {/* Input */}
          <div className="space-y-2">
            <Label htmlFor="payCode" className="text-sm font-medium">
              {currentPayCode ? 'Update Pay Code' : 'Enter Pay Code'}
            </Label>
            <Input
              id="payCode"
              value={payCode}
              onChange={(e) => {
                setPayCode(e.target.value);
                setError(null);
              }}
              placeholder="e.g. 000000000"
              className="font-mono text-base tracking-widest"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            {currentPayCode && !payCode.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Leaving this empty will <strong>remove</strong> the pay code from this student.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800/60">
              {error}
            </p>
          )}
        </div>

        <ModernDialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !isChanged}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? 'Saving…' : currentPayCode ? 'Update Pay Code' : 'Save Pay Code'}
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
  );
}
