"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { AndroidNotificationStatus } from '@/components/notifications/android-notification-status';
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { AccountIdentity, AccountSection, AccountStatus } from "@/components/account/account-profile";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Eye, EyeOff, Save, KeyRound, Shield, AlertCircle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUpdateUser } from "@/lib/hooks/use-users";
import { Loader2 } from "lucide-react";

import { PasskeySettings } from '@/components/settings/passkey-settings';
import { PASSKEYS_CHANGED_EVENT, PasskeyService } from '@/lib/services/passkey.service';

export default function AccountSettingsPage() {
  const { user, refreshUser, autoLockEnabled, setAutoLockEnabled, autoLockAction, setAutoLockAction, deviceUnlockForAutoLock, setDeviceUnlockForAutoLock } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const updateUserMutation = useUpdateUser();

  // Form states
  const [formData, setFormData] = useState({
    username: user?.username || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // UI states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [localDeviceUnlockAvailable, setLocalDeviceUnlockAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!user) return setLocalDeviceUnlockAvailable(false);
      const supported = await PasskeyService.localSupported().catch(() => false);
      setLocalDeviceUnlockAvailable(supported && PasskeyService.hasLocalUnlock(user.id));
    };
    void check();
    window.addEventListener(PASSKEYS_CHANGED_EVENT, check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener(PASSKEYS_CHANGED_EVENT, check);
      window.removeEventListener('focus', check);
    };
  }, [user]);

  useEffect(() => {
    if (deviceUnlockForAutoLock && autoLockAction === 'signout') {
      setDeviceUnlockForAutoLock(false);
    }
  }, [autoLockAction, deviceUnlockForAutoLock, localDeviceUnlockAvailable, setDeviceUnlockForAutoLock]);

  // Handle navigation in useEffect to avoid state updates during render
  React.useEffect(() => {
    if (!user) {
      // Don't redirect immediately, let the auth context settle
      const timer = setTimeout(() => {
        if (!user) {
          router.replace('/login');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, router]);

  // Ensure password fields are always empty and never prefilled
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }));
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Loading account settings...</h2>
          <p className="text-muted-foreground mt-2">Please wait while we load your account information.</p>
        </div>
      </div>
    );
  }

  const handleUpdateUsername = async () => {
    if (!formData.username.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid Username",
        description: "Username cannot be empty."
      });
      return;
    }

    if (formData.username === user.username) {
      toast({
        variant: "destructive",
        title: "No Changes",
        description: "The username is the same as your current username."
      });
      return;
    }

    setIsUpdatingUsername(true);
    try {
      await updateUserMutation.mutateAsync({
        userId: user.id,
        updates: { username: formData.username }
      });

      toast({
        title: "Username Updated",
        description: "Your username has been successfully updated."
      });

      // Refresh user data
      await refreshUser();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update username."
      });
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleUpdatePassword = async () => {
    // Validation
    if (!formData.currentPassword) {
      toast({
        variant: "destructive",
        title: "Current Password Required",
        description: "Please enter your current password."
      });
      return;
    }

    if (!formData.newPassword) {
      toast({
        variant: "destructive",
        title: "New Password Required",
        description: "Please enter a new password."
      });
      return;
    }

    if (formData.newPassword.length < 4) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 4 characters long."
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "New password and confirmation password don't match."
      });
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast({
        variant: "destructive",
        title: "Same Password",
        description: "New password must be different from your current password."
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // Note: In a real application, you would verify the current password on the server
      // For now, we'll just update the password
      await updateUserMutation.mutateAsync({
        userId: user.id,
        updates: { password: formData.newPassword }
      });

      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated."
      });

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update password."
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getUserDisplayName = () => {
    if (user.role === 'Staff' && user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username;
  };

  const handleLockOnCloseAndSavePreference = () => {
    setAutoLockAction('lock-on-close');
    setShowLockModal(false);
    toast({
      title: "Auto Lock Preference Set",
      description: "Your account will be locked when you close the browser window."
    });
  };

  const handleLockOnLeaveAndSavePreference = () => {
    setAutoLockAction('lock-on-leave');
    setShowLockModal(false);
    toast({
      title: "Auto Lock Preference Set",
      description: "Your account will be locked when you leave the window or switch tabs."
    });
  };

  const handleSignOutAndSavePreference = async () => {
    setAutoLockAction('signout');
    setShowLockModal(false);
    toast({
      title: "Auto Lock Preference Set",
      description: "You will be signed out when you close the browser window."
    });
  };

  const lockPreferenceLabel = autoLockAction === 'lock-on-close' ? 'Locks on close'
    : autoLockAction === 'lock-on-leave' ? 'Locks on leave'
    : autoLockAction === 'signout' ? 'Signs out on close' : 'Not set';

  return (
    <div className="min-h-screen">
      <GlassPageTopBar title="Account Settings" recordDetails={`@${user.username} · ${user.role}`} backHref="/settings" backLabel="Back to settings"
        meta={<AccountStatus active={user.isActive} />}
        actions={<GlassActionDock><GlassActionButton label="Profile" tone="blue" icon={<User className="h-4 w-4" />} onClick={() => router.push('/profile')} aria-label="View my profile" /></GlassActionDock>}
      />
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-28 sm:px-4 sm:pb-6">
        <AccountIdentity user={user} />
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <PasskeySettings />
            <AccountSection title="Username settings" icon={<User className="h-4 w-4" />} description="Change the username you use to sign in.">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" type="text" value={formData.username} onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))} placeholder="Enter your username" className="h-11" />
                </div>
                <div className="flex justify-end border-t border-border/60 pt-3">
                  <Button onClick={handleUpdateUsername} disabled={isUpdatingUsername || formData.username === user.username} className="min-h-11 w-full rounded-lg sm:w-auto">
                    {isUpdatingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isUpdatingUsername ? 'Updating...' : 'Update Username'}
                  </Button>
                </div>
              </div>
            </AccountSection>
            <AccountSection title="Password settings" icon={<KeyRound className="h-4 w-4" />} description="Change your password to keep your account secure.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input id="current-password" type={showCurrentPassword ? 'text' : 'password'} value={formData.currentPassword} onChange={e => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))} placeholder="Enter your current password" autoComplete="off" autoFocus={false} className="h-11 pr-12" />
                    <Button type="button" variant="ghost" className="absolute right-0 top-0 h-11 w-11 rounded-lg px-0" onClick={() => setShowCurrentPassword(!showCurrentPassword)} aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'} aria-pressed={showCurrentPassword}>
                      {showCurrentPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>
                <div className="grid content-start gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input id="new-password" type={showNewPassword ? 'text' : 'password'} value={formData.newPassword} onChange={e => setFormData(prev => ({ ...prev, newPassword: e.target.value }))} placeholder="Enter your new password" autoComplete="new-password" aria-describedby="password-help" className="h-11 pr-12" />
                    <Button type="button" variant="ghost" className="absolute right-0 top-0 h-11 w-11 rounded-lg px-0" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showNewPassword}>
                      {showNewPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>
                <div className="grid content-start gap-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Confirm your new password" autoComplete="new-password" className="h-11 pr-12" />
                    <Button type="button" variant="ghost" className="absolute right-0 top-0 h-11 w-11 rounded-lg px-0" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>
                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>
                <p id="password-help" className="text-xs text-muted-foreground sm:col-span-2">Password must be at least 4 characters long (letters, numbers, or any combination).</p>
              </div>
              <div className="mt-4 flex justify-end border-t border-border/60 pt-3">
                <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword} className="min-h-11 w-full rounded-lg sm:w-auto">
                  {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </AccountSection>
          </div>
          <aside className="min-w-0 space-y-4">
            <AccountSection title="Auto lock settings" icon={<Lock className="h-4 w-4" />}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><Label htmlFor="account-auto-lock" className="text-sm font-medium">Auto Lock</Label><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Automatically lock or sign out when closing or leaving the browser.</p></div>
                <button id="account-auto-lock" role="switch" aria-checked={autoLockEnabled} aria-label="Auto Lock" onClick={() => setAutoLockEnabled(!autoLockEnabled)} type="button" className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none ${autoLockEnabled ? 'bg-primary' : 'bg-input'}`}><span className={`h-5 w-5 rounded-full bg-background shadow-sm transition-transform motion-reduce:transition-none ${autoLockEnabled ? 'translate-x-5' : 'translate-x-0'}`} /></span>
                </button>
              </div>
              {autoLockEnabled && <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
                <div><p className="text-xs font-medium text-muted-foreground">Current preference</p><p className="mt-1 text-sm">{lockPreferenceLabel}</p></div>
                <Button onClick={() => setShowLockModal(true)} variant="outline" className="min-h-11 w-full rounded-lg"><Shield className="h-4 w-4" />{autoLockAction ? 'Change Preference' : 'Set Preference'}</Button>
              </div>}
              {autoLockEnabled && autoLockAction !== 'signout' && <div className="mt-4 flex items-start justify-between gap-3 border-t border-border/60 pt-3">
                <div className="min-w-0"><Label htmlFor="account-device-unlock" className="text-sm font-medium">Require device unlock</Label><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{localDeviceUnlockAvailable ? 'Use fingerprint, face unlock, or the device PIN. The privacy lock also opens offline.' : 'Enable biometric / device unlock in the device unlock settings first.'}</p></div>
                <button id="account-device-unlock" type="button" role="switch" aria-checked={deviceUnlockForAutoLock} aria-label="Require device unlock" disabled={!localDeviceUnlockAvailable} onClick={() => setDeviceUnlockForAutoLock(!deviceUnlockForAutoLock)} className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
                  <span className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none ${deviceUnlockForAutoLock ? 'bg-primary' : 'bg-input'}`}><span className={`h-5 w-5 rounded-full bg-background shadow-sm transition-transform motion-reduce:transition-none ${deviceUnlockForAutoLock ? 'translate-x-5' : 'translate-x-0'}`} /></span>
                </button>
              </div>}
            </AccountSection>
            <AccountSection title="Security tips" icon={<AlertCircle className="h-4 w-4" />}>
              <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                <li>Use a strong, unique password.</li>
                <li>Don't share your login credentials with others.</li>
                <li>Log out when using shared computers.</li>
                <li>Contact an administrator if you suspect unauthorized access.</li>
              </ul>
            </AccountSection>
          </aside>
        </div>
        <AndroidNotificationStatus />
      </div>
      <Dialog open={showLockModal} onOpenChange={setShowLockModal}>
        <DialogContent className="max-w-md border-border/70 bg-card dark:bg-card">
          <DialogTitle className="pr-6 text-lg">Set Auto Lock Preference</DialogTitle>
          <DialogDescription>Choose what happens when you close or leave the browser window.</DialogDescription>
          <div className="space-y-2">
            {[
              { value: 'lock-on-close', label: 'Lock on Close', description: 'Lock when you close the browser window.', onClick: handleLockOnCloseAndSavePreference },
              { value: 'lock-on-leave', label: 'Lock on Leave', description: 'Lock when you switch tabs or leave the window.', onClick: handleLockOnLeaveAndSavePreference },
              { value: 'signout', label: 'Sign Out on Close', description: 'Sign out when you close the browser window.', onClick: handleSignOutAndSavePreference }
            ].map(option => <button key={option.value} type="button" onClick={option.onClick} aria-pressed={autoLockAction === option.value} className={`flex min-h-11 w-full items-center gap-3 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${autoLockAction === option.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
              <Lock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{option.label}</span><span className="mt-1 block text-xs text-muted-foreground">{option.description}</span></span>
              {autoLockAction === option.value && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Current preference" />}
            </button>)}
          </div>
          <DialogClose asChild><Button variant="outline" className="min-h-11 rounded-lg">Cancel</Button></DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
