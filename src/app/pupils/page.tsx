"use client";

import React, { useState, useMemo, useEffect, useRef, useTransition, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, PencilSimple, Trash, Power, FunnelSimple, CaretUp, CaretDown, X, Printer, ChartLine, DotsThree, MagnifyingGlass, Users } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { GlassActionButton, GlassActionDock, GlassPageSearchInput, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { useToast } from '@/hooks/use-toast';
import { useDeletePupil, useUpdatePupil, usePupils, usePupilPhotos, pupilsKeys } from '@/lib/hooks/use-pupils';
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
import { Input } from "@/components/ui/input";
import { Shield, Loader2, Edit, Settings, ChevronDown, ChevronRight, UserPlus, CreditCard, Eye, Trash2, User, Clock, Tag, Download, DollarSign, ArrowRight, Receipt, Users as LucideUsers } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState as useReactState } from 'react';
import type { Pupil, Guardian, Class, PupilStatus, AdditionalIdentifier } from '@/types';
import { Suspense } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { HousesService } from "@/lib/services/houses.service";
import type { House } from "@/types";
import { ManageIdCodesModal } from '@/components/pupils/manage-id-codes-modal';
import { ManagePayCodeModal } from '@/components/pupils/manage-pay-code-modal';
import { LinkSiblingsModal } from '@/components/pupils/link-siblings-modal';
import { ActionGuard } from "@/components/auth/action-guard";
import { PupilTableRowSkeleton } from '@/components/pupils/PupilTableRowSkeleton';
import { usePermissions } from "@/lib/hooks/use-permissions";
import dynamic from 'next/dynamic';
import { formatPupilDisplayName, sortPupilsByName } from '@/lib/utils/name-formatter';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';
import { ExportConfigModal, type ExportConfig } from '@/components/pupils/ExportConfigModal';
import { PupilPhotoDetail } from '@/components/ui/pupil-photo-detail';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { getSchoolPayCode } from '@/lib/utils/schoolpay';
import { getPupilClassDisplay } from '@/lib/utils/class-streams';

// Define interfaces
interface ColumnSelection {
  pin: boolean;
  name: boolean;
  gender: boolean;
  age: boolean;
  dateOfBirth: boolean;
  class: boolean;
  house: boolean;
  payCode: boolean;
  lin: boolean;
  indexNumber: boolean;
  codes: boolean;
  section: boolean;
  status: boolean;
  guardianContacts: boolean;
  siblings: boolean;
  religion: boolean;
  photo: boolean;
  actualPhoto: boolean;
  admissionNumber?: boolean;
}

