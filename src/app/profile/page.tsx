"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/auth-context";
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { AccountField, AccountIdentity, AccountSection, AccountStatus } from "@/components/account/account-profile";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Calendar, Settings, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

// Safe date formatting utility
const formatSafeDate = (dateValue: any, formatString: string, fallback: string = 'Date not available'): string => {
  if (!dateValue || dateValue === 'undefined' || dateValue === 'null') {
    return fallback;
  }
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    return format(date, formatString);
  } catch (error) {
    console.warn('Date formatting error:', error);
    return fallback;
  }
};

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Handle navigation in useEffect to avoid state updates during render
  React.useEffect(() => {
    if (!user) {
      // Don't redirect immediately, let the auth context settle
      const timer = setTimeout(() => {
        if (!user) {
          router.replace('/login');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Loading profile...</h2>
          <p className="text-muted-foreground mt-2">Please wait while we load your profile information.</p>
        </div>
      </div>
    );
  }

  const getUserDisplayName = () => {
    if (user.role === 'Staff' && user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username;
  };

  const getPermissionSummary = () => {
    if (user.role === 'Admin') {
      return ['Full System Access'];
    }
    
    if (user.role === 'Parent') {
      return ['Pupil Information Access', 'Fee Payment Access', 'Communication Access'];
    }

    if (user.role === 'Staff') {
      const permissions: string[] = [];
      
      // Check granular permissions first
      if (user.granularPermissions && user.granularPermissions.length > 0) {
        const moduleCount = user.granularPermissions.length;
        permissions.push(`Access to ${moduleCount} module${moduleCount > 1 ? 's' : ''}`);
        
        const moduleNames = user.granularPermissions.map(gp => gp.moduleId).join(', ');
        permissions.push(`Modules: ${moduleNames}`);
      } 
      // Fallback to legacy permissions
      else if (user.modulePermissions && user.modulePermissions.length > 0) {
        const moduleCount = user.modulePermissions.length;
        permissions.push(`Access to ${moduleCount} module${moduleCount > 1 ? 's' : ''}`);
        
        const moduleNames = user.modulePermissions.map(mp => mp.module).join(', ');
        permissions.push(`Modules: ${moduleNames}`);
      } else {
        permissions.push('No specific permissions assigned');
      }
      
      return permissions;
    }

    return ['Standard User Access'];
  };

  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title="My Profile"
        recordDetails={`@${user.username} · ${user.role}`}
        backHref="/dashboard"
        backLabel="Back to dashboard"
        meta={<AccountStatus active={user.isActive} />}
        actions={<GlassActionDock><GlassActionButton label="Settings" tone="blue" icon={<Settings className="h-4 w-4" />} onClick={() => router.push('/settings/account')} aria-label="Account Settings" /></GlassActionDock>}
      />
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-28 sm:px-4 sm:pb-6">
        <AccountIdentity user={user} />
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <AccountSection title="Basic information" icon={<User className="h-4 w-4" />}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <AccountField label="Display name">{getUserDisplayName()}</AccountField>
                <AccountField label="Username"><span className="break-all">{user.username}</span></AccountField>
                <AccountField label="Role">{user.role}</AccountField>
                <AccountField label="Account status">{user.isActive ? 'Active' : 'Inactive'}</AccountField>
                {user.email && <div className="col-span-2"><AccountField label="Email address"><span className="break-all">{user.email}</span></AccountField></div>}
              </dl>
            </AccountSection>
            <AccountSection title="Permissions & access" icon={<Shield className="h-4 w-4" />}>
              <ul className="space-y-2">
                {getPermissionSummary().map((permission, index) => <li key={index} className="flex min-w-0 items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 break-words text-sm">{permission}</span>
                </li>)}
              </ul>
              {user.role === 'Staff' && !!user.granularPermissions?.length && <div className="mt-4 border-t border-border/60 pt-3">
                <h3 className="mb-3 text-xs font-medium text-muted-foreground">Detailed module access</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {user.granularPermissions.map(gp => <div key={gp.moduleId} className="min-w-0 rounded-lg border border-border/60 p-3">
                    <p className="break-words text-sm font-medium">{gp.moduleId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{gp.pages.length} page{gp.pages.length === 1 ? '' : 's'} accessible</p>
                  </div>)}
                </div>
              </div>}
            </AccountSection>
          </div>
          <aside className="min-w-0 space-y-4">
            <AccountSection title="Account activity" icon={<Calendar className="h-4 w-4" />}>
              <dl className="space-y-3">
                <AccountField label="Created">{formatSafeDate(user.createdAt, 'dd MMM yyyy')}</AccountField>
                <AccountField label="Last login">{formatSafeDate(user.lastLogin, 'dd MMM yyyy, HH:mm', 'No login recorded')}</AccountField>
              </dl>
            </AccountSection>
            <AccountSection title="Account settings" icon={<Settings className="h-4 w-4" />}>
              <p className="text-sm text-muted-foreground">Manage your username, password and automatic lock preferences.</p>
              <Link href="/settings/account" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Settings className="h-4 w-4" />Account Settings</Link>
            </AccountSection>
          </aside>
        </div>
      </div>
    </div>
  );
}
