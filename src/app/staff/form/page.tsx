"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { User, Plus, X, Upload, Camera, UserCheck, Phone, Briefcase, GraduationCap, Heart, Shield, Users } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { STAFF_DEPARTMENTS, RELIGIONS, NATIONALITIES } from "@/lib/constants";
import { useStaffById, useCreateStaff, useUpdateStaff } from "@/lib/hooks/use-staff";
import { useSubmissionState } from "@/lib/hooks/use-submission-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { ArrayInput } from "@/components/ui/array-input";
import { ImageCropper } from "@/components/ui/image-cropper";
import { CameraPreview } from "@/components/ui/camera-preview";
import { MultiSelect } from "@/components/ui/multi-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { generateEmployeeID } from "@/lib/utils/employee-id-generator";
import type { Staff } from '@/types';

type StaffFormData = {
  firstName: string;
  lastName: string;
  otherNames?: string;
  employeeId: string;
  dateOfBirth: string;
  nationalId?: string;
  religion?: string;
  gender: 'Male' | 'Female' | '';
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed' | '';
  department: string[];
  role: string[];
  joinDate?: string;
  status?: 'active' | 'inactive' | 'onLeave';
  contractType?: 'permanent' | 'contract' | 'temporary';
  contactNumber: string;
  alternativePhone?: string;
  email: string;
  address?: string;
  city?: string;
  country?: string;
  qualifications?: string[];
  specializations?: string[];
  bloodGroup?: string;
  allergies?: string[];
  medicalConditions?: string[];
  medications?: string[];
  insuranceProvider?: string;
  insuranceNumber?: string;
  vaccinationStatus?: string[];
  photo?: string;
  cvPhotos?: string[];
  qualificationPhotos?: string[];
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
    address?: string;
  };
};

const initialStaffData: StaffFormData = {
  firstName: "",
  lastName: "",
  otherNames: "",
  employeeId: "",
  dateOfBirth: "",
  nationalId: "",
  religion: "",
  gender: 'Male',
  maritalStatus: 'Single',
  department: ["Teaching"],
  role: [],
  joinDate: "",
  status: "active",
  contractType: "permanent",
  contactNumber: "",
  alternativePhone: "",
  email: "",
  address: "",
  city: "",
  country: "",
  qualifications: [],
  specializations: [],
  bloodGroup: "A+",
  allergies: [],
  medicalConditions: [],
  medications: [],
  insuranceProvider: "",
  insuranceNumber: "",
  vaccinationStatus: [],
  cvPhotos: [],
  qualificationPhotos: [],
  emergencyContact: {
    name: "",
    relationship: "",
    phone: "",
    address: ""
  }
};

