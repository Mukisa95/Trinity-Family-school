import { ProtectedRoute } from "@/components/auth/protected-route";

export default function PupilsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="pupils" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 