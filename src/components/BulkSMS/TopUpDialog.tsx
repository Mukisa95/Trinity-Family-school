"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  Settings,
  DollarSign,
  Clock,
  Shield
} from 'lucide-react';
import { useTopUp } from '@/lib/hooks/use-topup';
import { useToast } from '@/hooks/use-toast';

interface TopUpDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentBalance?: string;
  currency?: string;
}

const TopUpDialog: React.FC<TopUpDialogProps> = ({
  open,
  onClose,
  userId,
  currentBalance = '0',
  currency = 'KES'
}) => {
  const { toast } = useToast();
  const {
    autoTopUpConfig,
    isLoadingConfig,
    processTopUp,
    isProcessingTopUp,
    topUpError,
    updateAutoTopUpConfig,
    isUpdatingConfig,
    getPaymentMethods,
    formatCurrency,
    validatePhoneNumber,
    getRecommendedAmounts
  } = useTopUp(userId);

  // Manual top-up state
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card' | 'bank_transfer'>('mobile_money');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [provider, setProvider] = useState<'MTN' | 'Airtel' | 'Orange' | 'Safaricom'>('MTN');

  // Auto top-up state
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false);
  const [autoThreshold, setAutoThreshold] = useState<string>('100');
  const [autoAmount, setAutoAmount] = useState<string>('500');
  const [autoPaymentMethod, setAutoPaymentMethod] = useState<'mobile_money' | 'card' | 'bank_transfer'>('mobile_money');
  const [autoPhoneNumber, setAutoPhoneNumber] = useState<string>('');
  const [autoProvider, setAutoProvider] = useState<'MTN' | 'Airtel' | 'Orange' | 'Safaricom'>('MTN');
  const [maxTopUpsPerDay, setMaxTopUpsPerDay] = useState<string>('3');

  const paymentMethods = getPaymentMethods();
  const recommendedAmounts = getRecommendedAmounts(parseFloat(currentBalance), currency);

  // Load auto top-up config when dialog opens
  useEffect(() => {
    if (open && autoTopUpConfig) {
      setAutoEnabled(autoTopUpConfig.enabled);
      setAutoThreshold(autoTopUpConfig.threshold.toString());
      setAutoAmount(autoTopUpConfig.amount.toString());
      setAutoPaymentMethod(autoTopUpConfig.paymentMethod);
      setAutoPhoneNumber(autoTopUpConfig.phoneNumber || '');
      setAutoProvider(autoTopUpConfig.provider || 'MTN');
      setMaxTopUpsPerDay((autoTopUpConfig.maxTopUpsPerDay || 3).toString());
    }
  }, [open, autoTopUpConfig]);

  const handleManualTopUp = async () => {
    try {
      if (!amount || parseFloat(amount) <= 0) {
        toast({
          title: 'Invalid Amount',
          description: 'Please enter a valid top-up amount',
          variant: 'destructive',
        });
        return;
      }

      if (paymentMethod === 'mobile_money') {
        const validation = validatePhoneNumber(phoneNumber, provider);
        if (!validation.valid) {
          toast({
            title: 'Invalid Phone Number',
            description: validation.error,
            variant: 'destructive',
          });
          return;
        }
      }

      const result = await processTopUp({
        amount: parseFloat(amount),
        currency,
        paymentMethod,
        phoneNumber: paymentMethod === 'mobile_money' ? phoneNumber : undefined,
        provider: paymentMethod === 'mobile_money' ? provider : undefined,
        metadata: {
          userId,
          description: 'Manual top-up'
        }
      });

      if (result.success) {
        toast({
          title: 'Top-up Initiated',
          description: result.instructions || 'Your top-up request has been processed successfully.',
        });

        if (result.paymentUrl) {
          // Open payment URL in new tab for card/bank payments
          window.open(result.paymentUrl, '_blank');
        }

        // Reset form
        setAmount('');
        setPhoneNumber('');
      } else {
        throw new Error(result.error || 'Top-up failed');
      }
    } catch (error) {
      console.error('Manual top-up error:', error);
      toast({
        title: 'Top-up Failed',
        description: error instanceof Error ? error.message : 'Failed to process top-up',
        variant: 'destructive',
      });
    }
  };

  const handleAutoTopUpUpdate = async () => {
    try {
      if (autoEnabled) {
        if (!autoThreshold || parseFloat(autoThreshold) <= 0) {
          toast({
            title: 'Invalid Threshold',
            description: 'Please enter a valid threshold amount',
            variant: 'destructive',
          });
          return;
        }

        if (!autoAmount || parseFloat(autoAmount) <= 0) {
          toast({
            title: 'Invalid Amount',
            description: 'Please enter a valid auto top-up amount',
            variant: 'destructive',
          });
          return;
        }

        if (autoPaymentMethod === 'mobile_money') {
          const validation = validatePhoneNumber(autoPhoneNumber, autoProvider);
          if (!validation.valid) {
            toast({
              title: 'Invalid Phone Number',
              description: validation.error,
              variant: 'destructive',
            });
            return;
          }
        }
      }

      const result = await updateAutoTopUpConfig({
        userId,
        enabled: autoEnabled,
        threshold: parseFloat(autoThreshold),
        amount: parseFloat(autoAmount),
        currency,
        paymentMethod: autoPaymentMethod,
        phoneNumber: autoPaymentMethod === 'mobile_money' ? autoPhoneNumber : undefined,
        provider: autoPaymentMethod === 'mobile_money' ? autoProvider : undefined,
        maxTopUpsPerDay: parseInt(maxTopUpsPerDay)
      });

      if (result.success) {
        toast({
          title: 'Auto Top-up Updated',
          description: autoEnabled ? 'Auto top-up has been enabled successfully.' : 'Auto top-up has been disabled.',
        });
      } else {
        throw new Error(result.error || 'Failed to update auto top-up configuration');
      }
    } catch (error) {
      console.error('Auto top-up update error:', error);
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update auto top-up configuration',
        variant: 'destructive',
      });
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'mobile_money': return <Smartphone className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'bank_transfer': return <Building2 className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Account Top-up
          </DialogTitle>
          <DialogDescription>
            Add funds to your SMS account or configure automatic top-up
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Manual Top-up
            </TabsTrigger>
            <TabsTrigger value="auto" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Auto Top-up
            </TabsTrigger>
          </TabsList>

          {/* Manual Top-up Tab */}
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Current Balance</CardTitle>
                <CardDescription>
                  {formatCurrency(currentBalance, currency)}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Top-up Amount ({currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="1"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {recommendedAmounts.map((recommendedAmount) => (
                    <Badge
                      key={recommendedAmount}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => setAmount(recommendedAmount.toString())}
                    >
                      {formatCurrency(recommendedAmount, currency)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile_money">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Mobile Money
                      </div>
                    </SelectItem>
                    <SelectItem value="card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Credit/Debit Card
                      </div>
                    </SelectItem>
                    <SelectItem value="bank_transfer">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Bank Transfer
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'mobile_money' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Mobile Money Provider</Label>
                    <Select value={provider} onValueChange={(value: any) => setProvider(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.mobile_money.providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+256700000000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </>
              )}

              {topUpError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {topUpError.message}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleManualTopUp}
                disabled={isProcessingTopUp || !amount}
                className="w-full"
              >
                {isProcessingTopUp ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {getPaymentMethodIcon(paymentMethod)}
                    <span className="ml-2">
                      Top-up {amount ? formatCurrency(amount, currency) : ''}
                    </span>
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Auto Top-up Tab */}
          <TabsContent value="auto" className="space-y-4">
            {isLoadingConfig ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-1/2" />
              </div>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Auto Top-up Configuration
                    </CardTitle>
                    <CardDescription>
                      Automatically top-up your account when balance is low
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-enabled">Enable Auto Top-up</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically top-up when balance falls below threshold
                        </p>
                      </div>
                      <Switch
                        id="auto-enabled"
                        checked={autoEnabled}
                        onCheckedChange={setAutoEnabled}
                      />
                    </div>

                    {autoEnabled && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="auto-threshold">Threshold ({currency})</Label>
                            <Input
                              id="auto-threshold"
                              type="number"
                              placeholder="100"
                              value={autoThreshold}
                              onChange={(e) => setAutoThreshold(e.target.value)}
                              min="1"
                            />
                            <p className="text-xs text-muted-foreground">
                              Trigger when balance falls below this amount
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="auto-amount">Top-up Amount ({currency})</Label>
                            <Input
                              id="auto-amount"
                              type="number"
                              placeholder="500"
                              value={autoAmount}
                              onChange={(e) => setAutoAmount(e.target.value)}
                              min="1"
                            />
                            <p className="text-xs text-muted-foreground">
                              Amount to add when triggered
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="auto-payment-method">Payment Method</Label>
                          <Select value={autoPaymentMethod} onValueChange={(value: any) => setAutoPaymentMethod(value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mobile_money">
                                <div className="flex items-center gap-2">
                                  <Smartphone className="h-4 w-4" />
                                  Mobile Money
                                </div>
                              </SelectItem>
                              <SelectItem value="card">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4" />
                                  Credit/Debit Card
                                </div>
                              </SelectItem>
                              <SelectItem value="bank_transfer">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  Bank Transfer
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {autoPaymentMethod === 'mobile_money' && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="auto-provider">Mobile Money Provider</Label>
                              <Select value={autoProvider} onValueChange={(value: any) => setAutoProvider(value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  {paymentMethods.mobile_money.providers.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="auto-phone">Phone Number</Label>
                              <Input
                                id="auto-phone"
                                type="tel"
                                placeholder="+256700000000"
                                value={autoPhoneNumber}
                                onChange={(e) => setAutoPhoneNumber(e.target.value)}
                              />
                            </div>
                          </>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="max-topups">Daily Limit</Label>
                          <Input
                            id="max-topups"
                            type="number"
                            placeholder="3"
                            value={maxTopUpsPerDay}
                            onChange={(e) => setMaxTopUpsPerDay(e.target.value)}
                            min="1"
                            max="10"
                          />
                          <p className="text-xs text-muted-foreground">
                            Maximum auto top-ups per day (safety limit)
                          </p>
                        </div>

                        <Alert>
                          <Shield className="h-4 w-4" />
                          <AlertDescription>
                            Auto top-up will only trigger when your balance falls below {formatCurrency(autoThreshold, currency)} and will add {formatCurrency(autoAmount, currency)} to your account.
                          </AlertDescription>
                        </Alert>
                      </>
                    )}

                    <Button
                      onClick={handleAutoTopUpUpdate}
                      disabled={isUpdatingConfig}
                      className="w-full"
                    >
                      {isUpdatingConfig ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Settings className="h-4 w-4 mr-2" />
                          {autoEnabled ? 'Update Auto Top-up' : 'Disable Auto Top-up'}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {autoTopUpConfig && autoTopUpConfig.enabled && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Current Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Threshold:</span>
                        <span>{formatCurrency(autoTopUpConfig.threshold, currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Top-up Amount:</span>
                        <span>{formatCurrency(autoTopUpConfig.amount, currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Today's Count:</span>
                        <span>{autoTopUpConfig.topUpCount || 0} / {autoTopUpConfig.maxTopUpsPerDay || 3}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
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

export default TopUpDialog; 