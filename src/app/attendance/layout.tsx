import { ProtectedRoute } from "@/components/auth/protected-route";

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="attendance" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 