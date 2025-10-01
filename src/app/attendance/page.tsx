"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit3, Eye, CalendarClock } from "lucide-react";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";

export default function AttendanceHubPage() {
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  
  return (
    <>
      <PageHeader
        title="Attendance Management"
        description="Record, view, and manage pupil attendance."
      />
      
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Edit3 className="mr-3 h-6 w-6 text-primary" />
              Record Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Take daily attendance for classes.
            </p>
            <Button asChild className="w-full">
              <Link href="/attendance/record">Go to Record Attendance</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Eye className="mr-3 h-6 w-6 text-primary" />
              View Attendance Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              View attendance summaries by class, pupil, or date range.
            </p>
            <Button asChild className="w-full">
              <Link href="/attendance/view">Go to View Reports</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <CalendarClock className="mr-3 h-6 w-6 text-primary" />
              Manage Excluded Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Define non-school days (holidays, weekends) to exclude them from attendance calculations.
            </p>
            <Button asChild className="w-full">
              <Link href="/attendance/excluded-days">Manage Excluded Days</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 