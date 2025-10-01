"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePupil } from '@/lib/hooks/use-pupils';
import { useAccountByPupilId } from '@/lib/hooks/use-banking';
import { useHasReleasedResults } from '@/lib/hooks/use-results-release';
import type { Pupil } from '@/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, User, CreditCard, ClipboardList, Wallet, CalendarCheck, RefreshCw, Trophy, MessageCircle } from 'lucide-react';
import { AcademicProgressTile } from './academic-progress-tile';
import { FloatingNotificationsModal } from './floating-notifications-modal';
import { SimpleFloatingNotification } from './simple-floating-notification';
import { PupilInfoSection } from './pupil-info-section';
import { PupilFeesSection } from './pupil-fees-section';
import { PupilRequirementsSection } from './pupil-requirements-section';
import { PupilBankingSection } from './pupil-banking-section';
import { PupilAttendanceSection } from './pupil-attendance-section';
import { PupilResultsSection } from './pupil-results-section';


interface ParentDashboardProps {
  pupilId?: string;
}

export function ParentDashboard({ pupilId }: ParentDashboardProps) {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'info' | 'fees' | 'requirements' | 'banking' | 'attendance' | 'results'>('info');
  const [isTransitioning, setIsTransitioning] = useState(false);

    // Use the provided pupilId or fall back to user's default pupilId
    const targetPupilId = pupilId || user?.pupilId;
    
  // Use React Query hook for pupil data - this provides automatic cache invalidation and refresh
  const { 
    data: pupil, 
    isLoading: loading, 
    error: queryError, 
    refetch 
  } = usePupil(targetPupilId || '');

  // Check if pupil has banking account (for conditional navigation)
  const { data: bankingAccount, isLoading: bankingLoading } = useAccountByPupilId(targetPupilId || '');
  
  // Check if pupil has released exam results (for conditional navigation)
  const { data: hasReleasedResults, isLoading: resultsLoading } = useHasReleasedResults(targetPupilId || '');

  // Convert error to string format
  const error = queryError ? 
    (queryError instanceof Error ? queryError.message : 'Failed to load pupil details') 
    : (!targetPupilId ? 'No pupil ID available. Please contact administration.' : null);

  const handleRefresh = async () => {
    try {
      await refetch();
    } catch (err) {
      console.error('Error refreshing pupil data:', err);
    }
  };

  // Handle view change with shimmer animation
  const handleViewChange = (newView: typeof currentView) => {
    if (newView === currentView) return;
    
    setIsTransitioning(true);
    
    // Short delay to allow shimmer to start
    setTimeout(() => {
      setCurrentView(newView);
    }, 150);
    
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading pupil information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 space-x-2">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={logout} variant="destructive">
            Logout
          </Button>
        </div>
      </div>
    );
  }

  if (!pupil) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Data Found</AlertTitle>
          <AlertDescription>Pupil information could not be loaded. Please contact support.</AlertDescription>
        </Alert>
        <div className="mt-4 space-x-2">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={logout}>Logout</Button>
        </div>
      </div>
    );
  }

  // Dynamic header content based on current view
  const getViewConfig = () => {
    switch (currentView) {
      case 'info':
        return {
          title: 'Personal Information',
          subtitle: 'View student profile and academic details',
          icon: User,
          gradient: 'from-blue-500 via-blue-600 to-cyan-600',
          particles: 'from-blue-400/20 to-cyan-400/20',
          accentColor: 'text-blue-200'
        };
      case 'fees':
        return {
          title: 'Fees & Payments',
          subtitle: 'Track payment history and outstanding balances',
          icon: CreditCard,
          gradient: 'from-green-500 via-emerald-600 to-teal-600',
          particles: 'from-green-400/20 to-emerald-400/20',
          accentColor: 'text-green-200'
        };
      case 'requirements':
        return {
          title: 'School Requirements',
          subtitle: 'Monitor academic and administrative requirements',
          icon: ClipboardList,
          gradient: 'from-rose-500 via-pink-600 to-red-600',
          particles: 'from-rose-400/20 to-pink-400/20',
          accentColor: 'text-rose-200'
        };
      case 'attendance':
        return {
          title: 'Attendance Records',
          subtitle: 'View daily attendance and participation tracking',
          icon: CalendarCheck,
          gradient: 'from-violet-500 via-purple-600 to-indigo-600',
          particles: 'from-violet-400/20 to-purple-400/20',
          accentColor: 'text-violet-200'
        };
      case 'banking':
        return {
          title: 'Account Overview',
          subtitle: 'Monitor savings, transactions, and account activity',
          icon: Wallet,
          gradient: 'from-orange-500 via-amber-600 to-yellow-600',
          particles: 'from-orange-400/20 to-amber-400/20',
          accentColor: 'text-orange-200'
        };
      case 'results':
        return {
          title: 'Exam Results',
          subtitle: 'View released exam results and academic performance',
          icon: Trophy,
          gradient: 'from-yellow-500 via-orange-600 to-red-600',
          particles: 'from-yellow-400/20 to-orange-400/20',
          accentColor: 'text-yellow-200'
        };
      default:
        return {
          title: 'Dashboard Overview',
          subtitle: 'Welcome to your student information portal',
          icon: User,
          gradient: 'from-blue-500 via-blue-600 to-cyan-600',
          particles: 'from-blue-400/20 to-cyan-400/20',
          accentColor: 'text-blue-200'
        };
    }
  };

  const viewConfig = getViewConfig();
  const IconComponent = viewConfig.icon;

  // Get current theme colors based on active view
  const getCurrentTheme = () => {
    switch (currentView) {
      case 'info':
        return {
          primaryRgb: 'rgb(37 99 235)', // blue-600
          lightRgb: 'rgb(239 246 255)', // blue-50
          borderRgb: 'rgb(191 219 254)', // blue-200
          shadowRgb: 'rgba(37, 99, 235, 0.2)', // blue-600/20
          accentRgb: 'rgb(6 182 212)' // cyan-500
        };
      case 'fees':
        return {
          primaryRgb: 'rgb(22 163 74)', // green-600
          lightRgb: 'rgb(240 253 244)', // green-50
          borderRgb: 'rgb(187 247 208)', // green-200
          shadowRgb: 'rgba(22, 163, 74, 0.2)', // green-600/20
          accentRgb: 'rgb(16 185 129)' // emerald-500
        };
      case 'requirements':
        return {
          primaryRgb: 'rgb(225 29 72)', // rose-600
          lightRgb: 'rgb(255 241 242)', // rose-50
          borderRgb: 'rgb(254 205 211)', // rose-200
          shadowRgb: 'rgba(225, 29, 72, 0.2)', // rose-600/20
          accentRgb: 'rgb(236 72 153)' // pink-500
        };
      case 'attendance':
        return {
          primaryRgb: 'rgb(124 58 237)', // violet-600
          lightRgb: 'rgb(245 243 255)', // violet-50
          borderRgb: 'rgb(221 214 254)', // violet-200
          shadowRgb: 'rgba(124, 58, 237, 0.2)', // violet-600/20
          accentRgb: 'rgb(168 85 247)' // purple-500
        };
      case 'banking':
        return {
          primaryRgb: 'rgb(234 88 12)', // orange-600
          lightRgb: 'rgb(255 247 237)', // orange-50
          borderRgb: 'rgb(254 215 170)', // orange-200
          shadowRgb: 'rgba(234, 88, 12, 0.2)', // orange-600/20
          accentRgb: 'rgb(245 158 11)' // amber-500
        };
      case 'results':
        return {
          primaryRgb: 'rgb(202 138 4)', // yellow-600
          lightRgb: 'rgb(254 252 232)', // yellow-50
          borderRgb: 'rgb(254 240 138)', // yellow-200
          shadowRgb: 'rgba(202, 138, 4, 0.2)', // yellow-600/20
          accentRgb: 'rgb(249 115 22)' // orange-500
        };
      default:
        return {
          primaryRgb: 'rgb(37 99 235)', // blue-600
          lightRgb: 'rgb(239 246 255)', // blue-50
          borderRgb: 'rgb(191 219 254)', // blue-200
          shadowRgb: 'rgba(37, 99, 235, 0.2)', // blue-600/20
          accentRgb: 'rgb(6 182 212)' // cyan-500
        };
    }
  };

  const currentTheme = getCurrentTheme();

  // Determine if banking section should be shown
  const showBankingSection = !bankingLoading && bankingAccount;
  
  // Determine if results section should be shown
  const showResultsSection = !resultsLoading && hasReleasedResults;

  return (
    <div 
      className="min-h-screen"
      style={{
        '--theme-primary': currentTheme.primaryRgb,
        '--theme-light': currentTheme.lightRgb,
        '--theme-border': currentTheme.borderRgb,
        '--theme-shadow': currentTheme.shadowRgb,
        '--theme-accent': currentTheme.accentRgb,
        background: `linear-gradient(135deg, ${currentTheme.lightRgb.replace('rgb(', 'rgba(').replace(')', ', 0.15)')}, rgba(255, 255, 255, 0.95), ${currentTheme.lightRgb.replace('rgb(', 'rgba(').replace(')', ', 0.08)')})`
      } as React.CSSProperties}
    >
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b theme-border theme-shadow">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-1">
          {/* Centered Navigation with Horizontal Scroll Support */}
          <div className="flex justify-center gap-0.5 sm:gap-1 md:gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => handleViewChange('info')}
              className={`
                group relative px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0
                ${currentView === 'info' 
                  ? 'bg-white text-blue-600 shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25' 
                  : 'bg-white/20 backdrop-blur-sm text-slate-600 border-2 border-blue-600/60 hover:bg-blue-50/30 hover:border-blue-600/80 shadow-md shadow-blue-200/30'
                }
              `}
            >
              <div className="flex items-center">
                <User className={`w-3 h-3 mr-0.5 sm:mr-1 md:mr-1.5 transition-colors ${currentView === 'info' ? 'text-blue-600' : 'text-blue-700'}`} />
                <span className={`whitespace-nowrap ${currentView === 'info' ? 'text-blue-600' : 'text-blue-700'}`}>Info</span>
              </div>
              {currentView === 'info' && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 to-cyan-400/20 animate-pulse"></div>
              )}
            </button>
            
            <button
              onClick={() => handleViewChange('fees')}
              className={`
                group relative px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0
                ${currentView === 'fees' 
                  ? 'bg-white text-green-600 shadow-md shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/25' 
                  : 'bg-white/20 backdrop-blur-sm text-slate-600 border-2 border-green-600/60 hover:bg-green-50/30 hover:border-green-600/80 shadow-md shadow-green-200/30'
                }
              `}
            >
              <div className="flex items-center">
                <CreditCard className={`w-3 h-3 mr-0.5 sm:mr-1 md:mr-1.5 transition-colors ${currentView === 'fees' ? 'text-green-600' : 'text-green-700'}`} />
                <span className={`whitespace-nowrap ${currentView === 'fees' ? 'text-green-600' : 'text-green-700'}`}>Fees</span>
              </div>
              {currentView === 'fees' && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400/20 to-emerald-400/20 animate-pulse"></div>
              )}
            </button>
            
            <button
              onClick={() => handleViewChange('requirements')}
              className={`
                group relative px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0
                ${currentView === 'requirements' 
                  ? 'bg-white text-rose-600 shadow-md shadow-rose-600/20 hover:shadow-lg hover:shadow-rose-600/25' 
                  : 'bg-white/20 backdrop-blur-sm text-slate-600 border-2 border-rose-600/60 hover:bg-rose-50/30 hover:border-rose-600/80 shadow-md shadow-rose-200/30'
                }
              `}
            >
              <div className="flex items-center">
                <ClipboardList className={`w-3 h-3 mr-0.5 sm:mr-1 md:mr-1.5 transition-colors ${currentView === 'requirements' ? 'text-rose-600' : 'text-rose-700'}`} />
                <span className={`whitespace-nowrap ${currentView === 'requirements' ? 'text-rose-600' : 'text-rose-700'}`}>
                  <span className="hidden sm:inline">Requirements</span>
                  <span className="sm:hidden">Reqs</span>
                </span>
              </div>
              {currentView === 'requirements' && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-400/20 to-pink-400/20 animate-pulse"></div>
              )}
            </button>
            
            <button
              onClick={() => handleViewChange('attendance')}
              className={`
                group relative px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0
                ${currentView === 'attendance' 
                  ? 'bg-white text-violet-600 shadow-md shadow-violet-600/20 hover:shadow-lg hover:shadow-violet-600/25' 
                  : 'bg-white/20 backdrop-blur-sm text-slate-600 border-2 border-violet-600/60 hover:bg-violet-50/30 hover:border-violet-600/80 shadow-md shadow-violet-200/30'
                }
              `}
            >
              <div className="flex items-center">
                <CalendarCheck className={`w-3 h-3 mr-0.5 sm:mr-1 md:mr-1.5 transition-colors ${currentView === 'attendance' ? 'text-violet-600' : 'text-violet-700'}`} />
                <span className={`whitespace-nowrap ${currentView === 'attendance' ? 'text-violet-600' : 'text-violet-700'}`}>
                  <span className="hidden sm:inline">Attendance</span>
                  <span className="sm:hidden">Attend</span>
                </span>
              </div>
              {currentView === 'attendance' && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400/20 to-purple-400/20 animate-pulse"></div>
              )}
            </button>
            
            {/* Conditionally show Results button only if pupil has released results */}
            {showResultsSection && (
              <button
                onClick={() => handleViewChange('results')}
                className={`
                  group relative px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0
                  ${currentView === 'results' 
                    ? 'bg-white text-yellow-600 shadow-md shadow-yellow-600/20 hover:shadow-lg hover:shadow-yellow-600/25' 
                    : 'bg-white/20 backdrop-blur-sm text-slate-600 border-2 border-yellow-600/60 hover:bg-yellow-50/30 hover:border-yellow-600/80 shadow-md shadow-yellow-200/30'
                  }
                `}
              >
                <div className="flex items-center">
                  <Trophy className={`w-3 h-3 mr-0.5 sm:mr-1 md:mr-1.5 transition-colors ${currentView === 'results' ? 'text-yellow-600' : 'text-yellow-700'}`} />
                  <span className={`whitespace-nowrap ${currentView === 'results' ? 'text-yellow-600' : 'text-yellow-700'}`}>Results</span>
                </div>
                {currentView === 'results' && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400/20 to-orange-400/20 animate-pulse"></div>
                )}
              </button>
            )}

            {/* Conditionally show Banking button only if pupil has banking account */}
            {showBankingSection && (
              <button
                onClick={() => handleViewChange('banking')}
                className={`
                  group relative px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-full font-medium text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 flex-shrink-0
                  ${currentView === 'banking' 
                    ? 'bg-white text-orange-600 shadow-md shadow-orange-600/20 hover:shadow-lg hover:shadow-orange-600/25' 
                    : 'bg-white/20 backdrop-blur-sm text-slate-600 border-2 border-orange-600/60 hover:bg-orange-50/30 hover:border-orange-600/80 shadow-md shadow-orange-200/30'
                  }
                `}
              >
                <div className="flex items-center">
                  <Wallet className={`w-3 h-3 mr-0.5 sm:mr-1 md:mr-1.5 transition-colors ${currentView === 'banking' ? 'text-orange-600' : 'text-orange-700'}`} />
                  <span className={`whitespace-nowrap ${currentView === 'banking' ? 'text-orange-600' : 'text-orange-700'}`}>Account</span>
                </div>
                {currentView === 'banking' && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400/20 to-amber-400/20 animate-pulse"></div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div 
        className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 rounded-lg shadow-lg pt-4"
        style={{
          background: `linear-gradient(135deg, rgba(255, 255, 255, 0.8), ${currentTheme.lightRgb.replace('rgb(', 'rgba(').replace(')', ', 0.3)')})`,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${currentTheme.borderRgb.replace('rgb(', 'rgba(').replace(')', ', 0.3)')}`
        }}
      >
        {/* Enhanced Dynamic Header with Shimmer Animation */}
        <div className={`h-40 sm:h-44 md:h-52 rounded-xl bg-gradient-to-br ${viewConfig.gradient} relative mb-6 sm:mb-8 overflow-hidden shadow-2xl transition-all duration-700 ease-in-out`}>
          {/* Shimmer Animation Overlay */}
          {isTransitioning && (
            <div className="absolute inset-0 z-30">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-sweep"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent animate-shimmer-radial"></div>
            </div>
          )}
          
          {/* Animated Background Particles */}
          <div className="absolute inset-0">
            <div className={`absolute top-0 left-0 w-72 h-72 bg-gradient-to-br ${viewConfig.particles} rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob transition-all duration-700`}></div>
            <div className={`absolute top-0 right-0 w-72 h-72 bg-gradient-to-br ${viewConfig.particles} rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 transition-all duration-700`}></div>
            <div className={`absolute -bottom-8 left-20 w-72 h-72 bg-gradient-to-br ${viewConfig.particles} rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 transition-all duration-700`}></div>
          </div>
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent transition-all duration-700" />
          
          {/* Animated Grid Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-pulse"></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex items-center justify-between h-full px-4 sm:px-6 md:px-8">
            {/* Left Side - Student Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mr-3 sm:mr-4 shadow-lg transition-all duration-500 flex-shrink-0 overflow-hidden">
                  {pupil.photo && pupil.photo.trim() !== '' ? (
                    <img 
                      src={pupil.photo} 
                      alt={`${pupil.firstName} ${pupil.lastName}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.log('Avatar image failed to load:', pupil.photo);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white transition-all duration-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-1 tracking-tight transition-all duration-500 truncate">
                    {pupil.firstName} {pupil.lastName} {pupil.otherNames}
                  </h1>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-white/80 text-sm">
                    <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium transition-all duration-500 w-fit">
                      {pupil.className}
                    </span>
                    <span className="hidden sm:inline text-white/60">•</span>
                    <span className="text-xs text-white/70">
                      ID: {pupil.admissionNumber}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Dynamic View Title */}
              <div className="space-y-1.5">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-white transition-all duration-500">
                  {viewConfig.title}
                </h2>
                <p className={`text-xs sm:text-sm ${viewConfig.accentColor} max-w-md transition-all duration-500`}>
                  {viewConfig.subtitle}
                </p>
              </div>
            </div>
            
            {/* Right Side - Decorative Elements & WhatsApp */}
            <div className="flex flex-col items-end space-y-3">
              {/* Decorative Dots - Hidden on mobile to save space */}
              <div className="hidden sm:flex space-x-2">
                <div className="w-3 h-3 bg-white/30 rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-white/50 rounded-full animate-pulse animation-delay-200"></div>
                <div className="w-3 h-3 bg-white/70 rounded-full animate-pulse animation-delay-400"></div>
              </div>
              
              {/* Date - Smaller on mobile */}
              <div className="text-right text-white/70 text-xs">
                <div className="hidden sm:block">Trinity Family Schools</div>
                <div className="text-white/80">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              
              {/* WhatsApp Group Message - Optimized for mobile */}
              <div className="text-right text-white/90">
                <div className="flex items-center justify-end space-x-1 sm:space-x-1.5 mb-1.5 sm:mb-2">
                  <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-300" />
                  <span className="text-green-200 font-medium text-xs sm:text-sm">WhatsApp Group</span>
                </div>
                <a 
                  href="https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg transition-all duration-300 hover:scale-105 shadow-sm"
                >
                  Join Now
                </a>
              </div>
            </div>
          </div>
          
          {/* Bottom Accent Line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-white/0 via-white/50 to-white/0"></div>
        </div>

        {/* Academic Progress Tile */}
        <AcademicProgressTile className="mt-6 sm:mt-8 theme-card" />

        {/* Content based on current view */}
        <div className="mt-3 sm:mt-4 theme-card p-3 sm:p-4 md:p-6">
            {currentView === 'info' && <PupilInfoSection pupil={pupil} />}
            {currentView === 'fees' && <PupilFeesSection pupilId={pupil.id} />}
            {currentView === 'requirements' && <PupilRequirementsSection pupilId={pupil.id} />}
            {currentView === 'attendance' && <PupilAttendanceSection pupilId={pupil.id} />}
            {currentView === 'results' && (
                <PupilResultsSection 
                  pupilId={pupil.id} 
                  pupilName={`${pupil?.firstName || ''} ${pupil?.lastName || ''}`.trim() || 'Student'}
                />
            )}
            {currentView === 'banking' && showBankingSection && <PupilBankingSection pupilId={pupil.id} />}
        </div>
      </div>
      
      {/* Simple Floating Notification - Shows when there are new notifications */}
      <SimpleFloatingNotification />
    </div>
  );
} 