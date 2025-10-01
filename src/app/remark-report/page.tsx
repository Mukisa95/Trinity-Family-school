"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Class, Pupil } from '@/types';
import { RefreshCw, CheckCircle, Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, List, MessageSquare, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AcademicYear, Term } from '@/types';
import Link from 'next/link';
import { useActivePupils, useUpdatePupil } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { useCommentTemplates } from '@/hooks/useCommentTemplates';
import { getDynamicComments } from '@/utils/commentUtils';
import { pdf, Document } from '@react-pdf/renderer';
import PupilPerformanceListPDF from '@/components/reports/PupilPerformanceListPDF';
import NurseryAssessmentReport from '@/components/reports/NurseryAssessmentReport';
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';


// Performance status options
const PERFORMANCE_STATUS_OPTIONS = [
  { value: 'good', label: 'Good', color: 'bg-green-100 text-green-800' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'weak', label: 'Weak', color: 'bg-orange-100 text-orange-800' },
  { value: 'young', label: 'Young', color: 'bg-purple-100 text-purple-800' },
  { value: 'irregular', label: 'Irregular Performance', color: 'bg-red-100 text-red-800' }
];

export default function RemarkReportPage() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [updatedPupils, setUpdatedPupils] = useState<Record<string, string>>({});
  const [batchProgress, setBatchProgress] = useState<{
    isGenerating: boolean;
    currentStep: string;
    progress: number;
    total: number;
  }>({
    isGenerating: false,
    currentStep: '',
    progress: 0,
    total: 0
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  // Use existing hooks
  const { data: allClasses = [], isLoading: classesLoading } = useClasses();
  const { data: allPupils = [], isLoading: pupilsLoading } = useActivePupils();
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const { data: schoolSettings = null, isLoading: settingsLoading } = useSchoolSettings();
  
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  const updatePupilMutation = useUpdatePupil();

  // Filter pupils by selected class and search term
  const filteredPupils = useMemo(() => {
    let pupils = selectedClass
      ? allPupils?.filter((pupil: Pupil) => pupil.classId === selectedClass)
      : [];

    // Filter by selected status
    if (selectedStatusFilter && selectedStatusFilter !== 'all') {
      pupils = pupils.filter((pupil: Pupil) => pupil.otherNames === selectedStatusFilter);
    }

    // Filter by search term (case-insensitive)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      pupils = pupils.filter((pupil: Pupil) => 
        (pupil.firstName?.toLowerCase().includes(lowerSearchTerm) || 
         pupil.lastName?.toLowerCase().includes(lowerSearchTerm) ||
         pupil.admissionNumber?.toLowerCase().includes(lowerSearchTerm) ||
         pupil.learnerIdentificationNumber?.toLowerCase().includes(lowerSearchTerm)
         )
      );
    }

    // Sort pupils
    if (pupils.length > 0) {
      pupils.sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';

        switch (sortBy) {
          case 'name':
            aValue = formatPupilDisplayName(a).toLowerCase();
            bValue = formatPupilDisplayName(b).toLowerCase();
            break;
          case 'regNumber':
            aValue = (a.admissionNumber || a.learnerIdentificationNumber || '').toLowerCase();
            bValue = (b.admissionNumber || b.learnerIdentificationNumber || '').toLowerCase();
            break;
          case 'status':
            aValue = (a.otherNames || 'zzz').toLowerCase(); // 'zzz' to sort "Not set" items last
            bValue = (b.otherNames || 'zzz').toLowerCase();
            break;
          case 'firstName':
            aValue = (a.firstName || '').toLowerCase();
            bValue = (b.firstName || '').toLowerCase();
            break;
          case 'lastName':
            aValue = (a.lastName || '').toLowerCase();
            bValue = (b.lastName || '').toLowerCase();
            break;
          default:
            aValue = formatPupilDisplayName(a).toLowerCase();
            bValue = formatPupilDisplayName(b).toLowerCase();
        }

        if (aValue < bValue) {
          return sortOrder === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortOrder === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return pupils;
  }, [allPupils, selectedClass, selectedStatusFilter, searchTerm, sortBy, sortOrder]);

  // Find class object for selected class
  const selectedClassData = allClasses.find((c: Class) => c.id === selectedClass) || null;

  // Handlers
  const handleStatusChange = (pupilId: string, status: string) => {
    setUpdatedPupils(prev => ({ ...prev, [pupilId]: status }));
  };

  // Print handlers
  const handlePrintList = async () => {
    if (!selectedClass || filteredPupils.length === 0) {
      toast({
        title: "No Data",
        description: "Please select a class with pupils to print the list.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your performance list...",
      });

      // Generate PDF
      const pdfDoc = (
        <PupilPerformanceListPDF
          pupils={filteredPupils}
          pupilClass={selectedClassData}
          settings={schoolSettings}
          performanceOptions={PERFORMANCE_STATUS_OPTIONS}
        />
      );

      const pdfBlob = await pdf(pdfDoc).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Performance_List_${selectedClassData?.name || 'Class'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Generated",
        description: "Performance list has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrintReport = async () => {
    if (!selectedClass || filteredPupils.length === 0) {
      toast({
        title: "No Data",
        description: "Please select a class with pupils to generate batch reports.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedClassData) {
      toast({
        title: "Error",
        description: "Class information not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Initialize progress tracking
      setBatchProgress({
        isGenerating: true,
        currentStep: 'Initializing batch report generation...',
        progress: 0,
        total: Math.max(0, filteredPupils.length || 0)
      });

      toast({
        title: "Generating Batch Reports",
        description: `Creating assessment reports for ${filteredPupils.length} pupils. Please wait...`,
      });

      // Get current academic year and term using proper date-based detection
      const currentAcademicYear = academicYears.find(year => year.isActive);
      
      // Detect current term based on actual dates
      const getCurrentTerm = (academicYear: any) => {
        if (!academicYear || !academicYear.terms || academicYear.terms.length === 0) return null;
        
        const now = new Date();
        
        // Find term that contains current date
        const termByDate = academicYear.terms.find((term: any) => {
          if (!term.startDate || !term.endDate) return false;
          const termStart = new Date(term.startDate);
          const termEnd = new Date(term.endDate);
          return now >= termStart && now <= termEnd;
        });
        
        if (termByDate) {
          console.log('📅 Batch Report - Current term detected by date:', termByDate.name);
          return termByDate;
        }
        
        // Fallback to isCurrent flag or first term
        const fallbackTerm = academicYear.terms.find((t: any) => t.isCurrent) || academicYear.terms[0];
        console.log('📅 Batch Report - Current term fallback:', fallbackTerm?.name);
        return fallbackTerm;
      };
      
      const currentTerm = getCurrentTerm(currentAcademicYear);
      
      // Get next term dates dynamically
      const getNextTermDates = (academicYear: any, currentTerm: any) => {
        if (!academicYear || !academicYear.terms || academicYear.terms.length === 0) {
          return { startDate: null, endDate: null };
        }
        
        if (!currentTerm) {
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }
        
        const currentTermIndex = academicYear.terms.findIndex((term: any) => term.id === currentTerm.id);
        
        if (currentTermIndex === -1) {
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }
        
        const nextTermIndex = currentTermIndex + 1;
        if (nextTermIndex < academicYear.terms.length) {
          const nextTerm = academicYear.terms[nextTermIndex];
          return {
            startDate: nextTerm.startDate || null,
            endDate: nextTerm.endDate || null
          };
        }
        
        // Note: Since AcademicYear uses 'name' instead of 'year', we'll need to parse the year from the name
        const currentYearNumber = parseInt(academicYear.name.match(/\d{4}/)?.[0] || '0');
        const nextAcademicYear = academicYears.find(year => {
          const yearNumber = parseInt(year.name.match(/\d{4}/)?.[0] || '0');
          return yearNumber === (currentYearNumber + 1);
        });
        
        if (nextAcademicYear && nextAcademicYear.terms && nextAcademicYear.terms.length > 0) {
          const firstTermNextYear = nextAcademicYear.terms[0];
          return {
            startDate: firstTermNextYear.startDate || null,
            endDate: firstTermNextYear.endDate || null
          };
        }
        
        return { startDate: null, endDate: null };
      };
      
      const nextTermDates = getNextTermDates(currentAcademicYear, currentTerm);
      
      // Format dates for display
      const formatDateForDisplay = (dateString: string | null): string => {
        if (!dateString) return '';
        
        try {
          const date = new Date(dateString);
          const day = date.getDate();
          const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
          const year = date.getFullYear();
          
          const getOrdinalSuffix = (day: number): string => {
            if (day > 3 && day < 21) return 'TH';
            switch (day % 10) {
              case 1: return 'ST';
              case 2: return 'ND';
              case 3: return 'RD';
              default: return 'TH';
            }
          };
          
          return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
        } catch (error) {
          console.error('Error formatting date:', error);
          return '';
        }
      };
      
      const nextTermStartDate = formatDateForDisplay(nextTermDates.startDate);
      const nextTermEndDate = formatDateForDisplay(nextTermDates.endDate);

      console.log(`📊 Batch Report - Processing ${filteredPupils.length} pupils`);

      // Update progress
      setBatchProgress(prev => ({
        ...prev,
        currentStep: 'Preparing pupil data and fetching comments...',
        progress: 0
      }));

      // Prepare all pupil data with their comments
      const allPupilsData = [];
      for (let i = 0; i < filteredPupils.length; i++) {
        const pupil = filteredPupils[i];
        const performanceStatus = pupil.otherNames || 'fair';
        
        // Update progress for data preparation
        setBatchProgress(prev => ({
          ...prev,
          currentStep: `Preparing data for ${formatPupilDisplayName(pupil)} (${i + 1}/${filteredPupils.length})`,
          progress: Math.max(0, i || 0)
        }));
        
        console.log(`📄 Processing pupil ${i + 1}/${filteredPupils.length}: ${formatPupilDisplayName(pupil)} (${performanceStatus})`);
        
        // Fetch dynamic comments for this pupil
        const comments = await getDynamicComments(performanceStatus);
        
        allPupilsData.push({
          pupil,
          performanceStatus,
          classTeacherComment: comments.classTeacherComment,
          headTeacherComment: comments.headTeacherComment
        });
      }

      console.log(`📚 Batch Report - Prepared data for ${allPupilsData.length} pupils`);

      // Create a single PDF document with multiple pages - one page per pupil
      // We'll use the same template but combine all pupils into one document
      
      if (allPupilsData.length === 0) {
        throw new Error('No pupil data available for batch report');
      }

      console.log('📄 Batch Report - Creating single PDF with all pupils...');
      
             // Create individual PDF blobs and then combine them
       console.log('📄 Batch Report - Generating individual PDFs for combination...');
       
       // Update progress for PDF generation phase
       setBatchProgress(prev => ({
         ...prev,
         currentStep: 'Generating individual PDF reports...',
         progress: 0,
         total: Math.max(0, allPupilsData.length || 0)
       }));
       
       const pdfBlobs = [];
       for (let i = 0; i < allPupilsData.length; i++) {
         const pupilData = allPupilsData[i];
         
                 // Update progress for each PDF generation
        setBatchProgress(prev => ({
          ...prev,
          currentStep: `Generating PDF for ${formatPupilDisplayName(pupilData.pupil)} (${i + 1}/${allPupilsData.length})`,
          progress: Math.max(0, i || 0)
        }));
         
         console.log(`📄 Generating PDF ${i + 1}/${allPupilsData.length} for ${formatPupilDisplayName(pupilData.pupil)}`);
         
         const individualReportDoc = (
           <NurseryAssessmentReport
             pupil={pupilData.pupil}
             pupilClass={selectedClassData}
             settings={schoolSettings}
             currentAcademicYear={currentAcademicYear}
             currentTerm={currentTerm}
             nextTermStartDate={nextTermStartDate}
             nextTermEndDate={nextTermEndDate}
             performanceStatus={pupilData.performanceStatus}
             classTeacherComment={pupilData.classTeacherComment}
             headTeacherComment={pupilData.headTeacherComment}
           />
         );

         const pdfBlob = await pdf(individualReportDoc).toBlob();
         pdfBlobs.push(pdfBlob);
         
         // Small delay to make progress visible and prevent overwhelming the system
         if (i < allPupilsData.length - 1) {
           await new Promise(resolve => setTimeout(resolve, 100));
         }
       }

       // Update progress for combining phase
       setBatchProgress(prev => ({
         ...prev,
         currentStep: 'Combining all PDFs into single document...',
         progress: Math.max(0, allPupilsData.length || 0),
         total: Math.max(0, allPupilsData.length || 0)
       }));

       // Combine all PDFs into one using PDF-lib
       const { PDFDocument } = await import('pdf-lib');
       const combinedPdf = await PDFDocument.create();
       
       for (let i = 0; i < pdfBlobs.length; i++) {
         const blob = pdfBlobs[i];
         
         // Update progress for combining each PDF
         setBatchProgress(prev => ({
           ...prev,
           currentStep: `Combining PDF ${i + 1}/${pdfBlobs.length} into final document...`,
         }));
         
         const arrayBuffer = await blob.arrayBuffer();
         const pdf = await PDFDocument.load(arrayBuffer);
         const pages = await combinedPdf.copyPages(pdf, pdf.getPageIndices());
         pages.forEach((page) => combinedPdf.addPage(page));
       }
       
       setBatchProgress(prev => ({
         ...prev,
         currentStep: 'Finalizing combined PDF document...',
       }));
       
       const combinedPdfBytes = await combinedPdf.save();
       const combinedBlob = new Blob([combinedPdfBytes], { type: 'application/pdf' });

      console.log('📄 Batch Report - Combined all PDFs successfully');
      const pdfBlob = combinedBlob;
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Batch_Assessment_Reports_${selectedClassData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Reset progress and show success
      setBatchProgress({
        isGenerating: false,
        currentStep: '',
        progress: 0,
        total: 0
      });

      toast({
        title: "Batch Report Generated",
        description: `Combined assessment report with ${allPupilsData.length} pupils from ${selectedClassData.name} has been downloaded.`,
      });

      console.log(`✅ Batch Report - Successfully generated PDF with ${filteredPupils.length} reports`);
    } catch (error) {
      console.error('Error generating batch reports:', error);
      
      // Reset progress on error
      setBatchProgress({
        isGenerating: false,
        currentStep: '',
        progress: 0,
        total: 0
      });
      
      toast({
        title: "Error",
        description: "Failed to generate batch assessment reports. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Individual pupil print handler
  const handlePrintPupil = async (pupil: Pupil) => {
    if (!selectedClassData) {
      toast({
        title: "Error",
        description: "Class information not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating Report",
        description: `Creating assessment report for ${formatPupilDisplayName(pupil)}...`,
      });

      // Get current academic year and term using proper date-based detection
      const currentAcademicYear = academicYears.find(year => year.isActive);
      
      // Detect current term based on actual dates
      const getCurrentTerm = (academicYear: any) => {
        if (!academicYear || !academicYear.terms || academicYear.terms.length === 0) return null;
        
        const now = new Date();
        
        // Find term that contains current date
        const termByDate = academicYear.terms.find((term: any) => {
          if (!term.startDate || !term.endDate) return false;
          const termStart = new Date(term.startDate);
          const termEnd = new Date(term.endDate);
          return now >= termStart && now <= termEnd;
        });
        
        if (termByDate) {
          console.log('📅 Current term detected by date:', termByDate.name, {
            termStart: termByDate.startDate,
            termEnd: termByDate.endDate,
            currentDate: now.toISOString()
          });
          return termByDate;
        }
        
        // Fallback to isCurrent flag or first term
        const fallbackTerm = academicYear.terms.find((t: any) => t.isCurrent) || academicYear.terms[0];
        console.log('📅 Current term fallback:', fallbackTerm?.name);
        return fallbackTerm;
      };
      
      const currentTerm = getCurrentTerm(currentAcademicYear);
      
      // Get next term dates dynamically
      const getNextTermDates = (academicYear: any, currentTerm: any) => {
        if (!academicYear || !academicYear.terms || academicYear.terms.length === 0) {
          return { startDate: null, endDate: null };
        }
        
        if (!currentTerm) {
          // If no current term, return first term
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }
        
        // Find current term index
        const currentTermIndex = academicYear.terms.findIndex((term: any) => term.id === currentTerm.id);
        
        if (currentTermIndex === -1) {
          // Current term not found, return first term
          const firstTerm = academicYear.terms[0];
          return {
            startDate: firstTerm?.startDate || null,
            endDate: firstTerm?.endDate || null
          };
        }
        
        // Get next term (if exists in same academic year)
        const nextTermIndex = currentTermIndex + 1;
        if (nextTermIndex < academicYear.terms.length) {
          const nextTerm = academicYear.terms[nextTermIndex];
          console.log('📅 Next term found in same academic year:', nextTerm.name);
          return {
            startDate: nextTerm.startDate || null,
            endDate: nextTerm.endDate || null
          };
        }
        
        // If no next term in current academic year, look for next academic year's first term
        // Note: Since AcademicYear uses 'name' instead of 'year', we'll need to parse the year from the name
        const currentYearNumber = parseInt(academicYear.name.match(/\d{4}/)?.[0] || '0');
        const nextAcademicYear = academicYears.find(year => {
          const yearNumber = parseInt(year.name.match(/\d{4}/)?.[0] || '0');
          return yearNumber === (currentYearNumber + 1);
        });
        
        if (nextAcademicYear && nextAcademicYear.terms && nextAcademicYear.terms.length > 0) {
          const firstTermNextYear = nextAcademicYear.terms[0];
          console.log('📅 Next term found in next academic year:', firstTermNextYear.name);
          return {
            startDate: firstTermNextYear.startDate || null,
            endDate: firstTermNextYear.endDate || null
          };
        }
        
        // Fallback: no next term found
        console.log('📅 No next term found, using fallback');
        return { startDate: null, endDate: null };
      };
      
      const nextTermDates = getNextTermDates(currentAcademicYear, currentTerm);
      
      // Format dates for display
      const formatDateForDisplay = (dateString: string | null): string => {
        if (!dateString) return '';
        
        try {
          const date = new Date(dateString);
          const day = date.getDate();
          const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
          const year = date.getFullYear();
          
          // Add ordinal suffix to day
          const getOrdinalSuffix = (day: number): string => {
            if (day > 3 && day < 21) return 'TH';
            switch (day % 10) {
              case 1: return 'ST';
              case 2: return 'ND';
              case 3: return 'RD';
              default: return 'TH';
            }
          };
          
          return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
        } catch (error) {
          console.error('Error formatting date:', error);
          return '';
        }
      };
      
      const nextTermStartDate = formatDateForDisplay(nextTermDates.startDate);
      const nextTermEndDate = formatDateForDisplay(nextTermDates.endDate);
      
      console.log('📅 Next term dates:', {
        startDate: nextTermStartDate,
        endDate: nextTermEndDate,
        rawDates: nextTermDates
      });

      // Get the performance status from otherNames field (where we store it temporarily)
      const performanceStatus = pupil.otherNames || 'fair';

      // Fetch dynamic comments from Commentary Management system
      const comments = await getDynamicComments(performanceStatus);

      // Generate PDF with dynamic comments
      const pdfDoc = (
        <NurseryAssessmentReport
          pupil={pupil}
          pupilClass={selectedClassData}
          settings={schoolSettings}
          currentAcademicYear={currentAcademicYear}
          currentTerm={currentTerm}
          nextTermStartDate={nextTermStartDate}
          nextTermEndDate={nextTermEndDate}
          performanceStatus={performanceStatus}
          classTeacherComment={comments.classTeacherComment}
          headTeacherComment={comments.headTeacherComment}
        />
      );

      const pdfBlob = await pdf(pdfDoc).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Assessment_Report_${formatPupilDisplayName(pupil).replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: `Assessment report for ${formatPupilDisplayName(pupil)} has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating pupil report:', error);
      toast({
        title: "Error",
        description: "Failed to generate assessment report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveChanges = async () => {
    if (Object.keys(updatedPupils).length === 0) return;

    try {
      // Update each pupil with their new performance status
      const updatePromises = Object.entries(updatedPupils).map(([pupilId, performanceStatus]) =>
        updatePupilMutation.mutateAsync({
          id: pupilId,
          data: { 
            // Add performanceStatus to pupil's otherNames field temporarily
            // until a proper performanceStatus field is added to the Pupil type
            otherNames: performanceStatus
          }
        })
      );

      await Promise.all(updatePromises);

      toast({
        title: "Changes Saved",
        description: `Performance status updated for ${Object.keys(updatedPupils).length} pupil(s)`,
      });
      setUpdatedPupils({});
    } catch (error) {
      console.error('Error updating performance status:', error);
      toast({
        title: "Error",
        description: "Failed to update performance status. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (classesLoading || pupilsLoading || academicYearsLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto p-4 space-y-6">
          <PageHeader title="Pupil Performance Report" />
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Pupil Performance Report"
          description="Manage and track pupil performance status across classes."
          actions={
            <div className="flex gap-2">
              <Link href="/commentary-management">
                <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Commentary
                </Button>
              </Link>
              {selectedClass && filteredPupils.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="border-green-600 text-green-600 hover:bg-green-50"
                      disabled={batchProgress.isGenerating}
                    >
                      {batchProgress.isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="mr-2 h-4 w-4" />
                      )}
                      Print
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handlePrintList} className="cursor-pointer">
                      <List className="mr-2 h-4 w-4" />
                      Print List
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePrintReport} className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Print Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          }
        />
        
        {/* Show recess status banner if in recess mode */}
        <RecessStatusBanner />

        {/* Batch Report Progress Indicator */}
        {batchProgress.isGenerating && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Generating Batch Report
                  </h3>
                  <span className="text-sm font-medium text-gray-600">
                    {batchProgress.progress}/{batchProgress.total}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {batchProgress.currentStep}
                </p>
                <Progress 
                  value={(() => {
                    if (batchProgress.total <= 0 || isNaN(batchProgress.total) || isNaN(batchProgress.progress)) {
                      return 0;
                    }
                    const percentage = (batchProgress.progress / batchProgress.total) * 100;
                    return Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));
                  })()} 
                  className="w-full h-2"
                />
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Please wait while we generate your reports...</span>
                  <span>
                    {(() => {
                      if (batchProgress.total <= 0 || isNaN(batchProgress.total) || isNaN(batchProgress.progress)) {
                        return '0% complete';
                      }
                      const percentage = (batchProgress.progress / batchProgress.total) * 100;
                      return `${Math.round(isNaN(percentage) ? 0 : percentage)}% complete`;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

                {/* Modern Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Class Selection */}
            <div className="w-full">
              <Label htmlFor="classSelect" className="text-sm font-medium text-gray-700 mb-1">
                Select Class
              </Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Select a Class --" />
                </SelectTrigger>
                <SelectContent>
                  {allClasses.map((cls: Class) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Bar */}
            <div className="w-full">
              <Label htmlFor="searchInput" className="text-sm font-medium text-gray-700 mb-1">
                Search Pupils
              </Label>
              <div className="relative">
                <Input
                  id="searchInput"
                  type="text"
                  placeholder="Search by name or reg no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full">
              <Label htmlFor="statusFilter" className="text-sm font-medium text-gray-700 mb-1">
                Filter by Status
              </Label>
              <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {PERFORMANCE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="w-full">
              <Label htmlFor="sortBy" className="text-sm font-medium text-gray-700 mb-1">
                Sort By
              </Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Full Name</SelectItem>
                  <SelectItem value="firstName">First Name</SelectItem>
                  <SelectItem value="lastName">Last Name</SelectItem>
                  <SelectItem value="regNumber">Registration No.</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="w-full">
              <Label htmlFor="sortOrder" className="text-sm font-medium text-gray-700 mb-1">
                Order
              </Label>
              <Button 
                variant="outline" 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="w-full justify-start"
              >
                {sortOrder === 'asc' ? (
                  <>
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Ascending
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Descending
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Save Changes Button */}
        {selectedClass && Object.keys(updatedPupils).length > 0 && (
          <div className="mb-6">
            <Button 
              onClick={handleSaveChanges} 
              disabled={updatePupilMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updatePupilMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Save Changes ({Object.keys(updatedPupils).length})
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pupil List */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          {selectedClass ? (
            filteredPupils.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center space-x-1">
                          <span>Name</span>
                          {(sortBy === 'name' || sortBy === 'firstName' || sortBy === 'lastName') && (
                            sortOrder === 'asc' ? 
                              <ArrowUp className="h-3 w-3" /> : 
                              <ArrowDown className="h-3 w-3" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center space-x-1">
                          <span>Current Status</span>
                          {sortBy === 'status' && (
                            sortOrder === 'asc' ? 
                              <ArrowUp className="h-3 w-3" /> : 
                              <ArrowDown className="h-3 w-3" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        New Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPupils.map((pupil: Pupil) => (
                      <tr key={pupil.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {pupil.photo ? (
                                <img className="h-10 w-10 rounded-full object-cover" src={pupil.photo} alt="" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-gray-500 font-medium">
                                    {pupil.lastName?.[0]}{pupil.firstName?.[0]}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <Link href={`/pupils/${pupil.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900 hover:underline">
                                {formatPupilDisplayName(pupil)}
                              </Link>
                              <p className="text-xs text-gray-500">{pupil.admissionNumber || pupil.learnerIdentificationNumber || 'No Reg No.'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              pupil.otherNames && PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === pupil.otherNames)
                                ? PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === pupil.otherNames)?.color
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {pupil.otherNames && PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === pupil.otherNames)
                              ? PERFORMANCE_STATUS_OPTIONS.find(opt => opt.value === pupil.otherNames)?.label
                              : 'Not set'
                            }
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Select
                            value={updatedPupils[pupil.id] || pupil.otherNames || ''}
                            onValueChange={(value) => handleStatusChange(pupil.id, value)}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {PERFORMANCE_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintPupil(pupil)}
                            className="text-green-600 border-green-600 hover:bg-green-50"
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Print Report
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-5 text-center">
                <p className="text-sm text-gray-500">
                  {searchTerm 
                    ? "No pupils match the current filters."
                    : "No pupils found in this class."
                  }
                </p>
              </div>
            )
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-500">Select a class to view pupils.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 