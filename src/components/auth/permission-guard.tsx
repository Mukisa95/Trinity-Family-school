"use client";

import { useAuth } from "@/lib/contexts/auth-context";

interface PermissionGuardProps {
  children: React.ReactNode;
  module: string;
  permission?: 'view_only' | 'edit' | 'full_access';
  fallback?: React.ReactNode;
}

export function PermissionGuard({ 
  children, 
  module, 
  permission = 'view_only',
  fallback = null 
}: PermissionGuardProps) {
  const { user, canAccessModule, canEdit, canDelete } = useAuth();

  if (!user) return null;

  // Check basic module access
  if (!canAccessModule(module)) {
    return <>{fallback}</>;
  }

  // Check specific permission level
  if (permission === 'edit' && !canEdit(module)) {
    return <>{fallback}</>;
  }

  if (permission === 'full_access' && !canDelete(module)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
} 