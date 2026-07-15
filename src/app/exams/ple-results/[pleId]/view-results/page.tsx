"use client";

import * as React from "react";
import { ArrowLeft, Download, Search, X, GraduationCap, Users, Trophy, TrendingUp, Star, Medal, Printer, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, FileText, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { pdf } from '@react-pdf/renderer';
import CertificatePDFDocument from '@/components/certificates/PLECertificatePDF';
import PLEBatchCertificatesPDF from '@/components/certificates/PLEBatchCertificatesPDF';
import QRCode from 'qrcode';
import { GlassPageTopBar, GlassActionDock, GlassActionButton, GlassPageSearchInput } from "@/components/common/glass-page-top-bar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Import Firebase hooks and types
import {
  usePLERecord,
  usePLEResultsWithCurrentData
} from "@/lib/hooks/use-ple-results";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import type { PLEPupilResult, PLERecord } from "@/lib/services/ple-results.service";
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateExamPDF } from '@/components/exam/ExamResultsPDF';
import { PLESubjectsService } from '@/lib/services/ple-subjects.service';
import { PLESubjectReorderModal } from '@/components/ple/PLESubjectReorderModal';

// PLE Subjects - now managed centrally
// Individual components will use PLESubjectsService.getSubjectsForRecord()

interface PLEStatistics {
  totalCandidates: number;
  divisionI: number;
  divisionII: number;
  divisionIII: number;
  divisionIV: number;
  divisionU: number;
  maleCount: number;
  femaleCount: number;
  averageAggregate: number;
  bestPerformer: PLEPupilResult | null;
}

// Calculate statistics
const calculateStatistics = (results: PLEPupilResult[]): PLEStatistics => {
  const totalCandidates = results.length;
  const maleCount = results.filter(r => r.gender === 'Male').length;
  const femaleCount = results.filter(r => r.gender === 'Female').length;

  // Only count pupils who participated and have complete results for division statistics
  const participatedResults = results.filter(r => r.status !== 'missed');
  const completeResults = participatedResults.filter(r =>
    r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate)
  );

  const divisionI = completeResults.filter(r => r.division === 'I').length;
  const divisionII = completeResults.filter(r => r.division === 'II').length;
  const divisionIII = completeResults.filter(r => r.division === 'III').length;
  const divisionIV = completeResults.filter(r => r.division === 'IV').length;
  const divisionU = completeResults.filter(r => r.division === 'U').length;

  // Calculate average only for pupils with complete results who participated
  const totalAggregate = completeResults.reduce((sum, r) => sum + r.totalAggregate, 0);
  const averageAggregate = completeResults.length > 0 ? totalAggregate / completeResults.length : 0;

  // Find best performer among those with complete results who participated
  const bestPerformer = completeResults.reduce((best, current) => {
    if (!best || (current.totalAggregate > 0 && current.totalAggregate < best.totalAggregate)) {
      return current;
    }
    return best;
  }, null as PLEPupilResult | null);

  return {
    totalCandidates,
    divisionI,
    divisionII,
    divisionIII,
    divisionIV,
    divisionU,
    maleCount,
    femaleCount,
    averageAggregate: Math.round(averageAggregate * 10) / 10,
    bestPerformer
  };
};

// Get aggregate badge color
const getAggregateBadgeVariant = (aggregate: string) => {
  if (['D1', 'D2'].includes(aggregate)) return 'default';
  if (['C3', 'C4', 'C5', 'C6'].includes(aggregate)) return 'secondary';
  if (['P7', 'P8'].includes(aggregate)) return 'outline';
  return 'destructive'; // F9
};

// Get division badge color
const getDivisionBadgeVariant = (division: string) => {
  switch (division) {
    case 'I': return 'default';
    case 'II': return 'secondary';
    case 'III': return 'outline';
    case 'IV': return 'destructive';
    case 'U': return 'destructive';
    default: return 'outline';
  }
};

