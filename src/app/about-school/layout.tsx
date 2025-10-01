import { ProtectedRoute } from "@/components/auth/protected-route";

export default function AboutSchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="settings" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 