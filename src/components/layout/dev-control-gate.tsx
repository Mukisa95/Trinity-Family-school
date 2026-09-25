'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/contexts/auth-context';
import { SecureAuthService } from '@/lib/services/secure-auth.service';

export function DevControlGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unlockedUserId, setUnlockedUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setUnlockedUserId(null);
    setPassword('');
    setError('');
  }, [user?.id]);

  if (user?.role !== 'Admin') return null;

  const isUnlocked = unlockedUserId === user.id;
  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim() || isVerifying) return;

    setIsVerifying(true);
    setError('');
    try {
      const verifiedUser = await SecureAuthService.verifyCredentials(user.username, password);
      if (verifiedUser?.id !== user.id || verifiedUser.role !== 'Admin') {
        setError('The password could not be verified for this administrator account.');
        return;
      }
      setUnlockedUserId(user.id);
    } catch {
      setError('We could not verify the administrator password. Check your connection and try again.');
    } finally {
      setPassword('');
      setIsVerifying(false);
    }
  };

  if (isUnlocked) {
    return (
      <>
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setUnlockedUserId(null)}>
            <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
            Lock Dev Contral
          </Button>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-2 py-8 sm:px-4">
      <Card className="w-full border-amber-200 bg-white shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle>Dev Contral locked</CardTitle>
          <CardDescription>
            Seeding, Firestore usage, deployment settings, and system audit require administrator confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleUnlock}>
            <div className="space-y-2">
              <Label htmlFor="dev-control-password">Administrator password</Label>
              <div className="relative">
                <Input
                  id="dev-control-password"
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
                  aria-describedby={error ? 'dev-control-password-error' : undefined}
                  className="min-h-11 pr-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-11 w-11"
                  onClick={() => setShowPassword(visible => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isVerifying}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {error && <p id="dev-control-password-error" role="alert" className="text-sm text-red-700">{error}</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button asChild type="button" variant="outline" className="min-h-11">
                <Link href="/">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isVerifying || !password.trim()} className="min-h-11 gap-2">
                {isVerifying ? <KeyRound className="h-4 w-4 animate-pulse" /> : <ShieldCheck className="h-4 w-4" />}
                {isVerifying ? 'Verifying…' : 'Unlock Dev Contral'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
