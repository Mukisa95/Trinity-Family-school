"use client";

import * as React from 'react';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, Briefcase, Building2, Clock, Pencil, CheckCircle, XCircle, UserX, AlertTriangle, ChevronDown, FileText, Award, Activity, Users, UserRoundPlus, WalletCards, UserCircle2, ShieldAlert, ExternalLink } from 'lucide-react';
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useStaffById, useUpdateStaff } from '@/lib/hooks/use-staff';
import { UsersService } from '@/lib/services/users.service';
import { useAuth } from '@/lib/contexts/auth-context';
import { LinkedUserAccountDialog } from '@/components/users/linked-user-account-dialog';
import { StaffMofus } from '@/components/staff/staff-mofus';
import { StaffTeachingAssignments } from '@/components/staff/staff-teaching-assignments';
import { formatStaffRoles } from '@/lib/utils/format';
import { getStaffStatus, STAFF_STATUS_LABELS, type StaffStatus } from '@/lib/utils/staff-status';
import { cn } from '@/lib/utils';

function formatDate(value?: string) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StaffDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { canAccessModule, canAccessPage } = useAuth();
  const { data: staff, isLoading, error } = useStaffById(resolvedParams.id);
  const { mutateAsync: updateStaff } = useUpdateStaff();
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [isLinkedAccountOpen, setIsLinkedAccountOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    employment: true,
    qualifications: false,
    medical: false,
    emergency: true
  });

  const handleViewDocument = (url: string) => {
    setSelectedDocument(url);
  };

  const handleStatusChange = async (newStatus: StaffStatus) => {
    if (!staff || statusUpdating || newStatus === getStaffStatus(staff)) return;
    
    setStatusUpdating(true);
    try {
      await updateStaff({ id: resolvedParams.id, data: { status: newStatus } });
      try {
        const users = await UsersService.getAllUsers();
        const staffUser = users.find(user => user.staffId === resolvedParams.id);

        if (staffUser) {
          await UsersService.updateUser(staffUser.id, { isActive: newStatus === 'active' });
        }

        toast({
          title: "Status Updated",
          description: `Staff status changed to ${STAFF_STATUS_LABELS[newStatus]}.${staffUser ? ` User access has been ${newStatus === 'active' ? 'enabled' : 'disabled'}.` : ''}`,
        });
      } catch (userError) {
        console.error('Error updating user access:', userError);
        toast({
          title: "Partial Update",
          description: `Staff status updated to ${STAFF_STATUS_LABELS[newStatus]}, but failed to update user access. Please check user settings manually.`,
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update staff status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-500 dark:text-slate-400" />;
      case 'onLeave':
        return <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'suspended':
        return <UserX className="h-4 w-4 text-red-500 dark:text-red-400" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800/60';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700';
      case 'onLeave':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60';
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800/60';
      default:
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800/60';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Staff Details"
          subtitle="Loading profile..."
          backHref="/staff"
        />
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading staff details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Staff Details"
          subtitle="Staff member not found"
          backHref="/staff"
        />
        <div className="container mx-auto px-4 py-12 max-w-md">
          <Card>
            <CardContent className="text-center p-8">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4 dark:text-yellow-400" />
              <h2 className="text-xl font-semibold mb-2">Staff Member Not Found</h2>
              <p className="text-muted-foreground mb-4">The staff member you're looking for doesn't exist or has been removed.</p>
              <Button asChild className="w-full">
                <Link href="/staff">Back to Staff List</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title={`${staff.firstName} ${staff.lastName}`}
        recordDetails={`Employee ID: ${staff.employeeId || 'N/A'} • ${formatStaffRoles(staff.role)}`}
        backHref="/staff"
        backLabel="Back to staff list"
        meta={
          <Badge className={cn("text-xs border shadow-sm", getStatusColor(staff.status || 'active'))}>
            {STAFF_STATUS_LABELS[getStaffStatus(staff)]}
          </Badge>
        }
        actions={
          <GlassActionDock>
            {canAccessModule('users') && (
              <GlassActionButton
                label="Account"
                tone="purple"
                icon={<UserRoundPlus className="h-4 w-4" />}
                onClick={() => setIsLinkedAccountOpen(true)}
                aria-label="Manage staff account"
              />
            )}
            {canAccessPage('payroll', 'detail') && (
              <GlassActionButton
                label="Salary"
                tone="emerald"
                icon={<WalletCards className="h-4 w-4" />}
                onClick={() => router.push(`/payroll/staff/${resolvedParams.id}`)}
                aria-label="View staff salary"
              />
            )}
            <GlassActionButton
              label="Edit"
              tone="blue"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => router.push(`/staff/form?id=${resolvedParams.id}`)}
              aria-label="Edit Profile"
            />
          </GlassActionDock>
        }
      />
      <LinkedUserAccountDialog
        target="staff"
        targetId={staff.id}
        targetName={`${staff.firstName} ${staff.lastName}`.trim()}
        defaultUsername={`${staff.firstName}.${staff.lastName}`.replace(/\s+/g, '').toLowerCase()}
        open={isLinkedAccountOpen}
        onOpenChange={setIsLinkedAccountOpen}
      />
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-28 sm:px-4 sm:pb-6">
        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0 rounded-2xl border border-border sm:h-20 sm:w-20">
                <AvatarImage src={staff.photo} alt={`${staff.firstName} ${staff.lastName}`} className="object-cover" />
                <AvatarFallback className="rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
                  {staff.firstName?.[0]}{staff.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 basis-40">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Staff profile · {staff.employeeId || 'No employee ID'}</p>
                <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{[staff.firstName, staff.otherNames, staff.lastName].filter(Boolean).join(' ')}</h1>
                <p className="mt-1 break-words text-sm text-muted-foreground">{formatStaffRoles(staff.role)}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0" />{Array.isArray(staff.department) ? staff.department.join(', ') : staff.department}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 shrink-0" />Joined {formatDate(staff.joinDate)}</span>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 sm:w-auto sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                <Badge variant="outline" className={cn('gap-1.5 font-medium', getStatusColor(getStaffStatus(staff)))}>
                  {getStatusIcon(getStaffStatus(staff))}{STAFF_STATUS_LABELS[getStaffStatus(staff)]}
                </Badge>
                <div className="space-y-1">
                  <label htmlFor="staff-profile-status" className="block text-xs text-muted-foreground">Employment status</label>
                  <Select value={getStaffStatus(staff)} onValueChange={(value) => handleStatusChange(value as StaffStatus)} disabled={statusUpdating}>
                    <SelectTrigger id="staff-profile-status" className="h-11 w-40 bg-background" aria-label="Employment status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {statusUpdating && <p role="status" className="text-xs text-muted-foreground">Updating status…</p>}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-2">
              {staff.email ? <a href={`mailto:${staff.email}`} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="break-all">{staff.email}</span></a> : <p className="flex items-center gap-2 px-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" />Email not provided</p>}
              {staff.contactNumber ? <a href={`tel:${staff.contactNumber}`} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Phone className="h-4 w-4 shrink-0 text-muted-foreground" />{staff.contactNumber}</a> : <p className="flex items-center gap-2 px-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" />Phone not provided</p>}
            </div>
          </CardContent>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            {canAccessModule('classes') && <StaffTeachingAssignments staff={staff} />}
            {canAccessModule('pupils') && <StaffMofus staff={staff} />}
            <ProfileSection title="Employment details" icon={<Briefcase className="h-4 w-4" />} open={expandedSections.employment} onOpenChange={() => toggleSection('employment')}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <ProfileField label="Employee ID" value={staff.employeeId} />
                <ProfileField label="Contract type" value={staff.contractType} className="capitalize" />
                <ProfileField label="Department" value={Array.isArray(staff.department) ? staff.department.join(', ') : staff.department} />
                <ProfileField label="Position / roles" value={formatStaffRoles(staff.role)} />
                <ProfileField label="Join date" value={formatDate(staff.joinDate)} />
                <ProfileField label="Status" value={STAFF_STATUS_LABELS[getStaffStatus(staff)]} />
              </dl>
              <DocumentGallery title="CV documents" photos={staff.cvPhotos} onView={handleViewDocument} />
            </ProfileSection>

            <ProfileSection title="Personal information" icon={<UserCircle2 className="h-4 w-4" />} open={expandedSections.personal} onOpenChange={() => toggleSection('personal')}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <ProfileField label="Date of birth" value={formatDate(staff.dateOfBirth)} />
                <ProfileField label="Gender" value={staff.gender} />
                <ProfileField label="National ID" value={staff.nationalId} />
                <ProfileField label="Marital status" value={staff.maritalStatus} />
                <ProfileField label="Religion" value={staff.religion} />
                <ProfileField label="Alternative phone" value={staff.alternativePhone ? <a className="inline-flex min-h-11 items-center text-primary hover:underline" href={`tel:${staff.alternativePhone}`}>{staff.alternativePhone}</a> : undefined} />
                <ProfileField label="Address" value={[staff.address, staff.city, staff.country].filter(Boolean).join(', ')} className="col-span-2" />
              </dl>
            </ProfileSection>

            <ProfileSection title="Qualifications & specializations" icon={<Award className="h-4 w-4" />} open={expandedSections.qualifications} onOpenChange={() => toggleSection('qualifications')} summary={`${staff.qualifications?.length || 0} qualifications`}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <ProfileField label="Qualifications" value={<ProfileList items={staff.qualifications} empty="No qualifications listed" />} />
                <ProfileField label="Specializations" value={<ProfileList items={staff.specializations} empty="No specializations listed" />} />
              </dl>
              <DocumentGallery title="Qualification documents" photos={staff.qualificationPhotos} onView={handleViewDocument} />
            </ProfileSection>
          </div>

          <div className="min-w-0 space-y-4">
            <ProfileSection title="Emergency contact" icon={<ShieldAlert className="h-4 w-4" />} open={expandedSections.emergency} onOpenChange={() => toggleSection('emergency')}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <ProfileField label="Name" value={staff.emergencyContact?.name} />
                <ProfileField label="Relationship" value={staff.emergencyContact?.relationship} />
                <ProfileField label="Phone" value={staff.emergencyContact?.phone ? <a className="inline-flex min-h-11 items-center text-primary hover:underline" href={`tel:${staff.emergencyContact.phone}`}>{staff.emergencyContact.phone}</a> : undefined} className="col-span-2" />
                <ProfileField label="Address" value={staff.emergencyContact?.address} className="col-span-2" />
              </dl>
            </ProfileSection>

            <ProfileSection title="Medical information" icon={<Activity className="h-4 w-4" />} open={expandedSections.medical} onOpenChange={() => toggleSection('medical')}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <ProfileField label="Blood group" value={staff.bloodGroup} />
                <ProfileField label="Insurance provider" value={staff.insuranceProvider} />
                <ProfileField label="Insurance number" value={staff.insuranceNumber} className="col-span-2" />
                <ProfileField label="Allergies" value={<ProfileList items={staff.allergies} />} className="col-span-2" />
                <ProfileField label="Medical conditions" value={<ProfileList items={staff.medicalConditions} />} className="col-span-2" />
                <ProfileField label="Medications" value={<ProfileList items={staff.medications} />} className="col-span-2" />
              </dl>
            </ProfileSection>


          </div>
        </div>

        <Dialog open={!!selectedDocument} onOpenChange={open => { if (!open) setSelectedDocument(null); }}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogTitle>Staff document</DialogTitle>
            <DialogDescription>Preview the attached document.</DialogDescription>
            {selectedDocument && <>
              <img src={selectedDocument} alt="Staff document preview" className="max-h-[65vh] w-full rounded-lg bg-muted object-contain" />
              <Button variant="outline" asChild><a href={selectedDocument} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open original</a></Button>
            </>}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ProfileSection({ title, icon, open, onOpenChange, summary, children }: {
  title: string; icon: React.ReactNode; open: boolean; onOpenChange: () => void; summary?: string; children: React.ReactNode;
}) {
  return <Collapsible open={open} onOpenChange={onOpenChange}>
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
      <h2><CollapsibleTrigger className="flex min-h-12 w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
        {summary && <span className="text-xs font-normal text-muted-foreground">{summary}</span>}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </CollapsibleTrigger></h2>
      <CollapsibleContent><CardContent className="border-t border-border/60 p-4">{children}</CardContent></CollapsibleContent>
    </Card>
  </Collapsible>;
}

function ProfileField({ label, value, className }: { label: string; value?: React.ReactNode; className?: string }) {
  return <div className={cn('min-w-0', className)}>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words text-sm leading-relaxed">{value || <span className="text-muted-foreground">Not provided</span>}</dd>
  </div>;
}

function ProfileList({ items, empty = 'None listed' }: { items?: string[]; empty?: string }) {
  return items?.length ? <ul className="space-y-1">{items.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul> : <span className="text-muted-foreground">{empty}</span>;
}

function DocumentGallery({ title, photos, onView }: { title: string; photos?: string[]; onView: (url: string) => void }) {
  if (!photos?.length) return null;
  return <div className="mt-4 border-t border-border/60 pt-3">
    <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" />{title} · {photos.length}</h3>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((photo, index) => <button key={index} type="button" onClick={() => onView(photo)} className="overflow-hidden rounded-lg border border-border bg-muted/30 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View ${title.toLowerCase()}, page ${index + 1}`}>
        <img src={photo} alt={`${title}, page ${index + 1}`} loading="lazy" className="h-20 w-full bg-muted object-cover object-top" />
        <span className="block px-2 py-2 text-xs font-medium">Page {index + 1}</span>
      </button>)}
    </div>
  </div>;
}
