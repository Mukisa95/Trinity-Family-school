import { ProtectedRoute } from "@/components/auth/protected-route";

export default function FeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="fees" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 