import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SMSService, SMSTemplate } from '../services/sms.service';

const SMS_TEMPLATES_QUERY_KEY = 'smsTemplates';

export function useSMSTemplates() {
  return useQuery({
    queryKey: [SMS_TEMPLATES_QUERY_KEY],
    queryFn: SMSService.getSMSTemplates,
  });
}

export function useCreateSMSTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: Omit<SMSTemplate, 'id' | 'createdAt'>) =>
      SMSService.createSMSTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SMS_TEMPLATES_QUERY_KEY] });
    },
  });
}

export function useUpdateSMSTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SMSTemplate> }) =>
      SMSService.updateSMSTemplate(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SMS_TEMPLATES_QUERY_KEY] });
    },
  });
}

export function useDeleteSMSTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => SMSService.deleteSMSTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SMS_TEMPLATES_QUERY_KEY] });
    },
  });
} 