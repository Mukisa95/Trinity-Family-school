'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { 
  ProcurementSummary, 
  ViewPeriodType, 
  ProcurementBudget
} from '@/types';

interface ReportsAndAnalyticsProps {
  summary: ProcurementSummary | null;
  viewPeriod: ViewPeriodType;
  setViewPeriod: (period: ViewPeriodType) => void;
  budgets: ProcurementBudget[];
  onViewItemDetail: (itemId: string) => void;
}

export function ReportsAndAnalytics({ 
  summary, 
  viewPeriod, 
  setViewPeriod, 
  budgets,
  onViewItemDetail 
}: ReportsAndAnalyticsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports & Analytics</h2>
        <p className="text-gray-600">Detailed reports and budget comparisons</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>
            Reports and analytics functionality will be implemented here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Reports and analytics features coming soon...
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 