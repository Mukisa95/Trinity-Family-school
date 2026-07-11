"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Save, User, GraduationCap, Users, Heart, Upload, X, RefreshCw, Download, AlertTriangle, Plus } from "lucide-react";
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from "@/components/common/glass-page-top-bar";
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
import { useCreatePupil, usePupil, usePupils } from "@/lib/hooks/use-pupils";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { generateAdmissionNumber } from "@/lib/utils/admission-number";
import { sampleSchoolSettings } from "@/lib/sample-data";
import { PhotoUploadCrop } from "@/components/ui/photo-upload-crop";
import { PhoneInput } from "@/components/ui/phone-input";
import { validateForm, highlightMissingFields, scrollToFirstMissingField, clearFieldHighlights, createFieldValidation } from "@/lib/utils/form-validation";
import { useSubmissionState } from "@/lib/hooks/use-submission-state";
import { LoadingButton } from "@/components/ui/loading-button";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { parseLocalDate, formatDateForStorage } from "@/lib/utils/date-utils";
import { HousesService } from "@/lib/services/houses.service";
import type { House } from "@/types";

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

function NewPupilContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Check for sibling parameters
  const addingSibling = searchParams?.get('addingSibling') === 'true';
  const familyId = searchParams?.get('familyId');
  const originalPupilId = searchParams?.get('originalPupilId');

  // Firebase hooks
  const { data: classes = [] } = useClasses();
  const { data: schoolSettings } = useSchoolSettings();
  const createPupilMutation = useCreatePupil();
  const { data: originalPupil, isLoading: isLoadingOriginalPupil } = usePupil(originalPupilId || '');
  const { data: allPupils = [] } = usePupils();
  const [predictedHouse, setPredictedHouse] = React.useState<House | null>(null);

  // Use school settings or fallback to sample data
  const currentSchoolSettings = schoolSettings || sampleSchoolSettings;
  
  // Submission state management
  const { isSubmitting, submitWithState } = useSubmissionState();

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
  const [learnerIdentificationNumber, setLearnerIdentificationNumber] = React.useState<string | undefined>("");
  const [previousSchool, setPreviousSchool] = React.useState<string | undefined>("");
  const [registrationDate, setRegistrationDate] = React.useState<Date | undefined>(new Date());

  // Duplicate detection search states
  const [nameSearchResults, setNameSearchResults] = React.useState<Pupil[]>([]);
  const [showNameResults, setShowNameResults] = React.useState(false);
  const [isNameSearching, setIsNameSearching] = React.useState(false);

  const nationalityOptions: ComboboxOption[] = NATIONALITIES.map(nat => ({ value: nat, label: nat }));

  // Handle first name search for duplicate detection
  React.useEffect(() => {
    const searchSimilarPupils = async () => {
      if (firstName.length < 1) {
        setNameSearchResults([]);
        setShowNameResults(false);
        return;
      }

      setIsNameSearching(true);
      try {
        if (allPupils) {
          // Filter pupils based on first name similarity
          const filtered = allPupils.filter((pupil: Pupil) => {
            const searchString = `${pupil.firstName} ${pupil.lastName} ${pupil.admissionNumber}`.toLowerCase();
            return searchString.includes(firstName.toLowerCase()) || 
                   pupil.firstName.toLowerCase().includes(firstName.toLowerCase());
          });

          setNameSearchResults(filtered);
          setShowNameResults(filtered.length > 0);
        }
      } catch (error) {
        console.error('Error searching similar pupils:', error);
      } finally {
        setIsNameSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchSimilarPupils, 300);
    return () => clearTimeout(debounceTimer);
  }, [firstName, allPupils]);

  // Ref for first name search dropdown
  const nameSearchRef = React.useRef<HTMLDivElement>(null);

  // Handle click outside to close first name search dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nameSearchRef.current && !nameSearchRef.current.contains(event.target as Node)) {
        setShowNameResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownloadPdf = async () => {
    const pdfContainer = document.createElement('div');
    pdfContainer.style.fontFamily = 'Arial, sans-serif';
    pdfContainer.style.padding = '1px'; // Minimal padding, margins handled by PDF placement
    pdfContainer.style.width = '190mm'; // A4 width (210mm) - 2*1cm margins
    pdfContainer.style.color = '#333';
    pdfContainer.style.backgroundColor = '#fff'; // Ensure a white background for the canvas capture

    const formatDateForPdf = (date: Date | undefined) => date ? date.toLocaleDateString('en-GB') : '__________';
    const schoolName = currentSchoolSettings.generalInfo.name || 'School Name';

    const renderOptions = (options: readonly string[], selectedValue?: string) => {
      return options.map(opt => `
        <span class="checkbox-option">
          <input type="checkbox" ${selectedValue === opt ? 'checked' : ''} /> ${opt}
        </span>
      `).join('');
    };

    let htmlContent = `
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .pdf-header { text-align: center; margin-bottom: 30px; }
        .pdf-header h1 { font-size: 24px; color: #2c3e50; margin-bottom: 5px; }
        .pdf-header p { font-size: 12px; color: #7f8c8d; }
        .pdf-section { margin-bottom: 25px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #fff;}
        .pdf-section h2 { font-size: 18px; color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 8px; margin-bottom: 15px; }
        .pdf-field { margin-bottom: 12px; display: flex; align-items: center; flex-wrap: wrap; /* Allow wrapping for long content */ }
        .pdf-field-group { display: flex; flex-basis: 100%; margin-bottom: 10px; }
        .pdf-field-item { display: flex; align-items: center; margin-right: 20px; flex-basis: 48%; /* Adjust for spacing */ }
        .pdf-field-item-full { display: flex; align-items: center; flex-basis: 100%; }
        .pdf-field-label { font-weight: bold; min-width: 100px; font-size: 14px; color: #555; margin-right: 5px; }
        .pdf-field-value { font-size: 14px; border-bottom: 1px dashed #aaa; padding-bottom: 2px; flex-grow: 1; min-width: 150px; /* Ensure line is visible */ }
        .pdf-field-value.empty { color: #aaa; }
        .checkbox-option { margin-right: 15px; font-size: 14px; display: inline-flex; align-items: center;}
        .checkbox-option input { margin-right: 5px; }
        .guardian-section { margin-top: 20px; padding-left: 15px; border-left: 3px solid #3498db; }
        .photo-placeholder { width: 150px; height: 150px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; text-align: center; color: #aaa; font-size: 14px; margin: 0 auto 20px auto; }
      </style>
      <div class="pdf-header">
        <h1>Pupil Registration Form</h1>
        <p>${schoolName}</p>
        <p>Please fill in the details below clearly and accurately.</p>
      </div>

      <div class="pdf-section">
        <h2>Pupil's Personal Information</h2>
        <div class="pdf-field-group">
            <div class="pdf-field-item"><span class="pdf-field-label">First Name:</span><span class="pdf-field-value ${!firstName ? 'empty' : ''}">${firstName || '__________'}</span></div>
            <div class="pdf-field-item"><span class="pdf-field-label">Surname:</span><span class="pdf-field-value ${!lastName ? 'empty' : ''}">${lastName || '__________'}</span></div>
        </div>
        <div class="pdf-field-group">
            <div class="pdf-field-item"><span class="pdf-field-label">Other Names:</span><span class="pdf-field-value ${!otherNames ? 'empty' : ''}">${otherNames || '__________'}</span></div>
            <div class="pdf-field-item"><span class="pdf-field-label">Gender:</span>${renderOptions(['Male', 'Female'], gender)}</div>
        </div>
        <div class="pdf-field-group">
            <div class="pdf-field-item"><span class="pdf-field-label">Date of Birth:</span><span class="pdf-field-value">${formatDateForPdf(dateOfBirth)}</span></div>
            <div class="pdf-field-item"><span class="pdf-field-label">Place of Birth:</span><span class="pdf-field-value ${!placeOfBirth ? 'empty' : ''}">${placeOfBirth || '__________'}</span></div>
        </div>
        <div class="pdf-field-group">
            <div class="pdf-field-item"><span class="pdf-field-label">Nationality:</span><span class="pdf-field-value">__________</span></div>
            <div class="pdf-field-item"><span class="pdf-field-label">Religion:</span><span class="pdf-field-value">__________</span></div>
        </div>
        <div class="pdf-field-group">
             <div class="pdf-field-item"><span class="pdf-field-label">Class Applied For:</span><span class="pdf-field-value">${classes.find(c => c.id === classId)?.name || '__________'}</span></div>
             <div class="pdf-field-item"><span class="pdf-field-label">Previous School:</span><span class="pdf-field-value ${!previousSchool ? 'empty' : ''}">${previousSchool || '__________'}</span></div>
        </div>
        <div class="pdf-field-item-full"><span class="pdf-field-label">Residential Address:</span><span class="pdf-field-value ${!pupilAddress ? 'empty' : ''}">${pupilAddress || '__________'}</span></div>
      </div>
    `;

    // Explicitly create sections for two guardians in the PDF
    for (let i = 0; i < 2; i++) {
      const guardian = guardians[i]; // Will be undefined if guardians[i] doesn't exist
      const guardianNum = i + 1;

      const relationshipDisplay = guardian?.relationship || (guardianNum === 1 ? 'Primary Guardian Relationship' : 'Relationship __________');
      const firstNameVal = guardian?.firstName || '__________';
      const lastNameVal = guardian?.lastName || '__________';
      const emailVal = guardian?.email || '__________';
      const phoneVal = guardian?.phone || '__________';

      // CSS classes for empty state (though handled by || '__________' for values)
      const firstNameEmptyClass = guardian?.firstName ? '' : 'empty';
      const lastNameEmptyClass = guardian?.lastName ? '' : 'empty';
      const emailEmptyClass = guardian?.email ? '' : 'empty';
      const phoneEmptyClass = guardian?.phone ? '' : 'empty';

      htmlContent += `
      <div class="pdf-section guardian-section">
        <h2>Guardian ${guardianNum} Information (${relationshipDisplay})</h2>
        <div class="pdf-field-group">
            <div class="pdf-field-item"><span class="pdf-field-label">First Name:</span><span class="pdf-field-value ${firstNameEmptyClass}">${firstNameVal}</span></div>
            <div class="pdf-field-item"><span class="pdf-field-label">Surname:</span><span class="pdf-field-value ${lastNameEmptyClass}">${lastNameVal}</span></div>
        </div>
        <div class="pdf-field-group">
            <div class="pdf-field-item"><span class="pdf-field-label">Email Address:</span><span class="pdf-field-value ${emailEmptyClass}">${emailVal}</span></div>
            <div class="pdf-field-item"><span class="pdf-field-label">Phone Number:</span><span class="pdf-field-value ${phoneEmptyClass}">${phoneVal}</span></div>
        </div>
      </div>
      `;
    }

    htmlContent += `
      <div class="pdf-section">
        <h2>Medical Information</h2>
        <div class="pdf-field-item-full"><span class="pdf-field-label">Known Medical Conditions:</span><span class="pdf-field-value ${!medicalConditions ? 'empty' : ''}">${medicalConditions || '__________'}</span></div>
        <div class="pdf-field-item-full"><span class="pdf-field-label">Allergies:</span><span class="pdf-field-value ${!allergies ? 'empty' : ''}">${allergies || '__________'}</span></div>
        <div class="pdf-field-item-full"><span class="pdf-field-label">Current Medications:</span><span class="pdf-field-value ${!medications ? 'empty' : ''}">${medications || '__________'}</span></div>
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #7f8c8d;">
        <p>Thank you for choosing ${schoolName}.</p>
        <p>Parent/Guardian Signature: _________________________ Date: _________________________</p>
      </div>
    `;

    pdfContainer.innerHTML = htmlContent;
    document.body.appendChild(pdfContainer);

    try {
        const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true, backgroundColor: null }); // Ensure canvas background is transparent or white from container
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgProps = pdf.getImageProperties(imgData);
        const canvasWidthPx = imgProps.width;
        const canvasHeightPx = imgProps.height;

        const margin = 10; // 10mm
        const pdfPageWidth = 210; // A4 width in mm
        const pdfPageHeight = 297; // A4 height in mm

        const imageWidthOnPdf = pdfPageWidth - (2 * margin); // Should be 190mm
        
        // Calculate the total height of the image on the PDF, maintaining aspect ratio
        const imageAspectRatio = canvasHeightPx / canvasWidthPx;
        const totalImageHeightOnPdf = imageWidthOnPdf * imageAspectRatio;

        const pageContentHeight = pdfPageHeight - (2 * margin); // 277mm (usable height on PDF page)
        
        let imageSegmentStartY = 0; // The Y-coordinate from where to start slicing the source image (in pixels)
        let pageIndex = 0;

        while (imageSegmentStartY * (imageWidthOnPdf / canvasWidthPx) < totalImageHeightOnPdf) {
            if (pageIndex > 0) {
                pdf.addPage();
            }

            // Calculate the height of the current segment to draw, in pixels of the source canvas
            let segmentHeightPx = pageContentHeight * (canvasWidthPx / imageWidthOnPdf);
            
            // Ensure we don't try to capture beyond the actual image height
            if (imageSegmentStartY + segmentHeightPx > canvasHeightPx) {
                segmentHeightPx = canvasHeightPx - imageSegmentStartY;
            }

            // Create a temporary canvas to hold the segment
            const segmentCanvas = document.createElement('canvas');
            segmentCanvas.width = canvasWidthPx;
            segmentCanvas.height = segmentHeightPx;
            const ctx = segmentCanvas.getContext('2d');
            if (ctx) {
                // Draw the segment from the main canvas to the temporary canvas
                ctx.drawImage(canvas, 0, imageSegmentStartY, canvasWidthPx, segmentHeightPx, 0, 0, canvasWidthPx, segmentHeightPx);
                const segmentImgData = segmentCanvas.toDataURL('image/png');
                
                // Calculate actual height of this segment on PDF
                const segmentHeightOnPdf = segmentHeightPx * (imageWidthOnPdf / canvasWidthPx);

                pdf.addImage(segmentImgData, 'PNG', margin, margin, imageWidthOnPdf, segmentHeightOnPdf);
            }
            
            imageSegmentStartY += segmentHeightPx;
            pageIndex++;

            // Safety break for extremely long content, though html2canvas might limit this first
            if (pageIndex > 50) {
                console.warn("PDF generation stopped after 50 pages.");
                break;
            }
        }
        
        const safeFirstName = firstName || 'Pupil';
        const safeLastName = lastName || '';
        pdf.save(`Pupil_Registration_${safeFirstName}_${safeLastName}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: "PDF Generation Failed",
        description: "There was an issue creating the PDF. Please try again.",
      });
    } finally {
        document.body.removeChild(pdfContainer);
    }
  };

  // Auto-generate admission number when required fields are available
  const autoGenerateAdmissionNumber = React.useCallback(() => {
    if (
      currentSchoolSettings.generalInfo.name &&
      nationality &&
      dateOfBirth &&
      gender
    ) {
      const schoolName = currentSchoolSettings.generalInfo.name;
      const dobString = formatDateForStorage(dateOfBirth);
      const generatedNumber = generateAdmissionNumber(schoolName, nationality, dobString, gender);
      setAdmissionNumber(generatedNumber);
    }
  }, [currentSchoolSettings.generalInfo.name, nationality, dateOfBirth, gender]);

  // Auto-generate admission number when dependencies change
  React.useEffect(() => {
    autoGenerateAdmissionNumber();
  }, [autoGenerateAdmissionNumber]);

  // Predict next house assignment (round-robin) for preview
  React.useEffect(() => {
    const computeNextHouse = async () => {
      try {
        const houses = await HousesService.getAll();
        if (!houses || houses.length === 0) {
          setPredictedHouse(null);
          return;
        }
        houses.sort((a, b) => a.name.localeCompare(b.name));
        // Determine last registered pupil from allPupils (has createdAt or rely on list order)
        let lastPupilHouseId: string | undefined;
        if (allPupils && allPupils.length > 0) {
          const sorted = [...allPupils].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
          lastPupilHouseId = sorted[0]?.houseId || undefined;
        }
        const lastIndex = houses.findIndex(h => h.id === (lastPupilHouseId || ''));
        const nextIndex = lastIndex >= 0 ? (lastIndex + 1) % houses.length : 0;
        setPredictedHouse(houses[nextIndex]);
      } catch (e) {
        console.warn('Failed to compute next house', e);
        setPredictedHouse(null);
      }
    };
    computeNextHouse();
  }, [allPupils]);

  // Prefill family information when adding a sibling
  React.useEffect(() => {
    if (addingSibling && originalPupil) {
      // Prefill Place of Birth
      if (originalPupil.placeOfBirth) {
        setPlaceOfBirth(originalPupil.placeOfBirth);
      }
      
      // Prefill Nationality
      if (originalPupil.nationality) {
        setNationality(originalPupil.nationality);
      }
      
      // Prefill Residential Address
      if (originalPupil.address) {
        setPupilAddress(originalPupil.address);
      }
      
      // Prefill Religion
      if (originalPupil.religion) {
        setReligion(originalPupil.religion);
      }
      
      // Prefill Guardian Information
      if (originalPupil.guardians && originalPupil.guardians.length > 0) {
        // Copy guardians from the original pupil
        const copiedGuardians = originalPupil.guardians.map((guardian, index) => ({
          ...guardian,
          id: `g_sibling_${Date.now()}_${index}`
        }));
        setGuardians(copiedGuardians);
        
        // Set emergency contact to the first guardian if available
        if (copiedGuardians.length > 0 && copiedGuardians[0].id) {
          setEmergencyContactGuardianId(copiedGuardians[0].id);
        }
      }
    }
  }, [addingSibling, originalPupil]);

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

  const createPupilData = () => {
    // Auto-set emergency contact to first valid guardian if not already set
    const validGuardiansForEmergencyContact = guardians.filter(g => g.firstName && g.lastName && g.relationship && g.phone && g.id);
    const finalEmergencyContactId = emergencyContactGuardianId || (validGuardiansForEmergencyContact.length > 0 ? validGuardiansForEmergencyContact[0].id : undefined);

    // When adding a sibling, use the original pupil's familyId if available, otherwise use the familyId from URL params
    // If neither is available, create a new familyId (shouldn't happen in normal flow)
    const familyIdToSave = addingSibling 
      ? (originalPupil?.familyId || familyId || `fam-${Date.now()}`)
      : `fam-${Date.now()}`;

    const pupilData: Omit<Pupil, 'id' | 'createdAt'> = {
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
      familyId: familyIdToSave,
      guardians: guardians.filter(g => g.firstName && g.lastName && g.relationship && g.phone).map(g => ({ ...g, id: g.id || `g_submit_${Date.now()}${Math.random()}` })),
      registrationDate: formatDateForStorage(registrationDate),
      promotionHistory: [],
      statusChangeHistory: [],
      additionalIdentifiers: [],
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
      ...(learnerIdentificationNumber && { learnerIdentificationNumber }),
      ...(previousSchool && { previousSchool }),
    };

    return pupilData;
  };

  const validateFormData = () => {
    // Clear any previous field highlights
    const allFieldIds = [
      'lastName', 'firstName', 'admissionNumber', 'gender', 'dateOfBirth', 'classId', 'section', 'status',
      'guardian_relationship_0', 'guardian_firstName_0', 'guardian_lastName_0', 'guardian_phone_0'
    ];
    clearFieldHighlights(allFieldIds);

    // Define validation fields
    const validationFields = [
      createFieldValidation('lastName', lastName, 'Surname', true),
      createFieldValidation('firstName', firstName, 'First Name', true),
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
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateFormData()) {
      return;
    }

    const pupilData = createPupilData();

    // Use the submission state hook for protected submission
    await submitWithState(
      () => createPupilMutation.mutateAsync(pupilData),
      {
        successTitle: "Pupil Registered",
        successMessage: `${pupilData.lastName}, ${pupilData.firstName} successfully registered.`,
        errorTitle: "Registration Failed",
        errorMessage: "Failed to register pupil. Please check your data and try again.",
        onSuccess: () => {
          router.push('/pupils');
        }
      }
    );
  };

  const handleSaveAndAddSibling = async () => {
    if (!validateFormData()) {
      return;
    }

    const pupilData = createPupilData();

    // Use the submission state hook for protected submission
    await submitWithState(
      () => createPupilMutation.mutateAsync(pupilData),
      {
        successTitle: "Pupil Registered",
        successMessage: `${pupilData.lastName}, ${pupilData.firstName} successfully registered. Opening sibling form...`,
        errorTitle: "Registration Failed",
        errorMessage: "Failed to register pupil. Please check your data and try again.",
        onSuccess: (savedPupil) => {
          // Navigate to new pupil form with sibling parameters
          // If we're already adding a sibling, keep the original pupil's ID (the first pupil in the family)
          // Otherwise, use the newly saved pupil as the original
          const originalId = addingSibling && originalPupilId 
            ? originalPupilId 
            : savedPupil.id;
          
          // Use the familyId from the saved pupil (which should be the same family)
          const siblingParams = new URLSearchParams();
          siblingParams.set('addingSibling', 'true');
          siblingParams.set('familyId', savedPupil.familyId || pupilData.familyId);
          siblingParams.set('originalPupilId', originalId);
          router.push(`/pupils/new?${siblingParams.toString()}`);
        }
      }
    );
  };

  const validGuardiansForEmergencyContactSelection = guardians.filter(g => g.firstName && g.lastName && g.relationship && g.phone && g.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <GlassPageTopBar
        title={addingSibling ? 'Add Sibling' : 'Register New Pupil'}
        subtitle={
          addingSibling
            ? isLoadingOriginalPupil
              ? 'Loading family information...'
              : originalPupil
                ? `Adding a sibling to ${originalPupil.firstName} ${originalPupil.lastName}'s family`
                : 'Adding a sibling to family'
            : 'Complete the form below to register a new pupil'
        }
        backHref="/pupils"
        backLabel="Back to Pupils"
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="PDF"
              icon={<Download className="h-4 w-4" />}
              tone="blue"
              disabled={isSubmitting}
              onClick={handleDownloadPdf}
            />
            <GlassActionButton
              label={isSubmitting ? 'Saving' : 'Sibling'}
              icon={isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              tone="emerald"
              disabled={isSubmitting}
              onClick={handleSaveAndAddSibling}
            />
            <GlassActionButton
              label={isSubmitting ? 'Saving' : 'Register'}
              icon={isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              tone="violet"
              disabled={isSubmitting}
              onClick={handleSubmit}
            />
          </GlassActionDock>
        }
      />

      <div className="container mx-auto max-w-6xl px-4 pb-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Photo and Quick Info */}
          <div className="lg:col-span-1 space-y-6 order-last lg:order-first">
            {/* Consolidated Photo and Preview Card */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm photo-upload-card">
              <CardContent className="pt-6 space-y-6">
                <PhotoUploadCrop
                  onPhotoChange={handlePhotoChange}
                  currentPhoto={photoPreview}
                />

                {/* Separator if any preview info is available */}
                {((firstName || lastName) || gender || admissionNumber || registrationDate || predictedHouse) && (
                  <Separator className="bg-gray-200 dark:bg-gray-700" />
                )}

                <div className="text-center space-y-4">
                  {(firstName || lastName) && (
                    <div className="space-y-1">
                      <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                        {lastName}{lastName && firstName && ', '}{firstName}
                      </p>
                      {otherNames && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{otherNames}</p>
                      )}
                    </div>
                  )}
                  {gender && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Gender</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{gender}</p>
                    </div>
                  )}
                  
                  {/* Admission Number */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Admission Number</p>
                    {admissionNumber ? (
                      <Badge variant="outline" className="text-sm font-mono bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                        {admissionNumber}
                      </Badge>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">Auto-generated</p>
                    )}
                  </div>

                  {/* Registration Date */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Registration Date</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {registrationDate?.toLocaleDateString() || new Date().toLocaleDateString()}
                    </p>
                  </div>

                  {/* Predicted House */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Auto House</p>
                    {predictedHouse ? (
                      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full border text-sm mx-auto"
                           style={{ borderColor: predictedHouse.themeColor, color: predictedHouse.themeColor }}>
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: predictedHouse.themeColor }} />
                        <span className="font-medium">{predictedHouse.name}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">Determining...</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Form */}
          <div className="lg:col-span-2 space-y-6 order-first lg:order-none">
            {/* Personal Information */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <User className="h-6 w-6 text-blue-600" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-medium">
                      Surname <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="Enter surname"
                    />
                  </div>
                  <div className="relative" ref={nameSearchRef}>
                    <Label htmlFor="firstName" className="text-sm font-medium">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                        onFocus={() => {
                          if (nameSearchResults.length > 0) {
                            setShowNameResults(true);
                          }
                        }}
                        className="pr-8"
                        placeholder="Enter first name"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {isNameSearching ? (
                          <div className="animate-spin rounded-full h-4 w-4 border border-blue-500 border-t-transparent" />
                        ) : (
                          nameSearchResults.length > 0 && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )
                        )}
                      </div>
                    </div>

                    {/* Duplicate Detection Dropdown */}
                    {showNameResults && nameSearchResults.length > 0 && (
                      <div className="absolute mt-1 w-full bg-white/95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-slate-200/70 max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">
                              Similar pupils found ({nameSearchResults.length})
                            </span>
                          </div>
                          <p className="text-xs text-amber-600 mt-1">
                            Review these pupils to avoid duplicates
                          </p>
                        </div>
                        {nameSearchResults.map((pupil) => (
                          <div
                            key={pupil.id}
                            className="px-3 py-3 border-b last:border-b-0 hover:bg-blue-50/80 transition-all duration-200"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900">
                                    {pupil.firstName} {pupil.lastName}
                                  </p>
                                  {pupil.status === 'Graduated' && (
                                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                      Graduated
                                    </Badge>
                                  )}
                                  {pupil.status === 'Inactive' && (
                                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                  <p className="text-xs text-gray-500">
                                    Admission: {pupil.admissionNumber}
                                  </p>
                                  {pupil.dateOfBirth && (
                                    <p className="text-xs text-gray-500">
                                      DOB: {new Date(pupil.dateOfBirth).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                {pupil.guardians && pupil.guardians.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Guardian: {pupil.guardians[0].firstName} {pupil.guardians[0].lastName}
                                    {pupil.guardians[0].phone && ` • ${pupil.guardians[0].phone}`}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                  {pupil.className || pupil.classId}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="px-3 py-2 bg-gray-50 border-t">
                          <p className="text-xs text-gray-600 text-center">
                            If none of these match, continue with registration
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="otherNames" className="text-sm font-medium">Other Names</Label>
                    <Input
                      id="otherNames"
                      value={otherNames || ""}
                      onChange={(e) => setOtherNames(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="Enter other names"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender" className="text-sm font-medium">
                      Gender <span className="text-red-500">*</span>
                    </Label>
                    <Select value={gender} onValueChange={(val) => setGender(val as Pupil['gender'])}>
                      <SelectTrigger id="gender" className="mt-1">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth" className="text-sm font-medium">
                      Date of Birth <span className="text-red-500">*</span>
                    </Label>
                    <div className="mt-1">
                      <ModernDatePicker 
                        date={dateOfBirth} 
                        setDate={setDateOfBirth}
                        placeholder="Select date of birth"
                        maxDate={new Date()}
                        showQuickSelects={false}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="placeOfBirth" className="text-sm font-medium">Place of Birth</Label>
                    <Input
                      id="placeOfBirth"
                      value={placeOfBirth || ""}
                      onChange={(e) => setPlaceOfBirth(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="Enter place of birth"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nationality" className="text-sm font-medium">Nationality</Label>
                    <div className="mt-1">
                      <Combobox
                        options={nationalityOptions}
                        value={nationality}
                        onValueChange={setNationality}
                        placeholder="Select nationality..."
                        searchPlaceholder="Search nationality..."
                        notFoundMessage="Nationality not found."
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="religion" className="text-sm font-medium">Religion</Label>
                    <Select value={religion} onValueChange={setReligion}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select religion" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pupilAddress" className="text-sm font-medium">Residential Address</Label>
                    <Input
                      id="pupilAddress"
                      value={pupilAddress || ""}
                      onChange={(e) => setPupilAddress(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="Enter residential address"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Academic Information */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <GraduationCap className="h-6 w-6 text-green-600" />
                  Academic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="classId" className="text-sm font-medium">
                      Class <span className="text-red-500">*</span>
                    </Label>
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger id="classId" className="mt-1">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="section" className="text-sm font-medium">
                      Section <span className="text-red-500">*</span>
                    </Label>
                    <Select value={section} onValueChange={(val) => setSection(val as Pupil['section'])}>
                      <SelectTrigger id="section" className="mt-1">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {PUPIL_SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-sm font-medium">
                      Status <span className="text-red-500">*</span>
                    </Label>
                    <Select value={status} onValueChange={(val) => setStatus(val as Pupil['status'])}>
                      <SelectTrigger id="status" className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PUPIL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="previousSchool" className="text-sm font-medium">Previous School</Label>
                    <Input
                      id="previousSchool"
                      value={previousSchool || ""}
                      onChange={(e) => setPreviousSchool(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="Enter previous school"
                    />
                  </div>
                  <div>
                    <Label htmlFor="learnerIdentificationNumber" className="text-sm font-medium">
                      Learner ID (e.g. UPI)
                    </Label>
                    <Input
                      id="learnerIdentificationNumber"
                      value={learnerIdentificationNumber || ""}
                      onChange={(e) => setLearnerIdentificationNumber(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="Enter learner ID"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guardian Information */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-6 w-6 text-purple-600" />
                  Guardian Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {guardians.map((guardian, index) => (
                  <div key={guardian.id} className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-lg">
                        {index === 0 ? 'Primary Guardian' : `Guardian ${index + 1}`}
                      </h4>
                      {guardians.length > 1 && index > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGuardian(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {/* Basic Information - 2 columns on larger screens */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={ `guardian_relationship_${index}` } className="text-sm font-medium">
                            Relationship <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={guardian.relationship}
                            onValueChange={(val) => handleGuardianChange(index, 'relationship', val)}
                          >
                            <SelectTrigger id={`guardian_relationship_${index}`} className="mt-1">
                              <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                            <SelectContent>
                              {GUARDIAN_RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={ `guardian_firstName_${index}` } className="text-sm font-medium">
                            First Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`guardian_firstName_${index}`}
                            value={guardian.firstName}
                            onChange={(e) => handleGuardianChange(index, 'firstName', e.target.value.toUpperCase())}
                            className="mt-1"
                            placeholder="Enter first name"
                          />
                        </div>
                        <div>
                          <Label htmlFor={ `guardian_lastName_${index}` } className="text-sm font-medium">
                            Surname <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`guardian_lastName_${index}`}
                            value={guardian.lastName}
                            onChange={(e) => handleGuardianChange(index, 'lastName', e.target.value.toUpperCase())}
                            className="mt-1"
                            placeholder="Enter surname"
                          />
                        </div>
                        <div>
                          <Label htmlFor={ `guardian_phone_${index}` } className="text-sm font-medium">
                            Phone <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex items-center gap-2 mt-1">
                            <PhoneInput
                              id={`guardian_phone_${index}`}
                              value={guardian.phone}
                              onChange={(value) => handleGuardianChange(index, 'phone', value)}
                              className="flex-grow"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => addAdditionalPhone(index)}
                              className="h-9 w-9 p-0 flex-shrink-0"
                              title="Add additional phone number"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Additional Phone Numbers - Full width */}
                      {guardian.additionalPhones && guardian.additionalPhones.length > 0 && (
                        <div className="border-t pt-4">
                          <Label className="text-sm font-medium text-gray-600 block mb-3">
                            Additional Phone Numbers
                          </Label>
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
                        </div>
                      )}
                      
                      {/* Contact Information - 2 columns on larger screens */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={ `guardian_email_${index}` } className="text-sm font-medium">Email</Label>
                          <Input
                            type="email"
                            id={`guardian_email_${index}`}
                            value={guardian.email ?? ""}
                            onChange={(e) => handleGuardianChange(index, 'email', e.target.value)}
                            className="mt-1"
                            placeholder="Enter email address"
                          />
                        </div>
                        <div>
                          <Label htmlFor={ `guardian_occupation_${index}` } className="text-sm font-medium">Occupation</Label>
                          <Input
                            id={`guardian_occupation_${index}`}
                            value={guardian.occupation ?? ""}
                            onChange={(e) => handleGuardianChange(index, 'occupation', e.target.value.toUpperCase())}
                            className="mt-1"
                            placeholder="Enter occupation"
                          />
                        </div>
                        <div>
                          <Label htmlFor={ `guardian_address_${index}` } className="text-sm font-medium">Address</Label>
                          <Input
                            id={`guardian_address_${index}`}
                            value={guardian.address ?? ""}
                            onChange={(e) => handleGuardianChange(index, 'address', e.target.value.toUpperCase())}
                            className="mt-1"
                            placeholder="Enter address"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {guardians.length < 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addGuardian}
                    className="w-full border-dashed border-2 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Add Another Guardian
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Medical Information */}
            <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Heart className="h-6 w-6 text-red-600" />
                  Medical Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="emergencyContactGuardianId" className="text-sm font-medium">
                      Emergency Contact
                    </Label>
                    <Select
                      value={emergencyContactGuardianId}
                      onValueChange={setEmergencyContactGuardianId}
                      disabled={validGuardiansForEmergencyContactSelection.length === 0}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={
                          validGuardiansForEmergencyContactSelection.length > 0 
                            ? `${validGuardiansForEmergencyContactSelection[0].firstName} ${validGuardiansForEmergencyContactSelection[0].lastName} (Auto-selected)`
                            : "Add guardian details first"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {validGuardiansForEmergencyContactSelection.length === 0 && (
                          <SelectItem value="no-guardians" disabled>Add guardian details first</SelectItem>
                        )}
                        {validGuardiansForEmergencyContactSelection.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.firstName} {g.lastName} ({g.relationship})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      First guardian is automatically selected as emergency contact
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="bloodType" className="text-sm font-medium">Blood Type</Label>
                    <Select value={bloodType} onValueChange={(value) => setBloodType(value as Pupil['bloodType'])}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <Label htmlFor="medicalConditions" className="text-sm font-medium">Known Medical Conditions</Label>
                    <Input
                      id="medicalConditions"
                      value={medicalConditions || ""}
                      onChange={(e) => setMedicalConditions(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="e.g., Asthma, Diabetes, Epilepsy"
                    />
                  </div>
                  <div>
                    <Label htmlFor="allergies" className="text-sm font-medium">Allergies</Label>
                    <Input
                      id="allergies"
                      value={allergies || ""}
                      onChange={(e) => setAllergies(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="e.g., Peanuts, Pollen, Penicillin"
                    />
                  </div>
                  <div>
                    <Label htmlFor="medications" className="text-sm font-medium">Current Medications</Label>
                    <Input
                      id="medications"
                      value={medications || ""}
                      onChange={(e) => setMedications(e.target.value.toUpperCase())}
                      className="mt-1"
                      placeholder="e.g., Insulin - 10 units daily, Ventolin inhaler - as needed"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewPupilPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <GlassPageTopBar
          title="Loading..."
          subtitle="Preparing pupil registration form"
          backHref="/pupils"
          backLabel="Back to Pupils"
        />
        <div className="container mx-auto px-4 pb-8">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading registration form...</span>
          </div>
        </div>
      </div>
    }>
      <NewPupilContent />
    </Suspense>
  );
} 
