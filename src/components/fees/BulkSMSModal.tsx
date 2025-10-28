'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Send, X, AlertCircle } from 'lucide-react';
import { SMSService, SMSRequest } from '@/lib/services/sms.service';
import { toast } from '@/hooks/use-toast';
import type { Pupil } from '@/types';

interface BulkSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupils: Pupil[];
  currentUser?: { displayName?: string; email?: string; firstName?: string; lastName?: string; username?: string };
}

type ParentSelection = 'first' | 'second' | 'both';

export function BulkSMSModal({ isOpen, onClose, pupils, currentUser }: BulkSMSModalProps) {
  const [parentSelection, setParentSelection] = useState<ParentSelection>('first');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Calculate recipients based on parent selection
  const recipients = useMemo(() => {
    const phoneNumbers: string[] = [];
    
    pupils.forEach(pupil => {
      if (!pupil.guardians || pupil.guardians.length === 0) {
        return;
      }

      // First parent/guardian
      if (parentSelection === 'first' || parentSelection === 'both') {
        const firstGuardian = pupil.guardians[0];
        if (firstGuardian?.phone) {
          // Clean phone number
          const cleaned = firstGuardian.phone.replace(/\s+/g, '');
          if (cleaned && !phoneNumbers.includes(cleaned)) {
            phoneNumbers.push(cleaned);
          }
        }
      }
      
      // Second parent/guardian
      if (parentSelection === 'second' || parentSelection === 'both') {
        const secondGuardian = pupil.guardians[1];
        if (secondGuardian?.phone) {
          // Clean phone number
          const cleaned = secondGuardian.phone.replace(/\s+/g, '');
          if (cleaned && !phoneNumbers.includes(cleaned)) {
            phoneNumbers.push(cleaned);
          }
        }
      }
    });
    
    return phoneNumbers;
  }, [pupils, parentSelection]);

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message Required',
        description: 'Please enter a message to send.',
        variant: 'destructive'
      });
      return;
    }

    if (recipients.length === 0) {
      toast({
        title: 'No Recipients',
        description: 'No valid phone numbers found for the selected parents.',
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);
    
    try {
      const request: SMSRequest = {
        message: message.trim(),
        recipients,
        sentBy: currentUser?.displayName || 
                (currentUser?.firstName && currentUser?.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : '') ||
                currentUser?.username || 
                currentUser?.email || 
                'Admin'
      };

      const response = await SMSService.sendBulkSMS(request);

      if (response.success) {
        toast({
          title: 'SMS Sent Successfully',
          description: `Message sent to ${response.recipientCount} recipient(s).`,
        });
        onClose();
        setMessage('');
      } else {
        toast({
          title: 'SMS Send Failed',
          description: response.message || 'Failed to send SMS messages.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while sending SMS messages.',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            SMS Communication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Info Card - Compact */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <div className="text-xs text-blue-900">
                <span className="font-semibold">{pupils.length} pupils</span>
                <span className="text-blue-700 mx-1">•</span>
                <span className="text-blue-700">Based on active filters</span>
              </div>
            </div>
          </div>

          {/* Parent Selection - Compact & Modern */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Send To</Label>
            <RadioGroup value={parentSelection} onValueChange={(value) => setParentSelection(value as ParentSelection)}>
              <div className="grid grid-cols-3 gap-2">
                <div 
                  onClick={() => setParentSelection('first')}
                  className={`relative cursor-pointer rounded-lg border-2 p-2.5 transition-all ${
                    parentSelection === 'first' 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <RadioGroupItem value="first" id="first" className="sr-only" />
                  <div className="text-center">
                    <div className="text-xs font-semibold text-gray-700 mb-1">First Parent</div>
                    <div className={`text-lg font-bold ${parentSelection === 'first' ? 'text-blue-600' : 'text-gray-900'}`}>
                      {pupils.filter(p => p.guardians?.[0]?.phone).length}
                    </div>
                    <div className="text-[10px] text-gray-500">recipients</div>
                  </div>
                  {parentSelection === 'first' && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div 
                  onClick={() => setParentSelection('second')}
                  className={`relative cursor-pointer rounded-lg border-2 p-2.5 transition-all ${
                    parentSelection === 'second' 
                      ? 'border-purple-500 bg-purple-50 shadow-sm' 
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <RadioGroupItem value="second" id="second" className="sr-only" />
                  <div className="text-center">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Second Parent</div>
                    <div className={`text-lg font-bold ${parentSelection === 'second' ? 'text-purple-600' : 'text-gray-900'}`}>
                      {pupils.filter(p => p.guardians?.[1]?.phone).length}
                    </div>
                    <div className="text-[10px] text-gray-500">recipients</div>
                  </div>
                  {parentSelection === 'second' && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div 
                  onClick={() => setParentSelection('both')}
                  className={`relative cursor-pointer rounded-lg border-2 p-2.5 transition-all ${
                    parentSelection === 'both' 
                      ? 'border-green-500 bg-green-50 shadow-sm' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <RadioGroupItem value="both" id="both" className="sr-only" />
                  <div className="text-center">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Both Parents</div>
                    <div className={`text-lg font-bold ${parentSelection === 'both' ? 'text-green-600' : 'text-gray-900'}`}>
                      {recipients.length}
                    </div>
                    <div className="text-[10px] text-gray-500">unique</div>
                  </div>
                  {parentSelection === 'both' && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Message Composition - Compact */}
          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-xs font-medium text-gray-700">
              Message
            </Label>
            <Textarea
              id="message"
              placeholder="Type your message... (e.g., Dear parent, regarding your child's fees...)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none text-sm"
              disabled={isSending}
            />
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>{message.length} chars</span>
              <span>~{Math.ceil(message.length / 160)} SMS</span>
            </div>
          </div>

          {/* Recipients Summary - Compact */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-2">
            <div className="flex items-center gap-2 text-xs">
              <Users className="w-3.5 h-3.5 text-green-600" />
              <span className="text-gray-700">
                Sending to <span className="font-bold text-green-600">{recipients.length}</span> phone number{recipients.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSending} size="sm" className="h-8">
            <X className="w-3 h-3 mr-1.5" />
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !message.trim() || recipients.length === 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            size="sm"
          >
            {isSending ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-3 h-3 mr-1.5" />
                Send ({recipients.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

