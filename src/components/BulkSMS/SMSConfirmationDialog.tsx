import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  MessageSquare,
  Phone,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  analyzeSMSRecipientDuplicates,
  type SMSRecipientReviewItem,
} from '@/lib/utils/sms-recipient-deduplication';

interface SMSConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  message: string;
  recipients: SMSRecipientReviewItem[];
  onConfirm: (recipients: string[]) => void;
}

const SMSConfirmationDialog: React.FC<SMSConfirmationDialogProps> = ({
  open,
  onClose,
  message,
  recipients,
  onConfirm,
}) => {
  const duplicateAnalysis = useMemo(
    () => analyzeSMSRecipientDuplicates(recipients),
    [recipients]
  );
  const [includedRecipientIds, setIncludedRecipientIds] = useState<Set<string>>(new Set());
  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIncludedRecipientIds(new Set(duplicateAnalysis.defaultIncludedRecipientIds));
    setShowDuplicateDetails(false);
  }, [open, duplicateAnalysis]);

  const messageLength = message.length;
  const smsCount = Math.max(1, Math.ceil(messageLength / 160));
  const finalRecipientCount = includedRecipientIds.size;
  const totalSMSMessages = smsCount * finalRecipientCount;
  const duplicateCount = duplicateAnalysis.duplicateRecipientCount;
  const currentlyExcludedCount = recipients.length - finalRecipientCount;

  const toggleRecipient = (recipientId: string, include: boolean) => {
    setIncludedRecipientIds((current) => {
      const next = new Set(current);
      if (include) {
        next.add(recipientId);
      } else {
        next.delete(recipientId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const confirmedPhones = recipients
      .filter((recipient) => includedRecipientIds.has(recipient.id))
      .map((recipient) => recipient.phone);
    onConfirm(confirmedPhones);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Confirm SMS Sending
          </DialogTitle>
          <DialogDescription>
            Please review the details before sending your message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message Preview */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Message Preview:</h4>
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-sm whitespace-pre-wrap">{message}</p>
            </div>
          </div>

          {/* Recipient review */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <Users className="h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-blue-900">Total selected</p>
                <p className="text-lg font-bold text-blue-600">{recipients.length}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={duplicateCount === 0}
              onClick={() => setShowDuplicateDetails((current) => !current)}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition-colors hover:bg-amber-100 disabled:cursor-default disabled:hover:bg-amber-50"
              aria-expanded={showDuplicateDetails}
            >
              <UserMinus className="h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-xs font-medium text-amber-900">
                  Duplicates
                  {duplicateCount > 0 && (
                    <ChevronDown className={`h-3 w-3 transition-transform ${showDuplicateDetails ? 'rotate-180' : ''}`} />
                  )}
                </p>
                <p className="text-lg font-bold text-amber-600">{duplicateCount}</p>
              </div>
            </button>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-green-100 bg-green-50 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <div>
                <p className="text-xs font-medium text-green-900">Final recipients</p>
                <p className="text-lg font-bold text-green-600">{finalRecipientCount}</p>
              </div>
            </div>
          </div>

          {duplicateCount > 0 && (
            <Collapsible open={showDuplicateDetails} onOpenChange={setShowDuplicateDetails}>
              <CollapsibleTrigger asChild>
                <button type="button" className="sr-only">Toggle duplicate recipient details</button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Review repeated phone numbers</p>
                  <p className="text-xs text-gray-600">
                    Numbers are matched using their last 8 digits. The first match is included and repeated matches are excluded by default. Check any recipient you still want to include.
                  </p>
                </div>

                <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                  {duplicateAnalysis.groups.map((group) => (
                    <div key={group.matchKey} className="overflow-hidden rounded-md border bg-white">
                      <div className="flex items-center justify-between gap-3 border-b bg-gray-50 px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                          <Phone className="h-3.5 w-3.5" />
                          Same last 8 digits: {group.matchKey}
                        </span>
                        <BadgeCount count={group.recipients.length} />
                      </div>
                      <div className="divide-y">
                        {group.recipients.map((recipient, index) => {
                          const isIncluded = includedRecipientIds.has(recipient.id);
                          return (
                            <label
                              key={recipient.id}
                              className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-gray-50"
                            >
                              <Checkbox
                                checked={isIncluded}
                                onCheckedChange={(checked) => toggleRecipient(recipient.id, checked === true)}
                                aria-label={`Include ${recipient.name} at ${recipient.phone}`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="text-sm font-medium text-gray-900">{recipient.name}</span>
                                  <span className={`text-[10px] font-semibold uppercase ${isIncluded ? 'text-green-700' : 'text-amber-700'}`}>
                                    {isIncluded ? 'Included' : 'Excluded'}
                                  </span>
                                </span>
                                <span className="block text-xs text-gray-600">{recipient.phone}</span>
                                <span className="block text-[11px] text-gray-500">
                                  {[recipient.className, recipient.guardianLabel].filter(Boolean).join(' · ')}
                                  {index === 0 ? ' · First match' : ''}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Message Details */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Characters:</span>
              <span className={messageLength > 160 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                {messageLength}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">SMS per recipient:</span>
              <span className={smsCount > 1 ? 'text-amber-600 font-medium' : 'text-gray-900'}>
                {smsCount}
              </span>
            </div>
            {duplicateCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Currently excluded:</span>
                <span className="font-medium text-amber-700">{currentlyExcludedCount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total SMS messages:</span>
              <span className="text-gray-900 font-medium">{totalSMSMessages}</span>
            </div>
          </div>

          {/* Warnings */}
          {smsCount > 1 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Long Message Warning:</span> Your message exceeds 160 characters and will be sent as {smsCount} separate SMS messages to each recipient.
              </AlertDescription>
            </Alert>
          )}

          {finalRecipientCount > 100 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Large Recipient List:</span> You are sending to {finalRecipientCount} recipients. This may take a few minutes to complete.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={finalRecipientCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Send {totalSMSMessages} SMS{totalSMSMessages !== 1 ? 'es' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BadgeCount = ({ count }: { count: number }) => (
  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
    {count} matches
  </span>
);

export default SMSConfirmationDialog;
