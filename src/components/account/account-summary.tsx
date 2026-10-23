'use client';

import { useAuth } from '@/lib/contexts/auth-context';
import { SettingsRow, SettingsRows } from '@/components/settings/settings-controls';

export function AccountSummary() {
  const { user } = useAuth();
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  return <SettingsRows>
    <SettingsRow label="Name"><span className="break-words text-right text-xs">{name}</span></SettingsRow>
    <SettingsRow label="Email"><span className="break-all text-right text-xs text-muted-foreground">{user.email || 'Not provided'}</span></SettingsRow>
    <SettingsRow label="Role"><span className="text-xs text-muted-foreground">{user.role}</span></SettingsRow>
    <SettingsRow label="Account status"><span className="text-xs text-muted-foreground">{user.isActive ? 'Active' : 'Inactive'}</span></SettingsRow>
  </SettingsRows>;
}
