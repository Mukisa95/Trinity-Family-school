"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, BookOpen, Loader2 } from "lucide-react";
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
import type { Subject } from "@/types";
import { SUBJECT_TYPES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject } from "@/lib/hooks/use-subjects";
import { useToast } from "@/hooks/use-toast";


export default function SubjectsPage() {
  const { toast } = useToast();
  
  // Firebase hooks
  const { data: subjects = [], isLoading, error } = useSubjects();
  const createSubjectMutation = useCreateSubject();
  const updateSubjectMutation = useUpdateSubject();
  const deleteSubjectMutation = useDeleteSubject();
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingSubject, setEditingSubject] = React.useState<Subject | null>(null);

  // Form state
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [type, setType] = React.useState<Subject["type"]>("Core");

  const resetForm = () => {
    setName("");
    setCode("");
    setType("Core");
    setEditingSubject(null);
  };

  const handleAddSubject = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setName(subject.name);
    setCode(subject.code);
    setType(subject.type);
    setIsDialogOpen(true);
  };

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      await deleteSubjectMutation.mutateAsync(subjectId);
      toast({
        title: "Subject Deleted",
        description: "The subject has been successfully deleted.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete subject. Please try again.",
      });
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields.",
      });
      return;
    }

    const subjectData = {
      name: name.trim(),
      code: code.trim(),
      type,
    };

    try {
      if (editingSubject) {
        await updateSubjectMutation.mutateAsync({
          id: editingSubject.id,
          data: subjectData,
        });
        toast({
          title: "Subject Updated",
          description: "The subject has been successfully updated.",
        });
      } else {
        await createSubjectMutation.mutateAsync(subjectData);
        toast({
          title: "Subject Created",
          description: "The subject has been successfully created.",
        });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${editingSubject ? 'update' : 'create'} subject. Please try again.`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Subject Management" />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading subjects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Subject Management" />
        <div className="text-center text-destructive py-8">
          Error loading subjects. Please try again.
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Subject Management"
        description="Create, view, edit, and delete subjects."
        actions={
          <Button onClick={handleAddSubject}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Subject
          </Button>
        }
      />
      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox aria-label="Select all rows" />
              </TableHead>
              <TableHead>Subject Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No subjects found.
                </TableCell>
              </TableRow>
            ) : (
              subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell>
                    <Checkbox aria-label={`Select row ${subject.id}`} />
                  </TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.code}</TableCell>
                  <TableCell><Badge variant={subject.type === 'Core' ? 'default' : 'secondary'}>{subject.type}</Badge></TableCell>
                  <TableCell>{format(new Date(subject.createdAt), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEditSubject(subject)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteSubject(subject.id)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
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

      <ModernDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ModernDialogContent 
          size="xl" 
          className="w-[95vw] max-w-2xl" 
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <ModernDialogHeader className="p-2">
            <ModernDialogTitle className="text-sm">{editingSubject ? "Edit Subject" : "Add New Subject"}</ModernDialogTitle>
            <ModernDialogDescription className="text-[0.65rem]">
              {editingSubject ? "Update the subject details below." : "Fill in the details for the new subject."}
            </ModernDialogDescription>
          </ModernDialogHeader>
          
          {/* Academic Context Banner */}
          <div className={`mx-1 sm:mx-2 mt-1 sm:mt-2 p-1 border rounded-md text-[0.6rem] ${editingSubject ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex flex-wrap gap-1 items-center">
              <div className="flex items-center gap-0.5">
                <BookOpen className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-medium">Subject Management</span>
              </div>
              <div>
                <strong>Date:</strong> {format(new Date(), "MMM dd, yyyy")}
              </div>
              <div className={`text-[0.5rem] px-1 py-0.5 rounded ml-auto ${editingSubject ? 'text-amber-700 bg-amber-100' : 'text-green-700 bg-green-100'}`}>
                {editingSubject ? 'Edit Mode' : 'Create Mode'}
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-grow min-h-0 overflow-y-auto p-0">
            <div className="grid gap-1.5 py-1.5 px-1 sm:px-2">
              {/* Compact 3-column layout */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <div>
                  <Label htmlFor="name" className="text-[0.6rem]">Subject Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value.toUpperCase())} 
                    placeholder="e.g., MATHEMATICS"
                    className="h-6 text-[0.65rem]" 
                  />
                </div>
                <div>
                  <Label htmlFor="code" className="text-[0.6rem]">Subject Code <span className="text-destructive">*</span></Label>
                  <Input 
                    id="code" 
                    value={code} 
                    onChange={(e) => setCode(e.target.value.toUpperCase())} 
                    placeholder="e.g., MATH"
                    className="h-6 text-[0.65rem]" 
                  />
                </div>
                <div>
                  <Label htmlFor="type" className="text-[0.6rem]">Subject Type <span className="text-destructive">*</span></Label>
                  <Select value={type} onValueChange={(value) => setType(value as Subject["type"])}>
                    <SelectTrigger className="h-6 text-[0.65rem]">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="text-[0.65rem]">
                      {SUBJECT_TYPES.map(stype => (
                        <SelectItem key={stype} value={stype}>{stype}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>

          <ModernDialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-1 sm:gap-0 p-1 sm:p-2 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)} 
              className="w-full sm:w-auto text-[0.65rem] h-6"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              disabled={createSubjectMutation.isPending || updateSubjectMutation.isPending}
              className="w-full sm:w-auto text-[0.65rem] h-6"
            >
              {(createSubjectMutation.isPending || updateSubjectMutation.isPending) && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              {editingSubject ? 'Update Subject' : 'Create Subject'}
            </Button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
    </>
  );
}
