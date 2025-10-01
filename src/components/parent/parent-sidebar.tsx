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
import { Separator } from '@/components/ui/separator';

// Icons
import { 
  Home,
  GraduationCap,
  Bell,
  MessageCircle,
  Users, 
  Menu, 
  ChevronDown,
  School,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  User,
  Shield
} from 'lucide-react';

interface ParentSidebarProps {
  currentView: 'dashboard' | 'home' | 'notifications';
  currentPupilId?: string;
  onViewChange: (view: 'dashboard' | 'home' | 'notifications') => void;
  onPupilChange: (pupilId: string) => void;
  familyId?: string;
  familyMembers?: Pupil[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ParentSidebar({
  currentView,
  currentPupilId,
  onViewChange,
  onPupilChange,
  familyId,
  familyMembers = [],
  isCollapsed = false,
  onToggleCollapse
}: ParentSidebarProps) {
  const { user, logout } = useAuth();
  const { unreadCount, isLoading: badgeLoading } = useNotificationBadge();
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isPupilSelectorOpen, setIsPupilSelectorOpen] = useState(false);

  // Determine if parent has single or multiple children
  const hasSingleChild = familyMembers.length === 1;
  const hasMultipleChildren = familyMembers.length > 1;

  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      description: 'School Overview'
    },
    {
      id: 'dashboard',
      label: hasSingleChild ? 'Child' : hasMultipleChildren ? 'Children' : 'Dashboard',
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

  const currentPupil = familyMembers.find(p => p.id === currentPupilId);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <School className="w-6 h-6 text-white" />
              </div>
              <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Trinity Family</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Parent Portal</p>
              </div>
            </div>
            )}
              <Button
                variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="lg:flex hidden"
            >
              <Menu className="w-4 h-4" />
              </Button>
          </div>
          </div>
          
        {/* Pupil Selector - Only show if multiple children */}
        {hasMultipleChildren && !isCollapsed && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Sheet open={isPupilSelectorOpen} onOpenChange={setIsPupilSelectorOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-auto p-3 justify-between bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                                         <Avatar className="h-8 w-8">
                       <AvatarImage src={currentPupil?.photo || undefined} alt={`${currentPupil?.firstName} ${currentPupil?.lastName}`} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                        {currentPupil?.firstName?.charAt(0) || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">
                        {currentPupil ? `${currentPupil.firstName} ${currentPupil.lastName}` : 'Select Student'}
            </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {currentPupil?.className || 'Choose a student'}
          </div>
        </div>
      </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>Select Student</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {familyMembers.map((pupil) => (
                    <Button
                      key={pupil.id}
                      variant="ghost"
                      className={cn(
                        "w-full h-auto p-3 justify-start",
                        currentPupilId === pupil.id 
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                      onClick={() => handlePupilChange(pupil.id)}
                    >
                                             <Avatar className="h-10 w-10 mr-3">
                         <AvatarImage src={pupil.photo || undefined} alt={`${pupil.firstName} ${pupil.lastName}`} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                          {pupil.firstName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {`${pupil.firstName} ${pupil.lastName}`}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {pupil.className}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
        </div>
        )}
        
        {/* Navigation Menu */}
        <div className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
            const isActive = item.id === currentView;
          
          return (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
                  "w-full h-auto p-3 justify-start transition-all duration-200",
                  isActive 
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={() => handleViewChange(item.id as 'dashboard' | 'home' | 'notifications')}
              >
                <div className="relative">
                  <item.icon className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive ? "text-white" : "text-gray-600 dark:text-gray-400"
                  )} />
                                                                           {item.id === 'notifications' && unreadCount > 0 && !badgeLoading && (
                     <Badge 
                       className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-red-500 text-white border-2 border-white dark:border-gray-900"
                     >
                       {unreadCount > 9 ? '9+' : unreadCount}
                     </Badge>
                   )}
                </div>
                {!isCollapsed && (
                  <span className={cn(
                    "ml-3 font-medium transition-all duration-200",
                    isActive ? "text-white" : "text-gray-600 dark:text-gray-400"
                  )}>
                    {item.label}
                  </span>
                )}
          </Button>
          );
        })}
      </div>

        {/* Separator */}
        <Separator className="mx-4" />

        {/* Quick Actions */}
        <div className="p-4 space-y-2">
          {/* WhatsApp Group Button */}
          <Button
            variant="outline"
            className={cn(
              "w-full h-auto p-3 justify-start text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-800",
              isCollapsed && "justify-center"
            )}
            onClick={() => window.open('https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t', '_blank')}
          >
            <MessageCircle className="h-5 w-5" />
            {!isCollapsed && <span className="ml-3 font-medium">WhatsApp Group</span>}
          </Button>

          {/* School Info */}
        <Button
          variant="ghost"
                className={cn(
              "w-full h-auto p-3 justify-start text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              isCollapsed && "justify-center"
            )}
          >
            <BookOpen className="h-5 w-5" />
            {!isCollapsed && <span className="ml-3 font-medium">School Info</span>}
          </Button>

          {/* Calendar */}
          <Button
            variant="ghost"
                          className={cn(
              "w-full h-auto p-3 justify-start text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              isCollapsed && "justify-center"
            )}
          >
            <Calendar className="h-5 w-5" />
            {!isCollapsed && <span className="ml-3 font-medium">Calendar</span>}
          </Button>
                    </div>
                    
        {/* Separator */}
        <Separator className="mx-4" />

        {/* User Section */}
        <div className="p-4">
                    <div className={cn(
            "flex items-center space-x-3",
            isCollapsed && "justify-center"
          )}>
                         <Avatar className="h-8 w-8">
               <AvatarImage src={undefined} alt={user?.username || 'Parent'} />
               <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                 {user?.username?.charAt(0) || 'P'}
                  </AvatarFallback>
                </Avatar>
             {!isCollapsed && (
                <div className="flex-1 min-w-0">
                 <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                   {user?.username || 'Parent'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                   {user?.email || 'parent@trinity.com'}
                  </p>
        </div>
      )}
    </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 space-y-2">
        <Button
          variant="ghost"
            size="sm"
            className={cn(
              "w-full h-auto p-3 justify-start text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              isCollapsed && "justify-center"
            )}
          >
            <Settings className="h-4 w-4" />
            {!isCollapsed && <span className="ml-3 text-sm">Settings</span>}
        </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full h-auto p-3 justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
              isCollapsed && "justify-center"
            )}
                         onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-3 text-sm">Sign Out</span>}
          </Button>
        </div>
        </div>

      {/* Notifications Modal */}
      <FloatingNotificationsModal 
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />
    </>
  );
}

