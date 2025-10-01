import { ProtectedRoute } from "@/components/auth/protected-route";

export default function RequirementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="requirements" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 