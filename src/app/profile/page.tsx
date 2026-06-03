"use client";

import React from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Shield, Calendar, Settings, CheckCircle2 } from "lucide-react";
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

  const getRoleColor = () => {
    if (user.role === 'Admin') return 'bg-gradient-to-br from-purple-500 to-indigo-600';
    if (user.role === 'Staff') return 'bg-gradient-to-br from-blue-500 to-cyan-600';
    return 'bg-gradient-to-br from-green-500 to-emerald-600';
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Hero Profile Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-100/50 shadow-lg">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-0" />
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className={`relative ${getRoleColor()} rounded-full p-1 shadow-xl`}>
              <div className="bg-white rounded-full p-4 sm:p-6">
                <div className={`${getRoleColor()} rounded-full p-6 sm:p-8 flex items-center justify-center`}>
                  <User className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-lg border-2 border-blue-50">
                <div className={`w-4 h-4 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                  {getUserDisplayName()}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 font-mono">
                  @{user.username}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge 
                  variant={user.role === 'Admin' ? 'default' : user.role === 'Staff' ? 'secondary' : 'outline'}
                  className="text-sm px-3 py-1"
                >
                  <Shield className="h-3.5 w-3.5 mr-1.5" />
                  {user.role}
                </Badge>
                <Badge variant={user.isActive ? 'default' : 'destructive'} className="text-sm px-3 py-1">
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {user.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="w-full sm:w-auto">
              <Button 
                onClick={() => router.push('/settings/account')} 
                className="w-full sm:w-auto flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all rounded-full"
                size="lg"
              >
                <Settings className="h-4 w-4" />
                Account Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information Card */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              Basic Information
            </CardTitle>
            <CardDescription>
              Your account details and personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Display Name</p>
                  <p className="text-base font-semibold text-gray-900">{getUserDisplayName()}</p>
                </div>
              </div>
              
              <div className="flex items-start justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Username</p>
                  <p className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border">{user.username}</p>
                </div>
              </div>

              {user.email && (
                <div className="flex items-start justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Email Address</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p className="text-sm text-gray-900">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Account Status</p>
                  <Badge variant={user.isActive ? 'default' : 'destructive'} className="mt-1">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions & Access Card */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow lg:col-span-2">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              Permissions & Access
            </CardTitle>
            <CardDescription>
              Your current system permissions and access levels
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {getPermissionSummary().map((permission, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 hover:shadow-md transition-all"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-900 leading-relaxed">{permission}</p>
                  </div>
                ))}
              </div>

              {user.role === 'Staff' && user.granularPermissions && user.granularPermissions.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Detailed Module Access
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {user.granularPermissions.map((gp) => (
                      <div 
                        key={gp.moduleId} 
                        className="p-4 rounded-lg border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="font-semibold text-sm text-gray-900 mb-1">{gp.moduleId}</div>
                        <div className="text-xs text-gray-600">
                          {gp.pages.length} page{gp.pages.length > 1 ? 's' : ''} accessible
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
