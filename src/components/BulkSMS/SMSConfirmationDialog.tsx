import React from 'react';
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
import { MessageSquare, Users, AlertTriangle, DollarSign } from 'lucide-react';

interface SMSConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  message: string;
  recipientCount: number;
  onConfirm: () => void;
}

const SMSConfirmationDialog: React.FC<SMSConfirmationDialogProps> = ({
  open,
  onClose,
  message,
  recipientCount,
  onConfirm,
}) => {
  const messageLength = message.length;
  const smsCount = Math.ceil(messageLength / 160);
  const totalSMSMessages = smsCount * recipientCount;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
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

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-blue-900">Recipients</p>
                <p className="text-lg font-bold text-blue-600">{recipientCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs font-medium text-green-900">SMS Count</p>
                <p className="text-lg font-bold text-green-600">{smsCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-xs font-medium text-purple-900">Total SMS</p>
                <p className="text-lg font-bold text-purple-600">{totalSMSMessages}</p>
              </div>
            </div>
          </div>

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

          {recipientCount > 100 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Large Recipient List:</span> You are sending to {recipientCount} recipients. This may take a few minutes to complete.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            Send {totalSMSMessages} SMS{totalSMSMessages !== 1 ? 'es' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SMSConfirmationDialog; 