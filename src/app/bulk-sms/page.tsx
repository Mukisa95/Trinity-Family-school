"use client";

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Users, MessageSquare, Settings, FileText, Wallet, RefreshCw, CreditCard, Monitor, Calendar, Send } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SMSConfirmationDialog from '@/components/BulkSMS/SMSConfirmationDialog';
import SMSResultDialog from '@/components/BulkSMS/SMSResultDialog';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from '@/components/common/glass-page-top-bar';
import { AccountBalance } from '@/components/BulkSMS/AccountBalance';
import SMSSettingsModal from '@/components/BulkSMS/SMSSettingsModal';
import { WizaSMSDashboard } from '@/components/BulkSMS/WizaSMSDashboard';
import WizaRechargeDialog from '@/components/BulkSMS/WizaRechargeDialog';
import { SMSCostCalculator } from '@/components/BulkSMS/SMSCostCalculator';
import { SMSScheduleDialog } from '@/components/BulkSMS/SMSScheduleDialog';
import { SMSScheduleListDialog } from '@/components/BulkSMS/SMSScheduleListDialog';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { useFormValidation } from '@/lib/utils/form-validation';
import { useSMSTemplates } from '@/lib/hooks/use-sms-templates';
import { useWizaSMSAccount } from '@/lib/hooks/use-wiza-sms-account';
import { SMSService } from '@/lib/services/sms.service';
import { useUnifiedAccountBalance } from '@/lib/hooks/use-unified-account-balance';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Pupil, Class } from '@/types';
import type { SMSRecipientReviewItem } from '@/lib/utils/sms-recipient-deduplication';
import { getPupilClassDisplay } from '@/lib/utils/class-streams';

interface Recipient {
  name: string;
  phone: string;
  class?: string;
  guardianType: string; // Allow any string for guardian type
}

interface SMSResponse {
  success: boolean;
  message: string;
  recipientCount: number;
  messageId: string;
  cost?: string;
  details?: {
    total: number;
    successful: number;
    failed: number;
    blocked?: number;
    blockedRecipients?: Array<{
      phoneNumber: string;
      network: string;
      status: string;
      reason: string;
      timestamp: string;
    }>;
    failedRecipients?: Array<{
      number: string;
      status: string;
      network: string;
    }>;
    networkSummary?: Array<{
      network: string;
      sent: number;
      failed: number;
      blocked?: number;
      cost: number;
      success: boolean;
      error?: string;
    }>;
    mtnBlocked?: number;
    retryMessage?: string;
  };
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

const MESSAGE_MIN_CHARS = 320;
const MESSAGE_MAX_EXPAND_CHARS = 480;

function getCharacterCountColor(count: number): string {
  if (count === 0) return '#2563eb';
  if (count <= 130) return '#16a34a';
  if (count >= 160) return '#dc2626';
  const ratio = (count - 131) / 29;
  const r = Math.round(22 + (220 - 22) * ratio);
  const g = Math.round(163 + (38 - 163) * ratio);
  const b = Math.round(74 + (38 - 74) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

const BulkSMS: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedGuardians, setSelectedGuardians] = useState<('primary' | 'secondary')[]>([]);
  const [selectedSections, setSelectedSections] = useState<('Boarding' | 'Day')[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<('Male' | 'Female')[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [characterCount, setCharacterCount] = useState<number>(0);
  const [messageCount, setMessageCount] = useState<number>(1);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPupilIds, setSelectedPupilIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<'class' | 'individual'>('class');
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [pendingSmsData, setPendingSmsData] = useState<{
    message: string;
    recipients: SMSRecipientReviewItem[];
  } | null>(null);
  const [smsResult, setSmsResult] = useState<SMSResponse | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showRecharge, setShowRecharge] = useState<boolean>(false);
  const [showWizaDashboard, setShowWizaDashboard] = useState<boolean>(false);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [showScheduleList, setShowScheduleList] = useState<boolean>(false);
  const [wizaBalance, setWizaBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);
  const [lockedBalance, setLockedBalance] = useState<number>(0);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeights, setTextareaHeights] = useState({ min: 0, max: 0 });

  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: templates = [], isLoading: templatesLoading } = useSMSTemplates();
  const {
    invalidateAccountData,
    forceRefreshAccountData,
    triggerActivityRefresh
  } = useWizaSMSAccount();

