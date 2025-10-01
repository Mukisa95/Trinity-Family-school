"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, GraduationCap, Loader2, UserPlus, UserCircle2, Search, Filter, X, Grid3X3, List, Users, Phone, Mail, Building, Calendar, MapPin } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
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

  const hasActiveFilters = searchTerm || departmentFilter !== 'all' || statusFilter !== 'all';

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Staff Management" 
          description="Manage staff registration, profiles, and roles."
        />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading staff...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader 
          title="Staff Management" 
          description="Manage staff registration, profiles, and roles."
        />
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
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title="Staff Management"
        description="Manage staff registration, profiles, and roles."
        actions={
          <Button onClick={() => router.push('/staff/form')} className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" /> 
            <span className="hidden sm:inline">Add New Staff</span>
            <span className="sm:hidden">Add Staff</span>
          </Button>
        }
      />
      
      {/* Show recess status banner if in recess mode */}
      <RecessStatusBanner />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-blue-600 font-medium">Total Staff</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-green-600 font-medium">Teaching</p>
                <p className="text-lg sm:text-2xl font-bold text-green-700">{stats.teaching}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <Building className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-orange-600 font-medium">Administration</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-700">{stats.administration}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <UserCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-purple-600 font-medium">Support</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-700">{stats.support}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add new Management card if needed or adjust layout */}
      {stats.management > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 mt-3 sm:mt-4">
          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-indigo-600 font-medium">Management</p>
                  <p className="text-lg sm:text-2xl font-bold text-indigo-700">{stats.management}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="bg-white/80 backdrop-blur-sm border-blue-100/50">
        <CardContent className="p-3 sm:p-4">
          {/* Top Row: Search and View Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search staff by name, ID, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 h-9 sm:h-10 text-sm"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={cn(
                "h-9 sm:h-10 px-3",
                hasActiveFilters && "bg-blue-50 border-blue-200 text-blue-700"
              )}
            >
              <Filter className="h-4 w-4 mr-1.5" />
              Filter
            </Button>

            {!isMobile && (
              <div className="flex border rounded-md overflow-hidden">
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className="h-9 px-3 rounded-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-9 px-3 rounded-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

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
                <div className="pt-3 border-t border-gray-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">Department</Label>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="h-8 text-xs">
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
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 text-xs">
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
                        className="h-8 text-xs"
                        disabled={!hasActiveFilters}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {filteredStaff.length} staff member{filteredStaff.length !== 1 ? 's' : ''} found
          {hasActiveFilters && ` (filtered from ${staffList.length} total)`}
        </p>
        {hasActiveFilters && (
          <Badge variant="secondary" className="text-xs">
            Filtered Results
          </Badge>
        )}
      </div>

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
