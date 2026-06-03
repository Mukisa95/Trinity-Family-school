"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, CheckCircle, AlertTriangle, Smartphone, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WizaRechargeDialogProps {
  open: boolean;
  onClose: () => void;
  currentBalance?: string | null;
  onRechargeSuccess?: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const WizaRechargeDialog: React.FC<WizaRechargeDialogProps> = ({
  open,
  onClose,
  currentBalance,
  onRechargeSuccess,
}) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [resultMsg, setResultMsg] = useState('');

  const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

  const handleRecharge = async () => {
    if (!phone.trim()) {
      toast({ title: 'Phone required', description: 'Enter your mobile money number.', variant: 'destructive' });
      return;
    }
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount < 500) {
      toast({ title: 'Invalid amount', description: 'Minimum recharge is UGX 500.', variant: 'destructive' });
      return;
    }

    setStatus('loading');
    setResultMsg('');

    try {
      const res = await fetch('/api/sms/wiza-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), amount: numAmount }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setResultMsg(data.message || 'Recharge initiated! Check for a mobile money prompt on your phone.');
        setPhone('');
        setAmount('');
        onRechargeSuccess?.();
        toast({ title: 'Recharge Initiated', description: 'Check your phone for the mobile money prompt.' });
      } else {
        setStatus('error');
        setResultMsg(data.error || 'Recharge failed. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setResultMsg('Network error. Please check your connection and try again.');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setResultMsg('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Recharge SMS Balance
          </DialogTitle>
          <DialogDescription>
            Pay via mobile money to top up your Wiza SMS wallet instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current balance */}
          {currentBalance !== null && currentBalance !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Current Balance</span>
              <span className="font-semibold text-primary">
                UGX {Number(currentBalance).toLocaleString()}
              </span>
            </div>
          )}

          {/* Success state */}
          {status === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">{resultMsg}</AlertDescription>
            </Alert>
          )}

          {/* Error state */}
          {status === 'error' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{resultMsg}</AlertDescription>
            </Alert>
          )}

          {status !== 'success' && (
            <>
              {/* Phone number */}
              <div className="space-y-1.5">
                <Label htmlFor="recharge-phone">Mobile Money Number</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="recharge-phone"
                    placeholder="+256 700 000 000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="pl-9"
                    disabled={status === 'loading'}
                  />
                </div>
                <p className="text-xs text-muted-foreground">MTN or Airtel Uganda number</p>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="recharge-amount">Amount (UGX)</Label>
                <Input
                  id="recharge-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min={500}
                  disabled={status === 'loading'}
                />
                {/* Quick amount chips */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {QUICK_AMOUNTS.map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount(String(a))}
                      className="rounded-full border px-3 py-0.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                      disabled={status === 'loading'}
                    >
                      {a.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee note */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  A <strong>1% processing fee</strong> is applied by Wiza SMS. For UGX {amount ? Number(amount).toLocaleString() : '10,000'} you will be charged UGX {amount ? Math.ceil(Number(amount) * 1.01).toLocaleString() : '10,100'}.
                </AlertDescription>
              </Alert>

              {/* Submit */}
              <Button
                className="w-full"
                onClick={handleRecharge}
                disabled={status === 'loading' || !phone || !amount}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Recharge UGX {amount ? Number(amount).toLocaleString() : '—'}
                  </>
                )}
              </Button>
            </>
          )}

          {status === 'success' && (
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WizaRechargeDialog;
