import { ProtectedRoute } from "@/components/auth/protected-route";

export default function UniformsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute module="uniforms" requiredPermission="view_only">
      {children}
    </ProtectedRoute>
  );
} 