"use client";

import * as React from "react";
import { MoreHorizontal, Edit, Trash2, UserPlus, UserCircle2, Filter, X, Users, Phone, Mail } from "lucide-react";
import { GlassActionButton, GlassActionDock, GlassPageSearchInput, GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { GlassSummaryBar } from "@/components/common/glass-summary-bar";
import { GlassPageRouteSkeleton } from "@/components/common/glass-page-loading";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Staff } from "@/types";
import { STAFF_DEPARTMENTS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useStaff, useDeleteStaff } from "@/lib/hooks/use-staff";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { formatStaffRoles } from "@/lib/utils/format";
import { getStaffStatus, STAFF_STATUS_LABELS } from "@/lib/utils/staff-status";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";

export default function StaffPage() {
  const { toast } = useToast();
  
  const reduceMotion = useReducedMotion();
  const { data: staffList = [], isLoading, error } = useStaff();
  const deleteStaffMutation = useDeleteStaff();
  const router = useRouter();

  // View and filter states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('active');
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);

  // Filter staff based on search and filters
  const filteredStaff = React.useMemo(() => {
    return staffList.filter((staff: Staff) => {
      const matchesSearch = searchTerm === '' || 
        `${staff.firstName} ${staff.lastName} ${staff.employeeId} ${staff.email} ${staff.role}`.toLowerCase()
          .includes(searchTerm.toLowerCase());
      
      const matchesDepartment = departmentFilter === 'all' || 
        (Array.isArray(staff.department) ? staff.department.includes(departmentFilter) : staff.department === departmentFilter);
      
      const matchesStatus = statusFilter === 'all' || getStaffStatus(staff) === statusFilter;
      
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [staffList, searchTerm, departmentFilter, statusFilter]);

  // Stats calculations
  const stats = React.useMemo(() => {
    const total = staffList.length;
    const teaching = staffList.filter((s: Staff) => 
      Array.isArray(s.department) ? s.department.includes('Teaching') : s.department === 'Teaching'
    ).length;
    const administration = staffList.filter((s: Staff) => 
      Array.isArray(s.department) ? s.department.includes('Administration') : s.department === 'Administration'
    ).length;
    const support = staffList.filter((s: Staff) => 
      Array.isArray(s.department) ? s.department.includes('Support') : s.department === 'Support'
    ).length;
    const management = staffList.filter((s: Staff) => 
      Array.isArray(s.department) ? s.department.includes('Management') : s.department === 'Management'
    ).length;
    
    return { total, teaching, administration, support, management };
  }, [staffList]);

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to delete ${staffName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteStaffMutation.mutateAsync(staffId);
      toast({
        title: "Staff Deleted",
        description: "Staff member has been successfully deleted.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete staff member. Please try again.",
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('all');
    setStatusFilter('all');
  };

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (departmentFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    return count;
  }, [departmentFilter, statusFilter]);

  const hasActiveFilters = searchTerm || departmentFilter !== 'all' || statusFilter !== 'all';

  if (isLoading) {
    return <GlassPageRouteSkeleton variant="list" />;
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Staff Management"
          subtitle="Manage staff registration, profiles, and roles."
          backHref="/"
        />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <Card className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center dark:bg-red-950/40">
                <X className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-slate-100">Error Loading Staff</h3>
              <p className="text-gray-600 mb-4 dark:text-slate-300">There was a problem loading the staff data.</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title="Staff Management"
        subtitle="Manage staff registration, profiles, and roles."
        backHref="/"
        backLabel="Back to dashboard"
        className="mb-1.5"
        meta={
          <span className="whitespace-nowrap rounded-full border border-brand-alt-100/80 bg-brand-alt-surface-50 px-2 py-0.5 text-[10px] font-bold text-brand-alt-ink-700 dark:border-brand-alt-800/80 dark:bg-brand-alt-surface-950/40 dark:text-brand-alt-ink-300">
            {filteredStaff.length} {filteredStaff.length === 1 ? 'Staff Member' : 'Staff Members'}
          </span>
        }
        center={
          <GlassPageSearchInput
            placeholder="Search staff by name, ID, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        }
        actionsLeading={
          <GlassPageSearchInput
            placeholder="Search staff by name, ID, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            containerClassName="lg:hidden"
          />
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Filters"
              tone="blue"
              icon={<Filter className="h-4 w-4" />}
              badge={activeFiltersCount > 0 ? activeFiltersCount : undefined}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              aria-label="Toggle Filters"
            />
            <GlassActionButton
              label="Mofus"
              tone="slate"
              icon={<Users className="h-4 w-4" />}
              onClick={() => router.push('/staff/mofus')}
              aria-label="Staff Mofus Assignments"
            />
            <GlassActionButton
              label="Add Staff"
              tone="emerald"
              icon={<UserPlus className="h-4 w-4" />}
              onClick={() => router.push('/staff/form')}
              aria-label="Add New Staff"
            />
          </GlassActionDock>
        }
      />

      <GlassSummaryBar
        left={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-black tracking-wider text-brand-alt-ink-900 dark:text-brand-alt-ink-200 uppercase">
              Staff Summary
            </span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1 bg-brand-surface-50/80 dark:bg-brand-surface-950/20 border border-brand-100/50 dark:border-brand-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-brand-ink-600 dark:text-brand-ink-400">{stats.total}</span>
              <span className="text-brand-ink-700/85 dark:text-brand-ink-300 font-medium">Total Staff</span>
            </div>
            <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-green-600 dark:text-green-400">{stats.teaching}</span>
              <span className="text-green-700/85 dark:text-green-300 font-medium">Teaching</span>
            </div>
            <div className="flex items-center gap-1 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-orange-600 dark:text-orange-400">{stats.administration}</span>
              <span className="text-orange-700/85 dark:text-orange-300 font-medium">Administration</span>
            </div>
            <div className="flex items-center gap-1 bg-brand-secondary-surface-50/80 dark:bg-brand-secondary-surface-950/20 border border-brand-secondary-100/50 dark:border-brand-secondary-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-brand-secondary-ink-600 dark:text-brand-secondary-ink-400">{stats.support}</span>
              <span className="text-brand-secondary-ink-700/85 dark:text-brand-secondary-ink-300 font-medium">Support</span>
            </div>
            {stats.management > 0 && (
              <div className="flex items-center gap-1 bg-brand-alt-surface-50/80 dark:bg-brand-alt-surface-950/20 border border-brand-alt-100/50 dark:border-brand-alt-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-brand-alt-ink-600 dark:text-brand-alt-ink-400">{stats.management}</span>
                <span className="text-brand-alt-ink-700/85 dark:text-brand-alt-ink-300 font-medium">Management</span>
              </div>
            )}
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 pb-28 sm:pb-6 space-y-4 sm:space-y-6">
        {/* Show recess status banner if in recess mode */}
        <RecessStatusBanner />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredStaff.length}</span> of {stats.total} staff members
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="staff-status-filter" className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="staff-status-filter" className="h-11 w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Expandable Filters */}
        <AnimatePresence>
          {filtersExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="overflow-hidden"
            >
              <Card className="bg-white/80 backdrop-blur-sm border-brand-100/50 dark:bg-slate-900/80 dark:border-brand-800/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-slate-200">Filter Staff</h4>
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-6 text-xs px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="staff-department-filter" className="text-xs font-medium mb-1.5 block">Department</Label>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger id="staff-department-filter" className="h-11 text-sm">
                          <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {STAFF_DEPARTMENTS.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="h-11 text-sm"
                        disabled={!hasActiveFilters}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>





      {/* Staff Display */}
      {filteredStaff.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center dark:bg-slate-900">
            <Users className="w-8 h-8 text-gray-400 dark:text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-slate-100">
            {hasActiveFilters ? 'No Staff Found' : 'No Staff Members'}
          </h3>
          <p className="text-gray-600 mb-4 dark:text-slate-300">
            {hasActiveFilters 
              ? 'No staff members match your current search criteria.'
              : 'Get started by adding your first staff member.'
            }
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          ) : (
            <Button onClick={() => router.push('/staff/form')}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add First Staff Member
            </Button>
          )}
        </Card>
      ) : (
        <>
            <div className="grid grid-cols-1 gap-3 md:hidden" data-staff-view="cards">
              {filteredStaff.map((staff: Staff) => (
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  onEdit={() => router.push(`/staff/form?id=${staff.id}`)}
                  onView={() => router.push(`/staff/${staff.id}`)}
                  onDelete={() => handleDeleteStaff(staff.id, `${staff.firstName} ${staff.lastName}`)}
                  isDeleting={deleteStaffMutation.isPending}
                />
              ))}
            </div>
            <div className="hidden md:block" data-staff-view="table">
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-slate-900">
                      <TableHead className="font-semibold">Staff Member</TableHead>
                      <TableHead className="font-semibold">Employee ID</TableHead>
                      <TableHead className="font-semibold">Department</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Contact</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((staff: Staff) => (
                      <TableRow key={staff.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/50">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={staff.photo} alt={`${staff.firstName} ${staff.lastName}`} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium dark:bg-blue-950/40 dark:text-blue-300">
                                {staff.firstName[0]}{staff.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Button
                                variant="link"
                                className="p-0 h-auto font-medium text-left"
                                onClick={() => router.push(`/staff/${staff.id}`)}
                              >
                                {staff.firstName} {staff.lastName}
                              </Button>
                              <p className="text-xs text-gray-500 dark:text-slate-400">{staff.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{staff.employeeId}</span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={Array.isArray(staff.department) ? 
                              (staff.department.includes('Teaching') ? 'default' : 
                               staff.department.includes('Management') ? 'secondary' : 'outline') :
                              (staff.department === 'Teaching' ? 'default' : 
                               staff.department === 'Management' ? 'secondary' : 'outline')}
                            className="text-xs"
                          >
                            {Array.isArray(staff.department) ? staff.department.join(', ') : staff.department}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatStaffRoles(staff.role)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center text-xs text-gray-600 dark:text-slate-300">
                              <Phone className="w-3 h-3 mr-1" />
                              {staff.contactNumber ? (
                                <a 
                                  href={`tel:${staff.contactNumber}`}
                                  className="text-link hover:underline font-medium cursor-pointer"
                                >
                                  {staff.contactNumber}
                                </a>
                              ) : (
                                staff.contactNumber
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><StaffStatusBadge staff={staff} /></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-11 w-11 p-0" aria-label={`Actions for ${staff.firstName} ${staff.lastName}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/staff/${staff.id}`)}>
                                <UserCircle2 className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/staff/form?id=${staff.id}`)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteStaff(staff.id, `${staff.firstName} ${staff.lastName}`)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                disabled={deleteStaffMutation.isPending}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
        </>
      )}
      </div>
    </div>
  );
}

// Staff Card Component
function StaffCard({ 
  staff, 
  onEdit, 
  onView, 
  onDelete,
  isDeleting 
}: { 
  staff: Staff; 
  onEdit: () => void; 
  onView: () => void; 
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
      <Card className="group overflow-hidden border-border/70 bg-card/95 shadow-sm transition-colors hover:border-primary/30">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={staff.photo} alt={`${staff.firstName} ${staff.lastName}`} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                  {staff.firstName[0]}{staff.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <Button
                  variant="link"
                  className="h-auto min-h-11 whitespace-normal break-words p-0 text-left font-semibold text-foreground hover:text-primary"
                  onClick={onView}
                >
                  {staff.firstName} {staff.lastName}
                </Button>
                <p className="break-all text-xs font-mono text-muted-foreground">{staff.employeeId}</p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-11 w-11 shrink-0 p-0"
                  aria-label={`Actions for ${staff.firstName} ${staff.lastName}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={onView}>
                  <UserCircle2 className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Department & Role */}
          <div className="space-y-2 mb-3">
            <StaffStatusBadge staff={staff} />
            <div className="flex items-center justify-between">
              <Badge 
                variant={Array.isArray(staff.department) ? 
                  (staff.department.includes('Teaching') ? 'default' : 
                   staff.department.includes('Management') ? 'secondary' : 'outline') :
                  (staff.department === 'Teaching' ? 'default' : 
                   staff.department === 'Management' ? 'secondary' : 'outline')}
                className="text-xs break-words"
              >
                {Array.isArray(staff.department) ? staff.department.join(', ') : staff.department}
              </Badge>
            </div>
            <p className="break-words text-sm font-medium text-foreground">{formatStaffRoles(staff.role)}</p>
          </div>

          {/* Contact Info */}
          <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center text-xs text-gray-600 dark:text-slate-300">
              <Mail className="w-3 h-3 mr-2 flex-shrink-0" />
              <span className="truncate">{staff.email}</span>
            </div>
            <div className="flex items-center text-xs text-gray-600 dark:text-slate-300">
              <Phone className="w-3 h-3 mr-2 flex-shrink-0" />
              {staff.contactNumber ? (
                <a 
                  href={`tel:${staff.contactNumber}`}
                  className="text-link hover:underline font-medium cursor-pointer"
                >
                  {staff.contactNumber}
                </a>
              ) : (
                staff.contactNumber
              )}
            </div>
          </div>
        </CardContent>
      </Card>
  );
}

function StaffStatusBadge({ staff }: { staff: Staff }) {
  const status = getStaffStatus(staff);
  return (
    <Badge variant="outline" className={status === 'active'
      ? 'whitespace-nowrap border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
      : 'whitespace-nowrap border-border bg-muted text-muted-foreground'}>
      {STAFF_STATUS_LABELS[status]}
    </Badge>
  );
}
