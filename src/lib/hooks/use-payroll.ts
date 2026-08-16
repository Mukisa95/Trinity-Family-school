import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";

export const PAYROLL_QUERY_KEYS = {
  all: ["payroll"] as const,
  overview: () => [...PAYROLL_QUERY_KEYS.all, "overview"] as const,
  staff: (staffId: string) =>
    [...PAYROLL_QUERY_KEYS.all, "staff", staffId] as const,
};

async function payrollRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token)
    throw new Error("Your session is not ready. Please refresh and try again.");
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || !body.success)
    throw new Error(body.error || "Payroll request failed.");
  return body.result ?? body;
}

export function usePayrollOverview(enabled = true) {
  return useQuery({
    queryKey: PAYROLL_QUERY_KEYS.overview(),
    queryFn: () =>
      payrollRequest<{ today: string; rows: any[] }>("/api/payroll/overview"),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useStaffPayroll(staffId: string, enabled = true) {
  return useQuery({
    queryKey: PAYROLL_QUERY_KEYS.staff(staffId),
    queryFn: () =>
      payrollRequest<any>(`/api/payroll/staff/${encodeURIComponent(staffId)}`),
    enabled: enabled && Boolean(staffId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSalaryProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      payrollRequest("/api/payroll/profiles", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_, payload: any) => {
      client.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.overview() });
      if (payload?.staffId)
        client.invalidateQueries({
          queryKey: PAYROLL_QUERY_KEYS.staff(payload.staffId),
        });
    },
  });
}

export function useRecordSalaryPayment(staffId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      payrollRequest(
        `/api/payroll/staff/${encodeURIComponent(staffId)}/payments`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.overview() });
      client.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.staff(staffId) });
    },
  });
}

export function useScheduleSalaryIncrease(staffId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      payrollRequest(
        `/api/payroll/staff/${encodeURIComponent(staffId)}/increase`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.overview() });
      client.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.staff(staffId) });
    },
  });
}
