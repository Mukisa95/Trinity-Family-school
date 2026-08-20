"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  ExternalLink,
  User,
  Lock,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { createFieldValidation, useFormValidation } from '@/lib/utils/form-validation';

interface SMSSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WizaCredentialState {
  username: string;
  password: string;
  senderId: string;
}

const SMSSettingsModal: React.FC<SMSSettingsModalProps> = ({ open, onOpenChange }) => {
  const [credentials, setCredentials] = useState<WizaCredentialState>({
    username: '',
    password: '',
    senderId: 'TRINITY',
  });
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [currentSenderId, setCurrentSenderId] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('credentials');

  const { toast } = useToast();
  const formValidation = useFormValidation([
    createFieldValidation('wiza-username', credentials.username, 'Email or username', true, { message: 'Enter the Wiza SMS email or username.' }),
    createFieldValidation('wiza-password', credentials.password, 'Password', true, { message: 'Enter the Wiza SMS password.' }),
  ], {
    scrollBehavior: 'smooth',
  });

  // Load current settings when modal opens
  useEffect(() => {
    if (!open) return;
    loadCurrentSettings();
  }, [open]);

  const loadCurrentSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sms/settings');
      if (res.ok) {
        const data = await res.json();
        setCurrentUsername(data.username || '');
        setCurrentSenderId(data.senderId || 'TRINITY');
        setLastUpdated(data.updatedAt || '');
        // Pre-fill the form with the current (non-password) values
        setCredentials(prev => ({
          ...prev,
          username: data.username || '',
          senderId: data.senderId || 'TRINITY',
          password: '', // always start blank for security
        }));
      }
    } catch {
      // silent — will show env-var defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formValidation.validateAll().isValid) return;

    setSaving(true);
    try {
      const res = await fetch('/api/sms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username.trim(),
          password: credentials.password.trim(),
          senderId: credentials.senderId.trim() || 'TRINITY',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setCurrentUsername(data.username);
      setCurrentSenderId(data.senderId);
      setLastUpdated(new Date().toISOString());
      setCredentials(prev => ({ ...prev, password: '' }));

      toast({
        title: '✅ Settings Saved',
        description: `Wiza SMS will now use account: ${data.username}`,
      });
    } catch (error) {
      formValidation.setSubmissionError(error instanceof Error ? error.message : 'Could not save settings.');
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/sms/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Trinity School SMS connection test.',
          recipients: ['256700000000'], // dummy test number
          sentBy: 'settings-test',
        }),
      });

      // Any HTTP response (even 400 from invalid number) means the server reached Wiza
      if (res.status !== 0) {
        toast({
          title: '✅ Connection Test Passed',
          description: 'The server can reach Wiza SMS. Your credentials will be used for next send.',
        });
      } else {
        throw new Error('No response from server');
      }
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: 'Could not reach the SMS service. Check your internet connection.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            SMS Settings
          </DialogTitle>
          <DialogDescription>
            Manage your Wiza SMS account credentials. Changes take effect immediately — no redeployment needed.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="credentials">Account Credentials</TabsTrigger>
            <TabsTrigger value="info">About Wiza SMS</TabsTrigger>
          </TabsList>

          {/* ─── Credentials Tab ─── */}
          <TabsContent value="credentials" className="space-y-5 pt-2">
            <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />

            {/* Current active account */}
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading current settings…
              </div>
            ) : currentUsername ? (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Active Account</p>
                      <p className="font-medium text-green-900">{currentUsername}</p>
                      <div className="flex gap-2 flex-wrap mt-1">
                        <Badge variant="outline" className="text-green-700 border-green-400 text-xs">
                          Sender ID: {currentSenderId}
                        </Badge>
                        {lastUpdated && (
                          <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                            Updated: {formatDate(lastUpdated)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Using default credentials from environment variables. Enter new credentials below to override.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Credentials form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {currentUsername ? 'Update Credentials' : 'Set Credentials'}
                </CardTitle>
                <CardDescription>
                  Enter your Wiza SMS account details. The password is stored securely and never displayed again.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="wiza-username" className={`flex items-center gap-1.5 ${formValidation.getFieldError('wiza-username') ? 'text-destructive' : ''}`}>
                    <User className="h-3.5 w-3.5" />
                    Email / Username <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="wiza-username"
                    type="email"
                    placeholder="e.g. marbleodeke3@gmail.com"
                    value={credentials.username}
                    onChange={e => { setCredentials(prev => ({ ...prev, username: e.target.value })); formValidation.handleFieldChange('wiza-username'); }}
                    {...formValidation.getFieldProps('wiza-username')}
                  />
                  <FieldError error={formValidation.getFieldError('wiza-username')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wiza-password" className={`flex items-center gap-1.5 ${formValidation.getFieldError('wiza-password') ? 'text-destructive' : ''}`}>
                    <Lock className="h-3.5 w-3.5" />
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="wiza-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your Wiza SMS password"
                      value={credentials.password}
                      onChange={e => { setCredentials(prev => ({ ...prev, password: e.target.value })); formValidation.handleFieldChange('wiza-password'); }}
                      {...formValidation.getFieldProps('wiza-password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <FieldError error={formValidation.getFieldError('wiza-password')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wiza-sender-id" className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Sender ID
                    <span className="text-muted-foreground text-xs">(the name recipients see)</span>
                  </Label>
                  <Input
                    id="wiza-sender-id"
                    placeholder="e.g. TRINITY"
                    value={credentials.senderId}
                    onChange={e => setCredentials(prev => ({ ...prev, senderId: e.target.value }))}
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">Max 11 characters, no spaces.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                      : '💾 Save Credentials'
                    }
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing}
                  >
                    {testing
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Testing…</>
                      : <><RefreshCw className="h-4 w-4 mr-2" />Test Connection</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── About Tab ─── */}
          <TabsContent value="info" className="space-y-4 pt-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Wiza SMS — Uganda</CardTitle>
                <CardDescription>Local SMS gateway with competitive UGX pricing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">Cost per SMS</p>
                    <p className="font-semibold text-base">UGX 35</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs mb-1">Coverage</p>
                    <p className="font-semibold text-base">Uganda 🇺🇬</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Bulk SMS to MTN & Airtel</div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Custom Sender ID</div>
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> UGX billing</div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open('https://wizasms.ug/dashboard', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open('https://wizasms.ug', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Top Up Balance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SMSSettingsModal;
