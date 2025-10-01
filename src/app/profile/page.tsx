"use client";

import React from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Shield, Calendar, Clock, Settings, Edit } from "lucide-react";
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
          router.push('/login');
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
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View your account information and settings"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Your account details and personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                <p className="text-lg font-semibold">{getUserDisplayName()}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Username</label>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{user.username}</p>
              </div>

              {user.email && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <Badge variant={user.role === 'Admin' ? 'default' : user.role === 'Staff' ? 'secondary' : 'outline'}>
                    {user.role}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Account Status</label>
                <Badge variant={user.isActive ? 'default' : 'destructive'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Account Activity
            </CardTitle>
            <CardDescription>
              Your recent account activity and login information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatSafeDate(user.lastLogin, "PPP 'at' p", 'Never logged in')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatSafeDate(user.createdAt, "PPP", 'Date not available')}
                </p>
              </div>

              {user.staffId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Staff ID</label>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{user.staffId}</p>
                </div>
              )}

              {user.pupilId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Associated Pupil ID</label>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{user.pupilId}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissions & Access */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions & Access
            </CardTitle>
            <CardDescription>
              Your current system permissions and access levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getPermissionSummary().map((permission, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">{permission}</span>
                </div>
              ))}
            </div>

            {user.role === 'Staff' && user.granularPermissions && user.granularPermissions.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-3">Detailed Module Access</h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {user.granularPermissions.map((gp) => (
                    <div key={gp.moduleId} className="p-3 border rounded-lg">
                      <div className="font-medium text-sm">{gp.moduleId}</div>
                      <div className="text-xs text-muted-foreground">
                        {gp.pages.length} page{gp.pages.length > 1 ? 's' : ''} accessible
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => router.push('/settings/account')} className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Account Settings
        </Button>
        
        <Button variant="outline" onClick={() => router.push('/settings/general')} className="flex items-center gap-2">
          <Edit className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>
    </div>
  );
} 