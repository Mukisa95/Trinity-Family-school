"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Plus, X, Users, MessageSquare, Settings } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SMSConfirmationDialog from '@/components/BulkSMS/SMSConfirmationDialog';
import SMSResultDialog from '@/components/BulkSMS/SMSResultDialog';
import { AccountBalance } from '@/components/BulkSMS/AccountBalance';
import SMSSettingsModal from '@/components/BulkSMS/SMSSettingsModal';
import { WizaSMSDashboard } from '@/components/BulkSMS/WizaSMSDashboard';
import { SMSCostCalculator } from '@/components/BulkSMS/SMSCostCalculator';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSMSTemplates } from '@/lib/hooks/use-sms-templates';
import { useAfricasTalkingAccount } from '@/lib/hooks/use-africas-talking-account';
import { SMSService } from '@/lib/services/sms.service';
import { useUnifiedAccountBalance } from '@/lib/hooks/use-unified-account-balance';
import type { Pupil, Class } from '@/types';

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
    recipients: string[];
  } | null>(null);
  const [smsResult, setSmsResult] = useState<SMSResponse | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const { data: allPupils = [], isLoading: pupilsLoading } = usePupils();
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: templates = [], isLoading: templatesLoading } = useSMSTemplates();
  const { 
    invalidateAccountData, 
    forceRefreshAccountData, 
    triggerActivityRefresh 
  } = useAfricasTalkingAccount();
  
  // Get the active provider to conditionally show/hide AccountBalance
  const { provider } = useUnifiedAccountBalance();

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

  // Get all recipients including manual numbers
  const allRecipients = [...recipients.map(r => r.phone), ...manualNumbers];

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
    if (newNumber.trim() && !manualNumbers.includes(newNumber.trim())) {
      setManualNumbers(prev => [...prev, newNumber.trim()]);
      setNewNumber('');
      toast({
        title: 'Number Added',
        description: `${newNumber.trim()} has been added to recipients`,
      });
    } else if (manualNumbers.includes(newNumber.trim())) {
      toast({
        title: 'Duplicate Number',
        description: 'This number is already in the list',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Invalid Number',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
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
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (allRecipients.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one recipient',
        variant: 'destructive',
      });
      return;
    }

    setPendingSmsData({
      message: message.trim(),
      recipients: allRecipients
    });
    setShowConfirmation(true);
  };

  const handleConfirmSend = async () => {
    if (!pendingSmsData || !user?.id) return;

    // Close the confirmation dialog immediately
    setShowConfirmation(false);
    setLoading(true);
    
    // Show immediate feedback that sending has started
    toast({
      title: 'Sending SMS...',
      description: `Sending message to ${pendingSmsData.recipients.length} recipients`,
    });
    
    try {
      // Trigger activity refresh before sending
      triggerActivityRefresh('sms-send-start');

      const response = await SMSService.sendBulkSMS({
        message: pendingSmsData.message,
        recipients: pendingSmsData.recipients,
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
      } else {
        // Show warning for blocked MTN numbers (only when using Africa's Talking)
        if (response.details?.mtnBlocked && response.details.mtnBlocked > 0) {
          toast({
            title: 'MTN Numbers Blocked',
            description: `${response.details.mtnBlocked} MTN numbers were blocked to prevent charges for undelivered messages (Africa's Talking has delivery issues with MTN).`,
            variant: 'destructive',
          });
        } else if (response.success) {
          // Check if any MTN numbers were included in successful send
          const mtnNumbers = pendingSmsData.recipients.filter(phone => {
            const cleanNumber = phone.replace(/[\s\-\(\)\+]/g, '');
            let localNumber = cleanNumber;
            if (cleanNumber.startsWith('256')) {
              localNumber = cleanNumber.substring(3);
            }
            if (localNumber.startsWith('0')) {
              localNumber = localNumber.substring(1);
            }
            return localNumber.match(/^(77|78|76|39)/);
          });
          
          if (mtnNumbers.length > 0) {
            toast({
              title: 'SMS Sent Successfully (Including MTN)',
              description: `Messages sent to ${response.recipientCount} recipients, including ${mtnNumbers.length} MTN numbers via Wiza SMS.`,
            });
          } else {
            toast({
              title: 'SMS Sent Successfully',
              description: response.message,
            });
          }
        } else {
          toast({
            title: 'SMS Sending Failed',
            description: response.message,
            variant: 'destructive',
          });
        }
      }
      
      // Reset form
      setMessage('');
      setSelectedClasses([]);
      setSelectedGuardians([]);
      setSelectedSections([]);
      setSelectedGenders([]);
      setSelectedPupilIds([]);
      setManualNumbers([]);
      setRecipients([]);
      
      // Force refresh account data after sending (critical operation)
      await forceRefreshAccountData();
    } catch (error) {
      console.error('SMS sending error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send SMS messages',
        variant: 'destructive',
      });
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
      toast({
        title: 'Template Selected',
        description: `Template "${template.name}" has been loaded`,
      });
      // Trigger refresh on template selection activity
      triggerActivityRefresh('template-selection');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-gray-900">Bulk SMS</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            SMS Settings
          </Button>
          <WizaSMSDashboard />
        </div>
      </div>

      <div className={`grid gap-6 ${provider === 'Wiza SMS' ? 'lg:grid-cols-[1fr,1.2fr]' : 'lg:grid-cols-[1fr,1.2fr,0.8fr]'}`}>
        {/* Recipients Selection Card */}
        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recipients
              </CardTitle>
              <CardDescription>Select message recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
            {/* Classes Selection */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-gray-700">Classes <span className="text-red-500">*</span></p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllClasses}
                  className="h-8"
                >
                  {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg min-h-[60px]">
                {classes.map((cls) => (
                  <Badge
                    key={cls.id}
                    variant={selectedClasses.includes(cls.id) ? "default" : "outline"}
                    className="cursor-pointer hover:opacity-80 transition-opacity text-sm py-1 px-3"
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
                {/* Selection Mode */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Selection Method</p>
                  <div className="flex gap-3">
                    <Badge
                      variant={selectionMode === 'class' ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => {
                        setSelectionMode('class');
                        setSelectedPupilIds([]);
                      }}
                    >
                      By Class
                    </Badge>
                    <Badge
                      variant={selectionMode === 'individual' ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => setSelectionMode('individual')}
                    >
                      Individual Selection
                    </Badge>
                  </div>
                </div>

                {/* Guardian Selection - Always show this */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Guardian Types <span className="text-red-500">*</span></p>
                  <p className="text-xs text-gray-500">Select which guardians to send messages to</p>
                  <div className="flex gap-3">
                    <Badge
                      variant={selectedGuardians.includes('primary') ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => handleGuardianToggle('primary')}
                    >
                      Primary Guardian
                    </Badge>
                    <Badge
                      variant={selectedGuardians.includes('secondary') ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => handleGuardianToggle('secondary')}
                    >
                      Secondary Guardian
                    </Badge>
                  </div>
                  {selectedGuardians.length === 0 && (
                    <p className="text-xs text-red-500">Please select at least one guardian type</p>
                  )}
                </div>

                {/* Section Selection */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Section</p>
                  <div className="flex gap-3">
                    <Badge
                      variant={selectedSections.includes('Boarding') ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => handleSectionToggle('Boarding')}
                    >
                      Boarding
                    </Badge>
                    <Badge
                      variant={selectedSections.includes('Day') ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => handleSectionToggle('Day')}
                    >
                      Day
                    </Badge>
                  </div>
                </div>

                {/* Gender Selection */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Gender</p>
                  <div className="flex gap-3">
                    <Badge
                      variant={selectedGenders.includes('Male') ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => handleGenderToggle('Male')}
                    >
                      Male
                    </Badge>
                    <Badge
                      variant={selectedGenders.includes('Female') ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity flex-1 justify-center py-2.5 text-sm"
                      onClick={() => handleGenderToggle('Female')}
                    >
                      Female
                    </Badge>
                  </div>
                </div>

                {selectionMode === 'individual' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Select Pupils</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllFilteredPupils}
                        className="h-8"
                      >
                        {filteredPupils.length === selectedPupilIds.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    <Input
                      type="text"
                      placeholder="Search pupils..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-[300px] overflow-y-auto border rounded-lg bg-gray-50">
                      {filteredPupils
                        .filter(pupil => selectedClasses.includes(pupil.classId))
                        .map((pupil) => (
                          <div
                            key={pupil.id}
                            className="flex items-center space-x-2 p-3 hover:bg-gray-100 transition-colors border-b last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPupilIds.includes(pupil.id)}
                              onChange={() => handlePupilSelect(pupil.id)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="flex-1">{pupil.firstName} {pupil.lastName}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-sm text-gray-500">
                                {classes.find(c => c.id === pupil.classId)?.code || pupil.classId}
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

            {/* Manual Numbers */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Additional Numbers</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Add phone number..."
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNumber();
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  onClick={handleAddNumber}
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {manualNumbers.length > 0 && (
                <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg">
                  {manualNumbers.map((number) => (
                    <div
                      key={number}
                      className="flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-full text-sm shadow-sm"
                    >
                      {number}
                      <button
                        onClick={() => handleRemoveNumber(number)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* SMS Cost Calculator */}
        <SMSCostCalculator
          recipientCount={recipients.length + manualNumbers.length}
          messageCount={messageCount}
          pricePerSMS={35}
          currency="UGX"
        />
      </div>

        {/* Message Composition Card */}
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Message
            </CardTitle>
            <CardDescription>Compose your message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-4">
              <Select onValueChange={handleTemplateSelect}>
                <SelectTrigger className="h-11">
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

              <Textarea
                placeholder="Type your message here..."
                value={message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <div className="flex flex-col space-y-2">
                <div className={`flex items-center justify-between text-sm px-1 ${characterCount > 160 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  <div className="flex items-center">
                    <span>Characters: {characterCount}</span>
                    {characterCount > 160 && (
                      <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-medium">
                        Exceeds 160 limit
                      </span>
                    )}
                  </div>
                  <span>
                    Message count: <span className={characterCount > 160 ? 'font-bold' : ''}>{messageCount}</span>
                  </span>
                </div>
                
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      characterCount <= 160 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, (characterCount / 160) * 100)}%`,
                      transition: 'width 0.3s ease-in-out'
                    }}
                  />
                </div>
                
                <div className="text-xs text-center">
                  {characterCount <= 160 ? (
                    <span className="text-green-600">
                      {160 - characterCount} characters remaining in this SMS
                    </span>
                  ) : (
                    <span className="text-amber-600">
                      {160 - (characterCount % 160 || 160)} characters remaining in SMS #{messageCount}
                    </span>
                  )}
                </div>
                
                {characterCount > 160 && (
                  <div className="text-xs text-red-500 bg-red-50 p-2 rounded-md">
                    Warning: Your message exceeds 160 characters and will be charged as {messageCount} separate SMS messages.
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500 px-1 mt-2">
                  <span>Recipients: {recipients.length + manualNumbers.length}</span>
                  {recipients.length + manualNumbers.length === 0 && (
                    <span className="text-amber-600 text-xs">No recipients selected</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleSendSMS}
              disabled={loading || !message.trim() || allRecipients.length === 0}
              className="w-full h-12 text-base"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Messages'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Information Sidebar */}
        <div className="space-y-6">
          {/* Account Balance - Hidden for Wiza SMS since we have the embedded dashboard */}
          {provider !== 'Wiza SMS' && <AccountBalance />}
        </div>
      </div>

      {/* SMS Confirmation Dialog */}
      <SMSConfirmationDialog
        open={showConfirmation}
        onClose={handleCancelSend}
        message={pendingSmsData?.message || ''}
        recipientCount={pendingSmsData?.recipients.length || 0}
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
  );
};

export default BulkSMS; 