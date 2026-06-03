"use client";

import { useAuth } from "@/lib/contexts/auth-context";
import { GranularPermissionService } from "@/lib/services/granular-permissions.service";

interface ActionGuardProps {
  children: React.ReactNode;
  module: string;
  page: string;
  action: string;
  fallback?: React.ReactNode;
}

export function ActionGuard({ 
  children, 
  module,
  page,
  action,
  fallback = null 
}: ActionGuardProps) {
  const { user } = useAuth();

  if (!user) return null;

  // Check if user can perform the specific action
  const canPerform = GranularPermissionService.canPerformAction(user, module, page, action);

  if (!canPerform) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
} 