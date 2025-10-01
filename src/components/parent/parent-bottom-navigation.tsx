"use client";

import React, { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useNotificationBadge } from '@/lib/hooks/use-notification-badge';
import type { Pupil } from '@/types';
import { cn } from '@/lib/utils';
import { FloatingNotificationsModal } from './floating-notifications-modal';

// UI Components
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Icons
import { 
  Home,
  GraduationCap,
  Bell,
  MessageCircle,
  Users,
  Menu,
  ChevronDown,
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
  const { user } = useAuth();
  const { unreadCount, isLoading: badgeLoading } = useNotificationBadge();
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
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
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      description: 'Updates & Alerts'
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
    } else if (view === 'notifications') {
      // Special handling for notifications - open the modal instead of changing view
      setIsNotificationsModalOpen(true);
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
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50 shadow-lg" style={{ height: 'auto', minHeight: '60px' }}>
        {/* Navigation Tabs */}
        <div className="flex items-center justify-around px-1 py-0.5">
          {navigationItems.map((item) => {
            const isActive = item.id === currentView;
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "flex-1 h-12 flex flex-col items-center justify-center space-y-0.5 rounded-md transition-all duration-200 mx-0.5",
                  isActive 
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={() => handleViewChange(item.id as 'dashboard' | 'home' | 'notifications')}
              >
                <div className="relative">
                  <item.icon className={cn(
                    "h-4 w-4 transition-all duration-200",
                    isActive ? "text-white" : "text-gray-600 dark:text-gray-400"
                  )} />
                  {item.id === 'notifications' && unreadCount > 0 && !badgeLoading && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-xs bg-red-500 text-white border border-white dark:border-gray-900"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium transition-all duration-200 leading-none",
                  isActive ? "text-white" : "text-gray-600 dark:text-gray-400"
                )}>
                  {item.label}
                </span>
              </Button>
            );
          })}
          
          {/* WhatsApp Group Button */}
          <Button
            variant="ghost"
            className="flex-1 h-12 flex flex-col items-center justify-center space-y-0.5 rounded-md transition-all duration-200 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 mx-0.5"
            onClick={() => window.open('https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t', '_blank')}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs font-medium leading-none">WhatsApp</span>
          </Button>
        </div>
      </div>

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

      {/* Notifications Modal */}
      <FloatingNotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />
    </>
  );
}