export default function ViewPLEResultsPage({ params }: { params: Promise<{ pleId: string }> }) {
  const router = useRouter();
  const { toast } = useToast();

  // PDF Viewer hook
  const pdfViewer = usePDFViewer();

  // Unwrap params using React.use()
  const { pleId } = React.use(params);

  // Firebase hooks
  const { data: pleRecord, isLoading: recordLoading, error: recordError } = usePLERecord(pleId);
  const { data: rawPupilResults = [], isLoading: resultsLoading, error: resultsError } = usePLEResultsWithCurrentData(pleId);
  const { data: schoolSettings } = useSchoolSettings();

  // Memoize pupil results to prevent unnecessary re-renders
  const pupilResults = React.useMemo(() => {
    return rawPupilResults || [];
  }, [rawPupilResults]);

  // State management
  const [mounted, setMounted] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [divisionFilter, setDivisionFilter] = React.useState<string>("all");
  const [genderFilter, setGenderFilter] = React.useState<string>("all");
  const [completionFilter, setCompletionFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("totalAggregate");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [showPrintDialog, setShowPrintDialog] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = React.useState(false);

  // Get ordered subjects for this PLE record
  const orderedSubjects = React.useMemo(() => {
    return PLESubjectsService.getSubjectsForRecord(pleRecord);
  }, [pleRecord]);

  // Mount effect
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle error states
  React.useEffect(() => {
    if (recordError || resultsError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load PLE results. Please try again.",
      });
    }
  }, [recordError, resultsError]);

  const isLoading = recordLoading || resultsLoading;

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get sort icon for a column
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    }
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />
      : <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  // Filter and sort results using useMemo instead of useEffect to prevent infinite loops
  const filteredResults = React.useMemo(() => {
    // Only filter if component is mounted and we have data
    if (!mounted || !pupilResults || pupilResults.length === 0) {
      return [];
    }

    let filtered = [...pupilResults]; // Create a copy to avoid mutations

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(pupil =>
        formatPupilDisplayName(pupil).toLowerCase().includes(searchLower) ||
        pupil.admissionNumber.toLowerCase().includes(searchLower)
      );
    }

    // Division filter
    if (divisionFilter !== "all") {
      filtered = filtered.filter(pupil => pupil.division === divisionFilter);
    }

    // Gender filter
    if (genderFilter !== "all") {
      filtered = filtered.filter(pupil => pupil.gender === genderFilter);
    }

    // Completion filter
    if (completionFilter !== "all") {
      if (completionFilter === "complete") {
        filtered = filtered.filter(pupil =>
          pupil.status !== 'missed' && pupil.division && pupil.totalAggregate > 0 && Object.values(pupil.subjects).every(aggregate => aggregate)
        );
      } else if (completionFilter === "partial") {
        filtered = filtered.filter(pupil =>
          pupil.status !== 'missed' &&
          (Object.values(pupil.subjects).some(aggregate => aggregate) || pupil.division) &&
          !(pupil.division && pupil.totalAggregate > 0 && Object.values(pupil.subjects).every(aggregate => aggregate))
        );
      } else if (completionFilter === "none") {
        filtered = filtered.filter(pupil =>
          pupil.status !== 'missed' &&
          Object.values(pupil.subjects).every(aggregate => !aggregate) && !pupil.division
        );
      } else if (completionFilter === "missed") {
        filtered = filtered.filter(pupil => pupil.status === 'missed');
      }
    }

    // Sort results
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = formatPupilDisplayName(a).localeCompare(formatPupilDisplayName(b));
          break;
        case 'admissionNumber':
          comparison = (a.admissionNumber || '').localeCompare(b.admissionNumber || '');
          break;
        case 'indexNumber':
          comparison = (a.indexNumber || '').localeCompare(b.indexNumber || '');
          break;
        case 'totalAggregate':
          const aAgg = a.status === 'missed' ? Infinity : (a.totalAggregate || 0);
          const bAgg = b.status === 'missed' ? Infinity : (b.totalAggregate || 0);
          comparison = aAgg - bAgg;
          break;
        case 'division':
          // Sort by division: I < II < III < IV < U, then by total aggregate
          const divisionOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'U': 5 };
          const aDiv = a.division ? divisionOrder[a.division as keyof typeof divisionOrder] || 99 : 99;
          const bDiv = b.division ? divisionOrder[b.division as keyof typeof divisionOrder] || 99 : 99;
          if (aDiv !== bDiv) {
            comparison = aDiv - bDiv;
          } else {
            // If same division, sort by total aggregate
            const aAgg2 = a.status === 'missed' ? Infinity : (a.totalAggregate || 0);
            const bAgg2 = b.status === 'missed' ? Infinity : (b.totalAggregate || 0);
            comparison = aAgg2 - bAgg2;
          }
          break;
        case 'english':
        case 'mathematics':
        case 'science':
        case 'social_studies':
          const aSubject = a.subjects[sortField] || '';
          const bSubject = b.subjects[sortField] || '';
          // Convert aggregate to number for comparison (D1=1, D2=2, C3=3, etc.)
          const getAggregateValue = (agg: string) => {
            if (!agg) return 99;
            if (agg.startsWith('D')) return parseInt(agg.substring(1)) || 99;
            if (agg.startsWith('C')) return parseInt(agg.substring(1)) + 2 || 99;
            if (agg.startsWith('P')) return parseInt(agg.substring(1)) + 6 || 99;
            if (agg.startsWith('F')) return parseInt(agg.substring(1)) + 8 || 99;
            return 99;
          };
          comparison = getAggregateValue(aSubject) - getAggregateValue(bSubject);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [mounted, pupilResults, searchTerm, divisionFilter, genderFilter, completionFilter, sortField, sortDirection]);

  // Calculate statistics using useMemo instead of useEffect to prevent infinite loops
  const statistics = React.useMemo(() => {
    if (!mounted || !pupilResults || pupilResults.length === 0) {
      return null;
    }

    // Debug: Log the first pupil to see what data we have
    if (pupilResults.length > 0) {
      console.log('Sample pupil data:', pupilResults[0]);
      console.log('Admission numbers:', pupilResults.map(p => ({ id: p.pupilId, admissionNumber: p.admissionNumber })));
    }

    return calculateStatistics(pupilResults);
  }, [mounted, pupilResults]);

  // PLE Aggregate to Points mapping
  const PLE_AGGREGATE_POINTS: Record<string, number> = {
    'D1': 1, 'D2': 2, 'C3': 3, 'C4': 4, 'C5': 5, 'C6': 6, 'P7': 7, 'P8': 8, 'F9': 9
  };

  // Convert PLE aggregate to marks (for assessment report compatibility)
  const aggregateToMarks = (aggregate: string): number => {
    // Map aggregates to approximate marks: D1=90-100, D2=80-89, C3=70-79, etc.
    const marksMap: Record<string, number> = {
      'D1': 95, 'D2': 85, 'C3': 75, 'C4': 70, 'C5': 65, 'C6': 60, 'P7': 55, 'P8': 50, 'F9': 35
    };
    return marksMap[aggregate] || 50;
  };

  // Adapt PLE data for assessment report
  const adaptPLEDataForAssessment = () => {
    const validPupils = pupilResults.filter(pupil =>
      pupil.status !== 'missed' &&
      pupil.division &&
      pupil.totalAggregate > 0
    );

    // Convert PLE subjects to subject snaps format
    const subjectSnaps = orderedSubjects.map(subject => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      fullMarks: 100,
      teacherId: '',
      teacherName: 'Not Assigned'
    }));

    // Convert PLE pupil results to processed results format
    const processedResults = validPupils.map((pupil, index) => {
      // Convert PLE aggregates to marks for each subject
      // Use subject CODES (ENG, MATH, etc.) as keys, not IDs
      const results: Record<string, { marks: number; aggregates: number; grade: string }> = {};

      orderedSubjects.forEach(subject => {
        const aggregate = pupil.subjects[subject.id] || 'F9';
        // PLE doesn't use marks/scores, only aggregates
        const aggregates = PLE_AGGREGATE_POINTS[aggregate] || 9;
        const grade = aggregate; // Use aggregate as grade for PLE

        // Use subject.code (ENG, MATH, etc.) as the key, not subject.id
        // For PLE, we want to show only the grade (aggregate), not marks
        // Set marks to 0 - the PDF generator will detect this and show only the grade
        results[subject.code] = {
          marks: 0, // No marks for PLE - PDF generator will show only grade when marks is 0
          aggregates,
          grade
        };
      });

      // PLE doesn't use total marks, only total aggregates
      const totalMarks = 0; // No total marks for PLE
      const totalAggregates = pupil.totalAggregate;

      // Format name as: LastName, FirstName OtherNames
      const nameParts = [];
      if (pupil.lastName) nameParts.push(pupil.lastName);
      if (pupil.firstName) nameParts.push(pupil.firstName);
      if (pupil.otherNames) nameParts.push(pupil.otherNames);
      const fullName = nameParts.length > 0
        ? nameParts.join(' ')
        : pupil.firstName || pupil.lastName || '';

      return {
        pupilInfo: {
          pupilId: pupil.pupilId,
          name: fullName,
          admissionNumber: pupil.admissionNumber || '',
          indexNumber: pupil.indexNumber || '',
          learnerIdentificationNumber: pupil.learnerIdentificationNumber || ''
        },
        results, // Changed from subjectResults to results
        totalMarks,
        totalAggregates,
        division: pupil.division || '',
        position: index + 1,
        average: totalMarks / orderedSubjects.length
      };
    });

    // Sort by total aggregates (ascending - lower is better in PLE)
    processedResults.sort((a, b) => a.totalAggregates - b.totalAggregates);

    // Update positions after sorting
    processedResults.forEach((result, index) => {
      result.position = index + 1;
    });

    return {
      examDetails: {
        name: pleRecord?.examName || 'PLE',
        examTypeName: 'Primary Leaving Examination',
        startDate: pleRecord?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        endDate: pleRecord?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      },
      classSnap: {
        name: `P7 - ${pleRecord?.year || new Date().getFullYear()}`
      },
      subjectSnaps,
      processedResults,
      majorSubjects: orderedSubjects.map(s => s.code)
    };
  };

  // Generate assessment report
  const handleGenerateAssessment = async () => {
    try {
      setShowPrintDialog(false);

      const validPupils = pupilResults.filter(pupil =>
        pupil.status !== 'missed' &&
        pupil.division &&
        pupil.totalAggregate > 0
      );

      if (validPupils.length === 0) {
        toast({
          variant: "destructive",
          title: "No Valid Results",
          description: "No pupils with complete results found to generate assessment report.",
        });
        return;
      }

      toast({
        title: "Generating Assessment Report",
        description: `Generating assessment report for ${validPupils.length} pupils...`,
      });

      const adaptedData = adaptPLEDataForAssessment();

      // PLE doesn't use grading scale - pass empty array to hide it
      const gradingScale: any[] = [];

      // Generate the PDF with school settings
      const blob = await generateExamPDF({
        ...adaptedData,
        schoolSettings: schoolSettings || {},
        printOptions: {
          showPin: true,
          showMarks: false, // Hide marks column for PLE (no scores)
          showAgg: true, // Show aggregates
          showTotal: false, // Hide total marks column (no total score for PLE)
          showDiv: true, // Show division
          fillMarks: true, // Need to fill to show grades, but we'll handle marks=0 specially
          fillAgg: true, // Fill aggregates
          fillTotal: false, // Don't fill total
          fillDiv: true, // Fill division
          showMajorSubjects: true,
          showBestPupil: false, // Hide best performance for PLE
          showNeedsImprovement: false, // Hide worst performance for PLE
          showAggregateAnalysis: true
        },
        gradingScale // Empty array to hide grading scale
      });

      // Open in PDF viewer
      const fileName = `PLE_Assessment_${pleRecord?.year || new Date().getFullYear()}.pdf`;
      const title = 'PLE Assessment Report';
      pdfViewer.openPDFFromBlob(blob, fileName, title);

      toast({
        title: "Assessment Report Generated",
        description: `Assessment report for ${validPupils.length} pupils is ready for viewing.`,
      });
    } catch (error) {
      console.error('Error generating assessment report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate assessment report. Please try again.",
      });
    }
  };

  // Export batch certificates
  const handleExportResults = async () => {
    try {
      // Filter pupils with complete results who didn't miss the exam
      const validPupils = pupilResults.filter(pupil =>
        pupil.status !== 'missed' &&
        pupil.division &&
        pupil.totalAggregate > 0
      );

      if (validPupils.length === 0) {
        toast({
          variant: "destructive",
          title: "No Valid Results",
          description: "No pupils with complete results found to generate certificates.",
        });
        return;
      }

      toast({
        title: "Generating Certificates",
        description: `Generating batch certificates for ${validPupils.length} pupils...`,
      });

      // Get school information from settings
      const schoolName = schoolSettings?.generalInfo?.name || 'TRINITY FAMILY NURSERY AND PRIMARY SCHOOL';
      const schoolLogo = schoolSettings?.generalInfo?.logo;
      const schoolMotto = schoolSettings?.generalInfo?.motto || 'STRIVE TO EXCEL';
      const headTeacherSignature = schoolSettings?.headTeacher?.signature;

      // Prepare school contact information
      const schoolContact = {
        phone: schoolSettings?.contact?.phone,
        alternativePhone: schoolSettings?.contact?.alternativePhone,
        email: schoolSettings?.contact?.email,
        website: schoolSettings?.contact?.website,
        address: schoolSettings?.address?.physical,
        postal: schoolSettings?.address?.postal,
        poBox: schoolSettings?.address?.poBox,
        city: schoolSettings?.address?.city
      };

      // Generate QR codes in parallel
      toast({
        title: "Generating QR Codes",
        description: `Preparing data for ${validPupils.length} certificates...`,
      });
      
      const qrEntries = await Promise.all(validPupils.map(async (pupil) => {
        const qrData = `Name: ${formatPupilDisplayName(pupil)}
Index: ${pupil.indexNumber || 'N/A'}
LIN: ${pupil.learnerIdentificationNumber || 'N/A'}
Total: ${pupil.totalAggregate}
Division: ${pupil.division}`;

        try {
          const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
            width: 80,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' },
            errorCorrectionLevel: 'L',
            type: 'image/png'
          });
          return [pupil.pupilId, qrCodeDataUrl];
        } catch (qrError) {
          console.warn(`Failed to generate QR code for pupil ${pupil.pupilId}:`, qrError);
          return [pupil.pupilId, ''];
        }
      }));
      const qrCodes: Record<string, string> = Object.fromEntries(qrEntries);

      // Pre-fetch pupil photos in parallel to avoid react-pdf sequential fetches
      toast({
        title: "Fetching Photos",
        description: `Pre-fetching pupil photos for the PDF...`,
      });
      
      const photoEntries = await Promise.all(validPupils.map(async (pupil) => {
        if (!pupil.photo || pupil.photo.startsWith('data:')) {
          return [pupil.pupilId, pupil.photo || null];
        }
        
        try {
          const res = await fetch(pupil.photo);
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          return [pupil.pupilId, base64];
        } catch (err) {
          console.warn(`Failed to pre-fetch photo for ${pupil.pupilId}:`, err);
          return [pupil.pupilId, null];
        }
      }));
      const photosBase64 = Object.fromEntries(photoEntries);

      // Yield to the UI thread before rendering the massive PDF
      await new Promise(resolve => setTimeout(resolve, 0));

      toast({
        title: "Rendering PDF",
        description: `Rendering ${validPupils.length} certificates...`,
      });

      // Generate batch PDF
      const doc = (
        <PLEBatchCertificatesPDF
          pupils={validPupils}
          schoolName={schoolName}
          schoolLogo={schoolLogo}
          motto={schoolMotto}
          signatureUrl={headTeacherSignature}
          year={pleRecord?.year || new Date().getFullYear()}
          examName={pleRecord?.examName || 'PLE'}
          schoolContact={schoolContact}
          qrCodes={qrCodes}
          photosBase64={photosBase64}
        />
      );

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();

      // Create blob URL and open in new window for printing
      const fileName = `PLE_Batch_Certificates_${pleRecord?.year || new Date().getFullYear()}.pdf`;
      const url = URL.createObjectURL(blob);

      // Open PDF in new window and trigger print dialog
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
        // Fallback: if onload doesn't fire, try after a short delay
        setTimeout(() => {
          if (printWindow && !printWindow.closed) {
            printWindow.print();
          }
        }, 500);
      } else {
        // Fallback: if popup blocked, open in PDF viewer
        pdfViewer.openPDFFromBlob(blob, fileName, 'PLE Batch Certificates');
      }

      toast({
        title: "Certificates Generated",
        description: `Batch certificates for ${validPupils.length} pupils are ready to print.`,
      });
    } catch (error) {
      console.error('Error generating batch certificates:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate batch certificates. Please try again.",
      });
    }
  };

  // Print certificate function
  const handlePrintCertificate = async (pupil: PLEPupilResult) => {
    try {
      // Check if pupil has complete results
      if (pupil.status === 'missed') {
        toast({
          variant: "destructive",
          title: "Cannot Print Certificate",
          description: "Cannot generate certificate for pupils who missed the exam.",
        });
        return;
      }

      if (!pupil.division || pupil.totalAggregate === 0) {
        toast({
          variant: "destructive",
          title: "Incomplete Results",
          description: "Cannot generate certificate. Pupil results are incomplete.",
        });
        return;
      }

      // Prepare subjects data for certificate
      const subjects = orderedSubjects.map(subject => ({
        name: subject.name,
        grade: pupil.subjects[subject.id] || '--'
      }));

      // Get school information from settings
      const schoolName = schoolSettings?.generalInfo?.name || 'TRINITY FAMILY NURSERY AND PRIMARY SCHOOL';
      const schoolLogo = schoolSettings?.generalInfo?.logo;
      const schoolMotto = schoolSettings?.generalInfo?.motto || 'STRIVE TO EXCEL';
      const headTeacherSignature = schoolSettings?.headTeacher?.signature;

      // Prepare school contact information
      const schoolContact = {
        phone: schoolSettings?.contact?.phone,
        alternativePhone: schoolSettings?.contact?.alternativePhone,
        email: schoolSettings?.contact?.email,
        website: schoolSettings?.contact?.website,
        address: schoolSettings?.address?.physical,
        postal: schoolSettings?.address?.postal,
        poBox: schoolSettings?.address?.poBox,
        city: schoolSettings?.address?.city
      };

      // Generate QR code with pupil data
      const qrData = `Name: ${formatPupilDisplayName(pupil)}
Index: ${pupil.indexNumber || 'N/A'}
LIN: ${pupil.learnerIdentificationNumber || 'N/A'}
Total: ${pupil.totalAggregate}
Division: ${pupil.division}`;

      // Generate a compact, scannable QR code (keep it square for readability)
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 80,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'L',
        type: 'image/png'
      });

      // Generate PDF
      const doc = (
        <CertificatePDFDocument
          pupilName={formatPupilDisplayName(pupil)}
          admissionNumber={pupil.admissionNumber}
          indexNumber={pupil.indexNumber}
          learnerIdentificationNumber={pupil.learnerIdentificationNumber}
          additionalIdentifiers={pupil.additionalIdentifiers}
          schoolName={schoolName}
          division={pupil.division}
          subjects={subjects}
          totalMarks={pupil.totalAggregate.toString()}
          conduct="GOOD"
          date={new Date().toLocaleDateString()}
          schoolLogo={schoolLogo}
          motto={schoolMotto}
          signatureUrl={headTeacherSignature}
          pupilPhoto={pupil.photo}
          qrCodeDataUrl={qrCodeDataUrl}
          schoolContact={schoolContact}
        />
      );

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();

      // Open in PDF viewer
      const fileName = `PLE_Certificate_${formatPupilDisplayName(pupil).replace(/[^a-zA-Z0-9]/g, '_')}_${pleRecord?.year || new Date().getFullYear()}.pdf`;
      const title = 'PLE Certificate';

      pdfViewer.openPDFFromBlob(blob, fileName, title);

      toast({
        title: "Certificate Generated",
        description: `Certificate for ${formatPupilDisplayName(pupil)} has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate certificate. Please try again.",
      });
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <GlassPageTopBar
          title="View Results"
          subtitle="Loading PLE results..."
          backHref="/exams/ple-results"
          backLabel="Back to PLE"
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading PLE results...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!pleRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <GlassPageTopBar
          title="View Results"
          subtitle="PLE record not found"
          backHref="/exams/ple-results"
          backLabel="Back to PLE"
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-red-600 mb-2">PLE record not found</p>
              <Button onClick={() => router.push('/exams/ple-results')}>
                Back to PLE Results
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 animate-in fade-in duration-500">
      <GlassPageTopBar
        title={`View Results - ${pleRecord.examName}`}
        subtitle="View PLE examination results and statistics."
        backHref="/exams/ple-results"
        backLabel="Back to PLE"
        actionsLeading={
          <div className="flex items-center gap-2">
            <GlassPageSearchInput
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              containerClassName="w-[140px] sm:w-[180px] lg:w-[220px]"
            />
          </div>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Reorder"
              icon={<ArrowUpDown className="h-4 w-4" />}
              tone="slate"
              onClick={() => setIsReorderModalOpen(true)}
            />
            <GlassActionButton
              label="Filter"
              icon={<Filter className="h-4 w-4" />}
              tone={divisionFilter !== "all" || genderFilter !== "all" || completionFilter !== "all" ? "purple" : "slate"}
              onClick={() => setFiltersOpen(!filtersOpen)}
            />
            <GlassActionButton
              label="Print"
              icon={<Printer className="h-4 w-4" />}
              tone="green"
              onClick={() => setShowPrintDialog(true)}
            />
          </GlassActionDock>
        }
      />
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Statistics Cards - Hidden */}
        {false && statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalCandidates}</div>
                <p className="text-xs text-muted-foreground">
                  {statistics.maleCount} Male, {statistics.femaleCount} Female
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Division I</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{statistics.divisionI}</div>
                <p className="text-xs text-muted-foreground">
                  {statistics.totalCandidates > 0 ?
                    `${((statistics.divisionI / statistics.totalCandidates) * 100).toFixed(1)}% of candidates` :
                    'No complete results yet'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Aggregate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.averageAggregate}</div>
                <p className="text-xs text-muted-foreground">
                  Lower is better in PLE
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
                <Star className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold">
                  {statistics.bestPerformer ?
                    formatPupilDisplayName(statistics.bestPerformer) :
                    'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics.bestPerformer ? `${statistics.bestPerformer.totalAggregate} aggregate` : 'No complete results yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Status</CardTitle>
                <GraduationCap className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {pupilResults.filter(r =>
                    r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate)
                  ).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {statistics.totalCandidates} complete
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Division Breakdown */}
        {statistics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-purple-600" />
                Division Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{statistics.divisionI}</div>
                  <Badge variant="default" className="mt-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Division I</Badge>
                  <p className="text-xs text-muted-foreground mt-1">4-12 points</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{statistics.divisionII}</div>
                  <Badge variant="secondary" className="mt-1 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Division II</Badge>
                  <p className="text-xs text-muted-foreground mt-1">13-23 points</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{statistics.divisionIII}</div>
                  <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">Division III</Badge>
                  <p className="text-xs text-muted-foreground mt-1">24-29 points</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{statistics.divisionIV}</div>
                  <Badge variant="destructive" className="mt-1 bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">Division IV</Badge>
                  <p className="text-xs text-muted-foreground mt-1">30-32 points</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{statistics.divisionU}</div>
                  <Badge variant="destructive" className="mt-1 bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Ungraded U</Badge>
                  <p className="text-xs text-muted-foreground mt-1">33-36 points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-48">
                    <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by division" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Divisions</SelectItem>
                        <SelectItem value="I">Division I</SelectItem>
                        <SelectItem value="II">Division II</SelectItem>
                        <SelectItem value="III">Division III</SelectItem>
                        <SelectItem value="IV">Division IV</SelectItem>
                        <SelectItem value="U">Ungraded U</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-48">
                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genders</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-48">
                    <Select value={completionFilter} onValueChange={setCompletionFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by completion" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Results</SelectItem>
                        <SelectItem value="complete">Complete Results</SelectItem>
                        <SelectItem value="partial">Partial Results</SelectItem>
                        <SelectItem value="none">No Results</SelectItem>
                        <SelectItem value="missed">Missed Exam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Results Table */}
        <div className="rounded-lg border shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-64 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Candidate
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="w-40 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('admissionNumber')}
                  >
                    <div className="flex items-center gap-1">
                      PIN / Index No.
                      {getSortIcon('admissionNumber')}
                    </div>
                  </TableHead>
                  {orderedSubjects.map(subject => (
                    <TableHead
                      key={subject.id}
                      className="text-center w-24 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort(subject.id)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {subject.code}
                        {getSortIcon(subject.id)}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead
                    className="text-center w-32 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('totalAggregate')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Total Agg
                      {getSortIcon('totalAggregate')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center w-32 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('division')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Division
                      {getSortIcon('division')}
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-gray-400" />
                        <p className="text-gray-500">No results found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((pupil) => (
                    <TableRow key={pupil.pupilId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            <button
                              onClick={() => router.push(`/pupil-detail?id=${pupil.pupilId}`)}
                              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer text-left"
                            >
                              {formatPupilDisplayName(pupil)}
                            </button>
                          </div>
                          <div className="text-sm text-gray-500">
                            {pupil.gender}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            PIN: {pupil.admissionNumber || 'N/A'}
                          </Badge>
                          {pupil.indexNumber && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              Index: {pupil.indexNumber}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {orderedSubjects.map(subject => (
                        <TableCell key={subject.id} className="text-center">
                          {pupil.status === 'missed' ? (
                            <Badge variant="destructive" className="text-xs">
                              Missed
                            </Badge>
                          ) : pupil.subjects[subject.id] ? (
                            <Badge
                              variant={getAggregateBadgeVariant(pupil.subjects[subject.id])}
                              className="font-mono"
                            >
                              {pupil.subjects[subject.id]}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-mono text-gray-400">
                              --
                            </Badge>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        {pupil.status === 'missed' ? (
                          <Badge variant="destructive" className="text-xs">
                            Missed
                          </Badge>
                        ) : pupil.totalAggregate > 0 ? (
                          <Badge
                            variant="default"
                            className="font-mono font-bold"
                          >
                            {pupil.totalAggregate}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-gray-400">
                            --
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {pupil.status === 'missed' ? (
                          <Badge variant="destructive" className="text-xs">
                            Missed
                          </Badge>
                        ) : pupil.division ? (
                          <Badge
                            variant={getDivisionBadgeVariant(pupil.division)}
                            className="font-bold"
                          >
                            Div {pupil.division}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintCertificate(pupil)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Results Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Showing {filteredResults.length} of {pupilResults.length} candidates.
              {searchTerm && ` Search: "${searchTerm}"`}
              {divisionFilter !== "all" && ` | Division: ${divisionFilter}`}
              {genderFilter !== "all" && ` | Gender: ${genderFilter}`}
              {completionFilter !== "all" && ` | Status: ${completionFilter}`}
            </p>
            <div className="mt-2 flex gap-4 text-xs text-gray-500">
              <span>
                Complete: {pupilResults.filter(r =>
                  r.status !== 'missed' && r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate)
                ).length}
              </span>
              <span>
                Partial: {pupilResults.filter(r =>
                  r.status !== 'missed' &&
                  (Object.values(r.subjects).some(aggregate => aggregate) || r.division) &&
                  !(r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate))
                ).length}
              </span>
              <span>
                No Results: {pupilResults.filter(r =>
                  r.status !== 'missed' &&
                  Object.values(r.subjects).every(aggregate => !aggregate) && !r.division
                ).length}
              </span>
              <span>
                Missed: {pupilResults.filter(r => r.status === 'missed').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print Options Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Printer className="h-5 w-5 text-blue-600" />
              Print Options
            </DialogTitle>
            <DialogDescription>
              Select what you want to print
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <button
              onClick={() => {
                setShowPrintDialog(false);
                handleExportResults();
              }}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Certificates</h3>
                  <p className="text-sm text-gray-600">Batch certificates for all pupils</p>
                </div>
              </div>
            </button>

            <button
              onClick={handleGenerateAssessment}
              className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Assessment</h3>
                  <p className="text-sm text-gray-600">Class-wide assessment summary</p>
                </div>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={pdfViewer.closePDF}
        pdfBlob={pdfViewer.pdfBlob}
        fileName={pdfViewer.fileName}
        title={pdfViewer.title}
        showDownload={true}
        showPrint={true}
      />

      {/* Subject Reorder Modal */}
      <PLESubjectReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        pleRecord={pleRecord}
        onReorderComplete={() => {
          // The modal saves to Firestore, hook will auto-refresh
        }}
      />
    </div>
  );
} 