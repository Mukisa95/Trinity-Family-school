'use client';

import { useWorkspacePreparation } from '@/lib/hooks/use-workspace-preparation';

export function WorkspacePreparationStatus({ scope, role }: { scope: string; role: string }) {
  // Keep reconnect recovery and automatic retries running without rendering
  // download progress, task lists or a saved-data notice in the workspace.
  useWorkspacePreparation(scope, role);
  return null;
}
