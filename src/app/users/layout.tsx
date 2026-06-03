import { ProtectedRoute } from "@/components/auth/protected-route";

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="users" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 