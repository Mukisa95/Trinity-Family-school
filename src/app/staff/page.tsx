"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, GraduationCap, Loader2, UserPlus, UserCircle2, Search, Filter, X, Grid3X3, List, Users, Phone, Mail, Building, Calendar, MapPin } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useStaff, useDeleteStaff } from "@/lib/hooks/use-staff";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatStaffRoles } from "@/lib/utils/format";
import { useTermStatus } from "@/lib/hooks/use-term-status";
import { RecessStatusBanner } from "@/components/common/recess-status-banner";

export default function StaffPage() {
  const { toast } = useToast();
  
  // Use the new term status system
  const { effectiveTerm, isRecessMode, periodMessage } = useTermStatus();
  const { data: staffList = [], isLoading, error } = useStaff();
  const deleteStaffMutation = useDeleteStaff();
  const router = useRouter();

  // View and filter states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [viewMode, setViewMode] = React.useState<'cards' | 'table'>('cards');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Check mobile on mount and resize
  React.useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('cards');
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Filter staff based on search and filters
  const filteredStaff = React.useMemo(() => {
    return staffList.filter((staff: Staff) => {
      const matchesSearch = searchTerm === '' || 
        `${staff.firstName} ${staff.lastName} ${staff.employeeId} ${staff.email} ${staff.role}`.toLowerCase()
          .includes(searchTerm.toLowerCase());
      
      const matchesDepartment = departmentFilter === 'all' || 
        (Array.isArray(staff.department) ? staff.department.includes(departmentFilter) : staff.department === departmentFilter);
      
      // For status, we'll assume active staff for now
      const matchesStatus = statusFilter === 'all' || true;
      
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
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Staff</h3>
              <p className="text-gray-600 mb-4">There was a problem loading the staff data.</p>
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
          <span className="whitespace-nowrap rounded-full border border-indigo-100/80 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
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
            {!isMobile && (
              <GlassActionButton
                label={viewMode === 'table' ? "Cards" : "List"}
                icon={viewMode === 'table' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                tone="slate"
                onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                aria-label={viewMode === 'table' ? "Switch to Grid View" : "Switch to List View"}
              />
            )}
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
            <span className="text-xs sm:text-sm font-black tracking-wider text-indigo-900 dark:text-indigo-200 uppercase">
              Staff Summary
            </span>
          </div>
        }
        right={
          <>
            <div className="flex items-center gap-1 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-blue-600 dark:text-blue-400">{stats.total}</span>
              <span className="text-blue-700/85 dark:text-blue-300 font-medium">Total Staff</span>
            </div>
            <div className="flex items-center gap-1 bg-green-50/80 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-green-600 dark:text-green-400">{stats.teaching}</span>
              <span className="text-green-700/85 dark:text-green-300 font-medium">Teaching</span>
            </div>
            <div className="flex items-center gap-1 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-orange-600 dark:text-orange-400">{stats.administration}</span>
              <span className="text-orange-700/85 dark:text-orange-300 font-medium">Administration</span>
            </div>
            <div className="flex items-center gap-1 bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
              <span className="font-bold text-purple-600 dark:text-purple-400">{stats.support}</span>
              <span className="text-purple-700/85 dark:text-purple-300 font-medium">Support</span>
            </div>
            {stats.management > 0 && (
              <div className="flex items-center gap-1 bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{stats.management}</span>
                <span className="text-indigo-700/85 dark:text-indigo-300 font-medium">Management</span>
              </div>
            )}
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 pb-6 space-y-4 sm:space-y-6">
        {/* Show recess status banner if in recess mode */}
        <RecessStatusBanner />

        {/* Expandable Filters */}
        <AnimatePresence>
          {filtersExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Card className="bg-white/80 backdrop-blur-sm border-blue-100/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-semibold text-gray-700">Filter Staff</h4>
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-6 text-xs px-2 text-red-600 hover:text-red-700"
                      >
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Department</Label>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="h-9 text-xs">
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

                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Status</Label>
                      <Select value={statusFilter} onValueChange={statusFilter => setStatusFilter(statusFilter)}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="h-9 text-xs"
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
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {hasActiveFilters ? 'No Staff Found' : 'No Staff Members'}
          </h3>
          <p className="text-gray-600 mb-4">
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
        <AnimatePresence mode="wait">
          {viewMode === 'cards' ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredStaff.map((staff: Staff, index: number) => (
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  index={index}
                  onEdit={() => router.push(`/staff/form?id=${staff.id}`)}
                  onView={() => router.push(`/staff/${staff.id}`)}
                  onDelete={() => handleDeleteStaff(staff.id, `${staff.firstName} ${staff.lastName}`)}
                  isDeleting={deleteStaffMutation.isPending}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Staff Member</TableHead>
                      <TableHead className="font-semibold">Employee ID</TableHead>
                      <TableHead className="font-semibold">Department</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Contact</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((staff: Staff) => (
                      <TableRow key={staff.id} className="hover:bg-gray-50/50">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
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
                              <p className="text-xs text-gray-500">{staff.email}</p>
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
                            <div className="flex items-center text-xs text-gray-600">
                              <Phone className="w-3 h-3 mr-1" />
                              {staff.contactNumber ? (
                                <a 
                                  href={`tel:${staff.contactNumber}`}
                                  className="text-primary hover:underline font-medium cursor-pointer"
                                >
                                  {staff.contactNumber}
                                </a>
                              ) : (
                                staff.contactNumber
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
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
            </motion.div>
          )}
        </AnimatePresence>
      )}
      </div>
    </div>
  );
}

// Staff Card Component
function StaffCard({ 
  staff, 
  index, 
  onEdit, 
  onView, 
  onDelete,
  isDeleting 
}: { 
  staff: Staff; 
  index: number; 
  onEdit: () => void; 
  onView: () => void; 
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="group hover:shadow-lg transition-all duration-300 hover:border-blue-200 overflow-hidden">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                  {staff.firstName[0]}{staff.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <Button
                  variant="link"
                  className="p-0 h-auto font-semibold text-left text-gray-900 hover:text-blue-600"
                  onClick={onView}
                >
                  {staff.firstName} {staff.lastName}
                </Button>
                <p className="text-xs text-gray-500 font-mono">{staff.employeeId}</p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
            <div className="flex items-center justify-between">
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
            </div>
            <p className="text-sm font-medium text-gray-900">{formatStaffRoles(staff.role)}</p>
          </div>

          {/* Contact Info */}
          <div className="space-y-1.5 pt-3 border-t border-gray-100">
            <div className="flex items-center text-xs text-gray-600">
              <Mail className="w-3 h-3 mr-2 flex-shrink-0" />
              <span className="truncate">{staff.email}</span>
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <Phone className="w-3 h-3 mr-2 flex-shrink-0" />
              {staff.contactNumber ? (
                <a 
                  href={`tel:${staff.contactNumber}`}
                  className="text-primary hover:underline font-medium cursor-pointer"
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
    </motion.div>
  );
}
