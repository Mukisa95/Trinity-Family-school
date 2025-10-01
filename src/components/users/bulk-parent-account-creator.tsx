"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCreateBulkParentAccounts } from '@/lib/hooks/use-users';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { Loader2, Users, UserCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { Pupil, Class } from '@/types';

interface BulkParentAccountCreatorProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BulkParentAccountCreator({ onSuccess, onCancel }: BulkParentAccountCreatorProps) {
  const { toast } = useToast();
  const { data: pupils = [] } = usePupils();
  const { data: classes = [] } = useClasses();
  const createBulkParentAccountsMutation = useCreateBulkParentAccounts();

  // State for selection mode
  const [selectionMode, setSelectionMode] = useState<'individual' | 'class'>('individual');
  
  // State for individual pupil selection
  const [selectedPupilIds, setSelectedPupilIds] = useState<string[]>([]);
  
  // State for class selection
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // State for search/filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  // Get pupils that don't have parent accounts yet
  const availablePupils = useMemo(() => {
    return pupils.filter(pupil => pupil.status === 'Active');
  }, [pupils]);

  // Filter pupils based on search and section
  const filteredPupils = useMemo(() => {
    let result = availablePupils;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(pupil => {
        const fullName = `${pupil.firstName} ${pupil.lastName} ${pupil.otherNames || ''}`.toLowerCase();
        return (
          fullName.includes(searchLower) ||
          pupil.admissionNumber.toLowerCase().includes(searchLower) ||
          pupil.className?.toLowerCase().includes(searchLower)
        );
      });
    }

    if (selectedSection && selectedSection !== "all") {
      result = result.filter(pupil => pupil.section === selectedSection);
    }

    return result;
  }, [availablePupils, searchTerm, selectedSection]);

  // Get pupils in selected class
  const pupilsInSelectedClass = useMemo(() => {
    if (!selectedClassId || selectedClassId === "none") return [];
    return filteredPupils.filter(pupil => pupil.classId === selectedClassId);
  }, [filteredPupils, selectedClassId]);

  // Handle individual pupil selection
  const handlePupilSelection = (pupilId: string, checked: boolean) => {
    setSelectedPupilIds(prev => 
      checked 
        ? [...prev, pupilId]
        : prev.filter(id => id !== pupilId)
    );
  };

  // Handle class selection
  const handleClassSelection = (classId: string) => {
    setSelectedClassId(classId);
    // Auto-select all pupils in the class
    if (classId) {
      const classPupilIds = pupilsInSelectedClass.map(p => p.id);
      setSelectedPupilIds(classPupilIds);
    } else {
      setSelectedPupilIds([]);
    }
  };

  // Get final list of pupils to create accounts for
  const finalSelectedPupils = useMemo(() => {
    if (selectionMode === 'class' && selectedClassId && selectedClassId !== "none") {
      return pupilsInSelectedClass;
    }
    return availablePupils.filter(p => selectedPupilIds.includes(p.id));
  }, [selectionMode, selectedClassId, pupilsInSelectedClass, availablePupils, selectedPupilIds]);

  // Handle bulk creation
  const handleBulkCreate = async () => {
    if (finalSelectedPupils.length === 0) {
      toast({
        variant: "destructive",
        title: "No Pupils Selected",
        description: "Please select at least one pupil to create parent accounts for."
      });
      return;
    }

    const confirmed = window.confirm(
      `Create Parent Accounts\n\n` +
      `You are about to create ${finalSelectedPupils.length} parent account(s).\n\n` +
      `This will:\n` +
      `• Generate unique usernames for each parent\n` +
      `• Set default passwords as admission numbers\n` +
      `• Create family IDs if they don't exist\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      const results = await createBulkParentAccountsMutation.mutateAsync({
        pupilIds: finalSelectedPupils.map(p => p.id)
      });

      if (results.successCount > 0) {
        toast({
          title: "Bulk Creation Successful",
          description: `Created ${results.successCount} parent account(s). ${results.failedCount > 0 ? `${results.failedCount} failed.` : ''}`
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: "No parent accounts were created. Please check the errors and try again."
        });
      }

      // Show detailed results if there are failures
      if (results.failedCount > 0) {
        console.log('Bulk creation results:', results);
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create parent accounts."
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedPupilIds([]);
    setSelectedClassId('');
    setSearchTerm('');
    setSelectedSection('');
    setSelectionMode('individual');
  };

  // Get unique sections from pupils
  const sections = useMemo(() => {
    const uniqueSections = [...new Set(availablePupils.map(p => p.section).filter(Boolean))];
    return uniqueSections.sort();
  }, [availablePupils]);

  return (
    <div className="space-y-6">
      {/* Selection Mode Tabs */}
      <div className="flex space-x-2 border-b">
        <button
          onClick={() => setSelectionMode('individual')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectionMode === 'individual'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="inline w-4 h-4 mr-2" />
          Individual Selection
        </button>
        <button
          onClick={() => setSelectionMode('class')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectionMode === 'class'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCheck className="inline w-4 h-4 mr-2" />
          Class Selection
        </button>
      </div>

      {/* Individual Selection Mode */}
      {selectionMode === 'individual' && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Search Pupils</Label>
              <Input
                id="search"
                placeholder="Search by name, admission number, or class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="section">Section</Label>
                             <Select value={selectedSection || "all"} onValueChange={(value) => setSelectedSection(value === "all" ? "" : value)}>
                 <SelectTrigger>
                   <SelectValue placeholder="All Sections" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Sections</SelectItem>
                   {sections.map(section => (
                     <SelectItem key={section} value={section}>
                       {section}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
          </div>

          {/* Pupils List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Available Pupils ({filteredPupils.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredPupils.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No pupils found matching your criteria.</p>
                  </div>
                ) : (
                  filteredPupils.map(pupil => (
                    <div
                      key={pupil.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedPupilIds.includes(pupil.id)}
                        onCheckedChange={(checked) => 
                          handlePupilSelection(pupil.id, checked as boolean)
                        }
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {pupil.firstName} {pupil.lastName}
                          {pupil.otherNames && ` ${pupil.otherNames}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {pupil.admissionNumber} • {pupil.className} • {pupil.section}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {pupil.gender}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Class Selection Mode */}
      {selectionMode === 'class' && (
        <div className="space-y-4">
                     <div>
             <Label htmlFor="class-select">Select Class</Label>
             <Select value={selectedClassId || "none"} onValueChange={(value) => handleClassSelection(value === "none" ? "" : value)}>
               <SelectTrigger>
                 <SelectValue placeholder="Choose a class" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="none">Select a class</SelectItem>
                 {classes.map(cls => (
                   <SelectItem key={cls.id} value={cls.id}>
                     {cls.name} ({cls.level})
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

                     {selectedClassId && selectedClassId !== "none" && (
             <Card>
               <CardHeader>
                 <CardTitle className="text-lg">
                   Pupils in Selected Class ({pupilsInSelectedClass.length})
                 </CardTitle>
               </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {pupilsInSelectedClass.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No pupils found in this class.</p>
                    </div>
                  ) : (
                    pupilsInSelectedClass.map(pupil => (
                      <div
                        key={pupil.id}
                        className="flex items-center space-x-3 p-3 border rounded-lg bg-blue-50"
                      >
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <div className="font-medium">
                            {pupil.firstName} {pupil.lastName}
                            {pupil.otherNames && ` ${pupil.otherNames}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            {pupil.admissionNumber} • {pupil.section}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {pupil.gender}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary and Actions */}
      {finalSelectedPupils.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h3 className="font-medium text-blue-900">
                  Ready to Create {finalSelectedPupils.length} Parent Account(s)
                </h3>
                                 <p className="text-sm text-blue-700">
                   {selectionMode === 'class' && selectedClassId && selectedClassId !== "none"
                     ? `All pupils in ${classes.find(c => c.id === selectedClassId)?.name}`
                     : `${selectedPupilIds.length} pupil(s) selected`
                   }
                 </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900">
                  {finalSelectedPupils.length}
                </div>
                <div className="text-sm text-blue-700">accounts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div className="space-x-2">
          <Button variant="outline" onClick={resetForm}>
            Reset
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        
        <Button
          onClick={handleBulkCreate}
          disabled={createBulkParentAccountsMutation.isPending || finalSelectedPupils.length === 0}
          className="min-w-[200px]"
        >
          {createBulkParentAccountsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Accounts...
            </>
          ) : (
            <>
              <UserCheck className="mr-2 h-4 w-4" />
              Create {finalSelectedPupils.length} Account(s)
            </>
          )}
        </Button>
      </div>

      {/* Progress Indicator */}
      {createBulkParentAccountsMutation.isPending && (
        <div className="text-center py-4">
          <div className="inline-flex items-center space-x-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating parent accounts...</span>
          </div>
        </div>
      )}
    </div>
  );
}
