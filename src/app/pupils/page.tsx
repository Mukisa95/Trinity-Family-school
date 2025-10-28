"use client";

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, PencilSimple, Trash, Power, FunnelSimple, CaretUp, CaretDown, X, Printer, ChartLine, DotsThree, MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDeletePupil, useUpdatePupil } from '@/lib/hooks/use-pupils';
import { useClassPupilsManager } from '@/lib/hooks/use-class-pupils';
import { ClassSelector } from '@/components/common/class-selector';
import { useClasses } from '@/lib/hooks/use-classes';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
// PupilsProgressIndicator no longer needed with class-based loading
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
import { Shield, Loader2, Edit, Settings, ChevronDown, UserPlus, CreditCard, Eye, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState as useReactState, useEffect } from 'react';
import type { Pupil, Guardian, Class, PupilStatus, AdditionalIdentifier } from '@/types';
import { Suspense } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ManageIdCodesModal } from '@/components/pupils/manage-id-codes-modal';
import { LinkSiblingsModal } from '@/components/pupils/link-siblings-modal';
import { ActionGuard } from "@/components/auth/action-guard";
import { usePermissions } from "@/lib/hooks/use-permissions";
import dynamic from 'next/dynamic';
import { formatPupilDisplayName, sortPupilsByName } from '@/lib/utils/name-formatter';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';

// Define interfaces
interface ColumnSelection {
  pin: boolean;
  name: boolean;
  gender: boolean;
  age: boolean;
  class: boolean;
  codes: boolean;
  section: boolean;
  status: boolean;
  guardianContacts: boolean;
  siblings: boolean;
  religion: boolean;
  photo: boolean;
  actualPhoto: boolean;
}

