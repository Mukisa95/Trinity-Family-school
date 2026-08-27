'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquareText, Phone, Plus, Send, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import { SMSService } from '@/lib/services/sms.service';
import type { PaymentRecord, Pupil } from '@/types';

interface PaymentReceiptSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: PaymentRecord | null;
  pupil: Pupil;
  feeName?: string;
  currentBalance?: number;
  initialMessage?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  messageLabel?: string;
  sendButtonLabel?: string;
  sendingLabel?: string;
  successTitle?: string;
  successMessageLabel?: string;
}

const CUSTOM_NUMBER_VALUE = 'custom-number';

function formatSmsAmount(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount || 0));
}

function formatReceiptPupilName(pupil: Pupil) {
  const surname = pupil.lastName?.trim().toUpperCase();
  const firstInitial = pupil.firstName?.trim().charAt(0).toUpperCase();

  if (surname && firstInitial) return `${surname} ${firstInitial}.`;
  return (surname || pupil.firstName || 'PUPIL').toUpperCase();
}

function buildReceiptMessage(
  payment: PaymentRecord,
  pupil: Pupil,
  feeName: string,
  currentBalance: number,
) {
  const balanceAfterPayment = payment.balance ?? currentBalance;
  return `TRINITY FAMILY PAYMENT RECEIPT: SH.${formatSmsAmount(payment.amount)} WAS RECEIVED AS PAYMENT OF ${feeName.toUpperCase()} ON BEHALF OF ${formatReceiptPupilName(pupil)} BAL: SH.${formatSmsAmount(balanceAfterPayment)}. THANK YOU.`;
}

function isValidPhoneNumber(phoneNumber: string) {
  const compact = phoneNumber.trim().replace(/[\s()-]/g, '');

  if (/^0\d{9}$/.test(compact)) return true;
  if (/^256\d{9}$/.test(compact)) return true;
  return /^\+[1-9]\d{9,14}$/.test(compact);
}

function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.trim().replace(/[\s()-]/g, '');
}

