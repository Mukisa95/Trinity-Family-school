'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface PaymentDraftChange {
  label: string;
  value: string;
}

export function usePaymentDraftGuard({
  isOpen, dirty, busy, onDiscard,
}: {
  isOpen: boolean;
  dirty: boolean;
  busy: boolean;
  onDiscard: () => void;
}) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!isOpen) setShowWarning(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || (!dirty && !busy)) return;
    // Browsers control the reload/tab-close prompt and do not allow custom buttons.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, dirty, busy]);

  return {
    showWarning: isOpen && showWarning,
    continueEditing: () => setShowWarning(false),
    requestClose: () => {
      if (busy) return;
      if (dirty) setShowWarning(true);
      else onDiscard();
    },
    discard: () => {
      if (busy) return;
      setShowWarning(false);
      onDiscard();
    },
  };
}

export function UnsavedPaymentDialog({
  open, changes, onContinue, onDiscard, onSave,
}: {
  open: boolean;
  changes: PaymentDraftChange[];
  onContinue: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const continueButton = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onContinue(); }}>
      <AlertDialogContent
        className="max-w-xl bg-white dark:bg-slate-900"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          continueButton.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onContinue();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved payment changes</AlertDialogTitle>
          <AlertDialogDescription>
            These entries have not been saved. Discarding will lose the details below.
            Save records the payment after checking the amounts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="max-h-[40dvh] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950">
          {changes.map((change, index) => (
            <div key={index} className="min-w-0">
              <dt className="font-medium text-slate-500 dark:text-slate-400">{change.label}</dt>
              <dd className="mt-0.5 break-words whitespace-pre-line text-slate-900 dark:text-slate-100">{change.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button ref={continueButton} type="button" variant="outline" className="min-h-11" onClick={onContinue}>
            Continue editing
          </Button>
          <Button type="button" variant="destructive" className="min-h-11" onClick={onDiscard}>
            Discard
          </Button>
          <Button type="button" className="min-h-11" onClick={() => { onContinue(); onSave(); }}>
            Save payment
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
