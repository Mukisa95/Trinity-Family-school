"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Edit, Trash2, BookOpen, Loader2 } from "lucide-react";
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
import { FieldError, FormErrorSummary } from "@/components/ui/form-feedback";
import { createFieldValidation, useFormValidation } from "@/lib/utils/form-validation";

interface SubjectManagementProps {
  addTrigger: number;
}

export function SubjectManagement({ addTrigger }: SubjectManagementProps) {
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
  const formValidation = useFormValidation([
    createFieldValidation('subjectName', name, 'Subject name', true, { message: 'Enter the subject name.' }),
    createFieldValidation('subjectCode', code, 'Subject code', true, { message: 'Enter the subject code.' }),
    createFieldValidation('subjectType', type, 'Subject type', true, { message: 'Choose the subject type.' }),
  ]);

  // Listen to parent adding trigger
  React.useEffect(() => {
    if (addTrigger > 0) {
      handleAddSubject();
    }
  }, [addTrigger]);

  const resetForm = () => {
    setName("");
    setCode("");
    setType("Core");
    setEditingSubject(null);
    formValidation.resetValidation();
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
    if (window.confirm("Are you sure you want to delete this subject?")) {
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
    }
  };

  const handleSubmit = async () => {
    if (!formValidation.validateAll().isValid) return;

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
      formValidation.setSubmissionError(`Failed to ${editingSubject ? 'update' : 'create'} subject. Please try again.`);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${editingSubject ? 'update' : 'create'} subject. Please try again.`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-2">Loading subjects data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive py-16">
        Error loading subjects. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
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
                  <TableCell>
                    {subject.createdAt ? (
                      (() => {
                        try {
                          return format(new Date(subject.createdAt), 'dd MMM yyyy');
                        } catch {
                          return 'N/A';
                        }
                      })()
                    ) : 'N/A'}
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
          <div className="px-2">
            <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={(fieldId) => void formValidation.focusField(fieldId)} />
          </div>
          
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
                  <Label htmlFor="subjectName" className={`text-[0.6rem] ${formValidation.getFieldError('subjectName') ? 'text-destructive' : ''}`}>Subject Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="subjectName"
                    value={name} 
                    onChange={(e) => { setName(e.target.value.toUpperCase()); formValidation.handleFieldChange('subjectName'); }}
                    {...formValidation.getFieldProps('subjectName')}
                    placeholder="e.g., MATHEMATICS"
                    className="h-6 text-[0.65rem]" 
                  />
                  <FieldError error={formValidation.getFieldError('subjectName')} className="text-[0.6rem]" />
                </div>
                <div>
                  <Label htmlFor="subjectCode" className={`text-[0.6rem] ${formValidation.getFieldError('subjectCode') ? 'text-destructive' : ''}`}>Subject Code <span className="text-destructive">*</span></Label>
                  <Input 
                    id="subjectCode"
                    value={code} 
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); formValidation.handleFieldChange('subjectCode'); }}
                    {...formValidation.getFieldProps('subjectCode')}
                    placeholder="e.g., MATH"
                    className="h-6 text-[0.65rem]" 
                  />
                  <FieldError error={formValidation.getFieldError('subjectCode')} className="text-[0.6rem]" />
                </div>
                <div>
                  <Label htmlFor="type" className="text-[0.6rem]">Subject Type <span className="text-destructive">*</span></Label>
                  <Select value={type} onValueChange={(value) => { setType(value as Subject["type"]); formValidation.handleFieldChange('subjectType'); }}>
                    <SelectTrigger className="h-6 text-[0.65rem]" {...formValidation.getFieldProps('subjectType')}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="text-[0.65rem]">
                      {SUBJECT_TYPES.map(stype => (
                        <SelectItem key={stype} value={stype}>{stype}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={formValidation.getFieldError('subjectType')} className="text-[0.6rem]" />
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
    </div>
  );
}
