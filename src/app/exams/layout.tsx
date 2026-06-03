"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { memo } from "react";

// 🚀 OPTIMIZATION: Memoized layout to prevent unnecessary re-renders
// This keeps the sidebar and layout persistent when navigating between exam pages
const ExamsLayoutInner = memo(function ExamsLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="exams" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
});

export default function ExamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ExamsLayoutInner>{children}</ExamsLayoutInner>;
} 