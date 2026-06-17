"use client";

import {
  MagnifyingGlass,
  Bell,
  List,
  X,
  CurrencyDollar,
  User,
  Gear,
  SignOut,
  CaretDown,
  CheckCircle,
  XCircle,
  GraduationCap,
  Calendar,
  UserCircle,
  Info,
  Sparkle,
  DotsThree,
  Funnel
} from '@phosphor-icons/react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LogoutMessage from '@/components/common/LogoutMessage';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import quotes from '@/data/quotes.json';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { format } from 'date-fns';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { NetworkStrengthIndicator } from './network-strength-indicator';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { useSchoolPayBadge } from '@/lib/hooks/use-schoolpay-badge';
import { Zap } from 'lucide-react';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';


// We need to declare the module to add types that include className
declare module 'framer-motion' {
  export interface MotionProps {
    className?: string;
  }
}

interface HeaderProps {
  onMenuClick: () => void;
  showMenuButton: boolean;
  loadSchoolSettings?: boolean;
}

import { Pupil } from '@/types';

// Lightweight spring configs — lower stiffness / higher damping for buttery feel
const springConfig = {
  type: "spring" as const,
  stiffness: 200,
  damping: 28,
  mass: 0.6
};

const softSpring = {
  type: "spring" as const,
  stiffness: 150,
  damping: 30,
  mass: 0.8
};

// Text crossfade — opacity-only (no blur) for GPU perf
const messageVariants = {
  enter: {
    opacity: 0,
    y: 8,
  },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: "easeIn" }
  },
};

// Subtle float — small amplitude, GPU-only `transform`
const floatAnimation = {
  y: [0, -4, 0],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut",
    repeatType: "loop" as const,
  }
};

// Button hover — quick, subtle scale only
const buttonHover = {
  scale: 1.06,
  transition: { type: "spring", stiffness: 300, damping: 22 }
};

const buttonTap = {
  scale: 0.94,
};

// Sparkle — scale only, no rotate (avoids layout repaint)
const sparkleAnimation = {
  scale: [1, 1.15, 1],
  opacity: [0.7, 1, 0.7],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut",
    repeatType: "loop" as const,
  }
};

// Bell swing — single smooth rock for minimal jank
const bellSwing = {
  rotate: [0, 10, -10, 6, -4, 0],
  transition: {
    duration: 0.7,
    ease: "easeInOut"
  }
};

// Icon pulse — opacity only (much lighter than scale+opacity)
const pulseAnimation = {
  opacity: [0.75, 1, 0.75],
  transition: {
    duration: 2.5,
    repeat: Infinity,
    ease: "easeInOut",
    repeatType: "loop" as const,
  }
};

// Utility function to get time-based greeting
const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 22) return "Good Evening";
  return "Good Night";
};

