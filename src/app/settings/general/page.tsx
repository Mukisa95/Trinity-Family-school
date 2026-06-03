"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function GeneralSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to account settings
    router.replace('/settings/account');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to account settings...</p>
      </div>
    </div>
  );
} 