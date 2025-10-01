import { ProtectedRoute } from "@/components/auth/protected-route";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="events" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 