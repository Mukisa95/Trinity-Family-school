import { ProtectedRoute } from "@/components/auth/protected-route";

export default function BankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="banking" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 