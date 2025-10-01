"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, UserSquare, BookOpen as AcademicIcon, Users as GuardianIconLucide, HeartPulse, CalendarDays, MapPin, Phone, Mail, Briefcase, Home, Edit, Trash2, Receipt, Shirt, BookOpen, MoreVertical, User, GraduationCap, Shield, CreditCard, UserPlus, ChevronDown, BarChart3, Settings, History, TrendingUp, TrendingDown, ArrowRight, Clock, Tag, Printer, Award } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import type { Pupil, Class, AdditionalIdentifier, PupilAssignedFee } from "@/types";
import { usePupil, usePupilsByFamily, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useClasses } from "@/lib/hooks/use-classes";
import { usePupilExamHistory } from "@/lib/hooks/use-exams";
import { useAcademicYears, useActiveAcademicYear } from "@/lib/hooks/use-academic-years";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import { Loader2 } from "lucide-react";
import { ManageIdCodesModal } from "@/components/pupils/manage-id-codes-modal";
import { AssignmentModal } from "@/components/pupils/assignment-modal";
import { useToast } from "@/hooks/use-toast";
import { PupilPhotoDetail } from "@/components/ui/pupil-photo-detail";
import { ActionGuard } from "@/components/auth/action-guard";
import { RMQRCode } from "@/components/ui/rmqr-code";
import { usePupilPLEResults } from '@/lib/hooks/use-ple-results';
import PLEResultsCard from '@/components/ple/PLEResultsCard';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

// Import the new swipeable components
import { SwipeablePupilDetail } from '@/components/pupils/swipeable-pupil-detail';
import { 
  InformationSection, 
  FeesSection, 
  RequirementsSection, 
  AttendanceSection, 
  ResultsSection 
} from '@/components/pupils/pupil-detail-sections';

function SwipeablePupilDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pupilId = searchParams.get('id');
  const { toast } = useToast();
  
  // Firebase hooks
  const { data: pupil, isLoading, error, refetch: refetchPupil } = usePupil(pupilId || '');
  const { data: siblings = [] } = usePupilsByFamily(pupil?.familyId || '');
  const { data: classes = [] } = useClasses();
  const { data: schoolSettings } = useSchoolSettings();
  const updatePupilMutation = useUpdatePupil();
  
  // Academic years data for filters
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  
  // Fetch pupil's exam history
  const { 
    data: pupilExamHistory, 
    isLoading: isLoadingExamHistory 
  } = usePupilExamHistory(pupilId || '');

  // PLE Results
  const { 
    data: pupilPLEResults = [], 
    isLoading: isLoadingPLEResults 
  } = usePupilPLEResults(pupilId || '');

  // State for section management
  const [activeSection, setActiveSection] = React.useState(0);

  // Handle section change
  const handleSectionChange = (sectionIndex: number) => {
    setActiveSection(sectionIndex);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Pupil Details..." />
        <Card>
          <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center"> <Skeleton className="h-32 w-32 rounded-full" /></div>
            <Skeleton className="h-6 w-1/2 mx-auto mt-2" /> <Skeleton className="h-4 w-1/3 mx-auto" />
            <div className="mt-4 space-y-2"> <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-full" /> </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !pupil) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Error Loading Pupil" />
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600">Failed to load pupil details. Please try again.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render section content based on active section
  const renderSectionContent = () => {
    switch (activeSection) {
      case 0: // Information
        return <InformationSection pupil={pupil} classes={classes} />;
      case 1: // Fees
        return <FeesSection pupil={pupil} />;
      case 2: // Requirements
        return <RequirementsSection pupil={pupil} />;
      case 3: // Attendance
        return <AttendanceSection pupil={pupil} />;
      case 4: // Results
        return <ResultsSection pupil={pupil} examHistory={pupilExamHistory || []} />;
      default:
        return <InformationSection pupil={pupil} classes={classes} />;
    }
  };

  return (
    <>
      {/* Header with back button and pupil photo */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex items-center gap-4">
            <PupilPhotoDetail
              pupil={pupil}
              onPhotoChange={async (photoData) => {
                try {
                  await updatePupilMutation.mutateAsync({
                    id: pupil.id,
                    data: { photo: photoData },
                  });
                  toast({
                    title: "Photo Updated",
                    description: `${pupil.firstName}'s photo has been updated successfully.`,
                  });
                  refetchPupil();
                } catch (err) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to update photo. Please try again.",
                  });
                }
              }}
            />
          </div>
        </div>

        {/* Pupil Header Info */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={pupil.photo} alt={formatPupilDisplayName(pupil)} />
                <AvatarFallback className="text-lg">
                  {pupil.firstName?.[0]}{pupil.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {formatPupilDisplayName(pupil)}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm text-gray-600">
                  <Badge variant="outline">{pupil.status}</Badge>
                  <Badge variant="outline">{pupil.section}</Badge>
                  <Badge variant="outline">
                    {classes.find(c => c.id === pupil.classId)?.name || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Swipeable Content */}
        <SwipeablePupilDetail 
          pupil={pupil} 
          onSectionChange={handleSectionChange}
        >
          {renderSectionContent()}
        </SwipeablePupilDetail>
      </div>
    </>
  );
}

export default function SwipeablePupilDetailPage() {
  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Loading Pupil Details..." />
        <Card>
          <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center"> <Skeleton className="h-32 w-32 rounded-full" /></div>
            <Skeleton className="h-6 w-1/2 mx-auto mt-2" /> <Skeleton className="h-4 w-1/3 mx-auto" />
            <div className="mt-4 space-y-2"> <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-full" /> </div>
          </CardContent>
        </Card>
      </div>
    }>
      <SwipeablePupilDetailContent />
    </Suspense>
  );
}
