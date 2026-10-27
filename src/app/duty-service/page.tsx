'use client';

import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { List as TabsList, Trigger as TabsTrigger } from '@radix-ui/react-tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  Calendar,
  Plus,
  Loader2,
  ArrowLeft,
  Printer,
  Crown,
} from 'lucide-react';
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { useAcademicYears, useActiveAcademicYear } from '@/lib/hooks/use-academic-years';
import {
  usePrefectoralPosts,
  useDutyRotas,
  useDutyAssignments,
  useDeleteDutyRota,
  usePostAssignments,
  useLeadershipTerms
} from '@/lib/hooks/use-duty-service';
import { useStaff } from '@/lib/hooks/use-staff';
import { usePupils } from '@/lib/hooks/use-pupils';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { ActionGuard } from '@/components/auth/action-guard';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CreatePrefectoralPostModal } from '@/components/duty-service/PrefectoralManagement/CreatePrefectoralPostModal';
import { CreateDutyRotaModal } from '@/components/duty-service/DutyManagement/CreateDutyRotaModal';
import { EditDutyRotaModal } from '@/components/duty-service/DutyManagement/EditDutyRotaModal';
import { CreateLeadershipTermModal } from '@/components/duty-service/PrefectoralManagement/CreateLeadershipTermModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { DutyTimelineView } from '@/components/duty-service/DutyManagement/DutyTimelineView';
import { PrefectoralManagementView } from '@/components/duty-service/PrefectoralManagement/PrefectoralManagementView';
import type { DutyRota } from '@/types/duty-service';
import { generateDutyRotaPDF } from '@/lib/utils/pdf-generator';
import { DutyServiceService } from '@/lib/services/duty-service.service';
import { useDutyServiceData } from '@/lib/hooks/use-duty-service-data';
import { DutyOnlineAction } from '@/components/duty-service/DutyOnlineAction';
import { StaffOnDutyCard, DutyRotaCard } from '@/components/duty-service/duty-overview';
import { dutyRotaStatus } from '@/lib/duty-service/selectors';
import { useSchoolDate } from '@/lib/hooks/use-school-date';
import { Toaster } from '@/components/ui/toaster';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';

