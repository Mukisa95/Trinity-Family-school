"use client";

import * as React from "react";
import Image from "next/image";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { SchoolSettings } from "@/types";
import { sampleSchoolSettings } from "@/lib/sample-data";
import { Badge } from "@/components/ui/badge";
import { Edit3, Save, XCircle, School, Landmark, Phone, Mail, Globe, User, Edit, MessageSquare, BookMarked, Users2, Info, Facebook, Twitter, Instagram, Linkedin, Loader2 } from "lucide-react";
import { useSchoolSettings, useUpdateSchoolSettings, useInitializeSchoolSettings } from "@/lib/hooks/use-school-settings";

// Helper to display N/A for empty values in view mode
const displayValue = (value: string | undefined | null, prefix = "", suffix = "") => {
  return value ? `${prefix}${value}${suffix}` : <span className="text-muted-foreground italic">N/A</span>;
};

// Define types for sections and fields for better type safety
type SchoolSettingSection = keyof SchoolSettings;
type SchoolSettingField<S extends SchoolSettingSection> = keyof SchoolSettings[S];

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
  
  // Firebase hooks
  const { data: settings, isLoading, error } = useSchoolSettings();
  const updateSettingsMutation = useUpdateSchoolSettings();
  const initializeSettingsMutation = useInitializeSchoolSettings();
  
  // Use sample data as fallback if no settings exist in Firebase
  const currentSettings = settings || sampleSchoolSettings;
  
  const [editableSettings, setEditableSettings] = React.useState<SchoolSettings>(currentSettings);
  const [isEditing, setIsEditing] = React.useState(false);

  const [logoPreview, setLogoPreview] = React.useState<string | null>(currentSettings.generalInfo.logo || null);
  const [signaturePreview, setSignaturePreview] = React.useState<string | null>(currentSettings.headTeacher.signature || null);

  // Update editable settings when Firebase data changes
  React.useEffect(() => {
    if (currentSettings && !isEditing) {
      setEditableSettings(currentSettings);
      setLogoPreview(currentSettings.generalInfo.logo || null);
      setSignaturePreview(currentSettings.headTeacher.signature || null);
    }
  }, [currentSettings, isEditing]);

  const handleSettingChange = React.useCallback(
    <S extends SchoolSettingSection>(
      section: S,
      field: SchoolSettingField<S>,
      value: string
    ) => {
      setEditableSettings((prev) => {
        const prevSection = prev[section];
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
          const prevSection = prev[section];
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
      if (settings) {
        // Update existing settings
        await updateSettingsMutation.mutateAsync(editableSettings);
      } else {
        // Initialize settings if they don't exist
        await initializeSettingsMutation.mutateAsync(editableSettings);
      }
      setIsEditing(false);
      toast({ 
        title: "School Details Updated", 
        description: "Changes have been saved successfully to Firebase." 
      });
    } catch (error) {
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
  
  const DetailItem: React.FC<{ label: string; value: React.ReactNode; icon?: React.ElementType }> = ({ label, value, icon: Icon }) => (
    <div className="mb-2">
      <Label className="text-sm font-medium text-muted-foreground flex items-center">
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {label}
      </Label>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading school settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive py-12">
        <p>Error loading school settings. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="About School"
        description="View and manage your school's information."
        actions={
          !isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit3 className="mr-2 h-4 w-4" /> Edit Details
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveChanges} 
                variant="default"
                disabled={updateSettingsMutation.isPending || initializeSettingsMutation.isPending}
              >
                {(updateSettingsMutation.isPending || initializeSettingsMutation.isPending) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
              <Button onClick={handleCancelEdit} variant="outline">
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          )
        }
      />

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
        {currentSettings.socialMedia && (
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
                        </>
                    ) : (
                        <>
                            <DetailItem label="Facebook" value={currentSettings.socialMedia?.facebook ? <a href={currentSettings.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.facebook}</a> : displayValue(null)} icon={Facebook}/>
                            <DetailItem label="Twitter" value={currentSettings.socialMedia?.twitter ? <a href={currentSettings.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.twitter}</a> : displayValue(null)} icon={Twitter}/>
                            <DetailItem label="Instagram" value={currentSettings.socialMedia?.instagram ? <a href={currentSettings.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.instagram}</a> : displayValue(null)} icon={Instagram}/>
                            <DetailItem label="LinkedIn" value={currentSettings.socialMedia?.linkedin ? <a href={currentSettings.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{currentSettings.socialMedia.linkedin}</a> : displayValue(null)} icon={Linkedin}/>
                        </>
                    )}
                </CardContent>
            </Card>
        )}
      </div>
    </>
  );
}

    