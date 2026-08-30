"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { SchoolSettings } from "@/types";
import { sampleSchoolSettings } from "@/lib/sample-data";
import { Badge } from "@/components/ui/badge";
import { Edit3, Save, XCircle, School, Landmark, Phone, Mail, Globe, User, Edit, MessageSquare, MessageCircle, BookMarked, Users2, Info, Facebook, Twitter, Instagram, Linkedin, Loader2, Clock, CheckCircle2, Image as ImageIcon, Upload, RefreshCw } from "lucide-react";
import { useSchoolSettings, useUpdateSchoolSettings, useInitializeSchoolSettings } from "@/lib/hooks/use-school-settings";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { House } from "@/types";
import { useCreateHouse, useHouses, useUpdateHouse } from "@/lib/hooks/use-houses";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/contexts/auth-context";
import { usePupils, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useTerms } from "@/lib/hooks/use-terms";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { isTermEnded } from "@/lib/utils/academic-year-utils";
import { FieldError, FormErrorSummary } from "@/components/ui/form-feedback";
import { useFormValidation } from "@/lib/utils/form-validation";

// Helper to display N/A for empty values in view mode
const displayValue = (value: string | undefined | null, prefix = "", suffix = "") => {
  return value ? `${prefix}${value}${suffix}` : <span className="text-muted-foreground italic">N/A</span>;
};

// Define types for sections and fields for better type safety
type SchoolSettingSection = keyof SchoolSettings;
type SchoolSettingField<S extends SchoolSettingSection> = any;

interface EditItemProps<S extends SchoolSettingSection> {
  label: string;
  value: string | undefined;
  section: S;
  field: SchoolSettingField<S>;
  onSettingChange: (section: S, field: SchoolSettingField<S>, value: string) => void;
  placeholder?: string;
  isTextarea?: boolean;
  name: string; // Unique name for id and htmlFor
}

const EditItem = React.memo(function EditItemComponent<S extends SchoolSettingSection>({
  label,
  value,
  section,
  field,
  onSettingChange,
  placeholder,
  isTextarea,
  name,
}: EditItemProps<S>) {
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onSettingChange(section, field, e.target.value);
    },
    [section, field, onSettingChange]
  );

  return (
    <div className="mb-3">
      <Label htmlFor={name} className="text-sm font-medium">{label}</Label>
      {isTextarea ? (
        <Textarea id={name} name={name} value={value || ""} onChange={handleChange} placeholder={placeholder || label} className="mt-1" rows={3} />
      ) : (
        <Input id={name} name={name} type="text" value={value || ""} onChange={handleChange} placeholder={placeholder || label} className="mt-1" />
      )}
    </div>
  );
});
EditItem.displayName = "EditItem";


