'use client';

import { PageHeader } from '@/components/common/page-header';
import { AccessLevelsManager } from '@/components/access-levels/access-levels-manager';
import { ActionGuard } from '@/components/auth/action-guard';

export default function AccessLevelsPage() {
  return (
    <ActionGuard module="users" page="list" action="manage_permissions">
      <div className="space-y-6">
        <PageHeader
          title="Access Levels"
          description="Create and manage access levels to simplify user permission assignment"
        />
        <AccessLevelsManager />
      </div>
    </ActionGuard>
  );
}
