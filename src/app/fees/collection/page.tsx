'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  GraduationCap, 
  CheckCircle, 
  DollarSign, 
  X, 
  Receipt, 
  Calendar, 
  Clock, 
  Printer, 
  MessageSquare, 
  PieChart,
  ChevronDown,
  ArrowLeft,
  Users,
  TrendingUp,
  CreditCard,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';

// Progressive Loading Components
import { ProgressiveLoadingIndicator } from '@/components/fees/ProgressiveLoadingIndicator';
import { PupilFeesRow } from '@/components/fees/PupilFeesRow';
import { useProgressiveFees } from '@/lib/hooks/use-progressive-fees';
import { ClassSelector } from '@/components/common/class-selector';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';

// Services
import { PupilsService } from '@/lib/services/pupils.service';
import { ClassesService } from '@/lib/services/classes.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { PaymentsService } from '@/lib/services/payments.service';

// Types
import type { Pupil, Class, AcademicYear, FeeStructure, PaymentRecord, PupilAssignedFee } from '@/types';

// Import pupil validation utilities
import { isPupilValidForTerm } from '../collect/[id]/utils/feeProcessing';

// UI Modal Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface Filters {
  section: string;
  class: string;
  selectedClassId: string; // For class-based filtering optimization
  status: string; // Pupil status: Active, Inactive, Graduated, etc.
  balanceStatus: string; // Balance status: with_balance, without_balance, never_paid
  balanceMin: string;
  balanceMax: string;
  feeItem: string;
  year: string;
  term: string;
}

interface PupilFeesInfo {
  totalFees: number;
  totalPaid: number;
  balance: number;
  // Removed lastPayment to speed up calculations
  applicableFees: Array<{
    feeStructureId: string;
    name: string;
    amount: number;
    paid: number;
    balance: number;
    originalAmount?: number;
    discount?: {
      id: string;
      name: string;
      amount: number;
      type: 'fixed' | 'percentage';
    };
  }>;
}

// Fee processing utilities (copied from individual collection page)
function isAssignmentCurrentlyValid(
  assignment: PupilAssignedFee,
  currentTermId: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[]
): boolean {
  if (assignment.status === 'disabled') return false;

  switch (assignment.validityType) {
    case 'current_term':
      return assignment.applicableTermIds?.includes(currentTermId) || 
             assignment.termApplicability === 'all_terms';
    case 'current_year':
      return !assignment.startAcademicYearId || assignment.startAcademicYearId === currentAcademicYear.id;
    case 'specific_year':
      return assignment.startAcademicYearId === currentAcademicYear.id;
    case 'year_range':
      if (assignment.startAcademicYearId && assignment.endAcademicYearId) {
        const startYear = allAcademicYears.find(y => y.id === assignment.startAcademicYearId);
        const endYear = allAcademicYears.find(y => y.id === assignment.endAcademicYearId);
        if (startYear && endYear) {
          const startDate = new Date(startYear.startDate);
          const endDate = new Date(endYear.endDate);
          const currentDate = new Date(currentAcademicYear.startDate);
          return currentDate >= startDate && currentDate <= endDate;
        }
      }
      break;
    case 'specific_terms':
      return assignment.applicableTermIds?.includes(currentTermId) || false;
    case 'indefinite':
    default:
      return true;
  }
  
  if (assignment.termApplicability === 'specific_terms') {
    return assignment.applicableTermIds?.includes(currentTermId) || false;
  }
  
  return true;
}

// Define interfaces for PDF generation
interface ColumnSelection {
  pupilInfo: boolean;
  admissionNumber: boolean;
  class: boolean;
  section: boolean;
  totalFees: boolean;
  totalPaid: boolean;
  balance: boolean;
  feeBreakdown: boolean;
}

