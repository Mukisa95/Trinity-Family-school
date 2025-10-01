import { ProtectedRoute } from "@/components/auth/protected-route";

export default function CommentaryManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="exams" requiredPermission="edit">
      {children}
    </ProtectedRoute>
  );
} 