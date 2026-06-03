import { ProtectedRoute } from "@/components/auth/protected-route";

export default function FeesCollectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="fees" requiredPermission="edit">
      {children}
    </ProtectedRoute>
  );
} 