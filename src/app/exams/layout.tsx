import { ProtectedRoute } from "@/components/auth/protected-route";

export default function ExamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="exams" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 