export default function StaffForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  
  // Submission state management
  const { isSubmitting, submitWithState } = useSubmissionState();
  const [staffData, setStaffData] = useState<StaffFormData>(initialStaffData);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [showCamera, setShowCamera] = useState(false);
  const [generatedEmployeeID, setGeneratedEmployeeID] = useState<any>(null);
  const [isGeneratingID, setIsGeneratingID] = useState(false);
  
  const { data: staffMember, isLoading } = useStaffById(id || '');
  const createStaffMutation = useCreateStaff();
  const updateStaffMutation = useUpdateStaff();

  const departmentOptions = [
    { value: "Teaching", label: "Teaching" },
    { value: "Administration", label: "Administration" },
    { value: "Support", label: "Support" },
    { value: "Management", label: "Management" }
  ];

  const getRoleOptions = (departments: string[]) => {
    // Get all roles for all selected departments
    const allRoles: { value: string; label: string }[] = [];
    
    departments.forEach(dept => {
      switch (dept) {
      case "Teaching":
        allRoles.push(
          { value: "HEAD TEACHER", label: "Head Teacher" },
          { value: "DEPUTY HEAD TEACHER", label: "Deputy Head Teacher" },
          { value: "DIRECTOR OF STUDIES", label: "Director of Studies" },
          { value: "HEAD OF DEPARTMENT", label: "Head of Department" },
          { value: "SENIOR TEACHER", label: "Senior Teacher" },
          { value: "TEACHER", label: "Teacher" },
          { value: "TEACHING ASSISTANT", label: "Teaching Assistant" }
        );
        break;
      case "Administration":
        allRoles.push(
          { value: "PRINCIPAL", label: "Principal" },
          { value: "VICE PRINCIPAL", label: "Vice Principal" },
          { value: "BURSAR", label: "Bursar" },
          { value: "ACCOUNTANT", label: "Accountant" },
          { value: "SECRETARY", label: "Secretary" },
          { value: "RECEPTIONIST", label: "Receptionist" },
          { value: "ADMIN ASSISTANT", label: "Administrative Assistant" }
        );
        break;
      case "Support":
        allRoles.push(
          { value: "LIBRARIAN", label: "Librarian" },
          { value: "LAB TECHNICIAN", label: "Laboratory Technician" },
          { value: "IT SUPPORT", label: "IT Support" },
          { value: "MAINTENANCE", label: "Maintenance Staff" },
          { value: "SECURITY", label: "Security Officer" },
          { value: "DRIVER", label: "Driver" },
          { value: "CLEANER", label: "Cleaner" }
        );
        break;
      case "Management":
        allRoles.push(
          { value: "BOARD MEMBER", label: "Board Member" },
          { value: "DIRECTOR", label: "Director" },
          { value: "MANAGER", label: "Manager" },
          { value: "COORDINATOR", label: "Coordinator" }
        );
        break;
      }
    });
    
    // Remove duplicates and return
    return allRoles.filter((role, index, self) => 
      index === self.findIndex(r => r.value === role.value)
    );
  };

  // Fetch staff member data if editing
  useEffect(() => {
    if (staffMember && id) {
      const formattedStaffData: StaffFormData = {
        firstName: staffMember.firstName,
        lastName: staffMember.lastName,
        employeeId: staffMember.employeeId,
        dateOfBirth: staffMember.dateOfBirth,
        department: Array.isArray(staffMember.department) ? staffMember.department : [staffMember.department],
        role: Array.isArray(staffMember.role) ? staffMember.role : [staffMember.role],
        contactNumber: staffMember.contactNumber,
        email: staffMember.email,
        // Default empty arrays for new fields
        qualifications: [],
        specializations: [],
        allergies: [],
        medicalConditions: [],
        medications: [],
        vaccinationStatus: [],
        gender: 'Male',
        // Add other fields from staffMember if they exist
        ...(staffMember as any)
      };
      
      setStaffData(formattedStaffData);
      if ((staffMember as any).photo) {
        setPhotoPreview((staffMember as any).photo);
      }
    }
  }, [staffMember, id]);

  // Generate employee ID based on form data
  const generateEmployeeIDFromForm = useCallback(() => {
    try {
      if (!staffData.firstName || !staffData.lastName || !staffData.dateOfBirth || staffData.department.length === 0) {
        setGeneratedEmployeeID(null);
        return;
      }

      const idData = {
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        dateOfBirth: staffData.dateOfBirth,
        departments: staffData.department,
      };

      const generatedID = generateEmployeeID(idData);
      setGeneratedEmployeeID(generatedID);
      
      // Update the employee ID in the form data
      setStaffData(prev => ({
        ...prev,
        employeeId: generatedID.id
      }));
    } catch (error) {
      console.error('Error generating employee ID:', error);
      toast({
        title: "Error generating Employee ID",
        description: error instanceof Error ? error.message : "Failed to generate employee ID",
        variant: "destructive",
      });
    }
  }, [staffData.firstName, staffData.lastName, staffData.dateOfBirth, staffData.department, toast]);

  // Generate employee ID when required fields change
  useEffect(() => {
    generateEmployeeIDFromForm();
  }, [generateEmployeeIDFromForm]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const fieldName = name as keyof StaffFormData;
    
    // Handle nested fields if name contains a dot (e.g., "emergencyContact.name")
    if (name.includes('.')) {
      const [parentKey, childKey] = name.split('.') as [keyof StaffFormData, string];
      setStaffData(prev => ({
        ...prev,
        [parentKey]: {
          // @ts-ignore - Bypassing strict check for nested dynamic key
          ...(prev[parentKey] || {}),
          [childKey]: value
        }
      }));
    } else {
      setStaffData(prev => ({
        ...prev,
        [fieldName]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setStaffData(prev => ({ ...prev, photo: undefined }));
  };

  // Regenerate employee ID
  const handleRegenerateEmployeeID = () => {
    setIsGeneratingID(true);
    setTimeout(() => {
      generateEmployeeIDFromForm();
      setIsGeneratingID(false);
    }, 500); // Small delay for UX
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const isEditing = !!id;
    
    // Use the submission state hook for protected submission
    await submitWithState(
      () => {
        if (isEditing) {
          return updateStaffMutation.mutateAsync({
            id,
            data: staffData as any
          });
        } else {
          return createStaffMutation.mutateAsync(staffData as any);
        }
      },
      {
        successTitle: isEditing ? "Staff Updated" : "Staff Created",
        successMessage: isEditing 
          ? "Staff member has been successfully updated." 
          : "New staff member has been successfully added.",
        errorTitle: isEditing ? "Update Failed" : "Creation Failed",
        errorMessage: "Failed to submit staff form. Please check your data and try again.",
        onSuccess: () => {
          router.push('/staff');
        },
        onError: (error) => {
          console.error('Error submitting staff form:', error);
          setError('Failed to submit staff form. Please try again.');
        }
      }
    );
  };

  const inputClassName = "block w-full rounded-2xl border-2 border-input/80 bg-background/50 px-3.5 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:border-primary/80 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 hover:border-input";
  const labelClassName = "text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground/90";
  
  const renderInput = (
    label: string, 
    fieldName: keyof StaffFormData | string,
    value: string | number | undefined | null, 
    required: boolean = false, 
    type: string = "text",
    disabled: boolean = false
  ) => {
    const name = fieldName as string;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name} className={labelClassName}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id={name}
          type={type}
          name={name}
          value={value || ""}
          onChange={handleInputChange}
          required={required}
          disabled={disabled}
          className={inputClassName}
        />
      </div>
    );
  };

  const renderSelect = (
    label: string, 
    fieldName: keyof StaffFormData | string,
    options: { value: string; label: string }[], 
    required: boolean = false
  ) => {
    const name = fieldName as string;
    const value = staffData[name as keyof StaffFormData] as string;
    
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name} className={labelClassName}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <Select 
          value={value} 
          onValueChange={(newValue) => {
            setStaffData(prev => ({
              ...prev,
              [name]: newValue
            }));
          }}
        >
          <SelectTrigger id={name} className="rounded-2xl border-2 border-input/80 bg-background/50 px-3.5 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:border-primary/80 transition-all duration-200 hover:border-input">
            <SelectValue placeholder={`Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderTextarea = (
    label: string, 
    fieldName: keyof StaffFormData | string,
    value: string | undefined | null, 
    required: boolean = false
  ) => {
    const name = fieldName as string;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name} className={labelClassName}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <textarea
          id={name}
          name={name}
          value={value || ""}
          onChange={handleInputChange}
          rows={3}
          className={inputClassName}
          required={required}
        />
      </div>
    );
  };

  const renderSection = (title: string, children: React.ReactNode, icon?: React.ReactNode) => (
    <div className="bg-gradient-to-br from-card to-card/50 rounded-2xl shadow-lg border border-border/50 backdrop-blur-sm">
      <div className="px-4 py-2.5 border-b border-border/30 bg-gradient-to-r from-background/50 to-transparent">
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-primary">{icon}</div>}
          <h2 className="text-base font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {title}
          </h2>
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={id ? 'Edit Staff Member' : 'Add New Staff Member'}
        description={id ? 'Update staff member information' : 'Register a new staff member to the system'}
      />
      
      <form onSubmit={handleSubmit} className="space-y-3 pb-6">
        {/* Photo Upload & Employee ID Section */}
        {renderSection("Profile Photo & Employee ID", (
          <div className="flex items-start space-x-6">
            <div className="relative w-40 h-40 flex-shrink-0">
              {photoPreview ? (
                <div className="relative group">
                  <img
                    src={photoPreview}
                    alt="Profile"
                    className="w-40 h-40 rounded-2xl object-cover ring-4 ring-primary/20 shadow-lg transition-all duration-300 group-hover:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-3 -right-3 bg-destructive text-destructive-foreground rounded-full p-2 hover:bg-destructive/90 transition-all duration-200 shadow-lg hover:scale-110"
                  >
                    <span className="sr-only">Remove photo</span>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="w-40 h-40 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 bg-gradient-to-br from-background to-muted/30">
                  <div className="text-primary/60 mb-3">
                    <User className="h-16 w-16" />
                  </div>
                  <div className="flex flex-col items-center space-y-3">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-md hover:shadow-lg">
                        <Upload className="h-4 w-4" />
                        Upload Photo
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <Camera className="h-4 w-4" />
                      Take Photo
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              {/* Employee ID Preview */}
              <div className="space-y-2">
                <Label className={labelClassName}>
                  Employee ID <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center space-x-3">
                  <Input
                    value={staffData.employeeId || ""}
                    readOnly
                    className="font-mono text-sm bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 text-primary font-semibold"
                    placeholder="Will be generated automatically"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateEmployeeID}
                    disabled={isGeneratingID}
                    className="flex-shrink-0 bg-background/80 backdrop-blur-sm border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200"
                  >
                    {isGeneratingID ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : (
                      "🔄 Regenerate"
                    )}
                  </Button>
                </div>
                {generatedEmployeeID && (
                  <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/30">
                    <span className="font-medium">Generated from:</span> {staffData.firstName} {staffData.lastName} • {staffData.dateOfBirth} • {staffData.department.join(', ')}
                  </div>
                )}
              </div>
              
                              <div className="text-sm text-muted-foreground bg-gradient-to-r from-background/50 to-muted/30 p-3 rounded-lg border border-border/30">
                  <p className="font-medium mb-1.5">📸 Profile Photo</p>
                  <p>Upload a professional photo for your staff profile. The photo should be clear and recent.</p>
                  <p className="mt-1.5 font-medium">🆔 Employee ID</p>
                  <p>Employee ID is automatically generated based on personal details and department.</p>
                </div>
            </div>
          </div>
        ), <UserCheck className="h-6 w-6" />)}

        {/* Personal Details Section */}
        {renderSection("Personal Details", (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {renderInput("First Name", "firstName", staffData.firstName, true)}
            {renderInput("Last Name", "lastName", staffData.lastName, true)}
            {renderInput("Other Names", "otherNames", staffData.otherNames)}
            {renderSelect("Gender", "gender", [
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" }
            ], true)}
            {renderInput("Date of Birth", "dateOfBirth", staffData.dateOfBirth, true, "date")}
            {renderInput("National ID (NIN)", "nationalId", staffData.nationalId, true)}
            {renderSelect("Religion", "religion", RELIGIONS.map(religion => ({ value: religion, label: religion })), false)}
            {renderSelect("Marital Status", "maritalStatus", [
              { value: "Single", label: "Single" },
              { value: "Married", label: "Married" },
              { value: "Divorced", label: "Divorced" },
              { value: "Widowed", label: "Widowed" }
            ])}
          </div>
        ), <User className="h-6 w-6" />)}
        
        {/* Contact Information Section */}
        {renderSection("Contact Information", (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {renderInput("Email", "email", staffData.email, true, "email")}
            <div className="space-y-1.5">
              <Label htmlFor="contactNumber" className={labelClassName}>
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <PhoneInput
                id="contactNumber"
                name="contactNumber"
                value={staffData.contactNumber}
                onChange={(value) => {
                  setStaffData(prev => ({
                    ...prev,
                    contactNumber: value
                  }));
                }}
                className={inputClassName}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alternativePhone" className={labelClassName}>
                Alternative Phone
              </Label>
              <PhoneInput
                id="alternativePhone"
                name="alternativePhone"
                value={staffData.alternativePhone}
                onChange={(value) => {
                  setStaffData(prev => ({
                    ...prev,
                    alternativePhone: value
                  }));
                }}
                className={inputClassName}
              />
            </div>
            {renderTextarea("Address", "address", staffData.address, true)}
            {renderInput("City", "city", staffData.city, true)}
            {renderSelect("Country", "country", NATIONALITIES.map(country => ({ value: country, label: country })), true)}
          </div>
        ), <Phone className="h-6 w-6" />)}

        {/* Employment Details Section */}
        {renderSection("Employment Details", (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderInput("Join Date", "joinDate", staffData.joinDate, true, "date")}
            </div>
            
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className={labelClassName}>
                  Department <span className="text-destructive">*</span>
                </Label>
                <MultiSelect
                  options={departmentOptions}
                  selected={staffData.department}
                  onChange={(selected) => {
                    setStaffData(prev => ({
                      ...prev,
                      department: selected,
                      role: [] // Reset roles when departments change
                    }));
                  }}
                  placeholder="Select departments..."
                  searchPlaceholder="Search departments..."
                />
              </div>
              
              <div className="space-y-2">
                <Label className={labelClassName}>
                  Role <span className="text-destructive">*</span>
                </Label>
                <MultiSelect
                  options={getRoleOptions(staffData.department)}
                  selected={staffData.role}
                  onChange={(selected) => {
                    setStaffData(prev => ({
                      ...prev,
                      role: selected
                    }));
                  }}
                  placeholder="Select roles..."
                  searchPlaceholder="Search roles..."
                  disabled={staffData.department.length === 0}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderSelect("Status", "status", [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "onLeave", label: "On Leave" }
              ], true)}
              {renderSelect("Contract Type", "contractType", [
                { value: "permanent", label: "Permanent" },
                { value: "contract", label: "Contract" },
                { value: "temporary", label: "Temporary" }
              ], true)}
            </div>
            
            {/* CV Photos Upload */}
            <div className="space-y-2">
              <Label className={labelClassName}>CV Photos</Label>
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-center w-full">
                  <label className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-all duration-200 bg-gradient-to-br from-background to-muted/30">
                    <Upload className="h-8 w-8 text-primary/60" />
                    <span className="mt-2 text-sm text-muted-foreground font-medium">Upload CV photos</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const readers = files.map(file => {
                          return new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                          });
                        });
                        
                        Promise.all(readers).then(results => {
                          setStaffData(prev => ({
                            ...prev,
                            cvPhotos: [...(prev.cvPhotos || []), ...results]
                          }));
                        });
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                {staffData.cvPhotos && staffData.cvPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {staffData.cvPhotos.map((photo, index) => (
                      <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-md hover:shadow-lg transition-all duration-200">
                        <img 
                          src={photo} 
                          alt={`CV page ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setStaffData(prev => ({
                              ...prev,
                              cvPhotos: prev.cvPhotos?.filter((_, i) => i !== index)
                            }));
                          }}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 hover:bg-destructive/90 transition-all duration-200 shadow-lg hover:scale-110"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ), <Briefcase className="h-6 w-6" />)}
        
        {/* Academic Qualifications Section */}
        {renderSection("Academic Qualifications", (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <ArrayInput
                label="Qualifications"
                name="qualifications"
                value={staffData.qualifications || []}
                onChange={(name, value) => {
                  setStaffData(prev => ({
                    ...prev,
                    [name]: value
                  }));
                }}
                placeholder="Enter qualification and press Enter"
              />
              <ArrayInput
                label="Specializations"
                name="specializations"
                value={staffData.specializations || []}
                onChange={(name, value) => {
                  setStaffData(prev => ({
                    ...prev,
                    [name]: value
                  }));
                }}
                placeholder="Enter specialization and press Enter"
              />
            </div>
            
            {/* Qualification Photos Upload */}
            <div className="space-y-2">
              <Label className={labelClassName}>Qualification Documents</Label>
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-center w-full">
                  <label className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-all duration-200 bg-gradient-to-br from-background to-muted/30">
                    <Upload className="h-8 w-8 text-primary/60" />
                    <span className="mt-2 text-sm text-muted-foreground font-medium">Upload qualification documents</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const readers = files.map(file => {
                          return new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                          });
                        });
                        
                        Promise.all(readers).then(results => {
                          setStaffData(prev => ({
                            ...prev,
                            qualificationPhotos: [...(prev.qualificationPhotos || []), ...results]
                          }));
                        });
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                {staffData.qualificationPhotos && staffData.qualificationPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {staffData.qualificationPhotos.map((photo, index) => (
                      <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-md hover:shadow-lg transition-all duration-200">
                        <img 
                          src={photo} 
                          alt={`Qualification document ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setStaffData(prev => ({
                              ...prev,
                              qualificationPhotos: prev.qualificationPhotos?.filter((_, i) => i !== index)
                            }));
                          }}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 hover:bg-destructive/90 transition-all duration-200 shadow-lg hover:scale-110"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ), <GraduationCap className="h-6 w-6" />)}
        
        {/* Medical Information Section */}
        {renderSection("Medical Information", (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {renderSelect("Blood Group", "bloodGroup", [
              { value: "A+", label: "A+" },
              { value: "A-", label: "A-" },
              { value: "B+", label: "B+" },
              { value: "B-", label: "B-" },
              { value: "AB+", label: "AB+" },
              { value: "AB-", label: "AB-" },
              { value: "O+", label: "O+" },
              { value: "O-", label: "O-" },
              { value: "Unknown", label: "Unknown" }
            ])}
            <ArrayInput
              label="Allergies"
              name="allergies"
              value={staffData.allergies || []}
              onChange={(name, value) => {
                setStaffData(prev => ({
                  ...prev,
                  [name]: value
                }));
              }}
              placeholder="Enter allergy and press Enter"
            />
            <ArrayInput
              label="Medical Conditions"
              name="medicalConditions"
              value={staffData.medicalConditions || []}
              onChange={(name, value) => {
                setStaffData(prev => ({
                  ...prev,
                  [name]: value
                }));
              }}
              placeholder="Enter medical condition and press Enter"
            />
            <ArrayInput
              label="Medications"
              name="medications"
              value={staffData.medications || []}
              onChange={(name, value) => {
                setStaffData(prev => ({
                  ...prev,
                  [name]: value
                }));
              }}
              placeholder="Enter medication and press Enter"
            />
            {renderInput("Insurance Provider", "insuranceProvider", staffData.insuranceProvider)}
            {renderInput("Insurance Number", "insuranceNumber", staffData.insuranceNumber)}
            <ArrayInput
              label="Vaccination Status"
              name="vaccinationStatus"
              value={staffData.vaccinationStatus || []}
              onChange={(name, value) => {
                setStaffData(prev => ({
                  ...prev,
                  [name]: value
                }));
              }}
              placeholder="Enter vaccination details and press Enter"
            />
          </div>
        ), <Heart className="h-6 w-6" />)}

        {/* Emergency Contact Section */}
        {renderSection("Emergency Contact", (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderInput("Contact Name", "emergencyContact.name", staffData.emergencyContact?.name)}
            {renderInput("Relationship", "emergencyContact.relationship", staffData.emergencyContact?.relationship)}
            <div className="space-y-1.5">
              <Label htmlFor="emergencyContact.phone" className={labelClassName}>
                Phone Number
              </Label>
              <PhoneInput
                id="emergencyContact.phone"
                name="emergencyContact.phone"
                value={staffData.emergencyContact?.phone}
                onChange={(value) => {
                  setStaffData(prev => ({
                    ...prev,
                    emergencyContact: {
                      ...prev.emergencyContact,
                      phone: value
                    }
                  }));
                }}
                className={inputClassName}
              />
            </div>
            {renderTextarea("Address", "emergencyContact.address", staffData.emergencyContact?.address)}
          </div>
        ), <Shield className="h-6 w-6" />)}

        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
              {error}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/staff')}
            className="px-6 py-2 font-medium transition-all duration-200 hover:bg-muted/50"
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="Saving..."
            className="px-8 py-2 font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {id ? 'Update Staff' : 'Add Staff'}
          </LoadingButton>
        </div>
      </form>

      {/* Replace placeholder cropper modal */}
      {showCropper && selectedImage && (
        <ImageCropper
          imageSrc={selectedImage}
          onCropComplete={(croppedImage) => {
            setPhotoPreview(croppedImage);
            setStaffData(prev => ({ ...prev, photo: croppedImage }));
            setShowCropper(false);
          }}
          onCancel={() => setShowCropper(false)}
          aspectRatio={1}
        />
      )}

      {/* Replace placeholder camera modal */}
      {showCamera && (
        <CameraPreview
          onCapture={(photoData) => {
            setSelectedImage(photoData);
            setShowCropper(true);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
} 