  // Get the active provider to conditionally show/hide AccountBalance
  const { provider } = useUnifiedAccountBalance();

  // Fetch Wiza SMS live balance
  const fetchWizaBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await fetch('/api/sms/wiza-balance');
      const data = await res.json();
      if (data.success && data.balance !== null) {
        setWizaBalance(data.balance);
      } else {
        setWizaBalance(null);
      }
    } catch {
      setWizaBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWizaBalance();
    const interval = setInterval(fetchWizaBalance, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchWizaBalance]);

  // Fetch locked balance for scheduled SMS
  useEffect(() => {
    const q = query(
      collection(db, 'scheduledSMS'),
      where('status', '==', 'scheduled')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      snapshot.forEach(doc => {
        total += (doc.data().lockedAmount || 0);
      });
      setLockedBalance(total);
    });
    return () => unsubscribe();
  }, []);

  const availableBalance = wizaBalance !== null 
    ? Math.max(0, Number(wizaBalance) - lockedBalance).toString()
    : null;

  // Memoized function to process pupils and generate recipients
  const processRecipients = useCallback(() => {
    if (pupilsLoading || classesLoading) return;

    try {
      // Only process recipients if user has made explicit selections
      if (selectedGuardians.length === 0) {
        setRecipients([]);
        return;
      }

      const activePupils = allPupils.filter((p: Pupil) => p.status === 'Active');
      let targetPupils: Pupil[] = [];

      if (selectionMode === 'class') {
        // Only include pupils from explicitly selected classes
        if (selectedClasses.length > 0) {
          targetPupils = activePupils.filter(pupil => selectedClasses.includes(pupil.classId));
        } else {
          // No classes selected, no recipients
          setRecipients([]);
          return;
        }
      } else {
        // Individual selection mode - only include explicitly selected pupils
        if (selectedPupilIds.length > 0) {
          targetPupils = activePupils.filter(p => selectedPupilIds.includes(p.id));
        } else {
          // No pupils selected, no recipients
          setRecipients([]);
          return;
        }
      }

      // Apply section filter
      if (selectedSections.length > 0) {
        targetPupils = targetPupils.filter(pupil =>
          pupil.section && selectedSections.includes(pupil.section as 'Boarding' | 'Day')
        );
      }

      // Apply gender filter
      if (selectedGenders.length > 0) {
        targetPupils = targetPupils.filter(pupil =>
          pupil.gender && selectedGenders.includes(pupil.gender as 'Male' | 'Female')
        );
      }

      // Generate recipients from filtered pupils
      const formattedRecipients = targetPupils.flatMap((pupil: Pupil) => {
        const recipients: Recipient[] = [];
        const isValidPhone = (phone: string | undefined | null): boolean =>
          !!phone && phone.trim().length > 0;

        const currentClass = classes.find(c => c.id === pupil.classId);
        const className = currentClass?.code || pupil.classId;

        // Get primary guardian
        const primaryGuardian = pupil.guardians?.find(g =>
          g.relationship.toLowerCase().includes('mother') ||
          g.relationship.toLowerCase().includes('father') ||
          g.relationship.toLowerCase().includes('parent')
        ) || pupil.guardians?.[0];

        // Get secondary guardian
        const secondaryGuardian = pupil.guardians?.find(g => g !== primaryGuardian);

        if (selectedGuardians.includes('primary') && primaryGuardian && isValidPhone(primaryGuardian.phone)) {
          // Add primary phone
          recipients.push({
            name: `${pupil.firstName} ${pupil.lastName}`,
            phone: primaryGuardian.phone!.trim(),
            class: className,
            guardianType: 'primary'
          });

          // Add additional phones for primary guardian
          if (primaryGuardian.additionalPhones && primaryGuardian.additionalPhones.length > 0) {
            primaryGuardian.additionalPhones.forEach((additionalPhone, index) => {
              if (isValidPhone(additionalPhone)) {
                recipients.push({
                  name: `${pupil.firstName} ${pupil.lastName}`,
                  phone: additionalPhone.trim(),
                  class: className,
                  guardianType: `primary_${index + 1}`
                });
              }
            });
          }
        }

        if (selectedGuardians.includes('secondary') && secondaryGuardian && isValidPhone(secondaryGuardian.phone)) {
          // Add secondary phone
          recipients.push({
            name: `${pupil.firstName} ${pupil.lastName}`,
            phone: secondaryGuardian.phone!.trim(),
            class: className,
            guardianType: 'secondary'
          });

          // Add additional phones for secondary guardian
          if (secondaryGuardian.additionalPhones && secondaryGuardian.additionalPhones.length > 0) {
            secondaryGuardian.additionalPhones.forEach((additionalPhone, index) => {
              if (isValidPhone(additionalPhone)) {
                recipients.push({
                  name: `${pupil.firstName} ${pupil.lastName}`,
                  phone: additionalPhone.trim(),
                  class: className,
                  guardianType: `secondary_${index + 1}`
                });
              }
            });
          }
        }

        return recipients;
      });

      setRecipients(formattedRecipients);
    } catch (error) {
      console.error('Error processing recipients:', error);
      toast({
        title: 'Error',
        description: 'Failed to process recipients',
        variant: 'destructive',
      });
    }
  }, [
    allPupils,
    classes,
    selectedClasses,
    selectedPupilIds,
    selectedGuardians,
    selectedSections,
    selectedGenders,
    selectionMode,
    pupilsLoading,
    classesLoading,
    toast
  ]);

  // Effect to update recipients when filters change
  useEffect(() => {
    processRecipients();
  }, [processRecipients]);

  // Effect to trigger refresh on page load and user change
  useEffect(() => {
    if (user?.id) {
      triggerActivityRefresh('page-load');
    }
  }, [user?.id, triggerActivityRefresh]);

  // Effect to update character count and message count
  useEffect(() => {
    setCharacterCount(message.length);
    setMessageCount(message.length > 0 ? Math.ceil(message.length / 160) : 1);
  }, [message]);

  const measureTextareaHeights = useCallback(() => {
    const el = messageTextareaRef.current;
    if (!el) return;

    const measure = (charCount: number) => {
      const savedValue = el.value;
      const savedHeight = el.style.height;
      const savedOverflow = el.style.overflowY;

      el.value = charCount > 0 ? '.'.repeat(charCount) : '';
      el.style.height = 'auto';
      el.style.overflowY = 'hidden';
      const height = el.scrollHeight;

      el.value = savedValue;
      el.style.height = savedHeight;
      el.style.overflowY = savedOverflow;
      return height;
    };

    setTextareaHeights({
      min: measure(MESSAGE_MIN_CHARS),
      max: measure(MESSAGE_MAX_EXPAND_CHARS),
    });
  }, []);

  useLayoutEffect(() => {
    measureTextareaHeights();
    window.addEventListener('resize', measureTextareaHeights);
    return () => window.removeEventListener('resize', measureTextareaHeights);
  }, [measureTextareaHeights]);

  useLayoutEffect(() => {
    const el = messageTextareaRef.current;
    const { min, max } = textareaHeights;
    if (!el || min === 0) return;

    el.style.height = 'auto';
    const contentHeight = el.scrollHeight;

    if (characterCount > MESSAGE_MAX_EXPAND_CHARS) {
      el.style.height = `${max}px`;
      el.style.overflowY = 'auto';
      return;
    }

    el.style.height = `${Math.min(max, Math.max(min, contentHeight))}px`;
    el.style.overflowY = 'hidden';
  }, [message, characterCount, textareaHeights]);

  // Preserve pupil and guardian context so repeated family numbers can be
  // reviewed before sending instead of becoming an anonymous phone array.
  const recipientReviewItems = useMemo<SMSRecipientReviewItem[]>(() => [
    ...recipients.map((recipient, index) => ({
      id: `selected-${index}`,
      name: recipient.name,
      phone: recipient.phone,
      className: recipient.class,
      guardianLabel: recipient.guardianType
        .replace('_', ' additional ')
        .replace(/^./, (character) => character.toUpperCase()),
    })),
    ...manualNumbers.map((phone, index) => ({
      id: `manual-${index}`,
      name: 'Manual number',
      phone,
      guardianLabel: 'Manually added',
    })),
  ], [recipients, manualNumbers]);

  // Raw numbers remain available to scheduling; immediate sending is filtered
  // from recipientReviewItems in the confirmation dialog.
  const allRecipients = recipientReviewItems.map((recipient) => recipient.phone);
  const sendValidation = useFormValidation([
    { id: 'bulk-recipients', label: 'Recipients', value: allRecipients, required: true, message: 'Select at least one recipient or add a phone number.' },
    { id: 'bulk-message', label: 'Message', value: message, required: true, message: 'Enter the SMS message to send.' },
  ]);
  const manualNumberValidation = useFormValidation([
    { id: 'manual-phone', label: 'Phone number', value: newNumber, required: true, message: 'Enter the phone number to add.' },
  ]);
  useEffect(() => {
    sendValidation.handleFieldChange('bulk-recipients');
  }, [allRecipients.length]);
  const characterCountColor = getCharacterCountColor(characterCount);

  // Filter pupils for individual selection
  const filteredPupils = allPupils.filter((pupil: Pupil) => {
    if (pupil.status !== 'Active') return false;

    const matchesSearch = searchTerm === '' ||
      `${pupil.firstName} ${pupil.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const handlePupilSelect = (pupilId: string) => {
    setSelectedPupilIds(prev =>
      prev.includes(pupilId)
        ? prev.filter(id => id !== pupilId)
        : [...prev, pupilId]
    );
  };

  const handleSelectAllFilteredPupils = () => {
    const filteredPupilIds = filteredPupils
      .filter(pupil => selectedClasses.includes(pupil.classId))
      .map(pupil => pupil.id);

    if (filteredPupilIds.length === selectedPupilIds.length) {
      setSelectedPupilIds([]);
    } else {
      setSelectedPupilIds(filteredPupilIds);
    }
  };

  const handleClassToggle = (classId: string) => {
    setSelectedClasses(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
    // Trigger refresh on class selection activity
    triggerActivityRefresh('class-selection');
  };

  const handleSelectAllClasses = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map(c => c.id));
    }
    // Trigger refresh on bulk class selection
    triggerActivityRefresh('bulk-class-selection');
  };

  const handleAddNumber = () => {
    if (!manualNumberValidation.validateAll().isValid) return;
    if (!manualNumbers.includes(newNumber.trim())) {
      setManualNumbers(prev => [...prev, newNumber.trim()]);
      setNewNumber('');
      manualNumberValidation.resetValidation();
      toast({
        title: 'Number Added',
        description: `${newNumber.trim()} has been added to recipients`,
      });
    } else if (manualNumbers.includes(newNumber.trim())) {
      manualNumberValidation.setSubmissionError('This phone number is already in the recipient list.');
    }
  };

  const handleRemoveNumber = (number: string) => {
    setManualNumbers(prev => prev.filter(n => n !== number));
  };

  const handleGuardianToggle = (guardianType: 'primary' | 'secondary') => {
    setSelectedGuardians(prev =>
      prev.includes(guardianType)
        ? prev.filter(type => type !== guardianType)
        : [...prev, guardianType]
    );
    // Trigger refresh on guardian selection activity
    triggerActivityRefresh('guardian-selection');
  };

  const handleSectionToggle = (section: 'Boarding' | 'Day') => {
    setSelectedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleGenderToggle = (gender: 'Male' | 'Female') => {
    setSelectedGenders(prev =>
      prev.includes(gender)
        ? prev.filter(g => g !== gender)
        : [...prev, gender]
    );
  };

  const handleSendSMS = async () => {
    if (!sendValidation.validateAll().isValid) return;

    setPendingSmsData({
      message: message.trim(),
      recipients: recipientReviewItems
    });
    setShowConfirmation(true);
  };

  const handleConfirmSend = async (confirmedRecipients: string[]) => {
    if (!pendingSmsData || !user?.id) return;

    if (confirmedRecipients.length === 0) {
      toast({
        title: 'No Recipients Selected',
        description: 'Select at least one recipient before sending.',
        variant: 'destructive',
      });
      return;
    }

    // Close the confirmation dialog immediately
    setShowConfirmation(false);
    setLoading(true);

    // Show immediate feedback that sending has started
    toast({
      title: 'Sending SMS...',
      description: `Sending message to ${confirmedRecipients.length} recipients`,
    });

    try {
      // Trigger activity refresh before sending
      triggerActivityRefresh('sms-send-start');

      const response = await SMSService.sendBulkSMS({
        message: pendingSmsData.message,
        recipients: confirmedRecipients,
        sentBy: user.id
      });

      // Store the result for detailed display
      setSmsResult(response);
      setShowResults(true);

      if (response.success) {
        toast({
          title: 'SMS Sent Successfully',
          description: response.message,
        });
        // Reset only after a confirmed successful send.
        setMessage('');
        setSelectedClasses([]);
        setSelectedGuardians([]);
        setSelectedSections([]);
        setSelectedGenders([]);
        setSelectedPupilIds([]);
        setManualNumbers([]);
        setRecipients([]);
        sendValidation.resetValidation();
      } else {
        sendValidation.setSubmissionError(response.message || 'The SMS message could not be sent. Your message and recipients have been preserved.');
      }

      // Force refresh account data after sending (critical operation)
      await forceRefreshAccountData();
    } catch (error) {
      console.error('SMS sending error:', error);
      sendValidation.setSubmissionError(error instanceof Error ? error.message : 'Failed to send SMS messages. Your message and recipients have been preserved.');
    } finally {
      setLoading(false);
      setPendingSmsData(null);
    }
  };

  const handleCancelSend = () => {
    setShowConfirmation(false);
    setPendingSmsData(null);
  };



  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.content);
      sendValidation.handleFieldChange('bulk-message');
      toast({
        title: 'Template Selected',
        description: `Template "${template.name}" has been loaded`,
      });
      // Trigger refresh on template selection activity
      triggerActivityRefresh('template-selection');
    }
  };

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        title="Bulk SMS"
        subtitle="Send mass text messages and manage parent communications"
        backHref="/dashboard"
        backLabel="Dashboard"
        meta={
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm transition-colors text-xs font-semibold ${
            balanceLoading 
              ? 'bg-gray-50 border-gray-200' 
              : wizaBalance && Number(wizaBalance) < 1000 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <Wallet className="h-3.5 w-3.5" />
            {balanceLoading ? (
              <div className="flex items-center gap-1.5 text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Checking...</span>
              </div>
            ) : wizaBalance !== null ? (
              <div className="flex flex-col items-center leading-tight">
                <span>
                  UGX {Number(availableBalance || wizaBalance).toLocaleString()}
                </span>
                {lockedBalance > 0 ? (
                  <span className="text-[9px] opacity-80 font-medium text-amber-600">
                    ({lockedBalance.toLocaleString()} locked)
                  </span>
                ) : (
                  <span className="text-[9px] opacity-80 font-medium">
                    ~{Math.floor(Number(availableBalance || wizaBalance) / 35).toLocaleString()} SMS
                  </span>
                )}
              </div>
            ) : (
              <span className="text-gray-500">Balance unavailable</span>
            )}
            <button
              onClick={fetchWizaBalance}
              className={`ml-0.5 pt-0.5 rounded-full transition-all ${
                balanceLoading 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : wizaBalance && Number(wizaBalance) < 1000 
                    ? 'text-red-600 hover:bg-red-100' 
                    : 'text-green-600 hover:bg-green-100'
              }`}
              title="Refresh balance"
              disabled={balanceLoading}
            >
              <RefreshCw className={`h-3 w-3 ${balanceLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Recharge"
              icon={<CreditCard className="h-4 w-4" />}
              tone="emerald"
              onClick={() => setShowRecharge(true)}
            />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <GlassActionButton
                  label="More"
                  icon={<Settings className="h-4 w-4" />}
                  tone="slate"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-medium">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">SMS Tools</DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 border-gray-100" />
                <DropdownMenuItem onClick={() => router.push('/sms-templates')} className="cursor-pointer py-2.5">
                  <FileText className="mr-2 h-4 w-4 text-blue-600" />
                  <span>Message Templates</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowWizaDashboard(true)} className="cursor-pointer py-2.5">
                  <Monitor className="mr-2 h-4 w-4 text-purple-600" />
                  <span>Wiza SMS Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 border-gray-100" />
                <DropdownMenuItem onClick={() => setShowSettings(true)} className="cursor-pointer py-2.5">
                  <Settings className="mr-2 h-4 w-4 text-gray-600" />
                  <span>Provider Settings</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </GlassActionDock>
        }
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <WizaSMSDashboard open={showWizaDashboard} onClose={() => setShowWizaDashboard(false)} />

      {/* Recharge Dialog */}
      <WizaRechargeDialog
        open={showRecharge}
        onClose={() => setShowRecharge(false)}
        currentBalance={wizaBalance}
        onRechargeSuccess={() => {
          // refresh balance after a short delay to allow the payment to process
          setTimeout(fetchWizaBalance, 10000);
        }}
      />

      {/* Schedule Dialogs */}
      <SMSScheduleDialog
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        message={message}
        recipientCount={allRecipients.length}
        messageCount={messageCount}
        resolvedPhones={allRecipients}
        selectedClasses={selectedClasses}
        selectedGuardians={selectedGuardians}
        selectedSections={selectedSections}
        selectedGenders={selectedGenders}
        manualNumbers={manualNumbers}
        walletBalance={availableBalance}
        pricePerSMS={35}
      />
      <SMSScheduleListDialog
        open={showScheduleList}
        onClose={() => setShowScheduleList(false)}
      />
      <FormErrorSummary errors={sendValidation.errors} submissionError={sendValidation.submissionError} onSelectError={sendValidation.focusField} />

      <div
        className={`grid grid-cols-1 gap-6 lg:items-start ${
          provider === 'Wiza SMS'
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)]'
        }`}
      >
        {/* Recipients Selection Card */}
        <Card className="h-fit min-w-0 pt-6">
            <CardContent className="space-y-4" data-validation-field="bulk-recipients">
              <FieldError error={sendValidation.getFieldError('bulk-recipients')} />
              <FormErrorSummary errors={manualNumberValidation.errors} submissionError={manualNumberValidation.submissionError} onSelectError={manualNumberValidation.focusField} />
              {/* Classes Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex gap-1.5 flex-1 max-w-[180px]">
                    <Input
                      id="manual-phone"
                      placeholder="Add phone..."
                      value={newNumber}
                      onChange={(e) => { setNewNumber(e.target.value); manualNumberValidation.handleFieldChange('manual-phone'); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNumber();
                        }
                      }}
                      className="h-8 text-xs flex-1"
                      {...manualNumberValidation.getFieldProps('manual-phone')}
                    />
                    <Button
                      onClick={handleAddNumber}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <FieldError error={manualNumberValidation.getFieldError('manual-phone')} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllClasses}
                    className="h-8 text-xs px-2.5 rounded-md"
                  >
                    {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="flex flex-row justify-between w-full gap-1 p-3 bg-gray-50 rounded-lg min-h-[50px]">
                  {classes.map((cls) => (
                    <Badge
                      key={cls.id}
                      variant={selectedClasses.includes(cls.id) ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity text-[10px] py-1 px-1 flex-1 text-center justify-center truncate min-w-0"
                      onClick={() => handleClassToggle(cls.id)}
                    >
                      {cls.code}
                    </Badge>
                  ))}
                </div>
                {selectedClasses.length === 0 && (
                  <p className="text-xs text-red-500">Please select at least one class to continue</p>
                )}
              </div>

              {selectedClasses.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Selection Mode */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-700">Selection Method</p>
                      <div className="flex gap-1.5">
                        <Badge
                          variant={selectionMode === 'class' ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => {
                            setSelectionMode('class');
                            setSelectedPupilIds([]);
                          }}
                        >
                          Class
                        </Badge>
                        <Badge
                          variant={selectionMode === 'individual' ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => setSelectionMode('individual')}
                        >
                          Pupil
                        </Badge>
                      </div>
                    </div>

                    {/* Guardian Selection - Always show this */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-700">Guardian Types <span className="text-red-500">*</span></p>
                      <div className="flex gap-1.5">
                        <Badge
                          variant={selectedGuardians.includes('primary') ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => handleGuardianToggle('primary')}
                        >
                          Primary
                        </Badge>
                        <Badge
                          variant={selectedGuardians.includes('secondary') ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => handleGuardianToggle('secondary')}
                        >
                          Secondary
                        </Badge>
                      </div>
                      {selectedGuardians.length === 0 && (
                        <p className="text-[9px] text-red-500 mt-1">Required</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Section Selection */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-700">Section</p>
                      <div className="flex gap-1.5">
                        <Badge
                          variant={selectedSections.includes('Boarding') ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => handleSectionToggle('Boarding')}
                        >
                          Boarding
                        </Badge>
                        <Badge
                          variant={selectedSections.includes('Day') ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => handleSectionToggle('Day')}
                        >
                          Day
                        </Badge>
                      </div>
                    </div>

                    {/* Gender Selection */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-700">Gender</p>
                      <div className="flex gap-1.5">
                        <Badge
                          variant={selectedGenders.includes('Male') ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => handleGenderToggle('Male')}
                        >
                          Male
                        </Badge>
                        <Badge
                          variant={selectedGenders.includes('Female') ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-1 text-[10px] font-semibold"
                          onClick={() => handleGenderToggle('Female')}
                        >
                          Female
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {selectionMode === 'individual' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">Select Pupils</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAllFilteredPupils}
                          className="h-7 text-xs px-2"
                        >
                          {filteredPupils.length === selectedPupilIds.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                      <Input
                        type="text"
                        placeholder="Search pupils..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mb-1 h-8 text-sm"
                      />
                      <div className="max-h-[250px] overflow-y-auto border rounded-lg bg-gray-50">
                        {filteredPupils
                          .filter(pupil => selectedClasses.includes(pupil.classId))
                          .map((pupil) => (
                            <div
                              key={pupil.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 transition-colors border-b last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPupilIds.includes(pupil.id)}
                                onChange={() => handlePupilSelect(pupil.id)}
                                className="rounded border-gray-300 text-primary focus:ring-primary w-3.5 h-3.5"
                              />
                              <span className="flex-1 text-sm">{pupil.firstName} {pupil.lastName}</span>
                              <div className="flex flex-col items-end">
                                <span className="text-sm text-gray-500">
                                  {getPupilClassDisplay(pupil, classes.find(c => c.id === pupil.classId)).code || pupil.classId}
                                </span>
                                {pupil.gender && pupil.section && (
                                  <span className="text-xs text-gray-400">
                                    {pupil.gender} • {pupil.section}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Manual Numbers Chips List */}
              {manualNumbers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-lg">
                  {manualNumbers.map((number) => (
                    <div
                      key={number}
                      className="flex items-center gap-1 bg-white border px-2 py-0.5 rounded-full text-xs shadow-sm"
                    >
                      {number}
                      <button
                        onClick={() => handleRemoveNumber(number)}
                        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
        </Card>

        {/* Message + SMS Cost */}
        <div className="flex flex-col gap-6 min-w-0 lg:col-start-2">
          <Card className="h-fit pt-6">
            <CardContent className="space-y-5">
              <div className="space-y-4">
                <Textarea
                  id="bulk-message"
                  ref={messageTextareaRef}
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setMessage(e.target.value); sendValidation.handleFieldChange('bulk-message'); }}
                  className="resize-none overflow-hidden"
                  {...sendValidation.getFieldProps('bulk-message')}
                />
                <FieldError error={sendValidation.getFieldError('bulk-message')} />
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-sm px-1 text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums font-medium">
                        <span style={{ color: characterCountColor, transition: 'color 0.2s ease' }}>
                          {characterCount}
                        </span>
                        <span>/160</span>
                      </span>
                      {characterCount > 160 && (
                        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-medium">
                          Exceeds 160 limit
                        </span>
                      )}
                    </div>
                    <span>
                      Message count: <span className={characterCount > 160 ? 'font-bold text-red-600' : ''}>{messageCount}</span>
                    </span>
                  </div>

                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, (characterCount / 160) * 100)}%`,
                        backgroundColor: characterCountColor,
                        transition: 'width 0.3s ease-in-out, background-color 0.2s ease',
                      }}
                    />
                  </div>

                  {characterCount > 160 && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded-md">
                      Warning: Your message exceeds 160 characters and will be charged as {messageCount} separate SMS messages.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
                <Select onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="h-9 w-full sm:w-[220px]">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    onClick={handleSendSMS}
                    disabled={loading}
                    size="sm"
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-full px-4 h-9"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send
                      </>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        aria-label="Schedule SMS"
                        className="h-9 w-9 bg-green-600 hover:bg-green-700 text-white rounded-full shrink-0"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">SMS Scheduling</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowSchedule(true)} className="cursor-pointer">
                        <Calendar className="mr-2 h-4 w-4 text-blue-600" />
                        Schedule SMS
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowScheduleList(true)} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4 text-indigo-600" />
                        Schedule List
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>

          <SMSCostCalculator
            recipientCount={recipients.length + manualNumbers.length}
            messageCount={messageCount}
            pricePerSMS={35}
            currency="UGX"
            walletBalance={availableBalance}
          />
        </div>

        {/* Account Information Sidebar */}
        {provider !== 'Wiza SMS' && (
          <div className="min-w-0 lg:col-start-3">
            <AccountBalance />
          </div>
        )}
      </div>

      {/* SMS Confirmation Dialog */}
      <SMSConfirmationDialog
        open={showConfirmation}
        onClose={handleCancelSend}
        message={pendingSmsData?.message || ''}
        recipients={pendingSmsData?.recipients || []}
        onConfirm={handleConfirmSend}
      />

      {/* SMS Results Dialog */}
      <SMSResultDialog
        open={showResults}
        onClose={() => setShowResults(false)}
        result={smsResult}
        originalMessage={pendingSmsData?.message || ''}
        sentBy={user?.id || ''}
      />

      {/* SMS Settings Modal */}
      <SMSSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </div>
    </div>
  );
};

export default BulkSMS;