export default function FeesCollectionPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'firstName', direction: 'asc' });
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    section: 'all',
    class: 'all',
    selectedClassId: '', // Start with NO class selected - user must choose first
    status: 'Active',
    balanceStatus: 'all',
    balanceMin: '',
    balanceMax: '',
    feeItem: '',
    year: '',
    term: ''
  });
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Add column selection state with default values (removed lastPayment and status for speed)
  const [columnSelection, setColumnSelection] = useState<ColumnSelection>({
    pupilInfo: true,
    admissionNumber: true,
    class: true,
    section: true,
    totalFees: true,
    totalPaid: true,
    balance: true,
    feeBreakdown: false
  });
  
  // Add state for column selection modal
  const [isColumnSelectionModalOpen, setIsColumnSelectionModalOpen] = useState(false);

  // Helper function to check if date is within term
  const isDateWithinTerm = (date: Date, startDate: string, endDate: string): boolean => {
    const termStart = new Date(startDate);
    const termEnd = new Date(endDate);
    return date >= termStart && date <= termEnd;
  };

  // Fetch academic years
  const { data: rawAcademicYears = [], isLoading: isLoadingAcademicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const years = await AcademicYearsService.getAllAcademicYears();
      return years;
    }
  });

  // Process academic years with current status
  const academicYears = useMemo(() => {
    const today = new Date();
    
    return rawAcademicYears.map(year => {
      const processedTerms = year.terms.map(term => {
        const isCurrent = isDateWithinTerm(today, term.startDate, term.endDate);
        return {
          ...term,
          isCurrent
        };
      });
      return { ...year, terms: processedTerms };
    });
  }, [rawAcademicYears]);
  
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();

  // Fetch classes
  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const classesData = await ClassesService.getAll();
      return classesData;
    }
  });

  // Fetch pupils - now optimized with class-based loading
  const { data: pupils = [], isLoading: isLoadingPupils } = useQuery({
    queryKey: ['pupils-for-fees', filters.selectedClassId],
    queryFn: async () => {
      console.log('🚀 FEES COLLECTION - Loading pupils for class:', filters.selectedClassId);
      
      let pupilsData: Pupil[];
      
      if (!filters.selectedClassId || filters.selectedClassId === '') {
        console.log('❌ FEES COLLECTION - No class selected, not loading any data');
        return [];
      }
      
      if (filters.selectedClassId === 'all') {
        // Only load all pupils if explicitly requested
        console.log('⚠️ FEES COLLECTION - Loading ALL pupils (slower)');
        pupilsData = await PupilsService.getAllPupils();
      } else {
        // Use optimized class-based loading (much faster!)
        console.log('⚡ FEES COLLECTION - Loading pupils for specific class (faster)');
        pupilsData = await PupilsService.getPupilsByClass(filters.selectedClassId);
      }
      
      // Add class information
      return pupilsData.map((pupil: Pupil) => ({
        ...pupil,
        class: classes.find((c: Class) => c.id === pupil.classId)
      }));
    },
    enabled: !isLoadingClasses && !!filters.selectedClassId && filters.selectedClassId !== '',
    staleTime: 2 * 60 * 1000, // 2 minutes - cache class-specific data longer
  });

  // Fetch fee structures for the selected year, term, and class
  const { data: availableFeeStructures = [], isLoading: isLoadingFeeStructures } = useQuery({
    queryKey: ['fee-structures-for-filter', filters.year, filters.term, filters.selectedClassId],
    queryFn: async () => {
      console.log('🚀 FEES COLLECTION PAGE - Fee structures query started!', {
        filtersYear: filters.year,
        filtersTerm: filters.term,
        filtersClass: filters.selectedClassId,
        queryEnabled: true
      });
      
      try {
        const allStructures = await FeeStructuresService.getAllFeeStructures();
        console.log('🔍 FEES COLLECTION PAGE - Raw fee structures from database:', {
          total: allStructures.length,
          structures: allStructures.map(s => ({
            id: s.id,
            name: s.name,
            category: s.category,
            amount: s.amount,
            isAssignmentFee: s.isAssignmentFee,
            academicYearId: s.academicYearId,
            termId: s.termId,
            status: s.status
          }))
        });
        
        // MUCH MORE INCLUSIVE FILTERING - show all relevant fee items for the dropdown
        const filteredStructures = allStructures.filter(structure => {
          // Must be active
          if (structure.status !== 'active') {
            console.log(`❌ FEES COLLECTION PAGE - Fee "${structure.name}" rejected: not active (status: ${structure.status})`);
            return false;
          }
          
          // Must not be a discount
          if (structure.category === 'Discount') {
            console.log(`❌ FEES COLLECTION PAGE - Fee "${structure.name}" rejected: is a discount`);
            return false;
          }
          
          // Filter by selected term - only show fees for the selected term
          if (filters.term && structure.termId && structure.termId !== filters.term) {
            console.log(`❌ FEES COLLECTION PAGE - Fee "${structure.name}" rejected: wrong term (fee term: ${structure.termId}, selected: ${filters.term})`);
            return false;
          }
          
          // Filter by selected class - only show fees that apply to the selected class
          if (filters.selectedClassId && structure.classIds && structure.classIds.length > 0) {
            // If the fee has specific classIds, check if the selected class is included
            if (!structure.classIds.includes(filters.selectedClassId)) {
              console.log(`❌ FEES COLLECTION PAGE - Fee "${structure.name}" rejected: not for selected class (fee classes: ${structure.classIds.join(', ')}, selected: ${filters.selectedClassId})`);
              return false;
            }
          }
          
          // Include all assignment fees (they should appear in the filter)
          if (structure.isAssignmentFee) {
            console.log(`✅ FEES COLLECTION PAGE - Assignment fee "${structure.name}" included`);
            return true;
          }
          
          // For regular fee structures, be much more inclusive
          // Include if it has a positive amount and is a valid fee type
          if (structure.amount <= 0) {
            console.log(`❌ FEES COLLECTION PAGE - Fee "${structure.name}" rejected: non-positive amount (${structure.amount})`);
            return false;
          }
          
          console.log(`✅ FEES COLLECTION PAGE - Regular fee "${structure.name}" included`);
          return true;
        });
        
        console.log('🏁 Final filtered fee structures:', {
          total: filteredStructures.length,
          assignmentFees: filteredStructures.filter(s => s.isAssignmentFee).length,
          regularFees: filteredStructures.filter(s => !s.isAssignmentFee).length,
          structures: filteredStructures.map(s => ({
            id: s.id,
            name: s.name,
            category: s.category,
            isAssignmentFee: s.isAssignmentFee
          }))
        });
        
        // Sort by category first, then by name for better organization
        return filteredStructures.sort((a, b) => {
          // Assignment fees first, then by category, then by name
          if (a.isAssignmentFee && !b.isAssignmentFee) return -1;
          if (!a.isAssignmentFee && b.isAssignmentFee) return 1;
          
          const categoryCompare = a.category.localeCompare(b.category);
          if (categoryCompare !== 0) return categoryCompare;
          
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        console.error('Error fetching fee structures:', error);
        return [];
      }
    },
    enabled: !!filters.year && !!filters.term
  });

  // Set initial year and term when data is loaded
  useEffect(() => {
    if (academicYears.length > 0 && (!filters.year || !filters.term)) {
      const currentYear = academicYears.find(year => year.isActive);
      if (currentYear) {
        const currentTerm = currentYear.terms.find(term => term.isCurrent);
        setFilters(prev => ({
          ...prev,
          year: currentYear.id,
          term: currentTerm?.id || currentYear.terms[0]?.id || ''
        }));
      }
    }
  }, [academicYears, filters.year, filters.term]);

  // Handle scroll to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollToTop(scrollTop > 300); // Show button after scrolling 300px
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Get selected academic year object
  const selectedAcademicYear = useMemo(() => {
    return academicYears.find(year => year.id === filters.year) || null;
  }, [academicYears, filters.year]);

  // Use progressive fees loading with optimized batch size for class-specific data
  const progressiveFeesData = useProgressiveFees({
    pupils,
    selectedYear: selectedAcademicYear,
        selectedTermId: filters.term,
    academicYears,
    batchSize: Math.min(20, Math.max(5, Math.ceil(pupils.length / 3))), // Dynamic batch size based on class size
    enabled: !!filters.year && !!filters.term && pupils.length > 0
  });

  // Extract data from progressive loading
  const {
    pupilFeesInfo,
    processedCount,
    totalCount,
    isProcessing,
    currentBatch,
    totalBatches,
    processingStatus,
    progressPercentage,
    error: progressiveError,
    totals,
    restart: restartProcessing
  } = progressiveFeesData;

  // Filter pupils based on search and filters
  const filteredPupils = useMemo(() => {
    return pupils.filter((pupil: Pupil) => {
      // Search filter
      const matchesSearch = (
        pupil.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pupil.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pupil.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pupil.otherNames && pupil.otherNames.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      // Basic filters
      const matchesSection = !filters.section || filters.section === 'all' || 
        pupil.section?.toLowerCase() === filters.section.toLowerCase();
      const matchesClass = !filters.class || filters.class === 'all' || pupil.classId === filters.class;
      
      // Pupil Status filter (Active, Inactive, Graduated, etc.)
      const matchesStatus = !filters.status || filters.status === 'all' || 
        pupil.status?.toLowerCase() === filters.status.toLowerCase();

      // Fee Item filter - check if pupil has the selected fee item
      let matchesFeeItem = true;
      if (filters.feeItem && pupilFeesInfo[pupil.id]) {
        const feesInfo = pupilFeesInfo[pupil.id];
        matchesFeeItem = feesInfo.applicableFees.some(fee => fee.feeStructureId === filters.feeItem);
      }

      // Balance Status filter (with_balance, without_balance, never_paid, custom_range)
      let matchesBalanceStatus = true;
      if (filters.balanceStatus && filters.balanceStatus !== 'all' && pupilFeesInfo[pupil.id]) {
        const feesInfo = pupilFeesInfo[pupil.id];
        
        if (filters.feeItem) {
          // When a specific fee item is selected, check balance for that specific fee
          const selectedFee = feesInfo.applicableFees.find(fee => fee.feeStructureId === filters.feeItem);
          if (selectedFee) {
            if (filters.balanceStatus === 'with_balance') {
              matchesBalanceStatus = selectedFee.balance > 0;
            } else if (filters.balanceStatus === 'without_balance') {
              matchesBalanceStatus = selectedFee.balance === 0;
            } else if (filters.balanceStatus === 'never_paid') {
              matchesBalanceStatus = selectedFee.paid === 0;
            } else if (filters.balanceStatus === 'custom_range') {
              matchesBalanceStatus = true; // Will be handled in balance range filter
            }
          } else {
            matchesBalanceStatus = false; // Pupil doesn't have this fee item
          }
        } else {
          // When no specific fee item is selected, check total balance
          if (filters.balanceStatus === 'with_balance') {
            matchesBalanceStatus = feesInfo.balance > 0;
          } else if (filters.balanceStatus === 'without_balance') {
            matchesBalanceStatus = feesInfo.balance === 0;
          } else if (filters.balanceStatus === 'never_paid') {
            matchesBalanceStatus = feesInfo.totalPaid === 0;
          } else if (filters.balanceStatus === 'custom_range') {
            matchesBalanceStatus = true; // Will be handled in balance range filter
          }
        }
      }

      // Balance range filter (only applies when custom_range is selected or when range values are set)
      let matchesBalanceRange = true;
      if (pupilFeesInfo[pupil.id]) {
        const feesInfo = pupilFeesInfo[pupil.id];
        
        // Apply range filter if custom_range is selected and range values are provided
        if (filters.balanceStatus === 'custom_range' && (filters.balanceMin || filters.balanceMax)) {
          let balanceToCheck = feesInfo.balance;
          
          // If a specific fee item is selected, check that fee's balance instead of total
          if (filters.feeItem) {
            const selectedFee = feesInfo.applicableFees.find(fee => fee.feeStructureId === filters.feeItem);
            if (selectedFee) {
              balanceToCheck = selectedFee.balance;
            } else {
              matchesBalanceRange = false; // Pupil doesn't have this fee item
            }
          }
          
          if (matchesBalanceRange) {
            if (filters.balanceMin && balanceToCheck < parseFloat(filters.balanceMin)) {
              matchesBalanceRange = false;
            }
            if (filters.balanceMax && balanceToCheck > parseFloat(filters.balanceMax)) {
              matchesBalanceRange = false;
            }
          }
        }
      }

      // Registration date filter - check if pupil should appear for the selected term
      let matchesRegistrationDate = true;
      if (selectedAcademicYear && filters.term) {
        const selectedTerm = selectedAcademicYear.terms.find(t => t.id === filters.term);
        if (selectedTerm) {
          matchesRegistrationDate = isPupilValidForTerm(pupil, selectedTerm, selectedAcademicYear);
        }
      }

      return matchesSearch && matchesSection && matchesClass && matchesStatus && matchesFeeItem && matchesBalanceStatus && matchesBalanceRange && matchesRegistrationDate;
    });
  }, [pupils, searchQuery, filters.section, filters.class, filters.status, filters.feeItem, filters.balanceStatus, filters.balanceMin, filters.balanceMax, pupilFeesInfo, selectedAcademicYear, filters.term]);

  // Sort pupils
  const sortedPupils = useMemo(() => {
    return [...filteredPupils].sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      const aFeesInfo = pupilFeesInfo[a.id];
      const bFeesInfo = pupilFeesInfo[b.id];

      switch (sortConfig.key) {
        case 'firstName':
          return direction * a.firstName.localeCompare(b.firstName);
        case 'lastName':
          return direction * a.lastName.localeCompare(b.lastName);
        case 'class':
          const aClass = classes.find(c => c.id === a.classId)?.name || '';
          const bClass = classes.find(c => c.id === b.classId)?.name || '';
          return direction * aClass.localeCompare(bClass);
        case 'totalFees':
          if (filters.feeItem) {
            // Sort by specific fee amount
            const aFee = aFeesInfo?.applicableFees?.find(fee => fee.feeStructureId === filters.feeItem);
            const bFee = bFeesInfo?.applicableFees?.find(fee => fee.feeStructureId === filters.feeItem);
            return direction * ((aFee?.amount || 0) - (bFee?.amount || 0));
          }
          return direction * ((aFeesInfo?.totalFees || 0) - (bFeesInfo?.totalFees || 0));
        case 'totalPaid':
          if (filters.feeItem) {
            // Sort by specific fee paid amount
            const aFee = aFeesInfo?.applicableFees?.find(fee => fee.feeStructureId === filters.feeItem);
            const bFee = bFeesInfo?.applicableFees?.find(fee => fee.feeStructureId === filters.feeItem);
            return direction * ((aFee?.paid || 0) - (bFee?.paid || 0));
          }
          return direction * ((aFeesInfo?.totalPaid || 0) - (bFeesInfo?.totalPaid || 0));
        case 'balance':
          if (filters.feeItem) {
            // Sort by specific fee balance
            const aFee = aFeesInfo?.applicableFees?.find(fee => fee.feeStructureId === filters.feeItem);
            const bFee = bFeesInfo?.applicableFees?.find(fee => fee.feeStructureId === filters.feeItem);
            return direction * ((aFee?.balance || 0) - (bFee?.balance || 0));
          }
          return direction * ((aFeesInfo?.balance || 0) - (bFeesInfo?.balance || 0));
        // Removed lastPayment sorting for speed optimization
        default:
          return 0;
      }
    });
  }, [filteredPupils, sortConfig, pupilFeesInfo, classes, filters.feeItem, availableFeeStructures]);

  // Handle sort
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle pupil click
  const handlePupilClick = (pupilId: string) => {
    router.push(`/fees/collect?pupilId=${pupilId}`);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { 
      style: 'currency', 
      currency: 'UGX',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Add PDF generation function with dynamic import
  const handleGeneratePDF = async () => {
    try {
      // Dynamic import to avoid SSR issues
      const { PDFDownloadLink, pdf, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer');
      
      // Create PDF component inline to avoid import issues
      const createPDFComponent = (props: any) => {
        const { pupils, pupilFeesInfo, classes, filters, sortConfig, columnSelection, totals } = props;
        
        // Determine orientation and create styles
        const isLandscape = Object.entries(columnSelection).filter(([_, selected]) => selected).length > 6;
        
        const styles = StyleSheet.create({
          page: {
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            padding: 28.35,
            fontSize: 10,
          },
          header: {
            marginBottom: 20,
            textAlign: 'center',
          },
          schoolName: {
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 5,
            color: '#1a365d',
          },
          title: {
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 15,
            color: '#2d3748',
          },
          filterInfo: {
            fontSize: 10,
            marginBottom: 20,
            padding: 10,
            backgroundColor: '#f7fafc',
            borderRadius: 4,
            border: '1px solid #e2e8f0',
          },
          table: {
            width: '100%',
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: '#2d3748',
            marginBottom: 20,
          },
          tableRow: {
            flexDirection: 'row',
            minHeight: 30,
          },
          tableColHeader: {
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: '#2d3748',
            backgroundColor: '#4a5568',
            padding: 8,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tableCol: {
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 6,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          },
          tableCellHeader: {
            fontSize: 12,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#ffffff',
          },
          tableCell: {
            fontSize: 12,
            textAlign: 'left',
            color: '#2d3748',
            lineHeight: 1.4,
          },
          tableCellSmall: {
            fontSize: 10,
            textAlign: 'left',
            color: '#4a5568',
            lineHeight: 1.3,
          },
          footer: {
            position: 'absolute',
            bottom: 28.35,
            left: 28.35,
            right: 28.35,
            textAlign: 'center',
            fontSize: 9,
            color: '#718096',
            borderTop: '1px solid #e2e8f0',
            paddingTop: 10,
          },
          summaryRow: {
            backgroundColor: '#f0f9ff',
            borderTop: '2px solid #3b82f6',
          },
          currencyText: {
            fontFamily: 'Helvetica',
            fontWeight: 'bold',
          },
        });

        const getOptimalColumnWidths = () => {
          const selectedColumns = Object.entries(columnSelection).filter(([_, selected]) => selected);
          const columnWidths: Record<string, number> = {
            pupilInfo: 25,
            admissionNumber: 12,
            class: 8,
            section: 8,
            status: 8,
            totalFees: 15,
            totalPaid: 15,
            balance: 15,
            feeBreakdown: 20,
          };
          const totalDesiredWidth = selectedColumns.reduce((sum, [column]) => sum + columnWidths[column], 0);
          const scaleFactor = 100 / totalDesiredWidth;
          const optimizedWidths: Record<string, string> = {};
          selectedColumns.forEach(([column]) => {
            optimizedWidths[column] = `${(columnWidths[column] * scaleFactor).toFixed(1)}%`;
          });
          return optimizedWidths;
        };

        const columnWidths = getOptimalColumnWidths();

        const getFilterDescription = () => {
          const filterParts = [];
          if (filters.class !== 'all') {
            const className = classes.find((c: any) => c.id === filters.class)?.name;
            if (className) filterParts.push(`Class: ${className}`);
          }
          if (filters.section !== 'all') filterParts.push(`Section: ${filters.section.charAt(0).toUpperCase() + filters.section.slice(1)}`);
          if (filters.status !== 'all') filterParts.push(`Status: ${filters.status}`);
          if (filters.balanceStatus !== 'all') {
            const balanceLabels = {
              'with_balance': 'With Balance',
              'without_balance': 'No Balance', 
              'never_paid': 'Never Paid',
              'custom_range': 'Custom Range'
            };
            filterParts.push(`Balance: ${balanceLabels[filters.balanceStatus as keyof typeof balanceLabels] || filters.balanceStatus}`);
          }
          if (filters.balanceMin || filters.balanceMax) {
            filterParts.push(`Amount: ${filters.balanceMin || '0'} - ${filters.balanceMax || '∞'}`);
          }
          if (filterParts.length === 0) return 'All students included';
          return `Filtered by: ${filterParts.join(', ')}`;
        };

        return (
          <Document>
            <Page 
              size="A4" 
              orientation={isLandscape ? "landscape" : "portrait"} 
              style={styles.page}
              wrap
            >
              {/* School Header */}
              <View style={styles.header}>
                <Text style={styles.schoolName}>Trinity Family School</Text>
                <Text style={styles.title}>Fees Collection Report</Text>
              </View>

              {/* Filter Information */}
              <View style={styles.filterInfo}>
                <Text>{getFilterDescription()}</Text>
                <Text>Total students: {pupils.length} | Sorted by: {sortConfig.key} ({sortConfig.direction}) | Orientation: {isLandscape ? 'Landscape' : 'Portrait'}</Text>
                <Text>Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</Text>
                <Text>Summary: Total Fees: {formatCurrency(totals.totalFees)}, Paid: {formatCurrency(totals.totalPaid)}, Balance: {formatCurrency(totals.balance)}</Text>
              </View>

              {/* Table */}
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableRow} fixed>
                  {columnSelection.pupilInfo && (
                    <View style={[styles.tableColHeader, { width: columnWidths.pupilInfo }]}>
                      <Text style={styles.tableCellHeader}>Pupil Info</Text>
                    </View>
                  )}
                  {columnSelection.admissionNumber && (
                    <View style={[styles.tableColHeader, { width: columnWidths.admissionNumber }]}>
                      <Text style={styles.tableCellHeader}>Admission No.</Text>
                    </View>
                  )}
                  {columnSelection.class && (
                    <View style={[styles.tableColHeader, { width: columnWidths.class }]}>
                      <Text style={styles.tableCellHeader}>Class</Text>
                    </View>
                  )}
                  {columnSelection.section && (
                    <View style={[styles.tableColHeader, { width: columnWidths.section }]}>
                      <Text style={styles.tableCellHeader}>Section</Text>
                    </View>
                  )}
                  {columnSelection.totalFees && (
                    <View style={[styles.tableColHeader, { width: columnWidths.totalFees }]}>
                      <Text style={styles.tableCellHeader}>Total Fees</Text>
                    </View>
                  )}
                  {columnSelection.totalPaid && (
                    <View style={[styles.tableColHeader, { width: columnWidths.totalPaid }]}>
                      <Text style={styles.tableCellHeader}>Paid</Text>
                    </View>
                  )}
                  {columnSelection.balance && (
                    <View style={[styles.tableColHeader, { width: columnWidths.balance }]}>
                      <Text style={styles.tableCellHeader}>Balance</Text>
                    </View>
                  )}
                  {/* Removed Last Payment column for speed optimization */}
                  {columnSelection.feeBreakdown && (
                    <View style={[styles.tableColHeader, { width: columnWidths.feeBreakdown }]}>
                      <Text style={styles.tableCellHeader}>Fee Breakdown</Text>
                    </View>
                  )}
                </View>

                {/* Table Body */}
                {pupils.map((pupil: any, index: number) => {
                  const pupilClass = classes.find((c: any) => c.id === pupil.classId);
                  const feesInfo = pupilFeesInfo[pupil.id] || {};

                  return (
                    <View key={pupil.id} style={styles.tableRow} wrap={false} minPresenceAhead={40}>
                      {columnSelection.pupilInfo && (
                        <View style={[styles.tableCol, { width: columnWidths.pupilInfo }]}>
                          <Text style={styles.tableCell}>
                            {pupil.firstName} {pupil.lastName}
                            {pupil.otherNames && ` ${pupil.otherNames}`}
                          </Text>
                        </View>
                      )}
                      {columnSelection.admissionNumber && (
                        <View style={[styles.tableCol, { width: columnWidths.admissionNumber }]}>
                          <Text style={styles.tableCell}>{pupil.admissionNumber || 'N/A'}</Text>
                        </View>
                      )}
                      {columnSelection.class && (
                        <View style={[styles.tableCol, { width: columnWidths.class }]}>
                          <Text style={styles.tableCell}>{pupilClass?.code || 'N/A'}</Text>
                        </View>
                      )}
                      {columnSelection.section && (
                        <View style={[styles.tableCol, { width: columnWidths.section }]}>
                          <Text style={styles.tableCell}>
                            {pupil.section === 'boarding' ? 'Boarding' : 'Day'}
                          </Text>
                        </View>
                      )}
                      {columnSelection.totalFees && (
                        <View style={[styles.tableCol, { width: columnWidths.totalFees }]}>
                          <Text style={[styles.tableCell, styles.currencyText]}>
                            {formatCurrency(feesInfo.totalFees || 0)}
                          </Text>
                        </View>
                      )}
                      {columnSelection.totalPaid && (
                        <View style={[styles.tableCol, { width: columnWidths.totalPaid }]}>
                          <Text style={[styles.tableCell, styles.currencyText, { color: '#38a169' }]}>
                            {formatCurrency(feesInfo.totalPaid || 0)}
                          </Text>
                        </View>
                      )}
                      {columnSelection.balance && (
                        <View style={[styles.tableCol, { width: columnWidths.balance }]}>
                          <Text style={[styles.tableCell, styles.currencyText, { 
                            color: (feesInfo.balance || 0) > 0 ? '#e53e3e' : '#38a169'
                          }]}>
                            {formatCurrency(feesInfo.balance || 0)}
                          </Text>
                        </View>
                      )}
                      {/* Removed Last Payment data for speed optimization */}
                      {columnSelection.feeBreakdown && (
                        <View style={[styles.tableCol, { width: columnWidths.feeBreakdown }]}>
                          {feesInfo.applicableFees?.slice(0, 3).map((fee: any, idx: number) => (
                            <View key={idx} wrap={false}>
                              <Text style={styles.tableCellSmall}>
                                {fee.name}: {formatCurrency(fee.balance)}
                              </Text>
                            </View>
                          ))}
                          {feesInfo.applicableFees && feesInfo.applicableFees.length > 3 && (
                            <Text style={styles.tableCellSmall}>
                              +{feesInfo.applicableFees.length - 3} more
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Summary Row */}
                <View style={[styles.tableRow, styles.summaryRow]}>
                  {columnSelection.pupilInfo && (
                    <View style={[styles.tableCol, { width: columnWidths.pupilInfo }]}>
                      <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>
                        SUMMARY ({pupils.length} students)
                      </Text>
                    </View>
                  )}
                  {columnSelection.admissionNumber && (
                    <View style={[styles.tableCol, { width: columnWidths.admissionNumber }]}>
                      <Text style={styles.tableCell}>-</Text>
                    </View>
                  )}
                  {columnSelection.class && (
                    <View style={[styles.tableCol, { width: columnWidths.class }]}>
                      <Text style={styles.tableCell}>-</Text>
                    </View>
                  )}
                  {columnSelection.section && (
                    <View style={[styles.tableCol, { width: columnWidths.section }]}>
                      <Text style={styles.tableCell}>-</Text>
                    </View>
                  )}
                  {columnSelection.totalFees && (
                    <View style={[styles.tableCol, { width: columnWidths.totalFees }]}>
                      <Text style={[styles.tableCell, styles.currencyText, { fontWeight: 'bold' }]}>
                        {formatCurrency(totals.totalFees)}
                      </Text>
                    </View>
                  )}
                  {columnSelection.totalPaid && (
                    <View style={[styles.tableCol, { width: columnWidths.totalPaid }]}>
                      <Text style={[styles.tableCell, styles.currencyText, { fontWeight: 'bold', color: '#38a169' }]}>
                        {formatCurrency(totals.totalPaid)}
                      </Text>
                    </View>
                  )}
                  {columnSelection.balance && (
                    <View style={[styles.tableCol, { width: columnWidths.balance }]}>
                      <Text style={[styles.tableCell, styles.currencyText, { fontWeight: 'bold', color: '#e53e3e' }]}>
                        {formatCurrency(totals.balance)}
                      </Text>
                    </View>
                  )}
                  {/* Removed Last Payment summary for speed optimization */}
                  {columnSelection.feeBreakdown && (
                    <View style={[styles.tableCol, { width: columnWidths.feeBreakdown }]}>
                      <Text style={styles.tableCellSmall}>Various fees</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Footer */}
              <Text 
                style={styles.footer} 
                fixed 
                render={({ pageNumber, totalPages }: any) => 
                  `Trinity Family School - Fees Collection Report • Page ${pageNumber} of ${totalPages} • Generated: ${new Date().toLocaleDateString()}`
                }
              />
            </Page>
          </Document>
        );
      };

      const pdfDoc = createPDFComponent({
        pupils: sortedPupils,
        pupilFeesInfo,
        classes,
        filters,
        sortConfig,
        columnSelection,
        totals
      });

      // Generate and download the PDF
      const asPdf = pdf(pdfDoc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fees-collection-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Close the modal after successful generation
      setIsColumnSelectionModalOpen(false);
      
      toast({
        title: "PDF Generated",
        description: "Fees collection report has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
      });
    }
  };

  // Class selector is now in header - no separate selection prompt needed

  // Show loading state
  if (isLoadingPupils || isLoadingClasses || isLoadingAcademicYears || isLoadingFeeStructures) {
    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading Fees Collection</h2>
          <p className="text-gray-500">Please wait while we prepare your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />
      
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-white/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center space-x-4">
              <Link
                href="/fees"
                className="group flex items-center space-x-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span className="font-medium text-sm">Back</span>
              </Link>
              
              <div className="hidden sm:block w-px h-8 bg-gray-200"></div>
              
              <div>
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Fees Collection
                </h1>
                <p className="text-sm text-gray-500 hidden sm:block">
                  Manage student fee payments and balances
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {/* Class Selector for Performance Optimization */}
              <div className="flex-shrink-0">
                <ClassSelector
                  selectedClassId={filters.selectedClassId}
                  onClassChange={(classId) => setFilters(prev => ({ ...prev, selectedClassId: classId }))}
                  placeholder="Select class"
                  size="sm"
                  className="min-w-[140px]"
                  includeAllOption={true}
                  allOptionLabel="All Classes"
                />
              </div>
              
              {/* Minimal Academic Year & Term Peel */}
              <div className="flex items-center bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-sm overflow-hidden">
                {/* Academic Year Selector */}
                <Select value={filters.year} onValueChange={(value) => setFilters(prev => ({ ...prev, year: value }))}>
                  <SelectTrigger className="border-0 bg-transparent text-white hover:bg-white/10 transition-colors rounded-l-lg rounded-r-none h-7 px-2 focus:ring-0 focus:ring-offset-0 text-xs [&>svg]:hidden">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        <span className="text-sm">{year.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Divider */}
                <div className="w-px h-3 bg-white/20"></div>

                {/* Term Selector */}
                <Select value={filters.term} onValueChange={(value) => setFilters(prev => ({ ...prev, term: value }))}>
                  <SelectTrigger className="border-0 bg-transparent text-white hover:bg-white/10 transition-colors rounded-r-lg rounded-l-none h-7 px-2 focus:ring-0 focus:ring-offset-0 text-xs min-w-[60px] [&>svg]:hidden">
                    <SelectValue placeholder="Term" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedAcademicYear?.terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        <span className="text-sm">{term.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs whitespace-nowrap">
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline ml-1">Export</span>
              </Button>
              
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs whitespace-nowrap">
                <MessageSquare className="w-3 h-3" />
                <span className="hidden sm:inline ml-1">Send Reminders</span>
              </Button>
              
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg h-7 px-2 text-xs whitespace-nowrap" onClick={() => setIsColumnSelectionModalOpen(true)}>
                <Printer className="w-3 h-3" />
                <span className="hidden sm:inline ml-1">Print</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-6">
          <Card className="hidden md:block bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs font-medium">Total Students</p>
                  <p className="text-lg font-bold">
                    {sortedPupils.length !== pupils.length ? (
                      <span>{sortedPupils.length}<span className="text-sm opacity-75">/{pupils.length}</span></span>
                    ) : (
                      sortedPupils.length
                    )}
                  </p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-green-100 text-xs font-medium truncate">Collected</p>
                  <p className="text-xs sm:text-lg font-bold">{formatCurrency(totals.totalPaid)}</p>
                </div>
                <div className="hidden sm:block p-2 bg-white/20 rounded-lg ml-2">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0 shadow-lg">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-orange-100 text-xs font-medium truncate">Outstanding</p>
                  <p className="text-xs sm:text-lg font-bold">{formatCurrency(totals.balance)}</p>
                </div>
                <div className="hidden sm:block p-2 bg-white/20 rounded-lg ml-2">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-purple-100 text-xs font-medium truncate">Total Fees</p>
                  <p className="text-xs sm:text-lg font-bold">{formatCurrency(totals.totalFees)}</p>
                </div>
                <div className="hidden sm:block p-2 bg-white/20 rounded-lg ml-2">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Class-Based Optimization Indicator - Hidden per user request */}

        {/* Progressive Loading Indicator */}
        <ProgressiveLoadingIndicator
          processedCount={processedCount}
          totalCount={totalCount}
          currentBatch={currentBatch}
          totalBatches={totalBatches}
          isProcessing={isProcessing}
          processingStatus={processingStatus}
          progressPercentage={progressPercentage}
          error={progressiveError}
          totals={totals}
          optimizationInfo={progressiveFeesData.optimizationInfo}
          onRestart={restartProcessing}
        />

        {/* Compact Filter Panel - Same design as Pupils page */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-sm border border-blue-100/50 mb-4 sm:mb-6 overflow-hidden">
          <div className="px-2 sm:px-4 py-2 sm:py-3">
            {/* Single Row: Stats and Controls */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
              {/* Statistics Pills */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {(searchQuery || filters.class !== 'all' || filters.section !== 'all' || filters.status !== 'Active' || filters.balanceStatus !== 'all' || filters.balanceMin || filters.balanceMax) && (
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-purple-50 rounded-full border border-purple-100">
                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-purple-500"></div>
                    <span className="text-xs text-purple-600 font-medium">Filtered</span>
                </div>
                )}
              </div>
              
              {/* Clear Button */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                {(searchQuery || filters.class !== 'all' || filters.section !== 'all' || filters.status !== 'Active' || filters.balanceStatus !== 'all' || filters.balanceMin || filters.balanceMax || filters.feeItem) && (
                          <button
                    onClick={() => {
                      setFilters({
                        section: 'all',
                        class: 'all',
                        selectedClassId: '',
                        status: 'Active',
                        balanceStatus: 'all',
                        balanceMin: '',
                        balanceMax: '',
                        feeItem: '',
                        year: selectedAcademicYear?.id || '',
                        term: selectedAcademicYear?.terms.find(t => t.isCurrent)?.id || selectedAcademicYear?.terms[0]?.id || ''
                      });
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full border border-red-100 transition-all duration-200 hover:scale-105"
                  >
                    <X size={10} className="sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline">Clear</span>
                          </button>
                )}
                          </div>
                        </div>

            {/* Search Bar with Filter Button */}
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                  <Search size={10} className="sm:w-3 sm:h-3 text-blue-500/80" />
                      </div>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-6 sm:pl-8 pr-6 sm:pr-8 py-1 sm:py-1.5 text-xs bg-blue-50/50 rounded-full border border-blue-100 focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white placeholder:text-blue-400/70"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-red-500 transition-colors"
                  >
                    <X size={10} className="sm:w-3 sm:h-3" />
                  </button>
                )}
            </div>
          
              <button
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-100 transition-all duration-200 hover:scale-105"
              >
                <Filter size={10} className="sm:w-3 sm:h-3" />
                {isFiltersExpanded ? 'Hide' : 'Filter'}
              </button>
              </div>

            {/* Expandable Filter Controls */}
            {isFiltersExpanded && (
              <div className="border-t border-blue-50 pt-2 sm:pt-3 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                  {/* Class Filter */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-700">Class</label>
                    <select
                      value={filters.class}
                      onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
                      className="w-full rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1.5 sm:px-2.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white"
                    >
                      <option value="all">All Classes</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
              </div>

                  {/* Section Filter */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-700">Section</label>
                    <select
                      value={filters.section}
                      onChange={(e) => setFilters(prev => ({ ...prev, section: e.target.value }))}
                      className="w-full rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1.5 sm:px-2.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white"
                    >
                      <option value="all">All Sections</option>
                      <option value="day">Day</option>
                      <option value="boarding">Boarding</option>
                    </select>
              </div>

                  {/* Status Filter */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-700">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1.5 sm:px-2.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white"
                    >
                      <option value="all">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Graduated">Graduated</option>
                      <option value="Transferred">Transferred</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </select>
              </div>

                  {/* Balance Filter */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-700">Balance</label>
                    <select
                      value={filters.balanceStatus}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilters(prev => ({ 
                          ...prev, 
                          balanceStatus: value,
                          balanceMin: value !== 'custom_range' ? '' : prev.balanceMin,
                          balanceMax: value !== 'custom_range' ? '' : prev.balanceMax
                        }));
                      }}
                      className="w-full rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1.5 sm:px-2.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white"
                    >
                      <option value="all">All Balances</option>
                      <option value="with_balance">With Balance</option>
                      <option value="without_balance">No Balance</option>
                      <option value="never_paid">Never Paid</option>
                      <option value="custom_range">Custom Range</option>
                    </select>
            </div>

                  {/* Fee Item Filter */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-700">Fee Item</label>
                    <select
                      value={filters.feeItem}
                      onChange={(e) => setFilters(prev => ({ ...prev, feeItem: e.target.value }))}
                      className="w-full rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1.5 sm:px-2.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white"
                    >
                      <option value="">All Fee Items ({availableFeeStructures.length})</option>
                      
                      {/* Group by fee type for better organization */}
                      {(() => {
                        const assignmentFees = availableFeeStructures.filter(fs => fs.isAssignmentFee);
                        const regularFees = availableFeeStructures.filter(fs => !fs.isAssignmentFee);
                        
                        return (
                          <>
                            {/* Assignment Fees */}
                            {assignmentFees.length > 0 && (
                              <optgroup label={`Assignment Fees (${assignmentFees.length})`}>
                                {assignmentFees.map(feeStructure => (
                                  <option key={feeStructure.id} value={feeStructure.id}>
                                    {feeStructure.name} - {feeStructure.category}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            
                            {/* Regular Fee Structures by Category */}
                            {(() => {
                              const categorizedFees = regularFees.reduce((acc, fee) => {
                                if (!acc[fee.category]) acc[fee.category] = [];
                                acc[fee.category].push(fee);
                                return acc;
                              }, {} as Record<string, typeof regularFees>);
                              
                              return Object.entries(categorizedFees).map(([category, fees]) => (
                                <optgroup key={category} label={`${category} (${fees.length})`}>
                                  {fees.map(feeStructure => (
                                    <option key={feeStructure.id} value={feeStructure.id}>
                                      {feeStructure.name}
                                      {feeStructure.amount > 0 && ` - ${formatCurrency(feeStructure.amount)}`}
                                    </option>
                                  ))}
                                </optgroup>
                              ));
                            })()}
                          </>
                        );
                      })()}
                    </select>
                  </div>

                  {/* Balance Range - Show when Custom Range is selected */}
                  {filters.balanceStatus === 'custom_range' && (
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-xs font-medium text-blue-700">Amount Range</label>
                      <div className="flex items-center gap-1">
                        <input
                  type="number"
                  placeholder="Min"
                  value={filters.balanceMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, balanceMin: e.target.value }))}
                          className="w-16 sm:w-20 rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1 sm:px-1.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white text-center"
                        />
                        <span className="text-xs text-blue-400 font-medium">-</span>
                        <input
                  type="number"
                  placeholder="Max"
                  value={filters.balanceMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, balanceMax: e.target.value }))}
                          className="w-16 sm:w-20 rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1 sm:px-1.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white text-center"
                />
              </div>
            </div>
                  )}
            </div>
          </div>
            )}
        </div>
          </div>
                
        {/* Results Section with Beautiful Slide-Up Animation */}
        {sortedPupils.length === 0 ? (
          <Card className="shadow-xl border-0">
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-gray-100 rounded-full">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Students Found</h3>
                  <p className="text-gray-500">No students match your current search criteria.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile Card View with Beautiful Slide-Up Animation */}
                  <motion.div
              className="block lg:hidden space-y-4 mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.6,
                ease: "easeOut",
                delay: isProcessing ? 0 : 0.3 // Delay when progress indicator disappears
              }}
              layout
            >
              {sortedPupils.map((pupil, index) => {
                const feesInfo = pupilFeesInfo[pupil.id];
                const pupilClass = classes.find(c => c.id === pupil.classId);
                
                return (
                  <Card key={pupil.id} className="shadow-lg border-0 overflow-hidden bg-white rounded-2xl cursor-pointer" onClick={() => handlePupilClick(pupil.id)}>
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-12 h-12 border-2 border-white/30">
                            {pupil.photo && pupil.photo.trim() !== '' && pupil.photo.startsWith('http') ? (
                              <AvatarImage 
                                src={pupil.photo} 
                                alt={`${pupil.firstName} ${pupil.lastName}`}
                                onError={(e) => {
                                  console.log('Fees collection avatar image failed to load:', pupil.photo);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <AvatarFallback className="bg-white/20 text-white font-bold">
                                {pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">
                                {pupil.firstName} {pupil.lastName}
                            </h3>
                            <div className="flex items-center space-x-2 text-white/80 text-sm">
                              <span>{pupil.admissionNumber}</span>
                              <span>•</span>
                              <span>{pupilClass?.code || pupilClass?.name}</span>
                              {pupil.section && (
                                <>
                              <span>•</span>
                              <span>{pupil.section}</span>
                                </>
                              )}
                          </div>
                        </div>
                        </div>
                        
                      </div>
                    </div>
                    
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 font-medium">
                            {filters.feeItem ? 'Fee Amount' : 'Total Fees'}
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {(() => {
                              if (filters.feeItem && feesInfo?.applicableFees) {
                                const selectedFee = feesInfo.applicableFees.find(fee => fee.feeStructureId === filters.feeItem);
                                return formatCurrency(selectedFee?.amount || 0);
                              }
                              return formatCurrency(feesInfo?.totalFees || 0);
                            })()}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 font-medium">Paid</p>
                          <p className="text-sm font-bold text-green-600">
                            {(() => {
                              if (filters.feeItem && feesInfo?.applicableFees) {
                                const selectedFee = feesInfo.applicableFees.find(fee => fee.feeStructureId === filters.feeItem);
                                return formatCurrency(selectedFee?.paid || 0);
                              }
                              return formatCurrency(feesInfo?.totalPaid || 0);
                            })()}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 font-medium">Balance</p>
                          <p className={`text-sm font-bold ${(() => {
                            let balance = 0;
                            if (filters.feeItem && feesInfo?.applicableFees) {
                              const selectedFee = feesInfo.applicableFees.find(fee => fee.feeStructureId === filters.feeItem);
                              balance = selectedFee?.balance || 0;
                            } else {
                              balance = feesInfo?.balance || 0;
                            }
                            return balance > 0 ? 'text-red-600' : 'text-green-600';
                          })()}`}>
                            {(() => {
                              if (filters.feeItem && feesInfo?.applicableFees) {
                                const selectedFee = feesInfo.applicableFees.find(fee => fee.feeStructureId === filters.feeItem);
                                return formatCurrency(selectedFee?.balance || 0);
                              }
                              return formatCurrency(feesInfo?.balance || 0);
                            })()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Additional Info Row - Fee Name only (removed Last Payment for speed) */}
                      {filters.feeItem && (
                        <div className="pt-2 border-t border-gray-100">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 font-medium">Fee Item</p>
                            <p className="text-sm font-medium text-gray-700">
                              {(() => {
                                const selectedFeeStructure = availableFeeStructures.find(fs => fs.id === filters.feeItem);
                                return selectedFeeStructure?.name || 'Unknown Fee';
                              })()}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
                  </motion.div>
                  
            {/* Desktop Table View with Beautiful Slide-Up Animation */}
                  <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.6,
                ease: "easeOut",
                delay: isProcessing ? 0 : 0.3 // Delay when progress indicator disappears
              }}
              layout
            >
            <Card className="hidden lg:block shadow-xl border-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th 
                      onClick={() => handleSort('firstName')} 
                        className="cursor-pointer px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-200 transition-colors"
                      >
                      <div className="flex items-center space-x-1">
                        <span>Pupil ({sortedPupils.length})</span>
                          <ArrowUpDown size={14} className={`${sortConfig.key === 'firstName' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('totalFees')} 
                        className="cursor-pointer px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-200 transition-colors"
                      >
                      <div className="flex items-center space-x-1">
                          <span>{filters.feeItem ? 'Fee Amount' : 'Total Fees'}</span>
                          <ArrowUpDown size={14} className={`${sortConfig.key === 'totalFees' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('totalPaid')} 
                        className="cursor-pointer px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-200 transition-colors"
                      >
                      <div className="flex items-center space-x-1">
                          <span>Paid</span>
                          <ArrowUpDown size={14} className={`${sortConfig.key === 'totalPaid' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('balance')} 
                        className="cursor-pointer px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-200 transition-colors"
                      >
                      <div className="flex items-center space-x-1">
                          <span>Balance</span>
                          <ArrowUpDown size={14} className={`${sortConfig.key === 'balance' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                        {/* Removed Last Payment and Status columns for speed optimization */}
                  </tr>
                </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {sortedPupils.map((pupil, index) => {
                    const feesInfo = pupilFeesInfo[pupil.id];
                    const pupilClass = classes.find(c => c.id === pupil.classId);
                    
                    return (
                          <PupilFeesRow
                        key={pupil.id} 
                            pupil={pupil}
                            pupilClass={pupilClass}
                            feesInfo={feesInfo}
                            onClick={() => handlePupilClick(pupil.id)}
                            selectedFeeId={filters.feeItem}
                            availableFeeStructures={availableFeeStructures}
                          />
                    );
                  })}
                  
                      {/* Summary Row */}
                    <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-200">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <PieChart className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">Summary</p>
                            <p className="text-xs text-gray-600">{sortedPupils.length} students</p>
                          </div>
                        </div>
                    </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(totals.totalFees)}</p>
                    </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-green-700">{formatCurrency(totals.totalPaid)}</p>
                    </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-red-600">{formatCurrency(totals.balance)}</p>
                    </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-500">
                            Collection Rate: {totals.totalFees > 0 ? Math.round((totals.totalPaid / totals.totalFees) * 100) : 0}%
                        </div>
                      </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
            aria-label="Scroll to top"
          >
            <ArrowUpDown className="w-5 h-5 rotate-180" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Column Selection and PDF Generation Modal */}
      <Dialog 
        open={isColumnSelectionModalOpen} 
        onOpenChange={setIsColumnSelectionModalOpen}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Printer className="mr-2 h-5 w-5 text-indigo-600" />
              Print Fees Collection Report - Select Columns
            </DialogTitle>
            <DialogDescription>
              Choose which data columns to include in your PDF. More columns may require landscape orientation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Column Selection Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-700 border-b border-gray-200 pb-1">Basic Info</h4>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.pupilInfo}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, pupilInfo: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Pupil Name</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.admissionNumber}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, admissionNumber: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Admission Number</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.class}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, class: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Class</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.section}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, section: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Section</span>
                </label>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-700 border-b border-gray-200 pb-1">Financial</h4>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.totalFees}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, totalFees: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Total Fees</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.totalPaid}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, totalPaid: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Amount Paid</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.balance}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, balance: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Outstanding Balance</span>
                </label>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-700 border-b border-gray-200 pb-1">Additional</h4>
                
                {/* Removed Last Payment Date option for speed optimization */}
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.feeBreakdown}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, feeBreakdown: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Fee Breakdown</span>
                </label>
              </div>
            </div>

            {/* Quick Selection Buttons */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setColumnSelection({
                    pupilInfo: true,
                    admissionNumber: true,
                    class: true,
                    section: false,
                    totalFees: true,
                    totalPaid: true,
                    balance: true,
                    feeBreakdown: false
                  })}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                >
                  Standard Report
                </button>
                
                <button
                  onClick={() => setColumnSelection({
                    pupilInfo: true,
                    admissionNumber: true,
                    class: true,
                    section: true,
                    totalFees: true,
                    totalPaid: true,
                    balance: true,
                    feeBreakdown: false
                  })}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                >
                  Detailed Report
                </button>
                
                <button
                  onClick={() => setColumnSelection({
                    pupilInfo: true,
                    admissionNumber: true,
                    class: true,
                    section: true,
                    totalFees: true,
                    totalPaid: true,
                    balance: true,
                    feeBreakdown: true
                  })}
                  className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
                >
                  Complete Report
                </button>
                
                <button
                  onClick={() => setColumnSelection({
                    pupilInfo: false,
                    admissionNumber: false,
                    class: false,
                    section: false,
                    totalFees: false,
                    totalPaid: false,
                    balance: false,
                    feeBreakdown: false
                  })}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Preview Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-blue-900">PDF Preview</p>
                  <p className="text-blue-800 mt-1">
                    Selected columns: {Object.values(columnSelection).filter(Boolean).length} | 
                    Students to include: {sortedPupils.length} | 
                    Orientation: {Object.entries(columnSelection).filter(([_, selected]) => selected).length > 6 ? 'Landscape' : 'Portrait'}
                  </p>
                  <p className="text-blue-700 mt-1 text-xs">
                    Total Fees: {formatCurrency(totals.totalFees)} | Paid: {formatCurrency(totals.totalPaid)} | Balance: {formatCurrency(totals.balance)}
                  </p>
                  {Object.values(columnSelection).filter(Boolean).length === 0 && (
                    <p className="text-red-700 mt-2 text-xs">
                      Please select at least one column to generate the PDF.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsColumnSelectionModalOpen(false)}
            >
              Cancel
            </Button>
            
            {Object.values(columnSelection).some(Boolean) && (
              <Button 
                onClick={handleGeneratePDF}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Printer className="mr-2 h-4 w-4" />
                Generate PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 