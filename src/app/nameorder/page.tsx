"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  RotateCcw, 
  Search, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Upload
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { usePupils, useUpdatePupil } from '@/lib/hooks/use-pupils';
import { PageHeader } from '@/components/common/page-header';
import type { Pupil } from '@/types';

interface NameOrderChange {
  pupilId: string;
  originalFirstName: string;
  originalLastName: string;
  originalOtherNames?: string;
  newFirstName: string;
  newLastName: string;
  newOtherNames?: string;
  currentDisplay: string;
  newDisplay: string;
}

interface PupilNameState {
  id: string;
  originalData: {
    firstName: string;
    lastName: string;
    otherNames?: string;
  };
  currentData: {
    firstName: string;
    lastName: string;
    otherNames?: string;
  };
  hasChanges: boolean;
  selected: boolean;
}

export default function NameOrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: pupils = [], isLoading } = usePupils();
  const updatePupilMutation = useUpdatePupil();

  // State management
  const [pupilStates, setPupilStates] = useState<Record<string, PupilNameState>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, changed, issues
  const [showPreview, setShowPreview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  // Initialize pupil states when data loads
  React.useEffect(() => {
    if (pupils.length > 0 && Object.keys(pupilStates).length === 0) {
      const initialStates: Record<string, PupilNameState> = {};
      
      pupils.forEach(pupil => {
        initialStates[pupil.id] = {
          id: pupil.id,
          originalData: {
            firstName: pupil.firstName || '',
            lastName: pupil.lastName || '',
            otherNames: pupil.otherNames || ''
          },
          currentData: {
            firstName: pupil.firstName || '',
            lastName: pupil.lastName || '',
            otherNames: pupil.otherNames || ''
          },
          hasChanges: false,
          selected: false
        };
      });
      
      setPupilStates(initialStates);
    }
  }, [pupils, pupilStates]);

  // Helper functions
  const getCurrentDisplayName = (data: { firstName: string; lastName: string; otherNames?: string }) => {
    return `${data.firstName} ${data.lastName}${data.otherNames ? ` ${data.otherNames}` : ''}`;
  };

  const getCorrectDisplayName = (data: { firstName: string; lastName: string; otherNames?: string }) => {
    return `${data.lastName}, ${data.firstName}${data.otherNames ? ` ${data.otherNames}` : ''}`;
  };

  const swapFirstAndLastName = (pupilId: string) => {
    setPupilStates(prev => {
      const pupilState = prev[pupilId];
      if (!pupilState) return prev;

      const swappedData = {
        firstName: pupilState.currentData.lastName,
        lastName: pupilState.currentData.firstName,
        otherNames: pupilState.currentData.otherNames
      };

      return {
        ...prev,
        [pupilId]: {
          ...pupilState,
          currentData: swappedData,
          hasChanges: JSON.stringify(swappedData) !== JSON.stringify(pupilState.originalData)
        }
      };
    });
  };

  const updatePupilName = (pupilId: string, field: 'firstName' | 'lastName' | 'otherNames', value: string) => {
    setPupilStates(prev => {
      const pupilState = prev[pupilId];
      if (!pupilState) return prev;

      const updatedData = {
        ...pupilState.currentData,
        [field]: value
      };

      return {
        ...prev,
        [pupilId]: {
          ...pupilState,
          currentData: updatedData,
          hasChanges: JSON.stringify(updatedData) !== JSON.stringify(pupilState.originalData)
        }
      };
    });
  };

  const resetPupilChanges = (pupilId: string) => {
    setPupilStates(prev => {
      const pupilState = prev[pupilId];
      if (!pupilState) return prev;

      return {
        ...prev,
        [pupilId]: {
          ...pupilState,
          currentData: { ...pupilState.originalData },
          hasChanges: false
        }
      };
    });
  };

  const togglePupilSelection = (pupilId: string) => {
    setPupilStates(prev => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        selected: !prev[pupilId]?.selected
      }
    }));
  };

  const selectAllVisible = () => {
    const visiblePupilIds = filteredPupils.map(p => p.id);
    setPupilStates(prev => {
      const updated = { ...prev };
      visiblePupilIds.forEach(id => {
        if (updated[id]) {
          updated[id] = { ...updated[id], selected: true };
        }
      });
      return updated;
    });
  };

  const deselectAll = () => {
    setPupilStates(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        updated[id] = { ...updated[id], selected: false };
      });
      return updated;
    });
  };

  const bulkSwapNames = () => {
    const selectedIds = Object.keys(pupilStates).filter(id => pupilStates[id]?.selected);
    selectedIds.forEach(id => swapFirstAndLastName(id));
  };

  // Filtered and computed data
  const filteredPupils = useMemo(() => {
    if (!pupils.length) return [];

    return pupils.filter(pupil => {
      const pupilState = pupilStates[pupil.id];
      if (!pupilState) return false;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const currentName = getCurrentDisplayName(pupilState.currentData).toLowerCase();
        const admissionNumber = pupil.admissionNumber?.toLowerCase() || '';
        
        if (!currentName.includes(searchLower) && !admissionNumber.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (selectedFilter === 'changed' && !pupilState.hasChanges) return false;
      if (selectedFilter === 'issues') {
        // Define issues as missing names or very short names
        const hasIssues = !pupilState.currentData.firstName || 
                         !pupilState.currentData.lastName ||
                         pupilState.currentData.firstName.length < 2 ||
                         pupilState.currentData.lastName.length < 2;
        if (!hasIssues) return false;
      }

      return true;
    });
  }, [pupils, pupilStates, searchTerm, selectedFilter]);

  const changesCount = Object.values(pupilStates).filter(state => state.hasChanges).length;
  const selectedCount = Object.values(pupilStates).filter(state => state.selected).length;

  // Save changes
  const handleSaveChanges = async () => {
    if (changesCount === 0) {
      toast({
        title: "No Changes",
        description: "No changes have been made to save.",
        variant: "default"
      });
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const changedStates = Object.values(pupilStates).filter(state => state.hasChanges);
      
      for (const pupilState of changedStates) {
        try {
          await updatePupilMutation.mutateAsync({
            id: pupilState.id,
            data: {
              firstName: pupilState.currentData.firstName,
              lastName: pupilState.currentData.lastName,
              otherNames: pupilState.currentData.otherNames || undefined,
              updatedAt: new Date().toISOString(),
              nameOrderCorrected: true
            }
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to update pupil ${pupilState.id}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Names Updated",
          description: `Successfully updated ${successCount} pupil names${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
        });

        // Reset the original data to current data for successfully updated pupils
        setPupilStates(prev => {
          const updated = { ...prev };
          Object.values(updated).forEach(state => {
            if (state.hasChanges) {
              state.originalData = { ...state.currentData };
              state.hasChanges = false;
            }
          });
          return updated;
        });
      }

      if (errorCount > 0) {
        toast({
          title: "Some Updates Failed",
          description: `${errorCount} pupil names could not be updated. Please try again.`,
          variant: "destructive"
        });
      }

    } catch (error) {
      toast({
        title: "Save Failed",
        description: "An error occurred while saving changes.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
      setShowConfirmDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <PageHeader 
          title="Name Order Management"
          description="Loading pupil data..."
        />
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="Name Order Management" 
        description="Organize and correct pupil name ordering throughout the system"
      >
        <Button variant="outline" onClick={() => router.push('/pupils')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pupils
        </Button>
      </PageHeader>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Search Pupils</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or admission number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filter View</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pupils ({pupils.length})</SelectItem>
                <SelectItem value="changed">Changed ({changesCount})</SelectItem>
                <SelectItem value="issues">Issues Found</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="bulkMode"
                checked={bulkSelectMode}
                onCheckedChange={setBulkSelectMode}
              />
              <Label htmlFor="bulkMode" className="text-sm">Select Mode</Label>
            </div>
            {bulkSelectMode && (
              <div className="space-y-1">
                <Button size="sm" variant="outline" onClick={selectAllVisible} className="w-full text-xs">
                  Select All Visible
                </Button>
                <Button size="sm" variant="outline" onClick={deselectAll} className="w-full text-xs">
                  Deselect All
                </Button>
                {selectedCount > 0 && (
                  <Button size="sm" onClick={bulkSwapNames} className="w-full text-xs">
                    Swap Names ({selectedCount})
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="showPreview"
                checked={showPreview}
                onCheckedChange={setShowPreview}
              />
              <Label htmlFor="showPreview" className="text-sm">Show Preview</Label>
            </div>
            <Button 
              onClick={() => setShowConfirmDialog(true)}
              disabled={changesCount === 0 || isSaving}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes ({changesCount})
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      {(changesCount > 0 || selectedCount > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4 text-sm">
              {changesCount > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {changesCount} changes pending
                </Badge>
              )}
              {selectedCount > 0 && bulkSelectMode && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {selectedCount} selected
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pupils List */}
      <div className="space-y-4">
        {filteredPupils.map(pupil => {
          const pupilState = pupilStates[pupil.id];
          if (!pupilState) return null;

          const currentDisplay = getCurrentDisplayName(pupilState.currentData);
          const correctDisplay = getCorrectDisplayName(pupilState.currentData);
          const hasIssues = !pupilState.currentData.firstName || 
                           !pupilState.currentData.lastName ||
                           pupilState.currentData.firstName.length < 2 ||
                           pupilState.currentData.lastName.length < 2;

          return (
            <Card key={pupil.id} className={`${pupilState.hasChanges ? 'border-blue-200 bg-blue-50' : ''} ${hasIssues ? 'border-red-200 bg-red-50' : ''}`}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                  {/* Pupil Info */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {bulkSelectMode && (
                        <Checkbox
                          checked={pupilState.selected}
                          onCheckedChange={() => togglePupilSelection(pupil.id)}
                        />
                      )}
                      <div>
                        <div className="font-medium text-sm">{pupil.admissionNumber}</div>
                        <div className="text-xs text-gray-500">{pupil.className}</div>
                        {hasIssues && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            Issues Found
                          </Badge>
                        )}
                        {pupilState.hasChanges && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Modified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium text-gray-600">Surname</Label>
                      <Input
                        value={pupilState.currentData.lastName}
                        onChange={(e) => updatePupilName(pupil.id, 'lastName', e.target.value.toUpperCase())}
                        className="text-sm"
                        placeholder="Enter surname"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-600">First Name</Label>
                      <Input
                        value={pupilState.currentData.firstName}
                        onChange={(e) => updatePupilName(pupil.id, 'firstName', e.target.value.toUpperCase())}
                        className="text-sm"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-600">Other Names</Label>
                      <Input
                        value={pupilState.currentData.otherNames || ''}
                        onChange={(e) => updatePupilName(pupil.id, 'otherNames', e.target.value.toUpperCase())}
                        className="text-sm"
                        placeholder="Enter other names (optional)"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {showPreview && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Current Display</Label>
                        <div className="p-2 bg-gray-100 rounded text-sm font-medium">
                          {currentDisplay}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Correct Format</Label>
                        <div className="p-2 bg-green-100 rounded text-sm font-medium text-green-800">
                          {correctDisplay}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => swapFirstAndLastName(pupil.id)}
                      className="text-xs"
                    >
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      Swap Names
                    </Button>
                    {pupilState.hasChanges && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resetPupilChanges(pupil.id)}
                        className="text-xs text-gray-600"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredPupils.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-gray-500">
                {searchTerm ? 'No pupils match your search criteria.' : 'No pupils found.'}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Name Changes</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                You are about to save changes for <strong>{changesCount}</strong> pupils.
              </div>
              <div className="text-sm text-gray-600">
                This will update the database with the corrected name ordering. 
                The changes cannot be easily undone.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? 'Saving...' : `Save ${changesCount} Changes`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}