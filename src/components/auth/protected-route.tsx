"use client";

import { useAuth } from "@/lib/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  module?: string;
  requiredPermission?: 'view_only' | 'edit' | 'full_access';
  requireAuth?: boolean;
}

export function ProtectedRoute({ 
  children, 
  module, 
  requiredPermission = 'view_only',
  requireAuth = true 
}: ProtectedRouteProps) {
  const { user, isLoading, canAccessModule, canEdit, canDelete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // Check if authentication is required
      if (requireAuth && !user) {
        router.push('/login');
        return;
      }

      // Check module access if module is specified
      if (module && user) {
        const hasAccess = canAccessModule(module);
        
        if (!hasAccess) {
          // Redirect to home page or show unauthorized
          router.push('/');
          return;
        }

        // Check specific permission level if required
        if (requiredPermission === 'edit' && !canEdit(module)) {
          router.push('/');
          return;
        }

        if (requiredPermission === 'full_access' && !canDelete(module)) {
          router.push('/');
          return;
        }
      }
    }
  }, [isLoading, user, module, requiredPermission, canAccessModule, canEdit, canDelete, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // If no user and auth is required, show loading (redirect will happen in useEffect)
  if (requireAuth && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Redirecting to login...</span>
      </div>
    );
  }

  // If module is specified and user doesn't have access, show loading (redirect will happen)
  if (module && user && !canAccessModule(module)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 