import { ProtectedRoute } from "@/components/auth/protected-route";

export default function AcademicYearsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="academic_years" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 