import { ProtectedRoute } from "@/components/auth/protected-route";

export default function ProcurementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="procurement" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 