export function PaymentReceiptSmsDialog({
  open,
  onOpenChange,
  payment = null,
  pupil,
  feeName = '',
  currentBalance = 0,
  initialMessage,
  dialogTitle = 'Send payment receipt SMS',
  dialogDescription,
  messageLabel = 'Receipt message',
  sendButtonLabel = 'Send receipt',
  sendingLabel = 'Sending receipt…',
  successTitle = 'Receipt SMS sent',
  successMessageLabel = 'The payment receipt',
}: PaymentReceiptSmsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const guardians = pupil.guardians || [];
  const defaultRecipient = guardians.length > 0 ? 'guardian-0' : CUSTOM_NUMBER_VALUE;
  const [recipientChoice, setRecipientChoice] = useState(defaultRecipient);
  const [customNumber, setCustomNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setRecipientChoice(guardians.length > 0 ? 'guardian-0' : CUSTOM_NUMBER_VALUE);
    setCustomNumber('');
    setMessage(initialMessage ?? (payment ? buildReceiptMessage(payment, pupil, feeName, currentBalance) : ''));
    setSubmissionError(null);
  }, [currentBalance, feeName, guardians.length, initialMessage, open, payment, pupil]);

  const selectedGuardianIndex = recipientChoice.startsWith('guardian-')
    ? Number(recipientChoice.replace('guardian-', ''))
    : -1;
  const selectedGuardian = selectedGuardianIndex >= 0 ? guardians[selectedGuardianIndex] : null;
  const selectedPhoneNumber = recipientChoice === CUSTOM_NUMBER_VALUE
    ? customNumber
    : selectedGuardian?.phone || '';
  const trimmedMessage = message.trim();
  const phoneIsValid = isValidPhoneNumber(selectedPhoneNumber);
  const canSend = Boolean(trimmedMessage && phoneIsValid && user?.id && !isSending && !payment?.reverted);
  const estimatedSegments = useMemo(
    () => Math.max(1, Math.ceil(trimmedMessage.length / 160)),
    [trimmedMessage.length],
  );
  const effectiveDialogDescription = dialogDescription ?? (payment
    ? 'Review the recipient and edit the receipt before sending.'
    : null);

  const handleDialogChange = (nextOpen: boolean) => {
    if (!isSending) onOpenChange(nextOpen);
  };

  const handleSend = async () => {
    if (payment?.reverted) {
      setSubmissionError('A receipt SMS cannot be sent for a reversed payment.');
      return;
    }
    if (!trimmedMessage) {
      setSubmissionError(`Enter the ${messageLabel.toLowerCase()} to send.`);
      return;
    }
    if (!phoneIsValid) {
      setSubmissionError('Select a guardian with a valid phone number or enter a valid different number.');
      return;
    }
    if (!user?.id) {
      setSubmissionError('Your signed-in user could not be identified. Please sign in again before sending.');
      return;
    }

    setIsSending(true);
    setSubmissionError(null);

    try {
      const response = await SMSService.sendBulkSMS({
        message: trimmedMessage,
        recipients: [normalizePhoneNumber(selectedPhoneNumber)],
        sentBy: user.id,
      });

      if (!response.success) {
        setSubmissionError(response.message || 'The SMS could not be sent. Your message has been preserved.');
        return;
      }

      const recipientLabel = selectedGuardian
        ? `${selectedGuardian.firstName} ${selectedGuardian.lastName}`.trim()
        : normalizePhoneNumber(selectedPhoneNumber);
      toast({
        title: successTitle,
        description: `${successMessageLabel} was sent to ${recipientLabel}.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to send SMS:', error);
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'The SMS could not be sent. Your message has been preserved.',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-lg gap-3">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MessageSquareText className="h-4 w-4" />
            </span>
            {dialogTitle}
          </DialogTitle>
          {effectiveDialogDescription && (
            <DialogDescription>{effectiveDialogDescription}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          {submissionError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {submissionError}
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="sr-only">Send to</legend>
            <span className="block text-sm font-semibold text-slate-900">Send to</span>

            <div className="flex items-start gap-2">
              <RadioGroup
                value={recipientChoice}
                onValueChange={(value) => {
                  setRecipientChoice(value);
                  setSubmissionError(null);
                }}
                className="grid min-w-0 flex-1 grid-cols-2 gap-2"
              >
                {guardians.map((guardian, index) => {
                  const value = `guardian-${index}`;
                  const selected = recipientChoice === value;

                  return (
                    <Label
                      key={guardian.id || value}
                      htmlFor={`receipt-sms-${value}`}
                      className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                        selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                      }`}
                    >
                      <RadioGroupItem id={`receipt-sms-${value}`} value={value} />
                      <UserRound className="h-3.5 w-3.5 flex-none text-slate-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold capitalize text-slate-900">
                          {guardian.relationship || 'Guardian'}
                        </span>
                        <span className="block truncate text-[11px] font-normal text-slate-600">
                          {guardian.phone || 'No number saved'}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>

              <button
                type="button"
                aria-label="Add phone number"
                aria-pressed={recipientChoice === CUSTOM_NUMBER_VALUE}
                title="Add phone number"
                onClick={() => {
                  setRecipientChoice(CUSTOM_NUMBER_VALUE);
                  setSubmissionError(null);
                }}
                className={`inline-flex h-[42px] w-[42px] flex-none items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  recipientChoice === CUSTOM_NUMBER_VALUE
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {recipientChoice !== CUSTOM_NUMBER_VALUE && !phoneIsValid && (
              <p role="status" className="text-xs text-amber-800">
                This guardian has no valid saved phone number. Choose another guardian or use a different number.
              </p>
            )}

            {recipientChoice === CUSTOM_NUMBER_VALUE && (
              <div className="space-y-1.5">
                <Label htmlFor="receipt-sms-phone" className="sr-only">Phone number</Label>
                <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/60 px-2">
                  <Phone className="h-4 w-4 flex-none text-emerald-700" />
                  <Input
                    id="receipt-sms-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    autoFocus
                    placeholder="Enter phone number"
                    value={customNumber}
                    onChange={(event) => {
                      setCustomNumber(event.target.value);
                      setSubmissionError(null);
                    }}
                    aria-invalid={customNumber.length > 0 && !phoneIsValid}
                    className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
                {customNumber.length > 0 && !phoneIsValid && (
                  <p className="text-xs text-red-700">Enter a valid phone number, including the country code for numbers outside Uganda.</p>
                )}
              </div>
            )}
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="receipt-sms-message" className="font-semibold text-slate-900">{messageLabel}</Label>
              <span className="text-xs text-slate-500">
                {trimmedMessage.length} characters · about {estimatedSegments} SMS
              </span>
            </div>
            <Textarea
              id="receipt-sms-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setSubmissionError(null);
              }}
              className="min-h-28 resize-y leading-relaxed"
              aria-invalid={!trimmedMessage}
            />
            <p className="text-xs text-slate-500">You can change any wording before sending.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleDialogChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isSending ? (
              <>
                <Loader2 className="animate-spin" />
                {sendingLabel}
              </>
            ) : (
              <>
                <Send />
                {sendButtonLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
