'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { canManageFeeReminders, type CreateFeeReminderInput, type FeeReminder, type FeeReminderRecipient } from '@/lib/fees/fee-reminders';
import type {CreateCustomFeeNoteInput} from '@/lib/fees/custom-fee-notes';
import type {Pupil} from '@/types';

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

export function useFeeReminders(pupilId: string, open: boolean, featureEnabled = false) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['fee-reminders', user?.id, pupilId];
  useEffect(() => {
    if (!featureEnabled || !('serviceWorker' in navigator)) return;
    const refresh = (event: MessageEvent) => {
      if (event.data?.type === 'FEE_REMINDER_UPDATED') void queryClient.invalidateQueries({ queryKey: ['fee-reminders', user?.id, pupilId] });
    };
    navigator.serviceWorker.addEventListener('message', refresh);
    return () => navigator.serviceWorker.removeEventListener('message', refresh);
  }, [queryClient, user?.id, pupilId, featureEnabled]);
  const notes = useQuery<FeeReminder[]>({
    queryKey, enabled: featureEnabled && open && !!pupilId && !!user?.id,
    queryFn: async ({signal}) => featureEnabled ? (await reminderRequest(`/api/fees/reminders?pupilId=${encodeURIComponent(pupilId)}`, {signal})).notes : [],
    staleTime: 0, refetchInterval: featureEnabled && open ? 60_000 : false,
  });
  const recipients = useQuery<FeeReminderRecipient[]>({
    queryKey: ['fee-reminder-recipients', user?.id, pupilId], enabled: featureEnabled && open && canManageFeeReminders(user),
    queryFn: async ({signal}) => featureEnabled ? (await reminderRequest(`/api/fees/reminders?pupilId=${encodeURIComponent(pupilId)}&includeRecipients=true`, {signal})).recipients : [],
    staleTime: 0,
  });
  const updateRecipients = useMutation({
    mutationFn: async ({ id, recipientIds }: { id: string; recipientIds: string[] | null }): Promise<FeeReminder> =>
      (await reminderRequest(`/api/fees/reminders/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify({ action: 'recipients', pupilId, recipientIds }),
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
      method: 'PATCH', body: JSON.stringify({ action: 'cancel', pupilId, reason: reason || '' }),
    }),
    onSuccess: (_, { id, reason }) => {
      queryClient.setQueryData<FeeReminder[]>(queryKey, previous => previous?.map(note =>
        note.id === id ? { ...note, reminderStatus: 'cancelled', cancelReason: reason || '' } : note));
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  return { notes, create, cancel, recipients, updateRecipients };
}

export function useFeeNotesSwitch(pupil: Pupil) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => reminderRequest('/api/fees/reminders/switch', {
      method: 'POST', body: JSON.stringify({pupilId: pupil.id, enabled}),
    }),
    onSuccess: async ({enabled}: {enabled: boolean}) => {
      await queryClient.cancelQueries({queryKey: ['fee-reminders']});
      queryClient.removeQueries({queryKey: ['fee-reminders']});
      queryClient.removeQueries({queryKey: ['fee-reminder-recipients']});
      // Change already-loaded pupil data without fetching it again just to
      // display the switch. The normal pupil revision cache carries it to peers.
      queryClient.setQueriesData({predicate: query => query.queryKey[0] === 'pupils'}, (previous: any) =>
        Array.isArray(previous) ? previous.map(item => item.id === pupil.id ? {...item, feeNotesEnabled: enabled} : item)
          : previous?.id === pupil.id ? {...previous, feeNotesEnabled: enabled} : previous);
    },
  });
}
