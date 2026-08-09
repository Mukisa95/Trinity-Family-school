"use client";

import * as React from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { SystemUser } from '@/types';
import { UsersService, type LinkedAccountTarget } from '@/lib/services/users.service';
import { useAuth } from '@/lib/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type LinkedUserAccountDialogProps = {
  target: LinkedAccountTarget;
  targetId: string;
  targetName: string;
  defaultUsername: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountChanged?: () => void;
};

const targetCopy = {
  pupil: {
    title: 'Parent account',
    inactive: 'No parent account is active for this pupil yet.',
    activate: 'Activate parent account',
  },
  staff: {
    title: 'Staff account',
    inactive: 'No staff account is active for this staff member yet.',
    activate: 'Activate staff account',
  },
} as const;

export function LinkedUserAccountDialog({
  target,
  targetId,
  targetName,
  defaultUsername,
  open,
  onOpenChange,
  onAccountChanged,
}: LinkedUserAccountDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canAccessModule, canEdit, canPerformAction } = useAuth();
  const [account, setAccount] = React.useState<SystemUser | null>(null);
  const [username, setUsername] = React.useState(defaultUsername);
  const [password, setPassword] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const canView = canAccessModule('users');
  const canCreate = canEdit('users') || canPerformAction('users', 'list', 'create_user') || canPerformAction('users', 'list', 'manage_permissions');
  const canUpdate = canEdit('users') || canPerformAction('users', 'list', 'edit_user') || canPerformAction('users', 'list', 'manage_permissions');
  const canResetPassword = canEdit('users') || canPerformAction('users', 'list', 'reset_password') || canPerformAction('users', 'list', 'manage_permissions');
  const copy = targetCopy[target];

  const refreshAccount = React.useCallback(async () => {
    if (!canView || !targetId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextAccount = await UsersService.getLinkedAccount(target, targetId);
      setAccount(nextAccount);
      setUsername(nextAccount?.username || defaultUsername);
      setIsActive(nextAccount?.isActive ?? true);
    } catch (error) {
      setAccount(null);
      setLoadError(error instanceof Error ? error.message : 'Could not load this account.');
    } finally {
      setIsLoading(false);
    }
  }, [canView, defaultUsername, target, targetId]);

  React.useEffect(() => {
    if (open) {
      setPassword('');
      setShowPassword(false);
      void refreshAccount();
    }
  }, [open, refreshAccount]);

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPassword('');
      setShowPassword(false);
    }
    onOpenChange(nextOpen);
  };

  const invalidateAccountData = () => {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
    onAccountChanged?.();
  };

  const handleSave = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast({ variant: 'destructive', title: 'Username required', description: 'Enter an account username.' });
      return;
    }

    if (!account && !password) {
      toast({ variant: 'destructive', title: 'Password required', description: 'Set an initial password for this account.' });
      return;
    }

    try {
      setIsSaving(true);
      if (!account) {
        if (!canCreate) throw new Error('You do not have permission to activate this account.');
        const created = await UsersService.activateLinkedAccount({
          target,
          targetId,
          username: trimmedUsername,
          password,
        });
        setAccount(created);
        setUsername(created.username);
        setIsActive(created.isActive);
        toast({ title: 'Account activated', description: `${copy.title} created for ${targetName}.` });
      } else {
        const updates: { username?: string; isActive?: boolean; password?: string } = {};
        if (trimmedUsername !== account.username) updates.username = trimmedUsername;
        if (isActive !== account.isActive) updates.isActive = isActive;
        if (password) updates.password = password;

        if (Object.keys(updates).length === 0) {
          closeDialog(false);
          return;
        }
        if ((updates.username !== undefined || updates.isActive !== undefined) && !canUpdate) {
          throw new Error('You do not have permission to change this account.');
        }
        if (updates.password && !canResetPassword) {
          throw new Error('You do not have permission to reset this password.');
        }

        await UsersService.updateUser(account.id, updates);
        setAccount(current => current ? {
          ...current,
          ...(updates.username !== undefined ? { username: updates.username } : {}),
          ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
        } : current);
        setPassword('');
        toast({
          title: 'Account updated',
          description: updates.password
            ? 'The password was changed and existing sessions were revoked.'
            : `${copy.title} details were saved.`,
        });
      }
      invalidateAccountData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Account update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-7">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>
            Manage the account linked to {targetName}. Passwords are never displayed or stored in readable form.
          </DialogDescription>
        </DialogHeader>

        {!canView ? (
          <Alert variant="destructive">
            <AlertTitle>Users access is required</AlertTitle>
            <AlertDescription>You do not have permission to view or manage user accounts.</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading account…
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load account</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {!account && (
              <Alert className="border-primary/20 bg-primary/5">
                <UserRoundPlus className="h-4 w-4 text-primary" />
                <AlertTitle>{copy.inactive}</AlertTitle>
                <AlertDescription>Create it here with a username and an initial password.</AlertDescription>
              </Alert>
            )}

            {account && (
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Account status</span>
                <span className={account.isActive ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                  {account.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`linked-username-${targetId}`}>Account name</Label>
              <Input
                id={`linked-username-${targetId}`}
                value={username}
                onChange={event => setUsername(event.target.value)}
                disabled={Boolean(account) ? !canUpdate : !canCreate}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`linked-password-${targetId}`}>
                {account ? 'Set new password' : 'Initial password'}
              </Label>
              <div className="relative">
                <Input
                  id={`linked-password-${targetId}`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  disabled={Boolean(account) ? !canResetPassword : !canCreate}
                  placeholder={account ? 'Leave blank to keep the current password' : 'Enter a password'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={Boolean(account) ? !canResetPassword : !canCreate}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {account && <p className="text-xs text-muted-foreground">The existing password cannot be recovered. Saving a new one replaces it.</p>}
            </div>

            {account && (
              <div className="flex items-center justify-between rounded-xl border px-3 py-3">
                <div>
                  <Label htmlFor={`linked-active-${targetId}`} className="font-medium">Account access</Label>
                  <p className="text-xs text-muted-foreground">Disabled accounts cannot sign in.</p>
                </div>
                <Switch
                  id={`linked-active-${targetId}`}
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={!canUpdate}
                  aria-label="Enable account access"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => closeDialog(false)} disabled={isSaving}>Cancel</Button>
          {canView && !isLoading && !loadError && (
            <Button onClick={handleSave} disabled={isSaving || (account ? (!canUpdate && !canResetPassword) : !canCreate)}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : account ? <KeyRound className="mr-2 h-4 w-4" /> : <UserRoundPlus className="mr-2 h-4 w-4" />}
              {account ? 'Save account' : copy.activate}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