export default function AboutSchoolPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Firebase hooks - optimized with cache-first and real-time sync
  const { data: settings, isLoading, isFetching, error } = useSchoolSettings();
  const updateSettingsMutation = useUpdateSchoolSettings();
  const initializeSettingsMutation = useInitializeSchoolSettings();
  
  // Pupils and terms hooks for pending status management
  const { data: allPupils = [] } = usePupils();
  const updatePupilMutation = useUpdatePupil();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: terms = [] } = useTerms();
  const { termStatus } = useTermStatus();
  
  // Use sample data as fallback if no settings exist in Firebase
  // Always ensure we have settings to render - never show blank page
  const currentSettings = React.useMemo(() => {
    return settings || sampleSchoolSettings;
  }, [settings]);
  
  // Optimized loading state: never show spinner since we always have sampleSchoolSettings
  // The page should always render immediately with sample data, then update with Firebase data
  const showLoadingSpinner = false;
  
  // Update UI instantly when data becomes available
  React.useEffect(() => {
    if (settings !== undefined) {
      flushSync(() => {
        // Force immediate DOM update when cached data is available
      });
    }
  }, [settings]);
  
  // Initialize state with currentSettings (always available due to sampleSchoolSettings fallback)
  const [editableSettings, setEditableSettings] = React.useState<SchoolSettings>(currentSettings);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isActivatingPending, setIsActivatingPending] = React.useState(false);

  const [logoPreview, setLogoPreview] = React.useState<string | null>(currentSettings.generalInfo.logo || null);
  const [signaturePreview, setSignaturePreview] = React.useState<string | null>(currentSettings.headTeacher.signature || null);
  
  // App Icon Generation state
  const [appIconFile, setAppIconFile] = React.useState<File | null>(null);
  const [appIconPreview, setAppIconPreview] = React.useState<string | null>(null);
  const [isGeneratingIcons, setIsGeneratingIcons] = React.useState(false);
  const [iconGenerationResults, setIconGenerationResults] = React.useState<any>(null);

  // Houses state and handlers
  const { data: houses = [], isLoading: housesLoading } = useHouses();
  const createHouseMutation = useCreateHouse();
  const updateHouseMutation = useUpdateHouse();
  const [isHouseDialogOpen, setIsHouseDialogOpen] = React.useState<boolean>(false);
  const [editingHouse, setEditingHouse] = React.useState<House | null>(null);
  const [houseForm, setHouseForm] = React.useState<{ name: string; motto: string; themeColor: string }>({
    name: "",
    motto: "",
    themeColor: "#3b82f6",
  });
  const houseValidation = useFormValidation([
    { id: 'houseName', label: 'House name', value: houseForm.name, required: true, message: 'Enter the school house name.' },
    {
      id: 'houseColorText',
      focusTargetId: 'houseColorText',
      label: 'Theme color',
      value: houseForm.themeColor,
      required: true,
      message: 'Enter the house theme color.',
      validate: value => /^#[0-9A-Fa-f]{6}$/.test(String(value)) ? undefined : 'Enter a valid six-digit HEX color such as #FF0000.',
    },
  ]);
  const resetHouseForm = () => {
    setEditingHouse(null);
    setHouseForm({ name: "", motto: "", themeColor: "#3b82f6" });
    houseValidation.resetValidation();
  };
  const openCreateHouse = () => {
    resetHouseForm();
    setIsHouseDialogOpen(true);
  };
  const openEditHouse = (house: House) => {
    setEditingHouse(house);
    setHouseForm({
      name: house.name || "",
      motto: house.motto || "",
      themeColor: house.themeColor || "#3b82f6",
    });
    setIsHouseDialogOpen(true);
  };
  // Update editable settings when Firebase data changes
  React.useEffect(() => {
    if (currentSettings && !isEditing) {
      // Ensure pending settings have default values if they exist
      const settingsWithDefaults = {
        ...currentSettings,
        pending: currentSettings.pending ? {
          ...currentSettings.pending,
          timeOfEffect: currentSettings.pending.timeOfEffect || 'end_of_term',
          affectedComponents: currentSettings.pending.affectedComponents || {},
        } : undefined,
      };
      // Use flushSync to ensure immediate UI update
      flushSync(() => {
      setEditableSettings(settingsWithDefaults);
      setLogoPreview(currentSettings.generalInfo.logo || null);
      setSignaturePreview(currentSettings.headTeacher.signature || null);
      });
    }
  }, [currentSettings, isEditing]);

  const handleSettingChange = React.useCallback(
    <S extends SchoolSettingSection>(
      section: S,
      field: SchoolSettingField<S>,
      value: string
    ) => {
      setEditableSettings((prev) => {
        const prevSection = prev[section] || {};
        const updatedSection = {
          ...prevSection,
          [field]: value,
        };
        return {
          ...prev,
          [section]: updatedSection,
        };
      });
    },
    [] // setEditableSettings is stable
  );
  
  const handleFileChange = React.useCallback(
    <S extends SchoolSettingSection>(
    e: React.ChangeEvent<HTMLInputElement>,
    section: S,
    field: SchoolSettingField<S>,
    isLogo: boolean
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setEditableSettings(prev => {
          const prevSection = prev[section] || {};
          const updatedSection = {
            ...prevSection,
            [field]: result as any, // Cast as any, ensure field type matches string
          };
          return {
            ...prev,
            [section]: updatedSection,
          };
        });
        if (isLogo) {
          setLogoPreview(result);
        } else {
          setSignaturePreview(result);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = ''; 
    }
  }, [] // setEditableSettings is stable
);


  const handleSaveChanges = async () => {
    try {
      const wasPendingEnabled = currentSettings.pending?.enabled;
      const isPendingEnabled = editableSettings.pending?.enabled;
      
      // If pending is being enabled for the first time, check if it's the right time based on "Time of Effect"
      if (!wasPendingEnabled && isPendingEnabled) {
        const timeOfEffect = editableSettings.pending?.timeOfEffect || 'end_of_term';
        let shouldSetPending = false;
        let pendingReason = '';
        
        // Check if it's the right time to set pupils to Pending based on "Time of Effect" setting
        if (timeOfEffect === 'end_of_term') {
          // Check if current term has ended
          if (termStatus.currentTerm) {
            const termHasEnded = isTermEnded(termStatus.currentTerm);
            shouldSetPending = termHasEnded;
            pendingReason = termHasEnded 
              ? 'Automatically set to Pending at end of term based on school settings'
              : `Term has not ended yet. Pupils will be set to Pending when term ends (${new Date(termStatus.currentTerm.endDate).toLocaleDateString()})`;
          } else if (termStatus.previousTerm) {
            // If we're in recess/holiday and there's a previous term, that term has ended
            shouldSetPending = true;
            pendingReason = 'Automatically set to Pending at end of term based on school settings';
          } else {
            // No current or previous term found
            shouldSetPending = false;
            pendingReason = 'Cannot determine term status. Please check academic year settings.';
          }
        } else if (timeOfEffect === 'beginning_of_next_term') {
          // Check if we're at the beginning of the next term (within first few days)
          if (termStatus.currentTerm && termStatus.nextTerm) {
            const today = new Date();
            const nextTermStart = new Date(termStatus.nextTerm.startDate);
            const daysSinceTermStart = Math.floor((today.getTime() - nextTermStart.getTime()) / (1000 * 60 * 60 * 24));
            // Consider "beginning" as first 7 days of term
            shouldSetPending = daysSinceTermStart >= 0 && daysSinceTermStart <= 7;
            pendingReason = shouldSetPending
              ? 'Automatically set to Pending at beginning of next term based on school settings'
              : `Next term starts on ${nextTermStart.toLocaleDateString()}. Pupils will be set to Pending at the beginning of that term.`;
          } else {
            // Not at beginning of next term yet
            shouldSetPending = false;
            pendingReason = termStatus.nextTerm 
              ? `Next term starts on ${new Date(termStatus.nextTerm.startDate).toLocaleDateString()}. Pupils will be set to Pending then.`
              : 'Cannot determine next term. Pupils will be set to Pending when next term begins.';
          }
        }
        
        // Update settings first with activation date, preserving all pending settings including timeOfEffect
        const settingsWithActivation = {
          ...editableSettings,
          pending: {
            enabled: true,
            affectedComponents: editableSettings.pending?.affectedComponents || {},
            timeOfEffect: timeOfEffect,
            activationDate: new Date().toISOString(),
            activatedBy: user?.id || 'system',
          },
        };
        
        if (settings) {
          await updateSettingsMutation.mutateAsync(settingsWithActivation);
        } else {
          await initializeSettingsMutation.mutateAsync(settingsWithActivation);
        }
        
        // Only set pupils to Pending if it's the right time
        if (shouldSetPending) {
          setIsActivatingPending(true);
          
          // Now set all active pupils to Pending status
          const activePupils = allPupils.filter(p => p.status === 'Active');
          let updatedCount = 0;
          
          for (const pupil of activePupils) {
            try {
              const statusChangeEntry = {
                date: new Date().toISOString(),
                fromStatus: pupil.status,
                toStatus: 'Pending' as const,
                reason: pendingReason,
                processedBy: (user?.firstName && user?.lastName) ? `${user.firstName} ${user.lastName}` : user?.email || 'System',
              };
              
              const { id, createdAt, ...updateData } = pupil;
              await updatePupilMutation.mutateAsync({
                id: pupil.id,
                data: {
                  ...updateData,
                  status: 'Pending',
                  statusChangeHistory: [...(pupil.statusChangeHistory || []), statusChangeEntry],
                },
              });
              updatedCount++;
            } catch (err) {
              console.error(`Failed to update pupil ${pupil.id}:`, err);
            }
          }
          
          setIsActivatingPending(false);
          
          toast({ 
            title: "Pending Status Activated", 
            description: `Settings saved. ${updatedCount} pupils have been set to Pending status.` 
          });
        } else {
          // Settings saved but pupils not set to Pending yet - it's not the right time
          toast({ 
            title: "Pending Settings Saved", 
            description: pendingReason || "Settings saved. Pupils will be automatically set to Pending based on the 'Time of Effect' setting.",
            variant: "default"
          });
        }
      } else {
        // Normal save without pending activation - ensure pending settings are preserved properly
        const settingsToSave = {
          ...editableSettings,
          pending: editableSettings.pending ? {
            enabled: editableSettings.pending.enabled || false,
            affectedComponents: editableSettings.pending.affectedComponents || {},
            timeOfEffect: editableSettings.pending.timeOfEffect || 'end_of_term',
            ...(editableSettings.pending.activationDate && {
              activationDate: editableSettings.pending.activationDate,
            }),
            ...(editableSettings.pending.activatedBy && {
              activatedBy: editableSettings.pending.activatedBy,
            }),
          } : undefined,
        };
        
        if (settings) {
          await updateSettingsMutation.mutateAsync(settingsToSave);
        } else {
          await initializeSettingsMutation.mutateAsync(settingsToSave);
        }
        
        toast({ 
          title: "School Details Updated", 
          description: "Changes have been saved successfully to Firebase." 
        });
      }
      
      setIsEditing(false);
    } catch (error) {
      setIsActivatingPending(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save school settings. Please try again.",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditableSettings(currentSettings); 
    setLogoPreview(currentSettings.generalInfo.logo || null);
    setSignaturePreview(currentSettings.headTeacher.signature || null);
    setIsEditing(false);
  };
  
  // Handle app icon file selection
  const handleAppIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload an image file (PNG, JPEG, or WebP).",
        });
        return;
      }
      
      setAppIconFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAppIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle app icon generation
  const handleGenerateAppIcons = async () => {
    if (!appIconFile) {
      toast({
        variant: "destructive",
        title: "No File Selected",
        description: "Please select an image file first.",
      });
      return;
    }

    setIsGeneratingIcons(true);
    setIconGenerationResults(null);
    try {
      const formData = new FormData();
      formData.append('icon', appIconFile);
      
      const response = await fetch('/api/generate-app-icons', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Icons Generated Successfully!",
          description: `${data.summary.success} app icons have been generated. Clear your browser cache and reinstall the PWA to see changes.`,
        });
        setIconGenerationResults(data);
      } else {
        toast({
          variant: "destructive",
          title: "Icon Generation Failed",
          description: data.error || data.message || "Failed to generate icons. Please try again.",
        });
        setIconGenerationResults(data);
      }
    } catch (error) {
      console.error('Error generating app icons:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate app icons. Please try again.",
      });
    } finally {
      setIsGeneratingIcons(false);
    }
  };
  
  // Reset app icon state
  const handleResetAppIcon = () => {
    setAppIconFile(null);
    setAppIconPreview(null);
    setIconGenerationResults(null);
  };
  
  const DetailItem: React.FC<{ label: string; value: React.ReactNode; icon?: React.ElementType }> = ({ label, value, icon: Icon }) => (
    <div className="mb-2">
      <Label className="text-sm font-medium text-muted-foreground flex items-center">
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {label}
      </Label>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );

  // Only show loading spinner when no cached data exists
  if (showLoadingSpinner) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading school settings...</span>
      </div>
    );
  }

  // Only show error if we have a confirmed error AND no settings at all
  // Since we have sampleSchoolSettings, this should rarely happen
  if (error && !settings && !sampleSchoolSettings) {
    return (
      <div className="text-center text-destructive py-12">
        <p>Error loading school settings. Please try again.</p>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline" 
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }
  
  // Ensure we always have settings to render (should never be null/undefined)
  if (!currentSettings) {
    // This should never happen due to sampleSchoolSettings fallback, but just in case
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Initializing...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        title="About School"
        subtitle="View and manage your school's information."
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <GlassActionDock>
            {!isEditing ? (
              <GlassActionButton
                label="Edit Details"
                icon={<Edit3 className="h-4 w-4" />}
                tone="purple"
                onClick={() => setIsEditing(true)}
                title="Edit school settings"
              />
            ) : (
              <>
                <GlassActionButton
                  label="Save Changes"
                  icon={(updateSettingsMutation.isPending || initializeSettingsMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  tone="emerald"
                  disabled={updateSettingsMutation.isPending || initializeSettingsMutation.isPending}
                  onClick={handleSaveChanges}
                  title="Save school settings changes"
                />
                <GlassActionButton
                  label="Cancel"
                  icon={<XCircle className="h-4 w-4" />}
                  tone="slate"
                  onClick={handleCancelEdit}
                  title="Cancel editing"
                />
              </>
            )}
          </GlassActionDock>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center"><Landmark className="mr-2 h-5 w-5 text-primary" /> General Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <>
                <EditItem section="generalInfo" field="name" label="School Name" name="schoolName" value={editableSettings.generalInfo.name} onSettingChange={handleSettingChange} placeholder="e.g., Bright Future Academy" />
                <div className="mb-3">
                  <Label htmlFor="logo" className="text-sm font-medium">School Logo</Label>
                  {logoPreview && <Image src={logoPreview} alt="Logo Preview" width={100} height={100} className="my-2 rounded-md border object-contain" data-ai-hint="school logo" />}
                  <Input id="logo" name="logo" type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => handleFileChange(e, 'generalInfo', 'logo', true)} className="mt-1" />
                </div>
                <EditItem section="generalInfo" field="motto" label="Motto" name="motto" value={editableSettings.generalInfo.motto} onSettingChange={handleSettingChange} placeholder="e.g., Striving for Excellence" />
                <EditItem section="generalInfo" field="establishedYear" label="Established Year" name="establishedYear" value={editableSettings.generalInfo.establishedYear} onSettingChange={handleSettingChange} placeholder="e.g., 1990" />
                <EditItem section="generalInfo" field="schoolType" label="School Type" name="schoolType" value={editableSettings.generalInfo.schoolType} onSettingChange={handleSettingChange} placeholder="e.g., Mixed Day & Boarding" />
                <EditItem section="generalInfo" field="registrationNumber" label="Registration Number" name="registrationNumber" value={editableSettings.generalInfo.registrationNumber} onSettingChange={handleSettingChange} placeholder="e.g., MOE/SCH/001" />
              </>
            ) : (
              <>
                <DetailItem label="School Name" value={displayValue(currentSettings.generalInfo.name)} icon={School}/>
                <div className="mb-2">
                   <Label className="text-sm font-medium text-muted-foreground flex items-center">School Logo</Label>
                  {currentSettings.generalInfo.logo ? <Image src={currentSettings.generalInfo.logo} alt="School Logo" width={100} height={100} className="mt-1 rounded-md border object-contain" data-ai-hint="school logo" /> : displayValue(null)}
                </div>
                <DetailItem label="Motto" value={displayValue(currentSettings.generalInfo.motto)} />
                <DetailItem label="Established Year" value={displayValue(currentSettings.generalInfo.establishedYear)} />
                <DetailItem label="School Type" value={displayValue(currentSettings.generalInfo.schoolType)} />
                <DetailItem label="Registration Number" value={displayValue(currentSettings.generalInfo.registrationNumber)} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center"><Info className="mr-2 h-5 w-5 text-primary" /> Contact & Address</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Contact Information</h4>
                <EditItem section="contact" field="email" label="Email" name="email" value={editableSettings.contact.email} onSettingChange={handleSettingChange} placeholder="e.g., info@school.com" />
                <EditItem section="contact" field="phone" label="Phone" name="phone" value={editableSettings.contact.phone} onSettingChange={handleSettingChange} placeholder="e.g., +256 123 456789" />
                <EditItem section="contact" field="alternativePhone" label="Alternative Phone" name="alternativePhone" value={editableSettings.contact.alternativePhone} onSettingChange={handleSettingChange} />
                <EditItem section="contact" field="website" label="Website" name="website" value={editableSettings.contact.website} onSettingChange={handleSettingChange} placeholder="e.g., www.school.com" />
                
                <h4 className="font-semibold mt-4 mb-2 text-sm text-muted-foreground">Address Details</h4>
                <EditItem section="address" field="physical" label="Physical Address" name="physicalAddress" value={editableSettings.address.physical} onSettingChange={handleSettingChange} placeholder="e.g., Plot 123, School Lane" />
                <EditItem section="address" field="postal" label="Postal Address" name="postalAddress" value={editableSettings.address.postal} onSettingChange={handleSettingChange} placeholder="e.g., P.O. Box 100" />
                <EditItem section="address" field="poBox" label="P.O Box" name="poBox" value={editableSettings.address.poBox} onSettingChange={handleSettingChange} placeholder="e.g., P.O. Box 789" />
                <EditItem section="address" field="city" label="City" name="city" value={editableSettings.address.city} onSettingChange={handleSettingChange} />
                <EditItem section="address" field="country" label="Country" name="country" value={editableSettings.address.country} onSettingChange={handleSettingChange} />
              </>
            ) : (
              <>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Contact Information</h4>
                <DetailItem label="Email" value={displayValue(currentSettings.contact.email)} icon={Mail}/>
                <DetailItem label="Phone" value={displayValue(currentSettings.contact.phone)} icon={Phone}/>
                <DetailItem label="Alternative Phone" value={displayValue(currentSettings.contact.alternativePhone)} />
                <DetailItem label="Website" value={currentSettings.contact.website ? <a href={currentSettings.contact.website.startsWith('http') ? currentSettings.contact.website : `https://${currentSettings.contact.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.contact.website}</a> : displayValue(null)} icon={Globe}/>
                
                <h4 className="font-semibold mt-4 mb-2 text-sm text-muted-foreground">Address Details</h4>
                <DetailItem label="Physical Address" value={displayValue(currentSettings.address.physical)} icon={Landmark}/>
                <DetailItem label="Postal Address" value={displayValue(currentSettings.address.postal)} />
                <DetailItem label="P.O Box" value={displayValue(currentSettings.address.poBox)} />
                <DetailItem label="City" value={displayValue(currentSettings.address.city)} />
                <DetailItem label="Country" value={displayValue(currentSettings.address.country)} />
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center"><Users2 className="mr-2 h-5 w-5 text-primary" /> Leadership & Vision</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
               <>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Head Teacher's Office</h4>
                <EditItem section="headTeacher" field="name" label="Head Teacher's Name" name="headTeacherName" value={editableSettings.headTeacher.name} onSettingChange={handleSettingChange} />
                <div className="mb-3">
                  <Label htmlFor="signature" className="text-sm font-medium">Head Teacher's Signature</Label>
                  {signaturePreview && <Image src={signaturePreview} alt="Signature Preview" width={150} height={75} className="my-2 rounded-md border object-contain" data-ai-hint="teacher signature" />}
                  <Input id="signature" name="signature" type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileChange(e, 'headTeacher', 'signature', false)} className="mt-1" />
                </div>
                <EditItem section="headTeacher" field="message" label="Head Teacher's Message" name="headTeacherMessage" value={editableSettings.headTeacher.message} onSettingChange={handleSettingChange} isTextarea />

                <h4 className="font-semibold mt-4 mb-2 text-sm text-muted-foreground">Vision, Mission & Values</h4>
                <EditItem section="visionMissionValues" field="description" label="School Description" name="schoolDescription" value={editableSettings.visionMissionValues.description} onSettingChange={handleSettingChange} isTextarea />
                <EditItem section="visionMissionValues" field="vision" label="Vision" name="vision" value={editableSettings.visionMissionValues.vision} onSettingChange={handleSettingChange} isTextarea />
                <EditItem section="visionMissionValues" field="mission" label="Mission" name="mission" value={editableSettings.visionMissionValues.mission} onSettingChange={handleSettingChange} isTextarea />
                <EditItem section="visionMissionValues" field="coreValues" label="Core Values (comma-separated)" name="coreValues" value={editableSettings.visionMissionValues.coreValues} onSettingChange={handleSettingChange} isTextarea placeholder="e.g., Integrity, Respect, Excellence" />
              </>
            ) : (
              <>
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Head Teacher's Office</h4>
                <DetailItem label="Head Teacher's Name" value={displayValue(currentSettings.headTeacher.name)} icon={User}/>
                <div className="mb-2">
                   <Label className="text-sm font-medium text-muted-foreground flex items-center"><Edit className="mr-2 h-4 w-4" /> Head Teacher's Signature</Label>
                   {currentSettings.headTeacher.signature ? <Image src={currentSettings.headTeacher.signature} alt="Head Teacher's Signature" width={150} height={75} className="mt-1 rounded-md border object-contain" data-ai-hint="teacher signature" /> : displayValue(null)}
                </div>
                <DetailItem label="Head Teacher's Message" value={currentSettings.headTeacher.message ? <p className="whitespace-pre-wrap">{currentSettings.headTeacher.message}</p> : displayValue(null)} icon={MessageSquare}/>
                
                <h4 className="font-semibold mt-4 mb-2 text-sm text-muted-foreground">Vision, Mission & Values</h4>
                <DetailItem label="School Description" value={currentSettings.visionMissionValues.description ? <p className="whitespace-pre-wrap">{currentSettings.visionMissionValues.description}</p> : displayValue(null)} />
                <DetailItem label="Vision" value={currentSettings.visionMissionValues.vision ? <p className="whitespace-pre-wrap">{currentSettings.visionMissionValues.vision}</p> : displayValue(null)} />
                <DetailItem label="Mission" value={currentSettings.visionMissionValues.mission ? <p className="whitespace-pre-wrap">{currentSettings.visionMissionValues.mission}</p> : displayValue(null)} />
                <DetailItem label="Core Values" value={currentSettings.visionMissionValues.coreValues ? currentSettings.visionMissionValues.coreValues.split(',').map(v => v.trim()).map((val, i) => <Badge key={i} variant="secondary" className="mr-1 mb-1">{val}</Badge>) : displayValue(null)} icon={BookMarked}/>
              </>
            )}
          </CardContent>
        </Card>

        {/* Social Media Card */}
        <Card className="lg:col-span-1">
            <CardHeader>
                    <CardTitle className="flex items-center"><Globe className="mr-2 h-5 w-5 text-primary" /> Social Media</CardTitle>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <>
                            <EditItem section="socialMedia" field="facebook" label="Facebook URL" name="facebookUrl" value={editableSettings.socialMedia?.facebook} onSettingChange={handleSettingChange} placeholder="e.g., https://facebook.com/yourschool" />
                            <EditItem section="socialMedia" field="twitter" label="Twitter URL" name="twitterUrl" value={editableSettings.socialMedia?.twitter} onSettingChange={handleSettingChange} placeholder="e.g., https://twitter.com/yourschool" />
                            <EditItem section="socialMedia" field="instagram" label="Instagram URL" name="instagramUrl" value={editableSettings.socialMedia?.instagram} onSettingChange={handleSettingChange} placeholder="e.g., https://instagram.com/yourschool" />
                            <EditItem section="socialMedia" field="linkedin" label="LinkedIn URL" name="linkedinUrl" value={editableSettings.socialMedia?.linkedin} onSettingChange={handleSettingChange} placeholder="e.g., https://linkedin.com/company/yourschool" />
                            <EditItem section="socialMedia" field="whatsapp" label="WhatsApp Group URL" name="whatsappUrl" value={editableSettings.socialMedia?.whatsapp} onSettingChange={handleSettingChange} placeholder="e.g., https://chat.whatsapp.com/..." />
                        </>
                    ) : (
                        <>
                            <DetailItem label="Facebook" value={currentSettings.socialMedia?.facebook ? <a href={currentSettings.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.facebook}</a> : displayValue(null)} icon={Facebook}/>
                            <DetailItem label="Twitter" value={currentSettings.socialMedia?.twitter ? <a href={currentSettings.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.twitter}</a> : displayValue(null)} icon={Twitter}/>
                            <DetailItem label="Instagram" value={currentSettings.socialMedia?.instagram ? <a href={currentSettings.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.instagram}</a> : displayValue(null)} icon={Instagram}/>
                            <DetailItem label="LinkedIn" value={currentSettings.socialMedia?.linkedin ? <a href={currentSettings.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.linkedin}</a> : displayValue(null)} icon={Linkedin}/>
                            <DetailItem label="WhatsApp Group" value={currentSettings.socialMedia?.whatsapp ? <a href={currentSettings.socialMedia.whatsapp} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.whatsapp}</a> : displayValue(null)} icon={MessageCircle}/>
                        </>
                    )}
            </CardContent>
        </Card>

        {/* Pending Status Card */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" /> Pending Status Management</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="pendingEnabled" className="text-sm font-medium">Enable Pending Status</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      When enabled, pupils will be automatically set to Pending status based on the time of effect
                    </p>
                  </div>
                  <Switch
                    id="pendingEnabled"
                    checked={editableSettings.pending?.enabled || false}
                    onCheckedChange={(checked) => {
                      setEditableSettings((prev) => ({
                        ...prev,
                        pending: {
                          ...prev.pending,
                          enabled: checked,
                        },
                      }));
                    }}
                  />
                </div>

                {editableSettings.pending?.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Components to Exclude Pending Pupils</Label>
                      <p className="text-xs text-muted-foreground">
                        Check the components where Pending pupils should NOT be fetched or shown. 
                        Unchecked components will show ALL pupils (including Pending ones).
                      </p>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pending-classes"
                            checked={editableSettings.pending?.affectedComponents?.classes || false}
                            onCheckedChange={(checked) => {
                              setEditableSettings((prev) => ({
                                ...prev,
                                pending: {
                                  ...prev.pending,
                                  affectedComponents: {
                                    ...prev.pending?.affectedComponents,
                                    classes: checked as boolean,
                                  },
                                },
                              }));
                            }}
                          />
                          <Label htmlFor="pending-classes" className="text-sm font-normal cursor-pointer">Classes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pending-exams"
                            checked={editableSettings.pending?.affectedComponents?.exams || false}
                            onCheckedChange={(checked) => {
                              setEditableSettings((prev) => ({
                                ...prev,
                                pending: {
                                  ...prev.pending,
                                  affectedComponents: {
                                    ...prev.pending?.affectedComponents,
                                    exams: checked as boolean,
                                  },
                                },
                              }));
                            }}
                          />
                          <Label htmlFor="pending-exams" className="text-sm font-normal cursor-pointer">Exams</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pending-attendance"
                            checked={editableSettings.pending?.affectedComponents?.attendance || false}
                            onCheckedChange={(checked) => {
                              setEditableSettings((prev) => ({
                                ...prev,
                                pending: {
                                  ...prev.pending,
                                  affectedComponents: {
                                    ...prev.pending?.affectedComponents,
                                    attendance: checked as boolean,
                                  },
                                },
                              }));
                            }}
                          />
                          <Label htmlFor="pending-attendance" className="text-sm font-normal cursor-pointer">Attendance</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pending-pupils-list"
                            checked={editableSettings.pending?.affectedComponents?.pupilsList || false}
                            onCheckedChange={(checked) => {
                              setEditableSettings((prev) => ({
                                ...prev,
                                pending: {
                                  ...prev.pending,
                                  affectedComponents: {
                                    ...prev.pending?.affectedComponents,
                                    pupilsList: checked as boolean,
                                  },
                                },
                              }));
                            }}
                          />
                          <Label htmlFor="pending-pupils-list" className="text-sm font-normal cursor-pointer">Pupils List</Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeOfEffect" className="text-sm font-medium">Time of Effect</Label>
                      <Select
                        value={editableSettings.pending?.timeOfEffect || 'end_of_term'}
                        onValueChange={(value: 'end_of_term' | 'beginning_of_next_term') => {
                          setEditableSettings((prev) => ({
                            ...prev,
                            pending: {
                              ...prev.pending,
                              timeOfEffect: value,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger id="timeOfEffect">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="end_of_term">End of Term</SelectItem>
                          <SelectItem value="beginning_of_next_term">Beginning of Next Term</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose when pupils should be automatically set to Pending status
                      </p>
                    </div>

                    {currentSettings.pending?.activationDate && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground">
                          Last activated: {new Date(currentSettings.pending.activationDate).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge variant={currentSettings.pending?.enabled ? "default" : "secondary"}>
                    {currentSettings.pending?.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                {currentSettings.pending?.enabled && (
                  <>
                    <DetailItem 
                      label="Components Excluding Pending Pupils" 
                      value={
                        <div className="flex flex-wrap gap-2 mt-1">
                          {currentSettings.pending?.affectedComponents?.classes && (
                            <Badge variant="outline">Classes</Badge>
                          )}
                          {currentSettings.pending?.affectedComponents?.exams && (
                            <Badge variant="outline">Exams</Badge>
                          )}
                          {currentSettings.pending?.affectedComponents?.attendance && (
                            <Badge variant="outline">Attendance</Badge>
                          )}
                          {currentSettings.pending?.affectedComponents?.pupilsList && (
                            <Badge variant="outline">Pupils List</Badge>
                          )}
                          {!currentSettings.pending?.affectedComponents?.classes && 
                           !currentSettings.pending?.affectedComponents?.exams && 
                           !currentSettings.pending?.affectedComponents?.attendance && 
                           !currentSettings.pending?.affectedComponents?.pupilsList && (
                            <span className="text-xs text-muted-foreground">No components selected - All pupils (including Pending) will be shown in all components</span>
                          )}
                        </div>
                      } 
                    />
                    <DetailItem 
                      label="Time of Effect" 
                      value={
                        currentSettings.pending?.timeOfEffect === 'end_of_term' 
                          ? 'End of Term' 
                          : currentSettings.pending?.timeOfEffect === 'beginning_of_next_term'
                          ? 'Beginning of Next Term'
                          : currentSettings.pending?.enabled
                          ? 'End of Term' // Default fallback if enabled but not set
                          : displayValue(null)
                      } 
                    />
                    {currentSettings.pending?.activationDate && (
                      <DetailItem 
                        label="Last Activated" 
                        value={new Date(currentSettings.pending.activationDate).toLocaleString()} 
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* App Icon Management */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center"><ImageIcon className="mr-2 h-5 w-5 text-primary" /> App Icon Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center text-blue-900">
                  <Info className="mr-2 h-4 w-4" /> How to Change Your App Icon
                </h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Upload your school logo as a PNG, JPEG, or WebP file</li>
                  <li>Image must be at least 192×192 pixels (512×512 or higher recommended)</li>
                  <li>The system will automatically generate all required icon sizes</li>
                  <li>Icons will be used for browser tabs, PWA installation, bookmarks, and mobile home screens</li>
                  <li>After generation, clear your browser cache and reinstall the PWA to see changes</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="appIcon" className="text-sm font-medium">Select School Logo</Label>
                  <Input 
                    id="appIcon" 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    onChange={handleAppIconChange}
                    disabled={isGeneratingIcons}
                    className="cursor-pointer"
                  />
                  {appIconPreview && (
                    <div className="mt-3">
                      <Label className="text-sm font-medium mb-2 block">Preview</Label>
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
                        <Image 
                          src={appIconPreview} 
                          alt="App Icon Preview" 
                          width={120} 
                          height={120} 
                          className="rounded-lg border-2 border-gray-300 object-contain bg-white" 
                        />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">
                            This logo will be used for:
                          </p>
                          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                            <li>• Browser tabs and bookmarks</li>
                            <li>• PWA installation icons</li>
                            <li>• Mobile home screens</li>
                            <li>• Desktop shortcuts</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleGenerateAppIcons} 
                      disabled={!appIconFile || isGeneratingIcons}
                      className="flex-1"
                    >
                      {isGeneratingIcons ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Icons...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Generate App Icons
                        </>
                      )}
                    </Button>
                    {(appIconFile || iconGenerationResults) && (
                      <Button 
                        onClick={handleResetAppIcon} 
                        variant="outline"
                        disabled={isGeneratingIcons}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Generation Results</Label>
                  {!iconGenerationResults && !isGeneratingIcons && (
                    <div className="p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Upload and generate icons to see results here
                      </p>
                    </div>
                  )}
                  
                  {isGeneratingIcons && (
                    <div className="p-8 bg-gray-50 rounded-lg border text-center">
                      <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-3" />
                      <p className="text-sm font-medium">Generating all icon sizes...</p>
                      <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                    </div>
                  )}
                  
                  {iconGenerationResults && !isGeneratingIcons && (
                    <div className="space-y-3">
                      <div className={`p-4 rounded-lg border ${iconGenerationResults.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className={`h-5 w-5 ${iconGenerationResults.success ? 'text-green-600' : 'text-yellow-600'}`} />
                          <h4 className={`font-semibold text-sm ${iconGenerationResults.success ? 'text-green-900' : 'text-yellow-900'}`}>
                            {iconGenerationResults.message}
                          </h4>
                        </div>
                        <div className="text-xs space-y-1">
                          <p className={iconGenerationResults.success ? 'text-green-800' : 'text-yellow-800'}>
                            Total: {iconGenerationResults.summary.total} | 
                            Success: {iconGenerationResults.summary.success} | 
                            Failed: {iconGenerationResults.summary.failed}
                          </p>
                        </div>
                      </div>
                      
                      {iconGenerationResults.success && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="font-semibold text-xs mb-2 text-blue-900">Next Steps:</h4>
                          <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                            <li>Clear your browser cache (Ctrl+Shift+Delete)</li>
                            <li>Uninstall the PWA if already installed</li>
                            <li>Reload the website (Ctrl+F5)</li>
                            <li>Reinstall the PWA to see the new icon</li>
                          </ol>
                        </div>
                      )}
                      
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                          View Detailed Results ({iconGenerationResults.results.length} files)
                        </summary>
                        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto bg-gray-50 p-2 rounded border">
                          {iconGenerationResults.results.map((result: any, index: number) => (
                            <div 
                              key={index} 
                              className={`flex items-start gap-2 p-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}
                            >
                              <span>{result.success ? '✓' : '✗'}</span>
                              <span className="flex-1">{result.description}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* School Houses */}
      <div className="mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center"><Users2 className="mr-2 h-5 w-5 text-primary" /> School Houses</CardTitle>
            <div>
              <Button onClick={openCreateHouse} size="sm">
                Add House
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {housesLoading ? (
              <div className="flex items-center text-muted-foreground text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading houses...
              </div>
            ) : houses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No houses yet. Click "Add House" to create one.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {houses.map((house) => (
                  <div
                    key={house.id}
                    className="border rounded-lg p-3 flex items-start justify-between"
                    style={{ borderColor: house.themeColor }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: house.themeColor }}
                          aria-hidden
                        />
                        <span className="font-medium">{house.name}</span>
                      </div>
                      {house.motto ? (
                        <p className="text-xs text-muted-foreground italic">"{house.motto}"</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No motto</p>
                      )}
                      <UiBadge variant="outline" className="text-[10px]" style={{ borderColor: house.themeColor, color: house.themeColor }}>
                        {house.themeColor}
                      </UiBadge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEditHouse(house)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Create/Edit House Dialog */}
      <Dialog open={isHouseDialogOpen} onOpenChange={(open) => { setIsHouseDialogOpen(open); if (!open) resetHouseForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHouse ? 'Edit House' : 'Create House'}</DialogTitle>
          </DialogHeader>
          <FormErrorSummary errors={houseValidation.errors} submissionError={houseValidation.submissionError} onSelectError={houseValidation.focusField} />
          <div className="space-y-3">
            <div>
              <Label htmlFor="houseName" className={houseValidation.getFieldError('houseName') ? 'text-red-700' : undefined}>House Name <span className="text-red-600">*</span></Label>
              <Input
                id="houseName"
                value={houseForm.name}
                onChange={(e) => { setHouseForm((p) => ({ ...p, name: e.target.value })); houseValidation.handleFieldChange('houseName'); }}
                placeholder="e.g., Red House"
                {...houseValidation.getFieldProps('houseName')}
              />
              <FieldError error={houseValidation.getFieldError('houseName')} />
            </div>
            <div>
              <Label htmlFor="houseMotto">Motto</Label>
              <Input
                id="houseMotto"
                value={houseForm.motto}
                onChange={(e) => setHouseForm((p) => ({ ...p, motto: e.target.value }))}
                placeholder="e.g., Strive and Thrive"
              />
            </div>
            <div>
              <Label htmlFor="houseColorText" className={houseValidation.getFieldError('houseColorText') ? 'text-red-700' : undefined}>Theme Color <span className="text-red-600">*</span></Label>
              <div className="flex items-center gap-3">
                <Input
                  id="houseColor"
                  type="color"
                  value={houseForm.themeColor}
                  onChange={(e) => { setHouseForm((p) => ({ ...p, themeColor: e.target.value })); houseValidation.handleFieldChange('houseColorText'); }}
                  className="h-10 w-14 p-1"
                />
                <Input
                  id="houseColorText"
                  value={houseForm.themeColor}
                  onChange={(e) => { setHouseForm((p) => ({ ...p, themeColor: e.target.value })); houseValidation.handleFieldChange('houseColorText'); }}
                  placeholder="#3b82f6"
                  {...houseValidation.getFieldProps('houseColorText')}
                />
              </div>
              <FieldError error={houseValidation.getFieldError('houseColorText')} />
            </div>
          </div>
          <DialogFooter className="justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsHouseDialogOpen(false); resetHouseForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  if (!houseValidation.validateAll().isValid) return;
                  if (editingHouse) {
                    await updateHouseMutation.mutateAsync({ id: editingHouse.id, data: {
                      name: houseForm.name.trim(),
                      motto: houseForm.motto?.trim() || '',
                      themeColor: houseForm.themeColor,
                    } });
                    toast({ title: "House updated" });
                  } else {
                    await createHouseMutation.mutateAsync({
                      name: houseForm.name.trim(),
                      motto: houseForm.motto?.trim() || '',
                      themeColor: houseForm.themeColor,
                    });
                    toast({ title: "House created" });
                  }
                  setIsHouseDialogOpen(false);
                  resetHouseForm();
                } catch (err) {
                  houseValidation.setSubmissionError("The house could not be saved. Your entries have been preserved.");
                }
              }}
            >
              {editingHouse ? 'Save Changes' : 'Create House'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
