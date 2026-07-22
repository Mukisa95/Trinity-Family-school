"use client";

import React, { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import type { Pupil } from '@/types';
import { cn } from '@/lib/utils';

// UI Components
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Icons
import { 
  Home,
  GraduationCap,
  Settings,
  LogOut,
  User,
  X
} from 'lucide-react';

import { AnimatePresence, motion } from 'framer-motion';

interface ParentBottomNavigationProps {
  currentView: 'dashboard' | 'home' | 'notifications';
  currentPupilId?: string;
  onViewChange: (view: 'dashboard' | 'home' | 'notifications') => void;
  onPupilChange: (pupilId: string) => void;
  familyId?: string;
  familyMembers?: Pupil[];
}

export function ParentBottomNavigation({
  currentView,
  currentPupilId,
  onViewChange,
  onPupilChange,
  familyId,
  familyMembers = []
}: ParentBottomNavigationProps) {
  const { user, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPupilSelectorOpen, setIsPupilSelectorOpen] = useState(false);

  // Determine if parent has single or multiple children
  const hasSingleChild = familyMembers.length === 1;
  const hasMultipleChildren = familyMembers.length > 1;

  // Get current pupil for dynamic labeling
  const currentPupil = familyMembers.find(p => p.id === currentPupilId);

  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      description: 'School Overview'
    },
    {
      id: 'dashboard',
      label: (() => {
        if (hasSingleChild) {
          // Single child: show the child's first name
          return familyMembers[0]?.firstName || 'Child';
        } else if (hasMultipleChildren) {
          // Multiple children: show "Children"
          return 'Children';
        } else {
          // No children
          return 'Dashboard';
        }
      })(),
      icon: GraduationCap,
      description: hasSingleChild ? 'Student Info' : hasMultipleChildren ? 'Select Student' : 'Student Info'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Account & Logout'
    }
  ];

  const handleViewChange = (view: 'dashboard' | 'home' | 'notifications') => {
    if (view === 'dashboard') {
      // Special handling for dashboard button
      if (hasSingleChild) {
        // If only one child, automatically select that child and go to dashboard
        const singleChild = familyMembers[0];
        onPupilChange(singleChild.id);
        onViewChange('dashboard');
      } else if (hasMultipleChildren) {
        // If multiple children, show the selection popup
        setIsPupilSelectorOpen(true);
      } else {
        // No children, just go to dashboard
        onViewChange('dashboard');
      }
    } else if (view === 'settings') {
      // Special handling for settings - open the dropdown instead of changing view
      setIsSettingsOpen(prev => !prev);
    } else {
      onViewChange(view);
    }
  };

  const handlePupilChange = (pupilId: string) => {
    onPupilChange(pupilId);
    setIsPupilSelectorOpen(false);
    // Automatically switch to dashboard view when a child is selected
    onViewChange('dashboard');
  };

  return (
    <>
      {/* Floating Rounded Navigation Bar - Compact with Color */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-full shadow-2xl border-2 border-blue-200 dark:border-blue-800 px-1.5 py-1.5">
          {/* Navigation Tabs - Compact Rounded Pill Design */}
          <div className="flex items-center gap-0.5">
            {navigationItems.map((item) => {
              const isActive = item.id === currentView;
              const isSettings = item.id === 'settings';
              
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "h-10 px-4 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-300",
                    isActive 
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-105" 
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:scale-105"
                  )}
                  onClick={() => handleViewChange(item.id as 'dashboard' | 'home' | 'settings')}
                >
                  <div className="relative">
                    <item.icon className={cn(
                      "h-4 w-4 transition-all duration-200",
                      isActive ? "text-white" : isSettings ? "text-gray-600 dark:text-gray-400" : "text-gray-600 dark:text-gray-400"
                    )} />
                  </div>
                  <span className={cn(
                    "text-[9px] font-semibold transition-all duration-200 leading-none mt-0.5",
                    isActive ? "text-white" : "text-gray-600 dark:text-gray-400"
                  )}>
                    {item.label}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Settings Dropdown */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account</p>
                {user?.email && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">{user.email}</p>}
              </div>
              <a
                href="/parent/settings"
                onClick={() => setIsSettingsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 transition-colors duration-150"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium">User Settings</span>
              </a>
              <button
                onClick={() => { setIsSettingsOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <span className="font-medium">Logout</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Beautiful Children Selector Bubble - Only show when multiple children and dashboard button is clicked */}
      <AnimatePresence>
        {hasMultipleChildren && isPupilSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center pb-20">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsPupilSelectorOpen(false)}
            />
            
            {/* Children Selector Bubble */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4"
            >
              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select Your Child
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose which child's information to view
                </p>
              </div>

              {/* Children Grid */}
              <div className="space-y-3">
                {familyMembers.map((pupil) => (
                  <Button
                    key={pupil.id}
                    variant="ghost"
                    className={cn(
                      "w-full h-auto p-4 justify-start rounded-xl transition-all duration-200",
                      currentPupilId === pupil.id 
                        ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 shadow-md" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                    )}
                    onClick={() => handlePupilChange(pupil.id)}
                  >
                    <Avatar className="h-12 w-12 mr-4 ring-2 ring-white dark:ring-gray-800 shadow-lg">
                      <AvatarImage src={pupil.photo || undefined} alt={`${pupil.firstName} ${pupil.lastName}`} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-lg">
                        {pupil.firstName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white text-base">
                        {`${pupil.firstName} ${pupil.lastName}`}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {pupil.className}
                      </div>
                    </div>
                    {currentPupilId === pupil.id && (
                      <div className="ml-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </Button>
                ))}
              </div>

              {/* Close Button */}
              <Button
                variant="ghost"
                className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsPupilSelectorOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </>
  );
}