const EnhancedHeader = ({ onMenuClick, showMenuButton, loadSchoolSettings = true }: HeaderProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Safely get sidebar context - handle case where SidebarProvider might not be available
  let sidebarIsMobile = false;
  try {
    const sidebarContext = useSidebar();
    sidebarIsMobile = sidebarContext.isMobile;
  } catch (error) {
    // useSidebar is not available (e.g., for Parent interface)
    sidebarIsMobile = false;
  }

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Pupil[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchHovered, setIsSearchHovered] = useState(false);
  const [searchAnimationPhase, setSearchAnimationPhase] = useState<'logo' | 'name' | 'search'>('logo');
  const [searchAnimationComplete, setSearchAnimationComplete] = useState(false);
  const [searchBarWidth, setSearchBarWidth] = useState<'w-32' | 'w-64' | 'auto'>('w-32');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);

  // State for the top bar message
  const { data: settings } = useSchoolSettings({ enabled: loadSchoolSettings });
  const { data: pupils } = usePupils();
  const { data: classes } = useClasses(); // 🚀 CRITICAL: Fetch classes to show up-to-date class names
  const [phase, setPhase] = useState<'welcome' | 'motto' | 'quote'>('welcome');
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState<number>(0);
  const [currentMessage, setCurrentMessage] = useState<string>(getTimeBasedGreeting());
  const [bellShouldShake, setBellShouldShake] = useState(false);
  const motto = loadSchoolSettings ? (settings?.generalInfo?.motto || "") : "";

  // SchoolPay feed badge — count of unseen payments
  const schoolPayBadge = useSchoolPayBadge();
  // Permission check: only show SchoolPay icon for users who can access the feed page
  const canSeeSchoolPayFeed = GranularPermissionService.canAccessPage(user as any, 'fees', 'schoolpay_feed');


  // Fetch Academic Years to display Term Info
  const { data: academicYears } = useAcademicYears();
  // Use the same global two-pass search as the rest of the app
  const _effectiveTerm = useMemo(() =>
    academicYears ? getEffectiveTermForDataDisplay(academicYears) : null,
    [academicYears]);
  const currentAcademicYear = _effectiveTerm?.academicYear ?? undefined;
  const currentTerm = _effectiveTerm?.term ?? undefined;

  // Calculate term progress and days
  const termStats = useMemo(() => {
    if (!currentTerm || !currentTerm.startDate || !currentTerm.endDate) return null;
    const start = new Date(currentTerm.startDate).getTime();
    const end = new Date(currentTerm.endDate).getTime();
    const now = new Date().getTime();

    // Normalize to days
    const ONE_DAY = 1000 * 60 * 60 * 24;
    const totalDays = Math.ceil((end - start) / ONE_DAY);
    let elapsedDays = 0;

    if (now > end) {
      elapsedDays = totalDays;
    } else if (now > start) {
      elapsedDays = Math.ceil((now - start) / ONE_DAY);
    }

    const progress = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0;
    return { progress, elapsedDays, totalDays };
  }, [currentTerm]);

  // Search bar animation sequence
  useEffect(() => {
    if (!settings || searchAnimationComplete) return;

    const sequence = async () => {
      // Phase 1: Show logo (1 second)
      setSearchAnimationPhase('logo');
      setSearchBarWidth('w-32');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Phase 2: Slide to school name (1.5 seconds) - expand to fit name
      if (settings.generalInfo?.name) {
        setSearchAnimationPhase('name');
        // Expand to accommodate school name (first two words)
        const schoolNameWords = settings.generalInfo.name.split(' ').slice(0, 2).join(' ');
        // Estimate width: ~8px per character + padding
        const estimatedWidth = Math.max(256, schoolNameWords.length * 8 + 80);
        setSearchBarWidth('w-64'); // Use w-64 as base, will expand if needed
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Phase 3: Show "Search" (final state)
      setSearchAnimationPhase('search');
      setSearchBarWidth('w-32');
      setSearchAnimationComplete(true);
    };

    sequence();
  }, [settings, searchAnimationComplete]);

  // Add real-time clock update and window resize handler
  useEffect(() => {
    setMounted(true);

    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    // Handle window resize for responsive quote display
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial window width *after mount*
    setWindowWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    classId: '',
    section: '',
    gender: '',
    status: ''
  });

  // Handle search input changes
  useEffect(() => {
    const searchPupils = async () => {
      // Allow searching with just filters if search term is empty but filters are set
      const hasFilters = filters.classId || filters.section || filters.gender || filters.status;

      if (searchTerm.length < 1 && !hasFilters) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        if (pupils) {
          // Filter pupils based on search term
          const term = searchTerm.toLowerCase();
          const searchTerms = term.split(' ').filter(t => t.length > 0);

          const filtered = pupils.filter((pupil: Pupil) => {
            // 1. Text Search
            let matchesText = true;
            if (searchTerms.length > 0) {
              // Create a searchable string containing all relevant fields
              const searchableText = `${pupil.lastName} ${pupil.firstName} ${pupil.otherNames || ''} ${pupil.admissionNumber}`.toLowerCase();
              matchesText = searchTerms.every(t => searchableText.includes(t));
            }

            // 2. Filter Logic
            let matchesFilters = true;
            if (filters.classId && pupil.classId !== filters.classId) matchesFilters = false;
            if (filters.section && pupil.section !== filters.section) matchesFilters = false;
            if (filters.gender && pupil.gender !== filters.gender) matchesFilters = false;
            if (filters.status && pupil.status !== filters.status) matchesFilters = false;

            return matchesText && matchesFilters;
          });

          setSearchResults(filtered);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Error searching pupils:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchPupils, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, pupils, filters]);

  // useEffect for Top Bar Message Logic
  useEffect(() => {
    let phaseTimer: NodeJS.Timeout;
    let quoteInterval: NodeJS.Timeout;

    if (phase === 'welcome') {
      setCurrentMessage(getTimeBasedGreeting() + '!');
      phaseTimer = setTimeout(() => setPhase('motto'), 4000); // Slightly longer to enjoy the greeting
    } else if (phase === 'motto') {
      if (motto) {
        setCurrentMessage(`"${motto}"`);
        // Stay on motto, do not transition to quote
      } else {
        // If no motto, go back to time-based greeting
        setPhase('welcome');
      }
    }
    // Quote phase removed

    return () => {
      clearTimeout(phaseTimer);
    };
  }, [phase, motto, currentQuoteIndex]);

  // Format date and time with responsive formatting
  const formattedDateTime = useMemo(() => {
    if (!mounted) {
      const serverTime = new Date();
      return serverTime.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
    const isMobile = windowWidth < 768;
    const options: Intl.DateTimeFormatOptions = isMobile
      ? {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric'
      }
      : {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
    return currentDateTime.toLocaleDateString('en-US', options);
  }, [currentDateTime, windowWidth, mounted]);

  // Truncate message based on available space
  const getTruncatedMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message;

    // Find a good breaking point (prefer breaking at word boundaries)
    const truncated = message.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    // If we can break at a word boundary and it's not too short, do so
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  };

  // Get dynamic truncation length based on screen size - more aggressive
  const getDynamicTruncationLength = () => {
    if (!mounted) return 80;

    if (windowWidth >= 1536) return 150; // 2xl - more generous
    if (windowWidth >= 1280) return 130; // xl - more generous
    if (windowWidth >= 1024) return 110; // lg - more generous
    if (windowWidth >= 768) return 85;   // md - more generous
    // For smaller screens, account for mobile sidebar trigger
    if (sidebarIsMobile && windowWidth < 768) return 60; // Reduced for mobile with sidebar trigger
    return 80; // Default for sm and below, allows more text before "..." if not clamped by 2 lines
  };

  // Check if we should show full quote based on screen size and available space
  const shouldShowFullQuote = () => {
    if (windowWidth === 0) return false; // Not yet initialized
    if (windowWidth < 768) return false; // On small screens, we use two-line clamping, not "full quote" for multi-line

    // Calculate approximate characters that can fit based on screen width
    // More aggressive space utilization across all screen sizes
    const getMaxCharactersForWidth = (width: number) => {
      if (width >= 1536) return 200; // 2xl screens - very generous
      if (width >= 1280) return 180; // xl screens
      if (width >= 1024) return 160; // lg screens
      if (width >= 768) return 120;  // md screens - more generous
      // Below md, account for mobile sidebar trigger button
      if (width >= 640) return sidebarIsMobile ? 80 : 100; // Reduced for mobile with sidebar trigger
      if (width >= 480) return sidebarIsMobile ? 65 : 85;  // Reduced for mobile with sidebar trigger
      return sidebarIsMobile ? 50 : 70; // Reduced for mobile with sidebar trigger
    };

    const maxChars = getMaxCharactersForWidth(windowWidth);

    // Show full quote if it fits within the calculated space
    // Reduced buffer for more aggressive space usage (5% instead of 10%)
    return currentMessage.length <= (maxChars * 0.95);
  };

  // Determines if the quote is long enough to be expandable (either truncated or clamped)
  const isQuoteExpandable = () => {
    if (phase !== 'quote') return false;
    if (windowWidth < 768) { // Small screens: check if message is longer than what 2 lines might roughly hold
      // Estimate based on typical characters per line for small screens (e.g. 30-40 chars/line * 2 lines)
      // Or simply, if it's longer than a typical short sentence. This is an approximation.
      // The getDynamicTruncationLength provides a reasonable threshold here.
      return currentMessage.length > getDynamicTruncationLength();
    }
    // Large screens: check if not showing full quote and message is longer than truncation length
    return !shouldShowFullQuote() && currentMessage.length > getDynamicTruncationLength();
  };

  const handleMessageClick = () => {
    if (isQuoteExpandable()) {
      setIsQuoteExpanded(!isQuoteExpanded);
    }
  };

  // Handle pupil selection
  const handlePupilSelect = (pupilId: string) => {
    setShowResults(false);
    setSearchTerm('');
    setShowMobileSearch(false);

    // Add zoom animation
    const element = document.getElementById('dashboard-content');
    if (element) {
      element.style.transformOrigin = 'center center';
      element.style.animation = 'zoomOut 0.3s ease-in-out';
      setTimeout(() => {
        router.push(`/pupil-detail?id=${pupilId}`);
      }, 300);
    } else {
      router.push(`/pupil-detail?id=${pupilId}`);
    }
  };

  // Handle click outside for user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle click outside for mobile search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(event.target as Node)) {
        setShowMobileSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    setShowLogoutMessage(true);

    setTimeout(async () => {
      await logout();
      router.replace('/login');
    }, 2000);
  };


  return (
    <>
      <header className="bg-white/72 dark:bg-slate-950/72 backdrop-blur-[20px] border-b border-white/45 dark:border-slate-800/45 sticky md:absolute top-0 left-0 right-0 z-40 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="px-2 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-11 sm:h-13">
            {/* Left side: Mobile Sidebar Trigger, Menu Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 mr-1.5 sm:mr-3 lg:mr-4 flex-shrink-0">
              {/* Mobile Sidebar Trigger */}
              {sidebarIsMobile && (
                <motion.div
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  transition={springConfig}
                >
                  <SidebarTrigger className="md:hidden h-8 w-8 sm:h-[36px] sm:w-[36px] rounded-full bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 text-white shadow-sm flex-shrink-0 flex items-center justify-center border-0 relative overflow-hidden" />
                </motion.div>
              )}

              {showMenuButton && (
                <motion.button
                  onClick={onMenuClick}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  transition={springConfig}
                  className="h-8 w-8 sm:h-[36px] sm:w-[36px] rounded-full flex items-center justify-center bg-white hover:bg-blue-50/80 text-gray-600 hover:text-blue-600 border border-gray-200/60 shadow-sm flex-shrink-0 transition-all"
                  style={{ boxShadow: "0 1px 4px rgba(59, 130, 246, 0.05)" }}
                >
                  <List size={17} weight="duotone" />
                </motion.button>
              )}
            </div>

            {/* Center: Dynamic School Info / Message Pill — fully fluid */}
            <div className="flex-1 min-w-0 h-full flex items-center justify-center overflow-hidden px-1.5 sm:px-2 lg:px-4">
              <motion.div
                whileHover={{
                  scale: 1.015,
                  boxShadow: "0 4px 10px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.18)"
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full max-w-[680px] h-[34px] sm:h-[36px] px-2.5 sm:px-4 flex items-center justify-center gap-1.5 sm:gap-2 font-semibold rounded-full bg-gradient-to-r from-blue-50 via-white to-blue-50 cursor-pointer border border-blue-200/60 shadow-sm relative overflow-hidden header-shimmer"
                style={{
                  boxShadow: "0 2px 6px rgba(59, 130, 246, 0.05)",
                  willChange: "transform",
                }}
                onClick={handleMessageClick}
              >
                {/* Sparkle — only on sm+ */}
                <Sparkle size={12} weight="fill" className="hidden sm:block flex-shrink-0 text-blue-500/70" />

                {/* Animated message text */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMessage}
                    variants={messageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="flex-1 min-w-0 flex items-center justify-center overflow-hidden"
                  >
                    <span
                      className="w-full text-center bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent font-semibold tracking-wide truncate"
                      style={{
                        fontSize: "clamp(10px, 1.8vw, 13px)",
                        backgroundSize: '200% auto',
                      }}
                    >
                      {currentMessage}
                    </span>
                  </motion.div>
                </AnimatePresence>

                {/* Sparkle — only on sm+ */}
                <Sparkle size={12} weight="fill" className="hidden sm:block flex-shrink-0 text-blue-500/70" />
              </motion.div>
            </div>

            {/* Right side: Search, DateTime, User Menu */}
            <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-3 transition-all duration-300 flex-shrink-0">
              {/* DateTime — hidden on mobile, shown from lg */}
              <motion.div
                whileHover={{
                  scale: 1.02,
                  y: -1,
                  boxShadow: "0 4px 8px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)"
                }}
                whileTap={{ scale: 0.98 }}
                transition={springConfig}
                className="hidden lg:flex items-center gap-1.5 h-[34px] px-2.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 backdrop-blur-sm rounded-full border border-blue-200/60 shadow-sm relative overflow-hidden cursor-pointer header-shimmer"
                style={{ willChange: "transform" }}
              >
                {/* Shimmer is now CSS-only — no motion loop needed */}

                <Calendar size={14} className="text-blue-600 flex-shrink-0" weight="duotone" />
                <span className="text-[11px] font-semibold bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent relative z-10 whitespace-nowrap">
                  {formattedDateTime}
                </span>
              </motion.div>

              {/* Term Progress — only xl+ screens */}
              {currentAcademicYear && currentTerm && (
                <motion.div
                  whileHover={{
                    scale: 1.02,
                    y: -1,
                    boxShadow: "0 4px 8px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2)"
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={springConfig}
                  className="hidden xl:flex items-center gap-1.5 h-[34px] px-2.5 bg-gradient-to-r from-emerald-50/80 via-teal-50/80 to-cyan-50/80 backdrop-blur-sm rounded-full border border-emerald-200/60 shadow-sm relative overflow-hidden cursor-pointer header-shimmer"
                  style={{ willChange: "transform" }}
                >
                  {/* Shimmer handled by CSS — no blocking framer-motion loop */}

                  <GraduationCap size={13} className="text-emerald-600 flex-shrink-0 relative z-10" weight="duotone" />
                  <div className="flex flex-col relative z-10 leading-tight justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider leading-none">
                        {currentAcademicYear.name} • {currentTerm.name}
                      </span>
                      {termStats && (
                        <span className="text-[9px] font-semibold text-emerald-600 opacity-90 leading-none">
                          ({termStats.elapsedDays}/{termStats.totalDays}d)
                        </span>
                      )}
                    </div>
                    {termStats && (
                      <div className="flex items-center gap-1.5 mt-[4px]">
                        <div className="w-16 h-1 bg-emerald-200/60 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${termStats.progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-[8px] font-bold text-emerald-700 leading-none">{termStats.progress}%</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Desktop Search Bar — hidden on mobile, shown from md */}
              {user?.role !== 'Parent' && (
                <div
                  id="search-container"
                  className="hidden md:block relative z-50 transition-all duration-300 group"
                  onMouseEnter={() => setIsSearchHovered(true)}
                  onMouseLeave={() => setIsSearchHovered(false)}
                  onFocus={() => {
                    setIsSearchHovered(true);
                    setSearchAnimationComplete(true);
                    setSearchAnimationPhase('search');
                  }}
                  onBlur={() => {
                    if (!searchTerm && !showFilters) {
                      setIsSearchHovered(false);
                    }
                  }}
                >
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-blue-500/80 group-hover:text-blue-600 transition-colors duration-300 z-10">
                    <MagnifyingGlass size={14} weight="duotone" className="transition-all duration-300 group-hover:scale-110" />
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder=""
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setSearchAnimationComplete(true);
                        setSearchAnimationPhase('search');
                        setSearchBarWidth('w-32');
                      }}
                      className={`pl-7 pr-8 h-[34px] text-xs bg-white/90 rounded-full focus:ring-2 focus:ring-blue-400/50 focus:outline-none shadow-sm hover:shadow-md transition-all duration-300 ease-in-out border border-blue-200/60 ${searchTerm.length > 0 || isSearchHovered || showFilters
                        ? 'w-56 lg:w-72'
                        : searchAnimationPhase === 'name'
                          ? 'w-auto min-w-[160px] max-w-[240px]'
                          : searchBarWidth
                        }`}
                      style={{ boxShadow: "0 1px 4px rgba(59, 130, 246, 0.05)" }}
                    />

                    {/* Animated placeholder content */}
                    {!searchTerm && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                        <AnimatePresence mode="wait">
                          {searchAnimationPhase === 'logo' && settings?.generalInfo?.logo && !searchAnimationComplete && (
                            <motion.div
                              key="logo"
                              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              className="flex items-center justify-center"
                            >
                              <div className="relative w-6 h-6">
                                <Image
                                  src={settings.generalInfo.logo}
                                  alt="School Logo"
                                  fill
                                  sizes="24px"
                                  className="object-contain rounded"
                                />
                              </div>
                            </motion.div>
                          )}
                          {searchAnimationPhase === 'name' && settings?.generalInfo?.name && !searchAnimationComplete && (
                            <motion.div
                              key="name"
                              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              className="text-xs text-gray-400 font-medium whitespace-nowrap pl-4 pr-12"
                            >
                              {settings.generalInfo.name.split(' ').slice(0, 2).join(' ')}
                            </motion.div>
                          )}
                          {(searchAnimationPhase === 'search' || searchAnimationComplete) && (
                            <motion.div
                              key="search"
                              initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              className="text-xs text-gray-400 font-medium tracking-wide pl-4 pr-12"
                            >
                              Search...
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Filter and Clear Buttons */}
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1 z-10">
                      {isSearching ? (
                        <div className="animate-spin rounded-full h-3 w-3 border border-blue-500 border-t-transparent mr-1" />
                      ) : (
                        searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="text-gray-400 hover:text-red-500 transition-colors duration-200 p-1"
                            type="button"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )
                      )}

                      {/* Filter Button - Conditional Display */}
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] flex items-center justify-center rounded-full transition-all duration-200 ${showFilters || (filters && (filters.classId || filters.section || filters.gender || filters.status))
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 opacity-100'
                          : isSearchHovered || searchTerm.length > 0
                            ? 'text-gray-400 hover:text-blue-500 hover:bg-gray-100 opacity-100'
                            : 'opacity-0 pointer-events-none'
                          }`}
                        title="Search Filters"
                        type="button"
                      >
                        <Funnel size={14} weight={showFilters || (filters && (filters.classId || filters.section || filters.gender || filters.status)) ? "fill" : "regular"} />
                      </button>
                    </div>
                  </div>



                  {/* Consolidated Search Results & Filters Dropdown */}
                  <AnimatePresence>
                    {(showResults || showFilters) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-2 w-80 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-blue-100/50 overflow-hidden z-50"
                      >
                        {/* Filters Section (Compact) */}
                        {showFilters && (
                          <div className="p-3 bg-slate-50 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-semibold text-gray-700">Filters</h3>
                              <button
                                onClick={() => setFilters({ classId: '', section: '', gender: '', status: '' })}
                                className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                              >
                                Reset
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {/* Class Filter */}
                              <select
                                value={filters.classId}
                                onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
                                className="w-full text-xs rounded-md border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white py-1"
                              >
                                <option value="">All Classes</option>
                                {classes?.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>

                              {/* Section Filter */}
                              <select
                                value={filters.section}
                                onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                                className="w-full text-xs rounded-md border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white py-1"
                              >
                                <option value="">All Sections</option>
                                <option value="Day">Day</option>
                                <option value="Boarding">Boarding</option>
                              </select>

                              {/* Gender Filter */}
                              <select
                                value={filters.gender}
                                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                                className="w-full text-xs rounded-md border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white py-1"
                              >
                                <option value="">All Genders</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>

                              {/* Status Filter */}
                              <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full text-xs rounded-md border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white py-1"
                              >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Graduated">Graduated</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Search Results List */}
                        {searchResults.length > 0 ? (
                          <div className="max-h-60 overflow-y-auto">
                            {searchResults.map((pupil: Pupil) => {
                              // Dynamic class lookup
                              const pupilClass = classes?.find((c: any) => c.id === pupil.classId);
                              // Use class code (e.g. P.1) instead of full name
                              const classDisplay = pupilClass ? pupilClass.code : (pupil.classCode || pupil.className || pupil.classId);

                              // Status icons
                              let StatusIcon = CheckCircle;
                              let statusColor = 'text-gray-400';
                              let statusBg = 'bg-gray-50'; // Default background

                              if (pupil.status === 'Active') {
                                StatusIcon = CheckCircle;
                                statusColor = 'text-green-500'; // Slightly brighter green
                                statusBg = 'bg-green-50';
                              } else if (pupil.status === 'Graduated') {
                                StatusIcon = GraduationCap;
                                statusColor = 'text-purple-500';
                                statusBg = 'bg-purple-50';
                              } else if (pupil.status === 'Inactive') {
                                StatusIcon = XCircle;
                                statusColor = 'text-red-500';
                                statusBg = 'bg-red-50';
                              }

                              return (
                                <div
                                  key={pupil.id}
                                  className="px-3 py-2 border-b last:border-b-0 transition-all duration-200 hover:bg-blue-50/80 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between">
                                    <div
                                      onClick={() => handlePupilSelect(pupil.id)}
                                      className="flex-1 min-w-0 mr-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        {/* Status Icon - Inline before name */}
                                        <div className={`flex items-center justify-center p-0.5 rounded-full ${statusBg}`} title={pupil.status || 'Unknown'}>
                                          <StatusIcon size={14} weight="fill" className={statusColor} />
                                        </div>

                                        <p className="text-sm font-medium text-gray-900 break-words">
                                          {formatPupilDisplayName(pupil)}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5 pl-6 flex-wrap">
                                        {/* Additional info below name (indented) */}
                                        <span className="text-xs text-gray-500">
                                          {pupil.admissionNumber}
                                        </span>

                                        {pupil.status === 'Graduated' && pupil.graduationYear && (
                                          <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-100">
                                            {pupil.graduationYear}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                        {classDisplay}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/fees/collect/${pupil.id}`);
                                        }}
                                        className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-all duration-200"
                                        title="View Fees"
                                        type="button"
                                      >
                                        <CurrencyDollar size={14} weight="duotone" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          // No Results Message (only if searching but found nothing)
                          searchTerm && (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              No pupils found matching "{searchTerm}"
                            </div>
                          )
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Mobile Search Button — only on small screens */}
              {user?.role !== 'Parent' && (
                <motion.button
                  onClick={() => setShowMobileSearch(!showMobileSearch)}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  transition={springConfig}
                  className="md:hidden h-8 w-8 bg-white text-gray-600 border border-gray-200/60 hover:text-blue-600 hover:bg-blue-50/80 flex items-center justify-center rounded-full shadow-sm"
                  type="button"
                >
                  <MagnifyingGlass size={16} weight="duotone" />
                </motion.button>
              )}

              {/* Network Strength Indicator */}
              <NetworkStrengthIndicator />

              {/* SchoolPay Live Feed Icon + Badge */}
              {canSeeSchoolPayFeed && (
                <motion.button
                  onClick={() => router.push('/accounts/schoolpay-feed')}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  transition={springConfig}
                  className="relative h-8 w-8 bg-white border border-violet-200/70 hover:bg-violet-50 hover:border-violet-400 text-violet-500 hover:text-violet-700 flex items-center justify-center rounded-full shadow-sm transition-all"
                  title="SchoolPay Live Feed"
                  type="button"
                >
                  <Zap size={15} className={schoolPayBadge > 0 ? 'text-violet-600' : 'text-violet-400'} />
                  {schoolPayBadge > 0 && (
                    <motion.span
                      key={schoolPayBadge}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white"
                    >
                      {schoolPayBadge > 99 ? '99+' : schoolPayBadge}
                    </motion.span>
                  )}
                </motion.button>
              )}

              {/* User Profile */}
              <div className="relative" ref={userMenuRef}>
                <motion.div
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  whileHover={{
                    scale: 1.02,
                    y: -1,
                    boxShadow: "0 4px 8px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.2)"
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={springConfig}
                  className="flex items-center gap-1 sm:gap-1.5 h-8 sm:h-[34px] px-1 sm:px-1.5 rounded-full cursor-pointer bg-gradient-to-r from-blue-50/80 via-white to-blue-50/80 backdrop-blur-sm border border-blue-200/60 shadow-sm relative overflow-hidden header-shimmer"
                  style={{ willChange: "transform" }}
                >
                  {/* Shimmer is CSS-only — no framer-motion loop in user badge */}

                  <div className="relative z-10 flex items-center justify-center">
                    {false ? (
                      <img
                        src={undefined}
                        alt={`${user?.firstName} ${user?.lastName}`}
                        className="w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] rounded-full object-cover ring-1 ring-blue-300"
                      />
                    ) : (
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                        className="relative"
                      >
                        {/* Rotating gradient border */}
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                          className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-sm opacity-75"
                          style={{ padding: '2px' }}
                        />
                        <div
                          className="relative w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md"
                        >
                          <span className="text-[10px] font-bold text-white">
                            {user?.firstName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Name — hidden on mobile, shown from sm */}
                  <div className="hidden sm:block relative z-10">
                    <div className="text-[11px] font-bold bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent truncate max-w-[80px] lg:max-w-[120px] leading-none">
                      {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.username || 'User'
                      }
                    </div>
                    <div className="text-[10px] text-blue-600 font-semibold capitalize leading-none mt-0.5">
                      {user?.role || 'Role'}
                    </div>
                  </div>
                  <CaretDown size={10} className="text-blue-600 relative z-10 flex-shrink-0" />
                </motion.div>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-1 w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-lg py-1 z-50 overflow-hidden border border-slate-200/70 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
                  >
                    <div className="px-3 py-2 border-b border-blue-50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                      <p className="text-xs font-medium text-gray-600">Signed in as</p>
                      <p className="text-xs font-bold text-blue-700 truncate">{user?.username || 'User'}</p>
                    </div>

                    <div className="mt-1">
                      <button
                        onClick={() => router.push('/profile')}
                        className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-blue-50/80 hover:text-blue-700 transition-all duration-200"
                        type="button"
                      >
                        <UserCircle size={16} className="mr-2" weight="duotone" />
                        My Profile
                      </button>


                      <div className="my-1 border-b border-blue-50"></div>

                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50/70 hover:text-red-700 transition-all duration-200"
                        type="button"
                      >
                        <SignOut size={16} className="mr-2" weight="duotone" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Search Overlay - Hidden for Parent users */}
        {user?.role !== 'Parent' && showMobileSearch && (
          <motion.div
            ref={mobileSearchRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-blue-100 p-3 z-50"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlass size={18} className="text-blue-500" weight="duotone" />
              </div>
              <input
                type="text"
                placeholder="Search pupils..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 text-sm bg-white rounded-full border border-blue-200 focus:ring-2 focus:ring-blue-400/50 focus:outline-none focus:border-blue-400"
                autoFocus
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border border-blue-500 border-t-transparent" />
                ) : (
                  searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                      type="button"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Mobile Search Results */}
            {showResults && searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-lg shadow-lg border border-slate-200 max-h-48 overflow-y-auto">
                {searchResults.map((pupil) => (
                  <div
                    key={pupil.id}
                    className="px-3 py-2 border-b last:border-b-0 hover:bg-blue-50"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => handlePupilSelect(pupil.id)}
                        className="flex-1 cursor-pointer"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {formatPupilDisplayName(pupil)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {pupil.classCode || pupil.className || pupil.classId}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Mobile fees button clicked for pupil:', pupil.id);
                            router.push(`/fees/collect/${pupil.id}`);
                          }}
                          className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-all duration-200"
                          title="View Fees"
                          type="button"
                        >
                          <CurrencyDollar size={14} weight="duotone" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showResults && searchTerm && searchResults.length === 0 && (
              <div className="mt-2 bg-white rounded-lg shadow-lg border border-slate-200 p-3">
                <p className="text-gray-500 text-center text-sm">No pupils found</p>
              </div>
            )}
          </motion.div>
        )}
      </header>

      <AnimatePresence>
        {showLogoutMessage && (
          <LogoutMessage
            username={user?.firstName || user?.username || 'User'}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default EnhancedHeader; 
