"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePupil, usePupilsByFamily } from '@/lib/hooks/use-pupils';
import { useParentOfflineFamily } from '@/lib/hooks/use-parent-offline-family';
import { ParentBottomNavigation } from './parent-bottom-navigation';
import { ParentSidebar } from './parent-sidebar';
import { ParentDashboard } from './parent-dashboard';
import { ParentAboutSchool } from './parent-about-school';
import { ParentOfflineDatasetPreparer } from './parent-offline-dataset-preparer';
import type { Pupil } from '@/types';

interface ParentLayoutProps {
  children?: React.ReactNode;
}

export function ParentLayout({ children }: ParentLayoutProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [currentView, setCurrentView] = useState<'dashboard' | 'home' | 'notifications'>('dashboard');
  const [currentPupilId, setCurrentPupilId] = useState<string | undefined>(user?.pupilId);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Get familyId from user account (preferred) or fallback to pupil's familyId
  const userFamilyId = user?.familyId;
  const { data: primaryPupil } = usePupil(user?.pupilId || '');
  const fallbackFamilyId = primaryPupil?.familyId;
  const familyId = userFamilyId || fallbackFamilyId;

  // Fetch all family members using the family-based relationship
  const familyQuery = usePupilsByFamily(familyId || '');
  const { familyMembers } = useParentOfflineFamily({
    accountId: user?.role === 'Parent' ? user.id : undefined,
    familyId,
    liveFamilyMembers: familyQuery.data,
    // The selector intentionally returns [] while its canonical pupil cache is
    // still empty. Use the query's loading state so a cold offline launch can
    // distinguish that placeholder from a confirmed live empty family.
    hasLiveFamilyData: !familyQuery.isLoading,
  });

  // Initialize with user's default pupil or first family member
  useEffect(() => {
    if (!currentPupilId) {
      if (user?.pupilId) {
        setCurrentPupilId(user.pupilId);
      } else if (familyMembers.length > 0) {
        // If no specific pupil is linked, default to first family member
        setCurrentPupilId(familyMembers[0].id);
      }
    }
  }, [user?.pupilId, familyMembers, currentPupilId]);

  const handleViewChange = (view: 'dashboard' | 'home' | 'notifications') => {
    setCurrentView(view);
  };

  const handlePupilChange = (pupilId: string) => {
    setCurrentPupilId(pupilId);
    // When switching pupils, always go back to dashboard view
    setCurrentView('dashboard');
  };

  // Update view when route changes
  useEffect(() => {
    if (pathname === '/parent' || pathname === '/parent/dashboard') {
      setCurrentView('dashboard');
    } else if (pathname === '/parent/home') {
      setCurrentView('home');
    }
  }, [pathname]);

  // Listen for custom events from child components
  useEffect(() => {
    const handlePupilAndViewChange = (event: CustomEvent) => {
      const { pupilId, view } = event.detail;
      if (pupilId) {
        setCurrentPupilId(pupilId);
      }
      if (view) {
        setCurrentView(view as 'dashboard' | 'home' | 'notifications');
      }
    };

    window.addEventListener('changePupilAndView', handlePupilAndViewChange as EventListener);
    
    return () => {
      window.removeEventListener('changePupilAndView', handlePupilAndViewChange as EventListener);
    };
  }, []);

  const renderContent = () => {
    if (pathname.startsWith('/parent/settings')) return children;
    switch (currentView) {
      case 'home':
        return <ParentAboutSchool />;
      case 'dashboard':
      default:
        return <ParentDashboard pupilId={currentPupilId} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <ParentOfflineDatasetPreparer
        accountId={user?.role === 'Parent' ? user.id : undefined}
        familyId={familyId}
        pupils={familyMembers}
      />
      {/* Desktop Sidebar */}
      <ParentSidebar
        currentView={currentView}
        currentPupilId={currentPupilId}
        onViewChange={handleViewChange}
        onPupilChange={handlePupilChange}
        familyId={familyId}
        familyMembers={familyMembers}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto pb-28 lg:pb-0">
          {renderContent()}
        </div>
        
        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden">
          <ParentBottomNavigation
            currentView={currentView}
            currentPupilId={currentPupilId}
            onViewChange={handleViewChange}
            onPupilChange={handlePupilChange}
            familyId={familyId}
            familyMembers={familyMembers}
          />
        </div>
      </div>
    </div>
  );
}
