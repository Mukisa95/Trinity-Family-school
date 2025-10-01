"use client";

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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Smartphone,
  MessageSquare,
  DollarSign
} from 'lucide-react';

interface SMSResult {
  success: boolean;
  message: string;
  recipientCount: number;
  messageId: string;
  cost?: string;
  details?: {
    total: number;
    successful: number;
    failed: number;
    failedRecipients?: Array<{
      number: string;
      status: string;
      network: string;
    }>;
    networkSummary?: Array<{
      network: string;
      sent: number;
      failed: number;
      cost: number;
      success: boolean;
      error?: string;
      blocked?: number;
    }>;
    mtnFailures?: number;
    retryAttempt?: number;
    retryRecommended?: boolean;
    retryMessage?: string;
    mtnBlocked?: number;
    blockedRecipients?: Array<{
      phoneNumber: string;
      network: string;
      status: string;
    }>;
  };
}

interface SMSResultDialogProps {
  open: boolean;
  onClose: () => void;
  result: SMSResult | null;
  originalMessage: string;
  sentBy: string;
}

const SMSResultDialog: React.FC<SMSResultDialogProps> = ({
  open,
  onClose,
  result,
  originalMessage,
  sentBy
}) => {
  if (!result) return null;

  const getNetworkIcon = (network: string) => {
    return <Smartphone className="h-4 w-4" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getNetworkStatusColor = (network: string, failed: number, total: number) => {
    if (network === 'MTN' && failed > 0) {
      return 'border-red-200 bg-red-50';
    } else if (failed === 0) {
      return 'border-green-200 bg-green-50';
    } else {
      return 'border-yellow-200 bg-yellow-50';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            SMS Sending Results
          </DialogTitle>
          <DialogDescription>
            {result.message}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="networks">Networks</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs font-medium text-blue-900">Total</p>
                      <p className="text-lg font-bold text-blue-600">{result.details?.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs font-medium text-green-900">Sent</p>
                      <p className="text-lg font-bold text-green-600">{result.details?.successful}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-xs font-medium text-red-900">Failed</p>
                      <p className="text-lg font-bold text-red-600">{result.details?.failed}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs font-medium text-purple-900">Cost</p>
                      <p className="text-lg font-bold text-purple-600">{result.cost}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* MTN Blocking Alert */}
            {result.details?.mtnBlocked && result.details.mtnBlocked > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">MTN Numbers Blocked</p>
                    <p>{result.details.mtnBlocked} MTN numbers were blocked to prevent charges for undelivered messages.</p>
                    <p className="text-sm">MTN delivery through Africa's Talking is unreliable. Consider switching to Wiza SMS provider for MTN delivery.</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* MTN Success Alert */}
            {result.success && result.details?.mtnBlocked === 0 && (
              (() => {
                const mtnNumbers = originalMessage ? 
                  originalMessage.split(',').filter(phone => {
                    const cleanNumber = phone.replace(/[\s\-\(\)\+]/g, '');
                    let localNumber = cleanNumber;
                    if (cleanNumber.startsWith('256')) {
                      localNumber = cleanNumber.substring(3);
                    }
                    if (localNumber.startsWith('0')) {
                      localNumber = localNumber.substring(1);
                    }
                    return localNumber.match(/^(77|78|76|39)/);
                  }) : [];
                
                return mtnNumbers.length > 0 ? (
                  <Alert variant="default" className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium text-green-800">MTN Numbers Successfully Sent</p>
                        <p className="text-green-700">{mtnNumbers.length} MTN numbers were successfully sent via Wiza SMS provider.</p>
                        <p className="text-sm text-green-600">Wiza SMS provides reliable delivery to MTN numbers in Uganda.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null;
              })()
            )}

            {/* Blocked Recipients Information */}
            {result.details?.blockedRecipients && result.details.blockedRecipients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Blocked Recipients
                  </CardTitle>
                  <CardDescription>
                    These recipients were blocked to prevent charges for undelivered messages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {result.details.blockedRecipients.map((recipient, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded text-sm border border-red-200">
                        <span className="font-mono">{recipient.phoneNumber}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            {recipient.network}
                          </Badge>
                          <span className="text-red-600 text-xs">{recipient.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-200">
                    <p className="text-sm text-amber-800">
                      <strong>Alternative Communication:</strong> Consider using WhatsApp, email, or direct calls to reach these MTN recipients.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Networks Tab */}
          <TabsContent value="networks" className="space-y-4">
            {result.details?.networkSummary && result.details.networkSummary.length > 0 ? (
              <div className="space-y-3">
                {result.details.networkSummary.map((network, index) => (
                  <Card key={index} className={getNetworkStatusColor(network.network, network.failed, network.sent + network.failed)}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getNetworkIcon(network.network)}
                        {network.network} Network
                        {network.network === 'MTN' && network.failed > 0 && (
                          <Badge variant="destructive">Issues Detected</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 block">Sent</span>
                          <span className="font-medium text-green-600">{network.sent}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Failed</span>
                          <span className="font-medium text-red-600">{network.failed}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">{network.blocked ? 'Blocked' : 'Cost'}</span>
                          <span className="font-medium">
                            {network.blocked ? network.blocked : `UGX ${network.cost?.toFixed(4) || 'N/A'}`}
                          </span>
                        </div>
                      </div>
                      
                      {network.error && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            {network.error}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {network.network === 'MTN' && network.blocked && network.blocked > 0 && (
                        <Alert className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            MTN numbers are permanently blocked to prevent charges for undelivered messages. Consider alternative communication methods.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Network-specific information is not available for this message.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Message ID:</span>
                <span className="font-mono text-xs">{result.messageId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Success Rate:</span>
                <span className="font-medium">
                  {result.details?.successful && result.details?.total ? 
                    ((result.details.successful / result.details.total) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              {result.details?.retryAttempt !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Retry Attempt:</span>
                  <span className="font-medium">{result.details.retryAttempt}</span>
                </div>
              )}
            </div>

            {result.details?.failedRecipients && result.details.failedRecipients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Failed Recipients</CardTitle>
                  <CardDescription>
                    {result.details.failedRecipients.length} recipients did not receive the message
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {result.details.failedRecipients.map((recipient, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <span className="font-mono">{recipient.number}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={recipient.network === 'MTN' ? 'destructive' : 'secondary'}>
                            {recipient.network}
                          </Badge>
                          <span className="text-gray-600">{recipient.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SMSResultDialog; 