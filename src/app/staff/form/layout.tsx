import { ProtectedRoute } from "@/components/auth/protected-route";

export default function StaffFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="staff" requiredPermission="edit">
      {children}
    </ProtectedRoute>
  );
} 