"use client";

import React from "react";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { SYSTEM_MODULES } from "@/lib/constants/modules";
import { CheckCircle2, XCircle, Shield, User, Key } from "lucide-react";

export default function AuthDebugPage() {
  const { user, isAuthenticated, canAccessModule, canEdit, canDelete } = useAuth();

  return (
    <>
      <PageHeader
        title="Authentication Debug"
        description="View current user authentication status and permissions"
      />

      <div className="space-y-6">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Current User Information
            </CardTitle>
            <CardDescription>Details about the currently logged in user</CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Username</p>
                    <p className="font-mono">{user.username}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Role</p>
                    <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">User ID</p>
                    <p className="font-mono text-xs">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant={user.isActive ? 'default' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {user.email && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="font-mono">{user.email}</p>
                    </div>
                  )}
                  {user.staffId && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Staff ID</p>
                      <p className="font-mono">{user.staffId}</p>
                    </div>
                  )}
                  {user.pupilId && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pupil ID</p>
                      <p className="font-mono">{user.pupilId}</p>
                    </div>
                  )}
                  {user.lastLogin && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Login</p>
                      <p>{new Date(user.lastLogin).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
                <p className="text-muted-foreground">No user is currently logged in</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authentication Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Authentication Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Authenticated</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="font-medium">Not Authenticated</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Module Permissions */}
        {user && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Module Permissions
              </CardTitle>
              <CardDescription>
                Permissions for each system module
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {SYSTEM_MODULES.map((module) => {
                  const hasAccess = canAccessModule(module.id);
                  const canEditModule = canEdit(module.id);
                  const canDeleteModule = canDelete(module.id);

                  return (
                    <div
                      key={module.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{module.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Module ID: <code className="font-mono">{module.id}</code>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!hasAccess && (
                          <Badge variant="outline" className="text-xs">
                            No Access
                          </Badge>
                        )}
                        {hasAccess && !canEditModule && (
                          <Badge variant="secondary" className="text-xs">
                            View Only
                          </Badge>
                        )}
                        {canEditModule && !canDeleteModule && (
                          <Badge variant="default" className="text-xs">
                            View & Edit
                          </Badge>
                        )}
                        {canDeleteModule && (
                          <Badge className="text-xs bg-green-600">
                            Full Access
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Raw Permissions Data */}
              {user.role === 'Staff' && user.modulePermissions && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Raw Permission Data</h4>
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">
                    {JSON.stringify(user.modulePermissions, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Debug Information */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Technical details for troubleshooting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Local Storage</h4>
                <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">
                  {typeof window !== 'undefined' 
                    ? JSON.stringify({
                        trinity_user: localStorage.getItem('trinity_user') ? 'Present' : 'Not found',
                      }, null, 2)
                    : 'N/A'
                  }
                </pre>
              </div>
              
              {user && (
                <div>
                  <h4 className="font-medium mb-1">User Object</h4>
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">
                    {JSON.stringify(user, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 