import { ProtectedRoute } from "@/components/auth/protected-route";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="notifications" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 