export default function DutyServicePage() {
  const pdfViewer = usePDFViewer();
  const schoolDate = useSchoolDate();
  const { data: savedData, offline, error: dataError } = useDutyServiceData();
  const [activeTab, setActiveTab] = useState('duty-management');
  const [selectedRotaForTimeline, setSelectedRotaForTimeline] = useState<string | null>(null);
  const [selectedRotaForEdit, setSelectedRotaForEdit] = useState<DutyRota | null>(null);
  const [showEditRotaModal, setShowEditRotaModal] = useState(false);
  const [printingRotaId, setPrintingRotaId] = useState<string | null>(null);
  const [selectedLeadershipTermId, setSelectedLeadershipTermId] = useState<string | 'all'>('all');
  const [hasSetDefaultTerm, setHasSetDefaultTerm] = useState(false);
  const { data: academicYears = [] } = useAcademicYears();
  const { data: activeAcademicYear } = useActiveAcademicYear();
  const { data: prefectoralPosts = [], isLoading: postsLoading } = usePrefectoralPosts();
  const { data: dutyRotas = [], isLoading: rotasLoading } = useDutyRotas(activeAcademicYear?.id);
  const { data: dutyAssignments = [], isLoading: assignmentsLoading } = useDutyAssignments();
  const { data: postAssignments = [], isLoading: postAssignmentsLoading } = usePostAssignments();
  const { data: leadershipTerms = [], isLoading: termsLoading } = useLeadershipTerms(activeAcademicYear?.id);
  const { data: staff = [] } = useStaff();
  const { data: pupils = [] } = usePupils();
  const permissions = usePermissions();
  const deleteRota = useDeleteDutyRota();
  const { toast } = useToast();

  useEffect(() => {
    if (!hasSetDefaultTerm && leadershipTerms.length > 0) {
      const activeTerm = leadershipTerms.find(term => term.isActive);
      if (activeTerm) {
        setSelectedLeadershipTermId(activeTerm.id);
      }
      setHasSetDefaultTerm(true);
    }
  }, [leadershipTerms, hasSetDefaultTerm]);

  // Function to handle printing duty rota
  const handlePrintDutyRota = async (rota: DutyRota) => {
    setPrintingRotaId(rota.id);
    try {
      // Get the timeline data for this rota
      const timelineData = DutyServiceService.generateDutyTimeline(rota, dutyAssignments.filter(item => item.rotaId === rota.id));

      if (timelineData) {
        // Find the academic year and term data
        const academicYearData = academicYears.find(ay => ay.id === rota.academicYearId);
        const termData = rota.termId ? academicYearData?.terms?.find(t => t.id === rota.termId) : null;

        const fileName = `${rota.dutyName.replace(/[^a-zA-Z0-9]/g, '_')}_Duty_Rota_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        await pdfViewer.runPDFJob(
          { fileName, title: rota.dutyName, initialMessage: 'Rendering duty rota tables…' },
          async ({ updateProgress }) => {
            updateProgress(24, 'Preparing duty assignments…');
            const blob = await generateDutyRotaPDF({
              dutyRota: rota,
              timeline: timelineData,
              staff,
              pupils,
              academicYear: academicYearData,
              term: termData || undefined,
            });
            updateProgress(96, 'Finalizing duty rota…');
            return blob;
          },
        );
        toast({
          title: "PDF Generated Successfully",
          description: `Duty rota "${rota.dutyName}" is ready in the PDF workspace.`,
        });
      } else {
        toast({
          title: "No Data Available",
          description: "No timeline data available for this duty rota.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error Generating PDF",
        description: "An error occurred while generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPrintingRotaId(null);
    }
  };

  // Function to get member name by ID and type
  const getMemberName = (memberId: string, memberType: string) => {
    if (memberType === 'staff') {
      const member = staff.find(s => s.id === memberId);
      return member ? `${member.firstName} ${member.lastName}` : `Staff ID: ${memberId}`;
    } else if (memberType === 'prefects' || memberType === 'pupils') {
      const member = pupils.find(p => p.id === memberId);
      return member ? `${formatPupilDisplayName(member)} - ${member.className || 'No Class'}` : `Pupil ID: ${memberId}`;
    }
    return `Unknown ID: ${memberId}`;
  };

  const canAccessDutyService = permissions.canAccessModule('duty_service');

  if (!canAccessDutyService) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to access the Duty & Service module.</p>
        </div>
      </div>
    );
  }

  const isLoading = postsLoading || rotasLoading || assignmentsLoading || postAssignmentsLoading || termsLoading;

  const filteredPostAssignments = selectedLeadershipTermId === 'all'
    ? postAssignments
    : postAssignments.filter(a => a.leadershipTermId === selectedLeadershipTermId);

  const selectedRota = activeTab === 'duty-management' ? dutyRotas.find(rota => rota.id === selectedRotaForTimeline) : undefined;
  const termSelector = activeTab === 'prefectoral' ? (
    <Select value={selectedLeadershipTermId} onValueChange={setSelectedLeadershipTermId}>
      <SelectTrigger aria-label="Leadership term" className="h-9 w-[min(72vw,14rem)] text-xs sm:w-56"><SelectValue placeholder="Select term" /></SelectTrigger>
      <SelectContent><SelectItem value="all">All Terms (Combined)</SelectItem>{leadershipTerms.map(term => <SelectItem key={term.id} value={term.id}>{term.termName} {term.isActive ? '(Active)' : '(Terminated)'}</SelectItem>)}</SelectContent>
    </Select>
  ) : undefined;
  const pageActions = <GlassActionDock>
    <TabsList aria-label="Duty & Service sections" className="flex items-center">
      <TabsTrigger value="duty-management" asChild onClick={() => setSelectedRotaForTimeline(null)}><GlassActionButton label="Duties" aria-label="Duty Management" icon={<Calendar className="h-4 w-4" />} active={activeTab === 'duty-management'} /></TabsTrigger>
      <TabsTrigger value="prefectoral" asChild><GlassActionButton label="Prefects" aria-label="Prefectoral" tone="purple" icon={<Users className="h-4 w-4" />} active={activeTab === 'prefectoral'} /></TabsTrigger>
    </TabsList>
    {selectedRota ? <GlassActionButton label="Print" aria-label={`Print ${selectedRota.dutyName}`} icon={printingRotaId === selectedRota.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} disabled={printingRotaId === selectedRota.id} onClick={() => void handlePrintDutyRota(selectedRota)} /> : activeTab === 'duty-management' ? (
      <DutyOnlineAction><ActionGuard module="duty_service" page="list" action="assign_duties"><CreateDutyRotaModal trigger={<GlassActionButton label="New rota" aria-label="Create rota" tone="emerald" disabled={isLoading} icon={<Plus className="h-4 w-4" />} />} /></ActionGuard></DutyOnlineAction>
    ) : <DutyOnlineAction>
      <ActionGuard module="duty_service" page="prefectoral" action="create_prefectoral_post">
        <CreateLeadershipTermModal trigger={<GlassActionButton label="New term" aria-label="Create Term" tone="emerald" disabled={isLoading || leadershipTerms.some(term => term.isActive)} title={leadershipTerms.some(term => term.isActive) ? 'Please terminate the active term first' : 'Create Term'} icon={<Calendar className="h-4 w-4" />} />} />
        <CreatePrefectoralPostModal trigger={<GlassActionButton label="New post" aria-label="Create Post" tone="emerald" disabled={isLoading} icon={<Crown className="h-4 w-4" />} />} />
      </ActionGuard>
    </DutyOnlineAction>}
  </GlassActionDock>;

  return (
    <Tabs value={activeTab} onValueChange={value => { setActiveTab(value); if (value === 'duty-management') setSelectedRotaForTimeline(null); }} className="min-w-0 space-y-4 pb-28 sm:space-y-6 sm:pb-6">
      <GlassPageTopBar
        title={selectedRota ? 'Duty schedule' : 'Duty & Service'}
        backHref={selectedRota ? undefined : '/'} backLabel="Back to dashboard"
        leading={selectedRota ? <GlassActionButton label="Back" aria-label="Back to Duty Rotas" tone="slate" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setSelectedRotaForTimeline(null)} /> : undefined}
        recordDetails={selectedRota ? `${selectedRota.dutyName} · ${format(new Date(selectedRota.startDate), 'd MMM yyyy')} – ${format(new Date(selectedRota.endDate), 'd MMM yyyy')} · ${activeAcademicYear?.name || ''}` : `${activeTab === 'prefectoral' ? 'Prefectoral' : 'Duty Management'}${activeAcademicYear?.name ? ` · ${activeAcademicYear.name}` : ''}`}
        titleControls={termSelector} actions={pageActions}
      />

      {offline && <p role="status" className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">{savedData ? "You are offline. Showing saved Duty & Service information. Connect to make changes." : "Connect once to save Duty & Service information on this device."}</p>}
      {dataError && !offline && <p role="alert" className="text-sm text-destructive">Could not refresh Duty & Service. {savedData ? "Showing the last saved information." : "Please try again when your connection is available."}</p>}
      {!isLoading && savedData && <StaffOnDutyCard rotas={dutyRotas} assignments={dutyAssignments} date={schoolDate} memberName={getMemberName} />}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading duty and service data...</p>
          </div>
        </div>
      ) : (
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <TabsContent value="prefectoral">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <PrefectoralManagementView
                  posts={prefectoralPosts}
                  assignments={filteredPostAssignments}
                  selectedTermId={selectedLeadershipTermId === 'all' ? undefined : selectedLeadershipTermId}
                  getPupilName={(pupilId) => {
                    const pupil = pupils.find(p => p.id === pupilId);
                    return pupil ? `${formatPupilDisplayName(pupil)}` : `Pupil ${pupilId.slice(0, 8)}`;
                  }}
                  getPupilClass={(pupilId) => {
                    const pupil = pupils.find(p => p.id === pupilId);
                    return pupil ? pupil.className || 'No Class' : 'Unknown Class';
                  }}
                  getPupilPhoto={(pupilId) => {
                    const pupil = pupils.find(p => p.id === pupilId);
                    return pupil?.photo || '';
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duty-management">
            {selectedRotaForTimeline ? (
              <div className="min-w-0 space-y-4">
                <DutyTimelineView rotaId={selectedRotaForTimeline} />
              </div>
            ) : (
              <section aria-label="Duty rotas" className="space-y-3 sm:space-y-4">
                <h2 className="text-lg font-semibold">Duty rotas</h2>
                {dutyRotas.length === 0 ? <Card><CardContent className="py-8 text-center">
                  <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <h3 className="font-semibold">No duty rotas</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{offline ? 'No duty rotas are saved for this academic year.' : 'Create a rota to start planning duties.'}</p>
                </CardContent></Card> : [...dutyRotas].sort((a, b) => Number(dutyRotaStatus(b, schoolDate) === 'Active') - Number(dutyRotaStatus(a, schoolDate) === 'Active')).map(rota => (
                  <DutyRotaCard key={rota.id} rota={rota} assignments={dutyAssignments} date={schoolDate} memberName={getMemberName}
                    onTimeline={() => setSelectedRotaForTimeline(rota.id)}
                    onEdit={() => { setSelectedRotaForEdit(rota); setShowEditRotaModal(true); }}
                    onDelete={() => { if (confirm('Are you sure you want to delete this duty rota? This action cannot be undone.')) deleteRota.mutate(rota.id); }}
                    onPrint={() => void handlePrintDutyRota(rota)} printing={printingRotaId === rota.id} deleting={deleteRota.isPending}
                  />
                ))}
              </section>
            )}
          </TabsContent>
        </div>
      )}

      {/* Edit Duty Rota Modal */}
      <EditDutyRotaModal
        rota={selectedRotaForEdit}
        open={showEditRotaModal}
        onOpenChange={setShowEditRotaModal}
      />

      {/* Toaster for notifications */}
      <Toaster />
    </Tabs>
  );
}
