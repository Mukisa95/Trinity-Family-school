'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { canManageFeeReminders, type CreateFeeReminderInput, type FeeReminder, type FeeReminderRecipient } from '@/lib/fees/fee-reminders';
import type {CreateCustomFeeNoteInput} from '@/lib/fees/custom-fee-notes';

async function reminderRequest(path: string, init?: RequestInit) {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser || firebaseUser.isAnonymous) throw new Error('Please sign in again to use fee reminders.');
  const token = await firebaseUser.getIdToken();
  const response = await fetch(path, {
    ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers }, cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Unable to complete this reminder request.');
  return payload;
}

export function useFeeReminders(pupilId: string, open: boolean) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['fee-reminders', user?.id, pupilId];
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const refresh = (event: MessageEvent) => {
      if (event.data?.type === 'FEE_REMINDER_UPDATED') void queryClient.invalidateQueries({ queryKey: ['fee-reminders', user?.id, pupilId] });
    };
    navigator.serviceWorker.addEventListener('message', refresh);
    return () => navigator.serviceWorker.removeEventListener('message', refresh);
  }, [queryClient, user?.id, pupilId]);
  const notes = useQuery<FeeReminder[]>({
    queryKey, enabled: open && !!pupilId && !!user?.id,
    queryFn: async () => (await reminderRequest(`/api/fees/reminders?pupilId=${encodeURIComponent(pupilId)}`)).notes,
    staleTime: 0, refetchInterval: open ? 60_000 : false,
  });
  const recipients = useQuery<FeeReminderRecipient[]>({
    queryKey: ['fee-reminder-recipients', user?.id], enabled: open && canManageFeeReminders(user),
    queryFn: async () => (await reminderRequest(`/api/fees/reminders?pupilId=${encodeURIComponent(pupilId)}&includeRecipients=true`)).recipients,
    staleTime: 0,
  });
  const updateRecipients = useMutation({
    mutationFn: async ({ id, recipientIds }: { id: string; recipientIds: string[] | null }): Promise<FeeReminder> =>
      (await reminderRequest(`/api/fees/reminders/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify({ action: 'recipients', recipientIds }),
      })).note,
    onSuccess: note => {
      queryClient.setQueryData<FeeReminder[]>(queryKey, previous => previous?.map(item => item.id === note.id ? note : item));
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const create = useMutation({
    mutationFn: async (input: CreateFeeReminderInput | CreateCustomFeeNoteInput): Promise<FeeReminder> =>
      (await reminderRequest('/api/fees/reminders', { method: 'POST', body: JSON.stringify(input) })).note,
    onSuccess: note => {
      queryClient.setQueryData<FeeReminder[]>(queryKey, previous => [note, ...(previous || []).filter(item => item.id !== note.id)]);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => reminderRequest(`/api/fees/reminders/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ action: 'cancel', reason: reason || '' }),
    }),
    onSuccess: (_, { id, reason }) => {
      queryClient.setQueryData<FeeReminder[]>(queryKey, previous => previous?.map(note =>
        note.id === id ? { ...note, reminderStatus: 'cancelled', cancelReason: reason || '' } : note));
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  return { notes, create, cancel, recipients, updateRecipients };
}
