"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, UserSquare, BookOpen as AcademicIcon, Users as GuardianIconLucide, HeartPulse, CalendarDays, MapPin, Phone, Mail, Briefcase, Home, Edit, Trash2, Receipt, Shirt, BookOpen, MoreVertical, User, GraduationCap, Shield, CreditCard, UserPlus, ChevronDown, BarChart3, Settings, History, TrendingUp, TrendingDown, ArrowRight, Clock, Tag, Printer, Award } from "lucide-react";
import { X } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import type { Pupil, Class, AdditionalIdentifier, PupilAssignedFee } from "@/types";
import { usePupil, usePupilsByFamily, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { usePupilExamHistory } from "@/lib/hooks/use-exams";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { Loader2 } from "lucide-react";
import { ManageIdCodesModal } from "@/components/pupils/manage-id-codes-modal";
import { AssignmentModal } from "@/components/pupils/assignment-modal";
import { useToast } from "@/hooks/use-toast";
import { PupilPhotoDetail } from "@/components/ui/pupil-photo-detail";
import { ActionGuard } from "@/components/auth/action-guard";
import { RMQRCode } from "@/components/ui/rmqr-code";
import { usePupilPLEResults } from '@/lib/hooks/use-ple-results';
import PLEResultsCard from '@/components/ple/PLEResultsCard';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

// Import Swiper components


const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

const getClassName = (classId: string | undefined, classes: Class[]) => {
  if (!classId) return "N/A";
  const cls = classes.find(c => c.id === classId);
  return cls ? cls.name : "N/A";
};

interface DetailItemProps {
  icon?: React.ReactNode;
  label: string;
  value: string | React.ReactNode | undefined | null;
  multiline?: boolean;
  highlight?: boolean;
}

const DetailItem = React.memo(function DetailItem({ icon, label, value, multiline = false, highlight = false }: DetailItemProps) {
  // Don't render the item if value is empty, null, undefined, or "N/A"
  if (!value || value === "N/A" || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  return (
    <div className={`flex ${multiline ? 'flex-col items-start' : 'items-center justify-between'} py-1.5 border-b border-border/50 last:border-b-0`}>
      <div className="flex items-center">
        {icon && <span className="mr-2 text-muted-foreground">{icon}</span>}
        <span className="font-medium text-muted-foreground">{label}:</span>
      </div>
      <span className={`text-right ${multiline ? 'mt-1 ml-0 sm:ml-6 text-left sm:text-right' : ''} ${highlight ? 'font-semibold text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
});



function PupilDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pupilId = searchParams?.get('id');
  const { toast } = useToast();
  
  // Firebase hooks
  const { data: pupil, isLoading, error, refetch: refetchPupil } = usePupil(pupilId || '');
  const { data: siblings = [] } = usePupilsByFamily(pupil?.familyId || '');
  const { data: classes = [] } = useClasses();
  const { data: schoolSettings } = useSchoolSettings();
  const updatePupilMutation = useUpdatePupil();
  
  // Academic years data for filters
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  // Exam loading state - start with false to load on demand
  const [shouldLoadExams, setShouldLoadExams] = React.useState(false);
  
  // Fetch pupil's exam history - only when shouldLoadExams is true
  const { 
    data: pupilExamHistory, 
    isLoading: isLoadingExamHistory 
  } = usePupilExamHistory(pupilId || '', { enabled: shouldLoadExams });
  
  // Exam filters state
  const [examFilters, setExamFilters] = React.useState({
    academicYearId: 'all',
    termId: 'all'
  });
  
  // Set default filters to active academic year and current term when data is loaded
  React.useEffect(() => {
    if (activeAcademicYear?.id) {
      // First try to find a term marked as current
      let currentTerm = activeAcademicYear.terms?.find(term => term.isCurrent);
      
      // If no term is marked as current, find the current term based on dates
      if (!currentTerm && activeAcademicYear.terms?.length > 0) {
        const now = new Date();
        currentTerm = activeAcademicYear.terms.find(term => {
          const startDate = new Date(term.startDate);
          const endDate = new Date(term.endDate);
          return now >= startDate && now <= endDate;
        });
      }
      
      // If still no current term found, use the first term as fallback
      if (!currentTerm && activeAcademicYear.terms?.length > 0) {
        currentTerm = activeAcademicYear.terms[0];
      }
      
      console.log('Setting exam filters:', {
        academicYearId: activeAcademicYear.id,
        termId: currentTerm?.id || 'all',
        currentTerm: currentTerm?.name,
        allTerms: activeAcademicYear.terms?.map(t => ({ id: t.id, name: t.name, isCurrent: t.isCurrent }))
      });
      
      setExamFilters(prev => ({
        ...prev,
        academicYearId: activeAcademicYear.id,
        termId: currentTerm?.id || 'all'
      }));
    }
  }, [activeAcademicYear]);
  
  // Get available terms based on selected academic year
  const availableTerms = React.useMemo(() => {
    if (examFilters.academicYearId === 'all') {
      return [];
    }
    
    const selectedYear = academicYears.find(y => y.id === examFilters.academicYearId);
    return selectedYear?.terms || [];
  }, [academicYears, examFilters.academicYearId]);

  const [isManageIdCodesModalOpen, setIsManageIdCodesModalOpen] = React.useState(false);
  const [isStatusChangeModalOpen, setIsStatusChangeModalOpen] = React.useState(false);

  // Force reset modal state on component mount to ensure clean state
  React.useEffect(() => {
    setIsStatusChangeModalOpen(false);
    setIsManageIdCodesModalOpen(false);
  }, []);


  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState('');
  const [selectedClassId, setSelectedClassId] = React.useState('');
  const [showClassSelection, setShowClassSelection] = React.useState(false);


  // Filter out the current pupil from siblings list
  const actualSiblings = React.useMemo(() => 
    siblings.filter(sibling => sibling.id !== pupilId), 
    [siblings, pupilId]
  );

  // Memoize the getClassName function with classes
  const getClassNameMemo = React.useCallback((classId: string | undefined) => {
    return getClassName(classId, classes);
  }, [classes]);

  // Memoize emergency contact guardian calculation
  const emergencyContactGuardian = React.useMemo(() => {
    return pupil?.emergencyContactGuardianId
      ? pupil.guardians.find(g => g.id === pupil.emergencyContactGuardianId)
      : null;
  }, [pupil?.emergencyContactGuardianId, pupil?.guardians]);

  // Consolidate all identifiable numbers for display
  const allIdentifiers = React.useMemo(() => {
    const ids: AdditionalIdentifier[] = [];
    if (pupil?.additionalIdentifiers) {
      ids.push(...pupil.additionalIdentifiers);
    }
    // If old LIN exists and no new LIN is present, add it for display
    if (pupil?.learnerIdentificationNumber && !ids.some(id => id.idType === 'LIN')) {
      ids.push({ idType: 'LIN', idValue: pupil.learnerIdentificationNumber });
    }
    return ids;
  }, [pupil]);

  const academicIdentifiers = allIdentifiers.filter(id => id.idType === 'LIN' || id.idType === 'Index Number');
  const personalIdentifiers = allIdentifiers.filter(id => id.idType !== 'LIN' && id.idType !== 'Index Number');

  const handleSaveIdCodes = async (identifiers: AdditionalIdentifier[]) => {
    if (!pupil) return;

    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { additionalIdentifiers: identifiers },
      });
      toast({
        title: "ID Codes Updated",
        description: "Successfully updated ID codes.",
      });
      refetchPupil(); // Refetch pupil data to show the updated IDs
    } catch (err) {
      console.error("Failed to update ID codes:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ID codes. Please try again.",
      });
    }
  };

  const handlePhotoChange = async (photoData: string | undefined) => {
    if (!pupil) return;

    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { photo: photoData },
      });
      toast({
        title: "Photo Updated",
        description: `${pupil.firstName}'s photo has been updated successfully.`,
      });
      refetchPupil(); // Refetch pupil data to show the new photo
    } catch (err) {
      console.error("Failed to update photo:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update photo. Please try again.",
      });
    }
  };

  const handleSaveAssignments = async (updatedAssignedFees: PupilAssignedFee[]) => {
    if (!pupil) return;

    try {
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: { assignedFees: updatedAssignedFees },
      });
      toast({
        title: "Assignments Updated",
        description: "Successfully updated fee assignments and discounts.",
      });
      refetchPupil();
    } catch (err) {
      console.error("Failed to update assignments:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update assignments. Please try again.",
      });
    }
  };

  // ID card PDF generation function with precise positioning
  const handleGenerateIDCard = async () => {
    if (!pupil) return;
    
    try {
      toast({
        title: "Generating ID Card",
        description: "Your ID card is being prepared...",
      });
      
      // Dynamic imports to avoid SSR issues
      const [
        { default: ReactPDF },
        { Document, Page, Text, View, StyleSheet, Image, Font },
        QRCode
      ] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@react-pdf/renderer'),
        import('qrcode')
      ]);

      // Use local fonts instead of loading from CDN
      Font.register({
        family: 'Helvetica',
        fonts: [
          { src: '/fonts/Helvetica.ttf' },
          { src: '/fonts/Helvetica-Bold.ttf', fontWeight: 'bold' }
        ]
      });

      // A4 dimensions in points (1 point = 1/72 inch)
      const A4_WIDTH = 595.28;  // 210mm
      const A4_HEIGHT = 841.89; // 297mm

      // ID card dimensions from image (in mm, converted to points)
      const ID_CARD_WIDTH = 86 * 2.83465;  // 86mm to points
      const ID_CARD_HEIGHT = 55 * 2.83465; // 55mm to points

      // Margins from image (in mm, converted to points)
      const LEFT_MARGIN = 32 * 2.83465;  // 32mm to points
      const TOP_MARGIN = 10 * 2.83465;   // 10mm to points
      const BOTTOM_MARGIN = 5 * 2.83465; // 5mm to points

      // Color constants
      const COLORS = {
        navy: '#002B5B',
        gold: '#FFB800',
        burgundy: '#8B0000',
        white: '#FFFFFF',
        pink: '#FFF5F5',
        gray: {
          text: '#374151',
          border: '#D1D5DB'
        }
      };

      // Generate QR code
      const generateQRCodeSync = async (data: object): Promise<string> => {
        try {
          const jsonString = JSON.stringify(data || {});
          
          return await QRCode.toDataURL(jsonString, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 4,
            width: 200,
            color: {
              dark: '#000000FF',
              light: '#FFFFFFFF'
            }
          });
        } catch (error) {
          console.error('QR generation error:', error);
          throw error;
        }
      };

      // Create QR code data
      const qrData = {
        id: pupil.admissionNumber || '',
        name: `${pupil.firstName || ''} ${pupil.lastName || ''}`.trim(),
        class: getClassName(pupil.classId, classes),
        section: pupil.section || ''
      };

      const qrCodeDataURL = await generateQRCodeSync(qrData);

      const styles = StyleSheet.create({
        page: {
          width: A4_WIDTH,
          height: A4_HEIGHT,
          backgroundColor: COLORS.white,
          padding: 0
        },
        cardContainer: {
          position: 'absolute',
          top: TOP_MARGIN,
          left: LEFT_MARGIN,
          width: ID_CARD_WIDTH,
          height: ID_CARD_HEIGHT,
          backgroundColor: COLORS.white,
          fontFamily: 'Helvetica'
        },
        mainContainer: {
          flexDirection: 'row',
          height: '100%'
        },
        // Left section styles
        leftSection: {
          width: '35%',
          backgroundColor: COLORS.navy,
          position: 'relative',
          padding: 0,
          display: 'flex',
          alignItems: 'center'
        },
        hexagonContainer: {
          position: 'relative',
          width: '100%',
          height: 'auto',
          marginTop: 0,
          paddingTop: 8
        },
        photoContainer: {
          position: 'relative',
          width: 75,
          height: 75,
          marginLeft: 8,
          backgroundColor: COLORS.white,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2
        },
        photoBorder: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: `2px solid ${COLORS.gold}`,
          borderRadius: 8
        },
        photo: {
          width: '100%',
          height: '100%',
          borderRadius: 6,
          objectFit: 'cover'
        },
        dobContainer: {
          marginTop: 8,
          width: '100%',
          paddingHorizontal: 4
        },
        dobLabel: {
          fontSize: 5,
          color: COLORS.gold,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
          marginBottom: 1
        },
        dobValue: {
          fontSize: 6,
          color: COLORS.white,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold'
        },
        decorativeDots: {
          position: 'absolute',
          bottom: 4,
          left: 4,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: 35,
          gap: 2
        },
        dot: {
          width: 2,
          height: 2,
          backgroundColor: COLORS.gold,
          borderRadius: 1
        },
        // Right section styles
        rightSection: {
          width: '65%',
          backgroundColor: COLORS.pink,
          padding: 6,
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        },
        schoolName: {
          fontSize: 8,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.gold,
          marginBottom: 0.5,
          textAlign: 'center',
          width: '100%'
        },
        schoolNameSecondLine: {
          fontSize: 9,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.navy,
          marginBottom: 1,
          textAlign: 'center',
          width: '100%'
        },
        phoneNumbers: {
          fontSize: 5,
          color: COLORS.gray.text,
          marginBottom: 4,
          textAlign: 'center',
          width: '100%'
        },
        idTitle: {
          fontSize: 9,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.burgundy,
          marginBottom: 4,
          textAlign: 'center',
          width: '100%'
        },
        infoRow: {
          borderBottom: `0.5px solid ${COLORS.gray.border}`,
          paddingVertical: 1.5,
          marginBottom: 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        },
        label: {
          fontSize: 6,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.gray.text,
          flex: 1
        },
        value: {
          fontSize: 6.5,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.navy,
          flex: 2,
          textAlign: 'right'
        },
        watermark: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 35,
          height: 35,
          opacity: 0.1
        },
        signatureImage: {
          width: 45,
          height: 20,
          objectFit: 'contain',
          marginTop: 1,
          marginLeft: 'auto'
        },
        backCardContainer: {
          position: 'absolute',
          top: TOP_MARGIN,
          left: LEFT_MARGIN,
          width: ID_CARD_WIDTH,
          height: ID_CARD_HEIGHT,
          backgroundColor: '#0284C7',
          padding: 0,
          fontFamily: 'Helvetica',
          overflow: 'hidden'
        },
        logoCircle: {
          position: 'absolute',
          left: 15,
          top: 15,
          width: 70,
          height: 70,
          backgroundColor: '#FFF1F2',
          borderRadius: 35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        backLogo: {
          width: 60,
          height: 60,
          objectFit: 'contain'
        },
        decorativeLines: {
          position: 'absolute',
          top: 0,
          right: 0,
          width: 80,
          height: 80,
          opacity: 0.2
        },
        backDecorativeDots: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 80,
          height: 80,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4
        },
        decorativeDot: {
          width: 2,
          height: 2,
          backgroundColor: COLORS.white,
          borderRadius: 1,
          opacity: 0.3
        },
        qrCodeContainer: {
          position: 'absolute',
          top: 15,
          right: 15,
          backgroundColor: COLORS.white,
          padding: 5,
          width: 70,
          height: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        qrCode: {
          width: 60,
          height: 60
        },
        propertyNoticeContainer: {
          position: 'absolute',
          top: 90,
          left: 15,
          right: 15
        },
        propertyNotice: {
          color: COLORS.white,
          fontSize: 7,
          marginBottom: 2,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold'
        },
        emailText: {
          color: COLORS.white,
          fontSize: 7,
          textAlign: 'center',
          opacity: 0.9,
          marginTop: 4
        },
        houseIndicator: {
          marginTop: 2, 
          padding: 3,
          borderRadius: 3,
          alignSelf: 'center',
          width: '90%',
          borderWidth: 0.5,
          borderColor: COLORS.white,
          position: 'relative'
        },
        houseValue: {
          fontSize: 7,
          color: COLORS.white,
          textAlign: 'center',
          fontFamily: 'Helvetica-Bold',
          textTransform: 'uppercase',
          letterSpacing: 0.5
        },
      });

      // Get pupil's emergency contact
      const getEmergencyContact = () => {
        return emergencyContactGuardian?.phone || '';
      };

      // Calculate expiry date (3 years from now)
      const getExpiryDate = () => {
        const today = new Date();
        const expiryDate = new Date(today.setFullYear(today.getFullYear() + 3));
        return expiryDate.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      // Format date of birth
      const formatDateOfBirth = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      // Get school information from settings or use defaults
      const schoolInfo = {
        name: schoolSettings?.generalInfo?.name || "Trinity Family Nursery and Primary School",
        logo: schoolSettings?.generalInfo?.logo,
        signature: schoolSettings?.headTeacher?.signature,
        headTeacherName: schoolSettings?.headTeacher?.name || "Head Teacher",
        email: schoolSettings?.contact?.email || "trinityfmk@gmail.com",
        phone: schoolSettings?.contact?.phone || "0776300109 / 0774081378 / 0702957826",
        address: schoolSettings?.address?.physical || "School Address",
        website: schoolSettings?.contact?.website
      };

      // Create the PDF Document
      const PupilIDCardPDFDocument = () => (
        <Document>
          {/* Front face on first A4 page */}
          <Page size="A4" style={styles.page}>
            <View style={styles.cardContainer}>
              <View style={styles.mainContainer}>
                {/* Left Section */}
                <View style={styles.leftSection}>
                  <View style={styles.hexagonContainer}>
                    <View style={styles.photoContainer}>
                      <View style={styles.photoBorder} />
                      {pupil.photo ? (
                        <Image src={pupil.photo} style={styles.photo} />
                      ) : (
                        <Text style={{ fontSize: 6, textAlign: 'center', color: '#9ca3af' }}>
                          No Photo{'\n'}Available
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Date of Birth */}
                  <View style={styles.dobContainer}>
                    <Text style={styles.dobLabel}>DATE OF BIRTH</Text>
                    <Text style={styles.dobValue}>{formatDateOfBirth(pupil.dateOfBirth)}</Text>
                  </View>

                  <View style={styles.decorativeDots}>
                    {Array(15).fill(null).map((_, i) => (
                      <View key={i} style={styles.dot} />
                    ))}
                  </View>
                </View>

                {/* Right Section */}
                <View style={styles.rightSection}>
                  <Text style={styles.schoolName}>{schoolInfo.name}</Text>
                  <Text style={styles.schoolNameSecondLine}></Text>
                  <Text style={styles.phoneNumbers}>TEL: {schoolInfo.phone}</Text>
                  
                  <Text style={styles.idTitle}>PUPIL'S ID</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>PUPIL'S NAME:</Text>
                    <Text style={styles.value}>
                      {pupil.firstName} {pupil.lastName}
                      {pupil.otherNames && ` ${pupil.otherNames}`}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>CLASS:</Text>
                    <Text style={styles.value}>{getClassName(pupil.classId, classes)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>L.I. NUMBER:</Text>
                    <Text style={styles.value}>
                      {academicIdentifiers.find(id => id.idType === 'LIN')?.idValue || pupil.learnerIdentificationNumber || ''}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>PIN:</Text>
                    <Text style={styles.value}>{pupil.admissionNumber}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>EXPIRY DATE:</Text>
                    <Text style={styles.value}>
                      {getExpiryDate()}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>HEADTEACHER'S SIGNATURE:</Text>
                    {schoolInfo.signature ? (
                      <Image src={schoolInfo.signature} style={styles.signatureImage} />
                    ) : (
                      <Text style={styles.value}>Signature</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Page>

          {/* Back face on second A4 page */}
          <Page size="A4" style={styles.page}>
            <View style={styles.backCardContainer}>
              {/* Logo Circle */}
              <View style={styles.logoCircle}>
                {schoolInfo.logo ? (
                  <Image src={schoolInfo.logo} style={styles.backLogo} />
                ) : (
                  <Text style={{ fontSize: 8, color: COLORS.navy, fontWeight: 'bold' }}>SCHOOL{'\n'}LOGO</Text>
                )}
              </View>

              {/* Decorative Elements */}
              <View style={styles.decorativeLines}>
                {Array(15).fill(null).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * 5,
                      right: 0,
                      width: 80,
                      height: 1,
                      backgroundColor: COLORS.white,
                      transform: 'rotate(-45deg)',
                      opacity: 0.2
                    }}
                  />
                ))}
              </View>

              <View style={styles.backDecorativeDots}>
                {Array(20).fill(null).map((_, i) => (
                  <View key={i} style={styles.decorativeDot} />
                ))}
              </View>

              {/* QR Code */}
              <View style={styles.qrCodeContainer}>
                <Image src={qrCodeDataURL} style={styles.qrCode} />
              </View>

              {/* Property Notice */}
              <View style={styles.propertyNoticeContainer}>
                <Text style={styles.propertyNotice}>
                  THIS IS A PROPERTY OF {schoolInfo.name.toUpperCase()}
                </Text>
                <Text style={styles.propertyNotice}>
                  IF FOUND, PLEASE RETURN TO THE ABOVE ADDRESS OR CONTACT US
                </Text>
                <Text style={styles.emailText}>Email: {schoolInfo.email}</Text>
                <Text style={styles.emailText}>Tel: {schoolInfo.phone}</Text>
                {schoolInfo.website && (
                  <Text style={styles.emailText}>Web: {schoolInfo.website}</Text>
                )}
              </View>
            </View>
          </Page>
        </Document>
      );

      // Generate and download the PDF
      const blob = await ReactPDF.pdf(<PupilIDCardPDFDocument />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
              const safeName = formatPupilDisplayName(pupil).replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
        link.download = `${safeName}_ID_Card.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "ID Card Generated Successfully",
        description: `${pupil.firstName}'s ID card has been downloaded as PDF.`,
      });

    } catch (error) {
      console.error('Error generating ID card:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate ID card. Please try again.",
      });
    }
  };

  const handleStatusChange = () => {
    setSelectedStatus('');
    setSelectedClassId('');
    setShowClassSelection(false);
    setIsStatusChangeModalOpen(true);
  };

  const handleStatusSelection = (status: string) => {
    setSelectedStatus(status);
    // If changing to Active from another status, show class selection
    if (status === 'Active' && pupil?.status !== 'Active') {
      setShowClassSelection(true);
      setSelectedClassId(pupil?.classId || '');
    } else {
      setShowClassSelection(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!pupil || !selectedStatus) return;

    try {
      const updateData: any = { status: selectedStatus };
      
      // Create status change history entry
      const statusHistoryEntry = {
        date: new Date().toISOString(),
        fromStatus: pupil.status,
        toStatus: selectedStatus,
        reason: selectedStatus === 'Active' && showClassSelection && selectedClassId !== pupil.classId 
          ? `Status changed to Active with class change to ${getClassName(selectedClassId, classes)}`
          : `Status changed from ${pupil.status} to ${selectedStatus}`,
        processedBy: "System Admin", // TODO: Replace with actual user
        notes: selectedStatus === 'Active' && showClassSelection && selectedClassId !== pupil.classId ? `Class changed during status update to Active` : undefined,
      };

      // Add status history to update data
      updateData.statusChangeHistory = [...(pupil.statusChangeHistory || []), statusHistoryEntry];
      
      // If changing to Active and class selection was shown, update class too
      if (selectedStatus === 'Active' && showClassSelection && selectedClassId && selectedClassId !== pupil.classId) {
        updateData.classId = selectedClassId;
        updateData.className = getClassName(selectedClassId, classes);
        
        // Also add promotion history entry if class changed
        const promotionHistoryEntry = {
          date: new Date().toISOString(),
          fromClassId: pupil.classId,
          fromClassName: pupil.className || getClassName(pupil.classId, classes),
          toClassId: selectedClassId,
          toClassName: getClassName(selectedClassId, classes),
          type: 'Transfer' as const,
          notes: `Class changed during status update to Active`,
          processedBy: "System Admin", // TODO: Replace with actual user
        };
        
        updateData.promotionHistory = [...(pupil.promotionHistory || []), promotionHistoryEntry];
      }

      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      toast({
        title: "Status Updated",
        description: `${pupil.firstName}'s status has been changed to ${selectedStatus}${
          updateData.classId && updateData.classId !== pupil.classId ? ` and moved to ${getClassName(selectedClassId, classes)}` : ''
        }.`,
      });
      
      refetchPupil();
      setIsStatusChangeModalOpen(false);
    } catch (err) {
      console.error("Failed to update status:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status. Please try again.",
      });
    }
  };

  // Add PLE results hook
  const { data: pupilPLEResults = [], isLoading: isLoadingPLEResults } = usePupilPLEResults(pupilId || '');

  if (!pupilId) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Pupil Profile" />
        <p className="text-muted-foreground">No pupil ID provided. Please select a pupil from the pupils list.</p>
        <Button asChild className="mt-4" aria-label="Back to Pupils List">
          <Link href="/pupils"><ArrowLeft className="mr-2 h-4 w-4" /> Back to List</Link>
        </Button>
      </div>
    );
  }

  if (pupil === undefined) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Pupil Details..." />
        <Card>
          <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center"> <Skeleton className="h-32 w-32 rounded-full" /></div>
            <Skeleton className="h-6 w-1/2 mx-auto mt-2" /> <Skeleton className="h-4 w-1/3 mx-auto" />
            <div className="mt-4 space-y-2"> <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-full" /> </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pupil) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <PageHeader title="Pupil Profile" />
        <p className="text-muted-foreground">The pupil you are looking for does not exist.</p>
        <Button asChild className="mt-4" aria-label="Back to Pupils List">
          <Link href="/pupils"><ArrowLeft className="mr-2 h-4 w-4" /> Back to List</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Pupil Profile"
        actions={
          <div className="flex flex-row items-center gap-1 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1 action-buttons-container">
            {/* Fees Collection Button */}
            <ActionGuard module="pupils" page="detail" action="fee_collection">
              <Button asChild size="sm" className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap flex-shrink-0" aria-label="Fees Collection">
                <Link href={`/fees/collect?pupilId=${pupil.id}`}>
                  <Receipt className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Fees Collection</span>
                </Link>
              </Button>
            </ActionGuard>

            {/* Assignment & Discounts Button */}
            <ActionGuard module="pupils" page="detail" action="manage_assignments">
              <Button 
                onClick={() => setIsAssignmentModalOpen(true)}
                size="sm" 
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap flex-shrink-0" 
                aria-label="Manage Assignments"
              >
                <Tag className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Assignments</span>
              </Button>
            </ActionGuard>

            {/* Print ID Card Button */}
            <ActionGuard module="pupils" page="detail" action="print_id_card">
              <Button 
                onClick={handleGenerateIDCard}
                size="sm" 
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap flex-shrink-0" 
                aria-label="Print ID Card"
              >
                <Printer className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Print ID</span>
              </Button>
            </ActionGuard>

            {/* Tracking Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap flex-shrink-0" aria-label="Tracking Options">
                  <BarChart3 className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Tracking</span>
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Tracking Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/uniform-tracking?id=${pupil.id}`} className="cursor-pointer">
                    <Shirt className="mr-2 h-4 w-4 text-blue-600" />
                    Uniform Tracking
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/requirement-tracking?id=${pupil.id}`} className="cursor-pointer">
                    <BookOpen className="mr-2 h-4 w-4 text-purple-600" />
                    Requirements Tracking
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings/Edit Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap flex-shrink-0" aria-label="Settings">
                  <Settings className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Pupil Management</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ActionGuard module="pupils" page="detail" action="edit_details">
                  <DropdownMenuItem onClick={() => {
                    window.location.href = `/pupils/edit?id=${pupil.id}`;
                  }}>
                    <Edit className="mr-2 h-4 w-4 text-blue-600" />
                    Edit Pupil Details
                  </DropdownMenuItem>
                </ActionGuard>
                <ActionGuard module="pupils" page="detail" action="change_status">
                  <DropdownMenuItem onClick={handleStatusChange}>
                    <Shield className="mr-2 h-4 w-4 text-orange-600" />
                    Change Status
                  </DropdownMenuItem>
                </ActionGuard>
                <ActionGuard module="pupils" page="detail" action="manage_id_codes">
                  <DropdownMenuItem onClick={() => setIsManageIdCodesModalOpen(true)}>
                    <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                    Manage ID Codes
                  </DropdownMenuItem>
                </ActionGuard>
                <DropdownMenuSeparator />
                <ActionGuard module="pupils" page="detail" action="add_sibling">
                  <DropdownMenuItem onClick={() => {
                    const siblingParams = new URLSearchParams({
                      addingSibling: 'true',
                      familyId: pupil.familyId || `fam-${Date.now()}`,
                      originalPupilId: pupil.id
                    });
                    router.push(`/pupils/new?${siblingParams.toString()}`);
                  }}>
                    <UserPlus className="mr-2 h-4 w-4 text-indigo-600" />
                    Add Sibling
                  </DropdownMenuItem>
                </ActionGuard>
                <DropdownMenuSeparator />
                <ActionGuard module="pupils" page="detail" action="delete_pupil">
                  <DropdownMenuItem 
                    onClick={() => alert("Delete action for " + pupil.id)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Pupil
                  </DropdownMenuItem>
                </ActionGuard>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Back Button */}
            <Button asChild variant="outline" size="sm" className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200" aria-label="Back to List">
              <Link href="/pupils">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Main Content */}
      <div className="space-y-6">
        {/* Information Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
          <div className="xl:col-span-1 space-y-4 lg:space-y-6">
            <Card className="shadow-lg overflow-hidden">
             <CardContent className="pt-6 flex flex-col items-center bg-card">
               <PupilPhotoDetail
                 pupilPhoto={pupil.photo}
                 pupilName={formatPupilDisplayName(pupil)}
                 onPhotoChange={handlePhotoChange}
               />
              <h2 className="mt-4 text-2xl font-bold text-center text-card-foreground">{formatPupilDisplayName(pupil)}</h2>
              
              <div className="mt-2 text-sm text-muted-foreground">
                Admission No: {pupil.admissionNumber}
              </div>

              {personalIdentifiers.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-1 items-center">
                  {personalIdentifiers.map((ident, index) => (
                    <Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5 font-normal">
                      {ident.customIdName || ident.idType}: {ident.idValue}
                    </Badge>
                  ))}
                </div>
              )}
              
              <div className="mt-4 flex flex-wrap justify-center gap-2 items-center">
                {pupil.status === 'Graduated' ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                      <GraduationCap className="mr-1 h-3 w-3" />
                      Graduated
                    </Badge>
                    {pupil.graduationYear && pupil.graduationClassId ? (
                      <Link 
                        href={`/classes/graduates/${pupil.graduationClassId}`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-md text-xs text-yellow-700 hover:bg-yellow-100 transition-colors duration-200"
                      >
                        <Award className="h-3 w-3" />
                        <span>Class of {pupil.graduationYear}</span>
                      </Link>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                        Class of {pupil.graduationYear || 'Unknown'}
                      </Badge>
                    )}
                    {pupil.graduationDate && (
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        {new Date(pupil.graduationDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant={pupil.status === 'Active' ? 'default' : pupil.status === 'Inactive' ? 'secondary' : 'outline'} className="text-xs">{pupil.status}</Badge>
                )}
                <Badge variant="outline" className="text-xs">{pupil.section}</Badge>
                {pupil.classId ? (
                  <Link href={`/class-detail?id=${pupil.classId}`}>
                    <Badge variant="outline" className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                      {getClassNameMemo(pupil.classId)}
                    </Badge>
                  </Link>
                ) : (
                  <Badge variant="outline" className="text-xs">{getClassNameMemo(pupil.classId)}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg lg:text-xl"><UserSquare className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <DetailItem key="dob" icon={<CalendarDays />} label="Date of Birth" value={formatDate(pupil.dateOfBirth)} />
              <DetailItem key="pob" icon={<MapPin />} label="Place of Birth" value={pupil.placeOfBirth} />
              <DetailItem key="gender" icon={<UserSquare />} label="Gender" value={pupil.gender} />
              <DetailItem key="address" icon={<Home />} label="Address" value={pupil.address} />
              <DetailItem key="nationality" label="Nationality" value={pupil.nationality} />
              <DetailItem key="religion" label="Religion" value={pupil.religion} />
              <DetailItem key="regdate" label="Registration Date" value={formatDate(pupil.registrationDate)} />
              
              {/* rMQR Code - HIDDEN per user request */}
              {/* <div className="mt-4 pt-2 border-t border-border/50">
                <div className="flex flex-col items-center">
                  <h4 className="text-sm font-medium mb-1">Pupil ID Card</h4>
                  <RMQRCode
                    data={`Name: ${formatPupilDisplayName(pupil)}
DOB: ${formatDate(pupil.dateOfBirth)}
Admission #: ${pupil.admissionNumber || 'N/A'}
Registration: ${formatDate(pupil.registrationDate)}
Gender: ${pupil.gender || 'N/A'}
Emergency Contact: ${emergencyContactGuardian ? emergencyContactGuardian.phone : 'N/A'}`}
                    pixelSize={5}
                    className=""
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Rectangular Micro QR Code (rMQR)
                  </p>
                </div>
              </div> */}
            </CardContent>
          </Card>
          
          {pupil.familyId && actualSiblings.length > 0 && (
             <Card className="shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg lg:text-xl"><GuardianIconLucide className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> Family &amp; Siblings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground mb-3">Siblings in School ({actualSiblings.length}):</p>
                      <div className="space-y-3">
                        {actualSiblings.map(sibling => (
                          <div key={sibling.id} className="p-3 rounded-md border bg-muted/20 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <Link href={`/pupil-detail?id=${sibling.id}`} className="text-primary hover:underline font-medium">
                                  {sibling.firstName} {sibling.lastName} {sibling.otherNames || ''}
                                </Link>
                                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-4">
                                    <span>Adm. No: <span className="font-mono">{sibling.admissionNumber}</span></span>
                                    <span>Class: <span className="font-medium">
                                      {sibling.classId ? (
                                        <Link 
                                          href={`/class-detail?id=${sibling.classId}`}
                                          className="text-primary hover:underline cursor-pointer"
                                        >
                                          {getClassNameMemo(sibling.classId)}
                                        </Link>
                                      ) : (
                                        getClassNameMemo(sibling.classId)
                                      )}
                                    </span></span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span>Gender: {sibling.gender}</span>
                                    <span>Section: {sibling.section}</span>
                                    <Badge variant={sibling.status === 'Active' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0.5">
                                      {sibling.status}
                                    </Badge>
                                  </div>
                                  {sibling.dateOfBirth && (
                                    <div>Age: {new Date().getFullYear() - new Date(sibling.dateOfBirth).getFullYear()} years</div>
                                  )}
                                </div>
                              </div>
                              {sibling.photo && (
                                <Avatar className="h-12 w-12 border-2 border-primary/20">
                                  <AvatarImage
                                    src={sibling.photo && sibling.photo.trim() !== '' ? sibling.photo : undefined}
                                    alt={`${sibling.firstName} ${sibling.lastName}`}
                                    data-ai-hint="sibling photo"
                                  />
                                  <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                    {sibling.firstName?.[0] || 'S'}{sibling.lastName?.[0] || 'S'}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                </CardContent>
              </Card>
            )}

          {/* Exams Tile - moved to appear after Family & Siblings */}
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <CardTitle className="flex items-center text-base lg:text-lg">
                  <BookOpen className="mr-2 h-4 w-4 text-primary" /> Examination Records
                </CardTitle>
                
                <div className="flex flex-wrap items-center gap-2">
                  {shouldLoadExams && (
                    <>
                      <div className="w-28">
                        <Select
                          value={examFilters.academicYearId}
                          onValueChange={(value) => setExamFilters(prev => ({ ...prev, academicYearId: value, termId: 'all' }))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                            <SelectItem value="all">All Years</SelectItem>
                            {academicYears.map(year => (
                              <SelectItem key={year.id} value={year.id}>
                                {year.name}{year.isActive ? ' (Active)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="w-24">
                        <Select
                          value={examFilters.termId}
                          onValueChange={(value) => setExamFilters(prev => ({ ...prev, termId: value }))}
                          disabled={examFilters.academicYearId === 'all'}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Term" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-[200px] overflow-y-auto">
                            <SelectItem value="all">All Terms</SelectItem>
                            {availableTerms.map(term => (
                              <SelectItem key={term.id} value={term.id}>
                                {term.name}{term.isCurrent ? ' (Current)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Button
                        onClick={() => setShouldLoadExams(false)}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Hide
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* PLE Results Section - Always shown first, not affected by filters */}
              {isLoadingPLEResults ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading PLE results...</span>
                </div>
              ) : pupilPLEResults.length > 0 ? (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-lg">PLE Results</h3>
                    <Badge variant="outline" className="text-xs">
                      {pupilPLEResults.length} record{pupilPLEResults.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {pupilPLEResults.map(({ pleRecord, pupilResult }) => (
                      <PLEResultsCard
                        key={pleRecord.id}
                        pleRecord={pleRecord}
                        pupilResult={pupilResult}
                        className="border-purple-200"
                      />
                    ))}
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-lg mb-3">Other Examination Records</h3>
                  </div>
                </div>
              ) : null}

              {/* Regular Exam Results Section - Load on demand */}
              {!shouldLoadExams ? (
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex flex-col items-center gap-2">
                    <Button 
                      onClick={() => setShouldLoadExams(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      {pupilExamHistory ? 'Show Exams' : 'View Exams'}
                    </Button>
                  </div>
                </div>
              ) : isLoadingExamHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading exam history...</span>
                </div>
              ) : (!pupilExamHistory || !pupilExamHistory.examResults || pupilExamHistory.examResults.length === 0) ? (
                <div className="text-center p-4 bg-muted/30 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    {pupilPLEResults.length > 0 ? 'No other exam records found for this pupil.' : 'No exam records found for this pupil.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pupilExamHistory.examResults
                    .filter(examResult => {
                      // Find the corresponding exam data
                      const examData = pupilExamHistory.exams.find(exam => exam.id === examResult.examId);
                      if (!examData) return false;
                      
                      // Apply academic year filter
                      if (examFilters.academicYearId !== 'all' && examData.academicYearId !== examFilters.academicYearId) {
                        return false;
                      }
                      
                      // Apply term filter
                      if (examFilters.termId !== 'all' && examData.termId !== examFilters.termId) {
                        return false;
                      }
                      
                      return true;
                    })
                    .map((examResult) => {
                    // Find the corresponding exam data
                    const examData = pupilExamHistory.exams.find(exam => exam.id === examResult.examId);
                    if (!examData) return null;
                    
                    // Find pupil's data for this exam
                    const pupilData = examResult.pupilSnapshots?.find(p => p.pupilId === pupilId);
                    if (!pupilData) return null;
                    
                    // Calculate pupil's performance
                    let totalMarks = 0;
                    let totalAggregates = 0;
                    let subjectCount = 0;
                    
                    if (examResult.results && examResult.results[pupilId || '']) {
                      const results = examResult.results[pupilId || ''];
                      
                      Object.values(results).forEach((result: any) => {
                        if (result.marks !== undefined) {
                          totalMarks += result.marks || 0;
                          totalAggregates += result.aggregates || 0;
                          subjectCount++;
                        }
                      });
                    }
                    
                    const averageMarks = subjectCount > 0 ? (totalMarks / subjectCount).toFixed(1) : 'N/A';
                    
                    // Calculate division based on aggregates
                    const getDivision = (totalAggs: number) => {
                      if (totalAggs <= 8) return "DIV I";
                      if (totalAggs <= 16) return "DIV II";
                      if (totalAggs <= 24) return "DIV III";
                      if (totalAggs <= 32) return "DIV IV";
                      return "DIV U";
                    };
                    
                    const division = subjectCount > 0 ? getDivision(totalAggregates) : 'N/A';
                    
                    // Format date
                    const examDate = examData.startDate ? formatDate(examData.startDate) : 'N/A';
                    
                    return (
                      <Link 
                        href={`/exams/${examData.id}/pupil-results/${pupilId}?classId=${examData.classId}`}
                        key={examResult.id}
                        className="block p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="font-medium text-primary">{examData.name}</h4>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                              <span className="flex items-center">
                                <CalendarDays className="mr-1 h-3 w-3" /> {examDate}
                              </span>
                              <span className="flex items-center">
                                <Tag className="mr-1 h-3 w-3" /> {examData.examTypeName || 'Exam'}
                              </span>
                              <span className="flex items-center">
                                <GraduationCap className="mr-1 h-3 w-3" /> {pupilData.classNameAtExam || 'N/A'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {subjectCount > 0 ? (
                              <>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      Total: {totalMarks}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      Avg: {averageMarks}%
                                    </Badge>
                                  </div>
                                  <div className="text-xs mt-1 font-medium">
                                    <span className={`px-2 py-0.5 rounded ${
                                      division === "DIV I" ? "bg-green-100 text-green-800" :
                                      division === "DIV II" ? "bg-blue-100 text-blue-800" :
                                      division === "DIV III" ? "bg-yellow-100 text-yellow-800" :
                                      division === "DIV IV" ? "bg-orange-100 text-orange-800" :
                                      "bg-red-100 text-red-800"
                                    }`}>
                                      {division} ({totalAggregates})
                                    </span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-xs">View Results</Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        <div className="xl:col-span-2 space-y-4 lg:space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg lg:text-xl"><AcademicIcon className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> Academic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <DetailItem 
                key="class" 
                label="Current Class" 
                value={
                  pupil.classId ? (
                    <Link 
                      href={`/class-detail?id=${pupil.classId}`}
                      className="text-primary hover:underline font-medium cursor-pointer"
                    >
                      {getClassNameMemo(pupil.classId)}
                    </Link>
                  ) : (
                    getClassNameMemo(pupil.classId)
                  )
                } 
              />
              <DetailItem key="section" label="Section" value={pupil.section} />
              {academicIdentifiers.map((ident, index) => (
                <DetailItem key={`acad-id-${index}`} label={ident.customIdName || ident.idType} value={ident.idValue} />
              ))}
              {/* Display old LIN from root if no additional LIN present and it exists */}
              {pupil.learnerIdentificationNumber && !academicIdentifiers.some(id => id.idType === 'LIN') && (
                 <DetailItem key="lin-legacy" label="Learner ID (LIN)" value={pupil.learnerIdentificationNumber} />
              )}
              <DetailItem key="prevschool" label="Previous School" value={pupil.previousSchool} />
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg lg:text-xl"><GuardianIconLucide className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> Guardian Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pupil.guardians && pupil.guardians.length > 0 ? (
                pupil.guardians.map((guardian, index) => (
                  <div key={guardian.id || index} className={`p-3 rounded-md border bg-muted/30 ${index > 0 ? "mt-4" : ""}`}>
                    <h4 className="font-semibold text-sm lg:text-md mb-2 text-foreground flex flex-wrap items-center gap-2">
                      {guardian.firstName} {guardian.lastName} 
                      <Badge variant="outline" className="text-xs">{guardian.relationship}</Badge>
                    </h4>
                    <div className="space-y-1 text-sm">
                      <DetailItem 
                        key={`guardian-${index}-phone`} 
                        icon={<Phone />} 
                        label="Phone" 
                        value={
                          guardian.phone ? (
                            <a 
                              href={`tel:${guardian.phone}`}
                              className="text-primary hover:underline font-medium cursor-pointer"
                            >
                              {guardian.phone}
                            </a>
                          ) : (
                            guardian.phone
                          )
                        } 
                      />
                      <DetailItem key={`guardian-${index}-email`} icon={<Mail />} label="Email" value={guardian.email} />
                      <DetailItem key={`guardian-${index}-occupation`} icon={<Briefcase />} label="Occupation" value={guardian.occupation} />
                      <DetailItem key={`guardian-${index}-address`} icon={<Home />} label="Address" value={guardian.address} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No guardian information available.</p>
              )}
            </CardContent>
          </Card>

          {(emergencyContactGuardian || pupil.bloodType || pupil.medicalConditions || pupil.allergies || pupil.medications) && (
            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg lg:text-xl"><HeartPulse className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-primary" /> Medical Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                 {emergencyContactGuardian && (
                  <DetailItem 
                    key="emergency" 
                    label="Emergency Contact" 
                    value={
                      <span>
                        {emergencyContactGuardian.firstName} {emergencyContactGuardian.lastName} ({emergencyContactGuardian.relationship}) - Ph: {
                          emergencyContactGuardian.phone ? (
                            <a 
                              href={`tel:${emergencyContactGuardian.phone}`}
                              className="text-primary hover:underline font-medium cursor-pointer"
                            >
                              {emergencyContactGuardian.phone}
                            </a>
                          ) : (
                            emergencyContactGuardian.phone
                          )
                        }
                      </span>
                    } 
                    highlight 
                  />
                )}
                <DetailItem key="bloodtype" label="Blood Type" value={pupil.bloodType} />
                <DetailItem key="conditions" label="Known Medical Conditions" value={pupil.medicalConditions} multiline />
                <DetailItem key="allergies" label="Allergies" value={pupil.allergies} multiline />
                <DetailItem key="medications" label="Current Medications" value={pupil.medications} multiline />
              </CardContent>
            </Card>
          )}

          {/* Status Change History */}
          {pupil.statusChangeHistory && pupil.statusChangeHistory.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg lg:text-xl">
                  <Shield className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-orange-600" />
                  Status Change History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pupil.statusChangeHistory
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((entry, index) => (
                    <div key={index} className="p-3 rounded-md border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                              {entry.fromStatus} → {entry.toStatus}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          {entry.reason && (
                            <p className="text-xs text-muted-foreground mt-1">{entry.reason}</p>
                          )}
                          {entry.processedBy && (
                            <p className="text-xs text-muted-foreground">Processed by: {entry.processedBy}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Promotion History */}
          {pupil.promotionHistory && pupil.promotionHistory.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg lg:text-xl">
                  <GraduationCap className="mr-2 lg:mr-3 h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
                  Class Changes & Promotions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pupil.promotionHistory
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((entry, index) => (
                    <div key={index} className="p-3 rounded-md border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <div className="flex items-center">
                              {entry.type === 'Promotion' && <TrendingUp className="mr-1 h-3 w-3 text-green-600" />}
                              {entry.type === 'Demotion' && <TrendingDown className="mr-1 h-3 w-3 text-red-600" />}
                              {entry.type === 'Graduation' && <GraduationCap className="mr-1 h-3 w-3 text-yellow-600" />}
                              {(entry.type === 'Transfer' || entry.type === 'Initial Placement') && <ArrowRight className="mr-1 h-3 w-3 text-blue-600" />}
                              <Badge variant="outline" className={`text-xs ${
                                entry.type === 'Promotion' ? 'bg-green-100 text-green-800 border-green-300' :
                                entry.type === 'Demotion' ? 'bg-red-100 text-red-800 border-red-300' :
                                entry.type === 'Graduation' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                'bg-blue-100 text-blue-800 border-blue-300'
                              }`}>
                                {entry.type}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          <div className="text-sm">
                            {entry.type === 'Graduation' ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-yellow-700">
                                  Graduated from {entry.fromClassName || 'N/A'}
                                </span>
                                {entry.graduationYear && entry.toClassId && (
                                  <Link 
                                    href={`/classes/graduates/${entry.toClassId}`}
                                    className="inline-flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 underline"
                                  >
                                    <Award className="h-3 w-3" />
                                    View Class of {entry.graduationYear} Graduates
                                  </Link>
                                )}
                              </div>
                            ) : (
                              <span className="font-medium">
                                {entry.fromClassName || 'N/A'} → {entry.toClassName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
                </div>

            {/* Fees Section - HIDDEN per user request */}
            {/* <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Receipt className="mr-3 h-6 w-6 text-green-600" />
                  Fee Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Fee Management</h3>
                  <p className="text-gray-600 mb-4">
                    View and manage {pupil.firstName}'s fee information, payments, and outstanding balances.
                  </p>
                  <Button className="bg-green-600 hover:bg-green-700">
                    View Fee Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div> */}

            {/* Requirements Section - HIDDEN per user request */}
            {/* <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Shirt className="mr-3 h-6 w-6 text-purple-600" />
                  Requirements & Uniforms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Shirt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Requirements Tracking</h3>
                  <p className="text-gray-600 mb-4">
                    Track {pupil.firstName}'s uniform requirements, books, and other school supplies.
                  </p>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    View Requirements
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div> */}

            {/* Attendance Section - HIDDEN per user request */}
            {/* <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <BarChart3 className="mr-3 h-6 w-6 text-orange-600" />
                  Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Attendance Tracking</h3>
                  <p className="text-gray-600 mb-4">
                    View {pupil.firstName}'s attendance records, patterns, and statistics.
                  </p>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    View Attendance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div> */}

            {/* Results Section - HIDDEN per user request */}
            {/* <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <BookOpen className="mr-3 h-6 w-6 text-indigo-600" />
                  Examination Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pupilExamHistory && pupilExamHistory.examResults && pupilExamHistory.examResults.length > 0 ? (
                  <div className="space-y-4">
                    {pupilExamHistory.examResults.slice(0, 5).map((examResult: any) => (
                      <div key={examResult.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">Exam Result</h4>
                            <p className="text-sm text-gray-600">Result ID: {examResult.id}</p>
                          </div>
                          <Badge variant="outline">View Results</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
                    <p className="text-gray-600 mb-4">
                      {pupil.firstName} hasn't taken any exams yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div> */}
        </div>

      {/* Status Change Modal */}
      <ModernDialog open={isStatusChangeModalOpen} onOpenChange={(open) => !open && setIsStatusChangeModalOpen(false)}>
        <ModernDialogContent size="md" open={isStatusChangeModalOpen} onOpenChange={(open) => !open && setIsStatusChangeModalOpen(false)}>
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5 text-orange-600" />
              Change Pupil Status
            </ModernDialogTitle>
            <ModernDialogDescription>
              Change {formatPupilDisplayName(pupil)}'s status from <strong>{pupil.status}</strong> to a new status.
            </ModernDialogDescription>
          </ModernDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status-select">New Status</Label>
              <Select value={selectedStatus} onValueChange={handleStatusSelection}>
                <SelectTrigger id="status-select">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Graduated">Graduated</SelectItem>
                  <SelectItem value="Transferred">Transferred</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showClassSelection && (
              <div className="space-y-2">
                <Label htmlFor="class-select">Class Assignment</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger id="class-select">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={pupil.classId || ''}>Keep Current Class ({getClassNameMemo(pupil.classId)})</SelectItem>
                    {classes
                      .filter(cls => cls.id !== pupil.classId)
                      .map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          Change to {cls.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Since you're changing the status to Active, you can choose to keep the current class or move to a different class.
                </p>
              </div>
            )}
          </div>

          <ModernDialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsStatusChangeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={!selectedStatus || updatePupilMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {updatePupilMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Update Status
                </>
              )}
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      <ManageIdCodesModal 
        isOpen={isManageIdCodesModalOpen}
        onClose={() => setIsManageIdCodesModalOpen(false)}
        onSave={handleSaveIdCodes}
        existingIdentifiers={pupil.additionalIdentifiers || []}
        pupilName={formatPupilDisplayName(pupil)}
      />

      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        pupil={pupil}
        onSave={handleSaveAssignments}
      />
    </>
  );
}

export default function PupilDetailPage() {
  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Pupil Details..." />
        <Card>
          <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center"> <Skeleton className="h-32 w-32 rounded-full" /></div>
            <Skeleton className="h-6 w-1/2 mx-auto mt-2" /> <Skeleton className="h-4 w-1/3 mx-auto" />
            <div className="mt-4 space-y-2"> <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-full" /> </div>
          </CardContent>
        </Card>
      </div>
    }>
      <PupilDetailContent />
    </Suspense>
  );
} 