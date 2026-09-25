'use client';

import { useRouter } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HistoricalPupilSeedingWorkspace } from '@/components/pupils/historical-pupil-seeding-workspace';

export default function HistoricalPupilSeedingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const canAccessSeeding = GranularPermissionService.canAccessPage(user, 'pupils', 'historical_seeding');

  if (isLoading) return <div className="min-h-screen bg-slate-50" />;

  if (!canAccessSeeding) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <Card className="mx-auto max-w-lg border-amber-200 bg-amber-50/60 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle>Seeding access required</CardTitle>
            <CardDescription>Historical pupil seeding is available only to administrators through Dev Contral.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => router.push('/pupils')}>
              Return to pupils
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <HistoricalPupilSeedingWorkspace canCreate={GranularPermissionService.canPerformAction(user, 'pupils', 'historical_seeding', 'create_historical_pupil')} />
      </div>
    </main>
  );
}