interface House {
  id: string;
  name: string;
  motto?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface HouseAssignment {
  id: string;
  houseId: string;
  house: House;
  pupilId: string;
  assignedAt: string;
  assignedBy?: string;
  previousHouseId?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type SortField = 'name' | 'age' | 'class' | 'gender' | 'status';
type SortOrder = 'asc' | 'desc';

interface Filters {
  classId: string;
  gender: string;
  status: string;
  section: string;
  houseId: string;
  ageRange: {
    min: number;
    max: number;
  };
}



// Add settings interface
interface Settings {
  generalInfo: {
    name: string;
    logo?: string;
    motto?: string;
    establishedYear?: string;
    schoolType?: string;
    registrationNumber?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    alternativePhone?: string;
    website?: string;
  };
  address: {
    physical?: string;
    postal?: string;
    city?: string;
    country?: string;
  };
  headTeacher: {
    name?: string;
    signature?: string;
    message?: string;
  };
}

// Function to get user info from token
const getUserFromToken = () => {
  // Check if we're on the client side
  if (typeof window === 'undefined') {
    return {
      id: 'system',
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin'
    };
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return {
      id: 'guest',
      firstName: 'Guest',
      lastName: 'User',
      role: 'user'
    };
  }

  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return {
      id: payload.id,
      firstName: payload.firstName || payload.username,
      lastName: payload.lastName || '',
      role: payload.role
    };
  } catch (error) {
    console.error('Error parsing token:', error);
    return {
      id: 'error',
      firstName: 'Unknown',
      lastName: 'User',
      role: 'user'
    };
  }
};



function PupilsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  // Search is now handled by pupilsManager
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filters, setFilters] = useState<Filters>({
    classId: '',
    gender: searchParams?.get('gender') || '',
    status: 'Active',
    section: '',
    houseId: '',
    ageRange: { min: 0, max: 100 }
  });
  const [statusChangeModal, setStatusChangeModal] = useState<{
    isOpen: boolean;
    pupil: Pupil | null;
  }>({
    isOpen: false,
    pupil: null
  });
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedClassIdForStatus, setSelectedClassIdForStatus] = useState('');
  // selectedClassId is now handled by pupilsManager
  const [showClassSelection, setShowClassSelection] = useState(false);
  const [selectedPupilGuardians, setSelectedPupilGuardians] = useState<{
    pupilName: string;
    guardians: Guardian[];
    emergencyContactId: string;
  } | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedPupilSiblings, setSelectedPupilSiblings] = useState<{
    pupilName: string;
    siblings: Pupil[];
  } | null>(null);
  
  // Add column selection state with default values
  const [columnSelection, setColumnSelection] = useState<ColumnSelection>({
    pin: true,
    name: true,
    gender: true,
    age: true,
    class: true,
    codes: false,
    section: true,
    status: true,
    guardianContacts: false,
    siblings: false,
    religion: false,
    photo: false,
    actualPhoto: false
  });
  
  // Add state for column selection modal
  const [isColumnSelectionModalOpen, setIsColumnSelectionModalOpen] = useState(false);

  // Add class change modal state
  const [classChangeModal, setClassChangeModal] = useState<{
    isOpen: boolean;
    pupil: Pupil | null;
  }>({
    isOpen: false,
    pupil: null
  });
  const [selectedNewClassId, setSelectedNewClassId] = useState('');

  // Add section change modal state
  const [sectionChangeModal, setSectionChangeModal] = useState<{
    isOpen: boolean;
    pupil: Pupil | null;
  }>({
    isOpen: false,
    pupil: null
  });
  const [selectedNewSection, setSelectedNewSection] = useState<'Day' | 'Boarding'>('Day');

  // Add state for ID codes modal
  const [isManageIdCodesModalOpen, setIsManageIdCodesModalOpen] = useState(false);
  const [selectedPupilForIdCodes, setSelectedPupilForIdCodes] = useState<Pupil | null>(null);

  // Add state for link siblings modal
  const [isLinkSiblingsModalOpen, setIsLinkSiblingsModalOpen] = useState(false);
  const [selectedPupilForLinking, setSelectedPupilForLinking] = useState<Pupil | null>(null);

  // 🚀 PAGINATION: Prevent browser freeze with large datasets
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50); // Default: 50 pupils per page

  // Optimized: Firebase hooks with class-based loading - starts with NO class selected for faster initial load
  const pupilsManager = useClassPupilsManager('');
  const { 
    filteredPupils: pupils = [], 
    isLoading: isLoadingPupils, 
    error,
    selectedClassId,
    handleClassChange,
    filters: pupilFilters,
    handleFilterChange,
    resetFilters,
    handleSearch,
    searchQuery,
    clearSearch,
    totalCount,
    classCount,
    statistics
  } = pupilsManager;

  // Reset to page 1 when filters/search/class changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, searchQuery, pupilFilters.status, pupilFilters.section, pupilFilters.gender]);

  // Optimized: Cached hooks with longer stale times
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
  const { data: schoolSettings, isLoading: isLoadingSettings } = useSchoolSettings();
  
  // 🚀 OPTIMIZATION: Pre-compute classes map for O(1) lookups instead of O(N×M)
  const classesMap = useMemo(() => {
    console.log('🚀 OPTIMIZATION: Building classes map for', classes.length, 'classes');
    const map = new Map(classes.map(c => [c.id, c]));
    console.log(`✅ OPTIMIZATION: Classes map built with ${map.size} entries for instant lookups`);
    return map;
  }, [classes]);
  const deletePupilMutation = useDeletePupil();
  const updatePupilMutation = useUpdatePupil();

  // Mock houses data - you can replace this with actual house fetching
  const houses: House[] = [];

  // Use actual school settings or fallback to default
  const settings: Settings = schoolSettings || {
    generalInfo: {
                  name: "Trinity Family School",
      motto: "Excellence in Education"
    },
    contact: {},
    address: {},
    headTeacher: {}
  };

  // Get user info from token instead of API call
  const currentUser = getUserFromToken();

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Calculate age with years and months in abbreviated format
  const calculateAgeAbbreviated = (dateOfBirth: string): string => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    // Adjust if the birthday hasn't occurred yet this year
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
      years--;
      months += 12;
    }
    
    // Adjust months if day of month hasn't been reached
    if (today.getDate() < birthDate.getDate()) {
      months--;
      if (months < 0) {
        months = 11;
      }
    }
    
    // Format the output with abbreviations
    if (years === 0) {
      return `${months}mo`;
    } else if (months === 0) {
      return `${years}yr`;
    } else {
      return `${years}yr ${months}mo`;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <CaretUp className="inline" /> : <CaretDown className="inline" />;
  };

  // Add a function to get siblings for a pupil
  // 🚀 OPTIMIZATION: Pre-compute siblings map for O(1) lookups instead of O(N²)
  // NOTE: Use ALL pupils, not paginated, so siblings work across pages
  const siblingsMap = useMemo(() => {
    console.log('🚀 OPTIMIZATION: Building siblings map for', pupils.length, 'pupils');
    const startTime = performance.now();
    
    const map = new Map<string, Pupil[]>();
    
    // Group pupils by familyId - use ALL pupils for complete sibling relationships
    const familiesMap = new Map<string, Pupil[]>();
    pupils.forEach(pupil => {
      if (pupil.familyId) {
        if (!familiesMap.has(pupil.familyId)) {
          familiesMap.set(pupil.familyId, []);
        }
        familiesMap.get(pupil.familyId)!.push(pupil);
      }
    });
    
    // For each pupil, store their siblings (excluding themselves)
    pupils.forEach(pupil => {
      if (pupil.familyId) {
        const family = familiesMap.get(pupil.familyId) || [];
        const siblings = family.filter(p => 
          p.id !== pupil.id && 
          (p.status === 'Active' || p.status === 'Inactive')
        );
        map.set(pupil.id, siblings);
      } else {
        map.set(pupil.id, []);
      }
    });
    
    const endTime = performance.now();
    console.log(`✅ OPTIMIZATION: Built siblings map in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`📊 OPTIMIZATION: ${map.size} pupils processed, instant O(1) lookups now available`);
    
    return map;
  }, [pupils]);
  
  const getSiblings = (pupil: Pupil): Pupil[] => {
    return siblingsMap.get(pupil.id) || [];
  };

  // Helper function to get the current house of a pupil
  const getPupilHouse = (pupil: Pupil): House | null => {
    // For now, return null since we don't have house data
    // You can implement this when house data is available
    return null;
  };

  // Helper function to format additional identifiers (codes)
  const formatCodes = (identifiers: AdditionalIdentifier[] | undefined): string => {
    if (!identifiers || identifiers.length === 0) {
      return 'No codes';
    }
    
    return identifiers
      .map(id => `${id.idType}: ${id.idValue}`)
      .join(', ');
  };

  // Filter pupils for display
  // 🚀 OPTIMIZATION: First filter and sort ALL pupils, then paginate
  const {filteredAndSortedPupils, totalFilteredCount} = useMemo(() => {
    const filtered = pupils.filter(pupil => {
      // Status filter
      if (filters.status && pupil.status !== filters.status) return false;
      
      // Class filter
      if (filters.classId && pupil.classId !== filters.classId) return false;

      // Gender filter
      if (filters.gender && pupil.gender !== filters.gender) return false;

      // Section filter
      if (filters.section && pupil.section !== filters.section) return false;

      // Age filter
      if (pupil.dateOfBirth) {
        const age = calculateAge(pupil.dateOfBirth);
        if (age < filters.ageRange.min || age > filters.ageRange.max) return false;
      }

      // Search is now handled by pupilsManager, so we don't need to filter here
      
      return true;
    });

    // Sort the filtered pupils
    filtered.sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'name':
          // Sort by lastName first, then firstName
          const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
          if (lastNameCompare !== 0) {
            return multiplier * lastNameCompare;
          }
          return multiplier * (a.firstName || '').localeCompare(b.firstName || '');
        case 'age':
          if (!a.dateOfBirth || !b.dateOfBirth) return 0;
          return multiplier * (calculateAge(a.dateOfBirth) - calculateAge(b.dateOfBirth));
        case 'class':
          const classA = classes.find(c => c.id === a.classId)?.code || '';
          const classB = classes.find(c => c.id === b.classId)?.code || '';
          return multiplier * classA.localeCompare(classB);
        case 'gender':
          return multiplier * a.gender.localeCompare(b.gender);
        case 'status':
          return multiplier * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    // 🚀 PAGINATION: Apply pagination to sorted results to prevent browser freeze
    const totalCount = filtered.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);
    
    console.log(`📄 PAGINATION: Showing pupils ${startIndex + 1}-${Math.min(endIndex, totalCount)} of ${totalCount} total (page ${currentPage})`);
    
    return { 
      filteredAndSortedPupils: paginated, 
      totalFilteredCount: totalCount 
    };
  }, [pupils, filters, sortField, sortOrder, classes, currentPage, itemsPerPage]);

  // Calculate total pages
  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  const handleDelete = async (pupilId: string, pupilName: string) => {
    if (window.confirm(`Are you sure you want to delete ${pupilName}?`)) {
    try {
      await deletePupilMutation.mutateAsync(pupilId);
      toast({
        title: "Pupil Deleted",
          description: `${pupilName} has been deleted successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete pupil. Please try again.",
      });
      }
    }
  };

  const handleStatusChange = (pupil: Pupil) => {
    setStatusChangeModal({
      isOpen: true,
      pupil: pupil
    });
    setSelectedStatus('');
    setSelectedClassIdForStatus('');
    setShowClassSelection(false);
  };

  const handleStatusSelection = (status: string) => {
    setSelectedStatus(status);
    // If changing to Active from another status, show class selection
    if (status === 'Active' && statusChangeModal.pupil?.status !== 'Active') {
      setShowClassSelection(true);
      setSelectedClassIdForStatus(statusChangeModal.pupil?.classId || '');
    } else {
      setShowClassSelection(false);
    }
  };

  const getClassName = (classId: string | undefined) => {
    if (!classId) return "N/A";
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : "N/A";
  };

  const confirmStatusChange = async () => {
    if (!statusChangeModal.pupil) return;

    const pupil = statusChangeModal.pupil;

    try {
      const updateData: any = {
        status: selectedStatus as PupilStatus,
      };
      
      // Add status history entry
      const statusHistoryEntry = {
        date: new Date().toISOString(),
        fromStatus: pupil.status || 'N/A',
        toStatus: selectedStatus as PupilStatus,
        reason: selectedStatus === 'Active' && pupil.status !== 'Active' 
          ? `Status changed from ${pupil.status} to ${selectedStatus} with class assignment`
          : `Status changed from ${pupil.status} to ${selectedStatus}`,
        processedBy: "System Admin", // TODO: Replace with actual user
      };

      // Add status history to update data
      updateData.statusChangeHistory = [...(pupil.statusChangeHistory || []), statusHistoryEntry];
      
      // If changing to Active and class selection was shown, update class too
      if (selectedStatus === 'Active' && showClassSelection && selectedClassId && selectedClassId !== pupil.classId) {
        updateData.classId = selectedClassId;
        updateData.className = getClassName(selectedClassId);
        
        // Also add promotion history entry if class changed
        const promotionHistoryEntry = {
          date: new Date().toISOString(),
          fromClassId: pupil.classId,
          fromClassName: pupil.className || getClassName(pupil.classId),
          toClassId: selectedClassId,
          toClassName: getClassName(selectedClassId),
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
          updateData.classId && updateData.classId !== pupil.classId ? ` and moved to ${getClassName(selectedClassId)}` : ''
        }.`,
      });
      
      setStatusChangeModal({ isOpen: false, pupil: null });
    } catch (err) {
      console.error("Failed to update status:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status. Please try again.",
      });
    }
  };

  // Add class change handlers for individual pupils
  const handlePupilClassChange = (pupil: Pupil) => {
    setClassChangeModal({ isOpen: true, pupil });
    setSelectedNewClassId(pupil.classId || '');
  };

  const confirmClassChange = async () => {
    if (!classChangeModal.pupil || !selectedNewClassId) return;

    const pupil = classChangeModal.pupil;
    
    if (selectedNewClassId === pupil.classId) {
      toast({
        variant: "destructive",
        title: "No Change",
        description: "Please select a different class.",
      });
      return;
    }

    try {
      const updateData: any = {
        classId: selectedNewClassId,
        className: getClassName(selectedNewClassId),
      };

      // Add promotion history entry
      const promotionHistoryEntry = {
        date: new Date().toISOString(),
        fromClassId: pupil.classId,
        fromClassName: pupil.className || getClassName(pupil.classId),
        toClassId: selectedNewClassId,
        toClassName: getClassName(selectedNewClassId),
        type: 'Transfer' as const,
        notes: `Class changed from pupils list`,
        processedBy: "System Admin", // TODO: Replace with actual user
      };
      
      updateData.promotionHistory = [...(pupil.promotionHistory || []), promotionHistoryEntry];

      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      toast({
        title: "Class Updated",
        description: `${pupil.firstName}'s class has been changed from ${getClassName(pupil.classId)} to ${getClassName(selectedNewClassId)}.`,
      });
      
      setClassChangeModal({ isOpen: false, pupil: null });
      setSelectedNewClassId('');
    } catch (err) {
      console.error("Failed to update class:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update class. Please try again.",
      });
    }
  };

  // Add section change handlers for individual pupils
  const handlePupilSectionChange = async (pupil: Pupil, newSection: 'Day' | 'Boarding') => {
    if (pupil.section === newSection) {
      toast({
        variant: "destructive",
        title: "No Change",
        description: `${pupil.firstName} is already in ${newSection} section.`,
      });
      return;
    }

    try {
      const updateData: any = {
        section: newSection,
      };

      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      toast({
        title: "Section Updated",
        description: `${pupil.firstName}'s section has been changed from ${pupil.section || 'N/A'} to ${newSection}.`,
      });
    } catch (err) {
      console.error("Failed to update section:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update section. Please try again.",
      });
    }
  };

  // Add ID codes management handler
  const handleManageIdCodes = (pupil: Pupil) => {
    setSelectedPupilForIdCodes(pupil);
    setIsManageIdCodesModalOpen(true);
  };

  // Add better delete handler
  const handleDeletePupil = (pupil: Pupil) => {
    const pupilName = formatPupilDisplayName(pupil);
    if (window.confirm(`Are you sure you want to delete ${pupilName}?\n\nThis action cannot be undone and will permanently remove all of their data including:\n- Personal information\n- Academic records\n- Exam results\n- Fee records\n- Attendance history\n\nType "DELETE" to confirm this action.`)) {
      const confirmation = window.prompt(`To confirm deletion of ${pupilName}, please type "DELETE" in all caps:`);
      if (confirmation === "DELETE") {
        handleDelete(pupil.id, pupilName);
      } else {
        toast({
          variant: "destructive",
          title: "Deletion Cancelled",
          description: "The pupil was not deleted. Confirmation text did not match.",
        });
      }
    }
  };

  // Add ID codes save handler
  const handleSaveIdCodes = async (identifiers: AdditionalIdentifier[]) => {
    if (!selectedPupilForIdCodes) return;

    try {
      await updatePupilMutation.mutateAsync({
        id: selectedPupilForIdCodes.id,
        data: { additionalIdentifiers: identifiers },
      });

      toast({
        title: "ID Codes Updated",
        description: `${selectedPupilForIdCodes.firstName}'s ID codes have been updated successfully.`,
      });
      
      setIsManageIdCodesModalOpen(false);
      setSelectedPupilForIdCodes(null);
    } catch (err) {
      console.error("Failed to update ID codes:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ID codes. Please try again.",
      });
    }
  };

  // Add link siblings handler
  const handleLinkSiblings = (pupil: Pupil) => {
    setSelectedPupilForLinking(pupil);
    setIsLinkSiblingsModalOpen(true);
  };

  // Add register sibling handler
  const handleRegisterSibling = (pupil: Pupil) => {
    const siblingParams = new URLSearchParams({
      addingSibling: 'true',
      familyId: pupil.familyId || `fam-${Date.now()}`,
      originalPupilId: pupil.id
    });
    router.push(`/pupils/new?${siblingParams.toString()}`);
  };

  // Handle successful linking
  const handleLinkingSuccess = () => {
    setIsLinkSiblingsModalOpen(false);
    setSelectedPupilForLinking(null);
    // Optionally refresh pupils data or show success message
  };

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Export to Excel function
  const exportToExcel = () => {
    // Convert pupils data to CSV format
    const headers = ['Admission Number', 'First Name', 'Last Name', 'Gender', 'Class', 'Section', 'Status', 'Age'];
    const csvData = filteredAndSortedPupils.map(pupil => [
      pupil.admissionNumber,
      pupil.firstName,
      pupil.lastName,
      pupil.gender,
      classes.find(c => c.id === pupil.classId)?.name || 'N/A',
      pupil.section,
      pupil.status,
      pupil.dateOfBirth ? calculateAge(pupil.dateOfBirth) : ''
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pupils_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Successful",
      description: `Exported ${filteredAndSortedPupils.length} pupils to CSV file.`,
    });
  };

  // Add PDF generation function with dynamic import
  const handleGeneratePDF = async () => {
    try {
      // Dynamic import to avoid SSR issues
      const { PDFDownloadLink, pdf, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer');
      
      // Create PDF component inline to avoid import issues
      const createPDFComponent = (props: any) => {
        const { pupils, classes, filters, sortField, sortOrder, settings, currentUser, columnSelection } = props;
        
        // Smart orientation detection based on selected columns and data density
        const selectedColumns = Object.entries(columnSelection).filter(([_, selected]) => selected);
        const heavyColumns = ['guardianContacts', 'siblings', 'codes', 'actualPhoto'];
        const hasHeavyColumns = selectedColumns.some(([column]) => heavyColumns.includes(column));
        const isLandscape = selectedColumns.length > 5 || hasHeavyColumns;
        
        const styles = StyleSheet.create({
          page: {
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            padding: 20,
            fontFamily: 'Helvetica',
          },
          // Header styles
          header: {
            marginBottom: 25,
            textAlign: 'center',
            position: 'relative',
            paddingBottom: 20,
            borderBottom: '2 solid #1e40af',
          },
          schoolName: {
            fontSize: 24,
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: 4,
            letterSpacing: 0.5,
          },
          motto: {
            fontSize: 11,
            color: '#64748b',
            fontStyle: 'italic',
            marginBottom: 8,
          },
          schoolDetails: {
            fontSize: 9,
            color: '#64748b',
            marginBottom: 12,
          },
          title: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#0f172a',
            marginTop: 15,
            textTransform: 'uppercase',
            letterSpacing: 1,
          },
          // Filter info
          filterInfo: {
            marginBottom: 20,
            padding: 12,
            backgroundColor: '#f1f5f9',
            borderRadius: 6,
            borderLeft: '4 solid #3b82f6',
          },
          filterTitle: {
            fontSize: 10,
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: 4,
          },
          filterText: {
            fontSize: 9,
            color: '#475569',
            lineHeight: 1.4,
          },
          // Table styles
          table: {
            width: '100%',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 20,
          },
          tableHeader: {
            backgroundColor: '#1e40af',
            flexDirection: 'row',
            minHeight: 40,
          },
          tableRow: {
            flexDirection: 'row',
            minHeight: columnSelection.actualPhoto ? 70 : 55,
            borderBottom: '1 solid #e2e8f0',
          },
          tableRowEven: {
            backgroundColor: '#f8fafc',
          },
          tableRowOdd: {
            backgroundColor: '#ffffff',
          },
          // Combined column styles for space optimization
          studentInfoCol: {
            width: '28%',
            padding: 12,
            paddingVertical: 8,
            justifyContent: 'flex-start',
            borderRight: '1 solid #e2e8f0',
          },
          academicInfoCol: {
            width: '22%',
            padding: 12,
            paddingVertical: 8,
            justifyContent: 'flex-start',
            borderRight: '1 solid #e2e8f0',
          },
          personalInfoCol: {
            width: '18%',
            padding: 12,
            paddingVertical: 8,
            justifyContent: 'flex-start',
            borderRight: '1 solid #e2e8f0',
          },
          contactInfoCol: {
            width: '32%',
            padding: 12,
            paddingVertical: 8,
            justifyContent: 'flex-start',
          },
          // Header cell styles
          headerCell: {
            fontSize: 11,
            fontWeight: 'bold',
            color: '#ffffff',
            textAlign: 'center',
            padding: 12,
          },
          // Text styles
          primaryText: {
            fontSize: 11,
            fontWeight: 'bold',
            color: '#0f172a',
            marginBottom: 3,
            lineHeight: 1.3,
          },
          secondaryText: {
            fontSize: 9,
            color: '#475569',
            marginBottom: 2,
            lineHeight: 1.2,
          },
          tertiaryText: {
            fontSize: 8,
            color: '#64748b',
            lineHeight: 1.2,
          },
          accentText: {
            fontSize: 8,
            color: '#1e40af',
            fontWeight: 'bold',
            marginBottom: 2,
            lineHeight: 1.2,
          },
          // Status badges
          statusActive: {
            fontSize: 8,
            color: '#059669',
            fontWeight: 'bold',
            backgroundColor: '#d1fae5',
            padding: '2 6',
            borderRadius: 3,
            textAlign: 'center',
          },
          statusInactive: {
            fontSize: 8,
            color: '#dc2626',
            fontWeight: 'bold',
            backgroundColor: '#fee2e2',
            padding: '2 6',
            borderRadius: 3,
            textAlign: 'center',
          },
          // Code chips
          codeChip: {
            fontSize: 8,
            color: '#1e40af',
            backgroundColor: '#dbeafe',
            padding: '2 4',
            borderRadius: 2,
            marginBottom: 2,
            textAlign: 'center',
          },
          // Contact info
          guardianInfo: {
            fontSize: 9,
            color: '#374151',
            marginBottom: 4,
            lineHeight: 1.4,
          },
          emergencyTag: {
            fontSize: 7,
            color: '#dc2626',
            fontWeight: 'bold',
            backgroundColor: '#fee2e2',
            padding: '2 4',
            borderRadius: 2,
            marginLeft: 4,
            marginTop: 1,
          },
          siblingInfo: {
            fontSize: 8,
            color: '#4b5563',
            marginBottom: 2,
            lineHeight: 1.2,
          },
          // Footer
          footer: {
            position: 'absolute',
            fontSize: 8,
            bottom: 15,
            left: 20,
            right: 20,
            textAlign: 'center',
            color: '#94a3b8',
            borderTop: '1 solid #e2e8f0',
            paddingTop: 8,
          },
        });

        // Helper functions
        const calculateAge = (dateOfBirth: string) => {
          const today = new Date();
          const birthDate = new Date(dateOfBirth);
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          return age;
        };

        const getSiblings = (pupil: any, allPupils: any[]) => {
          if (!pupil.familyId) return [];
          return allPupils.filter(p => 
            p.familyId === pupil.familyId && 
            p.id !== pupil.id && 
            (p.status === 'ACTIVE' || p.status === 'INACTIVE')
          );
        };

        const getOptimalColumnWidths = () => {
          const selectedColumns = Object.entries(columnSelection).filter(([_, selected]) => selected);
          const columnWidths: Record<string, number> = {
            pin: 8, name: 20, gender: 8, age: 6, class: 7, codes: 15, section: 10,
            status: 8, guardianContacts: 25, siblings: 15, religion: 8, photo: 8, actualPhoto: 12,
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
          if (filters.classId) {
            const className = classes.find((c: any) => c.id === filters.classId)?.name;
            if (className) filterParts.push(`Class: ${className}`);
          }
          if (filters.gender) filterParts.push(`Gender: ${filters.gender}`);
          if (filters.status) filterParts.push(`Status: ${filters.status}`);
          if (filters.section) filterParts.push(`Section: ${filters.section.charAt(0).toUpperCase() + filters.section.slice(1)}`);
          if (filters.ageRange.min > 0 || filters.ageRange.max < 100) {
            filterParts.push(`Age: ${filters.ageRange.min}-${filters.ageRange.max} years`);
          }
          if (filterParts.length === 0) return 'All pupils included';
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
                {settings.generalInfo.logo && (
                  <Image 
                    style={{ width: 60, height: 60, marginBottom: 10, alignSelf: 'center' }} 
                    src={settings.generalInfo.logo} 
                  />
                )}
                <Text style={styles.schoolName}>{settings.generalInfo.name}</Text>
                {settings.generalInfo.motto && (
                  <Text style={styles.motto}>"{settings.generalInfo.motto}"</Text>
                )}
                <Text style={styles.title}>Pupils List</Text>
              </View>



              {/* Enhanced Filter Information */}
              <View style={styles.filterInfo}>
                <Text style={styles.filterTitle}>REPORT DETAILS</Text>
                <Text style={styles.filterText}>{getFilterDescription()}</Text>
                <Text style={styles.filterText}>
                  Total pupils: {pupils.length} | Sorted by: {sortField} ({sortOrder}) | 
                  Orientation: {isLandscape ? 'Landscape' : 'Portrait'}
                </Text>
                <Text style={styles.filterText}>
                  Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()} by {currentUser.firstName} {currentUser.lastName}
                </Text>
              </View>

              {/* Modern Table with Combined Columns */}
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader} fixed>
                  {/* Student Information Column */}
                  <View style={styles.studentInfoCol}>
                    <Text style={styles.headerCell}>STUDENT INFORMATION</Text>
                  </View>
                  
                  {/* Academic Information Column */}
                  <View style={styles.academicInfoCol}>
                    <Text style={styles.headerCell}>ACADEMIC DETAILS</Text>
                  </View>
                  
                  {/* Personal Information Column */}
                  <View style={styles.personalInfoCol}>
                    <Text style={styles.headerCell}>PERSONAL INFO</Text>
                  </View>
                  
                  {/* Contact Information Column */}
                  {(columnSelection.guardianContacts || columnSelection.siblings) && (
                    <View style={styles.contactInfoCol}>
                      <Text style={styles.headerCell}>FAMILY & CONTACTS</Text>
                    </View>
                  )}
                </View>

                {/* Modern Table Body with Combined Columns */}
                {pupils.map((pupil: any, index: number) => {
                  // 🚀 OPTIMIZATION: Use Map for O(1) lookup instead of array.find() O(N)
                  const pupilClass = classesMap.get(pupil.classId);
                  const siblings = siblingsMap.get(pupil.id) || [];
                  const isEven = index % 2 === 0;

                  return (
                    <View 
                      key={pupil.id} 
                      style={[
                        styles.tableRow,
                        isEven ? styles.tableRowEven : styles.tableRowOdd
                      ]} 
                      wrap={false} 
                      minPresenceAhead={50}
                    >
                      {/* Student Information Column */}
                      <View style={styles.studentInfoCol}>
                        {/* PIN */}
                        {columnSelection.pin && (
                          <Text style={[styles.accentText, { marginBottom: 3 }]}>
                            PIN: {pupil.pupilIdentificationNumber || 'N/A'}
                          </Text>
                        )}
                        
                        {/* Full Name */}
                        {columnSelection.name && (
                          <Text style={[styles.primaryText, { marginBottom: 4 }]}>
                            {formatPupilDisplayName(pupil)}
                          </Text>
                        )}
                        
                        {/* Section */}
                        {columnSelection.section && (
                          <Text style={[styles.secondaryText, { marginTop: 2 }]}>
                            {pupil.section === 'boarding' ? 'Boarding Student' : 'Day Student'}
                          </Text>
                        )}
                      </View>
                      
                      {/* Academic Information Column */}
                      <View style={styles.academicInfoCol}>
                        {/* Class */}
                        {columnSelection.class && (
                          <Text style={styles.primaryText}>
                            Class: {pupilClass?.code || 'N/A'}
                          </Text>
                        )}
                        
                        {/* Status */}
                        {columnSelection.status && (
                          <View style={pupil.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}>
                            <Text>{pupil.status}</Text>
                          </View>
                        )}
                        

                        
                        {/* ID Codes */}
                        {columnSelection.codes && pupil.additionalIdentifiers && pupil.additionalIdentifiers.length > 0 && (
                          <View>
                            {pupil.additionalIdentifiers.slice(0, 2).map((id: any, idx: number) => (
                              <View key={idx} style={styles.codeChip}>
                                <Text>{id.idType}: {id.idValue}</Text>
                              </View>
                            ))}
                            {pupil.additionalIdentifiers.length > 2 && (
                              <Text style={styles.tertiaryText}>
                                +{pupil.additionalIdentifiers.length - 2} more codes
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                      
                      {/* Personal Information Column */}
                      <View style={styles.personalInfoCol}>
                        {/* Gender */}
                        {columnSelection.gender && (
                          <Text style={styles.secondaryText}>
                            Gender: {pupil.gender}
                          </Text>
                        )}
                        
                        {/* Age */}
                        {columnSelection.age && pupil.dateOfBirth && (
                          <Text style={styles.secondaryText}>
                            Age: {calculateAge(pupil.dateOfBirth)} years
                          </Text>
                        )}
                        
                        {/* Religion */}
                        {columnSelection.religion && (
                          <Text style={styles.tertiaryText}>
                            Religion: {pupil.religion || 'Not specified'}
                          </Text>
                        )}
                        
                        {/* Photo indicator */}
                        {columnSelection.photo && (
                          <Text style={styles.tertiaryText}>
                            Photo: {pupil.photo ? 'Available' : 'Not available'}
                          </Text>
                        )}
                        
                        {/* Actual Photo */}
                        {columnSelection.actualPhoto && pupil.photo && (
                          <View style={{ marginTop: 4, alignItems: 'center' }}>
                            <Image 
                              style={{ 
                                width: 40, 
                                height: 40, 
                                borderRadius: 4,
                                border: '1 solid #e2e8f0'
                              }} 
                              src={pupil.photo} 
                            />
                          </View>
                        )}
                        
                        {columnSelection.actualPhoto && !pupil.photo && (
                          <View style={{ 
                            marginTop: 4, 
                            alignItems: 'center',
                            width: 40,
                            height: 40,
                            backgroundColor: '#f1f5f9',
                            borderRadius: 4,
                            border: '1 solid #e2e8f0',
                            justifyContent: 'center'
                          }}>
                            <Text style={{ fontSize: 6, color: '#64748b' }}>No Photo</Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Contact Information Column */}
                      {(columnSelection.guardianContacts || columnSelection.siblings) && (
                        <View style={styles.contactInfoCol}>
                          {/* Guardian Contacts */}
                          {columnSelection.guardianContacts && pupil.guardians && (
                            <View>
                              <Text style={styles.accentText}>GUARDIANS:</Text>
                              {pupil.guardians.slice(0, 2).map((guardian: any, idx: number) => (
                                <View key={guardian.id} style={{ marginBottom: 6 }}>
                                  <Text style={styles.guardianInfo}>
                                    {guardian.firstName} {guardian.lastName} ({guardian.relationship})
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Text style={styles.tertiaryText}>
                                      Tel: {guardian.phone}
                                    </Text>
                                    {guardian.id === pupil.emergencyContactGuardianId && (
                                      <Text style={styles.emergencyTag}>EMERGENCY</Text>
                                    )}
                                  </View>
                                </View>
                              ))}
                              {pupil.guardians.length > 2 && (
                                <Text style={styles.tertiaryText}>
                                  +{pupil.guardians.length - 2} more contacts
                                </Text>
                              )}
                            </View>
                          )}
                          
                          {/* Siblings */}
                          {columnSelection.siblings && (
                            <View style={{ marginTop: columnSelection.guardianContacts ? 8 : 0 }}>
                              <Text style={styles.accentText}>SIBLINGS:</Text>
                              {siblings.length > 0 ? (
                                <View>
                                  {siblings.slice(0, 2).map((sibling: any, idx: number) => {
                                    const siblingClass = classes.find((c: any) => c.id === sibling.classId);
                                    return (
                                      <Text key={sibling.id} style={styles.siblingInfo}>
                                        • {sibling.firstName} {sibling.lastName} ({siblingClass?.code || 'N/A'})
                                      </Text>
                                    );
                                  })}
                                  {siblings.length > 2 && (
                                    <Text style={styles.tertiaryText}>
                                      +{siblings.length - 2} more siblings
                                    </Text>
                                  )}
                                </View>
                              ) : (
                                <Text style={styles.tertiaryText}>No siblings in school</Text>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Footer */}
              <Text 
                style={styles.footer} 
                fixed 
                render={({ pageNumber, totalPages }: any) => 
                  `${settings.generalInfo.name} • Page ${pageNumber} of ${totalPages} • Generated: ${new Date().toLocaleDateString()}`
                }
              />
            </Page>
          </Document>
        );
      };

      const pdfDoc = createPDFComponent({
        pupils: filteredAndSortedPupils.map(pupil => ({
          id: pupil.id,
          firstName: pupil.firstName,
          lastName: pupil.lastName,
          otherNames: pupil.otherNames,
          gender: pupil.gender,
          dateOfBirth: pupil.dateOfBirth || '',
          pupilIdentificationNumber: pupil.learnerIdentificationNumber || pupil.admissionNumber,
          classId: pupil.classId,
          photo: pupil.photo,
          status: pupil.status as 'ACTIVE' | 'INACTIVE',
          section: pupil.section as 'boarding' | 'day',
          guardians: pupil.guardians || [],
          emergencyContactGuardianId: pupil.emergencyContactGuardianId || '',
          familyId: pupil.familyId,
          currentHouse: undefined,
          religion: pupil.religion,
          additionalIdentifiers: pupil.additionalIdentifiers || []
        })),
        classes: classes.map(cls => ({
          id: cls.id,
          name: cls.name,
          code: cls.code
        })),
        filters,
        sortField,
        sortOrder,
        settings,
        currentUser,
        columnSelection
      });

      // Generate and download the PDF
      const asPdf = pdf(pdfDoc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pupils-list-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Close the modal after successful generation
      setIsColumnSelectionModalOpen(false);
      
      toast({
        title: "PDF Generated",
        description: "Pupils list has been downloaded successfully.",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-2 sm:p-6">
      {/* Background fetching indicator - Fixed at top */}
      {pupilsManager.isFetching && !isLoadingPupils && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse">
          <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]"></div>
        </div>
      )}
      
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />
      <div className="bg-white/80 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100 -mx-2 sm:-mx-6 px-2 sm:px-6 py-2 sm:py-4 mb-4 sm:mb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-bold text-indigo-900 whitespace-nowrap">Pupils</h1>
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none text-blue-500/80 group-hover:text-blue-600 transition-all duration-500 z-10">
                <MagnifyingGlass size={14} className="sm:w-4 sm:h-4" weight="duotone" />
              </div>
              <input
                type="text"
                placeholder="Search pupils..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-4 sm:pr-6 py-1.5 sm:py-2 text-sm bg-white/90 rounded-full focus:ring-2 focus:ring-blue-400/50 focus:outline-none shadow-sm hover:shadow-md transition-all duration-500 ease-in-out placeholder:text-gray-400 placeholder:text-sm"
                style={{
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(226, 232, 240, 0.5)",
                  border: "none"
                }}
              />
            </div>
            
            {/* Class Selector for Fast Filtering */}
            <div className="flex-shrink-0">
              <ClassSelector
                selectedClassId={selectedClassId}
                onClassChange={handleClassChange}
                placeholder="Select class"
                size="sm"
                className="min-w-[140px] sm:min-w-[160px]"
                includeAllOption={true}
                allOptionLabel="All Classes"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setIsColumnSelectionModalOpen(true)}
                className="p-2 sm:p-2.5 text-indigo-700 hover:text-blue-600 hover:bg-blue-50/80 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                style={{
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(226, 232, 240, 0.5)",
                }}
                title="Print List"
              >
                <Printer size={16} className="sm:w-5 sm:h-5" weight="duotone" />
              </button>
              <button 
                onClick={exportToExcel}
                className="p-2 sm:p-2.5 text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl"
                title="Export to Excel"
              >
                <Printer size={16} className="sm:w-5 sm:h-5" weight="duotone" />
              </button>
              <ActionGuard module="pupils" page="create" action="access_page">
                <button 
                  onClick={() => router.push('/pupils/new')}
                  className="p-2 sm:p-2.5 text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl"
                  title="Add New Pupil"
                >
                  <Plus size={16} className="sm:w-5 sm:h-5" weight="duotone" />
                </button>
              </ActionGuard>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-1 sm:px-0">
        {/* Compact Filter Panel */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-sm border border-blue-100/50 mb-4 sm:mb-6 overflow-hidden">
          <div className="px-2 sm:px-4 py-2 sm:py-3">
            {/* Single Row: Stats and Controls */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
              {/* Statistics Pills */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-green-50 rounded-full border border-green-100">
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-green-700 font-medium">{pupils.filter(p => p.status === 'Active').length}</span>
                  <span className="text-xs text-green-600">Active</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-red-50 rounded-full border border-red-100">
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-red-500"></div>
                  <span className="text-xs text-red-700 font-medium">{pupils.filter(p => p.status === 'Inactive').length}</span>
                  <span className="text-xs text-red-600">Inactive</span>
                </div>
                {Object.entries(filters).some(([key, value]) => {
                  if (key === 'ageRange') return value.min > 0 || value.max < 100;
                  return !!value;
                }) && (
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-blue-50 rounded-full border border-blue-100">
                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-blue-600 font-medium">Filtered</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                {Object.entries(filters).some(([key, value]) => {
                  if (key === 'ageRange') return value.min > 0 || value.max < 100;
                  return !!value;
                }) && (
                  <button
                    onClick={() => setFilters({
                      classId: '',
                      gender: '',
                      status: 'Active',
                      section: '',
                      houseId: '',
                      ageRange: { min: 0, max: 100 }
                    })}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full border border-red-100 transition-all duration-200 hover:scale-105"
                  >
                    <X size={10} className="sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
                <button
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-100 transition-all duration-200 hover:scale-105"
                >
                  <FunnelSimple size={10} className="sm:w-3 sm:h-3" weight="duotone" />
                  {isFiltersExpanded ? 'Hide' : 'Filter'}
                </button>
              </div>
            </div>

            {/* Expandable Filter Controls */}
            {isFiltersExpanded && (
              <div className="border-t border-blue-50 pt-2 sm:pt-3 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                  {/* Class Filter */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-700">Class</label>
                    <select
                      value={filters.classId}
                      onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value }))}
                      className="w-full rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1.5 sm:px-2.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white"
                    >
                      <option value="">All Classes</option>
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
                      <option value="">All Sections</option>
                      <option value="Boarding">Boarding</option>
                      <option value="Day">Day</option>
                    </select>
                  </div>

                  {/* Gender Filter */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-700">Gender</label>
                    <select
                      value={filters.gender}
                      onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1.5 sm:px-2.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white"
                    >
                      <option value="">All Genders</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
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
                      <option value="">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Graduated">Graduated</option>
                      <option value="Transferred">Transferred</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </select>
                  </div>

                  {/* Age Range Filter */}
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-blue-700">Age Range</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max={filters.ageRange.max}
                        value={filters.ageRange.min}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          ageRange: { ...prev.ageRange, min: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-10 sm:w-12 rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1 sm:px-1.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white text-center"
                        placeholder="0"
                      />
                      <span className="text-xs text-blue-400 font-medium">-</span>
                      <input
                        type="number"
                        min={filters.ageRange.min}
                        value={filters.ageRange.max}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          ageRange: { ...prev.ageRange, max: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-10 sm:w-12 rounded-lg border-0 bg-blue-50/50 py-1 sm:py-1.5 px-1 sm:px-1.5 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white transition-all duration-200 hover:bg-white text-center"
                        placeholder="100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Optimization messages hidden per user request */}

        {/* Class selector is now in header - no separate selection prompt needed */}
        {isLoadingPupils || isLoadingClasses || isLoadingSettings ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-indigo-600">
              Loading pupils and school information...
            </span>
          </div>
        ) : filteredAndSortedPupils.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-12 text-center">
            <p className="text-indigo-500">No pupils found</p>
        </div>
      ) : (
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-indigo-100">
                <thead className="bg-gradient-to-r from-indigo-50 to-white">
                  <tr>
                    <th 
                      className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider cursor-pointer hover:text-indigo-700 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <span className="hidden sm:inline">Pupil Info</span>
                      <span className="sm:hidden">Pupil</span>
                      {getSortIcon('name')}
                    </th>
                    <th 
                      className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider cursor-pointer hover:text-indigo-700 transition-colors"
                      onClick={() => handleSort('class')}
                    >
                      Class & Section {getSortIcon('class')}
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">
                      Codes
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-indigo-500 uppercase tracking-wider">
                      Family
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-indigo-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-indigo-100">
                  {filteredAndSortedPupils.map((pupil) => {
                    const pupilHouse = getPupilHouse(pupil);
                    return (
                      <tr key={pupil.id} className={`hover:bg-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-50 transition-colors`}>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="relative flex-shrink-0">
                              <Link 
                                href={`/pupil-detail?id=${pupil.id}`}
                                className={`block h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-100 overflow-hidden ring-2 ring-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-100 hover:ring-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-300 transition-all flex-shrink-0`}
                              >
                    {pupil.photo ? (
                                  <img 
                        src={pupil.photo} 
                                                  alt={formatPupilDisplayName(pupil)} 
                                    className="h-full w-full object-cover"
                      />
                    ) : (
                                  <div className={`h-full w-full flex items-center justify-center text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-500 text-xs sm:text-sm font-medium`}>
                                    {pupil.firstName[0]}
                                    {pupil.lastName[0]}
                      </div>
                    )}
                    </Link>
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link 
                                href={`/pupil-detail?id=${pupil.id}`}
                                className={`text-xs sm:text-sm font-medium text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-800 transition-colors block truncate`}
                              >
                                {formatPupilDisplayName(pupil)}
                              </Link>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-gray-500">
                                <span className="truncate">{pupil.learnerIdentificationNumber || pupil.admissionNumber}</span>
                                <span className="hidden sm:inline">•</span>
                                <div className="flex items-center gap-2">
                                <span>{pupil.gender}</span>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                    pupil.status === 'Active' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {pupil.status}
                                  </span>
                                </div>
                                {pupil.dateOfBirth && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span>{calculateAgeAbbreviated(pupil.dateOfBirth)}</span>
                                  </>
                                )}
                              </div>
                              {/* Mobile-only class info */}
                              <div className="sm:hidden mt-1">
                                <div className="flex items-center gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className={`text-xs text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:underline transition-colors font-medium text-left`}>
                                        {classes.find(c => c.id === pupil.classId)?.name || 'N/A'}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Class Options</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => {
                                        router.push(`/class-detail?id=${pupil.classId}`);
                                      }}>
                                        <Settings className="mr-2 h-4 w-4 text-blue-600" />
                                        View Class Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handlePupilClassChange(pupil)}>
                                        <Edit className="mr-2 h-4 w-4 text-orange-600" />
                                        Change Class
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <span className="text-xs text-gray-400">•</span>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className={`text-xs text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:underline transition-colors font-medium text-left`}>
                                        {pupil.section}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40">
                                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Change Section</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handlePupilSectionChange(pupil, 'Day')}
                                        className={pupil.section === 'Day' ? 'bg-blue-50' : ''}
                                      >
                                        <svg className="mr-2 h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        Day
                                        {pupil.section === 'Day' && <span className="ml-auto text-blue-600">✓</span>}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handlePupilSectionChange(pupil, 'Boarding')}
                                        className={pupil.section === 'Boarding' ? 'bg-purple-50' : ''}
                                      >
                                        <svg className="mr-2 h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                        Boarding
                                        {pupil.section === 'Boarding' && <span className="ml-auto text-purple-600">✓</span>}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <span className="text-xs text-gray-400">•</span>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className={`text-xs text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:underline transition-colors font-medium text-left`}>
                                        Family
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Family Information</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setSelectedPupilGuardians({
                                        pupilName: formatPupilDisplayName(pupil),
                                        guardians: pupil.guardians || [],
                                        emergencyContactId: pupil.emergencyContactGuardianId || ''
                                      })}>
                                        <svg className="mr-2 h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Guardians ({pupil.guardians?.length || 0})
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        const siblings = getSiblings(pupil);
                                        setSelectedPupilSiblings({
                                          pupilName: formatPupilDisplayName(pupil),
                                          siblings
                                        });
                                      }}>
                                        <svg className="mr-2 h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        Siblings ({getSiblings(pupil).length})
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3">
                          <div className="text-sm">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={`text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:underline transition-colors font-medium text-left`}>
                              {classes.find(c => c.id === pupil.classId)?.name || 'N/A'}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-48">
                                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Class Options</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  router.push(`/class-detail?id=${pupil.classId}`);
                                }}>
                                  <Settings className="mr-2 h-4 w-4 text-blue-600" />
                                  View Class Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePupilClassChange(pupil)}>
                                  <Edit className="mr-2 h-4 w-4 text-orange-600" />
                                  Change Class
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="mt-0.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="text-xs text-gray-500 capitalize hover:text-indigo-600 hover:underline transition-colors text-left block">
                                    {pupil.section} Scholar
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-40">
                                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Change Section</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handlePupilSectionChange(pupil, 'Day')}
                                    className={pupil.section === 'Day' ? 'bg-blue-50' : ''}
                                  >
                                    <svg className="mr-2 h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    Day Scholar
                                    {pupil.section === 'Day' && <span className="ml-auto text-blue-600">✓</span>}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handlePupilSectionChange(pupil, 'Boarding')}
                                    className={pupil.section === 'Boarding' ? 'bg-purple-50' : ''}
                                  >
                                    <svg className="mr-2 h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    Boarding Scholar
                                    {pupil.section === 'Boarding' && <span className="ml-auto text-purple-600">✓</span>}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3">
                          <div className="text-sm">
                            {pupil.additionalIdentifiers && pupil.additionalIdentifiers.length > 0 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="text-left text-indigo-900 hover:text-indigo-600 transition-colors font-medium">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{pupil.additionalIdentifiers.length} code{pupil.additionalIdentifiers.length !== 1 ? 's' : ''}</span>
                                      <span className="text-xs text-gray-500 truncate max-w-32">
                                        {pupil.additionalIdentifiers[0].idType}: {pupil.additionalIdentifiers[0].idValue}
                                        {pupil.additionalIdentifiers.length > 1 && '...'}
                                      </span>
                                    </div>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-64">
                                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                                    ID Codes ({pupil.additionalIdentifiers.length})
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {pupil.additionalIdentifiers.map((identifier, index) => (
                                    <DropdownMenuItem key={index} className="flex flex-col items-start">
                                      <span className="font-medium text-xs text-indigo-600">{identifier.idType}</span>
                                      <span className="text-xs text-gray-700 font-mono">{identifier.idValue}</span>
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleManageIdCodes(pupil)}>
                                    <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                                    Manage Codes
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <button 
                                onClick={() => handleManageIdCodes(pupil)}
                                className="text-gray-400 hover:text-indigo-600 transition-colors text-xs"
                              >
                                <div className="flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" />
                                  <span>Add codes</span>
                                </div>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`text-left text-sm hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 transition-colors font-medium`}>
                            {(() => {
                                  const guardianCount = pupil.guardians?.length || 0;
                                  const siblings = getSiblings(pupil);
                                  const siblingCount = siblings.length;
                                  
                                  if (guardianCount === 0 && siblingCount === 0) {
                                    return <span className="text-gray-500">No family info</span>;
                                  }
                                  
                                  return (
                    <div className="flex flex-col">
                                      <span className="font-medium text-indigo-900">Family</span>
                                  <span className="text-xs text-gray-500">
                                        {guardianCount} guardian{guardianCount !== 1 ? 's' : ''} • {siblingCount} sibling{siblingCount !== 1 ? 's' : ''}
                                  </span>
                    </div>
                              );
                            })()}
                          </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Family Information</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setSelectedPupilGuardians({
                                pupilName: formatPupilDisplayName(pupil),
                                guardians: pupil.guardians || [],
                                emergencyContactId: pupil.emergencyContactGuardianId || ''
                              })}>
                                <svg className="mr-2 h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                View Guardians ({pupil.guardians?.length || 0})
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                              const siblings = getSiblings(pupil);
                              setSelectedPupilSiblings({
                                pupilName: formatPupilDisplayName(pupil),
                                siblings
                              });
                              }}>
                                <svg className="mr-2 h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                View Siblings ({getSiblings(pupil).length})
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-indigo-500 uppercase tracking-wider">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                              <button className={`text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 transition-colors font-medium`}>
                                Actions
                              </button>
                      </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Pupil Management</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                window.location.href = `/pupils/edit?id=${pupil.id}`;
                              }}>
                                <Edit className="mr-2 h-4 w-4 text-blue-600" />
                                Edit Pupil Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(pupil)}>
                                <Shield className="mr-2 h-4 w-4 text-orange-600" />
                                Change Status
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleManageIdCodes(pupil)}>
                                <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                                Manage ID Codes
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRegisterSibling(pupil)}>
                                <UserPlus className="mr-2 h-4 w-4 text-green-600" />
                                Register New Sibling
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleLinkSiblings(pupil)}>
                                <UserPlus className="mr-2 h-4 w-4 text-blue-600" />
                                Link Existing as Sibling
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeletePupil(pupil)}>
                                <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                                Delete Pupil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 🚀 PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-white">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Page Info */}
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium text-indigo-600">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                    <span className="font-medium text-indigo-600">{Math.min(currentPage * itemsPerPage, totalFilteredCount)}</span> of{' '}
                    <span className="font-medium text-indigo-600">{totalFilteredCount}</span> pupils
                  </div>

                  {/* Page Controls */}
                  <div className="flex items-center gap-2">
                    {/* Items per page */}
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1.5 text-sm border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400/50 focus:outline-none"
                    >
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                      <option value={200}>200 per page</option>
                    </select>

                    {/* Pagination buttons */}
                    <div className="flex items-center gap-1">
                      {/* First page */}
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="First page"
                      >
                        ««
                      </button>

                      {/* Previous page */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Previous page"
                      >
                        «
                      </button>

                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-indigo-600 hover:bg-indigo-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      {/* Next page */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Next page"
                      >
                        »
                      </button>

                      {/* Last page */}
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Last page"
                      >
                        »»
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      {/* Modals should be inside this div, but after the main content mapping */}
    {/* Guardian Information Modal */}
    <ModernDialog 
      open={selectedPupilGuardians !== null} 
      onOpenChange={() => setSelectedPupilGuardians(null)}
    >
      <ModernDialogContent size="lg">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center">
            <svg className="mr-2 h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Guardian Information - {selectedPupilGuardians?.pupilName}
            </ModernDialogTitle>
            <ModernDialogDescription>
            View guardian details and emergency contact information for this pupil.
            </ModernDialogDescription>
          </ModernDialogHeader>
          
        <div className="space-y-4">
          {selectedPupilGuardians?.guardians && selectedPupilGuardians.guardians.length > 0 ? (
            selectedPupilGuardians.guardians.map((guardian, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">{guardian.firstName} {guardian.lastName}</h4>
                  {guardian.id === selectedPupilGuardians?.emergencyContactId && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Emergency Contact
                    </span>
                  )}
            </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Relationship:</span>
                    <span className="ml-2">{guardian.relationship}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Phone:</span>
                    <span className="ml-2">
                      {guardian.phone ? (
                        <a 
                          href={`tel:${guardian.phone}`}
                          className="text-primary hover:underline font-medium cursor-pointer"
                        >
                          {guardian.phone}
                        </a>
                      ) : (
                        guardian.phone
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Email:</span>
                    <span className="ml-2">{guardian.email || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Occupation:</span>
                    <span className="ml-2">{guardian.occupation || 'Not provided'}</span>
                  </div>
                  {guardian.address && (
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-600">Address:</span>
                      <span className="ml-2">{guardian.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No guardian information available for this pupil.
              </div>
            )}
          </div>

        <ModernDialogFooter>
          <Button variant="outline" onClick={() => setSelectedPupilGuardians(null)}>
            Close
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

    {/* Siblings Information Modal */}
    <ModernDialog 
      open={selectedPupilSiblings !== null} 
      onOpenChange={() => setSelectedPupilSiblings(null)}
    >
      <ModernDialogContent size="lg">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center">
            <svg className="mr-2 h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Siblings - {selectedPupilSiblings?.pupilName}
            </ModernDialogTitle>
            <ModernDialogDescription>
            View sibling information for this pupil.
            </ModernDialogDescription>
          </ModernDialogHeader>
          
        <div className="space-y-4">
          {selectedPupilSiblings?.siblings && selectedPupilSiblings.siblings.length > 0 ? (
            selectedPupilSiblings.siblings.map((sibling, index) => (
              <Link key={index} href={`/pupil-detail?id=${sibling.id}`}>
                <div className="border rounded-lg p-4 space-y-2 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10 group-hover:ring-2 group-hover:ring-blue-300 transition-all duration-200">
                      {sibling.photo && sibling.photo.trim() !== '' && sibling.photo.startsWith('http') ? (
                        <AvatarImage 
                          src={sibling.photo} 
                          alt={`${sibling.firstName} ${sibling.lastName}`}
                          onError={(e) => {
                            console.log('Sibling avatar image failed to load:', sibling.photo);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                        {sibling.firstName.charAt(0)}{sibling.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">{formatPupilDisplayName(sibling)}</h4>
                      <p className="text-sm text-gray-600">{sibling.admissionNumber}</p>
    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Eye className="w-4 h-4 text-blue-500" />
          </div>
        </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Class:</span>
                      <span className="ml-2">{classes.find(c => c.id === sibling.classId)?.name || 'N/A'}</span>
                      </div>
                    <div>
                      <span className="font-medium text-gray-600">Section:</span>
                      <span className="ml-2 capitalize">{sibling.section}</span>
                      </div>
                    <div>
                      <span className="font-medium text-gray-600">Status:</span>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        sibling.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : sibling.status === 'Inactive'
                          ? 'bg-red-100 text-red-800'
                          : sibling.status === 'Graduated'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sibling.status || 'Unknown'}
                      </span>
                    </div>
                      </div>
                      </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              No siblings found for this pupil.
              </div>
            )}
          </div>
        
        <ModernDialogFooter>
          <Button variant="outline" onClick={() => setSelectedPupilSiblings(null)}>
            Close
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>

    {/* Status Change Modal */}
    <ModernDialog 
      open={statusChangeModal.isOpen} 
      onOpenChange={() => setStatusChangeModal({ isOpen: false, pupil: null })}
    >
      <ModernDialogContent size="md" open={statusChangeModal.isOpen} onOpenChange={() => setStatusChangeModal({ isOpen: false, pupil: null })}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5 text-orange-600" />
            Change Pupil Status
          </ModernDialogTitle>
          <ModernDialogDescription>
            Change {statusChangeModal.pupil?.firstName} {statusChangeModal.pupil?.lastName}'s status from <strong>{statusChangeModal.pupil?.status}</strong> to a new status.
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

          {/* Class selection if changing to Active */}
          {showClassSelection && (
            <div className="space-y-2">
              <Label htmlFor="class-select">Select Class (Required for Active Status)</Label>
              <Select value={selectedClassIdForStatus} onValueChange={setSelectedClassIdForStatus}>
                <SelectTrigger id="class-select">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <ModernDialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStatusChangeModal({ isOpen: false, pupil: null })}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmStatusChange}
            disabled={!selectedStatus || (showClassSelection && !selectedClassId)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Shield className="mr-2 h-4 w-4" />
            Update Status
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>

    {/* Class Change Modal */}
    <ModernDialog 
      open={classChangeModal.isOpen} 
      onOpenChange={() => setClassChangeModal({ isOpen: false, pupil: null })}
    >
      <ModernDialogContent open={classChangeModal.isOpen} onOpenChange={() => setClassChangeModal({ isOpen: false, pupil: null })}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center">
            <Edit className="mr-2 h-5 w-5 text-orange-600" />
            Change Class - {classChangeModal.pupil?.firstName} {classChangeModal.pupil?.lastName}
          </ModernDialogTitle>
          <ModernDialogDescription>
            Select a new class for this pupil. This will update their class assignment and create a promotion history record.
          </ModernDialogDescription>
        </ModernDialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-class">Current Class</Label>
            <div className="p-3 bg-gray-50 rounded-md border">
              <span className="font-medium text-gray-900">
                {getClassName(classChangeModal.pupil?.classId)} - {classChangeModal.pupil?.section} Section
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-class">New Class *</Label>
            <Select value={selectedNewClassId} onValueChange={setSelectedNewClassId}>
              <SelectTrigger id="new-class">
                <SelectValue placeholder="Select new class" />
              </SelectTrigger>
              <SelectContent>
                {classes
                  .filter(cls => cls.id !== classChangeModal.pupil?.classId)
                  .map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.code})
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          
          {selectedNewClassId && selectedNewClassId !== classChangeModal.pupil?.classId && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Class Change Summary</p>
                  <p className="text-blue-800 mt-1">
                    Moving from <span className="font-medium">{getClassName(classChangeModal.pupil?.classId)}</span> to <span className="font-medium">{getClassName(selectedNewClassId)}</span>
                  </p>
                  <p className="text-blue-700 mt-2 text-xs">
                    This action will create a promotion history record for tracking purposes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <ModernDialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setClassChangeModal({ isOpen: false, pupil: null })}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmClassChange}
            disabled={!selectedNewClassId || selectedNewClassId === classChangeModal.pupil?.classId}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Edit className="mr-2 h-4 w-4" />
            Change Class
          </Button>
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>

    {/* ID Codes Management Modal */}
    <ManageIdCodesModal 
      isOpen={isManageIdCodesModalOpen}
      onClose={() => {
        setIsManageIdCodesModalOpen(false);
        setSelectedPupilForIdCodes(null);
      }}
      onSave={handleSaveIdCodes}
      existingIdentifiers={selectedPupilForIdCodes?.additionalIdentifiers || []}
      pupilName={selectedPupilForIdCodes ? `${selectedPupilForIdCodes.firstName} ${selectedPupilForIdCodes.lastName}` : ''}
    />

    {/* Link Siblings Modal */}
    {selectedPupilForLinking && (
      <LinkSiblingsModal
        isOpen={isLinkSiblingsModalOpen}
        onClose={() => {
          setIsLinkSiblingsModalOpen(false);
          setSelectedPupilForLinking(null);
        }}
        sourcePupil={selectedPupilForLinking}
        onSuccess={handleLinkingSuccess}
      />
    )}

    {/* Column Selection and PDF Generation Modal */}
    <ModernDialog 
      open={isColumnSelectionModalOpen} 
      onOpenChange={() => setIsColumnSelectionModalOpen(false)}
    >
      <ModernDialogContent size="lg" open={isColumnSelectionModalOpen} onOpenChange={() => setIsColumnSelectionModalOpen(false)}>
        <ModernDialogHeader>
          <ModernDialogTitle className="flex items-center">
            <Printer className="mr-2 h-5 w-5 text-indigo-600" />
            Print Pupils List - Select Columns
          </ModernDialogTitle>
          <ModernDialogDescription>
            Choose which data columns to include in your PDF. More columns may require landscape orientation.
          </ModernDialogDescription>
        </ModernDialogHeader>
        
        <div className="space-y-6">
          {/* Column Selection Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700 border-b border-gray-200 pb-1">Basic Info</h4>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.pin}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, pin: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">PIN/ID Number</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.name}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, name: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Full Name</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.age}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, age: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Age</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.gender}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, gender: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Gender</span>
              </label>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700 border-b border-gray-200 pb-1">Academic</h4>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.class}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, class: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Class (Code)</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.codes}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, codes: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">ID Codes</span>
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
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.status}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, status: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Status</span>
              </label>
              

            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700 border-b border-gray-200 pb-1">Family & Contact</h4>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.guardianContacts}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, guardianContacts: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Guardian Contacts</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.siblings}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, siblings: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Siblings</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.religion}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, religion: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Religion</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.photo}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, photo: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Photo Status</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columnSelection.actualPhoto}
                  onChange={(e) => setColumnSelection(prev => ({ ...prev, actualPhoto: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Actual Photo</span>
              </label>
            </div>
          </div>

          {/* Quick Selection Buttons */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setColumnSelection({
                  pin: true,
                  name: true,
                  gender: true,
                  age: true,
                  class: true,
                  codes: false,
                  section: false,
                  status: true,
                  guardianContacts: false,
                  siblings: false,
                  religion: false,
                  photo: false,
                  actualPhoto: false
                })}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                Basic Info
              </button>
              
              <button
                onClick={() => setColumnSelection({
                  pin: true,
                  name: true,
                  gender: true,
                  age: true,
                  class: true,
                  codes: true,
                  section: true,
                  status: true,
                  guardianContacts: true,
                  siblings: false,
                  religion: false,
                  photo: false,
                  actualPhoto: false
                })}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
              >
                Standard Report
              </button>
              
              <button
                onClick={() => setColumnSelection({
                  pin: true,
                  name: true,
                  gender: true,
                  age: true,
                  class: true,
                  codes: true,
                  section: true,
                  status: true,
                  guardianContacts: true,
                  siblings: true,
                  religion: false,
                  photo: false,
                  actualPhoto: true
                })}
                className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
              >
                Complete Info
              </button>
              
              <button
                onClick={() => setColumnSelection({
                  pin: false,
                  name: false,
                  gender: false,
                  age: false,
                  class: false,
                  codes: false,
                  section: false,
                  status: false,
                  guardianContacts: false,
                  siblings: false,
                  religion: false,
                  photo: false,
                  actualPhoto: false
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
                  Pupils to include: {filteredAndSortedPupils.length} | 
                  Orientation: {(() => {
                    const selectedColumns = Object.entries(columnSelection).filter(([_, selected]) => selected);
                    const heavyColumns = ['name', 'guardianContacts', 'siblings'];
                    const hasHeavyColumns = selectedColumns.some(([column]) => heavyColumns.includes(column));
                    return selectedColumns.length > 6 || hasHeavyColumns ? 'Landscape' : 'Portrait';
                  })()}
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

        <ModernDialogFooter>
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
        </ModernDialogFooter>
      </ModernDialogContent>
    </ModernDialog>
    </div>
  );
}

export default function PupilsPage() {
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
        <div className="bg-white/80 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-indigo-100 -mx-6 px-6 py-4 mb-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-xl font-bold text-indigo-900">🚀 Loading Pupils...</h1>
            <p className="text-sm text-gray-600 mt-1">Setting up class-based loading for better performance</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600">Initializing pupils management...</span>
        </div>
      </div>
    }>
      <PupilsContent />
    </Suspense>
  );
}