interface PrintLayoutOptions {
  orientation: 'auto' | 'portrait' | 'landscape';
  grayscale: boolean;
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

const normalizeGuardianIdentity = (value?: string) =>
  (value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const getGuardianIdentityKeys = (guardian: Guardian) => {
  const keys = new Set<string>();
  const id = normalizeGuardianIdentity(guardian.id);
  const phone = normalizeGuardianIdentity(guardian.phone);
  const secondaryPhone = normalizeGuardianIdentity(guardian.secondaryPhone);
  const nationalId = normalizeGuardianIdentity(guardian.nationalId);
  const email = normalizeGuardianIdentity(guardian.email);
  const name = normalizeGuardianIdentity(`${guardian.firstName || ''}${guardian.lastName || ''}`);

  if (id) keys.add(`id:${id}`);
  if (phone) keys.add(`phone:${phone}`);
  if (secondaryPhone) keys.add(`phone:${secondaryPhone}`);
  if (nationalId) keys.add(`national-id:${nationalId}`);
  if (email) keys.add(`email:${email}`);
  if (name) keys.add(`name:${name}`);

  return keys;
};

const pupilsShareGuardian = (left: Pupil, right: Pupil) => {
  const leftGuardians = left.guardians || [];
  const rightGuardians = right.guardians || [];
  if (leftGuardians.length === 0 || rightGuardians.length === 0) return false;

  const leftKeys = new Set<string>();
  leftGuardians.forEach((guardian) => {
    getGuardianIdentityKeys(guardian).forEach((key) => leftKeys.add(key));
  });

  return rightGuardians.some((guardian) =>
    Array.from(getGuardianIdentityKeys(guardian)).some((key) => leftKeys.has(key)),
  );
};

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
  hasCodeType?: string;
  hasCodeFilterType?: 'with' | 'without';
  photoFilter: 'all' | 'with' | 'without';
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
    ageRange: { min: 0, max: 100 },
    hasCodeType: '',
    hasCodeFilterType: 'with',
    photoFilter: 'all',
  });

  // Update filters when URL parameters change (e.g., when navigating from dashboard cards)
  useEffect(() => {
    const genderParam = searchParams?.get('gender');
    const statusParam = searchParams?.get('status');

    setFilters(prev => ({
      ...prev,
      gender: genderParam || '',
      status: statusParam || 'Active'
    }));
  }, [searchParams]);

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
    pupil: Pupil;
    pupilName: string;
    guardians: Guardian[];
    emergencyContactId: string;
  } | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isExportConfigModalOpen, setIsExportConfigModalOpen] = useState(false);
  const [selectedPupilSiblings, setSelectedPupilSiblings] = useState<{
    pupil: Pupil;
    pupilName: string;
    siblings: Pupil[];
  } | null>(null);
  const [expandedFamilyPupilId, setExpandedFamilyPupilId] = useState<string | null>(null);
  const [selectedFamilyPupil, setSelectedFamilyPupil] = useState<Pupil | null>(null);
  const [unlinkSiblingConfirm, setUnlinkSiblingConfirm] = useState<{
    siblingToUnlink: Pupil;
    remainingSiblings: Pupil[];
    viewedPupilName: string;
  } | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // Add column selection state with default values
  const [columnSelection, setColumnSelection] = useState<ColumnSelection>({
    name: true,
    age: true,
    dateOfBirth: false,
    gender: true,
    class: true,
    section: true,
    siblings: true,
    status: true,
    house: true,
    payCode: false,
    lin: false,
    indexNumber: false,
    codes: true,
    actualPhoto: true,
    guardianContacts: true,
    pin: true, // Restored missing field
    religion: false, // Restored missing field
    photo: false, // Restored missing field
  });
  const [printLayoutOptions, setPrintLayoutOptions] = useState<PrintLayoutOptions>({
    orientation: 'auto',
    grayscale: true,
  });

  const [selectedPupilPhotoForDetails, setSelectedPupilPhotoForDetails] = useState<Pupil | null>(null);
  const [isExpandedPhotoOpen, setIsExpandedPhotoOpen] = useState(false);

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

  // Add state for Pay Code modal
  const [isManagePayCodeModalOpen, setIsManagePayCodeModalOpen] = useState(false);
  const [selectedPupilForPayCode, setSelectedPupilForPayCode] = useState<Pupil | null>(null);

  // Add state for link siblings modal
  const [isLinkSiblingsModalOpen, setIsLinkSiblingsModalOpen] = useState(false);
  const [selectedPupilForLinking, setSelectedPupilForLinking] = useState<Pupil | null>(null);

  // PDF Viewer hook
  const pdfViewer = usePDFViewer();

  // Add state for edit name modal
  const [editNameModal, setEditNameModal] = useState<{
    isOpen: boolean;
    pupil: Pupil | null;
  }>({
    isOpen: false,
    pupil: null
  });
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editOtherNames, setEditOtherNames] = useState('');

  // 🚀 INFINITE SCROLL: Reveal rows in batches of 50 as the user scrolls
  const BATCH_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLTableRowElement>(null);

  // 🚀 OPTIMIZED: Get all pupils from cache immediately for search functionality
  // This allows search to work instantly even when no class is selected
  // The dashboard already loaded this data, so it's cached and instant!
  const { data: allCachedPupils = [], isLoading: isLoadingAllPupils } = usePupils();

  // 🔍 DEBUG: Log when cached pupils are available
  React.useEffect(() => {
    if (allCachedPupils.length > 0) {
      console.log('✅ PUPILS LIST: Cached pupils available instantly:', allCachedPupils.length, 'pupils');
    }
  }, [allCachedPupils.length]);

  // 🚀 OPTIMIZED: Use manager only for class selection UI, not for data loading
  // We use cached pupils for instant display instead
  // Pass empty string to disable initial query - manager won't load when classId is empty
  const pupilsManager = useClassPupilsManager(''); // Empty string = no query, we use cached pupils instead
  const {
    filteredPupils: classPupils = [],
    isLoading: isLoadingClassPupils,
    isFetching: isFetchingPupils,
    error,
    selectedClassId,
    handleClassChange,
    filters: pupilFilters,
    handleFilterChange,
    resetFilters,
    handleSearch: classHandleSearch,
    searchQuery: classSearchQuery,
    clearSearch,
    totalCount,
    classCount,
    statistics
  } = pupilsManager;

  // 🚀 INSTANT SEARCH: Use cached data when no class is selected
  // This makes search work immediately using cached data from dashboard
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [isMobileTopBarSearchOpen, setIsMobileTopBarSearchOpen] = useState(false);
  const mobileTopBarSearchInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isMobileTopBarSearchOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      mobileTopBarSearchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [isMobileTopBarSearchOpen]);

  // 🚀 OPTIMIZED: Always use cached pupils for instant display, filter client-side
  // This is MUCH faster than waiting for class-based queries
  const pupils = useMemo(() => {
    // Always use cached pupils - filter by class if selected (instant client-side filtering)
    if (selectedClassId && selectedClassId !== '' && selectedClassId !== 'all') {
      // Filter cached pupils by class instantly (no database query needed)
      return allCachedPupils.filter(p => p.classId === selectedClassId);
    } else {
      // Use all cached pupils when no class is selected or "all" is selected
      return allCachedPupils;
    }
  }, [selectedClassId, allCachedPupils]);

  // 🚀 OPTIMIZED: Use local search for all cases - simpler and faster
  // No need to use class manager's search since we're using cached pupils
  const searchQuery = localSearchQuery;

  // Search handler - always use local search
  const handleSearch = useCallback((query: string) => {
    setLocalSearchQuery(query);
  }, []);

  // Notification links can open this list with an intentional search and
  // filter state already applied. Apply each URL state once: class selection
  // from the dropdown must never be reset just because /pupils has no classId.
  const appliedPupilsUrlStateRef = useRef<string | null>(null);
  useEffect(() => {
    const urlStateKey = searchParams?.toString() || '';
    if (appliedPupilsUrlStateRef.current === urlStateKey) return;
    appliedPupilsUrlStateRef.current = urlStateKey;

    const linkedClassId = searchParams?.get('classId');
    const linkedSearch = searchParams?.get('q') || '';
    const linkedGender = searchParams?.get('gender') || 'all';
    const linkedStatus = searchParams?.get('status') || 'Active';
    const linkedSection = searchParams?.get('section') || 'all';

    setLocalSearchQuery(linkedSearch);
    if (linkedClassId !== null) handleClassChange(linkedClassId);
    handleFilterChange({
      gender: linkedGender,
      status: linkedStatus,
      section: linkedSection,
    });
  }, [handleClassChange, handleFilterChange, searchParams]);

  // 🚀 OPTIMIZED: Ensure we always have pupils to display (from cache)
  // If cached pupils are available, use them immediately regardless of class selection
  const pupilsToDisplay = useMemo(() => {
    // If we have cached pupils, always use them (filtered by class if needed)
    if (allCachedPupils.length > 0) {
      return pupils; // This already filters by class if selected
    }
    // Fallback: if no cached pupils yet, return empty array (will show loading)
    return [];
  }, [pupils, allCachedPupils.length]);

  // 🚀 OPTIMIZED: Filter pupils based on search query (instant client-side filtering)
  const filteredPupils = useMemo(() => {
    // Use pupilsToDisplay which ensures we have cached data
    const pupilsToSearch = pupilsToDisplay;

    if (!searchQuery.trim()) {
      return pupilsToSearch;
    }

    const searchLower = searchQuery.toLowerCase();
    return pupilsToSearch.filter(pupil => {
      const fullName = `${pupil.firstName || ''} ${pupil.lastName || ''}`.toLowerCase();
      const admissionNumber = (pupil.admissionNumber || '').toLowerCase();
      const className = (pupil.className || '').toLowerCase();

      return (
        fullName.includes(searchLower) ||
        admissionNumber.includes(searchLower) ||
        className.includes(searchLower)
      );
    });
  }, [pupilsToDisplay, searchQuery]);

  // 🚀 OPTIMIZED: Only show loading if we don't have any cached data
  // If we have cached pupils, show them instantly even if class query is still loading
  // Never wait for class-based queries - always use cached data for instant display
  const isLoadingPupils = allCachedPupils.length === 0 && isLoadingAllPupils;

  // 🚀 CRITICAL OPTIMIZATION: Display pupils IMMEDIATELY without photos
  // Photos will load progressively in the background
  // This ensures instant page display even if photos take time

  // Step 1: ALWAYS display pupils without waiting for photos
  const pupilsWithPhotos = useMemo(() => {
    // Return pupils immediately - they already have photo URLs from cache if available
    return filteredPupils;
  }, [filteredPupils]);

  // Step 2: Load photos progressively in background (AFTER pupils are displayed)
  // Only load photos for visible pupils first (first 30)
  const pupilIds = useMemo(() => filteredPupils.map(p => p.id), [filteredPupils]);
  const priorityPhotoIds = useMemo(() => {
    // Prioritize first 30 pupils (typically visible on screen)
    return pupilIds.slice(0, 30);
  }, [pupilIds]);

  // 🚀 OPTIMIZED: Photos load in background, don't block display
  // This query runs but doesn't affect pupilsWithPhotos
  const {
    data: pupilPhotosMap = new Map<string, string>(),
    isLoading: isLoadingPhotos,
    isFetching: isFetchingPhotos
  } = usePupilPhotos(pupilIds, {
    priorityIds: priorityPhotoIds,
    enabled: pupilIds.length > 0 && pupilIds.length <= 500, // Only load photos if reasonable number
  });

  // Track if photos are still loading
  const photosLoading = isLoadingPhotos || isFetchingPhotos;

  // Track class changes for smooth transitions
  const previousClassIdRef = useRef<string | undefined>(selectedClassId);
  const expectedClassIdRef = useRef<string | undefined>(selectedClassId); // Track which class we're expecting
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Wrapper for handleClassChange that shows skeleton immediately
  const handleClassChangeWithTransition = useCallback((classId: string) => {
    // CRITICAL: Use flushSync to force immediate DOM update - skeleton MUST appear instantly
    // This bypasses React's batching to ensure the skeleton shows immediately
    flushSync(() => {
      setShowSkeleton(true);
      setIsTransitioning(true);
    });

    // Update refs immediately - track which class we're expecting
    previousClassIdRef.current = selectedClassId; // Save current class
    expectedClassIdRef.current = classId; // Track the new class we're waiting for

    // Use startTransition to make the actual class change non-blocking
    startTransition(() => {
      handleClassChange(classId);
    });
  }, [handleClassChange, startTransition, selectedClassId]);

  // Note: Transition effects are defined after filteredAndSortedPupils is computed

  // Get all pupils to count pending ones for the selected class
  const { data: allPupilsData = [] } = usePupils();

  // Count pending pupils for the selected class
  const pendingPupilsCount = useMemo(() => {
    if (!selectedClassId || selectedClassId === '' || selectedClassId === 'all') return 0;
    return allPupilsData.filter(p => p.classId === selectedClassId && p.status === 'Pending').length;
  }, [allPupilsData, selectedClassId]);

  // Reset visible rows when filters / class / search changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedClassId, searchQuery, pupilFilters.status, pupilFilters.section, pupilFilters.gender]);

  // Optimized: Cached hooks with longer stale times
  // 🚀 OPTIMIZED: Classes and settings use cache-first strategy - instant loading
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
  const { data: schoolSettings, isLoading: isLoadingSettings } = useSchoolSettings();

  // 🚀 OPTIMIZED: Only show loading if we don't have cached data
  // If we have cached classes/settings, display instantly
  const isLoadingClassesFinal = classes.length === 0 && isLoadingClasses;
  const isLoadingSettingsFinal = !schoolSettings && isLoadingSettings;

  // 🚀 OPTIMIZATION: Pre-compute classes map for O(1) lookups instead of O(N×M)
  const classesMap = useMemo(() => {
    console.log('🚀 OPTIMIZATION: Building classes map for', classes.length, 'classes');
    const map = new Map(classes.map(c => [c.id, c]));
    console.log(`✅ OPTIMIZATION: Classes map built with ${map.size} entries for instant lookups`);
    return map;
  }, [classes]);
  const deletePupilMutation = useDeletePupil();
  const updatePupilMutation = useUpdatePupil();


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
      return `${months}m`;
    } else if (months === 0) {
      return `${years}yr`;
    } else {
      return `${years}yr ${months}m`;
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
  // NOTE: Use ALL cached pupils (not class-filtered), so siblings from other classes are always found
  const siblingsMap = useMemo(() => {
    console.log('🚀 OPTIMIZATION: Building siblings map for', allCachedPupils.length, 'pupils');
    const startTime = performance.now();

    const map = new Map<string, Pupil[]>();

    // Group ALL cached pupils by familyId — not the class-filtered subset
    const familiesMap = new Map<string, Pupil[]>();
    allCachedPupils.forEach(pupil => {
      if (pupil.familyId) {
        if (!familiesMap.has(pupil.familyId)) {
          familiesMap.set(pupil.familyId, []);
        }
        familiesMap.get(pupil.familyId)!.push(pupil);
      }
    });

    // For each pupil, store their siblings (excluding themselves)
    allCachedPupils.forEach(pupil => {
      if (pupil.familyId) {
        const family = familiesMap.get(pupil.familyId) || [];
        const siblings = family.filter(p =>
          p.id !== pupil.id
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
  }, [allCachedPupils]);

  const getSiblings = (pupil: Pupil): Pupil[] => {
    return siblingsMap.get(pupil.id) || [];
  };

  // Load houses and create a lookup map for quick access
  const [houses, setHouses] = useState<House[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await HousesService.getAll();
        if (!mounted) return;
        data.sort((a, b) => a.name.localeCompare(b.name));
        setHouses(data);
      } catch (e) {
        console.warn('Failed to load houses', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const houseMap = useMemo(() => {
    const map = new Map<string, House>();
    houses.forEach(h => map.set(h.id, h));
    return map;
  }, [houses]);
  const getPupilHouse = (pupil: Pupil): House | null => {
    if (!pupil.houseId) return null;
    return houseMap.get(pupil.houseId) || null;
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

  // Extract all unique ID types from all pupils for the codes filter
  const availableIdTypes = useMemo(() => {
    const types = new Set<string>();
    allCachedPupils.forEach(p => {
      if (p.additionalIdentifiers) {
        p.additionalIdentifiers.forEach(id => types.add(id.idType));
      }
    });
    return Array.from(types).sort();
  }, [allCachedPupils]);

  // Filter pupils for display
  // 🚀 INFINITE SCROLL: Filter and sort ALL pupils first, then reveal in batches
  const { allFilteredPupils, filteredAndSortedPupils, totalFilteredCount } = useMemo(() => {
    const filtered = pupilsWithPhotos.filter(pupil => {
      // Status filter
      if (filters.status && pupil.status !== filters.status) return false;

      // Class filter
      if (filters.classId && pupil.classId !== filters.classId) return false;

      // Gender filter
      if (filters.gender && pupil.gender !== filters.gender) return false;

      // Section filter
      if (filters.section && pupil.section !== filters.section) return false;

      // Photo filter uses the pupil record so it remains immediate and stable
      // while progressive avatar image loading continues in the background.
      const hasPhoto = Boolean(pupil.photo?.trim());
      if (filters.photoFilter === 'with' && !hasPhoto) return false;
      if (filters.photoFilter === 'without' && hasPhoto) return false;

      // Age filter
      if (pupil.dateOfBirth) {
        const age = calculateAge(pupil.dateOfBirth);
        if (age < filters.ageRange.min || age > filters.ageRange.max) return false;
      }

      // Code filter
      if (filters.hasCodeType) {
        const hasCode = pupil.additionalIdentifiers?.some(id => id.idType === filters.hasCodeType);
        if (filters.hasCodeFilterType === 'with' && !hasCode) return false;
        if (filters.hasCodeFilterType === 'without' && hasCode) return false;
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

    const totalCount = filtered.length;
    // Slice only what we need to render right now — more rows revealed as user scrolls
    const visible = filtered.slice(0, visibleCount);

    return {
      allFilteredPupils: filtered,       // full list — used for exports, counts, etc.
      filteredAndSortedPupils: visible,  // displayed rows only
      totalFilteredCount: totalCount,
    };
  }, [pupilsWithPhotos, filters, sortField, sortOrder, classes, visibleCount]);


  // Update ref when class changes (for tracking, but skeleton is shown immediately in handler)
  useEffect(() => {
    previousClassIdRef.current = selectedClassId;
  }, [selectedClassId]);

  // 🚀 OPTIMIZED: Hide skeleton IMMEDIATELY when data is available
  // Since we use cached data, there's no need for complex logic or delays
  useEffect(() => {
    // Hide skeleton immediately if we have pupils data and not loading
    if (!isLoadingPupils && filteredAndSortedPupils.length > 0 && showSkeleton) {
      // Use flushSync for immediate update without any delay
      flushSync(() => {
        setShowSkeleton(false);
        setIsTransitioning(false);
      });
      expectedClassIdRef.current = undefined;
    }

    // Also hide skeleton if class is selected but has 0 pupils (valid state)
    if (!isLoadingPupils && selectedClassId && showSkeleton && filteredAndSortedPupils.length === 0) {
      flushSync(() => {
        setShowSkeleton(false);
        setIsTransitioning(false);
      });
      expectedClassIdRef.current = undefined;
    }
  }, [isLoadingPupils, filteredAndSortedPupils.length, selectedClassId, showSkeleton]);


  // 🚀 CASCADE AUTO-LOADER: As soon as data is ready and there are still hidden rows,
  // queue the next batch automatically — no scrolling required.
  // Uses requestIdleCallback so the browser renders each batch before loading the next.
  useEffect(() => {
    if (showSkeleton || isLoadingPupils || isPending) return; // wait until data is mounted
    if (visibleCount >= totalFilteredCount) return; // already showing everything

    const rIC = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 16));
    const id = rIC(() => {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, totalFilteredCount));
    });

    return () => {
      const cIC = (window as any).cancelIdleCallback ?? clearTimeout;
      cIC(id);
    };
  }, [visibleCount, totalFilteredCount, showSkeleton, isLoadingPupils, isPending, BATCH_SIZE]);

  // 🚀 SCROLL SENTINEL: Also load next batch when user scrolls near the bottom
  // (handles cases where the auto-cascade is paused)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => {
            if (prev >= totalFilteredCount) return prev;
            return Math.min(prev + BATCH_SIZE, totalFilteredCount);
          });
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [totalFilteredCount, BATCH_SIZE]);


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

  const getPupilClass = (pupil: Pupil) => getPupilClassDisplay(
    pupil,
    classes.find(schoolClass => schoolClass.id === pupil.classId),
  );

  const confirmStatusChange = async () => {
    if (!statusChangeModal.pupil) return;

    const pupil = statusChangeModal.pupil;
    const oldClassId = pupil.classId;

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

      // 🚀 OPTIMISTIC UPDATE: Update cache immediately for instant UI feedback
      const updatedPupil = {
        ...pupil,
        ...updateData,
      };

      // Update the class query with the new pupil data immediately
      if (oldClassId) {
        queryClient.setQueryData(['pupils-by-class', oldClassId], (oldData: Pupil[] | undefined) => {
          if (!oldData) return oldData;
          const index = oldData.findIndex(p => p.id === pupil.id);
          if (index >= 0) {
            const newData = [...oldData];
            // If class changed, remove from old class
            if (updateData.classId && updateData.classId !== oldClassId) {
              newData.splice(index, 1);
            } else {
              // Otherwise, update in place
              newData[index] = updatedPupil;
            }
            return newData;
          }
          return oldData;
        });
      }

      // 🚀 CRITICAL: Update the main pupils list cache (used by usePupils)
      queryClient.setQueryData(pupilsKeys.lists(), (oldData: Pupil[] | undefined) => {
        if (!oldData) return oldData;

        // Check if pupil already exists
        const index = oldData.findIndex(p => p.id === pupil.id);
        if (index >= 0) {
          const newData = [...oldData];
          newData[index] = updatedPupil;
          return newData;
        }
        return oldData;
      });

      // If class changed, add to new class immediately
      if (updateData.classId && updateData.classId !== oldClassId) {
        queryClient.setQueryData(['pupils-by-class', updateData.classId], (oldData: Pupil[] | undefined) => {
          if (!oldData) return [updatedPupil];
          const existingIndex = oldData.findIndex(p => p.id === pupil.id);
          if (existingIndex >= 0) {
            const newData = [...oldData];
            newData[existingIndex] = updatedPupil;
            // Sort by lastName
            newData.sort((a, b) => {
              const aLastName = (a.lastName || '').toLowerCase();
              const bLastName = (b.lastName || '').toLowerCase();
              return aLastName.localeCompare(bLastName);
            });
            return newData;
          }
          // Add new pupil and sort by lastName
          const newData = [...oldData, updatedPupil];
          newData.sort((a, b) => {
            const aLastName = (a.lastName || '').toLowerCase();
            const bLastName = (b.lastName || '').toLowerCase();
            return aLastName.localeCompare(bLastName);
          });
          return newData;
        });
      }

      // Show success immediately
      toast({
        title: "Status Updated",
        description: `${pupil.firstName}'s status has been changed to ${selectedStatus}${updateData.classId && updateData.classId !== pupil.classId ? ` and moved to ${getClassName(selectedClassId)}` : ''
          }.`,
      });

      setStatusChangeModal({ isOpen: false, pupil: null });

      // Perform mutation in background
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      // Background refetch to ensure data is in sync with server
      if (updateData.classId && updateData.classId !== oldClassId) {
        if (oldClassId) {
          queryClient.invalidateQueries({ queryKey: ['pupils-by-class', oldClassId] });
        }
        if (updateData.classId) {
          queryClient.invalidateQueries({ queryKey: ['pupils-by-class', updateData.classId] });
        }
      } else {
        // Even if class didn't change, invalidate the current class query for status updates
        if (oldClassId) {
          queryClient.invalidateQueries({ queryKey: ['pupils-by-class', oldClassId] });
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);

      // 🚨 ROLLBACK: Revert optimistic update on error
      if (oldClassId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', oldClassId] });
        queryClient.refetchQueries({ queryKey: ['pupils-by-class', oldClassId] });
      }
      if (updateData.classId && updateData.classId !== oldClassId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', updateData.classId] });
        queryClient.refetchQueries({ queryKey: ['pupils-by-class', updateData.classId] });
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status. Changes have been reverted.",
      });
    }
  };

  // Add class change handlers for individual pupils
  const handlePupilClassChange = (pupil: Pupil) => {
    setClassChangeModal({ isOpen: true, pupil });
    setSelectedNewClassId(pupil.classId || '');
  };

  const queryClient = useQueryClient();

  const confirmClassChange = async () => {
    if (!classChangeModal.pupil || !selectedNewClassId) return;

    const pupil = classChangeModal.pupil;
    const oldClassId = pupil.classId;

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

      // 🚀 OPTIMISTIC UPDATE: Update cache immediately for instant UI feedback
      const updatedPupil = {
        ...pupil,
        ...updateData,
      };

      // Remove from old class immediately
      if (oldClassId) {
        queryClient.setQueryData(['pupils-by-class', oldClassId], (oldData: Pupil[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.filter(p => p.id !== pupil.id);
        });
      }

      // 🚀 CRITICAL: Update the main pupils list cache (used by usePupils)
      queryClient.setQueryData(pupilsKeys.lists(), (oldData: Pupil[] | undefined) => {
        if (!oldData) return oldData;

        // Find and update the pupil
        const index = oldData.findIndex(p => p.id === pupil.id);
        if (index >= 0) {
          const newData = [...oldData];
          newData[index] = updatedPupil;
          return newData;
        }
        return oldData;
      });

      // Add to new class immediately
      if (selectedNewClassId) {
        queryClient.setQueryData(['pupils-by-class', selectedNewClassId], (oldData: Pupil[] | undefined) => {
          if (!oldData) return [updatedPupil];
          // Check if pupil already exists (shouldn't, but safety check)
          const existingIndex = oldData.findIndex(p => p.id === pupil.id);
          if (existingIndex >= 0) {
            // Update existing pupil
            const newData = [...oldData];
            newData[existingIndex] = updatedPupil;
            // Sort by lastName
            newData.sort((a, b) => {
              const aLastName = (a.lastName || '').toLowerCase();
              const bLastName = (b.lastName || '').toLowerCase();
              return aLastName.localeCompare(bLastName);
            });
            return newData;
          }
          // Add new pupil and sort by lastName
          const newData = [...oldData, updatedPupil];
          newData.sort((a, b) => {
            const aLastName = (a.lastName || '').toLowerCase();
            const bLastName = (b.lastName || '').toLowerCase();
            return aLastName.localeCompare(bLastName);
          });
          return newData;
        });
      }

      // Show success immediately
      toast({
        title: "Class Updated",
        description: `${pupil.firstName}'s class has been changed from ${getClassName(pupil.classId)} to ${getClassName(selectedNewClassId)}.`,
      });

      setClassChangeModal({ isOpen: false, pupil: null });
      setSelectedNewClassId('');

      // Perform mutation in background
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      // Background refetch to ensure data is in sync with server
      if (oldClassId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', oldClassId] });
      }
      if (selectedNewClassId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', selectedNewClassId] });
      }
    } catch (err) {
      console.error("Failed to update class:", err);

      // 🚨 ROLLBACK: Revert optimistic update on error
      if (oldClassId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', oldClassId] });
        queryClient.refetchQueries({ queryKey: ['pupils-by-class', oldClassId] });
      }
      if (selectedNewClassId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', selectedNewClassId] });
        queryClient.refetchQueries({ queryKey: ['pupils-by-class', selectedNewClassId] });
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update class. Changes have been reverted.",
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

      // 🚀 OPTIMISTIC UPDATE: Update cache immediately for instant UI feedback
      const updatedPupil = {
        ...pupil,
        section: newSection,
      };

      // Update the class query with the new pupil data immediately
      if (pupil.classId) {
        queryClient.setQueryData(['pupils-by-class', pupil.classId], (oldData: Pupil[] | undefined) => {
          if (!oldData) return oldData;
          const index = oldData.findIndex(p => p.id === pupil.id);
          if (index >= 0) {
            const newData = [...oldData];
            newData[index] = updatedPupil;
            return newData;
          }
          return oldData;
        });
      }

      // 🚀 CRITICAL: Update the main pupils list cache (used by usePupils)
      queryClient.setQueryData(pupilsKeys.lists(), (oldData: Pupil[] | undefined) => {
        if (!oldData) return oldData;
        const index = oldData.findIndex(p => p.id === pupil.id);
        if (index >= 0) {
          const newData = [...oldData];
          newData[index] = updatedPupil;
          return newData;
        }
        return oldData;
      });

      // Show success immediately
      toast({
        title: "Section Updated",
        description: `${pupil.firstName}'s section has been changed from ${pupil.section || 'N/A'} to ${newSection}.`,
      });

      // Perform mutation in background
      await updatePupilMutation.mutateAsync({
        id: pupil.id,
        data: updateData,
      });

      // Background refetch to ensure data is in sync with server
      if (pupil.classId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', pupil.classId] });
      }
    } catch (err) {
      console.error("Failed to update section:", err);

      // 🚨 ROLLBACK: Revert optimistic update on error
      if (pupil.classId) {
        queryClient.invalidateQueries({ queryKey: ['pupils-by-class', pupil.classId] });
        queryClient.refetchQueries({ queryKey: ['pupils-by-class', pupil.classId] });
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update section. Changes have been reverted.",
      });
    }
  };

  // Add ID codes management handler
  const handleManageIdCodes = (pupil: Pupil) => {
    setSelectedPupilForIdCodes(pupil);
    setIsManageIdCodesModalOpen(true);
  };

  // Pay code management handler
  const handleManagePayCode = (pupil: Pupil) => {
    setSelectedPupilForPayCode(pupil);
    setIsManagePayCodeModalOpen(true);
  };

  // Pay code save handler
  const handleSavePayCode = async (payCode: string | null) => {
    if (!selectedPupilForPayCode) return;
    const pupil = selectedPupilForPayCode;

    // Build new identifiers list: remove older pay code identifiers, then add the SchoolPay one if provided
    const existing = (pupil.additionalIdentifiers || []).filter(
      (id) => !(id.idType || '').toLowerCase().includes('pay code')
    );
    const updated = payCode
      ? [...existing, { idType: 'SchoolPay Payment Code', idValue: payCode }]
      : existing;

    await updatePupilMutation.mutateAsync({
      id: pupil.id,
      data: { additionalIdentifiers: updated, payCode: payCode || '' },
    });

    toast({
      title: payCode ? 'Pay Code Saved' : 'Pay Code Removed',
      description: payCode
        ? `${pupil.firstName}'s SchoolPay payment code has been set to ${payCode}.`
        : `${pupil.firstName}'s SchoolPay payment code has been removed.`,
    });
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

  // Handler to open edit name modal
  const handleEditName = (pupil: Pupil) => {
    setEditNameModal({ isOpen: true, pupil });
    // Ensure we set empty string explicitly, not undefined or null
    setEditFirstName(pupil.firstName ?? '');
    setEditLastName(pupil.lastName ?? '');
    setEditOtherNames(pupil.otherNames ?? '');
  };

  // Handler to save name changes
  // Handler for photo updates from PupilPhotoDetail component
  const handlePhotoUpdate = async (pupilId: string, photoData: string | undefined) => {
    try {
      await updatePupilMutation.mutateAsync({
        id: pupilId,
        data: { photo: photoData },
      });
      toast({
        title: "Photo Updated",
        description: "Pupil photo has been updated successfully.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update photo. Please try again.",
      });
    }
  };

  const handleSaveName = async () => {
    if (!editNameModal.pupil) return;

    if (!editFirstName.trim() || !editLastName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "First name and last name are required.",
      });
      return;
    }

    try {
      // Build update data - explicitly set otherNames to empty string if cleared
      const updateData: Partial<Pupil> = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
      };

      // Always include otherNames - set to empty string if cleared, or trimmed value if provided
      // This ensures we can actually clear the field (empty string) vs leaving it unchanged (undefined)
      updateData.otherNames = editOtherNames.trim();

      await updatePupilMutation.mutateAsync({
        id: editNameModal.pupil.id,
        data: updateData,
      });

      toast({
        title: "Name Updated",
        description: `${editFirstName} ${editLastName}'s name has been updated successfully.`,
      });

      setEditNameModal({ isOpen: false, pupil: null });
      setEditFirstName('');
      setEditLastName('');
      setEditOtherNames('');
    } catch (error) {
      console.error("Failed to update name:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update name. Please try again.",
      });
    }
  };

  // Add link siblings handler
  const handleLinkSiblings = (pupil: Pupil) => {
    setSelectedPupilForLinking(pupil);
    setIsLinkSiblingsModalOpen(true);
  };

  // Unlink a sibling: give them a brand-new unique familyId
  const handleUnlinkSibling = async () => {
    if (!unlinkSiblingConfirm) return;
    const { siblingToUnlink } = unlinkSiblingConfirm;
    setIsUnlinking(true);
    try {
      const newFamilyId = `fam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await updatePupilMutation.mutateAsync({
        id: siblingToUnlink.id,
        data: { familyId: newFamilyId },
      });
      toast({
        title: 'Sibling Unlinked',
        description: `${siblingToUnlink.firstName} ${siblingToUnlink.lastName} has been unlinked and given a new family code.`,
      });
      // Close both dialogs
      setUnlinkSiblingConfirm(null);
      setSelectedPupilSiblings(null);
    } catch (error) {
      console.error('Failed to unlink sibling:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to unlink sibling. Please try again.',
      });
    } finally {
      setIsUnlinking(false);
    }
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

  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);

  // Export to Excel function
  // Customizable Export to Excel function using config from the modal
  const handleCustomExport = (config: ExportConfig) => {
    try {
      if (!allFilteredPupils || allFilteredPupils.length === 0) {
        toast({ title: "Export Failed", description: "No pupils to export.", variant: "destructive" });
        return;
      }

      // Generate Headers based on config.columns
      const headers = config.columns.map(colId => {
        if (colId === 'indexNumber') return 'Index Number';
        if (colId === 'lin') return 'LIN Number';
        if (colId === 'admissionNumber') return 'Admission Number';
        if (colId === 'name') return 'Pupil Name';
        if (colId === 'gender') return 'Gender';
        if (colId === 'class') return 'Class';
        if (colId === 'stream') return 'Stream';
        if (colId === 'section') return 'Study Status (Section)';
        if (colId === 'status') return 'Status';
        if (colId === 'age') return 'Age / DOB';
        if (colId === 'siblingCount') return 'Sibling Count';
        if (colId === 'house') return 'House';
        if (colId.startsWith('code:')) return colId.replace('code:', '') + ' Code';
        return colId;
      });

      // Split name headers if needed
      const nameIndex = config.columns.indexOf('name');
      let finalHeaders = [...headers];
      if (nameIndex !== -1 && config.nameFormat === 'separated') {
        finalHeaders.splice(nameIndex, 1, 'Surname', 'First Name', 'Other Names');
      }

      const csvData = allFilteredPupils.map(pupil => {
        const rowData: string[] = [];

        config.columns.forEach(colId => {
          if (colId === 'name') {
            if (config.nameFormat === 'separated') {
              const names = (pupil.firstName || '').split(' ');
              const firstName = names[0] || '';
              const otherNames = names.slice(1).join(' ');
              rowData.push(pupil.lastName || '', firstName, otherNames);
            } else {
              rowData.push(`${pupil.firstName || ''} ${pupil.lastName || ''}`.trim());
            }
          } else if (colId === 'class') {
            const cls = classes.find((c: any) => c.id === pupil.classId);
            rowData.push(config.classFormat === 'code' ? (cls?.code || cls?.name || 'N/A') : (cls?.name || 'N/A'));
          } else if (colId === 'section') {
            const sec = pupil.section || 'Day';
            rowData.push(config.sectionFormat === 'short' ? sec.charAt(0).toUpperCase() : sec);
          } else if (colId === 'gender') {
            const gen = pupil.gender || 'N/A';
            rowData.push(config.genderFormat === 'short' ? gen.charAt(0).toUpperCase() : gen);
          } else if (colId === 'stream') {
            rowData.push(pupil.stream || 'N/A');
          } else if (colId === 'house') {
            const h = houses.find((h: any) => h.id === pupil.houseId);
            rowData.push(h?.name || 'N/A');
          } else if (colId === 'age') {
            rowData.push(pupil.dateOfBirth ? calculateAge(pupil.dateOfBirth) : '');
          } else if (colId === 'siblingCount') {
            rowData.push(pupil.familyId ? 'Has Family' : 'None');
          } else if (colId === 'admissionNumber') {
            rowData.push(pupil.admissionNumber || '');
          } else if (colId === 'status') {
            rowData.push(pupil.status || '');
          } else if (colId === 'indexNumber') {
            const idx = pupil.additionalIdentifiers?.find(id => id.idType === 'indexNumber');
            rowData.push(idx?.idValue || '');
          } else if (colId === 'lin') {
            const lin = pupil.additionalIdentifiers?.find(id => id.idType === 'LIN');
            rowData.push(lin?.idValue || '');
          } else if (colId.startsWith('code:')) {
            const type = colId.replace('code:', '');
            const code = pupil.additionalIdentifiers?.find(id => id.idType === type);
            rowData.push(code?.idValue || '');
          } else {
            rowData.push('');
          }
        });

        return rowData;
      });

      // Create CSV content
      const csvContent = [
        finalHeaders.map(h => `"${h}"`).join(','),
        ...csvData.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `pupils_custom_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Exported ${allFilteredPupils.length} pupils with custom formatting.`,
      });
    } catch (error) {
       console.error("Export error", error);
       toast({ title: "Export Failed", description: "An error occurred during export.", variant: "destructive" });
    }
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
            marginBottom: 3,
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
            marginTop: 5,
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
            minHeight: 30,
          },
          tableRow: {
            flexDirection: 'row',
            minHeight: columnSelection.actualPhoto ? 45 : 35,
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
            padding: 6,
            paddingVertical: 4,
            justifyContent: 'flex-start',
            borderRight: '1 solid #e2e8f0',
          },
          academicInfoCol: {
            width: '22%',
            padding: 6,
            paddingVertical: 4,
            justifyContent: 'flex-start',
            borderRight: '1 solid #e2e8f0',
          },
          personalInfoCol: {
            width: '18%',
            padding: 6,
            paddingVertical: 4,
            justifyContent: 'flex-start',
            borderRight: '1 solid #e2e8f0',
          },
          contactInfoCol: {
            width: '32%',
            padding: 6,
            paddingVertical: 4,
            justifyContent: 'flex-start',
          },
          // Header cell styles
          headerCell: {
            fontSize: 10,
            fontWeight: 'bold',
            color: '#ffffff',
            textAlign: 'center',
            padding: 6,
            paddingVertical: 8,
          },
          // Text styles
          primaryText: {
            fontSize: 10,
            fontWeight: 'bold',
            color: '#0f172a',
            marginBottom: 2,
            lineHeight: 1.2,
          },
          secondaryText: {
            fontSize: 8,
            color: '#475569',
            marginBottom: 1,
            lineHeight: 1.1,
          },
          tertiaryText: {
            fontSize: 7,
            color: '#64748b',
            lineHeight: 1.1,
          },
          accentText: {
            fontSize: 7,
            color: '#1e40af',
            fontWeight: 'bold',
            marginBottom: 1,
            lineHeight: 1.1,
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
            fontSize: 7,
            color: '#1e40af',
            backgroundColor: '#dbeafe',
            padding: '1 3',
            borderRadius: 2,
            marginBottom: 1,
            textAlign: 'center',
          },
          // Contact info
          guardianInfo: {
            fontSize: 8,
            color: '#374151',
            marginBottom: 2,
            lineHeight: 1.2,
          },
          emergencyTag: {
            fontSize: 6,
            color: '#dc2626',
            fontWeight: 'bold',
            backgroundColor: '#fee2e2',
            padding: '1 3',
            borderRadius: 2,
            marginLeft: 3,
            marginTop: 1,
          },
          siblingInfo: {
            fontSize: 7,
            color: '#4b5563',
            marginBottom: 1,
            lineHeight: 1.1,
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

        // Detect empty columns to hide them
        const hasPhotos = pupils.some((p: any) => p.photo);
        const hasGuardians = pupils.some((p: any) => p.guardians && p.guardians.length > 0);
        // Check for siblings using familyId grouping
        const familiesMap = new Map<string, any[]>();
        pupils.forEach((p: any) => {
          if (p.familyId) {
            if (!familiesMap.has(p.familyId)) {
              familiesMap.set(p.familyId, []);
            }
            familiesMap.get(p.familyId)!.push(p);
          }
        });
        const hasSiblings = Array.from(familiesMap.values()).some((family: any[]) => family.length > 1);
        const hasReligion = pupils.some((p: any) => p.religion);
        const hasCodes = pupils.some((p: any) => p.additionalIdentifiers && p.additionalIdentifiers.length > 0);

        // Create effective column selection (hide empty columns)
        const effectiveColumnSelection = {
          ...columnSelection,
          actualPhoto: columnSelection.actualPhoto && hasPhotos,
          guardianContacts: columnSelection.guardianContacts && hasGuardians,
          siblings: columnSelection.siblings && hasSiblings,
          religion: columnSelection.religion && hasReligion,
          codes: columnSelection.codes && hasCodes,
        };

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
                <Text style={styles.schoolName}>{settings.generalInfo.name}</Text>
                {settings.generalInfo.motto && (
                  <Text style={styles.motto}>"{settings.generalInfo.motto}"</Text>
                )}
                <Text style={styles.title}>
                  {selectedClassId && selectedClassId !== 'all' && selectedClassId !== ''
                    ? `${(classes.find(c => c.id === selectedClassId)?.name || classes.find(c => c.id === selectedClassId)?.code || '').toUpperCase()} PUPILS LIST`
                    : 'PUPILS LIST'}
                </Text>
              </View>

              {/* Modern Table with Combined Columns */}
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader} fixed>
                  {/* Photo Column */}
                  {effectiveColumnSelection.actualPhoto && (
                    <View style={{ width: '8%', padding: 6, paddingVertical: 8, borderRight: '1 solid #e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={styles.headerCell}>Photo</Text>
                    </View>
                  )}
                  {/* Student Information Column */}
                  <View style={[styles.studentInfoCol, { width: effectiveColumnSelection.actualPhoto ? '26%' : '28%' }]}>
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
                  {(effectiveColumnSelection.guardianContacts || effectiveColumnSelection.siblings) && (
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
                      {/* Photo Column - Left side */}
                      {effectiveColumnSelection.actualPhoto && (
                        <View style={{ width: '8%', padding: 6, paddingVertical: 4, borderRight: '1 solid #e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          {pupil.photo ? (
                            <Image
                              style={{
                                width: 25,
                                height: 25,
                                borderRadius: 12.5,
                                border: '1 solid #e2e8f0'
                              }}
                              src={pupil.photo}
                            />
                          ) : null}
                        </View>
                      )}

                      {/* Student Information Column */}
                      <View style={[styles.studentInfoCol, { width: effectiveColumnSelection.actualPhoto ? '26%' : '28%' }]}>
                        {/* PIN and Section combined */}
                        {columnSelection.pin && (
                          <Text style={[styles.accentText, { marginBottom: 1 }]}>
                            PIN: {pupil.pupilIdentificationNumber || 'N/A'}
                            {columnSelection.section && ` • ${pupil.section === 'boarding' ? 'Boarding' : 'Day'}`}
                          </Text>
                        )}
                        {!columnSelection.pin && columnSelection.section && (
                          <Text style={[styles.accentText, { marginBottom: 1 }]}>
                            {pupil.section === 'boarding' ? 'Boarding' : 'Day'} Student
                          </Text>
                        )}

                        {/* Full Name */}
                        {columnSelection.name && (
                          <Text style={[styles.primaryText, { marginBottom: 0 }]}>
                            {formatPupilDisplayName(pupil)}
                          </Text>
                        )}
                      </View>

                      {/* Academic Information Column */}
                      <View style={styles.academicInfoCol}>
                        {/* Class and Status combined */}
                        {(columnSelection.class || columnSelection.status) && (
                          <Text style={styles.primaryText}>
                            {columnSelection.class && `Class: ${pupilClass?.code || 'N/A'}`}
                            {columnSelection.class && columnSelection.status && ' • '}
                            {columnSelection.status && pupil.status}
                          </Text>
                        )}

                        {/* ID Codes */}
                        {effectiveColumnSelection.codes && pupil.additionalIdentifiers && pupil.additionalIdentifiers.length > 0 && (
                          <View style={{ marginTop: 2 }}>
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
                        {/* Age, Gender, and Religion combined on same line without labels */}
                        {(columnSelection.age || columnSelection.gender || effectiveColumnSelection.religion) && (
                          <Text style={styles.secondaryText}>
                            {[
                              columnSelection.age && pupil.dateOfBirth && `${calculateAge(pupil.dateOfBirth)}`,
                              columnSelection.gender && pupil.gender,
                              effectiveColumnSelection.religion && (pupil.religion || 'N/A')
                            ].filter(Boolean).join(' • ')}
                          </Text>
                        )}

                        {/* Photo indicator (only if actualPhoto is not selected) */}
                        {columnSelection.photo && !effectiveColumnSelection.actualPhoto && (
                          <Text style={styles.tertiaryText}>
                            Photo: {pupil.photo ? 'Available' : 'Not available'}
                          </Text>
                        )}
                      </View>

                      {/* Contact Information Column */}
                      {(effectiveColumnSelection.guardianContacts || effectiveColumnSelection.siblings) && (
                        <View style={styles.contactInfoCol}>
                          {/* Guardian Contacts */}
                          {effectiveColumnSelection.guardianContacts && pupil.guardians && pupil.guardians.length > 0 && (
                            <View>
                              <Text style={styles.accentText}>GUARDIANS:</Text>
                              {pupil.guardians.slice(0, 2).map((guardian: any, idx: number) => (
                                <View key={guardian.id} style={{ marginBottom: 3 }}>
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
                          {effectiveColumnSelection.siblings && (
                            <View style={{ marginTop: effectiveColumnSelection.guardianContacts ? 4 : 0 }}>
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
                              ) : null}
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
        pupils: allFilteredPupils.map(pupil => ({
          id: pupil.id,
          firstName: pupil.firstName,
          lastName: pupil.lastName,
          otherNames: pupil.otherNames,
          gender: pupil.gender,
          dateOfBirth: pupil.dateOfBirth || '',
          pupilIdentificationNumber: pupil.learnerIdentificationNumber || pupil.admissionNumber,
          classId: pupil.classId,
          photo: pupilPhotosMap.get(pupil.id) ?? null,
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

      // Generate PDF and open in viewer
      const selectedClassName = (selectedClassId && selectedClassId !== 'all' && selectedClassId !== '')
        ? (classes.find(c => c.id === selectedClassId)?.name || classes.find(c => c.id === selectedClassId)?.code || '')
        : '';
      const listHeading = selectedClassName ? `${selectedClassName} Pupils List` : 'Pupils List';
      const fileName = selectedClassName
        ? `${selectedClassName.replace(/\s+/g, '_')}_pupils-list-${new Date().toISOString().split('T')[0]}.pdf`
        : `pupils-list-${new Date().toISOString().split('T')[0]}.pdf`;
      const title = listHeading;

      await pdfViewer.openPDF(pdfDoc, fileName, title);

      // Close the column selection modal after successful generation
      setIsColumnSelectionModalOpen(false);

      toast({
        title: "PDF Generated",
        description: "Pupils list is ready for viewing.",
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

  const handleGenerateCompactPDF = async () => {
    try {
      const { Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer');

      const selectedColumnCount = Object.values(columnSelection).filter(Boolean).length;
      const autoLandscape =
        selectedColumnCount > 7 ||
        columnSelection.guardianContacts ||
        columnSelection.siblings ||
        columnSelection.codes ||
        columnSelection.actualPhoto;
      const orientation =
        printLayoutOptions.orientation === 'auto'
          ? (autoLandscape ? 'landscape' : 'portrait')
          : printLayoutOptions.orientation;
      const grayscale = printLayoutOptions.grayscale;
      const palette = grayscale
        ? {
            text: '#111111',
            muted: '#555555',
            border: '#999999',
            headerBg: '#dddddd',
            headerText: '#111111',
            rowAlt: '#f3f3f3',
            chipBg: '#eeeeee',
          }
        : {
            text: '#0f172a',
            muted: '#475569',
            border: '#cbd5e1',
            headerBg: '#e2e8f0',
            headerText: '#0f172a',
            rowAlt: '#f8fafc',
            chipBg: '#eef2ff',
          };

      const styles = StyleSheet.create({
        page: {
          paddingTop: 18,
          paddingBottom: 22,
          paddingHorizontal: 18,
          fontFamily: 'Helvetica',
          fontSize: 8,
          color: palette.text,
          backgroundColor: '#ffffff',
        },
        header: {
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: `1 solid ${palette.border}`,
        },
        schoolName: {
          fontSize: 14,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 2,
        },
        title: {
          fontSize: 10,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 3,
          textTransform: 'uppercase',
        },
        subText: {
          fontSize: 7,
          textAlign: 'center',
          color: palette.muted,
          marginBottom: 1,
        },
        metaValue: {
          fontSize: 7,
          textAlign: 'center',
          color: palette.muted,
        },
        table: {
          width: '100%',
          border: `1 solid ${palette.border}`,
          borderBottomWidth: 0,
        },
        row: {
          flexDirection: 'row',
          borderBottom: `1 solid ${palette.border}`,
          minHeight: columnSelection.actualPhoto ? 30 : 22,
        },
        headerRow: {
          backgroundColor: palette.headerBg,
          minHeight: 22,
        },
        altRow: {
          backgroundColor: palette.rowAlt,
        },
        cell: {
          paddingHorizontal: 4,
          paddingVertical: 3,
          justifyContent: 'center',
          borderRight: `1 solid ${palette.border}`,
        },
        lastCell: {
          borderRightWidth: 0,
        },
        headerCellText: {
          fontSize: 7,
          fontWeight: 'bold',
          color: palette.headerText,
          textAlign: 'center',
        },
        cellText: {
          fontSize: 7,
          color: palette.text,
          lineHeight: 1.25,
        },
        compactText: {
          fontSize: 6.5,
          color: palette.muted,
          lineHeight: 1.2,
        },
        nameText: {
          fontSize: 7.5,
          fontWeight: 'bold',
          color: palette.text,
          lineHeight: 1.2,
        },
        codeChip: {
          fontSize: 6,
          backgroundColor: palette.chipBg,
          paddingHorizontal: 3,
          paddingVertical: 1,
          marginBottom: 1,
        },
        photo: {
          width: 20,
          height: 24,
          objectFit: 'cover',
        },
        photoPlaceholder: {
          width: 20,
          height: 24,
          border: `1 solid ${palette.border}`,
          alignItems: 'center',
          justifyContent: 'center',
        },
        footer: {
          position: 'absolute',
          bottom: 10,
          left: 18,
          right: 18,
          paddingTop: 4,
          borderTop: `1 solid ${palette.border}`,
          textAlign: 'center',
          fontSize: 6.5,
          color: palette.muted,
        },
      });

      const formatDateOfBirth = (value?: string) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString('en-GB');
      };

      const formatSection = (value?: string) => {
        if (!value) return 'N/A';
        const normalized = value.trim().toLowerCase();
        if (normalized === 'boarding' || normalized === 'b') return 'Boarding';
        if (normalized === 'day' || normalized === 'd') return 'Day';
        return value;
      };

      const formatPhotoStatus = (photo?: string) => (photo ? 'Available' : 'Not available');
      const formatIdentifierLabel = (idType?: string) => {
        const normalized = (idType || '').trim().toLowerCase();
        if (normalized.includes('pay code') || normalized.includes('payment code')) {
          return 'Pay Code';
        }
        return idType || 'Code';
      };

      const getFilterDescription = () => {
        const parts: string[] = [];
        if (filters.classId) {
          const className = classes.find(c => c.id === filters.classId)?.name;
          if (className) parts.push(`Class: ${className}`);
        }
        if (filters.gender) parts.push(`Gender: ${filters.gender}`);
        if (filters.status) parts.push(`Status: ${filters.status}`);
        if (filters.section) parts.push(`Section: ${formatSection(filters.section)}`);
        if (filters.houseId) {
          const houseName = houseMap.get(filters.houseId)?.name;
          if (houseName) parts.push(`House: ${houseName}`);
        }
        if (filters.ageRange.min > 0 || filters.ageRange.max < 100) {
          parts.push(`Age: ${filters.ageRange.min}-${filters.ageRange.max}`);
        }
        return parts.length > 0 ? parts.join(' | ') : 'All pupils included';
      };

      const allColumns = [
        {
          key: 'actualPhoto',
          enabled: columnSelection.actualPhoto,
          label: 'Photo',
          weight: 8,
          align: 'center' as const,
          render: (pupil: Pupil) => (
            pupilPhotosMap.get(pupil.id) ? <Image style={styles.photo} src={pupilPhotosMap.get(pupil.id)!} /> : <View style={styles.photoPlaceholder}><Text style={styles.compactText}>N/A</Text></View>
          ),
        },
        {
          key: 'pin',
          enabled: columnSelection.pin,
          label: 'PIN / ID',
          weight: 11,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{pupil.learnerIdentificationNumber || pupil.admissionNumber || 'N/A'}</Text>,
        },
        {
          key: 'name',
          enabled: columnSelection.name,
          label: 'Pupil Name',
          weight: 17,
          render: (pupil: Pupil) => <Text style={styles.nameText}>{formatPupilDisplayName(pupil)}</Text>,
        },
        {
          key: 'gender',
          enabled: columnSelection.gender,
          label: 'Gender',
          weight: 7,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{pupil.gender || 'N/A'}</Text>,
        },
        {
          key: 'age',
          enabled: columnSelection.age,
          label: 'Age',
          weight: 6,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{pupil.dateOfBirth ? String(calculateAge(pupil.dateOfBirth)) : 'N/A'}</Text>,
        },
        {
          key: 'dateOfBirth',
          enabled: columnSelection.dateOfBirth,
          label: 'Date of Birth',
          weight: 11,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{formatDateOfBirth(pupil.dateOfBirth)}</Text>,
        },
        {
          key: 'class',
          enabled: columnSelection.class,
          label: 'Class',
          weight: 8,
          render: (pupil: Pupil) => {
            const pupilClass = classesMap.get(pupil.classId);
            return <Text style={styles.cellText}>{pupilClass?.code || pupilClass?.name || 'N/A'}</Text>;
          },
        },
        {
          key: 'section',
          enabled: columnSelection.section,
          label: 'Section',
          weight: 8,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{formatSection(pupil.section)}</Text>,
        },
        {
          key: 'status',
          enabled: columnSelection.status,
          label: 'Status',
          weight: 8,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{pupil.status || 'N/A'}</Text>,
        },
        {
          key: 'house',
          enabled: columnSelection.house,
          label: 'House',
          weight: 9,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{houseMap.get(pupil.houseId || '')?.name || 'N/A'}</Text>,
        },
        {
          key: 'payCode',
          enabled: columnSelection.payCode,
          label: 'Pay Code',
          weight: 11,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{getSchoolPayCode(pupil) || 'N/A'}</Text>,
        },
        {
          key: 'lin',
          enabled: columnSelection.lin,
          label: 'LIN',
          weight: 10,
          render: (pupil: Pupil) => {
            const linValue =
              pupil.additionalIdentifiers?.find(id => (id.idType || '').trim().toLowerCase() === 'lin')?.idValue ||
              pupil.learnerIdentificationNumber ||
              'N/A';
            return <Text style={styles.cellText}>{linValue}</Text>;
          },
        },
        {
          key: 'indexNumber',
          enabled: columnSelection.indexNumber,
          label: 'Index Number',
          weight: 11,
          render: (pupil: Pupil) => {
            const indexValue =
              pupil.additionalIdentifiers?.find(id => (id.idType || '').trim().toLowerCase() === 'indexnumber')?.idValue ||
              pupil.additionalIdentifiers?.find(id => (id.idType || '').trim().toLowerCase() === 'index number')?.idValue ||
              'N/A';
            return <Text style={styles.cellText}>{indexValue}</Text>;
          },
        },
        {
          key: 'codes',
          enabled: columnSelection.codes,
          label: 'ID Codes',
          weight: 15,
          render: (pupil: Pupil) => {
            const codes = pupil.additionalIdentifiers || [];
            if (codes.length === 0) {
              return <Text style={styles.compactText}>N/A</Text>;
            }
            return (
              <View>
                {codes.slice(0, 3).map((id, index) => (
                  <Text key={`${id.idType}-${id.idValue}-${index}`} style={styles.codeChip}>
                    {formatIdentifierLabel(id.idType)}: {id.idValue}
                  </Text>
                ))}
                {codes.length > 3 && <Text style={styles.compactText}>+{codes.length - 3} more</Text>}
              </View>
            );
          },
        },
        {
          key: 'religion',
          enabled: columnSelection.religion,
          label: 'Religion',
          weight: 8,
          render: (pupil: Pupil) => <Text style={styles.cellText}>{pupil.religion || 'N/A'}</Text>,
        },
        {
          key: 'photo',
          enabled: columnSelection.photo && !columnSelection.actualPhoto,
          label: 'Photo Status',
          weight: 9,
          render: (pupil: Pupil) => <Text style={styles.compactText}>{formatPhotoStatus(pupil.photo)}</Text>,
        },
        {
          key: 'guardianContacts',
          enabled: columnSelection.guardianContacts,
          label: 'Guardian Contacts',
          weight: 18,
          render: (pupil: Pupil) => {
            const guardians = pupil.guardians || [];
            if (guardians.length === 0) {
              return <Text style={styles.compactText}>N/A</Text>;
            }
            return (
              <View>
                {guardians.slice(0, 2).map((guardian) => (
                  <Text key={guardian.id} style={styles.compactText}>
                    {guardian.firstName} {guardian.lastName}: {guardian.phone || 'N/A'}
                    {guardian.id === pupil.emergencyContactGuardianId ? ' [Emergency]' : ''}
                  </Text>
                ))}
                {guardians.length > 2 && <Text style={styles.compactText}>+{guardians.length - 2} more</Text>}
              </View>
            );
          },
        },
        {
          key: 'siblings',
          enabled: columnSelection.siblings,
          label: 'Siblings',
          weight: 14,
          render: (pupil: Pupil) => {
            const siblings = siblingsMap.get(pupil.id) || [];
            if (siblings.length === 0) {
              return <Text style={styles.compactText}>None</Text>;
            }
            return (
              <View>
                {siblings.slice(0, 3).map((sibling) => {
                  const siblingClass = classesMap.get(sibling.classId);
                  return (
                    <Text key={sibling.id} style={styles.compactText}>
                      {formatPupilDisplayName(sibling)} ({siblingClass?.code || 'N/A'})
                    </Text>
                  );
                })}
                {siblings.length > 3 && <Text style={styles.compactText}>+{siblings.length - 3} more</Text>}
              </View>
            );
          },
        },
      ];

      const columns = allColumns.filter(column => column.enabled);
      const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
      const columnWidth = (weight: number) => `${((weight / totalWeight) * 100).toFixed(2)}%`;

      const pdfDoc = (
        <Document>
          <Page size="A4" orientation={orientation} style={styles.page} wrap>
            <View style={styles.header}>
              <Text style={styles.schoolName}>{settings.generalInfo.name}</Text>
              <Text style={styles.title}>
                {selectedClassId && selectedClassId !== 'all' && selectedClassId !== ''
                  ? `${(classes.find(c => c.id === selectedClassId)?.name || classes.find(c => c.id === selectedClassId)?.code || '').toUpperCase()} PUPILS LIST`
                  : 'PUPILS LIST'}
              </Text>
              {settings.generalInfo.motto && <Text style={styles.subText}>{settings.generalInfo.motto}</Text>}
              <Text style={styles.metaValue}>{allFilteredPupils.length} pupils</Text>
            </View>

            <View style={styles.table}>
              <View style={{ ...styles.row, ...styles.headerRow }} fixed>
                {columns.map((column, index) => (
                  <View
                    key={column.key}
                    style={{
                      ...styles.cell,
                      width: columnWidth(column.weight),
                      alignItems: column.align === 'center' ? 'center' : 'flex-start',
                      ...(index === columns.length - 1 ? styles.lastCell : {}),
                    }}
                  >
                    <Text style={styles.headerCellText}>{column.label}</Text>
                  </View>
                ))}
              </View>

              {allFilteredPupils.map((pupil, index) => (
                <View
                  key={pupil.id}
                  style={{
                    ...styles.row,
                    ...(index % 2 === 1 ? styles.altRow : {}),
                  }}
                  wrap={false}
                >
                  {columns.map((column, columnIndex) => (
                    <View
                      key={`${pupil.id}-${column.key}`}
                      style={{
                        ...styles.cell,
                        width: columnWidth(column.weight),
                        alignItems: column.align === 'center' ? 'center' : 'flex-start',
                        ...(columnIndex === columns.length - 1 ? styles.lastCell : {}),
                      }}
                    >
                      {column.render(pupil)}
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <Text
              style={styles.footer}
              fixed
              render={({ pageNumber, totalPages }: any) =>
                `${settings.generalInfo.name} | Page ${pageNumber} of ${totalPages} | Generated ${new Date().toLocaleDateString('en-GB')}`
              }
            />
          </Page>
        </Document>
      );

      const selectedClassNameC = (selectedClassId && selectedClassId !== 'all' && selectedClassId !== '')
        ? (classes.find(c => c.id === selectedClassId)?.name || classes.find(c => c.id === selectedClassId)?.code || '')
        : '';
      const listHeadingC = selectedClassNameC ? `${selectedClassNameC} Pupils List` : 'Pupils List';
      const fileName = selectedClassNameC
        ? `${selectedClassNameC.replace(/\s+/g, '_')}_pupils-list-${new Date().toISOString().split('T')[0]}.pdf`
        : `pupils-list-${new Date().toISOString().split('T')[0]}.pdf`;
      await pdfViewer.openPDF(pdfDoc, fileName, listHeadingC);
      setIsColumnSelectionModalOpen(false);

      toast({
        title: "PDF Generated",
        description: "Pupils list is ready for viewing.",
      });
    } catch (error) {
      console.error('Error generating compact PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
      });
    }
  };

  const handleGenerateBatchPaymentSlipsPDF = async () => {
    try {
      const pupilsWithPayCodes = allFilteredPupils.filter((pupil) => !!getSchoolPayCode(pupil));

      if (pupilsWithPayCodes.length === 0) {
        toast({
          title: "No Pay Codes Found",
          description: "There are no pupils with active pay codes in the current list.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Generating Payment Slips",
        description: `Preparing ${pupilsWithPayCodes.length} payment slips...`,
      });

      const [
        { default: ReactPDF },
        { Document, Page, Text, View, StyleSheet, Image, Link: PdfLink },
        QRCode,
      ] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@react-pdf/renderer'),
        import('qrcode'),
      ]);

      const schoolName = schoolSettings?.generalInfo?.name || "Trinity Family Nursery and Primary School";
      const schoolLogo = schoolSettings?.generalInfo?.logo;
      const paymentLink = 'https://www.schoolpay.co.ug/site/erp-select-channel';
      const qrCodeDataURL = await QRCode.toDataURL(paymentLink, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 180,
        color: {
          dark: '#111827',
          light: '#FFFFFF',
        },
      });

      const a4Width = 595.28;
      const a4Height = 841.89;
      const pagePadding = 12;
      const slipGap = 14.2; // ~0.5cm
      const slipWidth = (a4Width - (pagePadding * 2) - slipGap) / 2;
      const slipHeight = (a4Height - (pagePadding * 2) - slipGap) / 2;

      const styles = StyleSheet.create({
        page: {
          width: a4Width,
          height: a4Height,
          padding: pagePadding,
          backgroundColor: '#ffffff',
        },
        pageGrid: {
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        slip: {
          width: slipWidth,
          height: slipHeight,
          border: '1 solid #9ca3af',
          paddingTop: 10,
          paddingBottom: 8,
          paddingHorizontal: 10,
          backgroundColor: '#ffffff',
        },
        blankSlip: {
          width: slipWidth,
          height: slipHeight,
        },
        header: {
          alignItems: 'center',
          borderBottom: '1 solid #d1d5db',
          paddingBottom: 5,
          marginBottom: 5,
        },
        logo: {
          width: 24,
          height: 24,
          objectFit: 'contain',
          marginBottom: 3,
        },
        schoolName: {
          fontSize: 9,
          fontWeight: 'bold',
          textAlign: 'center',
          lineHeight: 1.15,
        },
        slipTitle: {
          fontSize: 6.2,
          color: '#4b5563',
          marginTop: 2,
          textAlign: 'center',
          letterSpacing: 0.3,
        },
        pupilBlock: {
          border: '1 solid #d1d5db',
          backgroundColor: '#f9fafb',
          padding: 5,
          marginBottom: 5,
        },
        pupilName: {
          fontSize: 8.2,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 2,
        },
        classText: {
          fontSize: 6.5,
          textAlign: 'center',
          color: '#374151',
        },
        payCodeLabel: {
          fontSize: 6.2,
          textAlign: 'center',
          color: '#4b5563',
          marginBottom: 2,
          letterSpacing: 0.3,
        },
        payCodeValue: {
          fontSize: 12.5,
          fontWeight: 'bold',
          textAlign: 'center',
          border: '1 solid #111827',
          paddingVertical: 4,
          paddingHorizontal: 3,
          marginBottom: 5,
        },
        sectionTitle: {
          fontSize: 6.8,
          fontWeight: 'bold',
          marginBottom: 2,
        },
        instruction: {
          fontSize: 5.6,
          lineHeight: 1.18,
          marginBottom: 1.5,
          color: '#1f2937',
        },
        qrSection: {
          marginTop: 4,
          paddingTop: 4,
          borderTop: '1 solid #e5e7eb',
          flexDirection: 'row',
          alignItems: 'center',
        },
        qrCode: {
          width: 56,
          height: 56,
          marginRight: 6,
        },
        qrMeta: {
          flex: 1,
        },
        qrText: {
          fontSize: 5.9,
          marginBottom: 2,
          color: '#374151',
          lineHeight: 1.15,
        },
        qrHint: {
          fontSize: 5.2,
          marginBottom: 2,
          color: '#4b5563',
          lineHeight: 1.15,
        },
        linkText: {
          fontSize: 4.8,
          color: '#2563eb',
          lineHeight: 1.1,
        },
      });

      const chunkedPupils = [];
      for (let i = 0; i < pupilsWithPayCodes.length; i += 4) {
        chunkedPupils.push(pupilsWithPayCodes.slice(i, i + 4));
      }

      const PaymentSlip = ({ pupil }: { pupil: Pupil }) => {
        const payCode = getSchoolPayCode(pupil) || 'N/A';
        return (
          <View style={styles.slip}>
            <View style={styles.header}>
              {schoolLogo ? <Image src={schoolLogo} style={styles.logo} /> : null}
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={styles.slipTitle}>SCHOOLPAY PAYMENT SLIP</Text>
            </View>

            <View style={styles.pupilBlock}>
              <Text style={styles.pupilName}>{formatPupilDisplayName(pupil)}</Text>
              <Text style={styles.classText}>Class: {getPupilClass(pupil).name || getClassName(pupil.classId)}</Text>
            </View>

            <Text style={styles.payCodeLabel}>PAY CODE</Text>
            <Text style={styles.payCodeValue}>{payCode}</Text>

            <Text style={styles.sectionTitle}>How to Pay Fees via SchoolPay</Text>
            <Text style={styles.instruction}>MTN: Dial *165*80# or *165*4*3*2#.</Text>
            <Text style={styles.instruction}>Airtel: Dial *185*6*2# or *185#.</Text>
            <Text style={styles.instruction}>Enter payment code {payCode}.</Text>
            <Text style={styles.instruction}>Confirm pupil name, class, balance, and pay.</Text>

            <View style={styles.qrSection} wrap={false}>
              <Image src={qrCodeDataURL} style={styles.qrCode} />
              <View style={styles.qrMeta}>
                <Text style={styles.qrText}>Or scan this QR code</Text>
                <Text style={styles.qrHint}>Open the SchoolPay payment channel directly.</Text>
                <PdfLink src={paymentLink} style={styles.linkText}>{paymentLink}</PdfLink>
              </View>
            </View>
          </View>
        );
      };

      const BatchPaymentSlipsDocument = () => (
        <Document>
          {chunkedPupils.map((pagePupils, pageIndex) => {
            const slots = [...pagePupils];
            while (slots.length < 4) slots.push(null as unknown as Pupil);
            return (
              <Page key={`payment-slips-page-${pageIndex}`} size="A4" style={styles.page}>
                <View style={styles.pageGrid}>
                  {[0, 1].map((rowIndex) => (
                    <View key={`row-${rowIndex}`} style={styles.row}>
                      {[0, 1].map((columnIndex) => {
                        const slotPupil = slots[(rowIndex * 2) + columnIndex];
                        return slotPupil ? (
                          <PaymentSlip key={slotPupil.id} pupil={slotPupil} />
                        ) : (
                          <View key={`blank-${rowIndex}-${columnIndex}`} style={styles.blankSlip} />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </Page>
            );
          })}
        </Document>
      );

      const fileName = `pupils-payment-slips-${new Date().toISOString().split('T')[0]}.pdf`;
      await pdfViewer.runPDFJob(
        {
          fileName,
          title: 'Payment Slips',
          initialMessage: `Rendering ${pupilsWithPayCodes.length} payment slips…`,
        },
        async ({ updateProgress }) => {
          updateProgress(18, 'Preparing payment slip pages…');
          const blob = await ReactPDF.pdf(<BatchPaymentSlipsDocument />).toBlob();
          updateProgress(96, 'Finalizing payment slips…');
          return blob;
        },
      );
    } catch (error) {
      console.error('Error generating batch payment slips PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate payment slips PDF.",
        variant: "destructive",
      });
    }
  };

  const statusCount = useMemo(() => {
    const currentStatus = filters.status || '';
    if (currentStatus === '') {
      return pupils.length;
    }
    return pupils.filter(p => p.status === currentStatus).length;
  }, [pupils, filters.status]);

  const statusLabel = useMemo(() => {
    const currentStatus = filters.status;
    if (!currentStatus) return 'PUPILS';
    if (currentStatus === 'Active') return 'PUPILS';
    return `${currentStatus.toUpperCase()} PUPILS`;
  }, [filters.status]);

  const dynamicHeading = useMemo(() => {
    if (!selectedClassId || selectedClassId === '') {
      return "Select a class";
    }

    if (selectedClassId === 'all') {
      return `Pupils in all classes (${statusCount})`;
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const classCode = selectedClass?.code || selectedClass?.name || 'N/A';
    
    const statusWord = filters.status && filters.status !== 'Active' ? `${filters.status.toLowerCase()} ` : '';
    const pupilWord = statusCount === 1 ? 'pupil' : 'pupils';
    
    return `${classCode} ${statusWord}${pupilWord} (${statusCount})`;
  }, [selectedClassId, statusCount, classes, filters.status]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.gender) count++;
    if (filters.status && filters.status !== 'Active') count++;
    if (filters.section) count++;
    if (filters.houseId) count++;
    if (filters.ageRange.min > 0 || filters.ageRange.max < 100) count++;
    if (filters.hasCodeType) count++;
    if (filters.photoFilter !== 'all') count++;
    return count;
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      classId: '',
      gender: '',
      status: 'Active',
      section: '',
      houseId: '',
      ageRange: { min: 0, max: 100 },
      hasCodeType: '',
      hasCodeFilterType: 'with',
      photoFilter: 'all',
    });
  }, []);

  const renderPupilSupportingCells = (
    rowPupil: Pupil,
    options: { hideFamilyControls?: boolean } = {},
  ) => {
    const rowSiblings = getSiblings(rowPupil);
    const guardianCount = rowPupil.guardians?.length || 0;
    const siblingCount = rowSiblings.length;

    return (
      <>
        <td className="hidden px-4 py-3 sm:table-cell">
          <div className="text-sm">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`text-${rowPupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${rowPupil.gender === 'Female' ? 'pink' : 'indigo'}-600 text-left font-medium transition-colors hover:underline`}>
                  {getPupilClass(rowPupil).code || getPupilClass(rowPupil).name || 'N/A'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Class Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/class-detail?id=${rowPupil.classId}`)}>
                  <Settings className="mr-2 h-4 w-4 text-blue-600" />
                  View Class Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePupilClassChange(rowPupil)}>
                  <Edit className="mr-2 h-4 w-4 text-orange-600" />
                  Change Class
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="mt-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="block text-left text-xs capitalize text-gray-500 transition-colors hover:text-indigo-600 hover:underline">
                    {rowPupil.section}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Change Section</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handlePupilSectionChange(rowPupil, 'Day')}
                    className={rowPupil.section === 'Day' ? 'bg-blue-50' : ''}
                  >
                    Day
                    {rowPupil.section === 'Day' && <span className="ml-auto text-blue-600">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handlePupilSectionChange(rowPupil, 'Boarding')}
                    className={rowPupil.section === 'Boarding' ? 'bg-purple-50' : ''}
                  >
                    Boarding
                    {rowPupil.section === 'Boarding' && <span className="ml-auto text-purple-600">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </td>

        <td className="hidden px-4 py-3 lg:table-cell">
          <div className="text-sm">
            {rowPupil.additionalIdentifiers && rowPupil.additionalIdentifiers.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {rowPupil.additionalIdentifiers.map((identifier, index) => {
                  let prefix = identifier.idType;
                  const lowerType = prefix.toLowerCase();
                  if (lowerType.includes('lin') || lowerType === 'lin') prefix = 'LIN';
                  else if (lowerType.includes('index')) prefix = 'IN';
                  else if (lowerType.includes('schoolpay') || lowerType.includes('pay code')) prefix = 'SP';

                  return (
                    <div key={`${identifier.idType}-${index}`} className="whitespace-nowrap font-mono text-xs text-gray-600">
                      <span className="inline-block w-8 font-semibold text-gray-800">{prefix}:</span>
                      <span className="ml-1 text-gray-700">{identifier.idValue}</span>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleManageIdCodes(rowPupil)}
                  className="mt-1 flex items-center gap-1 self-start text-[10px] font-medium text-indigo-500 transition-colors hover:text-indigo-700 hover:underline"
                >
                  <Edit className="h-3 w-3" /> Edit
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleManageIdCodes(rowPupil)}
                className="text-xs font-medium text-gray-400 transition-colors hover:text-indigo-600"
              >
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Add codes
                </span>
              </button>
            )}
          </div>
        </td>

        <td className="hidden px-4 py-3 md:table-cell">
          {options.hideFamilyControls ? (
            <span className="text-xs text-gray-300" title="Shares a guardian with the expanded pupil">—</span>
          ) : guardianCount === 0 && siblingCount === 0 ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {guardianCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPupilGuardians({
                    pupil: rowPupil,
                    pupilName: formatPupilDisplayName(rowPupil),
                    guardians: rowPupil.guardians || [],
                    emergencyContactId: rowPupil.emergencyContactGuardianId || '',
                  })}
                  className="text-xs text-blue-700 transition-colors hover:text-blue-900 hover:underline"
                >
                  {guardianCount} guardian{guardianCount !== 1 ? 's' : ''}
                </button>
              )}
              {guardianCount > 0 && siblingCount > 0 && <span className="text-xs text-gray-300">•</span>}
              {siblingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPupilSiblings({
                    pupil: rowPupil,
                    pupilName: formatPupilDisplayName(rowPupil),
                    siblings: rowSiblings,
                  })}
                  className="text-xs text-green-700 transition-colors hover:text-green-900 hover:underline"
                >
                  {siblingCount} sibling{siblingCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}
        </td>

        <td className="px-2 py-2 text-center sm:px-4 sm:py-3 sm:text-left">
          {rowSiblings.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedFamilyPupil(rowPupil)}
              className="group/fees inline-flex items-center justify-center rounded-lg border border-emerald-200/50 bg-emerald-50 p-1.5 text-emerald-700 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 active:scale-95"
              title="View Family / Sibling Fees Options"
              aria-label={`View fees options for ${formatPupilDisplayName(rowPupil)}`}
            >
              <span className="text-[11px] font-bold text-teal-600 transition-transform duration-200 group-hover/fees:scale-110">Shs.</span>
            </button>
          ) : (
            <Link
              href={`/fees/collect/${rowPupil.id}`}
              className="group/fees inline-flex items-center justify-center rounded-lg border border-emerald-200/50 bg-emerald-50 p-1.5 text-emerald-700 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 active:scale-95"
              title="Collect Fees"
              aria-label={`Collect fees for ${formatPupilDisplayName(rowPupil)}`}
            >
              <span className="text-[11px] font-bold transition-transform duration-200 group-hover/fees:scale-110">Shs.</span>
            </Link>
          )}
        </td>

        <td className="px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-indigo-500 sm:px-4 sm:py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`group inline-flex items-center justify-center rounded-lg p-1.5 text-${rowPupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${rowPupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:bg-${rowPupil.gender === 'Female' ? 'pink' : 'indigo'}-50/50 transition-all duration-200`}
                title="Actions"
                aria-label={`Actions for ${formatPupilDisplayName(rowPupil)}`}
              >
                <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Pupil Management</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                if (rowSiblings.length > 0) setSelectedFamilyPupil(rowPupil);
                else window.location.href = `/fees/collect/${rowPupil.id}`;
              }}>
                <span className="mr-2 pt-0.5 text-[11px] font-bold text-emerald-600">Shs.</span>
                Collect Fees
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditName(rowPupil)}>
                <User className="mr-2 h-4 w-4 text-purple-600" />
                Edit Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { window.location.href = `/pupils/edit?id=${rowPupil.id}`; }}>
                <Edit className="mr-2 h-4 w-4 text-blue-600" />
                Edit Pupil Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange(rowPupil)}>
                <Shield className="mr-2 h-4 w-4 text-orange-600" />
                Change Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleManageIdCodes(rowPupil)}>
                <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                ID Codes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleManagePayCode(rowPupil)}>
                <Tag className="mr-2 h-4 w-4 text-emerald-600" />
                Pay Code (SchoolPay)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleRegisterSibling(rowPupil)}>
                <UserPlus className="mr-2 h-4 w-4 text-green-600" />
                Register New Sibling
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLinkSiblings(rowPupil)}>
                <UserPlus className="mr-2 h-4 w-4 text-blue-600" />
                Link Existing as Sibling
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDeletePupil(rowPupil)}>
                <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                Delete Pupil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Background fetching indicator - Fixed at top */}
      {pupilsManager.isFetching && !isLoadingPupils && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse">
          <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]"></div>
        </div>
      )}

      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />

      <GlassPageTopBar
        title={
          <>
            <span className="hidden lg:inline">{dynamicHeading}</span>
            <span className="sr-only lg:hidden">Pupils</span>
          </>
        }
        backHref="/"
        backLabel="Back to dashboard"
        meta={null}
        inlineActions
        contentClassName="overflow-x-auto px-2 sm:px-4 lg:px-8"
        actionsClassName={`min-w-0 shrink gap-1 lg:flex-none lg:gap-2 ${
          isMobileTopBarSearchOpen ? 'flex-[999_1_0%]' : 'flex-1'
        }`}
        titleControls={
          <AnimatePresence initial={false} mode="popLayout">
            {!isMobileTopBarSearchOpen && (
              <motion.div
                key="mobile-class-selector"
                initial={{ opacity: 0, transform: prefersReducedMotion ? 'none' : 'translateX(-6px) scale(0.96)' }}
                animate={{ opacity: 1, transform: 'translateX(0) scale(1)' }}
                exit={{ opacity: 0, transform: prefersReducedMotion ? 'none' : 'translateX(-6px) scale(0.96)' }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                className="min-w-0 shrink-0 lg:hidden"
              >
                <ClassSelector
                  selectedClassId={selectedClassId}
                  onClassChange={handleClassChangeWithTransition}
                  placeholder="Class"
                  size="sm"
                  showIcon={false}
                  className="shrink-0"
                  triggerClassName="h-[34px] w-[58px] min-w-0 max-w-[58px] rounded-full border-blue-200/60 bg-white/90 px-2 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50 sm:w-[68px] sm:max-w-[68px]"
                  includeAllOption={true}
                  allOptionLabel="All"
                />
              </motion.div>
            )}
          </AnimatePresence>
        }
        center={
          <>
            <ClassSelector
              selectedClassId={selectedClassId}
              onClassChange={handleClassChangeWithTransition}
              placeholder="Class"
              size="sm"
              showIcon={false}
              className="shrink-0"
              triggerClassName="h-[34px] min-w-[120px] max-w-[160px] rounded-full border-blue-200/60 bg-white/90 px-3 text-xs font-semibold text-blue-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-400/50"
              includeAllOption={true}
              allOptionLabel="All Classes"
            />

            <GlassPageSearchInput
              placeholder="Search pupils..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </>
        }
        actionsLeading={
          <AnimatePresence initial={false} mode="popLayout">
            {isMobileTopBarSearchOpen ? (
              <motion.div
                key="mobile-pupils-search-field"
                initial={{ opacity: 0, transform: prefersReducedMotion ? 'none' : 'scaleX(0.35)' }}
                animate={{ opacity: 1, transform: 'scaleX(1)' }}
                exit={{ opacity: 0, transform: prefersReducedMotion ? 'none' : 'scaleX(0.35)' }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                style={{ transformOrigin: 'right center' }}
                className="relative flex h-9 min-w-[88px] flex-1 items-center lg:hidden"
              >
                <AnimatePresence initial={false}>
                  {!searchQuery && (
                    <motion.span
                      key="mobile-pupils-search-icon"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-2.5 z-10 flex text-blue-500"
                    >
                      <MagnifyingGlass size={14} weight="duotone" />
                    </motion.span>
                  )}
                </AnimatePresence>
                <input
                  ref={mobileTopBarSearchInputRef}
                  type="search"
                  inputMode="search"
                  value={searchQuery}
                  onChange={(event) => handleSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return;
                    handleSearch('');
                    setIsMobileTopBarSearchOpen(false);
                  }}
                  placeholder="Search pupils"
                  aria-label="Search pupils"
                  className={`h-9 w-full min-w-0 rounded-full border border-blue-300 bg-white/95 py-1 pr-8 text-xs text-slate-800 shadow-sm outline-none transition-[padding,box-shadow,border-color] duration-150 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/40 [&::-webkit-search-cancel-button]:appearance-none ${
                    searchQuery ? 'pl-2.5' : 'pl-8'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    handleSearch('');
                    setIsMobileTopBarSearchOpen(false);
                  }}
                  aria-label="Close and clear pupil search"
                  className="absolute right-0.5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.97]"
                >
                  <X size={13} weight="bold" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="mobile-pupils-search-button"
                type="button"
                onClick={() => setIsMobileTopBarSearchOpen(true)}
                initial={{ opacity: 0, transform: prefersReducedMotion ? 'none' : 'scale(0.95)' }}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                exit={{ opacity: 0, transform: prefersReducedMotion ? 'none' : 'scale(0.95)' }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                aria-label="Open pupil search"
                aria-expanded={false}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200/70 bg-white/95 text-blue-600 shadow-sm transition-[color,background-color,transform] duration-150 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.97] lg:hidden motion-reduce:active:transform-none"
              >
                <MagnifyingGlass size={15} weight="duotone" />
              </motion.button>
            )}
          </AnimatePresence>
        }
        actions={
          <GlassActionDock className="flex-nowrap gap-0.5 px-1 sm:gap-1 sm:px-2">
            {pendingPupilsCount > 0 && selectedClassId && selectedClassId !== '' && selectedClassId !== 'all' && (
              <GlassActionButton
                label="Pending"
                tone="orange"
                icon={<Clock className="h-4 w-4" />}
                href={`/classes/pending?classId=${selectedClassId}`}
                badge={pendingPupilsCount > 9 ? '9+' : pendingPupilsCount}
                aria-label={`Pending Pupils (${pendingPupilsCount})`}
              />
            )}

            <GlassActionButton
              label="Filters"
              tone="blue"
              icon={<FunnelSimple size={16} weight="duotone" />}
              badge={activeFiltersCount > 0 ? activeFiltersCount : undefined}
              onClick={() => setIsFilterPopupOpen(true)}
              aria-label="Filter Pupils"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <GlassActionButton
                  label="Export"
                  tone="emerald"
                  icon={<Download className="h-4 w-4" strokeWidth={2.5} />}
                  aria-label="Export Options"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-semibold text-xs text-muted-foreground">Export Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsColumnSelectionModalOpen(true)} className="cursor-pointer py-1.5 focus:bg-indigo-50">
                  <Printer size={14} className="mr-2 text-indigo-600" weight="duotone" />
                  <span className="font-medium text-[11px] text-gray-700">Print List</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsExportConfigModalOpen(true)} className="cursor-pointer py-1.5 focus:bg-green-50">
                  <ChartLine size={14} className="mr-2 text-green-600" weight="duotone" />
                  <span className="font-medium text-[11px] text-gray-700">Export to Excel</span>
                </DropdownMenuItem>
                {filteredAndSortedPupils.some((pupil) => !!getSchoolPayCode(pupil)) && (
                  <DropdownMenuItem onClick={handleGenerateBatchPaymentSlipsPDF} className="cursor-pointer py-1.5 focus:bg-amber-50">
                    <CreditCard size={14} className="mr-2 text-amber-600" />
                    <span className="font-medium text-[11px] text-gray-700">Payment Slips</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <ActionGuard module="pupils" page="create" action="access_page">
              <GlassActionButton
                label="Add"
                tone="blue"
                icon={<Plus size={16} weight="bold" />}
                onClick={() => router.push('/pupils/new')}
                aria-label="Add New Pupil"
              />
            </ActionGuard>
          </GlassActionDock>
        }
      />

      <div className="hidden">
        <div className="h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent" />
        <div className="max-w-7xl mx-auto py-1">
          <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-3 w-full flex-nowrap">
            
            {/* Left section: Title + count badge + class selector */}
            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-blue-50/80 border border-blue-200/60 text-blue-600 shadow-sm flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <h1 className="text-xs sm:text-lg font-bold text-indigo-900 leading-tight">
                    Pupils
                  </h1>
                  <span className="bg-indigo-50 text-indigo-700 text-[8px] sm:text-[10px] font-bold px-1 sm:px-2 py-0.5 rounded-full border border-indigo-100/80 whitespace-nowrap">
                    {statusCount} {statusLabel}
                  </span>
                  
                  <span className="text-gray-300 hidden xs:inline">•</span>
                  
                  <div className="flex items-center gap-0.5">
                    <ClassSelector
                      selectedClassId={selectedClassId}
                      onClassChange={handleClassChangeWithTransition}
                      placeholder="Class"
                      size="sm"
                      className="bg-transparent border-0 ring-0 focus:ring-0 text-blue-700 font-semibold text-[10px] sm:text-xs min-w-[70px] sm:min-w-[100px]"
                      includeAllOption={true}
                      allOptionLabel="All Classes"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Middle section: Dynamic flex-growing Search bar */}
            <div className="relative group flex-1 min-w-[50px] max-w-[200px] sm:max-w-xs mx-1 sm:mx-2">
              <div className="absolute inset-y-0 left-0 pl-1.5 sm:pl-2.5 flex items-center pointer-events-none text-blue-500/80 group-hover:text-blue-600 transition-all duration-500 z-10">
                <MagnifyingGlass size={11} className="w-3 h-3 sm:w-3.5 sm:h-3.5" weight="duotone" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-5 sm:pl-8 pr-1.5 py-1 text-[10px] sm:text-xs bg-white/70 rounded-full focus:ring-2 focus:ring-blue-400/50 focus:outline-none shadow-sm hover:shadow-md transition-all duration-500 ease-in-out placeholder:text-gray-400 border border-gray-200/60"
              />
            </div>

            {/* Right section: Action buttons floating pill */}
            <div className="bg-white/85 rounded-full px-1.5 sm:px-2 py-1 shadow-sm border border-gray-200/60 backdrop-blur-sm flex items-center justify-center gap-1 sm:gap-1.5 flex-shrink-0">
                {pendingPupilsCount > 0 && selectedClassId && selectedClassId !== '' && selectedClassId !== 'all' && (
                  <Link
                    href={`/classes/pending?classId=${selectedClassId}`}
                    className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white text-amber-600 border border-amber-300 shadow-sm hover:bg-gradient-to-br hover:from-amber-400 hover:via-orange-500 hover:to-amber-600 hover:text-white transition-all duration-300 hover:scale-105 active:scale-95"
                    title={`Pending Pupils (${pendingPupilsCount})`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full border border-white">
                      {pendingPupilsCount > 9 ? '9+' : pendingPupilsCount}
                    </span>
                  </Link>
                )}

                {/* Filter button */}
                <button
                  onClick={() => setIsFilterPopupOpen(true)}
                  className="relative flex items-center justify-center h-7 w-7 sm:w-auto px-0 sm:px-3 rounded-full font-semibold text-xs transition-all whitespace-nowrap border bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 flex-shrink-0 active:scale-95"
                  title="Filter Pupils"
                >
                  <FunnelSimple size={13} className="sm:mr-1" weight="duotone" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="absolute sm:relative -top-1 -right-1 sm:top-auto sm:right-auto sm:ml-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-600 text-white leading-none">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                <div className="h-4 w-px bg-gray-200 mx-0.5 flex-shrink-0"></div>

                {/* Export dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center justify-center h-7 w-7 sm:w-auto px-0 sm:px-3 rounded-full font-semibold text-xs transition-all whitespace-nowrap border bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 flex-shrink-0 active:scale-95"
                      title="Export Options"
                    >
                      <Download size={13} className="sm:mr-1" strokeWidth={2.5} />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-semibold text-xs text-muted-foreground">Export Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsColumnSelectionModalOpen(true)} className="cursor-pointer py-1.5 focus:bg-indigo-50">
                      <Printer size={14} className="mr-2 text-indigo-600" weight="duotone" />
                      <span className="font-medium text-[11px] text-gray-700">Print List</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsExportConfigModalOpen(true)} className="cursor-pointer py-1.5 focus:bg-green-50">
                      <ChartLine size={14} className="mr-2 text-green-600" weight="duotone" />
                      <span className="font-medium text-[11px] text-gray-700">Export to Excel</span>
                    </DropdownMenuItem>
                    {filteredAndSortedPupils.some((pupil) => !!getSchoolPayCode(pupil)) && (
                      <DropdownMenuItem onClick={handleGenerateBatchPaymentSlipsPDF} className="cursor-pointer py-1.5 focus:bg-amber-50">
                        <CreditCard size={14} className="mr-2 text-amber-600" />
                        <span className="font-medium text-[11px] text-gray-700">Payment Slips</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-px bg-gray-200 mx-0.5 flex-shrink-0"></div>

                {/* Add button */}
                <ActionGuard module="pupils" page="create" action="access_page">
                  <button
                    onClick={() => router.push('/pupils/new')}
                    className="flex items-center justify-center h-7 w-7 sm:w-auto px-0 sm:px-3 rounded-full font-semibold text-xs transition-all whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0 shadow-sm active:scale-95"
                    title="Add New Pupil"
                  >
                    <Plus size={13} className="sm:mr-1" strokeWidth={2.5} />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </ActionGuard>
              </div>

          </div>
        </div>
      </div>
      <div className="mx-auto px-2 sm:px-6 pt-0 sm:pt-0 -mt-3 sm:-mt-5 pb-4 sm:pb-6">

        {/* Optimization messages hidden per user request */}

        {/* Show message when no class is selected */}
        {!selectedClassId || selectedClassId === '' ? (
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <Users className="w-8 h-8 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-indigo-700 mb-2">Select a Class</h3>
                <p className="text-indigo-500">Please select a class from the dropdown above to view pupils</p>
              </div>
            </div>
          </div>
        ) : isLoadingPupils || isLoadingClassesFinal || isLoadingSettingsFinal ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-indigo-600">
              Loading pupils and school information...
            </span>
          </div>
        ) : filteredAndSortedPupils.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-12 text-center">
            <p className="text-indigo-500">No pupils found for the selected class</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
            <div className="overflow-x-auto rounded-t-xl">
              <table className="min-w-full divide-y divide-indigo-100">
                <thead className="border-b-2 border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-muted/30 backdrop-blur-sm">
                  <tr>
                    <th
                      className="px-2 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider sm:px-3"
                      onClick={() => handleSort('name')}
                    >
                      <button
                        type="button"
                        className="flex items-center space-x-2 rounded-lg px-2 py-1 transition-all duration-200 hover:scale-105 hover:bg-primary/10 hover:text-primary"
                      >
                        <span className="hidden sm:inline">PUPIL DETAILS</span>
                        <span className="sm:hidden">PUPIL</span>
                        <div className="hidden h-1 w-1 rounded-full bg-primary/40 sm:block" />
                        {getSortIcon('name')}
                      </button>
                    </th>
                    <th
                      className="hidden px-3 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider sm:table-cell"
                      onClick={() => handleSort('class')}
                    >
                      <button
                        type="button"
                        className="flex items-center space-x-1 rounded-lg px-2 py-1 transition-all duration-200 hover:scale-105 hover:bg-primary/10 hover:text-primary"
                      >
                        <span>MOPH</span>
                        {getSortIcon('class')}
                      </button>
                    </th>
                    <th className="hidden px-3 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider lg:table-cell">
                      <span className="flex items-center space-x-1 rounded-lg px-2 py-1">
                        <span>CODES</span>
                      </span>
                    </th>
                    <th className="hidden px-3 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider md:table-cell">
                      <span className="flex items-center space-x-1 rounded-lg px-2 py-1">
                        <span>FAMILY</span>
                      </span>
                    </th>
                    <th className="px-2 sm:px-3 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                      <span className="flex items-center space-x-1 rounded-lg px-2 py-1">
                        <span>FEES</span>
                      </span>
                    </th>
                    <th className="px-2 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider sm:px-3">
                      <span className="inline-flex items-center space-x-1 rounded-lg px-2 py-1 justify-end w-full">
                        <Settings className="h-4 w-4 text-foreground/75" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-indigo-100">
                  {showSkeleton || isLoadingPupils || isPending ? (
                    <PupilTableRowSkeleton count={8} />
                  ) : (
                    filteredAndSortedPupils.map((pupil, index) => {
                      const pupilHouse = getPupilHouse(pupil);
                      const familySiblings = getSiblings(pupil);
                      const hasFamilySiblings = familySiblings.length > 0;
                      const isFamilyExpanded = hasFamilySiblings && expandedFamilyPupilId === pupil.id;
                      const familyTreeId = `pupil-family-${pupil.id}`;
                      return (
                        <React.Fragment key={pupil.id}>
                          <motion.tr
                            initial={{ opacity: isTransitioning ? 0 : 1, y: isTransitioning ? -10 : 0 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{
                              duration: 0.3,
                              delay: isTransitioning ? 0 : index * 0.02,
                              ease: "easeOut"
                            }}
                            className={`hover:bg-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-50 transition-colors`}
                          >
                          <td className="px-2 sm:px-4 py-2 sm:py-3">
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              <div className="relative flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10" style={{ contain: 'layout' }}>
                                <PupilPhotoDetail
                                  pupilPhoto={pupil.photo}
                                  pupilName={formatPupilDisplayName(pupil)}
                                  onPhotoChange={(photoData) => handlePhotoUpdate(pupil.id, photoData)}
                                  className="h-8 w-8 sm:h-10 sm:w-10"
                                  ringColor={pupilHouse?.themeColor}
                                  isLoading={photosLoading && !pupil.photo}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {hasFamilySiblings && (
                                    <button
                                      type="button"
                                      aria-expanded={isFamilyExpanded}
                                      aria-controls={familyTreeId}
                                      aria-label={`${isFamilyExpanded ? 'Hide' : 'Show'} ${familySiblings.length} sibling${familySiblings.length === 1 ? '' : 's'} of ${formatPupilDisplayName(pupil)}`}
                                      title={`${isFamilyExpanded ? 'Hide' : 'Show'} family members`}
                                      onClick={() => setExpandedFamilyPupilId(current => current === pupil.id ? null : pupil.id)}
                                      className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                                    >
                                      <ChevronRight
                                        aria-hidden="true"
                                        className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${isFamilyExpanded ? 'rotate-90' : ''}`}
                                      />
                                    </button>
                                  )}
                                  <Link
                                    href={`/pupil-detail?id=${pupil.id}`}
                                    className={`min-w-0 truncate text-xs font-medium transition-colors sm:text-sm text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-800`}
                                  >
                                    {formatPupilDisplayName(pupil)}
                                  </Link>
                                  {hasFamilySiblings && (
                                    <span className="hidden flex-none rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 xl:inline-flex">
                                      {familySiblings.length + 1} family pupils
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                                  <span className="truncate max-w-[120px] xs:max-w-none">{pupil.learnerIdentificationNumber || pupil.admissionNumber}</span>
                                  <span className="hidden xs:inline text-gray-300">•</span>
                                  <div className="flex items-center gap-2">
                                    <span>{pupil.gender}</span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${pupil.status === 'Active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                      }`}>
                                      {pupil.status}
                                    </span>
                                  </div>
                                  {pupil.dateOfBirth && (
                                    <>
                                      <span className="hidden xs:inline text-gray-300">•</span>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="whitespace-nowrap hover:text-indigo-600 transition-colors font-medium">
                                            {calculateAgeAbbreviated(pupil.dateOfBirth)}
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="center">
                                          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                                            Date of Birth
                                          </DropdownMenuLabel>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem>
                                            <span className="text-sm font-medium">
                                              {new Date(pupil.dateOfBirth).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                              })}
                                            </span>
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </>
                                  )}
                                </div>
                                {/* Mobile-only class info */}
                                <div className="sm:hidden mt-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className={`text-xs text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:underline transition-colors font-medium text-left`}>
                                          {getPupilClass(pupil).code || getPupilClass(pupil).name || 'N/A'}
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
                                          pupil,
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
                                            pupil,
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
                                    <span className="text-xs text-gray-400">•</span>
                                    {pupil.additionalIdentifiers && pupil.additionalIdentifiers.length > 0 ? (
                                      <div className="flex flex-col gap-0.5 mt-1 w-full relative left-0.5">
                                        {pupil.additionalIdentifiers.map((id, index) => {
                                          let prefix = id.idType;
                                          const lowerType = prefix.toLowerCase();
                                          if (lowerType.includes('lin') || lowerType === 'lin') prefix = 'LIN';
                                          else if (lowerType.includes('index')) prefix = 'IN';
                                          else if (lowerType.includes('schoolpay') || lowerType.includes('pay code')) prefix = 'SP';
                                          
                                          return (
                                            <div key={index} className="text-[10px] font-mono whitespace-nowrap text-gray-600">
                                              <span className="font-semibold text-gray-800 w-6 inline-block">{prefix}:</span>
                                              <span className="text-gray-700 ml-1">{id.idValue}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
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
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3">
                            <div className="text-sm">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={`text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:underline transition-colors font-medium text-left`}>
                                    {getPupilClass(pupil).code || getPupilClass(pupil).name || 'N/A'}
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
                              </div>
                            </div>
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3">
                            <div className="text-sm">
                              {pupil.additionalIdentifiers && pupil.additionalIdentifiers.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  {pupil.additionalIdentifiers.map((id, index) => {
                                    let prefix = id.idType;
                                    const lowerType = prefix.toLowerCase();
                                    if (lowerType.includes('lin') || lowerType === 'lin') prefix = 'LIN';
                                    else if (lowerType.includes('index')) prefix = 'IN';
                                    else if (lowerType.includes('schoolpay') || lowerType.includes('pay code')) prefix = 'SP';
                                    
                                    return (
                                      <div key={index} className="text-xs font-mono whitespace-nowrap text-gray-600">
                                        <span className="font-semibold text-gray-800 w-8 inline-block">{prefix}:</span>
                                        <span className="text-gray-700 ml-1">{id.idValue}</span>
                                      </div>
                                    );
                                  })}
                                  <button
                                    onClick={() => handleManageIdCodes(pupil)}
                                    className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline transition-colors self-start mt-1 font-medium flex items-center gap-1"
                                  >
                                    <Edit className="h-3 w-3" /> Edit
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleManageIdCodes(pupil)}
                                  className="text-gray-400 hover:text-indigo-600 transition-colors text-xs font-medium"
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
                            {(() => {
                              const guardianCount = pupil.guardians?.length || 0;
                              const siblings = getSiblings(pupil);
                              const siblingCount = siblings.length;

                              if (guardianCount === 0 && siblingCount === 0) {
                                return <span className="text-gray-400 text-xs">—</span>;
                              }

                              return (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {guardianCount > 0 && (
                                    <button
                                      onClick={() => setSelectedPupilGuardians({
                                        pupil,
                                        pupilName: formatPupilDisplayName(pupil),
                                        guardians: pupil.guardians || [],
                                        emergencyContactId: pupil.emergencyContactGuardianId || ''
                                      })}
                                      className="text-xs text-blue-700 hover:text-blue-900 hover:underline transition-colors"
                                    >
                                      {guardianCount} guardian{guardianCount !== 1 ? 's' : ''}
                                    </button>
                                  )}
                                  {guardianCount > 0 && siblingCount > 0 && (
                                    <span className="text-gray-300 text-xs">•</span>
                                  )}
                                  {siblingCount > 0 && (
                                    <button
                                      onClick={() => setSelectedPupilSiblings({
                                        pupil,
                                        pupilName: formatPupilDisplayName(pupil),
                                        siblings
                                      })}
                                      className="text-xs text-green-700 hover:text-green-900 hover:underline transition-colors"
                                    >
                                      {siblingCount} sibling{siblingCount !== 1 ? 's' : ''}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center sm:text-left">
                            {(() => {
                              const siblings = getSiblings(pupil);
                              const hasSiblings = siblings.length > 0;
                              
                              if (hasSiblings) {
                                return (
                                  <button
                                    onClick={() => setSelectedFamilyPupil(pupil)}
                                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200/50 hover:border-emerald-300 transition-all duration-200 active:scale-95 group/fees shadow-sm"
                                    title="View Family / Sibling Fees Options"
                                    aria-label="View Family / Sibling Fees Options"
                                  >
                                    <span className="text-[11px] font-bold transition-transform duration-200 group-hover/fees:scale-110 text-teal-600">Shs.</span>
                                  </button>
                                );
                              }

                              return (
                                <Link
                                  href={`/fees/collect/${pupil.id}`}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200/50 hover:border-emerald-300 transition-all duration-200 active:scale-95 group/fees shadow-sm"
                                  title="Collect Fees"
                                  aria-label="Collect Fees"
                                >
                                  <span className="text-[11px] font-bold transition-transform duration-200 group-hover/fees:scale-110">Shs.</span>
                                </Link>
                              );
                            })()}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-indigo-500 uppercase tracking-wider">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button 
                                  className={`p-1.5 rounded-lg text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:text-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-600 hover:bg-${pupil.gender === 'Female' ? 'pink' : 'indigo'}-50/50 transition-all duration-200 inline-flex items-center justify-center group`}
                                  title="Actions"
                                  aria-label="Actions"
                                >
                                  <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Pupil Management</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  const siblings = getSiblings(pupil);
                                  if (siblings.length > 0) {
                                    setSelectedFamilyPupil(pupil);
                                  } else {
                                    window.location.href = `/fees/collect/${pupil.id}`;
                                  }
                                }}>
                                  <span className="mr-2 text-[11px] font-bold text-emerald-600 pt-0.5">Shs.</span>
                                  Collect Fees
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditName(pupil)}>
                                  <User className="mr-2 h-4 w-4 text-purple-600" />
                                  Edit Name
                                </DropdownMenuItem>
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
                                  ID Codes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleManagePayCode(pupil)}>
                                  <Tag className="mr-2 h-4 w-4 text-emerald-600" />
                                  Pay Code (SchoolPay)
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
                          </motion.tr>
                          {isFamilyExpanded && familySiblings.map((sibling, siblingIndex) => {
                            const siblingHouse = getPupilHouse(sibling);
                            const sharesGuardianWithAnchor = pupilsShareGuardian(pupil, sibling);
                            const isLastSibling = siblingIndex === familySiblings.length - 1;

                            return (
                              <tr
                                key={`${pupil.id}-family-row-${sibling.id}`}
                                id={siblingIndex === 0 ? familyTreeId : undefined}
                                className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/30 to-white transition-colors hover:bg-emerald-50"
                              >
                                <td className="relative py-2 pl-8 pr-2 sm:py-3 sm:pl-12 sm:pr-4">
                                  <span
                                    aria-hidden="true"
                                    className={`absolute left-3 top-0 w-px bg-emerald-300 sm:left-5 ${isLastSibling ? 'h-1/2' : 'bottom-0'}`}
                                  />
                                  <span aria-hidden="true" className="absolute left-3 top-1/2 h-px w-4 bg-emerald-300 sm:left-5 sm:w-5" />
                                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                    <PupilPhotoDetail
                                      pupilPhoto={sibling.photo}
                                      pupilName={formatPupilDisplayName(sibling)}
                                      onPhotoChange={(photoData) => handlePhotoUpdate(sibling.id, photoData)}
                                      className="h-8 w-8 flex-none sm:h-10 sm:w-10"
                                      ringColor={siblingHouse?.themeColor}
                                      isLoading={photosLoading && !sibling.photo}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                        <Link
                                          href={`/pupil-detail?id=${sibling.id}`}
                                          className={`min-w-0 truncate text-xs font-semibold transition-colors sm:text-sm text-${sibling.gender === 'Female' ? 'pink' : 'indigo'}-700 hover:text-${sibling.gender === 'Female' ? 'pink' : 'indigo'}-900 hover:underline`}
                                        >
                                          {formatPupilDisplayName(sibling)}
                                        </Link>
                                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                                          Sibling
                                        </span>
                                        {!sharesGuardianWithAnchor && (
                                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                                            Different guardian
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-gray-500 sm:text-xs">
                                        <span>{sibling.learnerIdentificationNumber || sibling.admissionNumber || 'No admission number'}</span>
                                        <span aria-hidden="true" className="text-emerald-300">•</span>
                                        <span>{sibling.gender || 'N/A'}</span>
                                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${sibling.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                                          {sibling.status || 'Unknown'}
                                        </span>
                                        {sibling.dateOfBirth && (
                                          <>
                                            <span aria-hidden="true" className="text-emerald-300">•</span>
                                            <span>{calculateAgeAbbreviated(sibling.dateOfBirth)}</span>
                                          </>
                                        )}
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500 sm:hidden">
                                        <span>{getPupilClass(sibling).code || getPupilClass(sibling).name || 'Class N/A'}</span>
                                        {sibling.section && <span>• {sibling.section}</span>}
                                        {getSchoolPayCode(sibling) && <span>• SP: {getSchoolPayCode(sibling)}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                {renderPupilSupportingCells(sibling, { hideFamilyControls: sharesGuardianWithAnchor })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}

                  {/* Infinite scroll sentinel — triggers next batch when it enters the viewport */}
                  {!showSkeleton && !isLoadingPupils && !isPending && (
                    <tr ref={sentinelRef} aria-hidden="true" className="h-px" />
                  )}
                </tbody>
              </table>
            </div>

            {/* 🚀 INFINITE SCROLL STATUS BAR */}
            {totalFilteredCount > 0 && (
              <div className="px-4 py-2.5 border-t border-indigo-100 bg-gradient-to-r from-indigo-50/40 to-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">
                    Showing{' '}
                    <span className="font-semibold text-indigo-600">{filteredAndSortedPupils.length}</span>
                    {' '}of{' '}
                    <span className="font-semibold text-indigo-600">{totalFilteredCount}</span>
                    {' '}pupils
                  </p>
                  {filteredAndSortedPupils.length < totalFilteredCount && (
                    <div className="flex items-center gap-2 text-xs text-indigo-500 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading more&hellip;
                    </div>
                  )}
                  {filteredAndSortedPupils.length >= totalFilteredCount && totalFilteredCount > 0 && (
                    <span className="text-xs text-gray-400">All pupils loaded</span>
                  )}
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
          {/* Switch-to-siblings button — absolute, sits left of the ✕ close button */}
          {(() => {
            const sibCount = selectedPupilGuardians ? getSiblings(selectedPupilGuardians.pupil).length : 0;
            return sibCount > 0 ? (
              <button
                onClick={() => {
                  const p = selectedPupilGuardians!.pupil;
                  const siblings = getSiblings(p);
                  setSelectedPupilGuardians(null);
                  setSelectedPupilSiblings({ pupil: p, pupilName: formatPupilDisplayName(p), siblings });
                }}
                className="absolute right-12 top-3 sm:right-14 sm:top-3.5 flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold border bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 active:scale-95 transition-all z-50"
                title="Switch to Siblings"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Siblings ({sibCount})
              </button>
            ) : null;
          })()}
          {/* Compact inline header — sits on same line as built-in close button */}
          <div className="flex items-center gap-2 pr-32 mb-3">
            <svg className="h-4 w-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              Guardians of <span className="text-blue-700">{selectedPupilGuardians?.pupilName}</span>
            </h2>
          </div>

          <div className="space-y-2">
            {selectedPupilGuardians?.guardians && selectedPupilGuardians.guardians.length > 0 ? (
              selectedPupilGuardians.guardians.map((guardian, index) => (
                <div key={index} className="border rounded-lg px-3 py-2.5 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 group">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
                      {guardian.firstName.charAt(0)}{guardian.lastName.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Name + emergency badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{guardian.firstName} {guardian.lastName}</span>
                        {guardian.id === selectedPupilGuardians?.emergencyContactId && (
                          <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            Emergency
                          </span>
                        )}
                      </div>

                      {/* Compact info line — relationship · phones · email · occupation */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {guardian.relationship && (
                          <span className="text-xs text-gray-500 capitalize">{guardian.relationship}</span>
                        )}
                        {guardian.phone && (
                          <>
                            <span className="text-gray-300 text-xs">·</span>
                            <a href={`tel:${guardian.phone}`} className="text-xs text-blue-600 hover:underline font-medium">
                              {guardian.phone}
                            </a>
                          </>
                        )}
                        {guardian.secondaryPhone && (
                          <>
                            <span className="text-gray-300 text-xs">·</span>
                            <a href={`tel:${guardian.secondaryPhone}`} className="text-xs text-blue-600 hover:underline font-medium">
                              {guardian.secondaryPhone}
                            </a>
                          </>
                        )}
                        {guardian.additionalPhones && guardian.additionalPhones.filter(Boolean).map((ph, i) => (
                          <React.Fragment key={i}>
                            <span className="text-gray-300 text-xs">·</span>
                            <a href={`tel:${ph}`} className="text-xs text-blue-600 hover:underline font-medium">{ph}</a>
                          </React.Fragment>
                        ))}
                        {guardian.email && (
                          <>
                            <span className="text-gray-300 text-xs">·</span>
                            <a href={`mailto:${guardian.email}`} className="text-xs text-blue-600 hover:underline">
                              {guardian.email}
                            </a>
                          </>
                        )}
                        {guardian.occupation && (
                          <>
                            <span className="text-gray-300 text-xs">·</span>
                            <span className="text-xs text-gray-600">{guardian.occupation}</span>
                          </>
                        )}
                      </div>

                      {/* Address on its own line only if provided */}
                      {guardian.address && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{guardian.address}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No guardian information available for this pupil.
              </div>
            )}
          </div>
        </ModernDialogContent>
      </ModernDialog>

      {/* Siblings Information Modal */}
      <ModernDialog
        open={selectedPupilSiblings !== null}
        onOpenChange={() => setSelectedPupilSiblings(null)}
      >
        <ModernDialogContent size="lg">
          {/* Switch-to-guardians button — absolute, sits left of the ✕ close button */}
          {(() => {
            const guardCount = selectedPupilSiblings?.pupil?.guardians?.length ?? 0;
            return guardCount > 0 ? (
              <button
                onClick={() => {
                  const p = selectedPupilSiblings!.pupil;
                  setSelectedPupilSiblings(null);
                  setSelectedPupilGuardians({
                    pupil: p,
                    pupilName: formatPupilDisplayName(p),
                    guardians: p.guardians || [],
                    emergencyContactId: p.emergencyContactGuardianId || '',
                  });
                }}
                className="absolute right-12 top-3 sm:right-14 sm:top-3.5 flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold border bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 active:scale-95 transition-all z-50"
                title="Switch to Guardians"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Guardians ({guardCount})
              </button>
            ) : null;
          })()}
          <div className="flex items-center gap-2 pr-32 mb-3">
            <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              Siblings of <span className="text-green-700">{selectedPupilSiblings?.pupilName}</span>
            </h2>
          </div>

          <div className="space-y-2">
            {selectedPupilSiblings?.siblings && selectedPupilSiblings.siblings.length > 0 ? (
              selectedPupilSiblings.siblings.map((sibling, index) => {
                const siblingClass = classes.find(c => c.id === sibling.classId);
                return (
                  <div key={index} className="border rounded-lg px-3 py-2.5 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 group">
                    <div className="flex items-center gap-3">
                      <Link href={`/pupil-detail?id=${sibling.id}`} className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                        <Avatar className="w-8 h-8 flex-shrink-0 group-hover:ring-2 group-hover:ring-blue-300 transition-all duration-200">
                          {sibling.photo && sibling.photo.trim() !== '' && sibling.photo.startsWith('http') ? (
                            <AvatarImage
                              src={sibling.photo}
                              alt={`${sibling.firstName} ${sibling.lastName}`}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs">
                            {sibling.firstName.charAt(0)}{sibling.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors duration-200 truncate">{formatPupilDisplayName(sibling)}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500">{sibling.admissionNumber}</span>
                            <span className="text-gray-300 text-xs">·</span>
                            <span className="text-xs text-gray-600 font-medium">
                              {siblingClass ? siblingClass.code : 'N/A'}
                            </span>
                            <span className="text-gray-300 text-xs">·</span>
                            <span className="text-xs text-gray-600 capitalize">{sibling.section}</span>
                            <span className="text-gray-300 text-xs">·</span>
                            <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${sibling.status === 'Active'
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
                      </Link>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Link
                          href={`/pupil-detail?id=${sibling.id}`}
                          className="flex items-center justify-center h-7 w-7 rounded-full transition-all border bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 active:scale-95"
                          title="View pupil"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const remaining = (selectedPupilSiblings?.siblings || []).filter(s => s.id !== sibling.id);
                            setUnlinkSiblingConfirm({
                              siblingToUnlink: sibling,
                              remainingSiblings: remaining,
                              viewedPupilName: selectedPupilSiblings?.pupilName || '',
                            });
                          }}
                          className="flex items-center justify-center h-7 w-7 rounded-full transition-all border bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-95"
                          title="Unlink this sibling"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No siblings found for this pupil.
              </div>
            )}
          </div>
        </ModernDialogContent>
      </ModernDialog>

      {/* Unlink Sibling Confirmation Dialog */}
      <ModernDialog
        open={unlinkSiblingConfirm !== null}
        onOpenChange={(open) => { if (!open && !isUnlinking) setUnlinkSiblingConfirm(null); }}
      >
        <ModernDialogContent size="md">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center text-red-700">
              <svg className="mr-2 h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Unlink Sibling
            </ModernDialogTitle>
            <ModernDialogDescription>
              Please review the following before confirming.
            </ModernDialogDescription>
          </ModernDialogHeader>

          {unlinkSiblingConfirm && (
            <div className="space-y-4">
              {/* What will happen */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What will happen:
                </p>
                <ul className="text-sm text-amber-700 space-y-1.5 list-disc list-inside">
                  <li>
                    The system will unlink{' '}
                    <span className="font-bold">
                      {unlinkSiblingConfirm.siblingToUnlink.firstName} {unlinkSiblingConfirm.siblingToUnlink.lastName}
                    </span>{' '}
                    from the family of{' '}
                    <span className="font-bold">
                      {unlinkSiblingConfirm.remainingSiblings.length > 0
                        ? unlinkSiblingConfirm.remainingSiblings.map(s => `${s.firstName} ${s.lastName}`).join(', ')
                        : unlinkSiblingConfirm.viewedPupilName
                      }
                    </span>.
                  </li>
                  <li>
                    A new family code will be created for{' '}
                    <span className="font-bold">
                      {unlinkSiblingConfirm.siblingToUnlink.firstName} {unlinkSiblingConfirm.siblingToUnlink.lastName}
                    </span>.
                  </li>
                  <li>This action will <span className="font-bold">not</span> delete any pupil records.</li>
                </ul>
              </div>

              {/* Pupil being unlinked */}
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <Avatar className="w-10 h-10">
                  {unlinkSiblingConfirm.siblingToUnlink.photo && unlinkSiblingConfirm.siblingToUnlink.photo.startsWith('http') ? (
                    <AvatarImage src={unlinkSiblingConfirm.siblingToUnlink.photo} alt={`${unlinkSiblingConfirm.siblingToUnlink.firstName}`} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-red-400 to-rose-600 text-white font-bold">
                    {unlinkSiblingConfirm.siblingToUnlink.firstName.charAt(0)}{unlinkSiblingConfirm.siblingToUnlink.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-gray-900">{unlinkSiblingConfirm.siblingToUnlink.firstName} {unlinkSiblingConfirm.siblingToUnlink.lastName}</p>
                  <p className="text-xs text-gray-500">{unlinkSiblingConfirm.siblingToUnlink.admissionNumber}</p>
                </div>
              </div>
            </div>
          )}

          <ModernDialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setUnlinkSiblingConfirm(null)}
              disabled={isUnlinking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlinkSibling}
              disabled={isUnlinking}
              className="gap-2"
            >
              {isUnlinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Yes, Unlink Sibling
                </>
              )}
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

      {/* Edit Name Modal */}
      <ModernDialog
        open={editNameModal.isOpen}
        onOpenChange={() => setEditNameModal({ isOpen: false, pupil: null })}
      >
        <ModernDialogContent size="md" open={editNameModal.isOpen} onOpenChange={() => setEditNameModal({ isOpen: false, pupil: null })}>
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center">
              <User className="mr-2 h-5 w-5 text-purple-600" />
              Edit Name - {editNameModal.pupil ? formatPupilDisplayName(editNameModal.pupil) : ''}
            </ModernDialogTitle>
            <ModernDialogDescription>
              Update the pupil's name. First name and last name are required.
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First Name *</Label>
              <Input
                id="edit-first-name"
                type="text"
                value={editFirstName || ''}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="Enter first name"
                className="w-full"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last Name *</Label>
              <Input
                id="edit-last-name"
                type="text"
                value={editLastName || ''}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Enter last name"
                className="w-full"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-other-names">Other Names (Optional)</Label>
              <Input
                id="edit-other-names"
                type="text"
                value={editOtherNames || ''}
                onChange={(e) => setEditOtherNames(e.target.value)}
                placeholder="Enter other names (middle names, etc.)"
                className="w-full"
                autoComplete="off"
              />
            </div>
          </div>

          <ModernDialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEditNameModal({ isOpen: false, pupil: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveName}
              disabled={!editFirstName.trim() || !editLastName.trim() || updatePupilMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {updatePupilMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
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

      <ExportConfigModal
        isOpen={isExportConfigModalOpen}
        onClose={() => setIsExportConfigModalOpen(false)}
        onExport={handleCustomExport}
        pupils={filteredAndSortedPupils}
      />

      {/* View Pupil Photos Detailed Modal */}
      {isExpandedPhotoOpen && (
        <PupilPhotoDetail
          pupilId={selectedPupilPhotoForDetails?.id || null}
          isOpen={isExpandedPhotoOpen}
          onClose={() => {
            setIsExpandedPhotoOpen(false);
            setSelectedPupilPhotoForDetails(null);
          }}
        />
      )}

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
              Print Pupils List
            </ModernDialogTitle>
            <ModernDialogDescription>
              Choose the columns and print layout for a cleaner, more compact list document.
            </ModernDialogDescription>
          </ModernDialogHeader>

            {/* Print Layout — single compact row */}
            <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
              <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Orientation</span>
              <div className="flex items-center gap-1">
                {(['auto', 'portrait', 'landscape'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPrintLayoutOptions(prev => ({ ...prev, orientation: opt }))}
                    className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                      printLayoutOptions.orientation === opt
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Grayscale</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={printLayoutOptions.grayscale}
                  onClick={() => setPrintLayoutOptions(prev => ({ ...prev, grayscale: !prev.grayscale }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    printLayoutOptions.grayscale ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      printLayoutOptions.grayscale ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
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
                    checked={columnSelection.dateOfBirth}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, dateOfBirth: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Date of Birth</span>
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
                    checked={columnSelection.house}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, house: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">House</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.payCode}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, payCode: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Pay Code</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.lin}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, lin: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">LIN</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columnSelection.indexNumber}
                    onChange={(e) => setColumnSelection(prev => ({ ...prev, indexNumber: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Index Number</span>
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
                    dateOfBirth: true,
                    class: true,
                    payCode: true,
                    lin: true,
                    indexNumber: true,
                    codes: false,
                    section: false,
                    status: true,
                    house: false,
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
                    dateOfBirth: true,
                    class: true,
                    payCode: true,
                    lin: true,
                    indexNumber: true,
                    codes: true,
                    section: true,
                    status: true,
                    house: true,
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
                    dateOfBirth: true,
                    class: true,
                    payCode: true,
                    lin: true,
                    indexNumber: true,
                    codes: true,
                    section: true,
                    status: true,
                    house: true,
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
                    dateOfBirth: false,
                    class: false,
                    house: false,
                    payCode: false,
                    lin: false,
                    indexNumber: false,
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
                    Orientation: {printLayoutOptions.orientation === 'auto'
                      ? (() => {
                          const selectedColumns = Object.entries(columnSelection).filter(([_, selected]) => selected);
                          const heavyColumns = ['guardianContacts', 'siblings', 'codes', 'actualPhoto'];
                          const hasHeavyColumns = selectedColumns.some(([column]) => heavyColumns.includes(column));
                          return selectedColumns.length > 7 || hasHeavyColumns ? 'Landscape (Auto)' : 'Portrait (Auto)';
                        })()
                      : `${printLayoutOptions.orientation.charAt(0).toUpperCase()}${printLayoutOptions.orientation.slice(1)} (Manual)`}
                  </p>
                  <p className="text-blue-700 mt-1 text-xs">
                    Style: Compact table with smaller fonts{printLayoutOptions.grayscale ? ' in gray scale' : ''}.
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
                onClick={handleGenerateCompactPDF}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Printer className="mr-2 h-4 w-4" />
                Generate PDF
              </Button>
            )}
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

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
      {/* Filters Modal */}
      <ModernDialog
        open={isFilterPopupOpen}
        onOpenChange={setIsFilterPopupOpen}
      >
        <ModernDialogContent size="md">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2 text-indigo-900">
              <FunnelSimple size={20} className="text-indigo-600 animate-[pulse_2s_infinite]" weight="duotone" />
              Filter Pupils
            </ModernDialogTitle>
            <ModernDialogDescription className="text-gray-500">
              Apply filters to narrow down the list of pupils.
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white focus:outline-none transition-all duration-200 hover:bg-white"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Graduated">Graduated</option>
                <option value="Transferred">Transferred</option>
                <option value="Suspended">Suspended</option>
                <option value="Withdrawn">Withdrawn</option>
              </select>
            </div>

            {/* Gender Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Gender</label>
              <select
                value={filters.gender}
                onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white focus:outline-none transition-all duration-200 hover:bg-white"
              >
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Section Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Section</label>
              <select
                value={filters.section}
                onChange={(e) => setFilters(prev => ({ ...prev, section: e.target.value }))}
                className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white focus:outline-none transition-all duration-200 hover:bg-white"
              >
                <option value="">All Sections</option>
                <option value="Boarding">Boarding</option>
                <option value="Day">Day</option>
              </select>
            </div>

            {/* Photo Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Photo</label>
              <select
                value={filters.photoFilter}
                onChange={(e) => setFilters(prev => ({ ...prev, photoFilter: e.target.value as Filters['photoFilter'] }))}
                className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white focus:outline-none transition-all duration-200 hover:bg-white"
              >
                <option value="all">All pupils</option>
                <option value="with">With photo</option>
                <option value="without">Without photo</option>
              </select>
            </div>

            {/* Age Range Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Age Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={filters.ageRange.max}
                  value={filters.ageRange.min}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    ageRange: { ...prev.ageRange, min: parseInt(e.target.value) || 0 }
                  }))}
                  className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white text-center focus:outline-none transition-all duration-200 hover:bg-white"
                  placeholder="Min age"
                />
                <span className="text-xs text-indigo-400 font-medium">—</span>
                <input
                  type="number"
                  min={filters.ageRange.min}
                  value={filters.ageRange.max}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    ageRange: { ...prev.ageRange, max: parseInt(e.target.value) || 0 }
                  }))}
                  className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white text-center focus:outline-none transition-all duration-200 hover:bg-white"
                  placeholder="Max age"
                />
              </div>
            </div>

            {/* Codes Filter */}
            <div className="col-span-1 sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-indigo-950">Codes Filter</label>
              <div className="flex gap-2">
                <select
                  value={filters.hasCodeType || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasCodeType: e.target.value }))}
                  className="w-[60%] rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white focus:outline-none transition-all duration-200 hover:bg-white"
                >
                  <option value="">Any Identifier Code</option>
                  {availableIdTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={filters.hasCodeFilterType || 'with'}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasCodeFilterType: e.target.value as 'with' | 'without' }))}
                  disabled={!filters.hasCodeType}
                  className="w-[40%] rounded-xl border border-gray-200/80 bg-gray-50/50 py-2 px-3 text-xs shadow-sm focus:ring-2 focus:ring-blue-400/50 focus:bg-white focus:outline-none transition-all duration-200 hover:bg-white disabled:opacity-55"
                >
                  <option value="with">With</option>
                  <option value="without">Without</option>
                </select>
              </div>
            </div>
          </div>

          <ModernDialogFooter className="flex justify-between items-center mt-2">
            {activeFiltersCount > 0 ? (
              <button
                onClick={() => {
                  handleClearFilters();
                  setIsFilterPopupOpen(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-full border border-rose-100 transition-all duration-200"
              >
                <X size={12} />
                <span>Clear All ({activeFiltersCount})</span>
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={() => setIsFilterPopupOpen(false)}
              className="inline-flex items-center justify-center h-8 px-4 rounded-full font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all duration-200"
            >
              Done
            </button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      {/* Family Account & Siblings Modal for Fees Collection */}
      <ModernDialog open={selectedFamilyPupil !== null} onOpenChange={(open) => { if (!open) setSelectedFamilyPupil(null); }}>
        <ModernDialogContent className="max-w-md">
          <ModernDialogHeader>
            <ModernDialogTitle className="flex items-center gap-2">
              <LucideUsers className="h-5 w-5 text-teal-600" />
              Family Account Options
            </ModernDialogTitle>
            <ModernDialogDescription>
              Choose whether to view the combined family account or navigate to a sibling's fee collection.
            </ModernDialogDescription>
          </ModernDialogHeader>

          <div className="space-y-4 py-3">
            {/* Family Account Link Button */}
            <Link
              href={`/fees/family/${selectedFamilyPupil?.familyId}`}
              onClick={() => setSelectedFamilyPupil(null)}
              className="flex items-center justify-between p-4 rounded-xl border border-teal-100 bg-teal-50/50 hover:bg-teal-50 hover:border-teal-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
                  <LucideUsers className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-teal-900">View Family Account</p>
                  <p className="text-xs text-teal-700/80">Combined school fees statement for all siblings</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-teal-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Sibling Fees Links */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Sibling Fees Collection</p>
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                {/* Current Pupil option first */}
                {selectedFamilyPupil && (
                  <Link
                    key={selectedFamilyPupil.id}
                    href={`/fees/collect/${selectedFamilyPupil.id}`}
                    onClick={() => setSelectedFamilyPupil(null)}
                    className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50/60 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 border border-indigo-200">
                        <AvatarImage
                          src={selectedFamilyPupil.photo && selectedFamilyPupil.photo.trim() !== '' ? selectedFamilyPupil.photo : undefined}
                          alt={`${selectedFamilyPupil.firstName} ${selectedFamilyPupil.lastName}`}
                        />
                        <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 font-bold">
                          {selectedFamilyPupil.firstName?.[0] || 'P'}{selectedFamilyPupil.lastName?.[0] || 'P'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="font-semibold text-sm text-indigo-900 transition-colors">
                          {selectedFamilyPupil.firstName} {selectedFamilyPupil.lastName} (Current)
                        </p>
                        <p className="text-xs text-indigo-700/80 font-mono">
                          {classes.find(c => c.id === selectedFamilyPupil.classId)?.code || classes.find(c => c.id === selectedFamilyPupil.classId)?.name || 'N/A'} • {selectedFamilyPupil.admissionNumber}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-xs text-indigo-500 group-hover:text-indigo-700 transition-colors">Shs.</span>
                  </Link>
                )}

                {/* Sibling options */}
                {selectedFamilyPupil && getSiblings(selectedFamilyPupil).map((sibling) => (
                  <Link
                    key={sibling.id}
                    href={`/fees/collect/${sibling.id}`}
                    onClick={() => setSelectedFamilyPupil(null)}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 border">
                        <AvatarImage
                          src={sibling.photo && sibling.photo.trim() !== '' ? sibling.photo : undefined}
                          alt={`${sibling.firstName} ${sibling.lastName}`}
                        />
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                          {sibling.firstName?.[0] || 'S'}{sibling.lastName?.[0] || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {sibling.firstName} {sibling.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {classes.find(c => c.id === sibling.classId)?.code || classes.find(c => c.id === sibling.classId)?.name || 'N/A'} • {sibling.admissionNumber}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-xs text-muted-foreground group-hover:text-emerald-600 transition-colors">Shs.</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <ModernDialogFooter>
            <Button variant="outline" onClick={() => setSelectedFamilyPupil(null)} className="w-full">
              Close
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>

      <ManagePayCodeModal
        isOpen={isManagePayCodeModalOpen}
        onClose={() => {
          setIsManagePayCodeModalOpen(false);
          setSelectedPupilForPayCode(null);
        }}
        onSave={handleSavePayCode}
        currentPayCode={
            getSchoolPayCode(selectedPupilForPayCode) || null
        }
        pupilName={
          selectedPupilForPayCode
            ? `${selectedPupilForPayCode.firstName} ${selectedPupilForPayCode.lastName}`
            : ''
        }
      />
    </div>
  );
}

export default function PupilsPage() {
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();

  return (
    <Suspense fallback={
      <div className="min-h-screen p-6">
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
