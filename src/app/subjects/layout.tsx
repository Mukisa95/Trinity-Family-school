import { ProtectedRoute } from "@/components/auth/protected-route";

export default function SubjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="subjects" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 