"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Save, User, GraduationCap, Users, Heart, Upload, X, RefreshCw, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Pupil, Class, Guardian, PupilStatus } from "@/types";
import { ModernDatePicker } from "@/components/common/modern-date-picker";
import { useClasses } from "@/lib/hooks/use-classes";
import { GENDERS, PUPIL_SECTIONS, PUPIL_STATUSES, GUARDIAN_RELATIONSHIPS, BLOOD_TYPES, RELIGIONS, NATIONALITIES } from "@/lib/constants";
import Image from "next/image";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { usePupil, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { sampleSchoolSettings } from "@/lib/sample-data";
import { PhotoUploadCrop } from "@/components/ui/photo-upload-crop";
import { PhoneInput } from "@/components/ui/phone-input";
import { validateForm, highlightMissingFields, scrollToFirstMissingField, clearFieldHighlights, createFieldValidation } from "@/lib/utils/form-validation";
import { parseLocalDate, formatDateForStorage } from "@/lib/utils/date-utils";

const initialGuardianState: Omit<Guardian, 'id'> = {
  relationship: '',
  firstName: '',
  lastName: '',
  phone: '',
  additionalPhones: [], // Initialize with empty array
  email: '',
  occupation: '',
  address: '',
};

function EditPupilContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get pupil ID from URL
  const pupilId = searchParams.get('id');

  // Firebase hooks
  const { data: classes = [] } = useClasses();
  const { data: schoolSettings } = useSchoolSettings();
  const { data: pupil, isLoading, error } = usePupil(pupilId || '');
  const updatePupilMutation = useUpdatePupil();

  // Use school settings or fallback to sample data
  const currentSchoolSettings = schoolSettings || sampleSchoolSettings;

  // Form state
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [otherNames, setOtherNames] = React.useState<string | undefined>("");
  const [admissionNumber, setAdmissionNumber] = React.useState("");
  const [gender, setGender] = React.useState<Pupil['gender']>('');
  const [dateOfBirth, setDateOfBirth] = React.useState<Date | undefined>(undefined);
  const [placeOfBirth, setPlaceOfBirth] = React.useState<string | undefined>("");
  const [nationality, setNationality] = React.useState<string | undefined>("Ugandan");
  const [religion, setReligion] = React.useState<string | undefined>('');
  const [pupilAddress, setPupilAddress] = React.useState<string | undefined>("");
  const [classId, setClassId] = React.useState("");
  const [photo, setPhoto] = React.useState<string | undefined>(undefined);
  const [photoPreview, setPhotoPreview] = React.useState<string | undefined>(undefined);
  const [section, setSection] = React.useState<Pupil['section']>('');
  const [status, setStatus] = React.useState<Pupil['status']>('Active');
  
  const [guardians, setGuardians] = React.useState<Guardian[]>([{ ...initialGuardianState, id: `g${Date.now()}0` }]);

  const [medicalConditions, setMedicalConditions] = React.useState<string | undefined>("");
  const [allergies, setAllergies] = React.useState<string | undefined>("");
  const [medications, setMedications] = React.useState<string | undefined>("");
  const [bloodType, setBloodType] = React.useState<Pupil['bloodType']>(undefined);
  const [emergencyContactGuardianId, setEmergencyContactGuardianId] = React.useState<string | undefined>(undefined);
  const [previousSchool, setPreviousSchool] = React.useState<string | undefined>("");
  const [registrationDate, setRegistrationDate] = React.useState<Date | undefined>(new Date());

  const nationalityOptions: ComboboxOption[] = NATIONALITIES.map(nat => ({ value: nat, label: nat }));

  // Load existing pupil data when pupil is fetched
  React.useEffect(() => {
    if (pupil) {
      setFirstName(pupil.firstName || "");
      setLastName(pupil.lastName || "");
      setOtherNames(pupil.otherNames || "");
      setAdmissionNumber(pupil.admissionNumber || "");
      setGender(pupil.gender || '');
      setDateOfBirth(parseLocalDate(pupil.dateOfBirth));
      setPlaceOfBirth(pupil.placeOfBirth || "");
      setNationality(pupil.nationality || "Ugandan");
      setReligion(pupil.religion || '');
      setPupilAddress(pupil.address || "");
      setClassId(pupil.classId || "");
      setPhoto(pupil.photo);
      setPhotoPreview(pupil.photo);
      setSection(pupil.section || '');
      setStatus(pupil.status || 'Active');
      
      if (pupil.guardians && pupil.guardians.length > 0) {
        setGuardians(pupil.guardians);
      }
      
      setMedicalConditions(pupil.medicalConditions || "");
      setAllergies(pupil.allergies || "");
      setMedications(pupil.medications || "");
      setBloodType(pupil.bloodType || undefined);
      setEmergencyContactGuardianId(pupil.emergencyContactGuardianId);
      setPreviousSchool(pupil.previousSchool || "");
      setRegistrationDate(parseLocalDate(pupil.registrationDate) || new Date());
    }
  }, [pupil]);

  // Auto-set emergency contact to first valid guardian
  React.useEffect(() => {
    const firstValidGuardian = guardians.find(g => g.firstName && g.lastName && g.relationship && g.phone && g.id);
    if (firstValidGuardian && firstValidGuardian.id && !emergencyContactGuardianId) {
      setEmergencyContactGuardianId(firstValidGuardian.id);
    }
  }, [guardians, emergencyContactGuardianId]);

  const handleGuardianChange = (index: number, field: keyof Omit<Guardian, 'id'>, value: string) => {
    const updatedGuardians = [...guardians];
    updatedGuardians[index] = { ...updatedGuardians[index], [field]: value };
    setGuardians(updatedGuardians);
  };

  const addGuardian = () => {
    if (guardians.length < 2) {
      setGuardians([...guardians, { ...initialGuardianState, id: `g${Date.now()}${guardians.length}` }]);
    }
  };

  const removeGuardian = (index: number) => {
    const guardianToRemove = guardians[index];
    const updatedGuardians = guardians.filter((_, i) => i !== index);
    
    if (guardianToRemove.id === emergencyContactGuardianId) {
      setEmergencyContactGuardianId(updatedGuardians.length > 0 && updatedGuardians[0].id ? updatedGuardians[0].id : undefined);
    }

    if (updatedGuardians.length === 0) {
      const newInitialGuardianId = `g_empty_remove_${Date.now()}_0`;
      setGuardians([{ ...initialGuardianState, id: newInitialGuardianId }]);
      setEmergencyContactGuardianId(newInitialGuardianId);
    } else {
      setGuardians(updatedGuardians);
    }
  };

  // Functions to handle additional phone numbers
  const addAdditionalPhone = (guardianIndex: number) => {
    const updatedGuardians = [...guardians];
    if (!updatedGuardians[guardianIndex].additionalPhones) {
      updatedGuardians[guardianIndex].additionalPhones = [];
    }
    updatedGuardians[guardianIndex].additionalPhones!.push('');
    setGuardians(updatedGuardians);
  };

  const removeAdditionalPhone = (guardianIndex: number, phoneIndex: number) => {
    const updatedGuardians = [...guardians];
    updatedGuardians[guardianIndex].additionalPhones!.splice(phoneIndex, 1);
    setGuardians(updatedGuardians);
  };

  const handleAdditionalPhoneChange = (guardianIndex: number, phoneIndex: number, value: string) => {
    const updatedGuardians = [...guardians];
    if (!updatedGuardians[guardianIndex].additionalPhones) {
      updatedGuardians[guardianIndex].additionalPhones = [];
    }
    updatedGuardians[guardianIndex].additionalPhones![phoneIndex] = value;
    setGuardians(updatedGuardians);
  };

  const handlePhotoChange = (photoData: string | undefined) => {
    setPhoto(photoData);
    setPhotoPreview(photoData);
  };

  const handleSubmit = async () => {
    if (!pupilId) {
      toast({ variant: "destructive", title: "Error", description: "No pupil ID provided." });
      return;
    }

    // Clear any previous field highlights
    const allFieldIds = [
      'lastName', 'firstName', 'admissionNumber', 'gender', 'dateOfBirth', 'classId', 'section', 'status',
      'guardian_relationship_0', 'guardian_firstName_0', 'guardian_lastName_0', 'guardian_phone_0'
    ];
    clearFieldHighlights(allFieldIds);

    // Define validation fields
    const validationFields = [
      createFieldValidation('firstName', firstName, 'First Name', true),
      createFieldValidation('lastName', lastName, 'Surname', true),
      createFieldValidation('admissionNumber', admissionNumber, 'Admission Number', true),
      createFieldValidation('gender', gender, 'Gender', true),
      createFieldValidation('dateOfBirth', dateOfBirth, 'Date of Birth', true),
      createFieldValidation('classId', classId, 'Class', true),
      createFieldValidation('section', section, 'Section', true),
      createFieldValidation('status', status, 'Status', true),
    ];

    // Add guardian validation fields
    if (guardians.length > 0) {
      const primaryGuardian = guardians[0];
      validationFields.push(
        createFieldValidation('guardian_relationship_0', primaryGuardian.relationship, 'Guardian Relationship', true),
        createFieldValidation('guardian_firstName_0', primaryGuardian.firstName, 'Guardian First Name', true),
        createFieldValidation('guardian_lastName_0', primaryGuardian.lastName, 'Guardian Surname', true),
        createFieldValidation('guardian_phone_0', primaryGuardian.phone, 'Guardian Phone', true)
      );
    }

    // Validate form
    const validation = validateForm(validationFields);
    
    if (!validation.isValid) {
      // Highlight missing fields
      const missingFieldIds = validation.missingFields.map(field => field.id);
      highlightMissingFields(missingFieldIds);
      
      // Scroll to first missing field
      if (validation.firstMissingFieldId) {
        scrollToFirstMissingField(validation.firstMissingFieldId);
      }
      
      // Show error toast with specific missing fields
      const missingFieldNames = validation.missingFields.map(field => field.label).join(', ');
      toast({ 
        variant: "destructive", 
        title: "Missing Required Fields", 
        description: `Please fill in the following required fields: ${missingFieldNames}` 
      });
      return;
    }

    // Auto-set emergency contact to first valid guardian if not already set
    const validGuardiansForEmergencyContact = guardians.filter(g => g.firstName && g.lastName && g.relationship && g.phone && g.id);
    const finalEmergencyContactId = emergencyContactGuardianId || (validGuardiansForEmergencyContact.length > 0 ? validGuardiansForEmergencyContact[0].id : undefined);

    const updatedPupilData: Partial<Pupil> = {
      firstName,
      lastName,
      admissionNumber,
      gender,
      dateOfBirth: formatDateForStorage(dateOfBirth),
      nationality: nationality || "Ugandan",
      classId,
      className: classes.find(c => c.id === classId)?.name || "",
      classCode: classes.find(c => c.id === classId)?.code || "",
      section,
      status,
      guardians: guardians.filter(g => g.firstName && g.lastName && g.relationship && g.phone).map(g => ({ ...g, id: g.id || `g_submit_${Date.now()}${Math.random()}` })),
      registrationDate: formatDateForStorage(registrationDate),
      // Only include optional fields if they have values
      ...(otherNames && { otherNames }),
      ...(placeOfBirth && { placeOfBirth }),
      ...(religion && { religion }),
      ...(pupilAddress && { address: pupilAddress }),
      ...(photo && { photo }),
      ...(medicalConditions && { medicalConditions }),
      ...(allergies && { allergies }),
      ...(medications && { medications }),
      ...(bloodType && { bloodType }),
      ...(finalEmergencyContactId && { emergencyContactGuardianId: finalEmergencyContactId }),
      ...(previousSchool && { previousSchool }),
    };

    try {
      await updatePupilMutation.mutateAsync({ id: pupilId, data: updatedPupilData });
      toast({
        title: "Pupil Updated",
        description: `${updatedPupilData.lastName}, ${updatedPupilData.firstName} successfully updated.`,
      });
      router.push(`/pupil-detail?id=${pupilId}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update pupil. Please try again.",
      });
    }
  };

  const validGuardiansForEmergencyContactSelection = guardians.filter(g => g.firstName && g.lastName && g.relationship && g.phone && g.id);

  if (!pupilId) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Edit Pupil" />
        <p className="text-muted-foreground">No pupil ID provided. Please select a pupil to edit.</p>
        <Button asChild className="mt-4" aria-label="Back to Pupils List">
          <Link href="/pupils"><ArrowLeft className="mr-2 h-4 w-4" /> Back to List</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Loading Pupil Data...
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Please wait while we load the pupil information
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pupil) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Edit Pupil" />
        <p className="text-muted-foreground">Pupil not found or error loading data.</p>
        <Button asChild className="mt-4" aria-label="Back to Pupils List">
          <Link href="/pupils"><ArrowLeft className="mr-2 h-4 w-4" /> Back to List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 hover:bg-white/50 dark:hover:bg-gray-800/50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pupil Details
          </Button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Edit Pupil Details
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Update {pupil.lastName}, {pupil.firstName}'s information
            </p>
          </div>
        </div>

        {/* Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Photo and Basic Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Photo Upload Card */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="flex items-center justify-center text-xl">
                  <User className="mr-3 h-6 w-6 text-blue-600" />
                  Pupil Photo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoUploadCrop
                  onPhotoChange={handlePhotoChange}
                  currentPhoto={photoPreview}
                />
              </CardContent>
            </Card>

            {/* Basic Information Card */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <User className="mr-3 h-6 w-6 text-blue-600" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-medium">Surname *</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value.toUpperCase())}
                      placeholder="Enter surname"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-medium">First Name *</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                      placeholder="Enter first name"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="otherNames" className="text-sm font-medium">Other Names</Label>
                    <Input
                      id="otherNames"
                      value={otherNames || ""}
                      onChange={(e) => setOtherNames(e.target.value.toUpperCase() || undefined)}
                      placeholder="Enter other names (optional)"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="admissionNumber" className="text-sm font-medium">Admission Number *</Label>
                    <Input
                      id="admissionNumber"
                      value={admissionNumber}
                      onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                      placeholder="Enter admission number"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender" className="text-sm font-medium">Gender *</Label>
                    <Select value={gender} onValueChange={(value) => setGender(value as Pupil['gender'])}>
                      <SelectTrigger id="gender" className="mt-1">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.filter(g => g).map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth" className="text-sm font-medium">Date of Birth *</Label>
                                         <ModernDatePicker
                       date={dateOfBirth}
                       setDate={setDateOfBirth}
                       className="mt-1 w-full"
                       placeholder="Select date of birth"
                       maxDate={new Date()}
                       showQuickSelects={false}
                     />
                  </div>

                  <div>
                    <Label htmlFor="placeOfBirth" className="text-sm font-medium">Place of Birth</Label>
                    <Input
                      id="placeOfBirth"
                      value={placeOfBirth || ""}
                      onChange={(e) => setPlaceOfBirth(e.target.value.toUpperCase() || undefined)}
                      placeholder="Enter place of birth (optional)"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="nationality" className="text-sm font-medium">Nationality</Label>
                    <Combobox
                      options={nationalityOptions}
                      value={nationality || ""}
                      onValueChange={(value) => setNationality(value || undefined)}
                      placeholder="Select or type nationality"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="religion" className="text-sm font-medium">Religion</Label>
                    <Select 
                      value={religion === '' || religion === undefined ? "NO_RELIGION" : religion} 
                      onValueChange={(value) => setReligion(value === "NO_RELIGION" ? undefined : value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select religion (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO_RELIGION">None</SelectItem>
                        {RELIGIONS.filter(r => r).map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="pupilAddress" className="text-sm font-medium">Address</Label>
                    <Textarea
                      id="pupilAddress"
                      value={pupilAddress || ""}
                      onChange={(e) => setPupilAddress(e.target.value.toUpperCase() || undefined)}
                      placeholder="Enter home address (optional)"
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Academic and Guardian Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Academic Information Card */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <GraduationCap className="mr-3 h-6 w-6 text-green-600" />
                  Academic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="classId" className="text-sm font-medium">Class *</Label>
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger id="classId" className="mt-1">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.filter(cls => cls.id && cls.name).map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} ({cls.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="section" className="text-sm font-medium">Section *</Label>
                    <Select value={section} onValueChange={(value) => setSection(value as Pupil['section'])}>
                      <SelectTrigger id="section" className="mt-1">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {PUPIL_SECTIONS.filter(s => s).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status" className="text-sm font-medium">Status *</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as Pupil['status'])}>
                      <SelectTrigger id="status" className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PUPIL_STATUSES.filter(s => s).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="registrationDate" className="text-sm font-medium">Registration Date</Label>
                                         <ModernDatePicker
                       date={registrationDate}
                       setDate={setRegistrationDate}
                       className="mt-1 w-full"
                       placeholder="Select registration date"
                       showQuickSelects={false}
                     />
                  </div>

                  <div>
                    <Label htmlFor="previousSchool" className="text-sm font-medium">Previous School</Label>
                    <Input
                      id="previousSchool"
                      value={previousSchool || ""}
                      onChange={(e) => setPreviousSchool(e.target.value.toUpperCase() || undefined)}
                      placeholder="Enter previous school (optional)"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guardian Information Card */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-xl">
                  <div className="flex items-center">
                    <Users className="mr-3 h-6 w-6 text-purple-600" />
                    Guardian Information
                  </div>
                  {guardians.length < 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addGuardian}
                      className="text-purple-600 border-purple-600 hover:bg-purple-50"
                    >
                      Add Guardian
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {guardians.map((guardian, index) => (
                  <div key={guardian.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-lg">
                        Guardian {index + 1} {index === 0 && <Badge variant="default" className="ml-2">Primary</Badge>}
                      </h4>
                      {guardians.length > 1 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeGuardian(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {/* Basic Information - 2 columns on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Relationship *</Label>
                          <Select
                            value={guardian.relationship}
                            onValueChange={(value) => handleGuardianChange(index, 'relationship', value)}
                          >
                            <SelectTrigger id={`guardian_relationship_${index}`} className="mt-1">
                              <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                            <SelectContent>
                              {GUARDIAN_RELATIONSHIPS.filter(rel => rel).map((rel) => (
                                <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">First Name *</Label>
                          <Input
                            id={`guardian_firstName_${index}`}
                            value={guardian.firstName}
                            onChange={(e) => handleGuardianChange(index, 'firstName', e.target.value.toUpperCase())}
                            placeholder="Enter first name"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Surname *</Label>
                          <Input
                            id={`guardian_lastName_${index}`}
                            value={guardian.lastName}
                            onChange={(e) => handleGuardianChange(index, 'lastName', e.target.value.toUpperCase())}
                            placeholder="Enter surname"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Phone *</Label>
                          <PhoneInput
                            id={`guardian_phone_${index}`}
                            value={guardian.phone}
                            onChange={(value) => handleGuardianChange(index, 'phone', value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      
                      {/* Additional Phone Numbers - Full width */}
                      <div className="border-t pt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                          <Label className="text-sm font-medium text-gray-600">
                            Additional Phone Numbers
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addAdditionalPhone(index)}
                            className="h-8 px-3 text-xs self-start sm:self-auto"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Phone
                          </Button>
                        </div>
                        
                        {guardian.additionalPhones && guardian.additionalPhones.length > 0 && (
                          <div className="space-y-3">
                            {guardian.additionalPhones.map((phone, phoneIndex) => (
                              <div key={phoneIndex} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                <PhoneInput
                                  value={phone}
                                  onChange={(value) => handleAdditionalPhoneChange(index, phoneIndex, value)}
                                  className="flex-1 w-full"
                                  placeholder="Additional phone number"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeAdditionalPhone(index, phoneIndex)}
                                  className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 self-start sm:self-auto"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Contact Information - 2 columns on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Email</Label>
                          <Input
                            value={guardian.email}
                            onChange={(e) => handleGuardianChange(index, 'email', e.target.value)}
                            placeholder="Enter email (optional)"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Occupation</Label>
                          <Input
                            value={guardian.occupation}
                            onChange={(e) => handleGuardianChange(index, 'occupation', e.target.value.toUpperCase())}
                            placeholder="Enter occupation (optional)"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      
                      {/* Address - Full width */}
                      <div>
                        <Label className="text-sm font-medium">Address</Label>
                        <Textarea
                          value={guardian.address}
                          onChange={(e) => handleGuardianChange(index, 'address', e.target.value.toUpperCase())}
                          placeholder="Enter address (optional)"
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {validGuardiansForEmergencyContactSelection.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Emergency Contact</Label>
                    <Select
                      value={emergencyContactGuardianId || ""}
                      onValueChange={(value) => setEmergencyContactGuardianId(value || undefined)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={
                          validGuardiansForEmergencyContactSelection.length > 0 
                            ? `${validGuardiansForEmergencyContactSelection[0].firstName} ${validGuardiansForEmergencyContactSelection[0].lastName} (Auto-selected)`
                            : "Select emergency contact"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {validGuardiansForEmergencyContactSelection.filter(guardian => guardian.id && guardian.firstName && guardian.lastName).map((guardian) => (
                          <SelectItem key={guardian.id} value={guardian.id}>
                            {guardian.firstName} {guardian.lastName} ({guardian.relationship})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      First guardian is automatically selected as emergency contact
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medical Information Card */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Heart className="mr-3 h-6 w-6 text-red-600" />
                  Medical Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bloodType" className="text-sm font-medium">Blood Type</Label>
                    <Select 
                      value={bloodType === undefined ? "UNKNOWN_BLOOD_TYPE" : bloodType} 
                      onValueChange={(value) => setBloodType(value === "UNKNOWN_BLOOD_TYPE" ? undefined : value as Pupil['bloodType'])}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select blood type (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNKNOWN_BLOOD_TYPE">Unknown</SelectItem>
                        {BLOOD_TYPES.filter(type => type).map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <Label htmlFor="medicalConditions" className="text-sm font-medium">Medical Conditions</Label>
                    <Textarea
                      id="medicalConditions"
                      value={medicalConditions || ""}
                      onChange={(e) => setMedicalConditions(e.target.value.toUpperCase() || undefined)}
                      placeholder="Enter any medical conditions (optional)"
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="allergies" className="text-sm font-medium">Allergies</Label>
                    <Textarea
                      id="allergies"
                      value={allergies || ""}
                      onChange={(e) => setAllergies(e.target.value.toUpperCase() || undefined)}
                      placeholder="Enter any allergies (optional)"
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="medications" className="text-sm font-medium">Current Medications</Label>
                    <Textarea
                      id="medications"
                      value={medications || ""}
                      onChange={(e) => setMedications(e.target.value.toUpperCase() || undefined)}
                      placeholder="Enter current medications (optional)"
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button
                onClick={handleSubmit}
                disabled={updatePupilMutation.isPending}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {updatePupilMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Pupil
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex-1 sm:flex-none border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditPupilPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Loading...
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Please wait while we load the edit form
            </p>
          </div>
        </div>
      </div>
    }>
      <EditPupilContent />
    </Suspense>
  );
} 