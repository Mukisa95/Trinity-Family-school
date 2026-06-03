import { ProtectedRoute } from "@/components/auth/protected-route";

export default function ClassesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="classes" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 