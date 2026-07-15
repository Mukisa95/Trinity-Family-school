'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { UsersService } from '@/lib/services/users.service';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HistoricalPupilSeedingWorkspace } from '@/components/pupils/historical-pupil-seeding-workspace';

function HistoricalPupilSeedingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [error, setError] = React.useState('');

  const isAdmin = user?.role === 'Admin';
  const canAccessSeeding = GranularPermissionService.canAccessPage(user, 'pupils', 'historical_seeding');
  const canCreateHistoricalPupils = GranularPermissionService.canPerformAction(
    user,
    'pupils',
    'historical_seeding',
    'create_historical_pupil'
  );

  const handleVerifyPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !password.trim()) return;

    setIsVerifying(true);
    setError('');

    try {
      const authenticatedUser = await UsersService.authenticateUser(user.username, password);
      const isMatchingAdmin = authenticatedUser?.id === user.id && authenticatedUser.role === 'Admin';

      if (!isMatchingAdmin) {
        setError('The password could not be verified for this administrator account.');
        return;
      }

      setPassword('');
      setIsUnlocked(true);
    } catch {
      setError('We could not verify the password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!canAccessSeeding) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <Card className="mx-auto max-w-lg border-amber-200 bg-amber-50/60 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle>Seeding access required</CardTitle>
            <CardDescription>
              Historical pupil seeding is available to administrators and staff explicitly granted this permission.
            </CardDescription>
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
    <>
      <Dialog
        open={isAdmin && !isUnlocked}
        onOpenChange={(open) => {
          if (!open) router.push('/pupils');
        }}
      >
        <DialogContent className="sm:max-w-md" onEscapeKeyDown={(event) => event.preventDefault()}>
          <DialogHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <LockKeyhole className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogTitle>Confirm administrator password</DialogTitle>
            <DialogDescription>
              Historical pupil records can affect reporting and enrolment history. Re-enter your password to continue.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleVerifyPassword}>
            <div className="space-y-2">
              <Label htmlFor="historical-seeding-password">Administrator password</Label>
              <div className="relative">
                <Input
                  id="historical-seeding-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="current-password"
                  autoFocus
                  disabled={isVerifying}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'historical-seeding-password-error' : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 text-muted-foreground"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isVerifying}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {error && (
                <p id="historical-seeding-password-error" className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.push('/pupils')} disabled={isVerifying}>
                Cancel
              </Button>
              <Button type="submit" disabled={isVerifying || !password.trim()} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                {isVerifying ? <KeyRound className="h-4 w-4 animate-pulse" /> : <ShieldCheck className="h-4 w-4" />}
                {isVerifying ? 'Verifying…' : 'Unlock seeding'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {(!isAdmin || isUnlocked) && (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsUnlocked(false)}>
                  Lock workspace
                </Button>
              </div>
            )}
            <HistoricalPupilSeedingWorkspace canCreate={canCreateHistoricalPupils} />
          </div>
        </main>
      )}
    </>
  );
}

export default HistoricalPupilSeedingPage;
