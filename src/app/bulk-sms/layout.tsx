import { ProtectedRoute } from "@/components/auth/protected-route";

export default function BulkSmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="bulk_sms" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 