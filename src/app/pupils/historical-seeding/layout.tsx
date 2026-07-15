import { ProtectedRoute } from '@/components/auth/protected-route';

export default function HistoricalPupilSeedingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
