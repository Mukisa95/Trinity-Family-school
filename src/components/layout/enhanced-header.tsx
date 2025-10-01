"use client";

import { MagnifyingGlass, Bell, List, Calendar, SignOut, CaretDown, UserCircle, Info, Sparkle, DotsThree, CurrencyDollar } from '@phosphor-icons/react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LogoutMessage from '@/components/common/LogoutMessage';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import quotes from '@/data/quotes.json';
import { usePupils } from '@/lib/hooks/use-pupils';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { format } from 'date-fns';
import type { Notification } from '@/types';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

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

// Animation variants for message transitions
const messageVariants = {
  enter: { 
    opacity: 0, 
    y: 10,
    scale: 0.95
  },
  center: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { 
      duration: 0.4,
      type: "spring",
      stiffness: 120,
      damping: 20
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    scale: 0.95,
    transition: { duration: 0.25 }
  },
};

// Sparkling animation for decorative elements
const sparkleAnimation = {
  scale: [1, 1.15, 1],
  opacity: [0.6, 1, 0.6],
  rotate: [0, 12, 0],
  transition: {
    duration: 2.2,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut"
  }
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  
  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { notifications } = useNotifications();
  
  // State for the top bar message
  const { data: settings } = useSchoolSettings({ enabled: loadSchoolSettings });
  const { data: pupils } = usePupils();
  const [phase, setPhase] = useState<'welcome' | 'motto' | 'quote'>('welcome');
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState<number>(0);
  const [currentMessage, setCurrentMessage] = useState<string>('Welcome!');
  const motto = loadSchoolSettings ? (settings?.generalInfo?.motto || "") : "";

  // Calculate pending notifications
  const pendingNotifications = useMemo(() => {
    return notifications?.filter(n => n.status === 'pending') || [];
  }, [notifications]);

  // Get recent notifications (last 5)
  const recentNotifications = useMemo(() => {
    return notifications?.slice(0, 5) || [];
  }, [notifications]);

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

  // Handle search input changes
  useEffect(() => {
    const searchPupils = async () => {
      if (searchTerm.length < 1) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        if (pupils) {
          // Filter pupils based on search term
          const filtered = pupils.filter((pupil: Pupil) => {
            const searchString = `${formatPupilDisplayName(pupil)} ${pupil.admissionNumber}`.toLowerCase();
            return searchString.includes(searchTerm.toLowerCase());
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
  }, [searchTerm, pupils]);

  // useEffect for Top Bar Message Logic
  useEffect(() => {
    let phaseTimer: NodeJS.Timeout;
    let quoteInterval: NodeJS.Timeout;

    if (phase === 'welcome') {
      setCurrentMessage('Welcome!');
      phaseTimer = setTimeout(() => setPhase('motto'), 3000);
    } else if (phase === 'motto') {
      if (motto) {
        setCurrentMessage(`"${motto}"`);
        phaseTimer = setTimeout(() => setPhase('quote'), 40000);
      } else {
        phaseTimer = setTimeout(() => setPhase('quote'), 500);
      }
    } else if (phase === 'quote') {
      const displayNextQuote = () => {
        setCurrentQuoteIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % quotes.length;
          setCurrentMessage(quotes[nextIndex]);
          return nextIndex;
        });
      };
      setCurrentMessage(quotes[currentQuoteIndex]); 
      quoteInterval = setInterval(displayNextQuote, 10000);
    }

    return () => {
      clearTimeout(phaseTimer);
      clearInterval(quoteInterval);
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

  // Handle click outside for notifications
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
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
      router.push('/login');
    }, 2000);
  };

  return (
    <>
      <header className="bg-gradient-to-r from-slate-50 via-white to-blue-50 backdrop-blur-xl border-b border-blue-100/30 sticky top-0 z-40 transition-all duration-300 shadow-[0_2px_15px_-5px_rgba(0,0,0,0.05)]">
        <div className="px-2 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* Left side: Mobile Sidebar Trigger, Menu Button and Animated Message */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2 lg:mr-4">
              {/* Mobile Sidebar Trigger - Only show on mobile and when sidebar is available */}
              {sidebarIsMobile && (
                <SidebarTrigger className="md:hidden h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 transition-all duration-200 border-0 flex-shrink-0" />
              )}
              
              {showMenuButton && (
                <button
                  onClick={onMenuClick}
                  className="p-1.5 sm:p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 rounded-full transition-all duration-200 shadow-sm hover:shadow-blue-100 transform hover:scale-110 active:scale-95 flex-shrink-0"
                >
                  <List size={20} className="sm:w-6 sm:h-6" weight="duotone" />
                </button>
              )}
              
              {/* Enhanced Animated Message Area */}
              <div className="flex-1 min-w-0 h-full flex items-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMessage}
                    variants={messageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="relative w-full"
                  >
                    <motion.div className="relative">
                      {/* Decorative elements - smaller on mobile */}
                      <motion.div 
                        animate={sparkleAnimation}
                        className="absolute -top-0.5 -right-0.5 text-amber-400 hidden sm:block"
                      >
                        <Sparkle size={14} weight="fill" />
                      </motion.div>
                      
                      <motion.div 
                        animate={sparkleAnimation}
                        className="absolute -bottom-0.5 -left-0.5 text-blue-300 hidden sm:block"
                        style={{ animationDelay: '0.5s' }}
                      >
                        <Sparkle size={12} weight="fill" />
                      </motion.div>
                      
                                            {/* Message card - Responsive sizing with two-line support for quotes */}
                      <motion.div
                        className={`flex items-start gap-2 text-xs sm:text-sm font-medium text-blue-800 px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-blue-50/70 cursor-pointer hover:bg-blue-100/70 transition-colors duration-200 ${
                          windowWidth < 768 
                            ? 'max-w-[calc(100vw-180px)] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl' // Account for mobile sidebar trigger
                            : 'max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl'
                        }`}
                        style={{
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(226, 232, 240, 0.5)",
                        }}
                        onClick={handleMessageClick}
                      >
                        <Info size={16} className="flex-shrink-0 text-blue-600 hidden sm:block mt-0.5" weight="duotone" /> 
                        <div className="flex-1 min-w-0">
                          <span 
                            className={`quote-text block ${
                              isQuoteExpanded 
                                ? 'whitespace-normal' 
                                : phase === 'quote' && windowWidth < 768 
                                  ? 'two-line-quote' // Apply two-line clamp on small screens for unexpanded quotes
                                  : shouldShowFullQuote() 
                                    ? 'whitespace-normal two-line-quote' // Allow multi-line for full quotes (CSS still clamps to 2 lines if two-line-quote is active)
                                    : 'truncate whitespace-nowrap' // Truncate on larger screens if not full and not expanded
                            }`}
                          >
                             {isQuoteExpanded || (phase === 'quote' && windowWidth < 768 && !isQuoteExpanded) || (shouldShowFullQuote() && phase === 'quote')
                               ? currentMessage // Show full message if expanded, or small screen quote (CSS handles clamping), or full quote on large screen
                               : getTruncatedMessage(currentMessage, getDynamicTruncationLength()) // Otherwise, truncate
                             }
                           </span>
                           {phase === 'quote' && isQuoteExpandable() && !isQuoteExpanded && (
                             <DotsThree size={14} className="inline-block ml-1 text-blue-500" weight="bold" />
                           )}
                         </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Right side: Search, DateTime, User Menu */}
            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 transition-all duration-500 flex-shrink-0">
              {/* DateTime Display - Hidden on small screens, compact on medium */}
              <div 
                className="hidden lg:flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-blue-50/70 rounded-full transition-all duration-500 group hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(226, 232, 240, 0.5)",
                }}
              >
                <Calendar size={14} className="text-blue-500 group-hover:animate-pulse" weight="duotone" />
                <span className="text-xs font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300">
                  {formattedDateTime}
                </span>
              </div>

              {/* Desktop Search Bar Container - Hidden for Parent users */}
              {user?.role !== 'Parent' && (
                <div 
                  id="search-container" 
                  className="hidden md:block relative z-50 transition-all duration-500 group"
                  onFocus={() => {
                    const container = document.querySelector('.flex.items-center.gap-1');
                    container?.classList.add('search-expanded');
                  }}
                  onBlur={() => {
                    if (!searchTerm) {
                      document.querySelector('.flex.items-center.gap-1')?.classList.remove('search-expanded');
                    }
                  }}
                >
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-blue-500/80 group-hover:text-blue-600 transition-all duration-500 z-10">
                    <MagnifyingGlass size={16} weight="duotone" className="transition-all duration-300 group-hover:scale-110" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-32 group-hover:w-48 focus:w-64 pl-8 pr-6 py-1.5 text-sm bg-white/90 rounded-full focus:ring-2 focus:ring-blue-400/50 focus:outline-none shadow-sm hover:shadow-md transition-all duration-500 ease-in-out placeholder:text-gray-400 placeholder:text-xs"
                    style={{
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(226, 232, 240, 0.5)",
                      border: "none"
                    }}
                  />
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center z-10">
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-3 w-3 border border-blue-500 border-t-transparent" />
                    ) : (
                      searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                          type="button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {showResults && searchResults.length > 0 && (
                    <div 
                      className="absolute mt-1 w-full bg-white/95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-slate-200/70 max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                      {searchResults.map((pupil) => (
                        <div
                          key={pupil.id}
                          className="px-3 py-2 border-b last:border-b-0 transition-all duration-200 hover:bg-blue-50/80"
                        >
                          <div className="flex items-center justify-between">
                            <div 
                              onClick={() => handlePupilSelect(pupil.id)}
                              className="flex-1 cursor-pointer"
                            >
                              <p className="text-sm font-medium text-gray-900">
                                {formatPupilDisplayName(pupil)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Admission: {pupil.admissionNumber}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                {pupil.classCode || pupil.className || pupil.classId}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Fees button clicked for pupil:', pupil.id);
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
                </div>
              )}

              {/* Mobile Search Button - Hidden for Parent users */}
              {user?.role !== 'Parent' && (
                <button 
                  onClick={() => setShowMobileSearch(!showMobileSearch)}
                  className="md:hidden p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95"
                  type="button"
                >
                  <MagnifyingGlass size={18} weight="duotone" />
                </button>
              )}

              {/* Enhanced Notification Bell */}
              <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-1.5 hover:bg-blue-50/80 hover:text-blue-600 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                    pendingNotifications.length > 0 ? 'animate-pulse' : ''
                  }`}
                  style={{
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                  type="button"
                >
                  {/* Custom Bell SVG with shaking animation */}
                  <div className={`relative ${pendingNotifications.length > 0 ? 'animate-bounce' : ''}`}>
                    <svg 
                      width="18" 
                      height="18" 
                      viewBox="0 0 256 256" 
                      className={`text-gray-600 transition-colors duration-200 ${
                        pendingNotifications.length > 0 ? 'animate-pulse text-blue-600' : ''
                      }`}
                      style={{
                        animation: pendingNotifications.length > 0 ? 'bellRing 0.6s ease-in-out infinite' : 'none'
                      }}
                    >
                      <path 
                        d="M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z" 
                        opacity="0.2"
                        fill="currentColor"
                      />
                      <path 
                        d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" 
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  
                  {/* Notification Count Badge */}
                  {pendingNotifications.length > 0 && (
                    <div 
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center z-10"
                      style={{
                        animation: 'notificationPulse 1.5s ease-in-out infinite'
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {pendingNotifications.length > 99 ? '99+' : pendingNotifications.length}
                      </span>
                    </div>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/70 z-50 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-blue-50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                        <button
                          onClick={() => router.push('/notifications')}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
                        >
                          View All
                        </button>
                      </div>
                      {pendingNotifications.length > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          {pendingNotifications.length} pending notification{pendingNotifications.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-64 overflow-y-auto">
                      {recentNotifications.length > 0 ? (
                        recentNotifications.map((notification: Notification) => (
                          <div
                            key={notification.id}
                            onClick={() => {
                              router.push('/notifications');
                              setShowNotifications(false);
                            }}
                            className={`px-4 py-3 border-b border-gray-50 last:border-b-0 cursor-pointer transition-all duration-200 hover:bg-blue-50/50 ${
                              notification.status === 'pending' ? 'bg-blue-25/30' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                notification.status === 'pending' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                {notification.description && (
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {notification.description}
                                  </p>
                                )}
                                <div className="flex items-center justify-between mt-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    notification.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                    notification.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                    notification.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {notification.priority}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(notification.scheduledFor || notification.createdAt), 'MMM d, HH:mm')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 text-gray-300">
                            <svg viewBox="0 0 256 256" fill="currentColor">
                              <path d="M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z" opacity="0.2"/>
                              <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"/>
                            </svg>
                          </div>
                          <p className="text-sm text-gray-500">No notifications yet</p>
                          <button
                            onClick={() => {
                              router.push('/notifications');
                              setShowNotifications(false);
                            }}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Create your first notification
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile - Compact */}
              <div className="relative" ref={userMenuRef}>
                <div 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1 sm:gap-2 cursor-pointer hover:bg-blue-50/80 rounded-full px-1.5 sm:px-2 py-1 transition-all duration-200 transform hover:scale-105 active:scale-98"
                  style={{
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  {false ? (
                    <img
                      src={undefined}
                      alt={`${user?.firstName} ${user?.lastName}`}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ring-blue-200 hover:scale-110 transition-transform duration-200"
                    />
                  ) : (
                    <div 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md hover:scale-110 transition-transform duration-200"
                    >
                      <span className="text-xs font-medium text-white">
                        {user?.firstName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold text-gray-800 truncate max-w-20">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user?.username || 'User'
                      }
                    </div>
                    <div className="text-xs text-blue-600 font-medium capitalize">
                      {user?.role || 'Role'}
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`}>
                    <CaretDown size={12} className="text-gray-500" />
                  </div>
                </div>
                
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
                      
                      <button
                        onClick={() => router.push('/settings/general')}
                        className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-blue-50/80 hover:text-blue-700 transition-all duration-200"
                        type="button"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 w-4 h-4" viewBox="0 0 256 256"><path fill="currentColor" d="M128 80a48 48 0 1 0 48 48a48.05 48.05 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32Zm108.76-26.66l-12-20.77a67.33 67.33 0 0 0 1.24-12.57a67.33 67.33 0 0 0-1.24-12.57l12-20.77c2.59-4.49 1.64-10.15-2.33-13.34l-16-12.8a10 10 0 0 0-13.59 1.06l-16.3 17.81a68.68 68.68 0 0 0-19.54-8V56a10 10 0 0 0-8-9.8l-20-4a10 10 0 0 0-11.6 6.39l-8 19.21a68.68 68.68 0 0 0-19.54 8L86.56 57.99a10.05 10.05 0 0 0-13.59-1.06l-16 12.8a10 10 0 0 0-2.33 13.34l12 20.77a67.33 67.33 0 0 0-1.24 12.57a67.33 67.33 0 0 0 1.24 12.57l-12 20.77A10 10 0 0 0 56.97 163l16 12.8a10 10 0 0 0 13.59-1.06l16.26-17.87a68.68 68.68 0 0 0 19.54 8V180a10 10 0 0 0 8 9.8l20 4a9.83 9.83 0 0 0 2 .2a10 10 0 0 0 9.6-6.59l8-19.21a68.68 68.68 0 0 0 19.54-8l16.3 17.81a10.05 10.05 0 0 0 13.59 1.06l16-12.8a10 10 0 0 0 2.33-13.33zm-15.66 1.66l-16 12.8a2 2 0 0 1-2.72-.21l-18.59-20.37a8 8 0 0 0-9.06-1.66a60.88 60.88 0 0 1-23.73 9.7a8 8 0 0 0-6 5.86l-8 19.21a2 2 0 0 1-2.36 1.24l-20-4a2 2 0 0 1-1.6-2V136a8 8 0 0 0-6-7.75a60.88 60.88 0 0 1-23.75-9.7a8 8 0 0 0-9.06 1.66l-18.6 20.38a1.92 1.92 0 0 1-2.71.21l-16-12.8a2 2 0 0 1-.49-2.66l13.4-23.21a8 8 0 0 0 0-8.26a60.69 60.69 0 0 1 0-25.74a8 8 0 0 0 0-8.26l-13.4-23.21a2 2 0 0 1 .47-2.66l16-12.8a2 2 0 0 1 2.72.21l18.59 20.36a8 8 0 0 0 9.06 1.66a60.88 60.88 0 0 1 23.73-9.7a8 8 0 0 0 6-5.86l8-19.21a2 2 0 0 1 2.32-1.28l20 4a2 2 0 0 1 1.64 2v26.29a8 8 0 0 0 6 7.75a60.88 60.88 0 0 1 23.73 9.7a8 8 0 0 0 9.06-1.66l18.6-20.37a1.94 1.94 0 0 1 2.71-.21l16 12.8a2 2 0 0 1 .47 2.66l-13.4 23.21a8 8 0 0 0 0 8.26a60.69 60.69 0 0 1 0 25.74a8 8 0 0 0 0 8.26l13.4 23.21a2 2 0 0 1-.47 2.66Z" /></svg>
                        Settings
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
                        <p className="text-xs text-gray-500">
                          Admission: {pupil.admissionNumber}
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