"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, BookOpen, Eye, Search, X, Users, UserCheck, UserX, GraduationCap, InfoIcon } from "lucide-react";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import Firebase hooks and types
import { 
  usePLERecords, 
  useCreatePLERecord, 
  useDeletePLERecord, 
  useP7Pupils 
} from "@/lib/hooks/use-ple-results";
import type { PLERecord } from "@/lib/services/ple-results.service";

// Helper function to safely format dates
const formatDate = (dateValue: any): string => {
  try {
    let date: Date;
    
    // Handle Firestore Timestamp with toDate method
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      date = dateValue.toDate();
    }
    // Handle Firestore Timestamp with seconds/nanoseconds properties
    else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
      // Convert Firestore timestamp to JavaScript Date
      date = new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    // Handle ISO string
    else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    }
    // Handle Date object
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    // Handle timestamp number
    else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    }
    else {
      console.log('Unhandled date format:', dateValue);
      return 'N/A';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.log('Invalid date created from:', dateValue);
      return 'N/A';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error, dateValue);
    return 'N/A';
  }
};

export default function PLEResultsPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  // Firebase hooks
  const { data: pleRecords = [], isLoading, error } = usePLERecords();
  const { data: p7Pupils = [], isLoading: p7PupilsLoading } = useP7Pupils();
  const createPLERecordMutation = useCreatePLERecord();
  const deletePLERecordMutation = useDeletePLERecord();
  
  // State management
  const [mounted, setMounted] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState<string>("all");
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [recordToDelete, setRecordToDelete] = React.useState<PLERecord | null>(null);
  
  // Form state
  const [newRecordYear, setNewRecordYear] = React.useState<number>(new Date().getFullYear());

  // Mount effect
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle error state
  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load PLE records. Please try again.",
      });
    }
  }, [error, toast]);

  // Filter records based on search and year
  const filteredRecords = React.useMemo(() => {
    // Debug: Log the first record to see the date format
    if (pleRecords.length > 0) {
      console.log('Sample PLE record:', pleRecords[0]);
      console.log('CreatedAt value:', pleRecords[0].createdAt);
      console.log('CreatedAt type:', typeof pleRecords[0].createdAt);
    }
    
    return pleRecords.filter(record => {
      const matchesSearch = record.examName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           record.year.toString().includes(searchTerm);
      const matchesYear = selectedYear === "all" || record.year.toString() === selectedYear;
      return matchesSearch && matchesYear;
    });
  }, [pleRecords, searchTerm, selectedYear]);

  // Get unique years for filter
  const availableYears = React.useMemo(() => {
    const years = [...new Set(pleRecords.map(record => record.year))];
    return years.sort((a, b) => b - a); // Sort descending
  }, [pleRecords]);

  // Handle create new PLE record
  const handleCreateRecord = async () => {
    try {
      if (p7Pupils.length === 0) {
        toast({
          variant: "destructive",
          title: "No P.7 Pupils Found",
          description: "No P.7 pupils found in the system. Please ensure P.7 pupils are registered.",
        });
        return;
      }

      await createPLERecordMutation.mutateAsync({
        examName: `PLE ${newRecordYear}`,
        year: newRecordYear,
        pupilsSnapshot: p7Pupils,
      });
      
      toast({
        title: "PLE Record Created",
        description: `PLE ${newRecordYear} record created with ${p7Pupils.length} candidates.`,
      });
      
      setIsCreateModalOpen(false);
      setNewRecordYear(new Date().getFullYear());
    } catch (error) {
      console.error('Error creating PLE record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create PLE record. Please try again.",
      });
    }
  };

  // Handle delete record
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    
    try {
      await deletePLERecordMutation.mutateAsync(recordToDelete.id);
      
      toast({
        title: "PLE Record Deleted",
        description: `${recordToDelete.examName} has been deleted successfully.`,
      });
      
      setIsDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error('Error deleting PLE record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete PLE record. Please try again.",
      });
    }
  };

  // Navigation handlers
  const handleRecordResults = (record: PLERecord) => {
    router.push(`/exams/ple-results/${record.id}/record-results`);
  };

  const handleViewResults = (record: PLERecord) => {
    router.push(`/exams/ple-results/${record.id}/view-results`);
  };

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-4 space-y-6">
          <PageHeader title="PLE Results Management" />
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading PLE records...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <PageHeader
          title="PLE Results Management"
          description="Manage Primary Leaving Examination records and results by year."
          actions={
            <Button 
              onClick={() => setIsCreateModalOpen(true)} 
              type="button"
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> 
              <span className="hidden sm:inline">Create PLE Record</span>
              <span className="sm:hidden">New</span>
            </Button>
          }
        />

        {/* Filters Section */}
        <div className="rounded-lg border shadow-sm bg-white">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search PLE records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0" 
                      onClick={() => setSearchTerm('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Year Filter */}
              <div className="w-full sm:w-48">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* PLE Records Table */}
        <div className="rounded-lg border shadow-sm bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam Name</TableHead>
                <TableHead>Year</TableHead>
                <TableHead className="text-center">Total Candidates</TableHead>
                <TableHead className="text-center">Male</TableHead>
                <TableHead className="text-center">Female</TableHead>
                <TableHead className="text-center">Created</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="h-8 w-8 text-gray-400" />
                      <p className="text-gray-500">No PLE records found</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsCreateModalOpen(true)}
                      >
                        Create First PLE Record
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-purple-600" />
                        {record.examName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {record.year}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold">{record.totalCandidates}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <UserCheck className="h-4 w-4 text-blue-500" />
                        <span>{record.maleCandidates}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <UserX className="h-4 w-4 text-pink-500" />
                        <span>{record.femaleCandidates}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-500">
                      {formatDate(record.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleRecordResults(record)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Record Results
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewResults(record)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Results
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              setRecordToDelete(record);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create PLE Record Modal */}
        <ModernDialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <ModernDialogContent open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <ModernDialogHeader>
              <ModernDialogTitle>Create New PLE Record</ModernDialogTitle>
              <ModernDialogDescription>
                Create a new PLE record for a specific year. This will automatically capture all P.7 pupils data.
              </ModernDialogDescription>
            </ModernDialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="year">PLE Year</Label>
                <Select 
                  value={newRecordYear.toString()} 
                  onValueChange={(value) => setNewRecordYear(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() + 2 - i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <InfoIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">Auto-capture Information</p>
                    <p className="text-blue-800 mt-1">
                      This will automatically capture all current P.7 pupils including their names, 
                      date of birth, pupil identification numbers, and gender for PLE {newRecordYear}.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <ModernDialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createPLERecordMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateRecord}
                disabled={createPLERecordMutation.isPending || p7PupilsLoading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {createPLERecordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create PLE Record
                  </>
                )}
              </Button>
            </ModernDialogFooter>
          </ModernDialogContent>
        </ModernDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete PLE Record</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {recordToDelete?.examName}? This action cannot be undone and will remove all associated results.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteRecord}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
} 