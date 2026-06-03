import { ProtectedRoute } from "@/components/auth/protected-route";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="staff" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 